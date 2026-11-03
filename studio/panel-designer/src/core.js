// Core state, reducers, utilities, exports, and secondary panels extracted from index.html.
if (!window.React || !window.ReactDOM) {
  throw new Error(
    "React CDN did not load. Check internet/CDN access or host React locally.",
  );
}
document.documentElement.setAttribute("data-panel-designer-cdn", "loaded");
const {
  useState,
  useReducer,
  useContext,
  createContext,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} = React;
const APP_VERSION = "v451_mobile_canvas_dock_cleanup";
window.__EURORACK_PANEL_DESIGNER_BUILD__ = {
  version: "v451_mobile_canvas_dock_cleanup",
  built: "2026-05-18T20:46:01Z",
  base: "index_v393_fixed_stable_rebuild.html",
  precompiled: true,
  browserPrompts: 0,
  browserConfirms: 0,
  minified: true,
};
document.documentElement.setAttribute(
  "data-panel-designer-build",
  window.__EURORACK_PANEL_DESIGNER_BUILD__.version,
);
const HP_TO_MM = 5.08;
const PANEL_HEIGHT_MM = 128.5;
const MOUNTING_HOLE_TOP_Y_MM = 3.0;
const MOUNTING_HOLE_BOTTOM_Y_MM = PANEL_HEIGHT_MM - 3.0;
const MOUNTING_HOLE_DIAMETER_MM = 3.2;
const MOUNTING_HOLE_KEEPOUT_R_MM = 1.0;
const MAX_UNDO = 50;
const STANDARD_HP = [2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20];
const DEFAULT_EXPORT_OPTIONS = {
  drillOnly: false,
  labels: true,
  rearKeepout: false,
  rearBody: false,
  centerMarks: true,
  mountingKeepouts: true,
  includeArtwork: true,
  svgLayeredPanelBase: true,
  svgLayeredComponents: true,
  svgLayeredHoles: true,
  svgLayeredArtwork: true,
  svgLayeredText: true,
  pngCombined: true,
  pngSeparateComponents: false,
  pngSeparateHoles: false,
  pngSeparateArtwork: false,
  pngSeparateText: false,
  pngTransparentBg: true,
  pngDpi: 300,
  psdPanelBase: true,
  psdComponents: true,
  psdHoles: true,
  psdArtwork: true,
  psdText: true,
  psdDpi: 300,
  kicadPanelOutline: true,
  kicadMountingHoles: true,
  kicadComponentHoles: true,
  kicadRectCutouts: true,
  kicadArtwork: true,
  kicadVisualOutlines: false,
  kicadKeepoutHints: false,
  kicadRefs: false,
  kicadTextLabels: false,
  kicadOrigin: "top-left",
};
function defaultSnapSettings() {
  return {
    grid: true,
    panelEdges: true,
    pcbEdges: true,
    componentCenters: true,
    componentBodyEdges: false,
    distance: 1.0,
  };
}
const DFM_PROFILES = {
  generic: {
    key: "generic",
    name: "Generic CNC / prototype",
    minHole: 2.5,
    minSlot: 2.5,
    minEdge: 1.5,
    minHoleToHole: 1.5,
    minText: 1.2,
  },
  cnc_aluminum: {
    key: "cnc_aluminum",
    name: "CNC aluminum panel",
    minHole: 2.5,
    minSlot: 2.5,
    minEdge: 2.0,
    minHoleToHole: 2.0,
    minText: 1.5,
  },
  laser_acrylic: {
    key: "laser_acrylic",
    name: "Laser acrylic",
    minHole: 2.0,
    minSlot: 2.0,
    minEdge: 2.0,
    minHoleToHole: 2.0,
    minText: 1.8,
  },
  fr4_panel: {
    key: "fr4_panel",
    name: "FR4 / PCB front panel",
    minHole: 0.8,
    minSlot: 1.0,
    minEdge: 0.6,
    minHoleToHole: 0.6,
    minText: 0.8,
  },
};
function defaultLayerVisibility() {
  return {
    grid: true,
    panelOutline: true,
    mountingHoles: true,
    artwork: true,
    text: true,
    labels: true,
    componentHoles: true,
    frontShapes: true,
    topHardware: true,
    rearBodies: true,
    rearKeepouts: true,
    pcb: true,
  };
}
function inferCategoryForType(type) {
  if (
    type === "pot9mm" ||
    type === "pot16mm" ||
    type === "pot9mm_ra" ||
    type === "trimmer6mm"
  )
    return "potentiometer";
  if (type === "jack" || type === "slimjack") return "jack";
  if (
    type === "toggle" ||
    type === "slideSwitchMini" ||
    type === "tact6mm" ||
    type === "momentary12" ||
    type === "tactled"
  )
    return "switch";
  if (type === "led3mm") return "led";
  if (type === "encoder") return "encoder";
  if (
    type === "fader20" ||
    type === "fader20led" ||
    type === "fader35" ||
    type === "fader45"
  )
    return "fader";
  if (type === "dip8socket") return "custom";
  return "custom";
}
function isSamePartType(a, b) {
  return (
    a.type === b.type ||
    (!!a.category &&
      !!b.category &&
      a.category === b.category &&
      a.name === b.name)
  );
}
const REF_PREFIX_BY_TYPE = {
  pot9mm: "RV",
  pot16mm: "RV",
  pot9mm_ra: "RV",
  encoder: "ENC",
  jack: "J",
  slimjack: "J",
  toggle: "SW",
  toggleSpdt: "SW",
  toggleSplash: "SW",
  slideSwitchMini: "SW",
  slideSwitch8pos: "SW",
  tact6mm: "SW",
  momentary12: "SW",
  tactled: "SW",
  led3mm: "LED",
  fader20: "FDR",
  fader20led: "FDR",
  fader35: "FDR",
  fader45: "FDR",
  trimmer6mm: "TR",
  custom: "H",
  customrect: "CUT",
};
function refPrefixForType(type) {
  return REF_PREFIX_BY_TYPE[type] ?? "X";
}
function nextRefForComponent(type, components) {
  const prefix = refPrefixForType(type);
  const nums = components
    .map((c) => c.ref || "")
    .filter((r) => r.startsWith(prefix))
    .map((r) => parseInt(r.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n));
  return `${prefix}${nums.length ? Math.max(...nums) + 1 : 1}`;
}
function renumberRefs(components) {
  const counts = {};
  return components.map((c) => {
    const prefix = refPrefixForType(c.type);
    counts[prefix] = (counts[prefix] || 0) + 1;
    return { ...c, ref: `${prefix}${counts[prefix]}` };
  });
}
function defaultAttachedLabelFor(c) {
  const offsetY = getFrontBottomOffset(c) + 4.0;
  return {
    id: crypto.randomUUID(),
    text: c.label && c.label !== c.name ? c.label : c.ref || c.name,
    x: c.x,
    y: c.y + offsetY,
    rotation: 0,
    fontSizeMm: 2.2,
    fontFamily: TEXT_FONT_OPTIONS[0].value,
    align: "center",
    layer: "foreground",
    locked: false,
    visible: true,
    opacity: 1,
    componentId: c.id,
    offsetX: 0,
    offsetY,
  };
}
function verificationLabel(v) {
  if (v === "production") return "Production verified";
  if (v === "measured") return "Measured";
  if (v === "datasheet") return "From datasheet";
  return "Approximate";
}
function verificationColor(v) {
  if (v === "production") return "#55dd88";
  if (v === "measured") return "#72b7ff";
  if (v === "datasheet") return "#ffd166";
  return "#ff9966";
}
function isPartVerified(c) {
  return (
    c.verificationStatus === "datasheet" ||
    c.verificationStatus === "measured" ||
    c.verificationStatus === "production"
  );
}
function shortPartName(def) {
  const t = def.type;
  if (t === "pot9mm") return "9mm Pot";
  if (t === "pot16mm") return "16mm Pot";
  if (t === "pot9mm_ra") return "9mm RA Pot";
  if (t === "trimmer6mm") return "Trim Pot 9mm";
  if (t === "jack") return "6mm Jack";
  if (t === "slimjack") return "1/4 Slim Jack";
  if (t === "toggle") return "DPDT Toggle";
  if (t === "toggleSpdt") return "SPDT Toggle";
  if (t === "toggleSplash") return "T88B52 Toggle";
  if (t === "slideSwitchMini") return "DPDT Slide";
  if (t === "slideSwitch8pos") return "SS-18F08";
  if (t === "subMiniSwitch") return "Sub-mini Switch";
  if (t === "rotary8pos") return "8-pos Rotary";
  if (t === "led3mm") return "3mm CVD LED";
  if (t === "tactled") return "LED Button 7.5";
  if (t === "tact6mm") return "6mm Tact";
  if (t === "momentary12") return "PV0 Button 12mm";
  if (t === "encoder") return "Encoder EC12";
  if (t === "fader20led") return "LED Fader 20mm";
  if (t === "fader20") return "Fader 20mm";
  // Keep the legacy type key for saved-project compatibility.
  if (t === "fader35") return "RA3043F Fader 30mm";
  if (t === "fader45") return "RA4543F Fader 45mm";
  if (t === "customrect") return "Rect Cutout";
  if (t === "custom") return "Custom Hole";
  return def.name
    .replace(/^Alpha\s+/i, "")
    .replace(/^ALPS\s+/i, "")
    .replace(/^Low Profile\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
function defaultLabelForComponentDef(_def) {
  return "";
}
function partTooltip(def) {
  const status = verificationLabel(def.verificationStatus);
  const hole =
    def.holeType === "slot"
      ? `${def.holeDiameter} × ${def.slotLength ?? def.holeDiameter} mm slot`
      : def.holeType === "rect"
        ? `${def.holeW ?? def.frontW ?? def.holeDiameter} × ${def.holeH ?? def.frontH ?? def.holeDiameter} mm cut`
        : `Ø ${def.holeDiameter} mm hole`;
  return [
    def.name,
    def.manufacturer || "",
    def.partNumber || "",
    hole,
    `rear ${def.rearBodyW} × ${def.rearBodyH} mm · depth ${def.rearDepth} mm`,
    status,
    def.verification || "",
  ]
    .filter(Boolean)
    .join("\n");
}
function panelWidthMM(panel) {
  return panel.widthHP * HP_TO_MM;
}
function snapToGrid(val, grid) {
  return Math.round(val / grid) * grid;
}
function mountingHoleRailY(side) {
  return side === "top" ? MOUNTING_HOLE_TOP_Y_MM : MOUNTING_HOLE_BOTTOM_Y_MM;
}
function mountingHoleSide(h) {
  const id = String(h.id || "").toLowerCase();
  if (id.includes("-b") || id.endsWith("b") || id.includes("bottom"))
    return "bottom";
  if (id.includes("-t") || id.endsWith("t") || id.includes("top")) return "top";
  return h.y > PANEL_HEIGHT_MM / 2 ? "bottom" : "top";
}
function normalizeMountingHoleRail(h) {
  const side = mountingHoleSide(h);
  return { ...h, y: mountingHoleRailY(side) };
}
function automaticMountingHolePreset(widthMM, holeShape = "oval") {
  const count = widthMM <= 10 * HP_TO_MM + 0.01 ? "two" : "four";
  return holeShape === "oval" ? `${count}Oval` : count;
}
function mountingHolesForPreset(widthMM, preset = "four") {
  const xL = 7.5;
  const resolvedPreset =
    preset === "auto" || preset === "autoOval"
      ? automaticMountingHolePreset(
          widthMM,
          preset === "autoOval" ? "oval" : "circle",
        )
      : preset;
  const horizontalPitchCount = Math.max(
    1,
    Math.round((widthMM - xL * 2) / HP_TO_MM),
  );
  const xR = xL + horizontalPitchCount * HP_TO_MM;
  const yT = mountingHoleRailY("top");
  const yB = mountingHoleRailY("bottom");
  if (resolvedPreset === "none") return [];
  if (resolvedPreset === "two" || resolvedPreset === "twoOval") {
    return [
      { id: "mh-t", x: xL, y: yT },
      { id: "mh-b", x: xL, y: yB },
    ];
  }
  return [
    { id: "mh-tl", x: xL, y: yT },
    { id: "mh-tr", x: xR, y: yT },
    { id: "mh-bl", x: xL, y: yB },
    { id: "mh-br", x: xR, y: yB },
  ];
}
function defaultMountingHoles(widthMM) {
  return mountingHolesForPreset(widthMM, "four");
}
function defaultMountingHoleConfig(widthMM) {
  return {
    enabled: true,
    showKeepouts: true,
    keepoutRadius: 1.0,
    holeShape: "oval",
    ovalLength: 4.8,
    preset: "autoOval",
    holes: mountingHolesForPreset(widthMM, "autoOval"),
  };
}
function normalizeMountingHoleConfig(raw, widthMM) {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const preset =
    obj.preset === "auto" ||
    obj.preset === "autoOval" ||
    obj.preset === "two" ||
    obj.preset === "twoOval" ||
    obj.preset === "fourOval" ||
    obj.preset === "none" ||
    obj.preset === "custom" ||
    obj.preset === "four"
      ? obj.preset
      : "autoOval";
  const storedHoles = Array.isArray(obj.holes)
    ? obj.holes
        .filter((h) => h && typeof h === "object")
        .map((h, i) =>
          normalizeMountingHoleRail({
            id: typeof h.id === "string" && h.id ? h.id : `mh-${i + 1}`,
            x: typeof h.x === "number" ? h.x : widthMM / 2,
            y: typeof h.y === "number" ? h.y : PANEL_HEIGHT_MM / 2,
          }),
        )
    : [];
  const holes =
    preset === "custom" ? storedHoles : mountingHolesForPreset(widthMM, preset);
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : true,
    showKeepouts:
      typeof obj.showKeepouts === "boolean" ? obj.showKeepouts : true,
    keepoutRadius:
      typeof obj.keepoutRadius === "number"
        ? Math.max(0, obj.keepoutRadius)
        : 1.0,
    holeShape:
      obj.holeShape === "oval" ||
      preset === "autoOval" ||
      preset === "fourOval" ||
      preset === "twoOval"
        ? "oval"
        : "circle",
    ovalLength:
      typeof obj.ovalLength === "number"
        ? Math.max(MOUNTING_HOLE_DIAMETER_MM, obj.ovalLength)
        : 4.8,
    preset,
    holes,
  };
}
/* Front-shape / DIP-8 geometry moved to src/geometry/frontShapeGeometry.js */
function pcbHeightWarnings(pcb) {
  if (!pcb.enabled) return [];
  const out = [];
  const h = pcb.height;
  const top = pcb.y;
  const bottom = pcb.y + pcb.height;
  if (top < 0 || bottom > PANEL_HEIGHT_MM) {
    out.push({
      ids: ["__pcb__"],
      message: `PCB outline exceeds panel height bounds: y=${top.toFixed(1)}…${bottom.toFixed(1)} mm`,
      severity: "error",
      tone: "red",
    });
  }
  if (h > 113) {
    out.push({
      ids: ["__pcb__"],
      message: `PCB outline height ${h.toFixed(1)} mm exceeds 113 mm practical maximum`,
      severity: "error",
      tone: "red",
    });
  } else if (h > 110) {
    out.push({
      ids: ["__pcb__"],
      message: `PCB outline height ${h.toFixed(1)} mm is very tall (110–113 mm caution range)`,
      severity: "warn",
      tone: "orange",
    });
  } else if (h >= 108) {
    out.push({
      ids: ["__pcb__"],
      message: `PCB outline height ${h.toFixed(1)} mm is near the practical limit (108–110 mm)`,
      severity: "warn",
      tone: "yellow",
    });
  }
  return out;
}
function mergeBroadAABB(a, b) {
  return {
    x1: Math.min(a.x1, b.x1),
    x2: Math.max(a.x2, b.x2),
    y1: Math.min(a.y1, b.y1),
    y2: Math.max(a.y2, b.y2),
  };
}
function inflateBroadAABB(a, amount) {
  return {
    x1: a.x1 - amount,
    x2: a.x2 + amount,
    y1: a.y1 - amount,
    y2: a.y2 + amount,
  };
}
function componentWarningBroadAABB(c, spacingInflate) {
  let bounds = obbEdgeExtents(makeHoleOBB(c));
  bounds = mergeBroadAABB(bounds, getFrontExtents(c));
  if (c.rearBodyW > 0 && c.rearBodyH > 0) {
    bounds = mergeBroadAABB(bounds, obbEdgeExtents(makeBodyOBB(c)));
  }
  if (c.keepoutW > 0 && c.keepoutH > 0) {
    bounds = mergeBroadAABB(bounds, obbEdgeExtents(makeKeepoutOBB(c)));
  }
  const ergoD = ergonomicDiameter(c);
  if (ergoD > 0) {
    const r = ergoD / 2;
    bounds = mergeBroadAABB(bounds, {
      x1: c.x - r,
      x2: c.x + r,
      y1: c.y - r,
      y2: c.y + r,
    });
  }
  return inflateBroadAABB(bounds, spacingInflate);
}
function buildWarningPairCandidateMap(components) {
  const byStart = new Map();
  const n = components.length;
  if (n < 2) return byStart;
  if (n <= 40) {
    for (let i = 0; i < n; i++) {
      const js = [];
      for (let j = i + 1; j < n; j++) js.push(j);
      if (js.length) byStart.set(i, js);
    }
    return byStart;
  }
  const maxSpacing = Math.max(
    2,
    ...components.map((c) => Number(c.minSpacing) || 0),
  );
  const bounds = components.map((c) =>
    componentWarningBroadAABB(c, maxSpacing),
  );
  const maxSpan = Math.max(
    ...bounds.map((b) => Math.max(b.x2 - b.x1, b.y2 - b.y1)),
    1,
  );
  const cellSize = Math.max(16, Math.min(32, maxSpan));
  const buckets = new Map();
  const seenPairs = new Set();
  for (let i = 0; i < n; i++) {
    const b = bounds[i];
    const ix1 = Math.floor(b.x1 / cellSize);
    const ix2 = Math.floor(b.x2 / cellSize);
    const iy1 = Math.floor(b.y1 / cellSize);
    const iy2 = Math.floor(b.y2 / cellSize);
    for (let ix = ix1; ix <= ix2; ix++) {
      for (let iy = iy1; iy <= iy2; iy++) {
        const key = `${ix},${iy}`;
        const bucket = buckets.get(key);
        if (bucket) {
          for (const prev of bucket) {
            const a = Math.min(prev, i);
            const bIdx = Math.max(prev, i);
            const pairKey = `${a}:${bIdx}`;
            if (seenPairs.has(pairKey)) continue;
            seenPairs.add(pairKey);
            const list = byStart.get(a);
            if (list) list.push(bIdx);
            else byStart.set(a, [bIdx]);
          }
          bucket.push(i);
        } else {
          buckets.set(key, [i]);
        }
      }
    }
  }
  for (const list of byStart.values()) list.sort((a, b) => a - b);
  return byStart;
}
function artworkDfmWarnings(artworks, widthMM) {
  const warnings = [];
  for (const artwork of artworks || []) {
    if (!artwork.visible) continue;
    const left = artwork.x - artwork.width / 2;
    const right = artwork.x + artwork.width / 2;
    const top = artwork.y - artwork.height / 2;
    const bottom = artwork.y + artwork.height / 2;
    if (
      left < -0.01 ||
      right > widthMM + 0.01 ||
      top < -0.01 ||
      bottom > PANEL_HEIGHT_MM + 0.01
    )
      warnings.push({
        ids: [],
        message: `Artwork "${artwork.name || "image"}" extends outside the panel`,
        severity: "warn",
      });
    if (!String(artwork.imageDataUrl || "").startsWith("data:image/svg+xml"))
      continue;
    try {
      const comma = artwork.imageDataUrl.indexOf(",");
      const svgText = artwork.imageDataUrl.slice(0, comma).includes(";base64")
        ? atob(artwork.imageDataUrl.slice(comma + 1))
        : decodeURIComponent(artwork.imageDataUrl.slice(comma + 1));
      const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
      const thinSilk = [
        ...doc.querySelectorAll('[data-kicad-layer="F.SilkS"]'),
      ].some(
        (element) =>
          Number(element.getAttribute("stroke-width")) > 0 &&
          Number(element.getAttribute("stroke-width")) < 0.15,
      );
      const smallText = [
        ...doc.querySelectorAll('text[data-kicad-layer="F.SilkS"]'),
      ].some((element) => Number(element.getAttribute("font-size")) < 0.8);
      const thinMask = [
        ...doc.querySelectorAll('[data-kicad-layer="F.Mask"]'),
      ].some(
        (element) =>
          Number(element.getAttribute("stroke-width")) > 0 &&
          Number(element.getAttribute("stroke-width")) < 0.1,
      );
      const viewBox = String(doc.documentElement.getAttribute("viewBox") || "")
        .split(/[ ,]+/)
        .map(Number);
      const copperPoints = [];
      for (const element of doc.querySelectorAll('[data-kicad-layer="F.Cu"]')) {
        if (element.tagName === "rect") {
          const x = Number(element.getAttribute("x"));
          const y = Number(element.getAttribute("y"));
          const width = Number(element.getAttribute("width"));
          const height = Number(element.getAttribute("height"));
          copperPoints.push([x, y], [x + width, y + height]);
        } else if (element.tagName === "circle") {
          const x = Number(element.getAttribute("cx"));
          const y = Number(element.getAttribute("cy"));
          const radius = Number(element.getAttribute("r"));
          copperPoints.push([x - radius, y - radius], [x + radius, y + radius]);
        } else {
          const values = String(
            element.getAttribute("d") || element.getAttribute("points") || "",
          )
            .match(/-?(?:\d+\.?\d*|\.\d+)/g)
            ?.map(Number);
          for (let index = 0; index + 1 < (values?.length || 0); index += 2)
            copperPoints.push([values[index], values[index + 1]]);
        }
      }
      const copperAtEdge =
        viewBox.length === 4 &&
        copperPoints.some(
          ([x, y]) =>
            x - viewBox[0] < 0.25 ||
            y - viewBox[1] < 0.25 ||
            viewBox[0] + viewBox[2] - x < 0.25 ||
            viewBox[1] + viewBox[3] - y < 0.25,
        );
      if (thinSilk)
        warnings.push({
          ids: [],
          message: `Artwork "${artwork.name || "image"}" has silkscreen lines below 0.15 mm`,
          severity: "warn",
        });
      if (smallText)
        warnings.push({
          ids: [],
          message: `Artwork "${artwork.name || "image"}" has silkscreen text below 0.8 mm`,
          severity: "warn",
        });
      if (thinMask)
        warnings.push({
          ids: [],
          message: `Artwork "${artwork.name || "image"}" has mask features below 0.10 mm`,
          severity: "warn",
        });
      if (copperAtEdge)
        warnings.push({
          ids: [],
          message: `Artwork "${artwork.name || "image"}" has copper within 0.25 mm of the panel edge`,
          severity: "warn",
        });
    } catch {}
  }
  return warnings;
}
function computeWarnings(
  components,
  widthMM,
  mountingHoles,
  pcb,
  artworks = [],
) {
  const warnings = [];
  warnings.push(...artworkDfmWarnings(artworks, widthMM));
  warnings.push(...pcbHeightWarnings(pcb));
  const pairCandidatesByStart = buildWarningPairCandidateMap(components);
  for (let i = 0; i < components.length; i++) {
    const a = components[i];
    const holeExt = obbEdgeExtents(makeHoleOBB(a));
    if (holeExt.x1 < 0)
      warnings.push({
        ids: [a.id],
        message: `"${a.label || a.name}" hole exceeds left panel edge`,
        severity: "error",
      });
    if (holeExt.x2 > widthMM)
      warnings.push({
        ids: [a.id],
        message: `"${a.label || a.name}" hole exceeds right panel edge`,
        severity: "error",
      });
    if (holeExt.y1 < 0)
      warnings.push({
        ids: [a.id],
        message: `"${a.label || a.name}" hole exceeds top panel edge`,
        severity: "error",
      });
    if (holeExt.y2 > PANEL_HEIGHT_MM)
      warnings.push({
        ids: [a.id],
        message: `"${a.label || a.name}" hole exceeds bottom panel edge`,
        severity: "error",
      });
    const aName = a.label || a.name;
    const fe = getFrontExtents(a);
    if (fe.x1 < 0)
      warnings.push({
        ids: [a.id],
        message: `"${aName}" front shape exceeds/violates left panel edge`,
        severity: "warn",
      });
    if (fe.x2 > widthMM)
      warnings.push({
        ids: [a.id],
        message: `"${aName}" front shape exceeds/violates right panel edge`,
        severity: "warn",
      });
    if (fe.y1 < 0)
      warnings.push({
        ids: [a.id],
        message: `"${aName}" front shape exceeds/violates top panel edge`,
        severity: "warn",
      });
    if (fe.y2 > PANEL_HEIGHT_MM)
      warnings.push({
        ids: [a.id],
        message: `"${aName}" front shape exceeds/violates bottom panel edge`,
        severity: "warn",
      });
    if (a.rearBodyW > 0) {
      const be = obbEdgeExtents(makeBodyOBB(a));
      if (be.x1 < 0)
        warnings.push({
          ids: [a.id],
          message: `"${aName}" rear body exceeds left panel edge`,
          severity: "error",
        });
      if (be.x2 > widthMM)
        warnings.push({
          ids: [a.id],
          message: `"${aName}" rear body exceeds right panel edge`,
          severity: "error",
        });
      if (be.y1 < 0)
        warnings.push({
          ids: [a.id],
          message: `"${aName}" rear body exceeds top panel edge`,
          severity: "error",
        });
      if (be.y2 > PANEL_HEIGHT_MM)
        warnings.push({
          ids: [a.id],
          message: `"${aName}" rear body exceeds bottom panel edge`,
          severity: "error",
        });
    }
    if (a.keepoutW > 0) {
      const ke = obbEdgeExtents(makeKeepoutOBB(a));
      if (ke.x1 < 0)
        warnings.push({
          ids: [a.id],
          message: `"${aName}" rear keepout exceeds left panel edge`,
          severity: "warn",
        });
      if (ke.x2 > widthMM)
        warnings.push({
          ids: [a.id],
          message: `"${aName}" rear keepout exceeds right panel edge`,
          severity: "warn",
        });
      if (ke.y1 < 0)
        warnings.push({
          ids: [a.id],
          message: `"${aName}" rear keepout exceeds top panel edge`,
          severity: "warn",
        });
      if (ke.y2 > PANEL_HEIGHT_MM)
        warnings.push({
          ids: [a.id],
          message: `"${aName}" rear keepout exceeds bottom panel edge`,
          severity: "warn",
        });
    }
    if (mountingHoles.enabled) {
      for (const mh of mountingHoles.holes) {
        const dist = Math.hypot(a.x - mh.x, a.y - mh.y);
        const approxHoleRadius = Math.max(
          holeExt.x2 - a.x,
          a.x - holeExt.x1,
          holeExt.y2 - a.y,
          a.y - holeExt.y1,
        );
        const minDist =
          (mountingHoles.keepoutRadius ?? MOUNTING_HOLE_KEEPOUT_R_MM) +
          approxHoleRadius;
        if (dist < minDist) {
          warnings.push({
            ids: [a.id],
            message: `"${a.label || a.name}" too close to mounting hole (${(minDist - dist).toFixed(1)}mm overlap)`,
            severity: "error",
          });
        }
      }
    }
    for (const j of pairCandidatesByStart.get(i) ?? []) {
      const b = components[j];
      const nameA = `"${a.label || a.name}"`;
      const nameB = `"${b.label || b.name}"`;
      const koA = makeKeepoutOBB(a);
      const koB = makeKeepoutOBB(b);
      if (obbOverlap(koA, koB)) {
        const overlapX = a.keepoutW / 2 + b.keepoutW / 2 - Math.abs(a.x - b.x);
        const overlapY = a.keepoutH / 2 + b.keepoutH / 2 - Math.abs(a.y - b.y);
        const ovlp = Math.max(0, Math.min(overlapX, overlapY)).toFixed(1);
        warnings.push({
          ids: [a.id, b.id],
          message: `${nameA} and ${nameB} rear keepout zones overlap by ~${ovlp}mm`,
          severity: "error",
        });
      }
      if (a.rearBodyW > 0 && b.rearBodyW > 0) {
        const bdA = makeBodyOBB(a);
        const bdB = makeBodyOBB(b);
        if (obbOverlap(bdA, bdB)) {
          warnings.push({
            ids: [a.id, b.id],
            message: `${nameA} and ${nameB} rear bodies overlap`,
            severity: "error",
          });
        }
      }
      let edgeGap = frontClearance(a, b);
      if (getFrontShape(a) === "circle" && getFrontShape(b) === "circle") {
        const frontOverlap = -edgeGap;
        if (frontOverlap > 0) {
          warnings.push({
            ids: [a.id, b.id],
            message: `${nameA} and ${nameB} front diameters overlap by ${frontOverlap.toFixed(1)}mm`,
            severity: "error",
          });
        }
      } else if (obbOverlap(getFrontOBB(a), getFrontOBB(b))) {
        warnings.push({
          ids: [a.id, b.id],
          message: `${nameA} and ${nameB} front shapes overlap`,
          severity: "error",
        });
      }
      const minNeeded = Math.max(a.minSpacing, b.minSpacing);
      if (edgeGap >= 0 && edgeGap < minNeeded) {
        warnings.push({
          ids: [a.id, b.id],
          message: `${nameA} and ${nameB} closer than recommended spacing (${edgeGap.toFixed(1)}mm gap, ${minNeeded}mm recommended)`,
          severity: "warn",
        });
      }
      const ergoA = ergonomicDiameter(a);
      const ergoB = ergonomicDiameter(b);
      if (ergoA > 0 && ergoB > 0) {
        const knobOvlp = circleOverlap(
          a.x,
          a.y,
          ergoA / 2,
          b.x,
          b.y,
          ergoB / 2,
        );
        if (knobOvlp > 0) {
          const label =
            a.ergonomicEnabled || b.ergonomicEnabled
              ? "ergonomic/knob zones"
              : "knob diameters";
          warnings.push({
            ids: [a.id, b.id],
            message: `${nameA} and ${nameB} ${label} overlap by ${knobOvlp.toFixed(1)}mm`,
            severity: "warn",
          });
        }
      }
    }
  }
  if (pcb.enabled) {
    for (const c of components) {
      const inBounds =
        c.x - c.rearBodyW / 2 >= pcb.x &&
        c.x + c.rearBodyW / 2 <= pcb.x + pcb.width &&
        c.y - c.rearBodyH / 2 >= pcb.y &&
        c.y + c.rearBodyH / 2 <= pcb.y + pcb.height;
      if (!inBounds && c.rearBodyW > 0) {
        warnings.push({
          ids: [c.id],
          message: `"${c.label || c.name}" rear body is outside PCB bounds`,
          severity: "warn",
        });
      }
      if (c.rearDepth > pcb.depthLimit) {
        warnings.push({
          ids: [c.id],
          message: `"${c.label || c.name}" rear depth ${c.rearDepth}mm exceeds PCB depth limit ${pcb.depthLimit}mm`,
          severity: "warn",
        });
      }
    }
  }
  return warnings;
}
function suggestClearanceResolution(
  components,
  widthMM,
  mountingHoles,
  pcb,
  ids,
) {
  const pair = (ids || [])
    .map((id) => components.find((component) => component.id === id))
    .filter(Boolean)
    .slice(0, 2);
  if (pair.length !== 2) return null;
  const [anchor, moving] = pair;
  function envelope(component) {
    const boxes = [getFrontExtents(component)];
    if (component.rearBodyW > 0)
      boxes.push(obbEdgeExtents(makeBodyOBB(component)));
    if (component.keepoutW > 0)
      boxes.push(obbEdgeExtents(makeKeepoutOBB(component)));
    return {
      x1: Math.min(...boxes.map((box) => box.x1)),
      x2: Math.max(...boxes.map((box) => box.x2)),
      y1: Math.min(...boxes.map((box) => box.y1)),
      y2: Math.max(...boxes.map((box) => box.y2)),
    };
  }
  function warningWeight(list) {
    return list.reduce(
      (sum, warning) => sum + (warning.severity === "error" ? 1000 : 100),
      0,
    );
  }
  const anchorBox = envelope(anchor);
  const movingBox = envelope(moving);
  const movingHalfW = Math.max(
    moving.x - movingBox.x1,
    movingBox.x2 - moving.x,
  );
  const movingHalfH = Math.max(
    moving.y - movingBox.y1,
    movingBox.y2 - moving.y,
  );
  const anchorHalfW = Math.max(
    anchor.x - anchorBox.x1,
    anchorBox.x2 - anchor.x,
  );
  const anchorHalfH = Math.max(
    anchor.y - anchorBox.y1,
    anchorBox.y2 - anchor.y,
  );
  const minGap = Math.max(anchor.minSpacing || 0, moving.minSpacing || 0, 1);
  const baselineWarnings = computeWarnings(
    components,
    widthMM,
    mountingHoles,
    pcb,
  );
  const baselineWeight = warningWeight(baselineWarnings);
  const candidates = [];
  for (const extra of [0, 1, 2, 4, 7, 11, 16]) {
    const gap = minGap + extra;
    candidates.push(
      { x: anchor.x + anchorHalfW + movingHalfW + gap, y: moving.y },
      { x: anchor.x - anchorHalfW - movingHalfW - gap, y: moving.y },
      { x: moving.x, y: anchor.y + anchorHalfH + movingHalfH + gap },
      { x: moving.x, y: anchor.y - anchorHalfH - movingHalfH - gap },
    );
  }
  let best = null;
  for (const candidate of candidates) {
    const x = Math.min(
      widthMM - movingHalfW,
      Math.max(movingHalfW, candidate.x),
    );
    const y = Math.min(
      PANEL_HEIGHT_MM - movingHalfH,
      Math.max(movingHalfH, candidate.y),
    );
    const nextComponents = components.map((component) =>
      component.id === moving.id ? { ...component, x, y } : component,
    );
    const nextWarnings = computeWarnings(
      nextComponents,
      widthMM,
      mountingHoles,
      pcb,
    );
    const warningScore = warningWeight(nextWarnings);
    const movement = Math.hypot(x - moving.x, y - moving.y);
    const score = warningScore * 1000 + movement;
    if (!best || score < best.score)
      best = { x, y, score, warningScore, movement, warnings: nextWarnings };
  }
  if (!best || best.warningScore >= baselineWeight) return null;
  return {
    id: moving.id,
    x: best.x,
    y: best.y,
    dx: best.x - moving.x,
    dy: best.y - moving.y,
    resolvedWarnings: baselineWarnings.length - best.warnings.length,
  };
}
function makeInitialState() {
  const panel = { widthHP: 8, customHP: false };
  const widthMM = panelWidthMM(panel);
  return {
    projectMeta: {
      name: "Untitled panel",
      revision: "A",
      author: "",
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    panel,
    panelOutlineGeometry: null,
    components: [],
    artworks: [],
    artworkPreviewMode: "composite",
    textItems: [],
    scaleItems: [],
    customParts: [],
    selected: [],
    selectedArtwork: null,
    selectedTexts: [],
    viewMode: "front",
    topHardwareStyle: "classic",
    hardwareRenderMode: "auto",
    mobilePerformanceMode: true,
    grid: { size: 1, showMajor: true },
    pcb: {
      enabled: false,
      x: 0,
      y: 9,
      width: widthMM,
      height: 110,
      depthLimit: 50,
    },
    mountingHoles: defaultMountingHoleConfig(widthMM),
    clipArtworkToPanel: true,
    ignoreLockedArtworkClicks: true,
    showArtworkInDrillView: false,
    drillArtworkOpacity: 0.3,
    layerVisibility: defaultLayerVisibility(),
    layerOpacity: {},
    layerExport: {},
    depthSettings: {
      caseDepthLimitMm: 45,
      pcbDistanceBehindPanelMm: 12,
      showPCBPlane: true,
    },
    dfmProfile: "generic",
    history: [],
    future: [],
  };
}
function snapshot(s) {
  const { history: _h, future: _f, ...rest } = s;
  return rest;
}
function withHistory(prev, next) {
  const history = [...prev.history.slice(-MAX_UNDO + 1), snapshot(prev)];
  return { ...next, history, future: [] };
}
function layerVisibilityForViewMode(prev, mode) {
  if (mode === "front") {
    return {
      ...prev,
      componentHoles: true,
      frontShapes: true,
      topHardware: true,
      rearBodies: false,
      rearKeepouts: false,
      labels: true,
    };
  }
  if (mode === "rear") {
    return {
      ...prev,
      componentHoles: true,
      frontShapes: false,
      topHardware: false,
      rearBodies: true,
      rearKeepouts: true,
      pcb: true,
      labels: true,
    };
  }
  if (mode === "drill") {
    return {
      ...prev,
      componentHoles: true,
      frontShapes: false,
      topHardware: false,
      rearBodies: false,
      rearKeepouts: false,
      pcb: false,
      labels: false,
      artwork: false,
      text: false,
    };
  }
  return {
    ...prev,
    componentHoles: true,
    frontShapes: true,
    topHardware: true,
    rearBodies: true,
    rearKeepouts: true,
    labels: true,
  };
}
/* GridLayer moved to Canvas.js */

/* HPGuideLayer moved to Canvas.js */

/* MountingHolesLayer moved to Canvas.js */

/* PCBLayer moved to Canvas.js */

/* ArtworksLayer moved to Canvas.js */
/* TopHardwareLayer moved to Canvas.js */

/* TextLayer moved to Canvas.js */
/* ComponentsLayer moved to Canvas.js */

/* RearBodySnapFootprintLayer moved to Canvas.js */

/* DistanceGuidesLayer moved to Canvas.js */

/* RulerLayer moved to Canvas.js */
/* ModeQuickSwitch moved to MobileDock.js */

/* CanvasLayerPanel moved to Canvas.js */

/* InspectorRail moved to Canvas.js */
/* SelectionMeasureFloat moved to Canvas.js */

/* CanvasMiniMap moved to Canvas.js */

/* SelectionHandles moved to Canvas.js */

/* MobileSafeZonesLayer moved to Canvas.js */

/* SVGCanvas moved to Canvas.js */
/* MobileQuickAdd moved to MobileDock.js */
/* ComponentLibraryPanel moved to LeftSidebarPanels.js */ /* TextPanel moved to LeftSidebarPanels.js */ /* ArtworkPanel moved to LeftSidebarPanels.js */
/* LeftSidebar moved to LeftSidebar.js */
/* NumField moved to RightSidebarPanels.js */ /* ComponentSourceCard moved to RightSidebarPanels.js */ /* PropertiesPanel moved to RightSidebarPanels.js */ /* downscaleArtworkImage moved to RightSidebarPanels.js */ /* ArtworkPropertiesPanel moved to RightSidebarPanels.js */ /* TextPropertiesPanel moved to RightSidebarPanels.js */
/* LayersPanel moved to LayerManager.js */
/* RightSidebar moved to RightSidebar.js */
