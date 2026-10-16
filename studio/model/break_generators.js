// Pattern generators for the Break engine: seeded, deterministic, musical rules instead of a dice per slice.
// Sources: BBCut CutProc11 / WarpCutProc, Squarepusher cells (Livecut), campanology, recursive cut, Beat Repeat.
// ctx: { steps, fileSteps, sliceStarts (file steps), labels (per slice), density 0..1, seed, mode? }
import { CONTINUE, HOME, ROLL, defaultEvent, normalizePattern } from './break_engine.js';
import { GROOVE_KINDS, groove, idm } from './break_grooves.js';
import { embed } from './break_embed.js';
import { beatRepeat } from './break_repeat.js';

// The first five build a groove from the file's own kicks, snares and hats (break_grooves.js); the rest cut the file by rule.
export const GENERATORS = ['jungle', 'dnb', 'halftime', 'funk', 'breakcore', 'idm', 'cutproc', 'warp', 'squarepusher', 'campanology', 'recursive', 'euclid'];

export function makeRng(seed) {
  let a = (Math.trunc(seed) >>> 0) || 1;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rng = { next, int: (n) => Math.floor(next() * n), chance: (p) => next() < p, pick: (list) => list[Math.floor(next() * list.length)] };
  rng.weighted = (items, weights) => { let r = next() * weights.reduce((x, y) => x + y, 0); for (let i = 0; i < items.length; i += 1) { r -= weights[i]; if (r < 0) return items[i]; } return items[items.length - 1]; };
  return rng;
}

const isAnchor = (label) => /kick|snare/.test(label ?? '');
const ev = (step, over) => ({ ...defaultEvent(step), ...over });

// Which slice starts on this pattern step (natural grid), or -1.
function sliceAt(ctx, step) {
  const pos = step % ctx.fileSteps;
  return ctx.sliceStarts.findIndex((s) => Math.round(s) === pos);
}

// Shuffle bag: every candidate comes up once before any repeats, and never twice in a row.
export function makeBag(rng, items) {
  let bag = []; let last = -1;
  return () => {
    if (!items.length) return CONTINUE;
    if (!bag.length) bag = items.slice().sort(() => rng.next() - 0.5);
    let i = bag.findIndex((x) => x !== last); if (i < 0) i = 0;
    last = bag.splice(i, 1)[0]; return last;
  };
}

// Kick and snare slices keep their natural place: re-sync the head on an anchor step, but only when an earlier jump or roll
// has pulled it off the grid. While the head is still on the break's own timeline the anchor needs no event, so a calm pattern stays calm.
function protectAnchors(pattern, ctx) {
  const events = pattern.events.slice();
  let off = false; // the head has been moved away from its natural position since the last re-sync
  for (let step = 0; step < pattern.steps; step += 1) {
    const at = events.findIndex((e) => e.step === step);
    const k = sliceAt(ctx, step);
    const anchor = k >= 0 && isAnchor(ctx.labels?.[k]);
    if (anchor && (at >= 0 || off)) {
      const spanEnd = Math.round(ctx.sliceStarts[k + 1] ?? ctx.fileSteps);
      // An event already on this step that plays the anchor's own slice (a snare roll, a kick double) or the natural place is kept.
      const keep = at >= 0 && (events[at].src === k || events[at].src === HOME) ? events[at] : null;
      const e = keep ?? ev(step, { src: k, len: Math.max(1, Math.min(spanEnd - step, 4)) });
      if (at >= 0) events[at] = e; else events.push(e);
      off = false;
    } else if (at >= 0) {
      const e = events[at];
      if (e.src !== HOME || e.rev) off = true;
    }
  }
  return normalizePattern({ steps: pattern.steps, events });
}

function candidates(ctx) {
  const all = ctx.sliceStarts.map((_, i) => i);
  const free = all.filter((i) => !isAnchor(ctx.labels?.[i]));
  return free.length >= 2 ? free : all;
}

