// Canvas tool rail dropdown menu content components.
// Depends on: useAppState, useAppDispatch (appState.js).

function CanvasToolMoreMenu({
  onClose,
  clearanceMode,
  showSafeZones,
  onToggleClearanceMode,
  onToggleSafeZones,
  onOpenProductionCheck,
  onResetView,
}) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", { className: "menu-title" }, "Workspace tools"),
    React.createElement(
      "div",
      { className: "menu-grid" },
      React.createElement(
        "button",
        {
          className: clearanceMode ? "active" : "",
          onClick: onToggleClearanceMode,
        },
        "Clearance",
      ),
      React.createElement(
        "button",
        {
          className: showSafeZones ? "active" : "",
          onClick: onToggleSafeZones,
        },
        showSafeZones ? "Hide safe zones" : "Safe zones",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            onOpenProductionCheck();
            onClose();
          },
        },
        "Production check",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            onResetView();
            onClose();
          },
        },
        "Reset view",
      ),
    ),
    React.createElement(
      "div",
      { className: "menu-note" },
      "Cursor modes are direct buttons on the rail. This menu keeps secondary checks and view reset nearby.",
    ),
  );
}

function CanvasToolViewMenu({
  onClose,
  showSafeZones,
  onToggleSafeZones,
  clearanceMode,
  onToggleClearanceMode,
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", { className: "menu-title" }, "View mode"),
    React.createElement(
      "div",
      { className: "menu-grid two" },
      ["front", "rear", "drill", "combined"].map((m) =>
        React.createElement(
          "button",
          {
            key: m,
            className: state.viewMode === m ? "active" : "",
            onClick: () => {
              dispatch({ type: "SET_VIEW_MODE", mode: m });
              onClose();
            },
          },
          m.charAt(0).toUpperCase() + m.slice(1),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "menu-title", style: { marginTop: 10 } },
      "Render mode",
    ),
    React.createElement(
      "div",
      { className: "menu-grid two" },
      ["auto", "classic", "realistic", "off"].map((mode) =>
        React.createElement(
          "button",
          {
            key: mode,
            className:
              (state.hardwareRenderMode || "auto") === mode ? "active" : "",
            onClick: () => dispatch({ type: "SET_HARDWARE_RENDER_MODE", mode }),
          },
          mode === "realistic"
            ? "Realistic"
            : mode.charAt(0).toUpperCase() + mode.slice(1),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "menu-title", style: { marginTop: 10 } },
      "Overlays",
    ),
    React.createElement(
      "div",
      { className: "menu-grid two" },
      React.createElement(
        "button",
        {
          className: showSafeZones ? "active" : "",
          onClick: onToggleSafeZones,
        },
        showSafeZones ? "Safe zones ON" : "Safe zones",
      ),
      React.createElement(
        "button",
        {
          className: clearanceMode ? "active" : "",
          onClick: onToggleClearanceMode,
        },
        clearanceMode ? "Clearance ON" : "Clearance",
      ),
    ),
  );
}

function CanvasToolSnapMenu({ snapSettings, onSnapSettingsChange }) {
  const state = useAppState();
  const dispatch = useAppDispatch();

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", { className: "menu-title" }, "Grid / Snap"),
    React.createElement(
      "div",
      { className: "menu-grid" },
      React.createElement(
        "select",
        {
          className: "tb-select",
          value: state.grid.size,
          onChange: (e) =>
            dispatch({ type: "SET_GRID_SIZE", size: +e.target.value }),
        },
        React.createElement("option", { value: 0.25 }, "0.25 mm"),
        React.createElement("option", { value: 0.5 }, "0.5 mm"),
        React.createElement("option", { value: 1 }, "1 mm"),
        React.createElement("option", { value: 2.5 }, "2.5 mm"),
        React.createElement("option", { value: 5 }, "5 mm"),
      ),
      React.createElement(
        "button",
        {
          className: state.layerVisibility.grid ? "active" : "",
          onClick: () =>
            dispatch({
              type: "SET_LAYER_VISIBILITY",
              key: "grid",
              value: !state.layerVisibility.grid,
            }),
        },
        state.layerVisibility.grid ? "Grid visible" : "Grid hidden",
      ),
      React.createElement(
        "button",
        {
          className: state.grid.showMajor ? "active" : "",
          onClick: () => dispatch({ type: "TOGGLE_MAJOR_GRID" }),
        },
        "5 mm major grid",
      ),
    ),
    React.createElement(
      "div",
      { className: "menu-title", style: { marginTop: 10 } },
      "Snap",
    ),
    React.createElement(
      "div",
      { className: "menu-grid two" },
      React.createElement(
        "button",
        {
          className: snapSettings.grid ? "active" : "",
          onClick: () =>
            onSnapSettingsChange({ ...snapSettings, grid: !snapSettings.grid }),
        },
        "Grid snap",
      ),
      React.createElement(
        "button",
        {
          className: snapSettings.panelEdges ? "active" : "",
          onClick: () =>
            onSnapSettingsChange({
              ...snapSettings,
              panelEdges: !snapSettings.panelEdges,
            }),
        },
        "Panel edges",
      ),
      React.createElement(
        "button",
        {
          className: snapSettings.pcbEdges ? "active" : "",
          onClick: () =>
            onSnapSettingsChange({
              ...snapSettings,
              pcbEdges: !snapSettings.pcbEdges,
            }),
        },
        "PCB edges",
      ),
      React.createElement(
        "button",
        {
          className: snapSettings.componentCenters ? "active" : "",
          onClick: () =>
            onSnapSettingsChange({
              ...snapSettings,
              componentCenters: !snapSettings.componentCenters,
            }),
        },
        "Centers",
      ),
    ),
    React.createElement(
      "label",
      { style: { marginTop: 8 } },
      "Snap distance (mm)",
    ),
    React.createElement("input", {
      type: "number",
      step: 0.25,
      min: 0.25,
      max: 5,
      value: snapSettings.distance,
      onChange: (e) =>
        onSnapSettingsChange({
          ...snapSettings,
          distance: Math.max(0.25, parseFloat(e.target.value) || 1),
        }),
    }),
    React.createElement(
      "div",
      { className: "menu-note snap-menu-note" },
      "Hold Shift while dragging to snap precisely. Imported cutout centers take priority over the grid.",
    ),
  );
}
