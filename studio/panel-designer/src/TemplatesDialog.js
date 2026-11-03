// Extracted component declarations from index.html.
// TemplateRealisticPreview
function TemplateRealisticPreview({ record }) {
  const template = useMemo(() => {
    try {
      return normalizeTemplate(JSON.parse(record.data));
    } catch {
      return null;
    }
  }, [record.data]);
  if (!template)
    return React.createElement(
      "div",
      { className: "template-preview-realistic template-preview-empty" },
      "Bad template",
    );
  const width = Math.max(
    HP_TO_MM * Math.max(1, template.hp || record.hp || 8),
    10,
  );
  const height = PANEL_HEIGHT_MM;
  const pad = 6;
  const comps = template.components || [];
  const mounting = template.mountingHoles
    ? normalizeMountingHoleConfig(template.mountingHoles, width)
    : defaultMountingHoleConfig(width);
  function hole(c) {
    if (isDip8Socket(c)) {
      return React.createElement(
        "g",
        { key: `${c.id}-holes` },
        dip8SocketHoleCenters(c).map((p, i) =>
          React.createElement("circle", {
            key: i,
            cx: p.x,
            cy: p.y,
            r: c.holeDiameter / 2,
            fill: "#050607",
            stroke: "rgba(210,225,230,.48)",
            strokeWidth: ".18",
          }),
        ),
      );
    }
    if (c.holeType === "slot") {
      const sl = c.slotLength ?? c.holeDiameter;
      return React.createElement(
        "g",
        {
          key: `${c.id}-hole`,
          transform: `rotate(${c.rotation || 0}, ${c.x}, ${c.y})`,
        },
        React.createElement("rect", {
          x: c.x - c.holeDiameter / 2,
          y: c.y - sl / 2,
          width: c.holeDiameter,
          height: sl,
          rx: c.holeDiameter / 2,
          fill: "#050607",
          stroke: "rgba(210,225,230,.48)",
          strokeWidth: ".18",
        }),
      );
    }
    if (c.holeType === "rect") {
      const w = c.holeW ?? c.frontW ?? c.holeDiameter;
      const h = c.holeH ?? c.frontH ?? c.holeDiameter;
      return React.createElement(
        "g",
        {
          key: `${c.id}-hole`,
          transform: `rotate(${c.rotation || 0}, ${c.x}, ${c.y})`,
        },
        React.createElement("rect", {
          x: c.x - w / 2,
          y: c.y - h / 2,
          width: w,
          height: h,
          rx: ".35",
          fill: "#050607",
          stroke: "rgba(210,225,230,.48)",
          strokeWidth: ".18",
        }),
      );
    }
    return React.createElement("circle", {
      key: `${c.id}-hole`,
      cx: c.x,
      cy: c.y,
      r: c.holeDiameter / 2,
      fill: "#050607",
      stroke: "rgba(210,225,230,.48)",
      strokeWidth: ".18",
    });
  }
  function hardware(c) {
    const cx = c.x,
      cy = c.y;
    const rot = `rotate(${c.rotation || 0}, ${cx}, ${cy})`;
    const color = topColor(c);
    if (isDip8Socket(c)) {
      const b = dip8SocketBodyBounds();
      return React.createElement(
        "g",
        { key: `${c.id}-hw`, transform: rot },
        React.createElement("rect", {
          x: cx - b.w / 2,
          y: cy - b.h / 2,
          width: b.w,
          height: b.h,
          rx: ".45",
          fill: "#090a0c",
          stroke: "rgba(220,230,235,.38)",
          strokeWidth: ".14",
        }),
        React.createElement("rect", {
          x: cx - b.w * 0.28,
          y: cy - b.h * 0.28,
          width: b.w * 0.56,
          height: b.h * 0.56,
          rx: ".10",
          fill: "#050607",
          stroke: "rgba(255,255,255,.08)",
          strokeWidth: ".08",
        }),
        React.createElement("path", {
          d: `M ${cx - 1.3} ${cy - b.h / 2} A 1.3 1.3 0 0 0 ${cx + 1.3} ${cy - b.h / 2}`,
          fill: "none",
          stroke: "rgba(220,230,235,.55)",
          strokeWidth: ".18",
        }),
        dip8SocketHoleCenters(c).map((p, i) =>
          React.createElement("circle", {
            key: i,
            cx: p.x,
            cy: p.y,
            r: ".36",
            fill: "#b8b0a0",
            stroke: "#2d261f",
            strokeWidth: ".08",
          }),
        ),
      );
    }
    if (isPotLike(c)) {
      const d = c.knobDiameter || Math.max(c.frontDiameter, 10);
      return React.createElement(
        "g",
        { key: `${c.id}-hw` },
        React.createElement("circle", {
          cx: cx,
          cy: cy,
          r: d / 2,
          fill: "#151515",
          stroke: "rgba(255,255,255,.12)",
          strokeWidth: ".32",
        }),
        React.createElement("circle", {
          cx: cx,
          cy: cy,
          r: d * 0.38,
          fill: color,
          stroke: "rgba(0,0,0,.75)",
          strokeWidth: ".22",
        }),
        React.createElement("line", {
          x1: cx,
          y1: cy,
          x2: cx,
          y2: cy - d * 0.32,
          stroke: "rgba(255,255,255,.72)",
          strokeWidth: ".32",
          strokeLinecap: "round",
        }),
      );
    }
    if (isFaderLike(c)) {
      const b = getFrontBounds(c);
      return React.createElement(
        "g",
        { key: `${c.id}-hw`, transform: rot },
        React.createElement("rect", {
          x: cx - b.w / 2,
          y: cy - b.h / 2,
          width: b.w,
          height: b.h,
          rx: b.w / 2,
          fill: "#070809",
          stroke: "rgba(201,154,74,.70)",
          strokeWidth: ".35",
        }),
        React.createElement("rect", {
          x: cx - 1.3,
          y: cy - b.h * 0.38,
          width: "2.6",
          height: b.h * 0.76,
          rx: "1.2",
          fill: "#0f1113",
          stroke: "rgba(255,255,255,.26)",
          strokeWidth: ".16",
        }),
        React.createElement("rect", {
          x: cx - 2.9,
          y: cy - 2.2,
          width: "5.8",
          height: "4.4",
          rx: "1.2",
          fill: c.type === "fader20led" ? "#ff4141" : "#d5d5d2",
          stroke: "rgba(0,0,0,.65)",
          strokeWidth: ".18",
        }),
      );
    }
    if (isJackLike(c)) {
      const r = Math.max(c.frontDiameter / 2, 4);
      return React.createElement(
        "g",
        { key: `${c.id}-hw` },
        React.createElement("circle", {
          cx: cx,
          cy: cy,
          r: r,
          fill: "#13171a",
          stroke: "rgba(255,255,255,.30)",
          strokeWidth: ".28",
        }),
        React.createElement("circle", {
          cx: cx,
          cy: cy,
          r: r * 0.58,
          fill: "#020304",
          stroke: "rgba(201,154,74,.28)",
          strokeWidth: ".16",
        }),
      );
    }
    if (isLedLike(c)) {
      return React.createElement(
        "g",
        { key: `${c.id}-hw` },
        React.createElement("circle", {
          cx: cx,
          cy: cy,
          r: Math.max(1.7, c.frontDiameter / 2),
          fill: color || "#ff4141",
          stroke: "rgba(255,255,255,.55)",
          strokeWidth: ".16",
        }),
        React.createElement("circle", {
          cx: cx - 0.55,
          cy: cy - 0.65,
          r: ".55",
          fill: "rgba(255,255,255,.55)",
        }),
      );
    }
    if (isButtonLike(c)) {
      const r = visualButtonRadius(c);
      return React.createElement(
        "g",
        { key: `${c.id}-hw` },
        React.createElement("circle", {
          cx: cx,
          cy: cy,
          r: r * 1.1,
          fill: "#202428",
          stroke: "rgba(255,255,255,.28)",
          strokeWidth: ".16",
        }),
        React.createElement("circle", {
          cx: cx,
          cy: cy,
          r: r * 0.82,
          fill: color || "#aaa",
          stroke: "rgba(0,0,0,.55)",
          strokeWidth: ".12",
        }),
      );
    }
    const b = getFrontBounds(c);
    if (getFrontShape(c) !== "circle")
      return React.createElement(
        "g",
        { key: `${c.id}-hw`, transform: rot },
        React.createElement("rect", {
          x: cx - b.w / 2,
          y: cy - b.h / 2,
          width: b.w,
          height: b.h,
          rx: ".6",
          fill: "#141719",
          stroke: "rgba(185,246,255,.36)",
          strokeWidth: ".18",
        }),
      );
    return React.createElement("circle", {
      key: `${c.id}-hw`,
      cx: cx,
      cy: cy,
      r: Math.max(1.8, c.frontDiameter / 2),
      fill: "#1b1e21",
      stroke: "rgba(185,246,255,.35)",
      strokeWidth: ".18",
    });
  }
  return React.createElement(
    "div",
    { className: "template-preview-realistic" },
    React.createElement(
      "svg",
      {
        viewBox: `${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`,
        preserveAspectRatio: "xMidYMid meet",
        "aria-label": `${template.name} preview`,
      },
      React.createElement(
        "defs",
        null,
        React.createElement(
          "pattern",
          {
            id: `tp-grid-${record.id}`,
            width: "5",
            height: "5",
            patternUnits: "userSpaceOnUse",
          },
          React.createElement("path", {
            d: "M 5 0 L 0 0 0 5",
            fill: "none",
            stroke: "rgba(255,255,255,.12)",
            strokeWidth: ".12",
          }),
        ),
        React.createElement(
          "radialGradient",
          { id: `tp-led-${record.id}`, cx: "35%", cy: "30%", r: "70%" },
          React.createElement("stop", {
            offset: "0",
            stopColor: "#fff",
            stopOpacity: ".75",
          }),
          React.createElement("stop", { offset: ".35", stopColor: "#ff5a5a" }),
          React.createElement("stop", { offset: "1", stopColor: "#7b1111" }),
        ),
      ),
      React.createElement("rect", {
        x: "0",
        y: "0",
        width: width,
        height: height,
        rx: ".8",
        fill: "#2b3034",
        stroke: "rgba(235,245,248,.72)",
        strokeWidth: ".55",
      }),
      React.createElement("rect", {
        x: "1.2",
        y: "1.2",
        width: width - 2.4,
        height: height - 2.4,
        rx: ".55",
        fill: `url(#tp-grid-${record.id})`,
        opacity: ".52",
      }),
      React.createElement("line", {
        x1: width / 2,
        y1: "0",
        x2: width / 2,
        y2: height,
        stroke: "rgba(201,154,74,.48)",
        strokeWidth: ".22",
        strokeDasharray: "1.5 1.3",
      }),
      React.createElement("line", {
        x1: "0",
        y1: height / 2,
        x2: width,
        y2: height / 2,
        stroke: "rgba(201,154,74,.34)",
        strokeWidth: ".18",
        strokeDasharray: "1.5 1.3",
      }),
      mounting.enabled &&
        mounting.holes.map((h, i) =>
          mounting.holeShape === "oval"
            ? React.createElement("rect", {
                key: i,
                x:
                  h.x -
                  Math.max(
                    mounting.ovalLength ?? 4.8,
                    MOUNTING_HOLE_DIAMETER_MM,
                  ) /
                    2,
                y: h.y - MOUNTING_HOLE_DIAMETER_MM / 2,
                width: Math.max(
                  mounting.ovalLength ?? 4.8,
                  MOUNTING_HOLE_DIAMETER_MM,
                ),
                height: MOUNTING_HOLE_DIAMETER_MM,
                rx: MOUNTING_HOLE_DIAMETER_MM / 2,
                fill: "#050607",
                stroke: "rgba(235,245,248,.66)",
                strokeWidth: ".2",
              })
            : React.createElement("circle", {
                key: i,
                cx: h.x,
                cy: h.y,
                r: MOUNTING_HOLE_DIAMETER_MM / 2,
                fill: "#050607",
                stroke: "rgba(235,245,248,.66)",
                strokeWidth: ".2",
              }),
        ),
      comps.map(hole),
      comps.map(hardware),
      template.textItems?.slice(0, 24).map((t) =>
        React.createElement(
          "text",
          {
            key: t.id,
            x: t.x,
            y: t.y,
            fontSize: Math.max(1.4, (t.fontSize || 3) * 0.55),
            textAnchor: t.align || "middle",
            fill: t.color || "#dcecf1",
            opacity: ".75",
          },
          t.text,
        ),
      ),
    ),
  );
}

