(function () {
  "use strict";

  const KEY = "pentavox.studio.appearance";
  const DEFAULT_PRESET = "industrial";
  const root = document.documentElement;

  const PRESETS = {
    industrial: {
      label: "Industrial",
      swatchBg: "#020202",
      swatchAccent: "rgb(214,170,88)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#020202",
        "--ui-bg-2": "#050505",
        "--ui-panel": "#080807",
        "--ui-panel-2": "#0d0c0a",
        "--ui-surface": "#11100e",
        "--ui-surface-hover": "#15130f",
        "--ui-text": "#eee7da",
        "--ui-text-soft": "#d8d0c0",
        "--ui-muted": "#928b7d",
        "--ui-gold": "#bd8c3f",
        "--ui-gold-2": "#d6aa58",
        "--ui-gold-rgb": "214,170,88",
        "--ui-gold-alt-rgb": "201,154,74",
        "--ui-line-rgb": "215,196,155",
        "--theme-radius": "0px",
        "--theme-font": 'Inter,"SF Pro Text",system-ui,sans-serif',
        "--theme-tracking": "0.14em",
        "--theme-weight-brand": "850",
        "--theme-btn-height": "32px",
        "--theme-section-gap": "8px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.13",
        "--hp-grid-opacity": "0.40",
      },
    },
    graphite: {
      label: "Graphite",
      swatchBg: "#1a1a1a",
      swatchAccent: "rgb(232,97,42)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#1a1a1a",
        "--ui-bg-2": "#1e1e1d",
        "--ui-panel": "#222220",
        "--ui-panel-2": "#262625",
        "--ui-surface": "#2c2c2a",
        "--ui-surface-hover": "#323230",
        "--ui-text": "#e8e6df",
        "--ui-text-soft": "#cfccc2",
        "--ui-muted": "#8a8780",
        "--ui-gold": "#e8612a",
        "--ui-gold-2": "#f47a3d",
        "--ui-gold-rgb": "232,97,42",
        "--ui-gold-alt-rgb": "200,75,25",
        "--ui-line-rgb": "220,215,205",
        "--theme-radius": "2px",
        "--theme-font": 'Inter,"SF Pro Text",system-ui,sans-serif',
        "--theme-tracking": "0.06em",
        "--theme-weight-brand": "700",
        "--theme-btn-height": "30px",
        "--theme-section-gap": "10px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.10",
        "--hp-grid-opacity": "0.28",
      },
    },
    blueprint: {
      label: "Blueprint",
      swatchBg: "#0a1018",
      swatchAccent: "rgb(95,184,255)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#0a1018",
        "--ui-bg-2": "#0d1420",
        "--ui-panel": "#101a28",
        "--ui-panel-2": "#142032",
        "--ui-surface": "#16263c",
        "--ui-surface-hover": "#1c2e48",
        "--ui-text": "#e0eef5",
        "--ui-text-soft": "#b8d4e6",
        "--ui-muted": "#6a8aa6",
        "--ui-gold": "#5fb8ff",
        "--ui-gold-2": "#86cdff",
        "--ui-gold-rgb": "95,184,255",
        "--ui-gold-alt-rgb": "70,160,235",
        "--ui-line-rgb": "120,180,225",
        "--theme-radius": "0px",
        "--theme-font":
          '"JetBrains Mono","IBM Plex Mono",ui-monospace,monospace',
        "--theme-tracking": "0.08em",
        "--theme-weight-brand": "600",
        "--theme-btn-height": "30px",
        "--theme-section-gap": "8px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.22",
        "--hp-grid-opacity": "0.62",
      },
    },
    minimal: {
      label: "Minimal",
      swatchBg: "#111111",
      swatchAccent: "rgb(180,180,180)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#111111",
        "--ui-bg-2": "#0d0d0d",
        "--ui-panel": "#1a1a1a",
        "--ui-panel-2": "#222222",
        "--ui-surface": "#2a2a2a",
        "--ui-surface-hover": "#333333",
        "--ui-text": "#e0e0e0",
        "--ui-text-soft": "#cccccc",
        "--ui-muted": "#888888",
        "--ui-gold": "#b0b0b0",
        "--ui-gold-2": "#c8c8c8",
        "--ui-gold-rgb": "180,180,180",
        "--ui-gold-alt-rgb": "160,160,160",
        "--ui-line-rgb": "180,180,180",
        "--theme-radius": "3px",
        "--theme-font": 'Inter,"SF Pro Text",system-ui,sans-serif',
        "--theme-tracking": "0.08em",
        "--theme-weight-brand": "700",
        "--theme-btn-height": "30px",
        "--theme-section-gap": "6px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.13",
        "--hp-grid-opacity": "0.32",
      },
    },
    retro: {
      label: "Retro",
      swatchBg: "#050800",
      swatchAccent: "rgb(80,230,100)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#050800",
        "--ui-bg-2": "#080b00",
        "--ui-panel": "#0b0f01",
        "--ui-panel-2": "#0e1302",
        "--ui-surface": "#121802",
        "--ui-surface-hover": "#161d03",
        "--ui-text": "#c8f0a0",
        "--ui-text-soft": "#a0c880",
        "--ui-muted": "#608040",
        "--ui-gold": "#50e664",
        "--ui-gold-2": "#70f080",
        "--ui-gold-rgb": "80,230,100",
        "--ui-gold-alt-rgb": "60,200,80",
        "--ui-line-rgb": "80,200,80",
        "--theme-radius": "0px",
        "--theme-font": 'ui-monospace,"Fira Code","Cascadia Code",monospace',
        "--theme-tracking": "0.04em",
        "--theme-weight-brand": "700",
        "--theme-btn-height": "32px",
        "--theme-section-gap": "8px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.20",
        "--hp-grid-opacity": "0.55",
      },
    },
    light: {
      label: "Light",
      swatchBg: "#f2f0ec",
      swatchAccent: "rgb(160,100,30)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#f2f0ec",
        "--ui-bg-2": "#ede9e3",
        "--ui-panel": "#e8e4dc",
        "--ui-panel-2": "#e2ddd5",
        "--ui-surface": "#dddad2",
        "--ui-surface-hover": "#d8d4cc",
        "--ui-text": "#1a1916",
        "--ui-text-soft": "#3a3730",
        "--ui-muted": "#7a7368",
        "--ui-gold": "#a0641e",
        "--ui-gold-2": "#b87828",
        "--ui-gold-rgb": "160,100,30",
        "--ui-gold-alt-rgb": "140,80,20",
        "--ui-line-rgb": "80,70,55",
        "--theme-radius": "3px",
        "--theme-font": 'Inter,"SF Pro Text",system-ui,sans-serif',
        "--theme-tracking": "0.12em",
        "--theme-weight-brand": "800",
        "--theme-btn-height": "32px",
        "--theme-section-gap": "8px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.16",
        "--hp-grid-opacity": "0.38",
      },
    },
    sakura: {
      label: "Sakura",
      swatchBg: "#f9eef0",
      swatchAccent: "rgb(210,127,142)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#f9eef0",
        "--ui-bg-2": "#f3e2e5",
        "--ui-panel": "#ede0e3",
        "--ui-panel-2": "#e6d2d7",
        "--ui-surface": "#e0c6cc",
        "--ui-surface-hover": "#dbbcc3",
        "--ui-text": "#3d2a30",
        "--ui-text-soft": "#5a4147",
        "--ui-muted": "#9d7d83",
        "--ui-gold": "#d27f8e",
        "--ui-gold-2": "#e095a3",
        "--ui-gold-rgb": "210,127,142",
        "--ui-gold-alt-rgb": "188,108,124",
        "--ui-line-rgb": "120,70,80",
        "--theme-radius": "3px",
        "--theme-font": 'Inter,"SF Pro Text",system-ui,sans-serif',
        "--theme-tracking": "0.10em",
        "--theme-weight-brand": "700",
        "--theme-btn-height": "30px",
        "--theme-section-gap": "9px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.14",
        "--hp-grid-opacity": "0.32",
      },
    },
    amber: {
      label: "Amber",
      swatchBg: "#1a0d00",
      swatchAccent: "rgb(255,176,0)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#1a0d00",
        "--ui-bg-2": "#1f1102",
        "--ui-panel": "#241402",
        "--ui-panel-2": "#2c1903",
        "--ui-surface": "#341d04",
        "--ui-surface-hover": "#3c2305",
        "--ui-text": "#ffd07a",
        "--ui-text-soft": "#e6b465",
        "--ui-muted": "#8a6230",
        "--ui-gold": "#ffb000",
        "--ui-gold-2": "#ffca40",
        "--ui-gold-rgb": "255,176,0",
        "--ui-gold-alt-rgb": "220,140,0",
        "--ui-line-rgb": "220,160,60",
        "--theme-radius": "0px",
        "--theme-font":
          '"JetBrains Mono","IBM Plex Mono",ui-monospace,monospace',
        "--theme-tracking": "0.10em",
        "--theme-weight-brand": "600",
        "--theme-btn-height": "32px",
        "--theme-section-gap": "8px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.22",
        "--hp-grid-opacity": "0.55",
      },
    },
    brutalist: {
      label: "Brutalist",
      swatchBg: "#0a0a0a",
      swatchAccent: "rgb(255,77,0)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#0a0a0a",
        "--ui-bg-2": "#101010",
        "--ui-panel": "#141414",
        "--ui-panel-2": "#1a1a1a",
        "--ui-surface": "#202020",
        "--ui-surface-hover": "#262626",
        "--ui-text": "#fafafa",
        "--ui-text-soft": "#dadada",
        "--ui-muted": "#7a7a7a",
        "--ui-gold": "#ff4d00",
        "--ui-gold-2": "#ff7733",
        "--ui-gold-rgb": "255,77,0",
        "--ui-gold-alt-rgb": "220,60,0",
        "--ui-line-rgb": "255,255,255",
        "--theme-radius": "0px",
        "--theme-font": '"Helvetica Neue",Helvetica,Arial,sans-serif',
        "--theme-tracking": "0.04em",
        "--theme-weight-brand": "900",
        "--theme-btn-height": "32px",
        "--theme-section-gap": "10px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.30",
        "--hp-grid-opacity": "0.42",
      },
    },
    tape: {
      label: "Tape",
      swatchBg: "#1c130a",
      swatchAccent: "rgb(232,142,40)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#1c130a",
        "--ui-bg-2": "#22180e",
        "--ui-panel": "#281c11",
        "--ui-panel-2": "#322316",
        "--ui-surface": "#3c2b1c",
        "--ui-surface-hover": "#463222",
        "--ui-text": "#f0dab8",
        "--ui-text-soft": "#d8be95",
        "--ui-muted": "#8a7252",
        "--ui-gold": "#e88e28",
        "--ui-gold-2": "#f5a64a",
        "--ui-gold-rgb": "232,142,40",
        "--ui-gold-alt-rgb": "200,118,25",
        "--ui-line-rgb": "210,170,120",
        "--theme-radius": "2px",
        "--theme-font": '"IBM Plex Sans","Helvetica Neue",system-ui,sans-serif',
        "--theme-tracking": "0.08em",
        "--theme-weight-brand": "700",
        "--theme-btn-height": "32px",
        "--theme-section-gap": "9px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.16",
        "--hp-grid-opacity": "0.38",
      },
    },
    forest: {
      label: "Forest",
      swatchBg: "#0d1a14",
      swatchAccent: "rgb(195,160,80)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#0d1a14",
        "--ui-bg-2": "#11211a",
        "--ui-panel": "#14271f",
        "--ui-panel-2": "#1a3127",
        "--ui-surface": "#1f3b30",
        "--ui-surface-hover": "#26463a",
        "--ui-text": "#d9e8d8",
        "--ui-text-soft": "#b8ccb6",
        "--ui-muted": "#708a78",
        "--ui-gold": "#c3a050",
        "--ui-gold-2": "#d8b66a",
        "--ui-gold-rgb": "195,160,80",
        "--ui-gold-alt-rgb": "168,135,60",
        "--ui-line-rgb": "170,200,170",
        "--theme-radius": "2px",
        "--theme-font": 'Inter,"SF Pro Text",system-ui,sans-serif',
        "--theme-tracking": "0.08em",
        "--theme-weight-brand": "700",
        "--theme-btn-height": "30px",
        "--theme-section-gap": "8px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.14",
        "--hp-grid-opacity": "0.36",
      },
    },
    submarine: {
      label: "Submarine",
      swatchBg: "#04111a",
      swatchAccent: "rgb(90,255,160)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#04111a",
        "--ui-bg-2": "#061620",
        "--ui-panel": "#081d2a",
        "--ui-panel-2": "#0a2434",
        "--ui-surface": "#0d2c40",
        "--ui-surface-hover": "#10354c",
        "--ui-text": "#c8e8d8",
        "--ui-text-soft": "#9ec8b4",
        "--ui-muted": "#5e8a78",
        "--ui-gold": "#5aff9a",
        "--ui-gold-2": "#80ffb0",
        "--ui-gold-rgb": "90,255,160",
        "--ui-gold-alt-rgb": "60,210,130",
        "--ui-line-rgb": "100,200,160",
        "--theme-radius": "0px",
        "--theme-font":
          '"JetBrains Mono","IBM Plex Mono",ui-monospace,monospace',
        "--theme-tracking": "0.08em",
        "--theme-weight-brand": "600",
        "--theme-btn-height": "30px",
        "--theme-section-gap": "8px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.18",
        "--hp-grid-opacity": "0.50",
      },
    },
    solarpunk: {
      label: "Solarpunk",
      swatchBg: "#f3eedd",
      swatchAccent: "rgb(15,140,128)",
      defaultStyle: "flat",
      defaultGlow: false,
      vars: {
        "--ui-bg": "#f3eedd",
        "--ui-bg-2": "#ede7d0",
        "--ui-panel": "#e6dfc4",
        "--ui-panel-2": "#dfd6b6",
        "--ui-surface": "#d8cca8",
        "--ui-surface-hover": "#d1c39c",
        "--ui-text": "#1d2e25",
        "--ui-text-soft": "#365044",
        "--ui-muted": "#6d806e",
        "--ui-gold": "#0f8c80",
        "--ui-gold-2": "#16a89c",
        "--ui-gold-rgb": "15,140,128",
        "--ui-gold-alt-rgb": "10,108,98",
        "--ui-line-rgb": "60,100,80",
        "--theme-radius": "4px",
        "--theme-font": '"IBM Plex Sans","Helvetica Neue",system-ui,sans-serif',
        "--theme-tracking": "0.06em",
        "--theme-weight-brand": "700",
        "--theme-btn-height": "30px",
        "--theme-section-gap": "8px",
        "--theme-surface-blur": "0px",
        "--theme-surface-sat": "1",
        "--theme-border-opacity": "0.16",
        "--hp-grid-opacity": "0.30",
      },
    },
    synthwave: {
      label: "Synthwave",
      swatchBg: "#0d0220",
      swatchAccent: "rgb(255,42,144)",
      defaultStyle: "glass",
      defaultGlow: true,
      vars: {
        "--ui-bg": "#0a0118",
        "--ui-bg-2": "#0f0220",
        "--ui-panel": "#140428",
        "--ui-panel-2": "#1a0532",
        "--ui-surface": "#220642",
        "--ui-surface-hover": "#2c084e",
        "--ui-text": "#fde8ff",
        "--ui-text-soft": "#e7c4f5",
        "--ui-muted": "#9a72b5",
        "--ui-gold": "#ff2a90",
        "--ui-gold-2": "#ff5cb0",
        "--ui-gold-rgb": "255,42,144",
        "--ui-gold-alt-rgb": "0,229,255",
        "--ui-line-rgb": "180,120,220",
        "--theme-radius": "3px",
        "--theme-font": 'Inter,"SF Pro Text",system-ui,sans-serif',
        "--theme-tracking": "0.16em",
        "--theme-weight-brand": "850",
        "--theme-btn-height": "32px",
        "--theme-section-gap": "8px",
        "--theme-surface-blur": "8px",
        "--theme-surface-sat": "0.9",
        "--theme-border-opacity": "0.22",
        "--hp-grid-opacity": "0.40",
      },
    },
  };

  const SHAPE_OPTIONS = [
    { label: "Sharp", value: "0px" },
    { label: "Soft", value: "3px" },
    { label: "Rounded", value: "8px" },
    { label: "Pill", value: "20px" },
  ];

  const FONT_OPTIONS = [
    { label: "Inter", value: 'Inter,"SF Pro Text",system-ui,sans-serif' },
    {
      label: "Helvetica",
      value: '"Helvetica Neue",Helvetica,Arial,sans-serif',
    },
    {
      label: "Plex",
      value: '"IBM Plex Sans","Helvetica Neue",system-ui,sans-serif',
    },
    {
      label: "Mono",
      value:
        '"JetBrains Mono","IBM Plex Mono",ui-monospace,"Fira Code",monospace',
    },
    {
      label: "System",
      value: "system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
    },
  ];

  const HPGRID_OPTIONS = [
    { label: "Hidden", value: "0" },
    { label: "Subtle", value: "0.20" },
    { label: "Visible", value: "0.55" },
    { label: "Strong", value: "0.85" },
  ];

  const DENSITY_OPTIONS = [
    { label: "Compact", value: "28px" },
    { label: "Default", value: "32px" },
    { label: "Comfortable", value: "38px" },
  ];

  const STYLE_OPTIONS = [
    { label: "Flat", value: "flat" },
    { label: "Bordered", value: "bordered" },
    { label: "Glass", value: "glass" },
  ];

  function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [
      Math.round(f(0) * 255),
      Math.round(f(8) * 255),
      Math.round(f(4) * 255),
    ];
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw)
        return {
          preset: DEFAULT_PRESET,
          style: null,
          overrides: {},
          glow: false,
          accentHue: null,
        };
      const p = JSON.parse(raw);
      if (!p.preset || !PRESETS[p.preset])
        return {
          preset: DEFAULT_PRESET,
          style: null,
          overrides: {},
          glow: false,
          accentHue: null,
        };
      const defaultGlow = PRESETS[p.preset].defaultGlow ?? false;
      return {
        preset: p.preset,
        style: p.style || null,
        overrides: p.overrides || {},
        glow: p.glow != null ? p.glow : defaultGlow,
        accentHue: p.accentHue != null ? p.accentHue : null,
      };
    } catch {
      return {
        preset: DEFAULT_PRESET,
        style: null,
        overrides: {},
        glow: false,
        accentHue: null,
      };
    }
  }

  function apply(presetKey, style, overrides, glow, accentHue) {
    const preset = PRESETS[presetKey] || PRESETS[DEFAULT_PRESET];
    const resolvedStyle = style || preset.defaultStyle || "flat";
    const resolvedGlow = glow != null ? glow : (preset.defaultGlow ?? false);

    const merged = Object.assign({}, preset.vars, overrides);

    if (resolvedStyle === "bordered") {
      const base = Number(merged["--theme-border-opacity"] || 0.13);
      merged["--ui-line"] =
        "rgba(var(--ui-line-rgb)," + (base * 2).toFixed(2) + ")";
      merged["--ui-line-soft"] =
        "rgba(var(--ui-line-rgb)," + (base * 1.4).toFixed(2) + ")";
      merged["--ui-line-strong"] =
        "rgba(var(--ui-line-rgb)," + (base * 3).toFixed(2) + ")";
    }

    if (accentHue != null) {
      const isLight = presetKey === "light";
      const [s1, l1] = isLight ? [60, 38] : [78, 58];
      const [s2, l2] = isLight ? [65, 48] : [83, 67];
      const [s3, l3] = isLight ? [50, 28] : [68, 45];
      const [r, g, b] = hslToRgb(accentHue, s1, l1);
      const [r2, g2, b2] = hslToRgb(accentHue, s2, l2);
      const [ra, ga, ba] = hslToRgb(accentHue, s3, l3);
      merged["--ui-gold"] = `rgb(${r},${g},${b})`;
      merged["--ui-gold-2"] = `rgb(${r2},${g2},${b2})`;
      merged["--ui-gold-rgb"] = `${r},${g},${b}`;
      merged["--ui-gold-alt-rgb"] = `${ra},${ga},${ba}`;
    }

    const goldRgb = merged["--ui-gold-rgb"];
    if (goldRgb) {
      merged["--ui-gold-soft"] = `rgba(${goldRgb},.13)`;
    }

    for (const [k, v] of Object.entries(merged)) {
      root.style.setProperty(k, v);
    }

    root.dataset.style = resolvedStyle;
    root.dataset.preset = presetKey;
    root.dataset.glow = resolvedGlow ? "on" : "off";
  }

  function save(presetKey, style, overrides, glow, accentHue) {
    apply(presetKey, style, overrides, glow, accentHue);
    localStorage.setItem(
      KEY,
      JSON.stringify({ preset: presetKey, style, overrides, glow, accentHue }),
    );
  }

  function reset() {
    save(DEFAULT_PRESET, null, {}, false, null);
  }

  window.ThemeEngine = {
    PRESETS,
    SHAPE_OPTIONS,
    FONT_OPTIONS,
    DENSITY_OPTIONS,
    STYLE_OPTIONS,
    HPGRID_OPTIONS,
    DEFAULT_PRESET,
    load,
    apply,
    save,
    reset,
  };

  window.addEventListener("panel-designer:open-appearance", () => {
    window.AppearanceModal?.open();
  });
  // Settings changed in another Studio tab/window: keep the designer in sync.
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    const next = load();
    apply(next.preset, next.style, next.overrides, next.glow, next.accentHue);
  });

  const initial = load();
  apply(
    initial.preset,
    initial.style,
    initial.overrides,
    initial.glow,
    initial.accentHue,
  );
})();
