// Recorded knob movements ("knob locks"): the opaque lock component of the live blob.
// Layout (KnobLockEngine::PersistSlots): per slot a 10-byte header, then kFrames uint16 samples.
//   header: active u8, exit u8, dest u16, length u16, record_base u16, musical_ticks u16 (little endian)
// A sample is the knob position 0..1 quantised to 0..65535, captured at kRateHz.

export const LOCK_SLOTS = 9;
export const LOCK_RATE_HZ = 20;
export const LOCK_FRAMES = 400;
const HEADER_BYTES = 10;
const SLOT_BYTES = HEADER_BYTES + LOCK_FRAMES * 2;
export const LOCK_BLOB_BYTES = LOCK_SLOTS * SLOT_BYTES;
const EXIT_NAMES = ['Return', 'Latch'];

/** The lock component descriptor entry, or undefined on firmware without knob locks. */
export function findLockComponent(components = []) {
  return components.find((component) => component.kind === 'opaque' && Number(component.size) === LOCK_BLOB_BYTES);
}

function view(bytes, component) {
  const offset = Number(component.off);
  if (offset < 0 || offset + LOCK_BLOB_BYTES > bytes.length) throw new RangeError('lock component lies outside blob');
  return new DataView(bytes.buffer, bytes.byteOffset + offset, LOCK_BLOB_BYTES);
}

export function readLocks(bytes, component) {
  const data = view(bytes, component);
  const slots = [];
  for (let slot = 0; slot < LOCK_SLOTS; ++slot) {
    const base = slot * SLOT_BYTES;
    const active = data.getUint8(base) !== 0;
    const length = Math.min(data.getUint16(base + 4, true), LOCK_FRAMES);
    const samples = [];
    if (active) for (let frame = 0; frame < length; ++frame) samples.push(data.getUint16(base + HEADER_BYTES + frame * 2, true) / 65535);
    slots.push({
      slot,
      active,
      dest: data.getUint16(base + 2, true),
      exit: EXIT_NAMES[data.getUint8(base + 1)] ?? 'Return',
      length,
      seconds: length / LOCK_RATE_HZ,
      recordBase: data.getUint16(base + 6, true) / 65535,
      musicalTicks: data.getUint16(base + 8, true),
      clocked: data.getUint16(base + 8, true) !== 0,
      samples,
    });
  }
  return slots;
}

/** A copy of `bytes` with the given slots (all when omitted) emptied; a cleared slot is the same as a fresh one. */
export function eraseLocks(bytes, component, slotsToErase = null) {
  const output = Uint8Array.from(bytes);
  const data = view(output, component);
  for (let slot = 0; slot < LOCK_SLOTS; ++slot) {
    if (slotsToErase && !slotsToErase.includes(slot)) continue;
    const base = slot * SLOT_BYTES;
    for (let index = 0; index < SLOT_BYTES; ++index) data.setUint8(base + index, 0);
  }
  return output;
}

/** The raw lock component bytes, for putting them back after an erase. */
export function lockBytes(bytes, component) {
  const offset = Number(component.off);
  return Uint8Array.from(bytes.subarray(offset, offset + LOCK_BLOB_BYTES));
}

export function withLockBytes(bytes, component, locks) {
  if (locks.length !== LOCK_BLOB_BYTES) throw new RangeError('lock bytes have the wrong size');
  const output = Uint8Array.from(bytes);
  output.set(locks, Number(component.off));
  return output;
}

/** Slots whose destination ids resolve to names; unknown ids stay visible rather than hidden. */
export function describeLocks(slots, destinations) {
  return slots.map((entry) => {
    const destination = destinations.byId(entry.dest);
    return {
      ...entry,
      group: destination?.group ?? 'Unknown',
      name: destination?.name ?? `Destination ${entry.dest}`,
      min: entry.samples.length ? Math.min(...entry.samples) : 0,
      max: entry.samples.length ? Math.max(...entry.samples) : 0,
    };
  });
}

// ---- Editing -------------------------------------------------------------

