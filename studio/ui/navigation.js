const TABS = new Set(['palette', 'dx7', 'wavetable', 'terrain', 'sampler', 'presets', 'routing', 'midi', 'locks', 'panel', 'settings', 'manual']);

export function parseRoute(hash = '') {
  const [name, ...parts] = String(hash).replace(/^#/, '').split('/');
  const tab = name === 'engines' ? 'palette' : name;
  if (tab === 'panel' && parts[0] === 'settings') return { tab: 'settings', section: '' };
  return { tab: TABS.has(tab) ? tab : 'palette', section: TABS.has(tab) ? parts.join('/') : '' };
}

export function routeHash(tab, section = '') {
  const valid = TABS.has(tab) ? tab : 'palette';
  return `#${valid === 'palette' ? 'engines' : valid}${section ? `/${section}` : ''}`;
}

/** Hash routes keep navigation useful on GitHub Pages, including Back and reload. */
export function mountNavigation({ links, panels, onChange, window = globalThis.window }) {
  function render() {
    const route = parseRoute(window.location.hash);
    for (const link of links) {
      const active = link.dataset.tab === route.tab;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
    for (const panel of panels) panel.hidden = panel.id !== `${route.tab}-tab`;
    onChange(route);
  }
  function navigate(tab, section = '', { replace = false } = {}) {
    const hash = routeHash(tab, section);
    if (window.location.hash === hash) { render(); return; }
    if (replace) { window.history.replaceState(null, '', hash); render(); }
    else window.location.hash = hash;
  }
  const handlers = [...links].map(link => {
    const handler = event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
      event.preventDefault(); navigate(link.dataset.tab);
    };
    link.addEventListener('click', handler);
    return [link, handler];
  });
  window.addEventListener('hashchange', render);
  return { navigate, render, dispose() { window.removeEventListener('hashchange', render); for (const [link, handler] of handlers) link.removeEventListener('click', handler); } };
}
