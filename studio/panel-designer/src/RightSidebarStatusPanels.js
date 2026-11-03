// Right sidebar panel components extracted from core.js.
// Globals are loaded by index.html; keep these files script-friendly, not ES modules.

// Status, warnings, and self-check panels.

function buildSelfCheckItems(state, warnings) {
  const items = [];
  const ids = new Set(state.components.map((c) => c.id));
  const hard = warnings.filter((w) => w.severity === "error").length;
  const warn = warnings.filter((w) => w.severity === "warn").length;
  if (hard > 0)
    items.push({
      level: "error",
      message: `${hard} hard error(s) in layout warnings.`,
    });
  if (warn > 0)
    items.push({
      level: "warn",
      message: `${warn} warning(s) in layout warnings.`,
    });
  const badDims = state.components.filter(
    (c) =>
      !isFinite(c.x) ||
      !isFinite(c.y) ||
      c.holeDiameter <= 0 ||
      c.rearBodyW < 0 ||
      c.rearBodyH < 0 ||
      c.keepoutW < 0 ||
      c.keepoutH < 0,
  );
  if (badDims.length)
    items.push({
      level: "error",
      message: `${badDims.length} component(s) have invalid coordinates or dimensions.`,
    });
  const unverified = state.components.filter(
    (c) => (c.verificationStatus || "approximate") === "approximate",
  ).length;
  if (unverified)
    items.push({
      level: "warn",
      message: `${unverified} part(s) are still marked Approximate.`,
    });
  const orphanScales = state.scaleItems.filter(
    (sc) => sc.componentId && !ids.has(sc.componentId),
  ).length;
  if (orphanScales)
    items.push({
      level: "warn",
      message: `${orphanScales} scale item(s) are attached to missing components.`,
    });
  const orphanText = state.textItems.filter(
    (t) => t.componentId && !ids.has(t.componentId),
  ).length;
  if (orphanText)
    items.push({
      level: "warn",
      message: `${orphanText} text label(s) are attached to missing components.`,
    });
  const duplicateRefs = Array.from(
    new Set(
      state.components
        .map((c) => c.ref)
        .filter(
          (ref) =>
            ref && state.components.filter((cc) => cc.ref === ref).length > 1,
        ),
    ),
  );
  if (duplicateRefs.length)
    items.push({
      level: "warn",
      message: `Duplicate refs: ${duplicateRefs.join(", ")}.`,
    });
  if (!items.length)
    items.push({
      level: "ok",
      message: "Self-check passed: no obvious data issues found.",
    });
  return items;
}
function SelfCheckPanel({ warnings }) {
  const state = useAppState();
  const items = buildSelfCheckItems(state, warnings);
  const errors = items.filter((i) => i.level === "error").length;
  const warns = items.filter((i) => i.level === "warn").length;
  function copySelfCheck() {
    const text = [
      "Self Check",
      `Errors: ${errors}`,
      `Warnings: ${warns}`,
      "",
      ...items.map((i) => `[${i.level.toUpperCase()}] ${i.message}`),
    ].join("\n");
    navigator.clipboard?.writeText(text);
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement("div", { className: "section-title" }, "Self Check"),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Status"),
      React.createElement(
        "span",
        null,
        errors ? "ERROR" : warns ? "WARN" : "OK",
      ),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Errors"),
      React.createElement("span", null, errors),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Warnings"),
      React.createElement("span", null, warns),
    ),
    React.createElement(
      "div",
      { style: { marginTop: 6 } },
      items.slice(0, 10).map((item, i) =>
        React.createElement(
          "div",
          {
            key: i,
            className: `warning-item ${item.level === "error" ? "" : "warn"}`,
            style:
              item.level === "ok"
                ? {
                    color: "var(--ui-success)",
                    borderColor: "rgba(var(--ui-success-rgb), .35)",
                    background: "rgba(var(--ui-success-rgb), .08)",
                  }
                : undefined,
          },
          item.message,
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "btn-row", style: { marginTop: 8 } },
      React.createElement(
        "button",
        { style: { flex: 1 }, onClick: copySelfCheck },
        "Copy self-check",
      ),
    ),
  );
}
function WarningsPanel({ warnings }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [pendingFix, setPendingFix] = useState(null);
  const componentIds = new Set(
    state.components.map((component) => component.id),
  );
  useEffect(() => setPendingFix(null), [state.components]);
  function focusComponents(ids, inspect = false) {
    window.dispatchEvent(
      new CustomEvent("panel-designer:focus-components", {
        detail: { ids, inspect },
      }),
    );
  }
  if (warnings.length === 0) {
    return React.createElement(
      "div",
      { className: "section" },
      React.createElement("div", { className: "section-title" }, "Warnings"),
      React.createElement(
        "div",
        { style: { color: "var(--ui-success)", fontSize: 11 } },
        "\u2713 No collisions detected",
      ),
    );
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement(
      "div",
      { className: "section-title" },
      "Warnings (",
      warnings.length,
      ")",
    ),
    warnings.map((w, i) => {
      const ids = (w.ids || []).filter((id) => componentIds.has(id));
      const fixKey = `${i}:${ids.join(":")}`;
      const preview = pendingFix?.key === fixKey ? pendingFix.suggestion : null;
      return React.createElement(
        "div",
        {
          key: i,
          className: `warning-item${w.severity === "warn" ? " warn" : ""}${w.tone ? " pcb-" + w.tone : ""}`,
        },
        React.createElement("span", null, w.message),
        ids.length > 0 &&
          React.createElement(
            "span",
            { className: "warning-actions" },
            React.createElement(
              "button",
              {
                onClick: () => focusComponents(ids),
              },
              "Focus",
            ),
            React.createElement(
              "button",
              {
                onClick: () => focusComponents(ids, true),
              },
              "Properties",
            ),
            ids.length === 2 &&
              React.createElement(
                "button",
                {
                  onClick: () => {
                    const suggestion = suggestClearanceResolution(
                      state.components,
                      panelWidthMM(state.panel),
                      state.mountingHoles,
                      state.pcb,
                      ids,
                    );
                    setPendingFix({ key: fixKey, suggestion });
                    focusComponents(ids);
                  },
                },
                "Preview fix",
              ),
          ),
        pendingFix?.key === fixKey &&
          React.createElement(
            "div",
            { className: "warning-fix-preview" },
            preview
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    "span",
                    null,
                    `Move by Δx ${preview.dx.toFixed(1)} / Δy ${preview.dy.toFixed(1)} mm`,
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () =>
                        dispatch({
                          type: "RESOLVE_COMPONENT_CLEARANCE",
                          ids,
                          position: preview,
                        }),
                    },
                    `Apply · ${Math.max(1, preview.resolvedWarnings)} resolved`,
                  ),
                )
              : React.createElement(
                  "span",
                  null,
                  "No safer free position was found on this panel.",
                ),
            React.createElement(
              "button",
              { onClick: () => setPendingFix(null) },
              "Cancel",
            ),
          ),
      );
    }),
  );
}
function LayoutStatusPanel({ warnings, components }) {
  const errors = warnings.filter((w) => w.severity === "error").length;
  const warns = warnings.filter((w) => w.severity === "warn").length;
  let minFrontClear = Infinity;
  let minKOClear = Infinity;
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i],
        b = components[j];
      const fc = edgeClearance(a, b);
      if (fc < minFrontClear) minFrontClear = fc;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const aR = Math.hypot(a.keepoutW / 2, a.keepoutH / 2);
      const bR = Math.hypot(b.keepoutW / 2, b.keepoutH / 2);
      const kc = dist - aR - bR;
      if (kc < minKOClear) minKOClear = kc;
    }
  }
  const maxDepth = computeMaxDepth(components);
  const status = errors > 0 ? "Collision" : warns > 0 ? "Warning" : "OK";
  const statusColor =
    errors > 0
      ? "var(--ui-danger)"
      : warns > 0
        ? "var(--ui-warn)"
        : "var(--ui-success)";
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement(
      "div",
      {
        className: "section-title",
        style: { display: "flex", justifyContent: "space-between" },
      },
      React.createElement("span", null, "Layout Status"),
      React.createElement(
        "span",
        { style: { color: statusColor, fontWeight: 700 } },
        status,
      ),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Hard collisions"),
      React.createElement(
        "span",
        {
          style: {
            color: errors > 0 ? "var(--ui-danger)" : "var(--ui-success)",
          },
        },
        errors,
      ),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Warnings"),
      React.createElement(
        "span",
        {
          style: { color: warns > 0 ? "var(--ui-warn)" : "var(--ui-success)" },
        },
        warns,
      ),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Min front clearance"),
      React.createElement(
        "span",
        null,
        components.length >= 2 ? `${minFrontClear.toFixed(1)} mm` : "—",
      ),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Min KO clearance"),
      React.createElement(
        "span",
        null,
        components.length >= 2 ? `${minKOClear.toFixed(1)} mm` : "—",
      ),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Max rear depth"),
      React.createElement(
        "span",
        null,
        maxDepth > 0 ? `${maxDepth.toFixed(1)} mm` : "—",
      ),
    ),
  );
}
