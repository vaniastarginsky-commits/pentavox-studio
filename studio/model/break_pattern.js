// Pattern bank and its binary form (the private WAV chunk `pvxp`, mirrored by the firmware parser).
// Body: u8 version(1), u8 patternCount (1-8), u8 chainLen (0-16), chain bytes (pattern indices),
// then per pattern: u8 steps/16 (1-8), u8 eventCount (0-128), eventCount * 8 bytes:
//   step u8, src i8 (-1 continue, -2 home), len u8, flags u8 (bits 0-2 reps index, 3-4 roll, 5 reverse, 6 gate),
//   amp0 u8 (0-255), amp1 u8, pitch0 i8 (semitones), pitch1 i8.
import { PATTERN_STEPS, REPS, normalizePattern } from './break_engine.js';

export const MAX_PATTERNS = 8;
export const MAX_CHAIN = 16;
export const MAX_EVENTS = 128;
const VERSION = 1;

export function normalizeBank(bank) {
  const patterns = (bank?.patterns ?? []).slice(0, MAX_PATTERNS).map(normalizePattern);
  patterns.forEach((p) => { p.events = p.events.slice(0, MAX_EVENTS); });
  const chain = (bank?.chain ?? []).map(Math.trunc).filter((i) => i >= 0 && i < patterns.length).slice(0, MAX_CHAIN);
  return { patterns, chain };
}

export function encodeBank(input) {
  const bank = normalizeBank(input);
  if (!bank.patterns.length) return null;
  const out = [VERSION, bank.patterns.length, bank.chain.length, ...bank.chain];
  for (const p of bank.patterns) {
    out.push(p.steps / 16, p.events.length);
    for (const e of p.events) {
      const flags = REPS.indexOf(e.reps) | (e.roll << 3) | (e.rev ? 32 : 0) | (e.gate ? 64 : 0);
      out.push(e.step, e.src & 255, e.len, flags, Math.round(e.amp0 * 255), Math.round(e.amp1 * 255), Math.round(e.pitch0) & 255, Math.round(e.pitch1) & 255);
    }
  }
  return Uint8Array.from(out);
}

// null for anything malformed or from a newer version: the module then plays without patterns.
export function decodeBank(bytes) {
  if (!bytes || bytes.length < 3 || bytes[0] !== VERSION) return null;
  const count = bytes[1]; const chainLen = bytes[2];
  if (count < 1 || count > MAX_PATTERNS || chainLen > MAX_CHAIN) return null;
  let at = 3; if (at + chainLen > bytes.length) return null;
  const chain = Array.from(bytes.subarray(at, at + chainLen)); at += chainLen;
  const s8 = (v) => (v > 127 ? v - 256 : v);
  const patterns = [];
  for (let i = 0; i < count; i += 1) {
    if (at + 2 > bytes.length) return null;
    const steps = bytes[at] * 16; const n = bytes[at + 1]; at += 2;
    if (!PATTERN_STEPS.includes(steps) || n > MAX_EVENTS || at + 8 * n > bytes.length) return null;
    const events = [];
    for (let k = 0; k < n; k += 1, at += 8) {
      const f = bytes[at + 3]; if ((f & 7) >= REPS.length || ((f >> 3) & 3) > 2) return null;
      events.push({ step: bytes[at], src: s8(bytes[at + 1]), len: bytes[at + 2], reps: REPS[f & 7], roll: (f >> 3) & 3, rev: (f & 32) !== 0, gate: (f & 64) !== 0,
        amp0: bytes[at + 4] / 255, amp1: bytes[at + 5] / 255, pitch0: s8(bytes[at + 6]), pitch1: s8(bytes[at + 7]) });
    }
    patterns.push({ steps, events });
  }
  return normalizeBank({ patterns, chain });
}
