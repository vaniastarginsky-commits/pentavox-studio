function exportLayeredSVG(state, opts) {
  const selected = [
    opts.svgLayeredPanelBase,
    opts.svgLayeredArtwork,
    opts.svgLayeredHoles,
    opts.svgLayeredComponents,
    opts.svgLayeredText,
  ].some(Boolean);
  if (!selected) {
    alert("Select at least one layered SVG layer.");
    return;
  }
  const base = safeProjectFileName(
    state.projectMeta?.name || "panel-layout",
  ).replace(/\.json$/i, "");
  downloadTextFile(
    `${base}__layers.svg`,
    exportLayeredSVGString(state, opts),
    "image/svg+xml",
  );
}
function layeredSVGSeparateFiles(state, opts) {
  const base = safeProjectFileName(
    state.projectMeta?.name || "panel-layout",
  ).replace(/\.json$/i, "");
  const files = [];
  if (opts.svgLayeredPanelBase)
    files.push([
      `${base}__layer_01_panel-base.svg`,
      exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: false,
        includeText: false,
        transparentBg: false,
        includePanelOutline: true,
      }),
      "image/svg+xml",
    ]);
  if (opts.svgLayeredArtwork)
    files.push([
      `${base}__layer_02_artwork.svg`,
      exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: true,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
      "image/svg+xml",
    ]);
  if (opts.svgLayeredHoles)
    files.push([
      `${base}__layer_03_holes.svg`,
      exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: true,
        includeArtwork: false,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
      "image/svg+xml",
    ]);
  if (opts.svgLayeredComponents)
    files.push([
      `${base}__layer_04_components.svg`,
      exportPNGSVGString(state, opts, {
        includeComponents: true,
        includeHoles: false,
        includeArtwork: false,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
      "image/svg+xml",
    ]);
  if (opts.svgLayeredText)
    files.push([
      `${base}__layer_05_text.svg`,
      exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: false,
        includeText: true,
        transparentBg: true,
        includePanelOutline: false,
      }),
      "image/svg+xml",
    ]);
  files.push([
    `${base}__layered-svg-readme.txt`,
    `Layered SVG package\n\nSVG has no fully universal layer model.Some apps open one SVG as groups,not native layers.\nThis ZIP gives every layer as a separate same-size SVG so you can import/place them as separate layers in Photoshop,Illustrator,Affinity,Inkscape,GIMP,Krita,etc.\n\nSuggested stacking order bottom to top:\n1.panel-base\n2.artwork\n3.holes\n4.components\n5.text\n`,
    "text/plain",
  ]);
  return files;
}
function exportLayeredSVGPackage(state, opts) {
  const files = layeredSVGSeparateFiles(state, opts);
  if (files.length <= 1) {
    alert("Select at least one layered SVG layer.");
    return;
  }
  const base = safeProjectFileName(
    state.projectMeta?.name || "panel-layout",
  ).replace(/\.json$/i, "");
  downloadBlobFile(`${base}__layered-svg-package.zip`, createZipBlob(files));
}
function exportInkscapeSVG(state, opts) {
  const selected = [
    opts.svgLayeredPanelBase,
    opts.svgLayeredArtwork,
    opts.svgLayeredHoles,
    opts.svgLayeredComponents,
    opts.svgLayeredText,
  ].some(Boolean);
  if (!selected) {
    alert("Select at least one layered SVG layer.");
    return;
  }
  const base = safeProjectFileName(
    state.projectMeta?.name || "panel-layout",
  ).replace(/\.json$/i, "");
  downloadTextFile(
    `${base}__inkscape.svg`,
    exportLayeredSVGString(state, opts),
    "image/svg+xml",
  );
}
function exportPNGSVGString(state, opts, cfg) {
  const widthMM = panelWidthMM(state.panel);
  const heightMM = PANEL_HEIGHT_MM;
  function escapeXml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  const exportLayer = (k) => state.layerExport?.[k] !== false;
  const holesLines = [];
  const componentLines = [];
  const textLines = [];
  const artworkLines = [];
  if (
    cfg.includeHoles &&
    state.mountingHoles.enabled &&
    exportLayer("mountingHoles")
  ) {
    for (const h of state.mountingHoles.holes) {
      if (state.mountingHoles.holeShape === "oval") {
        const ow = Math.max(
          state.mountingHoles.ovalLength ?? 4.8,
          MOUNTING_HOLE_DIAMETER_MM,
        );
        holesLines.push(
          `<rect x="${(h.x - ow / 2).toFixed(3)}"y="${(h.y - MOUNTING_HOLE_DIAMETER_MM / 2).toFixed(3)}"width="${ow.toFixed(3)}"height="${MOUNTING_HOLE_DIAMETER_MM.toFixed(3)}"rx="${(MOUNTING_HOLE_DIAMETER_MM / 2).toFixed(3)}"fill="white"stroke="#333"stroke-width="0.3"/>`,
        );
      } else {
        holesLines.push(
          `<circle cx="${h.x.toFixed(3)}"cy="${h.y.toFixed(3)}"r="${(MOUNTING_HOLE_DIAMETER_MM / 2).toFixed(3)}"fill="white"stroke="#333"stroke-width="0.3"/>`,
        );
      }
    }
  }
  for (const c of state.components) {
    if (cfg.includeComponents) {
      componentLines.push(
        `<!--${escapeXml((c.ref ? c.ref + " " : "") + (c.label || c.name))}|${c.type}-->`,
      );
      if (
        exportLayer("frontShapes") &&
        getFrontShape(c) !== "circle" &&
        !isFaderLike(c)
      ) {
        const b = getFrontBounds(c);
        const rot =
          c.rotation !== 0
            ? `transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})"`
            : "";
        componentLines.push(
          `<rect x="${(c.x - b.w / 2).toFixed(3)}"y="${(c.y - b.h / 2).toFixed(3)}"width="${b.w.toFixed(3)}"height="${b.h.toFixed(3)}"fill="none"stroke="#999"stroke-width="0.25"${rot}/>`,
        );
      } else if (exportLayer("frontShapes") && getFrontShape(c) === "circle") {
        componentLines.push(
          `<circle cx="${c.x.toFixed(3)}"cy="${c.y.toFixed(3)}"r="${(c.frontDiameter / 2).toFixed(3)}"fill="none"stroke="#999"stroke-width="0.25"/>`,
        );
      }
    }
    if (cfg.includeHoles && exportLayer("componentHoles") && isDip8Socket(c)) {
      for (const p of dip8SocketHoleCenters(c))
        holesLines.push(
          `<circle cx="${p.x.toFixed(3)}"cy="${p.y.toFixed(3)}"r="${(c.holeDiameter / 2).toFixed(3)}"fill="white"stroke="#333"stroke-width="0.3"/>`,
        );
    } else if (
      cfg.includeHoles &&
      exportLayer("componentHoles") &&
      isJoystick(c)
    ) {
      holesLines.push(
        `<circle cx="${c.x.toFixed(3)}"cy="${c.y.toFixed(3)}"r="${(c.holeDiameter / 2).toFixed(3)}"fill="white"stroke="#333"stroke-width="0.3"/>`,
      );
      for (const p of joystickMountHoles(c))
        holesLines.push(
          `<circle cx="${p.x.toFixed(3)}"cy="${p.y.toFixed(3)}"r="${p.r.toFixed(3)}"fill="white"stroke="#333"stroke-width="0.3"/>`,
        );
    } else if (
      cfg.includeHoles &&
      exportLayer("componentHoles") &&
      c.holeType === "slot"
    ) {
      const sl = c.slotLength ?? c.holeDiameter;
      const rot =
        c.rotation !== 0
          ? `transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})"`
          : "";
      holesLines.push(
        `<rect x="${(c.x - c.holeDiameter / 2).toFixed(3)}"y="${(c.y - sl / 2).toFixed(3)}"width="${c.holeDiameter.toFixed(3)}"height="${sl.toFixed(3)}"rx="${(c.holeDiameter / 2).toFixed(3)}"fill="white"stroke="#333"stroke-width="0.3"${rot}/>`,
      );
    } else if (
      cfg.includeHoles &&
      exportLayer("componentHoles") &&
      c.holeType === "rect"
    ) {
      const hw = c.holeW ?? c.frontW ?? c.holeDiameter;
      const hh = c.holeH ?? c.frontH ?? c.holeDiameter;
      const rot =
        c.rotation !== 0
          ? `transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})"`
          : "";
      holesLines.push(
        `<rect x="${(c.x - hw / 2).toFixed(3)}"y="${(c.y - hh / 2).toFixed(3)}"width="${hw.toFixed(3)}"height="${hh.toFixed(3)}"fill="white"stroke="#333"stroke-width="0.3"${rot}/>`,
      );
    } else if (cfg.includeHoles && exportLayer("componentHoles")) {
      holesLines.push(
        `<circle cx="${c.x.toFixed(3)}"cy="${c.y.toFixed(3)}"r="${(c.holeDiameter / 2).toFixed(3)}"fill="white"stroke="#333"stroke-width="0.3"/>`,
      );
    }
    if (cfg.includeText && opts.labels && exportLayer("labels")) {
      const label = getComponentLabelLayout(c, widthMM);
      textLines.push(
        `<text x="${label.x.toFixed(3)}"y="${label.y.toFixed(3)}"text-anchor="${label.anchor}"${label.baseline === "middle" ? ' dominant-baseline="middle"' : ""}font-size="2"fill="#333">${escapeXml(c.label || c.name)}</text>`,
      );
    }
  }
  if (cfg.includeArtwork && opts.includeArtwork && exportLayer("artwork")) {
    artworkLines.push(
      ...buildArtworkSVGLines(
        state.artworks,
        "background",
        widthMM,
        heightMM,
        state.clipArtworkToPanel,
      ),
    );
    artworkLines.push(
      ...buildArtworkSVGLines(
        state.artworks,
        "foreground",
        widthMM,
        heightMM,
        state.clipArtworkToPanel,
      ),
    );
  }
  if (cfg.includeText && exportLayer("text")) {
    textLines.push(...buildTextSVGLines(state.textItems, "background"));
    textLines.push(
      ...buildScaleSVGLines(state.scaleItems, state.components, "background"),
    );
    textLines.push(...buildTextSVGLines(state.textItems, "foreground"));
    textLines.push(
      ...buildScaleSVGLines(state.scaleItems, state.components, "foreground"),
    );
  }
  if (cfg.includeComponents && exportLayer("topHardware")) {
    componentLines.push(...buildTopHardwareSVGLines(state.components));
  }
  const bgRect = cfg.transparentBg
    ? ""
    : `<rect x="0"y="0"width="${widthMM.toFixed(3)}"height="${heightMM.toFixed(3)}"fill="#ccc"/>\n`;
  const outline =
    cfg.includePanelOutline !== false && exportLayer("panelOutline")
      ? `<rect x="0"y="0"width="${widthMM.toFixed(3)}"height="${heightMM.toFixed(3)}"fill="none"stroke="black"stroke-width="0.5"/>\n`
      : "";
  return `<?xml version="1.0"encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"viewBox="0 0 ${widthMM.toFixed(3)} ${heightMM.toFixed(3)}"width="${widthMM.toFixed(3)}mm"height="${heightMM.toFixed(3)}mm">${bgRect}${artworkLines.join("\n")}${artworkLines.length ? "\n" : ""}${outline}${holesLines.join("\n")}${holesLines.length ? "\n" : ""}${componentLines.join("\n")}${componentLines.length ? "\n" : ""}${textLines.join("\n")}${textLines.length ? "\n" : ""}</svg>`;
}
async function rasterizeSVGToPNGBlob(svg, widthMM, heightMM, dpi = 300) {
  const pxPerMM = Math.max(1, dpi) / 25.4;
  const pixelWidth = Math.max(1, Math.round(widthMM * pxPerMM));
  const pixelHeight = Math.max(1, Math.round(heightMM * pxPerMM));
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const blob = await new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D context unavailable");
          ctx.clearRect(0, 0, pixelWidth, pixelHeight);
          ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
          canvas.toBlob((out) => {
            if (out) resolve(out);
            else reject(new Error("PNG encoding failed"));
          }, "image/png");
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Could not rasterize SVG"));
      img.src = url;
    });
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function buildPNGExportPlan(state, opts) {
  const base = safeProjectFileName(
    state.projectMeta?.name || "panel-layout",
  ).replace(/\.json$/i, "");
  const plan = [];
  const transparent = !!opts.pngTransparentBg;
  if (opts.pngCombined) {
    plan.push({
      kind: "combined",
      filename: `${base}__panel.png`,
      svg: exportPNGSVGString(state, opts, {
        includeComponents: true,
        includeHoles: true,
        includeArtwork: true,
        includeText: true,
        transparentBg: transparent,
        includePanelOutline: true,
      }),
    });
  }
  if (opts.pngSeparateComponents) {
    plan.push({
      kind: "components",
      filename: `${base}__components.png`,
      svg: exportPNGSVGString(state, opts, {
        includeComponents: true,
        includeHoles: false,
        includeArtwork: false,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  }
  if (opts.pngSeparateHoles) {
    plan.push({
      kind: "holes",
      filename: `${base}__holes.png`,
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: true,
        includeArtwork: false,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  }
  if (opts.pngSeparateArtwork) {
    plan.push({
      kind: "artwork",
      filename: `${base}__artwork.png`,
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: true,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  }
  if (opts.pngSeparateText) {
    plan.push({
      kind: "text",
      filename: `${base}__text.png`,
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: false,
        includeText: true,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  }
  return plan;
}
async function exportPNG(state, opts) {
  const plan = buildPNGExportPlan(state, opts);
  if (!plan.length) {
    alert(
      "Select at least one PNG output: combined panel and/or one or more separate layer PNGs.",
    );
    return;
  }
  const widthMM = panelWidthMM(state.panel);
  const heightMM = PANEL_HEIGHT_MM;
  const dpi = Number.isFinite(opts.pngDpi) ? Math.max(72, opts.pngDpi) : 300;
  try {
    const rendered = await Promise.all(
      plan.map(async (item) => {
        const blob = await rasterizeSVGToPNGBlob(
          item.svg,
          widthMM,
          heightMM,
          dpi,
        );
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return { ...item, blob, bytes };
      }),
    );
    if (rendered.length === 1) {
      downloadBlobFile(rendered[0].filename, rendered[0].blob);
      return;
    }
    const files = rendered.map((item) => [
      item.filename,
      item.bytes,
      "image/png",
    ]);
    const base = safeProjectFileName(
      state.projectMeta?.name || "panel-layout",
    ).replace(/\.json$/i, "");
    downloadBlobFile(`${base}__png-export.zip`, createZipBlob(files));
  } catch (e) {
    alert(`PNG export failed:${e?.message || e}`);
  }
}
function drillTableCSVString(state, warnings) {
  const header = [
    "Ref",
    "Label",
    "Type",
    "Part name",
    "Manufacturer",
    "Part number",
    "Verification",
    "X mm",
    "Y mm",
    "Rotation deg",
    "Hole type",
    "Hole W/Ø",
    "Hole H/Slot L",
    "Front shape",
    "Front W",
    "Front H",
    "Rear body W",
    "Rear body H",
    "Rear depth",
    "Keepout W",
    "Keepout H",
    "Warning count",
  ];
  const rows = drillTableRows(state, warnings).map((r) =>
    r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
  );
  return [header.join(","), ...rows].join("\n");
}
function disabledExportLayers(state) {
  const labels = [
    ["panelOutline", "panel outline"],
    ["mountingHoles", "mounting holes"],
    ["artwork", "artwork"],
    ["text", "text/scales"],
    ["labels", "component labels"],
    ["componentHoles", "component holes"],
    ["frontShapes", "front shapes"],
    ["topHardware", "top hardware"],
    ["rearBodies", "rear bodies"],
    ["rearKeepouts", "rear keepouts"],
    ["pcb", "PCB"],
  ];
  return labels
    .filter(([k]) => state.layerExport?.[k] === false)
    .map(([, label]) => label);
}
function exportPackageFiles(state, warnings) {
  const base = safeProjectFileName(
    state.projectMeta?.name || "panel-layout",
  ).replace(/\.json$/i, "");
  return [
    [
      `${base}__front-artwork.svg`,
      exportSVGString(state, {
        drillOnly: false,
        labels: true,
        rearKeepout: false,
        rearBody: false,
        centerMarks: false,
        mountingKeepouts: false,
        includeArtwork: true,
      }),
      "image/svg+xml",
    ],
    [
      `${base}__drill-cut.svg`,
      exportSVGString(state, {
        drillOnly: true,
        labels: false,
        rearKeepout: false,
        rearBody: false,
        centerMarks: true,
        mountingKeepouts: true,
        includeArtwork: false,
      }),
      "image/svg+xml",
    ],
    [
      `${base}__rear-keepout.svg`,
      exportSVGString(state, {
        drillOnly: false,
        labels: true,
        rearKeepout: true,
        rearBody: true,
        centerMarks: true,
        mountingKeepouts: true,
        includeArtwork: false,
      }),
      "image/svg+xml",
    ],
    [
      `${base}__layers.svg`,
      exportLayeredSVGString(state, {
        ...DEFAULT_EXPORT_OPTIONS,
        svgLayeredPanelBase: true,
        svgLayeredComponents: true,
        svgLayeredHoles: true,
        svgLayeredArtwork: true,
        svgLayeredText: true,
      }),
      "image/svg+xml",
    ],
    [
      `${base}__component-table.csv`,
      drillTableCSVString(state, warnings),
      "text/csv",
    ],
    [
      `${base}__manufacturing-report.md`,
      manufacturingReportText(state, warnings),
      "text/markdown",
    ],
    [
      `${base}__export-readme.txt`,
      `Eurorack Panel Designer export package\n\nLayer export flags respected. Disabled layers: ${disabledExportLayers(state).join(", ") || "none"}\n\nFiles:\n- front-artwork.svg\n- drill-cut.svg\n- rear-keepout.svg\n- component-table.csv\n- manufacturing-report.md\n- project.json\n\nAlways verify scale 1:1 before manufacturing.`,
      "text/plain",
    ],
    [
      `${base}__project.json`,
      serializeProject(state, true),
      "application/json",
    ],
  ];
}
function downloadExportPackageZip(state, warnings) {
  const base = safeProjectFileName(
    state.projectMeta?.name || "panel-layout",
  ).replace(/\.json$/i, "");
  const blob = createZipBlob(exportPackageFiles(state, warnings));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}__manufacturing-package.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
function downloadExportPackage(state, warnings) {
  downloadExportPackageZip(state, warnings);
}
function downloadExportPackageLooseFiles(state, warnings) {
  exportPackageFiles(state, warnings).forEach(([name, content, mime], idx) => {
    window.setTimeout(() => downloadTextFile(name, content, mime), idx * 180);
  });
}
function exportSVGString(state, opts) {
  const widthMM = panelWidthMM(state.panel);
  const heightMM = PANEL_HEIGHT_MM;
  function escapeXml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  const lines = [];
  if (opts.mountingKeepouts && state.mountingHoles.enabled) {
    const kr = Math.max(
      0,
      state.mountingHoles.keepoutRadius ?? MOUNTING_HOLE_KEEPOUT_R_MM,
    );
    for (const h of state.mountingHoles.holes) {
      if (
        !opts.drillOnly &&
        state.mountingHoles.showKeepouts !== false &&
        kr > 0
      ) {
        lines.push(
          `  <circle cx="${h.x.toFixed(3)}" cy="${h.y.toFixed(3)}" r="${kr.toFixed(3)}" fill="none" stroke="#aaa" stroke-width="0.2" stroke-dasharray="1 0.5"/>`,
        );
      }
      if (state.mountingHoles.holeShape === "oval") {
        const ow = Math.max(
          state.mountingHoles.ovalLength ?? 4.8,
          MOUNTING_HOLE_DIAMETER_MM,
        );
        lines.push(
          `  <rect x="${(h.x - ow / 2).toFixed(3)}" y="${(h.y - MOUNTING_HOLE_DIAMETER_MM / 2).toFixed(3)}" width="${ow.toFixed(3)}" height="${MOUNTING_HOLE_DIAMETER_MM.toFixed(3)}" rx="${(MOUNTING_HOLE_DIAMETER_MM / 2).toFixed(3)}" fill="white" stroke="#333" stroke-width="0.3"/>`,
        );
      } else {
        lines.push(
          `  <circle cx="${h.x.toFixed(3)}" cy="${h.y.toFixed(3)}" r="${(MOUNTING_HOLE_DIAMETER_MM / 2).toFixed(3)}" fill="white" stroke="#333" stroke-width="0.3"/>`,
        );
      }
    }
  }
  for (const c of state.components) {
    lines.push(
      `  <!-- ${escapeXml((c.ref ? c.ref + " " : "") + (c.label || c.name))} | ${c.type} | x=${c.x.toFixed(2)} y=${c.y.toFixed(2)} | hole Ø${c.holeDiameter}mm${c.holeType === "slot" ? `slot ${c.holeDiameter}×${c.slotLength ?? "?"}mm` : ""} | depth ${c.rearDepth}mm -->`,
    );
    if (!opts.drillOnly) {
      if (opts.rearKeepout && c.keepoutW > 0) {
        lines.push(
          `  <g transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})">`,
        );
        lines.push(
          `    <rect x="${(c.x + getRearKeepoutBounds(c).x).toFixed(3)}" y="${(c.y + getRearKeepoutBounds(c).y).toFixed(3)}" width="${c.keepoutW.toFixed(3)}" height="${c.keepoutH.toFixed(3)}" fill="none" stroke="#f80" stroke-width="0.2" stroke-dasharray="1 0.5"/>`,
        );
        lines.push(`  </g>`);
      }
      if (opts.rearBody && c.rearBodyW > 0) {
        lines.push(
          `  <g transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})">`,
        );
        for (const r of getRearBodyRects(c)) {
          lines.push(
            `    <rect x="${(c.x + r.x).toFixed(3)}" y="${(c.y + r.y).toFixed(3)}" width="${r.width.toFixed(3)}" height="${r.height.toFixed(3)}" fill="none" stroke="#f60" stroke-width="0.3"><title>${escapeXml(r.name)}</title></rect>`,
          );
        }
        lines.push(`  </g>`);
      }
      if (getFrontShape(c) !== "circle") {
        const b = getFrontBounds(c);
        const rot =
          c.rotation !== 0
            ? ` transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})"`
            : "";
        lines.push(
          `  <rect x="${(c.x - b.w / 2).toFixed(3)}" y="${(c.y - b.h / 2).toFixed(3)}" width="${b.w.toFixed(3)}" height="${b.h.toFixed(3)}" fill="none" stroke="#999" stroke-width="0.25"${rot}/>`,
        );
      } else {
        lines.push(
          `  <circle cx="${c.x.toFixed(3)}" cy="${c.y.toFixed(3)}" r="${(c.frontDiameter / 2).toFixed(3)}" fill="none" stroke="#999" stroke-width="0.25"/>`,
        );
      }
    }
    if (c.holeType === "slot") {
      const sl = c.slotLength ?? c.holeDiameter;
      const rot =
        c.rotation !== 0
          ? ` transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})"`
          : "";
      lines.push(
        `  <rect x="${(c.x - c.holeDiameter / 2).toFixed(3)}" y="${(c.y - sl / 2).toFixed(3)}" width="${c.holeDiameter.toFixed(3)}" height="${sl.toFixed(3)}" rx="${(c.holeDiameter / 2).toFixed(3)}" fill="white" stroke="#333" stroke-width="0.3"${rot}/>`,
      );
    } else if (c.holeType === "rect") {
      const hw = c.holeW ?? c.frontW ?? c.holeDiameter;
      const hh = c.holeH ?? c.frontH ?? c.holeDiameter;
      const rot =
        c.rotation !== 0
          ? ` transform="rotate(${c.rotation}, ${c.x.toFixed(3)}, ${c.y.toFixed(3)})"`
          : "";
      lines.push(
        `  <rect x="${(c.x - hw / 2).toFixed(3)}" y="${(c.y - hh / 2).toFixed(3)}" width="${hw.toFixed(3)}" height="${hh.toFixed(3)}" fill="white" stroke="#333" stroke-width="0.3"${rot}/>`,
      );
    } else {
      lines.push(
        `  <circle cx="${c.x.toFixed(3)}" cy="${c.y.toFixed(3)}" r="${(c.holeDiameter / 2).toFixed(3)}" fill="white" stroke="#333" stroke-width="0.3"/>`,
      );
    }
    if (opts.centerMarks && !opts.drillOnly) {
      const cm = 1.5;
      lines.push(
        `  <line x1="${(c.x - cm).toFixed(3)}" y1="${c.y.toFixed(3)}" x2="${(c.x + cm).toFixed(3)}" y2="${c.y.toFixed(3)}" stroke="#555" stroke-width="0.12"/>`,
      );
      lines.push(
        `  <line x1="${c.x.toFixed(3)}" y1="${(c.y - cm).toFixed(3)}" x2="${c.x.toFixed(3)}" y2="${(c.y + cm).toFixed(3)}" stroke="#555" stroke-width="0.12"/>`,
      );
    }
    if (opts.labels && !opts.drillOnly) {
      const ly = (c.y + getFrontBottomOffset(c) + 2.5).toFixed(3);
      lines.push(
        `  <text x="${c.x.toFixed(3)}" y="${ly}" text-anchor="middle" font-size="2" fill="#333">${escapeXml(c.label || c.name)}</text>`,
      );
    }
  }
  const bgArtLines =
    opts.includeArtwork && !opts.drillOnly
      ? buildArtworkSVGLines(
          state.artworks,
          "background",
          widthMM,
          heightMM,
          state.clipArtworkToPanel,
        )
      : [];
  const fgArtLines =
    opts.includeArtwork && !opts.drillOnly
      ? buildArtworkSVGLines(
          state.artworks,
          "foreground",
          widthMM,
          heightMM,
          state.clipArtworkToPanel,
        )
      : [];
  const bgTextLines = !opts.drillOnly
    ? buildTextSVGLines(state.textItems, "background")
    : [];
  const fgTextLines = !opts.drillOnly
    ? buildTextSVGLines(state.textItems, "foreground")
    : [];
  const bgScaleLines = !opts.drillOnly
    ? buildScaleSVGLines(state.scaleItems, state.components, "background")
    : [];
  const fgScaleLines = !opts.drillOnly
    ? buildScaleSVGLines(state.scaleItems, state.components, "foreground")
    : [];
  const topHardwareLines = !opts.drillOnly
    ? buildTopHardwareSVGLines(state.components)
    : [];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Eurorack Panel Designer export -->
<!-- Panel: ${state.panel.widthHP}HP = ${widthMM.toFixed(2)}mm x ${heightMM}mm -->
<!-- WARNING: Dimensions are planning estimates. Verify all parts with datasheets/calipers before manufacturing. -->
<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 ${widthMM.toFixed(3)} ${heightMM.toFixed(3)}"
  width="${widthMM.toFixed(3)}mm" height="${heightMM.toFixed(3)}mm">
  <rect x="0" y="0" width="${widthMM.toFixed(3)}" height="${heightMM.toFixed(3)}" fill="#ccc"/>
${bgArtLines.join("\n")}${bgArtLines.length ? "\n" : ""}${bgTextLines.join("\n")}${bgTextLines.length ? "\n" : ""}${bgScaleLines.join("\n")}${bgScaleLines.length ? "\n" : ""}  <rect x="0" y="0" width="${widthMM.toFixed(3)}" height="${heightMM.toFixed(3)}" fill="none" stroke="black" stroke-width="0.5"/>
${lines.join("\n")}
${fgTextLines.length ? fgTextLines.join("\n") + "\n" : ""}${fgArtLines.length ? fgArtLines.join("\n") + "\n" : ""}</svg>`;
}
function exportSVG(state, opts) {
  downloadTextFile(
    "panel-export.svg",
    exportSVGString(state, opts),
    "image/svg+xml",
  );
}
