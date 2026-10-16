// Reference Break engine: turns a pattern into a list of grains (what plays when). Pure, no DOM, no audio.
// The firmware must produce the same list; see docs/superpowers/specs/2026-10-06-break-engine-design.md.
export const CONTINUE = -1;
export const HOME = -2;
export const ROLL = { EVEN: 0, ACCEL: 1, RITARD: 2 };
export const REPS = [1, 2, 3, 4, 6, 8];
export const PATTERN_STEPS = [16, 32, 48, 64, 80, 96, 112, 128];   // 1-8 bars
export const ACCEL_RATIO = 0.8;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function defaultEvent(step) {
  return { step, src: CONTINUE, len: 1, reps: 1, roll: ROLL.EVEN, amp0: 1, amp1: 1, pitch0: 0, pitch1: 0, rev: false, gate: true };
}

// Fixes up whatever a generator or the editor produced: ranges, sort, one event per step, no overlap.
export function normalizePattern(pattern) {
  const steps = PATTERN_STEPS.includes(pattern?.steps) ? pattern.steps : 16;
  const byStep = new Map();
  for (const raw of pattern?.events ?? []) {
    const step = Math.trunc(raw.step);
    if (!(step >= 0 && step < steps)) continue;
    const e = { ...defaultEvent(step), ...raw, step };
    e.src = Math.trunc(e.src); if (e.src < HOME) e.src = CONTINUE;
    e.len = clamp(Math.trunc(e.len) || 1, 1, steps - step);
    e.reps = REPS.includes(e.reps) ? e.reps : 1;
    e.roll = [0, 1, 2].includes(e.roll) ? e.roll : ROLL.EVEN;
    e.amp0 = clamp(Number(e.amp0), 0, 1); e.amp1 = clamp(Number(e.amp1), 0, 1);
    e.pitch0 = clamp(Number(e.pitch0), -12, 12); e.pitch1 = clamp(Number(e.pitch1), -12, 12);
    e.rev = Boolean(e.rev); e.gate = e.gate !== false;
    byStep.set(step, e);
  }
  const events = [...byStep.values()].sort((a, b) => a.step - b.step);
  for (let i = 0; i + 1 < events.length; i += 1) events[i].len = Math.min(events[i].len, events[i + 1].step - events[i].step);
  return { steps, events };
}

// Durations of the `reps` repeats inside `len` steps (they always sum to len).
export function repeatDurations(len, reps, roll) {
  if (reps <= 1) return [len];
  if (roll === ROLL.EVEN) return Array.from({ length: reps }, () => len / reps);
  const a = ACCEL_RATIO; const norm = (1 - a) / (1 - a ** reps);
  const accel = Array.from({ length: reps }, (_, i) => len * a ** i * norm);
  return roll === ROLL.ACCEL ? accel : accel.reverse();
}

const wrap = (pos, fileSteps) => ((pos % fileSteps) + fileSteps) % fileSteps;

/**
 * @param pattern  normalized pattern
 * @param ctx      { sliceStarts: file-step start of each slice, fileSteps, head?: starting play head }
 * @returns { grains, head }  grains: { t, src, dur, gain, pitch, rev }; head: the play head after the pattern
 */
export function renderPattern(pattern, { sliceStarts, fileSteps, head = 0 }) {
  const p = normalizePattern(pattern);
  const grains = []; let h = wrap(head, fileSteps); let step = 0; let i = 0;
  while (step < p.steps) {
    const e = p.events[i]?.step === step ? p.events[i++] : null;
    if (!e) { grains.push({ t: step, src: h, dur: 1, gain: 1, pitch: 0, rev: false }); h = wrap(h + 1, fileSteps); step += 1; continue; }
    if (e.src === HOME) h = wrap(step, fileSteps);
    else if (e.src >= 0) h = wrap(sliceStarts[Math.min(e.src, sliceStarts.length - 1)] ?? 0, fileSteps);
    const durs = repeatDurations(e.len, e.reps, e.roll); let t = step;
    durs.forEach((dur, r) => {
      const k = e.reps > 1 ? r / (e.reps - 1) : 0;
      if (e.gate) grains.push({ t, src: h, dur, gain: e.amp0 + (e.amp1 - e.amp0) * k, pitch: e.pitch0 + (e.pitch1 - e.pitch0) * k, rev: e.rev });
      t += dur;
    });
    h = wrap(h + e.len, fileSteps); step += e.len;
  }
  return { grains, head: h };
}

// A chain plays patterns one after another; the head carries over from pattern to pattern.
export function renderChain(bank, chain, ctx) {
  const out = []; let head = ctx.head ?? 0; let offset = 0;
  for (const index of chain) {
    const pattern = bank[index]; if (!pattern) continue;
    const r = renderPattern(pattern, { ...ctx, head });
    for (const g of r.grains) out.push({ ...g, t: g.t + offset });
    head = r.head; offset += normalizePattern(pattern).steps;
  }
  return { grains: out, head, steps: offset };
}
