import { readField, writeField } from './blob.js';

const PREFIXES = Object.freeze({
  A: Object.freeze({ route: 'route', panelpot: 'panelpot', basecv: 'basecv' }),
  B: Object.freeze({ route: 'routeB', panelpot: 'ppotB', basecv: 'basecvB' }),
});

const SOURCE_NAMES = Object.freeze({
  basecv: ['J3', 'J4', 'J5', 'J6', 'J7', 'J8'],
  panelpot: ['Pot 1', 'Pot 2', 'Pot 3', 'Pot 4', 'Pot 5', 'Pot 6'],
  route: [
    'Exp CV1', 'Exp CV2', 'Exp CV3', 'Exp CV4', 'Exp CV5', 'Exp CV6',
    'Exp Pot 1', 'Exp Pot 2', 'Exp Pot 3',
  ],
});

function ids(source, k) {
  const prefix = PREFIXES[source.bank]?.[source.key];
  if (!prefix) throw new TypeError('unknown route source');
  return [`${prefix}.${source.ch}.${k}.dest`, `${prefix}.${source.ch}.${k}.depth`];
}

function valueKey(source, k) {
  return `${source.bank}:${source.key}:${source.ch}:${k}`;
}

function clampDepth(depth) {
  if (!Number.isFinite(depth)) throw new TypeError('route depth must be finite');
  return Math.max(-1, Math.min(1, depth));
}

// StateCodec's current HostLink image uses normalized route-depth floats even
// though the Studio API and AppParameters use signed depths. This conversion
// is keyed by route identity and intentionally ignores descriptor `disp`.
function depthFromWire(wire) {
  return Math.max(-1, Math.min(1, wire * 2 - 1));
}

function depthToWire(depth) {
  return (depth + 1) * 0.5;
}

export class RouteTable {
  static fromBlob(bytes, index) {
    const sources = [];
    for (const bank of ['A', 'B']) {
      for (const key of ['basecv', 'panelpot', 'route']) {
        for (let ch = 0; ch < SOURCE_NAMES[key].length; ++ch) {
          const item = { key, ch, name: SOURCE_NAMES[key][ch], bank };
          let complete = true;
          for (let k = 0; k < 4; ++k) {
            const [destId, depthId] = ids(item, k);
            complete &&= index.has(destId) && index.has(depthId);
          }
          if (complete) sources.push(Object.freeze(item));
        }
      }
    }

    let destCount = 0;
    for (const item of sources) {
      const [destId] = ids(item, 0);
      destCount = Math.max(destCount, Number(index.get(destId).zones ?? 0));
    }
    if (sources.length === 0 || destCount < 1) {
      throw new Error('descriptor has no complete route fields');
    }

    const values = new Map();
    for (const item of sources) {
      for (let k = 0; k < 4; ++k) {
        const [destId, depthId] = ids(item, k);
        values.set(valueKey(item, k), {
          dest: readField(bytes, index.get(destId)),
          depth: depthFromWire(readField(bytes, index.get(depthId))),
        });
      }
    }
    return new RouteTable(index, sources, destCount, values);
  }

  constructor(index, sources, destCount, values) {
    this.index = index;
    this.sourceList = sources;
    this.destCount = destCount;
    this.values = values;
    this.original = new Map([...values].map(([key, value]) => [key, { ...value }]));
  }

  sources() {
    return this.sourceList.slice();
  }

  get(source, k) {
    if (!Number.isInteger(k) || k < 0 || k >= 4) throw new RangeError('route slot');
    const value = this.values.get(valueKey(source, k));
    if (!value) throw new TypeError('unknown route source');
    return { ...value };
  }

  set(source, k, { dest, depth }) {
    if (!Number.isInteger(dest) || dest < 0 || dest >= this.destCount) {
      throw new RangeError('destination is out of range');
    }
    const key = valueKey(source, k);
    if (!this.values.has(key)) throw new TypeError('unknown route source or slot');
    this.values.set(key, { dest, depth: clampDepth(depth) });
  }

  rows(source) {
    const result = [];
    for (let k = 0; k < 4; ++k) {
      const value = this.get(source, k);
      if (value.dest !== 0) result.push(value);
    }
    return result;
  }

  addRoute(source, dest, depth) {
    for (let k = 0; k < 4; ++k) {
      if (this.get(source, k).dest === 0) {
        this.set(source, k, { dest, depth });
        return k;
      }
    }
    return -1;
  }

  removeRoute(source, k) {
    for (let at = k; at < 3; ++at) this.set(source, at, this.get(source, at + 1));
    this.set(source, 3, { dest: 0, depth: 0 });
  }

  toBlob(baseBytes) {
    const output = Uint8Array.from(baseBytes);
    for (const item of this.sourceList) {
      for (let k = 0; k < 4; ++k) {
        const [destId, depthId] = ids(item, k);
        const value = this.get(item, k);
        writeField(output, this.index.get(destId), value.dest);
        writeField(output, this.index.get(depthId), depthToWire(value.depth));
      }
    }
    return output;
  }

  dirtyKeys() {
    const dirty = new Set();
    for (const item of this.sourceList) {
      for (let k = 0; k < 4; ++k) {
        const current = this.get(item, k);
        const original = this.original.get(valueKey(item, k));
        const [destId, depthId] = ids(item, k);
        if (current.dest !== original.dest) dirty.add(destId);
        if (current.depth !== original.depth) dirty.add(depthId);
      }
    }
    return dirty;
  }
}
