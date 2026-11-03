// Extracted component declarations from index.html.
// GridLayer
const GridLayer = React.memo(function GridLayer({ widthMM, heightMM, grid }) {
  const cfg = useMemo(() => {
    const rawStep = Number(grid?.size ?? 1);
    const step = rawStep > 0 ? rawStep : 1;
    const major = 5;
    const cx = widthMM / 2;
    const cy = heightMM / 2;
    const minorOpacity = step <= 0.25 ? 0.12 : step <= 0.5 ? 0.18 : 0.26;
    const token = String(step).replace(/[^a-zA-Z0-9_-]/g, "p");
    const majorToken = grid?.showMajor ? "major" : "minor";
    const minorX = cx - Math.ceil(cx / step) * step;
    const minorY = cy - Math.ceil(cy / step) * step;
    const majorX = cx - Math.ceil(cx / major) * major;
    const majorY = cy - Math.ceil(cy / major) * major;
    return {
      step,
      major,
      minorOpacity,
      minorX,
      minorY,
      majorX,
      majorY,
      minorPatternId: `grid-minor-${token}-${Math.round(widthMM * 100)}-${Math.round(heightMM * 100)}`,
      majorPatternId: `grid-major-${token}-${majorToken}-${Math.round(widthMM * 100)}-${Math.round(heightMM * 100)}`,
    };
  }, [widthMM, heightMM, grid?.size, grid?.showMajor]);
  return React.createElement(
    "g",
    { style: { pointerEvents: "none" } },
    React.createElement(
      "defs",
      null,
      React.createElement(
        "pattern",
        {
          id: cfg.minorPatternId,
          patternUnits: "userSpaceOnUse",
          x: cfg.minorX,
          y: cfg.minorY,
          width: cfg.step,
          height: cfg.step,
        },
        React.createElement("path", {
          d: `M ${cfg.step} 0 L 0 0 0 ${cfg.step}`,
          fill: "none",
          stroke: "#6f8188",
          strokeWidth: 0.055,
          strokeOpacity: cfg.minorOpacity,
          strokeDasharray: "0.45 0.75",
        }),
      ),
      grid?.showMajor &&
        React.createElement(
          "pattern",
          {
            id: cfg.majorPatternId,
            patternUnits: "userSpaceOnUse",
            x: cfg.majorX,
            y: cfg.majorY,
            width: cfg.major,
            height: cfg.major,
          },
          React.createElement("path", {
            d: `M ${cfg.major} 0 L 0 0 0 ${cfg.major}`,
            fill: "none",
            stroke: "#9aa8ad",
            strokeWidth: 0.095,
            strokeOpacity: 0.36,
            strokeDasharray: "1.1 1.0",
          }),
        ),
    ),
    React.createElement("rect", {
      x: 0,
      y: 0,
      width: widthMM,
      height: heightMM,
      fill: `url(#${cfg.minorPatternId})`,
    }),
    grid?.showMajor &&
      React.createElement("rect", {
        x: 0,
        y: 0,
        width: widthMM,
        height: heightMM,
        fill: `url(#${cfg.majorPatternId})`,
      }),
    React.createElement("line", {
      x1: widthMM / 2,
      y1: 0,
      x2: widthMM / 2,
      y2: heightMM,
      stroke: "#c99a4a",
      strokeWidth: 0.18,
      strokeOpacity: 0.36,
      strokeDasharray: "1.6 1.0",
    }),
    React.createElement("line", {
      x1: 0,
      y1: heightMM / 2,
      x2: widthMM,
      y2: heightMM / 2,
      stroke: "#c99a4a",
      strokeWidth: 0.18,
      strokeOpacity: 0.36,
      strokeDasharray: "1.6 1.0",
    }),
  );
});

// HPGuideLayer
const HPGuideLayer = React.memo(function HPGuideLayer({ widthHP, heightMM }) {
  const hpCount = Math.max(0, Math.round(widthHP));
  if (hpCount <= 0 || hpCount > 80) return null;
  return React.createElement(
    "g",
    {
      style: {
        pointerEvents: "none",
        opacity: "var(--hp-grid-opacity, 0.68)",
      },
    },
    Array.from({ length: hpCount + 1 }, (_, i) => {
      const x = i * HP_TO_MM;
      const edge = i === 0 || i === hpCount;
      const centerish = Math.abs(i - hpCount / 2) < 0.001;
      return React.createElement(
        "g",
        { key: `hp-guide-${i}` },
        React.createElement("line", {
          x1: x,
          y1: 0,
          x2: x,
          y2: heightMM,
          stroke: centerish ? "#64f4ff" : edge ? "#d8e7ef" : "#ffffff",
          strokeWidth: centerish ? 0.16 : edge ? 0.12 : 0.075,
          strokeOpacity: centerish ? 0.2 : edge ? 0.18 : 0.065,
          strokeDasharray: edge ? "none" : "0.75 1.35",
        }),
        i > 0 &&
          (i < hpCount || i === hpCount) &&
          (i === hpCount || i % 2 === 0 || hpCount <= 10) &&
          React.createElement(
            "text",
            {
              x: i === hpCount ? x - 0.55 : x,
              y: -2.1,
              textAnchor: i === hpCount ? "end" : "middle",
              fontSize: i === hpCount ? 1.22 : 1.15,
              fill: i === hpCount ? "#d7e8ef" : "#b8c8cf",
              opacity: i === hpCount ? 0.78 : 0.62,
              fontWeight: i === hpCount ? 800 : 600,
            },
            i,
          ),
      );
    }),
    React.createElement(
      "text",
      { x: 0.9, y: -4.2, fontSize: 1.25, fill: "#9eb0b7", opacity: 0.72 },
      "HP",
    ),
  );
});

// MountingHolesLayer
const MountingHolesLayer = React.memo(function MountingHolesLayer({ config }) {
  if (!config.enabled) return null;
  const kr = Math.max(0, config.keepoutRadius ?? MOUNTING_HOLE_KEEPOUT_R_MM);
  return React.createElement(
    "g",
    { className: "mounting-holes-layer" },
    config.holes.map((h) =>
      React.createElement(
        "g",
        {
          key: h.id,
          "data-mounting-hole-id": h.id,
          "data-mounting-hole-x": h.x,
        },
        config.showKeepouts &&
          kr > 0 &&
          React.createElement("circle", {
            cx: h.x,
            cy: h.y,
            r: kr,
            fill: "rgba(255,190,80,0.045)",
            stroke: "rgba(255,190,80,0.28)",
            strokeWidth: 0.18,
            strokeDasharray: "0.8 0.4",
          }),
        config.holeShape === "oval"
          ? React.createElement("rect", {
              x:
                h.x -
                Math.max(config.ovalLength ?? 4.8, MOUNTING_HOLE_DIAMETER_MM) /
                  2,
              y: h.y - MOUNTING_HOLE_DIAMETER_MM / 2,
              width: Math.max(
                config.ovalLength ?? 4.8,
                MOUNTING_HOLE_DIAMETER_MM,
              ),
              height: MOUNTING_HOLE_DIAMETER_MM,
              rx: MOUNTING_HOLE_DIAMETER_MM / 2,
              fill: "#0a0a0a",
              stroke: "#777",
              strokeWidth: 0.3,
            })
          : React.createElement("circle", {
              cx: h.x,
              cy: h.y,
              r: MOUNTING_HOLE_DIAMETER_MM / 2,
              fill: "#0a0a0a",
              stroke: "#777",
              strokeWidth: 0.3,
            }),
      ),
    ),
  );
});

// PCBLayer
const PCBLayer = React.memo(function PCBLayer({ pcb }) {
  if (!pcb.enabled) return null;
  return React.createElement("rect", {
    x: pcb.x,
    y: pcb.y,
    width: pcb.width,
    height: pcb.height,
    fill: "none",
    stroke: "#004488",
    strokeWidth: 0.4,
    strokeDasharray: "2 1",
  });
});

// ArtworksLayer
const artworkPreviewUrlCache = new Map();
function artworkPreviewUrl(artwork, mode) {
  if (!mode || mode === "composite") return artwork.imageDataUrl;
  const key = `${mode}:${artwork.imageDataUrl}`;
  if (artworkPreviewUrlCache.has(key)) return artworkPreviewUrlCache.get(key);
  const transparent =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  if (mode === "material") return transparent;
  if (!String(artwork.imageDataUrl || "").startsWith("data:image/svg+xml"))
    return mode === "silkscreen" ? artwork.imageDataUrl : transparent;
  try {
    const comma = artwork.imageDataUrl.indexOf(",");
    const source = artwork.imageDataUrl.slice(0, comma).includes(";base64")
      ? atob(artwork.imageDataUrl.slice(comma + 1))
      : decodeURIComponent(artwork.imageDataUrl.slice(comma + 1));
    const doc = new DOMParser().parseFromString(source, "image/svg+xml");
    const root = doc.documentElement;
    const wanted =
      mode === "copper" ? "F.Cu" : mode === "mask" ? "F.Mask" : "F.SilkS";
    const layerFor = (element) => {
      const explicit = element.getAttribute("data-kicad-layer");
      if (explicit) return explicit;
      if (element.closest("mask")) return "F.Mask";
      if (element.closest('g[mask*="top-stop"],g[mask*="front-mask"]'))
        return "F.Cu";
      return "F.SilkS";
    };
    const shapes = [...root.querySelectorAll("path,circle,rect,polygon,text")]
      .filter(
        (element) =>
          layerFor(element) === wanted &&
          !(
            element.closest("mask") &&
            element.tagName === "rect" &&
            element.getAttribute("fill") === "black"
          ),
      )
      .map((element) => element.outerHTML)
      .join("");
    const viewBox = root.getAttribute("viewBox") || "0 0 100 100";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${shapes}</svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    if (artworkPreviewUrlCache.size > 40) artworkPreviewUrlCache.clear();
    artworkPreviewUrlCache.set(key, url);
    return url;
  } catch {
    return transparent;
  }
}
const ArtworksLayer = React.memo(function ArtworksLayer({
  artworks,
  layer,
  selectedArtwork,
  artworkDragPreview,
  viewMode,
  clipToPanel,
  widthMM,
  heightMM,
  ignoreLockedClicks,
  showInDrill,
  drillOpacity,
  artworkResizePreview,
  previewMode,
}) {
  if (viewMode === "rear") return null;
  if (viewMode === "drill" && !showInDrill) return null;
  const clipId = `panel-clip-${layer}`;
  const visible = artworks.filter((a) => a.layer === layer && a.visible);
  if (visible.length === 0) return null;
  return React.createElement(
    "g",
    null,
    clipToPanel &&
      React.createElement(
        "defs",
        null,
        React.createElement(
          "clipPath",
          { id: clipId },
          React.createElement("rect", {
            x: 0,
            y: 0,
            width: widthMM,
            height: heightMM,
          }),
        ),
      ),
    React.createElement(
      "g",
      { clipPath: clipToPanel ? `url(#${clipId})` : undefined },
      visible.map((a) => {
        const dragPrev =
          artworkDragPreview?.id === a.id ? artworkDragPreview : null;
        const resizePrev =
          artworkResizePreview?.id === a.id ? artworkResizePreview : null;
        const cx = resizePrev?.x ?? dragPrev?.x ?? a.x;
        const cy = resizePrev?.y ?? dragPrev?.y ?? a.y;
        const w = resizePrev?.width ?? a.width;
        const h = resizePrev?.height ?? a.height;
        const isSel = selectedArtwork === a.id;
        const HS = 1.5;
        return React.createElement(
          "g",
          {
            key: a.id,
            "data-artwork-id": a.id,
            style: {
              cursor: a.locked ? "default" : "move",
              pointerEvents: a.locked ? "none" : "auto",
            },
          },
          React.createElement("image", {
            href: artworkPreviewUrl(a, previewMode),
            x: cx - w / 2,
            y: cy - h / 2,
            width: w,
            height: h,
            opacity:
              viewMode === "drill" ? drillOpacity * a.opacity : a.opacity,
            preserveAspectRatio: "none",
            transform: `rotate(${a.rotation}, ${cx}, ${cy})`,
          }),
          isSel &&
            React.createElement(
              "g",
              { transform: `rotate(${a.rotation}, ${cx}, ${cy})` },
              React.createElement("rect", {
                x: cx - w / 2 - 1,
                y: cy - h / 2 - 1,
                width: w + 2,
                height: h + 2,
                fill: "none",
                stroke: "#c99a4a",
                strokeWidth: 0.3,
                strokeDasharray: "1.5 0.5",
                style: { pointerEvents: "none" },
              }),
              !a.locked &&
                [
                  ["tl", cx - w / 2, cy - h / 2],
                  ["tr", cx + w / 2, cy - h / 2],
                  ["bl", cx - w / 2, cy + h / 2],
                  ["br", cx + w / 2, cy + h / 2],
                ].map(([corner, hx, hy]) =>
                  React.createElement("rect", {
                    key: corner,
                    "data-artwork-resize": `${a.id}:${corner}`,
                    x: hx - HS,
                    y: hy - HS,
                    width: HS * 2,
                    height: HS * 2,
                    fill: "#c99a4a",
                    stroke: "#001a2a",
                    strokeWidth: 0.2,
                    style: {
                      cursor:
                        corner === "tl" || corner === "br"
                          ? "nwse-resize"
                          : "nesw-resize",
                    },
                  }),
                ),
            ),
        );
      }),
    ),
  );
});