// CutProc11: cut sizes from a weighted set (odd allowed), energy-weighted jumps, phrase-end stutter.
function cutproc(ctx, rng) {
  const events = []; const pick = makeBag(rng, candidates(ctx));
  const energy = [0, 0.3, 0, 0.5, 0.7, 0.8, 0.9, 0.6];
  // The last four steps of the phrase are reserved for a fill (with a chance proportional to density, none at 0); only *which* fill is random.
  const fill = ctx.steps >= 8 && rng.chance(0.9 * ctx.density);
  const limit = fill ? ctx.steps - 4 : ctx.steps;
  let step = 0;
  while (step < limit) {
    const len = Math.min(limit - step, rng.weighted([1, 2, 3, 4], [2, 4, 1.5, 2]));
    const jump = rng.chance(ctx.density * (0.35 + 0.65 * energy[(step % 16) >> 1]));
    if (jump) events.push(ev(step, { src: pick(), len }));
    else if (rng.chance(0.12 * ctx.density)) events.push(ev(step, { src: CONTINUE, len, rev: true }));
    step += len;
  }
  if (fill) {
    // the classic roll at the end of a phrase: accelerating or even, fading, often climbing in pitch
    const reps = rng.pick([4, 4, 6, 8]);
    events.push(ev(limit, { src: rng.chance(0.5) ? HOME : pick(), len: 4, reps, roll: rng.pick([ROLL.EVEN, ROLL.ACCEL, ROLL.ACCEL]), amp0: 1, amp1: 0.5 + 0.5 * rng.next(), pitch1: rng.chance(0.6) ? rng.pick([3, 5, 7]) : 0 }));
  }
  // Ghost notes: a quiet extra hit of the slice that follows, one step before a snare (the break's own syncopation).
  const snares = ctx.sliceStarts.map((s, i) => (/snare/.test(ctx.labels?.[i] ?? '') ? Math.round(s) : -1)).filter((s) => s >= 0);
  for (let bar = 0; bar < ctx.steps; bar += ctx.fileSteps) for (const s of snares) {
    const at = bar + s - 1;
    if (at < 0 || at >= ctx.steps || events.some((e) => at >= e.step && at < e.step + e.len)) continue;
    if (rng.chance(0.55 * ctx.density)) events.push(ev(at, { src: HOME, len: 1, amp0: 0.4, amp1: 0.4 }));
  }
  return events;
}

// Warp roll: even / geometrically accelerating / ritard repeats with an amplitude ramp, a few per phrase.
function warp(ctx, rng) {
  const events = []; const rolls = Math.max(1, Math.round(ctx.density * ctx.steps / 8));
  const spots = new Set();
  for (let i = 0; i < rolls; i += 1) spots.add(rng.pick([6, 7, 10, 11, 14, 15].filter((s) => s < ctx.steps).concat([ctx.steps - 4, ctx.steps - 2])));
  let busyUntil = 0;
  for (const step of [...spots].sort((a, b) => a - b)) {
    if (step < busyUntil) continue;          // rolls do not run into each other
    const len = Math.min(ctx.steps - step, rng.pick([2, 4, 4, 8]), busyUntil === 0 ? 8 : 8);
    if (len < 2) continue;
    busyUntil = step + len + 1;
    events.push(ev(step, { src: HOME, len, reps: rng.pick(len >= 8 ? [4, 8] : [2, 4]), roll: rng.pick([ROLL.EVEN, ROLL.ACCEL, ROLL.RITARD]), amp0: 1, amp1: rng.pick([0.4, 0.6, 1]), pitch1: rng.chance(0.3) ? rng.pick([-5, 7, 12]) : 0 }));
  }
  return events;
}

