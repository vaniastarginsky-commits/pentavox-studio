// Template builder helpers with default structure.
// Depends on: COMPONENT_LIBRARY (componentLibrary.js), sanitizePart (projectSchema.js),
// inferCategoryForType, nextRefForComponent, HP_TO_MM, defaultMountingHoleConfig (core.js).

function factoryPart(type, x, y, label = "", rotation = 0, existing = []) {
  const def =
    COMPONENT_LIBRARY.find((p) => p.type === type) ||
    COMPONENT_LIBRARY.find((p) => p.type === "custom");
  const part = sanitizePart({
    ...def,
    category: def.category ?? inferCategoryForType(def.type),
    verificationStatus: def.verificationStatus ?? "approximate",
  });
  return {
    ...part,
    id: `factory-${type}-${Math.round(x * 10)}-${Math.round(y * 10)}-${existing.length}`,
    ref: nextRefForComponent(part.type, existing),
    label: label || part.name,
    x,
    y,
    rotation,
    notes:
      "Factory preset placement. Verify ergonomics and exact part dimensions before production.",
    locked: false,
  };
}
function makeFactoryTemplate(id, name, hp, description, placements) {
  let comps = [];
  for (const [type, x, y, label, rot] of placements) {
    comps = [...comps, factoryPart(type, x, y, label || "", rot || 0, comps)];
  }
  const now = "2026-05-15T00:00:00.000Z";
  return {
    templateVersion: 1,
    id,
    name,
    description,
    kind: "panel",
    hp,
    createdAt: now,
    updatedAt: now,
    includeText: false,
    includeScales: false,
    includeArtwork: false,
    components: comps,
    pcb: { enabled: true, x: 2, y: 9, width: hp * HP_TO_MM - 4, height: 110 },
    mountingHoles: defaultMountingHoleConfig(hp * HP_TO_MM),
    textItems: [],
    scaleItems: [],
    artworks: [],
    customParts: [],
  };
}
