// Engine sets the player saves (a set is the 24 engines of one voice, like the built-in ready-made sets) and the set each voice starts from.
// The built-in sets stay read-only and are named by their key ('stock', 'set1', ...); a saved one is named 'user:<id>'. Everything lives in the
// browser (localStorage, injectable for tests); a damaged entry is dropped, never thrown at the page.

const USER_KEY = 'pentavox.palette.userSets';
const DEFAULTS_KEY = 'pentavox.palette.defaults';
export const NAME_MAX = 32;
export const USER_PREFIX = 'user:';

export const isUserKey = (key) => typeof key === 'string' && key.startsWith(USER_PREFIX);

function readJson(storage, key, fallback) {
  try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function cleanName(name) {
  const text = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!text) throw new RangeError('Give the set a name');
  if (text.length > NAME_MAX) throw new RangeError(`The name is at most ${NAME_MAX} characters`);
  return text;
}

export class EnginePresetStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    const raw = readJson(storage, USER_KEY, []);
    this.sets = Array.isArray(raw)
      ? raw.filter((set) => set && typeof set.id === 'string' && typeof set.name === 'string' && Array.isArray(set.slots) && [24,32].includes(set.slots.length))
      : [];
    const defaults = readJson(storage, DEFAULTS_KEY, {});
    this.defaultKeys = defaults && typeof defaults === 'object' && !Array.isArray(defaults) ? defaults : {};
  }

  #save() {
    try { this.storage?.setItem(USER_KEY, JSON.stringify(this.sets)); } catch { /* a convenience only */ }
  }

  #saveDefaults() {
    try { this.storage?.setItem(DEFAULTS_KEY, JSON.stringify(this.defaultKeys)); } catch { /* a convenience only */ }
  }

  list() { return this.sets.map((set) => ({ id: set.id, key: USER_PREFIX + set.id, name: set.name })); }

  get(key) { return isUserKey(key) ? this.sets.find((set) => USER_PREFIX + set.id === key) ?? null : null; }

  #uniqueName(name, exceptId = null) {
    const clean = cleanName(name);
    if (this.sets.some((set) => set.id !== exceptId && set.name.toLowerCase() === clean.toLowerCase())) throw new RangeError(`A set named “${clean}” exists already`);
    return clean;
  }

  /** `slots` are one voice's recipe slots (24). Returns the key of the new set. */
  add(name, slots) {
    if (!Array.isArray(slots) || ![24,32].includes(slots.length)) throw new TypeError('A set holds 24 or 32 engines');
    const clean = this.#uniqueName(name);
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.sets.push({ id, name: clean, slots: JSON.parse(JSON.stringify(slots)) });
    this.#save();
    return USER_PREFIX + id;
  }

  rename(key, name) {
    const set = this.get(key);
    if (!set) throw new RangeError('Only your own sets can be renamed');
    set.name = this.#uniqueName(name, set.id);
    this.#save();
  }

  update(key, slots) {
    const set = this.get(key);
    if (!set) throw new RangeError('Only your own sets can be changed');
    if (!Array.isArray(slots) || ![24,32].includes(slots.length)) throw new TypeError('A set holds 24 or 32 engines');
    set.slots = JSON.parse(JSON.stringify(slots));
    this.#save();
  }

  remove(key) {
    const set = this.get(key);
    if (!set) throw new RangeError('Only your own sets can be deleted');
    this.sets = this.sets.filter((other) => other !== set);
    for (const voice of Object.keys(this.defaultKeys)) if (this.defaultKeys[voice] === key) delete this.defaultKeys[voice];
    this.#save(); this.#saveDefaults();
  }

  /** The set a voice starts from, or null; a default that points at a deleted set reads as none. */
  defaultFor(voice, builtIns) {
    const key = this.defaultKeys[String(voice)];
    if (!key) return null;
    if (isUserKey(key)) return this.get(key) ? key : null;
    return Object.hasOwn(builtIns ?? {}, key) ? key : null;
  }

  setDefault(voice, key) {
    if (key) this.defaultKeys[String(voice)] = key; else delete this.defaultKeys[String(voice)];
    this.#saveDefaults();
  }
}
