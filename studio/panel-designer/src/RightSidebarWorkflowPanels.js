// Right sidebar panel components extracted from core.js.
// Globals are loaded by index.html; keep these files script-friendly, not ES modules.

// Assistant, history, measurement, and alignment panels.

function LayoutAssistantPanel({ warnings }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const widthMM = panelWidthMM(state.panel);
  const ext = state.components.length
    ? state.components.map(getFrontExtents)
    : [];
  const minX = ext.length ? Math.min(...ext.map((e) => e.x1)) : 0;
  const maxX = ext.length ? Math.max(...ext.map((e) => e.x2)) : 0;
  const minY = ext.length ? Math.min(...ext.map((e) => e.y1)) : 0;
  const maxY = ext.length ? Math.max(...ext.map((e) => e.y2)) : 0;
  const requiredWidth = Math.max(0, maxX - minX);
  const minHP =
    STANDARD_HP.find((hp) => hp * HP_TO_MM >= requiredWidth) ??
    Math.ceil(requiredWidth / HP_TO_MM);
  const hard = warnings.filter((w) => w.severity === "error").length;
  function centerLayout() {
    if (!state.components.length) return;
    const dx = widthMM / 2 - (minX + maxX) / 2;
    const dy = PANEL_HEIGHT_MM / 2 - (minY + maxY) / 2;
    dispatch({
      type: "MOVE_COMPONENTS",
      moves: state.components.map((c) => ({
        id: c.id,
        x: c.x + dx,
        y: c.y + dy,
      })),
    });
  }
  function centerX() {
    if (!state.components.length) return;
    const dx = widthMM / 2 - (minX + maxX) / 2;
    dispatch({
      type: "MOVE_COMPONENTS",
      moves: state.components.map((c) => ({ id: c.id, x: c.x + dx, y: c.y })),
    });
  }
  function centerY() {
    if (!state.components.length) return;
    const dy = PANEL_HEIGHT_MM / 2 - (minY + maxY) / 2;
    dispatch({
      type: "MOVE_COMPONENTS",
      moves: state.components.map((c) => ({ id: c.id, x: c.x, y: c.y + dy })),
    });
  }
  function packColumn() {
    const x = widthMM / 2;
    const step =
      state.components.length > 1
        ? (PANEL_HEIGHT_MM - 30) / (state.components.length - 1)
        : 0;
    dispatch({
      type: "MOVE_COMPONENTS",
      moves: state.components.map((c, i) => ({
        id: c.id,
        x,
        y: 15 + i * step,
      })),
    });
  }
  function packTwoColumns() {
    if (!state.components.length) return;
    const xs = [widthMM * 0.35, widthMM * 0.65];
    const rows = Math.ceil(state.components.length / 2);
    const step = rows > 1 ? (PANEL_HEIGHT_MM - 30) / (rows - 1) : 0;
    dispatch({
      type: "MOVE_COMPONENTS",
      moves: state.components.map((c, i) => ({
        id: c.id,
        x: xs[i % 2],
        y: 15 + Math.floor(i / 2) * step,
      })),
    });
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement(
      "div",
      { className: "section-title" },
      "Layout Assistant",
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Current HP"),
      React.createElement("span", null, state.panel.widthHP),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Required width"),
      React.createElement("span", null, requiredWidth.toFixed(1), " mm"),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Minimum HP estimate"),
      React.createElement("span", null, minHP, " HP"),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Hard collisions"),
      React.createElement("span", null, hard),
    ),
    React.createElement(
      "div",
      { className: "btn-row", style: { marginTop: 6 } },
      React.createElement(
        "button",
        { onClick: centerLayout, style: { whiteSpace: "nowrap" } },
        "Center XY",
      ),
      React.createElement(
        "button",
        { onClick: centerX, style: { whiteSpace: "nowrap" } },
        "Center X",
      ),
      React.createElement(
        "button",
        { onClick: centerY, style: { whiteSpace: "nowrap" } },
        "Center Y",
      ),
    ),
    React.createElement(
      "div",
      { className: "btn-row" },
      React.createElement(
        "button",
        { onClick: packColumn, style: { whiteSpace: "nowrap" } },
        "Pack 1 col",
      ),
      React.createElement(
        "button",
        { onClick: packTwoColumns, style: { whiteSpace: "nowrap" } },
        "Pack 2 col",
      ),
    ),
  );
}
function historySummary(s) {
  const parts = [
    `${s.components?.length ?? 0} comp`,
    `${s.artworks?.length ?? 0} img`,
    `${s.textItems?.length ?? 0} text`,
  ];
  return parts.join(" · ");
}
function SelectionSetsPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [sets, setSets] = useState([]);
  async function saveCurrentSelection() {
    if (!state.selected.length) return;
    const name = await appTextPrompt({
      title: "Save selection set",
      subtitle: "Keep a named shortcut to these components while editing.",
      label: "Set name",
      defaultValue: `Set ${sets.length + 1}`,
      confirmText: "Save set",
    });
    if (!name?.trim()) return;
    setSets((current) => [
      ...current.filter((item) => item.name !== name.trim()),
      { name: name.trim(), ids: [...state.selected] },
    ]);
  }
  function existingIds(set) {
    const available = new Set(
      state.components.map((component) => component.id),
    );
    return set.ids.filter((id) => available.has(id));
  }
  return React.createElement(
    "div",
    { className: "section selection-sets-panel" },
    React.createElement(
      "div",
      { className: "section-title" },
      "Selection sets",
    ),
    React.createElement(
      "button",
      {
        disabled: state.selected.length === 0,
        onClick: saveCurrentSelection,
      },
      `Save current selection (${state.selected.length})`,
    ),
    sets.length === 0
      ? React.createElement(
          "div",
          { className: "selection-set-empty" },
          "Named sets make repeated editing and locking faster.",
        )
      : React.createElement(
          "div",
          { className: "selection-set-list" },
          sets.map((set) => {
            const ids = existingIds(set);
            return React.createElement(
              "div",
              { className: "selection-set-row", key: set.name },
              React.createElement(
                "button",
                {
                  disabled: ids.length === 0,
                  onClick: () =>
                    dispatch({ type: "SELECT", ids, additive: false }),
                },
                set.name,
                React.createElement("small", null, ids.length),
              ),
              React.createElement(
                "button",
                {
                  disabled: ids.length === 0,
                  title: "Lock every component in this set",
                  onClick: () => {
                    dispatch({ type: "SELECT", ids, additive: false });
                    dispatch({ type: "LOCK_SELECTED", locked: true, ids });
                  },
                },
                "Lock",
              ),
              React.createElement(
                "button",
                {
                  className: "danger",
                  title: "Forget this selection set",
                  onClick: () =>
                    setSets((current) =>
                      current.filter((item) => item.name !== set.name),
                    ),
                },
                "×",
              ),
            );
          }),
        ),
  );
}
function describeHistoryChange(before, after) {
  const countChange = (key, label) => {
    const delta = (after[key]?.length || 0) - (before[key]?.length || 0);
    if (!delta) return null;
    return `${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} ${label}${Math.abs(delta) === 1 ? "" : "s"}`;
  };
  const collectionChange =
    countChange("components", "component") ||
    countChange("artworks", "artwork") ||
    countChange("textItems", "label");
  if (collectionChange) return collectionChange;
  if (before.panel?.widthHP !== after.panel?.widthHP)
    return "Changed panel width";

  const beforeById = new Map(
    (before.components || []).map((component) => [component.id, component]),
  );
  const changed = (after.components || []).filter((component) => {
    const previous = beforeById.get(component.id);
    return previous && JSON.stringify(previous) !== JSON.stringify(component);
  });
  if (changed.length) {
    const everyChanged = (keys) =>
      changed.every((component) => {
        const previous = beforeById.get(component.id);
        return keys.some((key) => previous[key] !== component[key]);
      });
    const suffix = changed.length === 1 ? "component" : "components";
    if (everyChanged(["x", "y"])) return `Moved ${changed.length} ${suffix}`;
    if (everyChanged(["rotation"]))
      return `Rotated ${changed.length} ${suffix}`;
    if (everyChanged(["locked"]))
      return `Changed lock on ${changed.length} ${suffix}`;
    if (everyChanged(["groupId"]))
      return `Changed group for ${changed.length} ${suffix}`;
    if (
      everyChanged([
        "holeDiameter",
        "frontDiameter",
        "frontW",
        "frontH",
        "frontWidth",
        "frontHeight",
        "rearBodyW",
        "rearBodyH",
        "rearDepth",
        "keepoutW",
        "keepoutH",
      ])
    )
      return `Edited dimensions of ${changed.length} ${suffix}`;
    return `Edited ${changed.length} ${suffix}`;
  }
  if (JSON.stringify(before.artworks) !== JSON.stringify(after.artworks))
    return "Edited artwork";
  if (JSON.stringify(before.textItems) !== JSON.stringify(after.textItems))
    return "Edited labels";
  return "Changed project settings";
}
function UndoHistoryPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(true);
  const latest = [...state.history]
    .map((snap, idx) => ({ snap, idx }))
    .reverse()
    .slice(0, 12);
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement(
      "div",
      { className: "section-title" },
      React.createElement("span", null, "Undo History"),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Undo steps"),
      React.createElement("span", null, state.history.length),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Redo steps"),
      React.createElement("span", null, state.future.length),
    ),
    React.createElement(
      "div",
      { className: "btn-row", style: { marginTop: 6 } },
      React.createElement(
        "button",
        {
          disabled: state.history.length === 0,
          onClick: () => dispatch({ type: "UNDO" }),
        },
        "Undo",
      ),
      React.createElement(
        "button",
        {
          disabled: state.future.length === 0,
          onClick: () => dispatch({ type: "REDO" }),
        },
        "Redo",
      ),
      React.createElement(
        "button",
        {
          disabled: state.history.length === 0 && state.future.length === 0,
          onClick: () => dispatch({ type: "CLEAR_HISTORY" }),
        },
        "Clear",
      ),
    ),
    open &&
      React.createElement(
        "div",
        {
          style: {
            marginTop: 8,
            maxHeight: 170,
            overflow: "auto",
            fontSize: 10,
            lineHeight: 1.35,
          },
        },
        latest.length === 0
          ? React.createElement(
              "div",
              { style: { color: "#666" } },
              "No undo states yet.",
            )
          : latest.map((h, i) => {
              const after = i === 0 ? state : latest[i - 1].snap;
              return React.createElement(
                "div",
                {
                  key: h.idx,
                  className: "history-entry",
                },
                React.createElement(
                  "div",
                  null,
                  React.createElement(
                    "div",
                    { className: "history-entry-title" },
                    describeHistoryChange(h.snap, after),
                  ),
                  React.createElement(
                    "div",
                    { className: "history-entry-summary" },
                    historySummary(h.snap),
                  ),
                ),
                React.createElement(
                  "button",
                  {
                    title: "Restore this history state",
                    onClick: () =>
                      dispatch({ type: "RESTORE_HISTORY_INDEX", index: h.idx }),
                  },
                  "Go",
                ),
              );
            }),
      ),
  );
}
function MeasurementsPanel() {
  const state = useAppState();
  const widthMM = panelWidthMM(state.panel);
  const selComps = state.components.filter((c) =>
    state.selected.includes(c.id),
  );
  const maxDepth = computeMaxDepth(state.components);
  const artworkBytes = state.artworks.reduce(
    (sum, a) => sum + a.imageDataUrl.length,
    0,
  );
  const artworkKB = artworkBytes / 1024;
  const estimatedJSONKB = artworkKB + state.components.length * 0.5 + 2;
  const jsonWarning = estimatedJSONKB > 5120;
  const rows = [
    ["Panel width", `${widthMM.toFixed(2)} mm`],
    ["Panel height", `${PANEL_HEIGHT_MM} mm`],
    ["Max rear depth", maxDepth > 0 ? `${maxDepth.toFixed(1)} mm` : "—"],
    ["Components", String(state.components.length)],
    ["Artworks", String(state.artworks.length)],
    [
      "Artwork size",
      artworkKB > 1024
        ? `${(artworkKB / 1024).toFixed(1)} MB`
        : `${artworkKB.toFixed(0)} KB`,
    ],
  ];
  if (selComps.length === 1) {
    const c = selComps[0];
    rows.push(
      ["Selected X", `${c.x.toFixed(2)} mm`],
      ["Selected Y", `${c.y.toFixed(2)} mm`],
      ["Rear depth", `${c.rearDepth.toFixed(1)} mm`],
      ["Hole Ø", `${c.holeDiameter.toFixed(1)} mm`],
    );
  }
  if (selComps.length === 2) {
    const [a, b] = selComps;
    rows.push(
      ["Center dist", `${distanceBetween(a, b).toFixed(2)} mm`],
      ["Edge gap", `${edgeClearance(a, b).toFixed(2)} mm`],
    );
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement("div", { className: "section-title" }, "Measurements"),
    rows.map(([k, v]) =>
      React.createElement(
        "div",
        { key: k, className: "measurement-row" },
        React.createElement("span", null, k),
        React.createElement("span", null, v),
      ),
    ),
    jsonWarning &&
      React.createElement(
        "div",
        {
          className: "warning-item warn",
          style: { marginTop: 6, fontSize: 10 },
        },
        "Estimated JSON export >5 MB. Consider downscaling images.",
      ),
  );
}
function AlignTools() {
  const dispatch = useAppDispatch();
  const state = useAppState();
  const selCount = state.selected.length;
  const [spacing, setSpacing] = useState(10);
  const [dupCount, setDupCount] = useState(1);
  const selected = state.components.filter((c) =>
    state.selected.includes(c.id),
  );
  const widthMM = panelWidthMM(state.panel);
  function centerSelected(axis) {
    if (!selected.length) return;
    const ex = selected.map(getFrontExtents);
    const minX = Math.min(...ex.map((e) => e.x1)),
      maxX = Math.max(...ex.map((e) => e.x2));
    const minY = Math.min(...ex.map((e) => e.y1)),
      maxY = Math.max(...ex.map((e) => e.y2));
    const dx = axis === "y" ? 0 : widthMM / 2 - (minX + maxX) / 2;
    const dy = axis === "x" ? 0 : PANEL_HEIGHT_MM / 2 - (minY + maxY) / 2;
    dispatch({
      type: "MOVE_COMPONENTS",
      moves: selected.map((c) => ({ id: c.id, x: c.x + dx, y: c.y + dy })),
    });
  }
  function makeStereoPair() {
    if (selected.length !== 1) return;
    const c = selected[0];
    const clone = {
      ...c,
      id: crypto.randomUUID(),
      ref: nextRefForComponent(c.type, state.components),
      label: c.label && !/[LR]$/i.test(c.label) ? `${c.label} R` : c.label,
      x: Math.min(widthMM - 2, c.x + spacing),
    };
    dispatch({
      type: "ADD_COMPONENTS",
      components: [clone],
      selectedIds: [c.id, clone.id],
    });
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement("div", { className: "section-title" }, "Layout tools"),
    React.createElement(
      "div",
      { className: "layout-tools-note" },
      selCount,
      " selected \u00B7 align uses visible front bounds",
    ),
    React.createElement(
      "div",
      { className: "layout-tools-subtitle" },
      "Align edges / centers",
    ),
    React.createElement(
      "div",
      { className: "layout-tools-grid" },
      React.createElement(
        "button",
        {
          disabled: selCount < 2,
          onClick: () => dispatch({ type: "ALIGN", axis: "left" }),
        },
        "Left",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 2,
          onClick: () => dispatch({ type: "ALIGN", axis: "centerV" }),
        },
        "Center X",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 2,
          onClick: () => dispatch({ type: "ALIGN", axis: "right" }),
        },
        "Right",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 2,
          onClick: () => dispatch({ type: "ALIGN", axis: "top" }),
        },
        "Top",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 2,
          onClick: () => dispatch({ type: "ALIGN", axis: "centerH" }),
        },
        "Center Y",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 2,
          onClick: () => dispatch({ type: "ALIGN", axis: "bottom" }),
        },
        "Bottom",
      ),
    ),
    React.createElement(
      "div",
      { className: "layout-tools-subtitle" },
      "Center in panel",
    ),
    React.createElement(
      "div",
      { className: "layout-tools-grid three" },
      React.createElement(
        "button",
        { disabled: selCount < 1, onClick: () => centerSelected("x") },
        "Panel X",
      ),
      React.createElement(
        "button",
        { disabled: selCount < 1, onClick: () => centerSelected("y") },
        "Panel Y",
      ),
      React.createElement(
        "button",
        { disabled: selCount < 1, onClick: () => centerSelected("both") },
        "Both",
      ),
    ),
    React.createElement(
      "div",
      { className: "layout-tools-subtitle" },
      "Distribute / spacing",
    ),
    React.createElement(
      "div",
      { className: "layout-tools-grid two" },
      React.createElement(
        "button",
        {
          disabled: selCount < 3,
          onClick: () => dispatch({ type: "DISTRIBUTE", axis: "h" }),
        },
        "Distribute H",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 3,
          onClick: () => dispatch({ type: "DISTRIBUTE", axis: "v" }),
        },
        "Distribute V",
      ),
    ),
    React.createElement(
      "div",
      { className: "field-pair compact" },
      React.createElement(NumField, {
        label: "Spacing mm",
        value: spacing,
        min: 0,
        step: 0.5,
        onChange: setSpacing,
      }),
      React.createElement(NumField, {
        label: "Copies",
        value: dupCount,
        min: 1,
        step: 1,
        onChange: (v) => setDupCount(Math.max(1, Math.round(v))),
      }),
    ),
    React.createElement(
      "div",
      { className: "layout-tools-grid two" },
      React.createElement(
        "button",
        {
          disabled: selCount < 2,
          onClick: () =>
            dispatch({ type: "SET_SELECTED_SPACING", axis: "h", spacing }),
        },
        "Set H spacing",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 2,
          onClick: () =>
            dispatch({ type: "SET_SELECTED_SPACING", axis: "v", spacing }),
        },
        "Set V spacing",
      ),
    ),
    React.createElement(
      "div",
      { className: "layout-tools-subtitle" },
      "Duplicate pattern",
    ),
    React.createElement(
      "div",
      { className: "layout-tools-grid two" },
      React.createElement(
        "button",
        {
          disabled: selCount < 1,
          onClick: () =>
            dispatch({
              type: "DUPLICATE_SELECTED_PATTERN",
              axis: "h",
              spacing,
              count: dupCount,
            }),
        },
        "Duplicate \u2192",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 1,
          onClick: () =>
            dispatch({
              type: "DUPLICATE_SELECTED_PATTERN",
              axis: "v",
              spacing,
              count: dupCount,
            }),
        },
        "Duplicate \u2193",
      ),
    ),
    React.createElement(
      "div",
      { className: "layout-tools-subtitle" },
      "Mirror",
    ),
    React.createElement(
      "div",
      { className: "layout-tools-grid two" },
      React.createElement(
        "button",
        {
          disabled: selCount < 1,
          onClick: () =>
            dispatch({
              type: "MIRROR_SELECTED",
              axis: "x",
              around: "selection",
            }),
        },
        "Mirror X / selection",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 1,
          onClick: () =>
            dispatch({ type: "MIRROR_SELECTED", axis: "x", around: "panel" }),
        },
        "Mirror X / panel",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 1,
          onClick: () =>
            dispatch({
              type: "MIRROR_SELECTED",
              axis: "y",
              around: "selection",
            }),
        },
        "Mirror Y / selection",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 1,
          onClick: () =>
            dispatch({ type: "MIRROR_SELECTED", axis: "y", around: "panel" }),
        },
        "Mirror Y / panel",
      ),
    ),
    React.createElement(
      "div",
      { className: "layout-tools-subtitle" },
      "Eurorack helpers",
    ),
    React.createElement(
      "div",
      { className: "layout-tools-grid two" },
      React.createElement(
        "button",
        { disabled: selCount !== 1, onClick: makeStereoPair },
        "Make stereo pair \u2192",
      ),
      React.createElement(
        "button",
        {
          disabled: selCount < 1,
          onClick: () => dispatch({ type: "ROTATE_SELECTED", degrees: 90 }),
        },
        "Rotate +90\u00B0",
      ),
    ),
  );
}
