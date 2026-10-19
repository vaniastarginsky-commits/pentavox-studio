// Voice balance slots are aux-send aliases now; Stutter chance is inert since the random auto-stutter was retired.
// Master page destinations exist only in the compact firmware; other builds ignore them.
const MASTER_PAGE_SYMBOLS = /^(Voice[12]Filter|Voice[12]FilterRes|GlobalOutputLevel|GlobalInputAux|FxDrive|Voice[12]XMod|FxDelayDamp|FxDelaySpace|FxDelayReverse|FxDelayPingPong)$/;
// The compact build has no Stutter on any page, so nothing there can be routed to it.
const STUTTER_SYMBOLS = /^FxStutter/;
const DEPRECATED_SYMBOLS = /^(Voice[123]Balance|FxStutterChance|FxReverbShimmer|FxDrive|FxChebAmount|FxFoldAmount)$/;

// On the looper image the sampler voice is the looper: only these four sampler destinations do anything there, under the looper's own names.
const LOOPER_DESTINATIONS = Object.freeze({
  Sampler1Level: 'Level',
  Sampler1Balance: 'Aux send',
  Sampler1Decay: 'Overdub feedback',
  Sampler1Attack: 'Loop length',
});
const looperEntry = (item) => (LOOPER_DESTINATIONS[item.symbol] ? Object.freeze({ ...item, group: 'Looper', name: LOOPER_DESTINATIONS[item.symbol] }) : null);

class DestinationCatalog {
  constructor(json) {
    if (!Number.isInteger(json.count) || json.entries?.length !== json.count) {
      throw new TypeError('destination count does not match entries');
    }
    this.schemaHash = json.schemaHash >>> 0;
    this.count = json.count;
    const counts = json.supportedCounts ?? [json.count];
    if (!Array.isArray(counts) || !counts.includes(json.count)
        || counts.some((count) => !Number.isInteger(count) || count < 1 || count > json.count)) {
      throw new TypeError('invalid supported destination counts');
    }
    this.supportedCounts = Object.freeze([...new Set(counts)]);
    this.entries = json.entries.map((entry, id) => {
      if (entry.id !== id || typeof entry.group !== 'string' || typeof entry.name !== 'string') {
        throw new TypeError(`invalid destination id ${id}`);
      }
      return Object.freeze({ ...entry });
    });
  }

  /** Set while the connected firmware is a looper image (see StudioSession.loopIo): the sampler destinations are the looper's. */
  looper = false;

  byId(id) {
    const item = this.entries[id];
    return this.looper && item ? (looperEntry(item) ?? item) : item;
  }

  // Voice[123]Balance stay in the catalog (ids are stable, saved routes may still name them) but are
  // deprecated no-ops in the firmware, so they are not offered for selection.
  groups({ plaitsVoices = 3, samplerVoices = 2, granularEnabled = true, tapeEnabled = true, masterPage = true, stutter = true, destCount = this.count } = {}) {
    const groups = [];
    const byName = new Map();
    for (const item of this.entries) {
      if (item.id >= destCount) continue;
      if (DEPRECATED_SYMBOLS.test(item.symbol ?? '')) continue;
      if (destCount > 90 && item.symbol === 'FxDelaySpace') continue;
      if (!masterPage && MASTER_PAGE_SYMBOLS.test(item.symbol ?? '')) continue;
      if (!stutter && STUTTER_SYMBOLS.test(item.symbol ?? '')) continue;
      if (!granularEnabled && (item.group === 'FX Granular' || /^FxGranular/.test(item.symbol ?? ''))) continue;
      if (!tapeEnabled && /^FxTape/.test(item.symbol ?? '')) continue;
      const plaits = /^Plaits (\d+)$/.exec(item.group);
      if (plaits && Number(plaits[1]) > plaitsVoices) continue;
      const sampler = /^Sampler (\d+)$/.exec(item.group);
      if (sampler && Number(sampler[1]) > samplerVoices) continue;
      let shown = item;
      if (this.looper && sampler) {
        shown = looperEntry(item);
        if (!shown) continue;    // Start, End, Cutoff, Resonance, Transpose, Slot: nothing to do for a loop
      }
      let group = byName.get(shown.group);
      if (!group) {
        group = { group: shown.group, items: [] };
        byName.set(shown.group, group);
        groups.push(group);
      }
      group.items.push(shown);
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
