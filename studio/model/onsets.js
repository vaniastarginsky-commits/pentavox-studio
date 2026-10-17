// Spectral-flux onset detector. Pure; no DOM, no audio.
const FRAME = 1024;
const HOP = 256;
const MIN_SPACING = 0.05;     // seconds

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1; const ang = -2 * Math.PI / len; const wr = Math.cos(ang); const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < half; k += 1) {
        const a = i + k; const b = a + half;
        const vr = re[b] * cr - im[b] * ci; const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi; re[a] += vr; im[a] += vi;
        const next = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = next;
      }
    }
  }
}

function mixDown(channels) {
  const length = channels[0]?.length ?? 0; const mono = new Float32Array(length);
  for (const channel of channels) for (let i = 0; i < length; i += 1) mono[i] += channel[i] / channels.length;
  return mono;
}

// Positive change of the log-magnitude spectrum from frame to frame.
function spectralFlux(mono, firstBin = 0, lastBin = FRAME / 2) {
  const frames = Math.max(0, Math.floor((mono.length - FRAME) / HOP) + 1);
  const flux = new Float32Array(frames);
  const window = Float32Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / FRAME));
  const re = new Float64Array(FRAME); const im = new Float64Array(FRAME); const bins = FRAME / 2;
  const stopBin = Math.min(bins, Math.max(firstBin + 1, lastBin));
  let previous = new Float32Array(bins); let current = new Float32Array(bins);
  for (let f = 0; f < frames; f += 1) {
    const base = f * HOP;
    for (let i = 0; i < FRAME; i += 1) { re[i] = mono[base + i] * window[i]; im[i] = 0; }
    fft(re, im);
    let sum = 0;
    for (let k = 0; k < bins; k += 1) {
      current[k] = Math.log1p(Math.hypot(re[k], im[k]));
      const d = current[k] - previous[k]; if (k >= firstBin && k < stopBin && d > 0) sum += d;
    }
    flux[f] = f === 0 ? 0 : sum / (stopBin - firstBin);
    [previous, current] = [current, previous];
  }
  return flux;
}

// Move a flux peak to the start of the energy rise. First find the steepest
// 1 ms RMS step near the frame, then walk back to where that rise left the
// local noise floor; the steepest step itself can sit well inside a snare.
function refine(mono, sampleRate, frameIndex) {
  const block = Math.max(1, Math.round(sampleRate * 0.001));
  const from = Math.max(0, frameIndex * HOP - FRAME); const to = Math.min(mono.length - block, frameIndex * HOP + FRAME);
  const positions = []; const levels = []; let bestIndex = 0; let bestRise = 0; let previous = 0;
  for (let at = from; at <= to; at += block) {
    let sum = 0; for (let i = 0; i < block; i += 1) sum += mono[at + i] * mono[at + i];
    const rms = Math.sqrt(sum / block);
    positions.push(at); levels.push(rms);
    if (at > from && rms - previous > bestRise) { bestRise = rms - previous; bestIndex = levels.length - 1; }
    previous = rms;
  }
  let floor = levels[0] ?? 0;
  for (let i = 1; i <= bestIndex; i += 1) floor = Math.min(floor, levels[i]);
  const threshold = floor + ((levels[bestIndex] ?? floor) - floor) * 0.08;
  let onset = bestIndex;
  while (onset > 0 && levels[onset - 1] > threshold) onset -= 1;
  return (positions[onset] ?? frameIndex * HOP) / sampleRate;
}