// TopHardwareLayer
const TopHardwareLayer = React.memo(function TopHardwareLayer({
  components,
  dragPreview,
  viewMode,
  style,
  renderMode,
  performanceMode,
  zoom,
  dragPerfMode = false,
}) {
  if (viewMode === "rear" || viewMode === "drill" || renderMode === "off")
    return null;
  const isRealtime = !!dragPreview;
  const autoUseClassic =
    renderMode === "auto" && (isRealtime || (performanceMode && zoom < 0.7));
  const effectiveStyle =
    renderMode === "realistic"
      ? "realistic"
      : renderMode === "classic"
        ? "classic"
        : renderMode === "auto"
          ? autoUseClassic
            ? "classic"
            : "realistic"
          : style;
  const realistic = effectiveStyle === "realistic";
  return React.createElement(
    "g",
    { style: { pointerEvents: "none" } },
    components
      .filter(
        (c) =>
          topHardwareVisible(c) && !(dragPerfMode && dragPreview?.has(c.id)),
      )
      .map((c) => {
        const preview = dragPreview?.get(c.id);
        const cx = preview?.x ?? c.x;
        const cy = preview?.y ?? c.y;
        const color = topColor(c);
        const rot = `rotate(${c.rotation}, ${cx}, ${cy})`;
        const hwOpacity = preview ? 0.4 : 1;
        if (!realistic) {
          if (isDip8Socket(c)) {
            const b = dip8SocketBodyBounds();
            const holes = dip8SocketHoleCenters({ ...c, x: cx, y: cy });
            return React.createElement(
              "g",
              {
                key: c.id,
                "data-top-hardware-id": c.id,
                transform: rot,
                opacity: hwOpacity,
              },
              React.createElement("rect", {
                x: cx - b.w / 2,
                y: cy - b.h / 2,
                width: b.w,
                height: b.h,
                rx: 0.45,
                fill: "#090a0c",
                stroke: "rgba(220,230,235,0.34)",
                strokeWidth: 0.14,
              }),
              React.createElement("rect", {
                x: cx - b.w * 0.28,
                y: cy - b.h * 0.28,
                width: b.w * 0.56,
                height: b.h * 0.56,
                rx: 0.1,
                fill: "rgba(0,0,0,0.62)",
                stroke: "rgba(255,255,255,0.08)",
                strokeWidth: 0.08,
              }),
              React.createElement("path", {
                d: `M ${cx - 1.3} ${cy - b.h / 2} A 1.3 1.3 0 0 0 ${cx + 1.3} ${cy - b.h / 2}`,
                fill: "none",
                stroke: "rgba(220,230,235,.55)",
                strokeWidth: "0.18",
              }),
              holes.map((h, i) =>
                React.createElement("circle", {
                  key: `dip8-socket-contact-${i}`,
                  cx: h.x,
                  cy: h.y,
                  r: Math.max(0.34, (c.holeDiameter || 1.05) * 0.34),
                  fill: "#b8b0a0",
                  stroke: "#2d261f",
                  strokeWidth: 0.08,
                }),
              ),
            );
          }
          if (isPotLike(c)) {
            const d = visualKnobDiameter(c);
            const transparentKnob = isTrimPot(c) && !!c.knobTransparent;
            return React.createElement(
              "g",
              {
                key: c.id,
                "data-top-hardware-id": c.id,
                transform: rot,
                opacity: hwOpacity,
              },
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: d / 2,
                fill: color,
                fillOpacity: transparentKnob ? 0.5 : 1,
                stroke: "none",
                strokeWidth: 0,
              }),
              React.createElement("line", {
                x1: cx,
                y1: cy,
                x2: cx,
                y2: cy - d * 0.36,
                stroke: "rgba(255,255,255,0.62)",
                strokeWidth: 0.35,
                strokeLinecap: "round",
              }),
            );
          }
          if (isFaderLike(c)) {
            const capW = c.faderHandleW ?? Math.max(7, (c.frontW ?? 9) * 1.15);
            const capH = c.faderHandleH ?? 5;
            return React.createElement(
              "g",
              {
                key: c.id,
                "data-top-hardware-id": c.id,
                transform: rot,
                opacity: hwOpacity,
              },
              React.createElement("rect", {
                x: cx - capW / 2,
                y: cy - capH / 2,
                width: capW,
                height: capH,
                rx: 1.2,
                fill: color,
                stroke: "rgba(0,0,0,0.6)",
                strokeWidth: 0.3,
              }),
            );
          }
          if (isJackLike(c)) {
            const outer = Math.max(c.frontDiameter, 8) / 2;
            return React.createElement(
              "g",
              { key: c.id, "data-top-hardware-id": c.id, opacity: hwOpacity },
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: outer * 0.92,
                fill: color,
                stroke: "rgba(0,0,0,0.65)",
                strokeWidth: 0.22,
              }),
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: outer * 0.58,
                fill: "#111",
                stroke: "rgba(255,255,255,0.22)",
                strokeWidth: 0.12,
              }),
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: Math.max(1.5, c.holeDiameter * 0.3),
                fill: "#050505",
              }),
            );
          }
          if (isButtonLike(c) || isLedLike(c)) {
            const r = isButtonLike(c)
              ? visualButtonRadius(c)
              : Math.max(1.5, Math.min(1.65, c.holeDiameter / 2));
            return React.createElement(
              "g",
              { key: c.id, "data-top-hardware-id": c.id, opacity: hwOpacity },
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: r,
                fill: color,
                stroke: "rgba(255,255,255,0.32)",
                strokeWidth: 0.25,
              }),
            );
          }
          if (c.type === "toggleSplash") {
            const washerR = c.frontDiameter / 2;
            const holeR = c.holeDiameter / 2;
            return React.createElement(
              "g",
              {
                key: c.id,
                "data-top-hardware-id": c.id,
                transform: rot,
                opacity: hwOpacity,
              },
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: washerR,
                fill: "#d8d8d2",
                stroke: "rgba(0,0,0,0.68)",
                strokeWidth: 0.3,
              }),
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: Math.max(1, washerR - 1.15),
                fill: "#f0f0eb",
                stroke: "rgba(0,0,0,0.35)",
                strokeWidth: 0.16,
              }),
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: holeR * 0.56,
                fill: "#4a4a45",
                stroke: "rgba(255,255,255,0.45)",
                strokeWidth: 0.16,
              }),
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: Math.max(1.7, holeR * 0.36),
                fill: "#c1122b",
                stroke: "rgba(0,0,0,0.48)",
                strokeWidth: 0.16,
              }),
              React.createElement("line", {
                x1: cx,
                y1: cy - 0.5,
                x2: cx + 4.6,
                y2: cy - 12.8,
                stroke: "#cfd2d0",
                strokeWidth: 1.25,
                strokeLinecap: "round",
              }),
              React.createElement("line", {
                x1: cx + 0.7,
                y1: cy - 2.4,
                x2: cx + 4.8,
                y2: cy - 12.8,
                stroke: "rgba(255,255,255,0.55)",
                strokeWidth: 0.3,
                strokeLinecap: "round",
              }),
              React.createElement("circle", {
                cx: cx + 4.6,
                cy: cy - 12.8,
                r: 0.72,
                fill: "#e7e9e6",
                stroke: "rgba(0,0,0,0.35)",
                strokeWidth: 0.12,
              }),
            );
          }
          if (
            c.type === "toggle" ||
            c.type === "toggleSpdt" ||
            c.type === "toggle2m"
          ) {
            const _nutShape =
              c.nutShape ?? (c.type === "toggle2m" ? "hex" : "circle");
            const _R = c.frontDiameter / 2;
            const _nutEl =
              _nutShape === "hex"
                ? React.createElement("polygon", {
                    points: [0, 60, 120, 180, 240, 300]
                      .map((deg) => {
                        const rad = (deg * Math.PI) / 180;
                        return `${cx + _R * Math.cos(rad)},${cy + _R * Math.sin(rad)}`;
                      })
                      .join(" "),
                    fill: color,
                    stroke: "rgba(0,0,0,0.55)",
                    strokeWidth: 0.25,
                  })
                : React.createElement("circle", {
                    cx: cx,
                    cy: cy,
                    r: _R,
                    fill: color,
                    stroke: "rgba(0,0,0,0.55)",
                    strokeWidth: 0.25,
                  });
            return React.createElement(
              "g",
              {
                key: c.id,
                "data-top-hardware-id": c.id,
                transform: rot,
                opacity: hwOpacity,
              },
              _nutEl,
              React.createElement("rect", {
                x: cx - Math.max(c.holeDiameter * 0.375, 1.25),
                y: cy - _R * 1.3,
                width: Math.max(c.holeDiameter * 0.75, 2.5),
                height: _R * 1.7,
                rx: Math.max(c.holeDiameter * 0.375, 1.25),
                fill: color,
                fillOpacity: 0.85,
                stroke: "rgba(0,0,0,0.45)",
                strokeWidth: 0.2,
              }),
            );
          }
          if (isJoystick(c)) {
            const R = (c.frontDiameter ?? 40.4) / 2;
            const Rid = 14.0;
            const Rcap = R * 0.175;
            const screwOff = 12.75;
            const screwCorners = [
              [1, 1],
              [-1, 1],
              [-1, -1],
              [1, -1],
            ];
            return React.createElement(
              "g",
              {
                key: c.id,
                "data-top-hardware-id": c.id,
                transform: rot,
                opacity: hwOpacity,
              },
              React.createElement("circle", {
                cx,
                cy,
                r: R,
                fill: "#1e2022",
                stroke: "rgba(255,255,255,0.14)",
                strokeWidth: 0.3,
              }),
              React.createElement("circle", {
                cx,
                cy,
                r: Rid,
                fill: "#090b0c",
              }),
              ...[Rid, Rid * 0.857, Rid * 0.679, Rid * 0.536].map((r, i) =>
                React.createElement("circle", {
                  key: `br${i}`,
                  cx,
                  cy,
                  r,
                  fill: "none",
                  stroke: "#050607",
                  strokeWidth: 0.6,
                }),
              ),
              React.createElement("circle", {
                cx,
                cy,
                r: Rcap,
                fill: "#111314",
                stroke: "#2a2c2e",
                strokeWidth: 0.2,
              }),
              ...screwCorners.map(([sx, sy], i) =>
                React.createElement("circle", {
                  key: `s${i}`,
                  cx: cx + sx * screwOff,
                  cy: cy + sy * screwOff,
                  r: 1.4,
                  fill: "#252729",
                  stroke: "#454749",
                  strokeWidth: 0.2,
                }),
              ),
            );
          }
        }
        if (isDip8Socket(c)) {
          const b = getFrontBounds(c);
          const pinHoles = dip8SocketPinHoles({ ...c, x: cx, y: cy });
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            React.createElement("rect", {
              x: cx - b.w / 2,
              y: cy - b.h / 2,
              width: b.w,
              height: b.h,
              rx: 0.58,
              fill: "#090a0c",
              stroke: "rgba(255,255,255,0.22)",
              strokeWidth: 0.16,
            }),
            React.createElement("rect", {
              x: cx - b.w / 2 + 0.45,
              y: cy - b.h / 2 + 0.42,
              width: b.w - 0.9,
              height: b.h - 0.84,
              rx: 0.35,
              fill: "#151719",
              stroke: "rgba(0,0,0,0.65)",
              strokeWidth: 0.12,
            }),
            React.createElement("rect", {
              x: cx - b.w * 0.27,
              y: cy - b.h * 0.3,
              width: b.w * 0.54,
              height: b.h * 0.6,
              rx: 0.16,
              fill: "#050505",
              stroke: "rgba(255,255,255,0.08)",
              strokeWidth: 0.1,
            }),
            React.createElement("path", {
              d: `M ${cx - 1.55} ${cy + b.h / 2 - 0.04} C ${cx - 0.76} ${cy + b.h / 2 - 0.94}, ${cx + 0.76} ${cy + b.h / 2 - 0.94}, ${cx + 1.55} ${cy + b.h / 2 - 0.04}`,
              fill: "#050505",
              stroke: "rgba(220,220,210,0.34)",
              strokeWidth: 0.1,
            }),
            React.createElement("path", {
              d: `M ${cx - b.w * 0.43} ${cy - b.h * 0.32} H ${cx + b.w * 0.43}`,
              stroke: "rgba(255,255,255,0.11)",
              strokeWidth: 0.1,
              strokeLinecap: "round",
            }),
            pinHoles.map((h, i) =>
              React.createElement(
                "g",
                { key: `dip8-real-pin-${i}` },
                React.createElement("circle", {
                  cx: h.x,
                  cy: h.y,
                  r: Math.max(0.56, h.r * 0.82),
                  fill: "#c9b98d",
                  stroke: "#3b3424",
                  strokeWidth: 0.12,
                }),
                React.createElement("circle", {
                  cx: h.x,
                  cy: h.y,
                  r: Math.max(0.3, h.r * 0.42),
                  fill: "#191919",
                  stroke: "rgba(255,255,255,0.18)",
                  strokeWidth: 0.06,
                }),
                React.createElement("circle", {
                  cx: h.x - 0.12,
                  cy: h.y - 0.12,
                  r: Math.max(0.1, h.r * 0.17),
                  fill: "rgba(255,255,255,0.55)",
                  stroke: "none",
                }),
              ),
            ),
          );
        }
        if (c.type === "slideSwitch8pos") {
          const slotW = c.holeW ?? 26.6;
          const slotH = c.holeH ?? 4.0;
          const actW = 5.4;
          const actH = 3.8;
          const actVisualH = 4.5;
          const actX = cx - slotW / 2 + 0.1;
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            React.createElement("rect", {
              x: cx - slotW / 2,
              y: cy - slotH / 2,
              width: slotW,
              height: slotH,
              rx: 0.28,
              fill: "#010101",
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 0.08,
            }),
            React.createElement("rect", {
              x: actX,
              y: cy - actVisualH / 2,
              width: actW,
              height: actVisualH,
              rx: 0.32,
              fill: "#11161a",
              stroke: "rgba(255,255,255,0.26)",
              strokeWidth: 0.08,
            }),
            React.createElement("rect", {
              x: actX + 0.1,
              y: cy - actH / 2 + 0.1,
              width: actW - 0.2,
              height: actH - 0.2,
              rx: 0.18,
              fill: "#20272c",
              stroke: "rgba(0,0,0,0.65)",
              strokeWidth: 0.05,
            }),
            Array.from({ length: 5 }, (_, i) => {
              const xx = actX + 0.65 + i * 0.96;
              return React.createElement("line", {
                key: `ss18-act-rib-${i}`,
                x1: xx,
                x2: xx,
                y1: cy - actVisualH / 2 + 0.4,
                y2: cy + actVisualH / 2 - 0.4,
                stroke: "rgba(0,0,0,0.90)",
                strokeWidth: 0.22,
                strokeLinecap: "round",
              });
            }),
          );
        }
        if (c.type === "subMiniSwitch") {
          const slotW = c.holeW ?? 3.2;
          const slotH = c.holeH ?? 1.8;
          const actW = 1.28;
          const actH = 2.25;
          const actX = cx - slotW / 2 + 0.18;
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            React.createElement("rect", {
              x: cx - slotW / 2,
              y: cy - slotH / 2,
              width: slotW,
              height: slotH,
              rx: 0.18,
              fill: "#010101",
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 0.07,
            }),
            React.createElement("rect", {
              x: actX,
              y: cy - actH / 2,
              width: actW,
              height: actH,
              rx: 0.18,
              fill: "#11161a",
              stroke: "rgba(255,255,255,0.25)",
              strokeWidth: 0.07,
            }),
            Array.from({ length: 3 }, (_, i) => {
              const xx = actX + 0.25 + i * 0.36;
              return React.createElement("line", {
                key: `submini-slide-rib-${i}`,
                x1: xx,
                x2: xx,
                y1: cy - actH / 2 + 0.24,
                y2: cy + actH / 2 - 0.24,
                stroke: "rgba(0,0,0,0.86)",
                strokeWidth: 0.1,
                strokeLinecap: "round",
              });
            }),
          );
        }
        if (c.type === "slideSwitchMini") {
          const slotW = c.holeW ?? 3.8;
          const slotH = c.holeH ?? 1.8;
          const actW = 1.55;
          const actH = 2.45;
          const actX = cx - slotW / 2 + 0.2;
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            React.createElement("rect", {
              x: cx - slotW / 2,
              y: cy - slotH / 2,
              width: slotW,
              height: slotH,
              rx: 0.18,
              fill: "#010101",
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 0.07,
            }),
            React.createElement("rect", {
              x: actX,
              y: cy - actH / 2,
              width: actW,
              height: actH,
              rx: 0.18,
              fill: "#11161a",
              stroke: "rgba(255,255,255,0.25)",
              strokeWidth: 0.07,
            }),
            Array.from({ length: 3 }, (_, i) => {
              const xx = actX + 0.32 + i * 0.44;
              return React.createElement("line", {
                key: `dpdt-slide-rib-${i}`,
                x1: xx,
                x2: xx,
                y1: cy - actH / 2 + 0.25,
                y2: cy + actH / 2 - 0.25,
                stroke: "rgba(0,0,0,0.86)",
                strokeWidth: 0.12,
                strokeLinecap: "round",
              });
            }),
          );
        }
        if (isMiniSlideSwitch(c)) {
          const b = getFrontBounds(c);
          const knobW = Math.max(2.2, b.w * 0.28);
          const knobH = Math.max(3.0, b.h * 0.62);
          const knobX = cx + b.w * 0.18;
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            React.createElement("rect", {
              x: cx - b.w / 2,
              y: cy - b.h / 2,
              width: b.w,
              height: b.h,
              rx: 0.45,
              fill: "#f2f2ee",
              stroke: "#0b0b0b",
              strokeWidth: 0.28,
            }),
            React.createElement("rect", {
              x: cx - b.w / 2 + 0.55,
              y: cy - b.h / 2 + 0.55,
              width: b.w - 1.1,
              height: b.h - 1.1,
              rx: 0.25,
              fill: "#151515",
              stroke: "#a8a8a8",
              strokeWidth: 0.12,
            }),
            React.createElement("rect", {
              x: knobX - knobW / 2,
              y: cy - knobH / 2,
              width: knobW,
              height: knobH,
              rx: 0.2,
              fill: "#d9d9d5",
              stroke: "#ffffff",
              strokeWidth: 0.12,
            }),
          );
        }
        if (isPotLike(c)) {
          const d = visualKnobDiameter(c);
          const r = d / 2;
          if (isTrimPot(c)) {
            const ribCount = 10;
            const transparentKnob = !!c.knobTransparent;
            const ribs = Array.from({ length: ribCount }, (_, i) => {
              const a = (i / ribCount) * Math.PI * 2;
              const x1 = cx + Math.cos(a) * r * 0.76;
              const y1 = cy + Math.sin(a) * r * 0.76;
              const x2 = cx + Math.cos(a) * r * 0.98;
              const y2 = cy + Math.sin(a) * r * 0.98;
              return React.createElement("line", {
                key: i,
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                stroke: "rgba(255,255,255,0.14)",
                strokeWidth: 0.12,
                strokeLinecap: "round",
              });
            });
            return React.createElement(
              "g",
              {
                key: c.id,
                "data-top-hardware-id": c.id,
                transform: rot,
                opacity: hwOpacity,
              },
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: r + 0.28,
                fill: transparentKnob ? color : "#080808",
                fillOpacity: transparentKnob ? 0.28 : 1,
                stroke: "rgba(255,255,255,0.28)",
                strokeWidth: 0.16,
              }),
              transparentKnob &&
                React.createElement("circle", {
                  cx: cx,
                  cy: cy,
                  r: r * 0.72,
                  fill: color,
                  fillOpacity: 0.72,
                  stroke: "none",
                }),
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: r,
                fill: color,
                fillOpacity: transparentKnob ? 0.46 : 1,
                stroke: transparentKnob ? color : "#050505",
                strokeOpacity: transparentKnob ? 0.82 : 1,
                strokeWidth: 0.35,
              }),
              ribs,
              React.createElement("circle", {
                cx: cx - r * 0.26,
                cy: cy - r * 0.34,
                r: r * 0.26,
                fill: "rgba(255,255,255,0.20)",
                stroke: "none",
              }),
              React.createElement("line", {
                x1: cx,
                y1: cy - r * 0.06,
                x2: cx,
                y2: cy - r * 0.82,
                stroke: "#f4f4ee",
                strokeWidth: 0.42,
                strokeLinecap: "round",
              }),
            );
          }
          const pointerLen = r * 0.76;
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r + 0.85,
              fill: "#050505",
              stroke: "none",
              strokeWidth: 0,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r + 0.25,
              fill: "#111",
              stroke: "#2b2b2b",
              strokeWidth: 0.42,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 0.82,
              fill: "#1a1a1a",
              stroke: "#3f3f3f",
              strokeWidth: 0.18,
            }),
            React.createElement("circle", {
              cx: cx - r * 0.28,
              cy: cy - r * 0.36,
              r: r * 0.32,
              fill: "rgba(255,255,255,0.34)",
              stroke: "none",
            }),
            React.createElement("path", {
              d: `M ${cx - r * 0.48} ${cy - r * 0.2} C ${cx - r * 0.32} ${cy - r * 0.58}, ${cx + r * 0.12} ${cy - r * 0.72}, ${cx + r * 0.38} ${cy - r * 0.46}`,
              fill: "none",
              stroke: "rgba(255,255,255,0.32)",
              strokeWidth: 0.18,
              strokeLinecap: "round",
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 0.98,
              fill: "none",
              stroke: "rgba(255,255,255,0.12)",
              strokeWidth: 0.16,
              strokeDasharray: "1.1 1.0",
            }),
            React.createElement("line", {
              x1: cx,
              y1: cy - r * 0.15,
              x2: cx,
              y2: cy - pointerLen,
              stroke: "#f7f7f2",
              strokeWidth: 0.52,
              strokeLinecap: "round",
            }),
          );
        }
        if (isFaderLike(c)) {
          const b = getFrontBounds(c);
          const led = c.type === "fader20led";
          const alpha20 = c.type === "fader20" || c.type === "fader20led";
          const slotW = alpha20
            ? Math.max(1.7, b.w * 0.22)
            : Math.max(2.0, b.w * 0.3);
          const slotH = Math.max(10, b.h * 0.88);
          const capFill = led ? c.topColor || "#ff2b2b" : "#202224";
          const capW = alpha20
            ? Math.max(2.7, Math.min(3.4, b.w * 0.4))
            : (c.faderHandleW ?? Math.max(6.8, b.w * 0.96));
          const capH = alpha20
            ? Math.max(3.6, Math.min(4.7, b.w * 0.58))
            : (c.faderHandleH ?? 4.8);
          const stemW = alpha20
            ? Math.max(1.15, slotW * 0.72)
            : Math.max(1.65, slotW * 0.86);
          const stemH = alpha20
            ? Math.max(capH + 1.4, 5.0)
            : Math.max(capH + 0.8, 5.2);
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            React.createElement("rect", {
              x: cx - slotW / 2,
              y: cy - slotH / 2,
              width: slotW,
              height: slotH,
              rx: slotW / 2,
              fill: "#050505",
              stroke: "rgba(255,255,255,0.20)",
              strokeWidth: 0.13,
            }),
            led
              ? React.createElement(
                  "g",
                  null,
                  React.createElement("rect", {
                    x: cx - stemW / 2,
                    y: cy - stemH / 2,
                    width: stemW,
                    height: stemH,
                    rx: 0.28,
                    fill: "#111",
                    stroke: "#2d2d2d",
                    strokeWidth: 0.12,
                  }),
                  React.createElement("rect", {
                    x: cx - capW / 2,
                    y: cy - capH / 2,
                    width: capW,
                    height: capH,
                    rx: 0.34,
                    fill: "rgba(255,255,255,0.12)",
                    stroke: "rgba(255,255,255,0.55)",
                    strokeWidth: 0.15,
                  }),
                  React.createElement("rect", {
                    x: cx - capW * 0.22,
                    y: cy - capH * 0.2,
                    width: capW * 0.44,
                    height: capH * 0.4,
                    rx: 0.12,
                    fill: capFill,
                    opacity: 0.95,
                  }),
                  React.createElement("circle", {
                    cx: cx - capW * 0.14,
                    cy: cy - capH * 0.26,
                    r: Math.max(0.24, capW * 0.11),
                    fill: "rgba(255,255,255,0.72)",
                    stroke: "none",
                  }),
                )
              : React.createElement(
                  "g",
                  null,
                  React.createElement("rect", {
                    x: cx - stemW / 2,
                    y: cy - stemH / 2,
                    width: stemW,
                    height: stemH,
                    rx: 0.28,
                    fill: "#111",
                    stroke: "#2d2d2d",
                    strokeWidth: 0.12,
                  }),
                  React.createElement("rect", {
                    x: cx - capW / 2,
                    y: cy - capH / 2,
                    width: capW,
                    height: capH,
                    rx: 0.34,
                    fill: "rgba(255,255,255,0.10)",
                    stroke: "rgba(255,255,255,0.42)",
                    strokeWidth: 0.14,
                  }),
                  React.createElement("rect", {
                    x: cx - capW * 0.22,
                    y: cy - capH * 0.2,
                    width: capW * 0.44,
                    height: capH * 0.4,
                    rx: 0.12,
                    fill: capFill,
                    opacity: 0.95,
                  }),
                  React.createElement("circle", {
                    cx: cx - capW * 0.14,
                    cy: cy - capH * 0.26,
                    r: Math.max(0.22, capW * 0.1),
                    fill: "rgba(255,255,255,0.34)",
                    stroke: "none",
                  }),
                ),
          );
        }
        if (isJackLike(c)) {
          const outer = Math.max(c.frontDiameter, 8) / 2;
          const rimOuter = outer * 0.92;
          const metalRing = outer * 0.72;
          const innerBevel = outer * 0.56;
          const hole = Math.max(1.65, c.holeDiameter * 0.3);
          return React.createElement(
            "g",
            { key: c.id, "data-top-hardware-id": c.id, opacity: hwOpacity },
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: rimOuter,
              fill: "#16191b",
              stroke: "#030303",
              strokeWidth: 0.22,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: metalRing,
              fill: "#a2a8ad",
              stroke: "rgba(255,255,255,0.20)",
              strokeWidth: 0.1,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: metalRing * 0.88,
              fill: "#252a2e",
              stroke: "rgba(0,0,0,0.72)",
              strokeWidth: 0.16,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: innerBevel,
              fill: "#070808",
              stroke: "rgba(210,220,225,0.42)",
              strokeWidth: 0.18,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: hole,
              fill: "#000",
              stroke: "rgba(255,255,255,0.22)",
              strokeWidth: 0.1,
            }),
            React.createElement("path", {
              d: `M ${cx - metalRing * 0.52} ${cy - metalRing * 0.35} C ${cx - metalRing * 0.28} ${cy - metalRing * 0.68}, ${cx + metalRing * 0.34} ${cy - metalRing * 0.58}, ${cx + metalRing * 0.54} ${cy - metalRing * 0.18}`,
              fill: "none",
              stroke: "rgba(255,255,255,0.34)",
              strokeWidth: 0.15,
              strokeLinecap: "round",
            }),
          );
        }
        if (c.type === "tact6mm") {
          const r = visualButtonRadius(c);
          const cap = color || "#b9bec4";
          return React.createElement(
            "g",
            { key: c.id, "data-top-hardware-id": c.id, opacity: hwOpacity },
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 1.42,
              fill: "rgba(8,10,12,0.44)",
              stroke: "rgba(255,255,255,0.10)",
              strokeWidth: 0.1,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 1.12,
              fill: "#343a40",
              stroke: "rgba(0,0,0,0.72)",
              strokeWidth: 0.16,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 0.92,
              fill: cap,
              stroke: "rgba(245,248,250,0.36)",
              strokeWidth: 0.14,
            }),
            React.createElement("circle", {
              cx: cx - r * 0.25,
              cy: cy - r * 0.3,
              r: r * 0.3,
              fill: "rgba(255,255,255,0.36)",
              stroke: "none",
            }),
            React.createElement("path", {
              d: `M ${cx - r * 0.62} ${cy - r * 0.06} C ${cx - r * 0.42} ${cy - r * 0.62}, ${cx + r * 0.22} ${cy - r * 0.66}, ${cx + r * 0.52} ${cy - r * 0.2}`,
              fill: "none",
              stroke: "rgba(255,255,255,0.20)",
              strokeWidth: 0.11,
              strokeLinecap: "round",
            }),
          );
        }
        if (c.type === "tactled") {
          const r = 5.5 / 2;
          const ledColor = color || "#ff7a2a";
          return React.createElement(
            "g",
            { key: c.id, "data-top-hardware-id": c.id, opacity: hwOpacity },
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 1.18,
              fill: "rgba(12,14,16,0.34)",
              stroke: "rgba(255,255,255,0.10)",
              strokeWidth: 0.14,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 1.02,
              fill: "#7d858d",
              opacity: 0.74,
              stroke: "rgba(230,238,244,0.38)",
              strokeWidth: 0.16,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 0.78,
              fill: ledColor,
              opacity: 0.38,
              stroke: "none",
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 0.38,
              fill: ledColor,
              opacity: 0.68,
              stroke: "none",
            }),
            React.createElement("circle", {
              cx: cx - r * 0.25,
              cy: cy - r * 0.32,
              r: r * 0.28,
              fill: "rgba(255,255,255,0.42)",
              stroke: "none",
            }),
            React.createElement("path", {
              d: `M ${cx - r * 0.52} ${cy - r * 0.08} C ${cx - r * 0.34} ${cy - r * 0.55}, ${cx + r * 0.18} ${cy - r * 0.58}, ${cx + r * 0.42} ${cy - r * 0.22}`,
              fill: "none",
              stroke: "rgba(255,255,255,0.22)",
              strokeWidth: 0.14,
              strokeLinecap: "round",
            }),
          );
        }
        if (isLedLike(c)) {
          const lensR = Math.max(1.45, Math.min(1.6, c.holeDiameter / 2));
          const bezelR = lensR * 1.18;
          return React.createElement(
            "g",
            { key: c.id, "data-top-hardware-id": c.id, opacity: hwOpacity },
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: lensR * 1.38,
              fill: color,
              opacity: 0.16,
              stroke: "none",
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: bezelR,
              fill: "rgba(55,22,22,0.78)",
              stroke: "rgba(255,255,255,0.14)",
              strokeWidth: 0.12,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: lensR,
              fill: color,
              stroke: "#f6f6f2",
              strokeWidth: 0.16,
            }),
            React.createElement("circle", {
              cx: cx - lensR * 0.24,
              cy: cy - lensR * 0.28,
              r: lensR * 0.25,
              fill: "rgba(255,255,255,0.78)",
              stroke: "none",
            }),
          );
        }
        if (isButtonLike(c)) {
          const r = visualButtonRadius(c);
          return React.createElement(
            "g",
            { key: c.id, "data-top-hardware-id": c.id, opacity: hwOpacity },
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r * 1.12,
              fill: "rgba(12,14,16,0.40)",
              stroke: "rgba(255,255,255,0.12)",
              strokeWidth: 0.14,
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: r,
              fill: color,
              stroke: "rgba(255,255,255,0.30)",
              strokeWidth: 0.16,
            }),
            React.createElement("circle", {
              cx: cx - r * 0.25,
              cy: cy - r * 0.3,
              r: r * 0.28,
              fill: "rgba(255,255,255,0.36)",
              stroke: "none",
            }),
          );
        }
        if (
          c.type === "toggle" ||
          c.type === "toggleSpdt" ||
          c.type === "toggle2m"
        ) {
          const _nutShape =
            c.nutShape ?? (c.type === "toggle2m" ? "hex" : "circle");
          const _R = c.frontDiameter / 2;
          const _holeR = c.holeDiameter / 2 + 0.5;
          const _leverW = Math.max(c.holeDiameter * 0.75, 2.5);
          const _leverH = _R * 1.7;
          const _lever = React.createElement("rect", {
            key: "lever",
            x: cx - _leverW / 2,
            y: cy - _R * 1.3,
            width: _leverW,
            height: _leverH,
            rx: _leverW / 2,
            fill: "#1e1e1c",
            stroke: "#3c3c3a",
            strokeWidth: 0.18,
          });
          const _hexPts = (r, startDeg) =>
            [0, 60, 120, 180, 240, 300]
              .map((d) => {
                const rad = ((d + startDeg) * Math.PI) / 180;
                return `${cx + r * Math.cos(rad)},${cy + r * Math.sin(rad)}`;
              })
              .join(" ");
          const _nutEls =
            _nutShape === "hex"
              ? [
                  React.createElement("polygon", {
                    key: "hex-outer",
                    points: _hexPts(_R + 0.45, 0),
                    fill: "#dddbd6",
                    stroke: "#6a6860",
                    strokeWidth: 0.22,
                  }),
                  React.createElement("polygon", {
                    key: "hex-inner",
                    points: _hexPts(_R - 0.45, 30),
                    fill: "#eceae4",
                    stroke: "none",
                  }),
                  React.createElement("circle", {
                    key: "bushing",
                    cx: cx,
                    cy: cy,
                    r: _holeR,
                    fill: "#b4b8bc",
                    stroke: "#888a88",
                    strokeWidth: 0.15,
                  }),
                ]
              : [
                  React.createElement("circle", {
                    key: "nut-outer",
                    cx: cx,
                    cy: cy,
                    r: _R + 0.45,
                    fill: "#e8eae4",
                    stroke: "#484846",
                    strokeWidth: 0.2,
                  }),
                  React.createElement("circle", {
                    key: "nut-ring",
                    cx: cx,
                    cy: cy,
                    r: _R - 0.5,
                    fill: "#c8cac4",
                    stroke: "#d8dad4",
                    strokeWidth: 0.14,
                  }),
                  React.createElement("circle", {
                    key: "bushing",
                    cx: cx,
                    cy: cy,
                    r: _holeR,
                    fill: "#a8acae",
                    stroke: "#8a8e8e",
                    strokeWidth: 0.12,
                  }),
                ];
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            ..._nutEls,
            _lever,
          );
        }
        if (getFrontShape(c) !== "circle") {
          const b = getFrontBounds(c);
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            React.createElement("rect", {
              x: cx - b.w / 2,
              y: cy - b.h / 2,
              width: b.w,
              height: b.h,
              rx: 0.8,
              fill: color,
              opacity: 0.28,
              stroke: color,
              strokeWidth: 0.25,
            }),
          );
        }
        if (isJoystick(c)) {
          const R = (c.frontDiameter ?? 40.4) / 2;
          const Rid = 14.0;
          const Rcap = 3.5;
          const screwOff = 12.75;
          const screwCorners = [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
          ];
          const bootRidges = [
            Rid,
            Rid * 0.857,
            Rid * 0.679,
            Rid * 0.536,
            Rid * 0.393,
            Rid * 0.286,
          ];
          const sl = 0.85;
          return React.createElement(
            "g",
            {
              key: c.id,
              "data-top-hardware-id": c.id,
              transform: rot,
              opacity: hwOpacity,
            },
            React.createElement("circle", {
              cx,
              cy,
              r: R,
              fill: "#1a1c1e",
              stroke: "none",
            }),
            React.createElement("circle", {
              cx,
              cy,
              r: R,
              fill: "none",
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 0.5,
            }),
            React.createElement("circle", {
              cx,
              cy,
              r: R - 0.3,
              fill: "none",
              stroke: "rgba(0,0,0,0.65)",
              strokeWidth: 0.5,
            }),
            React.createElement("circle", {
              cx,
              cy,
              r: Rid + 0.6,
              fill: "none",
              stroke: "rgba(0,0,0,0.75)",
              strokeWidth: 1.2,
            }),
            React.createElement("ellipse", {
              cx: cx - R * 0.2,
              cy: cy - R * 0.2,
              rx: R * 0.52,
              ry: R * 0.22,
              fill: "rgba(255,255,255,0.055)",
              stroke: "none",
              transform: `rotate(-45,${cx},${cy})`,
            }),
            React.createElement("circle", {
              cx,
              cy,
              r: Rid,
              fill: "#090b0c",
              stroke: "none",
            }),
            ...bootRidges.flatMap((r, i) => [
              React.createElement("circle", {
                key: `bsh${i}`,
                cx: cx + 0.22,
                cy: cy + 0.22,
                r,
                fill: "none",
                stroke: "rgba(0,0,0,0.42)",
                strokeWidth: 0.45,
              }),
              React.createElement("circle", {
                key: `brd${i}`,
                cx,
                cy,
                r,
                fill: "none",
                stroke: "#050607",
                strokeWidth: i < 2 ? 1.1 : 0.8,
              }),
              React.createElement("circle", {
                key: `brh${i}`,
                cx,
                cy,
                r,
                fill: "none",
                stroke: "rgba(255,255,255,0.05)",
                strokeWidth: 0.22,
              }),
            ]),
            React.createElement("circle", {
              cx,
              cy,
              r: Rcap + 0.5,
              fill: "#060708",
              stroke: "rgba(0,0,0,0.55)",
              strokeWidth: 0.4,
            }),
            React.createElement("circle", {
              cx,
              cy,
              r: Rcap,
              fill: "#111415",
              stroke: "#282a2c",
              strokeWidth: 0.2,
            }),
            React.createElement("circle", {
              cx,
              cy,
              r: Rcap * 0.65,
              fill: "none",
              stroke: "rgba(0,0,0,0.32)",
              strokeWidth: 0.45,
            }),
            React.createElement("ellipse", {
              cx: cx - Rcap * 0.32,
              cy: cy - Rcap * 0.38,
              rx: Rcap * 0.38,
              ry: Rcap * 0.26,
              fill: "rgba(255,255,255,0.13)",
              stroke: "none",
            }),
            React.createElement("circle", {
              cx,
              cy,
              r: 0.65,
              fill: "#222426",
              stroke: "rgba(255,255,255,0.28)",
              strokeWidth: 0.1,
            }),
            React.createElement("circle", { cx, cy, r: 0.22, fill: "#0d0e0f" }),
            ...screwCorners.flatMap(([ox, oy], i) => {
              const sx = cx + ox * screwOff;
              const sy = cy + oy * screwOff;
              return [
                React.createElement("circle", {
                  key: `ssd${i}`,
                  cx: sx + 0.14,
                  cy: sy + 0.14,
                  r: 1.6,
                  fill: "rgba(0,0,0,0.38)",
                  stroke: "none",
                }),
                React.createElement("circle", {
                  key: `ssh${i}`,
                  cx: sx,
                  cy: sy,
                  r: 1.55,
                  fill: "#252729",
                  stroke: "#4a4c4f",
                  strokeWidth: 0.14,
                }),
                React.createElement("circle", {
                  key: `ssi${i}`,
                  cx: sx,
                  cy: sy,
                  r: 1.1,
                  fill: "#1e2022",
                  stroke: "rgba(0,0,0,0.28)",
                  strokeWidth: 0.1,
                }),
                React.createElement("line", {
                  key: `sc1${i}`,
                  x1: sx - sl,
                  y1: sy,
                  x2: sx + sl,
                  y2: sy,
                  stroke: "#0a0b0c",
                  strokeWidth: 0.28,
                  strokeLinecap: "round",
                }),
                React.createElement("line", {
                  key: `sc2${i}`,
                  x1: sx,
                  y1: sy - sl,
                  x2: sx,
                  y2: sy + sl,
                  stroke: "#0a0b0c",
                  strokeWidth: 0.28,
                  strokeLinecap: "round",
                }),
                React.createElement("circle", {
                  key: `shl${i}`,
                  cx: sx - 0.42,
                  cy: sy - 0.42,
                  r: 0.52,
                  fill: "rgba(255,255,255,0.15)",
                  stroke: "none",
                }),
              ];
            }),
          );
        }
        return null;
      }),
  );
});

