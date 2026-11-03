(function () {
  "use strict";

  let backdrop = null;
  let state = null; // { preset, style, overrides }

  function getActiveShape() {
    const v = state.overrides["--theme-radius"];
    if (v != null) return v;
    return (
      window.ThemeEngine.PRESETS[state.preset]?.vars["--theme-radius"] ?? "0px"
    );
  }

  function getActiveFont() {
    const v = state.overrides["--theme-font"];
    if (v != null) return v;
    return (
      window.ThemeEngine.PRESETS[state.preset]?.vars["--theme-font"] ??
      window.ThemeEngine.FONT_OPTIONS[0].value
    );
  }

  function getActiveDensity() {
    const v = state.overrides["--theme-btn-height"];
    if (v != null) return v;
    return (
      window.ThemeEngine.PRESETS[state.preset]?.vars["--theme-btn-height"] ??
      "32px"
    );
  }

  function getActiveHpGrid() {
    const v = state.overrides["--hp-grid-opacity"];
    if (v != null) return v;
    return (
      window.ThemeEngine.PRESETS[state.preset]?.vars["--hp-grid-opacity"] ??
      "0.40"
    );
  }

  function getActiveStyle() {
    if (state.style != null) return state.style;
    return window.ThemeEngine.PRESETS[state.preset]?.defaultStyle ?? "flat";
  }

  function getActiveGlow() {
    return (
      state.glow ??
      window.ThemeEngine.PRESETS[state.preset]?.defaultGlow ??
      false
    );
  }

  function applyAndSave() {
    window.ThemeEngine.save(
      state.preset,
      state.style,
      state.overrides,
      state.glow,
      state.accentHue ?? null,
    );
  }

  function buildPresetCards() {
    const grid = document.createElement("div");
    grid.className = "appearance-preset-grid";

    Object.entries(window.ThemeEngine.PRESETS).forEach(([key, preset]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "appearance-preset-btn" + (state.preset === key ? " active" : "");
      btn.dataset.presetKey = key;

      const swatch = document.createElement("div");
      swatch.className = "appearance-preset-swatch";
      swatch.style.background = preset.swatchBg;

      const accentBar = document.createElement("div");
      accentBar.className = "appearance-preset-swatch-accent";
      accentBar.style.background = preset.swatchAccent;
      swatch.appendChild(accentBar);

      const label = document.createElement("div");
      label.className = "appearance-preset-label";
      label.textContent = preset.label;

      btn.appendChild(swatch);
      btn.appendChild(label);

      btn.addEventListener("click", () => {
        state.preset = key;
        state.style = null;
        state.overrides = {};
        state.glow = window.ThemeEngine.PRESETS[key].defaultGlow ?? false;
        applyAndSave();
        refreshUI();
      });

      grid.appendChild(btn);
    });

    return grid;
  }

  function buildSegControl(options, getValue, onSelect) {
    const seg = document.createElement("div");
    seg.className = "appearance-seg";

    options.forEach(({ label, value }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.className = getValue() === value ? "active" : "";
      btn.addEventListener("click", () => {
        onSelect(value);
        applyAndSave();
        refreshUI();
      });
      seg.appendChild(btn);
    });

    return seg;
  }

  function buildAccentStrip() {
    const section = document.createElement("div");

    const label = document.createElement("span");
    label.className = "appearance-section-label";
    label.textContent = "Accent";
    section.appendChild(label);

    const row = document.createElement("div");
    row.className = "appearance-accent-row";

    const strip = document.createElement("div");
    strip.className = "appearance-accent-strip";

    const cursor = document.createElement("div");
    cursor.className = "appearance-accent-cursor";
    if (state.accentHue != null) {
      cursor.style.left = `${(state.accentHue / 360) * 100}%`;
    } else {
      cursor.style.display = "none";
    }
    strip.appendChild(cursor);

    function pickHue(e) {
      const rect = strip.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      state.accentHue = Math.round((x / rect.width) * 360) % 360;
      applyAndSave();
      refreshUI();
    }

    strip.addEventListener("mousedown", (e) => {
      e.preventDefault();
      pickHue(e);
      const onMove = (ev) => pickHue(ev);
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });

    const defaultBtn = document.createElement("button");
    defaultBtn.type = "button";
    defaultBtn.className =
      "toolbar-menu-trigger" + (state.accentHue == null ? " active" : "");
    defaultBtn.style.cssText =
      "font-size:11px;min-height:unset;padding:3px 8px";
    defaultBtn.textContent = "Default";
    defaultBtn.addEventListener("click", () => {
      state.accentHue = null;
      applyAndSave();
      refreshUI();
    });

    row.appendChild(strip);
    row.appendChild(defaultBtn);
    section.appendChild(row);

    return section;
  }

  function buildBody() {
    const body = document.createElement("div");
    body.className = "appearance-modal-body";

    // Presets section
    const presetsSection = document.createElement("div");
    const presetsLabel = document.createElement("span");
    presetsLabel.className = "appearance-section-label";
    presetsLabel.textContent = "Preset";
    presetsSection.appendChild(presetsLabel);
    presetsSection.appendChild(buildPresetCards());
    body.appendChild(presetsSection);

    // Accent
    body.appendChild(buildAccentStrip());

    // Shape
    const shapeSection = document.createElement("div");
    const shapeLabel = document.createElement("span");
    shapeLabel.className = "appearance-section-label";
    shapeLabel.textContent = "Shape";
    shapeSection.appendChild(shapeLabel);
    shapeSection.appendChild(
      buildSegControl(window.ThemeEngine.SHAPE_OPTIONS, getActiveShape, (v) => {
        state.overrides["--theme-radius"] = v;
      }),
    );
    body.appendChild(shapeSection);

    // Font
    const fontSection = document.createElement("div");
    const fontLabel = document.createElement("span");
    fontLabel.className = "appearance-section-label";
    fontLabel.textContent = "Font";
    fontSection.appendChild(fontLabel);
    fontSection.appendChild(
      buildSegControl(window.ThemeEngine.FONT_OPTIONS, getActiveFont, (v) => {
        state.overrides["--theme-font"] = v;
      }),
    );
    body.appendChild(fontSection);

    // Density
    const densitySection = document.createElement("div");
    const densityLabel = document.createElement("span");
    densityLabel.className = "appearance-section-label";
    densityLabel.textContent = "Density";
    densitySection.appendChild(densityLabel);
    densitySection.appendChild(
      buildSegControl(
        window.ThemeEngine.DENSITY_OPTIONS,
        getActiveDensity,
        (v) => {
          state.overrides["--theme-btn-height"] = v;
        },
      ),
    );
    body.appendChild(densitySection);

    // Visual style
    const styleSection = document.createElement("div");
    const styleLabel = document.createElement("span");
    styleLabel.className = "appearance-section-label";
    styleLabel.textContent = "Visual Style";
    styleSection.appendChild(styleLabel);
    styleSection.appendChild(
      buildSegControl(window.ThemeEngine.STYLE_OPTIONS, getActiveStyle, (v) => {
        state.style = v;
      }),
    );
    body.appendChild(styleSection);

    // HP Grid visibility
    const hpSection = document.createElement("div");
    const hpLabel = document.createElement("span");
    hpLabel.className = "appearance-section-label";
    hpLabel.textContent = "HP Grid";
    hpSection.appendChild(hpLabel);
    hpSection.appendChild(
      buildSegControl(
        window.ThemeEngine.HPGRID_OPTIONS,
        getActiveHpGrid,
        (v) => {
          state.overrides["--hp-grid-opacity"] = v;
        },
      ),
    );
    body.appendChild(hpSection);

    // View Contrast
    const contrastSection = document.createElement("div");
    const contrastLabel = document.createElement("span");
    contrastLabel.className = "appearance-section-label";
    contrastLabel.textContent = "View Contrast";
    contrastSection.appendChild(contrastLabel);
    contrastSection.appendChild(
      buildSegControl(
        [
          { label: "Off", value: 0 },
          { label: "Soft", value: 0.2 },
          { label: "Medium", value: 0.45 },
          { label: "Light", value: 0.7 },
        ],
        () => {
          const v = window.ViewContrast ? window.ViewContrast.read() : 0;
          const closest = [0, 0.2, 0.45, 0.7].reduce((a, b) =>
            Math.abs(b - v) < Math.abs(a - v) ? b : a,
          );
          return closest;
        },
        (v) => {
          if (window.ViewContrast) window.ViewContrast.save(v);
        },
      ),
    );
    body.appendChild(contrastSection);

    // Glow Effects — available on all presets
    const glowSection = document.createElement("div");
    const glowLabel = document.createElement("span");
    glowLabel.className = "appearance-section-label";
    glowLabel.textContent = "Glow Effects";
    glowSection.appendChild(glowLabel);
    glowSection.appendChild(
      buildSegControl(
        [
          { label: "Off", value: false },
          { label: "On", value: true },
        ],
        getActiveGlow,
        (v) => {
          state.glow = v;
        },
      ),
    );
    body.appendChild(glowSection);

    return body;
  }

  function refreshUI() {
    if (!backdrop) return;
    const oldBody = backdrop.querySelector(".appearance-modal-body");
    if (oldBody) oldBody.replaceWith(buildBody());
  }

  function ensureBackdrop() {
    if (backdrop) return backdrop;

    backdrop = document.createElement("div");
    backdrop.className = "appearance-modal-backdrop";
    backdrop.style.display = "none";

    const card = document.createElement("div");
    card.className = "appearance-modal-card";

    // Header
    const header = document.createElement("div");
    header.className = "appearance-modal-header";

    const title = document.createElement("div");
    title.className = "appearance-modal-title";
    title.textContent = "Appearance";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "toolbar-menu-trigger";
    closeBtn.style.cssText = "padding:4px 8px;font-size:16px;min-height:unset";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", close);

    header.appendChild(title);
    header.appendChild(closeBtn);
    card.appendChild(header);
    card.appendChild(buildBody());

    // Footer
    const footer = document.createElement("div");
    footer.className = "appearance-modal-footer";
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "toolbar-menu-trigger";
    resetBtn.style.cssText = "font-size:11px;color:#928b7d;min-height:unset";
    resetBtn.textContent = "Reset to default";
    resetBtn.addEventListener("click", () => {
      window.ThemeEngine.reset();
      state = window.ThemeEngine.load();
      refreshUI();
    });
    footer.appendChild(resetBtn);
    card.appendChild(footer);

    backdrop.appendChild(card);

    backdrop.addEventListener("pointerdown", (e) => {
      if (!card.contains(e.target)) close();
    });

    document.body.appendChild(backdrop);
    return backdrop;
  }

  function open() {
    state = window.ThemeEngine.load();
    const b = ensureBackdrop();
    const oldBody = b.querySelector(".appearance-modal-body");
    if (oldBody) oldBody.replaceWith(buildBody());
    b.style.display = "";
  }

  function close() {
    if (backdrop) backdrop.style.display = "none";
  }

  window.AppearanceModal = { open, close };
})();
