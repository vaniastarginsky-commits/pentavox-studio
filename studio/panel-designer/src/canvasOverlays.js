// Canvas overlay React components: ScaleLayer, TemplateGhostLayer,
// ComponentHoverTooltip, SnapFeedbackBadge, DFMStatusFloat.
// Depends on: React globals (useState, useMemo, useEffect, useRef), useAppState, useAppDispatch,
// isFaderLike, getFrontBounds, getFrontTopOffset, getFrontBottomOffset,
// getScaleReferenceRadius, isPartVerified, verificationLabel — all from core.js.
const ScaleLayer = React.memo(function ScaleLayer({
  items,
  components,
  layer,
  viewMode,
}) {
  if (viewMode === "rear" || viewMode === "drill") return null;
  function polar(cx, cy, r, deg) {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }
  return React.createElement(
    "g",
    null,
    items
      .filter((s) => s.layer === layer && s.visible)
      .map((sc) => {
        const c = sc.componentId
          ? components.find((x) => x.id === sc.componentId)
          : null;
        const cx = c?.x ?? sc.x,
          cy = c?.y ?? sc.y;
        const ticks = [];
        const n = Math.max(2, sc.ticks);
        if ((sc.kind === "fader" || (c && isFaderLike(c) && sc.side)) && c) {
          const b = getFrontBounds(c);
          const side = sc.side === "left" ? "left" : "right";
          const dir = side === "left" ? -1 : 1;
          const railW = Math.max(
            c.frontW || 0,
            b.w || 0,
            c.holeDiameter || 0,
            5.0,
          );
          const slotH = c.slotLength ?? b.h;
          const gap = Math.max(1.35, sc.tickLength * 1.15);
          const x0 = cx + dir * (railW / 2 + gap);
          const top = cy - slotH / 2;
          const bottom = cy + slotH / 2;
          ticks.push(
            React.createElement("line", {
              key: "fader-scale-spine",
              x1: x0,
              y1: top,
              x2: x0,
              y2: bottom,
              stroke: "#ddd",
              strokeWidth: 0.1,
              opacity: 0.72,
            }),
          );
          for (let i = 0; i < n; i++) {
            const t = i / (n - 1);
            const y = bottom - t * slotH;
            const major = i % Math.max(1, sc.majorEvery) === 0;
            const len = major
              ? Math.max(1.0, sc.tickLength * 0.92)
              : Math.max(0.55, sc.tickLength * 0.48);
            ticks.push(
              React.createElement("line", {
                key: `ft${i}`,
                x1: x0,
                y1: y,
                x2: x0 + dir * len,
                y2: y,
                stroke: "#ddd",
                strokeWidth: major ? 0.16 : 0.1,
                opacity: major ? 0.9 : 0.58,
              }),
            );
            if (major && sc.labelMode !== "none") {
              const value =
                sc.labelMode === "0-10"
                  ? Math.round(t * 10)
                  : Math.round(-5 + t * 10);
              const showNumber =
                i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2);
              if (showNumber) {
                ticks.push(
                  React.createElement(
                    "text",
                    {
                      key: `fl${i}`,
                      x: x0 + dir * (len + 0.62),
                      y: y,
                      fontSize: Math.min(sc.fontSizeMm, 0.86),
                      textAnchor: side === "left" ? "end" : "start",
                      dominantBaseline: "middle",
                      fill: "#ddd",
                      opacity: 0.86,
                    },
                    String(value),
                  ),
                );
              }
            }
          }
          return React.createElement(
            "g",
            {
              key: sc.id,
              transform: `rotate(${c.rotation || 0}, ${cx}, ${cy})`,
            },
            ticks,
          );
        }
        if (sc.kind === "fader" && !c) return null;
        if (sc.kind === "fader" && !c) return null;
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
        const rawFontSize = Number.isFinite(sc.fontSizeMm)
          ? Math.max(sc.fontSizeMm, 0.4)
          : 1.05;
        const fontSize =
          refR > 0 ? Math.min(rawFontSize, 1.15) : Math.min(rawFontSize, 3.2);
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const deg = sc.startAngle + (sc.endAngle - sc.startAngle) * t;
          const major = i % Math.max(1, sc.majorEvery) === 0;
          const len = major ? majorLen : minorLen;
          const [x1, y1] = polar(cx, cy, baseR, deg);
          const [x2, y2] = polar(cx, cy, Math.min(baseR + len, maxOuterR), deg);
          ticks.push(
            React.createElement("line", {
              key: `t${i}`,
              x1: x1,
              y1: y1,
              x2: x2,
              y2: y2,
              stroke: "#ddd",
              strokeWidth: major ? 0.24 : 0.15,
            }),
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
            ticks.push(
              React.createElement(
                "text",
                {
                  key: `l${i}`,
                  x: lx,
                  y: ly,
                  fontSize: fontSize,
                  textAnchor: "middle",
                  dominantBaseline: "middle",
                  fill: "#ddd",
                },
                label,
              ),
            );
          }
        }
        return React.createElement("g", { key: sc.id }, ticks);
      }),
  );
});
const TemplateGhostLayer = React.memo(function TemplateGhostLayer({ pending }) {
  if (!pending) return null;
  const comps = previewTemplateComponents(pending);
  return React.createElement(
    "g",
    { pointerEvents: "none", opacity: 0.45 },
    comps.map((c) =>
      React.createElement(
        "g",
        { key: c.id, transform: `rotate(${c.rotation}, ${c.x}, ${c.y})` },
        React.createElement("rect", {
          x: c.x - getFrontBounds(c).w / 2,
          y: c.y - getFrontBounds(c).h / 2,
          width: getFrontBounds(c).w,
          height: getFrontBounds(c).h,
          rx: 0.6,
          fill: "rgba(201,154,74,0.15)",
          stroke: "#c99a4a",
          strokeWidth: 0.25,
          strokeDasharray: "1 0.6",
        }),
        React.createElement("circle", {
          cx: c.x,
          cy: c.y,
          r: Math.max(0.8, c.holeDiameter / 2),
          fill: "none",
          stroke: "#ddd",
          strokeWidth: 0.2,
        }),
      ),
    ),
  );
});
function previewTemplateComponents(pending) {
  const comps = pending.components;
  const cx = comps.reduce((a, c) => a + c.x, 0) / Math.max(1, comps.length);
  const cy = comps.reduce((a, c) => a + c.y, 0) / Math.max(1, comps.length);
  const a = degToRad(pending.rotation);
  const co = Math.cos(a),
    si = Math.sin(a);
  return comps.map((c) => {
    const dx = c.x - cx,
      dy = c.y - cy;
    return {
      ...c,
      x: pending.anchor.x + dx * co - dy * si,
      y: pending.anchor.y + dx * si + dy * co,
      rotation: ((c.rotation || 0) + pending.rotation) % 360,
    };
  });
}
function getComponentLabelLayout(c, panelW) {
  const text = c.label || c.name || "";
  const pos = c.labelPosition || "bottom";
  const bounds = getFrontBounds(c);
  const sideGap = 2.1;
  const verticalGap = 2.5;
  const fontSize = 2;
  const approxW = Math.max(2.8, text.length * fontSize * 0.54);
  let x = c.x;
  let y = c.y + getFrontBottomOffset(c) + verticalGap;
  let anchor = "middle";
  let baseline = "auto";
  if (pos === "top") {
    y = c.y - getFrontTopOffset(c) - 1.8;
    anchor = "middle";
  } else if (pos === "left") {
    x = c.x - bounds.w / 2 - sideGap;
    y = c.y + 0.7;
    anchor = "end";
    baseline = "middle";
  } else if (pos === "right") {
    x = c.x + bounds.w / 2 + sideGap;
    y = c.y + 0.7;
    anchor = "start";
    baseline = "middle";
  }
  const pad = 0.7;
  if (anchor === "middle") {
    const half = Math.min(approxW / 2, Math.max(0.5, panelW / 2 - pad));
    x = Math.max(pad + half, Math.min(panelW - pad - half, x));
  } else if (anchor === "start") {
    x = Math.max(pad, Math.min(panelW - pad, x));
  } else {
    x = Math.max(pad, Math.min(panelW - pad, x));
  }
  return { text, x, y, anchor, baseline, fontSize };
}
function warningToneForIds(warnings, ids) {
  let hasWarn = false;
  for (const w of warnings) {
    if (!w.ids.some((id) => ids.includes(id))) continue;
    if (w.severity === "error") return "error";
    hasWarn = true;
  }
  return hasWarn ? "warn" : "ok";
}
function ComponentHoverTooltip({ component, warnings, x, y }) {
  if (!component) return null;
  const front = getFrontBounds(component);
  const related = warnings.filter((w) => w.ids.includes(component.id));
  const hard = related.filter((w) => w.severity === "error").length;
  const warn = related.length - hard;
  const body =
    component.rearBodyW > 0 && component.rearBodyH > 0
      ? `${component.rearBodyW.toFixed(1)} × ${component.rearBodyH.toFixed(1)} mm`
      : "none";
  const shape =
    component.holeType === "slot"
      ? `slot ${component.holeDiameter.toFixed(1)} × ${(component.slotLength ?? component.holeDiameter).toFixed(1)} mm`
      : component.holeType === "rect"
        ? `rect ${(component.holeW ?? component.frontW ?? component.holeDiameter).toFixed(1)} × ${(component.holeH ?? component.frontH ?? component.holeDiameter).toFixed(1)} mm`
        : `Ø ${component.holeDiameter.toFixed(1)} mm`;
  const status = verificationLabel(component.verificationStatus);
  const rows = [
    ["Part", component.name],
    ["Position", `${component.x.toFixed(2)} / ${component.y.toFixed(2)} mm`],
    ["Hole", shape],
    ["Front", `${front.w.toFixed(1)} × ${front.h.toFixed(1)} mm`],
    ["Rear body", body],
    ["Depth", `${component.rearDepth.toFixed(1)} mm`],
    ["Status", status],
  ];
  const cardW = 260;
  return React.createElement(
    "div",
    {
      className: `component-hover-card ${hard ? "has-errors" : warn ? "has-warnings" : ""}`,
      style: { width: cardW },
    },
    React.createElement(
      "div",
      { className: "hover-title" },
      React.createElement("span", null, component.ref || component.type),
      React.createElement("b", null, component.label || component.name),
    ),
    React.createElement(
      "div",
      { className: "hover-grid" },
      rows.map(([label, value]) =>
        React.createElement(
          "div",
          { key: label, className: "hover-row" },
          React.createElement("span", null, label),
          React.createElement("strong", null, value),
        ),
      ),
    ),
    related.length > 0 &&
      React.createElement(
        "div",
        { className: "hover-warnings" },
        hard ? `${hard} hard error${hard > 1 ? "s" : ""}` : "",
        hard && warn ? " · " : "",
        warn ? `${warn} warning${warn > 1 ? "s" : ""}` : "",
      ),
    component.locked &&
      React.createElement("div", { className: "hover-note" }, "Locked"),
  );
}
function SnapFeedbackBadge({ guides }) {
  if (!guides.length) return null;
  const labels = Array.from(new Set(guides.map((g) => g.label))).slice(0, 2);
  return React.createElement(
    "div",
    { className: "snap-feedback-badge" },
    React.createElement("span", null, "SNAP"),
    labels.join(" + "),
  );
}
function DFMStatusFloat({ warnings }) {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const hard = warnings.filter((w) => w.severity === "error").length;
  const warn = warnings.length - hard;
  const approxParts = state.components.filter((c) => !isPartVerified(c));
  const approx = approxParts.length;
  const tone = hard ? "error" : warn || approx ? "warn" : "ok";
  const componentIdSet = useMemo(
    () => new Set(state.components.map((c) => c.id)),
    [state.components],
  );
  const visibleWarnings = warnings.slice(0, 10);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);
  function selectIssue(ids) {
    const realIds = ids.filter((id) => componentIdSet.has(id));
    if (realIds.length)
      window.dispatchEvent(
        new CustomEvent("panel-designer:focus-components", {
          detail: { ids: realIds },
        }),
      );
  }
  return React.createElement(
    "div",
    {
      ref: rootRef,
      className: `dfm-status-float ${tone} ${open ? "open" : ""}`,
      onMouseDown: (e) => e.stopPropagation(),
      onTouchStart: (e) => e.stopPropagation(),
    },
    React.createElement(
      "button",
      {
        className: "dfm-status-main",
        onClick: () => setOpen((v) => !v),
        title: "Open DFM / issue summary",
      },
      React.createElement(
        "strong",
        null,
        tone === "ok" ? "DFM OK" : hard ? "DFM CHECK" : "DFM CAUTION",
      ),
      React.createElement("span", null, hard, " errors"),
      React.createElement("span", null, warn, " warnings"),
      React.createElement("span", null, approx, " unverified"),
    ),
    open &&
      React.createElement(
        "div",
        { className: "dfm-status-drawer" },
        warnings.length === 0 &&
          approx === 0 &&
          React.createElement(
            "div",
            { className: "dfm-empty" },
            "No active warnings.",
          ),
        visibleWarnings.map((w, i) => {
          const canSelect = w.ids.some((id) => componentIdSet.has(id));
          return React.createElement(
            "button",
            {
              key: `${w.message}-${i}`,
              className: `dfm-issue-row ${w.severity}`,
              onClick: () => selectIssue(w.ids),
              disabled: !canSelect,
              title: canSelect
                ? "Select related component(s)"
                : "Project-level warning",
            },
            React.createElement(
              "span",
              null,
              w.severity === "error" ? "ERR" : "WARN",
            ),
            React.createElement("b", null, w.message),
          );
        }),
        warnings.length > visibleWarnings.length &&
          React.createElement(
            "div",
            { className: "dfm-more" },
            "+",
            warnings.length - visibleWarnings.length,
            " more in the warnings sidebar",
          ),
        approx > 0 &&
          React.createElement(
            "div",
            { className: "dfm-unverified" },
            React.createElement("strong", null, approx, " unverified parts"),
            React.createElement(
              "small",
              null,
              approxParts
                .slice(0, 5)
                .map((c) => c.ref || c.name)
                .join(", "),
              approx > 5 ? "…" : "",
            ),
          ),
      ),
  );
}
