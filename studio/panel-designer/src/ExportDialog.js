// Extracted component declarations from index.html.
// ExportPreviewMini
function ExportPreviewMini({ state, warnings }) {
  const widthMM = panelWidthMM(state.panel);
  const hard = warnings.filter((w) => w.severity === "error").length;
  const warn = warnings.length - hard;
  const approx = state.components.filter((c) => !isPartVerified(c)).length;
  const slots = state.components.filter((c) => c.holeType === "slot").length;
  const rects = state.components.filter((c) => c.holeType === "rect").length;
  return React.createElement(
    "div",
    { className: "export-preview-card" },
    React.createElement(
      "svg",
      {
        viewBox: `0 0 ${widthMM} ${PANEL_HEIGHT_MM}`,
        preserveAspectRatio: "xMidYMid meet",
      },
      React.createElement("rect", {
        x: "0",
        y: "0",
        width: widthMM,
        height: PANEL_HEIGHT_MM,
        rx: "1",
        fill: "rgba(230,235,238,0.08)",
        stroke: "rgba(230,240,245,0.45)",
        strokeWidth: "0.55",
      }),
      state.mountingHoles.enabled &&
        state.mountingHoles.holes.map((h) =>
          React.createElement("circle", {
            key: h.id,
            cx: h.x,
            cy: h.y,
            r: MOUNTING_HOLE_DIAMETER_MM / 2,
            fill: "none",
            stroke: "rgba(255,255,255,0.55)",
            strokeWidth: "0.45",
          }),
        ),
      state.components.map((c) => {
        if (c.holeType === "slot") {
          const sl = c.slotLength ?? c.holeDiameter;
          return React.createElement("rect", {
            key: c.id,
            x: c.x - c.holeDiameter / 2,
            y: c.y - sl / 2,
            width: c.holeDiameter,
            height: sl,
            rx: c.holeDiameter / 2,
            transform: `rotate(${c.rotation || 0}, ${c.x}, ${c.y})`,
          });
        }
        if (c.holeType === "rect") {
          const hw = c.holeW ?? c.frontW ?? c.holeDiameter;
          const hh = c.holeH ?? c.frontH ?? c.holeDiameter;
          return React.createElement("rect", {
            key: c.id,
            x: c.x - hw / 2,
            y: c.y - hh / 2,
            width: hw,
            height: hh,
            transform: `rotate(${c.rotation || 0}, ${c.x}, ${c.y})`,
          });
        }
        return React.createElement("circle", {
          key: c.id,
          cx: c.x,
          cy: c.y,
          r: c.holeDiameter / 2,
        });
      }),
    ),
    React.createElement(
      "div",
      { className: "export-preview-stats" },
      React.createElement(
        "div",
        null,
        React.createElement("strong", null, state.panel.widthHP, "HP"),
        React.createElement(
          "span",
          null,
          widthMM.toFixed(2),
          " \u00D7 ",
          PANEL_HEIGHT_MM,
          " mm",
        ),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("strong", null, state.components.length),
        React.createElement("span", null, "components"),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("strong", null, slots + rects),
        React.createElement("span", null, "slots/cutouts"),
      ),
      React.createElement(
        "div",
        { className: hard ? "bad" : warn ? "warn" : "ok" },
        React.createElement("strong", null, hard, "/", warn),
        React.createElement("span", null, "errors/warnings"),
      ),
      React.createElement(
        "div",
        { className: approx ? "warn" : "ok" },
        React.createElement("strong", null, approx),
        React.createElement("span", null, "unverified"),
      ),
    ),
  );
}

