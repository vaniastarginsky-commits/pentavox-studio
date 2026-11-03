// Extracted component declarations from index.html.

function InlineTextEditor({ textItem, svgRef, onCommit, onCancel }) {
  const [value, setValueState] = React.useState(textItem.text);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);
  const getPosition = () => {
    if (!svgRef.current) return null;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return null;
    const fontSizeMm = Math.min(Math.max(textItem.fontSizeMm || 3, 0.4), 18);
    const screenX = ctm.a * textItem.x + ctm.c * textItem.y + ctm.e;
    const screenY = ctm.b * textItem.x + ctm.d * textItem.y + ctm.f;
    const fontSizePx = ctm.a * fontSizeMm;
    return { screenX, screenY, fontSizePx };
  };
  const pos = getPosition();
  if (!pos) return null;
  const { screenX, screenY, fontSizePx } = pos;
  const align = textItem.align || "center";
  const translateX =
    align === "center" ? "-50%" : align === "right" ? "-100%" : "0%";
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onCommit(value);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }
  return React.createElement("input", {
    ref: inputRef,
    type: "text",
    value: value,
    onChange: (e) => setValueState(e.target.value),
    onKeyDown: handleKeyDown,
    onBlur: () => onCommit(value),
    style: {
      position: "fixed",
      left: screenX + "px",
      top: screenY - fontSizePx + "px",
      transform: `translateX(${translateX})`,
      minWidth: "80px",
      height: fontSizePx * 1.4 + "px",
      padding: "0 4px",
      fontSize: fontSizePx + "px",
      fontFamily: textItem.fontFamily || "sans-serif",
      textAlign: align,
      background: "rgba(0,0,0,0.75)",
      color: "#f0e8d8",
      border: "1px solid rgba(214,170,88,0.7)",
      outline: "none",
      zIndex: 9999,
      boxSizing: "border-box",
    },
  });
}

