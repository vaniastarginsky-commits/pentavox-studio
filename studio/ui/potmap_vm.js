import { panelPotBuiltIn, shiftBuiltIn } from '../model/panel_pots.js';
import { POTMAP_OFF } from '../model/potmap.js';
import { PANEL_POT_PAGES } from '../model/panel_pots_data.js';

// Visible pages and their physical Page enum indexes. Sampler 2 deliberately
// remains an enum/schema hole in a one-sampler build, as does FX Granular in a
// no-granular build, so display indexes cannot be used to read/write the map.
export function potMapPages(table) {
  const {
    plaitsVoices = 3, samplerVoices = 2, granularEnabled = true,
    tapeEnabled = true, masterPage = false,
  } = table.capabilities ?? {};
  // The compact build hosts its Master page in the FX granular slot: the three DJ filters, output level and the two drive shapers.
  const MASTER = Object.freeze({
    page: 'Master',
    pots: Object.freeze(['builtin:Plaits 1 filter', 'builtin:Plaits 2 filter', 'Sampler1Cutoff', 'builtin:Output level', 'FxChebAmount', 'FxFoldAmount']),
  });
  const labels = PANEL_POT_PAGES.filter(({ page }) => {
    if (page === 'Plaits 3') return plaitsVoices === 3;
    if (page === 'Sampler 2') return samplerVoices === 2;
    if (page === 'FX granular') return granularEnabled || masterPage;
    if (page === 'FX tone') return granularEnabled;
    return true;
  }).map((entry) => {
    if (!masterPage) return entry;
    if (entry.page === 'FX granular') return MASTER;
    // Pot 4 of the sampler page is Loop mode here; the filter moved to the Master page.
    if (entry.page === 'Sampler 1') return { ...entry, pots: Object.freeze(entry.pots.map((symbol, pot) => (pot === 3 ? 'builtin:Loop mode' : symbol))) };
    return entry;
  });
  const sampler1 = plaitsVoices;
  const physical = new Map([
    ['Plaits 1', 0], ['Plaits 2', 1], ['Plaits 3', 2],
    ['Sampler 1', sampler1], ['Sampler 2', sampler1 + 1],
    ['FX live', sampler1 + 2], ['FX granular', sampler1 + 3], ['Master', sampler1 + 3],
    ['FX tone', sampler1 + 4],
  ]);
  return labels.map((entry) => {
    if (entry.page !== 'FX live' || tapeEnabled) {
      return { ...entry, index: physical.get(entry.page) };
    }
    return {
      ...entry,
      index: physical.get(entry.page),
      pots: Object.freeze([
        'builtin:Stutter division', 'FxFilterPosition',
        'FxPhaserMix', 'FxPhaserRate', 'FxDelayMix', 'FxReverbMix',
      ]),
    };
  });
}

export const POTMAP_LAYER_LABELS = Object.freeze(['Normal', 'Shift (hold B1)']);

export function potMapView(table, destinations) {
  const pages = potMapPages(table);
  const builtIns = Array.from({ length: 6 }, (_, pot) => new Map(
    panelPotBuiltIn(pot, destinations, pages).map((item) => [item.page, item.name]),
  ));
  return POTMAP_LAYER_LABELS.map((label, layer) => ({
    layer,
    label,
    pages: pages.map(({ page, index }) => ({
      page: index,
      label: page,
      cells: Array.from({ length: 6 }, (_, pot) => {
        const destId = table.get(layer, index, pot);
        const normal = builtIns[pot].get(page) ?? '';
        const shifted = layer === 1 ? shiftBuiltIn(page, pot, Boolean(table.capabilities?.masterPage)) : '';
        // What the pot does on this page/layer when nothing is assigned.
        const builtIn = layer === 0 ? normal : (shifted || (normal ? `${normal} (as normal)` : ''));
        const off = destId === POTMAP_OFF;
        const assigned = destId !== 0 && !off;
        const entry = assigned ? destinations.byId(destId) : null;
        return {
          layer,
          page: index,
          pot,
          potLabel: `Pot ${pot + 1}`,
          builtIn: builtIn || '\u2014',
          destId,
          off,
          assigned,
          // The cell's headline is always what the pot controls now.
          title: off ? 'Not assigned' : assigned ? (entry?.name ?? `#${destId}`) : (builtIn || 'Not used'),
          group: entry?.group ?? '',
          isDefault: destId === 0,
          replaces: (assigned || off) && builtIn ? `replaces ${builtIn}` : '',
        };
      }),
    })),
  }));
}
