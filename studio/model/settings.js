import { readField, writeField } from './blob.js';
import { moduleCapabilities } from './capabilities.js';

// Module-level settings that HostLink can write live: the hardware Settings
// pages ("settings" component, ids s<page>.<pot>) plus the expander's per-voice
// pitch/gate sources and button roles (ids voice.N.*_source, button.N.*).
const VOICES = 5;
const BUTTONS = 2;
const JACKS = 6;
const MIDI_ROUTES = 32;

const OPTIONAL_SETTING_NAMES = Object.freeze({
  's2.2': 'Tempo Change Mode',
  's2.3': 'Tempo Change Time',
});

export const SETTING_IDS = Object.freeze([
  's0.0', 's0.1', 's0.2', 's0.3', 's0.4', 's0.5', 's1.0', 's1.5', 's2.0',
  's2.1', 's2.2', 's2.3', 's2.4', 's2.5',
  ...Array.from({ length: VOICES }, (_, v) => [
    `voice.${v}.pitch_source`, `voice.${v}.gate_source`, `voice.${v}.midi_channel`,
  ]).flat(),
  ...Array.from({ length: BUTTONS }, (_, b) => [`button.${b}.role`, `button.${b}.param`]).flat(),
  ...Array.from({ length: JACKS }, (_, j) => `jack.${j}.function`),
  ...Array.from({ length: MIDI_ROUTES }, (_, i) => ['cc', 'ch', 'dest', 'depth'].map((key) => `midicc.${i}.${key}`)).flat(),
]);

// Pager shift-layer fields are also called s1.0 ...: the descriptor index prefixes
// colliding ids with their component, so look for the one that belongs to "settings".
export function settingsField(index, id) {
  const field = index.get(`settings:${id}`) ?? index.get(id);
  return field && (field.comp === 'settings' || !id.startsWith('s')) ? field : undefined;
}

export class SettingsTable {
  static fromBlob(bytes, index) {
    const fields = new Map();
    const values = new Map();
    for (const id of SETTING_IDS) {
      const field = settingsField(index, id);
      if (!field) continue;
      if (OPTIONAL_SETTING_NAMES[id] && field.name !== OPTIONAL_SETTING_NAMES[id]) continue;
      fields.set(id, field);
      values.set(id, readField(bytes, field));
    }
    // Without the hardware Settings page there is nothing to edit.
    if (!fields.has('s0.1') && !fields.has('s1.0')) throw new Error('descriptor has no settings fields');
    return new SettingsTable(fields, values, moduleCapabilities(index));
  }

  constructor(fields, values, capabilities = {}) {
    this.fields = fields;
    this.values = values;
    this.capabilities = Object.freeze({ ...capabilities });
    this.plaitsVoices = Number(capabilities.plaitsVoices) || 0;
    this.samplerVoices = Number(capabilities.samplerVoices) || 0;
    this.original = new Map(values);
  }

  has(id) { return this.fields.has(id); }

  field(id) {
    const field = this.fields.get(id);
    if (!field) throw new TypeError(`unknown setting: ${id}`);
    return field;
  }

  get(id) {
    this.field(id);
    return this.values.get(id);
  }

  // Raw wire value: enum zone index, or a normalised 0..1 float.
  set(id, value) {
    const field = this.field(id);
    if (field.type === 'enum') {
      if (!Number.isInteger(value) || value < 0 || value >= Number(field.zones)) throw new RangeError(`${id} is out of range`);
    } else {
      if (!Number.isFinite(value)) throw new TypeError(`${id} must be finite`);
      value = Math.max(0, Math.min(1, value));
    }
    this.values.set(id, value);
  }

  toBlob(baseBytes) {
    const output = Uint8Array.from(baseBytes);
    for (const [id, field] of this.fields) writeField(output, field, this.values.get(id));
    return output;
  }

  dirtyKeys() {
    const dirty = new Set();
    for (const [id, value] of this.values) if (value !== this.original.get(id)) dirty.add(id);
    return dirty;
  }
}
