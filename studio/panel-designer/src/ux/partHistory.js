const UX_RECENT_PARTS_KEY = "eurorack-panel-designer-recent-parts-v1";
const UX_FAVORITE_PARTS_KEY = "eurorack-panel-designer-favorite-parts-v1";
const UX_PART_ORGANIZER_KEY = "eurorack-panel-designer-part-organizer-v1";
function partStableKey(def) {
  return `${def.type}|${def.name}|${def.manufacturer || ""}|${def.partNumber || ""}`;
}
function readStringListStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeStringListStorage(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, 32)));
  } catch {}
}
function rememberRecentPart(def) {
  const key = partStableKey(def);
  const next = [
    key,
    ...readStringListStorage(UX_RECENT_PARTS_KEY).filter((k) => k !== key),
  ].slice(0, 8);
  writeStringListStorage(UX_RECENT_PARTS_KEY, next);
}
function readPartOrganizerStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(UX_PART_ORGANIZER_KEY) || "{}");
    return {
      collections: Array.isArray(raw.collections)
        ? raw.collections
            .filter((item) => item && typeof item.name === "string")
            .map((item) => ({
              id: String(item.id || item.name),
              name: item.name.trim().slice(0, 36),
              keys: Array.isArray(item.keys)
                ? item.keys
                    .filter((key) => typeof key === "string")
                    .slice(0, 96)
                : [],
            }))
        : [],
      tags: raw.tags && typeof raw.tags === "object" ? raw.tags : {},
    };
  } catch {
    return { collections: [], tags: {} };
  }
}
function writePartOrganizerStorage(value) {
  try {
    localStorage.setItem(UX_PART_ORGANIZER_KEY, JSON.stringify(value));
  } catch {}
}
function sendPartPlacementEvent(def, stamp = false) {
  rememberRecentPart(def);
  window.dispatchEvent(
    new CustomEvent("start-part-placement", { detail: { def, stamp } }),
  );
}
