import { PANEL_POT_PAGES } from './panel_pots_data.js';

export const BASE_CV_FUNCTION_LABELS = Object.freeze([
  'Not assigned', 'FX freeze', 'Phaser CV', 'Bar reset', 'Clock input',
]);

const LEGACY_BASE_CV_FUNCTIONS = Object.freeze([1, 2, 0, 0, 3, 4]);

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
  'Sampler 1': { 0: 'Tune (steps)', 1: 'Loop mode', 2: 'Loop length', 3: 'Resonance', 4: 'Attack', 5: 'Balance' },
  'Sampler 2': { 0: 'Tune (steps)', 1: 'Loop mode', 2: 'Loop length', 3: 'Resonance', 4: 'Attack', 5: 'Balance' },
  'FX live': { 1: 'Filter resonance', 2: 'Phaser depth', 3: 'Phaser feedback', 4: 'Delay feedback', 5: 'Reverb size' },
  'FX granular': { 0: 'Scatter', 1: 'Pitch spread', 2: 'Reverse' },
  'FX tone': { 0: 'Phaser center', 1: 'Phaser CV amount' },
});

/** Shift-layer function of a pot on a page, or '' when it keeps its normal one. */
export function shiftBuiltIn(page, potIndex, masterPage = false) {
  if (masterPage) {
    const table = MASTER_SHIFT_BUILT_IN[page];
    return table?.[potIndex] ?? '';
  }
  return SHIFT_BUILT_IN[page]?.[potIndex] ?? '';
}

// Compact B1 controls are explicit: every missing pot is inert.
const MASTER_SHIFT_BUILT_IN = Object.freeze({
  'Plaits 1': { 0: 'Cross FM', 4: 'Attack', 5: 'Aux send' },
  'Plaits 2': { 0: 'Cross FM', 4: 'Attack', 5: 'Aux send' },
  'Master': { 0: 'Plaits 1 filter resonance', 1: 'Phaser rate', 2: 'Plaits 2 filter resonance', 3: 'Input Aux send', 4: 'Sampler filter resonance', 5: 'Drive' },
  'Sampler 1': { 0: 'Tune (steps)', 2: 'Loop length', 4: 'Attack', 5: 'Aux send' },
  'FX live': { 0: 'Space', 1: 'Filter resonance', 2: 'Delay damp', 3: 'Reverb damp', 4: 'Delay feedback' },
});