// TextLayer
const TextLayer = React.memo(function TextLayer({
  items,
  layer,
  selectedTexts,
  textDragPreview,
  textsDragPreview,
  viewMode,
  editingTextId,
}) {
  if (viewMode === "rear") return null;
  return React.createElement(
    "g",
    null,
    items
      .filter((t) => t.layer === layer && t.visible)
      .map((t) => {
        const p =
          textsDragPreview?.[t.id] ??
          (textDragPreview?.id === t.id ? textDragPreview : null);
        const x = p?.x ?? t.x,
          y = p?.y ?? t.y;
        const fontSizeMm = Number.isFinite(t.fontSizeMm)
          ? Math.min(Math.max(t.fontSizeMm, 0.4), 18)
          : 3;
        const w = Math.max(6, t.text.length * fontSizeMm * 0.6);
        return React.createElement(
          "g",
          {
            key: t.id,
            "data-text-id": t.id,
            transform: `rotate(${t.rotation}, ${x}, ${y})`,
            style: {
              cursor: t.locked ? "default" : "move",
              opacity: editingTextId === t.id ? 0 : 1,
            },
          },
          React.createElement(
            "text",
            {
              x: x,
              y: y,
              fontSize: fontSizeMm,
              fontFamily: t.fontFamily || TEXT_FONT_OPTIONS[0].value,
              textAnchor:
                t.align === "left"
                  ? "start"
                  : t.align === "right"
                    ? "end"
                    : "middle",
              fill: "#ddd",
              opacity: t.opacity,
            },
            t.text,
          ),
          selectedTexts?.includes(t.id) &&
            React.createElement("rect", {
              x: x - w / 2,
              y: y - fontSizeMm,
              width: w,
              height: fontSizeMm * 1.25,
              fill: "none",
              stroke: "#c99a4a",
              strokeWidth: 0.42,
              strokeDasharray: "1.35 0.55",
              vectorEffect: "non-scaling-stroke",
              filter: "url(#selection-glow)",
            }),
        );
      }),
  );
});

