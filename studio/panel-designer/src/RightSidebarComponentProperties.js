// Right sidebar panel components extracted from core.js.
// Globals are loaded by index.html; keep these files script-friendly, not ES modules.

// Selected component properties inspector.

function PropertiesPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selComps = state.components.filter((c) =>
    state.selected.includes(c.id),
  );
  if (selComps.length === 0) {
    return React.createElement(
      "div",
      { className: "section", style: { color: "#555", fontSize: 11 } },
      "Click a component to select it.",
    );
  }
  const sameEditableKind =
    selComps.length <= 1 ||
    selComps.every(
      (c) =>
        c.type === selComps[0].type &&
        c.name === selComps[0].name &&
        c.holeType === selComps[0].holeType,
    );
  if (selComps.length > 1 && !sameEditableKind) {
    const selectedIds = selComps.map((c) => c.id);
    const allLocked = selComps.every((c) => c.locked);
    const types = [...new Set(selComps.map((c) => c.name || c.type))]
      .slice(0, 4)
      .join(", ");
    return React.createElement(
      "div",
      { className: "section" },
      React.createElement(
        "div",
        { className: "section-title" },
        selComps.length,
        " selected",
      ),
      React.createElement(
        "div",
        { className: "multi-edit-note warn" },
        "Mixed component types selected. Multi-edit is available when all selected parts are the same type.",
      ),
      React.createElement(
        "div",
        { style: { color: "var(--ui-muted)", fontSize: 11, marginTop: 6 } },
        "Selected: ",
        types,
        selComps.length > 4 ? "…" : "",
      ),
      React.createElement(
        "div",
        { style: { color: "#666", fontSize: 11, marginTop: 8 } },
        "Use align/distribute tools below for mixed selections.",
      ),
      React.createElement(
        "div",
        { className: "mixed-selection-actions" },
        React.createElement(
          "button",
          {
            onClick: () =>
              dispatch({
                type: "UPDATE_COMPONENTS_PATCH",
                ids: selectedIds,
                patch: { label: "" },
              }),
          },
          "Clear labels",
        ),
        React.createElement(
          "button",
          {
            onClick: () =>
              dispatch({ type: "LOCK_SELECTED", locked: !allLocked }),
          },
          allLocked ? "Unlock all" : "Lock all",
        ),
        React.createElement(
          "button",
          {
            onClick: () => dispatch({ type: "ROTATE_SELECTED", degrees: 90 }),
          },
          "Rotate +90°",
        ),
        React.createElement(
          "button",
          {
            onClick: () =>
              dispatch({ type: "SMART_ARRANGE_SELECTED", layout: "grid" }),
          },
          "Smart grid",
        ),
      ),
    );
  }
  const isMultiEdit = selComps.length > 1;
  const c = selComps[0];
  const displayMm = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return Number(number.toFixed(2)).toString();
  };
  const libraryDef =
    COMPONENT_LIBRARY.find(
      (def) =>
        def.type === c.type &&
        (!c.partNumber || !def.partNumber || def.partNumber === c.partNumber),
    ) || COMPONENT_LIBRARY.find((def) => def.type === c.type);
  const geometryKeys = [
    "holeType",
    "holeDiameter",
    "holeW",
    "holeH",
    "slotLength",
    "frontShape",
    "frontDiameter",
    "frontW",
    "frontH",
    "rearBodyW",
    "rearBodyH",
    "rearDepth",
    "keepoutW",
    "keepoutH",
    "minSpacing",
    "panelThicknessMin",
    "panelThicknessMax",
  ];
  const dimensionsDiffer =
    !!libraryDef &&
    geometryKeys.some((key) => {
      const current = c[key];
      const expected = libraryDef[key];
      if (current == null && expected == null) return false;
      if (typeof current === "number" && typeof expected === "number")
        return Math.abs(current - expected) > 0.001;
      return current !== expected;
    });
  const linkedScales = isMultiEdit
    ? []
    : state.scaleItems.filter((sc) => sc.componentId === c.id);
  const patch = (p) =>
    isMultiEdit
      ? dispatch({
          type: "UPDATE_COMPONENTS_PATCH",
          ids: selComps.map((c) => c.id),
          patch: p,
        })
      : dispatch({ type: "UPDATE_COMPONENT", id: c.id, patch: p });
  const category = c.category ?? inferCategoryForType(c.type);
  const showKnobControls =
    category === "potentiometer" || category === "encoder" || isPotLike(c);
  const showFaderControls = category === "fader" || isFaderLike(c);
  const showColorControls =
    category === "jack" ||
    category === "switch" ||
    category === "led" ||
    category === "fader" ||
    isJackLike(c) ||
    isButtonLike(c) ||
    isLedLike(c);
  const showThreadedHardware =
    hasNutWasherHardware(c) && !isButtonLike(c) && !isLedLike(c);
  const compatibleCutoutParts =
    c.type === "cutout" && c.holeType !== "rect" && c.holeType !== "slot"
      ? COMPONENT_LIBRARY.filter(
          (def) =>
            def.type !== "cutout" &&
            Number.isFinite(def.holeDiameter) &&
            Math.abs(def.holeDiameter - c.holeDiameter) <= 0.45,
        )
          .sort(
            (a, b) =>
              Math.abs(a.holeDiameter - c.holeDiameter) -
                Math.abs(b.holeDiameter - c.holeDiameter) ||
              a.rearDepth - b.rearDepth,
          )
          .slice(0, 4)
      : [];
  const isToggleLike =
    c.type === "toggle" || c.type === "toggleSpdt" || c.type === "toggle2m";
  const applyToSameType = (patchObj) =>
    dispatch({ type: "APPLY_TO_SAME_TYPE", sourceId: c.id, patch: patchObj });
  return React.createElement(
    "div",
    {
      className: `section ${isMultiEdit ? "multi-edit-active" : ""}`,
      "data-component-properties": "true",
    },
    React.createElement(
      "div",
      { className: "section-title" },
      isMultiEdit ? `${selComps.length} × ${shortPartName(c)}` : c.name,
    ),
    isMultiEdit &&
      React.createElement(
        "div",
        { className: "mixed-selection-actions smart-arrange-actions" },
        [
          ["grid", "Smart grid"],
          ["row", "Row"],
          ["column", "Column"],
        ].map(([layout, label]) =>
          React.createElement(
            "button",
            {
              key: layout,
              onClick: () =>
                dispatch({ type: "SMART_ARRANGE_SELECTED", layout }),
            },
            label,
          ),
        ),
      ),
    React.createElement(
      "div",
      { className: "inspector-geometry-summary" },
      React.createElement(
        "div",
        { className: "inspector-geometry-preview" },
        React.createElement(LibraryPartPreview, { def: c }),
      ),
      React.createElement(
        "div",
        { className: "inspector-geometry-specs" },
        React.createElement(
          "span",
          null,
          "Cutout",
          React.createElement(
            "b",
            null,
            c.holeType === "rect"
              ? `${displayMm(c.holeW ?? c.frontW)}×${displayMm(c.holeH ?? c.frontH)}`
              : c.holeType === "slot"
                ? `${displayMm(c.holeDiameter)}×${displayMm(c.slotLength ?? c.holeDiameter)}`
                : `Ø${displayMm(c.holeDiameter)}`,
          ),
        ),
        React.createElement(
          "span",
          null,
          "Rear body",
          React.createElement(
            "b",
            null,
            `${displayMm(c.rearBodyW)}×${displayMm(c.rearBodyH)}`,
          ),
        ),
        React.createElement(
          "span",
          null,
          "Depth",
          React.createElement("b", null, `${c.rearDepth} mm`),
        ),
        React.createElement(
          "span",
          null,
          "Keepout",
          React.createElement("b", null, `${c.keepoutW}×${c.keepoutH}`),
        ),
      ),
      libraryDef &&
        React.createElement(
          "div",
          { className: "inspector-library-state" },
          React.createElement(
            "span",
            { className: dimensionsDiffer ? "changed" : "matches" },
            dimensionsDiffer ? "Modified from library" : "Matches library",
          ),
          dimensionsDiffer &&
            React.createElement(
              "button",
              {
                onClick: () =>
                  patch(
                    Object.fromEntries(
                      geometryKeys
                        .filter((key) => libraryDef[key] != null)
                        .map((key) => [key, libraryDef[key]]),
                    ),
                  ),
              },
              "Reset dimensions",
            ),
        ),
    ),
    isMultiEdit &&
      React.createElement(
        "div",
        { className: "multi-edit-note ok" },
        "Multi-edit mode: changes are applied to all ",
        selComps.length,
        " selected matching components.",
      ),
    !isMultiEdit &&
      c.type === "cutout" &&
      React.createElement(
        "div",
        { className: "cutout-assistant" },
        React.createElement(
          "label",
          { className: "cutout-snap-toggle" },
          React.createElement("input", {
            type: "checkbox",
            checked: c.snapTargetEnabled !== false,
            onChange: (e) => patch({ snapTargetEnabled: e.target.checked }),
          }),
          React.createElement("span", null, "Use center as Shift snap target"),
        ),
        compatibleCutoutParts.length > 0 &&
          React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "span",
              { className: "cutout-assistant-label" },
              "Fits this hole",
            ),
            React.createElement(
              "div",
              { className: "cutout-suggestion-grid" },
              compatibleCutoutParts.map((def) =>
                React.createElement(
                  "button",
                  {
                    key: `${def.type}-${def.partNumber || def.name}`,
                    title: `${def.name} · Ø${def.holeDiameter} mm · ${def.rearDepth} mm deep`,
                    onClick: () =>
                      dispatch({
                        type: "ADD_COMPONENT",
                        def,
                        x: c.x,
                        y: c.y,
                      }),
                  },
                  React.createElement("b", null, shortPartName(def)),
                  React.createElement(
                    "small",
                    null,
                    `Ø${def.holeDiameter} · ${def.rearDepth} mm deep`,
                  ),
                ),
              ),
            ),
          ),
      ),
    React.createElement(
      "div",
      { className: "field-pair" },
      React.createElement(
        "div",
        { className: "field-row" },
        React.createElement("label", null, "Reference"),
        React.createElement("input", {
          type: "text",
          value: isMultiEdit ? "— multiple refs —" : c.ref || "",
          disabled: isMultiEdit,
          title: isMultiEdit
            ? "References stay unique in multi-edit mode."
            : "Reference",
          onChange: (e) => patch({ ref: e.target.value }),
        }),
      ),
      React.createElement(
        "div",
        { className: "field-row" },
        React.createElement("label", null, "Label"),
        React.createElement("input", {
          type: "text",
          "data-label-input": "1",
          value: c.label,
          onChange: (e) => patch({ label: e.target.value }),
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement(
        "label",
        {
          style: { display: "flex", alignItems: "center", gap: 6 },
          title:
            "Locked components can be selected, exported and edited, but cannot be dragged or rotated until unlocked.",
        },
        React.createElement("input", {
          type: "checkbox",
          checked: !!c.locked,
          onChange: (e) => patch({ locked: e.target.checked }),
        }),
        "Lock component position",
      ),
    ),
    React.createElement(
      "div",
      { className: "front-compact-grid inspector-position-grid" },
      React.createElement(NumFieldCompact, {
        label: "X (mm)",
        value: c.x,
        onChange: (v) => patch({ x: v }),
      }),
      React.createElement(NumFieldCompact, {
        label: "Y (mm)",
        value: c.y,
        onChange: (v) => patch({ y: v }),
      }),
      React.createElement(NumFieldCompact, {
        label: "Rotation (°)",
        value: c.rotation,
        step: 5,
        min: -360,
        onChange: (v) => patch({ rotation: v }),
      }),
    ),
    React.createElement(
      "details",
      { className: "inspector-part-details" },
      React.createElement("summary", null, "Part / verification"),
      React.createElement(
        "div",
        { className: "inspector-part-details-content" },
        React.createElement(
          "div",
          { className: "field-pair" },
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Manufacturer"),
            React.createElement("input", {
              type: "text",
              value: c.manufacturer || "",
              onChange: (e) => patch({ manufacturer: e.target.value }),
            }),
          ),
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Part No."),
            React.createElement("input", {
              type: "text",
              value: c.partNumber || "",
              onChange: (e) => patch({ partNumber: e.target.value }),
            }),
          ),
        ),
        React.createElement(
          "div",
          { className: "field-row" },
          React.createElement("label", null, "Datasheet URL"),
          React.createElement("input", {
            type: "text",
            value: c.datasheetUrl || "",
            onChange: (e) => patch({ datasheetUrl: e.target.value }),
          }),
        ),
        React.createElement(
          "div",
          { className: "field-pair" },
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Category"),
            React.createElement(
              "select",
              {
                value: category || "custom",
                onChange: (e) => patch({ category: e.target.value }),
              },
              React.createElement(
                "option",
                { value: "potentiometer" },
                "Potentiometer",
              ),
              React.createElement("option", { value: "jack" }, "Jack"),
              React.createElement("option", { value: "switch" }, "Switch"),
              React.createElement("option", { value: "led" }, "LED"),
              React.createElement("option", { value: "encoder" }, "Encoder"),
              React.createElement("option", { value: "fader" }, "Fader"),
              React.createElement("option", { value: "custom" }, "Custom"),
            ),
          ),
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Verification"),
            React.createElement(
              "select",
              {
                value: c.verificationStatus || "approximate",
                onChange: (e) => patch({ verificationStatus: e.target.value }),
              },
              React.createElement(
                "option",
                { value: "approximate" },
                "Approximate",
              ),
              React.createElement(
                "option",
                { value: "datasheet" },
                "From datasheet",
              ),
              React.createElement("option", { value: "measured" }, "Measured"),
              React.createElement(
                "option",
                { value: "production" },
                "Production verified",
              ),
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "field-row" },
          React.createElement("label", null, "Verification note"),
          React.createElement("textarea", {
            value: c.verification || "",
            onChange: (e) => patch({ verification: e.target.value }),
            placeholder:
              "e.g. dimensions from datasheet page 2, measured with calipers, production verified\u2026",
          }),
        ),
        isMultiEdit &&
          React.createElement(
            "div",
            { className: "multi-edit-note subtle" },
            "Reference is protected, but label, geometry, hardware, color, verification and manufacturing parameters apply to the whole selection.",
          ),
        React.createElement(
          "div",
          { className: "btn-row", style: { marginBottom: 6 } },
          React.createElement(
            "button",
            {
              disabled: isMultiEdit,
              title: isMultiEdit
                ? "Already editing selected matching parts."
                : "Apply manufacturer, part number, datasheet, category, verification and panel-thickness data to all matching parts of the same type.",
              onClick: () =>
                applyToSameType({
                  manufacturer: c.manufacturer,
                  partNumber: c.partNumber,
                  datasheetUrl: c.datasheetUrl,
                  category: c.category,
                  verificationStatus: c.verificationStatus,
                  panelThicknessMin: c.panelThicknessMin,
                  panelThicknessMax: c.panelThicknessMax,
                }),
            },
            "Apply part info to same type",
          ),
          React.createElement(
            "button",
            {
              title:
                "Apply hole, front, rear body, keepout and pin keepout dimensions to all matching parts of the same type.",
              onClick: () =>
                applyToSameType({
                  holeDiameter: c.holeDiameter,
                  holeType: c.holeType,
                  slotLength: c.slotLength,
                  holeW: c.holeW,
                  holeH: c.holeH,
                  frontDiameter: c.frontDiameter,
                  frontShape: c.frontShape,
                  frontW: c.frontW,
                  frontH: c.frontH,
                  rearBodyW: c.rearBodyW,
                  rearBodyH: c.rearBodyH,
                  rearDepth: c.rearDepth,
                  keepoutW: c.keepoutW,
                  keepoutH: c.keepoutH,
                  pinKeepoutW: c.pinKeepoutW,
                  pinKeepoutH: c.pinKeepoutH,
                  minSpacing: c.minSpacing,
                }),
              disabled: isMultiEdit,
            },
            "Apply dimensions to same type",
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "section-title", style: { marginTop: 8 } },
      "Front",
    ),
    showThreadedHardware
      ? React.createElement(
          "div",
          { className: "front-compact-grid" },
          React.createElement(NumFieldCompact, {
            label: "Panel cutout \u00D8",
            value: c.holeDiameter,
            onChange: (v) => patch({ holeDiameter: v }),
          }),
          React.createElement(NumFieldCompact, {
            label: "Nut \u00D8",
            value: c.nutDiameter ?? c.holeDiameter + 2,
            onChange: (v) => patch({ nutDiameter: v }),
          }),
          React.createElement(NumFieldCompact, {
            label: "Washer \u00D8",
            value: c.washerDiameter ?? c.frontDiameter,
            onChange: (v) => patch({ washerDiameter: v, frontDiameter: v }),
          }),
          React.createElement(NumFieldCompact, {
            label: "Min spacing",
            value: c.minSpacing,
            onChange: (v) => patch({ minSpacing: v }),
          }),
        )
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "div",
            { className: "front-compact-grid" },
            React.createElement(NumFieldCompact, {
              label: "Panel cutout \u00D8",
              value: c.holeDiameter,
              onChange: (v) => patch({ holeDiameter: v }),
            }),
            React.createElement(NumFieldCompact, {
              label: isButtonLike(c) ? "Bezel \u00D8" : "Front \u00D8",
              value: c.frontDiameter,
              onChange: (v) => patch({ frontDiameter: v }),
            }),
            React.createElement(NumFieldCompact, {
              label: "Min spacing",
              value: c.minSpacing,
              onChange: (v) => patch({ minSpacing: v }),
            }),
          ),
        ),
    c.holeType === "rect" &&
      React.createElement(
        "div",
        { className: "front-compact-grid" },
        React.createElement(NumFieldCompact, {
          label: "Hole W",
          value: c.holeW ?? c.frontW ?? c.holeDiameter,
          onChange: (v) => patch({ holeW: v, frontW: v, frontShape: "rect" }),
        }),
        React.createElement(NumFieldCompact, {
          label: "Hole H",
          value: c.holeH ?? c.frontH ?? c.holeDiameter,
          onChange: (v) => patch({ holeH: v, frontH: v, frontShape: "rect" }),
        }),
      ),
    showKnobControls &&
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "label",
          {
            className: "component-check-row",
            htmlFor: `knob-${c.id}`,
            title: "Show and size the knob/top cap visual hardware.",
          },
          React.createElement("input", {
            type: "checkbox",
            id: `knob-${c.id}`,
            checked: !!c.knobEnabled,
            onChange: (e) => patch({ knobEnabled: e.target.checked }),
          }),
          React.createElement("span", null, "Knob / top cap"),
        ),
        c.knobEnabled &&
          React.createElement(NumField, {
            label: "Knob \u00D8 (mm)",
            value: c.knobDiameter ?? c.frontDiameter,
            onChange: (v) => patch({ knobDiameter: v }),
          }),
        c.knobEnabled &&
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement(
              "label",
              null,
              isTrimPot(c) ? "Knob / LED color" : "Knob color",
            ),
            React.createElement("input", {
              type: "color",
              value: topColor(c),
              onChange: (e) => patch({ topColor: e.target.value }),
            }),
          ),
        c.knobEnabled &&
          isTrimPot(c) &&
          React.createElement(
            "label",
            {
              className: "component-check-row",
              title:
                "Render a translucent knob with the selected color glowing through it from an LED below.",
            },
            React.createElement("input", {
              type: "checkbox",
              checked: !!c.knobTransparent,
              onChange: (e) => patch({ knobTransparent: e.target.checked }),
            }),
            React.createElement("span", null, "Transparent / LED-lit knob"),
          ),
        c.knobEnabled &&
          React.createElement(
            "div",
            { className: "color-presets-row" },
            TOP_COLOR_PRESETS.map((col) =>
              React.createElement("button", {
                key: col,
                className: "top-color-preset",
                title: col,
                onClick: () => patch({ topColor: col }),
                style: { backgroundColor: col },
              }),
            ),
          ),
        React.createElement(
          "label",
          {
            className: "component-check-row",
            title:
              "Optional finger/ergonomic clearance zone. This can be larger than the visible knob and is used only for warnings.",
          },
          React.createElement("input", {
            type: "checkbox",
            checked: !!c.ergonomicEnabled,
            onChange: (e) => patch({ ergonomicEnabled: e.target.checked }),
          }),
          React.createElement(
            "span",
            null,
            "Use ergonomic clearance in warnings",
          ),
        ),
        c.ergonomicEnabled &&
          React.createElement(NumField, {
            label: "Ergonomic \u00D8 (mm)",
            value:
              c.ergonomicDiameter ??
              Math.max((c.knobDiameter ?? visualKnobDiameter(c)) + 4, 14),
            min: 1,
            onChange: (v) => patch({ ergonomicDiameter: v }),
          }),
        React.createElement(
          "div",
          { className: "btn-row", style: { marginTop: 4 } },
          c.type === "pot16mm" &&
            React.createElement(
              "button",
              {
                style: { fontSize: 11 },
                onClick: () => patch({ knobEnabled: true, knobDiameter: 23 }),
              },
              "Set Davies 1900H (\u00D823mm)",
            ),
          React.createElement(
            "button",
            {
              title:
                "Apply knob/top-cap diameter, ergonomic clearance and top color to all matching parts of the same type.",
              onClick: () =>
                applyToSameType({
                  knobEnabled: c.knobEnabled,
                  knobDiameter: c.knobDiameter,
                  knobTransparent: c.knobTransparent,
                  ergonomicEnabled: c.ergonomicEnabled,
                  ergonomicDiameter: c.ergonomicDiameter,
                  topColor: c.topColor,
                  topHardwareVisible: c.topHardwareVisible,
                }),
            },
            "Apply knob/visual to same type",
          ),
        ),
      ),
    (showColorControls || showFaderControls) &&
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          { className: "section-title", style: { marginTop: 8 } },
          "Top Hardware",
        ),
        React.createElement(
          "label",
          { style: { display: "flex", alignItems: "center", gap: 6 } },
          React.createElement("input", {
            type: "checkbox",
            checked: c.topHardwareVisible !== false,
            onChange: (e) => patch({ topHardwareVisible: e.target.checked }),
          }),
          "Show visual hardware only",
        ),
        isToggleLike &&
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Nut shape"),
            React.createElement(
              "select",
              {
                value: c.nutShape ?? (c.type === "toggle2m" ? "hex" : "circle"),
                onChange: (e) => patch({ nutShape: e.target.value }),
              },
              React.createElement("option", { value: "circle" }, "Circle"),
              React.createElement("option", { value: "hex" }, "Hex"),
            ),
          ),
        c.type === "toggle2m" &&
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Switch function"),
            React.createElement(
              "select",
              {
                value: c.switchFunction ?? "on-off-on",
                onChange: (e) => patch({ switchFunction: e.target.value }),
              },
              React.createElement("option", { value: "on-on" }, "ON-ON"),
              React.createElement(
                "option",
                { value: "on-off-on" },
                "ON-OFF-ON",
              ),
            ),
          ),
        showColorControls &&
          React.createElement(
            "div",
            { className: "field-row" },
            React.createElement("label", null, "Color"),
            React.createElement("input", {
              type: "color",
              value: topColor(c),
              onChange: (e) => patch({ topColor: e.target.value }),
            }),
          ),
        showColorControls &&
          React.createElement(
            "div",
            { className: "color-presets-row" },
            TOP_COLOR_PRESETS.map((col) =>
              React.createElement("button", {
                key: col,
                className: "top-color-preset",
                title: col,
                onClick: () => patch({ topColor: col }),
                style: { backgroundColor: col },
              }),
            ),
          ),
        showFaderControls &&
          React.createElement(
            "div",
            { className: "field-pair" },
            React.createElement(NumField, {
              label: "Handle W (mm)",
              value: c.faderHandleW ?? Math.max(7, (c.frontW ?? 9) * 1.15),
              min: 1,
              onChange: (v) => patch({ faderHandleW: v }),
            }),
            React.createElement(NumField, {
              label: "Handle H (mm)",
              value: c.faderHandleH ?? 5,
              min: 1,
              onChange: (v) => patch({ faderHandleH: v }),
            }),
          ),
        React.createElement(
          "div",
          { className: "btn-row", style: { marginTop: 4 } },
          React.createElement(
            "button",
            {
              title:
                "Apply top-hardware visibility, color and fader handle dimensions to all matching parts of the same type.",
              onClick: () =>
                applyToSameType({
                  topHardwareVisible: c.topHardwareVisible,
                  topColor: c.topColor,
                  faderHandleW: c.faderHandleW,
                  faderHandleH: c.faderHandleH,
                }),
            },
            "Apply visual to same type",
          ),
        ),
      ),
    React.createElement(
      "div",
      {
        className: "advanced-disclosure-toggle",
        role: "button",
        tabIndex: 0,
        onClick: () => setAdvancedOpen((o) => !o),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") setAdvancedOpen((o) => !o);
        },
      },
      React.createElement(
        "span",
        { className: advancedOpen ? "adv-caret open" : "adv-caret" },
        "▶",
      ),
      "Advanced",
    ),
    advancedOpen &&
      React.createElement(
        "div",
        { className: "advanced-disclosure-content" },
        React.createElement(
          "div",
          { className: "section-title", style: { marginTop: 4 } },
          "Rear Body",
        ),
        React.createElement(
          "div",
          { className: "front-compact-grid" },
          React.createElement(NumFieldCompact, {
            label: "Width",
            value: c.rearBodyW,
            onChange: (v) => patch({ rearBodyW: v }),
          }),
          React.createElement(NumFieldCompact, {
            label: "Height",
            value: c.rearBodyH,
            onChange: (v) => patch({ rearBodyH: v }),
          }),
          React.createElement(NumFieldCompact, {
            label: "Depth",
            value: c.rearDepth,
            onChange: (v) => patch({ rearDepth: v }),
          }),
        ),
        React.createElement(
          "div",
          { className: "front-compact-grid" },
          React.createElement(NumFieldCompact, {
            label: "Panel min",
            value: c.panelThicknessMin ?? 0,
            onChange: (v) => patch({ panelThicknessMin: v }),
          }),
          React.createElement(NumFieldCompact, {
            label: "Panel max",
            value: c.panelThicknessMax ?? 0,
            onChange: (v) => patch({ panelThicknessMax: v }),
          }),
          React.createElement(NumFieldCompact, {
            label: "Pin KO W",
            value: c.pinKeepoutW ?? 0,
            onChange: (v) => patch({ pinKeepoutW: v }),
          }),
          React.createElement(NumFieldCompact, {
            label: "Pin KO H",
            value: c.pinKeepoutH ?? 0,
            onChange: (v) => patch({ pinKeepoutH: v }),
          }),
        ),
        React.createElement(
          "div",
          { className: "section-title", style: { marginTop: 8 } },
          "Keepout Zone",
        ),
        React.createElement(
          "div",
          { className: "front-compact-grid" },
          React.createElement(NumFieldCompact, {
            label: "KO Width",
            value: c.keepoutW,
            onChange: (v) => patch({ keepoutW: v }),
          }),
          React.createElement(NumFieldCompact, {
            label: "KO Height",
            value: c.keepoutH,
            onChange: (v) => patch({ keepoutH: v }),
          }),
        ),
        React.createElement(
          "div",
          { className: "field-row", style: { marginTop: 6 } },
          React.createElement("label", null, "Notes"),
          React.createElement("textarea", {
            value: c.notes,
            onChange: (e) => patch({ notes: e.target.value }),
          }),
        ),
      ),
    React.createElement(
      "div",
      { className: "btn-row", style: { marginTop: 8 } },
      React.createElement(
        "button",
        { onClick: () => dispatch({ type: "DUPLICATE_SELECTED" }) },
        "Duplicate",
      ),
      React.createElement(
        "button",
        {
          title:
            "Create a text label attached to this component; it moves with the component",
          onClick: () =>
            dispatch({ type: "ADD_TEXT", item: defaultAttachedLabelFor(c) }),
        },
        "Add attached label",
      ),
      isScaleEligibleComponent(c) &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({
                  type: "ADD_SCALE",
                  item: makeCompactKnobScale(c, "0-10"),
                }),
            },
            "Add compact scale 0\u201310",
          ),
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({
                  type: "ADD_SCALE",
                  item: makeCompactKnobScale(c, "-5+5"),
                }),
            },
            "Add compact scale -5\u2026+5",
          ),
          linkedScales.length > 0 &&
            (() => {
              const sc = linkedScales[0];
              return React.createElement(
                "div",
                {
                  style: {
                    marginTop: 8,
                    padding: 6,
                    border: "1px solid #333",
                    borderRadius: 4,
                    gridColumn: "1 / -1",
                  },
                },
                React.createElement(
                  "div",
                  { className: "section-title", style: { marginTop: 0 } },
                  "Scale editor",
                ),
                React.createElement(
                  "div",
                  { className: "field-pair" },
                  React.createElement(NumField, {
                    label: "Radius",
                    value: sc.radius,
                    min: 0.1,
                    onChange: (v) =>
                      dispatch({
                        type: "UPDATE_SCALE",
                        id: sc.id,
                        patch: { radius: v },
                      }),
                  }),
                  React.createElement(NumField, {
                    label: "Ticks",
                    value: sc.ticks,
                    min: 2,
                    step: 1,
                    onChange: (v) =>
                      dispatch({
                        type: "UPDATE_SCALE",
                        id: sc.id,
                        patch: { ticks: Math.max(2, Math.round(v)) },
                      }),
                  }),
                ),
                React.createElement(
                  "div",
                  { className: "field-pair" },
                  React.createElement(NumField, {
                    label: "Start \u00B0",
                    value: sc.startAngle,
                    step: 5,
                    min: -360,
                    onChange: (v) =>
                      dispatch({
                        type: "UPDATE_SCALE",
                        id: sc.id,
                        patch: { startAngle: v },
                      }),
                  }),
                  React.createElement(NumField, {
                    label: "End \u00B0",
                    value: sc.endAngle,
                    step: 5,
                    min: -360,
                    onChange: (v) =>
                      dispatch({
                        type: "UPDATE_SCALE",
                        id: sc.id,
                        patch: { endAngle: v },
                      }),
                  }),
                ),
                React.createElement(
                  "div",
                  { className: "field-pair" },
                  React.createElement(NumField, {
                    label: "Major every",
                    value: sc.majorEvery,
                    min: 1,
                    step: 1,
                    onChange: (v) =>
                      dispatch({
                        type: "UPDATE_SCALE",
                        id: sc.id,
                        patch: { majorEvery: Math.max(1, Math.round(v)) },
                      }),
                  }),
                  React.createElement(NumField, {
                    label: "Tick len",
                    value: sc.tickLength,
                    min: 0.1,
                    onChange: (v) =>
                      dispatch({
                        type: "UPDATE_SCALE",
                        id: sc.id,
                        patch: { tickLength: v },
                      }),
                  }),
                ),
                React.createElement(
                  "div",
                  { className: "field-row" },
                  React.createElement("label", null, "Labels"),
                  React.createElement(
                    "select",
                    {
                      value: sc.labelMode,
                      onChange: (e) =>
                        dispatch({
                          type: "UPDATE_SCALE",
                          id: sc.id,
                          patch: { labelMode: e.target.value },
                        }),
                    },
                    React.createElement(
                      "option",
                      { value: "none" },
                      "No numbers",
                    ),
                    React.createElement(
                      "option",
                      { value: "0-10" },
                      "0\u201310",
                    ),
                    React.createElement(
                      "option",
                      { value: "-5+5" },
                      "-5\u2026+5",
                    ),
                  ),
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () =>
                      state.selected.forEach((id) => {
                        const cc = state.components.find((x) => x.id === id);
                        if (
                          cc &&
                          isPotLike(cc) &&
                          !state.scaleItems.some((x) => x.componentId === id)
                        )
                          dispatch({
                            type: "ADD_SCALE",
                            item: makeCompactKnobScale(cc, sc.labelMode),
                          });
                      }),
                  },
                  "Apply same scale to selected pots",
                ),
              );
            })(),
          linkedScales.length > 0 &&
            React.createElement(
              "button",
              {
                className: "danger",
                title: `Remove ${linkedScales.length} scale${linkedScales.length === 1 ? "" : "s"} linked to this potentiometer`,
                onClick: () =>
                  dispatch({
                    type: "DELETE_SCALES_FOR_COMPONENT",
                    componentId: c.id,
                  }),
              },
              "Remove scale",
              linkedScales.length === 1 ? "" : "s",
            ),
        ),
      showFaderControls &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({
                  type: "ADD_SCALE",
                  item: makeFaderScale(c, "left", "0-10"),
                }),
            },
            "Add left fader scale 0\u201310",
          ),
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({
                  type: "ADD_SCALE",
                  item: makeFaderScale(c, "right", "0-10"),
                }),
            },
            "Add right fader scale 0\u201310",
          ),
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({
                  type: "ADD_SCALE",
                  item: makeFaderScale(c, "left", "-5+5"),
                }),
            },
            "Add left fader scale -5\u2026+5",
          ),
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({
                  type: "ADD_SCALE",
                  item: makeFaderScale(c, "right", "-5+5"),
                }),
            },
            "Add right fader scale -5\u2026+5",
          ),
          linkedScales.length > 0 &&
            React.createElement(
              "button",
              {
                className: "danger",
                onClick: () =>
                  dispatch({
                    type: "DELETE_SCALES_FOR_COMPONENT",
                    componentId: c.id,
                  }),
              },
              "Remove fader scale",
              linkedScales.length === 1 ? "" : "s",
            ),
        ),
      React.createElement(
        "button",
        {
          className: "danger",
          onClick: () => dispatch({ type: "DELETE_SELECTED" }),
        },
        "Delete",
      ),
    ),
  );
}
