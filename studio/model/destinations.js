// Voice balance slots are aux-send aliases now; Stutter chance is inert since the random auto-stutter was retired.
// Master page destinations exist only in the compact firmware; other builds ignore them.
const MASTER_PAGE_SYMBOLS = /^(Voice[12]Filter|Voice[12]FilterRes|GlobalOutputLevel)$/;
// The compact build has no Stutter on any page, so nothing there can be routed to it.
const STUTTER_SYMBOLS = /^FxStutter/;
const DEPRECATED_SYMBOLS = /^(Voice[123]Balance|FxStutterChance)$/;

class DestinationCatalog {
  constructor(json) {
    if (!Number.isInteger(json.count) || json.entries?.length !== json.count) {
      throw new TypeError('destination count does not match entries');
    }
    this.schemaHash = json.schemaHash >>> 0;
    this.count = json.count;
    this.entries = json.entries.map((entry, id) => {
      if (entry.id !== id || typeof entry.group !== 'string' || typeof entry.name !== 'string') {
        throw new TypeError(`invalid destination id ${id}`);
      }
      return Object.freeze({ ...entry });
    });
  }

  byId(id) {
    return this.entries[id];
  }

  // Voice[123]Balance stay in the catalog (ids are stable, saved routes may still name them) but are
  // deprecated no-ops in the firmware, so they are not offered for selection.
  groups({ plaitsVoices = 3, samplerVoices = 2, granularEnabled = true, tapeEnabled = true, masterPage = true, stutter = true } = {}) {
    const groups = [];
    const byName = new Map();
    for (const item of this.entries) {
      if (DEPRECATED_SYMBOLS.test(item.symbol ?? '')) continue;
      if (!masterPage && MASTER_PAGE_SYMBOLS.test(item.symbol ?? '')) continue;
      if (!stutter && STUTTER_SYMBOLS.test(item.symbol ?? '')) continue;
      if (!granularEnabled && (item.group === 'FX Granular' || /^FxGranular/.test(item.symbol ?? ''))) continue;
      if (!tapeEnabled && /^FxTape/.test(item.symbol ?? '')) continue;
      const plaits = /^Plaits (\d+)$/.exec(item.group);
      if (plaits && Number(plaits[1]) > plaitsVoices) continue;
      const sampler = /^Sampler (\d+)$/.exec(item.group);
      if (sampler && Number(sampler[1]) > samplerVoices) continue;
      let group = byName.get(item.group);
      if (!group) {
        group = { group: item.group, items: [] };
        byName.set(item.group, group);
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  }

  label(id) {
    const item = this.byId(id);
    return item ? `${item.group} · ${item.name}` : `#${id}`;
  }
}

export function load(json) {
  return new DestinationCatalog(json);
}