// ComponentsLayer
const ComponentsLayer = React.memo(function ComponentsLayer({
  components,
  selectedIdSet,
  issueFocusIdSet,
  dragPreview,
  rotationPreview,
  viewMode,
  warnings,
  layers,
  panelWidthMM,
  dragPerfMode = false,
}) {
  const warnIds = useMemo(
    () => new Set(warnings.flatMap((w) => w.ids)),
    [warnings],
  );
  const errorIds = useMemo(
    () =>
      new Set(
        warnings.filter((w) => w.severity === "error").flatMap((w) => w.ids),
      ),
    [warnings],
  );
  return React.createElement(
    "g",
    null,
    components.map((component) => {
      const previewRotation = rotationPreview?.get(component.id);
      const c =
        typeof previewRotation === "number"
          ? { ...component, rotation: previewRotation }
          : component;
      const preview = dragPreview?.get(c.id);
      const cx = preview?.x ?? c.x;
      const cy = preview?.y ?? c.y;
      const isDraggedPreview = !!preview;
      const useCheapDragShape = dragPerfMode && isDraggedPreview;
      const isSel = selectedIdSet.has(c.id);
      const isErr = errorIds.has(c.id);
      const isWarn = warnIds.has(c.id) && !isErr;
      const isIssueFocused = issueFocusIdSet?.has(c.id);
      const statusClass = isSel
        ? " is-selected"
        : isErr
          ? " has-error"
          : isWarn
            ? " has-warning"
            : "";
      return React.createElement(
        "g",
        {
          key: c.id,
          "data-id": c.id,
          className: `component-node${statusClass}${isIssueFocused ? " issue-focus" : ""}`,
          style: { cursor: "move", opacity: preview ? 0.4 : 1 },
        },
        (() => {
          const e = getFrontExtents({ ...c, x: cx, y: cy });
          const minSize = 6;
          const w = Math.max(minSize, e.x2 - e.x1);
          const h = Math.max(minSize, e.y2 - e.y1);
          return React.createElement("rect", {
            className: "component-touch-hitbox",
            x: cx - w / 2,
            y: cy - h / 2,
            width: w,
            height: h,
            fill: "transparent",
            stroke: "none",
            pointerEvents: "all",
          });
        })(),
        useCheapDragShape &&
          React.createElement(
            "g",
            {
              transform: `rotate(${c.rotation}, ${cx}, ${cy})`,
              style: { pointerEvents: "none" },
            },
            getFrontShape(c) !== "circle"
              ? React.createElement("rect", {
                  x: cx - getFrontBounds(c).w / 2,
                  y: cy - getFrontBounds(c).h / 2,
                  width: getFrontBounds(c).w,
                  height: getFrontBounds(c).h,
                  rx: 1.2,
                  fill: "rgba(201,154,74,0.08)",
                  stroke: "#c99a4a",
                  strokeWidth: 0.34,
                  strokeDasharray: "1.2 0.7",
                  vectorEffect: "non-scaling-stroke",
                })
              : React.createElement("circle", {
                  cx: cx,
                  cy: cy,
                  r: Math.max(c.frontDiameter / 2, c.holeDiameter / 2),
                  fill: "rgba(201,154,74,0.08)",
                  stroke: "#c99a4a",
                  strokeWidth: 0.34,
                  strokeDasharray: "1.2 0.7",
                  vectorEffect: "non-scaling-stroke",
                }),
          ),
        !useCheapDragShape &&
          layers.rearKeepouts &&
          (viewMode === "rear" || viewMode === "combined") &&
          c.keepoutW > 0 &&
          React.createElement(
            "g",
            { transform: `rotate(${c.rotation}, ${cx}, ${cy})` },
            React.createElement("rect", {
              x: cx + getRearKeepoutBounds(c).x,
              y: cy + getRearKeepoutBounds(c).y,
              width: c.keepoutW,
              height: c.keepoutH,
              fill: isErr ? "rgba(255,50,50,0.25)" : "rgba(255,160,0,0.2)",
              stroke: isErr ? "#ff3333" : "#ffa000",
              strokeWidth: 0.25,
              strokeDasharray: "1 0.5",
            }),
          ),
        !useCheapDragShape &&
          layers.rearBodies &&
          (viewMode === "rear" || viewMode === "combined") &&
          c.rearBodyW > 0 &&
          React.createElement(
            "g",
            { transform: `rotate(${c.rotation}, ${cx}, ${cy})` },
            getRearBodyRects(c).map((r) =>
              React.createElement(
                "rect",
                {
                  key: r.name,
                  "data-rear-part": r.name,
                  x: cx + r.x,
                  y: cy + r.y,
                  width: r.width,
                  height: r.height,
                  fill: isErr ? "rgba(255,50,50,0.5)" : "rgba(255,100,0,0.5)",
                  stroke: isErr ? "#ff3333" : "#ff6400",
                  strokeWidth: r.name === "Housing" ? 0.3 : 0.15,
                },
                React.createElement("title", null, r.name),
              ),
            ),
          ),
        !useCheapDragShape &&
          layers.frontShapes &&
          (viewMode === "front" || viewMode === "combined") &&
          c.type !== "cutout" &&
          (isJoystick(c)
            ? React.createElement(
                "g",
                null,
                React.createElement("circle", {
                  cx,
                  cy,
                  r: c.holeDiameter / 2,
                  fill: "rgba(200,200,200,0.06)",
                  stroke: isErr ? "#ff3333" : isWarn ? "#ffa000" : "#444",
                  strokeWidth: 0.25,
                  strokeDasharray: "1.2 0.7",
                }),
              )
            : isDip8Socket(c)
              ? React.createElement(
                  "g",
                  { transform: `rotate(${c.rotation}, ${cx}, ${cy})` },
                  React.createElement("rect", {
                    x: cx - getFrontBounds(c).w / 2,
                    y: cy - getFrontBounds(c).h / 2,
                    width: getFrontBounds(c).w,
                    height: getFrontBounds(c).h,
                    fill: "rgba(200,200,200,0.035)",
                    stroke: isErr ? "#ff3333" : isWarn ? "#ffa000" : "#555",
                    strokeWidth: 0.18,
                    strokeDasharray: "0.8 0.55",
                  }),
                  React.createElement("path", {
                    d: `M ${cx - 1.3} ${cy - getFrontBounds(c).h / 2} A 1.3 1.3 0 0 0 ${cx + 1.3} ${cy - getFrontBounds(c).h / 2}`,
                    fill: "none",
                    stroke: "rgba(220,230,235,.55)",
                    strokeWidth: "0.18",
                  }),
                )
              : getFrontShape(c) !== "circle"
                ? isFaderLike(c)
                  ? null
                  : React.createElement(
                      "g",
                      { transform: `rotate(${c.rotation}, ${cx}, ${cy})` },
                      React.createElement("rect", {
                        x: cx - getFrontBounds(c).w / 2,
                        y: cy - getFrontBounds(c).h / 2,
                        width: getFrontBounds(c).w,
                        height: getFrontBounds(c).h,
                        fill: isErr
                          ? "rgba(255,50,50,0.12)"
                          : "rgba(200,200,200,0.07)",
                        stroke: isErr ? "#ff3333" : isWarn ? "#ffa000" : "#444",
                        strokeWidth: 0.25,
                      }),
                    )
                : c.holeType !== "slot" &&
                  React.createElement("circle", {
                    cx: cx,
                    cy: cy,
                    r: c.frontDiameter / 2,
                    fill: isErr
                      ? "rgba(255,50,50,0.12)"
                      : "rgba(200,200,200,0.07)",
                    stroke: isErr ? "#ff3333" : isWarn ? "#ffa000" : "#444",
                    strokeWidth: 0.25,
                  })),
        !useCheapDragShape &&
          layers.frontShapes &&
          (viewMode === "front" || viewMode === "combined") &&
          c.knobEnabled &&
          c.knobDiameter &&
          React.createElement("circle", {
            cx: cx,
            cy: cy,
            r: c.knobDiameter / 2,
            fill: "none",
            stroke: isErr ? "#ff3333" : "#607060",
            strokeWidth: 0.3,
            strokeDasharray: "1.5 1",
          }),
        !useCheapDragShape &&
          layers.componentHoles &&
          (viewMode === "front" ||
            viewMode === "combined" ||
            viewMode === "drill") &&
          (isDip8Socket(c)
            ? React.createElement(
                "g",
                null,
                dip8SocketHoleCenters(c, cx, cy).map((p, i) =>
                  React.createElement("circle", {
                    key: `dip8-${i}`,
                    cx: p.x,
                    cy: p.y,
                    r: c.holeDiameter / 2,
                    fill: "#090909",
                    stroke: isSel ? "#c99a4a" : "#888",
                    strokeWidth: isSel ? 0.32 : 0.24,
                  }),
                ),
              )
            : isJoystick(c)
              ? React.createElement(
                  "g",
                  null,
                  React.createElement("circle", {
                    cx,
                    cy,
                    r: c.holeDiameter / 2,
                    fill: "#090909",
                    stroke: isSel ? "#c99a4a" : "#888",
                    strokeWidth: isSel ? 0.4 : 0.3,
                  }),
                  ...joystickMountHoles(c, cx, cy).map((p, i) =>
                    React.createElement("circle", {
                      key: `jm-${i}`,
                      cx: p.x,
                      cy: p.y,
                      r: p.r,
                      fill: "#090909",
                      stroke: isSel ? "#c99a4a" : "#888",
                      strokeWidth: isSel ? 0.32 : 0.24,
                    }),
                  ),
                )
              : c.holeType === "slot"
                ? React.createElement(
                    "g",
                    { transform: `rotate(${c.rotation}, ${cx}, ${cy})` },
                    React.createElement("rect", {
                      x: cx - c.holeDiameter / 2,
                      y: cy - (c.slotLength ?? c.holeDiameter) / 2,
                      width: c.holeDiameter,
                      height: c.slotLength ?? c.holeDiameter,
                      rx: c.holeDiameter / 2,
                      fill: "#090909",
                      stroke: isSel ? "#c99a4a" : "#888",
                      strokeWidth: isSel ? 0.4 : 0.3,
                    }),
                  )
                : c.holeType === "rect"
                  ? React.createElement(
                      "g",
                      { transform: `rotate(${c.rotation}, ${cx}, ${cy})` },
                      React.createElement("rect", {
                        x: cx - (c.holeW ?? c.frontW ?? c.holeDiameter) / 2,
                        y: cy - (c.holeH ?? c.frontH ?? c.holeDiameter) / 2,
                        width: c.holeW ?? c.frontW ?? c.holeDiameter,
                        height: c.holeH ?? c.frontH ?? c.holeDiameter,
                        fill: "#090909",
                        stroke: isSel ? "#c99a4a" : "#888",
                        strokeWidth: isSel ? 0.4 : 0.3,
                      }),
                    )
                  : React.createElement("circle", {
                      cx: cx,
                      cy: cy,
                      r: c.holeDiameter / 2,
                      fill: "#090909",
                      stroke: isSel ? "#c99a4a" : "#888",
                      strokeWidth: isSel ? 0.4 : 0.3,
                    })),
        !useCheapDragShape &&
          viewMode === "drill" &&
          React.createElement(
            "text",
            {
              x: cx,
              y:
                cy -
                (c.holeType === "slot"
                  ? (c.slotLength ?? c.holeDiameter) / 2
                  : c.holeType === "rect"
                    ? (c.holeH ?? c.frontH ?? c.holeDiameter) / 2
                    : c.holeDiameter / 2) -
                1,
              textAnchor: "middle",
              fontSize: 1.8,
              fill: "#aaa",
            },
            cx.toFixed(1),
            ",",
            cy.toFixed(1),
          ),
        !useCheapDragShape &&
          c.type === "cutout" &&
          (viewMode === "front" || viewMode === "combined") &&
          React.createElement(
            "g",
            {
              className: `cutout-snap-center ${c.snapTargetEnabled === false ? "disabled" : "enabled"}`,
              "data-cutout-snap-center": c.id,
              style: { pointerEvents: "none" },
            },
            React.createElement("line", {
              x1: cx - 0.8,
              y1: cy,
              x2: cx + 0.8,
              y2: cy,
            }),
            React.createElement("line", {
              x1: cx,
              y1: cy - 0.8,
              x2: cx,
              y2: cy + 0.8,
            }),
            c.snapTargetEnabled === false &&
              React.createElement("line", {
                x1: cx - 0.7,
                y1: cy + 0.7,
                x2: cx + 0.7,
                y2: cy - 0.7,
              }),
          ),
        !useCheapDragShape &&
          layers.labels &&
          (viewMode === "front" || viewMode === "combined") &&
          c.label &&
          (() => {
            const label = getComponentLabelLayout(
              { ...c, x: cx, y: cy },
              panelWidthMM,
            );
            return React.createElement(
              "text",
              {
                "data-label-component-id": c.id,
                x: label.x,
                y: label.y,
                textAnchor: label.anchor,
                dominantBaseline:
                  label.baseline === "middle" ? "middle" : undefined,
                fontSize: label.fontSize,
                fill: isErr ? "#ff9a9a" : "#d6d9dc",
                stroke: "rgba(0,0,0,0.55)",
                strokeWidth: 0.35,
                paintOrder: "stroke fill",
                style: { cursor: "text" },
              },
              c.label,
            );
          })(),
        !useCheapDragShape &&
          layers.labels &&
          viewMode === "rear" &&
          c.type !== "cutout" &&
          React.createElement(
            "text",
            {
              x: cx,
              y: cy + 0.8,
              textAnchor: "middle",
              fontSize: 2,
              fill: "#888",
            },
            c.label || c.name,
          ),
        isSel &&
          (getFrontShape(c) !== "circle"
            ? React.createElement(
                "g",
                { transform: `rotate(${c.rotation}, ${cx}, ${cy})` },
                React.createElement("rect", {
                  x: cx - getFrontBounds(c).w / 2 - 1,
                  y: cy - getFrontBounds(c).h / 2 - 1,
                  width: getFrontBounds(c).w + 2,
                  height: getFrontBounds(c).h + 2,
                  fill: "none",
                  stroke: "#c99a4a",
                  strokeWidth: 0.42,
                  strokeDasharray: "1.35 0.55",
                  vectorEffect: "non-scaling-stroke",
                  filter: "url(#selection-glow)",
                }),
              )
            : c.holeType === "slot"
              ? React.createElement(
                  "g",
                  { transform: `rotate(${c.rotation}, ${cx}, ${cy})` },
                  React.createElement("rect", {
                    x: cx - c.holeDiameter / 2 - 1,
                    y: cy - (c.slotLength ?? c.holeDiameter) / 2 - 1,
                    width: c.holeDiameter + 2,
                    height: (c.slotLength ?? c.holeDiameter) + 2,
                    fill: "none",
                    stroke: "#c99a4a",
                    strokeWidth: 0.42,
                    strokeDasharray: "1.35 0.55",
                    vectorEffect: "non-scaling-stroke",
                    filter: "url(#selection-glow)",
                  }),
                )
              : React.createElement("rect", {
                  x: cx - c.frontDiameter / 2 - 1,
                  y: cy - c.frontDiameter / 2 - 1,
                  width: c.frontDiameter + 2,
                  height: c.frontDiameter + 2,
                  fill: "none",
                  stroke: "#c99a4a",
                  strokeWidth: 0.42,
                  strokeDasharray: "1.35 0.55",
                  vectorEffect: "non-scaling-stroke",
                  filter: "url(#selection-glow)",
                })),
        isSel &&
          React.createElement(
            "g",
            { style: { pointerEvents: "none" } },
            React.createElement("rect", {
              x: cx + 2.6,
              y: cy - getFrontBottomOffset(c) - 5.6,
              width: Math.max(4.8, (c.ref || "").length * 1.25 + 2.2),
              height: 2.6,
              rx: 1.25,
              fill: "rgba(4,12,16,0.86)",
              stroke: "rgba(201,154,74,0.48)",
              strokeWidth: 0.15,
            }),
            React.createElement(
              "text",
              {
                x: cx + 3.7,
                y: cy - getFrontBottomOffset(c) - 3.75,
                fontSize: 1.18,
                fill: "#f3dfb2",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              },
              c.ref || "SEL",
            ),
          ),
        isSel &&
          React.createElement(SelectionHandles, { c: c, cx: cx, cy: cy }),
      );
    }),
  );
});

