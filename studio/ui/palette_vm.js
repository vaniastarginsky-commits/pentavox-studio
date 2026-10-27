import { BANK_LETTERS, libraryEntries } from '../model/palette.js';

const BANKS = Object.freeze([
  { name: 'Green', colour: 'green', tagline: 'First eight · lively spectrum' },
  { name: 'Yellow', colour: 'yellow', tagline: 'Middle eight · soft light' },
  { name: 'Red', colour: 'red', tagline: 'Third bank · hits and noise' },
  { name: 'Blue', colour: 'blue', tagline: 'Fourth bank · single Plaits' },
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
  return BANKS.slice(0,slots.length/8).map((definition, bank) => {
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
  return Number(table?.voiceCount) === 1 ? 1 : Number(table?.voiceCount) === 3 ? 3 : 2;
}

export function isCompactModule(table) {
  return voiceTabCount(table) <= 2;
}

// The AXI-code meter: estimated union size against the budget; red (and no Build) when over.
// The budget is calibrated on the old three-voice build. On a compact module (two Plaits voices) real builds
// measured 41-43 KB of AXI margin for sets whose estimates differ by tens of KB, so there the number is only
// a rough guide (about +-17 KB): it never turns red or blocks Build, the build itself checks the real margin.
export function memoryView(summary, { compact = false } = {}) {
  const kb = (bytes) => `${(Math.abs(bytes) / 1024).toFixed(1)} KB`;
  if(summary.memoryUnavailable)return {red:false,buildDisabled:true,percent:0,marginLabel:'Single-Plaits memory calibration unavailable; reload Studio',classesLabel:'',hint:'Wait for the memory calibration to load, or reload Studio.'};
  if (summary.calibrated) {
    const over=summary.overBudget;
    return {red:over,buildDisabled:over&&Boolean(summary.exact),percent:Math.min(100,Math.round(summary.usedFraction*100)),
      usedLabel:`engines ≈ ${kb(summary.unionBytes)} of ${kb(summary.budgetBytes)}`,
      marginLabel:summary.exact ? `measured AXI reserve: ${kb(summary.referenceMargin)} above the 16 KB minimum`
        : `${over?'over conservative budget by':'estimated available'} ${kb(summary.estimatedMargin)} · 17 KB uncertainty reserved`,
      classesLabel:`engine classes: ${summary.unionClasses}`,
      hint:over?(summary.exact?'Over the measured single-Plaits limit. Replace heavy engines.':'Over the conservative estimate (new engines are only estimated). Build still runs; the real linker check decides, and a finished build recalibrates this meter.'):''};
  }
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