// Sample-accurate start of a sharp attack. The flux/RMS refinement above works in 1 ms blocks and can land a few ms away from the first sample of
// the hit. Look for the place where the peak envelope (0.1 ms hold) jumps by at least SHARP_RISE over the previous millisecond, in a window
// around the coarse time; the strongest such jump is the beginning of the attack (the sample before it is the quietest). Then walk to the first
// sample that reaches a few per cent of the attack's peak and step back PRE_ROLL, so the click is never cut. A soft onset (a hat swelling out of
// a tail, a cymbal over a wash) has no such jump: its coarse time is kept.
export const SHARP_RISE = 4;               // x4 = +12 dB over the previous 1 ms
export const SHARP_BACK_SECONDS = 0.008;   // how far before the coarse time the attack may start
export const SHARP_FORWARD_SECONDS = 0.002;
export const PRE_ROLL_SECONDS = 0.00025;   // a marker sits this long before the first sample of the attack
function sharpen(signal, sampleRate, time) {
  const hold = Math.max(1, Math.round(0.0001 * sampleRate)); const lookback = Math.max(hold, Math.round(0.001 * sampleRate));
  const first = Math.max(lookback, Math.round((time - SHARP_BACK_SECONDS) * sampleRate)); const last = Math.min(signal.length - lookback - 1, Math.round((time + SHARP_FORWARD_SECONDS) * sampleRate));
  if (!(last > first)) return time;
  // envelope on a 0.1 ms grid over [first - lookback, last + lookback]
  const base = first - lookback; const cells = Math.floor((last + lookback - base) / hold) + 1; const env = new Float32Array(cells);
  for (let c = 0; c < cells; c += 1) { let m = 0; const from = base + c * hold; for (let n = from; n < from + hold && n < signal.length; n += 1) { const v = Math.abs(signal[n]); if (v > m) m = v; } env[c] = m; }
  const back = Math.round(lookback / hold); let best = -1; let bestRatio = SHARP_RISE;
  for (let c = back; c < cells - back; c += 1) {
    let before = 0; for (let k = c - back; k < c; k += 1) if (env[k] > before) before = env[k];
    let after = 0; for (let k = c; k < c + back && k < cells; k += 1) if (env[k] > after) after = env[k];
    const ratio = after / (before + 1e-6); if (ratio > bestRatio) { bestRatio = ratio; best = c; }
  }
  if (best < 0) return time;
  let peak = 0; for (let k = best; k < Math.min(cells, best + back); k += 1) if (env[k] > peak) peak = env[k];
  const level = peak * 0.05; let onset = base + best * hold;
  for (let n = base + best * hold; n < base + (best + back + 1) * hold && n < signal.length; n += 1) if (Math.abs(signal[n]) >= level) { onset = n; break; }   // the jump may be anywhere in the next ms
  return Math.max(0, onset / sampleRate - PRE_ROLL_SECONDS);
}

// A hit makes the signal louder. The flux detector also fires on things that do not: the abrupt end of a gated kick, a click inside a tail.
// Those leave the level where it was (-1..+1 dB over 10 ms), real hits, even soft hats and a ride, rise by 2.5 dB or more.
export const MIN_LEVEL_RISE_DB = 2;
export const LEVEL_WINDOW_SECONDS = 0.01;
function levelRiseDb(mono, sampleRate, time) {
  const w = Math.max(1, Math.round(LEVEL_WINDOW_SECONDS * sampleRate)); const at = Math.round(time * sampleRate);
  if (at < w || at + w > mono.length) return Infinity;   // too close to an edge to compare
  let before = 0; let after = 0; for (let i = 0; i < w; i += 1) { before += mono[at - w + i] * mono[at - w + i]; after += mono[at + i] * mono[at + i]; }
  return 10 * Math.log10((after + 1e-12) / (before + 1e-12));
}

// Adaptive-threshold peak picking on one flux curve. Strength is normalised by the curve's own maximum, so a quiet
// band (hats) competes fairly with a loud one (kick).
function pickPeaks(flux, sensitivity, hopSeconds, { multSpan = 2.8, floorSpan = 0.3, minTop = 1e-6 } = {}, flag = false) {
  let top = 0; for (const v of flux) if (v > top) top = v;
  if (!(top > minTop)) return [];
  const s = Math.min(1, Math.max(0, sensitivity)); const radius = Math.max(2, Math.round(0.1 / hopSeconds));
  const mult = 1.2 + multSpan * (1 - s); const floor = top * (0.03 + floorSpan * (1 - s));
  const picks = [];
  for (let f = 1; f < flux.length; f += 1) {
    let sum = 0; let n = 0;
    for (let k = Math.max(0, f - radius); k <= Math.min(flux.length - 1, f + radius); k += 1) { sum += flux[k]; n += 1; }
    if (flux[f] <= (sum / n) * mult + floor) continue;
    let isPeak = true;
    for (let k = Math.max(0, f - 3); k <= Math.min(flux.length - 1, f + 3); k += 1) if (flux[k] > flux[f]) { isPeak = false; break; }
    if (isPeak) picks.push({ frame: f, strength: flux[f] / top, hat: Boolean(flag) });
  }
  return picks;
}

