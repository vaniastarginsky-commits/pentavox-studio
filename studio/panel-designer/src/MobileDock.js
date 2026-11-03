// Extracted component declarations from index.html.
// ModeQuickSwitch
function ModeQuickSwitch() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const modes = ["front", "rear", "drill", "combined"];
  return React.createElement(
    "div",
    {
      className: "canvas-mode-switch",
      onMouseDown: (e) => e.stopPropagation(),
      onTouchStart: (e) => e.stopPropagation(),
    },
    modes.map((m) =>
      React.createElement(
        "button",
        {
          key: m,
          className: state.viewMode === m ? "active" : "",
          onClick: () => dispatch({ type: "SET_VIEW_MODE", mode: m }),
        },
        m,
      ),
    ),
  );
}

// MobileQuickAdd
function MobileQuickAdd({ hidden }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const widthMM = panelWidthMM(state.panel);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const parts = [...COMPONENT_LIBRARY, ...state.customParts].filter((def) => {
    const category = def.category ?? inferCategoryForType(def.type);
    const hay =
      `${def.name} ${def.manufacturer || ""} ${def.partNumber || ""} ${category}`.toLowerCase();
    return (
      (cat === "all" || category === cat) &&
      (!q.trim() || hay.includes(q.trim().toLowerCase()))
    );
  });
  function add(def) {
    dispatch({
      type: "ADD_COMPONENT",
      def,
      x: snapToGrid(widthMM / 2, state.grid.size),
      y: snapToGrid(PANEL_HEIGHT_MM / 2, state.grid.size),
    });
    setOpen(false);
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { className: `mobile-quick-add ${hidden ? "hidden" : ""}` },
      React.createElement(
        "button",
        { title: "Quick add component", onClick: () => setOpen((v) => !v) },
        "\uFF0B Add",
      ),
    ),
    open &&
      !hidden &&
      ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className: "mobile-quick-add-menu",
            onPointerDown: (e) => e.stopPropagation(),
          },
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              },
            },
            React.createElement(
              "div",
              { className: "section-title", style: { margin: 0 } },
              "Quick Add",
            ),
            React.createElement(
              "button",
              { onClick: () => setOpen(false) },
              "Close",
            ),
          ),
          React.createElement(
            "div",
            { className: "search-row" },
            React.createElement("input", {
              type: "text",
              placeholder: "Search parts\u2026",
              value: q,
              onChange: (e) => setQ(e.target.value),
            }),
            React.createElement("button", { onClick: () => setQ("") }, "Clear"),
          ),
          React.createElement(
            "select",
            {
              className: "mini-input",
              value: cat,
              onChange: (e) => setCat(e.target.value),
            },
            React.createElement("option", { value: "all" }, "All categories"),
            React.createElement("option", { value: "potentiometer" }, "Pots"),
            React.createElement("option", { value: "jack" }, "Jacks"),
            React.createElement(
              "option",
              { value: "switch" },
              "Switches/buttons",
            ),
            React.createElement("option", { value: "led" }, "LED"),
            React.createElement("option", { value: "encoder" }, "Encoders"),
            React.createElement("option", { value: "fader" }, "Faders"),
            React.createElement("option", { value: "custom" }, "Custom"),
          ),
          React.createElement(
            "div",
            { className: "quick-add-grid" },
            parts.map((def, i) =>
              React.createElement(
                "button",
                {
                  key: `${def.name}-${i}`,
                  className: "quick-add-item",
                  onClick: () => add(def),
                },
                React.createElement(
                  "span",
                  { className: "qa-title" },
                  def.name,
                ),
                React.createElement(
                  "span",
                  { className: "qa-meta" },
                  def.holeType === "slot"
                    ? `${def.holeDiameter}×${def.slotLength} mm`
                    : def.holeType === "rect"
                      ? `${def.holeW ?? def.frontW}×${def.holeH ?? def.frontH} mm`
                      : `Ø${def.holeDiameter} mm`,
                ),
              ),
            ),
          ),
        ),
        document.body,
      ),
  );
}

