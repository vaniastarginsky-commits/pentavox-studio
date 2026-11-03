// Extracted component declarations from index.html.
// LayersPanel
function LayersPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const labels = [
    ["grid", "Grid"],
    ["panelOutline", "Panel"],
    ["mountingHoles", "Mount"],
    ["artwork", "Art"],
    ["text", "Text"],
    ["labels", "Labels"],
    ["componentHoles", "Holes"],
    ["frontShapes", "Front"],
    ["topHardware", "Hardware"],
    ["rearBodies", "Bodies"],
    ["rearKeepouts", "Keepouts"],
    ["pcb", "PCB"],
  ];
  const visibleCount = labels.filter(([k]) => state.layerVisibility[k]).length;
  function setAll(value) {
    const patch = {};
    labels.forEach(([k]) => (patch[k] = value));
    dispatch({ type: "SET_LAYER_VISIBILITY_BULK", patch });
  }
  return React.createElement(
    "div",
    { className: "section compact-layer-manager" },
    React.createElement("div", { className: "section-title" }, "Layers"),
    React.createElement(
      "div",
      { className: "layer-compact-presets" },
      React.createElement(
        "button",
        {
          title: "Visual view: artwork, labels, text, top hardware",
          onClick: () =>
            dispatch({ type: "APPLY_LAYER_PRESET", preset: "visual" }),
        },
        "Visual",
      ),
      React.createElement(
        "button",
        {
          title: "Mechanical view: holes, rear bodies, keepouts, PCB",
          onClick: () =>
            dispatch({ type: "APPLY_LAYER_PRESET", preset: "mechanical" }),
        },
        "Mech",
      ),
      React.createElement(
        "button",
        {
          title: "Production view: outline and cut/drill geometry only",
          onClick: () =>
            dispatch({ type: "APPLY_LAYER_PRESET", preset: "production" }),
        },
        "Prod",
      ),
      React.createElement(
        "button",
        { onClick: () => setAll(true), title: "Show all" },
        "All",
      ),
      React.createElement(
        "button",
        { onClick: () => setAll(false), title: "Hide all" },
        "None",
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row compact-render-row", style: { marginTop: 10 } },
      React.createElement("label", null, "Artwork view"),
      React.createElement(
        "select",
        {
          value: state.artworkPreviewMode || "composite",
          onChange: (event) =>
            dispatch({
              type: "SET_ARTWORK_PREVIEW_MODE",
              mode: event.target.value,
            }),
        },
        React.createElement("option", { value: "composite" }, "Final"),
        React.createElement("option", { value: "copper" }, "Copper / F.Cu"),
        React.createElement(
          "option",
          { value: "mask" },
          "Mask openings / F.Mask",
        ),
        React.createElement(
          "option",
          { value: "silkscreen" },
          "Silkscreen / F.SilkS",
        ),
        React.createElement("option", { value: "material" }, "Panel material"),
      ),
    ),
    React.createElement(
      "div",
      { className: "layer-grid" },
      labels.map(([k, l]) => {
        const visible = !!state.layerVisibility[k];
        return React.createElement(
          "label",
          {
            key: k,
            className: `layer-pill ${visible ? "on" : "off"}`,
            title: visible ? `${l} — visible` : `${l} — hidden`,
          },
          React.createElement("input", {
            type: "checkbox",
            checked: visible,
            onChange: (e) =>
              dispatch({
                type: "SET_LAYER_VISIBILITY",
                key: k,
                value: e.target.checked,
              }),
          }),
          React.createElement("span", null, l),
        );
      }),
    ),
    React.createElement(
      "div",
      { className: "field-row compact-render-row", style: { marginTop: 10 } },
      React.createElement("label", null, "Hardware render"),
      React.createElement(
        "select",
        {
          value: state.hardwareRenderMode || "auto",
          onChange: (e) =>
            dispatch({
              type: "SET_HARDWARE_RENDER_MODE",
              mode: e.target.value,
            }),
        },
        React.createElement(
          "option",
          { value: "auto" },
          "Auto: realistic idle / classic moving",
        ),
        React.createElement(
          "option",
          { value: "classic" },
          "Classic / fastest",
        ),
        React.createElement(
          "option",
          { value: "realistic" },
          "Realistic / detailed",
        ),
        React.createElement("option", { value: "off" }, "Off"),
      ),
    ),
    React.createElement(
      "div",
      { className: "compact-layer-topline" },
      React.createElement(
        "label",
        {
          className: "perf-toggle compact",
          title:
            "Performance ON: faster canvas; Auto render uses Classic while moving/zoomed out. OFF: richer Realistic render when idle.",
        },
        React.createElement("input", {
          type: "checkbox",
          checked: state.mobilePerformanceMode !== false,
          onChange: (e) =>
            dispatch({
              type: "SET_MOBILE_PERFORMANCE_MODE",
              value: e.target.checked,
            }),
        }),
        " Performance mode",
      ),
      React.createElement(
        "span",
        null,
        visibleCount,
        "/",
        labels.length,
        " visible",
      ),
    ),
  );
}
