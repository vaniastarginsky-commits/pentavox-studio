// Beat repeat, the way a drummer / BBCut / Beat Repeat does it: the hit that has just sounded is grabbed and repeated in a short, shaped roll,
// on a place where it belongs (the pick-up before a snare, the "a" of beats 2 and 4, the end of a phrase), never on top of a kick or a snare.
// `count` repeats over the WHOLE pattern, whatever its length; 0 changes nothing. Seeded, so the same seed gives the same repeats.
import { CONTINUE, HOME, ROLL, defaultEvent, normalizePattern, renderPattern } from './break_engine.js';
import { makeRng } from './break_generators.js';

const ev = (step, over) => ({ ...defaultEvent(step), ...over });
const roleOf = (label) => (/kick/.test(label ?? '') ? 'K' : /snare/.test(label ?? '') ? 'S' : /hat/.test(label ?? '') ? 'H' : 'O');

// [len in steps, repeats]: the grid of the repeat (1/16 pairs, eighth grid, triplet, quarter roll, very fast)
const SHAPES = [[1, 2], [1, 4], [2, 2], [2, 4], [3, 3], [4, 4], [4, 8], [2, 8]];
const LONG_AT_END = new Set([[4, 4].join(), [4, 8].join(), [2, 8].join()]);

// The slice that sounds at the natural position `pos` (file steps): the last one that starts at or before it.
function sliceAt(sliceStarts, pos) {
  let best = 0;
  sliceStarts.forEach((s, i) => { if (s <= pos + 1e-6) best = i; });
  return best;
}

export function beatRepeat(pattern, ctx, { count = 2, seed = 1 } = {}) {
  const p = normalizePattern(pattern);
  const n = Math.max(0, Math.min(p.steps, Math.trunc(Number(count)) || 0));
  if (n === 0 || !ctx.sliceStarts?.length || !ctx.fileSteps) return p;
  const rng = makeRng(seed); const steps = p.steps; const bars = steps / 16;
  const labels = ctx.labels ?? [];
  const hitAt = new Map(); ctx.sliceStarts.forEach((s, i) => hitAt.set(((Math.round(s) % ctx.fileSteps) + ctx.fileSteps) % ctx.fileSteps, roleOf(labels[i])));
  const byStep = new Map(p.events.map((e) => [e.step, { ...e }]));
  const heavy = (step) => hitAt.get(step % ctx.fileSteps) === 'K' || hitAt.get(step % ctx.fileSteps) === 'S'
    || (byStep.has(step) && byStep.get(step).src >= 0 && /K|S/.test(roleOf(labels[byStep.get(step).src])) && byStep.get(step).amp0 > 0.6);

  // what sounds just before each step, from the pattern as it is now
  const { grains } = renderPattern(p, { sliceStarts: ctx.sliceStarts, fileSteps: ctx.fileSteps, head: 0 });
  const soundingAt = (step) => grains.find((g) => g.t <= step + 1e-9 && step < g.t + g.dur - 1e-9) ?? grains[grains.length - 1];

  const weight = (step) => {
    const local = step % 16; const bar = Math.floor(step / 16); const g = bar % 4;
    let w = 0.4;
    if (local === 15 || local === 14) w += 4; else if (local === 7 || local === 11) w += 2.5; else if (local % 4 === 3) w += 1.5;
    if (hitAt.get((step + 1) % ctx.fileSteps) === 'S') w += 3;
    const f = bars >= 4 ? (g === 3 ? 2 : g === 1 ? 1.2 : g === 0 ? 0.5 : 1) : bars === 2 ? (bar === 1 ? 1.5 : 0.7) : 1;
    return w * f;
  };
  const taken = new Set(); const chosen = [];
  const free = (step) => step < steps && !taken.has(step) && !heavy(step);
  let guard = 0;
  while (chosen.length < n && guard++ < steps * 6) {
    const open = Array.from({ length: steps }, (_, i) => i).filter(free);
    if (!open.length) break;
    const step = rng.weighted(open, open.map((s) => weight(s) * ([s - 16, s + 16].some((x) => chosen.some((c) => c.step === x)) ? 0.2 : 1)));
    const local = step % 16; const atEnd = local >= 12; const last = Math.floor(step / 16) === bars - 1;
    // a shape that fits: it may not run over a kick / snare or into another repeat
    const fits = SHAPES.filter(([len]) => { for (let s = step; s < step + len; s += 1) if (s >= steps || taken.has(s) || (s > step && heavy(s))) return false; return true; });
    if (!fits.length) { taken.add(step); continue; }
    const [len, reps] = rng.weighted(fits, fits.map((sh) => (LONG_AT_END.has(sh.join()) ? (atEnd ? 3 : 0.5) : atEnd ? 1 : 2.5)));
    const roll = rng.pick([ROLL.EVEN, ROLL.ACCEL, ROLL.RITARD]);
    const build = last && atEnd && rng.chance(0.3);
    const amp0 = build ? 0.4 : 1; const amp1 = build ? 1 : 0.25 + 0.35 * rng.next();
    let pitch1 = 0;
    if (!build && rng.chance(0.2)) pitch1 = rng.pick([-5, -7, -12]);
    else if (last && atEnd && rng.chance(0.4)) pitch1 = rng.pick([7, 12]);
    const sounding = soundingAt(step);
    const src = sliceAt(ctx.sliceStarts, ((sounding.src % ctx.fileSteps) + ctx.fileSteps) % ctx.fileSteps);
    chosen.push({ step, len, reps, roll, amp0, amp1, pitch1, src, rev: rng.chance(0.1), stop: rng.chance(0.1) });
    for (let s = step; s < step + len + 1; s += 1) taken.add(s);            // repeats never touch
  }

  for (const c of chosen) {
    for (let s = c.step; s < c.step + c.len; s += 1) if (s > c.step) byStep.delete(s);   // what the repeat covers is replaced
    byStep.set(c.step, ev(c.step, { src: c.src, len: c.len, reps: c.reps, roll: c.roll, amp0: c.amp0, amp1: c.amp1, pitch1: c.pitch1, rev: c.rev }));
    const end = c.step + c.len;
    if (end < steps) {
      // a stutter-stop leaves one step of air; otherwise the break goes on from its own grid
      if (c.stop && !heavy(end)) byStep.set(end, ev(end, { src: CONTINUE, len: 1, gate: false }));
      else if (!byStep.has(end)) byStep.set(end, ev(end, { src: HOME, len: 1 }));
    }
  }
  return normalizePattern({ steps, events: [...byStep.values()] });
}