// RearBodySnapFootprintLayer
const RearBodySnapFootprintLayer = React.memo(
  function RearBodySnapFootprintLayer({
    components,
    selectedIdSet,
    dragPreview,
    viewMode,
  }) {
    if (viewMode === "rear" || selectedIdSet.size === 0) return null;
    const isDragging = !!dragPreview && dragPreview.size > 0;
    return React.createElement(
      "g",
      { style: { pointerEvents: "none" } },
      components
        .filter((c) => selectedIdSet.has(c.id))
        .map((c) => {
          const p = dragPreview?.get(c.id);
          const cx = p?.x ?? c.x;
          const cy = p?.y ?? c.y;
          const obb = makeRearBodyFootprintOBBAt(c, cx, cy);
          const ext = obbEdgeExtents(obb);
          const usesBody = c.rearBodyW > 0 && c.rearBodyH > 0;
          const usesKeepout =
            !usesBody &&
            c.keepoutW > 0 &&
            c.keepoutH > 0 &&
            c.type !== "customrect";
          const label = usesBody
            ? "rear body snap footprint"
            : usesKeepout
              ? "keepout snap footprint"
              : "cutout snap footprint";
          return React.createElement(
            "g",
            { key: `rear-snap-${c.id}` },
            React.createElement(
              "g",
              { transform: `rotate(${obb.angle}, ${obb.cx}, ${obb.cy})` },
              React.createElement("rect", {
                x: obb.cx - obb.hw,
                y: obb.cy - obb.hh,
                width: obb.hw * 2,
                height: obb.hh * 2,
                fill: "rgba(190,190,190,0.035)",
                stroke: isDragging ? "#d0d0d0" : "#9a9a9a",
                strokeWidth: isDragging ? 0.22 : 0.16,
                strokeDasharray: "1.1 0.7",
              }),
            ),
            isDragging &&
              React.createElement(
                "text",
                {
                  x: Math.max(0.8, Math.min(obb.cx - 0.5, obb.cx)),
                  y: Math.max(2, ext.y1 - 1.2),
                  fontSize: 1.05,
                  fill: "#c8c8c8",
                  opacity: 0.85,
                },
                label,
              ),
          );
        }),
    );
  },
);

// DistanceGuidesLayer
const DistanceGuidesLayer = React.memo(function DistanceGuidesLayer({
  guides,
}) {
  if (!guides.length) return null;
  return React.createElement(
    "g",
    { style: { pointerEvents: "none" } },
    guides.map((g) => {
      const midX = (g.x1 + g.x2) / 2;
      const midY = (g.y1 + g.y2) / 2;
      const isNearest = g.kind === "nearest";
      const stroke = isNearest ? "#d8d8d8" : "#9a9a9a";
      const opacity = isNearest ? 0.92 : 0.58;
      const dash = isNearest ? "1.2 0.65" : "0.65 0.75";
      const labelX = g.axis === "h" ? midX : midX + 1.0;
      const labelY = g.axis === "h" ? midY - 0.75 : midY;
      const labelW = Math.max(8.4, g.label.length * 0.84);
      return React.createElement(
        "g",
        { key: g.id, opacity: opacity },
        React.createElement("line", {
          x1: g.x1,
          y1: g.y1,
          x2: g.x2,
          y2: g.y2,
          stroke: stroke,
          strokeWidth: isNearest ? 0.18 : 0.13,
          strokeDasharray: dash,
        }),
        g.axis === "h"
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement("line", {
                x1: g.x1,
                y1: g.y1 - 0.9,
                x2: g.x1,
                y2: g.y1 + 0.9,
                stroke: stroke,
                strokeWidth: 0.14,
              }),
              React.createElement("line", {
                x1: g.x2,
                y1: g.y2 - 0.9,
                x2: g.x2,
                y2: g.y2 + 0.9,
                stroke: stroke,
                strokeWidth: 0.14,
              }),
            )
          : React.createElement(
              React.Fragment,
              null,
              React.createElement("line", {
                x1: g.x1 - 0.9,
                y1: g.y1,
                x2: g.x1 + 0.9,
                y2: g.y1,
                stroke: stroke,
                strokeWidth: 0.14,
              }),
              React.createElement("line", {
                x1: g.x2 - 0.9,
                y1: g.y2,
                x2: g.x2 + 0.9,
                y2: g.y2,
                stroke: stroke,
                strokeWidth: 0.14,
              }),
            ),
        React.createElement("rect", {
          x: labelX - labelW / 2,
          y: labelY - 1.25,
          width: labelW,
          height: 2.2,
          rx: 0.55,
          fill: "rgba(20,20,20,0.68)",
          stroke: "rgba(210,210,210,0.28)",
          strokeWidth: 0.08,
        }),
        React.createElement(
          "text",
          {
            x: labelX,
            y: labelY + 0.45,
            textAnchor: "middle",
            fontSize: 1.45,
            fill: stroke,
            style: { fontVariantNumeric: "tabular-nums" },
          },
          g.label,
        ),
      );
    }),
  );
});

