// Pure logic for slice markers on the Sampler waveform: the marker list, undo/redo, generators and the
// conversion to the frame list the WAV writer needs. No DOM, no audio.
import { snapTime } from './wave_edit.js';

export const MAX_SLICES = 32;                 // firmware limit, slice 0 included
export const MAX_MARKERS = MAX_SLICES - 1;    // interior boundaries only; slice 0 always starts at the beginning
export const MARKER_SNAP = 0.00002;            // markers snap to 20 us, less than one sample at 48 kHz (selection handles keep their 1 ms)
const snapMarker = (time) => snapTime(time, MARKER_SNAP);
export const MIN_GAP = 0.001;                 // seconds between markers, and between a marker and either edge

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function normalizeMarkers(markers, duration) {
  const out = [];
  const sorted = markers.filter(Number.isFinite).map((t) => snapMarker(t))
    .filter((t) => t >= MIN_GAP - 1e-9 && t <= duration - MIN_GAP + 1e-9).sort((a, b) => a - b);
  for (const t of sorted) if (!out.length || t - out[out.length - 1] >= MIN_GAP - 1e-9) out.push(t);
  return out.slice(0, MAX_MARKERS);
}

// `count` slices of equal length: count - 1 interior markers.
export function evenMarkers(duration, count) {
  const n = Math.max(1, Math.trunc(count));
  return normalizeMarkers(Array.from({ length: n - 1 }, (_, i) => duration * (i + 1) / n), duration);
}

export function beatMarkers(duration, bpm, beatsPerSlice = 1) {
  const step = 60 / bpm * beatsPerSlice;
  if (!(step > 0) || !Number.isFinite(step)) return [];
  const out = [];
  for (let k = 1; k * step < duration - MIN_GAP && out.length < MAX_MARKERS; k += 1) out.push(k * step);
  return normalizeMarkers(out, duration);
}

// The slice start frames for the exported WAV, relative to the trimmed start: [0, ...] ascending, or [] when
// there is nothing to cut (the firmware then plays 16 equal slices, as before). Markers on or outside the trim
// edges are dropped; the total is capped at MAX_SLICES.
/**
 * The cue points for a trimmed export and, in step with them, the drum label of each slice.
 * `labels[0]` is the slice at the file start, `labels[i + 1]` the slice that starts at `markers[i]`.
 * The first exported slice starts at the trim start, so it takes the label of the slice that contains it.
 */
export function exportSlices(markers, labels, trimStart, trimEnd, sampleRate) {
  let start = 0; for (let i = 0; i < markers.length; i += 1) if (markers[i] <= trimStart + MIN_GAP) start = i + 1;
  const frames = [0]; const kept = [labels?.[start] ?? 'other'];
  for (let i = 0; i < markers.length; i += 1) {
    const t = markers[i];
    if (t <= trimStart + MIN_GAP || t >= trimEnd - MIN_GAP) continue;
    const frame = Math.round((t - trimStart) * sampleRate);
    if (frame > frames[frames.length - 1]) { frames.push(frame); kept.push(labels?.[i + 1] ?? 'other'); }
  }
  return frames.length >= 2 ? { frames: frames.slice(0, MAX_SLICES), labels: kept.slice(0, MAX_SLICES) } : { frames: [], labels: [] };
}

export function exportSliceFrames(markers, trimStart, trimEnd, sampleRate) {
  return exportSlices(markers, [], trimStart, trimEnd, sampleRate).frames;
}

const LABELS = new Set(['kick', 'snare', 'hat', 'other', 'kick+hat', 'snare+hat']);   // a hat can run under a kick or a snare
const hasType = (label, type) => String(label).split('+').includes(type);
const cleanLabel = (label) => LABELS.has(label) ? label : 'other';
const labelsFor = (labels, count) => Array.from({ length: count }, (_, i) => cleanLabel(labels?.[i]));
const same = (a, b) => a.oneShot === b.oneShot && a.markers.length === b.markers.length && a.markers.every((t, i) => t === b.markers[i])
  && a.labels.length === b.labels.length && a.labels.every((label, i) => label === b.labels[i]);

// What a Kick / Snare / Hat / None action does to a slice's label. Kick and snare are exclusive and toggle off when pressed again; Hat
// toggles a hat that runs under them (or alone); None clears the label. Returns one of the LABELS.
export function labelAfter(label, action) {
  const parts = String(label).split('+');
  let main = parts.includes('kick') ? 'kick' : parts.includes('snare') ? 'snare' : null; let hat = parts.includes('hat');
  if (action === 'kick' || action === 'snare') main = main === action ? null : action;
  else if (action === 'hat') hat = !hat;
  else if (action === 'none') { main = null; hat = false; }
  else return cleanLabel(label);
  return main ? (hat ? `${main}+hat` : main) : hat ? 'hat' : 'other';
}

export class SliceModel {
  #duration; #markers; #labels; #oneShot; #playMode = 0; #step = 0; #playFilter = 0; #undo = []; #redo = []; #drag = null; #listeners = new Set();

  constructor(duration, { markers = [], labels = [], oneShot = true, playMode = 0, step = 0, playFilter = 0 } = {}) {
    this.#duration = Math.max(0, duration);
    this.#markers = normalizeMarkers(markers, this.#duration);
    this.#labels = labelsFor(labels, this.#markers.length + 1);
    this.#oneShot = Boolean(oneShot);
    this.#playMode = Math.min(5, Math.max(0, Math.trunc(playMode) || 0)); this.#step = Math.min(4, Math.max(0, Math.trunc(step) || 0)); this.#playFilter = Math.min(3, Math.max(0, Math.trunc(playFilter) || 0));
  }

