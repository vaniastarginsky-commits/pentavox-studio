// Desktop view contrast control. Keeps the visual tone preference outside app state.
(function () {
  "use strict";

  const KEY = "panel-designer:viewContrast";
  const root = document.documentElement;
  let panel = null;
  let button = null;

  function clamp(value) {
    return Math.max(0, Math.min(1, value));
  }

  function read() {
    const value = parseFloat(localStorage.getItem(KEY));
    return Number.isFinite(value) ? clamp(value) : 0;
  }

  function apply(value) {
    const contrast = clamp(value);
    const bright = 1 + contrast * 0.42;
    const flat = 1 - contrast * 0.42;
    root.style.setProperty("--pd-contrast", String(contrast));
    root.style.setProperty(
      "--pd-filter",
      `brightness(${bright.toFixed(3)}) contrast(${flat.toFixed(3)})`,
    );
    root.classList.toggle("pd-contrast-on", contrast > 0.001);
    if (button) button.classList.toggle("active", contrast > 0.001);
    const range = panel?.querySelector(".view-contrast-range");
    if (range) range.value = String(Math.round(contrast * 100));
  }

  function save(value) {
    const contrast = clamp(value);
    localStorage.setItem(KEY, String(contrast));
    apply(contrast);
  }

  function syncRailPosition() {
    const app = document.querySelector(".app");
    const leftClosed = app?.classList.contains("left-panel-closed");
    const compact = window.innerWidth <= 1120;
    root.style.setProperty(
      "--pd-rail-left",
      leftClosed ? (compact ? "8px" : "10px") : compact ? "292px" : "300px",
    );
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "view-contrast-panel";
    panel.hidden = true;
    panel.innerHTML = [
      '<div class="view-contrast-title">View contrast</div>',
      '<div class="view-contrast-row">',
      "<span>Dark</span>",
      '<input class="view-contrast-range" type="range" min="0" max="100" step="1" aria-label="View contrast">',
      "<span>Gray</span>",
      "</div>",
      '<div class="view-contrast-presets">',
      '<button type="button" data-value="0">Off</button>',
      '<button type="button" data-value="0.2">Soft</button>',
      '<button type="button" data-value="0.45">Medium</button>',
      '<button type="button" data-value="0.7">Light</button>',
      "</div>",
    ].join("");
    document.body.appendChild(panel);

    const range = panel.querySelector(".view-contrast-range");
    range.value = String(Math.round(read() * 100));
    range.addEventListener("input", (event) =>
      save(Number(event.target.value) / 100),
    );
    panel.querySelectorAll("[data-value]").forEach((preset) => {
      preset.addEventListener("click", () => {
        const value = Number(preset.dataset.value);
        range.value = String(Math.round(value * 100));
        save(value);
      });
    });

    document.addEventListener(
      "pointerdown",
      (event) => {
        if (panel.hidden) return;
        if (
          panel.contains(event.target) ||
          button?.contains(event.target) ||
          event.target.closest?.(".canvas-tool-rail")
        )
          return;
        panel.hidden = true;
      },
      true,
    );

    return panel;
  }

  function togglePanel() {
    syncRailPosition();
    const p = ensurePanel();
    p.hidden = !p.hidden;
  }

  function boot() {
    apply(read());
    if (!document.querySelector(".workspace")) {
      window.setTimeout(boot, 120);
      return;
    }
    ensurePanel();
    window.addEventListener("panel-designer:toggle-view-contrast", togglePanel);
    syncRailPosition();
    const observer = new MutationObserver(syncRailPosition);
    const app = document.querySelector(".app");
    if (app)
      observer.observe(app, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", syncRailPosition, { passive: true });
  }

  window.ViewContrast = { read, save };
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    const next = parseFloat(event.newValue);
    apply(Number.isFinite(next) ? clamp(next) : 0);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
