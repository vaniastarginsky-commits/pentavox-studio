export const SLOT_COUNT = 4;
export const SLOT_FILE_LIMIT = 16;
export const DEFAULT_START_NUMBER = 1;

// Item fields that depend on the slice model, for the plan table and the warnings line.
export function sliceSummary(item) {
  const count = item.slices ? item.slices.sliceCount : 1;
  return count <= 1 ? 'No slices: 16 equal steps' : `${count} slices${count >= 32 ? ' (max)' : ''}`;
}

export function formatFileNumber(number) { return `${String(number).padStart(4, '0')}.WAV`; }

function fileName(file) { return typeof file === 'string' ? file : file?.name; }
function wavFiles(files = []) { return files.filter((file) => !file?.directory && /\.wav$/i.test(fileName(file) ?? '')); }

export function nextStartNumbers(existingFilesBySlot = [], slotCount = SLOT_COUNT) {
  return Array.from({ length: slotCount }, (_, slot) => wavFiles(existingFilesBySlot[slot]).reduce((next, file) => {
    const match = /^(\d{1,4})\.wav$/i.exec(fileName(file)); return match ? Math.max(next, Number(match[1]) + 1) : next;
  }, DEFAULT_START_NUMBER));
}

export function buildSamplerPlan(items, starts, existingFilesBySlot = [], slotCount = SLOT_COUNT) {
  const defaults = nextStartNumbers(existingFilesBySlot, slotCount);
  const next = Array.from({ length: slotCount }, (_, slot) => Number(starts?.[slot] ?? defaults[slot]));
  return items.map((item) => {
    const slot = Number(item.slot);
    const fileNumber = next[slot];
    if (Number.isInteger(fileNumber)) next[slot] += 1;
    return { ...item, slot, fileNumber, fileName: Number.isInteger(fileNumber) ? formatFileNumber(fileNumber) : '????.WAV' };
  });
}

export function validateSamplerPlan(plan, existingFilesBySlot = [], slotCount = SLOT_COUNT) {
  const errors = [];
  const seen = new Set();
  const counts = Array.from({ length: slotCount }, (_, slot) => wavFiles(existingFilesBySlot[slot]).length);
  existingFilesBySlot.forEach((files, slot) => wavFiles(files).forEach((file) => seen.add(`${slot}:${fileName(file).toLowerCase()}`)));
  for (const item of plan) {
    if (!Number.isInteger(item.slot) || item.slot < 0 || item.slot >= slotCount) errors.push(`${item.name}: invalid slot`);
    else counts[item.slot] += 1;
    if (!Number.isInteger(item.fileNumber) || item.fileNumber < 0 || item.fileNumber > 9999) errors.push(`${item.name}: the number must be 0000 to 9999`);
    const key = `${item.slot}:${item.fileName.toLowerCase()}`;
    if (seen.has(key)) errors.push(`${item.name}: number ${item.fileName} is already used in this slot`);
    seen.add(key);
    if (!(item.frames >= 0) || item.frames > 1440000) errors.push(`${item.name}: must be 30 seconds or less after trimming`);
    const hasBpm = item.bpm !== '' && item.bpm !== undefined && item.bpm !== null;
    const hasBeats = item.beats !== '' && item.beats !== undefined && item.beats !== null;
    if (hasBpm !== hasBeats) errors.push(`${item.name}: an ACID tag needs both tempo and beat count`);
    if (hasBpm && (!(Number(item.bpm) > 0) || !Number.isInteger(Number(item.beats)) || !(Number(item.beats) > 0))) errors.push(`${item.name}: invalid tempo or beat count`);
  }
  counts.forEach((count, slot) => { if (count > SLOT_FILE_LIMIT) errors.push(`Slot ${slot + 1}: the firmware will only see the first 16 files`); });
  return { valid: errors.length === 0, errors, counts };
}

export function groupPlanBySlot(plan, slotCount = SLOT_COUNT) {
  return Array.from({ length: slotCount }, (_, slot) => plan.filter((item) => item.slot === slot));
}

export function mergeSamplerSlots(plan, existingFilesBySlot = [], slotCount = SLOT_COUNT) {
  const planned = groupPlanBySlot(plan, slotCount);
  return Array.from({ length: slotCount }, (_, slot) => {
    const existing = wavFiles(existingFilesBySlot[slot]); const count = existing.length + planned[slot].length;
    return { slot, existing, planned: planned[slot], count, overLimit: count > SLOT_FILE_LIMIT };
  });
}