  get duration() { return this.#duration; }
  get markers() { return this.#markers.slice(); }
  get labels() { return this.#labels.slice(); }
  get oneShot() { return this.#oneShot; }
  /** How the module plays the slices on its clock: 0 normal, 1 forward, 2 random, 3 repeat, 4 break (see PLAY_MODES in wav.js). */
  get playMode() { return this.#playMode; }
  /** The clock step between slice jumps: 0 1 beat, 1 1/2 beat, 2 1/4 beat, 3 2 beats, 4 1 bar (PLAY_STEPS). */
  get step() { return this.#step; }
  /** Which slices the module plays: 0 all, 1 kicks, 2 snares, 3 hats (needs the drum labels, see PLAY_FILTERS in wav.js). */
  get playFilter() { return this.#playFilter; }
  /** True when at least one slice carries a kick, snare or hat label. */
  get hasDrumLabels() { return this.#labels.some((label) => label !== 'other'); }
  setPlay(mode, step = this.#step, filter = this.#playFilter) {
    const m = Math.min(5, Math.max(0, Math.trunc(mode) || 0)); const s = Math.min(4, Math.max(0, Math.trunc(step) || 0)); const f = Math.min(3, Math.max(0, Math.trunc(filter) || 0));
    if (m === this.#playMode && s === this.#step && f === this.#playFilter) return false;
    this.#playMode = m; this.#step = s; this.#playFilter = f; this.#emit(); return true;
  }
  get sliceCount() { return this.#markers.length + 1; }
  get canUndo() { return this.#undo.length > 0; }
  get canRedo() { return this.#redo.length > 0; }

  subscribe(fn) { this.#listeners.add(fn); return () => { this.#listeners.delete(fn); }; }
  #emit() { for (const fn of [...this.#listeners]) fn(); }
  #snapshot() { return { markers: this.#markers.slice(), labels: this.#labels.slice(), oneShot: this.#oneShot }; }
  #restore(snap) { this.#markers = snap.markers.slice(); this.#labels = snap.labels.slice(); this.#oneShot = snap.oneShot; }
  #commit(before, markers, labels, oneShot) {
    const next = { markers, labels: labelsFor(labels, markers.length + 1), oneShot };
    if (same(before, next)) return false;
    this.#undo.push(before); this.#redo = []; this.#restore(next); this.#emit(); return true;
  }

  setMarkers(list, labels = []) { const markers = normalizeMarkers(list, this.#duration); return this.#commit(this.#snapshot(), markers, labels, this.#oneShot); }
  setLabels(labels) { return this.#commit(this.#snapshot(), this.#markers.slice(), labels, this.#oneShot); }
  /** One slice's drum label (undoable): 'kick', 'snare', 'hat', 'kick+hat', 'snare+hat' or 'other' (no label). */
  setLabel(index, label) {
    if (!(index >= 0 && index <= this.#markers.length)) return false;
    const labels = this.#labels.slice(); labels[index] = cleanLabel(label);
    return this.#commit(this.#snapshot(), this.#markers.slice(), labels, this.#oneShot);
  }
  setOneShot(value) { return this.#commit(this.#snapshot(), this.#markers.slice(), this.#labels, Boolean(value)); }
  clear() { return this.#commit(this.#snapshot(), [], [], this.#oneShot); }
  remove(index) {
    if (!(index >= 0 && index < this.#markers.length)) return false;
    return this.#commit(this.#snapshot(), this.#markers.filter((_, i) => i !== index), this.#labels.filter((_, i) => i !== index + 1), this.#oneShot);
  }
  add(t) {
    const target = snapMarker(t);
    const next = normalizeMarkers([...this.#markers, target], this.#duration);
    if (next.length !== this.#markers.length + 1) return -1;
    const index = next.indexOf(target); const labels = this.#labels.slice(); labels.splice(index + 1, 0, 'other');
    this.#commit(this.#snapshot(), next, labels, this.#oneShot);
    return index;
  }

  keepLabel(label) {
    const wanted = cleanLabel(label); const markers = []; const labels = [this.#labels[0]];
    for (let i = 0; i < this.#markers.length; i += 1) if (hasType(this.#labels[i + 1], wanted)) { markers.push(this.#markers[i]); labels.push(this.#labels[i + 1]); }
    return this.#commit(this.#snapshot(), markers, labels, this.#oneShot);
  }

  beginDrag(index) { if (index >= 0 && index < this.#markers.length) this.#drag = { index, before: this.#snapshot() }; }
  dragTo(index, t) {
    if (!this.#drag || this.#drag.index !== index) return;
    const lo = (this.#markers[index - 1] ?? 0) + MIN_GAP; const hi = (this.#markers[index + 1] ?? this.#duration) - MIN_GAP;
    if (lo > hi) return;
    const value = snapMarker(clamp(t, lo, hi));
    if (value === this.#markers[index]) return;
    this.#markers[index] = value; this.#emit();
  }
  endDrag() {
    const drag = this.#drag; this.#drag = null;
    if (!drag || same(drag.before, this.#snapshot())) return;
    this.#undo.push(drag.before); this.#redo = []; this.#emit();
  }

  undo() {
    const before = this.#undo.pop(); if (!before) return false;
    this.#redo.push(this.#snapshot()); this.#restore(before); this.#emit(); return true;
  }
  redo() {
    const after = this.#redo.pop(); if (!after) return false;
    this.#undo.push(this.#snapshot()); this.#restore(after); this.#emit(); return true;
  }
}
