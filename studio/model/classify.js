// Small, deterministic drum-hit classifier. Transparent rules on band ratios, no trained model.
// Tuned on real breaks, where a kick has a loud 150 Hz-2.5 kHz click, a hat sits ABOVE its own mid band,
// and a hat almost never plays alone: it is layered under the kick and snare. So:
//  - features are RATIOS between bands (dB), not shares or absolute levels;
//  - the window just before the hit is measured too, so a decaying tail is not mistaken for a new hit;
//  - classifyHits() also infers the hat that is hidden under another hit from the hat pattern around it ("snare+hat").
export const ANALYSIS_PRE_SECONDS = 0.002;        // the analysed hit window starts this long before the marker
export const ANALYSIS_POST_SECONDS = 0.040;
export const TAIL_WINDOW_SECONDS = 0.040;         // the window measured just before it, to tell a hit from a decaying tail
export const CLIP_EDGE_SECONDS = 0.010;
export const SILENCE_RMS = 1e-4;
export const LOW_HZ = 150;
export const MID_HIGH_HZ = 2500;
export const HIGH_HZ = 6000;
export const MIN_RISE_DB = 3;                     // some band must rise at least this much over the tail, else it is not a new hit
export const KICK_LOW_HZ = [25, 300];             // a kick lives down here (fundamental ~50-150 Hz); a snare's energy is above
export const KICK_WINDOW_SECONDS = 0.10;          // low frequencies need a long window: 50 Hz is a 20 ms period, 40 ms resolves nothing
export const KICK_LOW_RISE_DB = 14;               // kick, second way: the <150 Hz band jumped this much over the window before the hit ...
export const KICK_LOW_OVER_BRIGHT_RISE_DB = 9;    // 10 missed a quiet ghost kick by 0.2 dB (9.8); everything else in that break is below -6
export const KICK_RISE_MIN_LOW_MINUS_BRIGHT_DB = -8;   // ...but only when the low band is not clearly weaker than the bright one (real kicks in a cymbal wash: 0..+8, real snares <= -15)   // ... and by this much more than the >2.5 kHz band did (cymbal wash over a loop hides the first rule)
export const KICK_LOW_MINUS_BRIGHT_DB = 10;
export const KICK_ABS_MIN_LOW_RISE_DB = 5;        // the absolute rule only counts when the low band really rose over the window before (a steady bass bed does not rise)...
export const KICK_ABS_MIN_MID_RISE_DB = 20;       // ...or the hit is broadband (a kick right behind another kick: its sub is still ringing but its click is new)       // kick: the 25-300 Hz band beats everything above 2.5 kHz by this much (kicks +14..+28 dB, snares -30..+7)
export const HAT_HIGH_MINUS_MID_DB = -4;          // hat: the >6 kHz band is at least this close to the mid band (kick ~-16, snare ~-8)
export const HAT_ON_TAIL_BRIGHTER_DB = 6;         // a hit that only looks like a kick/snare because of a ringing tail: what it ADDED is brighter than that...
export const HAT_ON_TAIL_HIGH_RISE_DB = 6;        // ...its >6 kHz band rose by this much, and more than its mid band did (kick/snare: mid rises more) -> a hat on the tail
export const HAT_BRIGHT_HIGH_MINUS_MID_DB = 3.5;  // hat, whatever its decay (hats that ring, sit under a tail or are marked a little early show decay 0.7-2.9, so it cannot be required). Hand-labelled breaks (tests/fixtures/drum_loop_*): hats +5..+10 dB, snares -3..-13, kicks -12..-20, a ghost kick +1.8 (taken by the kick rule first)
export const HAT_MAX_DECAY = 0.56;                // hat: last third of the window / first third (RMS), snares ring longer
export const SNARE_MIN_MID_DB = -999;             // reserved: a snare is whatever mid-heavy hit is neither kick nor hat
export const LATTICE_TOLERANCE_SECONDS = 0.025;   // a hit this close to the hat grid counts as on it
export const LATTICE_REACH = 2;                   // ...when a plain hat sits within this many grid steps
export const LATTICE_MIN_HATS = 3;                // fewer plain hats than this and no hat pattern is assumed

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1; const angle = -2 * Math.PI / len; const wr = Math.cos(angle); const wi = Math.sin(angle);
    for (let base = 0; base < n; base += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < half; k += 1) {
        const a = base + k; const b = a + half; const br = re[b] * cr - im[b] * ci; const bi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - br; im[b] = im[a] - bi; re[a] += br; im[a] += bi;
        const next = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = next;
      }
    }
  }
}

function rms(values, from = 0, to = values.length) {
  let energy = 0; for (let i = from; i < to; i += 1) energy += values[i] * values[i];
  return Math.sqrt(energy / Math.max(1, to - from));
}

