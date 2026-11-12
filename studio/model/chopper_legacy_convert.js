// PVXP → PVXE. Written because a pattern the user already made must not be a reason to start over, and because
// the two formats do not describe the same thing: a PVXP event names a slice by NUMBER ("jump to slice 5"), while
// a PVXE event names a source QUARTER ("start 1.5 bars into the loop"). The bridge between those is the take's
// slice geometry, which is not inside the pattern file at all - the firmware reads it as `slices_[src]`, a table
// built from the loaded loop. So conversion happens with the same loop in front of it, and says out loud what it
// had to snap.
//
// Deliberate choices, all recorded in the report rather than hidden:
//   - a legacy slice is a physical position, so every converted event is ABSOLUTE, not RELative to a window;
//   - amplitude and pitch had two points per event (`amp0→amp1`, `pitch0→pitch1`) and the new format has one, so
//     the value at the START of the event wins - that is the one the ear catches first - and the flattened
//     events are counted;
//   - `roll` meant even / accelerate / retard in the old format and means a subdivision in the new one. The
//     repeat COUNT is carried over exactly (`reps` → `repeat`); the ramp style has nowhere to go, so it becomes a
//     plain even repeat and is counted;
//   - the old "keep playing where you are" events (`src` negative) are reconstructed by tracking where the head
//     would have arrived, which is exact for the contiguous case the old editor produced;
//   - probability is 100 - "always" - because the old format had no such thing, and inventing a percentage would
//     change the groove;
//   - `pcmCrc` is 0, meaning not measured, never a fabricated hash.
import { decodeChopperBank } from './chopper_bank.js';
import { encodeBank, validateBank, MAX_CUE } from './chopper_event_bank.js';

const fail = (message) => { throw new RangeError(message); };
const ROLES = ['base', 'variation', 'fill'];

/**
 * @param {object} input
 * @param {Uint8Array} input.bytes       the PVXP bank, exactly as the module or a file holds it
 * @param {number[]}   input.sliceStartFrames start frame of each slice, ascending, slice 0 at 0 (`exportSlices`)
 * @param {number}     input.bpm         the tempo the loop's grid was derived from
 * @param {number}     input.sampleRate
 * @param {number}     input.sourceFrames length of the loop in frames
 * @param {number}    [input.channels]
 * @param {number}    [input.revision]
 * @returns {{bytes: Uint8Array, bank: object, report: object}}
 */
