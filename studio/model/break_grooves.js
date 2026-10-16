// Role-based break generators: a genre skeleton (where kick, snare, ghosts and hats sit in a bar) is filled with the file's own
// slices of that role. This is how a jungle / drum'n'bass edit is actually built (resequence the chops onto a groove), instead of
// walking the file and jumping at random. Bars repeat with small mutations (repeat 3/4, vary 1/4) and the last bar of a phrase
// ends in a fill that belongs to the genre. Density only decides how many ornaments around the core groove come in:
// at 0 you get the bare backbeat.
import { CONTINUE, HOME, ROLL, defaultEvent } from './break_engine.js';

const ev = (step, over) => ({ ...defaultEvent(step), ...over });
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// slot = [step in the bar, role, amp, density threshold (0 = core, always there), chance once past the threshold]
// roles: K kick, S snare (backbeat), G ghost snare (quiet), H hat / small hit
export const GROOVES = {
  // Amen-style jungle: kick 1, kick on the "and" of 3, snare 2 and 4, a busy ghost-note pocket around the snares.
  jungle: {
    slots: [
      [0, 'K', 1, 0, 1], [4, 'S', 1, 0, 1], [10, 'K', 1, 0, 1], [12, 'S', 1, 0, 1],
      [2, 'K', 0.9, 0.2, 0.55], [11, 'K', 0.8, 0.5, 0.4],
      [7, 'G', 0.35, 0.25, 0.5], [9, 'G', 0.3, 0.35, 0.5], [14, 'G', 0.4, 0.45, 0.5], [15, 'G', 0.3, 0.6, 0.4], [1, 'G', 0.3, 0.7, 0.3],
      [6, 'H', 0.6, 0.15, 0.6], [8, 'H', 0.7, 0.1, 0.6], [13, 'H', 0.55, 0.4, 0.5], [5, 'H', 0.5, 0.55, 0.4],
    ],
    fills: [['roll', 3], ['stutter332', 2], ['skitter', 2], ['reverse', 1], ['dropout', 1]],
  },
  // Two-step drum'n'bass: kick 1 and "and" of 3, snare 2 and 4, rolling eighth hats; sparse ghosts, tight and rolling.
  dnb: {
    slots: [
      [0, 'K', 1, 0, 1], [4, 'S', 1, 0, 1], [10, 'K', 1, 0, 1], [12, 'S', 1, 0, 1],
      [2, 'H', 0.55, 0.1, 0.8], [6, 'H', 0.6, 0.1, 0.8], [8, 'H', 0.65, 0.1, 0.8], [14, 'H', 0.55, 0.1, 0.8],
      [3, 'K', 0.7, 0.45, 0.35], [7, 'G', 0.3, 0.4, 0.4], [15, 'G', 0.3, 0.55, 0.45], [11, 'H', 0.5, 0.65, 0.4],
    ],
    fills: [['roll', 3], ['dropout', 3], ['skitter', 1], ['reverse', 2]],
  },
  // Half-time (dub / half-step): the snare moves to beat 3, the kicks leave room, hats breathe.
  halftime: {
    slots: [
      [0, 'K', 1, 0, 1], [8, 'S', 1, 0, 1],
      [11, 'K', 0.85, 0.15, 0.6], [14, 'K', 0.8, 0.5, 0.35], [3, 'K', 0.7, 0.6, 0.3],
      [4, 'H', 0.55, 0.1, 0.7], [12, 'H', 0.6, 0.1, 0.7], [6, 'H', 0.45, 0.35, 0.5], [10, 'G', 0.3, 0.4, 0.5], [15, 'G', 0.3, 0.55, 0.4],
    ],
    fills: [['roll', 2], ['dropout', 3], ['reverse', 2]],
  },
  // Funk break (Funky Drummer / Think): syncopated kicks, snare 2 and 4, ghost snares everywhere between.
  funk: {
    slots: [
      [0, 'K', 1, 0, 1], [4, 'S', 1, 0, 1], [12, 'S', 1, 0, 1],
      [7, 'K', 0.9, 0.1, 0.7], [10, 'K', 0.9, 0.1, 0.7], [14, 'K', 0.75, 0.55, 0.4],
      [3, 'G', 0.3, 0.2, 0.55], [6, 'G', 0.3, 0.3, 0.5], [9, 'G', 0.35, 0.3, 0.55], [11, 'G', 0.3, 0.45, 0.5], [15, 'G', 0.35, 0.5, 0.5], [1, 'G', 0.25, 0.65, 0.4],
      [2, 'H', 0.6, 0.15, 0.55], [8, 'H', 0.65, 0.15, 0.55], [13, 'H', 0.5, 0.5, 0.4],
    ],
    fills: [['stutter332', 3], ['roll', 2], ['skitter', 2], ['dropout', 1]],
  },
  // Breakcore: the same backbeat, but a hit on almost every sixteenth, double-time kicks and long snare rolls.
  breakcore: {
    slots: [
      [0, 'K', 1, 0, 1], [4, 'S', 1, 0, 1], [8, 'K', 1, 0, 1], [12, 'S', 1, 0, 1],
      [2, 'K', 0.9, 0.1, 0.6], [6, 'H', 0.7, 0.1, 0.8], [10, 'K', 0.9, 0.1, 0.6], [14, 'S', 0.8, 0.2, 0.6],
      [1, 'H', 0.55, 0.2, 0.6], [3, 'H', 0.6, 0.2, 0.6], [5, 'G', 0.5, 0.3, 0.6], [7, 'S', 0.7, 0.3, 0.5], [9, 'H', 0.55, 0.3, 0.6],
      [11, 'K', 0.8, 0.35, 0.5], [13, 'G', 0.5, 0.4, 0.6], [15, 'S', 0.7, 0.4, 0.6],
    ],
    fills: [['roll', 4], ['skitter', 3], ['kickrun', 3], ['stutter332', 2]],
  },
};

