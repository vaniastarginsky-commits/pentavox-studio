// PVXE v1: Chopper EVENT bank with per-event REL/ABS addressing. Mirrors
// dsp/include/pentavox/chopper_event_bank.h byte for byte (golden vectors tie them together).
// Not a PVXP version: PVXP v1-v4 are never accepted here and never written by this module.
// Strict: nothing is clamped, wrapped, rounded or converted; invalid input throws.
import { crc32 } from '../hostlink/frame.js';

export const PVXE_VERSION = 1;
export const HEADER_BYTES = 32;
export const EVENT_BYTES = 12;
export const MAX_PATTERNS = 20;
export const MAX_EVENTS = 256;
export const MAX_CUE = 63;
// The largest bank this model can produce, straight from the wire layout in the header comment. The transport
// constant and the firmware buffer are pinned to this number by a test, so "Studio encoded it" and "the module
// has room for it" cannot quietly mean different sizes.
export const MAX_BANK_BYTES = HEADER_BYTES + MAX_PATTERNS * (4 + MAX_EVENTS * EVENT_BYTES);
const ROLES = ['base', 'variation', 'fill'];
const REPEATS = [1, 2, 3, 4, 6, 8];
const ROLLS = [1, 2, 4, 8];

const fail = (message) => { throw new RangeError(`PVXE: ${message}`); };
const isU = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;

function checkSource(source) {
  if (!source || !isU(source.sampleRate, 0xffffffff) || source.sampleRate < 1 || !isU(source.frames, 0xffffffff)
    || source.frames < 1 || ![1, 2].includes(source.channels) || !isU(source.beats, 0xffff)
    || source.beats < 4 || source.beats % 4 || !isU(source.pcmCrc, 0xffffffff)) fail('invalid source identity');
}

function checkEvent(e, beats, sourceBeats, end) {
  if (!e || !isU(e.step, 0xffff) || !isU(e.length, 0xffff) || e.step < end || e.length < 1
    || e.step + e.length > beats * 4 || !isU(e.cue, MAX_CUE) || typeof e.absolute !== 'boolean'
    || typeof e.reverse !== 'boolean' || typeof e.gate !== 'boolean' || (e.absolute && e.cue >= sourceBeats)
    || !REPEATS.includes(e.repeat) || !ROLLS.includes(e.roll) || !Number.isInteger(e.pitch) || e.pitch < -24
    || e.pitch > 24 || !isU(e.gain, 200) || !isU(e.probability, 100)) fail('invalid or overlapping event');
  return e.step + e.length;
}

export function validateBank(bank) {
  checkSource(bank?.source);
  if (!isU(bank.revision, 0xffffffff) || !Array.isArray(bank.patterns) || bank.patterns.length < 1
    || bank.patterns.length > MAX_PATTERNS) fail('invalid pattern count');
  let base = false;
  for (const p of bank.patterns) {
    if (!ROLES.includes(p?.role) || !Number.isInteger(p.beats) || p.beats < 4 || p.beats > 64 || p.beats % 4
      || !Array.isArray(p.events) || p.events.length > MAX_EVENTS) fail('invalid pattern');
    base ||= p.role === 'base';
    let end = 0;
    for (const e of p.events) end = checkEvent(e, p.beats, bank.source.beats, end);
  }
  if (!base) fail('a base pattern is required');
}

export function encodeBank(bank) {
  validateBank(bank);
  let payload = 0;
  for (const p of bank.patterns) payload += 4 + p.events.length * EVENT_BYTES;
  if (payload > 0xffff) fail('payload too large');
  const out = new Uint8Array(HEADER_BYTES + payload);
  const view = new DataView(out.buffer);
  out.set([0x50, 0x56, 0x58, 0x45, PVXE_VERSION, 0]);
  view.setUint16(6, payload, true);
  view.setUint32(12, bank.source.sampleRate, true);
  view.setUint32(16, bank.source.frames, true);
  out[20] = bank.source.channels;
  out[21] = bank.patterns.length;
  view.setUint16(22, bank.source.beats, true);
  view.setUint32(24, bank.source.pcmCrc, true);
  view.setUint32(28, bank.revision, true);
  let at = HEADER_BYTES;
  for (const p of bank.patterns) {
    out[at] = ROLES.indexOf(p.role);
    out[at + 1] = p.beats;
    view.setUint16(at + 2, p.events.length, true);
    at += 4;
    for (const e of p.events) {
      view.setUint16(at, e.step, true);
      view.setUint16(at + 2, e.length, true);
      out[at + 4] = e.cue;
      out[at + 5] = (e.absolute ? 1 : 0) | (e.reverse ? 2 : 0) | (e.gate ? 4 : 0);
      out[at + 6] = e.repeat;
      out[at + 7] = e.roll;
      out[at + 8] = e.pitch & 0xff;
      out[at + 9] = e.gain;
      out[at + 10] = e.probability;
      out[at + 11] = 0;
      at += EVENT_BYTES;
    }
  }
  view.setUint32(8, crc32(out.subarray(HEADER_BYTES)), true);
  return out;
}

