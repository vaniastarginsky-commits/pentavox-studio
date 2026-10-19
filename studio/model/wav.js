import { decodeBank, encodeBank } from './break_pattern.js';
export const TARGET_SAMPLE_RATE = 48000;
export const MAX_FRAMES = 1440000;
export const MAX_SLICE_POINTS = 32;
export const NORMALIZE_PEAK = 10 ** (-1 / 20);

function copyChannels(channels) {
  return channels.map((channel) => Float32Array.from(channel));
}

export function trimAudio(audio, startFrame = 0, endFrame = audio.channels[0]?.length ?? 0) {
  const length = audio.channels[0]?.length ?? 0;
  const start = Math.max(0, Math.min(length, Math.trunc(startFrame)));
  const end = Math.max(start, Math.min(length, Math.trunc(endFrame)));
  return { sampleRate: audio.sampleRate, channels: audio.channels.map((channel) => channel.slice(start, end)) };
}

export function downmixAudio(audio, channelMode = 'stereo') {
  if (!audio.channels.length) return { sampleRate: audio.sampleRate, channels: [new Float32Array()] };
  if (channelMode === 'mono') {
    const length = audio.channels[0].length;
    const mono = new Float32Array(length);
    for (const channel of audio.channels) for (let i = 0; i < length; i += 1) mono[i] += channel[i] / audio.channels.length;
    return { sampleRate: audio.sampleRate, channels: [mono] };
  }
  if (audio.channels.length === 1) return { sampleRate: audio.sampleRate, channels: copyChannels(audio.channels) };
  return { sampleRate: audio.sampleRate, channels: copyChannels(audio.channels.slice(0, 2)) };
}

export function normalizeAudio(audio, targetPeak = NORMALIZE_PEAK) {
  let peak = 0;
  for (const channel of audio.channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  if (!(peak > 0)) return { sampleRate: audio.sampleRate, channels: copyChannels(audio.channels) };
  const gain = targetPeak / peak;
  return { sampleRate: audio.sampleRate, channels: audio.channels.map((channel) => Float32Array.from(channel, (sample) => sample * gain)) };
}

export function resampleLinear(audio, targetRate = TARGET_SAMPLE_RATE) {
  if (audio.sampleRate === targetRate) return { sampleRate: targetRate, channels: copyChannels(audio.channels) };
  const sourceLength = audio.channels[0]?.length ?? 0;
  const targetLength = Math.round(sourceLength * targetRate / audio.sampleRate);
  const channels = audio.channels.map((source) => {
    const output = new Float32Array(targetLength);
    if (sourceLength === 0) return output;
    for (let i = 0; i < targetLength; i += 1) {
      const position = i * audio.sampleRate / targetRate;
      const left = Math.min(sourceLength - 1, Math.floor(position));
      const right = Math.min(sourceLength - 1, left + 1);
      const fraction = position - left;
      output[i] = source[left] + (source[right] - source[left]) * fraction;
    }
    return output;
  });
  return { sampleRate: targetRate, channels };
}

export async function resampleAudio(audio, targetRate = TARGET_SAMPLE_RATE, { preferOffline = true } = {}) {
  const Offline = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext;
  if (!preferOffline || !Offline || audio.sampleRate === targetRate || !audio.channels[0]?.length) return resampleLinear(audio, targetRate);
  const length = Math.round(audio.channels[0].length * targetRate / audio.sampleRate);
  const context = new Offline(audio.channels.length, length, targetRate);
  const buffer = context.createBuffer(audio.channels.length, audio.channels[0].length, audio.sampleRate);
  audio.channels.forEach((channel, index) => buffer.copyToChannel(channel, index));
  const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination); source.start();
  const rendered = await context.startRendering();
  return { sampleRate: targetRate, channels: Array.from({ length: rendered.numberOfChannels }, (_, index) => rendered.getChannelData(index).slice()) };
}

export async function prepareAudio(audio, options = {}) {
  const startFrame = Math.round((options.trimStart ?? 0) * audio.sampleRate);
  const endFrame = Math.round((options.trimEnd ?? (audio.channels[0]?.length ?? 0) / audio.sampleRate) * audio.sampleRate);
  let result = trimAudio(audio, startFrame, endFrame);
  result = downmixAudio(result, options.channelMode ?? 'stereo');
  if (options.normalize) result = normalizeAudio(result);
  return resampleAudio(result, TARGET_SAMPLE_RATE, { preferOffline: options.preferOffline !== false });
}

function writeTag(bytes, offset, tag) { for (let i = 0; i < 4; i += 1) bytes[offset + i] = tag.charCodeAt(i); }