// RulerLayer
const RulerLayer = React.memo(function RulerLayer({ ruler }) {
  if (!ruler) return null;
  const x1 = ruler.start.x,
    y1 = ruler.start.y,
    x2 = ruler.end.x,
    y2 = ruler.end.y;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const label = `${dist.toFixed(2)} mm  Δx ${dx.toFixed(2)}  Δy ${dy.toFixed(2)}  ${angle.toFixed(1)}°`;
  const labelOffset = 3.2;
  let nx = dist > 0.0001 ? -dy / dist : 0;
  let ny = dist > 0.0001 ? dx / dist : -1;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const appStateForRuler = useAppState();
  const rulerWidthMM = panelWidthMM(appStateForRuler.panel);
  const rulerPad = 10;
  const fontSize = 2.2;
  const approxLabelW = Math.min(
    label.length * fontSize * 0.52,
    rulerWidthMM + rulerPad * 2 - 2,
  );
  const minLabelX = -rulerPad + approxLabelW / 2 + 0.6;
  const maxLabelX = rulerWidthMM + rulerPad - approxLabelW / 2 - 0.6;
  const minLabelY = -rulerPad + fontSize + 0.6;
  const maxLabelY = PANEL_HEIGHT_MM + rulerPad - 0.8;
  const rawLabelX = midX + nx * labelOffset;
  const rawLabelY = midY + ny * labelOffset;
  const labelX = Math.max(minLabelX, Math.min(maxLabelX, rawLabelX));
  const labelY = Math.max(minLabelY, Math.min(maxLabelY, rawLabelY));
  return React.createElement(
    "g",
    { pointerEvents: "none", opacity: 0.92 },
    React.createElement(
      "defs",
      null,
      React.createElement(
        "marker",
        {
          id: "ruler-arrow-start",
          markerWidth: "4",
          markerHeight: "4",
          refX: "0",
          refY: "0",
          orient: "auto",
          markerUnits: "strokeWidth",
        },
        React.createElement("path", {
          d: "M 3 -2 L 0 0 L 3 2",
          fill: "none",
          stroke: "#d8d8d8",
          strokeWidth: "0.55",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      ),
      React.createElement(
        "marker",
        {
          id: "ruler-arrow-end",
          markerWidth: "4",
          markerHeight: "4",
          refX: "3",
          refY: "0",
          orient: "auto",
          markerUnits: "strokeWidth",
        },
        React.createElement("path", {
          d: "M 0 -2 L 3 0 L 0 2",
          fill: "none",
          stroke: "#d8d8d8",
          strokeWidth: "0.55",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      ),
    ),
    React.createElement("line", {
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      stroke: "#d0d0d0",
      strokeWidth: 0.45,
      strokeLinecap: "round",
      markerStart: dist > 0.05 ? "url(#ruler-arrow-start)" : undefined,
      markerEnd: dist > 0.05 ? "url(#ruler-arrow-end)" : undefined,
    }),
    React.createElement("line", {
      x1: x1,
      y1: y1,
      x2: x1,
      y2: y2,
      stroke: "rgba(190,190,190,0.36)",
      strokeWidth: 0.16,
      strokeDasharray: "1 0.8",
    }),
    React.createElement("line", {
      x1: x1,
      y1: y2,
      x2: x2,
      y2: y2,
      stroke: "rgba(190,190,190,0.36)",
      strokeWidth: 0.16,
      strokeDasharray: "1 0.8",
    }),
    React.createElement(
      "text",
      {
        x: labelX,
        y: labelY,
        textAnchor: "middle",
        fontSize: fontSize,
        fill: "#eeeeee",
        stroke: "rgba(0,0,0,0.65)",
        strokeWidth: 0.55,
        paintOrder: "stroke fill",
      },
      label,
    ),
  );
});

// CanvasLayerPanel
function CanvasLayerPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const labels = [
    ["grid", "Grid"],
    ["componentHoles", "Holes"],
    ["frontShapes", "Front"],
    ["topHardware", "Hardware"],
    ["rearBodies", "Bodies"],
    ["rearKeepouts", "Keepouts"],
    ["pcb", "PCB"],
    ["text", "Text"],
    ["artwork", "Art"],
    ["labels", "Labels"],
  ];
  return React.createElement(
    "div",
    {
      className: `canvas-layer-panel ${open ? "open" : ""}`,
      onMouseDown: (e) => e.stopPropagation(),
      onTouchStart: (e) => e.stopPropagation(),
    },
    React.createElement(
      "button",
      { className: "layer-panel-trigger", onClick: () => setOpen((v) => !v) },
      "\u2637 Layers",
    ),
    React.createElement(
      "div",
      { className: "hardware-style-mini" },
      React.createElement("span", null, "Top HW"),
      React.createElement(
        "button",
        {
          className: state.topHardwareStyle === "classic" ? "active" : "",
          onClick: () =>
            dispatch({ type: "SET_TOP_HARDWARE_STYLE", style: "classic" }),
        },
        "Classic",
      ),
      React.createElement(
        "button",
        {
          className: state.topHardwareStyle === "realistic" ? "active" : "",
          onClick: () =>
            dispatch({ type: "SET_TOP_HARDWARE_STYLE", style: "realistic" }),
        },
        "Realistic",
      ),
    ),
    open &&
      React.createElement(
        "div",
        { className: "layer-panel-body" },
        React.createElement(
          "div",
          { className: "layer-preset-row" },
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({ type: "APPLY_LAYER_PRESET", preset: "visual" }),
            },
            "Visual",
          ),
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({ type: "APPLY_LAYER_PRESET", preset: "mechanical" }),
            },
            "Mech",
          ),
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({ type: "APPLY_LAYER_PRESET", preset: "production" }),
            },
            "Prod",
          ),
          React.createElement(
            "button",
            {
              onClick: () =>
                dispatch({ type: "APPLY_LAYER_PRESET", preset: "debug" }),
            },
            "All",
          ),
        ),
        React.createElement(
          "div",
          { className: "layer-toggle-grid" },
          labels.map(([k, label]) =>
            React.createElement(
              "label",
              { key: k, className: state.layerVisibility[k] ? "on" : "" },
              React.createElement("input", {
                type: "checkbox",
                checked: state.layerVisibility[k],
                onChange: (e) =>
                  dispatch({
                    type: "SET_LAYER_VISIBILITY",
                    key: k,
                    value: e.target.checked,
                  }),
              }),
              React.createElement("span", null, label),
            ),
          ),
        ),
      ),
  );
}

// CanvasMiniMap
function CanvasMiniMap({ warnings, zoom }) {
  const state = useAppState();
  const widthMM = panelWidthMM(state.panel);
  const selected = new Set(state.selected);
  const errorIds = new Set(
    warnings.filter((w) => w.severity === "error").flatMap((w) => w.ids),
  );
  const warnIds = new Set(warnings.flatMap((w) => w.ids));
  return React.createElement(
    "div",
    {
      className: "canvas-minimap",
      title: "Panel overview",
      onMouseDown: (e) => e.stopPropagation(),
      onTouchStart: (e) => e.stopPropagation(),
    },
    React.createElement(
      "svg",
      {
        viewBox: `0 0 ${widthMM} ${PANEL_HEIGHT_MM}`,
        preserveAspectRatio: "xMidYMid meet",
      },
      React.createElement("rect", {
        x: "0",
        y: "0",
        width: widthMM,
        height: PANEL_HEIGHT_MM,
        rx: "1",
        fill: "rgba(220,230,235,0.08)",
        stroke: "rgba(220,240,245,0.36)",
        strokeWidth: "0.6",
      }),
      state.components.map((c) => {
        const r = Math.max(1.6, Math.min(3.4, c.frontDiameter / 2));
        const cls = errorIds.has(c.id)
          ? "err"
          : warnIds.has(c.id)
            ? "warn"
            : selected.has(c.id)
              ? "sel"
              : "";
        return React.createElement("circle", {
          key: c.id,
          cx: c.x,
          cy: c.y,
          r: r,
          className: cls,
        });
      }),
    ),
    React.createElement("div", null, Math.round(zoom * 100), "%"),
  );
}

// SelectionHandles
function SelectionHandles({ c, cx, cy }) {
  const ext = getFrontExtents({ ...c, x: cx, y: cy });
  const pad = 1.35;
  const x1 = ext.x1 - pad,
    x2 = ext.x2 + pad,
    y1 = ext.y1 - pad,
    y2 = ext.y2 + pad;
  const badge = c.locked ? "LOCK" : c.groupId ? "GROUP" : "";
  return React.createElement(
    "g",
    { className: "selection-handles", style: { pointerEvents: "none" } },
    React.createElement("line", { x1: cx - 1.6, y1: cy, x2: cx + 1.6, y2: cy }),
    React.createElement("line", { x1: cx, y1: cy - 1.6, x2: cx, y2: cy + 1.6 }),
    React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: 0.55,
      className: "center-dot",
    }),
    badge &&
      React.createElement(
        "g",
        { className: "selection-badge" },
        React.createElement("rect", {
          x: x1,
          y: y2 + 1.1,
          width: badge.length * 1.15 + 2.4,
          height: 2.35,
          rx: 1.1,
          fill: "rgba(4,4,4,0.82)",
          stroke: "rgba(214,170,88,0.72)",
          strokeWidth: 0.22,
        }),
        React.createElement(
          "text",
          {
            x: x1 + 1.15,
            y: y2 + 2.28,
            fontSize: 1.05,
            fontWeight: 850,
            fill: "#f2dfb2",
            dominantBaseline: "middle",
            letterSpacing: 0.12,
          },
          badge,
        ),
      ),
    Math.abs((c.rotation || 0) % 360) > 0.01 &&
      React.createElement(
        "text",
        {
          x: x2 + 0.9,
          y: y1 + 1.1,
          className: "rotation-label",
          fontSize: 1.35,
          fontWeight: 800,
          fill: "#f2dfb2",
          stroke: "rgba(0,0,0,0.82)",
          strokeWidth: 0.24,
          paintOrder: "stroke",
          dominantBaseline: "middle",
        },
        Math.round(c.rotation),
        "\u00B0",
      ),
  );
}

// MobileSafeZonesLayer
function MobileSafeZonesLayer({ widthMM, components }) {
  const edge = 2.0;
  const railTop = 7.5;
  const railBottom = PANEL_HEIGHT_MM - 7.5;
  const pcbSafeTop = 9;
  const pcbSafeH = 110;
  return React.createElement(
    "g",
    {
      className: "mobile-safe-zone-layer safe-zones-layer-v291",
      opacity: 1,
      style: { pointerEvents: "none" },
    },
    React.createElement("rect", {
      className: "edge",
      x: edge,
      y: edge,
      width: Math.max(0.1, widthMM - edge * 2),
      height: Math.max(0.1, PANEL_HEIGHT_MM - edge * 2),
      fill: "rgba(255,184,77,0.11)",
      stroke: "rgba(255,202,112,0.98)",
      strokeWidth: 0.36,
      strokeDasharray: "1.2 0.7",
      vectorEffect: "non-scaling-stroke",
    }),
    React.createElement("rect", {
      className: "rail",
      x: 0,
      y: 0,
      width: widthMM,
      height: railTop,
      fill: "rgba(255,84,84,0.18)",
      stroke: "rgba(255,112,112,0.98)",
      strokeWidth: 0.3,
      vectorEffect: "non-scaling-stroke",
    }),
    React.createElement("rect", {
      className: "rail",
      x: 0,
      y: railBottom,
      width: widthMM,
      height: PANEL_HEIGHT_MM - railBottom,
      fill: "rgba(255,84,84,0.18)",
      stroke: "rgba(255,112,112,0.98)",
      strokeWidth: 0.3,
      vectorEffect: "non-scaling-stroke",
    }),
    React.createElement("rect", {
      className: "pcb-limit",
      x: 1.0,
      y: pcbSafeTop,
      width: Math.max(0.1, widthMM - 2.0),
      height: Math.min(pcbSafeH, PANEL_HEIGHT_MM - pcbSafeTop * 2),
      fill: "rgba(201,154,74,0.10)",
      stroke: "rgba(201,154,74,0.98)",
      strokeWidth: 0.34,
      strokeDasharray: "1.3 0.8",
      vectorEffect: "non-scaling-stroke",
    }),
    components.map((c) => {
      const r = Math.max(
        (c.keepoutW || c.frontDiameter || c.holeDiameter) / 2,
        (c.keepoutH || c.frontDiameter || c.holeDiameter) / 2,
        (c.minSpacing || 0) / 2,
      );
      return React.createElement("circle", {
        key: `safe-${c.id}`,
        className: "clearance",
        cx: c.x,
        cy: c.y,
        r: Math.max(1.5, r),
        fill: "rgba(180,145,255,0.10)",
        stroke: "rgba(190,160,255,0.95)",
        strokeWidth: 0.24,
        strokeDasharray: "1.1 0.7",
        vectorEffect: "non-scaling-stroke",
      });
    }),
    React.createElement(
      "g",
      { className: "safe-zone-top-labels" },
      React.createElement(
        "text",
        {
          x: edge + 0.8,
          y: edge + 1.35,
          fontSize: 1.35,
          fill: "rgba(255,218,150,0.98)",
          stroke: "rgba(0,0,0,0.75)",
          strokeWidth: 0.28,
          paintOrder: "stroke",
        },
        "2mm edge",
      ),
      React.createElement(
        "text",
        {
          x: edge + 0.8,
          y: edge + 2.75,
          fontSize: 1.35,
          fill: "rgba(255,155,155,0.98)",
          stroke: "rgba(0,0,0,0.75)",
          strokeWidth: 0.28,
          paintOrder: "stroke",
        },
        "rail / lip",
      ),
      React.createElement(
        "text",
        {
          x: edge + 0.8,
          y: edge + 4.15,
          fontSize: 1.35,
          fill: "rgba(120,245,255,0.98)",
          stroke: "rgba(0,0,0,0.75)",
          strokeWidth: 0.28,
          paintOrder: "stroke",
        },
        "PCB 110mm",
      ),
    ),
  );
}