// A steady hat pattern keeps the local mean high, so this pass uses a gentler threshold than the full-band one.
// minTop: the band must really change (a steady tone leaks numerical noise up there, normalised that would look like hits).
const HAT_PICK = { multSpan: 1.0, floorSpan: 0.1, minTop: 0.02 };
const HAT_BAND_HZ = 6000;
const KICK_BAND_HZ = 1000;

// Two cascaded one-pole high-pass filters at HAT_BAND_HZ.
function highPass(mono, sampleRate) {
  const a = Math.exp(-2 * Math.PI * HAT_BAND_HZ / sampleRate); const out = new Float32Array(mono.length);
  let y1 = 0; let x1 = 0; let y2 = 0; let x2 = 0;
  for (let i = 0; i < mono.length; i += 1) { const y = a * (y1 + mono[i] - x1); x1 = mono[i]; y1 = y; const z = a * (y2 + y - x2); x2 = y; y2 = z; out[i] = z; }
  return out;
}   // the second detector only listens above this: hats are far quieter than kick and snare

export function detectOnsets(channels, sampleRate, { sensitivity = 0.5, maxOnsets = 31, hats = true } = {}) {
  if (!channels?.length || !channels[0]?.length) return [];
  const mono = mixDown(channels); const duration = mono.length / sampleRate; const hop = HOP / sampleRate;
  const flux = spectralFlux(mono); if (!flux.length) return [];
  const picks = pickPeaks(flux, sensitivity, hop);
  // A tonal kick occupies only a handful of the full spectrum's bins. Loud
  // broadband snares can otherwise set the full-band threshold high enough to
  // hide every kick between them, so let the low band compete on its own scale.
  const lastKickBin = Math.ceil(KICK_BAND_HZ * FRAME / sampleRate);
  if (lastKickBin > 4) picks.push(...pickPeaks(spectralFlux(mono, 0, lastKickBin), sensitivity, hop));
  // Hat pass: flux of the bins above HAT_BAND_HZ only, thresholded against ITS OWN maximum.
  if (hats) {
    const firstBin = Math.ceil(HAT_BAND_HZ * FRAME / sampleRate);
    if (firstBin < FRAME / 2 - 4) picks.push(...pickPeaks(spectralFlux(mono, firstBin), sensitivity, hop, HAT_PICK, true));
  }
  picks.sort((a, b) => a.frame - b.frame || b.strength - a.strength);
  const spaced = [];
  for (const pick of picks) {
    const last = spaced[spaced.length - 1];
    if (last && (pick.frame - last.frame) * hop < MIN_SPACING) { if (pick.strength > last.strength) spaced[spaced.length - 1] = pick; }
    else spaced.push(pick);
  }
  const strongest = spaced.sort((a, b) => b.strength - a.strength).slice(0, Math.max(0, maxOnsets)).sort((a, b) => a.frame - b.frame);
  // A hat pick is placed on the energy rise of the HIGH band, not of the full signal: under a kick the full-band RMS
  // wobbles with the bass and the steepest step lands up to a frame away from the hat.
  const bright = strongest.some((pick) => pick.hat) ? highPass(mono, sampleRate) : null;
  // Slice 0 already starts at the file boundary. Treat that boundary as an
  // implicit onset, otherwise refinement of the opening hit can add a second
  // marker a few milliseconds into the very same kick.
  const times = strongest.map((pick) => { const signal = pick.hat ? bright : mono; return sharpen(signal, sampleRate, refine(signal, sampleRate, pick.frame)); }).filter((t) => t >= MIN_SPACING && t < duration - 0.005 && levelRiseDb(mono, sampleRate, t) >= MIN_LEVEL_RISE_DB);
  const out = [];
  for (const t of times) if (!out.length || t - out[out.length - 1] >= MIN_SPACING) out.push(t);
  return out;
}

// Guess the tempo of a loop from its onsets. `onsets` are seconds from the start of the clip, `length` is the clip
// length in seconds. The clip is assumed to hold a whole number of beats, so every beat count that gives 70-200 BPM is
// tried as a grid, with the best phase. A candidate scores 0.6 * (share of beats that have a hit on them) +
// 0.4 * (share of hits that sit on the 16th-note grid), so syncopated drum breaks still fit. Similar candidates normally
// use the broad 110 BPM prior. The exception is a dense 150-185 BPM two-step: hats on eighths plus kick/snare backbeats
// are strong evidence that the fast candidate is a DnB/jungle tempo, not its 75-92.5 BPM half-time interpretation.
function powerOfTwoBars(beats) { const bars = beats / 4; return Number.isInteger(bars) && bars > 0 && (bars & (bars - 1)) === 0; }
function near(value, target, tolerance) { return Math.abs(value - target) <= tolerance; }
function presentation(candidate) { return { bpm: Number(candidate.bpm.toFixed(2)), beats: candidate.beats }; }

