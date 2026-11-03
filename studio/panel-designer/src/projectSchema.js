// Project file schema: validation, normalization, storage keys.
// Depends on: COMPONENT_LIBRARY, isPotLike, isFaderLike, inferCategoryForType,
// refPrefixForType, panelWidthMM, PANEL_HEIGHT_MM, defaultLayerVisibility — all from core.js.
/* ProjectPanel moved to LeftSidebarPanels.js */ /* PanelSettings moved to LeftSidebarPanels.js */ function sanitizePart(
  def,
) {
  const base = {
    type: def.type || "custom",
    name: def.name || "Custom Part",
    holeDiameter: Number(def.holeDiameter) || 5,
    frontDiameter: Number(def.frontDiameter) || Number(def.holeDiameter) || 5,
    rearBodyW: Number(def.rearBodyW) || 0,
    rearBodyH: Number(def.rearBodyH) || 0,
    rearDepth: Number(def.rearDepth) || 0,
    keepoutW: Number(def.keepoutW) || Number(def.frontDiameter) || 5,
    keepoutH: Number(def.keepoutH) || Number(def.frontDiameter) || 5,
    minSpacing: Number(def.minSpacing) || 1,
    holeType:
      def.holeType === "slot" || def.holeType === "rect"
        ? def.holeType
        : undefined,
    slotLength: typeof def.slotLength === "number" ? def.slotLength : undefined,
    holeW: typeof def.holeW === "number" ? def.holeW : undefined,
    holeH: typeof def.holeH === "number" ? def.holeH : undefined,
    frontShape:
      def.frontShape === "rect" ||
      def.frontShape === "slot" ||
      def.frontShape === "circle"
        ? def.frontShape
        : undefined,
    frontW: typeof def.frontW === "number" ? def.frontW : undefined,
    frontH: typeof def.frontH === "number" ? def.frontH : undefined,
    nutDiameter: def.nutDiameter,
    washerDiameter: def.washerDiameter,
    knobDiameter: def.knobDiameter,
    knobEnabled: !!def.knobEnabled,
    knobTransparent: !!def.knobTransparent,
    ergonomicDiameter: def.ergonomicDiameter,
    ergonomicEnabled: !!def.ergonomicEnabled,
    topColor: def.topColor,
    nutShape: def.nutShape === "hex" ? "hex" : "circle",
    switchFunction:
      typeof def.switchFunction === "string" ? def.switchFunction : "on-off-on",
    topHardwareVisible: def.topHardwareVisible !== false,
    snapTargetEnabled: def.snapTargetEnabled !== false,
    faderHandleW:
      typeof def.faderHandleW === "number" ? def.faderHandleW : undefined,
    faderHandleH:
      typeof def.faderHandleH === "number" ? def.faderHandleH : undefined,
    manufacturer: def.manufacturer,
    partNumber: def.partNumber,
    datasheetUrl: def.datasheetUrl,
    category: def.category ?? inferCategoryForType(def.type || "custom"),
    pinKeepoutW: def.pinKeepoutW,
    pinKeepoutH: def.pinKeepoutH,
    panelThicknessMin: def.panelThicknessMin,
    panelThicknessMax: def.panelThicknessMax,
    verificationStatus:
      def.verificationStatus === "datasheet" ||
      def.verificationStatus === "measured" ||
      def.verificationStatus === "production"
        ? def.verificationStatus
        : "approximate",
  };
  if (
    isFaderLike(base) ||
    base.type === "tactled" ||
    base.type === "tact6mm" ||
    base.type === "led3mm"
  ) {
    base.nutDiameter = undefined;
    base.washerDiameter = undefined;
  }
  if (isFaderLike(base)) {
    base.category = "fader";
    base.knobEnabled = false;
    base.knobDiameter = undefined;
    base.frontShape = base.frontShape ?? "slot";
    base.holeType = base.holeType ?? "slot";
    base.faderHandleW =
      base.faderHandleW ?? Math.max(7, (base.frontW ?? 9) * 1.15);
    base.faderHandleH = base.faderHandleH ?? 5;
  }
  if (base.type === "tactled") {
    base.frontDiameter = 5.5;
    base.knobEnabled = false;
    base.knobDiameter = undefined;
  }
  return normalizeLegacyJackGeometry(base);
}
const LEGACY_BUILT_IN_GEOMETRY = {
  fader35: {
    name: "Alps Fader 35mm",
    geometry: {
      holeDiameter: 4,
      frontDiameter: 9,
      rearBodyW: 6.7,
      rearBodyH: 55,
      rearDepth: 15,
      keepoutW: 9,
      keepoutH: 58,
      minSpacing: 2,
      holeType: "slot",
      slotLength: 41,
      frontShape: "slot",
      frontW: 9,
      frontH: 55,
      faderHandleW: 10.5,
      faderHandleH: 5,
    },
  },
  fader45: {
    name: "Alps Fader 45mm",
    geometry: {
      holeDiameter: 4,
      frontDiameter: 9,
      rearBodyW: 6.7,
      rearBodyH: 65,
      rearDepth: 15,
      keepoutW: 9,
      keepoutH: 68,
      minSpacing: 2,
      holeType: "slot",
      slotLength: 51,
      frontShape: "slot",
      frontW: 9,
      frontH: 65,
      faderHandleW: 10.5,
      faderHandleH: 5,
    },
  },
  momentary12: {
    name: "Momentary 12mm",
    geometry: {
      holeDiameter: 12,
      frontDiameter: 16,
      rearBodyW: 12,
      rearBodyH: 12,
      rearDepth: 20,
      keepoutW: 16,
      keepoutH: 16,
      minSpacing: 2,
    },
  },
};
const BUILT_IN_GEOMETRY_FIELDS = [
  "name",
  "holeDiameter",
  "frontDiameter",
  "rearBodyW",
  "rearBodyH",
  "rearDepth",
  "keepoutW",
  "keepoutH",
  "minSpacing",
  "holeType",
  "slotLength",
  "frontShape",
  "frontW",
  "frontH",
  "faderHandleW",
  "faderHandleH",
  "manufacturer",
  "partNumber",
  "datasheetUrl",
  "category",
  "panelThicknessMin",
  "panelThicknessMax",
  "verificationStatus",
  "verification",
];
function normalizeLegacyBuiltInGeometry(component, raw, libraryPart) {
  const legacy = LEGACY_BUILT_IN_GEOMETRY[component.type];
  if (
    !legacy ||
    raw.partNumber ||
    raw.manufacturer ||
    raw.datasheetUrl ||
    (raw.name && raw.name !== legacy.name) ||
    (raw.verificationStatus && raw.verificationStatus !== "approximate") ||
    Object.entries(legacy.geometry).some(([key, value]) => raw[key] !== value)
  )
    return component;
  const normalized = { ...component };
  for (const key of BUILT_IN_GEOMETRY_FIELDS)
    normalized[key] = libraryPart[key];
  if (raw.label === legacy.name) normalized.label = libraryPart.name;
  return normalized;
}
function validateAndNormalize(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Root must be a JSON object." };
  }
  const obj = raw;
  const _projectVersion =
    typeof obj.projectVersion === "number" ? obj.projectVersion : 1;
  if (!obj.panel || typeof obj.panel !== "object") {
    return { ok: false, error: "Missing required field: panel." };
  }
  if (!Array.isArray(obj.components)) {
    return {
      ok: false,
      error: "Missing required field: components (must be array).",
    };
  }
  const repairs = [];
  const panelRaw = obj.panel;
  const panel = {
    widthHP:
      typeof panelRaw.widthHP === "number"
        ? panelRaw.widthHP
        : (repairs.push("panel.widthHP defaulted to 8"), 8),
    customHP:
      typeof panelRaw.customHP === "boolean" ? panelRaw.customHP : false,
  };
  const widthMM = panelWidthMM(panel);
  const components = [];
  for (let i = 0; i < obj.components.length; i++) {
    const rc = obj.components[i];
    if (!rc || typeof rc !== "object" || Array.isArray(rc)) {
      repairs.push(`Component ${i}: skipped (not an object).`);
      continue;
    }
    const r = rc;
    const libMatch =
      COMPONENT_LIBRARY.find((d) => d.type === r.type) ?? COMPONENT_LIBRARY[0];
    function num(key, fallback) {
      return typeof r[key] === "number" ? r[key] : fallback;
    }
    function str(key, fallback) {
      return typeof r[key] === "string" ? r[key] : fallback;
    }
    function bool(key, fallback) {
      return typeof r[key] === "boolean" ? r[key] : fallback;
    }
    const id = str("id", "");
    if (!id)
      repairs.push(
        `Component ${i} "${str("label", libMatch.name)}": generated new ID.`,
      );
    const comp = {
      ...libMatch,
      id: id || crypto.randomUUID(),
      ref: str(
        "ref",
        `${refPrefixForType(str("type", libMatch.type))}${i + 1}`,
      ),
      label: str("label", str("name", libMatch.name)),
      type: str("type", libMatch.type),
      name: str("name", libMatch.name),
      x: num("x", 20),
      y: num("y", 64),
      rotation: num("rotation", 0),
      notes: str("notes", ""),
      locked: bool("locked", false),
      holeDiameter: num("holeDiameter", libMatch.holeDiameter),
      frontDiameter: num("frontDiameter", libMatch.frontDiameter),
      rearBodyW: num("rearBodyW", libMatch.rearBodyW),
      rearBodyH: num("rearBodyH", libMatch.rearBodyH),
      rearDepth: num("rearDepth", libMatch.rearDepth),
      keepoutW: num("keepoutW", libMatch.keepoutW),
      keepoutH: num("keepoutH", libMatch.keepoutH),
      minSpacing: num("minSpacing", libMatch.minSpacing),
      holeType:
        r.holeType === "slot" || r.holeType === "rect"
          ? r.holeType
          : libMatch.holeType === "slot" || libMatch.holeType === "rect"
            ? libMatch.holeType
            : undefined,
      slotLength:
        typeof r.slotLength === "number" ? r.slotLength : libMatch.slotLength,
      holeW: typeof r.holeW === "number" ? r.holeW : libMatch.holeW,
      holeH: typeof r.holeH === "number" ? r.holeH : libMatch.holeH,
      frontShape:
        r.frontShape === "rect" ||
        r.frontShape === "slot" ||
        r.frontShape === "circle"
          ? r.frontShape
          : (libMatch.frontShape ??
            (libMatch.holeType === "slot" ? "slot" : "circle")),
      nutDiameter:
        typeof r.nutDiameter === "number" ? r.nutDiameter : undefined,
      washerDiameter:
        typeof r.washerDiameter === "number" ? r.washerDiameter : undefined,
      knobDiameter:
        typeof r.knobDiameter === "number" ? r.knobDiameter : undefined,
      knobEnabled: bool("knobEnabled", libMatch.knobEnabled ?? false),
      knobTransparent: bool(
        "knobTransparent",
        libMatch.knobTransparent ?? false,
      ),
      ergonomicDiameter:
        typeof r.ergonomicDiameter === "number"
          ? r.ergonomicDiameter
          : libMatch.ergonomicDiameter,
      ergonomicEnabled: bool(
        "ergonomicEnabled",
        libMatch.ergonomicEnabled ?? false,
      ),
      topColor: typeof r.topColor === "string" ? r.topColor : libMatch.topColor,
      nutShape:
        r.nutShape === "hex" || r.nutShape === "circle"
          ? r.nutShape
          : (libMatch.nutShape ?? "circle"),
      switchFunction:
        r.switchFunction === "on-on" || r.switchFunction === "on-off-on"
          ? r.switchFunction
          : (libMatch.switchFunction ?? "on-off-on"),
      topHardwareVisible:
        typeof r.topHardwareVisible === "boolean"
          ? r.topHardwareVisible
          : libMatch.topHardwareVisible,
      faderHandleW:
        typeof r.faderHandleW === "number"
          ? r.faderHandleW
          : libMatch.faderHandleW,
      faderHandleH:
        typeof r.faderHandleH === "number"
          ? r.faderHandleH
          : libMatch.faderHandleH,
      manufacturer:
        typeof r.manufacturer === "string"
          ? r.manufacturer
          : libMatch.manufacturer,
      partNumber:
        typeof r.partNumber === "string" ? r.partNumber : libMatch.partNumber,
      datasheetUrl:
        typeof r.datasheetUrl === "string"
          ? r.datasheetUrl
          : libMatch.datasheetUrl,
      category:
        typeof r.category === "string"
          ? r.category
          : (libMatch.category ??
            inferCategoryForType(str("type", libMatch.type))),
      pinKeepoutW:
        typeof r.pinKeepoutW === "number"
          ? r.pinKeepoutW
          : libMatch.pinKeepoutW,
      pinKeepoutH:
        typeof r.pinKeepoutH === "number"
          ? r.pinKeepoutH
          : libMatch.pinKeepoutH,
      panelThicknessMin:
        typeof r.panelThicknessMin === "number"
          ? r.panelThicknessMin
          : libMatch.panelThicknessMin,
      panelThicknessMax:
        typeof r.panelThicknessMax === "number"
          ? r.panelThicknessMax
          : libMatch.panelThicknessMax,
      verificationStatus:
        r.verificationStatus === "datasheet" ||
        r.verificationStatus === "measured" ||
        r.verificationStatus === "production" ||
        r.verificationStatus === "approximate"
          ? r.verificationStatus
          : (libMatch.verificationStatus ?? "approximate"),
      frontW: typeof r.frontW === "number" ? r.frontW : libMatch.frontW,
      frontH: typeof r.frontH === "number" ? r.frontH : libMatch.frontH,
    };
    if (isFaderLike(comp)) {
      comp.category = "fader";
      comp.nutDiameter = undefined;
      comp.washerDiameter = undefined;
      comp.knobEnabled = false;
      comp.knobDiameter = undefined;
      comp.frontShape = comp.frontShape ?? "slot";
      comp.holeType = comp.holeType ?? "slot";
      comp.faderHandleW =
        comp.faderHandleW ?? Math.max(7, (comp.frontW ?? 9) * 1.15);
      comp.faderHandleH = comp.faderHandleH ?? 5;
    }
    if (comp.type === "tactled") {
      comp.frontDiameter = 5.5;
      comp.nutDiameter = undefined;
      comp.washerDiameter = undefined;
      comp.knobEnabled = false;
      comp.knobDiameter = undefined;
    }
    components.push(
      normalizeLegacyBuiltInGeometry(
        normalizeLegacyJackGeometry(comp),
        r,
        libMatch,
      ),
    );
  }
  function objOrDefault(key, fallback) {
    return obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])
      ? obj[key]
      : fallback;
  }
  const customParts = Array.isArray(obj.customParts)
    ? obj.customParts.map((p) => sanitizePart(p))
    : [];
  const artworks = [];
  if (Array.isArray(obj.artworks)) {
    for (let i = 0; i < obj.artworks.length; i++) {
      const ra = obj.artworks[i];
      if (!ra || typeof ra !== "object" || Array.isArray(ra)) {
        repairs.push(`Artwork ${i}: skipped (not an object).`);
        continue;
      }
      const r = ra;
      if (typeof r.id !== "string" || !r.id) {
        repairs.push(`Artwork ${i}: skipped (missing id).`);
        continue;
      }
      if (
        typeof r.imageDataUrl !== "string" ||
        !r.imageDataUrl.startsWith("data:")
      ) {
        repairs.push(`Artwork ${i} "${r.id}": skipped (invalid imageDataUrl).`);
        continue;
      }
      artworks.push({
        id: r.id,
        name: typeof r.name === "string" ? r.name : "image",
        imageDataUrl: r.imageDataUrl,
        x: typeof r.x === "number" ? r.x : widthMM / 2,
        y: typeof r.y === "number" ? r.y : PANEL_HEIGHT_MM / 2,
        width: typeof r.width === "number" ? r.width : 20,
        height: typeof r.height === "number" ? r.height : 20,
        naturalW: typeof r.naturalW === "number" ? r.naturalW : 100,
        naturalH: typeof r.naturalH === "number" ? r.naturalH : 100,
        rotation: typeof r.rotation === "number" ? r.rotation : 0,
        opacity: typeof r.opacity === "number" ? r.opacity : 1,
        locked: typeof r.locked === "boolean" ? r.locked : false,
        visible: typeof r.visible === "boolean" ? r.visible : true,
        layer: r.layer === "background" ? "background" : "foreground",
        preserveAspectRatio:
          typeof r.preserveAspectRatio === "boolean"
            ? r.preserveAspectRatio
            : true,
        notes: typeof r.notes === "string" ? r.notes : "",
      });
    }
  }
  const textItems = Array.isArray(obj.textItems)
    ? obj.textItems
        .filter((t) => t && typeof t === "object")
        .map((t) => ({
          id: typeof t.id === "string" ? t.id : crypto.randomUUID(),
          text: typeof t.text === "string" ? t.text : "TEXT",
          x: typeof t.x === "number" ? t.x : widthMM / 2,
          y: typeof t.y === "number" ? t.y : PANEL_HEIGHT_MM / 2,
          rotation: typeof t.rotation === "number" ? t.rotation : 0,
          fontSizeMm: typeof t.fontSizeMm === "number" ? t.fontSizeMm : 3,
          fontFamily:
            typeof t.fontFamily === "string"
              ? t.fontFamily
              : TEXT_FONT_OPTIONS[0].value,
          align:
            t.align === "left" || t.align === "right" || t.align === "center"
              ? t.align
              : "center",
          layer: t.layer === "background" ? "background" : "foreground",
          locked: !!t.locked,
          visible: t.visible !== false,
          opacity:
            typeof t.opacity === "number"
              ? Math.max(0, Math.min(1, t.opacity))
              : 1,
        }))
    : [];
  const scaleItems = Array.isArray(obj.scaleItems)
    ? obj.scaleItems
        .filter((sc) => sc && typeof sc === "object")
        .map((sc) => ({
          id: typeof sc.id === "string" ? sc.id : crypto.randomUUID(),
          componentId:
            typeof sc.componentId === "string" ? sc.componentId : null,
          x: typeof sc.x === "number" ? sc.x : widthMM / 2,
          y: typeof sc.y === "number" ? sc.y : PANEL_HEIGHT_MM / 2,
          radius: typeof sc.radius === "number" ? sc.radius : 8,
          startAngle: typeof sc.startAngle === "number" ? sc.startAngle : -135,
          endAngle: typeof sc.endAngle === "number" ? sc.endAngle : 135,
          ticks: typeof sc.ticks === "number" ? sc.ticks : 11,
          majorEvery: typeof sc.majorEvery === "number" ? sc.majorEvery : 2,
          tickLength: typeof sc.tickLength === "number" ? sc.tickLength : 0.85,
          labelMode:
            sc.labelMode === "0-10" || sc.labelMode === "-5+5"
              ? sc.labelMode
              : "none",
          fontSizeMm:
            typeof sc.fontSizeMm === "number"
              ? Math.min(sc.fontSizeMm, 1.4)
              : 1.05,
          layer: sc.layer === "background" ? "background" : "foreground",
          visible: sc.visible !== false,
          locked: !!sc.locked,
          kind: sc.kind === "fader" ? "fader" : "knob",
          side:
            sc.side === "left"
              ? "left"
              : sc.side === "right"
                ? "right"
                : undefined,
        }))
    : [];
  const clipArtworkToPanel =
    typeof obj.clipArtworkToPanel === "boolean" ? obj.clipArtworkToPanel : true;
  const ignoreLockedArtworkClicks =
    typeof obj.ignoreLockedArtworkClicks === "boolean"
      ? obj.ignoreLockedArtworkClicks
      : true;
  const showArtworkInDrillView =
    typeof obj.showArtworkInDrillView === "boolean"
      ? obj.showArtworkInDrillView
      : false;
  const drillArtworkOpacity =
    typeof obj.drillArtworkOpacity === "number"
      ? Math.max(0, Math.min(1, obj.drillArtworkOpacity))
      : 0.3;
  const metaRaw =
    obj.projectMeta &&
    typeof obj.projectMeta === "object" &&
    !Array.isArray(obj.projectMeta)
      ? obj.projectMeta
      : {};
  const nowIso = new Date().toISOString();
  const projectMeta = {
    name:
      typeof metaRaw.name === "string" && metaRaw.name.trim()
        ? metaRaw.name
        : "Untitled panel",
    revision: typeof metaRaw.revision === "string" ? metaRaw.revision : "A",
    author: typeof metaRaw.author === "string" ? metaRaw.author : "",
    notes: typeof metaRaw.notes === "string" ? metaRaw.notes : "",
    createdAt:
      typeof metaRaw.createdAt === "string" ? metaRaw.createdAt : nowIso,
    updatedAt:
      typeof metaRaw.updatedAt === "string" ? metaRaw.updatedAt : nowIso,
  };
  const normalized = {
    projectMeta,
    panel,
    panelOutlineGeometry: Array.isArray(obj.panelOutlineGeometry)
      ? obj.panelOutlineGeometry
      : null,
    components,
    artworks,
    artworkPreviewMode: [
      "composite",
      "copper",
      "mask",
      "silkscreen",
      "material",
    ].includes(obj.artworkPreviewMode)
      ? obj.artworkPreviewMode
      : "composite",
    textItems,
    scaleItems,
    customParts,
    selected: [],
    selectedArtwork: null,
    selectedTexts: [],
    viewMode: ["front", "rear", "drill", "combined"].includes(obj.viewMode)
      ? obj.viewMode
      : "front",
    topHardwareStyle:
      obj.topHardwareStyle === "realistic" || obj.topHardwareStyle === "classic"
        ? obj.topHardwareStyle
        : "classic",
    hardwareRenderMode:
      obj.hardwareRenderMode === "off" ||
      obj.hardwareRenderMode === "classic" ||
      obj.hardwareRenderMode === "realistic" ||
      obj.hardwareRenderMode === "auto"
        ? obj.hardwareRenderMode
        : "auto",
    mobilePerformanceMode:
      typeof obj.mobilePerformanceMode === "boolean"
        ? obj.mobilePerformanceMode
        : true,
    grid: objOrDefault("grid", { size: 1, showMajor: true }),
    pcb: objOrDefault("pcb", {
      enabled: false,
      x: 0,
      y: 9,
      width: widthMM,
      height: 110,
      depthLimit: 50,
    }),
    mountingHoles: normalizeMountingHoleConfig(obj.mountingHoles, widthMM),
    clipArtworkToPanel,
    ignoreLockedArtworkClicks,
    showArtworkInDrillView,
    drillArtworkOpacity,
    layerVisibility: {
      ...defaultLayerVisibility(),
      ...(obj.layerVisibility && typeof obj.layerVisibility === "object"
        ? obj.layerVisibility
        : {}),
    },
    layerOpacity:
      obj.layerOpacity && typeof obj.layerOpacity === "object"
        ? obj.layerOpacity
        : {},
    layerExport:
      obj.layerExport && typeof obj.layerExport === "object"
        ? obj.layerExport
        : {},
    depthSettings: {
      caseDepthLimitMm: 45,
      pcbDistanceBehindPanelMm: 12,
      showPCBPlane: true,
      ...(obj.depthSettings && typeof obj.depthSettings === "object"
        ? obj.depthSettings
        : {}),
    },
    dfmProfile: [
      "generic",
      "cnc_aluminum",
      "laser_acrylic",
      "fr4_panel",
    ].includes(obj.dfmProfile)
      ? obj.dfmProfile
      : "generic",
  };
  return { ok: true, state: normalized, repairs };
}
const PROJECT_FILE_VERSION = 4;
function stripIdsFromComponents(components) {
  return components.map((c) => ({ ...c, id: c.id || crypto.randomUUID() }));
}