// Squarepusher-style fill cells: short fixed gestures of (source offset, length, repeats) over 4 steps.
const CELLS = [
  [[0, 1, 1], [0, 1, 1], [1, 2, 1]],          // stutter then step
  [[1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 1, 1]],// ping-pong
  [[0, 2, 4]],                                // roll across the cell
  [[0, 1, 1], [1, 1, 1], [1, 1, 1], [0, 1, 1]],
  [[2, 1, 1], [2, 1, 1], [0, 2, 1]],
  [[0, 3, 1], [1, 1, 1]],                     // 3+1 shuffle
  [[1, 1, 1], [2, 1, 1], [3, 1, 1], [0, 1, 1]],// scrambled
  [[0, 1, 1], [0, 1, 1], [0, 1, 1], [0, 1, 1]],
];
function squarepusher(ctx, rng) {
  const events = []; const free = candidates(ctx); const pick = makeBag(rng, free);
  for (let base = 0; base < ctx.steps; base += 4) {
    if (!rng.chance(0.25 + 0.75 * ctx.density)) continue;
    const first = Math.max(0, free.indexOf(pick())); const cell = rng.pick(CELLS); let at = base;
    for (const [off, len, reps] of cell) {
      if (at >= ctx.steps) break;
      const l = Math.min(len, ctx.steps - at);
      // `off` walks along the free slices (hats and ghosts), so the cell scrambles them without piling extra kicks on the break
      events.push(ev(at, { src: free[(first + off) % free.length], len: l, reps: reps <= l ? reps : 1, roll: ROLL.EVEN }));
      at += l;
    }
    if (at < base + 4 && at < ctx.steps) events.push(ev(at, { src: HOME, len: 1 }));
  }
  return events;
}

// Campanology: the slice order of each bar is the previous bar's with adjacent pairs swapped (change ringing).
function campanology(ctx, rng) {
  const n = ctx.sliceStarts.length; let order = Array.from({ length: n }, (_, i) => i);
  const events = []; const bar = 16;
  for (let base = 0; base < ctx.steps; base += bar) {
    const parity = (base / bar) % 2;
    // change ringing among the free slices only; kicks and snares stay on their places
    const free = order.map((k, i) => i).filter((i) => !isAnchor(ctx.labels?.[order[i]]));
    for (let j = parity; j + 1 < free.length; j += 2) if (rng.chance(0.4 + 0.6 * ctx.density)) [order[free[j]], order[free[j + 1]]] = [order[free[j + 1]], order[free[j]]];
    let at = base;
    order.forEach((k, i) => {
      const len = Math.max(1, Math.round((ctx.sliceStarts[i + 1] ?? ctx.fileSteps) - ctx.sliceStarts[i]));
      if (at < Math.min(base + bar, ctx.steps)) { events.push(ev(at, { src: k, len: Math.min(len, ctx.steps - at) })); }
      at += len;
    });
  }
  return events;
}

// Recursive cut: halve a block with probability, each leaf plays a slice or continues.
function recursive(ctx, rng) {
  const events = []; const pick = makeBag(rng, candidates(ctx));
  const cut = (start, len, depth) => {
    if (len > 1 && depth < 3 && rng.chance(0.35 + 0.5 * ctx.density)) {
      const a = Math.max(1, Math.round(len * rng.pick([0.5, 0.5, 0.25, 0.75])));
      cut(start, a, depth + 1); cut(start + a, len - a, depth + 1); return;
    }
    if (rng.chance(ctx.density)) events.push(ev(start, { src: pick(), len, reps: len >= 2 && rng.chance(0.3) ? 2 : 1 }));
  };
  for (let base = 0; base < ctx.steps; base += 8) cut(base, Math.min(8, ctx.steps - base), 0);
  return events;
}

// Euclid: k hits spread over the steps; a hit jumps to a slice, other steps continue.
export function euclidSteps(hits, steps) {
  const out = []; for (let i = 0; i < steps; i += 1) if (Math.floor((i * hits) / steps) !== Math.floor(((i - 1) * hits) / steps) || i === 0 && hits > 0) out.push(i);
  return out;
}
function euclid(ctx, rng) {
  const pick = makeBag(rng, candidates(ctx)); const hits = Math.max(2, Math.round(ctx.density * 10) + 2);
  return euclidSteps(hits, ctx.steps).map((s) => ev(s, { src: pick(), len: 1 }));
}

