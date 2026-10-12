// Embed: ornaments laid into a break that otherwise keeps playing on its own timeline. Nothing of the file's rhythm is copied or replaced:
// an ornament is one event on a *free* step (a step where no slice of the file starts); the event after it is `HOME`, which puts the play
// head back on the file's own grid, so the break carries on as if nothing had happened.
//
// `ctx.count` is the number of ornaments over the WHOLE pattern, whatever its length (4 on one bar is 4 on eight bars; a count equal to the
// number of steps fills the pattern as far as it can be filled). They are drawn over all bars at once, so bars differ: the end of every two-
// and four-bar group carries more, the same step is avoided in neighbouring bars, kinds rotate, and on four or more bars an ornament may be
// answered two bars later by the same kind on another slice.
import { CONTINUE, HOME, ROLL, defaultEvent } from './break_engine.js';
import { GROOVES, voices } from './break_grooves.js';

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const ev = (step, over) => ({ ...defaultEvent(step), ...over });
const roleOf = (label) => (/kick/.test(label ?? '') ? 'K' : /snare/.test(label ?? '') ? 'S' : /hat/.test(label ?? '') ? 'H' : 'O');

// How many ornaments a call asks for: `count`, or (callers that still think in 0..1) a share of the steps.
export function ornamentCount(ctx) {
  if (ctx.count != null) return Math.max(0, Math.min(ctx.steps, Math.trunc(Number(ctx.count)) || 0));
  return Math.round(clamp01(ctx.density) * ctx.steps / 3);
}

function fileHits(ctx) {
  const hits = new Map();
  ctx.sliceStarts.forEach((start, i) => hits.set(((Math.round(start) % ctx.fileSteps) + ctx.fileSteps) % ctx.fileSteps, roleOf(ctx.labels?.[i])));
  return hits;
}

// How much a bar is wanted: the end of a two- and four-bar group more, its first bar less.
function barFactor(bar, bars) {
  if (bars === 1) return 1;
  if (bars === 2) return bar === 1 ? 1.6 : 0.7;
  const g = bar % 4;
  return g === 3 ? 2 : g === 1 ? 1.2 : g === 0 ? 0.5 : 1;
}

// Every free step of the pattern with a weight: the genre's own ghost / hat places and the pick-ups before the file's snares count most.
function placePool(kind, ctx, hits) {
  const slots = (GROOVES[kind] ?? GROOVES.breakcore).slots;
  const bars = ctx.steps / 16; const pool = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const base = bar * 16; const weight = new Map();
    const add = (step, w) => { if (step >= base && step < base + 16 && !hits.has(step % ctx.fileSteps)) weight.set(step, (weight.get(step) ?? 0.6) + w); };
    for (let step = base; step < base + 16; step += 1) if (!hits.has(step % ctx.fileSteps)) weight.set(step, 0.6);   // any free step can take one
    for (const [slot, role] of slots) if (role === 'G' || role === 'H') add(base + slot, 4);
    for (let step = base; step < base + 16; step += 1) {
      if (hits.get((step + 1) % ctx.fileSteps) === 'S') add(step, 6);
      if (hits.get((step + 2) % ctx.fileSteps) === 'S') add(step, 3);
      if (step % 4 === 3) add(step, 2);
      if (step % 8 === 5) add(step, 2);
      if (step % 2 === 0 && hits.get((step - 2 + ctx.fileSteps) % ctx.fileSteps) === 'K') add(step, 1);
    }
    add(base + 15, 3);
    for (const [step, w] of weight) pool.push({ step, weight: w * barFactor(bar, bars) });
  }
  return pool;
}

function sourceChoices(ctx, v) {
  const have = { K: false, S: false, H: false };
  for (const label of ctx.labels ?? []) { const role = roleOf(label); if (role in have) have[role] = true; }
  const unlabelled = !ctx.labels?.length && ctx.sliceStarts.length > 0;     // no labels: small hits from whatever the file has
  return {
    kick: have.K ? () => v.K.next() : null,
    snare: have.S ? () => v.G.next() : null,
    hat: have.H || unlabelled ? () => v.H.next() : null,
  };
}