export const GROOVE_KINDS = Object.keys(GROOVES);

const span = (ctx, i) => Math.max(1, Math.round((ctx.sliceStarts[i + 1] ?? ctx.fileSteps) - ctx.sliceStarts[i]));

// Slices of each role. Pure labels first ('kick' before 'kick+hat'); with no labels at all everything is "other".
function pools(ctx) {
  const labels = ctx.labels ?? []; const all = ctx.sliceStarts.map((_, i) => i);
  const of = (re, pure) => { const m = all.filter((i) => re.test(labels[i] ?? '')); const p = m.filter((i) => !/\+/.test(labels[i])); return pure && p.length ? p : m; };
  const kick = of(/kick/, true); const snare = of(/snare/, true); const hat = of(/hat/, true).filter((i) => !kick.includes(i) && !snare.includes(i));
  const other = all.filter((i) => !kick.includes(i) && !snare.includes(i) && !hat.includes(i));
  return { K: kick, S: snare, H: hat.length ? hat : other.length ? other : [], O: other };
}

// A role's source: a main voice (kept for the whole pattern, so the backbeat sounds like one drum kit) and alternates (variety).
export function voices(ctx, rng, h) {
  const p = pools(ctx); const out = {};
  for (const role of ['K', 'S', 'H']) {
    const list = p[role]; const bag = h.makeBag(rng, list);
    out[role] = { list, main: list.length ? list[rng.int(list.length)] : HOME, next: () => (list.length ? bag() : HOME) };
  }
  out.G = { list: p.S, next: () => (p.S.length ? p.S[rng.int(p.S.length)] : HOME) };
  out.pools = p;
  return out;
}

// One hit: the slice plays its own length (so a kick keeps its tail), cut by whatever comes next.
function hit(ctx, step, src, amp, over = {}) {
  const natural = src >= 0 ? span(ctx, src) : 1;
  return ev(step, { src, len: Math.min(natural, 4), amp0: amp, amp1: amp, ...over });
}

function buildBar(ctx, rng, v, groove, density) {
  const taken = new Map();
  const put = (e) => { if (!taken.has(e.step)) taken.set(e.step, e); };
  for (const [step, role, amp, from, chance] of groove.slots) {
    if (from > 0 && !(density > from && rng.chance(chance))) continue;     // ornaments only above their density threshold
    let src;
    if (role === 'K') src = (from === 0 || rng.chance(0.5)) ? v.K.main : v.K.next();
    else if (role === 'S') src = (from === 0 && !(density > 0.55 && step >= 12 && rng.chance(0.25))) ? v.S.main : v.S.next();
    else if (role === 'G') src = v.G.next();
    else src = v.H.next();
    const accent = role === 'H' ? 0.85 + 0.15 * (step % 4 === 2 ? 1 : 0) : 1;             // off-beat hats lean in
    put(hit(ctx, step, src, clamp01(amp * accent), role === 'G' || role === 'H' ? { len: 1 } : {}));
  }
  return taken;
}