// SVGCanvas
function SVGCanvas({
  svgRef,
  zoom,
  pan,
  dragPreview,
  rotationPreview,
  artworkDragPreview,
  artworkResizePreview,
  textDragPreview,
  textsDragPreview,
  snapGuides,
  distanceGuides,
  ruler,
  marqueeSelection,
  pendingTemplatePlacement,
  onSVGMouseMove,
  onSVGMouseDown,
  onSVGMouseUp,
  onSVGTouchStart,
  onSVGTouchMove,
  onSVGTouchEnd,
  onSVGContextMenu,
  onWheel,
  onWrapMouseDown,
  coordReadout,
  warnings,
  autosaveSummary,
  recentProjects = [],
  onRestoreAutosave,
  onOpenProjectFile,
  onOpenRecentProjects,
  pendingAddPart = null,
  pendingAddPreview = null,
  pendingAddRepeat = false,
  onTogglePendingAddRepeat,
  onCancelPendingAdd,
  rightPanelOpen = false,
  showSafeZones = false,
  editingTextId,
  onSVGDoubleClick,
  onZoomChange,
  issueFocusIds = [],
  touchMode = "edit",
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const widthMM = panelWidthMM(state.panel);
  useEffect(() => {
    window.__PANEL_DESIGNER_VERSION = APP_VERSION;
  }, []);
  useEffect(() => {
    function syncMobileViewportVars() {
      const vv = window.visualViewport;
      const h =
        vv?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        0;
      const w =
        vv?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth ||
        0;
      if (h > 0)
        document.documentElement.style.setProperty("--app-vvh", `${h}px`);
      if (w > 0)
        document.documentElement.style.setProperty("--app-vvw", `${w}px`);
    }
    syncMobileViewportVars();
    window.visualViewport?.addEventListener("resize", syncMobileViewportVars);
    window.visualViewport?.addEventListener("scroll", syncMobileViewportVars);
    window.addEventListener("resize", syncMobileViewportVars);
    window.addEventListener("orientationchange", syncMobileViewportVars);
    return () => {
      window.visualViewport?.removeEventListener(
        "resize",
        syncMobileViewportVars,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        syncMobileViewportVars,
      );
      window.removeEventListener("resize", syncMobileViewportVars);
      window.removeEventListener("orientationchange", syncMobileViewportVars);
    };
  }, []);
  const heightMM = PANEL_HEIGHT_MM;
  const PAD = 180;
  const selectedIdSet = useMemo(
    () => new Set(state.selected),
    [state.selected],
  );
  const snapTargetId = snapGuides.find((guide) => guide.targetId)?.targetId;
  const snapTarget = snapTargetId
    ? state.components.find((component) => component.id === snapTargetId)
    : null;
  const issueFocusIdSet = useMemo(
    () => new Set(issueFocusIds),
    [issueFocusIds],
  );
  const [hoverTip, setHoverTip] = useState(null);
  const hoverTipRef = useRef(null);
  hoverTipRef.current = hoverTip;
  const lop = (k) => state.layerOpacity?.[k] ?? 1;
  function updateHoverTip(e) {
    const target = e.target;
    const group =
      target && typeof target.closest === "function"
        ? target.closest("[data-id]")
        : null;
    const id = group?.getAttribute("data-id") || "";
    if (!id || dragPreview) {
      if (hoverTipRef.current) setHoverTip(null);
      return;
    }
    const component = state.components.find((c) => c.id === id);
    const svg = e.currentTarget;
    const ctm = group.getScreenCTM();
    if (!component || !ctm) {
      if (hoverTipRef.current) setHoverTip(null);
      return;
    }
    const center = svg.createSVGPoint();
    center.x = 0;
    center.y = 0;
    const screenCenter = center.matrixTransform(ctm);
    const fb = getFrontBounds(component);
    const radiusMM =
      Math.max(component.frontDiameter, fb.w, fb.h, component.holeDiameter, 6) /
      2;
    const edge = svg.createSVGPoint();
    edge.x = radiusMM;
    edge.y = 0;
    const screenEdge = edge.matrixTransform(ctm);
    const radiusPx = Math.max(14, Math.abs(screenEdge.x - screenCenter.x));
    const anchorX = screenCenter.x + radiusPx;
    const anchorY = screenCenter.y;
    const prev = hoverTipRef.current;
    if (
      !prev ||
      prev.id !== id ||
      Math.abs(prev.x - anchorX) > 3 ||
      Math.abs(prev.y - anchorY) > 3
    ) {
      setHoverTip({ id, x: anchorX, y: anchorY });
    }
  }
  function handleSVGMouseMove(e) {
    updateHoverTip(e);
    onSVGMouseMove(e);
  }
  function handleSVGMouseLeave() {
    if (hoverTipRef.current) setHoverTip(null);
  }
  const hoveredComponent = hoverTip
    ? state.components.find((c) => c.id === hoverTip.id)
    : undefined;
  function clientPointToMM(clientX, clientY) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const mm = pt.matrixTransform(ctm.inverse());
    return { x: mm.x, y: mm.y };
  }
  return React.createElement(
    "div",
    {
      className: `canvas-wrap mode-${state.viewMode} ${state.selected.length ? "has-selection" : ""} ${state.components.length > 140 ? "large-layout-mode" : ""}`,
      style: { touchAction: "none" },
      onWheel: onWheel,
      onMouseDown: onWrapMouseDown,
      onTouchStart: onSVGTouchStart,
      onTouchMove: onSVGTouchMove,
      onTouchEnd: onSVGTouchEnd,
      onTouchCancel: onSVGTouchEnd,
    },
    React.createElement(
      "div",
      {
        style: {
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      React.createElement(
        "svg",
        {
          ref: svgRef,
          className: "panel-canvas-svg",
          viewBox: `${-PAD} ${-PAD} ${widthMM + PAD * 2} ${heightMM + PAD * 2}`,
          style: {
            width: `${(widthMM + PAD * 2) * 4}px`,
            height: `${(heightMM + PAD * 2) * 4}px`,
            display: "block",
            flex: "0 0 auto",
            touchAction: "none",
            userSelect: "none",
          },
          onMouseMove: handleSVGMouseMove,
          onMouseLeave: handleSVGMouseLeave,
          onMouseDown: onSVGMouseDown,
          onMouseUp: onSVGMouseUp,
          onDoubleClick: onSVGDoubleClick,
          onContextMenu: onSVGContextMenu,
        },
        React.createElement(
          "defs",
          null,
          React.createElement(
            "linearGradient",
            { id: "panel-surface", x1: "0", y1: "0", x2: "0", y2: "1" },
            React.createElement("stop", { offset: "0%", stopColor: "#303236" }),
            React.createElement("stop", {
              offset: "48%",
              stopColor: "#25282b",
            }),
            React.createElement("stop", {
              offset: "100%",
              stopColor: "#1e2023",
            }),
          ),
          React.createElement(
            "filter",
            {
              id: "panel-drop-shadow",
              x: "-22%",
              y: "-10%",
              width: "144%",
              height: "120%",
            },
            React.createElement("feDropShadow", {
              dx: "0",
              dy: "2.6",
              stdDeviation: "3.3",
              floodColor: "#000000",
              floodOpacity: "0.62",
            }),
          ),
          React.createElement(
            "filter",
            {
              id: "selection-glow",
              x: "-70%",
              y: "-70%",
              width: "240%",
              height: "240%",
            },
            React.createElement("feDropShadow", {
              dx: "0",
              dy: "0",
              stdDeviation: "0.9",
              floodColor: "#c99a4a",
              floodOpacity: "0.75",
            }),
          ),
          React.createElement(
            "linearGradient",
            { id: "panel-edge-shine", x1: "0", y1: "0", x2: "1", y2: "0" },
            React.createElement("stop", {
              offset: "0%",
              stopColor: "#ffffff",
              stopOpacity: "0.22",
            }),
            React.createElement("stop", {
              offset: "48%",
              stopColor: "#ffffff",
              stopOpacity: "0.045",
            }),
            React.createElement("stop", {
              offset: "100%",
              stopColor: "#000000",
              stopOpacity: "0.24",
            }),
          ),
        ),
        React.createElement("rect", {
          x: 0,
          y: 0,
          width: widthMM,
          height: heightMM,
          rx: 0.7,
          fill: "#050607",
          opacity: 0.52,
          filter: "url(#panel-drop-shadow)",
        }),
        React.createElement("rect", {
          x: 0,
          y: 0,
          width: widthMM,
          height: heightMM,
          rx: 0.7,
          fill: "url(#panel-surface)",
        }),
        React.createElement("rect", {
          x: 0,
          y: 0,
          width: widthMM,
          height: heightMM,
          rx: 0.7,
          fill: "url(#panel-edge-shine)",
          opacity: 0.3,
        }),
        React.createElement("rect", {
          x: 0.6,
          y: 1.0,
          width: Math.max(0.1, widthMM - 1.2),
          height: 8.5,
          rx: 0.45,
          fill: "rgba(255,255,255,0.028)",
          opacity: 0.9,
        }),
        React.createElement("rect", {
          x: 0.6,
          y: heightMM - 9.5,
          width: Math.max(0.1, widthMM - 1.2),
          height: 8.5,
          rx: 0.45,
          fill: "rgba(0,0,0,0.13)",
          opacity: 0.75,
        }),
        state.layerVisibility.grid &&
          React.createElement(
            "g",
            { opacity: lop("grid") },
            React.createElement(GridLayer, {
              widthMM: widthMM,
              heightMM: heightMM,
              grid: state.grid,
            }),
          ),
        state.layerVisibility.grid &&
          React.createElement(
            "g",
            { opacity: lop("grid") },
            React.createElement(HPGuideLayer, {
              widthHP: state.panel.widthHP,
              heightMM: heightMM,
            }),
          ),
        state.layerVisibility.artwork &&
          React.createElement(ArtworksLayer, {
            artworks: state.artworks,
            layer: "background",
            selectedArtwork: state.selectedArtwork,
            artworkDragPreview: artworkDragPreview,
            artworkResizePreview: artworkResizePreview,
            viewMode: state.viewMode,
            clipToPanel: state.clipArtworkToPanel,
            widthMM: widthMM,
            heightMM: heightMM,
            ignoreLockedClicks: state.ignoreLockedArtworkClicks,
            showInDrill: state.showArtworkInDrillView,
            drillOpacity: state.drillArtworkOpacity,
            previewMode: state.artworkPreviewMode,
          }),
        state.layerVisibility.mountingHoles &&
          React.createElement(
            "g",
            { opacity: lop("mountingHoles") },
            React.createElement(MountingHolesLayer, {
              config: state.mountingHoles,
            }),
          ),
        state.layerVisibility.text &&
          React.createElement(
            "g",
            { opacity: lop("text") },
            React.createElement(TextLayer, {
              items: state.textItems,
              layer: "background",
              selectedTexts: state.selectedTexts,
              textDragPreview: textDragPreview,
              textsDragPreview: textsDragPreview,
              viewMode: state.viewMode,
              editingTextId: editingTextId,
            }),
          ),
        state.layerVisibility.text &&
          React.createElement(
            "g",
            { opacity: lop("text") },
            React.createElement(ScaleLayer, {
              items: state.scaleItems,
              components: state.components,
              layer: "background",
              viewMode: state.viewMode,
            }),
          ),
        state.layerVisibility.panelOutline &&
          React.createElement(
            "g",
            { opacity: lop("panelOutline"), style: { pointerEvents: "none" } },
            React.createElement("rect", {
              x: 0,
              y: 0,
              width: widthMM,
              height: heightMM,
              fill: "none",
              stroke: "#a9b7bf",
              strokeWidth: 0.46,
            }),
            React.createElement("rect", {
              x: 0.45,
              y: 0.45,
              width: Math.max(0.1, widthMM - 0.9),
              height: Math.max(0.1, heightMM - 0.9),
              fill: "none",
              stroke: "rgba(255,255,255,0.13)",
              strokeWidth: 0.18,
            }),
            React.createElement("path", {
              d: `M 0.8 0.8 H ${Math.max(0.9, widthMM - 0.8)} M 0.8 ${heightMM - 0.8} H ${Math.max(0.9, widthMM - 0.8)}`,
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 0.12,
              fill: "none",
            }),
          ),
        showSafeZones &&
          React.createElement(MobileSafeZonesLayer, {
            widthMM: widthMM,
            components: state.components,
          }),
        snapTarget &&
          React.createElement(
            "g",
            {
              "data-snap-target-id": snapTarget.id,
              transform: `rotate(${snapTarget.rotation || 0}, ${snapTarget.x}, ${snapTarget.y})`,
              style: { pointerEvents: "none" },
            },
            snapTarget.holeType === "rect" || snapTarget.holeType === "slot"
              ? React.createElement("rect", {
                  x:
                    snapTarget.x -
                    (snapTarget.holeType === "rect"
                      ? (snapTarget.holeW ?? snapTarget.frontW)
                      : snapTarget.holeDiameter) /
                      2 -
                    1,
                  y:
                    snapTarget.y -
                    (snapTarget.holeType === "rect"
                      ? (snapTarget.holeH ?? snapTarget.frontH)
                      : (snapTarget.slotLength ?? snapTarget.holeDiameter)) /
                      2 -
                    1,
                  width:
                    (snapTarget.holeType === "rect"
                      ? (snapTarget.holeW ?? snapTarget.frontW)
                      : snapTarget.holeDiameter) + 2,
                  height:
                    (snapTarget.holeType === "rect"
                      ? (snapTarget.holeH ?? snapTarget.frontH)
                      : (snapTarget.slotLength ?? snapTarget.holeDiameter)) + 2,
                  rx: snapTarget.holeType === "slot" ? 1.5 : 0.5,
                  fill: "rgba(201,154,74,0.12)",
                  stroke: "#f3dfb2",
                  strokeWidth: 0.36,
                  strokeDasharray: "1.1 0.65",
                })
              : React.createElement("circle", {
                  cx: snapTarget.x,
                  cy: snapTarget.y,
                  r: (snapTarget.holeDiameter || 1) / 2 + 1,
                  fill: "rgba(201,154,74,0.12)",
                  stroke: "#f3dfb2",
                  strokeWidth: 0.36,
                  strokeDasharray: "1.1 0.65",
                }),
            React.createElement(
              "text",
              {
                x: snapTarget.x,
                y:
                  snapTarget.y -
                  Math.max(
                    snapTarget.holeDiameter || 1,
                    snapTarget.holeH || 0,
                    snapTarget.slotLength || 0,
                  ) /
                    2 -
                  2,
                fill: "#f3dfb2",
                fontSize: 1.15,
                fontWeight: 700,
                textAnchor: "middle",
                paintOrder: "stroke",
                stroke: "rgba(0,0,0,0.82)",
                strokeWidth: 0.32,
              },
              "Center snap",
            ),
          ),
        snapGuides.map((g, i) => {
          const label = String(g.label || "").replace(/^SNAP:\s*/i, "");
          const compactLabel =
            label.length > 28 ? `${label.slice(0, 25)}...` : label;
          if (g.axis === "x") {
            const labelW = Math.max(8, compactLabel.length * 0.58);
            const anchor = g.pos + labelW > widthMM - 0.8 ? "end" : "start";
            const labelX =
              anchor === "end"
                ? Math.max(0.8, Math.min(widthMM - 0.8, g.pos - 0.55))
                : Math.max(0.8, Math.min(widthMM - 0.8, g.pos + 0.55));
            return React.createElement(
              "g",
              { key: `gx-${i}`, style: { pointerEvents: "none" } },
              React.createElement("line", {
                x1: g.pos,
                y1: 0,
                x2: g.pos,
                y2: heightMM,
                stroke: "#c99a4a",
                strokeWidth: 0.18,
                strokeDasharray: "1.2 0.9",
                opacity: 0.82,
              }),
              React.createElement(
                "text",
                {
                  x: labelX,
                  y: 3 + i * 2.1,
                  fontSize: 1.08,
                  fill: "#f3dfb2",
                  opacity: 0.96,
                  textAnchor: anchor,
                },
                compactLabel,
              ),
            );
          }
          return React.createElement(
            "g",
            { key: `gy-${i}`, style: { pointerEvents: "none" } },
            React.createElement("line", {
              x1: 0,
              y1: g.pos,
              x2: widthMM,
              y2: g.pos,
              stroke: "#c99a4a",
              strokeWidth: 0.18,
              strokeDasharray: "1.2 0.9",
              opacity: 0.82,
            }),
            React.createElement(
              "text",
              {
                x: 0.8,
                y: Math.max(2, g.pos - 0.8),
                fontSize: 1.08,
                fill: "#f3dfb2",
                opacity: 0.96,
              },
              compactLabel,
            ),
          );
        }),
        state.layerVisibility.pcb &&
          React.createElement(
            "g",
            { opacity: lop("pcb") },
            React.createElement(PCBLayer, { pcb: state.pcb }),
          ),
        React.createElement(
          "g",
          {
            opacity: Math.min(
              lop("componentHoles"),
              lop("frontShapes"),
              lop("rearBodies"),
              lop("rearKeepouts"),
            ),
          },
          React.createElement(ComponentsLayer, {
            components: state.components,
            selectedIdSet: selectedIdSet,
            issueFocusIdSet: issueFocusIdSet,
            dragPreview: dragPreview,
            rotationPreview: rotationPreview,
            viewMode: state.viewMode,
            warnings: warnings,
            layers: state.layerVisibility,
            panelWidthMM: widthMM,
            dragPerfMode: !!dragPreview && dragPreview.size > 8,
          }),
        ),
        state.layerVisibility.topHardware &&
          React.createElement(
            "g",
            { opacity: lop("topHardware") },
            React.createElement(TopHardwareLayer, {
              components: state.components,
              dragPreview: dragPreview,
              viewMode: state.viewMode,
              style: state.topHardwareStyle,
              renderMode: state.hardwareRenderMode || "auto",
              performanceMode:
                !!state.mobilePerformanceMode || state.components.length > 140,
              zoom: zoom,
              dragPerfMode: !!dragPreview && dragPreview.size > 8,
            }),
          ),
        state.layerVisibility.text &&
          React.createElement(
            "g",
            { opacity: lop("text") },
            React.createElement(ScaleLayer, {
              items: state.scaleItems,
              components: state.components,
              layer: "foreground",
              viewMode: state.viewMode,
            }),
          ),
        state.layerVisibility.text &&
          React.createElement(
            "g",
            { opacity: lop("text") },
            React.createElement(TextLayer, {
              items: state.textItems,
              layer: "foreground",
              selectedTexts: state.selectedTexts,
              textDragPreview: textDragPreview,
              textsDragPreview: textsDragPreview,
              viewMode: state.viewMode,
              editingTextId: editingTextId,
            }),
          ),
        React.createElement(TemplateGhostLayer, {
          pending: pendingTemplatePlacement,
        }),
        pendingAddPart &&
          pendingAddPreview &&
          (() => {
            const ghost = {
              ...sanitizePart({
                ...pendingAddPart.def,
                category:
                  pendingAddPart.def.category ??
                  inferCategoryForType(pendingAddPart.def.type),
                verificationStatus:
                  pendingAddPart.def.verificationStatus ?? "approximate",
              }),
              id: "pending-add-ghost",
              ref: "",
              label: "",
              x: pendingAddPreview.x,
              y: pendingAddPreview.y,
              rotation: 0,
              notes: "",
              locked: false,
            };
            const front = getFrontBounds(ghost);
            const placementWarnings = computeWarnings(
              [...state.components, ghost],
              widthMM,
              state.mountingHoles,
              state.pcb,
            ).filter((warning) => warning.ids.includes(ghost.id));
            const hasPlacementConflict = placementWarnings.some(
              (warning) => warning.severity === "error",
            );
            return React.createElement(
              "g",
              {
                className: `pending-add-ghost${hasPlacementConflict ? " conflict" : ""}`,
                style: { pointerEvents: "none" },
                opacity: 0.72,
              },
              ghost.keepoutW > 0 &&
                React.createElement("rect", {
                  x: ghost.x - ghost.keepoutW / 2,
                  y: ghost.y - ghost.keepoutH / 2,
                  width: ghost.keepoutW,
                  height: ghost.keepoutH,
                  fill: "rgba(var(--ui-danger-rgb), .08)",
                  stroke: "var(--ui-danger)",
                  strokeWidth: 0.18,
                  strokeDasharray: "0.8 0.8",
                  vectorEffect: "non-scaling-stroke",
                }),
              ghost.rearBodyW > 0 &&
                React.createElement("rect", {
                  x: ghost.x - ghost.rearBodyW / 2,
                  y: ghost.y - ghost.rearBodyH / 2,
                  width: ghost.rearBodyW,
                  height: ghost.rearBodyH,
                  fill: "rgba(var(--ui-gold-rgb), .06)",
                  stroke: "var(--ui-gold)",
                  strokeWidth: 0.2,
                  strokeDasharray: "1.2 0.55",
                  vectorEffect: "non-scaling-stroke",
                }),
              getFrontShape(ghost) !== "circle"
                ? React.createElement(
                    "g",
                    {
                      transform: `rotate(${ghost.rotation}, ${ghost.x}, ${ghost.y})`,
                    },
                    React.createElement("rect", {
                      x: ghost.x - front.w / 2,
                      y: ghost.y - front.h / 2,
                      width: front.w,
                      height: front.h,
                      rx: 1.1,
                      fill: "rgba(201,154,74,.10)",
                      stroke: "#c99a4a",
                      strokeWidth: 0.28,
                      strokeDasharray: "1.1 0.65",
                      vectorEffect: "non-scaling-stroke",
                    }),
                  )
                : React.createElement("circle", {
                    cx: ghost.x,
                    cy: ghost.y,
                    r: Math.max(
                      ghost.frontDiameter / 2,
                      ghost.holeDiameter / 2,
                    ),
                    fill: "rgba(201,154,74,.10)",
                    stroke: "#c99a4a",
                    strokeWidth: 0.28,
                    strokeDasharray: "1.1 0.65",
                    vectorEffect: "non-scaling-stroke",
                  }),
              ghost.holeType === "slot"
                ? React.createElement(
                    "g",
                    {
                      transform: `rotate(${ghost.rotation}, ${ghost.x}, ${ghost.y})`,
                    },
                    React.createElement("rect", {
                      x: ghost.x - ghost.holeDiameter / 2,
                      y: ghost.y - (ghost.slotLength ?? ghost.holeDiameter) / 2,
                      width: ghost.holeDiameter,
                      height: ghost.slotLength ?? ghost.holeDiameter,
                      rx: ghost.holeDiameter / 2,
                      fill: "rgba(0,0,0,.35)",
                      stroke: "rgba(185,246,255,.60)",
                      strokeWidth: 0.18,
                    }),
                  )
                : ghost.holeType === "rect"
                  ? React.createElement(
                      "g",
                      {
                        transform: `rotate(${ghost.rotation}, ${ghost.x}, ${ghost.y})`,
                      },
                      React.createElement("rect", {
                        x:
                          ghost.x -
                          (ghost.holeW ?? ghost.frontW ?? ghost.holeDiameter) /
                            2,
                        y:
                          ghost.y -
                          (ghost.holeH ?? ghost.frontH ?? ghost.holeDiameter) /
                            2,
                        width:
                          ghost.holeW ?? ghost.frontW ?? ghost.holeDiameter,
                        height:
                          ghost.holeH ?? ghost.frontH ?? ghost.holeDiameter,
                        fill: "rgba(0,0,0,.35)",
                        stroke: "rgba(185,246,255,.60)",
                        strokeWidth: 0.18,
                      }),
                    )
                  : React.createElement("circle", {
                      cx: ghost.x,
                      cy: ghost.y,
                      r: ghost.holeDiameter / 2,
                      fill: "rgba(0,0,0,.35)",
                      stroke: "rgba(185,246,255,.60)",
                      strokeWidth: 0.18,
                    }),
              React.createElement(
                "text",
                {
                  x: ghost.x,
                  y: ghost.y + getFrontBottomOffset(ghost) + 2.8,
                  textAnchor: "middle",
                  fontSize: 1.7,
                  fill: "#f3dfb2",
                  stroke: "rgba(0,0,0,.55)",
                  strokeWidth: 0.28,
                  paintOrder: "stroke fill",
                },
                shortPartName(pendingAddPart.def),
                hasPlacementConflict ? " · CONFLICT" : "",
              ),
            );
          })(),
        state.layerVisibility.artwork &&
          React.createElement(ArtworksLayer, {
            artworks: state.artworks,
            layer: "foreground",
            selectedArtwork: state.selectedArtwork,
            artworkDragPreview: artworkDragPreview,
            artworkResizePreview: artworkResizePreview,
            viewMode: state.viewMode,
            clipToPanel: state.clipArtworkToPanel,
            widthMM: widthMM,
            heightMM: heightMM,
            ignoreLockedClicks: state.ignoreLockedArtworkClicks,
            showInDrill: state.showArtworkInDrillView,
            drillOpacity: state.drillArtworkOpacity,
            previewMode: state.artworkPreviewMode,
          }),
        React.createElement(RearBodySnapFootprintLayer, {
          components: state.components,
          selectedIdSet: selectedIdSet,
          dragPreview: dragPreview,
          viewMode: state.viewMode,
        }),
        React.createElement(DistanceGuidesLayer, { guides: distanceGuides }),
        marqueeSelection &&
          (() => {
            const x1 = Math.min(
              marqueeSelection.start.x,
              marqueeSelection.current.x,
            );
            const y1 = Math.min(
              marqueeSelection.start.y,
              marqueeSelection.current.y,
            );
            const x2 = Math.max(
              marqueeSelection.start.x,
              marqueeSelection.current.x,
            );
            const y2 = Math.max(
              marqueeSelection.start.y,
              marqueeSelection.current.y,
            );
            return React.createElement(
              "g",
              { style: { pointerEvents: "none" } },
              React.createElement("rect", {
                x: x1,
                y: y1,
                width: Math.max(0.01, x2 - x1),
                height: Math.max(0.01, y2 - y1),
                fill: "rgba(201,154,74,0.10)",
                stroke: "#c99a4a",
                strokeWidth: 0.34,
                strokeDasharray: "1.2 0.7",
              }),
            );
          })(),
        React.createElement(RulerLayer, { ruler: ruler }),
      ),
    ),
    React.createElement(
      "div",
      {
        className: `canvas-hud ${warnings.some((w) => w.severity === "error") ? "has-errors" : warnings.length ? "has-warnings" : ""}`,
      },
      React.createElement(
        "span",
        { className: "hud-main" },
        state.panel.widthHP,
        "HP",
      ),
      React.createElement("span", null, state.viewMode.toUpperCase()),
      React.createElement("span", null, Math.round(zoom * 100), "%"),
      React.createElement("span", null, state.grid.size, "mm grid"),
      React.createElement("span", null, state.components.length, " parts"),
      state.selected.length > 0 &&
        React.createElement(
          "span",
          { className: "hud-selected" },
          state.selected.length,
          " selected",
        ),
      warnings.length > 0 &&
        React.createElement(
          "span",
          { className: "hud-issues" },
          warnings.length,
          " issues",
        ),
    ),
    touchMode === "select" &&
      React.createElement(
        "div",
        { className: "mobile-lasso-hint" },
        "Multi: tap parts or drag empty space",
      ),
    React.createElement(
      "div",
      {
        className: "workspace-overlay",
        onMouseDown: (e) => e.stopPropagation(),
        onTouchStart: (e) => e.stopPropagation(),
      },
      React.createElement(
        "div",
        { className: "hud-zone hud-bottom-left" },
        React.createElement(DFMStatusFloat, { warnings: warnings }),
      ),
      React.createElement(
        "div",
        { className: "hud-zone hud-bottom-right" },
        React.createElement(SelectionInfoStrip, { hidden: false }),
        coordReadout &&
          React.createElement(
            "div",
            { className: "coord-readout" },
            coordReadout,
          ),
        onZoomChange &&
          React.createElement(
            "div",
            {
              className: "zoom-hud-control",
              onMouseDown: (e) => e.stopPropagation(),
              onTouchStart: (e) => e.stopPropagation(),
            },
            React.createElement(
              "span",
              {
                className: "zoom-hud-value",
                onClick: () => onZoomChange(1),
                title: "Reset zoom to 100%",
              },
              Math.round(zoom * 100),
              "%",
            ),
            React.createElement("input", {
              type: "range",
              className: "zoom-hud-slider",
              min: 0.25,
              max: 6,
              step: 0.05,
              value: zoom,
              onChange: (e) => onZoomChange(parseFloat(e.target.value)),
            }),
          ),
      ),
      React.createElement(
        "div",
        { className: "hud-zone hud-top-center" },
        pendingAddPart &&
          React.createElement(
            "div",
            {
              className: "placement-status-pill",
              onMouseDown: (e) => e.stopPropagation(),
              onWheel: (e) => e.stopPropagation(),
            },
            React.createElement("strong", null, "PLACE"),
            React.createElement(
              "span",
              null,
              React.createElement("b", null, shortPartName(pendingAddPart.def)),
              React.createElement(
                "em",
                { className: "desktop-placement-help" },
                " \u00B7 Shift+click for more",
              ),
              React.createElement(
                "em",
                { className: "mobile-placement-help" },
                " \u00B7 tap panel to place",
              ),
            ),
            React.createElement(
              "button",
              {
                className: pendingAddRepeat ? "active" : "",
                onClick: () => onTogglePendingAddRepeat?.(),
              },
              pendingAddRepeat ? "Multiple on" : "Multiple",
            ),
            React.createElement(
              "button",
              {
                onClick: () => {
                  if (pendingAddPart) {
                    const x = pendingAddPreview
                      ? pendingAddPreview.x
                      : snapToGrid(widthMM / 2, state.grid.size);
                    const y = pendingAddPreview
                      ? pendingAddPreview.y
                      : snapToGrid(heightMM / 2, state.grid.size);
                    dispatch({
                      type: "ADD_COMPONENT",
                      def: pendingAddPart.def,
                      x,
                      y,
                    });
                  }
                  onCancelPendingAdd?.();
                },
              },
              "Done",
            ),
          ),
      ),
      React.createElement(
        "div",
        { className: "hud-zone hud-top-right" },
        React.createElement(SnapFeedbackBadge, { guides: snapGuides }),
      ),
      state.components.length === 0 &&
        state.artworks.length === 0 &&
        state.textItems.length === 0 &&
        !pendingAddPart &&
        React.createElement(
          "div",
          {
            className: "canvas-empty-state",
            onPointerDown: (e) => e.stopPropagation(),
            onTouchStart: (e) => e.stopPropagation(),
            onTouchEnd: (e) => e.stopPropagation(),
          },
          React.createElement("strong", null, "Build your panel"),
          React.createElement(
            "span",
            null,
            "Add the first control, start from a template, or bring in a mechanical faceplate.",
          ),
          React.createElement(
            "div",
            { className: "canvas-empty-actions primary" },
            React.createElement(
              "button",
              {
                className: "canvas-empty-primary",
                onClick: () => AppCommands.openComponentLibraryPicker(),
              },
              "Add component",
            ),
            React.createElement(
              "button",
              { onClick: () => AppCommands.openTemplatesDialog() },
              "Templates",
            ),
          ),
          React.createElement(
            "div",
            { className: "canvas-empty-import" },
            React.createElement("span", null, "Import faceplate"),
            React.createElement(
              "div",
              { className: "canvas-empty-actions" },
              React.createElement(
                "button",
                {
                  onClick: () =>
                    document.getElementById("kicad-pcb-file-input")?.click(),
                },
                "KiCad PCB",
              ),
              React.createElement(
                "button",
                {
                  onClick: () =>
                    document.getElementById("eagle-brd-file-input")?.click(),
                },
                "Eagle BRD",
              ),
            ),
          ),
          React.createElement(
            "small",
            { className: "canvas-empty-shortcut" },
            "⌘/Ctrl K searches everything · Shift snaps parts to imported holes",
          ),
        ),
    ),
    hoverTip &&
      React.createElement(ComponentHoverTooltip, {
        component: hoveredComponent,
        warnings: warnings,
        x: hoverTip.x,
        y: hoverTip.y,
      }),
  );
}