// One ornament of `kind` at `step`; `room` is how many steps (>= 1) it may cover without touching a hit of the file or another ornament.
function make(kind, step, room, last, sources, rng) {
  if (kind === 'snare') { const amp = 0.3 + 0.15 * rng.next(); return ev(step, { src: sources.snare(), len: 1, amp0: amp, amp1: amp }); }
  if (kind === 'hat') { const amp = 0.5 + 0.2 * rng.next(); return ev(step, { src: sources.hat(), len: 1, amp0: amp, amp1: amp }); }
  if (kind === 'kick') return ev(step, { src: sources.kick(), len: 1, amp0: 0.35, amp1: 0.35 });
  // a micro-roll lives inside its own step (thirty-seconds), so it never touches the next hit
  if (kind === 'roll') return ev(step, { src: sources.snare(), len: 1, reps: rng.pick([3, 4]), roll: ROLL.ACCEL, amp0: 0.45, amp1: 0.85 });
  if (kind === 'reverse') return ev(step, { src: (sources.snare ?? sources.hat)(), len: Math.min(2, room), rev: true, amp0: 0.8, amp1: 0.8 });
  return ev(step, { src: CONTINUE, len: Math.min(room, rng.pick([1, 2])), gate: false });          // dropout: a rest
}

function kindsFor(sources, local, last, dense) {
  const kinds = [];
  const offer = (kind, weight, yes) => { if (yes) kinds.push([kind, weight]); };
  offer('snare', 4, Boolean(sources.snare));
  offer('hat', 4, Boolean(sources.hat));
  offer('kick', 2, Boolean(sources.kick));
  offer('roll', 3, Boolean(sources.snare) && local >= 6);
  offer('reverse', 3, last && local >= 13 && Boolean(sources.snare || sources.hat));
  offer('dropout', 2, dense && local >= 10);
  return kinds;
}

export function embed(kind, ctx, rng, helpers) {
  const count = ornamentCount(ctx);
  if (count <= 0 || !ctx.steps || !ctx.fileSteps || !ctx.sliceStarts?.length) return [];
  const hits = fileHits(ctx); const v = voices(ctx, rng, helpers); const sources = sourceChoices(ctx, v);
  if (!sources.snare && !sources.hat && !sources.kick) return [];
  const steps = ctx.steps; const bars = steps / 16; const dense = count > steps * 0.2;
  const pool = placePool(kind, ctx, hits);
  const taken = new Set(); const chosen = new Map(); const recent = [];
  const room = (step) => { let n = 1; while (step + n < steps && !hits.has((step + n) % ctx.fileSteps) && !taken.has(step + n) && n < 2) n += 1; return n; };
  const place = (e) => { chosen.set(e.step, e); for (let s = e.step; s < e.step + e.len; s += 1) taken.add(s); };
  const neighbours = (step) => [step - 16, step + 16].some((s) => chosen.has(s));       // the same place in the bar before / after

  let guard = 0;
  while (chosen.size < count && guard++ < steps * 8) {
    const open = pool.filter((p) => !taken.has(p.step));
    if (!open.length) break;
    const pick = rng.weighted(open, open.map((p) => p.weight * (neighbours(p.step) ? 0.15 : 1)));
    const bar = Math.floor(pick.step / 16); const local = pick.step % 16;
    const offers = kindsFor(sources, local, bar === bars - 1, dense);
    if (!offers.length) { pool.splice(pool.indexOf(pick), 1); continue; }
    const choice = rng.weighted(offers.map((o) => o[0]), offers.map(([k, w]) => (recent.length === 2 && recent[0] === k && recent[1] === k ? w * 0.2 : w)));
    const e = make(choice, pick.step, room(pick.step), bar === bars - 1, sources, rng);
    place(e); recent.push(choice); if (recent.length > 2) recent.shift();
    // call and answer: two bars later the same kind, another slice
    const answer = pick.step + 32;
    if (bars >= 4 && chosen.size < count && choice !== 'dropout' && answer < steps && !taken.has(answer) && !hits.has(answer % ctx.fileSteps) && rng.chance(0.3)) {
      place(make(choice, answer, room(answer), answer >= (bars - 1) * 16, sources, rng));
    }
  }

  // After every ornament the play head goes back to the file's own grid.
  const events = new Map(chosen);
  for (const e of chosen.values()) {
    const end = e.step + e.len;
    if (end < steps && !events.has(end)) events.set(end, ev(end, { src: HOME, len: 1 }));
  }
  return [...events.values()].sort((a, b) => a.step - b.step);
}