// ExportDialog
function ExportDialog({
  options,
  onChange,
  onExport,
  onExportPNG,
  onExportPSD,
  onExportLayeredSVG,
  onExportLayeredSVGPackage,
  onExportInkscape,
  onExportMode,
  onExportPackage,
  onExportCSV,
  onExportKiCad,
  onExportPrintTemplate,
  onExportDXF,
  onExportReport,
  onExportEagle,
  onExportPrintTemplatePDF,
  onExportDocumentationPDF,
  onExportJSON,
  onCancel,
}) {
  const rows = [
    ["drillOnly", "Drill holes only"],
    ["labels", "Include labels"],
    ["includeArtwork", "Include artwork images"],
    ["rearKeepout", "Include rear keepout zones"],
    ["rearBody", "Include rear body outlines"],
    ["centerMarks", "Include center marks"],
    ["mountingKeepouts", "Include mounting hole keepouts"],
  ];
  const kicadRows = [
    ["kicadPanelOutline", "Panel outline / Edge.Cuts"],
    ["kicadMountingHoles", "Mounting holes"],
    ["kicadComponentHoles", "Component round/slot holes"],
    ["kicadRectCutouts", "Rectangular cutouts"],
    ["kicadArtwork", "Artwork / F.Cu, F.Mask, F.SilkS"],
    ["kicadVisualOutlines", "Visual front outlines / Dwgs.User"],
    ["kicadKeepoutHints", "Keepout hints / Cmts.User"],
    ["kicadRefs", "Reference labels"],
    ["kicadTextLabels", "Text labels"],
  ];
  const state = useAppState();
  const exportPanelWidth = panelWidthMM(state.panel);
  const warnings = useMemo(
    () =>
      computeWarnings(
        state.components,
        exportPanelWidth,
        state.mountingHoles,
        state.pcb,
        state.artworks,
      ),
    [
      state.components,
      exportPanelWidth,
      state.mountingHoles,
      state.pcb,
      state.artworks,
    ],
  );
  const exportSanity = useMemo(() => {
    const hard = warnings.filter((w) => w.severity === "error").length;
    const warn = warnings.length - hard;
    const unverified = state.components.filter(
      (c) => (c.verificationStatus || "approximate") === "approximate",
    ).length;
    return { hard, warn, unverified };
  }, [warnings, state.components]);
  const { hard, warn, unverified } = exportSanity;
  const [tab, setTab] = useState("kicad");
  const [showChecklist, setShowChecklist] = useState(false);
  const checklist = [
    ["Panel HP confirmed", true],
    ["No hard collisions", hard === 0],
    ["All parts measured/datasheet verified", unverified === 0],
    ["Mounting holes checked", state.mountingHoles.enabled],
    ["PCB outline checked", state.pcb.enabled],
    ["1:1 print template checked", false],
  ];
  const runtimeDiagnostics = useMemo(
    () => (tab === "report" ? runRuntimeSelfTest(state, warnings) : []),
    [tab, state, warnings],
  );
  const runtimeSummary = useMemo(() => {
    const ok = runtimeDiagnostics.filter((i) => i.level === "ok").length;
    const warn = runtimeDiagnostics.filter((i) => i.level === "warn").length;
    const error = runtimeDiagnostics.filter((i) => i.level === "error").length;
    return { ok, warn, error };
  }, [runtimeDiagnostics]);
  function optionRow(key, label) {
    return React.createElement(
      "label",
      { key: key, className: "export-option-row" },
      React.createElement("input", {
        type: "checkbox",
        checked: options[key],
        onChange: (e) => onChange({ ...options, [key]: e.target.checked }),
      }),
      React.createElement("span", null, label),
    );
  }
  function setKiCadPreset(preset) {
    const base = {
      ...options,
      kicadPanelOutline: true,
      kicadMountingHoles: true,
      kicadComponentHoles: true,
      kicadRectCutouts: true,
    };
    if (preset === "holes") {
      onChange({
        ...base,
        kicadArtwork: false,
        kicadVisualOutlines: false,
        kicadKeepoutHints: false,
        kicadRefs: false,
        kicadTextLabels: false,
      });
    } else if (preset === "refs") {
      onChange({
        ...base,
        kicadArtwork: true,
        kicadVisualOutlines: false,
        kicadKeepoutHints: false,
        kicadRefs: true,
        kicadTextLabels: true,
      });
    } else {
      onChange({
        ...base,
        kicadArtwork: true,
        kicadVisualOutlines: true,
        kicadKeepoutHints: true,
        kicadRefs: true,
        kicadTextLabels: true,
      });
    }
  }
  const kicadEnabledCount = kicadRows.filter(([key]) => !!options[key]).length;
  return React.createElement(
    "div",
    { className: "export-dialog-backdrop" },
    React.createElement(
      "div",
      { className: "export-dialog-panel export-dialog-panel-tabbed" },
      React.createElement(
        "div",
        { className: "export-dialog-header" },
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            { className: "export-dialog-title" },
            "Export",
          ),
          React.createElement(
            "div",
            { className: "export-dialog-subtitle" },
            "Hard errors: ",
            hard,
            " \u00B7 Warnings: ",
            warn,
            " \u00B7 Approximate parts: ",
            unverified,
          ),
        ),
        React.createElement("button", { onClick: onCancel }, "Close"),
      ),
      React.createElement(ExportPreviewMini, {
        state: state,
        warnings: warnings,
      }),
      React.createElement(
        "div",
        { className: "export-tabs" },
        React.createElement(
          "button",
          {
            className: tab === "svg" ? "active" : "",
            onClick: () => setTab("svg"),
          },
          "SVG",
        ),
        React.createElement(
          "button",
          {
            className: tab === "png" ? "active" : "",
            onClick: () => setTab("png"),
          },
          "PNG",
        ),
        React.createElement(
          "button",
          {
            className: tab === "psd" ? "active" : "",
            onClick: () => setTab("psd"),
          },
          "PSD",
        ),
        React.createElement(
          "button",
          {
            className: tab === "kicad" ? "active" : "",
            onClick: () => setTab("kicad"),
          },
          "KiCad",
        ),
        React.createElement(
          "button",
          {
            className: tab === "eagle" ? "active" : "",
            onClick: () => setTab("eagle"),
          },
          "Eagle",
        ),
        React.createElement(
          "button",
          {
            className: tab === "package" ? "active" : "",
            onClick: () => setTab("package"),
          },
          "Package",
        ),
        React.createElement(
          "button",
          {
            className: tab === "pdf" ? "active" : "",
            onClick: () => setTab("pdf"),
          },
          "PDF",
        ),
        React.createElement(
          "button",
          {
            className: tab === "report" ? "active" : "",
            onClick: () => setTab("report"),
          },
          "Report",
        ),
      ),
      tab === "svg" &&
        React.createElement(
          "div",
          { className: "export-tab-body" },
          React.createElement(
            "div",
            { className: "section-title" },
            "SVG quick modes",
          ),
          React.createElement(
            "div",
            { className: "export-action-grid" },
            React.createElement(
              "button",
              { onClick: () => onExportMode("preview") },
              "Preview SVG",
            ),
            React.createElement(
              "button",
              { onClick: () => onExportMode("drill") },
              "Drill/Cut SVG",
            ),
            React.createElement(
              "button",
              { onClick: () => onExportMode("artwork") },
              "Artwork SVG",
            ),
            React.createElement(
              "button",
              { onClick: onExportPrintTemplate },
              "1:1 Print Template",
            ),
            React.createElement(
              "button",
              { onClick: onExportDXF },
              "DXF Cut/Drill",
            ),
          ),
          React.createElement(
            "div",
            {
              className: "warning-item warn",
              style: { fontSize: 10, marginBottom: 10 },
            },
            "Preview SVG is for layout review. Use Drill/Cut SVG, DXF or the 1:1 template for fabrication checks.",
          ),
          React.createElement(
            "div",
            { className: "section-title" },
            "Layered SVG export",
          ),
          React.createElement(
            "div",
            { className: "export-options-grid" },
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.svgLayeredPanelBase,
                onChange: (e) =>
                  onChange({
                    ...options,
                    svgLayeredPanelBase: e.target.checked,
                  }),
              }),
              React.createElement("span", null, "Panel base layer"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.svgLayeredComponents,
                onChange: (e) =>
                  onChange({
                    ...options,
                    svgLayeredComponents: e.target.checked,
                  }),
              }),
              React.createElement("span", null, "Components layer"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.svgLayeredHoles,
                onChange: (e) =>
                  onChange({ ...options, svgLayeredHoles: e.target.checked }),
              }),
              React.createElement("span", null, "Holes layer"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.svgLayeredArtwork,
                onChange: (e) =>
                  onChange({ ...options, svgLayeredArtwork: e.target.checked }),
              }),
              React.createElement("span", null, "Artwork layer"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.svgLayeredText,
                onChange: (e) =>
                  onChange({ ...options, svgLayeredText: e.target.checked }),
              }),
              React.createElement("span", null, "Text layer"),
            ),
          ),
          React.createElement(
            "div",
            {
              className: "warning-item warn",
              style: { fontSize: 10, marginTop: 10, marginBottom: 10 },
            },
            "Layered SVG exports named top-level groups/layers. Some apps, especially Photoshop, still open SVG as a single object. Use Layered SVG ZIP for the most reliable cross-app workflow: each layer is a separate same-size SVG.",
          ),
          React.createElement(
            "div",
            { className: "export-dialog-actions" },
            React.createElement("button", { onClick: onCancel }, "Cancel"),
            React.createElement(
              "button",
              { onClick: onExportLayeredSVG },
              "Export layered SVG",
            ),
            React.createElement(
              "button",
              { onClick: onExportInkscape },
              "Export Inkscape SVG",
            ),
            React.createElement(
              "button",
              { className: "primary", onClick: onExportLayeredSVGPackage },
              "Export layered SVG ZIP",
            ),
          ),
          React.createElement(
            "div",
            { className: "section-title" },
            "Custom SVG options",
          ),
          React.createElement(
            "div",
            { className: "export-options-grid" },
            rows.map(([key, label]) => optionRow(key, label)),
          ),
          React.createElement(
            "div",
            { className: "export-dialog-actions" },
            React.createElement("button", { onClick: onCancel }, "Cancel"),
            React.createElement(
              "button",
              { className: "primary", onClick: onExport },
              "Export SVG",
            ),
          ),
        ),
      tab === "png" &&
        React.createElement(
          "div",
          { className: "export-tab-body" },
          React.createElement(
            "div",
            { className: "section-title" },
            "PNG outputs",
          ),
          React.createElement(
            "div",
            { className: "export-options-grid" },
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.pngCombined,
                onChange: (e) =>
                  onChange({ ...options, pngCombined: e.target.checked }),
              }),
              React.createElement("span", null, "Combined panel PNG"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.pngSeparateComponents,
                onChange: (e) =>
                  onChange({
                    ...options,
                    pngSeparateComponents: e.target.checked,
                  }),
              }),
              React.createElement("span", null, "Separate components PNG"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.pngSeparateHoles,
                onChange: (e) =>
                  onChange({ ...options, pngSeparateHoles: e.target.checked }),
              }),
              React.createElement("span", null, "Separate holes PNG"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.pngSeparateArtwork,
                onChange: (e) =>
                  onChange({
                    ...options,
                    pngSeparateArtwork: e.target.checked,
                  }),
              }),
              React.createElement("span", null, "Separate artwork PNG"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.pngSeparateText,
                onChange: (e) =>
                  onChange({ ...options, pngSeparateText: e.target.checked }),
              }),
              React.createElement("span", null, "Separate text PNG"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.pngTransparentBg,
                onChange: (e) =>
                  onChange({ ...options, pngTransparentBg: e.target.checked }),
              }),
              React.createElement(
                "span",
                null,
                "Transparent background for combined PNG",
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "kicad-origin-row", style: { marginTop: 10 } },
            React.createElement("span", null, "PNG resolution"),
            React.createElement(
              "select",
              {
                value: String(options.pngDpi || 300),
                onChange: (e) =>
                  onChange({
                    ...options,
                    pngDpi: Number(e.target.value) || 300,
                  }),
              },
              React.createElement("option", { value: "150" }, "150 DPI"),
              React.createElement("option", { value: "300" }, "300 DPI"),
              React.createElement("option", { value: "600" }, "600 DPI"),
            ),
          ),
          React.createElement(
            "div",
            {
              className: "warning-item warn",
              style: { fontSize: 10, marginTop: 10, marginBottom: 10 },
            },
            "If you enable multiple PNG outputs, the app exports one ZIP with separate transparent PNG layers using the same panel canvas size.",
          ),
          React.createElement(
            "div",
            { className: "export-dialog-actions" },
            React.createElement("button", { onClick: onCancel }, "Cancel"),
            React.createElement(
              "button",
              { className: "primary", onClick: onExportPNG },
              "Export PNG",
            ),
          ),
        ),
      tab === "psd" &&
        React.createElement(
          "div",
          { className: "export-tab-body" },
          React.createElement(
            "div",
            { className: "section-title" },
            "Layered PSD export",
          ),
          React.createElement(
            "div",
            { className: "export-options-grid" },
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.psdPanelBase,
                onChange: (e) =>
                  onChange({ ...options, psdPanelBase: e.target.checked }),
              }),
              React.createElement("span", null, "Panel base layer"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.psdComponents,
                onChange: (e) =>
                  onChange({ ...options, psdComponents: e.target.checked }),
              }),
              React.createElement("span", null, "Components layer"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.psdHoles,
                onChange: (e) =>
                  onChange({ ...options, psdHoles: e.target.checked }),
              }),
              React.createElement("span", null, "Holes layer"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.psdArtwork,
                onChange: (e) =>
                  onChange({ ...options, psdArtwork: e.target.checked }),
              }),
              React.createElement("span", null, "Artwork layer"),
            ),
            React.createElement(
              "label",
              { className: "export-option-row" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!options.psdText,
                onChange: (e) =>
                  onChange({ ...options, psdText: e.target.checked }),
              }),
              React.createElement("span", null, "Text layer"),
            ),
          ),
          React.createElement(
            "div",
            { className: "kicad-origin-row", style: { marginTop: 10 } },
            React.createElement("span", null, "PSD resolution"),
            React.createElement(
              "select",
              {
                value: String(options.psdDpi || 300),
                onChange: (e) =>
                  onChange({
                    ...options,
                    psdDpi: Number(e.target.value) || 300,
                  }),
              },
              React.createElement(
                "option",
                { value: "150" },
                "150 DPI \u00B7 smaller file",
              ),
              React.createElement("option", { value: "300" }, "300 DPI"),
              React.createElement(
                "option",
                { value: "600" },
                "600 DPI \u00B7 large file",
              ),
            ),
          ),
          React.createElement(
            "div",
            {
              className: "warning-item warn",
              style: { fontSize: 10, marginTop: 10, marginBottom: 10 },
            },
            "PSD is raster/layered: Panel base, Artwork, Holes, Components and Text become separate Photoshop layers. No layer effects or vector editability are preserved.",
          ),
          React.createElement(
            "div",
            { className: "export-dialog-actions" },
            React.createElement("button", { onClick: onCancel }, "Cancel"),
            React.createElement(
              "button",
              { className: "primary", onClick: onExportPSD },
              "Export PSD",
            ),
          ),
        ),
      tab === "kicad" &&
        React.createElement(
          "div",
          { className: "export-tab-body" },
          React.createElement(
            "div",
            { className: "section-title" },
            "KiCad PCB export",
          ),
          React.createElement(
            "div",
            { className: "kicad-preset-row" },
            React.createElement(
              "button",
              { onClick: () => setKiCadPreset("holes") },
              "Holes only",
            ),
            React.createElement(
              "button",
              { onClick: () => setKiCadPreset("refs") },
              "With refs/text",
            ),
            React.createElement(
              "button",
              { onClick: () => setKiCadPreset("debug") },
              "Debug layers",
            ),
          ),
          React.createElement(
            "div",
            { className: "kicad-origin-row" },
            React.createElement("span", null, "Origin"),
            React.createElement(
              "select",
              {
                value: options.kicadOrigin || "top-left",
                onChange: (e) =>
                  onChange({ ...options, kicadOrigin: e.target.value }),
              },
              React.createElement(
                "option",
                { value: "top-left" },
                "Top-left panel corner",
              ),
              React.createElement(
                "option",
                { value: "center" },
                "Panel center",
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "kicad-export-grid" },
            kicadRows.map(([key, label]) => optionRow(key, label)),
          ),
          React.createElement(
            "div",
            {
              className: `warning-item ${kicadEnabledCount ? "warn" : "bad"}`,
              style: { fontSize: 10, marginBottom: 10 },
            },
            kicadEnabledCount
              ? `KiCad export · ${kicadEnabledCount} layer groups enabled · ${state.components.length} components · ${state.artworks.filter((artwork) => artwork.visible).length} artwork · ${state.mountingHoles.enabled ? state.mountingHoles.holes.length : 0} mounting holes.`
              : "Nothing selected for KiCad export.",
          ),
          React.createElement(
            "div",
            {
              className: "warning-item warn",
              style: { fontSize: 10, marginBottom: 10 },
            },
            "The default includes panel Edge.Cuts, real NPTH holes/slots/cutouts and compatible vector artwork on fabrication layers.",
          ),
          React.createElement(
            "div",
            { className: "export-dialog-actions" },
            React.createElement("button", { onClick: onCancel }, "Cancel"),
            React.createElement(
              "button",
              {
                className: "primary",
                disabled: !kicadEnabledCount,
                onClick: onExportKiCad,
              },
              "Export KiCad PCB",
            ),
          ),
        ),
      tab === "eagle" &&
        React.createElement(
          "div",
          { className: "export-tab-body" },
          React.createElement(
            "div",
            { className: "section-title" },
            "Eagle board script",
          ),
          React.createElement(
            "div",
            {
              className: "warning-item warn",
              style: { fontSize: 10, marginBottom: 10 },
            },
            "Generates a .scr script with panel outline (Layer 20 Dimension) and all drill/cut holes (HOLE + Layer 46 Milling). Execute in Eagle via File → Execute Script.",
          ),
          React.createElement(
            "div",
            { className: "export-dialog-actions" },
            React.createElement("button", { onClick: onCancel }, "Cancel"),
            React.createElement(
              "button",
              { className: "primary", onClick: onExportEagle },
              "Export Eagle SCR",
            ),
          ),
        ),
      tab === "package" &&
        React.createElement(
          "div",
          { className: "export-tab-body" },
          React.createElement(
            "div",
            { className: "export-recommended-banner" },
            React.createElement("strong", null, "Recommended final handoff"),
            React.createElement(
              "span",
              null,
              "Use this when you want one archive with fabrication references, editable artwork, drill data and project backup.",
            ),
          ),
          React.createElement(
            "div",
            { className: "export-package-card recommended" },
            React.createElement(
              "div",
              null,
              React.createElement("strong", null, "Manufacturing package ZIP"),
              React.createElement(
                "p",
                null,
                "Includes front artwork SVG, drill/cut SVG, rear keepout SVG, layered SVG, component CSV, DFM report and project JSON. Respects Layer Manager export flags.",
              ),
              React.createElement(
                "ul",
                null,
                React.createElement(
                  "li",
                  null,
                  "Best archive before ordering / sharing the panel",
                ),
                React.createElement(
                  "li",
                  null,
                  "Keeps the project JSON together with production references",
                ),
                React.createElement(
                  "li",
                  null,
                  "Use PSD/PNG tabs separately for visual artwork workflows",
                ),
              ),
            ),
            React.createElement(
              "button",
              { className: "primary", onClick: onExportPackage },
              "Export recommended ZIP",
            ),
          ),
          React.createElement(
            "div",
            { className: "section-title" },
            "Individual package files",
          ),
          React.createElement(
            "div",
            { className: "export-action-grid" },
            React.createElement(
              "button",
              { onClick: onExportCSV },
              "CSV Drill Table",
            ),
            React.createElement(
              "button",
              {
                onClick: () => downloadExportPackageLooseFiles(state, warnings),
              },
              "Loose package files",
            ),
            React.createElement(
              "button",
              { onClick: onExportJSON },
              "Save Project JSON",
            ),
          ),
        ),
      tab === "pdf" &&
        React.createElement(
          "div",
          { className: "export-tab-body" },
          React.createElement(
            "div",
            { className: "section-title" },
            "PDF export",
          ),
          React.createElement(
            "div",
            {
              className: "warning-item warn",
              style: { fontSize: 10, marginBottom: 10 },
            },
            "Opens browser print dialog — select “Save as PDF” as destination.",
          ),
          React.createElement(
            "div",
            { className: "export-action-grid" },
            React.createElement(
              "button",
              { onClick: onExportPrintTemplatePDF },
              "1:1 Print Template",
            ),
            React.createElement(
              "button",
              { onClick: onExportDocumentationPDF },
              "Documentation PDF",
            ),
          ),
        ),
      tab === "report" &&
        React.createElement(
          "div",
          { className: "export-tab-body" },
          React.createElement(
            "button",
            {
              style: { marginBottom: 10 },
              onClick: () => setShowChecklist(!showChecklist),
            },
            "Production checklist",
          ),
          showChecklist &&
            React.createElement(
              "div",
              { className: "export-sanity" },
              checklist.map(([label, ok]) =>
                React.createElement(
                  "div",
                  { key: label, className: "checklist-row" },
                  React.createElement("span", null, ok ? "✓" : "○"),
                  React.createElement("span", null, label),
                ),
              ),
            ),
          React.createElement(
            "div",
            { className: "section-title" },
            "Runtime diagnostics",
          ),
          React.createElement(
            "div",
            { className: "runtime-diagnostics-card" },
            React.createElement(
              "div",
              { className: "runtime-diagnostics-head" },
              React.createElement("strong", null, "Build ", APP_VERSION),
              React.createElement(
                "span",
                {
                  className: runtimeSummary.error
                    ? "bad"
                    : runtimeSummary.warn
                      ? "warn"
                      : "ok",
                },
                runtimeSummary.error,
                " errors \u00B7 ",
                runtimeSummary.warn,
                " warnings \u00B7 ",
                runtimeSummary.ok,
                " ok",
              ),
            ),
            React.createElement(
              "div",
              { className: "runtime-diagnostics-list" },
              runtimeDiagnostics
                .slice(0, 10)
                .map((item, idx) =>
                  React.createElement(
                    "div",
                    { key: idx, className: `runtime-diagnostic ${item.level}` },
                    React.createElement("b", null, item.level.toUpperCase()),
                    React.createElement("span", null, item.message),
                  ),
                ),
            ),
          ),
          React.createElement(
            "div",
            { className: "export-action-grid" },
            React.createElement(
              "button",
              { onClick: onExportReport },
              "DFM Report",
            ),
            React.createElement(
              "button",
              { onClick: onExportCSV },
              "CSV Drill Table",
            ),
          ),
          React.createElement(
            "div",
            { className: "export-sanity" },
            React.createElement("strong", null, "Export sanity:"),
            React.createElement("br", null),
            "Hard errors: ",
            hard,
            " \u00B7 Warnings: ",
            warn,
            " \u00B7 Approximate parts: ",
            unverified,
            React.createElement("br", null),
            "Scale: 1:1 mm. Always verify real parts with datasheets/calipers before ordering a panel.",
          ),
        ),
    ),
  );
}
