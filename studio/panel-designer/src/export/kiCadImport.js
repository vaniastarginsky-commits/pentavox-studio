// KiCad PCB import parser.
// Parses KiCad .kicad_pcb files and converts footprints to panel components.
// Depends on: HP_TO_MM, PANEL_HEIGHT_MM, panelWidthMM (core.js),
//             COMPONENT_LIBRARY (components/library/componentDefinitions.js).
// Public API: parseKiCadPcbToPanel(src, currentPanelWidthMM).

function sexprBlocks(src, head) {
  const blocks = [];
  let i = 0;
  const needle = `(${head}`;
  while ((i = src.indexOf(needle, i)) !== -1) {
    let depth = 0;
    let inString = false;
    let esc = false;
    const start = i;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (inString) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          blocks.push(src.slice(start, i + 1));
          i++;
          break;
        }
      }
    }
  }
  return blocks;
}
function sexprHeadName(block) {
  const m =
    block.match(/^\(footprint\s+"([^"]+)"/) ||
    block.match(/^\(footprint\s+([^\s\)]+)/);
  return m ? m[1] : "KiCad Footprint";
}
function parseAt(block) {
  const m = block.match(
    /\(at\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/,
  );
  if (!m) return null;
  return { x: +m[1], y: +m[2], rot: m[3] ? +m[3] : 0 };
}
function parseKiCadProperty(block, name) {
  const m = block.match(
    new RegExp(
      '\\(property\\s+"' +
        name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        '"\\s+"([^"]*)"',
    ),
  );
  return m ? m[1] : "";
}
function parseFpText(block, kind) {
  const propName = kind === "reference" ? "Reference" : "Value";
  const prop = parseKiCadProperty(block, propName);
  if (prop) return prop;
  const quoted = block.match(
    new RegExp("\\(fp_text\\s+" + kind + '\\s+"([^"]*)"'),
  );
  if (quoted) return quoted[1];
  const bare = block.match(
    new RegExp("\\(fp_text\\s+" + kind + "\\s+([^\\s\\)]+)"),
  );
  return bare ? bare[1] : "";
}
function parseFpReference(block) {
  return parseFpText(block, "reference");
}
function parseFpValue(block) {
  return parseFpText(block, "value");
}
function parseFpDescription(block) {
  const prop = parseKiCadProperty(block, "Description");
  if (prop) return prop;
  const m =
    block.match(/\(descr\s+"([^"]*)"\)/) ||
    block.match(/\(description\s+"([^"]*)"\)/);
  return m ? m[1] : "";
}
function parseKiCadGraphicPrimitives(block) {
  const circles = sexprBlocks(block, "fp_circle")
    .map((c) => {
      const center = c.match(
        /\(center\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/,
      );
      const end = c.match(/\(end\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/);
      const layer = c.match(/\(layer\s+"?([^"\)\s]+)"?\)/)?.[1] || "";
      if (!center || !end) return null;
      const cx = +center[1],
        cy = +center[2],
        ex = +end[1],
        ey = +end[2];
      return { cx, cy, r: Math.hypot(ex - cx, ey - cy), layer };
    })
    .filter(Boolean);
  const rects = sexprBlocks(block, "fp_rect")
    .map((r) => {
      const start = r.match(
        /\(start\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/,
      );
      const end = r.match(/\(end\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/);
      const layer = r.match(/\(layer\s+"?([^"\)\s]+)"?\)/)?.[1] || "";
      if (!start || !end) return null;
      const x1 = +start[1],
        y1 = +start[2],
        x2 = +end[1],
        y2 = +end[2];
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1),
        layer,
      };
    })
    .filter(Boolean);
  const lines = sexprBlocks(block, "fp_line")
    .map((l) => {
      const start = l.match(
        /\(start\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/,
      );
      const end = l.match(/\(end\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/);
      const layer = l.match(/\(layer\s+"?([^"\)\s]+)"?\)/)?.[1] || "";
      if (!start || !end) return null;
      return { x1: +start[1], y1: +start[2], x2: +end[1], y2: +end[2], layer };
    })
    .filter(Boolean);
  return { circles, rects, lines };
}
function isPanelGeometryLayer(layer) {
  return /^(F\.Fab|F\.SilkS|Dwgs\.User|Cmts\.User|Eco1\.User|Eco2\.User|Edge\.Cuts)$/i.test(
    layer,
  );
}
function parseKiCadPads(block) {
  return sexprBlocks(block, "pad")
    .map((p) => {
      const size = p.match(/\(size\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/);
      const at = p.match(
        /\(at\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?\)/,
      );
      const oval =
        /\(drill\s+oval\s+/.test(p) ||
        /^\(pad\s+[^\)]*\s+[^\)]*\s+oval\b/.test(p);
      const rect = /^\(pad\s+[^\)]*\s+[^\)]*\s+rect\b/.test(p);
      const roundrect = /^\(pad\s+[^\)]*\s+[^\)]*\s+roundrect\b/.test(p);
      const drill =
        p.match(/\(drill\s+oval\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/) ||
        p.match(/\(drill\s+(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?\)/);
      const dw = drill ? +drill[1] : 0;
      const dh = drill ? +(drill[2] || drill[1]) : 0;
      return {
        drillW: dw,
        drillH: dh,
        sizeW: size ? +size[1] : 0,
        sizeH: size ? +size[2] : 0,
        oval,
        rect,
        roundrect,
        atX: at ? +at[1] : 0,
        atY: at ? +at[2] : 0,
        atRot: at && at[3] ? +at[3] : 0,
        npth: /^\(pad\s+(?:"[^"]*"|[^\s\)]+)\s+np_thru_hole\b/.test(p),
      };
    })
    .filter((p) => p.drillW > 0 || p.sizeW > 0 || p.sizeH > 0);
}
function kiCadFootprintGeometry(pads, graphics, hay = "") {
  if (/DIP-8|DIODE_SOCKET|Package_DIP:DIP-8|Socket.*8/i.test(hay)) {
    const drilled = pads.filter(
      (p) => p.drillW > 0 || p.sizeW > 0 || p.sizeH > 0,
    );
    const cx = drilled.length
      ? (Math.min(...drilled.map((p) => p.atX)) +
          Math.max(...drilled.map((p) => p.atX))) /
        2
      : 0;
    const cy = drilled.length
      ? (Math.min(...drilled.map((p) => p.atY)) +
          Math.max(...drilled.map((p) => p.atY))) /
        2
      : 0;
    return {
      holeDiameter: 1.05,
      rotationOffset: 0,
      offsetX: cx,
      offsetY: cy,
      anchorOnly: true,
      noPositionOffset: false,
      frontDiameter: 10.2,
      rearBodyW: 10.2,
      rearBodyH: 10.2,
    };
  }
  if (/Jack_3\.5mm_QingPu_WQP-PJ398SM|PJ398SM|Thonkiconn/i.test(hay)) {
    return {
      holeDiameter: 6.1,
      rotationOffset: 0,
      offsetX: 0,
      offsetY: 6.48,
      anchorOnly: true,
      noPositionOffset: false,
      frontDiameter: 8.0,
      rearBodyW: 8.5,
      rearBodyH: 10.5,
    };
  }
  if (/Potentiometer_Alpha_RD901F|RD901F/i.test(hay)) {
    return {
      holeDiameter: 7.0,
      rotationOffset: 0,
      offsetX: 7.5,
      offsetY: 2.5,
      anchorOnly: true,
      noPositionOffset: false,
      frontDiameter: 10.0,
      rearBodyW: 9.5,
      rearBodyH: 10.5,
    };
  }
  if (/SW_Tact_Low_Profile_LED|THONK-SW-LP-LED|Low_Profile_LED/i.test(hay)) {
    return {
      holeDiameter: 6.0,
      rotationOffset: 0,
      offsetX: 0,
      offsetY: 0,
      anchorOnly: true,
      noPositionOffset: true,
      frontDiameter: 6.0,
      rearBodyW: 8.0,
      rearBodyH: 8.0,
    };
  }
  const panelCircles = (graphics?.circles || [])
    .filter((c) => isPanelGeometryLayer(c.layer) && c.r >= 1.35 && c.r <= 20)
    .map((c) => ({ ...c, dist: Math.hypot(c.cx, c.cy) }));
  const largestCircle = panelCircles
    .filter((c) => c.r >= 2.2)
    .sort((a, b) => b.r - a.r || a.dist - b.dist)[0];
  const centralCircle =
    largestCircle ||
    panelCircles.sort((a, b) => a.dist - b.dist || b.r - a.r)[0];
  if (
    centralCircle &&
    (/jack|pj398|thonk|pot|rv09|rd901|encoder|ec12|button|tact|led|switch|cv|in_|out_|return|send/i.test(
      hay,
    ) ||
      centralCircle.dist < 1.5)
  ) {
    const d = centralCircle.r * 2;
    const padSpanW = pads.length
      ? Math.max(...pads.map((p) => p.atX)) -
        Math.min(...pads.map((p) => p.atX)) +
        Math.max(...pads.map((p) => p.sizeW || p.drillW || 0))
      : d;
    const padSpanH = pads.length
      ? Math.max(...pads.map((p) => p.atY)) -
        Math.min(...pads.map((p) => p.atY)) +
        Math.max(...pads.map((p) => p.sizeH || p.drillH || 0))
      : d;
    const isJackLike = /jack|pj398|thonk|cv|in_|out_|return|send/i.test(hay);
    const isPotLike = /pot|rv09|rd901|ssi2144|phase|drive|mix|freq|q/i.test(
      hay,
    );
    return {
      holeDiameter: d,
      rotationOffset: 0,
      offsetX: centralCircle.cx,
      offsetY: centralCircle.cy,
      anchorOnly: true,
      frontDiameter: d,
      rearBodyW:
        isJackLike || isPotLike
          ? Math.max(d + 2, Math.min(padSpanW, d + 8))
          : Math.max(padSpanW, d),
      rearBodyH:
        isJackLike || isPotLike
          ? Math.max(d + 2, Math.min(padSpanH, d + 8))
          : Math.max(padSpanH, d),
    };
  }
  if (!pads.length) return null;
  const drills = pads.filter((p) => p.drillW > 0 || p.drillH > 0);
  const sizes = pads.filter((p) => p.sizeW > 0 || p.sizeH > 0);
  const xs = pads.map((p) => p.atX);
  const ys = pads.map((p) => p.atY);
  const padSpanW = xs.length
    ? Math.max(...xs) -
      Math.min(...xs) +
      Math.max(...pads.map((p) => p.sizeW || p.drillW || 0))
    : 0;
  const padSpanH = ys.length
    ? Math.max(...ys) -
      Math.min(...ys) +
      Math.max(...pads.map((p) => p.sizeH || p.drillH || 0))
    : 0;
  const slot = drills.find(
    (p) =>
      p.oval || Math.abs((p.drillW || p.sizeW) - (p.drillH || p.sizeH)) > 1.0,
  );
  if (slot) {
    const w = slot.drillW || slot.sizeW;
    const h = slot.drillH || slot.sizeH;
    const dia = Math.max(0.1, Math.min(w, h));
    const len = Math.max(w, h);
    const rotOff = w >= h ? 90 : 0;
    return {
      holeType: "slot",
      holeDiameter: dia,
      slotLength: len,
      rotationOffset: rotOff,
      offsetX: slot.atX || 0,
      offsetY: slot.atY || 0,
      frontW: dia,
      frontH: len,
      frontDiameter: Math.max(dia, len),
      rearBodyW: Math.max(padSpanW, dia + 2),
      rearBodyH: Math.max(padSpanH, len + 2),
    };
  }
  const rectPad = sizes.find(
    (p) =>
      (p.rect || p.roundrect) &&
      Math.max(p.sizeW, p.sizeH) >= 2 &&
      Math.min(p.sizeW, p.sizeH) >= 1.0,
  );
  if (rectPad && !drills.length) {
    return {
      holeType: "rect",
      holeDiameter: Math.min(rectPad.sizeW, rectPad.sizeH),
      holeW: rectPad.sizeW,
      holeH: rectPad.sizeH,
      rotationOffset: rectPad.atRot || 0,
      offsetX: rectPad.atX || 0,
      offsetY: rectPad.atY || 0,
      frontW: rectPad.sizeW,
      frontH: rectPad.sizeH,
      frontDiameter: Math.max(rectPad.sizeW, rectPad.sizeH),
      rearBodyW: Math.max(padSpanW, rectPad.sizeW + 2),
      rearBodyH: Math.max(padSpanH, rectPad.sizeH + 2),
    };
  }
  const maxDrill = Math.max(
    0,
    ...drills.map((p) => Math.max(p.drillW, p.drillH)),
  );
  const maxPad = Math.max(0, ...sizes.map((p) => Math.max(p.sizeW, p.sizeH)));
  const d = maxDrill || Math.max(1, maxPad * 0.55);
  return {
    holeDiameter: d,
    rotationOffset: 0,
    offsetX: 0,
    offsetY: 0,
    frontDiameter: Math.max(d, maxPad || d),
    rearBodyW: Math.max(padSpanW, maxPad, d + 2),
    rearBodyH: Math.max(padSpanH, maxPad, d + 2),
  };
}
function boardCutoutsFromKiCad(src) {
  return sexprBlocks(src, "gr_circle")
    .filter((block) => /\(layer\s+"?Edge\.Cuts"?\)/i.test(block))
    .map((block) => {
      const center = block.match(
        /\(center\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/,
      );
      const end = block.match(
        /\(end\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/,
      );
      if (!center || !end) return null;
      const x = +center[1];
      const y = +center[2];
      const radius = Math.hypot(+end[1] - x, +end[2] - y);
      if (!(radius > 0)) return null;
      return {
        x,
        y,
        holeDiameter: radius * 2,
        rotation: 0,
        source: "board Edge.Cuts circle",
      };
    })
    .filter(Boolean);
}
function boardOutlineFromKiCad(src) {
  const pts = [];
  const edgeBlocks = [
    ...sexprBlocks(src, "gr_line"),
    ...sexprBlocks(src, "gr_rect"),
    ...sexprBlocks(src, "gr_arc"),
  ].filter((b) => /\(layer\s+"?Edge\.Cuts"?\)/.test(b));
  for (const b of edgeBlocks) {
    const pairs = [
      ...b.matchAll(
        /\((?:start|end|xy)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/g,
      ),
    ];
    for (const p of pairs) pts.push({ x: +p[1], y: +p[2] });
  }
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y);
  const x1 = Math.min(...xs),
    x2 = Math.max(...xs),
    y1 = Math.min(...ys),
    y2 = Math.max(...ys);
  if (!(x2 > x1) || !(y2 > y1)) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
function kiCadGraphicLayer(block) {
  return block.match(/\(layer\s+"?([^"\)\s]+)"?\)/)?.[1] || "";
}
function kiCadGraphicWidth(block) {
  return Math.max(
    0.01,
    Number(block.match(/\(stroke\s+\(width\s+(-?[\d.]+)/)?.[1]) || 0.1,
  );
}
function kiCadArcPolyline(start, mid, end) {
  const ax = start.x,
    ay = start.y;
  const bx = mid.x,
    by = mid.y;
  const cx = end.x,
    cy = end.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-8) return [start, end];
  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    d;
  const norm = (angle) => {
    let result = angle % (Math.PI * 2);
    if (result < 0) result += Math.PI * 2;
    return result;
  };
  const a0 = norm(Math.atan2(ay - uy, ax - ux));
  const am = norm(Math.atan2(by - uy, bx - ux));
  const a1 = norm(Math.atan2(cy - uy, cx - ux));
  const ccwEnd = norm(a1 - a0);
  const ccwMid = norm(am - a0);
  const delta = ccwMid <= ccwEnd ? ccwEnd : ccwEnd - Math.PI * 2;
  const radius = Math.hypot(ax - ux, ay - uy);
  const segments = Math.max(3, Math.ceil(Math.abs(delta) / (Math.PI / 24)));
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = a0 + delta * (index / segments);
    return {
      x: ux + radius * Math.cos(angle),
      y: uy + radius * Math.sin(angle),
    };
  });
}
function parseKiCadBoardArtwork(src, outline, xOffset, yOffset) {
  if (!outline) return [];
  const groups = { "F.Cu": [], "F.Mask": [], "F.SilkS": [] };
  const color = (layer) =>
    layer === "F.Cu" ? "#c99a4a" : layer === "F.Mask" ? "white" : "#f2f0e9";
  const localX = (value) => Math.round((value - outline.x) * 100000) / 100000;
  const localY = (value) => Math.round((value - outline.y) * 100000) / 100000;
  const attr = (layer) => `data-kicad-layer="${layer}"`;
  for (const block of sexprBlocks(src, "gr_line")) {
    const layer = kiCadGraphicLayer(block);
    if (!groups[layer]) continue;
    const start = block.match(/\(start\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    const end = block.match(/\(end\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    if (!start || !end) continue;
    groups[layer].push(
      `<path ${attr(layer)} d="M${localX(+start[1])} ${localY(+start[2])} L${localX(+end[1])} ${localY(+end[2])}" fill="none" stroke="${color(layer)}" stroke-width="${kiCadGraphicWidth(block)}" stroke-linecap="round"/>`,
    );
  }
  for (const block of sexprBlocks(src, "gr_arc")) {
    const layer = kiCadGraphicLayer(block);
    if (!groups[layer]) continue;
    const parsePoint = (name) => {
      const match = block.match(
        new RegExp(`\\(${name}\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\)`),
      );
      return match ? { x: +match[1], y: +match[2] } : null;
    };
    const start = parsePoint("start");
    const mid = parsePoint("mid");
    const end = parsePoint("end");
    if (!start || !mid || !end) continue;
    const points = kiCadArcPolyline(start, mid, end);
    const d = points
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${localX(point.x)} ${localY(point.y)}`,
      )
      .join(" ");
    groups[layer].push(
      `<path ${attr(layer)} data-kicad-native-arc="true" d="${d}" fill="none" stroke="${color(layer)}" stroke-width="${kiCadGraphicWidth(block)}" stroke-linecap="round"/>`,
    );
  }
  for (const block of sexprBlocks(src, "gr_circle")) {
    const layer = kiCadGraphicLayer(block);
    if (!groups[layer]) continue;
    const center = block.match(/\(center\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    const end = block.match(/\(end\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    if (!center || !end) continue;
    const radius = Math.hypot(+end[1] - +center[1], +end[2] - +center[2]);
    groups[layer].push(
      `<circle ${attr(layer)} cx="${localX(+center[1])}" cy="${localY(+center[2])}" r="${radius}" fill="none" stroke="${color(layer)}" stroke-width="${kiCadGraphicWidth(block)}"/>`,
    );
  }
  for (const block of sexprBlocks(src, "gr_rect")) {
    const layer = kiCadGraphicLayer(block);
    if (!groups[layer]) continue;
    const start = block.match(/\(start\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    const end = block.match(/\(end\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    if (!start || !end) continue;
    const x1 = localX(+start[1]),
      y1 = localY(+start[2]),
      x2 = localX(+end[1]),
      y2 = localY(+end[2]);
    groups[layer].push(
      `<rect ${attr(layer)} x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="${/\(fill\s+solid\)/.test(block) ? color(layer) : "none"}" stroke="${color(layer)}" stroke-width="${kiCadGraphicWidth(block)}"/>`,
    );
  }
  for (const block of sexprBlocks(src, "gr_poly")) {
    const layer = kiCadGraphicLayer(block);
    if (!groups[layer]) continue;
    const points = [...block.matchAll(/\(xy\s+(-?[\d.]+)\s+(-?[\d.]+)\)/g)];
    if (points.length < 3) continue;
    groups[layer].push(
      `<polygon ${attr(layer)} points="${points.map((point) => `${localX(+point[1])},${localY(+point[2])}`).join(" ")}" fill="${/\(fill\s+solid\)/.test(block) ? color(layer) : "none"}" stroke="${color(layer)}" stroke-width="${kiCadGraphicWidth(block)}"/>`,
    );
  }
  for (const block of sexprBlocks(src, "gr_text")) {
    const layer = kiCadGraphicLayer(block);
    if (!groups[layer]) continue;
    const text = block.match(/^\(gr_text\s+"((?:\\.|[^"\\])*)"/)?.[1];
    const at = block.match(
      /\(at\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s+(-?[\d.]+))?\)/,
    );
    const size = block.match(/\(font\s+\(size\s+([\d.]+)/)?.[1];
    if (text === undefined || !at) continue;
    groups[layer].push(
      `<text ${attr(layer)} transform="translate(${localX(+at[1])} ${localY(+at[2])}) rotate(${Number(at[3] || 0)})" x="0" y="0" fill="${color(layer)}" stroke="none" font-family="Arial, sans-serif" font-size="${Number(size || 1.2)}">${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text>`,
    );
  }
  const copper = groups["F.Cu"].join("");
  const mask = groups["F.Mask"].join("");
  const silk = groups["F.SilkS"].join("");
  if (!copper && !mask && !silk) return [];
  const composite =
    copper && mask
      ? `<defs><mask id="kicad-front-mask" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="black"/>${mask}</mask></defs><g mask="url(#kicad-front-mask)">${copper}</g>`
      : copper;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outline.width} ${outline.height}">${composite}${silk}</svg>`;
  return [
    {
      id: crypto.randomUUID(),
      name: "KiCad front artwork",
      imageDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      x: xOffset + outline.width / 2,
      y: yOffset + outline.height / 2,
      width: outline.width,
      height: outline.height,
      naturalW: outline.width,
      naturalH: outline.height,
      rotation: 0,
      opacity: 1,
      locked: true,
      visible: true,
      layer: "background",
      preserveAspectRatio: false,
      notes: "Imported from KiCad F.Cu, F.Mask and F.SilkS graphics.",
    },
  ];
}
function parseKiCadOutlineGeometry(src, outline, xOffset, yOffset) {
  if (!outline) return null;
  const point = (x, y) => ({
    x: x - outline.x + xOffset,
    y: y - outline.y + yOffset,
  });
  const candidates = [];
  for (const block of sexprBlocks(src, "gr_rect").filter((item) =>
    /\(layer\s+"?Edge\.Cuts"?\)/.test(item),
  )) {
    const start = block.match(/\(start\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    const end = block.match(/\(end\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    if (!start || !end) continue;
    const x1 = +start[1],
      y1 = +start[2],
      x2 = +end[1],
      y2 = +end[2];
    const corners = [
      point(x1, y1),
      point(x2, y1),
      point(x2, y2),
      point(x1, y2),
    ];
    candidates.push(
      corners.map((corner, index) => ({
        kind: "line",
        points: [corner, corners[(index + 1) % corners.length]],
      })),
    );
  }
  const loose = [];
  for (const block of sexprBlocks(src, "gr_line").filter((item) =>
    /\(layer\s+"?Edge\.Cuts"?\)/.test(item),
  )) {
    const start = block.match(/\(start\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    const end = block.match(/\(end\s+(-?[\d.]+)\s+(-?[\d.]+)\)/);
    if (start && end)
      loose.push({
        kind: "line",
        points: [point(+start[1], +start[2]), point(+end[1], +end[2])],
      });
  }
  for (const block of sexprBlocks(src, "gr_arc").filter((item) =>
    /\(layer\s+"?Edge\.Cuts"?\)/.test(item),
  )) {
    const get = (name) => {
      const match = block.match(
        new RegExp(`\\(${name}\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\)`),
      );
      return match ? { x: +match[1], y: +match[2] } : null;
    };
    const start = get("start"),
      mid = get("mid"),
      end = get("end");
    if (start && mid && end)
      loose.push({
        kind: "arc",
        points: kiCadArcPolyline(start, mid, end).map((item) =>
          point(item.x, item.y),
        ),
      });
  }
  const key = (item) =>
    `${Math.round(item.x * 100) / 100}:${Math.round(item.y * 100) / 100}`;
  const remaining = new Set(loose.map((_, index) => index));
  while (remaining.size) {
    const seed = remaining.values().next().value;
    remaining.delete(seed);
    const group = [loose[seed]];
    const endpoints = new Set([
      key(loose[seed].points[0]),
      key(loose[seed].points[loose[seed].points.length - 1]),
    ]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const index of [...remaining]) {
        const item = loose[index];
        const first = key(item.points[0]);
        const last = key(item.points[item.points.length - 1]);
        if (endpoints.has(first) || endpoints.has(last)) {
          remaining.delete(index);
          group.push(item);
          endpoints.add(first);
          endpoints.add(last);
          changed = true;
        }
      }
    }
    candidates.push(group);
  }
  const score = (group) => {
    const points = group.flatMap((item) => item.points);
    const xs = points.map((item) => item.x);
    const ys = points.map((item) => item.y);
    return (
      (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
    );
  };
  return candidates.sort((a, b) => score(b) - score(a))[0] || null;
}
function bestLibraryPartForKiCad(ref, fp, pads) {
  const hay = `${ref} ${fp}`.toLowerCase();
  const exactFind = (type) =>
    COMPONENT_LIBRARY.find((p) => p.type === type) || null;
  if (/DIP-8|DIODE_SOCKET|Package_DIP:DIP-8|Socket.*8/i.test(`${ref} ${fp}`))
    return exactFind("dip8socket");
  if (/Jack_3\.5mm_QingPu_WQP-PJ398SM|pj398sm|thonkiconn/i.test(`${ref} ${fp}`))
    return exactFind("jack");
  if (/Potentiometer_Alpha_RD901F|rd901f/i.test(`${ref} ${fp}`))
    return exactFind("pot9mm");
  if (
    /SW_Tact_Low_Profile_LED|thonk-sw-lp-led|low_profile_led/i.test(
      `${ref} ${fp}`,
    )
  )
    return exactFind("tactled");
  const maxDrill = Math.max(
    0,
    ...pads.map((p) => Math.max(p.drillW, p.drillH)),
  );
  const maxSize = Math.max(0, ...pads.map((p) => Math.max(p.sizeW, p.sizeH)));
  const slot = pads.find((p) => p.oval || Math.abs(p.drillW - p.drillH) > 1.0);
  const find = (type) => COMPONENT_LIBRARY.find((p) => p.type === type) || null;
  if (/ra4543/i.test(hay)) return find("fader45");
  if (/ra3043/i.test(hay)) return find("fader35");
  if (
    /fader|slider|slidepot|ra2045|rs?09|ptl/i.test(hay) ||
    (slot && Math.max(slot.drillW, slot.drillH) > 12)
  ) {
    const len = slot ? Math.max(slot.drillW, slot.drillH) : maxSize;
    if (len >= 40) return find("fader45");
    if (len >= 32) return find("fader35");
    return find(/led/i.test(hay) ? "fader20led" : "fader20");
  }
  if (/encoder|ec12|pec11/i.test(hay) || /^ENC/i.test(ref))
    return find("encoder");
  if (/jack|pj398|thonk|audio|conn_01x01|phone/i.test(hay))
    return maxDrill >= 8.5 ? find("slimjack") : find("jack");
  if (/led/i.test(hay) || /^LED/i.test(ref))
    return find(
      maxDrill >= 5.0 || /button|tact/i.test(hay) ? "tactled" : "led3mm",
    );
  if (/tact|fsm|button|push|sw_push/i.test(hay))
    return find(maxDrill >= 8.0 ? "momentary12" : "tact6mm");
  if (/slide.*switch|sub.?mini/i.test(hay)) return find("subMiniSwitch");
  if (/toggle|spdt|dpdt/i.test(hay)) return find("toggle");
  if (/rotary/i.test(hay)) return find("rotary8pos");
  if (/trimm?er|trim/i.test(hay)) return find("trimmer6mm");
  if (
    /pot|rv09|rk09|rd901|alpha|bourns/i.test(hay) ||
    /^RV/i.test(ref) ||
    /^POT/i.test(ref)
  ) {
    return maxDrill >= 7.1 || /16mm|rv16/i.test(hay)
      ? find("pot16mm")
      : find("pot9mm");
  }
  return null;
}
function rotateKiCadLocalOffset(dx, dy, deg) {
  const a = ((deg || 0) * Math.PI) / 180;
  const ca = Math.cos(a),
    sa = Math.sin(a);
  return { x: dx * ca + dy * sa, y: -dx * sa + dy * ca };
}
function normalizePanelRotation(deg) {
  const n = (((deg || 0) % 360) + 360) % 360;
  return Math.abs(n - 360) < 1e-6 ? 0 : Math.round(n * 1000) / 1000;
}
function kiCadRotationToPanelRotation(kicadDeg, offsetDeg = 0) {
  return normalizePanelRotation((kicadDeg || 0) + (offsetDeg || 0));
}
function roundKiCadPanelWidthToEurorackHP(widthMM) {
  const sourceHp = widthMM / HP_TO_MM;
  const hp = Math.max(2, Math.ceil(sourceHp - 1e-6));
  const roundedWidthMM = hp * HP_TO_MM;
  return {
    widthMM: roundedWidthMM,
    hp,
    rounded: Math.abs(roundedWidthMM - widthMM) > 0.01,
    sourceHp,
  };
}
function parseKiCadPcbToPanel(src, currentPanelWidthMM) {
  const warnings = [];
  const outline = boardOutlineFromKiCad(src);
  const footprints = sexprBlocks(src, "footprint");
  const raw = [];
  const mechanicalCutouts = boardCutoutsFromKiCad(src);
  let skippedNonPanelCount = 0;
  for (const fpBlock of footprints) {
    const at = parseAt(fpBlock);
    if (!at) continue;
    const fp = sexprHeadName(fpBlock);
    const ref = parseFpReference(fpBlock);
    const value = parseFpValue(fpBlock);
    const description = parseFpDescription(fpBlock);
    const pads = parseKiCadPads(fpBlock);
    const graphics = parseKiCadGraphicPrimitives(fpBlock);
    const def = bestLibraryPartForKiCad(`${ref} ${value}`, fp, pads);
    if (def) {
      raw.push({ ref, value, description, fp, fpBlock, at, pads, def });
      continue;
    }
    const footprintCutouts = [];
    for (const pad of pads.filter((item) => item.npth && item.drillW > 0)) {
      const offset = rotateKiCadLocalOffset(
        pad.atX || 0,
        pad.atY || 0,
        at.rot || 0,
      );
      const isSlot =
        pad.oval || Math.abs((pad.drillW || 0) - (pad.drillH || 0)) > 0.01;
      footprintCutouts.push({
        x: at.x + offset.x,
        y: at.y + offset.y,
        holeType: isSlot ? "slot" : undefined,
        holeDiameter: Math.min(pad.drillW, pad.drillH),
        slotLength: isSlot ? Math.max(pad.drillW, pad.drillH) : undefined,
        rotation: isSlot
          ? kiCadRotationToPanelRotation(
              at.rot || 0,
              (pad.atRot || 0) + (pad.drillW >= pad.drillH ? 90 : 0),
            )
          : 0,
        source: `NPTH pad in ${fp}`,
      });
    }
    for (const circle of graphics.circles.filter((item) =>
      /^Edge\.Cuts$/i.test(item.layer),
    )) {
      const offset = rotateKiCadLocalOffset(circle.cx, circle.cy, at.rot || 0);
      footprintCutouts.push({
        x: at.x + offset.x,
        y: at.y + offset.y,
        holeDiameter: circle.r * 2,
        rotation: 0,
        source: `Edge.Cuts circle in ${fp}`,
      });
    }
    for (const rect of graphics.rects.filter((item) =>
      /^Edge\.Cuts$/i.test(item.layer),
    )) {
      const centerX = rect.x + rect.w / 2;
      const centerY = rect.y + rect.h / 2;
      const offset = rotateKiCadLocalOffset(centerX, centerY, at.rot || 0);
      footprintCutouts.push({
        x: at.x + offset.x,
        y: at.y + offset.y,
        holeType: "rect",
        holeDiameter: Math.min(rect.w, rect.h),
        holeW: rect.w,
        holeH: rect.h,
        rotation: kiCadRotationToPanelRotation(at.rot || 0),
        source: `Edge.Cuts rectangle in ${fp}`,
      });
    }
    if (footprintCutouts.length) mechanicalCutouts.push(...footprintCutouts);
    else skippedNonPanelCount++;
  }
  if (!raw.length && !mechanicalCutouts.length && !outline) {
    const skippedMessage = skippedNonPanelCount
      ? `Ignored ${skippedNonPanelCount} footprints that are not recognized front-panel parts.`
      : "";
    return {
      components: [],
      boardOutline: outline,
      warnings: [
        "No recognized front-panel components found.",
        skippedMessage,
      ].filter(Boolean),
    };
  }
  if (skippedNonPanelCount)
    warnings.push(
      `Ignored ${skippedNonPanelCount} footprints that are not recognized front-panel parts.`,
    );
  const sourceXs = [
    ...raw.map((record) => record.at.x),
    ...mechanicalCutouts.map((cutout) => cutout.x),
  ];
  const sourceYs = [
    ...raw.map((record) => record.at.y),
    ...mechanicalCutouts.map((cutout) => cutout.y),
  ];
  const minX = outline?.x ?? Math.min(...sourceXs);
  const minY = outline?.y ?? Math.min(...sourceYs);
  const width =
    outline?.width ??
    Math.max(10, Math.max(...sourceXs) - Math.min(...sourceXs) + 20);
  const height =
    outline?.height ??
    Math.max(10, Math.max(...sourceYs) - Math.min(...sourceYs) + 20);
  const roundedPanel =
    outline?.width && outline.width > 5
      ? roundKiCadPanelWidthToEurorackHP(outline.width)
      : {
          widthMM: currentPanelWidthMM,
          hp: currentPanelWidthMM / HP_TO_MM,
          rounded: false,
          sourceHp: currentPanelWidthMM / HP_TO_MM,
        };
  const targetWidth = roundedPanel.widthMM;
  const xOffset = (targetWidth - width) / 2;
  const yOffset = outline
    ? Math.max(0, (PANEL_HEIGHT_MM - height) / 2)
    : (PANEL_HEIGHT_MM - height) / 2;
  const artworks = parseKiCadBoardArtwork(src, outline, xOffset, yOffset);
  const panelOutlineGeometry = parseKiCadOutlineGeometry(
    src,
    outline,
    xOffset,
    yOffset,
  );
  if (roundedPanel.rounded)
    warnings.push(
      `PCB Edge.Cuts width ${width.toFixed(2)} mm = ${roundedPanel.sourceHp.toFixed(2)} HP; rounded front panel to ${roundedPanel.hp} HP and centered imported components by ${xOffset.toFixed(2)} mm.`,
    );
  if (!outline)
    warnings.push(
      "No Edge.Cuts rectangle found. Footprints were centered on the current panel; verify origin manually.",
    );
  if (height > PANEL_HEIGHT_MM + 0.5)
    warnings.push(
      `Board outline height ${height.toFixed(2)} mm exceeds Eurorack 3U panel height ${PANEL_HEIGHT_MM} mm.`,
    );
  const refCounts = raw.reduce(
    (m, r) => (m.set(r.ref, (m.get(r.ref) || 0) + 1), m),
    new Map(),
  );
  const usedRefs = new Set();
  const components = raw.map((r, idx) => {
    const def = sanitizePart({
      ...r.def,
      verificationStatus: r.def.verificationStatus ?? "approximate",
    });
    const originalRef = r.ref || nextRefForComponent(def.type, []);
    const duplicatedOriginalRef = (refCounts.get(originalRef) || 0) > 1;
    let ref = originalRef;
    if (usedRefs.has(ref)) ref = `${ref}_${idx + 1}`;
    usedRefs.add(ref);
    const genericRepeatedRef =
      /^(J|RV|SW|D|LED|FDR|POT)\d*$/i.test(originalRef || "") &&
      r.value &&
      !/^\$?\{?value\}?$/i.test(r.value);
    const visibleLabel =
      duplicatedOriginalRef || genericRepeatedRef ? r.value : originalRef;
    const geom = kiCadFootprintGeometry(
      r.pads,
      parseKiCadGraphicPrimitives(r.fpBlock || ""),
      `${r.ref} ${r.value} ${r.description} ${r.fp}`,
    );
    const apertureOffset =
      geom && !geom.noPositionOffset
        ? rotateKiCadLocalOffset(
            geom.offsetX || 0,
            geom.offsetY || 0,
            r.at.rot || 0,
          )
        : { x: 0, y: 0 };
    const x = r.at.x + apertureOffset.x - minX + xOffset;
    const y = r.at.y + apertureOffset.y - minY + yOffset;
    const noteLines = [
      `Imported from KiCad footprint: ${r.fp}`,
      originalRef ? `Reference: ${originalRef}` : "",
      r.value ? `Value: ${r.value}` : "",
      r.description ? `Description: ${r.description}` : "",
      `KiCad rotation: ${Math.round((r.at.rot || 0) * 1000) / 1000}°`,
      geom?.rotationOffset
        ? `Import rotation offset: ${Math.round((geom.rotationOffset || 0) * 1000) / 1000}°`
        : "",
      geom && (Math.abs(geom.offsetX) > 0.001 || Math.abs(geom.offsetY) > 0.001)
        ? `PCB clearance/aperture anchor offset: ${geom.offsetX.toFixed(3)}, ${geom.offsetY.toFixed(3)} mm${geom.noPositionOffset ? " (recognition only)" : " (applied to position)"}`
        : "",
      geom?.anchorOnly
        ? geom.noPositionOffset
          ? "PCB-under-panel import: footprint position used for component center; aperture/clearance graphics used for recognition only; front-panel dimensions taken from component library."
          : "PCB-under-panel import: aperture/clearance center used as component center; front-panel dimensions taken from component library."
        : "",
    ].filter(Boolean);
    const comp = {
      ...def,
      ...(geom && !(geom.anchorOnly && def.type !== "custom")
        ? {
            holeDiameter: geom.holeDiameter || def.holeDiameter,
            frontDiameter: Math.max(
              def.frontDiameter || 0,
              geom.frontDiameter || 0,
            ),
            rearBodyW: Math.max(def.rearBodyW || 0, geom.rearBodyW || 0),
            rearBodyH: Math.max(def.rearBodyH || 0, geom.rearBodyH || 0),
            keepoutW: Math.max(def.keepoutW || 0, (geom.rearBodyW || 0) + 2),
            keepoutH: Math.max(def.keepoutH || 0, (geom.rearBodyH || 0) + 2),
          }
        : {}),
      id: crypto.randomUUID(),
      ref,
      label: visibleLabel,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      rotation: kiCadRotationToPanelRotation(
        r.at.rot || 0,
        geom?.rotationOffset || 0,
      ),
      notes: noteLines.join("\n"),
      locked: false,
    };
    if (geom?.holeType === "slot" && !geom.anchorOnly) {
      comp.holeType = "slot";
      comp.holeDiameter = geom.holeDiameter;
      comp.slotLength = geom.slotLength;
      comp.frontShape = "slot";
      comp.frontW = geom.frontW;
      comp.frontH = geom.frontH;
    } else if (geom?.holeType === "rect" && !geom.anchorOnly) {
      comp.holeType = "rect";
      comp.holeW = geom.holeW;
      comp.holeH = geom.holeH;
      comp.frontShape = "rect";
      comp.frontW = geom.frontW;
      comp.frontH = geom.frontH;
    }
    return comp;
  });
  const automaticMountingHoles = mountingHolesForPreset(
    targetWidth,
    "autoOval",
  );
  let standardMountingHoleCount = 0;
  let importedCutoutCount = 0;
  mechanicalCutouts.forEach((cutout, idx) => {
    const x = cutout.x - minX + xOffset;
    const y = cutout.y - minY + yOffset;
    if (
      automaticMountingHoles.some(
        (mountingHole) =>
          Math.hypot(x - mountingHole.x, y - mountingHole.y) <= 1.25,
      )
    ) {
      standardMountingHoleCount++;
      return;
    }
    const diameter = Math.max(0.1, cutout.holeDiameter || 0.1);
    const def = sanitizePart({
      type: "cutout",
      name: `KiCad cutout ${cutout.holeType === "rect" ? `${(cutout.holeW || diameter).toFixed(2)} × ${(cutout.holeH || diameter).toFixed(2)} mm` : cutout.holeType === "slot" ? `${diameter.toFixed(2)} × ${(cutout.slotLength || diameter).toFixed(2)} mm` : `Ø${diameter.toFixed(2)} mm`}`,
      holeDiameter: diameter,
      frontDiameter: diameter,
      rearBodyW: 0,
      rearBodyH: 0,
      rearDepth: 0,
      keepoutW:
        Math.max(cutout.holeW || 0, cutout.slotLength || 0, diameter) + 2,
      keepoutH:
        Math.max(cutout.holeH || 0, cutout.slotLength || 0, diameter) + 2,
      minSpacing: 1,
      category: "mechanical",
      topHardwareVisible: false,
      verificationStatus: "measured",
      snapTargetEnabled: true,
    });
    const component = {
      ...def,
      id: crypto.randomUUID(),
      ref: `CUT${importedCutoutCount + 1}`,
      label: "",
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      rotation: cutout.rotation || 0,
      notes: `Imported from KiCad mechanical ${cutout.source}.`,
      locked: false,
    };
    if (cutout.holeType === "slot") {
      component.holeType = "slot";
      component.slotLength = cutout.slotLength;
      component.frontShape = "slot";
      component.frontW = diameter;
      component.frontH = cutout.slotLength;
    } else if (cutout.holeType === "rect") {
      component.holeType = "rect";
      component.holeW = cutout.holeW;
      component.holeH = cutout.holeH;
      component.frontShape = "rect";
      component.frontW = cutout.holeW;
      component.frontH = cutout.holeH;
    }
    components.push(component);
    importedCutoutCount++;
  });
  if (importedCutoutCount)
    warnings.push(`Imported ${importedCutoutCount} mechanical panel cutouts.`);
  if (standardMountingHoleCount)
    warnings.push(
      `Matched ${standardMountingHoleCount} rail holes to automatic Eurorack mounting holes without duplicating them.`,
    );
  const offsetCount = components.filter((c) =>
    /Aperture offset:/i.test(c.notes || ""),
  ).length;
  if (offsetCount)
    warnings.push(
      `Applied local aperture offsets for ${offsetCount} footprints.`,
    );
  const knownCount = raw.filter((r) =>
    /PJ398SM|Thonkiconn|RD901F|SW_Tact_Low_Profile_LED|THONK-SW-LP-LED/i.test(
      `${r.fp} ${r.value}`,
    ),
  ).length;
  if (knownCount)
    warnings.push(
      `Used known front-panel footprint mapping for ${knownCount} footprints.`,
    );
  const anchorOnlyCount = components.filter((c) =>
    /PCB-under-panel import:/i.test(c.notes || ""),
  ).length;
  if (anchorOnlyCount)
    warnings.push(
      `Used PCB-under-panel mapping for ${anchorOnlyCount} parts; PJ398SM jacks and RD901F pots use rotated local aperture/shaft centers, LED tact switches keep footprint origins, and front-panel sizes stay from the component library.`,
    );
  return {
    components,
    artworks,
    panelOutlineGeometry,
    panelWidthMM: targetWidth,
    boardOutline: outline,
    warnings,
  };
}
/* ExportPreviewMini moved to ExportDialog.js */

/* ExportDialog moved to ExportDialog.js */
/* CommandPalette moved to AppOverlays.js */ /* factoryPart moved to FactoryTemplates.js */ /* makeFactoryTemplate moved to FactoryTemplates.js */ /* templateRecordFromFactoryTemplate moved to FactoryTemplates.js */ /* factoryPresetTemplates moved to FactoryTemplates.js */ /* loadFactoryTemplateRecords moved to FactoryTemplates.js */
/* TemplateRealisticPreview moved to TemplatesDialog.js */

/* TemplatesDialog moved to TemplatesDialog.js */
/* LocalProjectsDialog moved to AppOverlays.js */
/* CanvasQuickAddDock moved to MobileDock.js */
/* productionSeverityRank moved to AppOverlays.js */ /* productionRectsOverlap moved to AppOverlays.js */ /* productionRectInsidePanel moved to AppOverlays.js */ /* textApproxBounds moved to AppOverlays.js */ /* scaleApproxBounds moved to AppOverlays.js */ /* componentProductionFrontRect moved to AppOverlays.js */ /* buildProductionCheckItems moved to AppOverlays.js */ /* ProductionCheckDialog moved to AppOverlays.js */ /* ShortcutHelpOverlay moved to AppOverlays.js */ /* SelectionInfoStrip moved to AppOverlays.js */ /* avg moved to AppOverlays.js */
/* App moved to App.js */
