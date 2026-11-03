// Right sidebar panel components extracted from core.js.
// Globals are loaded by index.html; keep these files script-friendly, not ES modules.

// Production, PCB, BOM, drill, and mounting panels.

function DepthViewPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const d = state.depthSettings;
  const maxDepth = computeMaxDepth(state.components);
  const scale = 2;
  const w = Math.max(120, (d.caseDepthLimitMm + 10) * scale);
  return React.createElement(
    "div",
    { className: "field-row", style: { marginTop: 10 } },
    React.createElement(
      "div",
      { className: "section-title" },
      "Depth / Skiff Check",
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Case depth limit mm"),
      React.createElement("input", {
        type: "number",
        value: d.caseDepthLimitMm,
        onChange: (e) =>
          dispatch({
            type: "SET_DEPTH_SETTINGS",
            patch: { caseDepthLimitMm: +e.target.value },
          }),
      }),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "PCB distance mm"),
      React.createElement("input", {
        type: "number",
        value: d.pcbDistanceBehindPanelMm,
        onChange: (e) =>
          dispatch({
            type: "SET_DEPTH_SETTINGS",
            patch: { pcbDistanceBehindPanelMm: +e.target.value },
          }),
      }),
    ),
    React.createElement(
      "label",
      null,
      React.createElement("input", {
        type: "checkbox",
        checked: d.showPCBPlane,
        onChange: (e) =>
          dispatch({
            type: "SET_DEPTH_SETTINGS",
            patch: { showPCBPlane: e.target.checked },
          }),
      }),
      " Show PCB plane",
    ),
    React.createElement(
      "svg",
      {
        viewBox: `0 0 ${w} 70`,
        style: {
          width: "100%",
          height: 70,
          background: "#101010",
          border: "1px solid #333",
          marginTop: 6,
        },
      },
      React.createElement("line", {
        x1: 10,
        y1: 5,
        x2: 10,
        y2: 65,
        stroke: "#ccc",
      }),
      React.createElement("line", {
        x1: 10 + d.caseDepthLimitMm * scale,
        y1: 5,
        x2: 10 + d.caseDepthLimitMm * scale,
        y2: 65,
        stroke: "#f66",
        strokeDasharray: "3 2",
      }),
      d.showPCBPlane &&
        React.createElement("line", {
          x1: 10 + d.pcbDistanceBehindPanelMm * scale,
          y1: 5,
          x2: 10 + d.pcbDistanceBehindPanelMm * scale,
          y2: 65,
          stroke: "#4af",
          strokeDasharray: "3 2",
        }),
      state.components.slice(0, 12).map((c, i) =>
        React.createElement("rect", {
          key: c.id,
          x: 10,
          y: 8 + i * 4.5,
          width: Math.max(1, c.rearDepth * scale),
          height: 3,
          fill: c.rearDepth > d.caseDepthLimitMm ? "#f55" : "#0af",
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Max depth"),
      React.createElement("span", null, maxDepth.toFixed(1), " mm"),
    ),
    maxDepth > d.caseDepthLimitMm &&
      React.createElement(
        "div",
        { className: "warning-item warn" },
        "Max depth exceeds case limit by ",
        (maxDepth - d.caseDepthLimitMm).toFixed(1),
        " mm.",
      ),
  );
}
function DrillTablePanel() {
  const state = useAppState();
  const rows = state.components.map(
    (c) =>
      `${c.ref || ""} ${c.label || c.name}: ${c.x.toFixed(2)}, ${c.y.toFixed(2)} · ${c.holeType === "slot" ? "slot" : c.holeType === "rect" ? "rect" : "Ø"} ${c.holeType === "rect" ? `${c.holeW ?? c.frontW ?? c.holeDiameter}×${c.holeH ?? c.frontH ?? c.holeDiameter}` : c.holeDiameter}${c.holeType === "slot" ? `×${c.slotLength ?? c.holeDiameter}` : ""} mm · ${verificationLabel(c.verificationStatus)}`,
  );
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement(
      "div",
      { className: "section-title" },
      React.createElement("span", null, "Drill Table"),
    ),
    React.createElement(
      "div",
      {
        style: {
          maxHeight: 180,
          overflow: "auto",
          fontSize: 10,
          fontFamily: "monospace",
          lineHeight: 1.5,
        },
      },
      rows.length
        ? rows.map((r, i) =>
            React.createElement(
              "div",
              {
                key: i,
                style: { borderBottom: "1px solid #222", padding: "2px 0" },
              },
              r,
            ),
          )
        : React.createElement(
            "div",
            { style: { color: "#666" } },
            "No components",
          ),
      React.createElement(
        "div",
        { className: "btn-row", style: { marginTop: 6 } },
        React.createElement(
          "button",
          { onClick: () => copyDrillTableText(state) },
          "Copy table",
        ),
        React.createElement(
          "button",
          { onClick: () => exportCSVDrillTable(state, []) },
          "Export CSV",
        ),
      ),
    ),
  );
}
function AutosavePanel({ status, onRestore, onClear }) {
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement("div", { className: "section-title" }, "Autosave"),
    React.createElement(
      "div",
      { style: { color: "#888", fontSize: 11, marginBottom: 6 } },
      status || "Autosave ready",
    ),
    React.createElement(
      "div",
      { className: "btn-row" },
      React.createElement("button", { onClick: onRestore }, "Restore"),
      React.createElement(
        "button",
        { className: "danger", onClick: onClear },
        "Clear",
      ),
    ),
  );
}
function BOMPanel() {
  const state = useAppState();
  const rows = bomRows(state);
  function copyBOM() {
    const text = [
      "Qty\tPart\tManufacturer\tMPN\tVerification\tRefs",
      ...rows.map((r) =>
        [
          r.qty,
          r.name,
          r.manufacturer,
          r.mpn,
          r.verification,
          r.refs.join(" "),
        ].join("\t"),
      ),
    ].join("\n");
    if (navigator.clipboard && window.isSecureContext)
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    else fallbackCopy(text);
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement(
      "div",
      { className: "section-title" },
      React.createElement("span", null, "BOM"),
    ),
    React.createElement(
      "div",
      {
        style: {
          maxHeight: 180,
          overflow: "auto",
          fontSize: 10,
          lineHeight: 1.5,
        },
      },
      rows.length
        ? rows.map((r, i) =>
            React.createElement(
              "div",
              {
                key: i,
                style: { borderBottom: "1px solid #222", padding: "3px 0" },
              },
              React.createElement("b", null, r.qty, "\u00D7"),
              " ",
              r.name,
              React.createElement("br", null),
              React.createElement(
                "span",
                { style: { color: "#888" } },
                r.manufacturer,
                " ",
                r.mpn,
                " \u00B7 ",
                r.verification,
              ),
              React.createElement("br", null),
              React.createElement(
                "span",
                { style: { color: "#666" } },
                r.refs.join(", "),
              ),
            ),
          )
        : React.createElement(
            "div",
            { style: { color: "#666" } },
            "No components",
          ),
      React.createElement(
        "div",
        { className: "btn-row", style: { marginTop: 6 } },
        React.createElement("button", { onClick: copyBOM }, "Copy BOM"),
      ),
    ),
  );
}
function ManufacturingCheckPanel({ warnings }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const issues = getManufacturingIssues(state, warnings);
  const status = manufacturingStatus(state, warnings);
  const color = status.startsWith("NOT")
    ? "#ff7777"
    : status.startsWith("OK FOR MOCKUP")
      ? "#ffaa44"
      : "var(--ui-success)";
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement(
      "div",
      { className: "section-title" },
      React.createElement("span", null, "Manufacturing Check"),
    ),
    React.createElement(
      "div",
      { style: { fontSize: 12, color, fontWeight: 700, marginBottom: 6 } },
      status,
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "DFM profile"),
      React.createElement(
        "select",
        {
          value: state.dfmProfile || "generic",
          onChange: (e) =>
            dispatch({ type: "SET_DFM_PROFILE", profile: e.target.value }),
        },
        Object.values(DFM_PROFILES).map((p) =>
          React.createElement("option", { key: p.key, value: p.key }, p.name),
        ),
      ),
    ),
    React.createElement(
      "div",
      { style: { maxHeight: 160, overflow: "auto" } },
      issues.length
        ? issues.map((i, idx) =>
            React.createElement(
              "div",
              {
                key: idx,
                className: `warning-item${i.level === "warn" || i.level === "info" ? " warn" : ""}`,
                style: { fontSize: 10 },
              },
              i.message,
            ),
          )
        : React.createElement(
            "div",
            { style: { color: "var(--ui-success)", fontSize: 11 } },
            "\u2713 No DFM issues detected",
          ),
    ),
    React.createElement(
      "div",
      { className: "btn-row", style: { marginTop: 6 } },
      React.createElement(
        "button",
        { onClick: () => copyManufacturingReport(state, warnings) },
        "Copy report",
      ),
      React.createElement(
        "button",
        { onClick: () => exportManufacturingReport(state, warnings) },
        "Export MD",
      ),
    ),
  );
}
function PCBPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const pcb = state.pcb;
  const set = (p) => dispatch({ type: "SET_PCB", patch: p });
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement("div", { className: "section-title" }, "PCB Planning"),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement(
        "label",
        null,
        React.createElement("input", {
          type: "checkbox",
          checked: pcb.enabled,
          onChange: (e) => set({ enabled: e.target.checked }),
        }),
        " ",
        "Enable PCB outline",
      ),
    ),
    pcb.enabled &&
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          { className: "field-pair" },
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Width (mm)"),
            React.createElement("input", {
              type: "number",
              step: 0.5,
              value: pcb.width,
              onChange: (e) => set({ width: +e.target.value }),
            }),
          ),
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Height (mm)"),
            React.createElement("input", {
              type: "number",
              step: 0.5,
              value: pcb.height,
              onChange: (e) => set({ height: +e.target.value }),
            }),
          ),
        ),
        React.createElement(
          "div",
          { className: "field-pair" },
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "X offset"),
            React.createElement("input", {
              type: "number",
              step: 0.5,
              value: pcb.x,
              onChange: (e) => set({ x: +e.target.value }),
            }),
          ),
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Y offset"),
            React.createElement("input", {
              type: "number",
              step: 0.5,
              value: pcb.y,
              onChange: (e) => set({ y: +e.target.value }),
            }),
          ),
        ),
        React.createElement(
          "div",
          { className: "field-row" },
          React.createElement("label", null, "Depth limit (mm)"),
          React.createElement("input", {
            type: "number",
            step: 1,
            value: pcb.depthLimit,
            onChange: (e) => set({ depthLimit: +e.target.value }),
          }),
        ),
        pcbHeightWarnings(pcb).map((w, i) =>
          React.createElement(
            "div",
            {
              key: i,
              className: `warning-item${w.severity === "warn" ? " warn" : ""}${w.tone ? " pcb-" + w.tone : ""}`,
              style: { fontSize: 10, marginTop: 6 },
            },
            w.message,
          ),
        ),
      ),
    React.createElement(DepthViewPanel, null),
  );
}
function MountingHolesPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const mh = state.mountingHoles;
  const widthMM = panelWidthMM(state.panel);
  const [addRail, setAddRail] = useState("top");
  const topHoles = mh.holes
    .map(normalizeMountingHoleRail)
    .filter((h) => mountingHoleSide(h) === "top");
  const bottomHoles = mh.holes
    .map(normalizeMountingHoleRail)
    .filter((h) => mountingHoleSide(h) === "bottom");
  function applyPreset(preset) {
    dispatch({
      type: "SET_MOUNTING_HOLES",
      patch: {
        preset,
        enabled: preset !== "none",
        holeShape:
          preset === "autoOval" || preset === "fourOval" || preset === "twoOval"
            ? "oval"
            : preset === "custom"
              ? mh.holeShape
              : "circle",
        holes:
          preset === "custom"
            ? mh.holes
            : mountingHolesForPreset(widthMM, preset),
      },
    });
  }
  function addHole() {
    const side = addRail;
    const n = mh.holes.filter((h) => mountingHoleSide(h) === side).length + 1;
    const prefix = side === "top" ? "mh-t" : "mh-b";
    dispatch({
      type: "SET_MOUNTING_HOLES",
      patch: {
        preset: "custom",
        enabled: true,
        holes: [
          ...mh.holes.map(normalizeMountingHoleRail),
          { id: `${prefix}${n}`, x: widthMM / 2, y: mountingHoleRailY(side) },
        ],
      },
    });
  }
  function removeHole(id) {
    dispatch({
      type: "SET_MOUNTING_HOLES",
      patch: { preset: "custom", holes: mh.holes.filter((h) => h.id !== id) },
    });
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement(
      "div",
      { className: "section-title" },
      "Mounting Holes",
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement(
        "label",
        null,
        React.createElement("input", {
          type: "checkbox",
          checked: mh.enabled,
          onChange: (e) =>
            dispatch({
              type: "SET_MOUNTING_HOLES",
              patch: { enabled: e.target.checked },
            }),
        }),
        " ",
        "Show mounting holes",
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Hole preset"),
      React.createElement(
        "select",
        {
          style: { width: "100%" },
          value: mh.preset ?? "autoOval",
          onChange: (e) => applyPreset(e.target.value),
        },
        React.createElement(
          "option",
          { value: "autoOval" },
          "Automatic Eurorack / oval",
        ),
        React.createElement(
          "option",
          { value: "auto" },
          "Automatic Eurorack / round",
        ),
        React.createElement("option", { value: "four" }, "4 holes / standard"),
        React.createElement(
          "option",
          { value: "fourOval" },
          "4 slightly oval holes",
        ),
        React.createElement(
          "option",
          { value: "two" },
          "2 holes / narrow panel",
        ),
        React.createElement(
          "option",
          { value: "twoOval" },
          "2 slightly oval holes",
        ),
        React.createElement("option", { value: "none" }, "No mounting holes"),
        React.createElement("option", { value: "custom" }, "Custom positions"),
      ),
    ),
    React.createElement(
      "div",
      { className: "field-pair" },
      React.createElement(
        "div",
        null,
        React.createElement("label", null, "Hole shape"),
        React.createElement(
          "select",
          {
            style: { width: "100%" },
            value: mh.holeShape ?? "circle",
            onChange: (e) =>
              dispatch({
                type: "SET_MOUNTING_HOLES",
                patch: { preset: "custom", holeShape: e.target.value },
              }),
          },
          React.createElement("option", { value: "circle" }, "Round"),
          React.createElement("option", { value: "oval" }, "Slightly oval"),
        ),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("label", null, "Oval length (mm)"),
        React.createElement("input", {
          type: "number",
          min: MOUNTING_HOLE_DIAMETER_MM,
          step: 0.1,
          value: (mh.ovalLength ?? 4.8).toFixed(1),
          disabled: (mh.holeShape ?? "circle") !== "oval",
          onChange: (e) =>
            dispatch({
              type: "SET_MOUNTING_HOLES",
              patch: {
                ovalLength: Math.max(
                  MOUNTING_HOLE_DIAMETER_MM,
                  +e.target.value || MOUNTING_HOLE_DIAMETER_MM,
                ),
                holeShape: "oval",
                preset: "custom",
              },
            }),
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement(
        "label",
        null,
        React.createElement("input", {
          type: "checkbox",
          checked: mh.showKeepouts !== false,
          onChange: (e) =>
            dispatch({
              type: "SET_MOUNTING_HOLES",
              patch: { showKeepouts: e.target.checked },
            }),
        }),
        " ",
        "Show screw keepout zones",
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Screw keepout radius (mm)"),
      React.createElement("input", {
        type: "number",
        min: 0,
        step: 0.5,
        value: (mh.keepoutRadius ?? 1).toFixed(1),
        onChange: (e) =>
          dispatch({
            type: "SET_MOUNTING_HOLES",
            patch: { keepoutRadius: Math.max(0, +e.target.value || 0) },
          }),
      }),
    ),
    React.createElement(
      "div",
      {
        style: {
          color: "#666",
          fontSize: 10,
          lineHeight: 1.35,
          marginBottom: 6,
        },
      },
      "Mounting-hole Y is fixed to the Eurorack rail height. Edit only horizontal X positions; choose UP/DOWN below before Add hole.",
    ),
    mh.enabled &&
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 6,
          },
        },
        ["top", "bottom"].map((side) => {
          const holes = side === "top" ? topHoles : bottomHoles;
          return React.createElement(
            "div",
            { key: side },
            React.createElement(
              "div",
              {
                style: {
                  color: "#888",
                  fontSize: 11,
                  marginBottom: 4,
                  fontWeight: 700,
                },
              },
              side === "top"
                ? `Top rail Y=${MOUNTING_HOLE_TOP_Y_MM.toFixed(1)}`
                : `Bottom rail Y=${MOUNTING_HOLE_BOTTOM_Y_MM.toFixed(1)}`,
            ),
            holes.length === 0 &&
              React.createElement(
                "div",
                { style: { color: "#555", fontSize: 10, marginBottom: 4 } },
                "No holes",
              ),
            holes.map((h, i) =>
              React.createElement(
                "div",
                {
                  key: h.id,
                  style: {
                    display: "grid",
                    gridTemplateColumns: "18px 52px 18px",
                    gap: 4,
                    marginBottom: 4,
                    alignItems: "center",
                  },
                },
                React.createElement(
                  "span",
                  { style: { color: "#666", fontSize: 10, flexShrink: 0 } },
                  String(i + 1),
                ),
                React.createElement("input", {
                  type: "number",
                  step: 0.1,
                  value: h.x.toFixed(1),
                  title:
                    "Horizontal position in mm. Vertical position is fixed by the Eurorack rails.",
                  onChange: (e) =>
                    dispatch({
                      type: "UPDATE_MOUNTING_HOLE",
                      id: h.id,
                      x: +e.target.value,
                      y: mountingHoleRailY(side),
                    }),
                }),
                React.createElement(
                  "button",
                  {
                    className: "danger",
                    title: "Remove hole",
                    style: { padding: "2px 6px" },
                    onClick: () => removeHole(h.id),
                  },
                  "\u00D7",
                ),
              ),
            ),
          );
        }),
      ),
    React.createElement(
      "div",
      { className: "field-row", style: { marginTop: 8 } },
      React.createElement("label", null, "Add hole rail"),
      React.createElement(
        "div",
        {
          className: "btn-row",
          role: "group",
          "aria-label": "Add mounting hole rail",
        },
        React.createElement(
          "label",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              margin: 0,
            },
            title: "Add the next mounting hole to the upper rail",
          },
          React.createElement("input", {
            type: "checkbox",
            checked: addRail === "top",
            onChange: () => setAddRail("top"),
          }),
          " UP",
        ),
        React.createElement(
          "label",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              margin: 0,
            },
            title: "Add the next mounting hole to the lower rail",
          },
          React.createElement("input", {
            type: "checkbox",
            checked: addRail === "bottom",
            onChange: () => setAddRail("bottom"),
          }),
          " DOWN",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "btn-row", style: { marginTop: 6 } },
      React.createElement("button", { onClick: addHole }, "+ Add hole"),
      React.createElement(
        "button",
        { onClick: () => applyPreset("four") },
        "Reset 4",
      ),
      React.createElement(
        "button",
        { onClick: () => applyPreset("two") },
        "Narrow 2",
      ),
    ),
  );
}