const helpers = { makeBag, candidates };
const IMPL = {
  ...Object.fromEntries(GROOVE_KINDS.map((k) => [k, (ctx, rng) => groove(k, ctx, rng, helpers)])),
  idm: (ctx, rng) => idm(ctx, rng, helpers),
  cutproc, warp, squarepusher, campanology, recursive, euclid,
};
// Role-based kinds place kick and snare on their own groove, so the file's natural anchors must not be forced back in.
const OWN_ANCHORS = new Set([...GROOVE_KINDS, 'idm']);

export function generate(kind, ctx) {
  if (!IMPL[kind]) throw new RangeError(`Unknown generator ${kind}`);
  const c = { density: 0.5, seed: 1, mode: OWN_ANCHORS.has(kind) ? 'embed' : undefined, ...ctx };
  const rng = makeRng(c.seed);
  const events = OWN_ANCHORS.has(kind) && c.mode === 'embed' ? embed(kind, c, rng, helpers) : IMPL[kind](c, rng);
  const raw = normalizePattern({ steps: c.steps, events });
  return OWN_ANCHORS.has(kind) ? raw : protectAnchors(raw, c);
}

// Beat Repeat overlay: on every `interval` steps (from `offset`) the grid stutters for `grid` steps with a decay.
export function beatRepeatOverlay(pattern, { interval = 8, offset = 6, grid = 2, reps = 4, decay = 0.5, pitchDecay = 0 } = {}) {
  const p = normalizePattern(pattern); const events = p.events.filter((e) => true);
  for (let step = offset; step + grid <= p.steps; step += interval) {
    const at = events.findIndex((e) => e.step === step);
    const e = ev(step, { src: HOME, len: grid, reps: Math.min(reps, grid), roll: ROLL.EVEN, amp1: 1 - decay, pitch1: pitchDecay });
    if (at >= 0) events[at] = e; else events.push(e);
  }
  return normalizePattern({ steps: p.steps, events });
}

// A small phrase set in one go: A calm, B busier, C a fill, chained so the break tells a story (A A B A A B C).
export function generateSet(kind, ctx) {
  const base = { density: 0.5, seed: 1, ...ctx };
  if (OWN_ANCHORS.has(kind) && (base.mode ?? 'embed') === 'embed') {
    // Embed counts ornaments, whatever the length: A calm (half), B as asked, C the fill pattern as asked.
    const n = Math.max(0, Math.trunc(base.count ?? 4));
    const a = generate(kind, { ...base, steps: 32, count: Math.ceil(n / 2), seed: base.seed });
    const b = generate(kind, { ...base, steps: 32, count: n, seed: base.seed + 1 });
    const fill = generate(kind, { ...base, steps: 16, count: Math.min(16, n), seed: base.seed + 2 });
    const c = beatRepeat(fill, base, { count: 2, seed: base.seed + 2 });      // the fill pattern ends in repeats of the hits that sounded
    return { patterns: [a, b, c], chain: [0, 0, 1, 0, 0, 1, 2] };
  }
  const a = generate(kind, { ...base, steps: 32, density: base.density * 0.5, seed: base.seed });
  const b = generate(kind, { ...base, steps: 32, density: Math.min(1, base.density * 1.1), seed: base.seed + 1 });
  const c = beatRepeatOverlay(generate(kind, { ...base, steps: 16, density: Math.min(1, base.density + 0.3), seed: base.seed + 2 }), { interval: 8, offset: 4, grid: 4, reps: 4, decay: 0.5, pitchDecay: 0 });
  return { patterns: [a, b, c], chain: [0, 0, 1, 0, 0, 1, 2] };
}
