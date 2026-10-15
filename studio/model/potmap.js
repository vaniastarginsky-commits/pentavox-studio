import { readField, writeField } from './blob.js';
import { moduleCapabilities } from './capabilities.js';

export const POTMAP_LAYERS = 2;
export const POTMAP_PAGES = 8;
export const POTMAP_POTS = 6;
export const POTMAP_DESTINATIONS = 78;
/** Persisted Off sentinel; newer destination IDs extend beyond it. */
export const POTMAP_OFF = POTMAP_DESTINATIONS;

const idFor = (layer, page, pot) => `potmap.${layer}.${page}.${pot}`;

function coordinate(name, value, limit) {
  if (!Number.isInteger(value) || value < 0 || value >= limit) throw new RangeError(`pot map ${name} is out of range`);
}

export class PotMapTable {
  static fromBlob(bytes, index) {
    const fields = new Map();
    const values = new Map();
    for (let layer = 0; layer < POTMAP_LAYERS; ++layer) {
      for (let page = 0; page < POTMAP_PAGES; ++page) {
        for (let pot = 0; pot < POTMAP_POTS; ++pot) {
          const id = idFor(layer, page, pot);
          const field = index.get(id);
          if (!field) continue;
          fields.set(id, field);
          values.set(id, readField(bytes, field));
        }
      }
    }
    if (!fields.size) throw new Error('descriptor has no pot map fields');
    return new PotMapTable(fields, values, moduleCapabilities(index));
  }

  constructor(fields, values, capabilities = {
    plaitsVoices: 3, samplerVoices: 2, granularEnabled: true, tapeEnabled: true,
  }) {
    this.fields = fields;
    this.values = values;
    this.original = new Map(values);
    this.capabilities = Object.freeze({ ...capabilities });
  }

  field(layer, page, pot) {
    coordinate('layer', layer, POTMAP_LAYERS);
    coordinate('page', page, POTMAP_PAGES);
    coordinate('pot', pot, POTMAP_POTS);
    const id = idFor(layer, page, pot);
    const field = this.fields.get(id);
    if (!field) throw new TypeError(`unknown pot map field: ${id}`);
    return field;
  }

  get(layer, page, pot) {
    const field = this.field(layer, page, pot);
    return this.values.get(field.id);
  }

  set(layer, page, pot, destId) {
    const field = this.field(layer, page, pot);
    if (!Number.isInteger(destId) || destId < 0 || destId >= (field.zones ?? POTMAP_OFF + 1)) {
      throw new RangeError('pot map destination is out of range');
    }
    this.values.set(field.id, destId);
  }

  reset(layer, page) {
    if (layer !== undefined) coordinate('layer', layer, POTMAP_LAYERS);
    if (page !== undefined) coordinate('page', page, POTMAP_PAGES);
    for (const id of this.fields.keys()) {
      const [, fieldLayer, fieldPage] = id.split('.').map(Number);
      if ((layer === undefined || fieldLayer === layer) && (page === undefined || fieldPage === page)) this.values.set(id, 0);
    }
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
