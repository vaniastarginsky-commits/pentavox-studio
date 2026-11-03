// Left sidebar project and panel setup surfaces.
// Extracted from core.js without behavior changes.
function ProjectPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const meta = state.projectMeta;
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement("div", { className: "section-title" }, "Project"),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Project name"),
      React.createElement("input", {
        type: "text",
        value: meta.name,
        onChange: (e) =>
          dispatch({
            type: "UPDATE_PROJECT_META",
            patch: { name: e.target.value },
          }),
      }),
    ),
    React.createElement(
      "div",
      { className: "field-pair" },
      React.createElement(
        "div",
        { className: "field-row" },
        React.createElement("label", null, "Revision"),
        React.createElement("input", {
          type: "text",
          value: meta.revision,
          onChange: (e) =>
            dispatch({
              type: "UPDATE_PROJECT_META",
              patch: { revision: e.target.value },
            }),
        }),
      ),
      React.createElement(
        "div",
        { className: "field-row" },
        React.createElement("label", null, "Author"),
        React.createElement("input", {
          type: "text",
          value: meta.author,
          onChange: (e) =>
            dispatch({
              type: "UPDATE_PROJECT_META",
              patch: { author: e.target.value },
            }),
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Notes"),
      React.createElement("textarea", {
        value: meta.notes,
        onChange: (e) =>
          dispatch({
            type: "UPDATE_PROJECT_META",
            patch: { notes: e.target.value },
          }),
      }),
    ),
    React.createElement(
      "div",
      { style: { color: "#666", fontSize: 10, lineHeight: 1.4 } },
      "Browser saves are convenient, but exported .epanel.json files are the real backup.",
    ),
  );
}

function PanelSettings() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const widthMM = panelWidthMM(state.panel);
  const [customVal, setCustomVal] = useState("");
  const [armedAction, setArmedAction] = useState(null);
  useEffect(() => {
    if (!armedAction) return;
    const t = window.setTimeout(() => setArmedAction(null), 3200);
    return () => window.clearTimeout(t);
  }, [armedAction]);
  function setHP(hp) {
    if (hp > 0) dispatch({ type: "SET_PANEL_HP", hp });
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement("div", { className: "section-title" }, "Panel"),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Standard HP"),
      React.createElement(
        "select",
        {
          className: "tb-select",
          style: { width: "100%" },
          value: STANDARD_HP.includes(state.panel.widthHP)
            ? String(state.panel.widthHP)
            : "custom",
          onChange: (e) => {
            if (e.target.value !== "custom") setHP(Number(e.target.value));
          },
        },
        STANDARD_HP.map((hp) =>
          React.createElement("option", { key: hp, value: hp }, hp, "HP"),
        ),
        React.createElement("option", { value: "custom" }, "Custom"),
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Custom HP"),
      React.createElement(
        "div",
        { className: "panel-custom-hp-row" },
        React.createElement("input", {
          type: "number",
          min: 1,
          max: 84,
          step: 0.1,
          value: customVal !== "" ? customVal : state.panel.widthHP,
          onChange: (e) => setCustomVal(e.target.value),
          onBlur: () => {
            const v = parseFloat(customVal);
            if (!isNaN(v) && v > 0) setHP(v);
            setCustomVal("");
          },
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              const v = parseFloat(customVal);
              if (!isNaN(v) && v > 0) setHP(v);
              setCustomVal("");
            }
          },
          style: { flex: 1 },
        }),
        React.createElement(
          "button",
          {
            onClick: () => {
              const v = parseFloat(customVal);
              if (!isNaN(v) && v > 0) setHP(v);
              setCustomVal("");
            },
          },
          "Set",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Width"),
      React.createElement("span", null, widthMM.toFixed(2), " mm"),
    ),
    React.createElement(
      "div",
      { className: "measurement-row" },
      React.createElement("span", null, "Height"),
      React.createElement("span", null, PANEL_HEIGHT_MM, " mm"),
    ),
    React.createElement(
      "button",
      {
        className: `danger inline-confirm-button ${armedAction === "clear" ? "armed" : ""}`,
        style: { width: "100%", marginTop: 8 },
        disabled: state.components.length === 0,
        title:
          armedAction === "clear"
            ? "Click again to clear all components"
            : "First click arms this action",
        onClick: () => {
          if (armedAction !== "clear") {
            setArmedAction("clear");
            return;
          }
          dispatch({ type: "CLEAR_PANEL" });
          setArmedAction(null);
        },
      },
      armedAction === "clear"
        ? `Confirm clear ${state.components.length}`
        : "Clear Panel",
    ),
    React.createElement(
      "button",
      {
        className: `inline-confirm-button ${armedAction === "new" ? "armed" : ""}`,
        style: { width: "100%", marginTop: 6 },
        title:
          armedAction === "new"
            ? "Click again to start a new blank project"
            : "First click arms this action",
        onClick: () => {
          if (armedAction !== "new") {
            setArmedAction("new");
            return;
          }
          dispatch({ type: "START_NEW_PROJECT" });
          setArmedAction(null);
        },
      },
      armedAction === "new" ? "Confirm new project" : "Start New",
    ),
  );
}

