// Factory template public API — compatibility facade.
// Builder helpers: src/templates/templateDefaults.js (factoryPart, makeFactoryTemplate).
// Template data:   src/templates/factoryTemplateData.js (FACTORY_TEMPLATE_BUNDLE).
// Depends on: normalizeTemplate (templateStorage.js).

function templateRecordFromFactoryTemplate(t) {
  const data = JSON.stringify(t);
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    kind: t.kind,
    hp: t.hp,
    updatedAt: t.updatedAt,
    sizeBytes: data.length,
    data,
    factory: true,
  };
}
function factoryPresetTemplates() {
  return FACTORY_TEMPLATE_BUNDLE.map((item) => normalizeTemplate(item))
    .filter((item) => !!item)
    .sort((a, b) => a.hp - b.hp || a.name.localeCompare(b.name));
}
function loadFactoryTemplateRecords() {
  return factoryPresetTemplates().map(templateRecordFromFactoryTemplate);
}
