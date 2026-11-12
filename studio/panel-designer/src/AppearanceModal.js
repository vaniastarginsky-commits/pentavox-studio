(function () {
  "use strict";

  let backdrop = null;
  let state = null; // { preset, style, overrides }
  // The accent gesture in progress, if any. Only one strip is in the modal at a time, so the gesture lives next to the
  // state it writes; that lets open() finish a held drag before it throws that state away (review finding on P0 BUG 1).
  let dragPointer = null;
  let hueBeforeDrag = null;

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

  // P0 BUG 1: the drag used to call refreshUI(), which replaced this very strip. The move handler kept reading the detached
  // node, whose getBoundingClientRect() is all zeroes, so 0/0 turned accentHue into NaN and the accent jumped to the preset
  // default instead of following the pointer. The strip now lives for the whole gesture: a drag previews the hue through
  // ThemeEngine.apply() and moves only the cursor, and the change is written once, when the pointer is released.
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
    // A touch drag inside a scrollable card would otherwise scroll the modal instead of picking a hue.
    strip.style.touchAction = "none";

    const cursor = document.createElement("div");
    cursor.className = "appearance-accent-cursor";
    strip.appendChild(cursor);

    const defaultBtn = document.createElement("button");
    defaultBtn.type = "button";
    defaultBtn.style.cssText =
      "font-size:11px;min-height:unset;padding:3px 8px";
    defaultBtn.textContent = "Default";

    // A detached or hidden strip reports a zero-width rect; that must never reach the hue as 0/0.
    function hueAt(clientX) {
      const rect = strip.getBoundingClientRect();
      if (!rect || !Number.isFinite(rect.width) || rect.width <= 0) return null;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const hue = Math.round((x / rect.width) * 360) % 360;
      if (!Number.isFinite(hue)) return null;
      return (hue + 360) % 360;
    }

    function syncControls() {
      if (state.accentHue == null) {
        cursor.style.display = "none";
      } else {
        cursor.style.display = "";
        cursor.style.left = `${(state.accentHue / 360) * 100}%`;
      }
      defaultBtn.className =
        "toolbar-menu-trigger" + (state.accentHue == null ? " active" : "");
    }
    syncControls();

    // Live feedback only: no localStorage write, no iframe sync and no rebuild of the body while the pointer is down.
    function preview(hue) {
      state.accentHue = hue;
      window.ThemeEngine.apply(
        state.preset,
        state.style,
        state.overrides,
        state.glow,
        hue,
      );
      syncControls();
    }

    strip.addEventListener("pointerdown", (e) => {
      if (dragPointer !== null) return; // a second finger must not hijack the gesture
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const hue = hueAt(e.clientX);
      if (hue === null) return; // nothing measurable: do not start a gesture that can only produce NaN
      e.preventDefault();
      hueBeforeDrag = state.accentHue;
      dragPointer = e.pointerId;
      try {
        strip.setPointerCapture(e.pointerId);
      } catch {
        // Capture only keeps the moves coming after the pointer leaves the strip; the handlers below still end the gesture.
      }
      preview(hue);
    });

    strip.addEventListener("pointermove", (e) => {
      if (dragPointer !== e.pointerId) return;
      const hue = hueAt(e.clientX);
      if (hue !== null) preview(hue); // a rect that disappeared mid-gesture keeps the last valid hue
    });

    function endDrag(e, commit) {
      if (dragPointer === null || e.pointerId !== dragPointer) return;
      const id = dragPointer;
      dragPointer = null;
      // Release before anything replaces the body: a capture outliving its node is where this bug started.
      try {
        if (strip.hasPointerCapture?.(id)) strip.releasePointerCapture(id);
      } catch {
        // The node may already be gone.
      }
      if (commit) applyAndSave(); // one write and one cross-UI sync, at the end of the gesture
      else preview(hueBeforeDrag); // cancelled: back to what it was, nothing saved
    }

    strip.addEventListener("pointerup", (e) => endDrag(e, true));
    strip.addEventListener("pointercancel", (e) => endDrag(e, false));
    // Capture can also end because another control rebuilt the body; the hue picked so far still stands, so it is a finish, not a cancel.
    strip.addEventListener("lostpointercapture", (e) => {
      if (dragPointer === e.pointerId) endDrag(e, true);
    });

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
    // A drag still held must be finished against the state it started from: load() below replaces that object, and saving
    // afterwards would store the hue under settings the pointer never saw.
    if (dragPointer !== null) { dragPointer = null; applyAndSave(); }
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