// App
function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const widthMM = panelWidthMM(state.panel);
  const appSelectedComponents = state.components.filter((c) =>
    state.selected.includes(c.id),
  );
  const appSelectedAllLocked =
    appSelectedComponents.length > 0 &&
    appSelectedComponents.every((c) => !!c.locked);
  useEffect(() => {
    const isMobileLike = window.matchMedia?.(
      "(max-width: 860px), (pointer: coarse)",
    ).matches;
    if (isMobileLike && state.hardwareRenderMode !== "auto") {
      dispatch({ type: "SET_HARDWARE_RENDER_MODE", mode: "auto" });
    }
  }, []);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [touchMode, setTouchMode] = useState("edit");
  const [showMobileNudge, setShowMobileNudge] = useState(false);
  const [showMobileSelectionMore, setShowMobileSelectionMore] = useState(false);
  const [showMobileArrange, setShowMobileArrange] = useState(false);
  useEffect(() => {
    function onRequestMore() {
      setShowMobileNudge(false);
      setShowMobileSelectionMore(true);
    }
    function onRequestNudge() {
      setShowMobileSelectionMore(false);
      setShowMobileNudge(true);
    }
    window.addEventListener(
      "panel-designer:request-selection-more",
      onRequestMore,
    );
    window.addEventListener(
      "panel-designer:request-nudge-mode",
      onRequestNudge,
    );
    return () => {
      window.removeEventListener(
        "panel-designer:request-selection-more",
        onRequestMore,
      );
      window.removeEventListener(
        "panel-designer:request-nudge-mode",
        onRequestNudge,
      );
    };
  }, []);
  const [showTouchHitboxes, setShowTouchHitboxes] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [mobileFineMode, setMobileFineMode] = useState(false);
  const [mobileProtectMode, setMobileProtectMode] = useState(false);
  const [mobileOneHandMode, setMobileOneHandMode] = useState("off");
  const [mobileToast, setMobileToast] = useState("");
  const mobileToastTimerRef = useRef(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const previewModeRef = useRef(previewMode);
  previewModeRef.current = previewMode;
  const focusRestorePanelsRef = useRef(null);
  const previewRestoreRef = useRef(null);
  const manufacturingRestoreRef = useRef(null);
  const [manufacturingPreview, setManufacturingPreview] = useState(false);
  const warningFocusIndexRef = useRef(-1);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [clearanceMode, setClearanceMode] = useState(false);
  const [snapSettings, setSnapSettings] = useState(() => defaultSnapSettings());
  const [touchPanning, setTouchPanning] = useState(null);
  const [autosaveStatus, setAutosaveStatus] = useState("");
  const [lastExportAt, setLastExportAt] = useState(null);
  const lastExportDataRef = useRef("");
  const [ruler, setRuler] = useState(null);
  useEffect(() => {
    window.__PANEL_RULER_DISTANCE_MM = ruler
      ? Math.hypot(ruler.end.x - ruler.start.x, ruler.end.y - ruler.start.y)
      : null;
  }, [ruler]);
  const [editingTextId, setEditingTextId] = useState(null);
  function handleSetTouchMode(mode) {
    if (mode === "ruler" && touchMode === "ruler") {
      setTouchMode("edit");
      setRuler(null);
    } else {
      setTouchMode(mode);
    }
  }
  const projectFileInputRef = useRef(null);
  const kicadPcbInputRef = useRef(null);
  const eagleBrdInputRef = useRef(null);
  const pendingFileOpenRef = useRef(false);
  const [showLocalProjectsDialog, setShowLocalProjectsDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [pendingTemplatePlacement, setPendingTemplatePlacement] =
    useState(null);
  const [pendingAddPart, setPendingAddPart] = useState(null);
  const [pendingAddPreview, setPendingAddPreview] = useState(null);
  const [pendingAddRepeat, setPendingAddRepeat] = useState(false);
  useEffect(() => {
    if (!pendingAddPart || pendingAddRepeat) return undefined;
    function onShiftUp(e) {
      if (e.key === "Shift") {
        setPendingAddPart(null);
        setPendingAddPreview(null);
        setPendingAddRepeat(false);
        resetCanvasInteractionMode();
      }
    }
    window.addEventListener("keyup", onShiftUp);
    return () => window.removeEventListener("keyup", onShiftUp);
  }, [pendingAddPart, pendingAddRepeat]);
  useEffect(() => {
    const open = () => setShowTemplatesDialog(true);
    window.addEventListener("open-template-dialog", open);
    return () => window.removeEventListener("open-template-dialog", open);
  }, []);
  function startPartPlacement(def, stamp = false) {
    rememberRecentPart(def);
    setPendingAddPart({ def, stamp });
    setPendingAddPreview({
      x: snapToGrid(widthMM / 2, state.grid.size),
      y: snapToGrid(PANEL_HEIGHT_MM / 2, state.grid.size),
    });
    setPendingAddRepeat(false);
    if (typeof setMobileSheet !== "undefined") setMobileSheet(null);
    setCanvasInteractionMode("placingPart");
    setShowMobileNudge(false);
    setTouchMode("edit");
  }
  useEffect(() => {
    const startPlacement = (ev) => {
      const detail = ev.detail || {};
      if (!detail.def) return;
      startPartPlacement(detail.def, !!detail.stamp);
    };
    window.addEventListener("start-part-placement", startPlacement);
    return () =>
      window.removeEventListener("start-part-placement", startPlacement);
  }, []);
  const isNarrowInitial =
    typeof window !== "undefined" && window.innerWidth <= 860;
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(!isNarrowInitial);
  const [rightInspectorTopTab, setRightInspectorTopTab] = useState("status");
  const [rightStatusTab, setRightStatusTab] = useState("layout");
  const [rightInspectTab, setRightInspectTab] = useState("properties");
  const [rightProdTab, setRightProdTab] = useState("output");
  const [rightLayersTab, setRightLayersTab] = useState("layers");
  const panelVisibilityRef = useRef({ left: false, right: true });
  panelVisibilityRef.current = { left: leftPanelOpen, right: rightPanelOpen };
  const [issueFocusIds, setIssueFocusIds] = useState([]);
  const issueFocusTimerRef = useRef(null);
  const [sidebarSwipe, setSidebarSwipe] = useState(null);
  const [drawerCloseSwipe, setDrawerCloseSwipe] = useState(null);
  const lastComponentTapRef = useRef(null);
  const lastTouchEventAtRef = useRef(0);
  useEffect(() => {
    function closeLeftPanelFromPicker() {
      setLeftPanelOpen(false);
      setShowMobileNudge(false);
    }
    window.addEventListener("close-left-panel", closeLeftPanelFromPicker);
    return () =>
      window.removeEventListener("close-left-panel", closeLeftPanelFromPicker);
  }, []);
  const sidePanelOpen = leftPanelOpen || rightPanelOpen;
  function togglePreviewMode() {
    setPreviewMode((enabled) => {
      if (!enabled) {
        previewRestoreRef.current = {
          left: leftPanelOpen,
          right: rightPanelOpen,
          selected: [...stateRef.current.selected],
        };
        dispatch({ type: "DESELECT_ALL" });
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
        return true;
      }
      const restore = previewRestoreRef.current;
      if (restore) {
        setLeftPanelOpen(restore.left);
        setRightPanelOpen(restore.right);
        dispatch({ type: "SELECT", ids: restore.selected, additive: false });
      }
      previewRestoreRef.current = null;
      return false;
    });
  }
  function toggleManufacturingPreview() {
    if (!manufacturingRestoreRef.current) {
      const currentState = stateRef.current;
      manufacturingRestoreRef.current = {
        viewMode: currentState.viewMode,
        layerVisibility: { ...currentState.layerVisibility },
        previewMode: previewModeRef.current,
        panels: { ...panelVisibilityRef.current },
        selected: [...currentState.selected],
      };
      dispatch({ type: "SET_VIEW_MODE", mode: "drill" });
      dispatch({ type: "APPLY_LAYER_PRESET", preset: "production" });
      setLeftPanelOpen(false);
      setRightPanelOpen(false);
      setPreviewMode(true);
      setManufacturingPreview(true);
      dispatch({ type: "DESELECT_ALL" });
      return;
    }
    const restore = manufacturingRestoreRef.current;
    if (restore) {
      dispatch({ type: "SET_VIEW_MODE", mode: restore.viewMode });
      Object.entries(restore.layerVisibility).forEach(([key, value]) =>
        dispatch({ type: "SET_LAYER_VISIBILITY", key, value }),
      );
      setPreviewMode(restore.previewMode);
      setLeftPanelOpen(restore.panels.left);
      setRightPanelOpen(restore.panels.right);
      dispatch({ type: "SELECT", ids: restore.selected, additive: false });
    } else {
      setPreviewMode(false);
    }
    manufacturingRestoreRef.current = null;
    setManufacturingPreview(false);
  }
  function focusIssueComponents(
    ids,
    { inspect = false, openPanel = true } = {},
  ) {
    const realIds = ids.filter((id) =>
      stateRef.current.components.some((component) => component.id === id),
    );
    if (!realIds.length) return;
    dispatch({ type: "SELECT", ids: realIds, additive: false });
    setIssueFocusIds(realIds);
    if (openPanel) {
      setRightPanelOpen(true);
      setRightInspectorTopTab(inspect ? "inspect" : "status");
      if (inspect) setRightInspectTab("properties");
    }
    setZoom((value) => Math.max(value, 1.65));
    window.clearTimeout(issueFocusTimerRef.current);
    issueFocusTimerRef.current = window.setTimeout(
      () => setIssueFocusIds([]),
      1800,
    );
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        const nodes = [...document.querySelectorAll(".component-node")].filter(
          (node) => realIds.includes(node.getAttribute("data-id")),
        );
        const wrap = document.querySelector(".canvas-wrap");
        if (!nodes.length || !wrap) return;
        const boxes = nodes.map((node) => node.getBoundingClientRect());
        const bounds = {
          left: Math.min(...boxes.map((box) => box.left)),
          right: Math.max(...boxes.map((box) => box.right)),
          top: Math.min(...boxes.map((box) => box.top)),
          bottom: Math.max(...boxes.map((box) => box.bottom)),
        };
        const wrapBox = wrap.getBoundingClientRect();
        setPan((current) => ({
          x:
            current.x +
            (wrapBox.left + wrapBox.width / 2) -
            (bounds.left + bounds.right) / 2,
          y:
            current.y +
            (wrapBox.top + wrapBox.height / 2) -
            (bounds.top + bounds.bottom) / 2,
        }));
      }),
    );
  }
  useEffect(() => {
    function onFocusComponents(event) {
      focusIssueComponents(event.detail?.ids || [], {
        inspect: !!event.detail?.inspect,
        openPanel: event.detail?.openPanel !== false,
      });
    }
    window.addEventListener(
      "panel-designer:focus-components",
      onFocusComponents,
    );
    return () => {
      window.removeEventListener(
        "panel-designer:focus-components",
        onFocusComponents,
      );
      window.clearTimeout(issueFocusTimerRef.current);
    };
  }, []);
  function toggleFocusMode() {
    setFocusMode((prev) => {
      if (!prev) {
        focusRestorePanelsRef.current = {
          left: leftPanelOpen,
          right: rightPanelOpen,
        };
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
        setShowMobileNudge(false);
        setComponentMenu(null);
        return true;
      }
      const restore = focusRestorePanelsRef.current;
      if (restore) {
        setLeftPanelOpen(restore.left);
        setRightPanelOpen(restore.right);
      }
      focusRestorePanelsRef.current = null;
      setShowMobileNudge(false);
      setComponentMenu(null);
      return false;
    });
  }
  useEffect(() => {
    if (sidePanelOpen) {
      setShowMobileNudge(false);
      setComponentMenu(null);
    }
  }, [sidePanelOpen]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showProductionCheck, setShowProductionCheck] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [exportOptions, setExportOptions] = useState(DEFAULT_EXPORT_OPTIONS);
  const [canvasInteractionMode, setCanvasInteractionMode] = useState("idle");
  useEffect(() => {
    window.__PANEL_INTERACTION_MODE = canvasInteractionMode;
  }, [canvasInteractionMode]);
  function resetCanvasInteractionMode() {
    setCanvasInteractionMode("idle");
  }
  const [dragging, setDragging] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [dragStartPositions, setDragStartPositions] = useState(null);
  const draggingRef = useRef(dragging);
  const dragPreviewRef = useRef(dragPreview);
  draggingRef.current = dragging;
  dragPreviewRef.current = dragPreview;
  const dragStartPositionsRef = useRef(dragStartPositions);
  dragStartPositionsRef.current = dragStartPositions;
  const [rotatingComponent, setRotatingComponent] = useState(null);
  const [rotationPreview, setRotationPreview] = useState(null);
  const rotatingComponentRef = useRef(rotatingComponent);
  const rotationPreviewRef = useRef(rotationPreview);
  rotatingComponentRef.current = rotatingComponent;
  rotationPreviewRef.current = rotationPreview;
  const [draggingText, setDraggingText] = useState(null);
  const [textDragPreview, setTextDragPreview] = useState(null);
  const [textsDragPreview, setTextsDragPreview] = useState(null);
  const draggingTextRef = useRef(draggingText);
  const textDragPreviewRef = useRef(textDragPreview);
  draggingTextRef.current = draggingText;
  textDragPreviewRef.current = textDragPreview;
  const [draggingArtwork, setDraggingArtwork] = useState(null);
  const [artworkDragPreview, setArtworkDragPreview] = useState(null);
  const draggingArtworkRef = useRef(draggingArtwork);
  const artworkDragPreviewRef = useRef(artworkDragPreview);
  draggingArtworkRef.current = draggingArtwork;
  artworkDragPreviewRef.current = artworkDragPreview;
  const [resizingArtwork, setResizingArtwork] = useState(null);
  const [artworkResizePreview, setArtworkResizePreview] = useState(null);
  const resizingArtworkRef = useRef(resizingArtwork);
  const artworkResizePreviewRef = useRef(artworkResizePreview);
  resizingArtworkRef.current = resizingArtwork;
  artworkResizePreviewRef.current = artworkResizePreview;
  const [panning, setPanning] = useState(null);
  const [pinching, setPinching] = useState(null);
  const [coordReadout, setCoordReadout] = useState("");
  const lastCoordReadoutRef = useRef("");
  const pointerMoveRafRef = useRef(null);
  const pendingPointerMoveRef = useRef(null);
  const [snapGuides, setSnapGuides] = useState([]);
  const [distanceGuides, setDistanceGuides] = useState([]);
  const [marqueeSelection, setMarqueeSelection] = useState(null);
  const [pendingMarquee, setPendingMarquee] = useState(null);
  const pendingMarqueeRef = useRef(pendingMarquee);
  pendingMarqueeRef.current = pendingMarquee;
  const marqueeSelectionRef = useRef(marqueeSelection);
  marqueeSelectionRef.current = marqueeSelection;
  const [componentMenu, setComponentMenu] = useState(null);
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef(null);
  const lastHapticAtRef = useRef(0);
  const lastSnapHapticKeyRef = useRef("");
  const lastSnapGuidesSignatureRef = useRef("");
  const lastDistanceGuidesAtRef = useRef(0);
  const lastDistanceGuidesSignatureRef = useRef("");
  const lastDragPreviewSignatureRef = useRef("");
  function softHaptic(ms = 5) {
    try {
      const now = Date.now();
      if (now - lastHapticAtRef.current < 90) return;
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
      ) {
        navigator.vibrate(ms);
        lastHapticAtRef.current = now;
      }
    } catch {}
  }
  const svgRef = useRef(null);
  const warnings = useMemo(
    () =>
      computeWarnings(
        state.components,
        widthMM,
        state.mountingHoles,
        state.pcb,
        state.artworks,
      ),
    [state.components, widthMM, state.mountingHoles, state.pcb, state.artworks],
  );
  const selectedIdSet = useMemo(
    () => new Set(state.selected),
    [state.selected],
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingTemplatePlacementRef = useRef(pendingTemplatePlacement);
  pendingTemplatePlacementRef.current = pendingTemplatePlacement;
  useEffect(() => {
    if (state.selected.length === 0) setShowMobileNudge(false);
  }, [state.selected.length]);
  useEffect(() => {
    function isCollapsibleSection(section) {
      if (section.dataset.collapsible === "true") return true;
      if (section.dataset.collapsible === "false") return false;
      const title = (
        section.querySelector(".section-title")?.textContent || ""
      ).toLowerCase();
      const explicitLeftSidebarSection =
        title.includes("project") ||
        title === "panel" ||
        title.includes("artwork") ||
        title.includes("text / labels") ||
        title.includes("component library");
      const longOrAdvanced =
        explicitLeftSidebarSection ||
        title.includes("undo history") ||
        title.includes("warnings") ||
        title.includes("drill table") ||
        title.includes("bom") ||
        title.includes("autosave") ||
        title.includes("assistant") ||
        title.includes("library tools") ||
        title.includes("custom parts");
      return longOrAdvanced;
    }
    function shouldStartOpen(section) {
      if (section.dataset.defaultOpen === "true") return true;
      if (!isCollapsibleSection(section)) return true;
      const title = (
        section.querySelector(".section-title")?.textContent || ""
      ).toLowerCase();
      if (title.includes("project")) return false;
      if (title.includes("undo history")) return false;
      if (title.includes("autosave")) return false;
      if (title.includes("library tools")) return false;
      return true;
    }
    function initSections() {
      const containers = Array.from(
        document.querySelectorAll(".sidebar-left, .sidebar-right"),
      );
      containers.forEach((container) => {
        const sections = Array.from(
          container.querySelectorAll(":scope > .section"),
        );
        sections.forEach((section) => {
          if (section.dataset.collapseInit === "1") return;
          section.dataset.collapseInit = "1";
          const collapsible = isCollapsibleSection(section);
          section.dataset.collapsibleComputed = collapsible ? "true" : "false";
          section.classList.toggle("collapsible", collapsible);
          section.classList.toggle("not-collapsible", !collapsible);
          section.classList.toggle("collapsed", !shouldStartOpen(section));
        });
      });
    }
    function onClick(e) {
      const target = e.target;
      if (!target) return;
      if (target.closest("button,input,select,textarea,a,label")) return;
      const title = target.closest(".section-title");
      if (!title) return;
      const section = title.closest(".section");
      if (!section || !isCollapsibleSection(section)) return;
      section.classList.toggle("collapsed");
    }
    initSections();
    const observer = new MutationObserver(() => initSections());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick);
    };
  }, []);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const sections = Array.from(
        document.querySelectorAll(
          ".sidebar-left > .section, .sidebar-right > .section",
        ),
      );
      sections.forEach((section, idx) => {
        if (section.dataset.collapseInit === "1") return;
        section.dataset.collapseInit = "1";
        const title = (
          section.querySelector(".section-title")?.textContent || ""
        ).toLowerCase();
        const keepOpen =
          section.dataset.defaultOpen === "true" ||
          title.includes("add component") ||
          title.includes("layout status") ||
          (idx <= 2 &&
            !title.includes("project") &&
            !title.includes("panel") &&
            !title.includes("undo history"));
        section.classList.toggle("collapsed", !keepOpen);
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [
    state.selected.length,
    state.selectedArtwork,
    state.selectedTexts,
    leftPanelOpen,
    rightPanelOpen,
  ]);
  function clientToMM(clientX, clientY) {
    const svg =
      svgRef.current || document.querySelector("svg.panel-canvas-svg");
    if (!svg) return null;
    // getBoundingClientRect accounts for CSS transforms on ancestor elements;
    // getScreenCTM is unreliable in Mobile Safari when zoom is a CSS scale on a parent div.
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    if (rect.width > 0 && rect.height > 0 && vb.width > 0 && vb.height > 0) {
      const x = vb.x + ((clientX - rect.left) / rect.width) * vb.width;
      const y = vb.y + ((clientY - rect.top) / rect.height) * vb.height;
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
    try {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const mm = pt.matrixTransform(ctm.inverse());
        if (Number.isFinite(mm.x) && Number.isFinite(mm.y))
          return { x: mm.x, y: mm.y };
      }
    } catch {}
    return null;
  }
  function measurementAnchors() {
    const xs = [0, widthMM / 2, widthMM];
    const ys = [0, PANEL_HEIGHT_MM / 2, PANEL_HEIGHT_MM];
    for (const c of state.components) {
      const e = getFrontExtents(c);
      xs.push(e.x1, c.x, e.x2);
      ys.push(e.y1, c.y, e.y2);
      const be = obbEdgeExtents(makeBodyOBB(c));
      xs.push(be.x1, be.x2);
      ys.push(be.y1, be.y2);
      const ke = obbEdgeExtents(makeKeepoutOBB(c));
      xs.push(ke.x1, ke.x2);
      ys.push(ke.y1, ke.y2);
    }
    for (const a of state.artworks) {
      if (!a.visible) continue;
      xs.push(a.x - a.width / 2, a.x, a.x + a.width / 2);
      ys.push(a.y - a.height / 2, a.y, a.y + a.height / 2);
    }
    for (const t of state.textItems) {
      if (!t.visible) continue;
      xs.push(t.x);
      ys.push(t.y);
    }
    return { x: xs, y: ys };
  }
  function snapRulerPoint(mm, free) {
    if (free) return { point: mm, snapped: false };
    const tol = 1.25;
    const anchors = measurementAnchors();
    let x = mm.x,
      y = mm.y,
      snapped = false;
    let bestX = tol;
    for (const ax of anchors.x) {
      const d = Math.abs(mm.x - ax);
      if (d < bestX) {
        bestX = d;
        x = ax;
        snapped = true;
      }
    }
    let bestY = tol;
    for (const ay of anchors.y) {
      const d = Math.abs(mm.y - ay);
      if (d < bestY) {
        bestY = d;
        y = ay;
        snapped = true;
      }
    }
    return { point: { x, y }, snapped };
  }
  function isRealDesktopMouseEvent(e) {
    const ne = e.nativeEvent;
    return !!ne && typeof ne.type === "string" && ne.type === "mousedown";
  }
  function rectsOverlap(a, b) {
    return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
  }
  function componentMarqueeExtents(c) {
    const f = getFrontExtents(c);
    const r = getRearBodyFootprintExtentsAt(c, c.x, c.y);
    return {
      x1: Math.min(f.x1, r.x1),
      x2: Math.max(f.x2, r.x2),
      y1: Math.min(f.y1, r.y1),
      y2: Math.max(f.y2, r.y2),
    };
  }
  function componentsInsideMarquee(sel) {
    const rect = {
      x1: Math.min(sel.start.x, sel.current.x),
      x2: Math.max(sel.start.x, sel.current.x),
      y1: Math.min(sel.start.y, sel.current.y),
      y2: Math.max(sel.start.y, sel.current.y),
    };
    if (
      Math.abs(rect.x2 - rect.x1) < 0.25 ||
      Math.abs(rect.y2 - rect.y1) < 0.25
    )
      return [];
    return state.components
      .filter((c) => {
        const e = componentMarqueeExtents(c);
        const centerInside =
          c.x >= rect.x1 && c.x <= rect.x2 && c.y >= rect.y1 && c.y <= rect.y2;
        return centerInside || rectsOverlap(rect, e);
      })
      .map((c) => c.id);
  }
  function computeTextSnapGuides(x, y, textId) {
    const guides = [];
    const tol = Math.max(0.25, snapSettings.distance);
    const panelCenterX = widthMM / 2;
    const panelCenterY = PANEL_HEIGHT_MM / 2;
    if (snapSettings.componentCenters && Math.abs(x - panelCenterX) <= tol) {
      guides.push({
        axis: "x",
        pos: panelCenterX,
        label: "SNAP: panel center X",
      });
    }
    if (snapSettings.componentCenters && Math.abs(y - panelCenterY) <= tol) {
      guides.push({
        axis: "y",
        pos: panelCenterY,
        label: "SNAP: panel center Y",
      });
    }
    for (const c of state.components) {
      const name = c.ref || c.label || c.name;
      if (snapSettings.componentCenters && Math.abs(x - c.x) <= tol) {
        guides.push({ axis: "x", pos: c.x, label: `SNAP: same X as ${name}` });
      }
      if (snapSettings.componentCenters && Math.abs(y - c.y) <= tol) {
        guides.push({ axis: "y", pos: c.y, label: `SNAP: same Y as ${name}` });
      }
      if (guides.length >= 5) break;
    }
    for (const t of state.textItems) {
      if (t.id === textId || !t.visible) continue;
      const name = t.text || "text";
      if (snapSettings.componentCenters && Math.abs(x - t.x) <= tol) {
        guides.push({ axis: "x", pos: t.x, label: `SNAP: same X as ${name}` });
      }
      if (snapSettings.componentCenters && Math.abs(y - t.y) <= tol) {
        guides.push({ axis: "y", pos: t.y, label: `SNAP: same Y as ${name}` });
      }
      if (guides.length >= 6) break;
    }
    return guides;
  }
  function applyTextSmartSnap(textId, rawX, rawY) {
    let x = snapSettings.grid ? snapToGrid(rawX, state.grid.size) : rawX;
    let y = snapSettings.grid ? snapToGrid(rawY, state.grid.size) : rawY;
    const guides = computeTextSnapGuides(x, y, textId);
    const gx = guides.find((g) => g.axis === "x");
    const gy = guides.find((g) => g.axis === "y");
    if (gx) x = gx.pos;
    if (gy) y = gy.pos;
    const gridGuides = snapSettings.grid ? gridSnapGuidesForPosition(x, y) : [];
    return { x, y, guides: uniqueSnapGuides([...guides, ...gridGuides]) };
  }
  function computeSnapGuidesFor(id, x, y) {
    const guides = [];
    const tol = Math.max(0.25, snapSettings.distance);
    const panelCenterX = widthMM / 2;
    const panelCenterY = PANEL_HEIGHT_MM / 2;
    if (snapSettings.componentCenters && Math.abs(x - panelCenterX) <= tol)
      guides.push({
        axis: "x",
        pos: panelCenterX,
        label: "SNAP: panel center X",
      });
    if (snapSettings.componentCenters && Math.abs(y - panelCenterY) <= tol)
      guides.push({
        axis: "y",
        pos: panelCenterY,
        label: "SNAP: panel center Y",
      });
    for (const c of state.components) {
      if (c.id === id || selectedIdSet.has(c.id)) continue;
      const name = c.ref || c.label || c.name;
      if (snapSettings.componentCenters && Math.abs(x - c.x) <= tol)
        guides.push({ axis: "x", pos: c.x, label: `SNAP: same X as ${name}` });
      if (snapSettings.componentCenters && Math.abs(y - c.y) <= tol)
        guides.push({ axis: "y", pos: c.y, label: `SNAP: same Y as ${name}` });
      if (guides.length >= 4) break;
    }
    return guides;
  }
  function snapDragDeltaToComponentCenters(primaryId, primaryOrig, dx, dy) {
    if (!snapSettings.componentCenters) return { dx, dy, guides: [] };
    const tol = Math.max(0.25, snapSettings.distance);
    let outDx = dx;
    let outDy = dy;
    const guides = [];
    const currentX = primaryOrig.x + outDx;
    const currentY = primaryOrig.y + outDy;
    let bestX = null;
    let bestY = null;
    const candidates = [
      {
        x: widthMM / 2,
        y: PANEL_HEIGHT_MM / 2,
        labelX: "SNAP: panel center X",
        labelY: "SNAP: panel center Y",
      },
      ...state.components
        .filter((c) => c.id !== primaryId && !selectedIdSet.has(c.id))
        .map((c) => {
          const name = c.ref || c.label || c.name;
          return {
            x: c.x,
            y: c.y,
            labelX: `SNAP: same X as ${name}`,
            labelY: `SNAP: same Y as ${name}`,
          };
        }),
    ];
    for (const c of candidates) {
      const dxAbs = Math.abs(currentX - c.x);
      if (dxAbs <= tol && (!bestX || dxAbs < bestX.dist))
        bestX = { pos: c.x, label: c.labelX, dist: dxAbs };
      const dyAbs = Math.abs(currentY - c.y);
      if (dyAbs <= tol && (!bestY || dyAbs < bestY.dist))
        bestY = { pos: c.y, label: c.labelY, dist: dyAbs };
    }
    if (bestX) {
      outDx += bestX.pos - currentX;
      guides.push({ axis: "x", pos: bestX.pos, label: bestX.label });
    }
    if (bestY) {
      outDy += bestY.pos - currentY;
      guides.push({ axis: "y", pos: bestY.pos, label: bestY.label });
    }
    return { dx: outDx, dy: outDy, guides };
  }
  function snapDragDeltaToCutoutCenter(primaryId, primaryOrig, dx, dy) {
    const currentX = primaryOrig.x + dx;
    const currentY = primaryOrig.y + dy;
    const captureDistance = Math.max(1.5, snapSettings.distance);
    let best = null;
    for (const c of state.components) {
      if (
        c.id === primaryId ||
        selectedIdSet.has(c.id) ||
        c.type !== "cutout" ||
        c.snapTargetEnabled === false
      )
        continue;
      const distance = Math.hypot(currentX - c.x, currentY - c.y);
      if (distance <= captureDistance && (!best || distance < best.distance)) {
        best = { component: c, distance };
      }
    }
    if (!best) return null;
    const name = best.component.ref || best.component.name || "cutout";
    return {
      dx: dx + best.component.x - currentX,
      dy: dy + best.component.y - currentY,
      guides: [
        {
          axis: "x",
          pos: best.component.x,
          label: `Hole center · ${name}`,
          targetId: best.component.id,
        },
        {
          axis: "y",
          pos: best.component.y,
          label: `Hole center · ${name}`,
          targetId: best.component.id,
        },
      ],
    };
  }
  function gridSnapGuidesForPosition(x, y) {
    if (!snapSettings.grid) return [];
    const guides = [];
    const step = state.grid.size;
    const gx = snapToGrid(x, step);
    const gy = snapToGrid(y, step);
    if (Math.abs(x - gx) < 0.0001)
      guides.push({ axis: "x", pos: gx, label: `SNAP: grid ${step} mm` });
    if (Math.abs(y - gy) < 0.0001)
      guides.push({ axis: "y", pos: gy, label: `SNAP: grid ${step} mm` });
    return guides;
  }
  function uniqueSnapGuides(guides) {
    const out = [];
    const seen = new Set();
    for (const g of guides) {
      const key = `${g.axis}:${g.pos.toFixed(3)}:${g.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(g);
      if (out.length >= 6) break;
    }
    return out;
  }
  function getRearBodySnapExtents(c, x, y) {
    return getRearBodyFootprintExtentsAt(c, x, y);
  }
  function dragGroupRearExtentsWithDelta(startPositions, dx, dy) {
    const extents = state.components
      .filter((c) => startPositions.has(c.id))
      .map((c) => {
        const orig = startPositions.get(c.id);
        return getRearBodySnapExtents(c, orig.x + dx, orig.y + dy);
      });
    if (extents.length === 0) return null;
    return {
      x1: Math.min(...extents.map((e) => e.x1)),
      x2: Math.max(...extents.map((e) => e.x2)),
      y1: Math.min(...extents.map((e) => e.y1)),
      y2: Math.max(...extents.map((e) => e.y2)),
    };
  }
  function snapDragDeltaToPanelEdges(startPositions, dx, dy) {
    const tol = Math.max(0.25, snapSettings.distance);
    const guides = [];
    let outDx = dx;
    let outDy = dy;
    if (snapSettings.panelEdges) {
      const extX = dragGroupRearExtentsWithDelta(startPositions, outDx, outDy);
      if (extX) {
        const leftD = Math.abs(extX.x1);
        const rightD = Math.abs(widthMM - extX.x2);
        if (leftD <= tol && leftD <= rightD) {
          outDx = outDx - extX.x1;
          guides.push({
            axis: "x",
            pos: 0,
            label: "SNAP: rear body → left edge",
          });
        } else if (rightD <= tol) {
          outDx = outDx + (widthMM - extX.x2);
          guides.push({
            axis: "x",
            pos: widthMM,
            label: "SNAP: rear body → right edge",
          });
        }
      }
    }
    if (state.pcb.enabled && snapSettings.pcbEdges) {
      const extY = dragGroupRearExtentsWithDelta(startPositions, outDx, outDy);
      if (extY) {
        const pcbTop = state.pcb.y;
        const pcbBottom = state.pcb.y + state.pcb.height;
        const topD = Math.abs(extY.y1 - pcbTop);
        const bottomD = Math.abs(pcbBottom - extY.y2);
        if (topD <= tol && topD <= bottomD) {
          outDy = outDy + (pcbTop - extY.y1);
          guides.push({
            axis: "y",
            pos: pcbTop,
            label: "SNAP: rear body → PCB top",
          });
        } else if (bottomD <= tol) {
          outDy = outDy + (pcbBottom - extY.y2);
          guides.push({
            axis: "y",
            pos: pcbBottom,
            label: "SNAP: rear body → PCB bottom",
          });
        }
      }
    }
    return { dx: outDx, dy: outDy, guides };
  }
  function extentsOverlap(a1, a2, b1, b2) {
    return Math.min(a2, b2) - Math.max(a1, b1) > 0.15;
  }
  function extentsOverlapMid(a1, a2, b1, b2, fallback) {
    const lo = Math.max(a1, b1);
    const hi = Math.min(a2, b2);
    return hi > lo ? (lo + hi) / 2 : fallback;
  }
  function computeComponentExtentsAt(c, pos) {
    const x = pos?.x ?? c.x;
    const y = pos?.y ?? c.y;
    return getRearBodyFootprintExtentsAt(c, x, y);
  }
  function makeDistanceGuide(axis, x1, y1, x2, y2, gap, kind, id) {
    return {
      axis,
      x1,
      y1,
      x2,
      y2,
      label: `${kind === "similar" ? "Equal gap" : "Gap"} · ${Math.max(0, gap).toFixed(2)} mm`,
      kind,
      id,
    };
  }
  function snapGuidesSignature(guides) {
    return guides
      .map((g) => `${g.axis}:${g.pos.toFixed(2)}:${g.label}`)
      .join("|");
  }
  function distanceGuidesSignature(guides) {
    return guides
      .map(
        (g) =>
          `${g.id}:${g.axis}:${g.x1.toFixed(2)}:${g.y1.toFixed(2)}:${g.x2.toFixed(2)}:${g.y2.toFixed(2)}:${g.label}:${g.kind}`,
      )
      .join("|");
  }
  function setSnapGuidesIfChanged(guides) {
    const sig = snapGuidesSignature(guides);
    if (sig === lastSnapGuidesSignatureRef.current) return;
    lastSnapGuidesSignatureRef.current = sig;
    setSnapGuides(guides);
  }
  function setDistanceGuidesIfChanged(guides) {
    const sig = distanceGuidesSignature(guides);
    if (sig === lastDistanceGuidesSignatureRef.current) return;
    lastDistanceGuidesSignatureRef.current = sig;
    setDistanceGuides(guides);
  }
  function updateDistanceGuidesForPreview(preview, force = false) {
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    if (!force && now - lastDistanceGuidesAtRef.current < 48) return;
    lastDistanceGuidesAtRef.current = now;
    setDistanceGuidesIfChanged(computeDistanceGuidesForPreview(preview));
  }
  function updateDistanceGuidesForPrimary(primaryId, pos, force = false) {
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    if (!force && now - lastDistanceGuidesAtRef.current < 64) return;
    lastDistanceGuidesAtRef.current = now;
    setDistanceGuidesIfChanged(
      computeDistanceGuidesForPreview(new Map([[primaryId, pos]])),
    );
  }
  function snapDragDeltaToPrimaryBodyEdges(primaryId, orig, dx, dy) {
    const comp = state.components.find((c) => c.id === primaryId);
    if (!comp) return { dx, dy, guides: [] };
    const tol = Math.max(0.25, snapSettings.distance);
    const guides = [];
    let outDx = dx;
    let outDy = dy;
    if (snapSettings.panelEdges) {
      const e = getRearBodySnapExtents(comp, orig.x + outDx, orig.y + outDy);
      const leftD = Math.abs(e.x1);
      const rightD = Math.abs(widthMM - e.x2);
      if (leftD <= tol && leftD <= rightD) {
        outDx -= e.x1;
        guides.push({
          axis: "x",
          pos: 0,
          label: "SNAP: active part → left edge",
        });
      } else if (rightD <= tol) {
        outDx += widthMM - e.x2;
        guides.push({
          axis: "x",
          pos: widthMM,
          label: "SNAP: active part → right edge",
        });
      }
    }
    if (state.pcb.enabled && snapSettings.pcbEdges) {
      const e = getRearBodySnapExtents(comp, orig.x + outDx, orig.y + outDy);
      const pcbTop = state.pcb.y;
      const pcbBottom = state.pcb.y + state.pcb.height;
      const topD = Math.abs(e.y1 - pcbTop);
      const bottomD = Math.abs(pcbBottom - e.y2);
      if (topD <= tol && topD <= bottomD) {
        outDy += pcbTop - e.y1;
        guides.push({
          axis: "y",
          pos: pcbTop,
          label: "SNAP: active part → PCB top",
        });
      } else if (bottomD <= tol) {
        outDy += pcbBottom - e.y2;
        guides.push({
          axis: "y",
          pos: pcbBottom,
          label: "SNAP: active part → PCB bottom",
        });
      }
    }
    return { dx: outDx, dy: outDy, guides };
  }
  function clearLiveGuides() {
    lastSnapGuidesSignatureRef.current = "";
    lastDistanceGuidesSignatureRef.current = "";
    lastDistanceGuidesAtRef.current = 0;
    lastDragPreviewSignatureRef.current = "";
    setSnapGuides([]);
    setDistanceGuides([]);
    lastSnapHapticKeyRef.current = "";
  }
  function computeDistanceGuidesForPreview(preview) {
    const activeIds = new Set([...preview.keys()]);
    const activeComps = state.components.filter((c) => activeIds.has(c.id));
    if (activeComps.length === 0) return [];
    const activeExtents = activeComps.map((c) =>
      computeComponentExtentsAt(c, preview.get(c.id)),
    );
    const group = {
      x1: Math.min(...activeExtents.map((e) => e.x1)),
      x2: Math.max(...activeExtents.map((e) => e.x2)),
      y1: Math.min(...activeExtents.map((e) => e.y1)),
      y2: Math.max(...activeExtents.map((e) => e.y2)),
    };
    const groupCx = (group.x1 + group.x2) / 2;
    const groupCy = (group.y1 + group.y2) / 2;
    const others = state.components
      .filter((c) => !activeIds.has(c.id))
      .map((c) => ({ c, e: computeComponentExtentsAt(c) }));
    const guides = [];
    const candidates = [];
    for (const item of others) {
      const e = item.e;
      const verticalRelated =
        extentsOverlap(group.y1, group.y2, e.y1, e.y2) ||
        Math.abs((e.y1 + e.y2) / 2 - groupCy) < 10;
      const horizontalRelated =
        extentsOverlap(group.x1, group.x2, e.x1, e.x2) ||
        Math.abs((e.x1 + e.x2) / 2 - groupCx) < 10;
      if (verticalRelated && e.x2 <= group.x1)
        candidates.push({ dir: "left", gap: group.x1 - e.x2, item });
      if (verticalRelated && e.x1 >= group.x2)
        candidates.push({ dir: "right", gap: e.x1 - group.x2, item });
      if (horizontalRelated && e.y2 <= group.y1)
        candidates.push({ dir: "top", gap: group.y1 - e.y2, item });
      if (horizontalRelated && e.y1 >= group.y2)
        candidates.push({ dir: "bottom", gap: e.y1 - group.y2, item });
    }
    for (const dir of ["left", "right", "top", "bottom"]) {
      const best = candidates
        .filter((c) => c.dir === dir)
        .sort((a, b) => a.gap - b.gap)[0];
      if (!best || best.gap > 55) continue;
      const e = best.item.e;
      if (dir === "left") {
        const y = extentsOverlapMid(group.y1, group.y2, e.y1, e.y2, groupCy);
        guides.push(
          makeDistanceGuide(
            "h",
            e.x2,
            y,
            group.x1,
            y,
            best.gap,
            "nearest",
            `near-left-${best.item.c.id}`,
          ),
        );
      } else if (dir === "right") {
        const y = extentsOverlapMid(group.y1, group.y2, e.y1, e.y2, groupCy);
        guides.push(
          makeDistanceGuide(
            "h",
            group.x2,
            y,
            e.x1,
            y,
            best.gap,
            "nearest",
            `near-right-${best.item.c.id}`,
          ),
        );
      } else if (dir === "top") {
        const x = extentsOverlapMid(group.x1, group.x2, e.x1, e.x2, groupCx);
        guides.push(
          makeDistanceGuide(
            "v",
            x,
            e.y2,
            x,
            group.y1,
            best.gap,
            "nearest",
            `near-top-${best.item.c.id}`,
          ),
        );
      } else if (dir === "bottom") {
        const x = extentsOverlapMid(group.x1, group.x2, e.x1, e.x2, groupCx);
        guides.push(
          makeDistanceGuide(
            "v",
            x,
            group.y2,
            x,
            e.y1,
            best.gap,
            "nearest",
            `near-bottom-${best.item.c.id}`,
          ),
        );
      }
    }
    const primary = activeComps[0];
    const sameType = state.components
      .filter((c) => c.type === primary.type)
      .map((c) => ({ c, e: computeComponentExtentsAt(c, preview.get(c.id)) }));
    let addedSimilar = 0;
    const maxSimilar = 8;
    const centerY = (it) => (it.e.y1 + it.e.y2) / 2;
    const centerX = (it) => (it.e.x1 + it.e.x2) / 2;
    const row = [...sameType].sort((a, b) => centerX(a) - centerX(b));
    for (let i = 0; i < row.length - 1 && addedSimilar < maxSimilar; i++) {
      const a = row[i],
        b = row[i + 1];
      const gap = b.e.x1 - a.e.x2;
      if (gap < 0 || gap > 45) continue;
      const aligned =
        extentsOverlap(a.e.y1, a.e.y2, b.e.y1, b.e.y2) ||
        Math.abs(centerY(a) - centerY(b)) <= 3;
      if (!aligned) continue;
      const y = extentsOverlapMid(
        a.e.y1,
        a.e.y2,
        b.e.y1,
        b.e.y2,
        (centerY(a) + centerY(b)) / 2,
      );
      guides.push(
        makeDistanceGuide(
          "h",
          a.e.x2,
          y,
          b.e.x1,
          y,
          gap,
          "similar",
          `sim-h-${a.c.id}-${b.c.id}`,
        ),
      );
      addedSimilar++;
    }
    const col = [...sameType].sort((a, b) => centerY(a) - centerY(b));
    for (let i = 0; i < col.length - 1 && addedSimilar < maxSimilar * 2; i++) {
      const a = col[i],
        b = col[i + 1];
      const gap = b.e.y1 - a.e.y2;
      if (gap < 0 || gap > 45) continue;
      const aligned =
        extentsOverlap(a.e.x1, a.e.x2, b.e.x1, b.e.x2) ||
        Math.abs(centerX(a) - centerX(b)) <= 3;
      if (!aligned) continue;
      const x = extentsOverlapMid(
        a.e.x1,
        a.e.x2,
        b.e.x1,
        b.e.x2,
        (centerX(a) + centerX(b)) / 2,
      );
      guides.push(
        makeDistanceGuide(
          "v",
          x,
          a.e.y2,
          x,
          b.e.y1,
          gap,
          "similar",
          `sim-v-${a.c.id}-${b.c.id}`,
        ),
      );
      addedSimilar++;
    }
    const seen = new Set();
    return guides
      .filter((g) => {
        const key = `${g.axis}:${g.x1.toFixed(2)}:${g.y1.toFixed(2)}:${g.x2.toFixed(2)}:${g.y2.toFixed(2)}:${g.kind}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 14);
  }
  function computeStaticClearanceGuides() {
    if (!state.selected.length) return [];
    const preview = new Map();
    for (const c of state.components) {
      if (selectedIdSet.has(c.id)) preview.set(c.id, { x: c.x, y: c.y });
    }
    return computeDistanceGuidesForPreview(preview);
  }
  function selectedComponents() {
    return state.components.filter((c) => selectedIdSet.has(c.id));
  }
  function centerSelected(axis) {
    const sel = selectedComponents();
    if (!sel.length) return;
    const ex = sel.map(getFrontExtents);
    const minX = Math.min(...ex.map((e) => e.x1)),
      maxX = Math.max(...ex.map((e) => e.x2));
    const minY = Math.min(...ex.map((e) => e.y1)),
      maxY = Math.max(...ex.map((e) => e.y2));
    const dx = axis === "y" ? 0 : widthMM / 2 - (minX + maxX) / 2;
    const dy = axis === "x" ? 0 : PANEL_HEIGHT_MM / 2 - (minY + maxY) / 2;
    dispatch({
      type: "MOVE_COMPONENTS",
      moves: sel.map((c) => ({ id: c.id, x: c.x + dx, y: c.y + dy })),
    });
  }
  async function duplicatePattern() {
    const sel = selectedComponents();
    if (!sel.length) return;
    const result = await appPatternPrompt();
    if (!result) return;
    const { count, direction, spacing } = result;
    const dx =
      direction === "right" ? spacing : direction === "left" ? -spacing : 0;
    const dy =
      direction === "down" ? spacing : direction === "up" ? -spacing : 0;
    const comps = [];
    for (let step = 1; step <= count; step++)
      for (const c of sel)
        comps.push({
          ...c,
          id: crypto.randomUUID(),
          ref: nextRefForComponent(c.type, [...state.components, ...comps]),
          x: c.x + dx * step,
          y: c.y + dy * step,
        });
    dispatch({ type: "ADD_COMPONENTS", components: comps });
  }
  async function setSelectedSpacing(axis) {
    const spacing = await appNumberPrompt({
      title: axis === "h" ? "Horizontal spacing" : "Vertical spacing",
      subtitle: "Set center-to-center spacing for the current selection.",
      label:
        axis === "h"
          ? "Horizontal center spacing, mm"
          : "Vertical center spacing, mm",
      defaultValue: "10",
      min: 0,
      step: 0.1,
      confirmText: "Apply spacing",
    });
    if (spacing !== null && Number.isFinite(spacing))
      dispatch({ type: "SET_SELECTED_SPACING", axis, spacing });
  }
  function nudgeSelected(dx, dy) {
    const sel = selectedComponents();
    if (!sel.length) return;
    dispatch({
      type: "MOVE_COMPONENTS",
      moves: sel.map((c) => ({ id: c.id, x: c.x + dx, y: c.y + dy })),
    });
  }
  function showMobileToast(message) {
    setMobileToast(message);
    if (mobileToastTimerRef.current !== null)
      window.clearTimeout(mobileToastTimerRef.current);
    mobileToastTimerRef.current = window.setTimeout(() => {
      setMobileToast("");
      mobileToastTimerRef.current = null;
    }, 1150);
  }
  function touchDistance(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }
  function touchMidpoint(t1, t2) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  }
  function clampZoom(z) {
    return Math.max(0.25, Math.min(6, z));
  }
  function clearComponentLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }
  function scheduleComponentLongPress(target, clientX, clientY) {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches
    )
      return;
    const el = target;
    const group = el.closest("[data-id]");
    if (!group) return;
    const id = group.getAttribute("data-id");
    if (!id) return;
    const comp = state.components.find((c) => c.id === id);
    if (!comp) return;
    clearComponentLongPress();
    longPressStartRef.current = { id, x: clientX, y: clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      dispatch({ type: "SELECT", ids: [id], additive: false });
      setDragging(null);
      setDragPreview(null);
      setDragStartPositions(null);
      lastDragPreviewSignatureRef.current = "";
      setDraggingArtwork(null);
      setArtworkDragPreview(null);
      setResizingArtwork(null);
      setArtworkResizePreview(null);
      setDraggingText(null);
      setTextDragPreview(null);
      setComponentMenu({ id, x: clientX, y: clientY });
      longPressTimerRef.current = null;
    }, 560);
  }
  function cancelLongPressIfMoved(clientX, clientY) {
    const start = longPressStartRef.current;
    if (!start) return;
    if (Math.hypot(clientX - start.x, clientY - start.y) > 10) {
      clearComponentLongPress();
    }
  }
  function canStartSidebarSwipe(target, clientX) {
    const raw = target;
    const el =
      raw && typeof raw.closest === "function"
        ? raw
        : (raw?.parentElement ?? null);
    if (!el || typeof el.closest !== "function") return false;
    if (
      el.closest(
        "input, textarea, select, button, summary, details, [role=menu], .dropdown-menu",
      )
    )
      return false;
    if (el.closest(".mobile-mode-switch")) return false;
    if (typeof window === "undefined") return false;
    if (leftPanelOpen || rightPanelOpen)
      return clientX >= 0 && clientX <= window.innerWidth;
    if (
      el.closest("[data-id]") ||
      el.closest("[data-artwork-id]") ||
      el.closest("[data-text-id]") ||
      el.closest("[data-artwork-resize]")
    )
      return false;
    return clientX >= 0 && clientX <= window.innerWidth;
  }
  function resolveSidebarSwipe(dx, dy) {
    if (Math.abs(dx) < 74 || Math.abs(dx) < Math.abs(dy) * 1.4) return false;
    if (rightPanelOpen && dx > 0) {
      setRightPanelOpen(false);
      return true;
    }
    if (leftPanelOpen && dx < 0) {
      setLeftPanelOpen(false);
      return true;
    }
    return false;
  }
  useEffect(() => {
    if (!isNarrowInitial) return;
    let start = null;
    function busyWithEditorGesture() {
      return !!(
        draggingRef.current ||
        draggingTextRef.current ||
        draggingArtworkRef.current ||
        resizingArtworkRef.current ||
        rotatingComponentRef.current ||
        pinching ||
        panning ||
        touchPanning ||
        ruler?.dragging ||
        pendingMarqueeRef.current ||
        marqueeSelectionRef.current ||
        pendingAddPart ||
        pendingTemplatePlacement ||
        componentMenu
      );
    }
    function onDocTouchStart(ev) {
      if (ev.touches.length !== 1) {
        start = null;
        return;
      }
      if (busyWithEditorGesture()) {
        start = null;
        return;
      }
      const t = ev.touches[0];
      const target = ev.target;
      if (
        target?.closest?.(
          ".mobile-main-dock, .mobile-bottom-sheet, .toolbar-popover, .export-dialog-panel, .command-palette, .component-menu, input, textarea, select, button",
        )
      ) {
        start = null;
        return;
      }
      if (!(leftPanelOpen || rightPanelOpen)) {
        start = null;
        return;
      }
      if (!canStartSidebarSwipe(ev.target, t.clientX)) {
        start = null;
        return;
      }
      start = { x: t.clientX, y: t.clientY };
    }
    function onDocTouchMove(ev) {
      if (!start || ev.touches.length !== 1) return;
      if (busyWithEditorGesture()) {
        start = null;
        return;
      }
      const t = ev.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        start = null;
        return;
      }
      if (resolveSidebarSwipe(dx, dy)) {
        ev.preventDefault();
        softHaptic(6);
        start = null;
      }
    }
    function onDocTouchEnd() {
      start = null;
    }
    document.addEventListener("touchstart", onDocTouchStart, { passive: true });
    document.addEventListener("touchmove", onDocTouchMove, { passive: false });
    document.addEventListener("touchend", onDocTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onDocTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onDocTouchStart);
      document.removeEventListener("touchmove", onDocTouchMove);
      document.removeEventListener("touchend", onDocTouchEnd);
      document.removeEventListener("touchcancel", onDocTouchEnd);
    };
  }, [
    isNarrowInitial,
    leftPanelOpen,
    rightPanelOpen,
    pinching,
    panning,
    touchPanning,
    ruler,
    resizingArtwork,
  ]);
  function onDrawerSwipeStart(e) {
    if (!(leftPanelOpen || rightPanelOpen)) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    setDrawerCloseSwipe({ startX: t.clientX, startY: t.clientY });
  }
  function onDrawerSwipeMove(e) {
    if (!drawerCloseSwipe || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - drawerCloseSwipe.startX;
    const dy = t.clientY - drawerCloseSwipe.startY;
    if (Math.abs(dx) < 66 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (rightPanelOpen && dx > 0) {
      e.preventDefault();
      setRightPanelOpen(false);
      setDrawerCloseSwipe(null);
      return;
    }
    if (leftPanelOpen && dx < 0) {
      e.preventDefault();
      setLeftPanelOpen(false);
      setDrawerCloseSwipe(null);
      return;
    }
    if (leftPanelOpen && rightPanelOpen) {
      e.preventDefault();
      if (dx > 0) setRightPanelOpen(false);
      else setLeftPanelOpen(false);
      setDrawerCloseSwipe(null);
    }
  }
  function onDrawerSwipeEnd() {
    setDrawerCloseSwipe(null);
  }
  function duplicateComponentFromMenu(id) {
    dispatch({
      type:
        state.selected.length > 1 && state.selected.includes(id)
          ? "DUPLICATE_SELECTED"
          : "DUPLICATE_COMPONENT",
      id,
    });
    setComponentMenu(null);
    clearComponentLongPress();
  }
  function rotateComponentFromMenu(id) {
    const comp = state.components.find((c) => c.id === id);
    if (!comp) return;
    if (state.selected.length > 1 && state.selected.includes(id)) {
      dispatch({ type: "ROTATE_SELECTED", degrees: 90 });
    } else {
      dispatch({
        type: "UPDATE_COMPONENT",
        id,
        patch: { rotation: ((comp.rotation || 0) + 90) % 360 },
      });
      dispatch({ type: "SELECT", ids: [id], additive: false });
    }
    setComponentMenu(null);
    clearComponentLongPress();
  }
  function deleteComponentFromMenu(id) {
    dispatch({
      type:
        state.selected.length > 1 && state.selected.includes(id)
          ? "DELETE_SELECTED"
          : "DELETE_COMPONENT",
      id,
    });
    setComponentMenu(null);
    clearComponentLongPress();
  }
  function resetRightDrawerPosition() {
    const right = document.querySelector(".sidebar-right");
    if (!right) return null;
    right.scrollLeft = 0;
    right.style.left = "";
    right.style.right = "";
    return right;
  }
  function openComponentPropertiesPanel() {
    setRightPanelOpen(true);
    setRightInspectorTopTab("inspect");
    setRightInspectTab("properties");
    window.setTimeout(() => {
      const right = resetRightDrawerPosition();
      if (!right) return;
      const props = right.querySelector("[data-component-properties]");
      const page = right.querySelector(".right-tab-page");
      if (props) {
        props.classList.remove("collapsed");
        right.scrollTop = 0;
        if (page)
          page.scrollTop = Math.max(0, props.offsetTop - page.offsetTop - 8);
        else right.scrollTop = Math.max(0, props.offsetTop - 8);
      } else {
        right.scrollTop = 0;
        if (page) page.scrollTop = 0;
      }
    }, 60);
  }
  function openArtworkPropertiesPanel() {
    setRightPanelOpen(true);
    setRightInspectorTopTab("inspect");
    setRightInspectTab("properties");
    window.setTimeout(() => {
      const right = resetRightDrawerPosition();
      if (!right) return;
      const props = right.querySelector("[data-artwork-properties]");
      const page = right.querySelector(".right-tab-page");
      if (props) {
        props.classList.remove("collapsed");
        right.scrollTop = 0;
        if (page)
          page.scrollTop = Math.max(0, props.offsetTop - page.offsetTop - 8);
        else right.scrollTop = Math.max(0, props.offsetTop - 8);
      } else {
        right.scrollTop = 0;
        if (page) page.scrollTop = 0;
      }
    }, 60);
  }
  function openTextPropertiesPanel() {
    setRightPanelOpen(true);
    setRightInspectorTopTab("inspect");
    setRightInspectTab("properties");
  }
  function enterTextEdit(id) {
    dispatch({ type: "SELECT_TEXT", id });
    setEditingTextId(id);
    openTextPropertiesPanel();
  }
  function onSVGDoubleClick(e) {
    const el = e.target;
    const textGroup = el.closest("[data-text-id]");
    if (textGroup) {
      const id = textGroup.getAttribute("data-text-id");
      const t = state.textItems.find((tt) => tt.id === id);
      if (t && !t.locked) {
        enterTextEdit(id);
      }
      return;
    }
  }
  function onSVGContextMenu(e) {
    const el = e.target;
    const group = el.closest("[data-id]");
    e.preventDefault();
    e.stopPropagation();
    if (!group) {
      setComponentMenu(null);
      AppCommands.openComponentLibraryPicker();
      return;
    }
    const id = group.getAttribute("data-id");
    if (!state.selected.includes(id)) {
      dispatch({ type: "SELECT", ids: [id], additive: false });
    }
    setComponentMenu({ id, x: e.clientX, y: e.clientY });
  }
  function onSVGMouseDown(e) {
    if (e.button !== 0) return;
    if (
      isRealDesktopMouseEvent(e) &&
      Date.now() - lastTouchEventAtRef.current < 700
    ) {
      e.preventDefault();
      return;
    }
    setComponentMenu(null);
    const mm = clientToMM(e.clientX, e.clientY);
    if (!mm) return;
    const el = e.target;
    if (pendingAddPart) {
      const hitComponent = el.closest("[data-id]");
      const hitText = el.closest("[data-text-id]");
      const hitArtwork = el.closest("[data-artwork-id]");
      const hitHandle = el.closest(
        "[data-artwork-resize], [data-component-rotate]",
      );
      if (!hitComponent && !hitText && !hitArtwork && !hitHandle) {
        e.preventDefault();
        e.stopPropagation();
        const x = snapToGrid(mm.x, state.grid.size);
        const y = snapToGrid(mm.y, state.grid.size);
        dispatch({ type: "ADD_COMPONENT", def: pendingAddPart.def, x, y });
        const keepPlacing = e.shiftKey || pendingAddRepeat;
        if (!keepPlacing) {
          setPendingAddPart(null);
          setPendingAddPreview(null);
          setPendingAddRepeat(false);
          resetCanvasInteractionMode();
        } else {
          setPendingAddPreview({ x, y });
          setCanvasInteractionMode("placingPart");
        }
        softHaptic(e.shiftKey ? 3 : 5);
        return;
      }
    }
    if (pendingTemplatePlacement) {
      e.preventDefault();
      e.stopPropagation();
      const placed = previewTemplateComponents({
        ...pendingTemplatePlacement,
        anchor: {
          x: snapToGrid(mm.x, state.grid.size),
          y: snapToGrid(mm.y, state.grid.size),
        },
      }).map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        ref: nextRefForComponent(c.type, state.components),
      }));
      dispatch({
        type: "ADD_COMPONENTS",
        components: placed,
        selectedIds: placed.map((c) => c.id),
      });
      setPendingTemplatePlacement(null);
      resetCanvasInteractionMode();
      return;
    }
    if (touchMode === "ruler") {
      e.preventDefault();
      e.stopPropagation();
      const snapped = snapRulerPoint(mm, e.shiftKey);
      setRuler({
        start: snapped.point,
        end: snapped.point,
        dragging: true,
        snappedStart: snapped.snapped,
        snappedEnd: snapped.snapped,
      });
      setCanvasInteractionMode("ruler");
      dispatch({ type: "DESELECT_ALL" });
      return;
    }
    const rotateHandle = el.closest("[data-component-rotate]");
    if (rotateHandle) {
      e.preventDefault();
      e.stopPropagation();
      const id = rotateHandle.getAttribute("data-component-rotate");
      const comp = state.components.find((c) => c.id === id);
      if (comp && !comp.locked) {
        const startAngle =
          (Math.atan2(mm.y - comp.y, mm.x - comp.x) * 180) / Math.PI;
        dispatch({ type: "SELECT", ids: [id], additive: false });
        setRotatingComponent({
          id,
          cx: comp.x,
          cy: comp.y,
          startRotation: comp.rotation || 0,
          startAngle,
        });
        setCanvasInteractionMode("rotatingComponent");
        setRotationPreview(new Map([[id, comp.rotation || 0]]));
      }
      return;
    }
    const textGroup = el.closest("[data-text-id]");
    if (textGroup) {
      e.stopPropagation();
      const id = textGroup.getAttribute("data-text-id");
      const t = state.textItems.find((tt) => tt.id === id);
      if (t) {
        dispatch({ type: "SELECT_TEXT", id });
        if (!t.locked) {
          setDraggingText({ id, offX: mm.x - t.x, offY: mm.y - t.y });
          setTextDragPreview({ id, x: t.x, y: t.y });
          setCanvasInteractionMode("draggingText");
        }
      }
      return;
    }
    const resizeHandle = el.closest("[data-artwork-resize]");
    if (resizeHandle) {
      e.stopPropagation();
      const [artId, corner] = resizeHandle
        .getAttribute("data-artwork-resize")
        .split(":");
      const art = state.artworks.find((a) => a.id === artId);
      if (art) {
        setResizingArtwork({
          id: artId,
          corner: corner,
          startMM: { x: mm.x, y: mm.y },
          startW: art.width,
          startH: art.height,
          startArtX: art.x,
          startArtY: art.y,
        });
        setArtworkResizePreview({
          id: artId,
          x: art.x,
          y: art.y,
          width: art.width,
          height: art.height,
        });
      }
      return;
    }
    const artworkGroup = el.closest("[data-artwork-id]");
    if (artworkGroup) {
      e.stopPropagation();
      const artId = artworkGroup.getAttribute("data-artwork-id");
      const art = state.artworks.find((a) => a.id === artId);
      if (art) {
        if (e.detail >= 2) {
          e.preventDefault();
          dispatch({ type: "SELECT_ARTWORK", id: artId });
          openArtworkPropertiesPanel();
          setDraggingArtwork(null);
          setArtworkDragPreview(null);
          setResizingArtwork(null);
          setArtworkResizePreview(null);
          return;
        }
        if (art.locked && state.ignoreLockedArtworkClicks) {
        } else {
          dispatch({ type: "SELECT_ARTWORK", id: artId });
          if (!art.locked) {
            setDraggingArtwork({
              id: artId,
              offX: mm.x - art.x,
              offY: mm.y - art.y,
            });
            setCanvasInteractionMode("draggingArtwork");
            setArtworkDragPreview({ id: artId, x: art.x, y: art.y });
          }
          return;
        }
      } else {
        return;
      }
    }
    const group = el.closest("[data-id]");
    if (group) {
      e.stopPropagation();
      const id = group.getAttribute("data-id");
      const comp = state.components.find((c) => c.id === id);
      const groupIds = comp.groupId
        ? state.components
            .filter((c) => c.groupId === comp.groupId)
            .map((c) => c.id)
        : [id];
      const isTouchSynthetic = !isRealDesktopMouseEvent(e);
      const selectionIds = isTouchSynthetic ? [id] : groupIds;
      if (e.detail >= 2) {
        e.preventDefault();
        dispatch({ type: "SELECT", ids: selectionIds, additive: false });
        if (isTouchSynthetic) AppCommands.openMobileQuickLabelEdit();
        else {
          openComponentPropertiesPanel();
          if (e.target.closest("[data-label-component-id]")) {
            window.setTimeout(() => {
              const inp = document.querySelector("[data-label-input]");
              if (inp) {
                inp.focus();
                inp.select();
              }
            }, 80);
          }
        }
        setDragging(null);
        setDragPreview(null);
        setDragStartPositions(null);
        return;
      }
      if (touchMode === "select") {
        const next = selectionIds.every((gid) => state.selected.includes(gid))
          ? state.selected.filter((selId) => !selectionIds.includes(selId))
          : [...new Set([...state.selected, ...selectionIds])];
        dispatch({ type: "SELECT", ids: next, additive: false });
        return;
      }
      if (isTouchSynthetic) {
        dispatch({ type: "SELECT", ids: selectionIds, additive: false });
      } else if (e.shiftKey) {
        dispatch({ type: "SELECT", ids: selectionIds, additive: true });
      } else if (!selectionIds.every((gid) => state.selected.includes(gid))) {
        dispatch({ type: "SELECT", ids: selectionIds, additive: false });
      }
      if (comp.locked || (mobileProtectMode && isTouchSynthetic)) {
        if (mobileProtectMode && isTouchSynthetic && !comp.locked)
          showMobileToast("Protect layout: drag disabled");
        setDragging(null);
        setDragPreview(null);
        setDragStartPositions(null);
        return;
      }
      setDragging({
        id,
        offX: mm.x - comp.x,
        offY: mm.y - comp.y,
        startX: mm.x,
        startY: mm.y,
        moved: false,
      });
      setCanvasInteractionMode("draggingComponents");
      const newSelected = isTouchSynthetic
        ? selectionIds
        : e.shiftKey
          ? [...new Set([...state.selected, ...selectionIds])]
          : selectionIds.every((gid) => state.selected.includes(gid))
            ? state.selected
            : selectionIds;
      const startPositions = new Map(
        state.components
          .filter((c) => newSelected.includes(c.id))
          .map((c) => [c.id, { x: c.x, y: c.y }]),
      );
      setDragStartPositions(startPositions);
      const initPreview = new Map();
      startPositions.forEach((pos, cid) =>
        initPreview.set(cid, { x: pos.x, y: pos.y }),
      );
      setDragPreview(initPreview);
      softHaptic(5);
    } else {
      const isDesktopMouse = isRealDesktopMouseEvent(e);
      if (!isDesktopMouse) {
        e.preventDefault();
        dispatch({ type: "DESELECT_ALL" });
        setPendingMarquee(null);
        setMarqueeSelection(null);
        resetCanvasInteractionMode();
        return;
      }
      if (touchMode !== "pan") {
        e.preventDefault();
        setPendingMarquee({
          start: mm,
          additive: e.shiftKey,
          initialSelection: state.selected,
        });
        setCanvasInteractionMode("idle");
      } else if (touchMode !== "select") {
        if (!e.shiftKey) dispatch({ type: "DESELECT_ALL" });
      }
    }
  }
  function updatePlacementPreview(mm) {
    if (pendingAddPart) {
      const nextPending = {
        x: snapToGrid(mm.x, state.grid.size),
        y: snapToGrid(mm.y, state.grid.size),
      };
      setPendingAddPreview((prev) =>
        prev &&
        Math.abs(prev.x - nextPending.x) < 0.001 &&
        Math.abs(prev.y - nextPending.y) < 0.001
          ? prev
          : nextPending,
      );
    }
    if (pendingTemplatePlacement) {
      setPendingTemplatePlacement({
        ...pendingTemplatePlacement,
        anchor: {
          x: snapToGrid(mm.x, state.grid.size),
          y: snapToGrid(mm.y, state.grid.size),
        },
      });
    }
  }
  function updatePendingMarquee(mm) {
    if (!pendingMarquee) return false;
    const dx = Math.abs(mm.x - pendingMarquee.start.x);
    const dy = Math.abs(mm.y - pendingMarquee.start.y);
    if (dx >= 0.35 || dy >= 0.35) {
      const next = {
        start: pendingMarquee.start,
        current: mm,
        additive: pendingMarquee.additive,
        initialSelection: pendingMarquee.initialSelection,
      };
      setPendingMarquee(null);
      setMarqueeSelection(next);
      setCanvasInteractionMode("marqueeSelecting");
    }
    return true;
  }
  function updateActiveMarquee(mm) {
    if (!marqueeSelection) return false;
    setMarqueeSelection({ ...marqueeSelection, current: mm });
    return true;
  }
  function updateRulerPreview(mm, freeMeasure) {
    if (!(touchMode === "ruler" && ruler?.dragging)) return false;
    const snapped = snapRulerPoint(mm, freeMeasure);
    setRuler((r) =>
      r ? { ...r, end: snapped.point, snappedEnd: snapped.snapped } : r,
    );
    return true;
  }
  function updateRotationPreviewFromPointer(mm, shiftKey) {
    if (!rotatingComponent) return false;
    const angle =
      (Math.atan2(mm.y - rotatingComponent.cy, mm.x - rotatingComponent.cx) *
        180) /
      Math.PI;
    let nextRotation =
      rotatingComponent.startRotation + angle - rotatingComponent.startAngle;
    nextRotation = ((nextRotation % 360) + 360) % 360;
    nextRotation = shiftKey
      ? Math.round(nextRotation / 15) * 15
      : Math.round(nextRotation);
    setRotationPreview(new Map([[rotatingComponent.id, nextRotation]]));
    return true;
  }
  function updateComponentDragPreview(mm, shiftKey) {
    if (!dragging || !dragStartPositions) return;
    const primaryOrig = dragStartPositions.get(dragging.id);
    if (!primaryOrig) return;
    const selectionSize = dragStartPositions.size;
    const multiDrag = selectionSize > 1;
    const rawDx = mm.x - dragging.startX;
    const rawDy = mm.y - dragging.startY;
    const moveDistance = Math.hypot(rawDx, rawDy);
    if (!dragging.moved && moveDistance < 0.35) return;
    if (!dragging.moved) setDragging((d) => (d ? { ...d, moved: true } : d));
    let dx = rawDx;
    let dy = rawDy;
    const hardSnapActive = shiftKey;
    const cutoutSnap = hardSnapActive
      ? snapDragDeltaToCutoutCenter(dragging.id, primaryOrig, rawDx, rawDy)
      : null;
    if (cutoutSnap) {
      dx = cutoutSnap.dx;
      dy = cutoutSnap.dy;
    } else if (hardSnapActive && snapSettings.grid) {
      dx = snapToGrid(rawDx, state.grid.size);
      dy = snapToGrid(rawDy, state.grid.size);
    }
    let edgeSnap = { dx, dy, guides: [] };
    let centerSnap = { dx, dy, guides: [] };
    if (hardSnapActive && !cutoutSnap) {
      edgeSnap = multiDrag
        ? snapDragDeltaToPrimaryBodyEdges(dragging.id, primaryOrig, dx, dy)
        : snapDragDeltaToPanelEdges(dragStartPositions, dx, dy);
      dx = edgeSnap.dx;
      dy = edgeSnap.dy;
      centerSnap = snapDragDeltaToComponentCenters(
        dragging.id,
        primaryOrig,
        dx,
        dy,
      );
      dx = centerSnap.dx;
      dy = centerSnap.dy;
    }
    const snappedX = primaryOrig.x + dx;
    const snappedGuideY = primaryOrig.y + dy;
    const previewSig = `${selectionSize}:${dx.toFixed(3)}:${dy.toFixed(3)}`;
    if (previewSig !== lastDragPreviewSignatureRef.current) {
      lastDragPreviewSignatureRef.current = previewSig;
      const newPreview = new Map();
      dragStartPositions.forEach((pos, cid) =>
        newPreview.set(cid, { x: pos.x + dx, y: pos.y + dy }),
      );
      setDragPreview(newPreview);
      if (stateRef.current.selectedTexts?.length) {
        const tp = {};
        stateRef.current.selectedTexts.forEach((tid) => {
          const t = stateRef.current.textItems.find(
            (tt) => tt.id === tid && !tt.componentId,
          );
          if (t) tp[tid] = { x: t.x + dx, y: t.y + dy };
        });
        setTextsDragPreview(tp);
      }
      if (
        typeof shouldShowDragMeasurement === "function"
          ? shouldShowDragMeasurement(selectionSize)
          : selectionSize <= 4
      )
        updateDistanceGuidesForPreview(newPreview);
    }
    const gridGuides =
      hardSnapActive && snapSettings.grid
        ? gridSnapGuidesForPosition(snappedX, snappedGuideY)
        : [];
    const visualCenterGuides =
      hardSnapActive && !cutoutSnap
        ? computeSnapGuidesFor(dragging.id, snappedX, snappedGuideY).filter(
            (g) =>
              !centerSnap.guides.some(
                (s) =>
                  s.axis === g.axis &&
                  Math.abs(s.pos - g.pos) < 0.001 &&
                  s.label === g.label,
              ),
          )
        : [];
    const nextGuides = uniqueSnapGuides([
      ...(cutoutSnap?.guides || []),
      ...centerSnap.guides,
      ...edgeSnap.guides,
      ...visualCenterGuides,
      ...gridGuides,
    ]);
    setSnapGuidesIfChanged(nextGuides);
    const snapKey = snapGuidesSignature(nextGuides);
    if (hardSnapActive && snapKey && snapKey !== lastSnapHapticKeyRef.current) {
      lastSnapHapticKeyRef.current = snapKey;
      softHaptic(multiDrag ? 4 : 8);
    }
    const dragReadout = `Δx: ${dx.toFixed(1)} mm   Δy: ${dy.toFixed(1)} mm`;
    if (dragReadout !== lastCoordReadoutRef.current) {
      lastCoordReadoutRef.current = dragReadout;
      setCoordReadout(dragReadout);
    }
  }
  function updateTextDragPreview(mm, shiftKey) {
    if (!draggingText) return;
    const rawX = mm.x - draggingText.offX;
    const rawY = mm.y - draggingText.offY;
    if (shiftKey) {
      const snapped = applyTextSmartSnap(draggingText.id, rawX, rawY);
      setTextDragPreview({ id: draggingText.id, x: snapped.x, y: snapped.y });
      setSnapGuidesIfChanged(snapped.guides);
      const snapKey = snapGuidesSignature(snapped.guides);
      if (snapKey && snapKey !== lastSnapHapticKeyRef.current) {
        lastSnapHapticKeyRef.current = snapKey;
        softHaptic(5);
      }
    } else {
      setTextDragPreview({ id: draggingText.id, x: rawX, y: rawY });
      clearLiveGuides();
    }
  }
  function processSVGMouseMove(e) {
    const mm = clientToMM(e.clientX, e.clientY);
    if (!mm) return;
    const nextCoordReadout = `x: ${mm.x.toFixed(1)} mm   y: ${mm.y.toFixed(1)} mm`;
    if (nextCoordReadout !== lastCoordReadoutRef.current) {
      lastCoordReadoutRef.current = nextCoordReadout;
      setCoordReadout(nextCoordReadout);
    }
    updatePlacementPreview(mm);
    if (updatePendingMarquee(mm)) return;
    if (updateActiveMarquee(mm)) return;
    if (updateRulerPreview(mm, e.shiftKey)) return;
    if (updateRotationPreviewFromPointer(mm, e.shiftKey)) return;
    if (dragging && dragStartPositions) {
      updateComponentDragPreview(mm, e.shiftKey);
    } else {
      clearLiveGuides();
    }
    if (draggingText) {
      updateTextDragPreview(mm, e.shiftKey);
    }
    if (draggingArtwork) {
      const snappedX = snapToGrid(mm.x - draggingArtwork.offX, state.grid.size);
      const snappedY = snapToGrid(mm.y - draggingArtwork.offY, state.grid.size);
      setArtworkDragPreview({
        id: draggingArtwork.id,
        x: snappedX,
        y: snappedY,
      });
    }
    if (resizingArtwork) {
      const { id, corner, startMM, startW, startH, startArtX, startArtY } =
        resizingArtwork;
      const art = state.artworks.find((a) => a.id === id);
      if (!art) return;
      const dx = mm.x - startMM.x;
      const dy = mm.y - startMM.y;
      let newW = startW;
      let newH = startH;
      let newX = startArtX;
      let newY = startArtY;
      const MIN = 1;
      if (corner === "br") {
        newW = Math.max(MIN, snapToGrid(startW + dx, state.grid.size));
        newH = art.preserveAspectRatio
          ? newW * (startH / startW)
          : Math.max(MIN, snapToGrid(startH + dy, state.grid.size));
        newX = startArtX + (newW - startW) / 2;
        newY = startArtY + (newH - startH) / 2;
      } else if (corner === "bl") {
        newW = Math.max(MIN, snapToGrid(startW - dx, state.grid.size));
        newH = art.preserveAspectRatio
          ? newW * (startH / startW)
          : Math.max(MIN, snapToGrid(startH + dy, state.grid.size));
        newX = startArtX + (startW - newW) / 2;
        newY = startArtY + (newH - startH) / 2;
      } else if (corner === "tr") {
        newW = Math.max(MIN, snapToGrid(startW + dx, state.grid.size));
        newH = art.preserveAspectRatio
          ? newW * (startH / startW)
          : Math.max(MIN, snapToGrid(startH - dy, state.grid.size));
        newX = startArtX + (newW - startW) / 2;
        newY = startArtY + (startH - newH) / 2;
      } else {
        newW = Math.max(MIN, snapToGrid(startW - dx, state.grid.size));
        newH = art.preserveAspectRatio
          ? newW * (startH / startW)
          : Math.max(MIN, snapToGrid(startH - dy, state.grid.size));
        newX = startArtX + (startW - newW) / 2;
        newY = startArtY + (startH - newH) / 2;
      }
      setArtworkResizePreview({
        id,
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      });
    }
  }
  function onSVGMouseMove(e) {
    const shouldThrottle = !!(
      dragging ||
      dragStartPositions ||
      draggingText ||
      draggingArtwork ||
      resizingArtwork ||
      rotatingComponent ||
      marqueeSelection ||
      ruler?.dragging ||
      pendingTemplatePlacement
    );
    if (
      !shouldThrottle ||
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      processSVGMouseMove(e);
      return;
    }
    pendingPointerMoveRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      shiftKey: e.shiftKey,
      target: e.target,
    };
    if (pointerMoveRafRef.current != null) return;
    pointerMoveRafRef.current = window.requestAnimationFrame(() => {
      pointerMoveRafRef.current = null;
      const pending = pendingPointerMoveRef.current;
      pendingPointerMoveRef.current = null;
      if (pending) processSVGMouseMove(pending);
    });
  }
  function onSVGMouseUp(_e) {
    if (pendingMarquee) {
      if (!pendingMarquee.additive) dispatch({ type: "DESELECT_ALL" });
      setPendingMarquee(null);
      resetCanvasInteractionMode();
      return;
    }
    if (marqueeSelection) {
      const dx = Math.abs(
        marqueeSelection.current.x - marqueeSelection.start.x,
      );
      const dy = Math.abs(
        marqueeSelection.current.y - marqueeSelection.start.y,
      );
      if (dx < 0.25 || dy < 0.25) {
        dispatch({
          type: "SELECT",
          ids: marqueeSelection.initialSelection ?? state.selected,
          additive: false,
        });
      } else {
        const ids = componentsInsideMarquee(marqueeSelection);
        const base = marqueeSelection.additive
          ? (marqueeSelection.initialSelection ?? state.selected)
          : [];
        const next = marqueeSelection.additive
          ? [...new Set([...base, ...ids])]
          : ids;
        const rect = {
          x1: Math.min(marqueeSelection.start.x, marqueeSelection.current.x),
          x2: Math.max(marqueeSelection.start.x, marqueeSelection.current.x),
          y1: Math.min(marqueeSelection.start.y, marqueeSelection.current.y),
          y2: Math.max(marqueeSelection.start.y, marqueeSelection.current.y),
        };
        const textIds = state.textItems
          .filter(
            (t) =>
              t.visible &&
              t.x >= rect.x1 &&
              t.x <= rect.x2 &&
              t.y >= rect.y1 &&
              t.y <= rect.y2,
          )
          .map((t) => t.id);
        dispatch({ type: "SELECT", ids: next, textIds, additive: false });
      }
      setMarqueeSelection(null);
      resetCanvasInteractionMode();
      return;
    }
    if (ruler?.dragging) setRuler((r) => (r ? { ...r, dragging: false } : r));
  }
  function onSVGTouchStart(e) {
    if (e.touches.length === 2) {
      clearComponentLongPress();
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      setDragging(null);
      setDragPreview(null);
      setDragStartPositions(null);
      lastDragPreviewSignatureRef.current = "";
      setDraggingArtwork(null);
      setArtworkDragPreview(null);
      setResizingArtwork(null);
      setArtworkResizePreview(null);
      setPinching({
        startDistance: Math.max(1, touchDistance(t1, t2)),
        startMid: touchMidpoint(t1, t2),
        startZoom: zoom,
        startPan: pan,
      });
      return;
    }
    if (e.touches.length !== 1) return;
    if (pinching) return;
    lastTouchEventAtRef.current = Date.now();
    const t = e.touches[0];
    if (touchMode === "ruler") {
      e.preventDefault();
      setSidebarSwipe(null);
      const mm = clientToMM(t.clientX, t.clientY);
      if (!mm) return;
      const snapped = snapRulerPoint(mm, false);
      setRuler({
        start: snapped.point,
        end: snapped.point,
        dragging: true,
        snappedStart: snapped.snapped,
        snappedEnd: snapped.snapped,
      });
      dispatch({ type: "DESELECT_ALL" });
      return;
    }
    const tapEl = e.target;
    const componentGroup =
      tapEl && typeof tapEl.closest === "function"
        ? tapEl.closest("[data-id]")
        : null;
    if (componentGroup) {
      const id = componentGroup.getAttribute("data-id");
      const now = Date.now();
      const last = lastComponentTapRef.current;
      if (
        id &&
        last &&
        last.id === id &&
        now - last.t < 340 &&
        Math.hypot(t.clientX - last.x, t.clientY - last.y) < 22
      ) {
        e.preventDefault();
        clearComponentLongPress();
        lastComponentTapRef.current = null;
        dispatch({ type: "SELECT", ids: [id], additive: false });
        setTouchMode("edit");
        setDragging(null);
        setDragPreview(null);
        setDragStartPositions(null);
        window.setTimeout(openComponentPropertiesPanel, 20);
        return;
      }
      if (id)
        lastComponentTapRef.current = {
          id,
          t: now,
          x: t.clientX,
          y: t.clientY,
        };
    }
    if (
      (leftPanelOpen || rightPanelOpen) &&
      canStartSidebarSwipe(e.target, t.clientX)
    ) {
      setSidebarSwipe({ startX: t.clientX, startY: t.clientY, active: true });
    } else {
      setSidebarSwipe(null);
    }
    if (touchMode === "pan") {
      e.preventDefault();
      setTouchPanning({ startX: t.clientX, startY: t.clientY, panStart: pan });
      return;
    }
    if (touchMode !== "select")
      scheduleComponentLongPress(e.target, t.clientX, t.clientY);
    e.preventDefault();
    onSVGMouseDown({
      button: 0,
      clientX: t.clientX,
      clientY: t.clientY,
      target: e.target,
      shiftKey: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });
  }
  function onSVGTouchMove(e) {
    if (e.touches.length === 2) {
      clearComponentLongPress();
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const mid = touchMidpoint(t1, t2);
      const dist = Math.max(1, touchDistance(t1, t2));
      const p = pinching ?? {
        startDistance: dist,
        startMid: mid,
        startZoom: zoom,
        startPan: pan,
      };
      if (!pinching) setPinching(p);
      const nextZoom = clampZoom(p.startZoom * (dist / p.startDistance));
      setZoom(nextZoom);
      setPan({
        x: p.startPan.x + (mid.x - p.startMid.x) * 0.72,
        y: p.startPan.y + (mid.y - p.startMid.y) * 0.72,
      });
      return;
    }
    if (e.touches.length !== 1) return;
    if (pinching) return;
    lastTouchEventAtRef.current = Date.now();
    const t = e.touches[0];
    cancelLongPressIfMoved(t.clientX, t.clientY);
    if (touchMode === "ruler") {
      e.preventDefault();
      const mm = clientToMM(t.clientX, t.clientY);
      if (!mm) return;
      const snapped = snapRulerPoint(mm, false);
      setRuler((r) =>
        r
          ? {
              ...r,
              end: snapped.point,
              snappedEnd: snapped.snapped,
              dragging: true,
            }
          : r,
      );
      return;
    }
    if (sidebarSwipe?.active) {
      const dx = t.clientX - sidebarSwipe.startX;
      const dy = t.clientY - sidebarSwipe.startY;
      if (resolveSidebarSwipe(dx, dy)) {
        e.preventDefault();
        clearComponentLongPress();
        setSidebarSwipe(null);
        return;
      }
      if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx))
        setSidebarSwipe(null);
    }
    e.preventDefault();
    if (touchPanning) {
      const PAN_GAIN = 0.72;
      setPan({
        x:
          touchPanning.panStart.x +
          (t.clientX - touchPanning.startX) * PAN_GAIN,
        y:
          touchPanning.panStart.y +
          (t.clientY - touchPanning.startY) * PAN_GAIN,
      });
      return;
    }
    onSVGMouseMove({ clientX: t.clientX, clientY: t.clientY, shiftKey: true });
  }
  function onSVGTouchEnd(e) {
    lastTouchEventAtRef.current = Date.now();
    clearComponentLongPress();
    e.preventDefault();
    if (pinching) {
      if (e.touches.length < 2) setPinching(null);
      return;
    }
    if (touchPanning) {
      setTouchPanning(null);
      return;
    }
    if (ruler?.dragging) setRuler((r) => (r ? { ...r, dragging: false } : r));
    setSidebarSwipe(null);
    window.dispatchEvent(new MouseEvent("mouseup"));
  }
  function onWrapMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setPanning({ startX: e.clientX, startY: e.clientY, panStart: pan });
    }
  }
  useEffect(() => {
    function onMouseMove(e) {
      if (!panning) return;
      setPan({
        x: panning.panStart.x + e.clientX - panning.startX,
        y: panning.panStart.y + e.clientY - panning.startY,
      });
    }
    function onMouseUp() {
      setPanning(null);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [panning]);
  useEffect(() => {
    function onGlobalMouseUp() {
      if (pointerMoveRafRef.current != null) {
        cancelAnimationFrame(pointerMoveRafRef.current);
        pointerMoveRafRef.current = null;
        const pending = pendingPointerMoveRef.current;
        pendingPointerMoveRef.current = null;
        if (pending) processSVGMouseMove(pending);
      }
      if (pendingMarqueeRef.current) {
        const current = pendingMarqueeRef.current;
        if (!current.additive) dispatch({ type: "DESELECT_ALL" });
        setPendingMarquee(null);
        resetCanvasInteractionMode();
      }
      if (marqueeSelectionRef.current) {
        const current = marqueeSelectionRef.current;
        const dx = Math.abs(current.current.x - current.start.x);
        const dy = Math.abs(current.current.y - current.start.y);
        if (dx < 0.25 || dy < 0.25) {
          dispatch({
            type: "SELECT",
            ids: current.initialSelection ?? state.selected,
            additive: false,
          });
        } else {
          const ids = componentsInsideMarquee(current);
          const base = current.additive
            ? (current.initialSelection ?? state.selected)
            : [];
          const next = current.additive ? [...new Set([...base, ...ids])] : ids;
          const rect = {
            x1: Math.min(current.start.x, current.current.x),
            x2: Math.max(current.start.x, current.current.x),
            y1: Math.min(current.start.y, current.current.y),
            y2: Math.max(current.start.y, current.current.y),
          };
          const textIds = stateRef.current.textItems
            .filter(
              (t) =>
                t.visible &&
                t.x >= rect.x1 &&
                t.x <= rect.x2 &&
                t.y >= rect.y1 &&
                t.y <= rect.y2,
            )
            .map((t) => t.id);
          dispatch({ type: "SELECT", ids: next, textIds, additive: false });
        }
        setMarqueeSelection(null);
        resetCanvasInteractionMode();
      }
      if (draggingRef.current) {
        if (
          draggingRef.current.moved &&
          dragPreviewRef.current &&
          dragPreviewRef.current.size > 0
        ) {
          const moves = [];
          dragPreviewRef.current.forEach((pos, id) =>
            moves.push({ id, x: pos.x, y: pos.y }),
          );
          const textMoves = [];
          if (stateRef.current.selectedTexts?.length && moves.length > 0) {
            const firstMove = moves[0];
            const startPos = dragStartPositionsRef.current?.get(firstMove.id);
            if (startPos) {
              const dx = firstMove.x - startPos.x;
              const dy = firstMove.y - startPos.y;
              stateRef.current.selectedTexts.forEach((tid) => {
                const t = stateRef.current.textItems.find(
                  (tt) => tt.id === tid && !tt.componentId,
                );
                if (t) textMoves.push({ id: tid, x: t.x + dx, y: t.y + dy });
              });
            }
          }
          if (moves.length === 1 && textMoves.length === 0) {
            dispatch({
              type: "MOVE_COMPONENT",
              id: moves[0].id,
              x: moves[0].x,
              y: moves[0].y,
            });
          } else {
            dispatch({ type: "MOVE_COMPONENTS", moves, textMoves });
          }
        }
        setDragging(null);
        setDragPreview(null);
        setTextsDragPreview(null);
        setDragStartPositions(null);
        clearLiveGuides();
        resetCanvasInteractionMode();
      }
      if (draggingTextRef.current) {
        if (textDragPreviewRef.current) {
          const { id } = draggingTextRef.current;
          const { x, y } = textDragPreviewRef.current;
          dispatch({ type: "MOVE_TEXT", id, x, y });
        }
        setDraggingText(null);
        setTextDragPreview(null);
        clearLiveGuides();
        resetCanvasInteractionMode();
      }
      if (draggingArtworkRef.current) {
        if (artworkDragPreviewRef.current) {
          const { id } = draggingArtworkRef.current;
          const { x, y } = artworkDragPreviewRef.current;
          dispatch({ type: "MOVE_ARTWORK", id, x, y });
        }
        setDraggingArtwork(null);
        setArtworkDragPreview(null);
        resetCanvasInteractionMode();
      }
      if (rotatingComponentRef.current && rotationPreviewRef.current) {
        const { id } = rotatingComponentRef.current;
        const rotation = rotationPreviewRef.current.get(id);
        if (typeof rotation === "number") {
          dispatch({ type: "UPDATE_COMPONENT", id, patch: { rotation } });
        }
      }
      if (rotatingComponentRef.current) resetCanvasInteractionMode();
      setRotatingComponent(null);
      setRotationPreview(null);
      setRuler((r) => (r?.dragging ? { ...r, dragging: false } : r));
      if (ruler?.dragging) resetCanvasInteractionMode();
      if (resizingArtworkRef.current && artworkResizePreviewRef.current) {
        const { id } = resizingArtworkRef.current;
        const { x, y, width, height } = artworkResizePreviewRef.current;
        dispatch({
          type: "UPDATE_ARTWORK",
          id,
          patch: { x, y, width, height },
        });
      }
      setResizingArtwork(null);
      setArtworkResizePreview(null);
    }
    window.addEventListener("mouseup", onGlobalMouseUp);
    return () => window.removeEventListener("mouseup", onGlobalMouseUp);
  }, [dispatch]);
  function onWheel(e) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cursor = {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    };
    setZoom((prevZoom) => {
      const nextZoom = clampZoom(prevZoom * (e.deltaY < 0 ? 1.1 : 0.9));
      const zoomRatio = nextZoom / prevZoom;
      setPan((prevPan) => ({
        x: cursor.x - (cursor.x - prevPan.x) * zoomRatio,
        y: cursor.y - (cursor.y - prevPan.y) * zoomRatio,
      }));
      return nextZoom;
    });
  }
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const s = stateRef.current;
      const pending = pendingTemplatePlacementRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcutHelp(true);
        return;
      }
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        toggleFocusMode();
        return;
      }
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.toLowerCase() === "p"
      ) {
        e.preventDefault();
        toggleManufacturingPreview();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedTexts?.length) {
          s.selectedTexts.forEach((id) =>
            dispatch({ type: "DELETE_TEXT", id }),
          );
        } else if (s.selectedArtwork) {
          dispatch({ type: "DELETE_ARTWORK", id: s.selectedArtwork });
        } else {
          dispatch({ type: "DELETE_SELECTED" });
        }
      } else if (e.key === "d" || e.key === "D") {
        dispatch({ type: "DUPLICATE_SELECTED" });
      } else if (e.key === "r" || e.key === "R") {
        if (pending) {
          e.preventDefault();
          setPendingTemplatePlacement({
            ...pending,
            rotation: (pending.rotation + 90) % 360,
          });
          return;
        }
        if (s.selected.length > 0) {
          e.preventDefault();
          dispatch({ type: "ROTATE_SELECTED", degrees: 90 });
        }
      } else if (e.key.toLowerCase() === "g") {
        if (s.selected.length > 1) {
          e.preventDefault();
          dispatch({
            type: e.shiftKey ? "UNGROUP_SELECTED" : "GROUP_SELECTED",
          });
        }
      } else if (e.key.toLowerCase() === "m") {
        if (s.selected.length > 0) {
          e.preventDefault();
          dispatch({
            type: "MIRROR_SELECTED",
            axis: e.shiftKey ? "y" : "x",
            around: "selection",
          });
        }
      } else if (e.key === "[" || e.key === "]") {
        const liveWarnings = computeWarnings(
          s.components,
          panelWidthMM(s.panel),
          s.mountingHoles,
          s.pcb,
        ).filter((warning) => warning.ids?.length);
        if (liveWarnings.length) {
          e.preventDefault();
          warningFocusIndexRef.current =
            (warningFocusIndexRef.current +
              (e.key === "]" ? 1 : -1) +
              liveWarnings.length) %
            liveWarnings.length;
          const warning = liveWarnings[warningFocusIndexRef.current];
          window.dispatchEvent(
            new CustomEvent("panel-designer:focus-components", {
              detail: { ids: warning.ids },
            }),
          );
        }
      } else if (e.key === "Escape") {
        if (previewModeRef.current) {
          const manufacturingRestore = manufacturingRestoreRef.current;
          if (manufacturingRestore) {
            dispatch({
              type: "SET_VIEW_MODE",
              mode: manufacturingRestore.viewMode,
            });
            Object.entries(manufacturingRestore.layerVisibility).forEach(
              ([key, value]) =>
                dispatch({ type: "SET_LAYER_VISIBILITY", key, value }),
            );
            setLeftPanelOpen(manufacturingRestore.panels.left);
            setRightPanelOpen(manufacturingRestore.panels.right);
            setPreviewMode(manufacturingRestore.previewMode);
            dispatch({
              type: "SELECT",
              ids: manufacturingRestore.selected,
              additive: false,
            });
            manufacturingRestoreRef.current = null;
            setManufacturingPreview(false);
          } else {
            const restore = previewRestoreRef.current;
            if (restore) {
              setLeftPanelOpen(restore.left);
              setRightPanelOpen(restore.right);
              dispatch({
                type: "SELECT",
                ids: restore.selected,
                additive: false,
              });
            }
            previewRestoreRef.current = null;
            setPreviewMode(false);
          }
          return;
        }
        if (pendingAddPart) {
          setPendingAddPart(null);
          setPendingAddPreview(null);
          setPendingAddRepeat(false);
          resetCanvasInteractionMode();
          return;
        }
        if (pending) {
          setPendingTemplatePlacement(null);
          return;
        }
        setRuler(null);
        dispatch({ type: "DESELECT_ALL" });
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "z"
      ) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        dispatch({
          type: "SELECT",
          ids: s.components.map((c) => c.id),
          additive: false,
        });
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        exportJSON(s);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        setShowExportDialog(true);
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        if (
          s.selected.length === 0 &&
          !s.selectedArtwork &&
          !s.selectedTexts?.length
        ) {
          if (
            !isNarrowInitial &&
            e.key === "ArrowRight" &&
            !e.shiftKey &&
            !e.ctrlKey &&
            !e.metaKey
          )
            setRightPanelOpen((v) => !v);
          return;
        }
        e.preventDefault();
        const d = e.shiftKey ? 0.1 : s.grid.size;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        if (s.selectedTexts?.length) {
          s.selectedTexts.forEach((tid) => {
            const t = s.textItems.find((tt) => tt.id === tid);
            if (t)
              dispatch({
                type: "MOVE_TEXT",
                id: t.id,
                x: t.x + dx,
                y: t.y + dy,
              });
          });
        }
        if (s.selectedArtwork) {
          const a = s.artworks.find((aa) => aa.id === s.selectedArtwork);
          if (a && !a.locked)
            dispatch({
              type: "MOVE_ARTWORK",
              id: a.id,
              x: a.x + dx,
              y: a.y + dy,
            });
        }
        if (s.selected.length > 0) {
          const byId = new Map(s.components.map((c) => [c.id, c]));
          const moves = s.selected
            .map((id) => {
              const c = byId.get(id);
              return c ? { id, x: c.x + dx, y: c.y + dy } : null;
            })
            .filter(Boolean);
          if (moves.length === 1)
            dispatch({
              type: "MOVE_COMPONENT",
              id: moves[0].id,
              x: moves[0].x,
              y: moves[0].y,
            });
          else if (moves.length > 1)
            dispatch({ type: "MOVE_COMPONENTS", moves });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, setRightPanelOpen]);
  const AUTOSAVE_KEY = "eurorack-panel-autosave-v4";
  const AUTOSAVE_LEGACY_KEY = "eurorack-panel-autosave-v3";
  function projectString(st) {
    return serializeProject(st, false);
  }
  function recordSuccessfulExport() {
    lastExportDataRef.current = projectString(stateRef.current);
    const exportedAt = new Date();
    setLastExportAt(exportedAt);
    setAutosaveStatus("Export complete");
  }
  function completeExport(run) {
    const result = run();
    if (result && typeof result.then === "function") {
      void result
        .then(recordSuccessfulExport)
        .finally(() => setShowExportDialog(false));
      return;
    }
    recordSuccessfulExport();
    setShowExportDialog(false);
  }
  const lastAutosaveDataRef = useRef("");
  const autosaveTimerRef = useRef(null);
  const autosaveStateRef = useRef(state);
  autosaveStateRef.current = state;
  function writeAutosaveNow(reason = "debounced") {
    try {
      const data = projectString(autosaveStateRef.current);
      if (data === lastAutosaveDataRef.current) return;
      const payload = JSON.stringify({
        autosaveVersion: 2,
        savedAt: new Date().toISOString(),
        reason,
        bytes: data.length,
        project: JSON.parse(data),
      });
      localStorage.setItem(AUTOSAVE_KEY, payload);
      try {
        localStorage.setItem(AUTOSAVE_LEGACY_KEY, data);
      } catch {}
      lastAutosaveDataRef.current = data;
      setAutosaveStatus(
        `Autosaved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${(data.length / 1024).toFixed(0)} KB`,
      );
    } catch (err) {
      const name = err?.name || "";
      setAutosaveStatus(
        name === "QuotaExceededError"
          ? "Autosave failed: storage full"
          : "Autosave failed",
      );
    }
  }
  useEffect(() => {
    if (autosaveTimerRef.current != null)
      window.clearTimeout(autosaveTimerRef.current);
    const busy = !!(
      dragging ||
      dragPreview ||
      draggingArtwork ||
      artworkDragPreview ||
      resizingArtwork ||
      artworkResizePreview ||
      draggingText ||
      textDragPreview ||
      rotatingComponent ||
      rotationPreview
    );
    const delay = busy ? 7000 : 2200;
    if (projectString(state) !== lastAutosaveDataRef.current)
      setAutosaveStatus("Saving…");
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      writeAutosaveNow("debounced");
    }, delay);
    return () => {
      if (autosaveTimerRef.current != null)
        window.clearTimeout(autosaveTimerRef.current);
    };
  }, [
    state.components,
    state.artworks,
    state.textItems,
    state.scaleItems,
    state.panel,
    state.grid,
    state.pcb,
    state.mountingHoles,
    state.customParts,
    state.projectMeta,
    state.layerVisibility,
    state.layerOpacity,
    state.layerExport,
    state.topHardwareStyle,
    state.hardwareRenderMode,
    state.mobilePerformanceMode,
    dragging,
    dragPreview,
    draggingArtwork,
    artworkDragPreview,
    resizingArtwork,
    artworkResizePreview,
    draggingText,
    textDragPreview,
    rotatingComponent,
    rotationPreview,
  ]);
  useEffect(() => {
    function onPageHide() {
      writeAutosaveNow("pagehide");
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") onPageHide();
    }
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  function readAutosavePayload() {
    const modern = localStorage.getItem(AUTOSAVE_KEY);
    if (modern) {
      try {
        const parsed = JSON.parse(modern);
        const project = parsed?.project;
        if (project && typeof project === "object")
          return {
            data: JSON.stringify(project),
            label: parsed.savedAt
              ? `saved ${new Date(parsed.savedAt).toLocaleString()}`
              : "saved project",
          };
      } catch {}
    }
    const legacy = localStorage.getItem(AUTOSAVE_LEGACY_KEY);
    return legacy ? { data: legacy, label: "legacy autosave" } : null;
  }
  function restoreAutosave() {
    const payload = readAutosavePayload();
    if (!payload) return alert("No autosave found.");
    let raw;
    try {
      raw = JSON.parse(payload.data);
    } catch {
      return alert("Autosave is corrupted.");
    }
    const result = validateAndNormalize(raw);
    if (!result.ok) return alert(`Autosave import failed: ${result.error}`);
    dispatch({ type: "LOAD_STATE", state: result.state });
    setAutosaveStatus(`Restored autosave · ${payload.label}`);
  }
  function clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(AUTOSAVE_LEGACY_KEY);
    lastAutosaveDataRef.current = "";
    setAutosaveStatus("Autosave cleared");
  }
  function onImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      let raw;
      try {
        raw = JSON.parse(ev.target.result);
      } catch {
        alert("Could not parse file: invalid JSON syntax.");
        return;
      }
      const result = validateAndNormalize(raw);
      if (!result.ok) {
        alert(`Import failed: ${result.error}`);
        return;
      }
      const hasProjectData =
        state.components.length > 0 ||
        state.artworks.length > 0 ||
        state.textItems.length > 0 ||
        state.scaleItems.length > 0;
      if (hasProjectData) {
        const ok = await appConfirm({
          title: "Load project file",
          message: "Replace the current project with the loaded project file?",
          confirmText: "Load file",
        });
        if (!ok) return;
      }
      if (result.repairs.length > 0) {
        alert(`Imported with repairs:\n• ${result.repairs.join("\n• ")}`);
      }
      dispatch({ type: "LOAD_STATE", state: result.state });
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function requestProjectFileImport() {
    pendingFileOpenRef.current = true;
    const input =
      projectFileInputRef.current ||
      document.getElementById("project-file-input");
    if (!input) {
      setAutosaveStatus("Project file input unavailable");
      pendingFileOpenRef.current = false;
      return;
    }
    try {
      input.value = "";
      input.click();
      window.setTimeout(() => {
        pendingFileOpenRef.current = false;
      }, 1200);
    } catch {
      setAutosaveStatus("Open project file failed");
      pendingFileOpenRef.current = false;
    }
  }
  function requestKiCadPcbImport() {
    const input =
      kicadPcbInputRef.current ||
      document.getElementById("kicad-pcb-file-input");
    if (!input) {
      setAutosaveStatus("KiCad PCB file input unavailable");
      return;
    }
    input.value = "";
    input.click();
  }
  function requestEagleBrdImport() {
    const input =
      eagleBrdInputRef.current ||
      document.getElementById("eagle-brd-file-input");
    if (!input) {
      setAutosaveStatus("Eagle .brd file input unavailable");
      return;
    }
    input.value = "";
    input.click();
  }
  function onKiCadPcbImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const src = String(ev.target?.result || "");
      const result = parseKiCadPcbToPanel(src, panelWidthMM(state.panel));
      if (
        !result.components.length &&
        !result.boardOutline &&
        !result.artworks?.length
      ) {
        alert(
          `KiCad import found no panel geometry.\n${result.warnings.join("\n")}`,
        );
        return;
      }
      const hasProjectData =
        state.components.length > 0 ||
        state.artworks.length > 0 ||
        state.textItems.length > 0 ||
        state.scaleItems.length > 0;
      const cutouts = result.components.filter(
        (item) => item.type === "cutout",
      );
      const panelComponents = result.components.filter(
        (item) => item.type !== "cutout",
      );
      const choices = await appImportPreview({
        format: "KiCad PCB",
        replace: hasProjectData,
        outline: !!result.boardOutline,
        components: panelComponents.length,
        cutouts: cutouts.length,
        artwork: result.artworks?.length || 0,
      });
      if (!choices) return;
      const importedComponents = [
        ...(choices.components ? panelComponents : []),
        ...(choices.cutouts ? cutouts : []),
      ];
      const importedArtwork = choices.artwork ? result.artworks || [] : [];
      const importedOutline = choices.outline ? result.boardOutline : null;
      if (
        !importedComponents.length &&
        !importedArtwork.length &&
        !importedOutline
      )
        return;
      dispatch({
        type: "LOAD_KICAD_IMPORT",
        components: importedComponents,
        artworks: importedArtwork,
        panelOutlineGeometry: choices.outline
          ? result.panelOutlineGeometry
          : null,
        panelWidthMM: result.panelWidthMM,
        boardOutline: importedOutline,
      });
      dispatch({ type: "SET_VIEW_MODE", mode: "front" });
      setAutosaveStatus(
        `Imported KiCad PCB · ${result.components.length} panel features`,
      );
      const msg = [
        `Imported KiCad panel with ${result.components.length} panel features.`,
      ];
      if (result.boardOutline)
        msg.push(
          `Edge.Cuts: ${result.boardOutline.width.toFixed(2)} × ${result.boardOutline.height.toFixed(2)} mm.`,
        );
      if (result.warnings.length) msg.push("", ...result.warnings);
      window.appNotify(msg.join("\n"), { timeout: 12000 });
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function onEagleBrdImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const src = String(ev.target?.result || "");
      const result = parseEagleBrdToPanel(src, panelWidthMM(state.panel));
      if (
        !result.components.length &&
        !result.boardOutline &&
        !result.artworks?.length
      ) {
        alert(
          `Eagle import found no panel geometry.\n${result.warnings.join("\n")}`,
        );
        return;
      }
      const hasProjectData =
        state.components.length > 0 ||
        state.artworks.length > 0 ||
        state.textItems.length > 0 ||
        state.scaleItems.length > 0;
      const cutouts = result.components.filter(
        (item) => item.type === "cutout",
      );
      const panelComponents = result.components.filter(
        (item) => item.type !== "cutout",
      );
      const choices = await appImportPreview({
        format: "Eagle .brd",
        replace: hasProjectData,
        outline: !!result.boardOutline,
        components: panelComponents.length,
        cutouts: cutouts.length,
        artwork: result.artworks?.length || 0,
      });
      if (!choices) return;
      const importedComponents = [
        ...(choices.components ? panelComponents : []),
        ...(choices.cutouts ? cutouts : []),
      ];
      const importedArtwork = choices.artwork ? result.artworks || [] : [];
      const importedOutline = choices.outline ? result.boardOutline : null;
      if (
        !importedComponents.length &&
        !importedArtwork.length &&
        !importedOutline
      )
        return;
      dispatch({
        type: "LOAD_KICAD_IMPORT",
        components: importedComponents,
        artworks: importedArtwork,
        panelOutlineGeometry: choices.outline
          ? result.panelOutlineGeometry
          : null,
        panelWidthMM: result.panelWidthMM,
        boardOutline: importedOutline,
      });
      dispatch({ type: "SET_VIEW_MODE", mode: "front" });
      setAutosaveStatus(
        `Imported Eagle .brd · ${result.components.length} panel features · ${result.artworks.length} artwork`,
      );
      const msg = [
        `Imported Eagle panel with ${result.components.length} panel features.`,
      ];
      if (result.artworks.length)
        msg.push(`Imported ${result.artworks.length} front artwork layer.`);
      if (result.boardOutline)
        msg.push(
          `Board outline: ${result.boardOutline.width.toFixed(2)} × ${result.boardOutline.height.toFixed(2)} mm.`,
        );
      if (result.warnings.length) msg.push("", ...result.warnings);
      window.appNotify(msg.join("\n"), { timeout: 12000 });
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  const autosavePayloadForLauncher = readAutosavePayload();
  const autosaveSummaryForLauncher = autosavePayloadForLauncher
    ? {
        label: autosavePayloadForLauncher.label,
        sizeLabel:
          autosavePayloadForLauncher.data.length > 1024 * 1024
            ? `${(autosavePayloadForLauncher.data.length / 1024 / 1024).toFixed(1)} MB`
            : `${Math.max(1, Math.round(autosavePayloadForLauncher.data.length / 1024))} KB`,
      }
    : null;
  const recentProjectsForLauncher = loadLocalProjects().slice(0, 3);
  const currentProjectData = projectString(state);
  const projectHealth = {
    errors: warnings.filter((warning) => warning.severity === "error").length,
    warnings: warnings.filter((warning) => warning.severity !== "error").length,
    exportState: !lastExportAt
      ? "Not exported"
      : currentProjectData !== lastExportDataRef.current
        ? "Modified after export"
        : `Exported ${lastExportAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
  };
  const renderedDistanceGuides = useMemo(() => {
    if (dragging) return distanceGuides;
    if (!clearanceMode) return distanceGuides;
    return computeStaticClearanceGuides();
  }, [
    dragging,
    distanceGuides,
    clearanceMode,
    state.selected,
    state.components,
  ]);
  const commandItems = [
    {
      id: "preview-mode",
      label: previewMode ? "Exit preview mode" : "Enter preview mode",
      hint: "Hide editing HUD and show the module like a product",
      run: togglePreviewMode,
    },
    {
      id: "manufacturing-preview",
      label: manufacturingPreview
        ? "Exit manufacturing preview"
        : "Enter manufacturing preview",
      hint: "Clean drill/cut view using production layers",
      run: toggleManufacturingPreview,
    },
    {
      id: "toggle-grid",
      label: "Toggle grid layer",
      hint: "Show/hide grid overlay",
      run: () =>
        dispatch({
          type: "SET_LAYER_VISIBILITY",
          key: "grid",
          value: !state.layerVisibility.grid,
        }),
    },
    {
      id: "toggle-safe-zones",
      label: showSafeZones ? "Hide safe zones" : "Show safe zones",
      hint: "Overlay edge, rail/lip, PCB envelope and clearance zones",
      run: () => setShowSafeZones((v) => !v),
    },
    {
      id: "focus-mode",
      label: focusMode ? "Exit focus mode" : "Enter focus mode",
      hint: "Hide side panels and keep canvas clear",
      run: () => toggleFocusMode(),
    },
    {
      id: "import-kicad-pcb",
      label: "Import KiCad PCB…",
      hint: "Read .kicad_pcb footprint positions into the front-panel layout",
      run: () => requestKiCadPcbImport(),
    },
    {
      id: "import-eagle-brd",
      label: "Import Eagle .brd…",
      hint: "Read Eagle 6+ board element positions into the front-panel layout",
      run: () => requestEagleBrdImport(),
    },
    {
      id: "shortcuts",
      label: "Show shortcuts",
      hint: "Keyboard and mouse cheat sheet",
      run: () => setShowShortcutHelp(true),
    },
    {
      id: "copy-build-info",
      label: "Copy build info",
      hint: "Copy current build/version metadata",
      run: () => {
        const b = window.__EURORACK_PANEL_DESIGNER_BUILD__ || {
          version: APP_VERSION,
        };
        const txt = JSON.stringify(b, null, 2);
        if (navigator.clipboard && window.isSecureContext)
          navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
        else fallbackCopy(txt);
        alert("Build info copied.");
      },
    },
    {
      id: "copy-environment-info",
      label: "Copy environment info",
      hint: "Copy browser/device environment for bug reports",
      run: () => {
        let storage = false;
        try {
          const k = "__panel_designer_storage_test__";
          localStorage.setItem(k, "1");
          localStorage.removeItem(k);
          storage = true;
        } catch (e) {}
        const env = {
          version: APP_VERSION,
          userAgent: navigator.userAgent || "",
          platform: navigator.platform || "",
          language: navigator.language || "",
          online: navigator.onLine,
          protocol: location.protocol,
          viewport: {
            w: window.innerWidth,
            h: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
          },
          screen: { w: screen.width, h: screen.height },
          device: {
            memory: navigator.deviceMemory || null,
            cores: navigator.hardwareConcurrency || null,
            touch: navigator.maxTouchPoints || 0,
            coarse: !!(
              window.matchMedia &&
              window.matchMedia("(pointer: coarse)").matches
            ),
          },
          storage: { localStorage: storage },
          markers: {
            ready:
              document.documentElement.getAttribute(
                "data-panel-designer-ready",
              ) || "",
            cdn:
              document.documentElement.getAttribute(
                "data-panel-designer-cdn",
              ) || "",
            runtimeError:
              document.documentElement.getAttribute(
                "data-panel-designer-runtime-error",
              ) || "",
          },
        };
        const txt = JSON.stringify(env, null, 2);
        if (navigator.clipboard && window.isSecureContext)
          navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
        else fallbackCopy(txt);
        alert("Environment info copied.");
      },
    },
    {
      id: "download-environment-info",
      label: "Download environment info",
      hint: "Download browser/device environment JSON",
      run: () => {
        let storage = false;
        try {
          const k = "__panel_designer_storage_test__";
          localStorage.setItem(k, "1");
          localStorage.removeItem(k);
          storage = true;
        } catch (e) {}
        const env = {
          version: APP_VERSION,
          userAgent: navigator.userAgent || "",
          platform: navigator.platform || "",
          language: navigator.language || "",
          online: navigator.onLine,
          protocol: location.protocol,
          viewport: {
            w: window.innerWidth,
            h: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
          },
          screen: { w: screen.width, h: screen.height },
          device: {
            memory: navigator.deviceMemory || null,
            cores: navigator.hardwareConcurrency || null,
            touch: navigator.maxTouchPoints || 0,
            coarse: !!(
              window.matchMedia &&
              window.matchMedia("(pointer: coarse)").matches
            ),
          },
          storage: { localStorage: storage },
          markers: {
            ready:
              document.documentElement.getAttribute(
                "data-panel-designer-ready",
              ) || "",
            cdn:
              document.documentElement.getAttribute(
                "data-panel-designer-cdn",
              ) || "",
            runtimeError:
              document.documentElement.getAttribute(
                "data-panel-designer-runtime-error",
              ) || "",
          },
        };
        const blob = new Blob([JSON.stringify(env, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `panel-designer-environment-${APP_VERSION}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        alert("Environment info downloaded.");
      },
    },
    {
      id: "download-build-info",
      label: "Download build info",
      hint: "Download current build/version metadata JSON",
      run: () => {
        const b = window.__EURORACK_PANEL_DESIGNER_BUILD__ || {
          version: APP_VERSION,
        };
        const blob = new Blob([JSON.stringify(b, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `panel-designer-build-info-${APP_VERSION}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        alert("Build info downloaded.");
      },
    },
    {
      id: "copy-last-runtime-error",
      label: "Copy last runtime error",
      hint: "Copy the last captured runtime error from this browser",
      run: () => {
        let txt =
          localStorage.getItem("eurorack_panel_designer_last_runtime_error") ||
          "No runtime error captured.";
        if (navigator.clipboard && window.isSecureContext)
          navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
        else fallbackCopy(txt);
        alert("Last runtime error copied.");
      },
    },
    {
      id: "copy-diagnostic-snapshot",
      label: "Copy diagnostic snapshot",
      hint: "Copy build, ready markers and last runtime error",
      run: () => {
        let last = null;
        try {
          last = localStorage.getItem(
            "eurorack_panel_designer_last_runtime_error",
          );
        } catch (e) {}
        const snap = {
          build: window.__EURORACK_PANEL_DESIGNER_BUILD__ || {
            version: APP_VERSION,
          },
          ready:
            document.documentElement.getAttribute(
              "data-panel-designer-ready",
            ) || "false",
          runtimeErrorMarker:
            document.documentElement.getAttribute(
              "data-panel-designer-runtime-error",
            ) || "",
          cdn:
            document.documentElement.getAttribute("data-panel-designer-cdn") ||
            "",
          lastRuntimeError: last || "",
        };
        const txt = JSON.stringify(snap, null, 2);
        if (navigator.clipboard && window.isSecureContext)
          navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
        else fallbackCopy(txt);
        alert("Diagnostic snapshot copied.");
      },
    },
    {
      id: "copy-qa-checklist",
      label: "Copy QA checklist",
      hint: "Copy manual pre-release test checklist",
      run: () => {
        const txt = `EURORACK PANEL DESIGNER PRE-RELEASE QA\nBuild: ${APP_VERSION}\n\n1. Startup\n[ ] Loading shell appears briefly\n[ ] App renders and data-panel-designer-ready=true\n[ ] Command palette opens\n[ ] Copy diagnostic snapshot works\n\n2. Desktop editor\n[ ] Add jack, pot, fader, switch, LED, custom hole\n[ ] Select single / multi-select\n[ ] Drag, nudge, rotate, duplicate\n[ ] Undo / redo\n[ ] Lock / unlock selected group\n[ ] Left/right panels open and close correctly\n[ ] Component info tooltip appears near component\n\n3. Rendering\n[ ] Render mode Auto behaves correctly\n[ ] Classic / realistic / off modes switch correctly\n[ ] Layer Manager visual/mech/prod/all presets work\n[ ] Top hardware style displays correctly\n\n4. Templates / local projects\n[ ] Open Templates\n[ ] Load panel template\n[ ] Insert block template\n[ ] Save current panel template\n[ ] Edit template metadata\n[ ] Delete/hide template inline modal works\n[ ] Save to Browser\n[ ] Open Local Projects\n[ ] Load / rename / export / delete local project\n\n5. Mobile\n[ ] Default mobile view is Auto\n[ ] Bottom toolbar is usable\n[ ] Select single / multi visible\n[ ] Performance mode checkbox toggles\n[ ] Component picker closes without phantom right box\n[ ] Panels only close by swipe, do not open by swipe\n[ ] Templates open without Mobile Templates error\n\n6. Exports\n[ ] Preview SVG\n[ ] Drill/Cut SVG\n[ ] Artwork SVG\n[ ] Layered SVG\n[ ] Layered SVG package\n[ ] PNG combined\n[ ] PNG separate layers\n[ ] PSD export\n[ ] DXF Cut/Drill\n[ ] CSV Drill Table\n[ ] DFM Report\n[ ] Full export package\n\n7. Diagnostics\n[ ] Copy build info\n[ ] Download build info\n[ ] Copy CDN status\n[ ] Copy/download environment info\n[ ] Copy/download app state summary\n[ ] Copy/download diagnostic snapshot\n[ ] Clear diagnostic log\n\n8. Final sanity\n[ ] Browser prompt calls expected: 0\n[ ] Browser confirm calls expected: 0\n[ ] No runtime error toast during normal workflow\n[ ] No layout-breaking overflow on desktop/mobile\n`;
        if (navigator.clipboard && window.isSecureContext)
          navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
        else fallbackCopy(txt);
        alert("QA checklist copied.");
      },
    },
    {
      id: "download-diagnostic-snapshot",
      label: "Download diagnostic snapshot",
      hint: "Download build/runtime diagnostic JSON file",
      run: () => {
        let last = null;
        try {
          last = localStorage.getItem(
            "eurorack_panel_designer_last_runtime_error",
          );
        } catch (e) {}
        const snap = {
          build: window.__EURORACK_PANEL_DESIGNER_BUILD__ || {
            version: APP_VERSION,
          },
          ready:
            document.documentElement.getAttribute(
              "data-panel-designer-ready",
            ) || "false",
          runtimeErrorMarker:
            document.documentElement.getAttribute(
              "data-panel-designer-runtime-error",
            ) || "",
          cdn:
            document.documentElement.getAttribute("data-panel-designer-cdn") ||
            "",
          lastRuntimeError: last || "",
          app: {
            hp: state.panel.widthHP,
            widthMM: panelWidthMM(state.panel),
            components: state.components.length,
            artworks: state.artworks.length,
            textItems: state.textItems.length,
            scaleItems: state.scaleItems.length,
            viewMode: state.viewMode,
            hardwareRenderMode: state.hardwareRenderMode,
          },
        };
        const blob = new Blob([JSON.stringify(snap, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `panel-designer-diagnostic-${APP_VERSION}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        alert("Diagnostic snapshot downloaded.");
      },
    },
    {
      id: "copy-cdn-status",
      label: "Copy CDN status",
      hint: "Copy React CDN loading status",
      run: () => {
        const txt = JSON.stringify(
          {
            version: APP_VERSION,
            cdn:
              document.documentElement.getAttribute(
                "data-panel-designer-cdn",
              ) || "",
            ready:
              document.documentElement.getAttribute(
                "data-panel-designer-ready",
              ) || "false",
          },
          null,
          2,
        );
        if (navigator.clipboard && window.isSecureContext)
          navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
        else fallbackCopy(txt);
        alert("CDN status copied.");
      },
    },
    {
      id: "copy-app-state-summary",
      label: "Copy app state summary",
      hint: "Copy compact project state summary for bug reports",
      run: () => {
        const hard = warnings.filter((w) => w.severity === "error").length;
        const warn = warnings.length - hard;
        const s = {
          version: APP_VERSION,
          hp: state.panel.widthHP,
          widthMM: panelWidthMM(state.panel),
          components: state.components.length,
          selected: state.selected.length,
          artworks: state.artworks.length,
          textItems: state.textItems.length,
          scaleItems: state.scaleItems.length,
          viewMode: state.viewMode,
          hardwareRenderMode: state.hardwareRenderMode,
          topHardwareStyle: state.topHardwareStyle,
          dfm: { errors: hard, warnings: warn },
          mobilePerformanceMode: state.mobilePerformanceMode,
        };
        const txt = JSON.stringify(s, null, 2);
        if (navigator.clipboard && window.isSecureContext)
          navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
        else fallbackCopy(txt);
        alert("App state summary copied.");
      },
    },
    {
      id: "download-app-state-summary",
      label: "Download app state summary",
      hint: "Download compact project state summary JSON",
      run: () => {
        const hard = warnings.filter((w) => w.severity === "error").length;
        const warn = warnings.length - hard;
        const s = {
          version: APP_VERSION,
          hp: state.panel.widthHP,
          widthMM: panelWidthMM(state.panel),
          components: state.components.length,
          selected: state.selected.length,
          artworks: state.artworks.length,
          textItems: state.textItems.length,
          scaleItems: state.scaleItems.length,
          viewMode: state.viewMode,
          hardwareRenderMode: state.hardwareRenderMode,
          topHardwareStyle: state.topHardwareStyle,
          dfm: { errors: hard, warnings: warn },
          mobilePerformanceMode: state.mobilePerformanceMode,
        };
        const blob = new Blob([JSON.stringify(s, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `panel-designer-state-summary-${APP_VERSION}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        alert("App state summary downloaded.");
      },
    },
    {
      id: "clear-diagnostic-log",
      label: "Clear diagnostic log",
      hint: "Clear saved runtime error marker for a clean retest",
      run: () => {
        try {
          localStorage.removeItem("eurorack_panel_designer_last_runtime_error");
        } catch (e) {}
        document.documentElement.removeAttribute(
          "data-panel-designer-runtime-error",
        );
        alert("Diagnostic log cleared.");
      },
    },
    {
      id: "view-front",
      label: "View: Front",
      hint: "Front panel mode",
      run: () => dispatch({ type: "SET_VIEW_MODE", mode: "front" }),
    },
    {
      id: "view-rear",
      label: "View: Rear",
      hint: "Rear bodies and keepouts",
      run: () => dispatch({ type: "SET_VIEW_MODE", mode: "rear" }),
    },
    {
      id: "view-drill",
      label: "View: Drill",
      hint: "Cut/drill review mode",
      run: () => dispatch({ type: "SET_VIEW_MODE", mode: "drill" }),
    },
    {
      id: "view-combined",
      label: "View: Combined",
      hint: "Front + rear overlay",
      run: () => dispatch({ type: "SET_VIEW_MODE", mode: "combined" }),
    },
    {
      id: "layers-visual",
      label: "Layer preset: Visual",
      hint: "Artwork, labels, hardware",
      run: () => dispatch({ type: "APPLY_LAYER_PRESET", preset: "visual" }),
    },
    {
      id: "layers-mechanical",
      label: "Layer preset: Mechanical",
      hint: "Holes, bodies, PCB, keepouts",
      run: () => dispatch({ type: "APPLY_LAYER_PRESET", preset: "mechanical" }),
    },
    {
      id: "layers-production",
      label: "Layer preset: Production",
      hint: "Outline and drill/cut geometry",
      run: () => dispatch({ type: "APPLY_LAYER_PRESET", preset: "production" }),
    },
    {
      id: "export",
      label: "Open export preview",
      hint: "SVG, DXF, CSV, report",
      run: () => setShowExportDialog(true),
    },
    {
      id: "templates",
      label: "Open templates",
      hint: "Panel/block templates",
      run: () => setShowTemplatesDialog(true),
    },
    ...COMPONENT_LIBRARY.map((def, index) => ({
      id: `add-part-${index}-${def.type}`,
      label: `Place: ${shortPartName(def)}`,
      hint: `${def.manufacturer || "Generic"} · ${def.partNumber || def.type} · ${def.verificationStatus || "approximate"}`,
      run: () => startPartPlacement(def),
    })),
    {
      id: "select-all",
      label: "Select all components",
      hint: "Ctrl/Cmd+A",
      run: () =>
        dispatch({
          type: "SELECT",
          ids: state.components.map((c) => c.id),
          additive: false,
        }),
    },
    {
      id: "clear-selection",
      label: "Clear selection",
      hint: "Escape",
      run: () => dispatch({ type: "DESELECT_ALL" }),
    },
    {
      id: "group-selection",
      label: "Group selected components",
      hint: "G",
      run: () => dispatch({ type: "GROUP_SELECTED" }),
    },
    {
      id: "ungroup-selection",
      label: "Ungroup selected components",
      hint: "Shift+G",
      run: () => dispatch({ type: "UNGROUP_SELECTED" }),
    },
    {
      id: "mirror-selection-x",
      label: "Mirror selection horizontally",
      hint: "M",
      run: () =>
        dispatch({ type: "MIRROR_SELECTED", axis: "x", around: "selection" }),
    },
    {
      id: "mirror-selection-y",
      label: "Mirror selection vertically",
      hint: "Shift+M",
      run: () =>
        dispatch({ type: "MIRROR_SELECTED", axis: "y", around: "selection" }),
    },
    {
      id: "next-warning",
      label: "Focus next DFM warning",
      hint: "]",
      run: () => {
        const focusable = warnings.filter((warning) => warning.ids?.length);
        if (!focusable.length) return;
        warningFocusIndexRef.current =
          (warningFocusIndexRef.current + 1) % focusable.length;
        focusIssueComponents(focusable[warningFocusIndexRef.current].ids);
      },
    },
    {
      id: "component-library",
      label: "Open component library",
      hint: "Search and place a part",
      run: () => AppCommands.openComponentLibraryPicker(),
    },
    {
      id: "fit-view",
      label: "Fit view",
      hint: "Zoom to comfortable panel view",
      run: () => {
        setZoom(1.25);
        setPan({ x: 0, y: 0 });
      },
    },
    {
      id: "fit-selection",
      label: "Fit selection",
      hint: "Center and zoom to the selected components",
      run: () =>
        focusIssueComponents(state.selected, {
          openPanel: false,
        }),
    },
    {
      id: "production-check",
      label: "Production check",
      hint: "Manufacturing readiness report",
      run: () => setShowProductionCheck(true),
    },
    {
      id: "runtime-self-test",
      label: "Run runtime self-test",
      hint: "Check export, library, validation and report generators",
      run: () =>
        alert(
          runRuntimeSelfTest(state, warnings)
            .map((i) => `[${i.level.toUpperCase()}] ${i.message}`)
            .join("\n"),
        ),
    },
    {
      id: "reset-view",
      label: "Reset view",
      hint: "100% zoom and centered pan",
      run: () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      },
    },
  ];
  return React.createElement(
    "div",
    {
      className: `app ${focusMode ? "focus-mode" : ""} ${previewMode ? "preview-mode" : ""} ${manufacturingPreview ? "manufacturing-preview" : ""} ${showTouchHitboxes ? "show-touch-hitboxes" : ""} ${showSafeZones ? "show-safe-zones" : ""} ${leftPanelOpen ? "left-panel-open" : "left-panel-closed"} ${rightPanelOpen ? "right-panel-open" : "right-panel-closed"} ${!leftPanelOpen && !rightPanelOpen ? "both-panels-closed" : ""} ${mobileProtectMode ? "mobile-protect-mode" : ""} ${mobileFineMode ? "mobile-fine-mode" : ""} ${mobileOneHandMode !== "off" ? `mobile-one-hand-${mobileOneHandMode}` : ""} ${isNarrowInitial && state.selected.length > 0 && !sidePanelOpen ? "has-mobile-selection" : ""}`,
    },
    React.createElement(Topbar, {
      onExportSVGClick: () => setShowExportDialog(true),
      onRequestProjectFileImport: requestProjectFileImport,
      onRequestKiCadPcbImport: requestKiCadPcbImport,
      onRequestEagleBrdImport: requestEagleBrdImport,
      onOpenLocalProjects: () => setShowLocalProjectsDialog(true),
      onOpenProductionCheck: () => setShowProductionCheck(true),
      onOpenShortcuts: () => setShowShortcutHelp(true),
      isNarrow: isNarrowInitial,
      rightPanelOpen: rightPanelOpen,
      onToggleRightPanel: () => setRightPanelOpen((v) => !v),
      autosaveStatus: autosaveStatus,
      projectHealth: projectHealth,
    }),
    previewMode &&
      React.createElement(
        "button",
        {
          className: "preview-exit-control",
          onClick: manufacturingPreview
            ? toggleManufacturingPreview
            : togglePreviewMode,
          title: "Return to the editor (Esc)",
        },
        manufacturingPreview ? "Exit manufacturing view" : "Exit preview",
      ),
    showCommandPalette &&
      React.createElement(CommandPalette, {
        commands: commandItems,
        onClose: () => setShowCommandPalette(false),
      }),
    showShortcutHelp &&
      React.createElement(ShortcutHelpOverlay, {
        onClose: () => setShowShortcutHelp(false),
      }),
    showProductionCheck &&
      React.createElement(ProductionCheckDialog, {
        warnings: warnings,
        onClose: () => setShowProductionCheck(false),
        onOpenExport: () => {
          setShowProductionCheck(false);
          setShowExportDialog(true);
        },
      }),
    React.createElement("input", {
      id: "project-file-input",
      ref: projectFileInputRef,
      type: "file",
      accept: ".json,.epanel,application/json",
      tabIndex: -1,
      style: {
        position: "fixed",
        left: -10000,
        top: 0,
        width: 1,
        height: 1,
        opacity: 0,
      },
      onChange: (e) => {
        pendingFileOpenRef.current = false;
        onImport(e);
      },
    }),
    React.createElement("input", {
      id: "kicad-pcb-file-input",
      ref: kicadPcbInputRef,
      type: "file",
      accept: ".kicad_pcb,text/plain",
      tabIndex: -1,
      style: {
        position: "fixed",
        left: -10000,
        top: 0,
        width: 1,
        height: 1,
        opacity: 0,
      },
      onChange: onKiCadPcbImport,
    }),
    React.createElement("input", {
      id: "eagle-brd-file-input",
      ref: eagleBrdInputRef,
      type: "file",
      accept: ".brd",
      tabIndex: -1,
      style: {
        position: "fixed",
        left: -10000,
        top: 0,
        width: 1,
        height: 1,
        opacity: 0,
      },
      onChange: onEagleBrdImport,
    }),
    showLocalProjectsDialog &&
      React.createElement(LocalProjectsDialog, {
        onClose: () => setShowLocalProjectsDialog(false),
      }),
    pendingTemplatePlacement &&
      React.createElement(
        "div",
        {
          style: {
            position: "fixed",
            left: "50%",
            top: 54,
            transform: "translateX(-50%)",
            zIndex: 2500,
            background: "rgba(20,20,20,0.95)",
            border: "1px solid #c99a4a",
            borderRadius: 8,
            padding: "7px 10px",
            boxShadow: "0 10px 30px rgba(0,0,0,.45)",
            fontSize: 12,
          },
        },
        React.createElement("b", null, "Place template:"),
        " ",
        pendingTemplatePlacement.template.name,
        " \u00B7 click/tap to place \u00B7 ",
        React.createElement(
          "button",
          {
            onClick: () =>
              setPendingTemplatePlacement({
                ...pendingTemplatePlacement,
                rotation: (pendingTemplatePlacement.rotation + 90) % 360,
              }),
          },
          "Rotate",
        ),
        " ",
        React.createElement(
          "button",
          { onClick: () => setPendingTemplatePlacement(null) },
          "Cancel",
        ),
      ),
    showTemplatesDialog &&
      React.createElement(TemplatesDialog, {
        onClose: () => setShowTemplatesDialog(false),
        onPlaceBlock: (tpl) => {
          const comps = tpl.components.map((c) => ({
            ...c,
            id: crypto.randomUUID(),
          }));
          const anchor = { x: widthMM / 2, y: PANEL_HEIGHT_MM / 2 };
          setPendingTemplatePlacement({
            template: tpl,
            components: comps,
            anchor,
            rotation: 0,
          });
          setTouchMode("edit");
        },
      }),
    showExportDialog &&
      React.createElement(ExportDialog, {
        options: exportOptions,
        onChange: setExportOptions,
        onExport: () => completeExport(() => exportSVG(state, exportOptions)),
        onExportPNG: () =>
          completeExport(() => exportPNG(state, exportOptions)),
        onExportPSD: () =>
          completeExport(() => exportPSD(state, exportOptions)),
        onExportLayeredSVG: () =>
          completeExport(() => exportLayeredSVG(state, exportOptions)),
        onExportLayeredSVGPackage: () =>
          completeExport(() => exportLayeredSVGPackage(state, exportOptions)),
        onExportInkscape: () =>
          completeExport(() => exportInkscapeSVG(state, exportOptions)),
        onExportMode: (mode) =>
          completeExport(() => exportSVGMode(state, mode, warnings)),
        onExportPackage: () =>
          completeExport(() => downloadExportPackage(state, warnings)),
        onExportPrintTemplatePDF: () =>
          completeExport(() => exportPrintTemplatePDF(state)),
        onExportDocumentationPDF: () =>
          completeExport(() => exportDocumentationPDF(state, warnings)),
        onExportCSV: () =>
          completeExport(() => exportCSVDrillTable(state, warnings)),
        onExportKiCad: () =>
          completeExport(() => exportKiCadPCB(state, exportOptions)),
        onExportEagle: () => completeExport(() => exportEagleSCR(state)),
        onExportPrintTemplate: () =>
          completeExport(() => exportPrintableTemplate(state)),
        onExportDXF: () => completeExport(() => exportDXF(state)),
        onExportReport: () =>
          completeExport(() => exportManufacturingReport(state, warnings)),
        onExportJSON: () => completeExport(() => exportJSON(state)),
        onCancel: () => setShowExportDialog(false),
      }),
    React.createElement(
      WorkspaceShell,
      {
        leftOpen: leftPanelOpen,
        rightOpen: rightPanelOpen,
        isMobile: isNarrowInitial,
      },
      React.createElement("div", {
        className: `mobile-sidebar-backdrop ${leftPanelOpen || rightPanelOpen ? "visible" : ""}`,
        onClick: () => {
          setLeftPanelOpen(false);
          setRightPanelOpen(false);
        },
        onTouchStart: onDrawerSwipeStart,
        onTouchMove: onDrawerSwipeMove,
        onTouchEnd: onDrawerSwipeEnd,
        onTouchCancel: onDrawerSwipeEnd,
      }),
      isNarrowInitial &&
        React.createElement(LeftSidebar, {
          open: leftPanelOpen,
          onTouchStart: onDrawerSwipeStart,
          onTouchMove: onDrawerSwipeMove,
          onTouchEnd: onDrawerSwipeEnd,
          onStartPartPlacement: startPartPlacement,
        }),
      React.createElement(CanvasToolRail, {
        leftPanelOpen: leftPanelOpen,
        rightPanelOpen: rightPanelOpen,
        onToggleLeftPanel: () => setLeftPanelOpen((v) => !v),
        onToggleRightPanel: () => {
          setRightPanelOpen((v) => {
            const nv = !v;
            if (nv) {
              setTimeout(() => {
                const r = document.querySelector(".sidebar-right");
                if (r) {
                  r.scrollLeft = 0;
                  r.style.left = "";
                  r.style.right = "";
                }
              }, 0);
            }
            return nv;
          });
        },
        touchMode: touchMode,
        onSetTouchMode: handleSetTouchMode,
        onFitView: () => {
          const isMobileFit = window.matchMedia?.(
            "(max-width: 860px), (pointer: coarse)",
          ).matches;
          setZoom(isMobileFit ? 1.14 : 1.25);
          setPan({ x: 0, y: 0 });
        },
        snapSettings: snapSettings,
        onSnapSettingsChange: setSnapSettings,
        clearanceMode: clearanceMode,
        onToggleClearanceMode: () => setClearanceMode((v) => !v),
        showSafeZones: showSafeZones,
        onToggleSafeZones: () => setShowSafeZones((v) => !v),
        onOpenProductionCheck: () => setShowProductionCheck(true),
        onOpenShortcuts: () => setShowShortcutHelp(true),
        onAddText: () => {
          const id = crypto.randomUUID();
          dispatch({
            type: "ADD_TEXT",
            item: {
              id,
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
          setEditingTextId(id);
        },
        onOpenComponentLibrary: () => AppCommands.openComponentLibraryPicker(),
      }),
      React.createElement(ComponentLibraryPanel, {
        headless: true,
        onStartPartPlacement: startPartPlacement,
      }),
      React.createElement(SVGCanvas, {
        svgRef: svgRef,
        zoom: zoom,
        pan: pan,
        dragPreview: dragPreview,
        rotationPreview: rotationPreview,
        artworkDragPreview: artworkDragPreview,
        artworkResizePreview: artworkResizePreview,
        textDragPreview: textDragPreview,
        textsDragPreview: textsDragPreview,
        snapGuides: snapGuides,
        distanceGuides: renderedDistanceGuides,
        ruler: ruler,
        marqueeSelection: marqueeSelection,
        pendingTemplatePlacement: pendingTemplatePlacement,
        onSVGMouseMove: onSVGMouseMove,
        onSVGMouseDown: onSVGMouseDown,
        onSVGMouseUp: onSVGMouseUp,
        onSVGTouchStart: onSVGTouchStart,
        onSVGTouchMove: onSVGTouchMove,
        onSVGTouchEnd: onSVGTouchEnd,
        onSVGContextMenu: onSVGContextMenu,
        onWheel: onWheel,
        onWrapMouseDown: onWrapMouseDown,
        coordReadout: coordReadout,
        warnings: warnings,
        autosaveSummary: autosaveSummaryForLauncher,
        recentProjects: recentProjectsForLauncher,
        onRestoreAutosave: restoreAutosave,
        onOpenProjectFile: requestProjectFileImport,
        onOpenRecentProjects: () => setShowLocalProjectsDialog(true),
        pendingAddPart: pendingAddPart,
        pendingAddPreview: pendingAddPreview,
        pendingAddRepeat: pendingAddRepeat,
        onTogglePendingAddRepeat: () => setPendingAddRepeat((v) => !v),
        onCancelPendingAdd: () => {
          setPendingAddPart(null);
          setPendingAddPreview(null);
          setPendingAddRepeat(false);
          resetCanvasInteractionMode();
        },
        rightPanelOpen: rightPanelOpen,
        showSafeZones: showSafeZones,
        editingTextId: editingTextId,
        onSVGDoubleClick: onSVGDoubleClick,
        onZoomChange: setZoom,
        issueFocusIds: issueFocusIds,
        touchMode: touchMode,
      }),
      editingTextId &&
        (() => {
          const t = state.textItems.find((tt) => tt.id === editingTextId);
          if (!t) return null;
          return React.createElement(InlineTextEditor, {
            key: editingTextId,
            textItem: t,
            svgRef: svgRef,
            onCommit: (value) => {
              if (value.trim()) {
                dispatch({
                  type: "UPDATE_TEXT",
                  id: editingTextId,
                  patch: { text: value },
                });
              }
              setEditingTextId(null);
            },
            onCancel: () => setEditingTextId(null),
          });
        })(),
      React.createElement(CanvasQuickAddDock, {
        hidden: sidePanelOpen && isNarrowInitial,
        focusMode: focusMode,
        previewMode: previewMode,
        onToggleFocus: toggleFocusMode,
        onTogglePreviewMode: togglePreviewMode,
        onOpenShortcuts: () => setShowShortcutHelp(true),
        touchMode: touchMode,
        onSetTouchMode: handleSetTouchMode,
        onOpenExport: () => setShowExportDialog(true),
        onOpenTemplates: () => setShowTemplatesDialog(true),
        onOpenLocalProjects: () => setShowLocalProjectsDialog(true),
        onOpenProductionCheck: () => setShowProductionCheck(true),
        onToggleLeftPanel: () => setLeftPanelOpen((v) => !v),
        onToggleRightPanel: () => setRightPanelOpen((v) => !v),
        leftPanelOpen: leftPanelOpen,
        rightPanelOpen: rightPanelOpen,
        warnings: warnings,
        showTouchHitboxes: showTouchHitboxes,
        onToggleTouchHitboxes: () => setShowTouchHitboxes((v) => !v),
        showSafeZones: showSafeZones,
        onToggleSafeZones: () => setShowSafeZones((v) => !v),
        mobileFineMode: mobileFineMode,
        onToggleMobileFineMode: () => setMobileFineMode((v) => !v),
        mobileProtectMode: mobileProtectMode,
        onToggleMobileProtectMode: () => setMobileProtectMode((v) => !v),
        mobileOneHandMode: mobileOneHandMode,
        onSetMobileOneHandMode: setMobileOneHandMode,
        autosaveStatus: autosaveStatus,
      }),
      !rightPanelOpen &&
        React.createElement(
          "div",
          {
            className: `project-health-pill ${warnings.some((w) => w.severity === "error") ? "error" : warnings.length ? "warn" : "ok"}`,
          },
          React.createElement(
            "span",
            null,
            warnings.some((w) => w.severity === "error")
              ? "Issues"
              : warnings.length
                ? `${warnings.length} warnings`
                : "OK",
          ),
          React.createElement(
            "small",
            null,
            autosaveStatus || "Autosave ready",
          ),
        ),
      mobileToast &&
        !sidePanelOpen &&
        React.createElement(
          "div",
          { className: "mobile-toast-v250" },
          mobileToast,
        ),
      isNarrowInitial &&
        !sidePanelOpen &&
        autosaveStatus &&
        React.createElement(
          "div",
          { className: "mobile-autosave-chip" },
          autosaveStatus,
        ),
      isNarrowInitial &&
        !sidePanelOpen &&
        mobileProtectMode &&
        React.createElement(
          "div",
          { className: "mobile-protect-banner" },
          "PROTECT \u00B7 drag disabled",
        ),
      isNarrowInitial &&
        !sidePanelOpen &&
        state.selected.length === 0 &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "div",
            { className: "mobile-grid-corner-chip" },
            "Grid ",
            state.grid.size,
            "mm",
          ),
          React.createElement(
            "div",
            { className: "mobile-workflow-chip-row" },
            React.createElement(
              "button",
              {
                className: `mobile-workflow-chip ${warnings.some((w) => w.severity === "error") ? "bad" : warnings.length ? "warn" : ""}`,
                onClick: () => setShowProductionCheck(true),
              },
              warnings.some((w) => w.severity === "error")
                ? "ERR"
                : warnings.length
                  ? `${warnings.length} warn`
                  : "OK",
            ),
            mobileFineMode &&
              React.createElement(
                "span",
                { className: "mobile-workflow-chip mobile-fine-badge" },
                "Fine 0.10mm",
              ),
          ),
        ),
      !sidePanelOpen &&
        React.createElement(
          "div",
          {
            className: `mobile-mode-pill-v250 ${touchMode === "select" ? "multi" : touchMode}`,
          },
          React.createElement(
            "strong",
            null,
            touchMode === "select"
              ? "MULTI"
              : touchMode === "ruler"
                ? "RULER"
                : touchMode === "pan"
                  ? "PAN"
                  : "EDIT",
          ),
          React.createElement(
            "span",
            null,
            touchMode === "select"
              ? "tap add/remove · empty clears"
              : touchMode === "ruler"
                ? "drag to measure"
                : touchMode === "pan"
                  ? "drag canvas"
                  : "single tap selects one",
          ),
        ),
      !sidePanelOpen &&
        React.createElement(
          "div",
          {
            className: "mobile-mode-switch",
            onMouseDown: (e) => e.stopPropagation(),
            onTouchStart: (e) => e.stopPropagation(),
            role: "group",
            "aria-label": "Mobile edit/select mode",
          },
          React.createElement(
            "button",
            {
              className: touchMode === "edit" ? "active" : "",
              title: "Edit mode: drag components and objects",
              onClick: () => setTouchMode("edit"),
            },
            "\u270F\uFE0F Edit",
          ),
          React.createElement(
            "button",
            {
              className: touchMode === "select" ? "active" : "",
              title:
                "Select mode: tap components to add or remove them from selection",
              onClick: () => setTouchMode("select"),
            },
            "\u2611 Select",
          ),
        ),
      touchMode === "ruler" &&
        ruler &&
        !sidePanelOpen &&
        React.createElement(
          "div",
          {
            style: {
              position: "fixed",
              right: 10,
              bottom: isNarrowInitial
                ? state.selected.length > 0
                  ? 138
                  : 72
                : state.selected.length > 0
                  ? 92
                  : 22,
              zIndex: 1100,
              background: "rgba(18,18,18,0.62)",
              border: "1px solid rgba(210,210,210,0.45)",
              borderRadius: 8,
              boxShadow: "0 8px 22px rgba(0,0,0,0.28)",
              padding: "6px 7px",
              display: "flex",
              gap: 5,
              alignItems: "center",
              touchAction: "pan-x",
              backdropFilter: "blur(4px)",
            },
            onMouseDown: (e) => e.stopPropagation(),
            onTouchStart: (e) => e.stopPropagation(),
          },
          React.createElement(
            "button",
            {
              title: "Clear ruler measurement",
              onClick: () => {
                setRuler(null);
                setTouchMode("edit");
              },
            },
            "Clear",
          ),
        ),
      isNarrowInitial &&
        state.selected.length > 0 &&
        !sidePanelOpen &&
        React.createElement(
          React.Fragment,
          null,
          isNarrowInitial &&
            showMobileNudge &&
            React.createElement(
              "div",
              {
                className: "mobile-nudge-mode-sheet",
                onMouseDown: (e) => e.stopPropagation(),
                onTouchStart: (e) => e.stopPropagation(),
              },
              (() => {
                const fineStep = mobileFineMode ? 0.1 : 0.25;
                return React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    "div",
                    { className: "mobile-nudge-mode-head" },
                    React.createElement("strong", null, "NUDGE"),
                    React.createElement(
                      "span",
                      null,
                      fineStep.toFixed(2),
                      " mm step",
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => setShowMobileNudge(false) },
                      "✓",
                    ),
                  ),
                  React.createElement(
                    "div",
                    { className: "mobile-nudge-mode-grid" },
                    React.createElement("span", null),
                    React.createElement(
                      "button",
                      { onClick: () => nudgeSelected(0, -fineStep) },
                      "\u2191",
                    ),
                    React.createElement("span", null),
                    React.createElement(
                      "button",
                      { onClick: () => nudgeSelected(-fineStep, 0) },
                      "\u2190",
                    ),
                    React.createElement(
                      "button",
                      {
                        className: mobileFineMode ? "active" : "",
                        onClick: () => setMobileFineMode((v) => !v),
                      },
                      mobileFineMode ? "⊕" : "○",
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => nudgeSelected(fineStep, 0) },
                      "\u2192",
                    ),
                    React.createElement("span", null),
                    React.createElement(
                      "button",
                      { onClick: () => nudgeSelected(0, fineStep) },
                      "\u2193",
                    ),
                    React.createElement("span", null),
                  ),
                  React.createElement(
                    "div",
                    { className: "mobile-nudge-mode-presets" },
                    React.createElement(
                      "button",
                      { onClick: () => nudgeSelected(-state.grid.size, 0) },
                      "\u2190 grid",
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => nudgeSelected(state.grid.size, 0) },
                      "grid \u2192",
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => nudgeSelected(0, -state.grid.size) },
                      "\u2191 grid",
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => nudgeSelected(0, state.grid.size) },
                      "grid \u2193",
                    ),
                  ),
                );
              })(),
            ),
          isNarrowInitial &&
            showMobileSelectionMore &&
            React.createElement(
              "div",
              {
                className: "mobile-action-sheet-backdrop",
                onClick: () => setShowMobileSelectionMore(false),
              },
              React.createElement(
                "div",
                {
                  className: "mobile-more-bottom-sheet",
                  onClick: (e) => e.stopPropagation(),
                  onMouseDown: (e) => e.stopPropagation(),
                  onTouchStart: (e) => e.stopPropagation(),
                },
                React.createElement("div", {
                  className: "mobile-sheet-grabber",
                }),
                React.createElement(
                  "div",
                  { className: "mobile-sheet-headline" },
                  React.createElement(
                    "div",
                    null,
                    React.createElement("strong", null, "Selected actions"),
                    React.createElement(
                      "span",
                      null,
                      state.selected.length,
                      " selected",
                    ),
                  ),
                  React.createElement(
                    "button",
                    { onClick: () => setShowMobileSelectionMore(false) },
                    "Close",
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "mobile-more-sheet-body" },
                  React.createElement(
                    "div",
                    { className: "mobile-sheet-section-title" },
                    "Edit",
                  ),
                  React.createElement(
                    "div",
                    { className: "mobile-sheet-action-grid" },
                    React.createElement(
                      "button",
                      {
                        onClick: () => {
                          setShowMobileSelectionMore(false);
                          AppCommands.openMobilePartSheet();
                        },
                      },
                      "Inspector",
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => {
                          setShowMobileSelectionMore(false);
                          AppCommands.openMobileQuickLabelEdit();
                        },
                      },
                      "Label editor",
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => {
                          dispatch({ type: "ROTATE_SELECTED", degrees: 90 });
                          showMobileToast("Rotated 90°");
                        },
                      },
                      "Rotate 90",
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => {
                          dispatch({ type: "DUPLICATE_SELECTED" });
                          showMobileToast("Duplicated");
                        },
                      },
                      "Duplicate",
                    ),
                    React.createElement(
                      "button",
                      {
                        className: appSelectedAllLocked ? "active" : "",
                        onClick: () =>
                          dispatch({
                            type: "LOCK_SELECTED",
                            locked: !appSelectedAllLocked,
                          }),
                      },
                      appSelectedAllLocked ? "Unlock" : "Lock",
                    ),
                    React.createElement(
                      "button",
                      {
                        className: "danger",
                        onClick: () => {
                          dispatch({ type: "DELETE_SELECTED" });
                          setShowMobileSelectionMore(false);
                          showMobileToast("Deleted · Undo available");
                        },
                      },
                      "Delete",
                    ),
                  ),
                  React.createElement(
                    "div",
                    { className: "mobile-sheet-section-title" },
                    "Align / space",
                  ),
                  React.createElement(
                    "div",
                    { className: "mobile-sheet-action-grid three" },
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () =>
                          dispatch({ type: "ALIGN", axis: "left" }),
                      },
                      "Align L",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () =>
                          dispatch({ type: "ALIGN", axis: "centerV" }),
                      },
                      "Align X",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () =>
                          dispatch({ type: "ALIGN", axis: "right" }),
                      },
                      "Align R",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () => dispatch({ type: "ALIGN", axis: "top" }),
                      },
                      "Align T",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () =>
                          dispatch({ type: "ALIGN", axis: "centerH" }),
                      },
                      "Align Y",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () =>
                          dispatch({ type: "ALIGN", axis: "bottom" }),
                      },
                      "Align B",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 3,
                        onClick: () =>
                          dispatch({ type: "DISTRIBUTE", axis: "h" }),
                      },
                      "Dist H",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 3,
                        onClick: () =>
                          dispatch({ type: "DISTRIBUTE", axis: "v" }),
                      },
                      "Dist V",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () => setSelectedSpacing("h"),
                      },
                      "Space H",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () => setSelectedSpacing("v"),
                      },
                      "Space V",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () => {
                          dispatch({
                            type: "SMART_ARRANGE_SELECTED",
                            layout: "grid",
                          });
                          showMobileToast("Arranged to grid");
                        },
                      },
                      "Smart grid",
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => centerSelected("x") },
                      "Center X",
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => centerSelected("y") },
                      "Center Y",
                    ),
                  ),
                  React.createElement(
                    "div",
                    { className: "mobile-sheet-section-title" },
                    "Workflow",
                  ),
                  React.createElement(
                    "div",
                    { className: "mobile-sheet-action-grid" },
                    React.createElement(
                      "button",
                      {
                        className: mobileFineMode ? "active" : "",
                        onClick: () => setMobileFineMode((v) => !v),
                      },
                      mobileFineMode ? "Fine ON" : "Fine mode",
                    ),
                    React.createElement(
                      "button",
                      {
                        className: mobileProtectMode ? "active" : "",
                        onClick: () => setMobileProtectMode((v) => !v),
                      },
                      mobileProtectMode ? "Protect ON" : "Protect layout",
                    ),
                    React.createElement(
                      "button",
                      {
                        className: showSafeZones ? "active" : "",
                        onClick: () => setShowSafeZones((v) => !v),
                      },
                      "Safe zones",
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => {
                          setShowProductionCheck(true);
                          setShowMobileSelectionMore(false);
                        },
                      },
                      "Preflight",
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => {
                          try {
                            localStorage.setItem(
                              "eurorack-panel-manual-mobile-backup",
                              projectString(state),
                            );
                            showMobileToast("Backup saved locally");
                          } catch {
                            showMobileToast("Backup failed");
                          }
                        },
                      },
                      "Backup now",
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => duplicatePattern() },
                      "Pattern",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 2,
                        onClick: () => dispatch({ type: "GROUP_SELECTED" }),
                      },
                      "Group",
                    ),
                    React.createElement(
                      "button",
                      {
                        disabled: state.selected.length < 1,
                        onClick: () => dispatch({ type: "UNGROUP_SELECTED" }),
                      },
                      "Ungroup",
                    ),
                    touchMode === "select" &&
                      React.createElement(
                        "button",
                        {
                          onClick: () => {
                            setTouchMode("edit");
                            setShowMobileSelectionMore(false);
                          },
                        },
                        "Back to Single",
                      ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => {
                          dispatch({ type: "DESELECT_ALL" });
                          setShowMobileSelectionMore(false);
                          setShowMobileNudge(false);
                        },
                      },
                      "Clear selection",
                    ),
                  ),
                ), // mobile-more-sheet-body
              ),
            ),
          React.createElement(
            "div",
            {
              className: `mobile-selection-actions v267-context-bar ${state.selected.length > 1 ? "multi" : "single"}`,
              onMouseDown: (e) => e.stopPropagation(),
              onTouchStart: (e) => e.stopPropagation(),
            },
            state.selected.length === 1
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    "button",
                    {
                      className: showMobileNudge ? "active" : "",
                      onClick: () => {
                        setShowMobileSelectionMore(false);
                        setShowMobileNudge((v) => !v);
                      },
                    },
                    "Nudge",
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        dispatch({ type: "DUPLICATE_SELECTED" });
                        showMobileToast("Duplicated");
                      },
                    },
                    "Duplicate",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: appSelectedAllLocked ? "active" : "",
                      onClick: () =>
                        dispatch({
                          type: "LOCK_SELECTED",
                          locked: !appSelectedAllLocked,
                        }),
                    },
                    appSelectedAllLocked ? "Unlock" : "Lock",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: "danger",
                      onClick: () => {
                        dispatch({ type: "DELETE_SELECTED" });
                        showMobileToast("Deleted · Undo available");
                      },
                    },
                    "Del",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: showMobileSelectionMore ? "active" : "",
                      onClick: () => {
                        setShowMobileNudge(false);
                        setShowMobileSelectionMore((v) => !v);
                      },
                    },
                    "More",
                  ),
                )
              : React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    "button",
                    {
                      className: "primary-action",
                      onClick: () => setShowMobileSelectionMore(true),
                    },
                    "Align",
                  ),
                  React.createElement(
                    "button",
                    { onClick: () => setSelectedSpacing("v") },
                    "Space",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: appSelectedAllLocked ? "active" : "",
                      onClick: () =>
                        dispatch({
                          type: "LOCK_SELECTED",
                          locked: !appSelectedAllLocked,
                        }),
                    },
                    appSelectedAllLocked ? "Unlock" : "Lock",
                  ),
                  React.createElement(
                    "button",
                    { onClick: () => dispatch({ type: "GROUP_SELECTED" }) },
                    "Group",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: "danger",
                      onClick: () => {
                        dispatch({ type: "DELETE_SELECTED" });
                        showMobileToast("Deleted · Undo available");
                      },
                    },
                    "Del",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: showMobileSelectionMore ? "active" : "",
                      onClick: () => {
                        setShowMobileNudge(false);
                        setShowMobileSelectionMore((v) => !v);
                      },
                    },
                    "More",
                  ),
                ),
          ),
        ),
      componentMenu &&
        (() => {
          const comp = state.components.find((c) => c.id === componentMenu.id);
          if (!comp) return null;
          const appliesToSelection =
            state.selected.length > 1 && state.selected.includes(comp.id);
          const allTargetsLocked = appliesToSelection
            ? state.components
                .filter((c) => state.selected.includes(c.id))
                .every((c) => c.locked)
            : comp.locked;
          const menuWidth = Math.min(420, window.innerWidth - 16);
          const left = Math.min(
            Math.max(8, componentMenu.x),
            window.innerWidth - menuWidth - 8,
          );
          const top = Math.min(
            Math.max(52, componentMenu.y),
            window.innerHeight - 154,
          );
          return React.createElement(
            "div",
            {
              className: "component-menu",
              style: {
                position: "fixed",
                left,
                top,
                zIndex: 1200,
                width: menuWidth,
              },
              onMouseDown: (e) => e.stopPropagation(),
              onTouchStart: (e) => e.stopPropagation(),
            },
            React.createElement(
              "div",
              { className: "component-menu-head" },
              React.createElement(
                "strong",
                null,
                appliesToSelection
                  ? `${state.selected.length} selected`
                  : comp.label || comp.name,
              ),
              React.createElement(
                "button",
                {
                  className: "component-menu-close",
                  onClick: () => setComponentMenu(null),
                  title: "Close menu",
                  "aria-label": "Close menu",
                },
                "×",
              ),
            ),
            React.createElement(
              "div",
              { className: "component-menu-actions" },
              React.createElement(
                "button",
                {
                  onClick: () => {
                    dispatch({
                      type: "SELECT",
                      ids: [comp.id],
                      additive: false,
                    });
                    setComponentMenu(null);
                    if (isNarrowInitial) {
                      AppCommands.openMobileQuickLabelEdit();
                    } else {
                      openComponentPropertiesPanel();
                      window.setTimeout(() => {
                        const inp =
                          document.querySelector("[data-label-input]");
                        if (inp) {
                          inp.focus();
                          inp.select();
                        }
                      }, 80);
                    }
                  },
                },
                React.createElement(
                  "span",
                  { className: "component-menu-icon", "aria-hidden": true },
                  "✎",
                ),
                React.createElement("span", null, "Edit label"),
              ),
              React.createElement(
                "button",
                {
                  onClick: () => {
                    dispatch({
                      type: "SELECT",
                      ids: [comp.id],
                      additive: false,
                    });
                    setComponentMenu(null);
                    if (isNarrowInitial) {
                      AppCommands.openMobilePartSheet();
                    } else {
                      openComponentPropertiesPanel();
                    }
                  },
                },
                React.createElement(
                  "span",
                  { className: "component-menu-icon", "aria-hidden": true },
                  "⌁",
                ),
                React.createElement("span", null, "Part inspector"),
              ),
              React.createElement(
                "button",
                { onClick: () => duplicateComponentFromMenu(comp.id) },
                React.createElement(
                  "span",
                  { className: "component-menu-icon", "aria-hidden": true },
                  "⧉",
                ),
                React.createElement("span", null, "Duplicate"),
              ),
              React.createElement(
                "button",
                { onClick: () => rotateComponentFromMenu(comp.id) },
                React.createElement(
                  "span",
                  { className: "component-menu-icon", "aria-hidden": true },
                  "↻",
                ),
                React.createElement("span", null, "Rotate +90\u00B0"),
              ),
              React.createElement(
                "button",
                {
                  onClick: () => {
                    dispatch(
                      appliesToSelection
                        ? {
                            type: "LOCK_SELECTED",
                            locked: !allTargetsLocked,
                          }
                        : {
                            type: "SET_COMPONENT_LOCKED",
                            id: comp.id,
                            locked: !comp.locked,
                          },
                    );
                    setComponentMenu(null);
                  },
                },
                React.createElement(
                  "span",
                  { className: "component-menu-icon", "aria-hidden": true },
                  allTargetsLocked ? "◇" : "◆",
                ),
                React.createElement(
                  "span",
                  null,
                  allTargetsLocked ? "Unlock" : "Lock",
                ),
              ),
              React.createElement(
                "button",
                {
                  className: "danger component-menu-delete",
                  onClick: () => deleteComponentFromMenu(comp.id),
                },
                React.createElement(
                  "span",
                  { className: "component-menu-icon", "aria-hidden": true },
                  "×",
                ),
                React.createElement("span", null, "Delete"),
              ),
            ),
          );
        })(),
      React.createElement(RightSidebar, {
        warnings: warnings,
        components: state.components,
        open: rightPanelOpen,
        autosaveStatus: autosaveStatus,
        onRestoreAutosave: restoreAutosave,
        onClearAutosave: clearAutosave,
        onTouchStart: onDrawerSwipeStart,
        onTouchMove: onDrawerSwipeMove,
        onTouchEnd: onDrawerSwipeEnd,
        topTab: rightInspectorTopTab,
        setTopTab: setRightInspectorTopTab,
        statusTab: rightStatusTab,
        setStatusTab: setRightStatusTab,
        inspectTab: rightInspectTab,
        setInspectTab: setRightInspectTab,
        prodTab: rightProdTab,
        setProdTab: setRightProdTab,
        layersTab: rightLayersTab,
        setLayersTab: setRightLayersTab,
      }),
    ),
  );
}
