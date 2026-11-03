// Extracted component declarations from index.html.
// RightSidebar
function RightSidebar({
  warnings,
  components,
  open,
  autosaveStatus,
  onRestoreAutosave,
  onClearAutosave,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  topTab,
  setTopTab,
  statusTab,
  setStatusTab,
  inspectTab,
  setInspectTab,
  prodTab,
  setProdTab,
  layersTab,
  setLayersTab,
}) {
  const state = useAppState();
  if (!open)
    return React.createElement("div", {
      className: "sidebar-right closed lazy-unmounted",
      "aria-hidden": "true",
    });
  const propertyPanel = state.selectedTexts?.length
    ? React.createElement(TextPropertiesPanel, null)
    : state.selectedArtwork
      ? React.createElement(ArtworkPropertiesPanel, null)
      : React.createElement(PropertiesPanel, null);
  return React.createElement(
    "div",
    {
      className: "sidebar-right open sidebar-right-tabs",
      onTouchStart: onTouchStart,
      onTouchMove: onTouchMove,
      onTouchEnd: onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
    React.createElement(
      "div",
      {
        className: "right-tab-strip primary",
        role: "group",
        "aria-label": "Inspector section",
      },
      React.createElement(
        "button",
        {
          className: topTab === "status" ? "active" : "",
          onClick: () => setTopTab("status"),
          "aria-pressed": topTab === "status",
        },
        "Status",
      ),
      React.createElement(
        "button",
        {
          className: topTab === "inspect" ? "active" : "",
          onClick: () => setTopTab("inspect"),
          "aria-pressed": topTab === "inspect",
        },
        "Inspect",
      ),
      React.createElement(
        "button",
        {
          className: topTab === "prod" ? "active" : "",
          onClick: () => setTopTab("prod"),
          "aria-pressed": topTab === "prod",
          title: "Production",
        },
        "Prod",
      ),
      React.createElement(
        "button",
        {
          className: topTab === "layers" ? "active" : "",
          onClick: () => setTopTab("layers"),
          "aria-pressed": topTab === "layers",
        },
        "Layers",
      ),
    ),
    topTab === "status" &&
      React.createElement(
        "div",
        { className: "right-tab-page" },
        React.createElement(
          "div",
          {
            className: "right-tab-strip secondary",
            role: "group",
            "aria-label": "Status view",
          },
          React.createElement(
            "button",
            {
              className: statusTab === "layout" ? "active" : "",
              onClick: () => setStatusTab("layout"),
              "aria-pressed": statusTab === "layout",
            },
            "Layout",
          ),
          React.createElement(
            "button",
            {
              className: statusTab === "warnings" ? "active" : "",
              onClick: () => setStatusTab("warnings"),
              "aria-pressed": statusTab === "warnings",
            },
            "Warnings",
          ),
          React.createElement(
            "button",
            {
              className: statusTab === "checks" ? "active" : "",
              onClick: () => setStatusTab("checks"),
              "aria-pressed": statusTab === "checks",
            },
            "Checks",
          ),
        ),
        statusTab === "layout" &&
          React.createElement(LayoutStatusPanel, {
            warnings: warnings,
            components: components,
          }),
        statusTab === "warnings" &&
          React.createElement(WarningsPanel, { warnings: warnings }),
        statusTab === "checks" &&
          React.createElement(
            React.Fragment,
            null,
            React.createElement(ManufacturingCheckPanel, {
              warnings: warnings,
            }),
            React.createElement(SelfCheckPanel, { warnings: warnings }),
          ),
      ),
    topTab === "inspect" &&
      React.createElement(
        "div",
        { className: "right-tab-page" },
        React.createElement(
          "div",
          {
            className: "right-tab-strip secondary",
            role: "group",
            "aria-label": "Inspection view",
          },
          React.createElement(
            "button",
            {
              className: inspectTab === "properties" ? "active" : "",
              onClick: () => setInspectTab("properties"),
              "aria-pressed": inspectTab === "properties",
            },
            "Props",
          ),
          React.createElement(
            "button",
            {
              className: inspectTab === "measure" ? "active" : "",
              onClick: () => setInspectTab("measure"),
              "aria-pressed": inspectTab === "measure",
            },
            "Measure",
          ),
          React.createElement(
            "button",
            {
              className: inspectTab === "history" ? "active" : "",
              onClick: () => setInspectTab("history"),
              "aria-pressed": inspectTab === "history",
            },
            "History",
          ),
        ),
        inspectTab === "properties" && propertyPanel,
        inspectTab === "measure" &&
          React.createElement(MeasurementsPanel, null),
        inspectTab === "history" &&
          React.createElement(
            React.Fragment,
            null,
            React.createElement(SelectionSetsPanel, null),
            React.createElement(UndoHistoryPanel, null),
          ),
      ),
    topTab === "prod" &&
      React.createElement(
        "div",
        { className: "right-tab-page" },
        React.createElement(
          "div",
          {
            className: "right-tab-strip secondary",
            role: "group",
            "aria-label": "Production view",
          },
          React.createElement(
            "button",
            {
              className: prodTab === "output" ? "active" : "",
              onClick: () => setProdTab("output"),
              "aria-pressed": prodTab === "output",
            },
            "Output",
          ),
          React.createElement(
            "button",
            {
              className: prodTab === "pcb" ? "active" : "",
              onClick: () => setProdTab("pcb"),
              "aria-pressed": prodTab === "pcb",
            },
            "PCB",
          ),
          React.createElement(
            "button",
            {
              className: prodTab === "mounts" ? "active" : "",
              onClick: () => setProdTab("mounts"),
              "aria-pressed": prodTab === "mounts",
            },
            "Mounts",
          ),
        ),
        prodTab === "output" &&
          React.createElement(
            React.Fragment,
            null,
            React.createElement(DrillTablePanel, null),
            React.createElement(BOMPanel, null),
            React.createElement(AutosavePanel, {
              status: autosaveStatus,
              onRestore: onRestoreAutosave,
              onClear: onClearAutosave,
            }),
          ),
        prodTab === "pcb" && React.createElement(PCBPanel, null),
        prodTab === "mounts" && React.createElement(MountingHolesPanel, null),
      ),
    topTab === "layers" &&
      React.createElement(
        "div",
        { className: "right-tab-page" },
        React.createElement(
          "div",
          {
            className: "right-tab-strip secondary",
            role: "group",
            "aria-label": "Layer tools",
          },
          React.createElement(
            "button",
            {
              className: layersTab === "layers" ? "active" : "",
              onClick: () => setLayersTab("layers"),
              "aria-pressed": layersTab === "layers",
            },
            "Layers",
          ),
          React.createElement(
            "button",
            {
              className: layersTab === "align" ? "active" : "",
              onClick: () => setLayersTab("align"),
              "aria-pressed": layersTab === "align",
            },
            "Align",
          ),
          React.createElement(
            "button",
            {
              className: layersTab === "assistant" ? "active" : "",
              onClick: () => setLayersTab("assistant"),
              "aria-pressed": layersTab === "assistant",
            },
            "Assistant",
          ),
        ),
        layersTab === "layers" && React.createElement(LayersPanel, null),
        layersTab === "align" && React.createElement(AlignTools, null),
        layersTab === "assistant" &&
          React.createElement(LayoutAssistantPanel, { warnings: warnings }),
      ),
  );
}
