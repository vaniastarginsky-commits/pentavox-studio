// Browser preview of a Break pattern: the slice context the engine needs, and an offline render of grains to audio.
// No DOM, no AudioContext: the UI wraps the returned channels in an AudioBuffer.
import { exportSlices } from './slices.js';
import { renderChain } from './break_engine.js';

const FADE = 48;   // samples (1 ms) of de-click at every cut that is not a seamless continuation

// null when the item has no slices to point at.
export function breakContext(item) {
  const sr = item.audio.sampleRate; const trimDur = item.trimEnd - item.trimStart;
  if (!(trimDur > 0)) return null;
  const cut = exportSlices(item.slices.markers, item.slices.labels, item.trimStart, item.trimEnd, sr);
  if (cut.frames.length < 2) return null;
  const bpm = Number(item.bpm); const beats = Number(item.beats);
  const fileSteps = beats > 0 ? beats * 4 : bpm > 0 ? Math.max(1, Math.round(trimDur * bpm / 15)) : 16;
  return { sampleRate: sr, trimStart: item.trimStart, trimDur, fileSteps, stepSec: trimDur / fileSteps,
    sliceStarts: cut.frames.map((f) => f / sr / trimDur * fileSteps), labels: cut.labels };
}

const same = (a, b) => Math.abs(a - b) < 1e-9;
const seamless = (prev, g, fileSteps, steps) => prev && g && !prev.rev && !g.rev && prev.pitch === 0 && g.pitch === 0 && prev.gain === g.gain
  && same((prev.t + prev.dur) % steps, g.t % steps) && same(((prev.src + prev.dur) % fileSteps + fileSteps) % fileSteps, g.src);

/**
 * @param grains   from renderChain / renderPattern
 * @param channels source Float32Arrays (the whole file; the trim window is cut out here)
 * @returns Float32Array[] of `steps` grid steps at the file's own tempo
 */
export function renderGrains(grains, steps, channels, ctx) {
  const sr = ctx.sampleRate; const start = Math.round(ctx.trimStart * sr);
  const len = Math.min(Math.round(ctx.trimDur * sr), channels[0].length - start);
  const stepSamples = ctx.stepSec * sr; const total = Math.round(steps * stepSamples);
  const out = channels.map(() => new Float32Array(total));
  grains.forEach((g, i) => {
    const prev = grains[(i + grains.length - 1) % grains.length]; const next = grains[(i + 1) % grains.length];   // the pattern loops
    const fadeIn = !seamless(prev, g, ctx.fileSteps, steps); const fadeOut = !seamless(g, next, ctx.fileSteps, steps);
    const dst = Math.round(g.t * stepSamples); const count = Math.min(Math.round(g.dur * stepSamples), total - dst);
    const rate = 2 ** (g.pitch / 12); const srcSamples = g.dur * stepSamples;
    const origin = g.src * stepSamples;
    for (let n = 0; n < count; n += 1) {
      let gain = g.gain;
      if (fadeIn && n < FADE) gain *= n / FADE;
      if (fadeOut && count - 1 - n < FADE) gain *= (count - 1 - n) / FADE;
      const pos = g.rev ? origin + srcSamples * rate - 1 - n * rate : origin + n * rate;   // reverse starts at the end of what a forward grain would read
      const wrapped = ((pos % len) + len) % len; const i0 = Math.floor(wrapped); const frac = wrapped - i0; const i1 = (i0 + 1) % len;
      for (let c = 0; c < channels.length; c += 1) {
        const x = channels[c]; out[c][dst + n] += gain * (x[start + i0] * (1 - frac) + x[start + i1] * frac);
      }
    }
  });
  return out;
}

export function renderBankAudio(bank, channels, ctx) {
  const { grains, steps } = renderChain(bank.patterns, bank.chain.length ? bank.chain : [0], { sliceStarts: ctx.sliceStarts, fileSteps: ctx.fileSteps });
  return { channels: renderGrains(grains, steps, channels, ctx), steps, grains };
}
