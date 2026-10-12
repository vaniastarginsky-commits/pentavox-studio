// The editor's working copy of one loop: editable points plus how long the loop lasts.
// Free loops last `seconds`. Synced loops span `beats` quarter notes at `bpm`; the module restarts them on
// that musical boundary (musical_ticks, 96 per quarter note), so they stay with the clock's grid.
import { fromSamples, toSamples } from './curve_points.js';
import { CURVES } from './curve_library.js';
import { LOCK_FRAMES, LOCK_RATE_HZ, MIN_FRAMES } from './knob_locks.js';

export const TICKS_PER_BEAT = 96;
export const BEAT_CHOICES = Object.freeze([1, 2, 3, 4, 6, 8, 12, 16, 24, 32]);
export const MAX_SECONDS = LOCK_FRAMES / LOCK_RATE_HZ;
const clampBpm = (bpm) => Math.min(300, Math.max(20, bpm));
const round1 = (value) => Math.round(value * 10) / 10;

export function newDraft({ bpm = 120 } = {}) {
  return { dest: 0, exit: 'Return', points: CURVES.find((curve) => curve.id === 'sine').points.map((point) => ({ ...point })), mode: 'free', seconds: 5, beats: 4, bpm: clampBpm(bpm), bipolar: true, recordBase: 0 };
}

/** `loop`: {dest, exit, samples, musicalTicks, recordBase?, bipolar?} as read from the module or a file. */
export function draftFromLoop(loop, { bpm = 120 } = {}) {
  const sync = loop.musicalTicks > 0;
  const beats = sync ? loop.musicalTicks / TICKS_PER_BEAT : 4;
  return {
    dest: loop.dest,
    exit: loop.exit,
    // The level that means "no change to the knob": the bottom, the centre (bipolar), or where a recorded knob started.
    bipolar: loop.bipolar ?? Math.abs((loop.recordBase ?? 0) - 0.5) < 0.005,
    recordBase: loop.recordBase ?? 0,
    // Only a loop read from the module knows where the knob was when it was recorded.
    recordedBase: loop.bipolar === undefined ? loop.recordBase : undefined,
    points: fromSamples(loop.samples),
    mode: sync ? 'sync' : 'free',
    seconds: round1(loop.samples.length / LOCK_RATE_HZ),
    beats,
    // A synced loop was recorded at the tempo that made `length` frames last `beats`.
    bpm: sync ? clampBpm(round1((beats * 60 * LOCK_RATE_HZ) / loop.samples.length)) : clampBpm(bpm),
  };
}

export function framesFor(draft) {
  return Math.round(draft.mode === 'sync' ? (draft.beats * 60 * LOCK_RATE_HZ) / draft.bpm : draft.seconds * LOCK_RATE_HZ);
}

export const zeroLevel = (draft) => (draft.bipolar ? 0.5 : draft.recordBase ?? 0);

export function lengthSeconds(draft) { return framesFor(draft) / LOCK_RATE_HZ; }

/** The loop to write to the module, or the reason it cannot be written. */
export function loopFromDraft(draft) {
  const frames = framesFor(draft);
  if (!Number.isFinite(frames) || frames < MIN_FRAMES) return { error: 'The loop is too short: raise the length or lower the tempo.' };
  if (frames > LOCK_FRAMES) return { error: `The module holds up to ${MAX_SECONDS} s per loop: shorten it or raise the tempo.` };
  if (!draft.dest) return { error: 'Choose the parameter this loop moves.' };
  const samples = toSamples(draft.points, frames);
  return {
    frames,
    loop: { dest: draft.dest, exit: draft.exit, samples, recordBase: zeroLevel(draft), musicalTicks: draft.mode === 'sync' ? Math.round(draft.beats * TICKS_PER_BEAT) : 0 },
  };
}
