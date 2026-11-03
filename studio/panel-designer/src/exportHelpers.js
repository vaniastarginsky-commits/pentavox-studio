function buildArtworkSVGLines(artworks, layer, widthMM, heightMM, clip) {
  const visible = artworks.filter((a) => a.layer === layer && a.visible);
  if (visible.length === 0) return [];
  const out = [];
  const clipId = `export-clip-${layer}`;
  if (clip) {
    out.push(
      `  <defs><clipPath id="${clipId}"><rect x="0" y="0" width="${widthMM.toFixed(3)}" height="${heightMM.toFixed(3)}"/></clipPath></defs>`,
    );
  }
  out.push(`  <g${clip ? `clip-path="url(#${clipId})"` : ""}>`);
  for (const a of visible) {
    const x = (a.x - a.width / 2).toFixed(3);
    const y = (a.y - a.height / 2).toFixed(3);
    const transform =
      a.rotation !== 0
        ? ` transform="rotate(${a.rotation}, ${a.x.toFixed(3)}, ${a.y.toFixed(3)})"`
        : "";
    out.push(
      `    <image href="${a.imageDataUrl}" x="${x}" y="${y}" width="${a.width.toFixed(3)}" height="${a.height.toFixed(3)}" opacity="${a.opacity}" preserveAspectRatio="none"${transform}/>`,
    );
  }
  out.push(`  </g>`);
  return out;
}
function buildTextSVGLines(items, layer) {
  return items
    .filter((t) => t.layer === layer && t.visible)
    .map((t) => {
      const anchor =
        t.align === "left" ? "start" : t.align === "right" ? "end" : "middle";
      const rot = t.rotation
        ? ` transform="rotate(${t.rotation}, ${t.x.toFixed(3)}, ${t.y.toFixed(3)})"`
        : "";
      return `  <text x="${t.x.toFixed(3)}" y="${t.y.toFixed(3)}" font-size="${t.fontSizeMm.toFixed(3)}" font-family="${(t.fontFamily || TEXT_FONT_OPTIONS[0].value).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" text-anchor="${anchor}" opacity="${t.opacity}" fill="#111"${rot}>${t.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
    });
}
function buildScaleSVGLines(items, components, layer) {
  const out = [];
  const polar = (cx, cy, r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  for (const sc of items.filter((s) => s.layer === layer && s.visible)) {
    const c = sc.componentId
      ? components.find((x) => x.id === sc.componentId)
      : null;
    const cx = c?.x ?? sc.x,
      cy = c?.y ?? sc.y;
    const n = Math.max(2, sc.ticks);
    if (sc.kind === "fader" && !c) continue;
    if ((sc.kind === "fader" || (c && isFaderLike(c) && sc.side)) && c) {
      const b = getFrontBounds(c);
      const side = sc.side === "left" ? "left" : "right";
      const dir = side === "left" ? -1 : 1;
      const railW = Math.max(c.frontW || 0, b.w || 0, c.holeDiameter || 0, 5.0);
      const slotH = c.slotLength ?? b.h;
      const gap = Math.max(1.35, sc.tickLength * 1.15);
      const x0 = cx + dir * (railW / 2 + gap);
      const top = cy - slotH / 2;
      const bottom = cy + slotH / 2;
      const rot = c.rotation
        ? ` transform="rotate(${c.rotation}, ${cx.toFixed(3)}, ${cy.toFixed(3)})"`
        : "";
      out.push(`  <g${rot}>`);
      out.push(
        `    <line x1="${x0.toFixed(3)}" y1="${top.toFixed(3)}" x2="${x0.toFixed(3)}" y2="${bottom.toFixed(3)}" stroke="#111" stroke-width="0.10" opacity="0.72"/>`,
      );
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const y = bottom - t * slotH;
        const major = i % Math.max(1, sc.majorEvery) === 0;
        const len = major
          ? Math.max(1.0, sc.tickLength * 0.92)
          : Math.max(0.55, sc.tickLength * 0.48);
        out.push(
          `    <line x1="${x0.toFixed(3)}" y1="${y.toFixed(3)}" x2="${(x0 + dir * len).toFixed(3)}" y2="${y.toFixed(3)}" stroke="#111" stroke-width="${major ? 0.16 : 0.1}" opacity="${major ? 0.9 : 0.58}"/>`,
        );
        if (major && sc.labelMode !== "none") {
          const value =
            sc.labelMode === "0-10"
              ? Math.round(t * 10)
              : Math.round(-5 + t * 10);
          const showNumber =
            i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2);
          const anchor = side === "left" ? "end" : "start";
          if (showNumber)
            out.push(
              `    <text x="${(x0 + dir * (len + 0.62)).toFixed(3)}" y="${y.toFixed(3)}" font-size="${Math.min(sc.fontSizeMm, 0.86).toFixed(3)}" text-anchor="${anchor}" dominant-baseline="middle" fill="#111" opacity="0.86">${value}</text>`,
            );
        }
      }
      out.push("  </g>");
      continue;
    }
    const refR = c ? getScaleReferenceRadius(c) : 0;
    const maxOuterR = refR > 0 ? refR + 3.0 : Infinity;
    const baseR = refR > 0 ? Math.min(sc.radius, refR + 1.15) : sc.radius;
    const minorLen =
      refR > 0
        ? Math.min(
            Math.max(0.35, sc.tickLength * 0.75),
            Math.max(0.35, maxOuterR - baseR - 0.45),
          )
        : sc.tickLength;
    const majorLen =
      refR > 0
        ? Math.min(
            Math.max(minorLen, sc.tickLength * 1.15),
            Math.max(minorLen, maxOuterR - baseR - 0.25),
          )
        : sc.tickLength * 1.5;
    const fontSize = refR > 0 ? Math.min(sc.fontSizeMm, 1.15) : sc.fontSizeMm;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const deg = sc.startAngle + (sc.endAngle - sc.startAngle) * t;
      const major = i % Math.max(1, sc.majorEvery) === 0;
      const len = major ? majorLen : minorLen;
      const [x1, y1] = polar(cx, cy, baseR, deg);
      const [x2, y2] = polar(cx, cy, Math.min(baseR + len, maxOuterR), deg);
      out.push(
        `  <line x1="${x1.toFixed(3)}" y1="${y1.toFixed(3)}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}" stroke="#111" stroke-width="${major ? 0.24 : 0.15}"/>`,
      );
      if (major && sc.labelMode !== "none") {
        const labelR =
          refR > 0
            ? Math.min(baseR + len + fontSize * 0.55, maxOuterR)
            : baseR + len + fontSize * 1.2;
        const [lx, ly] = polar(cx, cy, labelR, deg);
        const label =
          sc.labelMode === "0-10"
            ? String(Math.round(t * 10))
            : String(Math.round(-5 + t * 10));
        out.push(
          `  <text x="${lx.toFixed(3)}" y="${ly.toFixed(3)}" font-size="${fontSize.toFixed(3)}" text-anchor="middle" dominant-baseline="middle" fill="#111">${label}</text>`,
        );
      }
    }
  }
  return out;
}
function buildTopHardwareSVGLines(components) {
  const out = [];
  for (const c of components.filter(topHardwareVisible)) {
    const col = topColor(c);
    if (isPotLike(c)) {
      const d = visualKnobDiameter(c);
      out.push(
        `  <circle cx="${c.x.toFixed(3)}" cy="${c.y.toFixed(3)}" r="${(d / 2).toFixed(3)}" fill="${col}" stroke="#777" stroke-width="0.35"/>`,
      );
      out.push(
        `  <line x1="${c.x.toFixed(3)}" y1="${c.y.toFixed(3)}" x2="${c.x.toFixed(3)}" y2="${(c.y - d * 0.38).toFixed(3)}" stroke="#eee" stroke-width="0.45" stroke-linecap="round"/>`,
      );
    } else if (isFaderLike(c)) {
      const capW = c.faderHandleW ?? Math.max(7, (c.frontW ?? 9) * 1.15),
        capH = c.faderHandleH ?? 5;
      const rot = c.rotation
        ? ` transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})"`
        : "";
      out.push(
        `  <rect x="${(c.x - capW / 2).toFixed(3)}" y="${(c.y - capH / 2).toFixed(3)}" width="${capW.toFixed(3)}" height="${capH.toFixed(3)}" rx="1.5" fill="${col}" stroke="#111" stroke-width="0.35"${rot}/>`,
      );
    } else if (isJackLike(c)) {
      const outer = Math.max(c.frontDiameter, 8) / 2;
      out.push(
        `  <circle cx="${c.x.toFixed(3)}" cy="${c.y.toFixed(3)}" r="${outer.toFixed(3)}" fill="${col}" stroke="#777" stroke-width="0.3"/>`,
      );
      out.push(
        `  <circle cx="${c.x.toFixed(3)}" cy="${c.y.toFixed(3)}" r="${Math.max(1.5, c.holeDiameter * 0.32).toFixed(3)}" fill="#050505"/>`,
      );
    } else if (isButtonLike(c) || isLedLike(c)) {
      const r = visualButtonRadius(c);
      out.push(
        `  <circle cx="${c.x.toFixed(3)}" cy="${c.y.toFixed(3)}" r="${r.toFixed(3)}" fill="${col}" stroke="#777" stroke-width="0.3"/>`,
      );
    } else if (c.type === "toggle" || c.type === "toggleSpdt") {
      const rot = c.rotation
        ? ` transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})"`
        : "";
      out.push(
        `  <g${rot}><circle cx="${c.x.toFixed(3)}" cy="${c.y.toFixed(3)}" r="${(c.frontDiameter / 2).toFixed(3)}" fill="${col}"/><line x1="${c.x.toFixed(3)}" y1="${c.y.toFixed(3)}" x2="${c.x.toFixed(3)}" y2="${(c.y - 8).toFixed(3)}" stroke="${col}" stroke-width="1.2" stroke-linecap="round"/></g>`,
      );
    }
  }
  return out;
}
function drillTableText(state) {
  const header = "Label	Type	X mm	Y mm	Rotation	Hole	Slot length	Rear depth";
  const rows = state.components.map((c) =>
    [
      c.label || c.name,
      c.type,
      c.x.toFixed(3),
      c.y.toFixed(3),
      c.rotation.toFixed(1),
      c.holeDiameter,
      c.slotLength ?? "",
      c.rearDepth,
    ].join("	"),
  );
  return [header, ...rows].join("\n");
}
function copyDrillTableText(state) {
  const text = drillTableText(state);
  if (navigator.clipboard && window.isSecureContext)
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  else fallbackCopy(text);
}
function exportPrintableTemplate(state) {
  const widthMM = panelWidthMM(state.panel);
  const heightMM = PANEL_HEIGHT_MM;
  const rulerY = heightMM + 12;
  const refs = state.components
    .map(
      (c) =>
        `<text x="${c.x.toFixed(3)}" y="${(c.y - 3).toFixed(3)}" font-size="2" text-anchor="middle">${c.ref || ""}</text>`,
    )
    .join("\n");
  const holes = state.components
    .map((c) =>
      c.holeType === "slot"
        ? `<rect x="${(c.x - c.holeDiameter / 2).toFixed(3)}" y="${(c.y - (c.slotLength ?? c.holeDiameter) / 2).toFixed(3)}" width="${c.holeDiameter.toFixed(3)}" height="${(c.slotLength ?? c.holeDiameter).toFixed(3)}" rx="${(c.holeDiameter / 2).toFixed(3)}" fill="none" stroke="black" stroke-width="0.25" transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})"/>`
        : `<circle cx="${c.x.toFixed(3)}" cy="${c.y.toFixed(3)}" r="${(c.holeDiameter / 2).toFixed(3)}" fill="none" stroke="black" stroke-width="0.25"/>`,
    )
    .join("\n");
  const mounting = state.mountingHoles.enabled
    ? state.mountingHoles.holes
        .map((h) =>
          state.mountingHoles.holeShape === "oval"
            ? `<rect x="${(h.x - Math.max(state.mountingHoles.ovalLength ?? 4.8, MOUNTING_HOLE_DIAMETER_MM) / 2).toFixed(3)}" y="${(h.y - MOUNTING_HOLE_DIAMETER_MM / 2).toFixed(3)}" width="${Math.max(state.mountingHoles.ovalLength ?? 4.8, MOUNTING_HOLE_DIAMETER_MM).toFixed(3)}" height="${MOUNTING_HOLE_DIAMETER_MM.toFixed(3)}" rx="${(MOUNTING_HOLE_DIAMETER_MM / 2).toFixed(3)}" fill="none" stroke="black" stroke-width="0.25"/>`
            : `<circle cx="${h.x.toFixed(3)}" cy="${h.y.toFixed(3)}" r="${(MOUNTING_HOLE_DIAMETER_MM / 2).toFixed(3)}" fill="none" stroke="black" stroke-width="0.25"/>`,
        )
        .join("\n")
    : "";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="-10 -10 210 297">
  <text x="0" y="-3" font-size="3">1:1 Eurorack panel template — verify printer scale</text>
  <rect x="0" y="0" width="${widthMM.toFixed(3)}" height="${heightMM.toFixed(3)}" fill="none" stroke="black" stroke-width="0.35"/>
  ${holes}
  ${refs}
  ${mounting}
  <line x1="0" y1="${rulerY}" x2="100" y2="${rulerY}" stroke="black" stroke-width="0.4"/>
  <line x1="0" y1="${rulerY - 2}" x2="0" y2="${rulerY + 2}" stroke="black" stroke-width="0.4"/>
  <line x1="100" y1="${rulerY - 2}" x2="100" y2="${rulerY + 2}" stroke="black" stroke-width="0.4"/>
  <text x="0" y="${rulerY + 6}" font-size="3">100 mm calibration ruler</text>
</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "panel-print-template-1to1.svg";
  a.click();
  URL.revokeObjectURL(url);
}
function exportPrintTemplatePDF(state) {
  const widthMM = panelWidthMM(state.panel);
  const H = PANEL_HEIGHT_MM;
  const svgContent = exportSVGString(state, {
    drillOnly: false,
    labels: true,
    includeArtwork: true,
    centerMarks: true,
    mountingKeepouts: false,
    rearKeepout: false,
    rearBody: false,
  });
  const pageW = (widthMM + 20).toFixed(1);
  const pageH = (H + 30).toFixed(1);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: ${pageW}mm ${pageH}mm; margin: 8mm; }
  body { margin: 0; font: 8pt sans-serif; }
  .note { margin-bottom: 3mm; color: #555; }
  svg { width: ${widthMM.toFixed(1)}mm; height: ${H.toFixed(1)}mm; display: block; }
  .ruler { margin-top: 4mm; border-top: 0.4pt solid black; width: 100mm; }
  .ruler-label { font: 7pt sans-serif; color: #555; margin-top: 1mm; }
</style>
</head>
<body>
<p class="note">1:1 Eurorack panel template &mdash; ${widthMM.toFixed(2)}&nbsp;&times;&nbsp;${H}&nbsp;mm &mdash; verify scale with ruler</p>
${svgContent}
<div class="ruler"></div>
<p class="ruler-label">100&nbsp;mm calibration ruler above &mdash; measure before printing</p>
<script>window.print();</script>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url);
}
function exportDocumentationPDF(state, warnings) {
  const widthMM = panelWidthMM(state.panel);
  const H = PANEL_HEIGHT_MM;
  const projectName = state.projectMeta?.name || "Eurorack Panel";
  const panelSVG = exportSVGString(state, {
    drillOnly: false,
    labels: true,
    includeArtwork: true,
    centerMarks: false,
    mountingKeepouts: false,
    rearKeepout: false,
    rearBody: false,
  });
  const rows = drillTableRows(state, warnings);
  const tableHeaders = [
    "Ref",
    "Label",
    "Type",
    "Name",
    "X mm",
    "Y mm",
    "Rot°",
    "Hole type",
    "Ø/W mm",
    "H mm",
    "Status",
    "Warn",
  ];
  function escHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  // drillTableRows columns: 0=ref,1=label,2=type,3=name,6=verification,
  // 7=x,8=y,9=rot,10=holeType,11=holeW,12=holeH,20=warnCount
  const tableRows = rows
    .map(
      (r) =>
        `<tr>${[
          r[0],
          r[1],
          r[2],
          r[3],
          r[7],
          r[8],
          r[9],
          r[10],
          r[11],
          r[12],
          r[6],
          r[20],
        ]
          .map((v) => `<td>${escHtml(v)}</td>`)
          .join("")}</tr>`,
    )
    .join("\n");
  const hard = warnings.filter((w) => w.severity === "error").length;
  const warn = warnings.filter((w) => w.severity !== "error").length;
  const warningRows = warnings
    .map(
      (w) =>
        `<tr class="${w.severity}"><td>${escHtml(w.severity)}</td><td>${escHtml(w.message)}</td></tr>`,
    )
    .join("\n");
  const warningsSection =
    warnings.length > 0
      ? `<div class="section page-break">
<h2>DFM status &mdash; ${hard} errors, ${warn} warnings</h2>
<table><thead><tr><th>Level</th><th>Message</th></tr></thead>
<tbody>${warningRows}</tbody></table>
</div>`
      : "";
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escHtml(projectName)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { margin: 0; font: 9pt sans-serif; }
  h1 { font-size: 13pt; margin: 0 0 3mm; }
  h2 { font-size: 11pt; margin: 0 0 3mm; }
  .panel-section { text-align: center; page-break-after: always; }
  .panel-section svg { max-width: 100%; height: auto; }
  .page-break { page-break-before: always; }
  table { border-collapse: collapse; width: 100%; font-size: 8pt; }
  th, td { border: 1px solid #ccc; padding: 1.5pt 3pt; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  tr.error td { color: #c00; }
  tr.warn td { color: #a60; }
  .meta { color: #555; font-size: 8pt; margin-bottom: 4mm; }
</style>
</head>
<body>
<div class="panel-section">
  <h1>${escHtml(projectName)}</h1>
  <p class="meta">${state.panel.widthHP}HP &mdash; ${widthMM.toFixed(2)}&times;${H}&nbsp;mm &mdash; ${state.components.length} components</p>
  ${panelSVG}
</div>
<div class="page-break">
  <h2>Component table</h2>
  <table>
    <thead><tr>${tableHeaders.map((h) => `<th>${escHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>
${warningsSection}
<script>window.print();</script>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url);
}
function drillTableRows(state, warnings) {
  return state.components.map((c) => {
    const warnCount = warnings.filter((w) => w.ids.includes(c.id)).length;
    const holeW =
      c.holeType === "rect" ? (c.holeW ?? c.holeDiameter) : c.holeDiameter;
    const holeH =
      c.holeType === "slot"
        ? (c.slotLength ?? c.holeDiameter)
        : c.holeType === "rect"
          ? (c.holeH ?? c.holeDiameter)
          : "";
    const fb = getFrontBounds(c);
    return [
      c.ref || "",
      c.label || "",
      c.type,
      c.name,
      c.manufacturer || "",
      c.partNumber || "",
      c.verificationStatus || "approximate",
      c.x.toFixed(3),
      c.y.toFixed(3),
      (c.rotation || 0).toFixed(1),
      c.holeType || "circle",
      holeW,
      holeH,
      getFrontShape(c),
      fb.w.toFixed(2),
      fb.h.toFixed(2),
      c.rearBodyW,
      c.rearBodyH,
      c.rearDepth,
      c.keepoutW,
      c.keepoutH,
      warnCount,
    ];
  });
}
function exportCSVDrillTable(state, warnings) {
  downloadTextFile(
    "drill-table.csv",
    drillTableCSVString(state, warnings),
    "text/csv",
  );
}
function exportKiCadPlacementCSV(state) {
  const header = [
    "Ref",
    "Type",
    "Value",
    "X_mm",
    "Y_mm",
    "Rotation_deg",
    "Hole_type",
    "Hole_D_or_W",
    "Slot_or_H",
    "Part_name",
    "Manufacturer",
    "Part_number",
  ];
  const rows = state.components.map((c) =>
    [
      c.ref || "",
      c.type,
      c.label || c.name,
      c.x.toFixed(3),
      c.y.toFixed(3),
      (c.rotation || 0).toFixed(1),
      c.holeType || "circle",
      (c.holeType === "rect"
        ? (c.holeW ?? c.holeDiameter)
        : c.holeDiameter
      ).toFixed(3),
      (c.holeType === "slot"
        ? (c.slotLength ?? c.holeDiameter)
        : c.holeType === "rect"
          ? (c.holeH ?? c.holeDiameter)
          : ""
      ).toString(),
      c.name,
      c.manufacturer || "",
      c.partNumber || "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  downloadTextFile(
    "kicad-placement-helper.csv",
    [header.join(","), ...rows].join("\n"),
    "text/csv",
  );
}
function dxfLine(x1, y1, x2, y2, layer = "CUT") {
  return `0\nLINE\n8\n${layer}\n10\n${x1.toFixed(4)}\n20\n${y1.toFixed(4)}\n11\n${x2.toFixed(4)}\n21\n${y2.toFixed(4)}\n`;
}
function dxfCircle(x, y, r, layer = "CUT") {
  return `0\nCIRCLE\n8\n${layer}\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n40\n${r.toFixed(4)}\n`;
}
function dxfRect(cx, cy, w, h, rot, layer = "CUT") {
  const hw = w / 2,
    hh = h / 2,
    a = degToRad(rot),
    co = Math.cos(a),
    si = Math.sin(a);
  const pts = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co]);
  return pts
    .map((p, i) =>
      dxfLine(p[0], p[1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1], layer),
    )
    .join("");
}
function dxfSlot(cx, cy, w, h, rot, layer = "CUT") {
  const a = degToRad(rot),
    co = Math.cos(a),
    si = Math.sin(a);
  const off = Math.max(0, (h - w) / 2);
  const p1 = [cx - off * si, cy + off * co];
  const p2 = [cx + off * si, cy - off * co];
  return (
    dxfRect(cx, cy, w, h, rot, layer) +
    dxfCircle(p1[0], p1[1], w / 2, layer) +
    dxfCircle(p2[0], p2[1], w / 2, layer)
  );
}
function exportDXF(state) {
  const widthMM = panelWidthMM(state.panel),
    h = PANEL_HEIGHT_MM;
  let out = "0\nSECTION\n2\nENTITIES\n";
  out += dxfRect(widthMM / 2, h / 2, widthMM, h, 0, "PANEL");
  if (state.mountingHoles.enabled)
    for (const mh of state.mountingHoles.holes) {
      if (state.mountingHoles.holeShape === "oval")
        out += dxfSlot(
          mh.x,
          mh.y,
          MOUNTING_HOLE_DIAMETER_MM,
          Math.max(
            state.mountingHoles.ovalLength ?? 4.8,
            MOUNTING_HOLE_DIAMETER_MM,
          ),
          90,
          "MOUNT",
        );
      else out += dxfCircle(mh.x, mh.y, MOUNTING_HOLE_DIAMETER_MM / 2, "MOUNT");
    }
  for (const c of state.components) {
    if (c.holeType === "slot")
      out += dxfSlot(
        c.x,
        c.y,
        c.holeDiameter,
        c.slotLength ?? c.holeDiameter,
        c.rotation,
        "CUT",
      );
    else if (isDip8Socket(c))
      dip8SocketHoleCenters(c).forEach((p) => {
        out += dxfCircle(p.x, p.y, c.holeDiameter / 2, "DRILL");
      });
    else if (isJoystick(c)) {
      out += dxfCircle(c.x, c.y, c.holeDiameter / 2, "CUT");
      joystickMountHoles(c).forEach((p) => {
        out += dxfCircle(p.x, p.y, p.r, "DRILL");
      });
    } else if (c.holeType === "rect")
      out += dxfRect(
        c.x,
        c.y,
        c.holeW ?? c.frontW ?? c.holeDiameter,
        c.holeH ?? c.frontH ?? c.holeDiameter,
        c.rotation,
        "CUT",
      );
    else out += dxfCircle(c.x, c.y, c.holeDiameter / 2, "DRILL");
  }
  out += "0\nENDSEC\n0\nEOF\n";
  const blob = new Blob([out], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "panel-cut-drill.dxf";
  a.click();
  URL.revokeObjectURL(url);
}
function exportEagleSCR(state) {
  const W = panelWidthMM(state.panel);
  const H = PANEL_HEIGHT_MM;
  function ex(x) {
    return x.toFixed(3);
  }
  function ey(y) {
    return (H - y).toFixed(3);
  }
  function eagleCorners(cx, cy, hw, hh, rot) {
    const a = degToRad(rot || 0),
      co = Math.cos(a),
      si = Math.sin(a);
    return [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ].map(([dx, dy]) => [cx + dx * co - dy * si, cy + dx * si + dy * co]);
  }
  function wireRect(corners) {
    const pts = [...corners, corners[0]];
    return "WIRE " + pts.map(([x, y]) => `(${ex(x)} ${ey(y)})`).join(" ") + ";";
  }
  const out = [];
  out.push("GRID MM;");
  out.push("SET WIRE_BEND 2;");
  out.push("");
  out.push("LAYER 20 Dimension;");
  out.push(
    `WIRE (0.000 0.000) (${ex(W)} 0.000) (${ex(W)} ${ex(H)}) (0.000 ${ex(H)}) (0.000 0.000);`,
  );
  out.push("");
  if (state.mountingHoles.enabled) {
    for (const mh of state.mountingHoles.holes) {
      if (state.mountingHoles.holeShape === "oval") {
        const ow = Math.max(
          state.mountingHoles.ovalLength ?? 4.8,
          MOUNTING_HOLE_DIAMETER_MM,
        );
        const off = Math.max(0, (ow - MOUNTING_HOLE_DIAMETER_MM) / 2);
        out.push(
          `HOLE ${MOUNTING_HOLE_DIAMETER_MM.toFixed(3)} (${ex(mh.x)} ${(H - mh.y - off).toFixed(3)});`,
        );
        out.push(
          `HOLE ${MOUNTING_HOLE_DIAMETER_MM.toFixed(3)} (${ex(mh.x)} ${(H - mh.y + off).toFixed(3)});`,
        );
        out.push("LAYER 46 Milling;");
        out.push(
          wireRect(
            eagleCorners(mh.x, mh.y, MOUNTING_HOLE_DIAMETER_MM / 2, ow / 2, 0),
          ),
        );
      } else {
        out.push(
          `HOLE ${MOUNTING_HOLE_DIAMETER_MM.toFixed(3)} (${ex(mh.x)} ${ey(mh.y)});`,
        );
      }
    }
    out.push("");
  }
  for (const c of state.components) {
    if (isDip8Socket(c)) {
      for (const p of dip8SocketHoleCenters(c)) {
        out.push(`HOLE ${c.holeDiameter.toFixed(3)} (${ex(p.x)} ${ey(p.y)});`);
      }
    } else if (isJoystick(c)) {
      out.push(`HOLE ${c.holeDiameter.toFixed(3)} (${ex(c.x)} ${ey(c.y)});`);
      for (const p of joystickMountHoles(c)) {
        out.push(`HOLE ${(p.r * 2).toFixed(3)} (${ex(p.x)} ${ey(p.y)});`);
      }
    } else if (c.holeType === "slot") {
      const sl = c.slotLength ?? c.holeDiameter;
      const a = degToRad(c.rotation || 0);
      const off = Math.max(0, (sl - c.holeDiameter) / 2);
      const p1x = c.x - off * Math.sin(a);
      const p1y = c.y + off * Math.cos(a);
      const p2x = c.x + off * Math.sin(a);
      const p2y = c.y - off * Math.cos(a);
      out.push(`HOLE ${c.holeDiameter.toFixed(3)} (${ex(p1x)} ${ey(p1y)});`);
      out.push(`HOLE ${c.holeDiameter.toFixed(3)} (${ex(p2x)} ${ey(p2y)});`);
      out.push("LAYER 46 Milling;");
      out.push(
        wireRect(
          eagleCorners(c.x, c.y, c.holeDiameter / 2, sl / 2, c.rotation || 0),
        ),
      );
    } else if (c.holeType === "rect") {
      const rw = c.holeW ?? c.frontW ?? c.holeDiameter;
      const rh = c.holeH ?? c.frontH ?? c.holeDiameter;
      out.push("LAYER 46 Milling;");
      out.push(
        wireRect(eagleCorners(c.x, c.y, rw / 2, rh / 2, c.rotation || 0)),
      );
    } else {
      out.push(`HOLE ${c.holeDiameter.toFixed(3)} (${ex(c.x)} ${ey(c.y)});`);
    }
  }
  out.push("");
  const base = safeProjectFileName(
    state.projectMeta?.name || "panel-layout",
  ).replace(/\.json$/i, "");
  downloadTextFile(`${base}__eagle.scr`, out.join("\n"), "text/plain");
}
function getManufacturingIssues(state, warnings) {
  const issues = [];
  const profile = DFM_PROFILES[state.dfmProfile || "generic"];
  const unverified = state.components.filter((c) => !isPartVerified(c));
  if (warnings.some((w) => w.severity === "error"))
    issues.push({
      level: "error",
      message: `${warnings.filter((w) => w.severity === "error").length} hard collision/geometry errors`,
    });
  if (warnings.some((w) => w.severity === "warn"))
    issues.push({
      level: "warn",
      message: `${warnings.filter((w) => w.severity === "warn").length} warnings`,
    });
  if (unverified.length)
    issues.push({
      level: "warn",
      message: `${unverified.length} parts are not measured/production verified`,
    });
  for (const c of state.components) {
    const cutW =
      c.holeType === "rect" ? (c.holeW ?? c.holeDiameter) : c.holeDiameter;
    const cutLen =
      c.holeType === "slot"
        ? (c.slotLength ?? c.holeDiameter)
        : c.holeType === "rect"
          ? (c.holeH ?? c.holeDiameter)
          : c.holeDiameter;
    if (cutW < (c.holeType === "slot" ? profile.minSlot : profile.minHole))
      issues.push({
        level: "warn",
        message: `${c.ref || c.label}: cut width ${cutW}mm is below ${profile.name} minimum ${c.holeType === "slot" ? profile.minSlot : profile.minHole}mm`,
      });
    if (c.holeType === "slot" && cutLen < profile.minSlot)
      issues.push({
        level: "warn",
        message: `${c.ref || c.label}: slot length ${cutLen}mm is very small for ${profile.name}`,
      });
    if (c.rearDepth > state.depthSettings.caseDepthLimitMm)
      issues.push({
        level: "error",
        message: `${c.ref || c.label}: rear depth ${c.rearDepth}mm exceeds case limit ${state.depthSettings.caseDepthLimitMm}mm`,
      });
    if (state.pcb.enabled && c.rearBodyW > 0) {
      const e = obbEdgeExtents(makeBodyOBB(c));
      if (
        e.x1 < state.pcb.x ||
        e.x2 > state.pcb.x + state.pcb.width ||
        e.y1 < state.pcb.y ||
        e.y2 > state.pcb.y + state.pcb.height
      )
        issues.push({
          level: "warn",
          message: `${c.ref || c.label}: rear body is outside PCB outline`,
        });
    }
  }
  if (!state.components.length)
    issues.push({ level: "info", message: "No components on panel" });
  return issues;
}
function manufacturingStatus(state, warnings) {
  const issues = getManufacturingIssues(state, warnings);
  if (issues.some((i) => i.level === "error"))
    return "NOT READY FOR MANUFACTURING";
  if (issues.some((i) => i.level === "warn"))
    return "OK FOR MOCKUP / PROTOTYPE CHECK";
  return "OK FOR PROTOTYPE EXPORT";
}
function bomRows(state) {
  const map = new Map();
  for (const c of state.components) {
    const key = [
      c.name,
      c.manufacturer || "",
      c.partNumber || "",
      c.verificationStatus || "approximate",
    ].join("|");
    const row = map.get(key) || {
      qty: 0,
      name: c.name,
      manufacturer: c.manufacturer || "",
      mpn: c.partNumber || "",
      verification: verificationLabel(c.verificationStatus),
      refs: [],
    };
    row.qty++;
    row.refs.push(c.ref || c.label || c.name);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function manufacturingReportText(state, warnings) {
  const issues = getManufacturingIssues(state, warnings);
  const bom = bomRows(state)
    .map(
      (r) =>
        `- ${r.qty}× ${r.name}${r.mpn ? `(${r.mpn})` : ""}${r.verification ? `—${r.verification}` : ""} — ${r.refs.join(", ")}`,
    )
    .join("\n");
  return `# Eurorack Panel Manufacturing Check\n\nStatus: ${manufacturingStatus(state, warnings)}\nPanel: ${state.panel.widthHP}HP / ${panelWidthMM(state.panel).toFixed(2)} × ${PANEL_HEIGHT_MM} mm\nComponents: ${state.components.length}\nMax rear depth: ${computeMaxDepth(state.components).toFixed(1)} mm\n\n## Issues\n${issues.length ? issues.map((i) => `-[${i.level.toUpperCase()}]${i.message}`).join("\n") : "- None"}\n\n## BOM\n${bom || "- Empty"}\n\n## Drill table\n${drillTableText(state, warnings)}\n`;
}
function exportManufacturingReport(state, warnings) {
  const blob = new Blob([manufacturingReportText(state, warnings)], {
    type: "text/markdown",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "manufacturing-check-report.md";
  a.click();
  URL.revokeObjectURL(url);
}
function copyManufacturingReport(state, warnings) {
  const text = manufacturingReportText(state, warnings);
  if (navigator.clipboard && window.isSecureContext)
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  else fallbackCopy(text);
}
function exportSVGMode(state, mode, warnings) {
  if (mode === "drill")
    return exportSVG(state, {
      drillOnly: true,
      labels: false,
      rearKeepout: false,
      rearBody: false,
      centerMarks: true,
      mountingKeepouts: true,
      includeArtwork: false,
    });
  if (mode === "artwork")
    return exportSVG(state, {
      drillOnly: false,
      labels: true,
      rearKeepout: false,
      rearBody: false,
      centerMarks: false,
      mountingKeepouts: false,
      includeArtwork: true,
    });
  return exportSVG(state, {
    drillOnly: false,
    labels: true,
    rearKeepout: false,
    rearBody: false,
    centerMarks: true,
    mountingKeepouts: true,
    includeArtwork: true,
  });
}
function extractSVGInnerContent(svg) {
  const match = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>\s*$/i);
  return (match?.[1] || "").trim();
}
function indentSVGBlock(svgBody, spaces = 4) {
  const pad = " ".repeat(Math.max(0, spaces));
  return svgBody
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}
function exportLayeredSVGString(state, opts) {
  const widthMM = panelWidthMM(state.panel);
  const heightMM = PANEL_HEIGHT_MM;
  function escapeXml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  const layerDefs = [];
  if (opts.svgLayeredPanelBase)
    layerDefs.push({
      id: "panel-base",
      label: "Panel base",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: false,
        includeText: false,
        transparentBg: false,
        includePanelOutline: true,
      }),
    });
  if (opts.svgLayeredArtwork)
    layerDefs.push({
      id: "artwork",
      label: "Artwork",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: true,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  if (opts.svgLayeredHoles)
    layerDefs.push({
      id: "holes",
      label: "Holes",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: true,
        includeArtwork: false,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  if (opts.svgLayeredComponents)
    layerDefs.push({
      id: "components",
      label: "Components",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: true,
        includeHoles: false,
        includeArtwork: false,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  if (opts.svgLayeredText)
    layerDefs.push({
      id: "text",
      label: "Text",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: false,
        includeText: true,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  const groups = layerDefs.map((layer) => {
    const inner = extractSVGInnerContent(layer.svg);
    const simpleId = `Layer_${layer.id.replace(/[^A-Za-z0-9]+/g, "_")}`;
    return `  <g id="${simpleId}" inkscape:groupmode="layer" inkscape:label="${escapeXml(layer.label)}" data-layer-id="${escapeXml(layer.id)}">\n    <title>${escapeXml(layer.label)}</title>\n${indentSVGBlock(inner, 4)}\n  </g>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Eurorack Panel Designer layered SVG export -->
<!-- Panel: ${state.panel.widthHP}HP = ${widthMM.toFixed(2)}mm x ${heightMM}mm -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  viewBox="0 0 ${widthMM.toFixed(3)} ${heightMM.toFixed(3)}"
  width="${widthMM.toFixed(3)}mm" height="${heightMM.toFixed(3)}mm">
${groups.join("\n")}
</svg>`;
}
