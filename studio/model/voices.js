import { readField, writeField } from './blob.js';

const MAX_VOICES = 3;
const BANK_SIZE = 8;
const BANK_NAMES = Object.freeze([
  'Bank 1 (slots 1-8)',
  'Bank 2 (slots 9-16)',
  'Bank 3 (slots 17-24)',
]);

function fieldId(voice, key) {
  return `voice.${voice}.${key}`;
}

function normalizeName(value) {
  return String(value ?? '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
}

function clampPct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError('balance must be finite');
  return Math.max(-100, Math.min(100, number));
}

function buildCapabilities({ paletteCatalog = [], composerCatalog = {} } = {}) {
  const result = new Map();
  for (const engine of paletteCatalog ?? []) {
    const key = normalizeName(engine.display_name);
    if (key) result.set(key, { stereo: engine.stereo_capable !== false, sync: true });
  }
  for (const engine of composerCatalog?.engines ?? []) {
    const key = normalizeName(engine.name);
    if (!key) continue;
    const current = result.get(key) ?? { stereo: true, sync: true };
    result.set(key, {
      stereo: typeof engine.stereo === 'boolean' ? engine.stereo : current.stereo,
      sync: typeof engine.sync === 'boolean' ? engine.sync : current.sync,
    });
  }
  return result;
}

export function isVoiceField(field) {
  return /^voice\.[0-2]\.(engine|stereo|sync_in|balance)$/.test(field.id);
}

export class VoiceTable {
  static fromBlob(bytes, index, catalogs = {}) {
    // The firmware says how many Plaits voices it has: 3 in the full build, 2 in the lighter one without the third.
    let voiceCount = 0;
    while (voiceCount < MAX_VOICES && index.has(fieldId(voiceCount, 'engine'))) voiceCount += 1;
    if (voiceCount < 2) throw new Error('descriptor has no complete palette voice fields: voice.0.engine');
    const required = [];
    for (let voice = 0; voice < voiceCount; ++voice) {
      for (const key of ['engine', 'stereo', 'sync_in', 'balance']) required.push(fieldId(voice, key));
    }
    const missing = required.filter((id) => !index.has(id));
    if (missing.length) throw new Error(`descriptor has no complete palette voice fields: ${missing[0]}`);

    // Per-voice engine sets (recipe v2): each voice carries its own label list.
    const labelSets = [];
    for (let voice = 0; voice < voiceCount; ++voice) {
      const labels = index.get(fieldId(voice, 'engine')).disp?.labels;
      if (!Array.isArray(labels) || labels.length === 0) throw new Error('voice engine labels are missing');
      labelSets.push(labels);
    }
    const labels = labelSets[0];

    const values = [];
    for (let voice = 0; voice < voiceCount; ++voice) {
      values.push({
        engine: readField(bytes, index.get(fieldId(voice, 'engine'))),
        stereo: readField(bytes, index.get(fieldId(voice, 'stereo'))) !== 0,
        syncIn: readField(bytes, index.get(fieldId(voice, 'sync_in'))) !== 0,
        balancePct: Math.round(clampPct((readField(bytes, index.get(fieldId(voice, 'balance'))) * 2 - 1) * 100) * 1000) / 1000,
      });
    }
    return new VoiceTable(index, labels, values, buildCapabilities(catalogs), catalogs, labelSets);
  }

  constructor(index, labels, values, capabilityMap, catalogs, labelSets = values.map(() => labels)) {
    this.voiceCount = values.length;
    this.index = index;
    this.engineLabels = Object.freeze(labels.slice());
    this.voiceLabels = labelSets.map((set) => Object.freeze(set.slice()));
    this.values = values.map((value) => ({ ...value }));
    this.original = values.map((value) => ({ ...value }));
    this.capabilityMap = capabilityMap;
    this.catalogs = catalogs;
  }

  get(voice) {
    this.#assertVoice(voice);
    return { ...this.values[voice] };
  }

