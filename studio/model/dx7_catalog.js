// The DX7 patch catalog: Palette's JSON files (downloaded by tools/dx7_composer/fetch_palette_library.py into
// studio/data/dx7/, not in git) plus the 96 Plaits factory voices. Pure data functions: no DOM, no fetch.
import { b64ToBytes, deriveTags, voiceAlgorithm, voiceKey, voiceName, VOICE_BYTES } from './dx7_syx.js';

export const CATEGORIES = ['Bass', 'Bells', 'Brass', 'Clav', 'Effects', 'Keys', 'Organ', 'Percussion', 'Piano', 'Plucked', 'Strings', 'Voice', 'Woodwind', 'Other'];
export const SOUND_TAGS = [
  { id: 'percussive', label: 'percussive' }, { id: 'sustained', label: 'sustained' }, { id: 'slowAttack', label: 'slow attack' },
  { id: 'inharmonic', label: 'inharmonic' }, { id: 'harmonic', label: 'harmonic' }, { id: 'bright', label: 'bright' }, { id: 'dark', label: 'dark' },
];
export const PAGE_SIZE = 300;

const NAME_CATEGORIES = [
  ['Bass', /BASS|\bBS\b|SUB\b|\bBAS\d/],
  ['Clav', /CLAV|HARPSI/],
  ['Piano', /PIANO|PNO|\bEP\d?\b|RHODES|WURLI/],
  ['Bells', /BELL|CHIME|GLOCK|VIBE|MARIMBA|XYLO|MALLET|KALIMB|TUBULAR|GONG/],
  ['Plucked', /PLUCK|GUITAR|HARP\b|BANJO|KOTO|SITAR|LUTE|MANDOL|PIZZ/],
  ['Strings', /STRING|\bPAD\b|ORCH|ATMOS|SWEEP|SOLINA|ENSEMB|CELLO|VIOLIN|VIOLA|FIDDLE/],
  ['Voice', /CHOIR|VOICE|VOX|\bAH\b|\bOO\b/],
  ['Brass', /BRASS|TRUMP|TROMB|HORN|TUBA|FLUGEL/],
  ['Woodwind', /SAX|FLUTE|OBOE|CLARI|BASSOON|WIND|REED|PIPE|WHISTLE/],
  ['Organ', /ORGAN|\bORG\b|ACCORD|CHURCH/],
  ['Percussion', /DRUM|PERC|KICK|SNARE|\bTOM|HI-?HAT|CONGA|BONGO|CLAP|TIMP|TAIKO|COWBELL|RIM/],
  ['Effects', /FX|NOISE|EFFECT|RAIN|SPACE|ZAP|LASER|CRASH|WHOOSH|ALIEN|SIREN|BOMB|THUNDER/],
  ['Keys', /KEYS|KEYBOARD|CELESTA|TINE/],
];
export function categorize(name) {
  const upper = name.toUpperCase();
  for (const [category, pattern] of NAME_CATEGORIES) if (pattern.test(upper)) return category;
  return 'Other';
}

export function patchFrom(fields, voice) {
  return {
    id: fields.id, name: fields.name ?? voiceName(voice), cat: fields.cat ?? categorize(voiceName(voice)),
    tags: fields.tags ?? deriveTags(voice), algo: voiceAlgorithm(voice), rom: fields.rom ?? null, romLabel: fields.romLabel ?? null,
    slot: fields.slot ?? null, src: fields.src ?? null, voice,
  };
}

/** The first problem found in the three catalog files as a readable sentence, or null when they look right. */
export function checkShape(sample, rom, stock) {
  if (sample != null) {
    if (!Array.isArray(sample)) return 'dx7-catalog-sample.json is not a list of patches.';
    const bad = sample.find((p) => typeof p?.b64 !== 'string' || typeof p?.name !== 'string');
    if (bad) return 'dx7-catalog-sample.json has a patch without name or b64.';
  }
  if (rom != null) {
    if (!Array.isArray(rom?.roms) || !Array.isArray(rom?.patches)) return 'dx7-rom-catalog.json has no roms/patches lists.';
  }
  if (stock != null) {
    if (!Array.isArray(stock)) return 'dx7-stock-banks.json is not a list of banks.';
    if (stock.some((bank) => !Array.isArray(bank?.voices))) return 'dx7-stock-banks.json has a bank without voices.';
  }
  return null;
}

