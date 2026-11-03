// Topbar dropdown menu content components.
// Depends on: useAppState, useAppDispatch (appState.js), panelWidthMM, snapToGrid,
// PANEL_HEIGHT_MM, TEXT_FONT_OPTIONS, APP_VERSION (core.js), appConfirm (NativeDialogs.js),
// validateAndNormalize (projectSchema.js), AppCommands (appCommands.js),
// loadLocalProjects, exportJSON, saveProjectToBrowser, copyTable (exportEngine.js/core.js),
// makeTemplateFromState, saveTemplateToBrowser, exportTemplatesLibrary,
// importTemplatesLibraryFile (FactoryTemplates.js — called at runtime only).

function AddMenuContent({ onClose }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const widthMM = panelWidthMM(state.panel);
  const [largeImageWarning, setLargeImageWarning] = useState(false);
  useEffect(() => {
    if (state.artworks.length === 0) setLargeImageWarning(false);
  }, [state.artworks.length]);

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
    onClose();
  }

  function handleArtworkFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setLargeImageWarning(dataUrl.length > 2_000_000);
      const img = new window.Image();
      img.onload = () => {
        dispatch({
          type: "ADD_ARTWORK",
          item: {
            id: crypto.randomUUID(),
            name: file.name,
            imageDataUrl: dataUrl,
            x: snapToGrid(widthMM / 2, state.grid.size),
            y: snapToGrid(PANEL_HEIGHT_MM / 2, state.grid.size),
            width: widthMM,
            height: PANEL_HEIGHT_MM,
            naturalW: img.naturalWidth || 100,
            naturalH: img.naturalHeight || 100,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            layer: "background",
            preserveAspectRatio: false,
            notes: "Auto-fit to panel on import",
          },
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const allVisible =
    state.artworks.length > 0 && state.artworks.every((a) => a.visible);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", { className: "menu-title" }, "Add"),
    React.createElement(
      "div",
      { className: "menu-grid" },
      React.createElement(
        "button",
        {
          className: "primary",
          onClick: () => {
            onClose();
            AppCommands.openComponentLibraryPicker();
          },
        },
        "Component picker",
      ),
      React.createElement(
        "button",
        {
          onClick: () =>
            document.getElementById("topbar-artwork-import-input")?.click(),
        },
        "+ Add Image",
      ),
      React.createElement("button", { onClick: addText }, "+ Add Text"),
    ),
    React.createElement("input", {
      id: "topbar-artwork-import-input",
      type: "file",
      accept: ".png,.jpg,.jpeg,.svg,.webp",
      style: { display: "none" },
      onChange: handleArtworkFile,
    }),
    state.artworks.length > 0 &&
      React.createElement(
        React.Fragment,
        null,
        React.createElement("div", {
          style: {
            borderTop: "1px solid rgba(215,196,155,0.13)",
            margin: "8px 0 4px",
          },
        }),
        React.createElement(
          "div",
          { className: "menu-title", style: { paddingTop: 4 } },
          "Artwork",
        ),
        largeImageWarning &&
          React.createElement(
            "div",
            {
              className: "warning-item warn",
              style: { marginBottom: 6, fontSize: 11 },
            },
            "Large image — JSON/SVG export may be slow.",
          ),
        React.createElement(
          "label",
          { className: "app-native-check-row" },
          React.createElement("input", {
            type: "checkbox",
            checked: state.clipArtworkToPanel,
            onChange: (e) =>
              dispatch({
                type: "SET_CLIP_ARTWORK",
                value: e.target.checked,
              }),
          }),
          "Clip artwork to panel",
        ),
        React.createElement(
          "label",
          { className: "app-native-check-row" },
          React.createElement("input", {
            type: "checkbox",
            checked: state.ignoreLockedArtworkClicks,
            onChange: (e) =>
              dispatch({
                type: "SET_IGNORE_LOCKED_CLICKS",
                value: e.target.checked,
              }),
          }),
          "Ignore locked artwork clicks",
        ),
        React.createElement(
          "label",
          { className: "app-native-check-row" },
          React.createElement("input", {
            type: "checkbox",
            checked: state.showArtworkInDrillView,
            onChange: (e) =>
              dispatch({
                type: "SET_SHOW_ARTWORK_IN_DRILL",
                value: e.target.checked,
              }),
          }),
          "Show artwork in drill view",
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
        React.createElement(
          "label",
          { className: "app-native-check-row" },
          React.createElement("input", {
            type: "checkbox",
            checked: allVisible,
            onChange: () =>
              dispatch({
                type: "SET_ALL_ARTWORK_VISIBLE",
                visible: !allVisible,
              }),
          }),
          "Show all artwork",
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
              },
            },
            React.createElement(
              "span",
              {
                style: {
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#aaa",
                },
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
              "×",
            ),
          ),
        ),
      ),
  );
}