export function convertLegacyBank({ bytes, sliceStartFrames, bpm, sampleRate, sourceFrames, channels = 1, revision = 1 }) {
  const legacy = decodeChopperBank(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes ?? []));
  if (!legacy) fail('it is not a readable PVXP cue bank');
  if (!Array.isArray(sliceStartFrames) || sliceStartFrames.length < 1) fail('the slice geometry of the loop is missing');
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) fail('a tempo between 20 and 400 BPM is needed to place slices in time');
  if (!Number.isInteger(sampleRate) || sampleRate < 1 || !Number.isInteger(sourceFrames) || sourceFrames < 1) fail('a real sample rate and frame count are needed');

  const quarterFrames = sampleRate * 60 / bpm;   // one beat of the grid the module rebound the bank to
  const frameToQuarter = (frame) => frame / quarterFrames;
  const patternsInSequence = (legacy.chain?.length ? legacy.chain : legacy.patterns.map((_, index) => index));
  const report = { patterns: 0, events: 0, snapped: 0, worstSnapQuarters: 0, continued: 0, homed: 0,
    glidesFlattened: 0, rampsFlattened: 0, roles: [] };
  const converted = [];
  let maxCue = 0;

  for (const patternIndex of patternsInSequence) {
    const source = legacy.patterns?.[patternIndex];
    if (!source) fail(`the chain names pattern ${patternIndex}, which the bank does not hold`);
    // Old pattern lengths are sixteenths (16..128), new ones are quarters - the same span, no rounding.
    const beats = source.steps / 4;
    if (!Number.isInteger(beats) || beats < 4 || beats % 4) fail(`pattern ${patternIndex} is ${source.steps} sixteenths, which is not a whole number of bars`);
    let head = 0;   // where the play head would be, in quarters, for a "continue" event
    const events = [];
    for (const event of [...source.events].sort((a, b) => a.step - b.step)) {
      let quarter;
      if (event.src >= 0) {
        if (event.src >= sliceStartFrames.length) fail(`pattern ${patternIndex} jumps to slice ${event.src}, but this loop has ${sliceStartFrames.length}`);
        quarter = frameToQuarter(sliceStartFrames[event.src]);
      } else if (event.src === -1) {
        quarter = 0; report.homed += 1;                      // "home": the top of the loop
      } else {
        quarter = head; report.continued += 1;               // "continue": stay where the last slice left us
      }
      const cue = Math.round(quarter);
      if (cue > MAX_CUE) fail(`slice ${event.src} sits ${quarter.toFixed(2)} quarters in, past the ${MAX_CUE + 1} quarters the new format can address - use a shorter loop or re-cut this pattern`);
      const snap = Math.abs(quarter - cue);
      if (snap > 1e-9) report.snapped += 1;
      if (snap > report.worstSnapQuarters) report.worstSnapQuarters = snap;
      head = cue + event.len / 4;
      maxCue = Math.max(maxCue, cue);
      if (event.amp1 !== event.amp0 || event.pitch1 !== event.pitch0) report.glidesFlattened += 1;
      if (event.roll !== 0) report.rampsFlattened += 1;
      events.push({ step: event.step, length: event.len, cue, absolute: true, reverse: Boolean(event.rev),
        gate: Boolean(event.gate), repeat: event.reps, roll: 1, pitch: event.pitch0,
        gain: Math.round(event.amp0 * 100), probability: 100 });
      report.events += 1;
    }
    const role = ROLES.includes(legacy.roles?.[patternIndex]) ? legacy.roles[patternIndex] : (patternIndex === 0 ? 'base' : 'variation');
    report.roles.push(role); report.patterns += 1;
    converted.push({ role, beats, events });
  }
  if (!converted.some((pattern) => pattern.role === 'base')) converted[0].role = 'base';

  // The authored grid has to hold every ABS cue, and the format wants whole bars.
  let beats = Math.max(4, Math.ceil((maxCue + 1) / 4) * 4);
  beats = Math.max(beats, ...converted.map((pattern) => pattern.beats));
  const bank = {
    revision,
    source: { sampleRate, frames: sourceFrames, channels, beats, pcmCrc: 0 },
    patterns: converted,
  };
  validateBank(bank);
  report.exact = report.snapped === 0 && report.continued === 0 && report.homed === 0
    && report.glidesFlattened === 0 && report.rampsFlattened === 0;
  report.authoredQuarters = beats;
  report.sourceQuarters = frameToQuarter(sourceFrames);
  return { bank, bytes: encodeBank(bank), report };
}

/** One sentence a human can act on, built from the report instead of a boolean. The tempo is needed to turn a
 * snapped quarter fraction into milliseconds, because "half a beat off" means nothing to an ear. */
export function describeConversion(report, bpm) {
  if (report.exact) return 'Converted exactly: every jump lands on the new grid and no event had a ramp or a glide.';
  const parts = [];
  const ms = (quarters) => Number.isFinite(bpm) && bpm > 0 ? `${Math.round(quarters * 60000 / bpm)} ms` : `${quarters.toFixed(2)} quarters`;
  if (report.snapped) parts.push(`${report.snapped} jump${report.snapped === 1 ? '' : 's'} moved to the nearest beat (worst ${ms(report.worstSnapQuarters)})`);
  if (report.continued || report.homed) parts.push(`${report.continued + report.homed} "stay where you are" event${report.continued + report.homed === 1 ? '' : 's'} given an explicit position`);
  if (report.glidesFlattened) parts.push(`${report.glidesFlattened} event${report.glidesFlattened === 1 ? '' : 's'} lost its volume or pitch glide (start value kept)`);
  if (report.rampsFlattened) parts.push(`${report.rampsFlattened} accelerate/retard roll${report.rampsFlattened === 1 ? '' : 's'} play as even repeats`);
  return parts.join('; ');
}
