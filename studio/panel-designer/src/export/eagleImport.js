// Eagle 6+ XML .brd import parser.
// Parses Eagle board files and converts elements to panel components.
// Depends on: HP_TO_MM, PANEL_HEIGHT_MM, mountingHolesForPreset,
//             sanitizePart (core.js),
//             COMPONENT_LIBRARY (components/library/componentDefinitions.js).
// Public API: parseEagleBrdToPanel(xmlSrc, currentPanelWidthMM).
function parseEagleBrdOutline(doc) {
  const pts = [];
  const wires = doc.querySelectorAll(
    'plain > wire[layer="20"], board > plain > wire[layer="20"]',
  );
  for (const w of wires) {
    const x1 = parseFloat(w.getAttribute("x1"));
    const y1 = parseFloat(w.getAttribute("y1"));
    const x2 = parseFloat(w.getAttribute("x2"));
    const y2 = parseFloat(w.getAttribute("y2"));
    if (!isNaN(x1)) pts.push({ x: x1, y: y1 });
    if (!isNaN(x2)) pts.push({ x: x2, y: y2 });
  }
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs),
    xMax = Math.max(...xs);
  const yMin = Math.min(...ys),
    yMax = Math.max(...ys);
  if (!(xMax > xMin) || !(yMax > yMin)) return null;
  return {
    x: xMin,
    y: yMin,
    width: xMax - xMin,
    height: yMax - yMin,
    maxY: yMax,
  };
}
function largestConnectedWireGroup(wires) {
  const remaining = new Set(wires.map((_, index) => index));
  const groups = [];
  const key = (x, y) =>
    `${Math.round(x * 100) / 100}:${Math.round(y * 100) / 100}`;
  while (remaining.size) {
    const seed = remaining.values().next().value;
    remaining.delete(seed);
    const group = [wires[seed]];
    const endpoints = new Set([
      key(wires[seed].x1, wires[seed].y1),
      key(wires[seed].x2, wires[seed].y2),
    ]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const index of [...remaining]) {
        const wire = wires[index];
        if (
          endpoints.has(key(wire.x1, wire.y1)) ||
          endpoints.has(key(wire.x2, wire.y2))
        ) {
          remaining.delete(index);
          group.push(wire);
          endpoints.add(key(wire.x1, wire.y1));
          endpoints.add(key(wire.x2, wire.y2));
          changed = true;
        }
      }
    }
    groups.push(group);
  }
  const score = (group) => {
    const xs = group.flatMap((wire) => [wire.x1, wire.x2]);
    const ys = group.flatMap((wire) => [wire.y1, wire.y2]);
    return (
      (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
    );
  };
  return groups.sort((a, b) => score(b) - score(a))[0] || [];
}
function parseEagleOutlineGeometry(doc, outline, xOffset, yOffset) {
  if (!outline) return null;
  const source = [...doc.querySelectorAll('plain > wire[layer="20"]')]
    .map((wire) => ({
      element: wire,
      x1: Number(wire.getAttribute("x1")),
      y1: Number(wire.getAttribute("y1")),
      x2: Number(wire.getAttribute("x2")),
      y2: Number(wire.getAttribute("y2")),
    }))
    .filter((wire) =>
      [wire.x1, wire.y1, wire.x2, wire.y2].every(Number.isFinite),
    );
  const outer = largestConnectedWireGroup(source);
  if (!outer.length) return null;
  return outer.map((wire) => {
    const points = eagleWirePoints(wire.element).map((point) => ({
      x: point.x - outline.x + xOffset,
      y: outline.y + outline.height - point.y + yOffset,
    }));
    return { kind: points.length > 2 ? "arc" : "line", points };
  });
}
function parseEaglePlainCutouts(doc) {
  const cutouts = [];
  const add = (x, y, diameter, source) => {
    if (![x, y, diameter].every(Number.isFinite) || diameter <= 0) return;
    if (
      cutouts.some(
        (item) =>
          Math.abs(item.x - x) < 0.001 &&
          Math.abs(item.y - y) < 0.001 &&
          Math.abs(item.diameter - diameter) < 0.001,
      )
    )
      return;
    cutouts.push({ x, y, diameter, source });
  };
  for (const hole of doc.querySelectorAll(
    "plain > hole, board > plain > hole",
  )) {
    add(
      parseFloat(hole.getAttribute("x")),
      parseFloat(hole.getAttribute("y")),
      parseFloat(hole.getAttribute("drill")),
      "hole",
    );
  }
  for (const circle of doc.querySelectorAll(
    'plain > circle[layer="20"], plain > circle[layer="46"], board > plain > circle[layer="20"], board > plain > circle[layer="46"]',
  )) {
    add(
      parseFloat(circle.getAttribute("x")),
      parseFloat(circle.getAttribute("y")),
      parseFloat(circle.getAttribute("radius")) * 2,
      `circle layer ${circle.getAttribute("layer")}`,
    );
  }
  return cutouts;
}
function eagleSvgNumber(value) {
  return Math.round(value * 10000) / 10000;
}
function escapeEagleSvgText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function eagleWirePoints(wire) {
  const x1 = parseFloat(wire.getAttribute("x1"));
  const y1 = parseFloat(wire.getAttribute("y1"));
  const x2 = parseFloat(wire.getAttribute("x2"));
  const y2 = parseFloat(wire.getAttribute("y2"));
  if (![x1, y1, x2, y2].every(Number.isFinite)) return [];
  const curve = parseFloat(wire.getAttribute("curve") || "0");
  if (!Number.isFinite(curve) || Math.abs(curve) < 0.001)
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  const theta = (curve * Math.PI) / 180;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const chord = Math.hypot(dx, dy);
  if (chord < 0.0001 || Math.abs(Math.sin(theta / 2)) < 0.0001)
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  const centerOffset = chord / (2 * Math.tan(theta / 2));
  const cx = (x1 + x2) / 2 + (-dy / chord) * centerOffset;
  const cy = (y1 + y2) / 2 + (dx / chord) * centerOffset;
  const start = Math.atan2(y1 - cy, x1 - cx);
  const radius = Math.hypot(x1 - cx, y1 - cy);
  const segments = Math.max(2, Math.ceil(Math.abs(curve) / 8));
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = start + theta * (index / segments);
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}
function eaglePrimitiveSvg(element, outline, mode) {
  const x = (value) => eagleSvgNumber(parseFloat(value) - outline.x);
  const y = (value) =>
    eagleSvgNumber(outline.y + outline.height - parseFloat(value));
  const width = Math.max(
    0.05,
    parseFloat(element.getAttribute("width") || "0.1"),
  );
  const color =
    mode === "mask" ? "white" : mode === "silk" ? "#f2f0e9" : "#c99a4a";
  const kicadLayer =
    mode === "mask" ? "F.Mask" : mode === "silk" ? "F.SilkS" : "F.Cu";
  if (element.tagName === "wire") {
    const points = eagleWirePoints(element);
    if (points.length < 2) return "";
    const d = points
      .map((point, index) => `${index ? "L" : "M"}${x(point.x)} ${y(point.y)}`)
      .join(" ");
    return `<path data-kicad-layer="${kicadLayer}" d="${d}" fill="none" stroke="${color}" stroke-width="${eagleSvgNumber(width)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (element.tagName === "circle") {
    const radius = parseFloat(element.getAttribute("radius"));
    if (!Number.isFinite(radius) || radius <= 0) return "";
    return `<circle data-kicad-layer="${kicadLayer}" cx="${x(element.getAttribute("x"))}" cy="${y(element.getAttribute("y"))}" r="${eagleSvgNumber(radius)}" fill="none" stroke="${color}" stroke-width="${eagleSvgNumber(width)}"/>`;
  }
  if (element.tagName === "rectangle") {
    const x1 = x(element.getAttribute("x1"));
    const x2 = x(element.getAttribute("x2"));
    const y1 = y(element.getAttribute("y1"));
    const y2 = y(element.getAttribute("y2"));
    return `<rect data-kicad-layer="${kicadLayer}" x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${eagleSvgNumber(Math.abs(x2 - x1))}" height="${eagleSvgNumber(Math.abs(y2 - y1))}" fill="${color}" stroke="none"/>`;
  }
  if (element.tagName === "text") {
    const size = Math.max(
      0.5,
      parseFloat(element.getAttribute("size") || "1.27"),
    );
    const px = x(element.getAttribute("x"));
    const py = y(element.getAttribute("y"));
    const rotation = parseEagleRotation(element.getAttribute("rot") || "");
    const mirrored = /^M/i.test(element.getAttribute("rot") || "");
    const transform = [
      `translate(${px} ${py})`,
      rotation ? `rotate(${-rotation})` : "",
      mirrored ? "scale(-1 1)" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<text data-kicad-layer="${kicadLayer}" transform="${transform}" x="0" y="0" fill="${color}" stroke="none" font-family="Arial, sans-serif" font-size="${eagleSvgNumber(size)}" dominant-baseline="alphabetic">${escapeEagleSvgText(element.textContent)}</text>`;
  }
  return "";
}
function parseEagleFrontArtwork(doc, outline, xOffset, yOffset) {
  if (!outline) return [];
  const plain =
    doc.querySelector("board > plain") || doc.querySelector("plain");
  if (!plain) return [];
  const elements = [...plain.children];
  const topCopper = elements.filter((el) => el.getAttribute("layer") === "1");
  const topStop = elements.filter((el) => el.getAttribute("layer") === "29");
  const topSilk = elements.filter((el) =>
    ["21", "25", "27"].includes(el.getAttribute("layer")),
  );
  if (!topCopper.length && !topStop.length && !topSilk.length) return [];
  const copperSvg = topCopper
    .map((el) => eaglePrimitiveSvg(el, outline, "copper"))
    .join("");
  const stopSvg = topStop
    .map((el) => eaglePrimitiveSvg(el, outline, "mask"))
    .join("");
  const silkSvg = topSilk
    .map((el) => eaglePrimitiveSvg(el, outline, "silk"))
    .join("");
  const maskedCopper =
    copperSvg && stopSvg
      ? `<defs><mask id="eagle-top-stop" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="black"/>${stopSvg}</mask></defs><g mask="url(#eagle-top-stop)">${copperSvg}</g>`
      : copperSvg ||
        (stopSvg ? `<g stroke="#c99a4a" fill="#c99a4a">${stopSvg}</g>` : "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${eagleSvgNumber(outline.width)} ${eagleSvgNumber(outline.height)}">${maskedCopper}${silkSvg}</svg>`;
  return [
    {
      id: crypto.randomUUID(),
      name: "Eagle front artwork",
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
      notes: "Imported from Eagle top copper, tStop and top silkscreen layers.",
    },
  ];
}
function parseEagleRotation(rotStr) {
  if (!rotStr) return 0;
  const m = rotStr.match(/M?R(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : 0;
}
function roundEaglePanelWidthToHP(widthMM) {
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
function bestLibraryPartForEagle(name, pkg) {
  const hay = `${name} ${pkg}`.toLowerCase();
  const find = (type) => COMPONENT_LIBRARY.find((p) => p.type === type) || null;
  if (
    /thonkiconn|pj398sm|wqp-pj398sm|3\.5mm-jack|jack.*3\.5|3\.5.*jack/.test(hay)
  )
    return find("jack");
  if (/slim.*jack|cliff.*fc68|rean.*nys|jack.*6\.35|6\.35.*jack/.test(hay))
    return find("slimjack");
  if (/alpha-16mm|rd901f.*16|16mm.*pot|rv16/.test(hay)) return find("pot16mm");
  if (/alpha-9mm|rd901f|9mm.*pot|rv09/.test(hay)) return find("pot9mm");
  if (/ec12|pec11|encoder.*12|rotary.*enc/.test(hay)) return find("encoder");
  if (/fader.*45|ra.*slide.*45|ra4543/.test(hay)) return find("fader45");
  if (/fader.*30|fader.*35|ra.*slide.*(?:30|35)|ra3043/.test(hay))
    return find("fader35");
  if (/fader.*20.*led/.test(hay)) return find("fader20led");
  if (/fader.*20|slide.*pot/.test(hay)) return find("fader20");
  if (/led.*5mm|5mm.*led|tact.*led|thonk.*sw.*lp.*led/.test(hay))
    return find("tactled");
  if (/led.*3mm|3mm.*led/.test(hay)) return find("led3mm");
  if (/momentary.*12|sw.*push.*12|d6.*switch/.test(hay))
    return find("momentary12");
  if (/tact.*6mm|6mm.*tact|fsm.*switch|sw.*push.*6/.test(hay))
    return find("tact6mm");
  if (/sub.*mini/.test(hay)) return find("subMiniSwitch");
  if (/toggle|spdt|dpdt/.test(hay)) return find("toggle");
  if (/rotary.*8|rotary.*12|wafer/.test(hay)) return find("rotary8pos");
  if (/dip-8|socket.*8|diode.*socket/.test(hay)) return find("dip8socket");
  if (/trimmer|trim.*6/.test(hay)) return find("trimmer6mm");
  const n = name.toLowerCase();
  if (/^rv|^pot/.test(n)) return find("pot9mm");
  if (/^led/.test(n)) return find("led3mm");
  if (/^sw|^s\d/.test(n)) return find("tact6mm");
  if (/^enc/.test(n)) return find("encoder");
  return null;
}
function parseEagleBrdToPanel(xmlSrc, currentPanelWidthMM) {
  const warnings = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlSrc, "text/xml");
  if (doc.querySelector("parsererror")) {
    return {
      components: [],
      boardOutline: null,
      warnings: [
        "Eagle .brd file could not be parsed. Is this a valid Eagle 6+ XML file?",
      ],
    };
  }
  const outline = parseEagleBrdOutline(doc);
  const elements = [...doc.querySelectorAll("elements > element")];
  const plainCutouts = parseEaglePlainCutouts(doc);
  if (!elements.length && !plainCutouts.length && !outline) {
    return {
      components: [],
      boardOutline: outline,
      warnings: ["No panel outline, elements or mechanical holes found."],
    };
  }
  const allX = [
    ...elements.map((el) => parseFloat(el.getAttribute("x") || "0")),
    ...plainCutouts.map((hole) => hole.x),
  ];
  const allY = [
    ...elements.map((el) => parseFloat(el.getAttribute("y") || "0")),
    ...plainCutouts.map((hole) => hole.y),
  ];
  const boardMinX = outline ? outline.x : Math.min(...allX);
  const boardMaxY = outline ? outline.y + outline.height : Math.max(...allY);
  const boardWidth = outline
    ? outline.width
    : Math.max(10, Math.max(...allX) - Math.min(...allX) + 20);
  const boardHeight = outline
    ? outline.height
    : Math.max(10, Math.max(...allY) - Math.min(...allY) + 20);
  if (!outline) {
    warnings.push(
      "No Dimension (Layer 20) outline found. Components were centered on the current panel; verify origin manually.",
    );
  }
  if (boardHeight > PANEL_HEIGHT_MM + 0.5) {
    warnings.push(
      `Board outline height ${boardHeight.toFixed(2)} mm exceeds Eurorack 3U panel height ${PANEL_HEIGHT_MM} mm.`,
    );
  }
  const roundedPanel =
    outline && outline.width > 5
      ? roundEaglePanelWidthToHP(outline.width)
      : {
          widthMM: currentPanelWidthMM,
          hp: currentPanelWidthMM / HP_TO_MM,
          rounded: false,
          sourceHp: currentPanelWidthMM / HP_TO_MM,
        };
  if (roundedPanel.rounded) {
    warnings.push(
      `Board width ${boardWidth.toFixed(2)} mm = ${roundedPanel.sourceHp.toFixed(2)} HP; rounded to ${roundedPanel.hp} HP.`,
    );
  }
  const targetWidth = roundedPanel.widthMM;
  const xOffset = (targetWidth - boardWidth) / 2;
  const yOffset = outline
    ? Math.max(0, (PANEL_HEIGHT_MM - boardHeight) / 2)
    : (PANEL_HEIGHT_MM - boardHeight) / 2;
  const artworks = parseEagleFrontArtwork(doc, outline, xOffset, yOffset);
  const panelOutlineGeometry = parseEagleOutlineGeometry(
    doc,
    outline,
    xOffset,
    yOffset,
  );
  const usedRefs = new Set();
  const components = [];
  let skippedNonPanelCount = 0;
  elements.forEach((el, idx) => {
    const name = el.getAttribute("name") || "";
    const pkg = el.getAttribute("package") || "";
    const lib = el.getAttribute("library") || "";
    const ex = parseFloat(el.getAttribute("x") || "0");
    const ey = parseFloat(el.getAttribute("y") || "0");
    const rotStr = el.getAttribute("rot") || "";
    const rotation = parseEagleRotation(rotStr);
    const def = bestLibraryPartForEagle(name, pkg);
    if (!def) {
      skippedNonPanelCount++;
      return;
    }
    const sanitized = sanitizePart({
      ...def,
      verificationStatus: def.verificationStatus ?? "approximate",
    });
    let ref = name || `C${idx + 1}`;
    if (usedRefs.has(ref)) ref = `${ref}_${idx + 1}`;
    usedRefs.add(ref);
    const panelX = ex - boardMinX + xOffset;
    const panelY = boardMaxY - ey + yOffset;
    const noteLines = [
      `Imported from Eagle package: ${pkg}`,
      lib ? `Library: ${lib}` : "",
      `Eagle rotation: ${rotStr || "R0"}`,
    ].filter(Boolean);
    components.push({
      ...sanitized,
      id: crypto.randomUUID(),
      ref,
      label: name,
      x: Math.round(panelX * 1000) / 1000,
      y: Math.round(panelY * 1000) / 1000,
      rotation,
      notes: noteLines.join("\n"),
      locked: false,
    });
  });
  const automaticMountingHoles = mountingHolesForPreset(
    targetWidth,
    "autoOval",
  );
  let standardMountingHoleCount = 0;
  let importedCutoutCount = 0;
  plainCutouts.forEach((hole, idx) => {
    const panelX = hole.x - boardMinX + xOffset;
    const panelY = boardMaxY - hole.y + yOffset;
    const isStandardMountingHole = automaticMountingHoles.some(
      (mountingHole) =>
        Math.hypot(panelX - mountingHole.x, panelY - mountingHole.y) <= 1.25,
    );
    if (isStandardMountingHole) {
      standardMountingHoleCount++;
      return;
    }
    const diameter = Math.max(0.1, hole.diameter);
    const def = sanitizePart({
      type: "cutout",
      name: `Eagle cutout Ø${diameter.toFixed(2)} mm`,
      holeDiameter: diameter,
      frontDiameter: diameter,
      rearBodyW: 0,
      rearBodyH: 0,
      rearDepth: 0,
      keepoutW: diameter + 2,
      keepoutH: diameter + 2,
      minSpacing: 1,
      category: "mechanical",
      topHardwareVisible: false,
      verificationStatus: "measured",
      snapTargetEnabled: true,
    });
    components.push({
      ...def,
      id: crypto.randomUUID(),
      ref: `CUT${importedCutoutCount + 1}`,
      label: "",
      x: Math.round(panelX * 1000) / 1000,
      y: Math.round(panelY * 1000) / 1000,
      rotation: 0,
      notes: `Imported from Eagle mechanical ${hole.source}.`,
      locked: false,
    });
    importedCutoutCount++;
  });
  if (skippedNonPanelCount)
    warnings.push(
      `Ignored ${skippedNonPanelCount} elements that are not recognized front-panel parts.`,
    );
  if (importedCutoutCount)
    warnings.push(`Imported ${importedCutoutCount} mechanical panel cutouts.`);
  if (standardMountingHoleCount)
    warnings.push(
      `Matched ${standardMountingHoleCount} rail holes to automatic Eurorack mounting holes without duplicating them.`,
    );
  if (artworks.length)
    warnings.push(
      "Imported Eagle top copper, solder-mask openings and silkscreen as editable artwork.",
    );
  return {
    components,
    artworks,
    panelOutlineGeometry,
    panelWidthMM: targetWidth,
    boardOutline: outline
      ? {
          x: outline.x,
          y: outline.y,
          width: outline.width,
          height: outline.height,
        }
      : null,
    warnings,
  };
}