// The next bar is the base bar with a few of its non-core hits moved, swapped or dropped.
function mutate(ctx, rng, v, groove, density, bar) {
  const core = new Set(groove.slots.filter((s) => s[3] === 0).map((s) => s[0]));
  const events = new Map([...bar].map(([k, e]) => [k, { ...e }]));
  const edits = 1 + Math.round(density * 2);
  for (let n = 0; n < edits; n += 1) {
    const free = [...events.keys()].filter((s) => !core.has(s));
    const kind = rng.weighted(['swap', 'move', 'drop', 'add'], [3, 2, 1.5, 1.5 * density + 0.2]);
    if (kind === 'add') {
      const step = rng.pick([1, 3, 5, 7, 9, 11, 13, 15]);
      if (!events.has(step) && !core.has(step)) events.set(step, hit(ctx, step, v.G.next(), 0.3 + 0.1 * rng.int(3), { len: 1 }));
    } else if (!free.length) continue;
    else if (kind === 'drop') events.delete(rng.pick(free));
    else if (kind === 'move') {
      const s = rng.pick(free); const to = s + rng.pick([-1, 1]); const e = events.get(s);
      if (to >= 0 && to < 16 && !events.has(to) && !core.has(to)) { events.delete(s); events.set(to, { ...e, step: to }); }
    } else { const s = rng.pick(free); const e = events.get(s); const role = v.pools.H.includes(e.src) ? 'H' : 'G'; events.set(s, { ...e, src: v[role].next() }); }
  }
  return events;
}

// Fills occupy the end of a bar and replace what is there. `at` = first step of the fill inside the bar.
function applyFill(kind, ctx, rng, v, bar, density) {
  const clear = (from) => { for (const s of [...bar.keys()]) if (s >= from) bar.delete(s); };
  if (kind === 'roll') {
    // the snare itself rolls: accelerating or even, fading in or out, often climbing in pitch
    const long = density > 0.6 && rng.chance(0.4); const at = long ? 8 : 12; clear(at);
    const reps = rng.pick(long ? [8, 8, 6] : [4, 6, 8]); const up = rng.chance(0.6);
    bar.set(at, ev(at, { src: v.S.main, len: 16 - at, reps, roll: rng.pick([ROLL.EVEN, ROLL.ACCEL, ROLL.ACCEL]), amp0: up ? 0.55 : 1, amp1: up ? 1 : 0.45, pitch1: rng.chance(0.6) ? rng.pick([3, 5, 7]) : 0 }));
  } else if (kind === 'dropout') {
    // everything but the snare falls away for a beat and one hit pulls it back
    clear(13); bar.set(13, ev(13, { src: CONTINUE, len: 2, gate: false })); bar.set(15, hit(ctx, 15, rng.chance(0.5) ? v.K.main : v.H.next(), 0.9, { len: 1 }));
  } else if (kind === 'skitter') {
    clear(12); const roles = ['S', 'K', 'S', 'K']; const rest = rng.int(4);
    roles.forEach((role, i) => { const s = 12 + i; if (i === rest && rng.chance(0.6)) bar.set(s, ev(s, { src: CONTINUE, len: 1, gate: false })); else bar.set(s, hit(ctx, s, v[role].next(), role === 'S' ? 0.9 - 0.15 * i : 0.8, { len: 1 })); });
  } else if (kind === 'reverse') {
    clear(14); bar.set(14, ev(14, { src: v.S.main, len: 2, rev: true, amp0: 0.9, amp1: 0.9 }));
  } else if (kind === 'kickrun') {
    clear(12); [12, 13, 14].forEach((s, i) => bar.set(s, hit(ctx, s, v.K.next(), 0.85 - 0.05 * i, { len: 1 }))); bar.set(15, hit(ctx, 15, v.S.main, 1, { len: 1 }));
  } else if (kind === 'stutter332') {
    // 3 + 3 + 2 over the last half bar: the odd cut that makes a break feel pushed
    clear(8); const srcs = [v.K.next(), v.S.next(), v.H.next()];
    [[8, 3], [11, 3], [14, 2]].forEach(([s, len], i) => bar.set(s, ev(s, { src: srcs[i], len, reps: len === 3 ? rng.pick([1, 3]) : 2, roll: ROLL.EVEN, amp0: 1, amp1: 0.7 })));
  }
}

function pickFill(groove, rng, density) {
  return rng.weighted(groove.fills.map((f) => f[0]), groove.fills.map((f) => f[1] * (0.4 + density)));
}