// CanvasQuickAddDock
function CanvasQuickAddDock({
  hidden,
  focusMode,
  previewMode,
  onToggleFocus,
  onTogglePreviewMode,
  onOpenShortcuts,
  touchMode,
  onSetTouchMode,
  onOpenExport,
  onOpenTemplates,
  onOpenLocalProjects,
  onOpenProductionCheck,
  onToggleLeftPanel,
  onToggleRightPanel,
  leftPanelOpen,
  rightPanelOpen,
  warnings,
  showTouchHitboxes,
  onToggleTouchHitboxes,
  showSafeZones,
  onToggleSafeZones,
  mobileFineMode = false,
  onToggleMobileFineMode,
  mobileProtectMode = false,
  onToggleMobileProtectMode,
  mobileOneHandMode = "off",
  onSetMobileOneHandMode,
  autosaveStatus = "",
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [dockSwipeStart, setDockSwipeStart] = useState(null);
  const [restoreSwipeStart, setRestoreSwipeStart] = useState(null);
  useEffect(() => {
    const openEditSheet = () => {
      setDockCollapsed(false);
      setMobileSheet("edit");
    };
    const openAddSheet = () => {
      setOpen(false);
      setMobileSheet(null);
      setDockCollapsed(false);
      AppCommands.closeLeftPanel();
      window.setTimeout(() => AppCommands.openComponentLibraryPicker(), 80);
    };
    const openViewSheet = () => {
      setDockCollapsed(false);
      setMobileSheet("view");
    };
    const openMoreSheet = () => {
      setDockCollapsed(false);
      setMobileSheet("more");
    };
    const hideDock = () => {
      setMobileSheet(null);
      setDockCollapsed(false);
    };
    window.addEventListener("mobile-open-part-sheet", openEditSheet);
    window.addEventListener("mobile-open-add-sheet", openAddSheet);
    window.addEventListener("mobile-open-view-sheet", openViewSheet);
    window.addEventListener("mobile-open-more-sheet", openMoreSheet);
    window.addEventListener("mobile-hide-main-dock", hideDock);
    return () => {
      window.removeEventListener("mobile-open-part-sheet", openEditSheet);
      window.removeEventListener("mobile-open-add-sheet", openAddSheet);
      window.removeEventListener("mobile-open-view-sheet", openViewSheet);
      window.removeEventListener("mobile-open-more-sheet", openMoreSheet);
      window.removeEventListener("mobile-hide-main-dock", hideDock);
    };
  }, []);
  const widthMM = panelWidthMM(state.panel);
  const [mobileAddQuery, setMobileAddQuery] = useState("");
  const [mobileAddCategory, setMobileAddCategory] = useState("all");
  const commonTypes = [
    "pot9mm",
    "jack",
    "slimjack",
    "toggle",
    "led3mm",
    "encoder",
    "fader20",
    "fader20led",
    "tactled",
    "trimmer6mm",
    "slideSwitchMini",
    "customrect",
  ];
  const commonParts = sortComponentDefs(
    commonTypes
      .map((t) => COMPONENT_LIBRARY.find((c) => c.type === t))
      .filter(Boolean),
  );
  const allMobileParts = useMemo(() => {
    const seen = new Set();
    const all = [...COMPONENT_LIBRARY, ...state.customParts].filter((def) => {
      const key = `${def.type}:${def.name}:${def.partNumber || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const sorted = sortComponentDefs(all);
    const q = mobileAddQuery.trim().toLowerCase();
    return sorted.filter((def) => {
      const cat = def.category ?? inferCategoryForType(def.type);
      const verified =
        (def.verificationStatus || "approximate") !== "approximate";
      const matchesCategory =
        mobileAddCategory === "all" ||
        (mobileAddCategory === "verified"
          ? verified
          : cat === mobileAddCategory);
      const hay =
        `${def.name} ${def.type} ${cat || ""} ${def.manufacturer || ""} ${def.partNumber || ""}`.toLowerCase();
      return matchesCategory && (!q || hay.includes(q));
    });
  }, [state.customParts, mobileAddQuery, mobileAddCategory]);
  const [mobileTemplateQuery, setMobileTemplateQuery] = useState("");
  const [mobileTemplateArmedId, setMobileTemplateArmedId] = useState(null);
  useEffect(() => {
    if (!mobileTemplateArmedId) return;
    const t = window.setTimeout(() => setMobileTemplateArmedId(null), 3200);
    return () => window.clearTimeout(t);
  }, [mobileTemplateArmedId]);
  const [mobileSpacingH, setMobileSpacingH] = useState("10");
  const [mobileSpacingV, setMobileSpacingV] = useState("10");
  const [selectionSlotA, setSelectionSlotA] = useState([]);
  const [selectionSlotB, setSelectionSlotB] = useState([]);
  const mobileTemplates = useMemo(() => {
    const q = mobileTemplateQuery.trim().toLowerCase();
    const records = [...loadFactoryTemplateRecords(), ...loadLocalTemplates()];
    return records
      .filter((r) => {
        if (!q) return true;
        return `${r.name} ${r.kind} ${r.description || ""}`
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 24);
  }, [mobileTemplateQuery]);
  const selectedMobileIds = state.selected.filter((id) =>
    state.components.some((c) => c.id === id),
  );
  const restoreSelectionSlot = (ids) => {
    const valid = ids.filter((id) => state.components.some((c) => c.id === id));
    if (valid.length) dispatch({ type: "SELECT", ids: valid, additive: false });
  };
  const applyExactSpacing = (axis, value) => {
    const spacing = parseFloat(value);
    if (!Number.isFinite(spacing) || spacing < 0) return;
    dispatch({ type: "SET_SELECTED_SPACING", axis, spacing });
  };
  useEffect(() => {
    const openQuickLabel = () => {
      setOpen(false);
      setDockCollapsed(false);
      setMobileSheet("edit");
      window.setTimeout(() => {
        const input = document.querySelector(
          '[data-mobile-label-input="true"]',
        );
        if (input) {
          input.focus();
          input.select();
        }
      }, 80);
    };
    window.addEventListener("mobile-quick-label-edit", openQuickLabel);
    return () =>
      window.removeEventListener("mobile-quick-label-edit", openQuickLabel);
  }, []);
  function partKindLabel(def) {
    if (def.type === "fader20led") return "LED Slider";
    if (def.category === "fader" || isFaderLike(def)) return "Fader";
    if (
      def.category === "potentiometer" ||
      def.type === "trimmer6mm" ||
      isPotLike(def)
    )
      return def.type === "trimmer6mm" ? "Trim Pot" : "Pot";
    if (def.category === "jack" || isJackLike(def)) return "Jack";
    if (def.category === "led" || def.type === "led3mm") return "LED";
    if (def.type === "tactled") return "LED Button";
    if (def.category === "switch" || def.type === "slideSwitchMini")
      return def.type === "slideSwitchMini" ? "Slide Switch" : "Switch";
    if (def.type === "customrect") return "Cutout";
    if (def.type === "custom") return "Hole";
    return def.category || def.type;
  }
  function mobilePartTitle(def) {
    return shortPartName(def);
  }
  function partMeta(def) {
    const status =
      def.verificationStatus === "datasheet"
        ? "datasheet"
        : def.verificationStatus === "measured"
          ? "measured"
          : def.verificationStatus === "production"
            ? "production"
            : "approx";
    const size =
      def.holeType === "slot"
        ? `${def.holeDiameter} × ${def.slotLength ?? def.holeDiameter} mm slot`
        : def.holeType === "rect"
          ? `${def.holeW ?? def.frontW ?? def.holeDiameter} × ${def.holeH ?? def.frontH ?? def.holeDiameter} mm cut`
          : `Ø ${def.holeDiameter} mm`;
    return `${size} · ${status}`;
  }
  const hard = warnings.filter((w) => w.severity === "error").length;
  const warn = warnings.length - hard;
  const unverified = state.components.filter((c) => !isPartVerified(c)).length;
  const layerLabels = [
    ["grid", "Grid"],
    ["componentHoles", "Holes"],
    ["frontShapes", "Front"],
    ["topHardware", "Hardware"],
    ["rearBodies", "Bodies"],
    ["rearKeepouts", "Keepouts"],
    ["pcb", "PCB"],
    ["text", "Text"],
    ["artwork", "Artwork"],
    ["labels", "Labels"],
  ];
  const selectedMobileItems = state.components.filter((c) =>
    state.selected.includes(c.id),
  );
  const selectedMobile =
    selectedMobileItems.length === 1 ? selectedMobileItems[0] : null;
  const selectedMobileCount = selectedMobileItems.length;
  const selectedMobileAllLocked =
    selectedMobileItems.length > 0 &&
    selectedMobileItems.every((c) => !!c.locked);
  const selectedMobileSomeLocked = selectedMobileItems.some((c) => !!c.locked);
  const selectedMobileScales = selectedMobile
    ? state.scaleItems.filter((sc) => sc.componentId === selectedMobile.id)
    : [];
  const selectedMobileCategory = selectedMobile
    ? (selectedMobile.category ?? inferCategoryForType(selectedMobile.type))
    : null;
  const selectedMobileCanKnobScale =
    !!selectedMobile &&
    (selectedMobileCategory === "potentiometer" ||
      selectedMobileCategory === "encoder" ||
      isPotLike(selectedMobile));
  const selectedMobileCanFaderScale =
    !!selectedMobile &&
    (selectedMobileCategory === "fader" || isFaderLike(selectedMobile));
  function add(def) {
    dispatch({
      type: "ADD_COMPONENT",
      def,
      x: snapToGrid(widthMM / 2, state.grid.size),
      y: snapToGrid(PANEL_HEIGHT_MM / 2, state.grid.size),
    });
    setOpen(false);
    setMobileSheet(null);
    onSetTouchMode("edit");
  }
  function openLibraryPickerFromMobileAdd() {
    setOpen(false);
    setMobileSheet(null);
    setDockCollapsed(false);
    AppCommands.closeLeftPanel();
    window.setTimeout(() => AppCommands.openComponentLibraryPicker(), 80);
  }
  function openSheet(sheet) {
    if (sheet === "add") {
      openLibraryPickerFromMobileAdd();
      return;
    }
    setOpen(false);
    setDockCollapsed(false);
    setMobileSheet((v) => (v === sheet ? null : sheet));
  }
  function onDockTouchStart(e) {
    setDockSwipeStart(null);
  }
  function onDockTouchEnd(e) {
    setDockSwipeStart(null);
  }
  function onRestoreTouchStart(e) {
    setRestoreSwipeStart(null);
  }
  function onRestoreTouchEnd(e) {
    setRestoreSwipeStart(null);
  }
  const [isMobileDockViewport, setIsMobileDockViewport] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(max-width: 900px)").matches,
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobileDockViewport(!!mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return null; // replaced by CanvasToolRail on mobile
  const sheetTitle =
    mobileSheet === "view"
      ? "View & layers"
      : mobileSheet === "edit"
        ? "Mobile inspector"
        : "More tools";
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      {
        className: `mobile-main-dock ${hidden ? "hidden" : ""} ${mobileOneHandMode === "left" ? "one-hand-left" : mobileOneHandMode === "right" ? "one-hand-right" : ""}`,
        onMouseDown: (e) => e.stopPropagation(),
        onTouchStart: (e) => {
          e.stopPropagation();
          onDockTouchStart(e);
        },
        onTouchEnd: (e) => {
          e.stopPropagation();
          onDockTouchEnd(e);
        },
      },
      React.createElement(
        "button",
        {
          onClick: openLibraryPickerFromMobileAdd,
          title: "Open Component Library picker",
        },
        React.createElement("b", null, "\uFF0B"),
        React.createElement("span", null, "Add"),
      ),
      React.createElement(
        "button",
        {
          className: touchMode === "select" ? "active" : "",
          "aria-pressed": touchMode === "select",
          onClick: () =>
            onSetTouchMode(touchMode === "select" ? "edit" : "select"),
          title:
            touchMode === "select"
              ? "Multi-select is on; tap to return to single edit"
              : "Single edit mode; tap to enable multi-select",
        },
        React.createElement("b", null, touchMode === "select" ? "☑" : "✎"),
        React.createElement(
          "span",
          null,
          touchMode === "select" ? "Multi ON" : "Single",
        ),
      ),
      React.createElement(
        "button",
        {
          className: mobileSheet === "edit" ? "active" : "",
          disabled: selectedMobileCount === 0,
          onClick: () => openSheet("edit"),
        },
        React.createElement("b", null, "\u270E"),
        React.createElement("span", null, "Part"),
      ),
      React.createElement(
        "button",
        {
          className: mobileSheet === "view" ? "active" : "",
          onClick: () => openSheet("view"),
        },
        React.createElement("b", null, "\u25C9"),
        React.createElement("span", null, "View"),
      ),
      React.createElement(
        "button",
        {
          className: mobileSheet === "more" ? "active" : "",
          onClick: () => openSheet("more"),
        },
        React.createElement("b", null, "\u2022\u2022\u2022"),
        React.createElement("span", null, "More"),
      ),
    ),
    false &&
      dockCollapsed &&
      !hidden &&
      React.createElement(
        "button",
        {
          className: "mobile-dock-restore",
          onMouseDown: (e) => e.stopPropagation(),
          onTouchStart: (e) => {
            e.stopPropagation();
            onRestoreTouchStart(e);
          },
          onTouchEnd: (e) => {
            e.stopPropagation();
            onRestoreTouchEnd(e);
          },
          onClick: () => setDockCollapsed(false),
          title: "Show bottom toolbar",
        },
        "\u203A",
      ),
    mobileSheet &&
      React.createElement(
        "div",
        {
          className: "mobile-sheet-backdrop",
          onMouseDown: () => setMobileSheet(null),
        },
        React.createElement(
          "div",
          {
            className: "mobile-bottom-sheet",
            onMouseDown: (e) => e.stopPropagation(),
            onTouchStart: (e) => e.stopPropagation(),
          },
          React.createElement("div", { className: "mobile-sheet-handle" }),
          React.createElement(
            "div",
            { className: "mobile-sheet-head" },
            React.createElement("strong", null, sheetTitle),
            React.createElement(
              "button",
              { onClick: () => setMobileSheet(null) },
              "Close",
            ),
          ),
          mobileSheet === "view" &&
            React.createElement(
              React.Fragment,
              null,
              React.createElement(
                "div",
                { className: "mobile-sheet-section compact-first" },
                React.createElement(
                  "div",
                  { className: "mobile-sheet-label" },
                  "Clean view",
                ),
                React.createElement(
                  "button",
                  {
                    className: `mobile-perf-button ${previewMode ? "active" : ""}`,
                    onClick: onTogglePreviewMode,
                  },
                  React.createElement("span", {
                    className: "mobile-toggle-dot",
                  }),
                  previewMode ? "Clean view on" : "Hide editing UI",
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-segment-grid four" },
                ["front", "rear", "drill", "combined"].map((m) =>
                  React.createElement(
                    "button",
                    {
                      key: m,
                      className: state.viewMode === m ? "active" : "",
                      onClick: () =>
                        dispatch({ type: "SET_VIEW_MODE", mode: m }),
                    },
                    m,
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-sheet-section" },
                React.createElement(
                  "div",
                  { className: "mobile-sheet-label" },
                  "Grid size",
                ),
                React.createElement(
                  "div",
                  { className: "mobile-segment-grid five" },
                  [0.25, 0.5, 1, 2.5, 5].map((g) =>
                    React.createElement(
                      "button",
                      {
                        key: g,
                        className: state.grid.size === g ? "active" : "",
                        onClick: () =>
                          dispatch({ type: "SET_GRID_SIZE", size: g }),
                      },
                      g,
                    ),
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-sheet-section" },
                React.createElement(
                  "div",
                  { className: "mobile-sheet-label" },
                  "Layer presets",
                ),
                React.createElement(
                  "div",
                  { className: "mobile-segment-grid four" },
                  React.createElement(
                    "button",
                    {
                      onClick: () =>
                        dispatch({
                          type: "APPLY_LAYER_PRESET",
                          preset: "visual",
                        }),
                    },
                    "Visual",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () =>
                        dispatch({
                          type: "APPLY_LAYER_PRESET",
                          preset: "mechanical",
                        }),
                    },
                    "Mech",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () =>
                        dispatch({
                          type: "APPLY_LAYER_PRESET",
                          preset: "production",
                        }),
                    },
                    "Prod",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () =>
                        dispatch({
                          type: "APPLY_LAYER_PRESET",
                          preset: "debug",
                        }),
                    },
                    "All",
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-sheet-section" },
                React.createElement(
                  "div",
                  { className: "mobile-sheet-label" },
                  "Hardware render",
                ),
                React.createElement(
                  "div",
                  {
                    className: "mobile-hardware-controls",
                    onPointerDown: (e) => e.stopPropagation(),
                    onTouchStart: (e) => e.stopPropagation(),
                    onClick: (e) => e.stopPropagation(),
                  },
                  React.createElement(
                    "div",
                    { className: "mobile-hardware-button-grid" },
                    ["auto", "classic", "realistic", "off"].map((mode) => {
                      const setMode = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dispatch({ type: "SET_HARDWARE_RENDER_MODE", mode });
                      };
                      return React.createElement(
                        "button",
                        {
                          key: mode,
                          type: "button",
                          className:
                            (state.hardwareRenderMode || "auto") === mode
                              ? "active"
                              : "",
                          onTouchEnd: setMode,
                          onPointerUp: setMode,
                          onClick: setMode,
                        },
                        mode === "realistic"
                          ? "Realistic"
                          : mode.charAt(0).toUpperCase() + mode.slice(1),
                      );
                    }),
                  ),
                  React.createElement(
                    "label",
                    {
                      className: `mobile-perf-checkbox ${state.mobilePerformanceMode !== false ? "active" : ""}`,
                      onPointerDown: (e) => e.stopPropagation(),
                      onTouchStart: (e) => e.stopPropagation(),
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
                    React.createElement("span", {
                      className: "mobile-perf-checkbox-box",
                      "aria-hidden": "true",
                    }),
                    React.createElement(
                      "span",
                      { className: "mobile-perf-checkbox-text" },
                      React.createElement("b", null, "Performance mode"),
                      React.createElement(
                        "small",
                        null,
                        state.mobilePerformanceMode !== false
                          ? "ON · faster Auto/classic while moving"
                          : "OFF · richer realistic idle render",
                      ),
                    ),
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-layer-grid" },
                layerLabels.map(([k, label]) =>
                  React.createElement(
                    "label",
                    { key: k, className: state.layerVisibility[k] ? "on" : "" },
                    React.createElement("input", {
                      type: "checkbox",
                      checked: state.layerVisibility[k],
                      onChange: (e) =>
                        dispatch({
                          type: "SET_LAYER_VISIBILITY",
                          key: k,
                          value: e.target.checked,
                        }),
                    }),
                    React.createElement("span", null, label),
                  ),
                ),
              ),
            ),
          mobileSheet === "edit" &&
            React.createElement(
              React.Fragment,
              null,
              selectedMobileCount === 0
                ? React.createElement(
                    "div",
                    { className: "mobile-sheet-note" },
                    "Select one or more components to edit them here.",
                  )
                : React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      "div",
                      {
                        className: `mobile-selected-card ${selectedMobile ? ((selectedMobile.verificationStatus || "approximate") === "approximate" ? "warn" : "ok") : "ok"}`,
                      },
                      React.createElement(
                        "strong",
                        null,
                        selectedMobile
                          ? selectedMobile.ref ||
                              selectedMobile.label ||
                              selectedMobile.name
                          : `${selectedMobileCount} selected`,
                      ),
                      React.createElement(
                        "span",
                        null,
                        selectedMobile
                          ? selectedMobile.name
                          : `${selectedMobileCount} components`,
                      ),
                      React.createElement(
                        "small",
                        null,
                        selectedMobile
                          ? `${selectedMobile.manufacturer || "Unknown maker"}${selectedMobile.partNumber ? `·${selectedMobile.partNumber}` : ""} · ${selectedMobile.verificationStatus || "approximate"}`
                          : `${selectedMobileSomeLocked ? "some locked" : "unlocked"} · batch actions`,
                      ),
                    ),
                    React.createElement(
                      "div",
                      { className: "mobile-action-grid" },
                      React.createElement(
                        "button",
                        {
                          onClick: () =>
                            dispatch({ type: "DUPLICATE_SELECTED" }),
                        },
                        "Duplicate",
                      ),
                      React.createElement(
                        "button",
                        {
                          onClick: () =>
                            dispatch({ type: "ROTATE_SELECTED", degrees: 90 }),
                        },
                        "Rot 90",
                      ),
                      React.createElement(
                        "button",
                        {
                          onClick: () =>
                            dispatch({
                              type: "LOCK_SELECTED",
                              locked: !selectedMobileAllLocked,
                            }),
                        },
                        selectedMobileAllLocked ? "Unlock" : "Lock",
                      ),
                      React.createElement(
                        "button",
                        {
                          className: "danger",
                          onClick: () => {
                            dispatch({ type: "DELETE_SELECTED" });
                            setMobileSheet(null);
                          },
                        },
                        "Delete",
                      ),
                    ),
                    selectedMobile
                      ? React.createElement(
                          "div",
                          { className: "mobile-sheet-section" },
                          React.createElement(
                            "div",
                            { className: "mobile-sheet-label" },
                            "Position",
                          ),
                          React.createElement(
                            "div",
                            { className: "mobile-edit-grid" },
                            React.createElement(
                              "label",
                              null,
                              "X mm",
                              React.createElement("input", {
                                type: "number",
                                step: state.grid.size,
                                value: Number(selectedMobile.x.toFixed(3)),
                                onChange: (e) =>
                                  dispatch({
                                    type: "UPDATE_COMPONENT",
                                    id: selectedMobile.id,
                                    patch: {
                                      x: parseFloat(e.target.value) || 0,
                                    },
                                  }),
                              }),
                            ),
                            React.createElement(
                              "label",
                              null,
                              "Y mm",
                              React.createElement("input", {
                                type: "number",
                                step: state.grid.size,
                                value: Number(selectedMobile.y.toFixed(3)),
                                onChange: (e) =>
                                  dispatch({
                                    type: "UPDATE_COMPONENT",
                                    id: selectedMobile.id,
                                    patch: {
                                      y: parseFloat(e.target.value) || 0,
                                    },
                                  }),
                              }),
                            ),
                            React.createElement(
                              "label",
                              null,
                              "Rotation",
                              React.createElement("input", {
                                type: "number",
                                step: 5,
                                value: Number(
                                  (selectedMobile.rotation || 0).toFixed(1),
                                ),
                                onChange: (e) =>
                                  dispatch({
                                    type: "UPDATE_COMPONENT",
                                    id: selectedMobile.id,
                                    patch: {
                                      rotation: parseFloat(e.target.value) || 0,
                                    },
                                  }),
                              }),
                            ),
                            React.createElement(
                              "label",
                              null,
                              "Label",
                              React.createElement("input", {
                                "data-mobile-label-input": "true",
                                type: "text",
                                value: selectedMobile.label || "",
                                onChange: (e) =>
                                  dispatch({
                                    type: "UPDATE_COMPONENT",
                                    id: selectedMobile.id,
                                    patch: { label: e.target.value },
                                  }),
                              }),
                            ),
                            React.createElement(
                              "label",
                              null,
                              "Label position",
                              React.createElement(
                                "select",
                                {
                                  value:
                                    selectedMobile.labelPosition || "bottom",
                                  onChange: (e) =>
                                    dispatch({
                                      type: "UPDATE_COMPONENT",
                                      id: selectedMobile.id,
                                      patch: { labelPosition: e.target.value },
                                    }),
                                },
                                React.createElement(
                                  "option",
                                  { value: "bottom" },
                                  "Bottom",
                                ),
                                React.createElement(
                                  "option",
                                  { value: "top" },
                                  "Top",
                                ),
                                React.createElement(
                                  "option",
                                  { value: "left" },
                                  "Left",
                                ),
                                React.createElement(
                                  "option",
                                  { value: "right" },
                                  "Right",
                                ),
                              ),
                            ),
                            React.createElement(
                              "label",
                              null,
                              "Lock",
                              React.createElement(
                                "select",
                                {
                                  value: selectedMobile.locked
                                    ? "locked"
                                    : "free",
                                  onChange: (e) =>
                                    dispatch({
                                      type: "UPDATE_COMPONENT",
                                      id: selectedMobile.id,
                                      patch: {
                                        locked: e.target.value === "locked",
                                      },
                                    }),
                                },
                                React.createElement(
                                  "option",
                                  { value: "free" },
                                  "Unlocked",
                                ),
                                React.createElement(
                                  "option",
                                  { value: "locked" },
                                  "Locked",
                                ),
                              ),
                            ),
                          ),
                        )
                      : React.createElement(
                          "div",
                          { className: "mobile-sheet-note" },
                          "Batch mode: Duplicate, Rotate, Lock/Unlock and Delete apply to all selected components.",
                        ),
                    selectedMobileCount > 1 &&
                      React.createElement(
                        "div",
                        { className: "mobile-sheet-section" },
                        React.createElement(
                          "div",
                          { className: "mobile-sheet-label" },
                          "Align / exact spacing",
                        ),
                        React.createElement(
                          "div",
                          { className: "mobile-align-grid" },
                          React.createElement(
                            "button",
                            {
                              onClick: () =>
                                dispatch({ type: "ALIGN", axis: "left" }),
                            },
                            "Left",
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: () =>
                                dispatch({ type: "ALIGN", axis: "centerV" }),
                            },
                            "Center X",
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: () =>
                                dispatch({ type: "ALIGN", axis: "right" }),
                            },
                            "Right",
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: () =>
                                dispatch({ type: "ALIGN", axis: "top" }),
                            },
                            "Top",
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: () =>
                                dispatch({ type: "ALIGN", axis: "centerH" }),
                            },
                            "Center Y",
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: () =>
                                dispatch({ type: "ALIGN", axis: "bottom" }),
                            },
                            "Bottom",
                          ),
                          React.createElement(
                            "button",
                            {
                              disabled: selectedMobileCount < 3,
                              onClick: () =>
                                dispatch({ type: "DISTRIBUTE", axis: "h" }),
                            },
                            "Dist H",
                          ),
                          React.createElement(
                            "button",
                            {
                              disabled: selectedMobileCount < 3,
                              onClick: () =>
                                dispatch({ type: "DISTRIBUTE", axis: "v" }),
                            },
                            "Dist V",
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: () => dispatch({ type: "DESELECT_ALL" }),
                            },
                            "Clear",
                          ),
                        ),
                        React.createElement(
                          "div",
                          {
                            className: "mobile-spacing-row",
                            style: { marginTop: 8 },
                          },
                          React.createElement(
                            "label",
                            null,
                            "Horizontal spacing",
                            React.createElement("input", {
                              type: "number",
                              step: "0.25",
                              value: mobileSpacingH,
                              onChange: (e) =>
                                setMobileSpacingH(e.target.value),
                            }),
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: () =>
                                applyExactSpacing("h", mobileSpacingH),
                            },
                            "Apply H",
                          ),
                          React.createElement(
                            "button",
                            {
                              disabled: selectedMobileCount < 3,
                              onClick: () =>
                                dispatch({ type: "DISTRIBUTE", axis: "h" }),
                            },
                            "Even H",
                          ),
                        ),
                        React.createElement(
                          "div",
                          {
                            className: "mobile-spacing-row",
                            style: { marginTop: 6 },
                          },
                          React.createElement(
                            "label",
                            null,
                            "Vertical spacing",
                            React.createElement("input", {
                              type: "number",
                              step: "0.25",
                              value: mobileSpacingV,
                              onChange: (e) =>
                                setMobileSpacingV(e.target.value),
                            }),
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: () =>
                                applyExactSpacing("v", mobileSpacingV),
                            },
                            "Apply V",
                          ),
                          React.createElement(
                            "button",
                            {
                              disabled: selectedMobileCount < 3,
                              onClick: () =>
                                dispatch({ type: "DISTRIBUTE", axis: "v" }),
                            },
                            "Even V",
                          ),
                        ),
                      ),
                    selectedMobile &&
                      React.createElement(
                        "div",
                        { className: "mobile-sheet-section" },
                        React.createElement(
                          "div",
                          { className: "mobile-sheet-label" },
                          "Mechanical summary",
                        ),
                        React.createElement(
                          "div",
                          { className: "mobile-dim-list" },
                          React.createElement(
                            "div",
                            null,
                            React.createElement("span", null, "Hole"),
                            React.createElement(
                              "b",
                              null,
                              selectedMobile.holeType === "slot"
                                ? `${selectedMobile.holeDiameter} × ${selectedMobile.slotLength ?? selectedMobile.holeDiameter} mm`
                                : selectedMobile.holeType === "rect"
                                  ? `${selectedMobile.holeW ?? selectedMobile.frontW ?? selectedMobile.holeDiameter} × ${selectedMobile.holeH ?? selectedMobile.frontH ?? selectedMobile.holeDiameter} mm`
                                  : `Ø ${selectedMobile.holeDiameter} mm`,
                            ),
                          ),
                          React.createElement(
                            "div",
                            null,
                            React.createElement("span", null, "Rear body"),
                            React.createElement(
                              "b",
                              null,
                              selectedMobile.rearBodyW,
                              " \u00D7 ",
                              selectedMobile.rearBodyH,
                              " mm",
                            ),
                          ),
                          React.createElement(
                            "div",
                            null,
                            React.createElement("span", null, "Depth"),
                            React.createElement(
                              "b",
                              null,
                              selectedMobile.rearDepth,
                              " mm",
                            ),
                          ),
                          React.createElement(
                            "div",
                            null,
                            React.createElement("span", null, "Keepout"),
                            React.createElement(
                              "b",
                              null,
                              selectedMobile.keepoutW,
                              " \u00D7 ",
                              selectedMobile.keepoutH,
                              " mm",
                            ),
                          ),
                        ),
                      ),
                    selectedMobile &&
                      React.createElement(
                        "div",
                        { className: "mobile-sheet-section" },
                        React.createElement(
                          "div",
                          { className: "mobile-sheet-label" },
                          "Scales",
                        ),
                        React.createElement(
                          "div",
                          { className: "mobile-scale-card" },
                          React.createElement(
                            "div",
                            null,
                            React.createElement(
                              "strong",
                              null,
                              selectedMobileScales.length,
                            ),
                            React.createElement(
                              "span",
                              null,
                              "linked scale",
                              selectedMobileScales.length === 1 ? "" : "s",
                            ),
                          ),
                          selectedMobileCanKnobScale ||
                            selectedMobileCanFaderScale
                            ? React.createElement(
                                React.Fragment,
                                null,
                                selectedMobileCanKnobScale &&
                                  React.createElement(
                                    "div",
                                    { className: "mobile-action-grid" },
                                    React.createElement(
                                      "button",
                                      {
                                        onClick: () =>
                                          dispatch({
                                            type: "ADD_SCALE",
                                            item: makeCompactKnobScale(
                                              selectedMobile,
                                              "0-10",
                                            ),
                                          }),
                                      },
                                      "Knob 0\u201310",
                                    ),
                                    React.createElement(
                                      "button",
                                      {
                                        onClick: () =>
                                          dispatch({
                                            type: "ADD_SCALE",
                                            item: makeCompactKnobScale(
                                              selectedMobile,
                                              "-5+5",
                                            ),
                                          }),
                                      },
                                      "Knob -5\u2026+5",
                                    ),
                                  ),
                                selectedMobileCanFaderScale &&
                                  React.createElement(
                                    "div",
                                    { className: "mobile-action-grid" },
                                    React.createElement(
                                      "button",
                                      {
                                        onClick: () =>
                                          dispatch({
                                            type: "ADD_SCALE",
                                            item: makeFaderScale(
                                              selectedMobile,
                                              "left",
                                              "0-10",
                                            ),
                                          }),
                                      },
                                      "Left 0\u201310",
                                    ),
                                    React.createElement(
                                      "button",
                                      {
                                        onClick: () =>
                                          dispatch({
                                            type: "ADD_SCALE",
                                            item: makeFaderScale(
                                              selectedMobile,
                                              "right",
                                              "0-10",
                                            ),
                                          }),
                                      },
                                      "Right 0\u201310",
                                    ),
                                    React.createElement(
                                      "button",
                                      {
                                        onClick: () =>
                                          dispatch({
                                            type: "ADD_SCALE",
                                            item: makeFaderScale(
                                              selectedMobile,
                                              "left",
                                              "-5+5",
                                            ),
                                          }),
                                      },
                                      "Left -5\u2026+5",
                                    ),
                                    React.createElement(
                                      "button",
                                      {
                                        onClick: () =>
                                          dispatch({
                                            type: "ADD_SCALE",
                                            item: makeFaderScale(
                                              selectedMobile,
                                              "right",
                                              "-5+5",
                                            ),
                                          }),
                                      },
                                      "Right -5\u2026+5",
                                    ),
                                  ),
                                selectedMobileScales[0] &&
                                  React.createElement(
                                    "div",
                                    { className: "mobile-scale-editor" },
                                    React.createElement(
                                      "label",
                                      null,
                                      "Ticks",
                                      React.createElement("input", {
                                        type: "number",
                                        min: 2,
                                        step: 1,
                                        value: selectedMobileScales[0].ticks,
                                        onChange: (e) =>
                                          dispatch({
                                            type: "UPDATE_SCALE",
                                            id: selectedMobileScales[0].id,
                                            patch: {
                                              ticks: Math.max(
                                                2,
                                                Math.round(
                                                  parseFloat(e.target.value) ||
                                                    2,
                                                ),
                                              ),
                                            },
                                          }),
                                      }),
                                    ),
                                    React.createElement(
                                      "label",
                                      null,
                                      "Major every",
                                      React.createElement("input", {
                                        type: "number",
                                        min: 1,
                                        step: 1,
                                        value:
                                          selectedMobileScales[0].majorEvery,
                                        onChange: (e) =>
                                          dispatch({
                                            type: "UPDATE_SCALE",
                                            id: selectedMobileScales[0].id,
                                            patch: {
                                              majorEvery: Math.max(
                                                1,
                                                Math.round(
                                                  parseFloat(e.target.value) ||
                                                    1,
                                                ),
                                              ),
                                            },
                                          }),
                                      }),
                                    ),
                                    React.createElement(
                                      "label",
                                      null,
                                      "Tick length",
                                      React.createElement("input", {
                                        type: "number",
                                        min: 0.2,
                                        step: 0.1,
                                        value:
                                          selectedMobileScales[0].tickLength,
                                        onChange: (e) =>
                                          dispatch({
                                            type: "UPDATE_SCALE",
                                            id: selectedMobileScales[0].id,
                                            patch: {
                                              tickLength: Math.max(
                                                0.2,
                                                parseFloat(e.target.value) ||
                                                  0.2,
                                              ),
                                            },
                                          }),
                                      }),
                                    ),
                                    React.createElement(
                                      "label",
                                      null,
                                      "Labels",
                                      React.createElement(
                                        "select",
                                        {
                                          value:
                                            selectedMobileScales[0].labelMode,
                                          onChange: (e) =>
                                            dispatch({
                                              type: "UPDATE_SCALE",
                                              id: selectedMobileScales[0].id,
                                              patch: {
                                                labelMode: e.target.value,
                                              },
                                            }),
                                        },
                                        React.createElement(
                                          "option",
                                          { value: "none" },
                                          "None",
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
                                    selectedMobileScales[0].kind === "fader" &&
                                      React.createElement(
                                        "label",
                                        null,
                                        "Side",
                                        React.createElement(
                                          "select",
                                          {
                                            value:
                                              selectedMobileScales[0].side ||
                                              "left",
                                            onChange: (e) =>
                                              dispatch({
                                                type: "UPDATE_SCALE",
                                                id: selectedMobileScales[0].id,
                                                patch: { side: e.target.value },
                                              }),
                                          },
                                          React.createElement(
                                            "option",
                                            { value: "left" },
                                            "Left",
                                          ),
                                          React.createElement(
                                            "option",
                                            { value: "right" },
                                            "Right",
                                          ),
                                        ),
                                      ),
                                  ),
                                selectedMobileScales.length > 0 &&
                                  React.createElement(
                                    "button",
                                    {
                                      className: "danger",
                                      onClick: () =>
                                        dispatch({
                                          type: "DELETE_SCALES_FOR_COMPONENT",
                                          componentId: selectedMobile.id,
                                        }),
                                    },
                                    "Remove linked scales",
                                  ),
                              )
                            : React.createElement(
                                "div",
                                { className: "mobile-sheet-note" },
                                "Scales are available for pots, encoders and faders.",
                              ),
                        ),
                      ),
                    selectedMobile &&
                      (selectedMobile.verificationStatus || "approximate") ===
                        "approximate" &&
                      React.createElement(
                        "div",
                        { className: "mobile-sheet-note warn" },
                        "Approximate part \u2014 verify datasheet/measured dimensions before production.",
                      ),
                  ),
            ),
          mobileSheet === "templates" &&
            React.createElement(
              React.Fragment,
              null,
              React.createElement(
                "div",
                { className: "mobile-sheet-note" },
                "Fast template browser with realistic preview. Panel templates replace the layout; block templates append at the panel center.",
              ),
              React.createElement(
                "div",
                { className: "mobile-template-browser" },
                React.createElement("input", {
                  className: "mobile-add-search",
                  value: mobileTemplateQuery,
                  onChange: (e) => setMobileTemplateQuery(e.target.value),
                  placeholder: "Search templates\u2026",
                }),
                React.createElement(
                  "div",
                  { className: "mobile-template-list" },
                  mobileTemplates.length === 0 &&
                    React.createElement(
                      "div",
                      { className: "mobile-sheet-note" },
                      "No templates found.",
                    ),
                  mobileTemplates.map((rec) => {
                    const tpl = JSON.parse(rec.data);
                    const previewComponents = tpl.components || [];
                    return React.createElement(
                      "button",
                      {
                        key: rec.id,
                        className: `mobile-template-item ${mobileTemplateArmedId === rec.id ? "armed" : ""}`,
                        onClick: () => {
                          if (tpl.kind === "panel") {
                            if (
                              state.components.length &&
                              mobileTemplateArmedId !== rec.id
                            ) {
                              setMobileTemplateArmedId(rec.id);
                              return;
                            }
                            dispatch({
                              type: "SET_PANEL_HP",
                              hp: tpl.panel.widthHP,
                            });
                            dispatch({
                              type: "LOAD_PRESET",
                              components: tpl.components.map((c) => ({
                                ...c,
                                id: crypto.randomUUID(),
                              })),
                            });
                            setMobileTemplateArmedId(null);
                            setMobileSheet(null);
                          } else {
                            const anchorX = tpl.anchor?.x || widthMM / 2;
                            const anchorY =
                              tpl.anchor?.y || PANEL_HEIGHT_MM / 2;
                            const comps = tpl.components.map((c) => ({
                              ...c,
                              id: crypto.randomUUID(),
                              x: c.x + widthMM / 2 - anchorX,
                              y: c.y + PANEL_HEIGHT_MM / 2 - anchorY,
                            }));
                            dispatch({
                              type: "ADD_COMPONENTS",
                              components: comps,
                              selectedIds: comps.map((c) => c.id),
                            });
                            setMobileTemplateArmedId(null);
                            setMobileSheet(null);
                          }
                        },
                      },
                      React.createElement(TemplatePreviewSVG, {
                        components: previewComponents,
                        width: tpl.panel?.widthHP
                          ? panelWidthMM(tpl.panel)
                          : widthMM,
                        height: PANEL_HEIGHT_MM,
                      }),
                      React.createElement(
                        "span",
                        null,
                        React.createElement("b", null, rec.name),
                        React.createElement(
                          "span",
                          null,
                          rec.kind,
                          " \u00B7 ",
                          previewComponents.length,
                          " parts",
                          rec.factory ? " · factory" : " · local",
                        ),
                      ),
                      React.createElement("small", null, "Use"),
                    );
                  }),
                ),
              ),
            ),
          mobileSheet === "more" &&
            React.createElement(
              React.Fragment,
              null,
              React.createElement(
                "div",
                {
                  className: `mobile-dfm-card ${hard ? "error" : warn || unverified ? "warn" : "ok"}`,
                },
                React.createElement(
                  "strong",
                  null,
                  hard
                    ? "DFM CHECK"
                    : warn || unverified
                      ? "DFM CAUTION"
                      : "DFM OK",
                ),
                React.createElement(
                  "span",
                  null,
                  hard,
                  " errors \u00B7 ",
                  warn,
                  " warnings \u00B7 ",
                  unverified,
                  " unverified",
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-sheet-section compact-first" },
                React.createElement(
                  "div",
                  { className: "mobile-sheet-label" },
                  "Project files",
                ),
                React.createElement(
                  "div",
                  { className: "mobile-action-grid" },
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        exportJSON(state);
                      },
                    },
                    "Save project file",
                  ),
                  React.createElement(
                    "label",
                    {
                      className: "mobile-file-open-button",
                      htmlFor: "project-file-input",
                      onClick: () => {
                        window.setTimeout(() => setMobileSheet(null), 500);
                      },
                    },
                    "Load project file",
                  ),
                  React.createElement(
                    "button",
                    { onClick: () => saveProjectToBrowser(state) },
                    "Save to browser",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        setMobileSheet(null);
                        window.setTimeout(() => onOpenLocalProjects(), 0);
                      },
                    },
                    "Open local projects",
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-sheet-section" },
                React.createElement(
                  "div",
                  { className: "mobile-sheet-label" },
                  "Tools",
                ),
                React.createElement(
                  "div",
                  { className: "mobile-action-grid" },
                  React.createElement(
                    "button",
                    {
                      className: focusMode ? "active" : "",
                      onClick: onToggleFocus,
                    },
                    focusMode ? "Exit focus" : "Focus mode",
                  ),
                  React.createElement(
                    "button",
                    { onClick: () => openSheet("add") },
                    "Component picker",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        setMobileSheet(null);
                        onOpenExport();
                      },
                    },
                    "Export preview",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        setMobileSheet(null);
                        window.setTimeout(() => onOpenTemplates(), 0);
                      },
                    },
                    "Templates",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        setMobileSheet(null);
                        onOpenProductionCheck();
                      },
                    },
                    "Production check",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        setMobileSheet(null);
                        onOpenShortcuts();
                      },
                    },
                    "Shortcuts",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: leftPanelOpen ? "active" : "",
                      onClick: onToggleLeftPanel,
                    },
                    "Left panel",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: rightPanelOpen ? "active" : "",
                      onClick: onToggleRightPanel,
                    },
                    "Right panel",
                  ),
                  React.createElement(
                    "button",
                    { onClick: () => onSetTouchMode("ruler") },
                    "Ruler mode",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: showTouchHitboxes ? "active" : "",
                      onClick: onToggleTouchHitboxes,
                    },
                    showTouchHitboxes ? "Hide hitboxes" : "Show hitboxes",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: showSafeZones ? "active" : "",
                      onClick: onToggleSafeZones,
                    },
                    showSafeZones ? "Hide safe zones" : "Show safe zones",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        dispatch({ type: "DESELECT_ALL" });
                      },
                    },
                    "Clear select",
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-sheet-section" },
                React.createElement(
                  "div",
                  { className: "mobile-sheet-label" },
                  "Selection memory",
                ),
                React.createElement(
                  "div",
                  { className: "mobile-action-grid" },
                  React.createElement(
                    "button",
                    {
                      disabled: selectedMobileIds.length === 0,
                      onClick: () => setSelectionSlotA(selectedMobileIds),
                    },
                    "Save A",
                  ),
                  React.createElement(
                    "button",
                    {
                      disabled: selectionSlotA.length === 0,
                      onClick: () => restoreSelectionSlot(selectionSlotA),
                    },
                    "Restore A (",
                    selectionSlotA.length,
                    ")",
                  ),
                  React.createElement(
                    "button",
                    {
                      disabled: selectedMobileIds.length === 0,
                      onClick: () => setSelectionSlotB(selectedMobileIds),
                    },
                    "Save B",
                  ),
                  React.createElement(
                    "button",
                    {
                      disabled: selectionSlotB.length === 0,
                      onClick: () => restoreSelectionSlot(selectionSlotB),
                    },
                    "Restore B (",
                    selectionSlotB.length,
                    ")",
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "mobile-sheet-note" },
                  "Slots remember selected component IDs while this file is open. Useful for switching between jacks, knobs and labels.",
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-sheet-section" },
                React.createElement(
                  "div",
                  { className: "mobile-sheet-label" },
                  "Undo history",
                ),
                React.createElement(
                  "div",
                  { className: "mobile-action-grid" },
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
                      disabled:
                        state.history.length === 0 && state.future.length === 0,
                      onClick: () => dispatch({ type: "CLEAR_HISTORY" }),
                    },
                    "Clear history",
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "mobile-history-list", style: { marginTop: 7 } },
                  state.history
                    .slice(-6)
                    .reverse()
                    .map((h, i) => {
                      const idx = state.history.length - 1 - i;
                      return React.createElement(
                        "button",
                        {
                          key: `hist-${idx}`,
                          onClick: () =>
                            dispatch({
                              type: "RESTORE_HISTORY_INDEX",
                              index: idx,
                            }),
                        },
                        React.createElement(
                          "span",
                          null,
                          "Restore snapshot -",
                          i + 1,
                        ),
                        React.createElement(
                          "small",
                          null,
                          h.components.length,
                          " parts \u00B7 ",
                          h.panel.widthHP,
                          "HP",
                        ),
                      );
                    }),
                  state.history.length === 0 &&
                    React.createElement(
                      "div",
                      { className: "mobile-sheet-note" },
                      "No undo snapshots yet.",
                    ),
                ),
              ),
              React.createElement(
                "div",
                { className: "mobile-sheet-section" },
                React.createElement(
                  "div",
                  { className: "mobile-sheet-label" },
                  "Export preflight",
                ),
                React.createElement(
                  "div",
                  {
                    className: `mobile-workflow-card ${hard ? "error" : warn || unverified ? "warn" : "ok"}`,
                  },
                  React.createElement(
                    "strong",
                    null,
                    hard
                      ? "Not ready for production"
                      : warn || unverified
                        ? "Review before export"
                        : "Ready for export",
                  ),
                  React.createElement(
                    "span",
                    null,
                    state.panel.widthHP,
                    "HP \u00B7 ",
                    state.components.length,
                    " components \u00B7 ",
                    hard,
                    " errors \u00B7 ",
                    warn,
                    " warnings \u00B7 ",
                    unverified,
                    " approximate",
                  ),
                  React.createElement(
                    "small",
                    null,
                    "Use Production check for the full list, or Export preview when this card is clean.",
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "mobile-action-grid" },
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        setMobileSheet(null);
                        onOpenProductionCheck();
                      },
                    },
                    "Open full check",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        setMobileSheet(null);
                        onOpenExport();
                      },
                    },
                    "Export preview",
                  ),
                ),
              ),
            ),
        ),
      ),
  );
}
