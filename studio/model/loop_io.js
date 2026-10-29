// The looper image's loop files: /LOOPS/NNNN.WAV on the module's card, and the HostLink commands 0x78..0x7A that save the playing loop,
// load a numbered file into a loop slot and report how that went (fw/include/pentavox/hw/loop_io_extension.h). Pure functions and a small client.
import { HostLinkError } from '../hostlink/client.js';

export const LOOP_IO_COMMAND = Object.freeze({ SAVE: 0x78, LOAD: 0x79, STATUS: 0x7a });
export const LOOP_DIR = '/LOOPS';
export const LOOP_PLAYING_SLOT = 0xff;
export const LOOP_SLOTS = 2;
const SAMPLE_RATE = 48000;
const HEADER_BYTES = 76;   // RIFF + fmt + acid + data header of a file the module wrote
const STATE = Object.freeze(['idle', 'working', 'done', 'failed']);

/** Does the module advertise the loop commands? (descriptor root key "loopIo") */
export function loopIoVersion(descriptor) {
  const version = Number(descriptor?.loopIo?.version);
  return Number.isFinite(version) && version >= 1 ? version : 0;
}

/** 'NNNN.WAV' -> NNNN, else null. */
export function loopFileNumber(name) {
  const match = /^(\d{4})\.wav$/i.exec(String(name ?? ''));
  const number = match ? Number(match[1]) : 0;
  return number >= 1 ? number : null;
}

export function loopFileName(number) { return `${String(number).padStart(4, '0')}.WAV`; }

/** The loop files of a /LOOPS listing, by number. Seconds follow from the size of a file this module wrote (stereo 16 bit, 48 kHz). */
export function loopFiles(entries) {
  return (entries ?? [])
    .filter((entry) => !entry.directory && loopFileNumber(entry.name) !== null)
    .map((entry) => ({ ...entry, number: loopFileNumber(entry.name), seconds: Math.max(0, entry.size - HEADER_BYTES) / (SAMPLE_RATE * 4) }))
    .sort((a, b) => a.number - b.number);
}

/** The first number above every existing one that a rename may use: it must not be taken and must be 1..9999. */
export function renumberProblem(files, from, to) {
  const number = Number(to);
  if (!Number.isInteger(number) || number < 1 || number > 9999) return 'The number has to be between 1 and 9999';
  if (files.some((file) => file.number === number && file.number !== from)) return `${loopFileName(number)} already exists`;
  return '';
}

/** Why a save or a load failed (the firmware's LoopFailure), as a sentence. 0 and unknown numbers read as the generic line. */
export const LOOP_FAILURES = Object.freeze({
  1: 'There is no loop in the active slot to save',
  2: 'No SD card in the module',
  3: 'The looper is busy (recording, overdubbing or another transfer): try again when it plays',
  4: 'The card refused the write (full or taken out)',
  5: 'The file ended before its header says: it is damaged or not finished',
  6: 'That file is not a loop the module can use (it needs a 48 kHz WAV with a tempo)',
  7: 'That file is longer than a loop can be',
  8: 'The module did not answer in time',
  9: 'The card would not open the file',
  10: 'All loop numbers up to 9999 are used',
});
export const describeLoopFailure = (reason, fallback) => LOOP_FAILURES[reason] ?? fallback;

/** The reply of the status command: status byte, u8 io, u8 active slot, u16 files, u16 last number, u32 ms, u32 frames, u32 longest control-loop gap (ms), u8 failure reason (newer firmware). */
export function parseLoopStatus(body) {
  if (!(body instanceof Uint8Array) || body.length < 18) throw new HostLinkError('LOOP_STATUS: the reply is too short', { code: 'BAD_STATUS' });
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const io = body[0];
  let recorder=null;
  if(body.length>=23) {
    const [target,mode,source,bars]=body.slice(19,23);
    if(target>1 || body[1]>1 || mode>4 || source>2 || ![4,8,16].includes(bars))
      throw new HostLinkError('LOOP_STATUS: invalid recorder state',{code:'BAD_STATUS'});
    recorder={target,mode,source,bars};
    if(body.length>=25) {
      if(body[24]>5)throw new HostLinkError('LOOP_STATUS: invalid refusal reason',{code:'BAD_STATUS'});
      recorder.refusalCount=body[23];recorder.refusalReason=body[24];
    }
  }
  return {
    ...(recorder?{recorder}:{}),
    io, state: STATE[io] ?? 'idle', activeSlot: body[1], files: view.getUint16(2, true), lastNumber: view.getUint16(4, true),
    ms: view.getUint32(6, true), frames: view.getUint32(10, true), stallMs: view.getUint32(14, true),
    reason: body.length >= 19 ? body[18] : 0,
  };
}

/** What a refused command means for the player. */
export function describeLoopError(error) {
  const status = error?.status;
  if (status === 9) return 'The module is already saving or loading a loop';
  if (status === 11) return 'No SD card in the module';
  if (status === 12) return 'That loop file is not on the card';
  if (status === 2) return 'The module did not understand the request';
  if (status === 1) return 'This firmware has no loop saving';
  return error?.message ?? 'The loop request failed';
}

export class LoopIoClient {
  constructor(client) { this.client = client; }

  /** Save the loop that plays now (slot 0xFF) or the given slot; resolves once the module has queued it. */
  async save(slot = LOOP_PLAYING_SLOT) { await this.client.request(LOOP_IO_COMMAND.SAVE, Uint8Array.of(slot)); }

  async load(slot, number) {
    await this.client.request(LOOP_IO_COMMAND.LOAD, Uint8Array.of(slot, number & 0xff, (number >> 8) & 0xff));
  }

  async status() {
    const { body } = await this.client.request(LOOP_IO_COMMAND.STATUS);
    return parseLoopStatus(body);
  }

  /**
   * Waits for the job just queued to finish. The module shows "done" / "failed" for 1.5 s, and a job is at least a moment long, so a poll every
   * `pollMs` sees it. Resolves the final status; rejects on timeout or abort.
   */
  async finish({ pollMs = 250, timeoutMs = 180000, signal, onStatus = () => {}, delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
    const deadline = Date.now() + timeoutMs;
    let sawWorking = false; let idleSince = null;
    for (;;) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const status = await this.status();
      onStatus(status);
      if (status.state === 'working') { sawWorking = true; idleSince = null; }
      else if (status.state === 'done' || status.state === 'failed') return status;
      else if (sawWorking) return status;           // the 1.5 s result window passed between two polls: report what the module kept
      else { idleSince ??= Date.now(); if (Date.now() - idleSince > 5000) throw new Error('The module did not start the loop job'); }
      if (Date.now() > deadline) throw new Error('The loop job took too long');
      await delay(pollMs);
    }
  }
}
