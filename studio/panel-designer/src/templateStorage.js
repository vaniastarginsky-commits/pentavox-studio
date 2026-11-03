const LOCAL_TEMPLATE_INDEX_KEY = "pentavox-studio-panel-templates-index-v1";
const LOCAL_TEMPLATE_PREFIX = "pentavox-studio-panel-template:";
async function makeTemplateFromState(state, kind, componentIds) {
  const selectedSet = new Set(componentIds || []);
  const comps =
    kind === "block"
      ? state.components.filter((c) => selectedSet.has(c.id))
      : state.components;
  if (comps.length === 0) {
    alert(
      kind === "block"
        ? "Select at least one component to save a block template."
        : "Nothing to save as template: panel has no components.",
    );
    return null;
  }
  const defaultName =
    kind === "block"
      ? `${comps.length} component block`
      : `${state.projectMeta?.name || state.panel.widthHP + "HP panel"} template`;
  const promptResult = await appTemplateSavePrompt({ kind, defaultName });
  if (!promptResult) return null;
  const { name, description, includeText, includeScales, includeArtwork } =
    promptResult;
  const compIdSet = new Set(comps.map((c) => c.id));
  const now = new Date().toISOString();
  return {
    templateVersion: 1,
    id: crypto.randomUUID(),
    name,
    description,
    kind,
    hp: state.panel.widthHP,
    createdAt: now,
    updatedAt: now,
    includeText,
    includeScales,
    includeArtwork,
    components: stripIdsFromComponents(comps),
    pcb: kind === "panel" ? state.pcb : undefined,
    mountingHoles: kind === "panel" ? state.mountingHoles : undefined,
    textItems: includeText
      ? state.textItems
          .filter(
            (t) =>
              kind === "panel" ||
              !t.componentId ||
              compIdSet.has(t.componentId),
          )
          .map((t) => ({ ...t, id: t.id || crypto.randomUUID() }))
      : [],
    scaleItems: includeScales
      ? state.scaleItems
          .filter(
            (sc) =>
              kind === "panel" ||
              !sc.componentId ||
              compIdSet.has(sc.componentId),
          )
          .map((sc) => ({ ...sc, id: sc.id || crypto.randomUUID() }))
      : [],
    artworks:
      includeArtwork && kind === "panel"
        ? state.artworks.map((a) => ({ ...a, id: a.id || crypto.randomUUID() }))
        : [],
    customParts: state.customParts,
  };
}
function templateRecordFromTemplate(t) {
  const data = JSON.stringify(t);
  return {
    id: t.id,
    name: t.name,
    description: t.description || "",
    kind: t.kind,
    hp: t.hp,
    updatedAt: t.updatedAt,
    sizeBytes: data.length,
    data,
  };
}
function loadLocalTemplates() {
  try {
    const ids = JSON.parse(
      localStorage.getItem(LOCAL_TEMPLATE_INDEX_KEY) || "[]",
    );
    const records = [];
    if (Array.isArray(ids)) {
      for (const id of ids) {
        if (typeof id !== "string") continue;
        const raw = localStorage.getItem(LOCAL_TEMPLATE_PREFIX + id);
        if (!raw) continue;
        try {
          const t = JSON.parse(raw);
          if (t && typeof t.id === "string" && Array.isArray(t.components))
            records.push(templateRecordFromTemplate(t));
        } catch {}
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      if (!key.startsWith(LOCAL_TEMPLATE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const t = JSON.parse(raw);
        if (
          t &&
          typeof t.id === "string" &&
          Array.isArray(t.components) &&
          !records.some((r) => r.id === t.id)
        ) {
          records.push(templateRecordFromTemplate(t));
        }
      } catch {}
    }
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}
function saveTemplateToBrowser(t) {
  const records = loadLocalTemplates();
  const ids = [...new Set([t.id, ...records.map((r) => r.id)])];
  localStorage.setItem(LOCAL_TEMPLATE_PREFIX + t.id, JSON.stringify(t));
  localStorage.setItem(LOCAL_TEMPLATE_INDEX_KEY, JSON.stringify(ids));
}
function deleteLocalTemplate(id) {
  localStorage.removeItem(LOCAL_TEMPLATE_PREFIX + id);
  const ids = loadLocalTemplates()
    .filter((r) => r.id !== id)
    .map((r) => r.id);
  localStorage.setItem(LOCAL_TEMPLATE_INDEX_KEY, JSON.stringify(ids));
}
const HIDDEN_TEMPLATE_IDS_KEY =
  "pentavox_studio_panel_hidden_template_ids_v1";
function hiddenTemplateIds() {
  try {
    const raw = JSON.parse(
      localStorage.getItem(HIDDEN_TEMPLATE_IDS_KEY) || "[]",
    );
    return new Set(
      Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}
function saveHiddenTemplateIds(ids) {
  localStorage.setItem(HIDDEN_TEMPLATE_IDS_KEY, JSON.stringify([...ids]));
}
function hideTemplateEverywhere(id) {
  const ids = hiddenTemplateIds();
  ids.add(id);
  saveHiddenTemplateIds(ids);
  deleteLocalTemplate(id);
}
function unhideTemplate(id) {
  const ids = hiddenTemplateIds();
  if (ids.has(id)) {
    ids.delete(id);
    saveHiddenTemplateIds(ids);
  }
}
function editableTemplateRecords() {
  const hidden = hiddenTemplateIds();
  const factory = loadFactoryTemplateRecords()
    .filter((t) => !hidden.has(t.id))
    .sort((a, b) => a.hp - b.hp || a.name.localeCompare(b.name));
  const factoryIds = new Set(factory.map((t) => t.id));
  const local = loadLocalTemplates()
    .filter((t) => !hidden.has(t.id) && !factoryIds.has(t.id))
    .map((t) => ({ ...t, local: true }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return [...local, ...factory];
}
function updateTemplateMetadata(record, name, description) {
  try {
    const t = normalizeTemplate(JSON.parse(record.data));
    if (!t) return null;
    const now = new Date().toISOString();
    return {
      ...t,
      id: record.id,
      name,
      description,
      updatedAt: now,
      createdAt: t.createdAt || now,
    };
  } catch {
    return null;
  }
}
function replaceTemplateContentFromState(record, state, name, description) {
  const previous = (() => {
    try {
      return normalizeTemplate(JSON.parse(record.data));
    } catch {
      return null;
    }
  })();
  if (!previous) return null;
  const kind = previous.kind;
  const selectedSet = new Set(state.selected || []);
  const comps =
    kind === "block" && selectedSet.size > 0
      ? state.components.filter((c) => selectedSet.has(c.id))
      : state.components;
  if (comps.length === 0) {
    alert(
      kind === "block"
        ? "Nothing to replace with: select components first or add components to the panel."
        : "Nothing to replace with: current panel has no components.",
    );
    return null;
  }
  const compIdSet = new Set(comps.map((c) => c.id));
  const now = new Date().toISOString();
  return {
    templateVersion: 1,
    id: record.id,
    name,
    description,
    kind,
    hp: state.panel.widthHP,
    createdAt: previous.createdAt || now,
    updatedAt: now,
    includeText: previous.includeText,
    includeScales: previous.includeScales,
    includeArtwork: previous.includeArtwork,
    components: stripIdsFromComponents(comps),
    pcb: kind === "panel" ? state.pcb : undefined,
    mountingHoles: kind === "panel" ? state.mountingHoles : undefined,
    textItems: previous.includeText
      ? state.textItems
          .filter(
            (t) =>
              kind === "panel" ||
              !t.componentId ||
              compIdSet.has(t.componentId),
          )
          .map((t) => ({ ...t, id: t.id || crypto.randomUUID() }))
      : [],
    scaleItems: previous.includeScales
      ? state.scaleItems
          .filter(
            (sc) =>
              kind === "panel" ||
              !sc.componentId ||
              compIdSet.has(sc.componentId),
          )
          .map((sc) => ({ ...sc, id: sc.id || crypto.randomUUID() }))
      : [],
    artworks:
      previous.includeArtwork && kind === "panel"
        ? state.artworks.map((a) => ({ ...a, id: a.id || crypto.randomUUID() }))
        : [],
    customParts: state.customParts,
  };
}
function exportTemplatesLibrary() {
  const templates = loadLocalTemplates().map((r) => JSON.parse(r.data));
  if (templates.length === 0) {
    alert("No templates saved in this browser yet.");
    return;
  }
  downloadTextFile(
    "eurorack-panel-templates.json",
    JSON.stringify({ templateLibraryVersion: 1, templates }, null, 2),
    "application/json",
  );
}
function importTemplatesLibraryFile(onDone) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.epanel-templates,application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result);
        const arr = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.templates)
            ? raw.templates
            : [];
        let count = 0;
        for (const item of arr) {
          const t = normalizeTemplate(item);
          if (t) {
            saveTemplateToBrowser(t);
            count++;
          }
        }
        alert(`Imported ${count} template(s).`);
        onDone?.();
      } catch {
        alert("Could not import templates JSON.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
function normalizeTemplate(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.components))
    return null;
  const now = new Date().toISOString();
  const kind = raw.kind === "block" ? "block" : "panel";
  return {
    templateVersion: 1,
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    name:
      typeof raw.name === "string" && raw.name ? raw.name : "Imported template",
    description: typeof raw.description === "string" ? raw.description : "",
    kind,
    hp: typeof raw.hp === "number" && raw.hp > 0 ? raw.hp : 8,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: now,
    includeText: !!raw.includeText,
    includeScales: !!raw.includeScales,
    includeArtwork: !!raw.includeArtwork,
    components: raw.components.map((c) => ({
      ...sanitizePart(c),
      ...c,
      id: typeof c.id === "string" ? c.id : crypto.randomUUID(),
      label: typeof c.label === "string" ? c.label : c.name || "Component",
      x: typeof c.x === "number" ? c.x : 0,
      y: typeof c.y === "number" ? c.y : 0,
      rotation: typeof c.rotation === "number" ? c.rotation : 0,
      notes: typeof c.notes === "string" ? c.notes : "",
    })),
    pcb: raw.pcb && typeof raw.pcb === "object" ? raw.pcb : undefined,
    mountingHoles:
      raw.mountingHoles && typeof raw.mountingHoles === "object"
        ? raw.mountingHoles
        : undefined,
    textItems: Array.isArray(raw.textItems) ? raw.textItems : [],
    scaleItems: Array.isArray(raw.scaleItems) ? raw.scaleItems : [],
    artworks: Array.isArray(raw.artworks) ? raw.artworks : [],
    customParts: Array.isArray(raw.customParts)
      ? raw.customParts.map((p) => sanitizePart(p))
      : [],
  };
}