function TemplatesMenuContent({ onClose }) {
  const state = useAppState();

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", { className: "menu-title" }, "Templates"),
    React.createElement(
      "div",
      { className: "menu-grid" },
      React.createElement(
        "button",
        {
          onClick: async () => {
            const t = await makeTemplateFromState(state, "panel");
            if (t) {
              saveTemplateToBrowser(t);
              alert(`Saved template "${t.name}".`);
            }
            onClose();
          },
        },
        "Save current panel",
      ),
      React.createElement(
        "button",
        {
          disabled: state.selected.length === 0,
          onClick: async () => {
            const t = await makeTemplateFromState(
              state,
              "block",
              state.selected,
            );
            if (t) {
              saveTemplateToBrowser(t);
              alert(`Saved block template "${t.name}".`);
            }
            onClose();
          },
        },
        "Save selected block",
      ),
      React.createElement(
        "button",
        {
          className: "primary",
          onClick: () => {
            onClose();
            AppCommands.openTemplatesDialog();
          },
        },
        "Load / Manage templates",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            exportTemplatesLibrary();
            onClose();
          },
        },
        "Export templates",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            importTemplatesLibraryFile();
            onClose();
          },
        },
        "Import templates",
      ),
    ),
    React.createElement(
      "div",
      { className: "menu-note" },
      "Default templates are baked into this HTML. Browser templates can still be saved, imported and exported.",
    ),
  );
}