function looksLikeFastBreak(candidate, hits, labels, tolerance) {
  if (candidate.bpm < 150 || candidate.bpm > 185 || !powerOfTwoBars(candidate.beats)) return false;
  if (hits.length / candidate.beats < 1.4) return false;                 // hats/ghosts near eighth-note density
  if (!labels || labels.length !== hits.length) return true;
  const step = 60 / candidate.bpm; const snares = []; let kicks = 0; let hats = 0;
  labels.forEach((label, i) => {
    const parts = String(label).split('+');
    if (parts.includes('snare')) snares.push(hits[i]);
    if (parts.includes('kick')) kicks += 1;
    if (parts.includes('hat')) hats += 1;
  });
  if (kicks < 2 || snares.length < 2 || hats < candidate.beats * 0.75) return false;
  let backbeats = 0;
  for (let i = 1; i < snares.length; i += 1) if (near(snares[i] - snares[i - 1], 2 * step, Math.max(tolerance * 2, step * 0.18))) backbeats += 1;
  return backbeats >= Math.max(1, Math.floor((snares.length - 1) * 0.5));
}

// Returns { bpm, beats, alternatives? } or null when nothing fits (fewer than 3 hits, or an irregular pattern).
export function estimateTempo(onsets, length, { minBpm = 70, maxBpm = 200, tolerance = 0.03, threshold = 0.6, labels = null } = {}) {
  const hits = onsets.filter((t) => t >= 0 && t < length);
  if (hits.length < 3 || !(length > 0)) return null;
  const candidates = [];
  for (let beats = 1; beats <= 256; beats += 1) {
    const bpm = beats * 60 / length;
    if (bpm < minBpm || bpm > maxBpm) continue;
    const step = 60 / bpm; const fine = step / 4;
    const phases = [0, ...hits.map((t) => ((t % step) + step) % step)];
    let top = 0;
    for (const phase of phases) {
      let onBeats = 0; let points = 0;
      for (let p = phase; p < length - 1e-9; p += step) { points += 1; if (hits.some((t) => Math.abs(t - p) <= tolerance)) onBeats += 1; }
      if (!points) continue;
      let onGrid = 0;
      for (const t of hits) { const k = Math.round((t - phase) / fine); if (Math.abs(t - (phase + k * fine)) <= tolerance) onGrid += 1; }
      const score = 0.6 * onBeats / points + 0.4 * onGrid / hits.length + (phase === 0 ? 0.02 : 0);
      if (score > top) top = score;
    }
    candidates.push({ score: top, closeness: Math.abs(Math.log(bpm / 110)), bpm, beats });
  }
  const topScore = Math.max(...candidates.map((candidate) => candidate.score));
  if (!(topScore >= threshold)) return null;
  const close = candidates.filter((candidate) => candidate.score > topScore - 0.02);
  let best = close.reduce((winner, candidate) => !winner || candidate.closeness < winner.closeness ? candidate : winner, null);

  // Only override the general tempo prior when both octave grids fit and the fast grid carries the characteristic
  // information the half-time reading hides: roughly two events per beat and a two-beat kick/snare backbeat period.
  const fast = candidates
    .filter((candidate) => candidate.score >= threshold && candidate.score >= topScore - 0.04 && looksLikeFastBreak(candidate, hits, labels, tolerance))
    .sort((a, b) => b.score - a.score)[0];
  if (fast) {
    const half = candidates.find((candidate) => candidate.beats * 2 === fast.beats && Math.abs(candidate.bpm * 2 - fast.bpm) < 0.01);
    if (half && half.score >= threshold && half.score >= fast.score - 0.04) best = fast;
  }

  const result = presentation(best);
  const alternatives = candidates
    .filter((candidate) => candidate !== best && candidate.score >= threshold && candidate.score >= best.score - 0.04
      && (candidate.beats * 2 === best.beats || candidate.beats === best.beats * 2))
    .map(presentation);
  if (alternatives.length) result.alternatives = alternatives;
  return result;
}
