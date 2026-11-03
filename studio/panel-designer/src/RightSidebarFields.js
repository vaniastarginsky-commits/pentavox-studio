// Right sidebar panel components extracted from core.js.
// Globals are loaded by index.html; keep these files script-friendly, not ES modules.

// Shared field/card helpers for right sidebar panels.

function NumFieldCompact({ label, value, onChange, step = 0.1, min = 0 }) {
  const [draft, setDraft] = useState("");
  return React.createElement(
    "div",
    { className: "compact-field" },
    React.createElement("span", { className: "compact-field-label" }, label),
    React.createElement("input", {
      type: "number",
      step: step,
      min: min,
      value: draft !== "" ? draft : value.toFixed(2),
      onChange: (e) => setDraft(e.target.value),
      onBlur: () => {
        const v = parseFloat(draft);
        if (!isNaN(v)) onChange(v);
        setDraft("");
      },
      onKeyDown: (e) => {
        if (e.key === "Enter") {
          const v = parseFloat(draft);
          if (!isNaN(v)) onChange(v);
          setDraft("");
        }
      },
    }),
  );
}
function NumField({ label, value, onChange, step = 0.1, min = 0 }) {
  const [draft, setDraft] = useState("");
  return React.createElement(
    "div",
    { className: "field-row" },
    React.createElement("label", null, label),
    React.createElement("input", {
      type: "number",
      step: step,
      min: min,
      value: draft !== "" ? draft : value.toFixed(2),
      onChange: (e) => setDraft(e.target.value),
      onBlur: () => {
        const v = parseFloat(draft);
        if (!isNaN(v)) onChange(v);
        setDraft("");
      },
      onKeyDown: (e) => {
        if (e.key === "Enter") {
          const v = parseFloat(draft);
          if (!isNaN(v)) onChange(v);
          setDraft("");
        }
      },
    }),
  );
}
function ComponentSourceCard({ c }) {
  const status = c.verificationStatus || "approximate";
  const statusLabel =
    status === "datasheet"
      ? "Datasheet"
      : status === "measured"
        ? "Measured"
        : status === "production"
          ? "Production"
          : "Approximate";
  const statusClass =
    status === "approximate" ? "warn" : status === "production" ? "ok" : "info";
  const front = getFrontBounds(c);
  const hole =
    c.holeType === "slot"
      ? `${c.holeDiameter.toFixed(2)} × ${(c.slotLength ?? c.holeDiameter).toFixed(2)} mm slot`
      : c.holeType === "rect"
        ? `${(c.holeW ?? c.frontW ?? c.holeDiameter).toFixed(2)} × ${(c.holeH ?? c.frontH ?? c.holeDiameter).toFixed(2)} mm rectangular cut`
        : `Ø ${c.holeDiameter.toFixed(2)} mm`;
  const frontText =
    getFrontShape(c) === "circle"
      ? `Ø ${c.frontDiameter.toFixed(2)} mm visible/front`
      : `${front.w.toFixed(2)} × ${front.h.toFixed(2)} mm front bounds`;
  const source =
    [c.manufacturer, c.partNumber].filter(Boolean).join(" · ") ||
    "No source set";
  return React.createElement(
    "div",
    { className: `component-source-card ${statusClass}` },
    React.createElement(
      "div",
      { className: "component-source-head" },
      React.createElement("strong", null, statusLabel),
      React.createElement(
        "span",
        null,
        c.category || inferCategoryForType(c.type),
      ),
    ),
    React.createElement("div", { className: "component-source-title" }, source),
    c.datasheetUrl &&
      React.createElement(
        "div",
        { className: "component-source-url", title: c.datasheetUrl },
        c.datasheetUrl,
      ),
    status === "approximate" &&
      React.createElement(
        "div",
        { className: "component-source-warning" },
        "Approximate part: verify panel hole, rear body, depth and keepouts before production.",
      ),
    React.createElement(
      "div",
      { className: "component-dim-grid" },
      React.createElement(
        "div",
        null,
        React.createElement("b", null, "Hole"),
        React.createElement("span", null, hole),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("b", null, "Front"),
        React.createElement("span", null, frontText),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("b", null, "Rear body"),
        React.createElement(
          "span",
          null,
          c.rearBodyW.toFixed(2),
          " \u00D7 ",
          c.rearBodyH.toFixed(2),
          " mm",
        ),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("b", null, "Rear depth"),
        React.createElement("span", null, c.rearDepth.toFixed(2), " mm"),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("b", null, "Keepout"),
        React.createElement(
          "span",
          null,
          c.keepoutW.toFixed(2),
          " \u00D7 ",
          c.keepoutH.toFixed(2),
          " mm",
        ),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("b", null, "Spacing"),
        React.createElement("span", null, c.minSpacing.toFixed(2), " mm min"),
      ),
    ),
    React.createElement(
      "div",
      { className: "component-source-note" },
      c.verification || "No verification note yet.",
    ),
  );
}