export function decodeBank(input) {
  const bytes = input instanceof Uint8Array ? input : fail('bytes required');
  if (bytes.length < HEADER_BYTES) fail('truncated');
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'PVXE') fail('bad magic');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[4] !== PVXE_VERSION) fail('unsupported version');
  if (bytes[5] !== 0) fail('unsupported flags');
  const payload = bytes.length - HEADER_BYTES;
  if (view.getUint16(6, true) !== payload) fail('length mismatch');
  if (view.getUint32(8, true) !== crc32(bytes.subarray(HEADER_BYTES))) fail('checksum mismatch');
  const count = bytes[21];
  const bank = {
    source: { sampleRate: view.getUint32(12, true), frames: view.getUint32(16, true), channels: bytes[20],
      beats: view.getUint16(22, true), pcmCrc: view.getUint32(24, true) },
    revision: view.getUint32(28, true),
    patterns: [],
  };
  let at = HEADER_BYTES;
  for (let p = 0; p < count; p += 1) {
    if (bytes.length - at < 4) fail('truncated');
    const n = view.getUint16(at + 2, true);
    const pattern = { role: ROLES[bytes[at]] ?? fail('invalid role'), beats: bytes[at + 1], events: [] };
    at += 4;
    if (n > MAX_EVENTS || bytes.length - at < n * EVENT_BYTES) fail('truncated');
    for (let i = 0; i < n; i += 1, at += EVENT_BYTES) {
      const flags = bytes[at + 5];
      if ((flags & ~7) !== 0 || bytes[at + 11] !== 0) fail('reserved bits set');
      pattern.events.push({
        step: view.getUint16(at, true), length: view.getUint16(at + 2, true), cue: bytes[at + 4],
        absolute: (flags & 1) !== 0, reverse: (flags & 2) !== 0, gate: (flags & 4) !== 0,
        repeat: bytes[at + 6], roll: bytes[at + 7], pitch: (bytes[at + 8] << 24) >> 24,
        gain: bytes[at + 9], probability: bytes[at + 10],
      });
    }
    bank.patterns.push(pattern);
  }
  if (at !== bytes.length) fail('trailing data');
  validateBank(bank);
  return bank;
}

// Slice Lab editor event ({mode, gain 0..2, probability 0..1, ...}) to the wire event.
// gain/probability must already sit on the 1/100 grid; they are never rounded silently.
export function eventFromEditor(e) {
  const grid = (value, scale, what) => {
    const scaled = value * scale;
    const rounded = Math.round(scaled);
    if (!Number.isFinite(scaled) || Math.abs(scaled - rounded) > 1e-6) fail(`${what} is not representable on the 1/100 grid`);
    return rounded;
  };
  if (e.mode !== 'relative' && e.mode !== 'absolute') fail('unknown addressing mode');
  return { step: e.step, length: e.length, cue: e.cue, absolute: e.mode === 'absolute', reverse: e.reverse,
    gate: e.gate, repeat: e.repeat, roll: e.roll, pitch: e.pitch,
    gain: grid(e.gain, 100, 'gain'), probability: grid(e.probability, 100, 'probability') };
}

/**
 * Map the Chopper editor's document into a bank this model can encode - the only place where editor semantics
 * become device bytes, so that the encoder stays the one certified against the firmware by the golden timeline
 * vectors. The editor keeps no second byte-level implementation, and this function does not invent what the
 * editor does not say.
 *
 * `source` is what the patterns were authored against: { beats, sampleRate, frames, channels }. `beats` becomes
 * the bank's authored grid, which is the number REL cues are scheduled inside and the number ABS cues were
 * chosen against - it is not the loop that happens to be loaded in the module, and the module reports the two
 * apart. frames / sample rate / channels are provenance the module enforces against nothing, so an editor that
 * cannot state them is refused rather than written for. `pcmCrc` stays 0 meaning *not measured*: a fabricated
 * hash would be indistinguishable from a real one after a reboot.
 *
 * Anything structurally wrong is raised by validateBank rather than repaired here. An ABS cue beyond the
 * authored grid, for example, is a message the user can act on; clamping it silently would send a different
 * pattern than the one they wrote.
 */
export function bankFromEditor({ patterns, source, revision = 1 }) {
  if (!Array.isArray(patterns) || patterns.length < 1) fail('editor patterns are required');
  const beats = Number(source?.beats);
  if (!Number.isInteger(beats) || beats < 4 || beats % 4) fail('the authored grid must be whole 4/4 bars');
  const sampleRate = Number(source?.sampleRate), frames = Number(source?.frames);
  if (!Number.isInteger(sampleRate) || sampleRate < 1 || !Number.isInteger(frames) || frames < 1) {
    fail('the authored loop must be stated in real sample rate and frames, not assumed');
  }
  const channels = Number(source?.channels ?? 1);
  if (channels !== 1 && channels !== 2) fail('the authored loop must be mono or stereo');
  const bank = {
    // The module counts its own staging revisions; this field only says which bank came from where, so a
    // download-edit-upload round trip can carry the number the module last reported.
    revision,
    source: { sampleRate, frames, channels, beats, pcmCrc: Number(source?.pcmCrc ?? 0) },
    // Events reach the wire in step order, and validateBank requires them sorted and non-overlapping; the
    // editor keeps them sorted too, so this sort is a guard against a hand-edited file, not a reordering.
    patterns: patterns.map((pattern) => ({
      role: pattern?.role,
      beats: pattern?.beats,
      events: [...(pattern?.events ?? [])].sort((a, b) => a.step - b.step).map(eventFromEditor),
    })),
  };
  validateBank(bank);
  return bank;
}