// TemplatesDialog
function TemplatesDialog({ onClose, onPlaceBlock }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [templates, setTemplates] = useState(() => editableTemplateRecords());
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateKind, setTemplateKind] = useState("all");
  const [templateSource, setTemplateSource] = useState("all");
  const [templateEditTarget, setTemplateEditTarget] = useState(null);
  const [templateEditName, setTemplateEditName] = useState("");
  const [templateEditDescription, setTemplateEditDescription] = useState("");
  const [templateEditReplaceContent, setTemplateEditReplaceContent] =
    useState(false);
  const [templateDeleteTarget, setTemplateDeleteTarget] = useState(null);
  const [templateLoadPending, setTemplateLoadPending] = useState(null);
  const visibleTemplates = templates.filter((t) => {
    const q = templateSearch.trim().toLowerCase();
    const matchesKind = templateKind === "all" || t.kind === templateKind;
    const matchesSource =
      templateSource === "all" ||
      (templateSource === "factory" ? !!t.factory : !t.factory);
    const hay =
      `${t.name} ${t.description} ${t.kind} ${t.hp}HP ${t.factory ? "preset factory built-in" : "local saved"}`.toLowerCase();
    return matchesKind && matchesSource && (!q || hay.includes(q));
  });
  function refresh() {
    setTemplates(editableTemplateRecords());
  }
  function loadTemplate(record) {
    const t = normalizeTemplate(JSON.parse(record.data));
    if (!t) {
      alert("Template is corrupted.");
      return;
    }
    const idMap = new Map();
    const comps = t.components.map((c) => {
      const oldId = c.id;
      const newId = crypto.randomUUID();
      if (oldId) idMap.set(oldId, newId);
      return { ...c, id: newId };
    });
    const remapAttachedTextItems = (items = []) =>
      items.map((x) => ({
        ...x,
        id: crypto.randomUUID(),
        componentId:
          x.componentId && idMap.has(x.componentId)
            ? idMap.get(x.componentId)
            : x.componentId || null,
      }));
    const remapScaleItems = (items = []) =>
      items
        .map((x) => ({
          ...x,
          id: crypto.randomUUID(),
          componentId:
            x.componentId && idMap.has(x.componentId)
              ? idMap.get(x.componentId)
              : x.componentId || null,
        }))
        .filter(
          (x) => !x.componentId || comps.some((c) => c.id === x.componentId),
        );
    if (t.kind === "block") {
      const dx = 3;
      const dy = 3;
      const newComps = comps.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
      dispatch({
        type: "ADD_COMPONENTS",
        components: newComps,
        selectedIds: newComps.map((c) => c.id),
      });
      onClose();
      return;
    }
    setTemplateLoadPending({
      template: t,
      components: comps,
      textItems: remapAttachedTextItems(t.textItems || []),
      scaleItems: remapScaleItems(t.scaleItems || []),
    });
  }
  function confirmTemplateLoad() {
    if (!templateLoadPending) return;
    const t = templateLoadPending.template;
    const base = snapshot(state);
    dispatch({
      type: "LOAD_STATE",
      state: {
        ...base,
        panel: {
          ...base.panel,
          widthHP: t.hp,
          customHP: !STANDARD_HP.includes(t.hp),
        },
        components: templateLoadPending.components,
        selected: [],
        selectedArtwork: null,
        selectedTexts: [],
        pcb: t.pcb
          ? { ...base.pcb, ...t.pcb }
          : { ...base.pcb, width: t.hp * HP_TO_MM },
        mountingHoles: t.mountingHoles
          ? normalizeMountingHoleConfig(t.mountingHoles, t.hp * HP_TO_MM)
          : base.mountingHoles,
        textItems: templateLoadPending.textItems,
        scaleItems: templateLoadPending.scaleItems,
        artworks: (t.artworks || []).map((x) => ({
          ...x,
          id: crypto.randomUUID(),
        })),
        customParts: [...base.customParts, ...(t.customParts || [])].map((p) =>
          sanitizePart(p),
        ),
      },
    });
    setTemplateLoadPending(null);
    onClose();
  }
  function editTemplate(record) {
    const current = normalizeTemplate(JSON.parse(record.data));
    if (!current) {
      alert("Template is corrupted.");
      return;
    }
    setTemplateEditTarget(record);
    setTemplateEditName(record.name);
    setTemplateEditDescription(record.description || "");
    setTemplateEditReplaceContent(false);
  }
  function confirmTemplateEdit() {
    if (!templateEditTarget) return;
    const name = templateEditName.trim();
    if (!name) return;
    const description = templateEditDescription.trim();
    const next = templateEditReplaceContent
      ? replaceTemplateContentFromState(
          templateEditTarget,
          state,
          name,
          description,
        )
      : updateTemplateMetadata(templateEditTarget, name, description);
    if (!next) {
      alert("Could not update template.");
      return;
    }
    unhideTemplate(templateEditTarget.id);
    saveTemplateToBrowser(next);
    setTemplateEditTarget(null);
    setTemplateEditName("");
    setTemplateEditDescription("");
    setTemplateEditReplaceContent(false);
    refresh();
  }
  function deleteTemplate(record) {
    setTemplateDeleteTarget(record);
  }
  function confirmTemplateDelete() {
    if (!templateDeleteTarget) return;
    if (templateDeleteTarget.factory || templateDeleteTarget.editedFactory) {
      hideTemplateEverywhere(templateDeleteTarget.id);
    } else {
      deleteLocalTemplate(templateDeleteTarget.id);
    }
    setTemplateDeleteTarget(null);
    refresh();
  }
  return ReactDOM.createPortal(
    React.createElement(
      "div",
      {
        className: "app-modal-backdrop template-manager-backdrop",
        onPointerDown: (e) => {
          if (e.target === e.currentTarget) onClose();
        },
      },
      React.createElement(
        "div",
        { className: "app-modal-panel template-manager-panel" },
        React.createElement(
          "div",
          { className: "app-modal-header" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "app-modal-title" },
              "Templates",
            ),
            React.createElement(
              "div",
              { className: "app-modal-subtitle" },
              "Bundled templates baked into this HTML. Panel templates replace the layout; block templates append reusable groups.",
            ),
          ),
          React.createElement(
            "div",
            { className: "btn-row" },
            React.createElement(
              "button",
              {
                onClick: () => {
                  importTemplatesLibraryFile(refresh);
                },
              },
              "Import",
            ),
            React.createElement(
              "button",
              { onClick: exportTemplatesLibrary },
              "Export",
            ),
            React.createElement("button", { onClick: onClose }, "Close"),
          ),
        ),
        React.createElement(
          "div",
          { className: "app-modal-body" },
          React.createElement(
            "div",
            { className: "filter-row" },
            React.createElement("input", {
              type: "text",
              placeholder: "Search templates / presets\u2026",
              value: templateSearch,
              onChange: (e) => setTemplateSearch(e.target.value),
            }),
            React.createElement(
              "select",
              {
                value: templateSource,
                onChange: (e) => setTemplateSource(e.target.value),
              },
              React.createElement("option", { value: "all" }, "All sources"),
              React.createElement(
                "option",
                { value: "factory" },
                "Bundled templates",
              ),
              React.createElement(
                "option",
                { value: "local" },
                "Local templates",
              ),
            ),
            React.createElement(
              "select",
              {
                value: templateKind,
                onChange: (e) => setTemplateKind(e.target.value),
              },
              React.createElement("option", { value: "all" }, "All kinds"),
              React.createElement("option", { value: "panel" }, "Panel"),
              React.createElement("option", { value: "block" }, "Block"),
            ),
          ),
          React.createElement(
            "div",
            { className: "template-preset-note" },
            "Saved templates: ",
            templates.filter((t) => t.local).length,
            " \u00B7 Default templates: ",
            templates.filter((t) => t.factory).length,
          ),
          templates.length === 0
            ? React.createElement(
                "div",
                { style: { color: "#888", fontSize: 13, padding: 12 } },
                "No bundled templates found. Try clearing hidden templates/site data or reloading this HTML.",
              )
            : visibleTemplates.length === 0
              ? React.createElement(
                  "div",
                  { style: { color: "#888", fontSize: 13, padding: 12 } },
                  "No templates match the filter.",
                )
              : visibleTemplates.map((t) =>
                  React.createElement(
                    "div",
                    { key: t.id, className: "template-card-realistic" },
                    React.createElement(TemplateRealisticPreview, {
                      record: t,
                    }),
                    React.createElement(
                      "div",
                      { className: "template-card-main" },
                      React.createElement(
                        "div",
                        { style: { minWidth: 0 } },
                        React.createElement(
                          "div",
                          {
                            style: {
                              fontWeight: 800,
                              color: "#edfaff",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            },
                          },
                          t.factory
                            ? "Template"
                            : t.editedFactory
                              ? "Edited"
                              : t.kind === "block"
                                ? "Block"
                                : "Panel",
                          " \u00B7 ",
                          t.name,
                          " ",
                          React.createElement(
                            "span",
                            { style: { color: "#7f929a", fontWeight: 500 } },
                            t.hp,
                            "HP",
                          ),
                        ),
                        t.description &&
                          React.createElement(
                            "div",
                            {
                              style: {
                                color: "#a8bac1",
                                fontSize: 12,
                                marginTop: 4,
                                lineHeight: 1.3,
                              },
                            },
                            t.description,
                          ),
                        React.createElement(
                          "div",
                          {
                            style: {
                              color: "#7f929a",
                              fontSize: 11,
                              marginTop: 5,
                            },
                          },
                          new Date(t.updatedAt).toLocaleString(),
                          " \u00B7 ",
                          (t.sizeBytes / 1024).toFixed(0),
                          " KB \u00B7 realistic preview",
                        ),
                      ),
                      React.createElement(
                        "div",
                        { className: "btn-row template-card-actions" },
                        React.createElement(
                          "button",
                          {
                            className: "primary",
                            onClick: () => loadTemplate(t),
                          },
                          t.kind === "block" ? "Insert" : "Load",
                        ),
                        t.kind === "block" &&
                          React.createElement(
                            "button",
                            {
                              title:
                                "Place this block with a ghost preview under the cursor/finger",
                              onClick: () => {
                                const tpl = normalizeTemplate(
                                  JSON.parse(t.data),
                                );
                                if (tpl) {
                                  onPlaceBlock(tpl);
                                  onClose();
                                }
                              },
                            },
                            "Place",
                          ),
                        React.createElement(
                          "button",
                          { onClick: () => editTemplate(t) },
                          "Edit",
                        ),
                        React.createElement(
                          "button",
                          {
                            className: "danger",
                            onClick: () => deleteTemplate(t),
                          },
                          "Delete",
                        ),
                      ),
                    ),
                  ),
                ),
        ),
        templateEditTarget &&
          React.createElement(
            "div",
            {
              className: "inline-modal-layer",
              onPointerDown: (e) => {
                if (e.target === e.currentTarget) setTemplateEditTarget(null);
              },
            },
            React.createElement(
              "div",
              { className: "inline-modal-card template-edit-modal" },
              React.createElement(
                "div",
                { className: "inline-modal-title" },
                "Edit template",
              ),
              React.createElement(
                "div",
                { className: "inline-modal-subtitle" },
                "Rename, edit notes, or replace the stored layout with the current panel.",
              ),
              React.createElement(
                "label",
                { className: "inline-field-label" },
                "Template name",
              ),
              React.createElement("input", {
                autoFocus: true,
                value: templateEditName,
                onChange: (e) => setTemplateEditName(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Escape") setTemplateEditTarget(null);
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    confirmTemplateEdit();
                },
              }),
              React.createElement(
                "label",
                { className: "inline-field-label" },
                "Description / notes",
              ),
              React.createElement("textarea", {
                value: templateEditDescription,
                onChange: (e) => setTemplateEditDescription(e.target.value),
                rows: 4,
              }),
              React.createElement(
                "label",
                { className: "inline-check-row" },
                React.createElement("input", {
                  type: "checkbox",
                  checked: templateEditReplaceContent,
                  onChange: (e) =>
                    setTemplateEditReplaceContent(e.target.checked),
                }),
                React.createElement(
                  "span",
                  null,
                  "Replace template content with current panel layout",
                ),
              ),
              React.createElement(
                "div",
                { className: "inline-modal-actions" },
                React.createElement(
                  "button",
                  { onClick: () => setTemplateEditTarget(null) },
                  "Cancel",
                ),
                React.createElement(
                  "button",
                  {
                    className: "primary",
                    onClick: confirmTemplateEdit,
                    disabled: !templateEditName.trim(),
                  },
                  "Save template",
                ),
              ),
            ),
          ),
        templateDeleteTarget &&
          React.createElement(
            "div",
            {
              className: "inline-modal-layer",
              onPointerDown: (e) => {
                if (e.target === e.currentTarget) setTemplateDeleteTarget(null);
              },
            },
            React.createElement(
              "div",
              { className: "inline-modal-card" },
              React.createElement(
                "div",
                { className: "inline-modal-title danger-title" },
                "Delete template",
              ),
              React.createElement(
                "div",
                { className: "inline-modal-subtitle" },
                templateDeleteTarget.factory ||
                  templateDeleteTarget.editedFactory
                  ? "This hides the bundled/edited template in this browser. It can be restored by clearing site data or re-importing templates."
                  : "This removes the local browser template.",
              ),
              React.createElement(
                "div",
                { className: "delete-confirm-name" },
                "\u201C",
                templateDeleteTarget.name,
                "\u201D \u00B7 ",
                templateDeleteTarget.hp,
                "HP",
              ),
              React.createElement(
                "div",
                { className: "inline-modal-actions" },
                React.createElement(
                  "button",
                  { onClick: () => setTemplateDeleteTarget(null) },
                  "Cancel",
                ),
                React.createElement(
                  "button",
                  { className: "danger", onClick: confirmTemplateDelete },
                  "Delete",
                ),
              ),
            ),
          ),
      ),
      templateLoadPending &&
        React.createElement(
          "div",
          {
            className: "inline-modal-layer",
            onPointerDown: (e) => {
              if (e.target === e.currentTarget) setTemplateLoadPending(null);
            },
          },
          React.createElement(
            "div",
            { className: "inline-modal-card" },
            React.createElement(
              "div",
              { className: "inline-modal-title" },
              "Load panel template",
            ),
            React.createElement(
              "div",
              { className: "inline-modal-subtitle" },
              "This replaces the current layout with the selected panel template. Custom parts are preserved/merged.",
            ),
            React.createElement(
              "div",
              { className: "delete-confirm-name" },
              "\u201C",
              templateLoadPending.template.name,
              "\u201D \u00B7 ",
              templateLoadPending.template.hp,
              "HP",
            ),
            React.createElement(
              "div",
              { className: "inline-modal-actions" },
              React.createElement(
                "button",
                { onClick: () => setTemplateLoadPending(null) },
                "Cancel",
              ),
              React.createElement(
                "button",
                { className: "primary", onClick: confirmTemplateLoad },
                "Load template",
              ),
            ),
          ),
        ),
    ),
    document.body,
  );
}
