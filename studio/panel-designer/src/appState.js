// React app state: context, reducer, AppProvider, useAppState, useAppDispatch.
// Depends on: React globals (useState, useReducer, useContext, createContext) from CDN.
// Load after core.js (uses MAX_UNDO and other core constants via closure).
const AppStateCtx = createContext(null);
const AppDispatchCtx = createContext(null);
function appReducer(state, action) {
  switch (action.type) {
    case "SET_PANEL_HP": {
      const panel = { ...state.panel, widthHP: action.hp };
      const widthMM = panelWidthMM(panel);
      return withHistory(state, {
        ...snapshot(state),
        panel,
        mountingHoles:
          state.mountingHoles.preset === "custom"
            ? {
                ...state.mountingHoles,
                holes: state.mountingHoles.holes.map(normalizeMountingHoleRail),
              }
            : {
                ...state.mountingHoles,
                holes: mountingHolesForPreset(
                  widthMM,
                  state.mountingHoles.preset,
                ),
              },
        pcb: { ...state.pcb, x: 0, width: widthMM },
      });
    }
    case "ADD_COMPONENT": {
      const def = sanitizePart({
        ...action.def,
        category: action.def.category ?? inferCategoryForType(action.def.type),
        verificationStatus: action.def.verificationStatus ?? "approximate",
      });
      const comp = {
        ...def,
        id: crypto.randomUUID(),
        ref: nextRefForComponent(def.type, state.components),
        label: defaultLabelForComponentDef(def),
        x: action.x,
        y: action.y,
        rotation: 0,
        notes: "",
        locked: false,
      };
      return withHistory(state, {
        ...snapshot(state),
        components: [...state.components, comp],
        selected: [comp.id],
      });
    }
    case "UPDATE_COMPONENT": {
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c,
        ),
      });
    }
    case "UPDATE_COMPONENTS_PATCH": {
      const ids = new Set(action.ids);
      if (!ids.size) return state;
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          ids.has(c.id) ? { ...c, ...action.patch } : c,
        ),
      });
    }
    case "DELETE_SELECTED": {
      const deletedIds = new Set(state.selected);
      const deletedTextIds = new Set(state.selectedTexts);
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.filter((c) => !deletedIds.has(c.id)),
        scaleItems: state.scaleItems.filter(
          (sc) => !sc.componentId || !deletedIds.has(sc.componentId),
        ),
        textItems: state.textItems.filter(
          (t) =>
            !deletedTextIds.has(t.id) &&
            (!t.componentId || !deletedIds.has(t.componentId)),
        ),
        selected: [],
        selectedTexts: [],
      });
    }
    case "DELETE_COMPONENT": {
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.filter((c) => c.id !== action.id),
        scaleItems: state.scaleItems.filter(
          (sc) => sc.componentId !== action.id,
        ),
        textItems: state.textItems.filter((t) => t.componentId !== action.id),
        selected: state.selected.filter((id) => id !== action.id),
        selectedArtwork: null,
        selectedTexts: [],
      });
    }
    case "CLEAR_PANEL": {
      if (state.components.length === 0) return state;
      return withHistory(state, {
        ...snapshot(state),
        components: [],
        scaleItems: state.scaleItems.filter((sc) => !sc.componentId),
        textItems: state.textItems.filter((t) => !t.componentId),
        selected: [],
        selectedArtwork: null,
        selectedTexts: [],
      });
    }
    case "START_NEW_PROJECT": {
      const fresh = snapshot(makeInitialState());
      return withHistory(state, { ...fresh, customParts: state.customParts });
    }
    case "DUPLICATE_SELECTED": {
      const srcs = state.components.filter((c) =>
        state.selected.includes(c.id),
      );
      const dupes = [];
      for (const c of srcs) {
        dupes.push({
          ...c,
          id: crypto.randomUUID(),
          ref: nextRefForComponent(c.type, [...state.components, ...dupes]),
          x: c.x + 5,
          y: c.y + 5,
        });
      }
      return withHistory(state, {
        ...snapshot(state),
        components: [...state.components, ...dupes],
        selected: dupes.map((d) => d.id),
      });
    }
    case "ADD_COMPONENTS": {
      if (action.components.length === 0) return state;
      return withHistory(state, {
        ...snapshot(state),
        components: [...state.components, ...action.components],
        selected: action.selectedIds ?? action.components.map((c) => c.id),
        selectedArtwork: null,
        selectedTexts: [],
      });
    }
    case "LOAD_KICAD_IMPORT": {
      if (
        action.components.length === 0 &&
        !action.boardOutline &&
        !action.artworks?.length
      )
        return state;
      const importedWidth =
        action.panelWidthMM && action.panelWidthMM > 5
          ? action.panelWidthMM
          : panelWidthMM(state.panel);
      const hp = Math.max(2, Math.ceil(importedWidth / HP_TO_MM));
      const panelWidth = hp * HP_TO_MM;
      const importedMountingPreset =
        state.mountingHoles.preset === "custom" ||
        state.mountingHoles.preset === "none"
          ? state.mountingHoles.preset
          : state.mountingHoles.holeShape === "oval"
            ? "autoOval"
            : "auto";
      return withHistory(state, {
        ...snapshot(state),
        panel: {
          ...state.panel,
          widthHP: hp,
          customHP: !STANDARD_HP.includes(hp),
        },
        panelOutlineGeometry: action.panelOutlineGeometry || null,
        pcb: action.boardOutline
          ? {
              ...state.pcb,
              x: 0,
              y: 0,
              width: panelWidth,
              height: Math.min(
                PANEL_HEIGHT_MM,
                Math.max(10, action.boardOutline.height),
              ),
            }
          : { ...state.pcb, x: 0, width: panelWidth },
        mountingHoles:
          importedMountingPreset === "custom"
            ? state.mountingHoles
            : {
                ...state.mountingHoles,
                preset: importedMountingPreset,
                holes: mountingHolesForPreset(
                  panelWidth,
                  importedMountingPreset,
                ),
              },
        components: action.components,
        textItems: [],
        scaleItems: [],
        artworks: Array.isArray(action.artworks) ? action.artworks : [],
        selected: action.components.map((c) => c.id),
        selectedArtwork: null,
        selectedTexts: [],
      });
    }
    case "SET_ARTWORK_PREVIEW_MODE":
      return {
        ...state,
        artworkPreviewMode: action.mode || "composite",
      };
    case "DUPLICATE_COMPONENT": {
      const src = state.components.find((c) => c.id === action.id);
      if (!src) return state;
      const dupe = {
        ...src,
        id: crypto.randomUUID(),
        ref: nextRefForComponent(src.type, state.components),
        x: src.x + 5,
        y: src.y + 5,
      };
      return withHistory(state, {
        ...snapshot(state),
        components: [...state.components, dupe],
        selected: [dupe.id],
        selectedArtwork: null,
        selectedTexts: [],
      });
    }
    case "ROTATE_SELECTED": {
      if (state.selected.length === 0) return state;
      const selectedSet = new Set(state.selected);
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          selectedSet.has(c.id)
            ? {
                ...c,
                rotation:
                  ((((c.rotation || 0) + action.degrees) % 360) + 360) % 360,
              }
            : c,
        ),
      });
    }
    case "SELECT": {
      const ids = action.additive
        ? [...new Set([...state.selected, ...action.ids])]
        : action.ids;
      return {
        ...state,
        selected: ids,
        selectedArtwork: null,
        selectedTexts: action.textIds ?? [],
      };
    }
    case "DESELECT_ALL":
      return {
        ...state,
        selected: [],
        selectedArtwork: null,
        selectedTexts: [],
      };
    case "MOVE_COMPONENT": {
      const oldComp = state.components.find((c) => c.id === action.id);
      const dx = oldComp ? action.x - oldComp.x : 0;
      const dy = oldComp ? action.y - oldComp.y : 0;
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          c.id === action.id && !c.locked
            ? { ...c, x: action.x, y: action.y }
            : c,
        ),
        textItems: state.textItems.map((t) =>
          t.componentId === action.id ? { ...t, x: t.x + dx, y: t.y + dy } : t,
        ),
      });
    }
    case "MOVE_COMPONENTS": {
      const movesMap = new Map(action.moves.map((m) => [m.id, m]));
      const textMovesMap = new Map(
        (action.textMoves || []).map((m) => [m.id, m]),
      );
      const deltas = new Map();
      for (const c of state.components) {
        const m = movesMap.get(c.id);
        if (m) deltas.set(c.id, { dx: m.x - c.x, dy: m.y - c.y });
      }
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          movesMap.has(c.id) && !c.locked
            ? { ...c, x: movesMap.get(c.id).x, y: movesMap.get(c.id).y }
            : c,
        ),
        textItems: state.textItems.map((t) => {
          if (textMovesMap.has(t.id))
            return {
              ...t,
              x: textMovesMap.get(t.id).x,
              y: textMovesMap.get(t.id).y,
            };
          const d = t.componentId ? deltas.get(t.componentId) : undefined;
          return d ? { ...t, x: t.x + d.dx, y: t.y + d.dy } : t;
        }),
      });
    }
    case "SET_VIEW_MODE":
      return {
        ...state,
        viewMode: action.mode,
        layerVisibility: layerVisibilityForViewMode(
          state.layerVisibility,
          action.mode,
        ),
      };
    case "SET_TOP_HARDWARE_STYLE":
      return { ...state, topHardwareStyle: action.style };
    case "SET_HARDWARE_RENDER_MODE":
      return { ...state, hardwareRenderMode: action.mode };
    case "SET_MOBILE_PERFORMANCE_MODE":
      return { ...state, mobilePerformanceMode: action.value };
    case "SET_GRID_SIZE":
      return { ...state, grid: { ...state.grid, size: action.size } };
    case "TOGGLE_MAJOR_GRID":
      return {
        ...state,
        grid: { ...state.grid, showMajor: !state.grid.showMajor },
      };
    case "SET_PCB": {
      const patch = { ...action.patch };
      if (typeof patch.height === "number" && typeof patch.y !== "number") {
        const oldCenterY = state.pcb.y + state.pcb.height / 2;
        patch.height = Math.max(0.1, patch.height);
        patch.y = oldCenterY - patch.height / 2;
      }
      return withHistory(state, {
        ...snapshot(state),
        pcb: { ...state.pcb, ...patch },
      });
    }
    case "SET_MOUNTING_HOLES":
      return withHistory(state, {
        ...snapshot(state),
        mountingHoles: { ...state.mountingHoles, ...action.patch },
      });
    case "UPDATE_MOUNTING_HOLE":
      return withHistory(state, {
        ...snapshot(state),
        mountingHoles: {
          ...state.mountingHoles,
          holes: state.mountingHoles.holes.map((h) =>
            h.id === action.id
              ? normalizeMountingHoleRail({ ...h, x: action.x })
              : h,
          ),
        },
      });
    case "ALIGN": {
      if (state.selected.length < 2) return state;
      const sel = state.components.filter((c) => state.selected.includes(c.id));
      const extents = new Map(sel.map((c) => [c.id, getFrontExtents(c)]));
      const left = Math.min(...sel.map((c) => extents.get(c.id).x1));
      const right = Math.max(...sel.map((c) => extents.get(c.id).x2));
      const top = Math.min(...sel.map((c) => extents.get(c.id).y1));
      const bottom = Math.max(...sel.map((c) => extents.get(c.id).y2));
      const centerX = sel.reduce((sum, c) => sum + c.x, 0) / sel.length;
      const centerY = sel.reduce((sum, c) => sum + c.y, 0) / sel.length;
      const getX = (c) => {
        const e = extents.get(c.id);
        if (action.axis === "left") return left + (c.x - e.x1);
        if (action.axis === "right") return right - (e.x2 - c.x);
        if (action.axis === "centerV") return centerX;
        return c.x;
      };
      const getY = (c) => {
        const e = extents.get(c.id);
        if (action.axis === "top") return top + (c.y - e.y1);
        if (action.axis === "bottom") return bottom - (e.y2 - c.y);
        if (action.axis === "centerH") return centerY;
        return c.y;
      };
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          state.selected.includes(c.id) ? { ...c, x: getX(c), y: getY(c) } : c,
        ),
      });
    }
    case "ALIGN_TO_REFERENCE": {
      if (state.selected.length < 2) return state;
      const reference = state.components.find(
        (component) => component.id === action.referenceId,
      );
      if (!reference || !state.selected.includes(reference.id)) return state;
      const referenceExtents = getFrontExtents(reference);
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((component) => {
          if (
            component.id === reference.id ||
            !state.selected.includes(component.id) ||
            component.locked
          )
            return component;
          const extents = getFrontExtents(component);
          if (action.axis === "centerX")
            return { ...component, x: reference.x };
          if (action.axis === "centerY")
            return { ...component, y: reference.y };
          if (action.axis === "left")
            return {
              ...component,
              x: referenceExtents.x1 + (component.x - extents.x1),
            };
          if (action.axis === "right")
            return {
              ...component,
              x: referenceExtents.x2 - (extents.x2 - component.x),
            };
          if (action.axis === "top")
            return {
              ...component,
              y: referenceExtents.y1 + (component.y - extents.y1),
            };
          if (action.axis === "bottom")
            return {
              ...component,
              y: referenceExtents.y2 - (extents.y2 - component.y),
            };
          return component;
        }),
      });
    }
    case "DISTRIBUTE": {
      if (state.selected.length < 3) return state;
      const sel = [
        ...state.components.filter((c) => state.selected.includes(c.id)),
      ];
      if (action.axis === "h") {
        sel.sort((a, b) => a.x - b.x);
        const minX = sel[0].x,
          maxX = sel[sel.length - 1].x;
        const step = (maxX - minX) / (sel.length - 1);
        const xMap = new Map(sel.map((c, i) => [c.id, minX + i * step]));
        return withHistory(state, {
          ...snapshot(state),
          components: state.components.map((c) =>
            xMap.has(c.id) ? { ...c, x: xMap.get(c.id) } : c,
          ),
        });
      } else {
        sel.sort((a, b) => a.y - b.y);
        const minY = sel[0].y,
          maxY = sel[sel.length - 1].y;
        const step = (maxY - minY) / (sel.length - 1);
        const yMap = new Map(sel.map((c, i) => [c.id, minY + i * step]));
        return withHistory(state, {
          ...snapshot(state),
          components: state.components.map((c) =>
            yMap.has(c.id) ? { ...c, y: yMap.get(c.id) } : c,
          ),
        });
      }
    }
    case "SET_SELECTED_SPACING": {
      if (
        state.selected.length < 2 ||
        !isFinite(action.spacing) ||
        action.spacing < 0
      )
        return state;
      const sel = [
        ...state.components.filter((c) => state.selected.includes(c.id)),
      ];
      if (action.axis === "h") {
        sel.sort((a, b) => a.x - b.x);
        const first = sel[0].x;
        const xMap = new Map(
          sel.map((c, i) => [c.id, first + i * action.spacing]),
        );
        return withHistory(state, {
          ...snapshot(state),
          components: state.components.map((c) =>
            xMap.has(c.id) ? { ...c, x: xMap.get(c.id) } : c,
          ),
        });
      }
      sel.sort((a, b) => a.y - b.y);
      const first = sel[0].y;
      const yMap = new Map(
        sel.map((c, i) => [c.id, first + i * action.spacing]),
      );
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          yMap.has(c.id) ? { ...c, y: yMap.get(c.id) } : c,
        ),
      });
    }
    case "SMART_ARRANGE_SELECTED": {
      const selected = state.components.filter(
        (component) =>
          state.selected.includes(component.id) && !component.locked,
      );
      if (selected.length < 2) return state;
      const ordered = [...selected].sort((a, b) => a.y - b.y || a.x - b.x);
      const extents = ordered.map((component) => getFrontExtents(component));
      const maxWidth = Math.max(
        ...extents.map((extent) => extent.x2 - extent.x1),
        ...ordered.map(
          (component) =>
            Number(component.keepoutW) || Number(component.rearBodyW) || 0,
        ),
      );
      const maxHeight = Math.max(
        ...extents.map((extent) => extent.y2 - extent.y1),
        ...ordered.map(
          (component) =>
            Number(component.keepoutH) || Number(component.rearBodyH) || 0,
        ),
      );
      const recommendedGap = Math.max(
        1,
        ...ordered.map((component) => Number(component.minSpacing) || 0),
      );
      const cellWidth = maxWidth + recommendedGap;
      const cellHeight = maxHeight + recommendedGap;
      const panelWidth = panelWidthMM(state.panel);
      const maxPanelColumns = Math.max(
        1,
        Math.floor((panelWidth - maxWidth) / cellWidth) + 1,
      );
      const columns =
        action.layout === "row"
          ? Math.min(ordered.length, maxPanelColumns)
          : action.layout === "column"
            ? 1
            : Math.min(Math.ceil(Math.sqrt(ordered.length)), maxPanelColumns);
      const rows = Math.ceil(ordered.length / columns);
      const currentCenterX =
        ordered.reduce((sum, component) => sum + component.x, 0) /
        ordered.length;
      const currentCenterY =
        ordered.reduce((sum, component) => sum + component.y, 0) /
        ordered.length;
      const groupWidth = (columns - 1) * cellWidth;
      const groupHeight = (rows - 1) * cellHeight;
      const halfWidth = maxWidth / 2;
      const halfHeight = maxHeight / 2;
      const centerX = Math.max(
        halfWidth + groupWidth / 2,
        Math.min(panelWidth - halfWidth - groupWidth / 2, currentCenterX),
      );
      const centerY = Math.max(
        halfHeight + groupHeight / 2,
        Math.min(
          PANEL_HEIGHT_MM - halfHeight - groupHeight / 2,
          currentCenterY,
        ),
      );
      const step = Number(state.grid?.size) || 0.5;
      const positionById = new Map(
        ordered.map((component, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          return [
            component.id,
            {
              x:
                Math.round(
                  (centerX - groupWidth / 2 + column * cellWidth) / step,
                ) * step,
              y:
                Math.round(
                  (centerY - groupHeight / 2 + row * cellHeight) / step,
                ) * step,
            },
          ];
        }),
      );
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((component) =>
          positionById.has(component.id)
            ? { ...component, ...positionById.get(component.id) }
            : component,
        ),
      });
    }
    case "RESOLVE_COMPONENT_CLEARANCE": {
      const pair = (action.ids || [])
        .map((id) => state.components.find((component) => component.id === id))
        .filter(Boolean)
        .slice(0, 2);
      if (pair.length !== 2) return state;
      const suggestion =
        action.position ||
        suggestClearanceResolution(
          state.components,
          panelWidthMM(state.panel),
          state.mountingHoles,
          state.pcb,
          action.ids,
        );
      if (!suggestion) return state;
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((component) =>
          component.id === suggestion.id
            ? { ...component, x: suggestion.x, y: suggestion.y }
            : component,
        ),
        selected: pair.map((component) => component.id),
      });
    }
    case "MIRROR_SELECTED": {
      if (state.selected.length < 1) return state;
      const sel = state.components.filter((c) => state.selected.includes(c.id));
      const widthMM = panelWidthMM(state.panel);
      const xs = sel.map((c) => c.x),
        ys = sel.map((c) => c.y);
      const centerX =
        action.around === "panel"
          ? widthMM / 2
          : (Math.min(...xs) + Math.max(...xs)) / 2;
      const centerY =
        action.around === "panel"
          ? PANEL_HEIGHT_MM / 2
          : (Math.min(...ys) + Math.max(...ys)) / 2;
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) => {
          if (!state.selected.includes(c.id)) return c;
          if (action.axis === "x")
            return {
              ...c,
              x: centerX * 2 - c.x,
              rotation: (360 - (c.rotation || 0)) % 360,
            };
          return {
            ...c,
            y: centerY * 2 - c.y,
            rotation: (180 - (c.rotation || 0) + 360) % 360,
          };
        }),
      });
    }
    case "DUPLICATE_SELECTED_PATTERN": {
      if (
        state.selected.length < 1 ||
        !isFinite(action.spacing) ||
        action.spacing === 0 ||
        action.count < 1
      )
        return state;
      const selected = state.components.filter((c) =>
        state.selected.includes(c.id),
      );
      const comps = [];
      for (let step = 1; step <= action.count; step++) {
        for (const c of selected) {
          comps.push({
            ...c,
            id: crypto.randomUUID(),
            ref: nextRefForComponent(c.type, [...state.components, ...comps]),
            x: c.x + (action.axis === "h" ? action.spacing * step : 0),
            y: c.y + (action.axis === "v" ? action.spacing * step : 0),
          });
        }
      }
      return withHistory(state, {
        ...snapshot(state),
        components: [...state.components, ...comps],
        selected: comps.map((c) => c.id),
      });
    }
    case "LOAD_PRESET":
      return withHistory(state, {
        ...snapshot(state),
        components: action.components,
        selected: [],
      });
    case "LOAD_STATE":
      return { ...action.state, history: [], future: [] };
    case "UNDO": {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      const history = state.history.slice(0, -1);
      const future = [snapshot(state), ...state.future];
      return { ...prev, history, future };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const future = state.future.slice(1);
      const history = [...state.history, snapshot(state)];
      return { ...next, history, future };
    }
    case "ADD_ARTWORK":
      return withHistory(state, {
        ...snapshot(state),
        artworks: [...state.artworks, action.item],
        selected: [],
        selectedArtwork: action.item.id,
      });
    case "UPDATE_ARTWORK":
      return withHistory(state, {
        ...snapshot(state),
        artworks: state.artworks.map((a) =>
          a.id === action.id ? { ...a, ...action.patch } : a,
        ),
      });
    case "DELETE_ARTWORK":
      return withHistory(state, {
        ...snapshot(state),
        artworks: state.artworks.filter((a) => a.id !== action.id),
        selectedArtwork:
          state.selectedArtwork === action.id ? null : state.selectedArtwork,
      });
    case "MOVE_ARTWORK":
      return withHistory(state, {
        ...snapshot(state),
        artworks: state.artworks.map((a) =>
          a.id === action.id ? { ...a, x: action.x, y: action.y } : a,
        ),
      });
    case "SELECT_ARTWORK":
      return {
        ...state,
        selectedArtwork: action.id,
        selectedTexts: [],
        selected: action.id !== null ? [] : state.selected,
      };
    case "SET_CLIP_ARTWORK":
      return { ...state, clipArtworkToPanel: action.value };
    case "SET_IGNORE_LOCKED_CLICKS":
      return { ...state, ignoreLockedArtworkClicks: action.value };
    case "SET_SHOW_ARTWORK_IN_DRILL":
      return { ...state, showArtworkInDrillView: action.value };
    case "SET_DRILL_ARTWORK_OPACITY":
      return { ...state, drillArtworkOpacity: action.value };
    case "SET_ALL_ARTWORK_VISIBLE":
      return withHistory(state, {
        ...snapshot(state),
        artworks: state.artworks.map((a) => ({
          ...a,
          visible: action.visible,
        })),
      });
    case "REORDER_ARTWORK": {
      const art = state.artworks.find((a) => a.id === action.id);
      if (!art) return state;
      const layer = art.layer;
      const same = state.artworks.filter((a) => a.layer === layer);
      const idx = same.findIndex((a) => a.id === action.id);
      const newSame = [...same];
      if (action.dir === "forward" && idx < newSame.length - 1) {
        [newSame[idx], newSame[idx + 1]] = [newSame[idx + 1], newSame[idx]];
      } else if (action.dir === "backward" && idx > 0) {
        [newSame[idx], newSame[idx - 1]] = [newSame[idx - 1], newSame[idx]];
      } else if (action.dir === "front") {
        newSame.splice(idx, 1);
        newSame.push(art);
      } else if (action.dir === "back") {
        newSame.splice(idx, 1);
        newSame.unshift(art);
      }
      let si = 0;
      const newArtworks = state.artworks.map((a) =>
        a.layer === layer ? newSame[si++] : a,
      );
      return withHistory(state, { ...snapshot(state), artworks: newArtworks });
    }
    case "ADD_TEXT":
      return withHistory(state, {
        ...snapshot(state),
        textItems: [...state.textItems, action.item],
        selected: [],
        selectedArtwork: null,
        selectedTexts: [action.item.id],
      });
    case "UPDATE_TEXT":
      return withHistory(state, {
        ...snapshot(state),
        textItems: state.textItems.map((t) => {
          if (t.id !== action.id) return t;
          const updated = { ...t, ...action.patch };
          if (
            (action.patch.x !== undefined || action.patch.y !== undefined) &&
            updated.componentId
          ) {
            const c = state.components.find(
              (cc) => cc.id === updated.componentId,
            );
            if (c)
              return {
                ...updated,
                offsetX: updated.x - c.x,
                offsetY: updated.y - c.y,
              };
          }
          return updated;
        }),
      });
    case "DELETE_TEXT":
      return withHistory(state, {
        ...snapshot(state),
        textItems: state.textItems.filter((t) => t.id !== action.id),
        selectedTexts: state.selectedTexts.filter((id) => id !== action.id),
      });
    case "MOVE_TEXT":
      return withHistory(state, {
        ...snapshot(state),
        textItems: state.textItems.map((t) => {
          if (t.id !== action.id) return t;
          const moved = { ...t, x: action.x, y: action.y };
          if (moved.componentId) {
            const c = state.components.find(
              (cc) => cc.id === moved.componentId,
            );
            if (c)
              return {
                ...moved,
                offsetX: action.x - c.x,
                offsetY: action.y - c.y,
              };
          }
          return moved;
        }),
      });
    case "SELECT_TEXT":
      return {
        ...state,
        selectedTexts: action.id !== null ? [action.id] : [],
        selectedArtwork: null,
        selected: action.id !== null ? [] : state.selected,
      };
    case "ADD_SCALE":
      return withHistory(state, {
        ...snapshot(state),
        scaleItems: [...state.scaleItems, action.item],
      });
    case "DELETE_SCALE":
      return withHistory(state, {
        ...snapshot(state),
        scaleItems: state.scaleItems.filter((sc) => sc.id !== action.id),
      });
    case "UPDATE_SCALE":
      return withHistory(state, {
        ...snapshot(state),
        scaleItems: state.scaleItems.map((sc) =>
          sc.id === action.id ? { ...sc, ...action.patch } : sc,
        ),
      });
    case "DELETE_SCALES_FOR_COMPONENT":
      return withHistory(state, {
        ...snapshot(state),
        scaleItems: state.scaleItems.filter(
          (sc) => sc.componentId !== action.componentId,
        ),
      });
    case "ADD_CUSTOM_PART":
      return withHistory(state, {
        ...snapshot(state),
        customParts: [
          ...state.customParts.filter((p) => p.name !== action.item.name),
          action.item,
        ],
      });
    case "DELETE_CUSTOM_PART":
      return withHistory(state, {
        ...snapshot(state),
        customParts: state.customParts.filter((p) => p.name !== action.name),
      });
    case "IMPORT_CUSTOM_PARTS":
      return withHistory(state, {
        ...snapshot(state),
        customParts: action.items,
      });
    case "RESET_CUSTOM_PARTS":
      return withHistory(state, { ...snapshot(state), customParts: [] });
    case "SET_LAYER_VISIBILITY":
      return {
        ...state,
        layerVisibility: {
          ...state.layerVisibility,
          [action.key]: action.value,
        },
      };
    case "SET_LAYER_VISIBILITY_BULK":
      return {
        ...state,
        layerVisibility: { ...state.layerVisibility, ...action.patch },
      };
    case "SET_LAYER_OPACITY":
      return {
        ...state,
        layerOpacity: {
          ...state.layerOpacity,
          [action.key]: Math.max(0.05, Math.min(1, action.value)),
        },
      };
    case "SET_LAYER_EXPORT":
      return {
        ...state,
        layerExport: { ...state.layerExport, [action.key]: action.value },
      };
    case "SET_DEPTH_SETTINGS":
      return {
        ...state,
        depthSettings: { ...state.depthSettings, ...action.patch },
      };
    case "AUTO_NUMBER_REFS":
      return withHistory(state, {
        ...snapshot(state),
        components: renumberRefs(state.components),
      });
    case "APPLY_TO_SAME_TYPE": {
      const src = state.components.find((c) => c.id === action.sourceId);
      if (!src) return state;
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          c.id !== src.id && isSamePartType(c, src)
            ? { ...c, ...action.patch }
            : c,
        ),
      });
    }
    case "REPLACE_SELECTED_WITH_PART": {
      if (state.selected.length === 0) return state;
      const selected = new Set(state.selected);
      const part = sanitizePart(action.def);
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          selected.has(c.id)
            ? {
                ...part,
                id: c.id,
                ref: c.ref,
                label: c.label,
                x: c.x,
                y: c.y,
                rotation: c.rotation,
                notes: c.notes,
              }
            : c,
        ),
      });
    }
    case "SET_COMPONENT_LOCKED":
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          c.id === action.id ? { ...c, locked: action.locked } : c,
        ),
      });
    case "LOCK_SELECTED": {
      const ids = action.ids || state.selected;
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          ids.includes(c.id) ? { ...c, locked: action.locked } : c,
        ),
      });
    }
    case "GROUP_SELECTED": {
      if (state.selected.length < 2) return state;
      const groupId = crypto.randomUUID();
      const groupName = action.name || `Group ${state.selected.length}`;
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          state.selected.includes(c.id) ? { ...c, groupId, groupName } : c,
        ),
      });
    }
    case "UNGROUP_SELECTED":
      return withHistory(state, {
        ...snapshot(state),
        components: state.components.map((c) =>
          state.selected.includes(c.id)
            ? { ...c, groupId: null, groupName: "" }
            : c,
        ),
      });
    case "SET_DFM_PROFILE":
      return { ...state, dfmProfile: action.profile };
    case "APPLY_LAYER_PRESET": {
      const preset =
        action.preset === "mechanical"
          ? {
              grid: true,
              panelOutline: true,
              mountingHoles: true,
              artwork: false,
              text: false,
              labels: false,
              componentHoles: true,
              frontShapes: false,
              topHardware: false,
              rearBodies: true,
              rearKeepouts: true,
              pcb: true,
            }
          : action.preset === "visual"
            ? {
                grid: true,
                panelOutline: true,
                mountingHoles: false,
                artwork: true,
                text: true,
                labels: true,
                componentHoles: false,
                frontShapes: true,
                topHardware: true,
                rearBodies: false,
                rearKeepouts: false,
                pcb: false,
              }
            : action.preset === "production"
              ? {
                  grid: false,
                  panelOutline: true,
                  mountingHoles: true,
                  artwork: false,
                  text: false,
                  labels: false,
                  componentHoles: true,
                  frontShapes: false,
                  topHardware: false,
                  rearBodies: false,
                  rearKeepouts: false,
                  pcb: false,
                }
              : defaultLayerVisibility();
      return { ...state, layerVisibility: preset };
    }
    case "UPDATE_PROJECT_META":
      return withHistory(state, {
        ...snapshot(state),
        projectMeta: {
          ...state.projectMeta,
          ...action.patch,
          updatedAt: new Date().toISOString(),
        },
      });
    case "RESTORE_HISTORY_INDEX": {
      if (action.index < 0 || action.index >= state.history.length)
        return state;
      const target = state.history[action.index];
      const before = state.history.slice(0, action.index);
      const newer = state.history.slice(action.index + 1);
      return {
        ...target,
        history: before,
        future: [...newer, snapshot(state)],
      };
    }
    case "CLEAR_HISTORY":
      return { ...state, history: [], future: [] };
    default:
      return state;
  }
}
function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, makeInitialState);
  return React.createElement(
    AppStateCtx.Provider,
    { value: state },
    React.createElement(AppDispatchCtx.Provider, { value: dispatch }, children),
  );
}
const useAppState = () => useContext(AppStateCtx);
const useAppDispatch = () => useContext(AppDispatchCtx);
