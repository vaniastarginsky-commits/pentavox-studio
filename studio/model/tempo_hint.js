// Tempo clues in a file name ("Break_Duke_120", "loop 95bpm", "bpm-128"), checked against the clip length.

const MIN_HINT = 50;
const MAX_HINT = 220;
const BEAT_FIT = 0.15;   // a clip counts as "whole beats" when it is within this many beats of an integer ...
const BEAT_FIT_RELATIVE = 0.025;   // ... or within 2.5 % of the beats it holds (a pack loop of 5.455 s labelled 174 BPM is 15.8 beats, not 16)
const AGREE = 0.04;      // a bare number in a name must agree with the audio guess (up to half/double time) within 4 %

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

/** A bare 2-3 digit number between separators in the middle of a name ("DMEDNB_174_Drum_Loop_03_1"), when it is the only one that can be a tempo. */
export function weakBpmFromName(name) {
  const text = String(name ?? '').replace(/\.(wav|wave|aif|aiff|flac|mp3|ogg|m4a)$/i, '');
  const found = [...text.matchAll(/(?:^|[_\-\s.])(\d{2,3})(?=$|[_\-\s.])/g)].map((match) => Number(match[1])).filter(inRange);
  return found.length === 1 ? found[0] : null;
}

/** Whole beats a clip of `length` seconds holds at `bpm`, or null when it is not a whole number of beats (strict: a fixed 0.15 beat allowance only). */
export function wholeBeats(bpm, length, { strict = false } = {}) {
  if (!(bpm > 0) || !(length > 0)) return null;
  const exact = length * bpm / 60; const beats = Math.round(exact);
  const allowance = strict ? BEAT_FIT : Math.max(BEAT_FIT, BEAT_FIT_RELATIVE * beats);
  return beats >= 1 && Math.abs(exact - beats) <= allowance ? beats : null;
}

/**
 * Pick the tempo to show. `guess` is the audio estimate ({bpm, beats} or null), `hint` the BPM from the file name,
 * `weakHint` a bare number from the middle of it (only trusted when the audio agrees).
 * A name that fits the clip length wins (it settles half/double-time mistakes and recomputes the beats);
 * otherwise the audio guess stands. Returns { bpm, beats, source: 'name' | 'audio' } or null.
 */
export function reconcileTempo(guess, hint, length, weakHint = null) {
  const named = (bpm, beats) => {
    // The tag is the tempo at which the clip is EXACTLY `beats` beats: the module counts length * bpm / 60 quarters and only snaps to a whole
    // number within 0.05, so a 15.82-beat clip tagged 174 loses its last bar (floor of 3.95 bars). A name that is a little off says 176.0 here.
    const exact = Number((beats * 60 / length).toFixed(2));
    return Math.abs(exact - bpm) > bpm * 0.002 ? { bpm: exact, beats, source: 'name', named: bpm } : { bpm, beats, source: 'name' };
  };
  const beats = hint ? wholeBeats(hint, length) : null;
  if (beats) return named(hint, beats);
  if (weakHint) {
    // A bare number mid-name is a tempo only when the audio says so too (any octave), or, with no audio guess, when it fits the clip strictly.
    const agrees = guess ? [0.5, 1, 2].some((k) => Math.abs(guess.bpm * k - weakHint) <= weakHint * AGREE) : true;
    const weakBeats = agrees ? wholeBeats(weakHint, length, { strict: !guess }) : null;
    if (weakBeats) return named(weakHint, weakBeats);
  }
  return guess ? { ...guess, source: 'audio' } : null;
}

/**
 * How the audio's own tempo compares with the one in the name (or anywhere), up to half/double time:
 * { relation: 'same' | 'near' | 'differs', measured } where `measured` is the audio tempo brought to the octave of `bpm`.
 * 'same' is within 0.4 %, 'near' within 3 %; a loop labelled 174 that plays at 176 is 'near' and says so.
 */
export function compareAudioTempo(guess, bpm) {
  if (!guess || !(guess.bpm > 0) || !(bpm > 0)) return null;
  let best = guess.bpm;
  for (const k of [0.5, 1, 2]) if (Math.abs(guess.bpm * k - bpm) < Math.abs(best - bpm)) best = guess.bpm * k;
  const off = Math.abs(best - bpm) / bpm;
  return { relation: off <= 0.004 ? 'same' : off <= 0.03 ? 'near' : 'differs', measured: Number(best.toFixed(1)) };
}