  setEngine(voice, engine) {
    this.#assertVoice(voice);
    if (!Number.isInteger(engine) || engine < 0 || engine >= this.voiceLabels[voice].length) {
      throw new RangeError('engine is out of range');
    }
    this.values[voice].engine = engine;
  }

  setStereo(voice, enabled) {
    this.#assertVoice(voice);
    this.values[voice].stereo = Boolean(enabled);
  }

  setSyncIn(voice, enabled) {
    this.#assertVoice(voice);
    this.values[voice].syncIn = Boolean(enabled);
  }

  setBalancePct(voice, value) {
    this.#assertVoice(voice);
    this.values[voice].balancePct = clampPct(value);
  }

  bankGroups(voice = 0) {
    return BANK_NAMES.map((label, bank) => ({
      bank: bank + 1,
      label,
      engines: this.voiceLabels[voice].slice(bank * BANK_SIZE, (bank + 1) * BANK_SIZE)
        .map((name, offset) => ({ index: bank * BANK_SIZE + offset, slot: bank * BANK_SIZE + offset + 1, name })),
    })).filter((group) => group.engines.length);
  }

  isSixOp(engineIdx, voice = 0) {
    this.#assertEngine(engineIdx, voice);
    return normalizeName(this.voiceLabels[voice][engineIdx]).includes('six op');
  }

  // Per-voice builds label a six-op slot with its real SD bank ("Six-op FM B"); the stock
  // set keeps the plain label and takes A, B, C in occurrence order.
  dx7BankFor(engineIdx, voice = 0) {
    if (!this.isSixOp(engineIdx, voice)) return null;
    const lettered = /six op(?: fm)? ([a-f])$/.exec(normalizeName(this.voiceLabels[voice][engineIdx]));
    if (lettered) return lettered[1].toUpperCase();
    const occurrence = this.voiceLabels[voice].slice(0, engineIdx + 1)
      .filter((label) => normalizeName(label).includes('six op')).length - 1;
    return ['A', 'B', 'C', 'D', 'E', 'F'][occurrence] ?? null;
  }

  capabilities(engineIdx, voice = 0) {
    this.#assertEngine(engineIdx, voice);
    const name = normalizeName(this.voiceLabels[voice][engineIdx]).replace(/^(six op fm) [a-f]$/, '$1');
    return { ...(this.capabilityMap.get(name) ?? { stereo: true, sync: true }) };
  }

  toBlob(baseBytes) {
    const output = Uint8Array.from(baseBytes);
    for (let voice = 0; voice < this.voiceCount; ++voice) {
      const value = this.values[voice];
      writeField(output, this.index.get(fieldId(voice, 'engine')), value.engine);
      writeField(output, this.index.get(fieldId(voice, 'stereo')), value.stereo ? 1 : 0);
      writeField(output, this.index.get(fieldId(voice, 'sync_in')), value.syncIn ? 1 : 0);
      writeField(output, this.index.get(fieldId(voice, 'balance')), (value.balancePct / 100 + 1) * 0.5);
    }
    return output;
  }

  dirtyKeys() {
    const dirty = new Set();
    for (let voice = 0; voice < this.voiceCount; ++voice) {
      const current = this.values[voice];
      const original = this.original[voice];
      if (current.engine !== original.engine) dirty.add(fieldId(voice, 'engine'));
      if (current.stereo !== original.stereo) dirty.add(fieldId(voice, 'stereo'));
      if (current.syncIn !== original.syncIn) dirty.add(fieldId(voice, 'sync_in'));
      if (current.balancePct !== original.balancePct) dirty.add(fieldId(voice, 'balance'));
    }
    return dirty;
  }

  #assertVoice(voice) {
    if (!Number.isInteger(voice) || voice < 0 || voice >= this.voiceCount) throw new RangeError('voice is out of range');
  }

  #assertEngine(engine, voice = 0) {
    if (!Number.isInteger(engine) || engine < 0 || engine >= this.voiceLabels[voice].length) {
      throw new RangeError('engine is out of range');
    }
  }
}
