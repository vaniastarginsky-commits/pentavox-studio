// Right sidebar panel components extracted from core.js.
// Globals are loaded by index.html; keep these files script-friendly, not ES modules.

// Artwork and text properties inspectors.

function downscaleArtworkImage(dataUrl, maxPx, naturalW, naturalH, cb) {
  const img = new window.Image();
  img.onload = () => {
    const scale = Math.min(1, maxPx / Math.max(naturalW, naturalH));
    if (scale >= 1) {
      cb(dataUrl, naturalW, naturalH);
      return;
    }
    const w = Math.round(naturalW * scale);
    const h = Math.round(naturalH * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    cb(canvas.toDataURL("image/png"), w, h);
  };
  img.src = dataUrl;
}
function ArtworkPropertiesPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const art = state.artworks.find((a) => a.id === state.selectedArtwork);
  if (!art) return null;
  const patch = (p) =>
    dispatch({ type: "UPDATE_ARTWORK", id: art.id, patch: p });
  const widthMM = panelWidthMM(state.panel);
  const heightMM = PANEL_HEIGHT_MM;
  function centerOnPanel() {
    patch({ x: widthMM / 2, y: heightMM / 2 });
  }
  function fitToPanel() {
    patch({
      x: widthMM / 2,
      y: heightMM / 2,
      width: widthMM,
      height: heightMM,
    });
  }
  function fitToWidth() {
    const scale = widthMM / art.width;
    patch({
      x: widthMM / 2,
      y: heightMM / 2,
      width: widthMM,
      height: art.height * scale,
    });
  }
  function fitToHeight() {
    const scale = heightMM / art.height;
    patch({
      x: widthMM / 2,
      y: heightMM / 2,
      width: art.width * scale,
      height: heightMM,
    });
  }
  async function calibrateByRuler() {
    const measured = window.__PANEL_RULER_DISTANCE_MM;
    if (!measured || measured <= 0) {
      alert("Use the Ruler tool to measure two points on the image first.");
      return;
    }
    const known = await appNumberPrompt({
      title: "Calibrate artwork",
      subtitle: `Current ruler measurement is ${measured.toFixed(2)} mm in panel space.`,
      label: "Known real distance, mm",
      defaultValue: measured.toFixed(2),
      min: 0.01,
      step: 0.01,
      confirmText: "Calibrate",
    });
    if (known === null || !Number.isFinite(known) || known <= 0) return;
    const s = known / measured;
    patch({ width: art.width * s, height: art.height * s });
  }
  function setWidth(w) {
    if (art.preserveAspectRatio && art.naturalW > 0) {
      patch({ width: w, height: w * (art.naturalH / art.naturalW) });
    } else {
      patch({ width: w });
    }
  }
  function setHeight(h) {
    if (art.preserveAspectRatio && art.naturalH > 0) {
      patch({ height: h, width: h * (art.naturalW / art.naturalH) });
    } else {
      patch({ height: h });
    }
  }
  return React.createElement(
    "div",
    { className: "section", "data-artwork-properties": "true" },
    React.createElement("div", { className: "section-title" }, "Image"),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Name"),
      React.createElement("input", {
        type: "text",
        value: art.name,
        onChange: (e) => patch({ name: e.target.value }),
      }),
    ),
    React.createElement(
      "div",
      { className: "field-pair" },
      React.createElement(NumField, {
        label: "X (mm)",
        value: art.x,
        onChange: (v) => patch({ x: v }),
      }),
      React.createElement(NumField, {
        label: "Y (mm)",
        value: art.y,
        onChange: (v) => patch({ y: v }),
      }),
    ),
    React.createElement(
      "div",
      { className: "field-pair" },
      React.createElement(NumField, {
        label: "W (mm)",
        value: art.width,
        min: 0.1,
        onChange: setWidth,
      }),
      React.createElement(NumField, {
        label: "H (mm)",
        value: art.height,
        min: 0.1,
        onChange: setHeight,
      }),
    ),
    React.createElement(NumField, {
      label: "Rotation (\u00B0)",
      value: art.rotation,
      step: 5,
      min: -360,
      onChange: (v) => patch({ rotation: v }),
    }),
    React.createElement(NumField, {
      label: "Opacity (0\u20131)",
      value: art.opacity,
      step: 0.05,
      min: 0,
      onChange: (v) => patch({ opacity: Math.max(0, Math.min(1, v)) }),
    }),
    React.createElement(
      "div",
      { className: "section-title", style: { fontSize: 10, marginTop: 6 } },
      "Fit / align",
    ),
    React.createElement(
      "div",
      { className: "btn-row" },
      React.createElement("button", { onClick: centerOnPanel }, "Center"),
      React.createElement("button", { onClick: fitToPanel }, "Fit panel"),
    ),
    React.createElement(
      "div",
      { className: "btn-row" },
      React.createElement("button", { onClick: fitToWidth }, "Fit width"),
      React.createElement("button", { onClick: fitToHeight }, "Fit height"),
    ),
    React.createElement(
      "div",
      { className: "btn-row" },
      React.createElement(
        "button",
        {
          title: "Use the current ruler length as two-point image calibration.",
          onClick: calibrateByRuler,
        },
        "Calibrate by ruler",
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Layer"),
      React.createElement(
        "select",
        {
          style: { width: "100%" },
          value: art.layer,
          onChange: (e) => patch({ layer: e.target.value }),
        },
        React.createElement(
          "option",
          { value: "background" },
          "Background (behind components)",
        ),
        React.createElement(
          "option",
          { value: "foreground" },
          "Foreground (above components)",
        ),
      ),
    ),
    React.createElement(
      "div",
      {
        className: "field-row",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 5,
          marginTop: 4,
        },
      },
      React.createElement(
        "label",
        { style: { display: "flex", alignItems: "center", gap: 6 } },
        React.createElement("input", {
          type: "checkbox",
          checked: art.preserveAspectRatio,
          onChange: (e) => patch({ preserveAspectRatio: e.target.checked }),
        }),
        "Preserve aspect ratio",
      ),
      React.createElement(
        "label",
        { style: { display: "flex", alignItems: "center", gap: 6 } },
        React.createElement("input", {
          type: "checkbox",
          checked: art.visible,
          onChange: (e) => patch({ visible: e.target.checked }),
        }),
        "Visible",
      ),
      React.createElement(
        "label",
        { style: { display: "flex", alignItems: "center", gap: 6 } },
        React.createElement("input", {
          type: "checkbox",
          checked: art.locked,
          onChange: (e) => patch({ locked: e.target.checked }),
        }),
        "Locked (no drag)",
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row", style: { marginTop: 6 } },
      React.createElement("label", null, "Notes"),
      React.createElement("textarea", {
        value: art.notes,
        onChange: (e) => patch({ notes: e.target.value }),
      }),
    ),
    React.createElement(
      "div",
      { className: "btn-row", style: { marginTop: 8 } },
      React.createElement(
        "button",
        {
          onClick: () => {
            const dupe = {
              ...art,
              id: crypto.randomUUID(),
              x: art.x + 5,
              y: art.y + 5,
            };
            dispatch({ type: "ADD_ARTWORK", item: dupe });
          },
        },
        "Duplicate",
      ),
      React.createElement(
        "button",
        {
          className: "danger",
          onClick: () => dispatch({ type: "DELETE_ARTWORK", id: art.id }),
        },
        "Delete",
      ),
    ),
    React.createElement(
      "div",
      { className: "section-title", style: { marginTop: 8, fontSize: 10 } },
      "Z-order (within layer)",
    ),
    React.createElement(
      "div",
      { className: "btn-row" },
      React.createElement(
        "button",
        {
          title: "Bring Forward",
          onClick: () =>
            dispatch({ type: "REORDER_ARTWORK", id: art.id, dir: "forward" }),
        },
        "\u2191 Forward",
      ),
      React.createElement(
        "button",
        {
          title: "Send Backward",
          onClick: () =>
            dispatch({ type: "REORDER_ARTWORK", id: art.id, dir: "backward" }),
        },
        "\u2193 Backward",
      ),
    ),
    React.createElement(
      "div",
      { className: "btn-row" },
      React.createElement(
        "button",
        {
          title: "Bring to Front of layer",
          onClick: () =>
            dispatch({ type: "REORDER_ARTWORK", id: art.id, dir: "front" }),
        },
        "\u2912 To Front",
      ),
      React.createElement(
        "button",
        {
          title: "Send to Back of layer",
          onClick: () =>
            dispatch({ type: "REORDER_ARTWORK", id: art.id, dir: "back" }),
        },
        "\u2913 To Back",
      ),
    ),
    React.createElement(
      "div",
      { className: "section-title", style: { marginTop: 8, fontSize: 10 } },
      "Downscale image",
    ),
    React.createElement(
      "div",
      { className: "btn-row" },
      React.createElement(
        "button",
        {
          title: "Resample image to max 2000px on longest side",
          onClick: () =>
            downscaleArtworkImage(
              art.imageDataUrl,
              2000,
              art.naturalW,
              art.naturalH,
              (url, w, h) =>
                patch({ imageDataUrl: url, naturalW: w, naturalH: h }),
            ),
        },
        "Max 2000px",
      ),
      React.createElement(
        "button",
        {
          title: "Resample image to max 1000px on longest side",
          onClick: () =>
            downscaleArtworkImage(
              art.imageDataUrl,
              1000,
              art.naturalW,
              art.naturalH,
              (url, w, h) =>
                patch({ imageDataUrl: url, naturalW: w, naturalH: h }),
            ),
        },
        "Max 1000px",
      ),
    ),
    React.createElement(
      "div",
      { style: { fontSize: 9, color: "#666", marginTop: 2 } },
      "Current: ",
      art.naturalW,
      "\u00D7",
      art.naturalH,
      "px",
    ),
  );
}
function TextPropertiesPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const t = state.textItems.find((x) => x.id === state.selectedTexts?.[0]);
  if (!t) return null;
  const patch = (p) => dispatch({ type: "UPDATE_TEXT", id: t.id, patch: p });
  const linkedComponent = t.componentId
    ? state.components.find((c) => c.id === t.componentId)
    : null;
  function attachToComponent(id) {
    if (!id) {
      patch({ componentId: null, offsetX: undefined, offsetY: undefined });
      return;
    }
    const c = state.components.find((cc) => cc.id === id);
    if (!c) return;
    patch({ componentId: c.id, offsetX: t.x - c.x, offsetY: t.y - c.y });
  }
  function moveBelowLinked() {
    if (!linkedComponent) return;
    const offsetY = getFrontBottomOffset(linkedComponent) + 4;
    patch({
      x: linkedComponent.x,
      y: linkedComponent.y + offsetY,
      offsetX: 0,
      offsetY,
    });
  }
  return React.createElement(
    "div",
    { className: "section" },
    React.createElement("div", { className: "section-title" }, "Text"),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Text"),
      React.createElement("input", {
        type: "text",
        value: t.text,
        onChange: (e) => patch({ text: e.target.value }),
      }),
    ),
    React.createElement(
      "div",
      { className: "field-pair" },
      React.createElement(NumField, {
        label: "X",
        value: t.x,
        onChange: (v) => patch({ x: v }),
      }),
      React.createElement(NumField, {
        label: "Y",
        value: t.y,
        onChange: (v) => patch({ y: v }),
      }),
    ),
    React.createElement(
      "div",
      { className: "field-pair" },
      React.createElement(NumField, {
        label: "Size",
        value: t.fontSizeMm,
        min: 0.5,
        onChange: (v) => patch({ fontSizeMm: v }),
      }),
      React.createElement(NumField, {
        label: "Rotation",
        value: t.rotation,
        min: -360,
        step: 5,
        onChange: (v) => patch({ rotation: v }),
      }),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Font"),
      React.createElement(
        "select",
        {
          value: t.fontFamily || TEXT_FONT_OPTIONS[0].value,
          onChange: (e) => patch({ fontFamily: e.target.value }),
        },
        TEXT_FONT_OPTIONS.map((f) =>
          React.createElement(
            "option",
            { key: f.value, value: f.value },
            f.label,
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Align"),
      React.createElement(
        "select",
        { value: t.align, onChange: (e) => patch({ align: e.target.value }) },
        React.createElement("option", { value: "left" }, "Left"),
        React.createElement("option", { value: "center" }, "Center"),
        React.createElement("option", { value: "right" }, "Right"),
      ),
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Layer"),
      React.createElement(
        "select",
        { value: t.layer, onChange: (e) => patch({ layer: e.target.value }) },
        React.createElement("option", { value: "background" }, "Background"),
        React.createElement("option", { value: "foreground" }, "Foreground"),
      ),
    ),
    React.createElement(
      "div",
      { className: "section-title", style: { marginTop: 8, fontSize: 10 } },
      "Attachment",
    ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Attach to component"),
      React.createElement(
        "select",
        {
          value: t.componentId || "",
          onChange: (e) => attachToComponent(e.target.value),
        },
        React.createElement("option", { value: "" }, "None / free text"),
        state.components.map((c) =>
          React.createElement(
            "option",
            { key: c.id, value: c.id },
            c.ref || c.label || c.name,
            " \u2014 ",
            c.label || c.name,
          ),
        ),
      ),
    ),
    linkedComponent &&
      React.createElement(
        "div",
        { className: "btn-row" },
        React.createElement(
          "button",
          {
            title:
              "Move this text below its linked component and keep it attached",
            onClick: moveBelowLinked,
          },
          "Place below component",
        ),
        React.createElement(
          "button",
          {
            title: "Detach but keep current text position",
            onClick: () =>
              patch({
                componentId: null,
                offsetX: undefined,
                offsetY: undefined,
              }),
          },
          "Detach",
        ),
      ),
    React.createElement(
      "div",
      { className: "field-row" },
      React.createElement("label", null, "Style helpers"),
      React.createElement(
        "div",
        { className: "btn-row" },
        React.createElement(
          "button",
          { onClick: () => patch({ text: t.text.toUpperCase() }) },
          "Uppercase",
        ),
        React.createElement(
          "button",
          { onClick: () => patch({ fontSizeMm: t.fontSizeMm + 0.5 }) },
          "Size +",
        ),
        React.createElement(
          "button",
          {
            onClick: () =>
              patch({ fontSizeMm: Math.max(0.5, t.fontSizeMm - 0.5) }),
          },
          "Size -",
        ),
      ),
    ),
    React.createElement(NumField, {
      label: "Opacity",
      value: t.opacity,
      step: 0.05,
      min: 0,
      onChange: (v) => patch({ opacity: Math.max(0, Math.min(1, v)) }),
    }),
    React.createElement(
      "label",
      null,
      React.createElement("input", {
        type: "checkbox",
        checked: t.visible,
        onChange: (e) => patch({ visible: e.target.checked }),
      }),
      " Visible",
    ),
    React.createElement(
      "label",
      null,
      React.createElement("input", {
        type: "checkbox",
        checked: t.locked,
        onChange: (e) => patch({ locked: e.target.checked }),
      }),
      " Locked",
    ),
    React.createElement(
      "div",
      { className: "btn-row", style: { marginTop: 8 } },
      React.createElement(
        "button",
        {
          onClick: () =>
            dispatch({
              type: "ADD_TEXT",
              item: {
                ...t,
                id: crypto.randomUUID(),
                x: t.x + 5,
                y: t.y + 5,
                componentId: null,
                offsetX: undefined,
                offsetY: undefined,
              },
            }),
        },
        "Duplicate",
      ),
      React.createElement(
        "button",
        {
          className: "danger",
          onClick: () => dispatch({ type: "DELETE_TEXT", id: t.id }),
        },
        "Delete",
      ),
    ),
  );
}
