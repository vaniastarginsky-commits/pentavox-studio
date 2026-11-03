// Compact header: brand, project setup menus, Templates, File and Help.
function Topbar({
  onExportSVGClick,
  onRequestProjectFileImport,
  onRequestKiCadPcbImport,
  onRequestEagleBrdImport,
  onOpenLocalProjects,
  onOpenProductionCheck,
  onOpenShortcuts,
  isNarrow,
  rightPanelOpen,
  onToggleRightPanel,
  autosaveStatus,
  projectHealth,
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPos, setMenuPos] = useState({ left: 8, top: 48 });
  const sectionMenus = ["project", "panel", "add", "text"];

  useEffect(() => {
    if (!openMenu) return undefined;
    function onDocPointerDown(e) {
      const target = e.target;
      if (!target) return;
      if (
        target.closest(".toolbar-popover") ||
        target.closest(".toolbar-menu-trigger")
      )
        return;
      setOpenMenu(null);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    function close() {
      setOpenMenu(null);
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [openMenu]);

  function toggleMenu(name, e) {
    const r = e.currentTarget.getBoundingClientRect();
    const estimatedWidth = sectionMenus.includes(name)
      ? 360
      : name === "help"
        ? 390
        : 250;
    const left = Math.max(
      8,
      Math.min(r.left, window.innerWidth - estimatedWidth - 8),
    );
    setMenuPos({ left, top: r.bottom + 6 });
    setOpenMenu(openMenu === name ? null : name);
  }

  function menuButton(name, label) {
    return React.createElement(
      "button",
      {
        className: `toolbar-menu-trigger ${openMenu === name ? "active" : ""}`,
        onClick: (e) => toggleMenu(name, e),
      },
      label,
      " \u25BE",
    );
  }

  const popoverStyle = { left: menuPos.left, top: menuPos.top };

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { className: "topbar global-topbar" },
      React.createElement(
        "span",
        { className: "app-brand", title: "Panel Designer" },
        React.createElement("img", {
          src: "cubreak_logo_small.png",
          className: "app-logo",
          alt: "",
          "aria-hidden": "true",
        }),
        React.createElement(
          "span",
          { className: "app-title" },
          "PANEL DESIGNER",
        ),
      ),
      React.createElement(
        "div",
        { className: "topbar-actions" },
        React.createElement(
          "div",
          {
            className: "topbar-work-actions",
            "aria-label": "Panel setup menus",
          },
          menuButton("project", "Project"),
          menuButton("panel", "Panel"),
          menuButton("add", "Insert"),
          menuButton("text", "Labels"),
        ),
        !isNarrow &&
          React.createElement(
            "div",
            {
              className: `topbar-project-status${autosaveStatus?.includes("failed") || projectHealth?.errors ? " error" : ""}`,
              title: [
                autosaveStatus || "Autosave ready",
                projectHealth?.exportState,
                projectHealth
                  ? `${projectHealth.errors} errors · ${projectHealth.warnings} warnings`
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
            },
            React.createElement("strong", null, state.projectMeta.name),
            React.createElement(
              "span",
              null,
              autosaveStatus === "Saving…" || autosaveStatus?.includes("failed")
                ? autosaveStatus
                : projectHealth?.errors
                  ? `${projectHealth.errors} DFM errors`
                  : projectHealth?.warnings
                    ? `${projectHealth.warnings} DFM warnings`
                    : projectHealth?.exportState || autosaveStatus || "Ready",
            ),
          ),
        React.createElement(
          "div",
          { className: "topbar-history-group" },
          React.createElement(
            "button",
            {
              className: "topbar-history-btn",
              disabled: state.history.length === 0,
              onClick: () => dispatch({ type: "UNDO" }),
              title: "Undo",
              "aria-label": "Undo",
            },
            React.createElement(
              "svg",
              {
                width: 16,
                height: 16,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 1.7,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": "true",
              },
              React.createElement("path", { d: "M9 14 4 9l5-5" }),
              React.createElement("path", {
                d: "M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
              }),
            ),
          ),
          React.createElement(
            "button",
            {
              className: "topbar-history-btn",
              disabled: state.future.length === 0,
              onClick: () => dispatch({ type: "REDO" }),
              title: "Redo",
              "aria-label": "Redo",
            },
            React.createElement(
              "svg",
              {
                width: 16,
                height: 16,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 1.7,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": "true",
              },
              React.createElement("path", { d: "M15 14l5-5-5-5" }),
              React.createElement("path", {
                d: "M19 9H8.5a5.5 5.5 0 0 0 0 11H13",
              }),
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "topbar-global-actions", "aria-label": "Global menus" },
          menuButton("templates", "Templates"),
          menuButton("file", "File"),
        ),
        !isNarrow &&
          React.createElement(
            "button",
            {
              className: "toolbar-menu-trigger toolbar-appearance-trigger",
              onClick: () => AppCommands.openAppearance(),
              title: "Appearance settings",
            },
            React.createElement(
              "svg",
              {
                width: 14,
                height: 14,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 1.7,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": "true",
              },
              React.createElement("circle", { cx: "12", cy: "12", r: "3" }),
              React.createElement("path", {
                d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
              }),
            ),
          ),
        isNarrow &&
          React.createElement(
            "button",
            {
              className:
                "toolbar-menu-trigger toolbar-appearance-trigger topbar-icon-btn",
              onClick: () => AppCommands.openAppearance(),
              title: "Appearance settings",
              "aria-label": "Appearance",
            },
            React.createElement(
              "svg",
              {
                width: 16,
                height: 16,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 1.7,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": "true",
              },
              React.createElement("circle", { cx: "12", cy: "12", r: "3" }),
              React.createElement("path", {
                d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
              }),
            ),
          ),
        isNarrow
          ? null
          : React.createElement(
              "button",
              {
                className: `toolbar-menu-trigger toolbar-help-trigger ${openMenu === "help" ? "active" : ""}`,
                onClick: (e) => toggleMenu("help", e),
                title: "Help, shortcuts and manufacturing notes",
              },
              "Help",
            ),
        isNarrow
          ? onToggleRightPanel &&
              React.createElement(
                "button",
                {
                  className: `toolbar-menu-trigger topbar-icon-btn ${rightPanelOpen ? "active" : ""}`,
                  onClick: onToggleRightPanel,
                  title: "Toggle right panel",
                },
                React.createElement(
                  "svg",
                  {
                    width: 16,
                    height: 16,
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: 1.7,
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    "aria-hidden": "true",
                  },
                  React.createElement("path", {
                    d: "M21 3H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z",
                  }),
                  React.createElement("path", { d: "M15 3v18" }),
                  React.createElement("path", { d: "M19 10l3 2-3 2" }),
                ),
              )
          : onToggleRightPanel &&
              React.createElement(
                "button",
                {
                  className: `toolbar-menu-trigger topbar-inspect-btn ${rightPanelOpen ? "active" : ""}`,
                  onClick: onToggleRightPanel,
                  title: "Toggle inspector panel (→)",
                },
                React.createElement(
                  "span",
                  { className: "topbar-inspect-label" },
                  "Sidebar",
                ),
                React.createElement(
                  "svg",
                  {
                    width: 14,
                    height: 14,
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: 2,
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    "aria-hidden": "true",
                  },
                  React.createElement("path", { d: "M9 18l6-6-6-6" }),
                ),
              ),
      ),
    ),
    openMenu &&
      ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className: `toolbar-popover ${openMenu === "help" ? "help-popover" : ""} ${sectionMenus.includes(openMenu) ? "topbar-section-popover" : ""}`,
            style: popoverStyle,
            onClick: (e) => e.stopPropagation(),
            onPointerDown: (e) => e.stopPropagation(),
            onWheel: (e) => {
              e.preventDefault();
              e.stopPropagation();
            },
            onTouchMove: (e) => e.stopPropagation(),
          },
          openMenu === "project" && React.createElement(ProjectPanel, null),
          openMenu === "panel" && React.createElement(PanelSettings, null),
          openMenu === "add" &&
            React.createElement(AddMenuContent, {
              onClose: () => setOpenMenu(null),
            }),
          openMenu === "text" && React.createElement(TextPanel, null),
          openMenu === "templates" &&
            React.createElement(TemplatesMenuContent, {
              onClose: () => setOpenMenu(null),
            }),
          openMenu === "file" &&
            React.createElement(FileMenuContent, {
              onClose: () => setOpenMenu(null),
              onExportSVGClick,
              onRequestProjectFileImport,
              onRequestKiCadPcbImport,
              onRequestEagleBrdImport,
              onOpenLocalProjects,
            }),
          openMenu === "help" &&
            React.createElement(HelpMenuContent, {
              onClose: () => setOpenMenu(null),
              onOpenShortcuts,
              onOpenProductionCheck,
            }),
        ),
        document.body,
      ),
  );
}
