// The module reports the engine class of every slot of every voice (the descriptor's engine labels); Studio keeps its own copy of the
// sets in the browser. These helpers compare the two, so a module flashed from another browser, another build or an older recipe is noticed.

function normalizeName(value) {
  return String(value ?? '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Catalog engine ids whose firmware name (`firmwareName`, else `name`: Studio may show a friendlier one) is the given label (several engines can share a name). */
export function engineIdsForLabel(label, catalogEngines) {
  const key = normalizeName(label);
  return catalogEngines.filter((engine) => normalizeName(engine.firmwareName ?? engine.name) === key).map((engine) => engine.id);
}

/**
 * Slots of one voice where the module and Studio disagree.
 * @param slots Studio's 24 slots ({ id, bank? })
 * @param labels the module's 24 labels for that voice
 * @returns [{ slot, labelled, ids, studioId }]: `ids` are the catalog engines the module's label could mean; slots whose label is
 *          unknown to the catalog are left out (nothing to compare against). Six-op banks (A/B/C) are not in the labels, so they never count as a difference.
 */
export function differingSlots(slots, labels, catalogEngines) {
  const result = [];
  labels.forEach((label, slot) => {
    const studio = slots[slot];
    const ids = engineIdsForLabel(label, catalogEngines);
    if (!studio || ids.length === 0 || ids.includes(studio.id)) return;
    result.push({ slot, label, ids, studioId: studio.id });
  });
  return result;
}

/** A short description of the differences for every voice the module reports. */
export function setDifferences(model, voiceLabels, catalogEngines) {
  return voiceLabels.map((labels, voice) => differingSlots(model.slotsOf(voice), labels, catalogEngines));
}

/** Overwrite Studio's differing slots with the module's engines (first candidate when a name is shared).
 *  Banked engines (Six-op FM) go last, so the old banked slots they replace have already freed their bank letters. */
export function adoptModuleSet(model, differences) {
  const jobs = differences.flatMap((voiceDifferences, voice) => voiceDifferences.map(({ slot, ids }) => ({ voice, slot, id: ids[0] })));
  for (const job of jobs.filter((item) => !model.isBanked(item.id))) model.place(job.voice, job.slot, job.id);
  for (const job of jobs.filter((item) => model.isBanked(item.id))) model.place(job.voice, job.slot, job.id);
}
