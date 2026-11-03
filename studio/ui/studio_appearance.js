// Studio uses the Panel Designer's actual ThemeEngine and AppearanceModal frontend.
const KEY = 'pentavox.studio.appearance';
const CONTRAST_KEY = 'pentavox.studio.viewContrast';
const DESIGNER_CONTRAST_KEY = 'panel-designer:viewContrast';
const MAPPED = ['--bg','--surface','--surface-2','--text','--muted','--line','--accent','--accent-strong','--accent-ink','--accent-soft','--tile','--tile-hover','--studio-font','--studio-radius','--studio-density'];

export function mountStudioAppearance(host, frame) {
  const samples = document.querySelector('.slice-lab-frame');
  const engine = window.ThemeEngine;
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(KEY) ? engine.load() : null; } catch { return null; } };
  const readContrast = () => { try { return localStorage.getItem(CONTRAST_KEY) || '0'; } catch { return '0'; } };
  function syncSamples() {
    try {
      const doc = samples?.contentDocument; if (!doc) return;
      let style = doc.getElementById('studio-global-appearance');
      if (!style) { style = doc.createElement('link'); style.id = 'studio-global-appearance'; style.rel = 'stylesheet'; style.href = new URL('../samples_appearance.css', import.meta.url).href; doc.head.append(style); }
      const target = doc.documentElement;
      const keys = [...MAPPED, '--border', '--top', '--panel', '--panel-hi', '--teal'];
      for (const key of keys) target.style.removeProperty(key);
      const computed = getComputedStyle(root);
      // Samples is a separate application with a dark-coded default stylesheet. Always bridge
      // the active Studio palette, including Studio default/system mode, not only custom presets.
      target.dataset.studioAppearance = 'custom';
      target.dataset.theme = root.dataset.theme || (computed.colorScheme === 'dark' ? 'dark' : 'light');
      target.style.colorScheme = target.dataset.theme;
      for (const key of MAPPED) {
        const value = root.style.getPropertyValue(key) || computed.getPropertyValue(key).trim();
        if (value) target.style.setProperty(key, value);
      }
      for (const [key, source] of Object.entries({'--border':'--line','--top':'--surface','--panel':'--surface','--panel-hi':'--surface-2','--teal':'--accent'})) {
        const value = root.style.getPropertyValue(source) || computed.getPropertyValue(source).trim();
        if (value) target.style.setProperty(key, value);
      }
    } catch { /* only same-origin embedded workspaces are themed */ }
  }
  function apply(state) {
    for (const key of MAPPED) root.style.removeProperty(key);
    if (!state) {
      delete root.dataset.studioAppearance; delete root.dataset.studioSurfaceStyle;
      try { const theme = localStorage.getItem('pentavox.studio.theme'); if (theme) root.dataset.theme = theme; else delete root.dataset.theme; } catch { delete root.dataset.theme; }
      syncSamples(); return;
    }
    engine.apply(state.preset, state.style, state.overrides, state.glow, state.accentHue);
    const css = getComputedStyle(root); const v = key => css.getPropertyValue(key).trim();
    const bg = v('--ui-bg'), text = v('--ui-text'), accent = v('--ui-gold');
    const probe = document.createElement('canvas').getContext('2d');
    const luminance = color => { probe.fillStyle = '#000'; probe.fillStyle = color; const m = /^#([0-9a-f]{6})$/i.exec(probe.fillStyle); if (!m) return .5; const n = parseInt(m[1],16); const c = [n >> 16,(n >> 8)&255,n&255].map(x => { x /= 255; return x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4; }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
    root.dataset.theme = luminance(bg) > .35 ? 'light' : 'dark'; root.dataset.studioAppearance = 'custom';
    root.dataset.studioSurfaceStyle = state.style || engine.PRESETS[state.preset].defaultStyle || 'flat';
    const map = {'--bg':bg,'--surface':v('--ui-panel'),'--surface-2':v('--ui-surface'),'--text':text,'--muted':v('--ui-text-soft'),'--line':`rgba(${v('--ui-line-rgb')}, .35)`,'--accent':accent,'--accent-strong':accent,'--accent-ink':luminance(accent) > .35 ? '#111' : '#fff','--accent-soft':`rgba(${v('--ui-gold-rgb')}, .18)`,'--tile':v('--ui-surface'),'--tile-hover':v('--ui-surface-hover'),'--studio-font':state.overrides['--theme-font'] || v('--theme-font'),'--studio-radius':state.overrides['--theme-radius'] || v('--theme-radius'),'--studio-density':state.overrides['--theme-btn-height'] || v('--theme-btn-height')};
    for (const [key,value] of Object.entries(map)) root.style.setProperty(key,value);
    syncSamples();
  }
  function syncFrame(state) {
    try { const child = frame.contentWindow?.ThemeEngine; if (child && state) child.apply(state.preset,state.style,state.overrides,state.glow,state.accentHue); } catch { /* a navigated frame may be cross-origin */ }
  }
  function syncContrast(value) {
    const normalized = String(Math.max(0, Math.min(1, Number(value) || 0)));
    try { localStorage.setItem(CONTRAST_KEY, normalized); localStorage.setItem(DESIGNER_CONTRAST_KEY, normalized); } catch {}
  }
  // AppearanceModal delegates View Contrast to this Studio-scoped bridge.
  window.ViewContrast = { read: () => Number(readContrast()), save: syncContrast };
  // Extend the original modal with a Studio-specific reset without forking its controls.
  const openDesignerAppearance = window.AppearanceModal.open.bind(window.AppearanceModal);
  window.AppearanceModal.open = () => {
    const result = openDesignerAppearance();
    const footer = document.querySelector('.appearance-modal-footer');
    if (footer && !footer.querySelector('.studio-default-appearance')) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'studio-default-appearance';
      button.textContent = 'Studio default'; button.title = 'Restore Studio and system appearance defaults';
      button.addEventListener('click', () => { window.AppearanceModal.close(); reset(); });
      footer.prepend(button);
    }
    return result;
  };
  // The real Designer frontend saves through ThemeEngine; reflect same-tab saves into all Studio surfaces.
  const saveTheme = engine.save.bind(engine);
  engine.save = (...args) => { saveTheme(...args); const state = engine.load(); apply(state); syncFrame(state); render(); };
  function render() {
    const state = read(); const current = state ? engine.PRESETS[state.preset] : null;
    const title = current?.label ?? 'Studio default';
    const colors = current ? `--current-bg:${current.swatchBg};--current-accent:${current.swatchAccent}` : '';
    host.innerHTML = `<section class="studio-appearance-launch"><div class="appearance-current"><span class="appearance-current-swatch" style="${colors}" aria-hidden="true"></span><div><strong>${title}</strong><small>${state ? 'Global appearance preset' : 'Use the Studio and system defaults'}</small></div></div><div class="appearance-launch-actions"><button type="button" class="primary" data-action="open">Customize appearance</button>${state ? '<button type="button" data-action="reset">Studio default</button>' : ''}</div><p class="appearance-sharing-note">Changes apply to Studio, Samples, and Panel Designer, and are saved in this browser.</p></section>`;
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch {}
    apply(null); syncFrame(engine.load()); render();
  }
  host.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    if (button.dataset.action === 'open') window.AppearanceModal?.open();
    if (button.dataset.action === 'reset') reset();
  });
  frame.addEventListener('load', () => syncFrame(read())); samples?.addEventListener('load', syncSamples);
  window.addEventListener('storage', event => {
    if (event.key === KEY) { const state = read(); if (state) apply(state); else apply(null); render(); }
    else if (event.key === DESIGNER_CONTRAST_KEY) { try { localStorage.setItem(CONTRAST_KEY,event.newValue || '0'); } catch {} }
    else if (event.key === CONTRAST_KEY) { try { localStorage.setItem(DESIGNER_CONTRAST_KEY,event.newValue || '0'); } catch {} }
  });
  apply(read()); syncContrast(readContrast()); render();
}
