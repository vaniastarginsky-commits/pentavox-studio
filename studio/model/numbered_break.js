// Explicit numbered-grid to Break bank conversion. This does not convert Slice Lab clips
// or alter source audio; callers must obtain an intentional jump sequence from the user.
import { defaultEvent } from './break_engine.js';

/**
 * One-based slice numbers in `sequence`, one jump per grid cell. `sourceBars`
 * describes the complete loop, independently of the number of pattern bars.
 * Frame positions are rounded to nearest integer and the errors are returned.
 * Throws instead of letting WAV/Break encoders clamp or discard information.
 */
export function numberedBreak({ frames, sourceBars, patternBars, division, sequence, maxSlices = 32 }) {
  if (!Number.isSafeInteger(frames) || frames < 1) throw new RangeError('Invalid audio frame count');
  if (!Number.isInteger(sourceBars) || sourceBars < 1 || sourceBars > 8) throw new RangeError('Source length must be 1–8 bars');
  if (!Number.isInteger(patternBars) || patternBars < 1 || patternBars > 8) throw new RangeError('Pattern length must be 1–8 bars');
  if (division !== 4 && division !== 8) throw new RangeError('Only 1/4 or 1/8 grid is supported');
  if (!Number.isInteger(maxSlices) || maxSlices < 2 || maxSlices > 64) throw new RangeError('Invalid firmware slice limit');
  const sliceCount = sourceBars * division;
  if (sliceCount > maxSlices) throw new RangeError(`Source needs ${sliceCount} slices; firmware limit is ${maxSlices}`);
  if (frames < sliceCount) throw new RangeError('Not enough frames for unique slice boundaries');
  if (!Array.isArray(sequence) || sequence.length !== patternBars * division) throw new RangeError('A slice number is required for every pattern cell');
  if (sequence.some(n => !Number.isInteger(n) || n < 1 || n > sliceCount)) throw new RangeError('Slice number outside the source grid');
  const slices = Array.from({ length: sliceCount }, (_, i) => Math.round(frames * i / sliceCount));
  const rounding = slices.map((frame, i) => frame - frames * i / sliceCount);
  const stepLength = 16 / division;
  const events = sequence.map((n, i) => ({ ...defaultEvent(i * stepLength), src: n - 1, len: stepLength }));
  return { slices, beats: sourceBars * 4, bank: { patterns: [{ steps: patternBars * 16, events }], chain: [0] }, rounding };
}