// acid flags: bit 0 one-shot (standard). Pentavox slice-play, valid only with bit 14: bits 8-10 mode, bits 11-13 step.
export const PLAY_MODES = ['Normal', 'Forward', 'Random', 'Repeat', 'Break', 'Break Gate'];   // Break plays the file's patterns (needs a clock); Break Gate waits for the sequencer's C3 (note 60) to start it and stops when the trigger does not come again at the end of the cycle
export const PLAY_STEPS = ['1 beat', '1/2 beat', '1/4 beat', '2 beats', '1 bar'];   // the firmware's step codes 0-4
export const PLAY_FILTERS = ['All', 'Kicks', 'Snares', 'Hats'];                     // acid bits 15-16: play only this drum type
// `pvxt` chunk: one type bitmask per cue point (1 kick, 2 snare, 4 hat, 0 other), so the module can play or trigger by drum type.
const LABEL_BITS = { kick: 1, snare: 2, hat: 4 };
export function labelMask(label) { let mask = 0; for (const part of String(label).split('+')) mask |= LABEL_BITS[part] ?? 0; return mask; }
export function maskLabel(mask) {
  const hat = (mask & 4) !== 0;
  if (mask & 1) return hat ? 'kick+hat' : 'kick';
  if (mask & 2) return hat ? 'snare+hat' : 'snare';
  return hat ? 'hat' : 'other';
}
export const SLICE_PLAY_VALID = 0x4000;
export function acidFlags({ hasCue, oneShot, playMode = 0, step = 0, filter = 0 }) {
  let flags = hasCue && oneShot ? 1 : 0;
  const mode = Math.trunc(playMode); const code = Math.trunc(step); const only = Math.trunc(filter);
  const modeOk = mode >= 0 && mode <= 5 && code >= 0 && code <= 4 && only >= 0 && only <= 3;
  if (hasCue && modeOk && (mode >= 1 || only >= 1)) flags |= SLICE_PLAY_VALID | (mode << 8) | (code << 11) | (only << 15);
  return flags;
}
export function encodePcm16Wav(audio, { bpm, beats, rootNote = 60, slices = [], oneShot = false, playMode = 0, step = 0, playFilter = 0, labels = [], breakBank = null, origin = 0 } = {}) {
  const channels = audio.channels.length;
  if (channels !== 1 && channels !== 2) throw new RangeError('A WAV file must have one or two channels');
  const frames = audio.channels[0]?.length ?? 0;
  if (audio.channels.some((channel) => channel.length !== frames)) throw new RangeError('WAV channels have different lengths');
  if (frames > MAX_FRAMES) throw new RangeError('The sample is longer than 30 seconds');
  const hasTempo = Number.isFinite(Number(bpm)) && Number(bpm) > 0 && Number.isInteger(Number(beats)) && Number(beats) > 0;
  // Cue points with their drum label riding along, so sorting or dropping a point never misaligns the labels.
  const pairs = []; const seen = new Set();
  (Array.isArray(slices) ? slices : []).forEach((value, index) => {
    const f = Math.trunc(value);
    if (Number.isFinite(f) && f >= 0 && f < frames && !seen.has(f)) { seen.add(f); pairs.push([f, labelMask(labels?.[index] ?? 'other')]); }
  });
  pairs.sort((a, b) => a[0] - b[0]);
  const cue = pairs.slice(0, MAX_SLICE_POINTS).map(([f]) => f);
  const types = pairs.slice(0, MAX_SLICE_POINTS).map(([, mask]) => mask);
  const hasCue = cue.length >= 2;
  const hasTypes = hasCue && types.some((mask) => mask !== 0);
  const typesSize = hasTypes ? 8 + ((2 + types.length + 1) & ~1) : 0;
  const bankBytes = hasCue && breakBank ? encodeBank(breakBank) : null;   // `pvxp`: Break patterns, only with slices to point at
  const bankSize = bankBytes ? 8 + ((bankBytes.length + 1) & ~1) : 0;
  const hasAcid = hasTempo || hasCue;
  const cueSize = hasCue ? 12 + 24 * cue.length : 0;
  const originSize = origin === 1 || origin === 2 ? 10 : 0;   // `pvxo`: where the file came from (2 = Studio, 1 = recorded on the module), for the module's loop picker
  const headerSize = 12 + 24 + (hasAcid ? 32 : 0) + originSize + cueSize + typesSize + bankSize + 8;
  const dataBytes = frames * channels * 2;
  const bytes = new Uint8Array(headerSize + dataBytes);
  const view = new DataView(bytes.buffer);
  writeTag(bytes, 0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); writeTag(bytes, 8, 'WAVE');
  writeTag(bytes, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  let offset = 36;
  if (hasAcid) {
    writeTag(bytes, offset, 'acid'); view.setUint32(offset + 4, 24, true);
    view.setUint32(offset + 8, acidFlags({ hasCue, oneShot, playMode, step, filter: playFilter }), true); view.setUint16(offset + 12, rootNote, true); view.setUint16(offset + 14, 0, true);
    view.setUint32(offset + 16, 0, true); view.setUint32(offset + 20, hasTempo ? Number(beats) : 0, true);
    view.setUint16(offset + 24, 4, true); view.setUint16(offset + 26, 4, true); view.setFloat32(offset + 28, hasTempo ? Number(bpm) : 0, true);
    offset += 32;
  }
  if (originSize) {
    writeTag(bytes, offset, 'pvxo'); view.setUint32(offset + 4, 2, true); bytes[offset + 8] = 1; bytes[offset + 9] = origin;
    offset += originSize;
  }
  if (hasCue) {
    writeTag(bytes, offset, 'cue '); view.setUint32(offset + 4, 4 + 24 * cue.length, true); view.setUint32(offset + 8, cue.length, true);
    cue.forEach((frame, i) => {
      const at = offset + 12 + 24 * i;
      view.setUint32(at, i + 1, true); view.setUint32(at + 4, frame, true); writeTag(bytes, at + 8, 'data');
      view.setUint32(at + 12, 0, true); view.setUint32(at + 16, 0, true); view.setUint32(at + 20, frame, true);
    });
    offset += cueSize;
  }
  if (hasTypes) {
    writeTag(bytes, offset, 'pvxt'); view.setUint32(offset + 4, 2 + types.length, true);
    bytes[offset + 8] = 1; bytes[offset + 9] = types.length; types.forEach((mask, i) => { bytes[offset + 10 + i] = mask; });
    offset += typesSize;
  }
  if (bankBytes) {
    writeTag(bytes, offset, 'pvxp'); view.setUint32(offset + 4, bankBytes.length, true); bytes.set(bankBytes, offset + 8);
    offset += bankSize;
  }
  writeTag(bytes, offset, 'data'); view.setUint32(offset + 4, dataBytes, true); offset += 8;
  for (let frame = 0; frame < frames; frame += 1) for (let channel = 0; channel < channels; channel += 1) {
    const sample = Math.max(-1, Math.min(1, audio.channels[channel][frame]));
    const pcm = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
    view.setInt16(offset, pcm, true); offset += 2;
  }
  return bytes;
}

// Reads what the sampler needs from a WAV without decoding it: format, the acid tempo, one-shot bit and play settings, drum labels, and the
// cue points (a `cue ` chunk before or after `data`). Tolerant of truncation. null when it is not RIFF/WAVE.
export function readWavMarkers(bytes) {
  if (!bytes || bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  const info = { sampleRate: 0, channels: 0, frames: 0, slices: [], oneShot: false, playMode: 0, step: 0, playFilter: 0, labels: [], bpm: 0, beats: 0, breakBank: null };
  let typeBytes = null;
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const id = tag(pos); const size = view.getUint32(pos + 4, true); const body = pos + 8; const avail = Math.min(size, bytes.length - body);
    if (id === 'fmt ' && avail >= 16) { info.channels = view.getUint16(body + 2, true); info.sampleRate = view.getUint32(body + 4, true); }
    else if (id === 'acid' && avail >= 4) {
      const flags = view.getUint32(body, true); info.oneShot = (flags & 1) === 1;
      if ((flags & SLICE_PLAY_VALID) !== 0) { const mode = (flags >> 8) & 7; const step = (flags >> 11) & 7; if (mode <= 5 && step <= 4) { info.playMode = mode; info.step = step; info.playFilter = (flags >> 15) & 3; } }
      if (avail >= 24) { info.beats = view.getUint32(body + 12, true); const bpm = view.getFloat32(body + 20, true); info.bpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 0; }
    } else if (id === 'cue ' && avail >= 4) {
      const count = Math.min(view.getUint32(body, true), Math.floor((avail - 4) / 24));
      for (let i = 0; i < count; i += 1) info.slices.push(view.getUint32(body + 4 + 24 * i + 20, true));
    } else if (id === 'pvxt' && avail >= 2 && bytes[body] === 1) {
      const n = Math.min(bytes[body + 1], avail - 2); typeBytes = Array.from(bytes.subarray(body + 2, body + 2 + n));
    } else if (id === 'pvxp' && avail >= 3) {
      info.breakBank = decodeBank(bytes.subarray(body, body + avail));
    } else if (id === 'data' && info.channels > 0) info.frames = Math.floor(avail / (info.channels * 2));
    pos = body + size + (size & 1);
  }
  const raw = info.slices.length; info.slices = [...new Set(info.slices)].sort((a, b) => a - b);
  // The labels belong to the cue points as Studio wrote them (sorted, unique): any other count means a foreign edit, so ignore them.
  if (typeBytes && raw === info.slices.length && typeBytes.length === info.slices.length) info.labels = typeBytes.map(maskLabel);
  return info;
}

export function audioFromBuffer(buffer) {
  return { sampleRate: buffer.sampleRate, channels: Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index).slice()) };
}
