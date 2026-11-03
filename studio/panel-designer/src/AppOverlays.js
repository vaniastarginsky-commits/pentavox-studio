// App-level overlays and dialogs extracted from core.js.
// These components are rendered by App or canvas HUD surfaces and own no global app state.

function CommandPalette({ commands, onClose }) {
  const [q, setQ] = useState("");
  const filtered = commands
    .filter((c) =>
      (c.label + " " + c.hint).toLowerCase().includes(q.trim().toLowerCase()),
    )
    .slice(0, 12);
  function run(c) {
    c.run();
    onClose();
  }
  return React.createElement(
    "div",
    { className: "command-palette-backdrop", onMouseDown: onClose },
    React.createElement(
      "div",
      { className: "command-palette", onMouseDown: (e) => e.stopPropagation() },
      React.createElement(
        "div",
        { className: "command-palette-title" },
        "Command palette",
      ),
      React.createElement("input", {
        autoFocus: true,
        value: q,
        placeholder: "Type a command: grid, rear, export, fader\u2026",
        onChange: (e) => setQ(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && filtered[0]) run(filtered[0]);
        },
      }),
      React.createElement(
        "div",
        { className: "command-palette-list" },
        filtered.map((c) =>
          React.createElement(
            "button",
            { key: c.id, onClick: () => run(c) },
            React.createElement("span", null, c.label),
            React.createElement("small", null, c.hint),
          ),
        ),
        !filtered.length &&
          React.createElement(
            "div",
            { className: "command-empty" },
            "No matching commands",
          ),
      ),
    ),
  );
}
function LocalProjectsDialog({ onClose }) {
  const dispatch = useAppDispatch();
  const state = useAppState();
  const currentProjectHasContent =
    state.components.length > 0 ||
    state.artworks.length > 0 ||
    state.textItems.length > 0 ||
    state.scaleItems.length > 0;
  const [projects, setProjects] = useState(() => loadLocalProjects());
  const [projectSearch, setProjectSearch] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loadPending, setLoadPending] = useState(null);
  const visibleProjects = projects.filter(
    (p) =>
      !projectSearch.trim() ||
      `${p.name} ${p.updatedAt}`
        .toLowerCase()
        .includes(projectSearch.trim().toLowerCase()),
  );
  function refresh() {
    setProjects(loadLocalProjects());
  }
  function loadRecord(record) {
    let raw;
    try {
      raw = JSON.parse(record.data);
    } catch {
      alert("Saved project is corrupted and could not be parsed.");
      return;
    }
    const result = validateAndNormalize(raw);
    if (!result.ok) {
      alert(`Load failed: ${result.error}`);
      return;
    }
    if (currentProjectHasContent) {
      setLoadPending({ record, state: result.state });
      return;
    }
    dispatch({ type: "LOAD_STATE", state: result.state });
    onClose();
  }
  function confirmLoadRecord() {
    if (!loadPending) return;
    dispatch({ type: "LOAD_STATE", state: loadPending.state });
    setLoadPending(null);
    onClose();
  }
  function deleteRecord(record) {
    setDeleteTarget(record);
  }
  function confirmDeleteRecord() {
    if (!deleteTarget) return;
    deleteLocalProject(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  }
  function renameRecord(record) {
    setRenameTarget(record);
    setRenameDraft(record.name);
  }
  function confirmRenameRecord() {
    if (!renameTarget) return;
    const name = renameDraft.trim();
    if (!name) return;
    try {
      const next = {
        ...renameTarget,
        name,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        LOCAL_PROJECT_RECORD_PREFIX + renameTarget.id,
        JSON.stringify(next),
      );
      setRenameTarget(null);
      setRenameDraft("");
      refresh();
    } catch {
      alert("Rename failed.");
    }
  }
  function duplicateRecord(record) {
    try {
      const next = {
        ...record,
        id: crypto.randomUUID(),
        name: record.name + " copy",
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        LOCAL_PROJECT_RECORD_PREFIX + next.id,
        JSON.stringify(next),
      );
      const idx = loadLocalProjects().map((p) => ({
        id: p.id,
        updatedAt: p.updatedAt,
      }));
      if (!idx.some((x) => x.id === next.id))
        idx.unshift({ id: next.id, updatedAt: next.updatedAt });
      localStorage.setItem(LOCAL_PROJECTS_INDEX_KEY, JSON.stringify(idx));
      refresh();
    } catch {
      alert("Duplicate failed.");
    }
  }
  function exportRecord(record) {
    downloadTextFile(
      safeProjectFileName(record.name),
      record.data,
      "application/json",
    );
  }
  return ReactDOM.createPortal(
    React.createElement(
      "div",
      {
        className: "app-modal-backdrop local-projects-backdrop",
        onPointerDown: (e) => {
          if (e.target === e.currentTarget) onClose();
        },
      },
      React.createElement(
        "div",
        { className: "app-modal-panel local-projects-panel" },
        React.createElement(
          "div",
          { className: "app-modal-header" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "app-modal-title" },
              "Local Browser Projects",
            ),
            React.createElement(
              "div",
              { className: "app-modal-subtitle" },
              "Stored in this browser only. Export a project file for a real backup.",
            ),
          ),
          React.createElement("button", { onClick: onClose }, "Close"),
        ),
        React.createElement(
          "div",
          { className: "app-modal-body" },
          React.createElement(
            "div",
            { className: "local-projects-toolbar" },
            React.createElement("input", {
              type: "text",
              placeholder: "Search local projects\u2026",
              value: projectSearch,
              onChange: (e) => setProjectSearch(e.target.value),
            }),
            React.createElement(
              "span",
              null,
              visibleProjects.length,
              " / ",
              projects.length,
            ),
          ),
          projects.length === 0
            ? React.createElement(
                "div",
                { className: "empty-state-note" },
                "No local browser projects found. Use File \u2192 Save to Browser first.",
              )
            : visibleProjects.length === 0
              ? React.createElement(
                  "div",
                  { className: "empty-state-note" },
                  "No local projects match \u201C",
                  projectSearch,
                  "\u201D.",
                )
              : visibleProjects.map((p) =>
                  React.createElement(
                    "div",
                    { key: p.id, className: "local-project-card-row" },
                    React.createElement(
                      "div",
                      { className: "local-project-card-inner" },
                      React.createElement(
                        "div",
                        { style: { minWidth: 0 } },
                        React.createElement(
                          "div",
                          {
                            style: {
                              fontWeight: 700,
                              color: "#ddd",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            },
                          },
                          p.name,
                        ),
                        React.createElement(
                          "div",
                          {
                            style: {
                              color: "#888",
                              fontSize: 11,
                              marginTop: 3,
                            },
                          },
                          new Date(p.updatedAt).toLocaleString(),
                          " \u00B7 ",
                          (p.sizeBytes / 1024).toFixed(0),
                          " KB",
                        ),
                      ),
                      React.createElement(
                        "div",
                        { className: "btn-row", style: { flexShrink: 0 } },
                        React.createElement(
                          "button",
                          {
                            className: "primary",
                            onClick: () => loadRecord(p),
                          },
                          "Load",
                        ),
                        React.createElement(
                          "button",
                          { onClick: () => renameRecord(p) },
                          "Rename",
                        ),
                        React.createElement(
                          "button",
                          { onClick: () => duplicateRecord(p) },
                          "Duplicate",
                        ),
                        React.createElement(
                          "button",
                          { onClick: () => exportRecord(p) },
                          "Export",
                        ),
                        React.createElement(
                          "button",
                          {
                            className: "danger",
                            onClick: () => deleteRecord(p),
                          },
                          "Delete",
                        ),
                      ),
                    ),
                  ),
                ),
        ),
        renameTarget &&
          React.createElement(
            "div",
            {
              className: "inline-modal-layer",
              onPointerDown: (e) => {
                if (e.target === e.currentTarget) setRenameTarget(null);
              },
            },
            React.createElement(
              "div",
              { className: "inline-modal-card" },
              React.createElement(
                "div",
                { className: "inline-modal-title" },
                "Rename project",
              ),
              React.createElement(
                "div",
                { className: "inline-modal-subtitle" },
                "Stored locally in this browser.",
              ),
              React.createElement("input", {
                autoFocus: true,
                value: renameDraft,
                onChange: (e) => setRenameDraft(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Escape") setRenameTarget(null);
                  if (e.key === "Enter") confirmRenameRecord();
                },
              }),
              React.createElement(
                "div",
                { className: "inline-modal-actions" },
                React.createElement(
                  "button",
                  { onClick: () => setRenameTarget(null) },
                  "Cancel",
                ),
                React.createElement(
                  "button",
                  {
                    className: "primary",
                    onClick: confirmRenameRecord,
                    disabled: !renameDraft.trim(),
                  },
                  "Rename",
                ),
              ),
            ),
          ),
        deleteTarget &&
          React.createElement(
            "div",
            {
              className: "inline-modal-layer",
              onPointerDown: (e) => {
                if (e.target === e.currentTarget) setDeleteTarget(null);
              },
            },
            React.createElement(
              "div",
              { className: "inline-modal-card" },
              React.createElement(
                "div",
                { className: "inline-modal-title danger-title" },
                "Delete project",
              ),
              React.createElement(
                "div",
                { className: "inline-modal-subtitle" },
                "This removes the local browser copy. Export a project file first if you need a backup.",
              ),
              React.createElement(
                "div",
                { className: "delete-confirm-name" },
                "\u201C",
                deleteTarget.name,
                "\u201D",
              ),
              React.createElement(
                "div",
                { className: "inline-modal-actions" },
                React.createElement(
                  "button",
                  { onClick: () => setDeleteTarget(null) },
                  "Cancel",
                ),
                React.createElement(
                  "button",
                  { className: "danger", onClick: confirmDeleteRecord },
                  "Delete",
                ),
              ),
            ),
          ),
        loadPending &&
          React.createElement(
            "div",
            {
              className: "inline-modal-layer",
              onPointerDown: (e) => {
                if (e.target === e.currentTarget) setLoadPending(null);
              },
            },
            React.createElement(
              "div",
              { className: "inline-modal-card" },
              React.createElement(
                "div",
                { className: "inline-modal-title" },
                "Load project",
              ),
              React.createElement(
                "div",
                { className: "inline-modal-subtitle" },
                "This replaces the current project with the selected local browser project.",
              ),
              React.createElement(
                "div",
                { className: "delete-confirm-name" },
                "\u201C",
                loadPending.record.name,
                "\u201D",
              ),
              React.createElement(
                "div",
                { className: "inline-modal-actions" },
                React.createElement(
                  "button",
                  { onClick: () => setLoadPending(null) },
                  "Cancel",
                ),
                React.createElement(
                  "button",
                  { className: "primary", onClick: confirmLoadRecord },
                  "Load project",
                ),
              ),
            ),
          ),
      ),
    ),
    document.body,
  );
}
function productionSeverityRank(s) {
  return s === "error" ? 0 : s === "warning" ? 1 : s === "info" ? 2 : 3;
}
function productionRectsOverlap(a, b, pad = 0) {
  return (
    a.x1 - pad <= b.x2 &&
    a.x2 + pad >= b.x1 &&
    a.y1 - pad <= b.y2 &&
    a.y2 + pad >= b.y1
  );
}
function productionRectInsidePanel(r, widthMM) {
  return (
    r.x1 >= -0.01 &&
    r.y1 >= -0.01 &&
    r.x2 <= widthMM + 0.01 &&
    r.y2 <= PANEL_HEIGHT_MM + 0.01
  );
}
function textApproxBounds(t) {
  const w = Math.max(1, (t.text || "").length * t.fontSizeMm * 0.55);
  const h = Math.max(0.6, t.fontSizeMm * 1.15);
  const a = Math.abs((((t.rotation || 0) % 180) * Math.PI) / 180);
  const ca = Math.abs(Math.cos(a));
  const sa = Math.abs(Math.sin(a));
  const bw = w * ca + h * sa;
  const bh = w * sa + h * ca;
  return {
    x1: t.x - bw / 2,
    x2: t.x + bw / 2,
    y1: t.y - bh / 2,
    y2: t.y + bh / 2,
  };
}
function scaleApproxBounds(sc, components) {
  const c = sc.componentId
    ? components.find((cc) => cc.id === sc.componentId)
    : null;
  if ((sc.kind === "fader" || (c && isFaderLike(c))) && c) {
    const b = getFrontBounds(c);
    const slotW = c.holeDiameter || Math.max(2, b.w * 0.32);
    const slotH = c.slotLength ?? b.h;
    const side = sc.side === "left" ? -1 : 1;
    const gap = 0.65;
    const tick = Math.max(0.7, sc.tickLength || 1);
    const label =
      sc.labelMode === "none" ? 0 : Math.max(2.2, (sc.fontSizeMm || 1.1) * 1.8);
    const x0 = c.x + side * (slotW / 2 + gap);
    const x1 = side < 0 ? x0 - tick - label : x0;
    const x2 = side < 0 ? x0 : x0 + tick + label;
    return {
      x1: Math.min(x1, x2),
      x2: Math.max(x1, x2),
      y1: c.y - slotH / 2 - 0.8,
      y2: c.y + slotH / 2 + 0.8,
    };
  }
  const r =
    Math.max(1, sc.radius || 1) +
    Math.max(0.5, sc.tickLength || 1) +
    (sc.labelMode === "none" ? 0 : Math.max(2, (sc.fontSizeMm || 1.2) * 1.8));
  return { x1: sc.x - r, x2: sc.x + r, y1: sc.y - r, y2: sc.y + r };
}
function componentProductionFrontRect(c) {
  return getFrontExtents(c);
}
function buildProductionCheckItems(state, warnings) {
  const widthMM = panelWidthMM(state.panel);
  const items = [];
  const errorWarnings = warnings.filter((w) => w.severity === "error");
  const warnWarnings = warnings.filter((w) => w.severity !== "error");
  if (errorWarnings.length) {
    items.push({
      severity: "error",
      title: "DFM errors",
      detail: `${errorWarnings.length} blocking geometry issue${errorWarnings.length === 1 ? "" : "s"} found. Resolve red warnings before production.`,
    });
  } else {
    items.push({
      severity: "ok",
      title: "DFM errors",
      detail: "No blocking component/body/keepout collisions detected.",
    });
  }
  if (warnWarnings.length) {
    items.push({
      severity: "warning",
      title: "DFM warnings",
      detail: `${warnWarnings.length} non-blocking warning${warnWarnings.length === 1 ? "" : "s"} found. Review before ordering panels.`,
    });
  } else {
    items.push({
      severity: "ok",
      title: "DFM warnings",
      detail: "No non-blocking warnings detected.",
    });
  }
  const unverified = state.components.filter((c) => !isPartVerified(c));
  if (unverified.length) {
    items.push({
      severity: "warning",
      title: "Approximate parts",
      detail: `${unverified.length} component${unverified.length === 1 ? "" : "s"} are approximate/unverified. Verify datasheets or measure before production.`,
      ids: unverified.map((c) => c.id),
    });
  } else {
    items.push({
      severity: "ok",
      title: "Part verification",
      detail: "All placed parts are datasheet/measured/production status.",
    });
  }
  const outside = state.components.filter((c) => {
    const f = getFrontExtents(c);
    const rear = obbEdgeExtents(makeBodyOBB(c));
    const keep = obbEdgeExtents(makeKeepoutOBB(c));
    const minX = Math.min(f.x1, rear.x1, keep.x1);
    const maxX = Math.max(f.x2, rear.x2, keep.x2);
    const minY = Math.min(f.y1, rear.y1, keep.y1);
    const maxY = Math.max(f.y2, rear.y2, keep.y2);
    return (
      minX < -0.01 ||
      maxX > widthMM + 0.01 ||
      minY < -0.01 ||
      maxY > PANEL_HEIGHT_MM + 0.01
    );
  });
  if (outside.length) {
    items.push({
      severity: "error",
      title: "Parts outside panel",
      detail: `${outside.length} component${outside.length === 1 ? "" : "s"} extend beyond the panel boundary.`,
      ids: outside.map((c) => c.id),
    });
  } else {
    items.push({
      severity: "ok",
      title: "Panel boundary",
      detail:
        "All component front/rear/keepout extents stay within panel bounds.",
    });
  }
  if (state.pcb.enabled) {
    const pcbBottom = state.pcb.y + state.pcb.height;
    if (state.pcb.y < 0 || pcbBottom > PANEL_HEIGHT_MM) {
      items.push({
        severity: "error",
        title: "PCB outside panel height",
        detail: `PCB y=${state.pcb.y.toFixed(1)}…${pcbBottom.toFixed(1)} mm exceeds the panel height.`,
      });
    } else if (state.pcb.height > 110) {
      items.push({
        severity: "warning",
        title: "PCB height near practical limit",
        detail: `PCB height is ${state.pcb.height.toFixed(1)} mm. 110 mm is a safer practical maximum for many 3U Eurorack cases.`,
      });
    } else {
      items.push({
        severity: "ok",
        title: "PCB envelope",
        detail: `PCB height ${state.pcb.height.toFixed(1)} mm is within the 110 mm practical target.`,
      });
    }
  } else {
    items.push({
      severity: "info",
      title: "PCB envelope disabled",
      detail:
        "Enable PCB outline to check rear body fit against your board envelope.",
    });
  }
  const tinyText = state.textItems.filter(
    (t) => t.visible && t.fontSizeMm < 1.2,
  );
  if (tinyText.length) {
    items.push({
      severity: "warning",
      title: "Small text",
      detail: `${tinyText.length} text item${tinyText.length === 1 ? "" : "s"} below 1.2 mm. Confirm readability and manufacturer minimums.`,
    });
  } else {
    items.push({
      severity: "ok",
      title: "Text size",
      detail: "No visible text below 1.2 mm.",
    });
  }
  const textOutside = state.textItems.filter(
    (t) =>
      t.visible && !productionRectInsidePanel(textApproxBounds(t), widthMM),
  );
  if (textOutside.length) {
    items.push({
      severity: "warning",
      title: "Text outside panel",
      detail: `${textOutside.length} visible text item${textOutside.length === 1 ? "" : "s"} extend beyond the panel boundary.`,
    });
  } else {
    items.push({
      severity: "ok",
      title: "Text bounds",
      detail: "Visible text appears inside the panel boundary.",
    });
  }
  const hardwareRects = state.components.map((c) => ({
    c,
    r: componentProductionFrontRect(c),
  }));
  let textHardwareOverlaps = 0;
  for (const t of state.textItems.filter((t) => t.visible)) {
    const tb = textApproxBounds(t);
    for (const { c, r } of hardwareRects) {
      if (t.componentId === c.id) continue;
      if (productionRectsOverlap(tb, r, 0.25)) {
        textHardwareOverlaps++;
        break;
      }
    }
  }
  if (textHardwareOverlaps) {
    items.push({
      severity: "warning",
      title: "Text overlaps hardware",
      detail: `${textHardwareOverlaps} visible text item${textHardwareOverlaps === 1 ? "" : "s"} may overlap component hardware/cutouts.`,
    });
  } else {
    items.push({
      severity: "ok",
      title: "Text clearance",
      detail: "No obvious text-to-hardware overlaps detected.",
    });
  }
  const visibleScales = state.scaleItems.filter((sc) => sc.visible);
  const scaleOutside = visibleScales.filter(
    (sc) =>
      !productionRectInsidePanel(
        scaleApproxBounds(sc, state.components),
        widthMM,
      ),
  );
  if (scaleOutside.length) {
    items.push({
      severity: "warning",
      title: "Scales outside panel",
      detail: `${scaleOutside.length} scale${scaleOutside.length === 1 ? "" : "s"} extend beyond the panel boundary.`,
    });
  } else {
    items.push({
      severity: "ok",
      title: "Scale bounds",
      detail: "Visible scales appear inside the panel boundary.",
    });
  }
  let scaleHardwareOverlaps = 0;
  for (const sc of visibleScales) {
    const sb = scaleApproxBounds(sc, state.components);
    for (const { c, r } of hardwareRects) {
      if (sc.componentId === c.id && (sc.kind === "fader" || isFaderLike(c)))
        continue;
      if (productionRectsOverlap(sb, r, 0.2)) {
        scaleHardwareOverlaps++;
        break;
      }
    }
  }
  if (scaleHardwareOverlaps) {
    items.push({
      severity: "warning",
      title: "Scale overlaps hardware",
      detail: `${scaleHardwareOverlaps} scale${scaleHardwareOverlaps === 1 ? "" : "s"} may overlap component hardware/cutouts.`,
    });
  } else {
    items.push({
      severity: "ok",
      title: "Scale clearance",
      detail: "No obvious scale-to-hardware overlaps detected.",
    });
  }
  const longFaderTicks = visibleScales.filter((sc) => {
    const c = sc.componentId
      ? state.components.find((cc) => cc.id === sc.componentId)
      : null;
    return (
      c &&
      (sc.kind === "fader" || isFaderLike(c)) &&
      (sc.tickLength || 0) > 1.15
    );
  });
  if (longFaderTicks.length) {
    items.push({
      severity: "warning",
      title: "Fader scale tick length",
      detail: `${longFaderTicks.length} fader scale${longFaderTicks.length === 1 ? "" : "s"} use long ticks. Consider shorter ticks for compact Eurorack panels.`,
    });
  } else {
    items.push({
      severity: "ok",
      title: "Fader scales",
      detail: "Fader scale tick lengths look compact.",
    });
  }
  const shortSlots = state.components.filter(
    (c) => c.holeType === "slot" && (c.slotLength ?? 0) < 10,
  );
  if (shortSlots.length) {
    items.push({
      severity: "warning",
      title: "Short slots",
      detail: `${shortSlots.length} slot${shortSlots.length === 1 ? "" : "s"} shorter than 10 mm. Check milling limitations.`,
      ids: shortSlots.map((c) => c.id),
    });
  } else {
    items.push({
      severity: "ok",
      title: "Slots",
      detail: "No unusually short slot cutouts detected.",
    });
  }
  if (!state.components.length) {
    items.push({
      severity: "info",
      title: "Empty layout",
      detail: "No components placed yet.",
    });
  }
  return items.sort(
    (a, b) =>
      productionSeverityRank(a.severity) - productionSeverityRank(b.severity),
  );
}
function ProductionCheckDialog({ warnings, onClose, onOpenExport }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const items = useMemo(
    () => buildProductionCheckItems(state, warnings),
    [
      state.components,
      state.textItems,
      state.scaleItems,
      state.panel,
      state.pcb,
      state.mountingHoles,
      warnings,
    ],
  );
  const errors = items.filter((i) => i.severity === "error").length;
  const warns = items.filter((i) => i.severity === "warning").length;
  const status = errors ? "BLOCKED" : warns ? "WARNINGS" : "READY";
  function selectIds(ids) {
    if (!ids || !ids.length) return;
    dispatch({ type: "SELECT", ids, additive: false });
  }
  return ReactDOM.createPortal(
    React.createElement(
      "div",
      {
        className: "production-check-backdrop",
        onMouseDown: (e) => {
          if (e.target === e.currentTarget) onClose();
        },
      },
      React.createElement(
        "div",
        {
          className: "production-check-dialog",
          onMouseDown: (e) => e.stopPropagation(),
        },
        React.createElement(
          "div",
          { className: "production-check-head" },
          React.createElement(
            "div",
            null,
            React.createElement("strong", null, "Production Check"),
            React.createElement(
              "span",
              { className: `production-status ${status.toLowerCase()}` },
              status,
            ),
          ),
          React.createElement("button", { onClick: onClose }, "Close"),
        ),
        React.createElement(
          "div",
          { className: "production-summary" },
          React.createElement(
            "div",
            null,
            React.createElement("b", null, state.panel.widthHP, "HP"),
            React.createElement(
              "span",
              null,
              panelWidthMM(state.panel).toFixed(2),
              " \u00D7 ",
              PANEL_HEIGHT_MM,
              " mm",
            ),
          ),
          React.createElement(
            "div",
            null,
            React.createElement("b", null, state.components.length),
            React.createElement("span", null, "components"),
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "b",
              null,
              state.textItems.filter((t) => t.visible).length,
            ),
            React.createElement("span", null, "text"),
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "b",
              null,
              state.scaleItems.filter((s) => s.visible).length,
            ),
            React.createElement("span", null, "scales"),
          ),
          React.createElement(
            "div",
            null,
            React.createElement("b", null, errors),
            React.createElement("span", null, "errors"),
          ),
          React.createElement(
            "div",
            null,
            React.createElement("b", null, warns),
            React.createElement("span", null, "warnings"),
          ),
        ),
        React.createElement(
          "div",
          { className: "production-check-list" },
          items.map((item, idx) =>
            React.createElement(
              "button",
              {
                key: `${item.title}-${idx}`,
                className: `production-check-item ${item.severity}`,
                onClick: () => selectIds(item.ids),
                disabled: !item.ids?.length,
              },
              React.createElement(
                "span",
                { className: "production-dot" },
                item.severity === "error"
                  ? "!"
                  : item.severity === "warning"
                    ? "△"
                    : item.severity === "ok"
                      ? "✓"
                      : "i",
              ),
              React.createElement(
                "span",
                null,
                React.createElement("b", null, item.title),
                React.createElement("small", null, item.detail),
              ),
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "production-actions" },
          React.createElement(
            "button",
            { onClick: onOpenExport },
            "Open export",
          ),
          React.createElement(
            "button",
            { onClick: () => exportManufacturingReport(state, warnings) },
            "Export report",
          ),
          React.createElement(
            "button",
            { onClick: () => exportCSVDrillTable(state, warnings) },
            "Export CSV",
          ),
        ),
      ),
    ),
    document.body,
  );
}
function ShortcutHelpOverlay({ onClose }) {
  const groups = [
    {
      title: "Navigation",
      rows: [
        ["Ctrl/Cmd + K", "Command palette"],
        ["F", "Focus mode / restore panels"],
        ["Preview button", "Product view / Edit view"],
        ["Mouse wheel", "Zoom toward cursor"],
        ["Fit", "Fit panel to screen"],
      ],
    },
    {
      title: "Selection",
      rows: [
        ["Click component", "Select component"],
        ["Click empty canvas", "Deselect"],
        ["Drag empty canvas", "Marquee select"],
        ["Shift + click", "Add/remove selection"],
        ["Drag empty canvas (Multi)", "Touch or mouse lasso selection"],
        ["Right click / long press", "Component edit menu"],
        ["Esc", "Cancel placement / clear selection"],
      ],
    },
    {
      title: "Placement",
      rows: [
        ["Library click", "Choose part, then click panel"],
        ["Multiple", "Place more of the same part"],
        ["Done", "Finish placement"],
        ["Shift + panel click", "Desktop quick repeat placement"],
        ["Mobile Add", "Use Add sheet; sheet closes before placement"],
      ],
    },
    {
      title: "Editing",
      rows: [
        ["Drag", "Cursor-anchored move"],
        ["Shift + drag", "Smart snap: grid, edges, centers"],
        ["D", "Duplicate selected"],
        ["R", "Rotate selected 90°"],
        ["G / Shift + G", "Group / ungroup selected"],
        ["M / Shift + M", "Mirror X / mirror Y selected"],
        ["[ / ]", "Previous / next DFM warning"],
        ["P", "Manufacturing preview / restore"],
        ["Delete / Backspace", "Delete selected"],
        ["Text row input", "Inline edit text label"],
      ],
    },
    {
      title: "Exports",
      rows: [
        ["Ctrl/Cmd + S", "Export JSON project"],
        ["Ctrl/Cmd + E", "Open export dialog"],
        ["KiCad tab", "Mechanical .kicad_pcb export"],
        ["Holes only", "Clean KiCad panel outline + NPTH holes"],
        ["Report tab", "Regression QA checklist"],
      ],
    },
    {
      title: "Mobile",
      rows: [
        ["Bottom dock", "Add / Select / Part / View / More"],
        ["Pinch", "Zoom"],
        ["Side drawers", "Swipe from edge, not over editor gestures"],
        ["Bottom sheets", "Scroll inside sheet, canvas stays put"],
      ],
    },
  ];
  return React.createElement(
    "div",
    { className: "shortcut-help-backdrop", onMouseDown: onClose },
    React.createElement(
      "div",
      { className: "shortcut-help", onMouseDown: (e) => e.stopPropagation() },
      React.createElement(
        "div",
        { className: "shortcut-help-head" },
        React.createElement(
          "strong",
          null,
          "Shortcuts ",
          React.createElement("small", null, APP_VERSION),
        ),
        React.createElement("button", { onClick: onClose }, "\u00D7"),
      ),
      React.createElement(
        "div",
        { className: "shortcut-help-grid" },
        groups.map((g) =>
          React.createElement(
            "div",
            { key: g.title, className: "shortcut-help-card" },
            React.createElement("h4", null, g.title),
            g.rows.map(([key, label]) =>
              React.createElement(
                "div",
                { key: key, className: "shortcut-row" },
                React.createElement("kbd", null, key),
                React.createElement("span", null, label),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
function SelectionInfoStrip({ hidden }) {
  const state = useAppState();
  if (hidden || state.selected.length === 0) return null;
  const selected = state.components.filter((c) =>
    state.selected.includes(c.id),
  );
  if (!selected.length) return null;
  const xs = selected.map((c) => c.x);
  const ys = selected.map((c) => c.y);
  const locked = selected.filter((c) => c.locked).length;
  const label =
    selected.length === 1
      ? selected[0].ref || selected[0].label || selected[0].name
      : `${selected.length} parts`;
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  return React.createElement(
    "div",
    {
      className: "selection-info-strip",
      onMouseDown: (e) => e.stopPropagation(),
      onTouchStart: (e) => e.stopPropagation(),
    },
    React.createElement("strong", null, label),
    React.createElement("span", null, "x ", avg(xs).toFixed(2)),
    React.createElement("span", null, "y ", avg(ys).toFixed(2)),
    selected.length > 1 &&
      React.createElement(
        "span",
        null,
        "span ",
        spanX.toFixed(1),
        " \u00D7 ",
        spanY.toFixed(1),
        " mm",
      ),
    locked > 0 &&
      React.createElement("span", { className: "warn" }, locked, " locked"),
  );
}
function avg(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
