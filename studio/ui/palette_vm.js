import { BANK_LETTERS, libraryEntries } from '../model/palette.js';

const BANKS = Object.freeze([
  { name: 'Green', colour: 'green', tagline: 'First eight · lively spectrum' },
  { name: 'Yellow', colour: 'yellow', tagline: 'Middle eight · soft light' },
  { name: 'Red', colour: 'red', tagline: 'Final eight · hits and noise' },
]);

const CATEGORY_ICONS = Object.freeze({
  'Analog': '∿', 'FM': '≋', 'Wavetable': '▦', 'Drums': '●', 'Chords': '♢',
  'Vocal': '◖', 'Noise/texture': '░', 'Physical': '⌁', 'Other': '✦',
});

export function sizeClass(bytes) {
  if (bytes < 4 * 1024) return 'size-small';
  if (bytes < 16 * 1024) return 'size-medium';
  return 'size-large';
}

function engineRow(engine, index, slot) {
  const bank = slot?.bank ?? engine.bank;
  return {
    index,
    id: engine.id,
    key: engine.key ?? engine.id,
    name: bank === undefined ? engine.name : `Six-op FM · bank ${BANK_LETTERS[bank]}`,
    category: engine.cat,
    family: engine.cat,
    icon: CATEGORY_ICONS[engine.cat] ?? '◇',
    bytes: engine.bytes,
    sizeLabel: `${(engine.bytes / 1024).toFixed(1)} KB`,
    sizeClass: sizeClass(engine.bytes),
    stereo: Boolean(engine.stereo),
    monoInPractice: Boolean(engine.monoInPractice),
    stereoEnabled: Boolean(slot?.stereo),
    sync: Boolean(engine.sync),
    syncEnabled: Boolean(slot?.sync),
    bank,
    dx7Bank: bank === undefined ? null : BANK_LETTERS[bank],
    sources: engine.srcs ?? [],
  };
}

// One voice's palette as three bank cards. liveIndex is the slot the connected module
// currently plays on this voice (null when not connected).
export function bankCardsView(model, voice, liveIndex = null) {
  const slots = model.slotsOf(voice);
  return BANKS.map((definition, bank) => {
    const start = bank * 8;
    return {
      ...definition,
      bank,
      counter: '8/8',
      slots: slots.slice(start, start + 8).map((slot, offset) => {
        const index = start + offset;
        return {
          ...engineRow(model.byId.get(slot.id), index, slot),
          number: String(offset + 1).padStart(2, '0'),
          globalNumber: index + 1,
          live: liveIndex === index,
        };
      }),
    };
  });
}

export function libraryRowsView(catalogOrEntries, slots, filters = {}) {
  const entries = Array.isArray(catalogOrEntries) ? catalogOrEntries : libraryEntries(catalogOrEntries);
  const query = String(filters.search ?? '').trim().toLocaleLowerCase('en');
  const used = new Set(slots.map((slot) => (slot.bank === undefined ? slot.id : `${slot.id}#${slot.bank}`)));
  return entries
    .filter((engine) => !query || `${engine.name} ${engine.id} ${engine.cat}`.toLocaleLowerCase('en').includes(query))
    .filter((engine) => !filters.category || engine.cat === filters.category)
    .filter((engine) => !filters.stereo || engine.stereo)
    .filter((engine) => !filters.sync || engine.sync)
    .filter((engine) => !filters.absent || !used.has(engine.key ?? engine.id))
    .map((engine) => ({ ...engineRow(engine, undefined, undefined), inSet: used.has(engine.key ?? engine.id) }));
}

export function categoriesView(engines) {
  return [...new Set(engines.map((engine) => engine.cat))].sort((a, b) => a.localeCompare(b, 'en'));
}

// Studio assumes the compact product (two Plaits voices + one sampler) unless a connected module reports exactly
// three Plaits voices. Without a module (not connected, demo, unreadable table) it must NOT fall back to the full
// three-voice build: that once started a cloud build of the wrong product.
export function voiceTabCount(table) {
  return Number(table?.voiceCount) === 3 ? 3 : 2;
}

export function isCompactModule(table) {
  return voiceTabCount(table) === 2;
}

// The AXI-code meter: estimated union size against the budget; red (and no Build) when over.
// The budget is calibrated on the old three-voice build. On a compact module (two Plaits voices) real builds
// measured 41-43 KB of AXI margin for sets whose estimates differ by tens of KB, so there the number is only
// a rough guide (about +-17 KB): it never turns red or blocks Build, the build itself checks the real margin.
export function memoryView(summary, { compact = false } = {}) {
  const kb = (bytes) => `${(Math.abs(bytes) / 1024).toFixed(1)} KB`;
  if (compact) {
    return {
      red: false,
      buildDisabled: false,
      percent: Math.min(100, Math.round(summary.usedFraction * 100)),
      usedLabel: `code ≈ ${kb(summary.unionBytes)}`,
      marginLabel: 'rough estimate (±17 KB); the exact AXI check runs at Build',
      classesLabel: `engine classes: ${summary.unionClasses}`,
      hint: '',
    };
  }
  const over = summary.overBudget;
  return {
    red: over,
    buildDisabled: over,
    percent: Math.min(100, Math.round(summary.usedFraction * 100)),
    usedLabel: `code ≈ ${kb(summary.unionBytes)} of ${kb(summary.budgetBytes)}`,
    marginLabel: over
      ? `short by ≈ ${kb(summary.estimatedMargin)} of AXI`
      : `≈ ${kb(summary.estimatedMargin)} of AXI to spare`,
    classesLabel: `engine classes: ${summary.unionClasses}`,
    hint: over ? 'Does not fit in AXI: replace heavy engines (use the Suggest replacements button).' : '',
  };
}

// One button occupies one place: cancellation remains available even if the
// recipe was edited over budget while its previous build is still running.
export function buildButtonView({ phase, cancelling = false, buildDisabled = false, hint = '', demo = false }) {
  const building = phase === 'building' || phase === 'cancelling';
  return {
    label: building ? 'Cancel' : 'Build',
    disabled: demo || cancelling || phase === 'cancelling' || phase === 'flashing' || (!building && buildDisabled),
    title: building ? (cancelling || phase === 'cancelling' ? 'Cancelling the firmware build' : 'Cancel the firmware build') : (buildDisabled ? hint : ''),
  };
}
