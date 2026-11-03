function kicadNum(n) {
  const v = Number.isFinite(n) ? n : 0;
  return String(Math.round(v * 1000000) / 1000000);
}
function kicadStr(s) {
  return `"${String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')}"`;
}
function kicadRefPrefix(type) {
  if (type.includes("jack")) return "J";
  if (
    type.includes("pot") ||
    type.includes("trimmer") ||
    type.includes("fader")
  )
    return "RV";
  if (type.includes("switch") || type === "toggle") return "SW";
  if (type.includes("led")) return "D";
  if (type.includes("encoder")) return "ENC";
  return "H";
}
function kicadSafeName(s) {
  return (
    String(s || "part")
      .replace(/[^A-Za-z0-9_.+-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "part"
  );
}
function rotatePointAround(px, py, cx, cy, deg) {
  const a = (deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: cy + dx * Math.sin(a) + dy * Math.cos(a),
  };
}
function kicadEdgeLine(x1, y1, x2, y2, width = 0.1) {
  return `  (gr_line (start ${kicadNum(x1)} ${kicadNum(y1)}) (end ${kicadNum(x2)} ${kicadNum(y2)}) (stroke (width ${kicadNum(width)}) (type solid)) (layer "Edge.Cuts") (tstamp ${crypto.randomUUID()}))`;
}
function kicadRectLines(
  cx,
  cy,
  w,
  h,
  rot = 0,
  layer = "Edge.Cuts",
  width = 0.1,
) {
  const pts = [
    rotatePointAround(cx - w / 2, cy - h / 2, cx, cy, rot),
    rotatePointAround(cx + w / 2, cy - h / 2, cx, cy, rot),
    rotatePointAround(cx + w / 2, cy + h / 2, cx, cy, rot),
    rotatePointAround(cx - w / 2, cy + h / 2, cx, cy, rot),
  ];
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return `  (gr_line (start ${kicadNum(p.x)} ${kicadNum(p.y)}) (end ${kicadNum(q.x)} ${kicadNum(q.y)}) (stroke (width ${kicadNum(width)}) (type solid)) (layer ${kicadStr(layer)}) (tstamp ${crypto.randomUUID()}))`;
  });
}
function kicadCircle(cx, cy, r, layer = "Dwgs.User", width = 0.08) {
  return `  (gr_circle (center ${kicadNum(cx)} ${kicadNum(cy)}) (end ${kicadNum(cx + r)} ${kicadNum(cy)}) (stroke (width ${kicadNum(width)}) (type solid)) (fill none) (layer ${kicadStr(layer)}) (tstamp ${crypto.randomUUID()}))`;
}
function kicadGrText(text, x, y, size = 1.2, rot = 0, layer = "F.SilkS") {
  const s = Math.max(0.3, size);
  return `  (gr_text ${kicadStr(text)} (at ${kicadNum(x)} ${kicadNum(y)} ${kicadNum(rot)}) (layer ${kicadStr(layer)}) (tstamp ${crypto.randomUUID()})
    (effects (font (size ${kicadNum(s)} ${kicadNum(s)}) (thickness ${kicadNum(Math.max(0.08, s * 0.12))})))
  )`;
}
function decodeSvgArtworkData(dataUrl) {
  if (!String(dataUrl || "").startsWith("data:image/svg+xml")) return "";
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return "";
  const payload = dataUrl.slice(comma + 1);
  try {
    return dataUrl.slice(0, comma).includes(";base64")
      ? atob(payload)
      : decodeURIComponent(payload);
  } catch {
    return "";
  }
}
function kicadArtworkLine(x1, y1, x2, y2, layer, width) {
  return `  (gr_line (start ${kicadNum(x1)} ${kicadNum(y1)}) (end ${kicadNum(x2)} ${kicadNum(y2)}) (stroke (width ${kicadNum(Math.max(0.01, width))}) (type solid)) (layer ${kicadStr(layer)}) (tstamp ${crypto.randomUUID()}))`;
}
function kicadArtworkCircle(cx, cy, radius, layer, width) {
  return `  (gr_circle (center ${kicadNum(cx)} ${kicadNum(cy)}) (end ${kicadNum(cx + radius)} ${kicadNum(cy)}) (stroke (width ${kicadNum(Math.max(0.01, width))}) (type solid)) (fill none) (layer ${kicadStr(layer)}) (tstamp ${crypto.randomUUID()}))`;
}
function kicadArtworkArc(start, mid, end, layer, width) {
  return `  (gr_arc (start ${kicadNum(start.x)} ${kicadNum(start.y)}) (mid ${kicadNum(mid.x)} ${kicadNum(mid.y)}) (end ${kicadNum(end.x)} ${kicadNum(end.y)}) (stroke (width ${kicadNum(Math.max(0.01, width))}) (type solid)) (layer ${kicadStr(layer)}) (tstamp ${crypto.randomUUID()}))`;
}
function kicadArtworkPolygon(points, layer) {
  return `  (gr_poly (pts ${points.map((point) => `(xy ${kicadNum(point.x)} ${kicadNum(point.y)})`).join(" ")}) (stroke (width 0.01) (type solid)) (fill solid) (layer ${kicadStr(layer)}) (tstamp ${crypto.randomUUID()}))`;
}
function svgPathLinePoints(pathData) {
  const tokens = String(pathData || "").match(
    /[ML]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi,
  );
  if (!tokens) return [];
  const points = [];
  for (let i = 0; i < tokens.length; ) {
    const command = tokens[i++];
    if (command !== "M" && command !== "L") return [];
    const x = Number(tokens[i++]);
    const y = Number(tokens[i++]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    points.push({ x, y });
  }
  return points;
}
function artworkSvgTransform(artwork, viewBox) {
  const sx = artwork.width / viewBox.width;
  const sy = artwork.height / viewBox.height;
  const left = artwork.x - artwork.width / 2;
  const top = artwork.y - artwork.height / 2;
  return {
    strokeScale: (Math.abs(sx) + Math.abs(sy)) / 2,
    point(x, y) {
      const panelPoint = {
        x: left + (x - viewBox.x) * sx,
        y: top + (y - viewBox.y) * sy,
      };
      return rotatePointAround(
        panelPoint.x,
        panelPoint.y,
        artwork.x,
        artwork.y,
        artwork.rotation || 0,
      );
    },
  };
}
function artworkElementLayer(element) {
  const explicit = element.getAttribute("data-kicad-layer");
  if (["F.Cu", "F.Mask", "F.SilkS"].includes(explicit)) return explicit;
  if (element.closest("mask")) return "F.Mask";
  if (element.closest('g[mask*="eagle-top-stop"]')) return "F.Cu";
  return "F.SilkS";
}
function kicadGraphicsFromSvgArtwork(artwork, tx, ty) {
  if (!artwork?.visible) return [];
  const svgText = decodeSvgArtworkData(artwork.imageDataUrl);
  if (!svgText) return [];
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) return [];
  const svg = doc.documentElement;
  const viewBoxValues = String(svg.getAttribute("viewBox") || "")
    .trim()
    .split(/[ ,]+/)
    .map(Number);
  const viewBox =
    viewBoxValues.length === 4 && viewBoxValues.every(Number.isFinite)
      ? {
          x: viewBoxValues[0],
          y: viewBoxValues[1],
          width: viewBoxValues[2],
          height: viewBoxValues[3],
        }
      : { x: 0, y: 0, width: artwork.naturalW, height: artwork.naturalH };
  if (!(viewBox.width > 0) || !(viewBox.height > 0)) return [];
  const transform = artworkSvgTransform(artwork, viewBox);
  const outputPoint = (x, y) => {
    const point = transform.point(x, y);
    return { x: tx(point.x), y: ty(point.y) };
  };
  const graphics = [];
  for (const element of svg.querySelectorAll("path,circle,rect,polygon,text")) {
    if (
      element.closest("mask") &&
      element.tagName === "rect" &&
      element.getAttribute("fill") === "black"
    )
      continue;
    const layer = artworkElementLayer(element);
    const width =
      Math.max(0.01, Number(element.getAttribute("stroke-width")) || 0.1) *
      transform.strokeScale;
    if (element.tagName === "path") {
      const points = svgPathLinePoints(element.getAttribute("d"));
      if (
        points.length > 2 &&
        (element.getAttribute("data-kicad-native-arc") === "true" ||
          element.closest("svg")?.querySelector('mask[id="eagle-top-stop"]'))
      ) {
        const start = outputPoint(points[0].x, points[0].y);
        const middlePoint = points[Math.floor(points.length / 2)];
        const mid = outputPoint(middlePoint.x, middlePoint.y);
        const endPoint = points[points.length - 1];
        const end = outputPoint(endPoint.x, endPoint.y);
        graphics.push(kicadArtworkArc(start, mid, end, layer, width));
        continue;
      }
      for (let i = 1; i < points.length; i++) {
        const start = outputPoint(points[i - 1].x, points[i - 1].y);
        const end = outputPoint(points[i].x, points[i].y);
        graphics.push(
          kicadArtworkLine(start.x, start.y, end.x, end.y, layer, width),
        );
      }
    } else if (element.tagName === "circle") {
      const cx = Number(element.getAttribute("cx"));
      const cy = Number(element.getAttribute("cy"));
      const radius = Number(element.getAttribute("r"));
      if (![cx, cy, radius].every(Number.isFinite) || radius <= 0) continue;
      const center = outputPoint(cx, cy);
      graphics.push(
        kicadArtworkCircle(
          center.x,
          center.y,
          radius * transform.strokeScale,
          layer,
          width,
        ),
      );
    } else if (element.tagName === "rect") {
      const x = Number(element.getAttribute("x"));
      const y = Number(element.getAttribute("y"));
      const rectWidth = Number(element.getAttribute("width"));
      const rectHeight = Number(element.getAttribute("height"));
      if (![x, y, rectWidth, rectHeight].every(Number.isFinite)) continue;
      graphics.push(
        kicadArtworkPolygon(
          [
            outputPoint(x, y),
            outputPoint(x + rectWidth, y),
            outputPoint(x + rectWidth, y + rectHeight),
            outputPoint(x, y + rectHeight),
          ],
          layer,
        ),
      );
    } else if (element.tagName === "polygon") {
      const points = String(element.getAttribute("points") || "")
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",").map(Number))
        .filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
        .map(([x, y]) => outputPoint(x, y));
      if (points.length >= 3) graphics.push(kicadArtworkPolygon(points, layer));
    } else if (element.tagName === "text") {
      const svgTransform = element.getAttribute("transform") || "";
      const translate = svgTransform.match(
        /translate\(\s*(-?[\d.]+)(?:[ ,]+(-?[\d.]+))?\s*\)/i,
      );
      const rotate = svgTransform.match(/rotate\(\s*(-?[\d.]+)/i);
      const x = Number(element.getAttribute("x")) + Number(translate?.[1] || 0);
      const y = Number(element.getAttribute("y")) + Number(translate?.[2] || 0);
      const point = outputPoint(x, y);
      graphics.push(
        kicadGrText(
          element.textContent || "",
          point.x,
          point.y,
          Math.max(
            0.3,
            (Number(element.getAttribute("font-size")) || 1.2) *
              transform.strokeScale,
          ),
          Number(rotate?.[1] || 0) + (artwork.rotation || 0),
          layer,
        ),
      );
    }
  }
  return graphics;
}
function kicadNPTHFootprint(
  ref,
  name,
  x,
  y,
  type,
  d,
  slotLength,
  rot = 0,
  value,
  ovalAxis = "x",
) {
  const fp = kicadSafeName(name);
  const hole = Math.max(0.1, d || 3);
  const len = Math.max(hole, slotLength || hole);
  const padSize =
    type === "oval"
      ? ovalAxis === "x"
        ? `${kicadNum(len)} ${kicadNum(hole)}`
        : `${kicadNum(hole)} ${kicadNum(len)}`
      : `${kicadNum(hole)} ${kicadNum(hole)}`;
  const drill =
    type === "oval"
      ? ovalAxis === "x"
        ? `oval ${kicadNum(len)} ${kicadNum(hole)}`
        : `oval ${kicadNum(hole)} ${kicadNum(len)}`
      : `${kicadNum(hole)}`;
  const shape = type === "oval" ? "oval" : "circle";
  return `  (footprint "PanelDesigner:${fp}" (layer "F.Cu")
    (tstamp ${crypto.randomUUID()})
    (at ${kicadNum(x)} ${kicadNum(y)} ${kicadNum(rot)})
    (attr board_only exclude_from_pos_files exclude_from_bom)
    (property "Reference" ${kicadStr(ref)} (at 0 ${kicadNum(-(len / 2 + 2))} 0) (layer "F.SilkS") hide (effects (font (size 1 1) (thickness 0.15))))
    (property "Value" ${kicadStr(value || name)} (at 0 ${kicadNum(len / 2 + 2)} 0) (layer "F.Fab") hide (effects (font (size 1 1) (thickness 0.15))))
    (fp_text reference ${kicadStr(ref)} (at 0 ${kicadNum(-(len / 2 + 1.2))} 0) (layer "F.SilkS") hide (effects (font (size 1 1) (thickness 0.15))))
    (fp_text value ${kicadStr(value || name)} (at 0 ${kicadNum(len / 2 + 1.2)} 0) (layer "F.Fab") hide (effects (font (size 1 1) (thickness 0.15))))
    (pad "" np_thru_hole ${shape} (at 0 0) (size ${padSize}) (drill ${drill}) (layers "*.Cu" "*.Mask"))
  )`;
}
function exportKiCadPCB(state, options = DEFAULT_EXPORT_OPTIONS) {
  const widthMM = panelWidthMM(state.panel);
  const heightMM = PANEL_HEIGHT_MM;
  const includePanelOutline = options.kicadPanelOutline !== false;
  const includeMountingHoles = options.kicadMountingHoles !== false;
  const includeComponentHoles = options.kicadComponentHoles !== false;
  const includeRectCutouts = options.kicadRectCutouts !== false;
  const includeArtwork = options.kicadArtwork !== false;
  const includeVisualOutlines = !!options.kicadVisualOutlines;
  const includeKeepoutHints = !!options.kicadKeepoutHints;
  const includeRefs = !!options.kicadRefs;
  const includeTextLabels = !!options.kicadTextLabels;
  const kicadOrigin = options.kicadOrigin || "top-left";
  const ox = kicadOrigin === "center" ? -widthMM / 2 : 0;
  const oy = kicadOrigin === "center" ? -heightMM / 2 : 0;
  const tx = (x) => x + ox;
  const ty = (y) => y + oy;
  const lines = [];
  const footprints = [];
  const graphics = [];
  if (includePanelOutline) {
    const importedOutline = state.panelOutlineGeometry;
    if (Array.isArray(importedOutline) && importedOutline.length) {
      for (const item of importedOutline) {
        const points = item.points || [];
        if (item.kind === "arc" && points.length > 2) {
          const start = points[0];
          const mid = points[Math.floor(points.length / 2)];
          const end = points[points.length - 1];
          lines.push(
            kicadArtworkArc(
              { x: tx(start.x), y: ty(start.y) },
              { x: tx(mid.x), y: ty(mid.y) },
              { x: tx(end.x), y: ty(end.y) },
              "Edge.Cuts",
              0.1,
            ),
          );
        } else if (points.length >= 2) {
          lines.push(
            kicadEdgeLine(
              tx(points[0].x),
              ty(points[0].y),
              tx(points[points.length - 1].x),
              ty(points[points.length - 1].y),
            ),
          );
        }
      }
    } else {
      lines.push(kicadEdgeLine(tx(0), ty(0), tx(widthMM), ty(0)));
      lines.push(kicadEdgeLine(tx(widthMM), ty(0), tx(widthMM), ty(heightMM)));
      lines.push(kicadEdgeLine(tx(widthMM), ty(heightMM), tx(0), ty(heightMM)));
      lines.push(kicadEdgeLine(tx(0), ty(heightMM), tx(0), ty(0)));
    }
  }
  if (includeMountingHoles && state.mountingHoles?.enabled) {
    for (let i = 0; i < state.mountingHoles.holes.length; i++) {
      const h = normalizeMountingHoleRail(state.mountingHoles.holes[i]);
      if (state.mountingHoles.holeShape === "oval") {
        footprints.push(
          kicadNPTHFootprint(
            `MH${i + 1}`,
            "Mounting_Hole_Oval",
            tx(h.x),
            ty(h.y),
            "oval",
            MOUNTING_HOLE_DIAMETER_MM,
            state.mountingHoles.ovalLength || 4.8,
            0,
            "Mounting hole",
            "x",
          ),
        );
      } else {
        footprints.push(
          kicadNPTHFootprint(
            `MH${i + 1}`,
            "Mounting_Hole",
            tx(h.x),
            ty(h.y),
            "circle",
            MOUNTING_HOLE_DIAMETER_MM,
            undefined,
            0,
            "Mounting hole",
          ),
        );
      }
      if (includeKeepoutHints && state.mountingHoles.showKeepouts)
        graphics.push(
          kicadCircle(
            tx(h.x),
            ty(h.y),
            state.mountingHoles.keepoutRadius || MOUNTING_HOLE_KEEPOUT_R_MM,
            "Cmts.User",
            0.06,
          ),
        );
    }
  }
  if (
    includeComponentHoles ||
    includeRectCutouts ||
    includeVisualOutlines ||
    includeKeepoutHints ||
    includeRefs
  ) {
    for (let i = 0; i < state.components.length; i++) {
      const c = state.components[i];
      const ref = c.ref || `${kicadRefPrefix(c.type)}${i + 1}`;
      const rot = c.rotation || 0;
      if (isDip8Socket(c)) {
        if (includeComponentHoles) {
          const pts = dip8SocketHoleCenters(c).map((p) => ({
            x: tx(p.x),
            y: ty(p.y),
          }));
          pts.forEach((p, pinIdx) =>
            footprints.push(
              kicadNPTHFootprint(
                `${ref}_${pinIdx + 1}`,
                c.name || c.type,
                p.x,
                p.y,
                "circle",
                c.holeDiameter || 1.05,
                undefined,
                0,
                `${shortPartName(c)} pin ${pinIdx + 1}`,
              ),
            ),
          );
        }
        if (includeVisualOutlines)
          graphics.push(
            ...kicadRectLines(
              tx(c.x),
              ty(c.y),
              c.frontW ?? 10.2,
              c.frontH ?? 10.2,
              rot,
              "Dwgs.User",
              0.08,
            ),
          );
        if (includeKeepoutHints)
          graphics.push(
            ...kicadRectLines(
              tx(c.x),
              ty(c.y),
              c.keepoutW || 12,
              c.keepoutH || 12,
              rot,
              "Cmts.User",
              0.05,
            ),
          );
      } else if (c.holeType === "rect") {
        const w = c.holeW ?? c.frontW ?? c.holeDiameter ?? 3;
        const h = c.holeH ?? c.frontH ?? c.holeDiameter ?? 3;
        if (includeRectCutouts)
          lines.push(
            ...kicadRectLines(tx(c.x), ty(c.y), w, h, rot, "Edge.Cuts", 0.1),
          );
        if (includeVisualOutlines)
          graphics.push(
            ...kicadRectLines(
              tx(c.x),
              ty(c.y),
              c.frontW ?? w,
              c.frontH ?? h,
              rot,
              "Dwgs.User",
              0.08,
            ),
          );
      } else if (c.holeType === "slot") {
        if (includeComponentHoles)
          footprints.push(
            kicadNPTHFootprint(
              ref,
              c.name || c.type,
              tx(c.x),
              ty(c.y),
              "oval",
              c.holeDiameter || 3,
              c.slotLength || c.holeDiameter || 3,
              rot,
              shortPartName(c),
              "y",
            ),
          );
        if (includeKeepoutHints)
          graphics.push(
            ...kicadRectLines(
              tx(c.x),
              ty(c.y),
              c.keepoutW || (c.holeDiameter || 3) + 2,
              c.keepoutH || (c.slotLength || 3) + 2,
              rot,
              "Cmts.User",
              0.05,
            ),
          );
      } else {
        if (includeComponentHoles)
          footprints.push(
            kicadNPTHFootprint(
              ref,
              c.name || c.type,
              tx(c.x),
              ty(c.y),
              "circle",
              c.holeDiameter || 3,
              undefined,
              rot,
              shortPartName(c),
            ),
          );
        if (includeVisualOutlines)
          graphics.push(
            kicadCircle(
              tx(c.x),
              ty(c.y),
              (c.frontDiameter || c.holeDiameter || 3) / 2,
              "Dwgs.User",
              0.08,
            ),
          );
        if (includeKeepoutHints)
          graphics.push(
            kicadCircle(
              tx(c.x),
              ty(c.y),
              Math.max(c.keepoutW || 0, c.keepoutH || 0, c.holeDiameter || 3) /
                2,
              "Cmts.User",
              0.05,
            ),
          );
      }
      if (includeRefs)
        graphics.push(
          kicadGrText(
            ref,
            tx(c.x),
            ty(c.y) - Math.max(2.5, (c.frontDiameter || c.frontH || 6) / 2 + 2),
            1.0,
            0,
            "F.SilkS",
          ),
        );
    }
  }
  if (includeTextLabels) {
    for (const t of state.textItems) {
      if (!t.visible) continue;
      graphics.push(
        kicadGrText(
          t.text || "TEXT",
          tx(t.x),
          ty(t.y),
          Math.max(0.6, t.fontSizeMm || 1.2),
          t.rotation || 0,
          t.layer === "background" ? "B.SilkS" : "F.SilkS",
        ),
      );
    }
  }
  if (includeArtwork) {
    for (const artwork of state.artworks || [])
      graphics.push(...kicadGraphicsFromSvgArtwork(artwork, tx, ty));
  }
  const board = `(kicad_pcb
  (version 20221018)
  (generator "Panel Designer KiCad mechanical export")
  (general
    (thickness 1.6)
  )
  (paper "A4")
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user)
    (33 "F.Adhes" user)
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user)
    (37 "F.SilkS" user)
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (44 "Edge.Cuts" user)
    (45 "Margin" user)
    (46 "B.CrtYd" user)
    (47 "F.CrtYd" user)
    (48 "B.Fab" user)
    (49 "F.Fab" user)
    (50 "User.1" user)
    (51 "User.2" user)
    (52 "User.3" user)
    (53 "User.4" user)
    (54 "User.5" user)
    (55 "User.6" user)
    (56 "User.7" user)
    (57 "User.8" user)
    (58 "User.9" user)
    (59 "Dwgs.User" user)
    (60 "Cmts.User" user)
  )
  (setup
    (pad_to_mask_clearance 0)
    (grid_origin 0 0)
  )
${lines.join("\n")}
${graphics.join("\n")}
${footprints.join("\n")}
)
`;
  const base = safeProjectFileName(
    state.projectMeta?.name || "panel-layout",
  ).replace(/\.json$/i, "");
  void saveTextFile(`${base}.kicad_pcb`, board, "application/x-kicad-pcb");
}