function stockBanksFrom(stock, factory) {
  if (stock) {
    return stock.map((bank, index) => ({
      id: `stock-${'ABC'[index] ?? index}`, name: bank.name,
      patches: bank.voices.map((v, i) => patchFrom({ id: `stock-${'ABC'[index] ?? index}-${i + 1}`, name: v.name, src: bank.name, slot: i + 1 }, b64ToBytes(v.b64))),
    }));
  }
  if (factory && factory.length >= 3 * 32 * VOICE_BYTES) {
    return [0, 1, 2].map((bank) => ({
      id: `stock-${'ABC'[bank]}`, name: `6-Op FM Bank ${'ABC'[bank]}`,
      patches: Array.from({ length: 32 }, (_, i) => {
        const at = (bank * 32 + i) * VOICE_BYTES;
        return patchFrom({ id: `stock-${'ABC'[bank]}-${i + 1}`, src: `6-Op FM Bank ${'ABC'[bank]}`, slot: i + 1 }, factory.slice(at, at + VOICE_BYTES));
      }),
    }));
  }
  return [];
}

/** One patch list from every source. A voice that appears twice is kept once; ROM entries win over the rest. */
export function buildCatalog({ sample = [], rom = null, stock = null, factory = null, community = [] } = {}) {
  const patches = []; const seen = new Set();
  const take = (patch) => { const key = voiceKey(patch.voice); if (seen.has(key)) return; seen.add(key); patches.push(patch); };
  const roms = rom?.roms ?? [];
  for (const p of rom?.patches ?? []) take(patchFrom({ ...p, src: p.romLabel }, b64ToBytes(p.b64)));
  for (const p of sample ?? []) take(patchFrom({ ...p, src: 'Palette catalog' }, b64ToBytes(p.b64)));
  const stockBanks = stockBanksFrom(stock, factory);
  for (const bank of stockBanks) for (const p of bank.patches) take(p);
  const communityBanks = community.map((bank) => ({
    id: bank.id, name: bank.name,
    patches: bank.voices.map((v, i) => patchFrom({ id: `${bank.id}-${i + 1}`, name: v.name, src: bank.name, slot: i + 1 }, b64ToBytes(v.b64))),
  }));
  for (const bank of communityBanks) for (const p of bank.patches) take(p);
  const byVoice = new Map(patches.map((p) => [voiceKey(p.voice), p]));
  for (const bank of communityBanks) bank.patches = bank.patches.map((p) => byVoice.get(voiceKey(p.voice)));
  return { patches, roms, stockBanks, communityBanks, romPatches: (rom?.patches ?? []) };
}

export function filterPatches(patches, { query = '', category = null, tags = [] } = {}) {
  const needle = query.trim().toLowerCase();
  return patches.filter((p) => (!category || p.cat === category)
    && tags.every((tag) => p.tags.includes(tag))
    && (!needle || p.name.toLowerCase().includes(needle)));
}

export function sortPatches(patches, key = 'name') {
  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
  const sorted = [...patches];
  if (key === 'nameDesc') return sorted.sort((a, b) => byName(b, a));
  if (key === 'category') return sorted.sort((a, b) => a.cat.localeCompare(b.cat) || byName(a, b));
  if (key === 'algorithm') return sorted.sort((a, b) => a.algo - b.algo || byName(a, b));
  if (key === 'source') {
    return sorted.sort((a, b) => (a.rom ? 0 : 1) - (b.rom ? 0 : 1) || (a.romLabel ?? '').localeCompare(b.romLabel ?? '') || (a.slot ?? 0) - (b.slot ?? 0) || byName(a, b));
  }
  return sorted.sort(byName);
}

export function pageOf(list, page, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const at = Math.min(Math.max(0, page), pages - 1);
  return { items: list.slice(at * size, (at + 1) * size), pages, page: at };
}

/** "Start from" choices: the Plaits stock banks, then every ROM cartridge grouped as Palette groups them. */
export function sourceGroups(catalog) {
  const groups = [];
  if (catalog.stockBanks.length) groups.push({ label: 'Plaits stock banks', items: catalog.stockBanks.map((b) => ({ id: b.id, label: b.name, patches: b.patches })) });
  if (catalog.communityBanks?.length) groups.push({ label: 'Community banks', items: catalog.communityBanks.map((b) => ({ id: b.id, label: b.name, patches: b.patches })) });
  const byRom = new Map(catalog.roms.map((r) => [r.id, []]));
  const known = new Map(catalog.patches.map((p) => [p.id, p]));
  for (const raw of catalog.romPatches) if (byRom.has(raw.rom) && known.has(raw.id)) byRom.get(raw.rom).push(known.get(raw.id));
  for (const romInfo of catalog.roms) {
    let group = groups.find((g) => g.label === romInfo.group);
    if (!group) { group = { label: romInfo.group, items: [] }; groups.push(group); }
    const list = byRom.get(romInfo.id).sort((a, b) => a.slot - b.slot);
    if (list.length) group.items.push({ id: romInfo.id, label: `${romInfo.label} — ${romInfo.title}`, patches: list });
  }
  return groups.filter((g) => g.items.length);
}