// A pattern of any length in bars: bar 1 is the groove, each following bar is a mutation of the one before, the last bar carries a fill.
export function groove(kind, ctx, rng, h) {
  const g = GROOVES[kind]; const bars = Math.max(1, ctx.steps >> 4); const v = voices(ctx, rng, h);
  const density = clamp01(ctx.density);
  let bar = buildBar(ctx, rng, v, g, density); const events = [];
  const fillChance = density === 0 ? 0 : bars === 1 ? 0.5 * density : 0.35 + 0.6 * density;
  for (let b = 0; b < bars; b += 1) {
    if (b > 0 && density > 0) bar = mutate(ctx, rng, v, g, density, bar);
    const out = new Map([...bar].map(([k, e]) => [k, { ...e }]));
    const last = b === bars - 1; const mid = bars >= 4 && b === (bars >> 1) - 1;   // a small turnaround halfway through a 4-bar phrase
    if ((last && rng.chance(fillChance)) || (mid && rng.chance(fillChance * 0.4))) applyFill(pickFill(g, rng, density), ctx, rng, v, out, density);
    for (const e of out.values()) events.push({ ...e, step: e.step + b * 16 });
  }
  // a hit never runs into the next one, and a rest keeps its own length
  events.sort((a, b) => a.step - b.step);
  return events;
}

// IDM: the bar is cut into groups of 3, 5 and 2 steps that rotate bar by bar (3+3+2+3+3+2, 5+3+5+3 ...). Each group plays a slice, the
// bigger ones repeat with a decay, pitch drifts, and the last bar ends in a progressive roll (64th -> 32nd -> 16th).
const GROUPINGS = [[3, 3, 2, 3, 3, 2], [3, 3, 3, 3, 2, 2], [5, 3, 5, 3], [4, 4, 3, 3, 2], [2, 3, 3, 2, 3, 3], [5, 5, 3, 3], [3, 2, 3, 2, 3, 3]];
export function idm(ctx, rng, h) {
  const v = voices(ctx, rng, h); const density = clamp01(ctx.density); const events = []; const bars = Math.max(1, ctx.steps >> 4);
  const grouping = rng.pick(GROUPINGS); const free = h.candidates(ctx); const bag = h.makeBag(rng, free.length ? free : ctx.sliceStarts.map((_, i) => i));
  for (let b = 0; b < bars; b += 1) {
    const rot = b % grouping.length; const groups = grouping.slice(rot).concat(grouping.slice(0, rot));
    let at = 0; let total = 0; const bar = [];
    for (const len of groups) { if (total + len > 16) { bar.push(16 - total); total = 16; break; } bar.push(len); total += len; }
    if (total < 16) bar.push(16 - total);
    at = 0;
    bar.forEach((len, i) => {
      const step = b * 16 + at; at += len;
      // the first group is the downbeat kick, the group that covers step 4 or 12 carries the snare; the others are the file's small hits
      const covers = (s) => at - len <= s && s < at;
      const role = i === 0 ? 'K' : (covers(4) || covers(12)) ? 'S' : null;
      const src = role ? (v[role].list.length ? (rng.chance(0.7) ? v[role].main : v[role].next()) : HOME) : bag();
      const repeats = len >= 3 && rng.chance(0.15 + 0.7 * density);
      events.push(ev(step, {
        src, len, reps: repeats ? rng.pick(len >= 5 ? [3, 4] : [2, 3]) : 1, roll: repeats ? rng.pick([ROLL.EVEN, ROLL.ACCEL, ROLL.RITARD]) : ROLL.EVEN,
        amp0: role ? 1 : 0.75 + 0.25 * rng.next(), amp1: repeats ? 0.35 + 0.3 * rng.next() : 1,
        pitch1: repeats && rng.chance(0.3 * density) ? rng.pick([-5, 5, 7, 12]) : 0,
      }));
    });
  }
  if (density > 0 && rng.chance(0.4 + 0.5 * density)) {
    const at = ctx.steps - 4; const keep = events.filter((e) => e.step < at);
    const tail = events.filter((e) => e.step < at && e.step + e.len > at).pop(); if (tail) tail.len = at - tail.step;
    keep.push(ev(at, { src: v.S.main, len: 4, reps: 8, roll: rng.pick([ROLL.ACCEL, ROLL.RITARD]), amp0: 0.4, amp1: 1, pitch1: rng.pick([0, 5, 7]) }));
    return keep;
  }
  return events;
}
