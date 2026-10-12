// Tempo clues in a file name ("Break_Duke_120", "loop 95bpm", "bpm-128"), checked against the clip length.

const MIN_HINT = 50;
const MAX_HINT = 220;
const BEAT_FIT = 0.15;   // a clip counts as "whole beats" when it is within this many beats of an integer

function inRange(bpm) { return Number.isFinite(bpm) && bpm >= MIN_HINT && bpm <= MAX_HINT; }
function num(text) { return Number(String(text).replace(',', '.')); }

/** BPM written in a file name, or null. Only an explicit "bpm" or a number ending the name counts. */
export function bpmFromName(name) {
  const text = String(name ?? '').replace(/\.(wav|wave|aif|aiff|flac|mp3|ogg|m4a)$/i, '');
  const patterns = [/(\d{2,3}(?:[.,]\d+)?)\s*[-_ ]?bpm/i, /bpm\s*[-_ ]?(\d{2,3}(?:[.,]\d+)?)/i, /(?:^|[_\-\s])(\d{2,3})$/];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && inRange(num(match[1]))) return num(match[1]);
  }
  return null;
}

/** Whole beats a clip of `length` seconds holds at `bpm`, or null when it is not a whole number of beats. */
export function wholeBeats(bpm, length) {
  if (!(bpm > 0) || !(length > 0)) return null;
  const exact = length * bpm / 60; const beats = Math.round(exact);
  return beats >= 1 && Math.abs(exact - beats) <= BEAT_FIT ? beats : null;
}

/**
 * Pick the tempo to show. `guess` is the audio estimate ({bpm, beats} or null), `hint` the BPM from the file name.
 * A name that fits the clip length wins (it settles half/double-time mistakes and recomputes the beats);
 * otherwise the audio guess stands. Returns { bpm, beats, source: 'name' | 'audio' } or null.
 */
export function reconcileTempo(guess, hint, length) {
  const beats = hint ? wholeBeats(hint, length) : null;
  if (beats) return { bpm: hint, beats, source: 'name' };
  return guess ? { ...guess, source: 'audio' } : null;
}