function FileMenuContent({
  onClose,
  onExportSVGClick,
  onRequestProjectFileImport,
  onRequestKiCadPcbImport,
  onRequestEagleBrdImport,
  onOpenLocalProjects,
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [fileRecentOpen, setFileRecentOpen] = useState(true);
  const [recentFileProjects] = useState(() => loadLocalProjects().slice(0, 7));

  async function loadRecentProject(record) {
    let raw;
    try {
      raw = JSON.parse(record.data);
    } catch {
      alert("Saved project is corrupted and could not be parsed.");
      return;
    }
    const result = validateAndNormalize(raw);
    if (!result.ok) {
      alert(`Load failed: ${result.error}`);
      return;
    }
    const hasContent =
      state.components.length > 0 ||
      state.artworks.length > 0 ||
      state.textItems.length > 0 ||
      state.scaleItems.length > 0;
    if (hasContent) {
      const ok = await appConfirm({
        title: "Load recent project",
        message: `Replace the current project with "${record.name}"?`,
        confirmText: "Load project",
      });
      if (!ok) return;
    }
    dispatch({ type: "LOAD_STATE", state: result.state });
    onClose();
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", { className: "menu-title" }, "File / Export"),
    React.createElement(
      "div",
      { className: "menu-grid" },
      React.createElement(
        "button",
        {
          onClick: () => {
            onExportSVGClick();
            onClose();
          },
        },
        "Export...",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            onExportSVGClick();
            onClose();
          },
        },
        "Export KiCad PCB...",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            onClose();
            onRequestKiCadPcbImport();
          },
        },
        "Import KiCad PCB...",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            onClose();
            onRequestEagleBrdImport();
          },
        },
        "Import Eagle .brd...",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            exportJSON(state);
            onClose();
          },
        },
        "Save Project File",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            onClose();
            onRequestProjectFileImport();
          },
        },
        "Load Project File",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            saveProjectToBrowser(state);
            setFileRecentOpen(true);
          },
        },
        "Save to Browser",
      ),
      React.createElement(
        "button",
        {
          className: `recent-projects-toggle ${fileRecentOpen ? "active" : ""}`,
          onClick: () => setFileRecentOpen((v) => !v),
        },
        "Recent Projects ",
        recentFileProjects.length ? `(${recentFileProjects.length})` : "",
        " ",
        fileRecentOpen ? "▴" : "▾",
      ),
      fileRecentOpen &&
        React.createElement(
          "div",
          { className: "recent-projects-menu-list" },
          recentFileProjects.length
            ? recentFileProjects.map((p) =>
                React.createElement(
                  "button",
                  {
                    key: p.id,
                    className: "recent-project-menu-item",
                    onClick: () => loadRecentProject(p),
                    title: `${p.name} - ${new Date(p.updatedAt).toLocaleString()} - ${(p.sizeBytes / 1024).toFixed(0)} KB`,
                  },
                  React.createElement("strong", null, p.name),
                  React.createElement(
                    "small",
                    null,
                    new Date(p.updatedAt).toLocaleString(),
                    " - ",
                    (p.sizeBytes / 1024).toFixed(0),
                    " KB",
                  ),
                ),
              )
            : React.createElement(
                "div",
                { className: "recent-projects-empty" },
                "No recent browser projects yet. Use Save to Browser first.",
              ),
          React.createElement(
            "button",
            {
              className: "recent-projects-manager",
              onClick: () => {
                onClose();
                onOpenLocalProjects();
              },
            },
            "Manage all local projects...",
          ),
        ),
      React.createElement(
        "button",
        {
          onClick: () => {
            copyTable(state.components);
            onClose();
          },
        },
        "Copy component table",
      ),
    ),
  );
}

function HelpMenuContent({ onClose, onOpenShortcuts, onOpenProductionCheck }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { className: "menu-title" },
      "Help / quick reference",
    ),
    React.createElement(
      "div",
      { className: "menu-note" },
      "Build: ",
      APP_VERSION,
    ),
    React.createElement(
      "div",
      { className: "help-popover-grid" },
      React.createElement(
        "div",
        { className: "help-card warn" },
        React.createElement("strong", null, "Manufacturing"),
        React.createElement(
          "span",
          null,
          "Dimensions are planning estimates. Verify parts with datasheets or calipers before production.",
        ),
      ),
      React.createElement(
        "div",
        { className: "help-card" },
        React.createElement("strong", null, "Mobile"),
        React.createElement(
          "span",
          null,
          "Use Add / Select / Part / View / More. Pinch to zoom.",
        ),
      ),
      React.createElement(
        "div",
        { className: "help-card" },
        React.createElement("strong", null, "Part / text editing"),
        React.createElement(
          "span",
          null,
          "Select a component for Part properties. Text labels can be edited inline in Text / Labels.",
        ),
      ),
      React.createElement(
        "div",
        { className: "help-card" },
        React.createElement("strong", null, "Snap / placement"),
        React.createElement(
          "span",
          null,
          "Normal drag is cursor anchored. Hold Shift for smart snap. Placement uses Multiple/Done.",
        ),
      ),
      React.createElement(
        "div",
        { className: "help-card" },
        React.createElement("strong", null, "KiCad export"),
        React.createElement(
          "span",
          null,
          "Use File / Export KiCad PCB for mechanical .kicad_pcb output and origin options.",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "menu-grid two", style: { marginTop: 10 } },
      React.createElement(
        "button",
        {
          onClick: () => {
            onOpenShortcuts();
            onClose();
          },
        },
        "Open shortcuts",
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
            AppCommands.openAppearance();
            onClose();
          },
        },
        "Appearance",
      ),
    ),
  );
}