function ComponentLibraryPanel({
  onStartPartPlacement,
  headless = false,
} = {}) {
  const dispatch = useAppDispatch();
  const state = useAppState();
  const allParts = [...COMPONENT_LIBRARY, ...state.customParts];
  const [replaceMode, setReplaceMode] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [partCategory, setPartCategory] = useState("all");
  const [partVerification, setPartVerification] = useState("all");
  const [partHoleRange, setPartHoleRange] = useState("all");
  const [partDepthRange, setPartDepthRange] = useState("all");
  const [partSort, setPartSort] = useState("default");
  const [focusedPart, setFocusedPart] = useState(null);
  const [compareKeys, setCompareKeys] = useState([]);
  const [organizer, setOrganizer] = useState(() => readPartOrganizerStorage());
  const [activeCollection, setActiveCollection] = useState("all");
  const [collectionOnly, setCollectionOnly] = useState(false);
  const [activeTag, setActiveTag] = useState("all");
  const [resetPartsArmed, setResetPartsArmed] = useState(false);
  const [renderLimit, setRenderLimit] = useState(48);
  useEffect(() => {
    if (!resetPartsArmed) return;
    const t = window.setTimeout(() => setResetPartsArmed(false), 3200);
    return () => window.clearTimeout(t);
  }, [resetPartsArmed]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [favoriteKeys, setFavoriteKeys] = useState(() =>
    readStringListStorage(UX_FAVORITE_PARTS_KEY),
  );
  const [recentKeys, setRecentKeys] = useState(() =>
    readStringListStorage(UX_RECENT_PARTS_KEY),
  );
  const triggerRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ left: 330, top: 80 });
  useEffect(() => {
    setRenderLimit(48);
  }, [
    partSearch,
    partCategory,
    partVerification,
    partHoleRange,
    partDepthRange,
    activeCollection,
    collectionOnly,
    activeTag,
    state.customParts.length,
  ]);
  useEffect(() => {
    if (!headless) return;
    function openLibraryFromCanvas() {
      setLibraryOpen(true);
      setRenderLimit((v) => Math.max(v, 48));
    }
    window.addEventListener(
      "open-component-library-picker",
      openLibraryFromCanvas,
    );
    return () =>
      window.removeEventListener(
        "open-component-library-picker",
        openLibraryFromCanvas,
      );
  }, [headless]);
  useEffect(() => {
    if (!libraryOpen) return;
    function updatePos() {
      const r = triggerRef.current?.getBoundingClientRect();
      const left = Math.max(12, Math.round(window.innerWidth / 2 - 312));
      const top = Math.max(96, Math.round(window.innerHeight / 2 - 312));
      setPopoverPos({ left, top });
    }
    updatePos();
    function onKey(e) {
      if (e.key === "Escape") setLibraryOpen(false);
    }
    function onPointerDown(e) {
      const target = e.target;
      if (!target) return;
      if (
        target.closest(".component-library-popover") ||
        target.closest(".component-library-launcher") ||
        target.closest(".app-native-modal-backdrop")
      )
        return;
      setLibraryOpen(false);
    }
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [libraryOpen]);
  const visibleParts = allParts.filter((def) => {
    const q = partSearch.trim().toLowerCase();
    const cat = def.category ?? inferCategoryForType(def.type);
    const key = partStableKey(def);
    const collection = organizer.collections.find(
      (item) => item.id === activeCollection,
    );
    const partTags = Array.isArray(organizer.tags[key])
      ? organizer.tags[key]
      : [];
    const matchesCat =
      partCategory === "all" ||
      cat === partCategory ||
      (partCategory === "favorites" && favoriteKeys.includes(key)) ||
      (partCategory === "recent" && recentKeys.includes(key));
    const status = def.verificationStatus || "approximate";
    const matchesVerification =
      partVerification === "all" ||
      (partVerification === "verified"
        ? status !== "approximate"
        : status === "approximate");
    const hole = Number(def.holeDiameter) || 0;
    const matchesHole =
      partHoleRange === "all" ||
      (partHoleRange === "small" && hole < 3) ||
      (partHoleRange === "medium" && hole >= 3 && hole < 7) ||
      (partHoleRange === "large" && hole >= 7 && hole < 12) ||
      (partHoleRange === "xlarge" && hole >= 12);
    const depth = Number(def.rearDepth) || 0;
    const matchesDepth =
      partDepthRange === "all" ||
      (partDepthRange === "shallow" && depth <= 10) ||
      (partDepthRange === "standard" && depth > 10 && depth <= 20) ||
      (partDepthRange === "deep" && depth > 20);
    const hay =
      `${def.name} ${def.type} ${def.manufacturer || ""} ${def.partNumber || ""} ${cat || ""} ${status} ${partTags.join(" ")}`.toLowerCase();
    return (
      matchesCat &&
      matchesVerification &&
      matchesHole &&
      matchesDepth &&
      (!collection || !collectionOnly || collection.keys.includes(key)) &&
      (activeTag === "all" || partTags.includes(activeTag)) &&
      (!q || hay.includes(q))
    );
  });
  const sortedVisibleParts =
    partSort === "name"
      ? [...visibleParts].sort((a, b) =>
          shortPartName(a).localeCompare(shortPartName(b)),
        )
      : partSort === "manufacturer"
        ? [...visibleParts].sort((a, b) =>
            (a.manufacturer || "Generic").localeCompare(
              b.manufacturer || "Generic",
            ),
          )
        : partSort === "accuracy"
          ? [...visibleParts].sort(
              (a, b) =>
                Number(isPartVerified(b)) - Number(isPartVerified(a)) ||
                shortPartName(a).localeCompare(shortPartName(b)),
            )
          : sortComponentDefs(visibleParts);
  const displayedParts = sortedVisibleParts.slice(0, renderLimit);
  const hiddenPartCount = Math.max(
    0,
    sortedVisibleParts.length - displayedParts.length,
  );
  function refreshLibraryMemory() {
    setRecentKeys(readStringListStorage(UX_RECENT_PARTS_KEY));
    setFavoriteKeys(readStringListStorage(UX_FAVORITE_PARTS_KEY));
  }
  function toggleFavorite(def) {
    const key = partStableKey(def);
    const exists = favoriteKeys.includes(key);
    const next = exists
      ? favoriteKeys.filter((k) => k !== key)
      : [key, ...favoriteKeys].slice(0, 32);
    writeStringListStorage(UX_FAVORITE_PARTS_KEY, next);
    setFavoriteKeys(next);
  }
  const organizerTags = [
    ...new Set(Object.values(organizer.tags).flat().filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  function saveOrganizer(next) {
    writePartOrganizerStorage(next);
    setOrganizer(next);
  }
  async function createCollection() {
    const name = await appTextPrompt({
      title: "New collection",
      subtitle: "Group parts for a module, build, or preferred hardware set.",
      label: "Collection name",
      defaultValue: "",
      confirmText: "Create collection",
    });
    if (!name?.trim()) return;
    const id = `${Date.now()}-${name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`;
    const next = {
      ...organizer,
      collections: [
        ...organizer.collections,
        { id, name: name.trim(), keys: [] },
      ],
    };
    saveOrganizer(next);
    setActiveCollection(id);
  }
  function togglePartInCollection(def) {
    const collection = organizer.collections.find(
      (item) => item.id === activeCollection,
    );
    if (!collection) return;
    const key = partStableKey(def);
    const keys = collection.keys.includes(key)
      ? collection.keys.filter((item) => item !== key)
      : [...collection.keys, key];
    saveOrganizer({
      ...organizer,
      collections: organizer.collections.map((item) =>
        item.id === collection.id ? { ...item, keys } : item,
      ),
    });
  }
  async function editPartTags(def) {
    const key = partStableKey(def);
    const current = Array.isArray(organizer.tags[key])
      ? organizer.tags[key]
      : [];
    const value = await appTextPrompt({
      title: "Part tags",
      subtitle:
        "Use comma-separated tags such as audio, compact, or prototype.",
      label: "Tags",
      defaultValue: current.join(", "),
      confirmText: "Save tags",
    });
    if (value == null) return;
    const tags = [
      ...new Set(
        value
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    ].slice(0, 12);
    saveOrganizer({
      ...organizer,
      tags: { ...organizer.tags, [key]: tags },
    });
  }
  function toggleCompare(def) {
    const key = partStableKey(def);
    setCompareKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current.slice(-1), key],
    );
  }
  function startPlacement(def) {
    rememberRecentPart(def);
    setLibraryOpen(false);
    if (onStartPartPlacement) onStartPartPlacement(def, false);
    else sendPartPlacementEvent(def, false);
    refreshLibraryMemory();
  }
  function addComponent(def) {
    if (replaceMode && state.selected.length > 0) {
      setLibraryOpen(false);
      dispatch({ type: "REPLACE_SELECTED_WITH_PART", def });
      return;
    }
    startPlacement(def);
  }
  async function saveSelectedAsPart() {
    const c = state.components.find((cc) => cc.id === state.selected[0]);
    if (!c) return alert("Select one component first.");
    const name = await appTextPrompt({
      title: "Save custom part",
      subtitle: "Create a reusable part from the selected component geometry.",
      label: "Custom part name",
      defaultValue: c.name + " custom",
      confirmText: "Save part",
    });
    if (!name || !name.trim()) return;
    const { id: _id, label: _label, x: _x, y: _y, rotation: _rot, ...def } = c;
    dispatch({
      type: "ADD_CUSTOM_PART",
      item: sanitizePart({
        ...def,
        name: name.trim(),
        type: "custom",
        category: def.category ?? "custom",
      }),
    });
  }
  function exportParts() {
    const blob = new Blob(
      [
        JSON.stringify(
          { projectVersion: 4, customParts: state.customParts },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eurorack-parts-library.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportAuditCSV() {
    const header = [
      "Name",
      "Type",
      "Category",
      "Status",
      "Manufacturer",
      "Part number",
      "Hole",
      "Front",
      "Rear body",
      "Depth",
      "Keepout",
      "Datasheet",
    ];
    const rows = allParts.map((def) => {
      const hole =
        def.holeType === "slot"
          ? `${def.holeDiameter}x${def.slotLength ?? def.holeDiameter}`
          : def.holeType === "rect"
            ? `${def.holeW ?? def.frontW ?? def.holeDiameter}x${def.holeH ?? def.frontH ?? def.holeDiameter}`
            : `Ø${def.holeDiameter}`;
      const front =
        getFrontShape(def) === "circle"
          ? `Ø${def.frontDiameter}`
          : `${def.frontW ?? def.frontDiameter}x${def.frontH ?? def.frontDiameter}`;
      return [
        def.name,
        def.type,
        def.category ?? inferCategoryForType(def.type),
        def.verificationStatus || "approximate",
        def.manufacturer || "",
        def.partNumber || "",
        hole,
        front,
        `${def.rearBodyW}x${def.rearBodyH}`,
        def.rearDepth,
        `${def.keepoutW}x${def.keepoutH}`,
        def.datasheetUrl || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    downloadTextFile(
      "component-library-audit.csv",
      [header.join(","), ...rows].join("\n"),
      "text/csv",
    );
  }
  function importParts(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result);
        const arr = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.customParts)
            ? raw.customParts
            : [];
        dispatch({
          type: "IMPORT_CUSTOM_PARTS",
          items: arr.map((x) => sanitizePart(x)),
        });
      } catch {
        alert("Could not import parts JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function holeText(def) {
    return def.holeType === "slot"
      ? `${def.holeDiameter}×${def.slotLength ?? def.holeDiameter}`
      : def.holeType === "rect"
        ? `${def.holeW ?? def.frontW}×${def.holeH ?? def.frontH}`
        : `Ø${def.holeDiameter}`;
  }
  const compareParts = compareKeys
    .map((key) => allParts.find((def) => partStableKey(def) === key))
    .filter(Boolean);
  const activeCollectionItem = organizer.collections.find(
    (item) => item.id === activeCollection,
  );
  const popover = libraryOpen
    ? ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className: "component-library-popover",
            style: { top: popoverPos.top },
            onPointerDown: (e) => e.stopPropagation(),
            onClick: (e) => e.stopPropagation(),
            onWheel: (e) => e.stopPropagation(),
          },
          React.createElement(
            "div",
            { className: "component-library-popover-head" },
            React.createElement(
              "div",
              null,
              React.createElement("strong", null, "Component Library"),
              React.createElement(
                "span",
                { className: "component-library-count" },
                displayedParts.length,
                "/",
                sortedVisibleParts.length,
                " parts",
              ),
            ),
            React.createElement(
              "button",
              { onClick: () => setLibraryOpen(false) },
              "\u00D7",
            ),
          ),
          React.createElement(
            "div",
            { className: "component-library-popover-controls" },
            React.createElement("input", {
              className: "mini-input library-search-compact",
              autoFocus: window.innerWidth > 900,
              type: "text",
              placeholder: "Search parts\u2026",
              value: partSearch,
              onChange: (e) => setPartSearch(e.target.value),
            }),
            React.createElement(
              "select",
              {
                className: "mini-input library-category-select-wide",
                value: partCategory,
                onChange: (e) => setPartCategory(e.target.value),
              },
              React.createElement(
                "option",
                { value: "all" },
                "All component types",
              ),
              React.createElement("option", { value: "recent" }, "Recent"),
              React.createElement(
                "option",
                { value: "favorites" },
                "Favorites",
              ),
              React.createElement(
                "option",
                { value: "potentiometer" },
                "Potentiometers",
              ),
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
              "select",
              {
                className: "mini-input library-verification-select",
                value: partVerification,
                onChange: (e) => setPartVerification(e.target.value),
                "aria-label": "Footprint verification",
              },
              React.createElement("option", { value: "all" }, "Any accuracy"),
              React.createElement("option", { value: "verified" }, "Verified"),
              React.createElement(
                "option",
                { value: "approximate" },
                "Approximate",
              ),
            ),
            React.createElement(
              "select",
              {
                className: "mini-input library-size-select",
                value: partHoleRange,
                onChange: (e) => setPartHoleRange(e.target.value),
                "aria-label": "Hole diameter",
              },
              React.createElement("option", { value: "all" }, "Any hole Ø"),
              React.createElement("option", { value: "small" }, "Under 3 mm"),
              React.createElement("option", { value: "medium" }, "3–7 mm"),
              React.createElement("option", { value: "large" }, "7–12 mm"),
              React.createElement("option", { value: "xlarge" }, "12+ mm"),
            ),
            React.createElement(
              "select",
              {
                className: "mini-input library-depth-select",
                value: partDepthRange,
                onChange: (e) => setPartDepthRange(e.target.value),
                "aria-label": "Rear depth",
              },
              React.createElement("option", { value: "all" }, "Any depth"),
              React.createElement(
                "option",
                { value: "shallow" },
                "≤10 mm deep",
              ),
              React.createElement(
                "option",
                { value: "standard" },
                "10–20 mm deep",
              ),
              React.createElement("option", { value: "deep" }, "20+ mm deep"),
            ),
            React.createElement(
              "select",
              {
                className: "mini-input library-sort-select",
                value: partSort,
                onChange: (e) => setPartSort(e.target.value),
                "aria-label": "Sort component library",
              },
              React.createElement(
                "option",
                { value: "default" },
                "Library order",
              ),
              React.createElement("option", { value: "name" }, "Name"),
              React.createElement(
                "option",
                { value: "manufacturer" },
                "Manufacturer",
              ),
              React.createElement(
                "option",
                { value: "accuracy" },
                "Accuracy first",
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "component-library-organizer" },
            React.createElement(
              "select",
              {
                className: "mini-input",
                value: activeCollection,
                onChange: (e) => {
                  setActiveCollection(e.target.value);
                  if (e.target.value === "all") setCollectionOnly(false);
                },
                "aria-label": "Part collection",
              },
              React.createElement(
                "option",
                { value: "all" },
                "All collections",
              ),
              organizer.collections.map((item) =>
                React.createElement(
                  "option",
                  { key: item.id, value: item.id },
                  item.name,
                  ` (${item.keys.length})`,
                ),
              ),
            ),
            React.createElement(
              "button",
              { type: "button", onClick: createCollection },
              "+ Collection",
            ),
            activeCollectionItem &&
              React.createElement(
                "button",
                {
                  type: "button",
                  className: collectionOnly ? "active" : "",
                  onClick: () => setCollectionOnly((value) => !value),
                },
                collectionOnly ? "Show all" : "Show only",
              ),
            React.createElement(
              "select",
              {
                className: "mini-input",
                value: activeTag,
                onChange: (e) => setActiveTag(e.target.value),
                "aria-label": "Part tag",
              },
              React.createElement("option", { value: "all" }, "All tags"),
              organizerTags.map((tag) =>
                React.createElement(
                  "option",
                  { key: tag, value: tag },
                  `#${tag}`,
                ),
              ),
            ),
            activeCollectionItem &&
              React.createElement(
                "span",
                { className: "component-library-organizer-note" },
                collectionOnly
                  ? "Showing collection members"
                  : "Use + on a card to add or remove parts",
              ),
          ),
          React.createElement(
            "div",
            {
              className: "component-library-category-strip",
              role: "toolbar",
              "aria-label": "Component categories",
            },
            [
              ["all", "All"],
              ["recent", "Recent"],
              ["favorites", "Favorites"],
              ["potentiometer", "Pots"],
              ["jack", "Jacks"],
              ["switch", "Switches"],
              ["led", "LEDs"],
              ["encoder", "Encoders"],
              ["fader", "Faders"],
              ["custom", "Custom"],
            ].map(([value, label]) =>
              React.createElement(
                "button",
                {
                  key: value,
                  type: "button",
                  className: partCategory === value ? "active" : "",
                  "aria-pressed": partCategory === value,
                  disabled:
                    (value === "recent" && recentKeys.length === 0) ||
                    (value === "favorites" && favoriteKeys.length === 0),
                  onClick: () => setPartCategory(value),
                },
                label,
              ),
            ),
          ),
          React.createElement(
            "details",
            { className: "library-tools-compact" },
            React.createElement("summary", null, "Tools"),
            React.createElement(
              "label",
              {
                className: "library-replace-compact",
                title:
                  "When enabled, clicking a part replaces the selected components while keeping their ref/label/position/rotation.",
              },
              React.createElement("input", {
                type: "checkbox",
                checked: replaceMode,
                disabled: state.selected.length === 0,
                onChange: (e) => setReplaceMode(e.target.checked),
              }),
              "Replace selected",
            ),
            React.createElement(
              "div",
              { className: "library-action-grid compact" },
              React.createElement(
                "button",
                { onClick: saveSelectedAsPart },
                "Save selected",
              ),
              React.createElement(
                "button",
                {
                  onClick: exportParts,
                  disabled: state.customParts.length === 0,
                },
                "Export custom",
              ),
              React.createElement(
                "button",
                { onClick: exportAuditCSV },
                "Export CSV",
              ),
              React.createElement(
                "button",
                {
                  onClick: () =>
                    document
                      .getElementById("popover-parts-import-input")
                      ?.click(),
                },
                "Import",
              ),
              React.createElement(
                "button",
                {
                  className: `danger inline-confirm-button ${resetPartsArmed ? "armed" : ""}`,
                  disabled: state.customParts.length === 0,
                  title: resetPartsArmed
                    ? "Click again to reset custom parts"
                    : "First click arms this action",
                  onClick: () => {
                    if (!resetPartsArmed) {
                      setResetPartsArmed(true);
                      return;
                    }
                    dispatch({ type: "RESET_CUSTOM_PARTS" });
                    setResetPartsArmed(false);
                  },
                },
                resetPartsArmed ? "Confirm reset" : "Reset",
              ),
              React.createElement("input", {
                id: "popover-parts-import-input",
                type: "file",
                accept: ".json",
                style: { display: "none" },
                onChange: importParts,
              }),
            ),
          ),
          (recentKeys.length > 0 || favoriteKeys.length > 0) &&
            !partSearch.trim() &&
            partCategory === "all" &&
            partVerification === "all" &&
            React.createElement(
              "div",
              { className: "library-memory-row popover-memory-row" },
              favoriteKeys.length > 0 &&
                React.createElement(
                  "div",
                  null,
                  React.createElement("b", null, "Favorites"),
                  favoriteKeys
                    .slice(0, 5)
                    .map((k) => allParts.find((p) => partStableKey(p) === k))
                    .filter(Boolean)
                    .map((p) =>
                      React.createElement(
                        "button",
                        {
                          key: partStableKey(p),
                          onClick: () => addComponent(p),
                        },
                        shortPartName(p),
                      ),
                    ),
                ),
              recentKeys.length > 0 &&
                React.createElement(
                  "div",
                  null,
                  React.createElement("b", null, "Recent"),
                  recentKeys
                    .slice(0, 5)
                    .map((k) => allParts.find((p) => partStableKey(p) === k))
                    .filter(Boolean)
                    .map((p) =>
                      React.createElement(
                        "button",
                        {
                          key: partStableKey(p),
                          onClick: () => addComponent(p),
                        },
                        shortPartName(p),
                      ),
                    ),
                ),
            ),
          visibleParts.length === 0 &&
            React.createElement(
              "div",
              { className: "component-library-empty" },
              "No parts match the filter.",
            ),
          focusedPart &&
            React.createElement(
              "div",
              { className: "component-library-detail" },
              React.createElement(
                "div",
                { className: "component-library-detail-preview" },
                React.createElement(LibraryPartPreview, { def: focusedPart }),
              ),
              React.createElement(
                "div",
                { className: "component-library-detail-copy" },
                React.createElement("strong", null, shortPartName(focusedPart)),
                React.createElement(
                  "span",
                  null,
                  focusedPart.manufacturer || "Generic",
                  focusedPart.partNumber ? ` · ${focusedPart.partNumber}` : "",
                ),
                React.createElement(
                  "div",
                  { className: "component-library-detail-specs" },
                  React.createElement(
                    "b",
                    null,
                    "Cutout ",
                    holeText(focusedPart),
                  ),
                  React.createElement(
                    "b",
                    null,
                    "Front ",
                    getFrontShape(focusedPart) === "circle"
                      ? `Ø${focusedPart.frontDiameter}`
                      : `${focusedPart.frontW ?? focusedPart.frontDiameter}×${focusedPart.frontH ?? focusedPart.frontDiameter}`,
                  ),
                  React.createElement(
                    "b",
                    null,
                    "Body ",
                    `${focusedPart.rearBodyW}×${focusedPart.rearBodyH}`,
                  ),
                  React.createElement(
                    "b",
                    null,
                    `Depth ${focusedPart.rearDepth} mm`,
                  ),
                  React.createElement(
                    "b",
                    null,
                    "Keepout ",
                    `${focusedPart.keepoutW}×${focusedPart.keepoutH}`,
                  ),
                ),
              ),
            ),
          compareParts.length === 2 &&
            React.createElement(
              "div",
              { className: "component-library-compare" },
              React.createElement(
                "div",
                { className: "component-library-compare-head" },
                React.createElement("strong", null, "Compare parts"),
                React.createElement(
                  "button",
                  { type: "button", onClick: () => setCompareKeys([]) },
                  "Clear",
                ),
              ),
              React.createElement(
                "div",
                { className: "component-library-compare-grid" },
                React.createElement("span", null, ""),
                compareParts.map((def) =>
                  React.createElement(
                    "b",
                    { key: partStableKey(def) },
                    shortPartName(def),
                  ),
                ),
                [
                  ["Cutout", (def) => holeText(def)],
                  ["Depth", (def) => `${def.rearDepth} mm`],
                  ["Rear body", (def) => `${def.rearBodyW}×${def.rearBodyH}`],
                  ["Keepout", (def) => `${def.keepoutW}×${def.keepoutH}`],
                ].flatMap(([label, value]) => [
                  React.createElement("span", { key: `${label}-label` }, label),
                  ...compareParts.map((def) =>
                    React.createElement(
                      "span",
                      { key: `${label}-${partStableKey(def)}` },
                      value(def),
                    ),
                  ),
                ]),
              ),
            ),
          React.createElement(
            "div",
            {
              className: "component-icon-grid popover-component-grid",
              role: "list",
              "aria-label": "Component library",
            },
            displayedParts.map((def, idx) =>
              React.createElement(
                "button",
                {
                  key: `${def.name}-${idx}`,
                  type: "button",
                  className: `component-icon-card comp-lib-item real-part-tile ${compareKeys.includes(partStableKey(def)) ? "compare-active" : ""} ${(def.verificationStatus || "approximate") === "approximate" ? "approx" : ""}`,
                  title: `${replaceMode ? "Replace selected component(s) with this part" : "Click to choose, then click the panel to place. Use Multiple to place more."}\n\n${partTooltip(def)}`,
                  onMouseEnter: () => setFocusedPart(def),
                  onFocus: () => setFocusedPart(def),
                  onClick: () => addComponent(def),
                },
                React.createElement(
                  "span",
                  {
                    className: `part-favorite-mini ${favoriteKeys.includes(partStableKey(def)) ? "active" : ""}`,
                    title: favoriteKeys.includes(partStableKey(def))
                      ? "Remove from favorites"
                      : "Add to favorites",
                    onClick: (e) => {
                      e.stopPropagation();
                      toggleFavorite(def);
                    },
                  },
                  "\u2605",
                ),
                React.createElement(
                  "span",
                  {
                    className: `part-compare-mini ${compareKeys.includes(partStableKey(def)) ? "active" : ""}`,
                    title: compareKeys.includes(partStableKey(def))
                      ? "Remove from comparison"
                      : "Compare this part",
                    onClick: (e) => {
                      e.stopPropagation();
                      toggleCompare(def);
                    },
                  },
                  "⇄",
                ),
                activeCollectionItem &&
                  React.createElement(
                    "span",
                    {
                      className: `part-collection-mini ${activeCollectionItem.keys.includes(partStableKey(def)) ? "active" : ""}`,
                      title: activeCollectionItem.keys.includes(
                        partStableKey(def),
                      )
                        ? `Remove from ${activeCollectionItem.name}`
                        : `Add to ${activeCollectionItem.name}`,
                      onClick: (e) => {
                        e.stopPropagation();
                        togglePartInCollection(def);
                      },
                    },
                    "+",
                  ),
                React.createElement(
                  "span",
                  {
                    className: `part-tag-mini ${Array.isArray(organizer.tags[partStableKey(def)]) && organizer.tags[partStableKey(def)].length ? "active" : ""}`,
                    title: "Edit tags",
                    onClick: (e) => {
                      e.stopPropagation();
                      editPartTags(def);
                    },
                  },
                  "#",
                ),
                React.createElement(
                  "span",
                  {
                    className: `component-icon-status ${(def.verificationStatus || "approximate") === "datasheet" ? "verified" : "approximate"}`,
                    title: verificationLabel(def.verificationStatus),
                    "aria-hidden": "true",
                  },
                  (def.verificationStatus || "approximate") === "datasheet"
                    ? "✓"
                    : "~",
                ),
                React.createElement(
                  "span",
                  { className: "component-icon-preview" },
                  React.createElement(LibraryPartPreview, { def: def }),
                ),
                React.createElement(
                  "span",
                  { className: "component-icon-name" },
                  shortPartName(def),
                ),
                React.createElement(
                  "span",
                  { className: "component-icon-meta" },
                  holeText(def),
                ),
                state.customParts.some((p) => p.name === def.name) &&
                  React.createElement(
                    "span",
                    {
                      className: "part-delete-mini",
                      onClick: (e) => {
                        e.stopPropagation();
                        dispatch({
                          type: "DELETE_CUSTOM_PART",
                          name: def.name,
                        });
                      },
                    },
                    "\u00D7",
                  ),
              ),
            ),
          ),
          hiddenPartCount > 0 &&
            React.createElement(
              "button",
              {
                className: "library-load-more",
                onClick: () => setRenderLimit((v) => v + 48),
              },
              "Load more (",
              hiddenPartCount,
              " hidden)",
            ),
        ),
        document.body,
      )
    : null;
  if (headless) return React.createElement(React.Fragment, null, popover);
  return React.createElement(
    "div",
    {
      className: "section component-library-shell",
      "data-component-library": "true",
    },
    React.createElement(
      "div",
      { className: "section-title" },
      "Component Library",
    ),
    React.createElement(
      "button",
      {
        ref: triggerRef,
        className: `component-library-launcher ${libraryOpen ? "active" : ""}`,
        onClick: () => {
          const isMobilePicker = window.matchMedia?.(
            "(max-width: 860px), (pointer: coarse)",
          ).matches;
          if (isMobilePicker) {
            setLibraryOpen(false);
            AppCommands.closeLeftPanel();
            window.setTimeout(
              () => AppCommands.openComponentLibraryPicker(),
              180,
            );
            return;
          }
          setLibraryOpen((v) => !v);
        },
      },
      React.createElement(
        "span",
        { className: "launcher-icon-grid" },
        "\u25A6",
      ),
      React.createElement(
        "span",
        null,
        React.createElement("b", null, "Open component picker"),
        React.createElement(
          "small",
          null,
          allParts.length,
          " parts \u00B7 icon grid",
        ),
      ),
    ),
    popover,
  );
}

function TextPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const widthMM = panelWidthMM(state.panel);
  function addText() {
    dispatch({
      type: "ADD_TEXT",
      item: {
        id: crypto.randomUUID(),
        text: "TEXT",
        x: snapToGrid(widthMM / 2, state.grid.size),
        y: snapToGrid(PANEL_HEIGHT_MM / 2, state.grid.size),
        rotation: 0,
        fontSizeMm: 3,
        align: "center",
        layer: "foreground",
        locked: false,
        visible: true,
        opacity: 1,
        fontFamily: TEXT_FONT_OPTIONS[0].value,
      },
    });
  }
  function addLabelsForSelected() {
    const selected = state.components.filter((c) =>
      state.selected.includes(c.id),
    );
    selected.forEach((c) =>
      dispatch({ type: "ADD_TEXT", item: defaultAttachedLabelFor(c) }),
    );
  }
  function updateText(id, value) {
    dispatch({ type: "UPDATE_TEXT", id, patch: { text: value } });
  }
  return React.createElement(
    "div",
    { className: "section text-labels-panel" },
    React.createElement("div", { className: "section-title" }, "Text / Labels"),
    React.createElement(
      "button",
      { className: "text-panel-add", onClick: addText },
      "+ Add Text",
    ),
    React.createElement(
      "button",
      {
        className: "text-panel-add",
        disabled: state.selected.length === 0,
        title: "Create attached text labels under selected components",
        onClick: addLabelsForSelected,
      },
      "+ Labels for selected",
    ),
    React.createElement(
      "div",
      { className: "text-item-list" },
      state.textItems.map((t) =>
        React.createElement(
          "div",
          {
            key: t.id,
            className: `text-item-row ${state.selectedTexts?.includes(t.id) ? "active" : ""}`,
            onClick: () => dispatch({ type: "SELECT_TEXT", id: t.id }),
          },
          React.createElement(
            "span",
            { className: "text-item-layer" },
            t.layer === "background" ? "▼" : "▲",
          ),
          t.componentId &&
            React.createElement(
              "span",
              { className: "text-item-link" },
              "\uD83D\uDD17",
            ),
          React.createElement("input", {
            value: t.text,
            placeholder: "TEXT",
            onClick: (e) => {
              e.stopPropagation();
              dispatch({ type: "SELECT_TEXT", id: t.id });
            },
            onFocus: () => dispatch({ type: "SELECT_TEXT", id: t.id }),
            onChange: (e) => updateText(t.id, e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              e.stopPropagation();
            },
          }),
        ),
      ),
      state.textItems.length === 0 &&
        React.createElement(
          "div",
          { className: "text-empty-note" },
          "No text yet. Add a label or create text.",
        ),
    ),
  );
}

function ArtworkPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const widthMM = panelWidthMM(state.panel);
  const [largeImageWarning, setLargeImageWarning] = useState(false);
  useEffect(() => {
    if (state.artworks.length === 0) setLargeImageWarning(false);
  }, [state.artworks.length]);
  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setLargeImageWarning(dataUrl.length > 2000000);
      const img = new window.Image();
      img.onload = () => {
        const naturalW = img.naturalWidth || 100;
        const naturalH = img.naturalHeight || 100;
        const item = {
          id: crypto.randomUUID(),
          name: file.name,
          imageDataUrl: dataUrl,
          x: snapToGrid(widthMM / 2, state.grid.size),
          y: snapToGrid(PANEL_HEIGHT_MM / 2, state.grid.size),
          width: widthMM,
          height: PANEL_HEIGHT_MM,
          naturalW,
          naturalH,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          layer: "background",
          preserveAspectRatio: false,
          notes: "Auto-fit to panel on import",
        };
        dispatch({ type: "ADD_ARTWORK", item });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  const allVisible =
    state.artworks.length > 0 && state.artworks.every((a) => a.visible);
  function toggleAllVisible() {
    dispatch({ type: "SET_ALL_ARTWORK_VISIBLE", visible: !allVisible });
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement("div", { className: "section-title" }, "Artwork"),
    React.createElement(
      "button",
      {
        style: { width: "100%", marginBottom: 6 },
        onClick: () => document.getElementById("artwork-import-input").click(),
      },
      "+ Add Image",
    ),
    React.createElement("input", {
      id: "artwork-import-input",
      type: "file",
      accept: ".png,.jpg,.jpeg,.svg,.webp",
      style: { display: "none" },
      onChange: handleFileInput,
    }),
    largeImageWarning &&
      React.createElement(
        "div",
        { className: "warning-item warn", style: { marginBottom: 6 } },
        "Large image \u2014 JSON/SVG export may be slow.",
      ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement(
        "label",
        null,
        React.createElement("input", {
          type: "checkbox",
          checked: state.clipArtworkToPanel,
          onChange: (e) =>
            dispatch({ type: "SET_CLIP_ARTWORK", value: e.target.checked }),
        }),
        " ",
        "Clip artwork to panel",
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
          checked: state.ignoreLockedArtworkClicks,
          onChange: (e) =>
            dispatch({
              type: "SET_IGNORE_LOCKED_CLICKS",
              value: e.target.checked,
            }),
        }),
        " ",
        "Ignore locked artwork clicks (locked images don't block selection)",
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
          checked: state.showArtworkInDrillView,
          onChange: (e) =>
            dispatch({
              type: "SET_SHOW_ARTWORK_IN_DRILL",
              value: e.target.checked,
            }),
        }),
        " ",
        "Show artwork in drill view",
      ),
    ),
    state.showArtworkInDrillView &&
      React.createElement(
        "div",
        { className: "field-row" },
        React.createElement("label", null, "Drill artwork opacity"),
        React.createElement("input", {
          type: "number",
          step: 0.05,
          min: 0,
          max: 1,
          value: state.drillArtworkOpacity,
          onChange: (e) =>
            dispatch({
              type: "SET_DRILL_ARTWORK_OPACITY",
              value: Math.max(0, Math.min(1, +e.target.value)),
            }),
        }),
      ),
    state.artworks.length > 0 &&
      React.createElement(
        "div",
        { className: "field-row" },
        React.createElement(
          "label",
          null,
          React.createElement("input", {
            type: "checkbox",
            checked: allVisible,
            onChange: toggleAllVisible,
          }),
          " ",
          "Show all artwork",
        ),
      ),
    state.artworks.map((a) =>
      React.createElement(
        "div",
        {
          key: a.id,
          style: {
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "3px 4px",
            borderBottom: "1px solid #222",
            fontSize: 10,
            background:
              state.selectedArtwork === a.id
                ? "rgba(201,154,74,0.08)"
                : "transparent",
          },
        },
        React.createElement(
          "button",
          {
            title:
              a.layer === "background"
                ? "Background (click to move to foreground)"
                : "Foreground (click to move to background)",
            style: {
              padding: "1px 3px",
              fontSize: 9,
              minWidth: 18,
              background: "transparent",
              border: "1px solid #333",
            },
            onClick: () =>
              dispatch({
                type: "UPDATE_ARTWORK",
                id: a.id,
                patch: {
                  layer: a.layer === "background" ? "foreground" : "background",
                },
              }),
          },
          a.layer === "background" ? "▼" : "▲",
        ),
        React.createElement(
          "span",
          {
            style: {
              flex: 1,
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: state.selectedArtwork === a.id ? "#c99a4a" : "#aaa",
            },
            onClick: () => dispatch({ type: "SELECT_ARTWORK", id: a.id }),
          },
          a.name,
        ),
        React.createElement(
          "button",
          {
            title: a.visible ? "Hide" : "Show",
            style: {
              padding: "1px 3px",
              fontSize: 9,
              background: "transparent",
              border: "1px solid #333",
              color: a.visible ? "#aaa" : "#555",
            },
            onClick: () =>
              dispatch({
                type: "UPDATE_ARTWORK",
                id: a.id,
                patch: { visible: !a.visible },
              }),
          },
          a.visible ? "●" : "○",
        ),
        React.createElement(
          "button",
          {
            title: a.locked ? "Unlock" : "Lock",
            style: {
              padding: "1px 3px",
              fontSize: 9,
              background: "transparent",
              border: "1px solid #333",
              color: a.locked ? "#ffa000" : "#555",
            },
            onClick: () =>
              dispatch({
                type: "UPDATE_ARTWORK",
                id: a.id,
                patch: { locked: !a.locked },
              }),
          },
          a.locked ? "🔒" : "🔓",
        ),
        React.createElement(
          "button",
          {
            title: "Delete",
            style: {
              padding: "1px 3px",
              fontSize: 9,
              background: "transparent",
              border: "1px solid #333",
              color: "#f55",
            },
            onClick: () => dispatch({ type: "DELETE_ARTWORK", id: a.id }),
          },
          "\u2715",
        ),
      ),
    ),
  );
}
