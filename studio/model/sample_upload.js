import { crc32 } from '../hostlink/frame.js';
import { HostLinkError } from '../hostlink/client.js';
import { readWavMarkers, labelMask } from './wav.js';

export const SAMPLE_UPLOAD_COMMAND = Object.freeze({ BEGIN: 0x70, CHUNK: 0x71, COMMIT: 0x72, ABORT: 0x73, RESCAN: 0x74, BREAK: 0x75, BEATS: 0x76 });

function u32(value) { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value >>> 0, true); return out; }
function concat(...parts) { const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let at = 0; for (const part of parts) { out.set(part, at); at += part.length; } return out; }
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function pcm16FromWav(wav) {
  if (!(wav instanceof Uint8Array) || wav.length < 44) throw new RangeError('Converted WAV is incomplete');
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (at) => String.fromCharCode(...wav.subarray(at, at + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new RangeError('Converted WAV is invalid');
  let channels; let sampleRate; let bits; let data; let rootNote = 60; let breakBytes = null; let beats = 0;
  for (let at = 12; at + 8 <= wav.length;) {
    const size = view.getUint32(at + 4, true); const start = at + 8; const end = start + size;
    if (end > wav.length) throw new RangeError('Converted WAV is truncated');
    if (tag(at) === 'fmt ') { channels = view.getUint16(start + 2, true); sampleRate = view.getUint32(start + 4, true); bits = view.getUint16(start + 14, true); }
    if (tag(at) === 'acid' && size >= 6) {
      const taggedRoot = view.getUint16(start + 4, true);
      if (taggedRoot <= 127) rootNote = taggedRoot;
      if (size >= 24 && view.getFloat32(start + 20, true) > 0) beats = view.getUint32(start + 12, true);   // the file's length in beats (acid dwNumBeats)
    }
    if (tag(at) === 'pvxp' && size >= 3) breakBytes = wav.slice(start, end);   // the Break patterns Studio put in the file
    if (tag(at) === 'data') data = wav.slice(start, end);
    at = end + (size & 1);
  }
  if (!data || (channels !== 1 && channels !== 2) || bits !== 16 || !sampleRate || data.length % (channels * 2)) throw new RangeError('Converted WAV is not mono or stereo PCM16');
  return { bytes: data, channels, sampleRate, frames: data.length / (channels * 2), rootNote, slices: sliceBlockFromWav(wav), breakBytes, beats };
}

/**
 * The slice block of a Begin frame, taken from the WAV Studio exported (so Send-to-voice and Write-to-SD can never disagree):
 * u8 version(1) | u8 flags (bit 0 one-shot) | u8 play mode | u8 step | u8 filter | u8 count | count x u32 starts |
 * u8 type count (0 or count) | type bytes. Returns null when the file has no usable cue list.
 */
export function sliceBlockFromWav(wav) {
  const marks = readWavMarkers(wav);
  if (!marks || marks.slices.length < 2 || marks.slices.length > 32) return null;
  const types = marks.labels.length === marks.slices.length ? marks.labels.map(labelMask) : [];
  const out = [1, marks.oneShot ? 1 : 0, marks.playMode, marks.step, marks.playFilter, marks.slices.length];
  for (const start of marks.slices) out.push(start & 255, (start >>> 8) & 255, (start >>> 16) & 255, (start >>> 24) & 255);
  out.push(types.length, ...types);
  return Uint8Array.from(out);
}

export class SampleUploadClient {
  constructor(client, info, { retries = 3, busyDelayMs = 4 } = {}) { this.client = client; this.info = info; this.retries = retries; this.busyDelayMs = busyDelayMs; }

  async upload({ voice, bytes, frames, channels, sampleRate, rootNote = 60, slices = null, breakBytes = null, beats = 0, onProgress = () => {}, signal }) {
    if (voice !== 0 && voice !== 1) throw new RangeError('Voice must be 1 or 2');
    if (!(bytes instanceof Uint8Array) || bytes.length !== frames * channels * 2) throw new RangeError('PCM byte count does not match the sample');
    const totalCrc = crc32(bytes);
    const plainBegin = concat(Uint8Array.of(voice), u32(frames), Uint8Array.of(channels), u32(sampleRate), Uint8Array.of(rootNote), u32(totalCrc));
    let begin = slices ? concat(plainBegin, slices) : plainBegin;
    let slicesSent = Boolean(slices);
    try {
      const beginDeadline = Date.now() + 5000;
      for (;;) {
        this.#notAborted(signal);
        try { await this.client.request(SAMPLE_UPLOAD_COMMAND.BEGIN, begin); break; }
        catch (error) {
          // Firmware from before slice markers answers "bad arguments" to the longer frame: send the plain sample instead.
          if (slicesSent && error instanceof HostLinkError && error.status === 2) { begin = plainBegin; slicesSent = false; continue; }
          if (!(error instanceof HostLinkError) || error.status !== 9 || Date.now() >= beginDeadline) throw error;
          await delay(this.busyDelayMs);
        }
      }
      // Break patterns ride along when the file has them and the slice table was accepted (they point at slices).
      let patternsSent = false;
      if (breakBytes && slicesSent) patternsSent = await this.#sendPatterns(breakBytes, signal);
      // The file's length in beats: Break then needs no Loop bars. An older firmware answers Unsupported / bad arguments and goes on without.
      if (beats > 0 && beats <= 0xFFFF) {
        try { await this.client.request(SAMPLE_UPLOAD_COMMAND.BEATS, Uint8Array.of(beats & 255, beats >> 8)); }
        catch (error) { if (!(error instanceof HostLinkError && (error.status === 1 || error.status === 2))) throw error; }
      }
      const maximum = this.info.maxBody - 8;
      if (maximum <= 0) throw new Error('The module reports a HostLink frame size too small for sample upload');
      let sequence = 0;
      for (let offset = 0; offset < bytes.length; offset += maximum, sequence += 1) {
        this.#notAborted(signal);
        const chunk = bytes.subarray(offset, offset + maximum);
        const body = concat(u32(sequence), u32(crc32(chunk)), chunk);
        const response = await this.#retryChunk(body, signal);
        if (response.body.length !== 8) throw new Error('The module returned an invalid sample upload acknowledgement');
        const view = new DataView(response.body.buffer, response.body.byteOffset, response.body.byteLength);
        if (view.getUint32(0, true) !== sequence + 1 || view.getUint32(4, true) !== offset + chunk.length) throw new Error('The module acknowledged the wrong sample chunk');
        onProgress((offset + chunk.length) / bytes.length);
      }
      this.#notAborted(signal);
      await this.client.request(SAMPLE_UPLOAD_COMMAND.COMMIT);
      onProgress(1);
      return { slicesSent, patternsSent };
    } catch (error) {
      try { await this.client.request(SAMPLE_UPLOAD_COMMAND.ABORT); } catch { /* preserve the original error */ }
      if (error?.name === 'AbortError') throw error;
      if (error instanceof HostLinkError && error.status === 17) throw new Error('Stop sampler recording before sending a sample', { cause: error });
      if (error instanceof HostLinkError && error.status === 18) throw new Error('The sampler slot is busy loading from the SD card', { cause: error });
      if (error instanceof HostLinkError && error.status === 9) throw new Error('The module could not stop the sampler voice in time', { cause: error });
      throw error;
    }
  }

  // false when the firmware predates patterns (Unsupported / bad arguments): the sample then plays without them.
  async #sendPatterns(bytes, signal) {
    const piece = this.info.maxBody - 4;
    if (piece <= 0 || bytes.length > 0xFFFF) return false;
    for (let offset = 0; offset < bytes.length; offset += piece) {
      this.#notAborted(signal);
      const part = bytes.subarray(offset, offset + piece);
      const head = Uint8Array.of(bytes.length & 255, bytes.length >> 8, offset & 255, offset >> 8);
      try { await this.client.request(SAMPLE_UPLOAD_COMMAND.BREAK, concat(head, part)); }
      catch (error) { if (offset === 0 && error instanceof HostLinkError && (error.status === 1 || error.status === 2)) return false; throw error; }
    }
    return true;
  }

  async #retryChunk(body, signal) {
    let last;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      this.#notAborted(signal);
      try { return await this.client.request(SAMPLE_UPLOAD_COMMAND.CHUNK, body); }
      catch (error) { last = error; if (!(error instanceof HostLinkError) || error.code !== 'TIMEOUT' || attempt === this.retries) throw error; }
    }
    throw last;
  }

  #notAborted(signal) { if (signal?.aborted) throw new DOMException('Sample upload cancelled', 'AbortError'); }
}
