export const KEY_MAP_FIRST_NOTE = 60;
export const KEY_MAP_KEYS = 37;

export function keyRole(index) {
  if (index >= 0 && index < 12) return 'kick';
  if (index >= 12 && index < 24) return 'snare';
  if (index >= 24 && index < 36) return 'hat';
  return 'other';
}

function labelRole(label) {
  const value = typeof label === 'string' ? label : '';
  if (value.includes('kick')) return 'kick';
  if (value.includes('snare')) return 'snare';
  if (value.includes('hat')) return 'hat';
  return 'other';
}

export function keyMap(labels, sliceCount) {
  const out = Array(KEY_MAP_KEYS).fill(-1);
  const count = Math.max(0, Math.trunc(Number(sliceCount) || 0));
  const haveTypes = Array.isArray(labels) && labels.length >= count && count > 0;
  if (!haveTypes) {
    for (let i = 0; i < Math.min(count, KEY_MAP_KEYS); i += 1) out[i] = i;
    return out;
  }

  const next = { kick: 0, snare: 12, hat: 24, other: 36 };
  const end = { kick: 12, snare: 24, hat: 36, other: 37 };
  for (let slice = 0; slice < count; slice += 1) {
    const role = labelRole(labels[slice]);
    if (next[role] < end[role]) out[next[role]++] = slice;
  }
  return out;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Ableton naming: note 60 is C3.
export const noteName = (note) => `${NAMES[note % 12]}${Math.floor(note / 12) - 2}`;

// The 37 keys C3..C6 for the Studio strip: note, name, slice number (1-based, null when the key is empty) and the zone's role.
export function keyStripModel(labels, sliceCount) {
  const map = keyMap(labels, sliceCount);
  const haveTypes = Array.isArray(labels) && labels.length >= sliceCount && sliceCount > 0;
  return map.map((slice, key) => ({
    note: KEY_MAP_FIRST_NOTE + key, name: noteName(KEY_MAP_FIRST_NOTE + key),
    slice: slice >= 0 ? slice + 1 : null, role: haveTypes ? keyRole(key) : 'other',
  }));
}
