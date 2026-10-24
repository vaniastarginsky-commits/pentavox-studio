import { PANEL_POT_PAGES } from './panel_pots_data.js';

export const BASE_CV_FUNCTION_LABELS = Object.freeze([
  'Not assigned', 'FX freeze', 'Phaser CV', 'Bar reset', 'Clock input',
]);

const LEGACY_BASE_CV_FUNCTIONS = Object.freeze([1, 2, 0, 0, 3, 4]);

export function isLooperDescriptor(descriptor) {
  return Number(descriptor?.loopIo?.version) >= 1
    || (descriptor?.manual?.sections ?? []).some((section) => section.title === 'Looper');
}

/** What a panel pot controls on every page, by destination name: [{ page, name }]. */
export function panelPotBuiltIn(potIndex, destinations, pages = PANEL_POT_PAGES) {
  const bySymbol = new Map(destinations.entries.map((entry) => [entry.symbol, entry]));
  const out = [];
  for (const { page, pots } of pages) {
    const symbol = pots[potIndex];
    if (!symbol || symbol === 'None') continue;
    if (symbol.startsWith('builtin:')) { out.push({ page, name: symbol.slice(8), symbol }); continue; }
    const entry = bySymbol.get(symbol);
    out.push({ page, name: entry?.name ?? symbol, symbol });
  }
  return out;
}

/** Built-in function of a base CV jack, read from the live firmware when available. */
export function baseCvFunction(channel, settings = null) {
  const id = `jack.${channel}.function`;
  const value = settings?.has(id) ? settings.get(id) : LEGACY_BASE_CV_FUNCTIONS[channel] ?? 0;
  return {
    id,
    value,
    label: BASE_CV_FUNCTION_LABELS[value] ?? `Function ${value}`,
    options: BASE_CV_FUNCTION_LABELS.map((label, option) => ({ value: option, label })),
    editable: Boolean(settings?.has(id)),
  };
}

/** Compatibility helper used by old descriptors and model tests. */
export function baseCvBuiltIn(channel, settings = null) {
  const fn = baseCvFunction(channel, settings);
  return fn.value === 0 ? '' : fn.label;
}

/** Short text for a collapsed row: the distinct functions, in page order. */
export function builtInSummary(items) {
  return [...new Set(items.map((item) => item.name))].join(' \u00b7 ');
}

// Built-in functions of the shift layer (B1 held), by page then pot. A pot not listed keeps its
// normal function while B1 is held. Mirrors ShiftTargetFor() in fw/include/pentavox/panel_shift.h.
const SHIFT_BUILT_IN = Object.freeze({
  'Plaits 1': { 4: 'Attack', 5: 'Aux send' }, 'Plaits 2': { 4: 'Attack', 5: 'Aux send' }, 'Plaits 3': { 4: 'Attack', 5: 'Aux send' },
  'Sampler 1': { 0: 'Tune (steps)', 1: 'Loop mode', 2: 'End (fine trim)', 3: 'Resonance', 4: 'Attack', 5: 'Balance' },
  'Sampler 2': { 0: 'Tune (steps)', 1: 'Loop mode', 2: 'End (fine trim)', 3: 'Resonance', 4: 'Attack', 5: 'Balance' },
  'FX live': { 1: 'Filter resonance', 2: 'Phaser depth', 3: 'Phaser feedback', 4: 'Delay feedback', 5: 'Reverb size' },
  'FX granular': { 0: 'Scatter', 1: 'Pitch spread', 2: 'Reverse' },
  'FX tone': { 0: 'Phaser center', 1: 'Phaser CV amount' },
});

/** Shift-layer function of a pot on a page, or '' when it keeps its normal one. */
export function shiftBuiltIn(page, potIndex, masterPage = false, capabilities = null) {
  if(capabilities?.multitap) {
    const single=capabilities.plaitsVoices===1;
    const maps={
      'Plaits 1':[single?'Engine':capabilities.crossFm?'Cross FM':'','Twist',capabilities.sidechain?'Sidechain EQ':'','Reverb send','Attack','Delay send'],
      'Plaits 2':[capabilities.crossFm?'Cross FM':'','Twist',capabilities.sidechain?'Sidechain EQ':'','Reverb send','Attack','Delay send'],
      'Looper':['File A','File B',single?'Direction A':'Direction',single?'Direction B':capabilities.sidechain?'Sidechain EQ':'','Reverb send','Delay send'],
      'FX live':['Taps','Reverb motion','Damp','Reverb tone','Delay → Reverb','Algorithm'],
      'Master':['Plaits resonance',capabilities.phaser?'Phaser rate':'',single?'':'Plaits 2 resonance','Input → Delay','Looper resonance','Input → Reverb'],
    };
    if(maps[page])return maps[page][potIndex]??'';
  }
  if (masterPage) {
    const table = MASTER_SHIFT_BUILT_IN[page];
    return table?.[potIndex] ?? '';
  }
  return SHIFT_BUILT_IN[page]?.[potIndex] ?? '';
}

// Compact B1 controls are explicit: every missing pot is inert.
const MASTER_SHIFT_BUILT_IN = Object.freeze({
  'Plaits 1': { 0: 'Cross FM', 2: 'Sidechain EQ', 4: 'Attack', 5: 'Aux send' },
  'Plaits 2': { 0: 'Cross FM', 2: 'Sidechain EQ', 4: 'Attack', 5: 'Aux send' },
  'Master': { 0: 'Plaits 1 filter resonance', 1: 'Phaser rate', 2: 'Plaits 2 filter resonance', 3: 'Input Aux send', 4: 'Sampler filter resonance' },
  'Sampler 1': { 0: 'Tune (steps)', 2: 'End (fine trim)', 4: 'Attack', 5: 'Aux send' },
  'Looper': { 0: 'Loop 1 file', 1: 'Loop 2 file', 2: 'Direction', 3: 'Sidechain EQ', 5: 'Aux send' },
  'FX live': { 0: 'Reverse', 1: 'Filter resonance', 2: 'Delay damp', 3: 'Reverb damp', 4: 'Delay feedback' },
});