function mixWindow(channels, first, last) {
  const mono = new Float64Array(Math.max(0, last - first));
  for (const channel of channels) for (let i = 0; i < mono.length; i += 1) mono[i] += (channel[first + i] ?? 0) / channels.length;
  return mono;
}

// Energy in four bands of a Hann-windowed block.
function bandEnergies(mono, sampleRate) {
  let size = 1; while (size < mono.length) size <<= 1;
  const re = new Float64Array(size); const im = new Float64Array(size);
  for (let i = 0; i < mono.length; i += 1) re[i] = mono[i] * (mono.length === 1 ? 1 : 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (mono.length - 1)));
  fft(re, im);
  const out = { low: 0, mid: 0, pres: 0, high: 0 };
  for (let k = 1; k <= size / 2; k += 1) {
    const hz = k * sampleRate / size; const energy = re[k] * re[k] + im[k] * im[k];
    if (hz < LOW_HZ) out.low += energy; else if (hz < MID_HIGH_HZ) out.mid += energy; else if (hz < HIGH_HZ) out.pres += energy; else out.high += energy;
  }
  return out;
}

const dB = (x) => 10 * Math.log10(x + 1e-12);

// One-pole high-pass, applied twice: keeps what rings above `hz` so the decay of a hit is not judged by a bass tail.
function highPass(mono, sampleRate, hz) {
  const a = Math.exp(-2 * Math.PI * hz / sampleRate); const out = new Float64Array(mono.length);
  let y1 = 0; let x1 = 0; let y2 = 0; let x2 = 0;
  for (let i = 0; i < mono.length; i += 1) { const y = a * (y1 + mono[i] - x1); x1 = mono[i]; y1 = y; const z = a * (y2 + y - x2); x2 = y; y2 = z; out[i] = z; }
  return out;
}
const DECAY_HIGH_PASS_HZ = 3000;

// Low / mid / bright levels over the long window (it stops short of the next hit so that one is not measured as well).
function kickBands(channels, sampleRate, time, limitTime) {
  const length = channels[0].length;
  const first = Math.max(0, Math.floor((time - ANALYSIS_PRE_SECONDS) * sampleRate));
  let last = Math.min(length, Math.ceil((time + KICK_WINDOW_SECONDS) * sampleRate));
  if (Number.isFinite(limitTime) && limitTime > time) last = Math.min(last, Math.floor((limitTime - 0.003) * sampleRate));
  last = Math.max(last, Math.min(length, first + Math.round(0.04 * sampleRate)));
  const mono = mixWindow(channels, first, last); if (!mono.length) return null;
  let size = 1; while (size < mono.length) size <<= 1;
  const re = new Float64Array(size); const im = new Float64Array(size);
  for (let i = 0; i < mono.length; i += 1) re[i] = mono[i] * (mono.length === 1 ? 1 : 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (mono.length - 1)));
  fft(re, im);
  const out = { low: 0, mid: 0, bright: 0 };
  for (let k = 1; k <= size / 2; k += 1) {
    const hz = k * sampleRate / size; const energy = re[k] * re[k] + im[k] * im[k];
    if (hz < KICK_LOW_HZ[0]) continue;
    if (hz < KICK_LOW_HZ[1]) out.low += energy; else if (hz < MID_HIGH_HZ) out.mid += energy; else out.bright += energy;
  }
  return out;
}

/** The numbers the rules look at (exported for tuning and tests). Returns null for silence or an unusable position.
 *  `limitTime` (optional) is the next hit: the long sub window ends before it. */