export const MIN_FRAMES = 2;
const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** A copy of `bytes` with one slot rewritten from `loop` {dest, exit, samples, recordBase?, musicalTicks?}. */
export function writeLockSlot(bytes, component, slot, loop) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= LOCK_SLOTS) throw new RangeError('no such lock slot');
  const samples = loop.samples.slice(0, LOCK_FRAMES);
  if (samples.length < MIN_FRAMES) throw new RangeError('a loop needs at least two samples');
  const output = eraseLocks(bytes, component, [slot]);
  const data = view(output, component);
  const base = slot * SLOT_BYTES;
  data.setUint8(base, 1);
  data.setUint8(base + 1, Math.max(0, EXIT_NAMES.indexOf(loop.exit)));
  data.setUint16(base + 2, loop.dest, true);
  data.setUint16(base + 4, samples.length, true);
  data.setUint16(base + 6, Math.round(clamp01(loop.recordBase ?? samples[0]) * 65535), true);
  data.setUint16(base + 8, loop.musicalTicks ?? 0, true);   // 0 = free running; a synced loop keeps the span it was recorded with
  samples.forEach((value, frame) => data.setUint16(base + HEADER_BYTES + frame * 2, Math.round(clamp01(value) * 65535), true));
  return output;
}

export const reverseCurve = (samples) => [...samples].reverse();
export const invertCurve = (samples) => samples.map((value) => 1 - value);

/** Three-point moving average with the ends held, repeated `passes` times. */
export function smoothCurve(samples, passes = 1) {
  let current = samples;
  for (let pass = 0; pass < passes; ++pass) {
    current = current.map((value, frame) => {
      const before = current[Math.max(0, frame - 1)];
      const after = current[Math.min(current.length - 1, frame + 1)];
      return (before + value + after) / 3;
    });
  }
  return current;
}

/** Linear resample to `length` frames (clamped to 2..400); stretches or squeezes the loop in time. */
export function resampleCurve(samples, length) {
  const count = Math.min(LOCK_FRAMES, Math.max(MIN_FRAMES, Math.round(length)));
  if (samples.length === 1) return Array(count).fill(samples[0]);
  return Array.from({ length: count }, (_, frame) => {
    const position = (frame / (count - 1)) * (samples.length - 1);
    const lower = Math.floor(position);
    const upper = Math.min(samples.length - 1, lower + 1);
    return samples[lower] + (samples[upper] - samples[lower]) * (position - lower);
  });
}

/** Paints `value` onto frames between two drag positions so a fast stroke leaves no gaps. */
export function paintCurve(samples, fromFrame, toFrame, fromValue, toValue) {
  const output = [...samples];
  const start = Math.max(0, Math.min(fromFrame, toFrame));
  const end = Math.min(output.length - 1, Math.max(fromFrame, toFrame));
  for (let frame = start; frame <= end; ++frame) {
    const span = toFrame === fromFrame ? 0 : (frame - fromFrame) / (toFrame - fromFrame);
    output[frame] = clamp01(fromValue + (toValue - fromValue) * span);
  }
  return output;
}

// ---- Saved curve files -----------------------------------------------------

export const CURVE_FORMAT = 'pentavox-knob-curve';

/** Destinations are saved by symbol, not id: ids shift between firmware versions, symbols do not. */
export function exportCurve(loop, destinations) {
  return {
    format: CURVE_FORMAT,
    version: 1,
    destination: destinations.byId(loop.dest)?.symbol ?? null,
    exit: loop.exit,
    bipolar: Boolean(loop.bipolar),
    rateHz: LOCK_RATE_HZ,
    samples: loop.samples.map((value) => Math.round(clamp01(value) * 65535) / 65535),
  };
}

export function parseCurve(text, destinations) {
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('This file is not a Pentavox knob curve'); }
  if (json?.format !== CURVE_FORMAT || json.version !== 1 || !Array.isArray(json.samples)) throw new Error('This file is not a Pentavox knob curve');
  if (json.rateHz !== LOCK_RATE_HZ) throw new Error(`The curve was recorded at ${json.rateHz} Hz; Studio expects ${LOCK_RATE_HZ} Hz`);
  const samples = json.samples.map(Number);
  if (samples.length < MIN_FRAMES || samples.length > LOCK_FRAMES || samples.some((value) => !Number.isFinite(value))) {
    throw new Error(`A curve needs ${MIN_FRAMES}–${LOCK_FRAMES} samples`);
  }
  const entry = destinations.entries.find((candidate) => candidate.symbol === json.destination);
  return {
    dest: entry?.id ?? 0,
    exit: json.exit === 'Latch' ? 'Latch' : 'Return',
    musicalTicks: 0,
    ...(typeof json.bipolar === 'boolean' ? { bipolar: json.bipolar } : {}),
    samples: samples.map(clamp01),
  };
}
