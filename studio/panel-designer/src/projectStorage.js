const LOCAL_PROJECTS_KEY = "pentavox-studio-panel-local-projects-v1";
function safeProjectFileName(name) {
  const base =
    (name || "panel-layout")
      .trim()
      .replace(/[^a-z0-9\u0430-\u044f\u0451_\-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "panel-layout";
  return `${base}.epanel.json`;
}
function serializeProject(state, pretty = false) {
  const { history: _h, future: _f, ...clean } = state;
  const meta = { ...clean.projectMeta, updatedAt: new Date().toISOString() };
  return JSON.stringify(
    { projectVersion: PROJECT_FILE_VERSION, ...clean, projectMeta: meta },
    null,
    pretty ? 2 : 0,
  );
}
function isIOSLike() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
async function saveTextFile(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const file = new File([blob], filename, { type: mime });
  const nav = navigator;
  if (
    isIOSLike() &&
    nav.canShare &&
    nav.share &&
    nav.canShare({ files: [file] })
  ) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}
function downloadTextFile(filename, text, mime = "application/json") {
  saveTextFile(filename, text, mime).catch(() => {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1500);
    } catch {
      alert("Save failed. Try Save to browser or Export ZIP instead.");
    }
  });
}
function downloadBlobFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}
function exportJSON(state) {
  void saveTextFile(
    safeProjectFileName(state.projectMeta?.name || "panel-layout"),
    serializeProject(state, true),
    "application/json",
  );
}
const LOCAL_PROJECTS_INDEX_KEY = "pentavox-studio-panel-local-project-index-v2";
const LOCAL_PROJECT_RECORD_PREFIX = "pentavox-studio-panel-local-project-record-v2:";
function safeStorageAvailable() {
  try {
    const k = "__eurorack_panel_storage_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
function localProjectRecordKey(id) {
  return `${LOCAL_PROJECT_RECORD_PREFIX}${id}`;
}
function cleanLocalProjectRecord(p) {
  if (!p || typeof p !== "object") return null;
  if (typeof p.data !== "string" || !p.data.trim()) return null;
  const id = typeof p.id === "string" && p.id ? p.id : crypto.randomUUID();
  const name =
    typeof p.name === "string" && p.name.trim()
      ? p.name.trim()
      : "Untitled panel";
  const updatedAt =
    typeof p.updatedAt === "string" && p.updatedAt
      ? p.updatedAt
      : new Date().toISOString();
  const sizeBytes =
    typeof p.sizeBytes === "number" && Number.isFinite(p.sizeBytes)
      ? p.sizeBytes
      : p.data.length;
  return { id, name, updatedAt, sizeBytes, data: p.data };
}
function loadLocalProjects() {
  if (!safeStorageAvailable()) return [];
  const out = [];
  const seen = new Set();
  function add(rec) {
    if (!rec) return;
    const key = rec.id || rec.name;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(rec);
  }
  try {
    const rawIndex = localStorage.getItem(LOCAL_PROJECTS_INDEX_KEY);
    const index = rawIndex ? JSON.parse(rawIndex) : [];
    if (Array.isArray(index)) {
      for (const item of index) {
        if (!item || typeof item !== "object") continue;
        const id = typeof item.id === "string" ? item.id : "";
        if (!id) continue;
        const rawRecord = localStorage.getItem(localProjectRecordKey(id));
        if (rawRecord) add(cleanLocalProjectRecord(JSON.parse(rawRecord)));
      }
    }
  } catch {}
  try {
    const rawLegacy = localStorage.getItem(LOCAL_PROJECTS_KEY);
    const legacy = rawLegacy ? JSON.parse(rawLegacy) : [];
    if (Array.isArray(legacy)) {
      for (const item of legacy) add(cleanLocalProjectRecord(item));
    }
  } catch {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (!k.startsWith(LOCAL_PROJECT_RECORD_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      add(cleanLocalProjectRecord(JSON.parse(raw)));
    }
  } catch {}
  return out.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
function storeLocalProjects(projects) {
  if (!safeStorageAvailable())
    throw new Error("Browser storage is unavailable.");
  const normalized = projects.map(cleanLocalProjectRecord).filter(Boolean);
  const keepIds = new Set(normalized.map((p) => p.id));
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (k.startsWith(LOCAL_PROJECT_RECORD_PREFIX)) {
        const id = k.slice(LOCAL_PROJECT_RECORD_PREFIX.length);
        if (!keepIds.has(id)) toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
  for (const p of normalized) {
    localStorage.setItem(localProjectRecordKey(p.id), JSON.stringify(p));
  }
  const index = normalized.map(({ id, name, updatedAt, sizeBytes }) => ({
    id,
    name,
    updatedAt,
    sizeBytes,
  }));
  localStorage.setItem(LOCAL_PROJECTS_INDEX_KEY, JSON.stringify(index));
  try {
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(normalized));
  } catch {}
}
/* appConfirm moved to NativeDialogs.js */ /* appNumberPrompt moved to NativeDialogs.js */ /* appPatternPrompt moved to NativeDialogs.js */ /* appTextPrompt moved to NativeDialogs.js */ async function saveProjectToBrowser(
  state,
) {
  if (!safeStorageAvailable()) {
    alert("Browser storage is unavailable. Use Save Project File instead.");
    return;
  }
  const current = loadLocalProjects();
  const suggested =
    state.projectMeta?.name && state.projectMeta.name !== "Untitled panel"
      ? state.projectMeta.name
      : `Panel ${new Date().toLocaleDateString()}`;
  const name = await appTextPrompt({
    title: "Save to Browser",
    subtitle:
      "Stored locally in this browser. Export a project file too for a real backup.",
    label: "Project name",
    defaultValue: suggested,
    confirmText: "Save",
  });
  if (!name || !name.trim()) return;
  const cleanName = name.trim();
  const data = serializeProject(
    {
      ...state,
      projectMeta: {
        ...state.projectMeta,
        name: cleanName,
        updatedAt: new Date().toISOString(),
      },
    },
    false,
  );
  const existing = current.find((p) => p.name === cleanName);
  const rec = {
    id: existing?.id || crypto.randomUUID(),
    name: cleanName,
    updatedAt: new Date().toISOString(),
    sizeBytes: data.length,
    data,
  };
  const next = [
    rec,
    ...current.filter((p) => p.id !== rec.id && p.name !== cleanName),
  ].slice(0, 30);
  try {
    storeLocalProjects(next);
    const verified = loadLocalProjects().some(
      (p) => p.id === rec.id || p.name === rec.name,
    );
    if (!verified)
      throw new Error("Saved project was not visible after write.");
    alert(
      `Saved “${cleanName}” to browser (${(data.length / 1024).toFixed(0)} KB). Export a project file too for real backup.`,
    );
  } catch (err) {
    console.error(err);
    alert(
      `Could not save to browser storage. The project may be too large or storage may be blocked. Use Save Project File instead.\n\n${String(err?.message || err)}`,
    );
  }
}
function deleteLocalProject(id) {
  storeLocalProjects(loadLocalProjects().filter((p) => p.id !== id));
}