export function hitFeatures(channels, sampleRate, time, limitTime) {
  const length = channels?.[0]?.length ?? 0; const duration = length / sampleRate;
  if (!channels?.length || !(sampleRate > 0) || !Number.isFinite(time) || time < 0 || time >= duration - CLIP_EDGE_SECONDS) return null;
  const first = Math.max(0, Math.floor((time - ANALYSIS_PRE_SECONDS) * sampleRate));
  const last = Math.min(length, Math.ceil((time + ANALYSIS_POST_SECONDS) * sampleRate));
  const mono = mixWindow(channels, first, last);
  if (!mono.length || rms(mono) < SILENCE_RMS) return null;
  const post = bandEnergies(mono, sampleRate);
  if (!(post.low + post.mid + post.pres + post.high > 0)) return null;
  // The window just before the hit. Too little room before it (the very start of the clip) counts as no tail.
  const tailEnd = first; const tailStart = Math.max(0, tailEnd - Math.round(TAIL_WINDOW_SECONDS * sampleRate));
  let rise = Infinity; let midRise = Infinity; let highRise = Infinity; let lowRise = Infinity; let brightRise = Infinity;
  if (tailEnd - tailStart >= Math.round(TAIL_WINDOW_SECONDS * sampleRate * 0.5)) {
    const pre = bandEnergies(mixWindow(channels, tailStart, tailEnd), sampleRate);
    midRise = dB(post.mid) - dB(pre.mid); highRise = dB(post.high) - dB(pre.high);
    lowRise = dB(post.low) - dB(pre.low); brightRise = dB(post.pres + post.high) - dB(pre.pres + pre.high);
    rise = Math.max(dB(post.low) - dB(pre.low), midRise, dB(post.pres) - dB(pre.pres), highRise);
  }
  const bright = highPass(mono, sampleRate, DECAY_HIGH_PASS_HZ); const third = Math.max(1, Math.floor(bright.length / 3));
  const decay = rms(bright, bright.length - third) / Math.max(SILENCE_RMS * 0.1, rms(bright, 0, third));
  const kb = kickBands(channels, sampleRate, time, limitTime);
  const lowMinusBright = kb ? dB(kb.low) - dB(kb.bright) : -Infinity;
  return { lowRise, brightRise, lowMinusBright, lowMinusMid: dB(post.low) - dB(post.mid), highMinusMid: dB(post.high) - dB(post.mid), brightMinusMid: dB(post.pres + post.high) - dB(post.mid), decay, rise, midRise, highRise, midDb: dB(post.mid) };
}

/** 'kick' | 'snare' | 'hat' | 'other' for one hit. */
export function classifyHit(channels, sampleRate, time, limitTime) {
  const f = hitFeatures(channels, sampleRate, time, limitTime);
  if (!f || f.rise < MIN_RISE_DB) return 'other';
  const hatOnTail = f.decay <= HAT_MAX_DECAY && f.highRise >= HAT_ON_TAIL_HIGH_RISE_DB && f.highRise - f.midRise >= HAT_ON_TAIL_BRIGHTER_DB;
  // A kick is low-heavy with little above it (at most a click); a snare has as much or more mid and bright energy as low.
  const kickByRise = f.lowRise >= KICK_LOW_RISE_DB && f.lowRise - f.brightRise >= KICK_LOW_OVER_BRIGHT_RISE_DB
    && f.lowMinusBright >= KICK_RISE_MIN_LOW_MINUS_BRIGHT_DB;
  const lowIsNew = f.lowRise >= KICK_ABS_MIN_LOW_RISE_DB || !Number.isFinite(f.lowRise) || f.midRise >= KICK_ABS_MIN_MID_RISE_DB;
  if ((f.lowMinusBright >= KICK_LOW_MINUS_BRIGHT_DB && lowIsNew) || kickByRise) return hatOnTail ? 'hat' : 'kick';
  // A hat is far brighter than any snare, however it decays and whatever rings under it (hand-labelled breaks: hats +5..+10, snares -3..-13, kicks -15..-20).
  const hatBySpectrum = f.highMinusMid >= HAT_BRIGHT_HIGH_MINUS_MID_DB;
  if (f.highMinusMid >= HAT_HIGH_MINUS_MID_DB && (f.decay <= HAT_MAX_DECAY || hatBySpectrum)) return 'hat';
  if (f.midDb >= SNARE_MIN_MID_DB) return hatOnTail ? 'hat' : 'snare';
  return 'other';
}

// Hats are the quickest, steadiest voice in a groove. Take the spacing of the plain hats, and tag every other hit that
// lies on that grid with a plain hat nearby as carrying a hat too.
function layerHats(times, labels) {
  const hats = times.filter((_, i) => labels[i] === 'hat');
  if (hats.length < LATTICE_MIN_HATS) return labels;
  const gaps = []; for (let i = 1; i < hats.length; i += 1) gaps.push(hats[i] - hats[i - 1]);
  gaps.sort((a, b) => a - b);
  const step = gaps[Math.floor(gaps.length * 0.25)];                      // the short gaps are the real step, long ones skip a layered hit
  if (!(step > 0.03)) return labels;
  return labels.map((label, i) => {
    if (label !== 'kick' && label !== 'snare') return label;
    for (const hat of hats) {
      const steps = (times[i] - hat) / step; const nearest = Math.round(steps);
      if (nearest !== 0 && Math.abs(nearest) <= LATTICE_REACH && Math.abs(times[i] - hat - nearest * step) <= LATTICE_TOLERANCE_SECONDS) return `${label}+hat`;
    }
    return label;
  });
}

/** Labels for a list of hit times: 'kick' | 'snare' | 'hat' | 'other', or 'kick+hat' / 'snare+hat' when a hat runs under it. */
export function classifyHits(channels, sampleRate, times) {
  return layerHats(times, times.map((time, i) => classifyHit(channels, sampleRate, time, times[i + 1])));
}
