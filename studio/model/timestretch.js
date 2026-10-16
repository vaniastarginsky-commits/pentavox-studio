// Waveform-similarity overlap-add (WSOLA) time stretching. Analysis positions are chosen from a mono
// sum, then shared by every channel so stereo phase relationships are preserved.
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function resampleShort(channels, sourceLength, targetLength) {
  return channels.map((source) => {
    const out = new Float32Array(targetLength);
    if (!sourceLength || !targetLength) return out;
    if (sourceLength === 1) { out.fill(Number.isFinite(source[0]) ? source[0] : 0); return out; }
    for (let i = 0; i < targetLength; i += 1) {
      const position = i * (sourceLength - 1) / Math.max(1, targetLength - 1);
      const left = Math.floor(position); const fraction = position - left;
      const a = Number.isFinite(source[left]) ? source[left] : 0; const b = Number.isFinite(source[Math.min(sourceLength - 1, left + 1)]) ? source[Math.min(sourceLength - 1, left + 1)] : 0;
      out[i] = a + (b - a) * fraction;
    }
    return out;
  });
}

export function timeStretch(channels, sampleRate, ratio) {
  if (!(ratio >= 0.5 && ratio <= 2) || !Number.isFinite(ratio)) throw new RangeError('Time-stretch ratio must be between 0.5 and 2');
  if (!Array.isArray(channels) || !channels.length) return [];
  const sourceLength = Math.min(...channels.map((channel) => channel.length));
  const targetLength = Math.round(sourceLength * ratio);
  if (!sourceLength || ratio === 1) return channels.map((channel) => Float32Array.from(channel.subarray(0, targetLength)));

  // A 50 ms frame with 75% overlap. Powers of two are not required, but rounding the
  // hop makes synthesis positions integral and keeps the hot loops simple.
  const frameLength = Math.max(32, Math.round(sampleRate * 0.05));
  if (sourceLength < frameLength) return resampleShort(channels, sourceLength, targetLength);
  const synthesisHop = Math.round(frameLength / 4); const overlap = frameLength - synthesisHop;
  const analysisHop = synthesisHop / ratio; const search = Math.round(sampleRate * 0.012);
  const mono = new Float32Array(sourceLength); const channelScale = 1 / channels.length;
  for (const channel of channels) for (let i = 0; i < sourceLength; i += 1) mono[i] += (Number.isFinite(channel[i]) ? channel[i] : 0) * channelScale;

  const window = new Float32Array(frameLength);
  for (let i = 0; i < frameLength; i += 1) window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i + 0.5) / frameLength);
  const output = channels.map(() => new Float32Array(targetLength)); const weights = new Float32Array(targetLength);
  const maxStart = sourceLength - frameLength; let sourceStart = 0;

  function correlation(reference, candidate, stride) {
    let dot = 0; let aa = 0; let bb = 0;
    for (let i = 0; i < overlap; i += stride) { const a = mono[reference + i]; const b = mono[candidate + i]; dot += a * b; aa += a * a; bb += b * b; }
    return aa > 1e-12 && bb > 1e-12 ? dot / Math.sqrt(aa * bb) : -Infinity;
  }

  function bestStart(expected, previous) {
    const low = Math.max(0, expected - search); const high = Math.min(maxStart, expected + search);
    if (low >= high) return clamp(expected, 0, maxStart);
    const reference = Math.min(sourceLength - overlap, previous + synthesisHop); let best = clamp(expected, low, high); let bestScore = -Infinity;
    // Coarse candidate and sample decimation keeps a 30-second stereo clip comfortably interactive.
    const candidateStep = 8; const sampleStep = 8; const first = low + ((best - low) % candidateStep);
    for (let candidate = first; candidate <= high; candidate += candidateStep) {
      const score = correlation(reference, candidate, sampleStep);
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    const refineLow = Math.max(low, best - candidateStep); const refineHigh = Math.min(high, best + candidateStep);
    for (let candidate = refineLow; candidate <= refineHigh; candidate += 1) {
      const score = correlation(reference, candidate, 4);
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    return best;
  }

  for (let outputStart = 0, frame = 0; outputStart < targetLength; outputStart += synthesisHop, frame += 1) {
    if (frame) sourceStart = bestStart(Math.round(frame * analysisHop), sourceStart);
    const count = Math.min(frameLength, targetLength - outputStart, sourceLength - sourceStart);
    for (let i = 0; i < count; i += 1) weights[outputStart + i] += window[i];
    channels.forEach((source, channel) => {
      const out = output[channel];
      for (let i = 0; i < count; i += 1) out[outputStart + i] += (Number.isFinite(source[sourceStart + i]) ? source[sourceStart + i] : 0) * window[i];
    });
  }
  for (let i = 0; i < targetLength; i += 1) if (weights[i] > 1e-8) for (const channel of output) channel[i] /= weights[i];
  return output;
}
