import { POTMAP_OFF } from '../model/potmap.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const MODULE_KEYS = Object.freeze({
  'Plaits 1': 'p1', 'Plaits 2': 'p2', 'Plaits 3': 'p3',
  'Sampler 1': 's1', 'Sampler 2': 's2', 'FX': 'fx', 'Global': 'gl',
});
const moduleKey = (group) => MODULE_KEYS[group] ?? 'gl';

export function mountPotMap(root, controller) {
  const COLLAPSE_KEY = 'pentavox.studio.potmap.collapsed';
  const stored = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } };
  const ui = { layer: 0, popover: null, query: '', collapsed: stored() };
  const setCollapsed = (value) => { ui.collapsed = value; ui.popover = null; try { localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0'); } catch { /* the choice just is not remembered */ } render(); };
  const destinations = controller.destinations;

  function picker(cell, view) {
    const key = `${cell.layer}.${cell.page}.${cell.pot}`;
    const entry = destinations.byId(cell.destId);
    const wrap = element('div', 'pm-picker');
    const button = element('button', 'pm-dest'); button.type = 'button'; button.disabled = view.readOnly;
    button.dataset.mod = moduleKey(entry?.group);
    if (cell.assigned) button.append(element('span', 'mod-dot'), element('span', 'pm-dest-group', cell.group), element('strong', '', cell.title));
    else {
      button.append(element('strong', '', cell.title));
      if (cell.isDefault) button.append(element('span', 'pm-default-tag', 'default'));
    }
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', String(ui.popover === key));
    button.addEventListener('click', (event) => {
      event.stopPropagation(); ui.popover = ui.popover === key ? null : key; ui.query = ''; render();
    });
    wrap.append(button);
    if (ui.popover !== key) return wrap;

    const pop = element('div', 'dest-pop pm-pop'); pop.addEventListener('click', (event) => event.stopPropagation());
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search destinations'; search.value = ui.query; search.setAttribute('aria-label', 'Search destinations');
    const list = element('div', 'dest-list'); list.setAttribute('role', 'listbox');
    const choose = (destId) => { ui.popover = null; controller.updatePotMap(cell.layer, cell.page, cell.pot, destId); };
    const fill = () => {
      list.replaceChildren();
      const q = ui.query.trim().toLocaleLowerCase('en');
      if (!q || 'built-in default'.includes(q)) {
        const choice = element('button', `dest-item pm-default${cell.destId === 0 ? ' current' : ''}`, cell.builtIn !== '\u2014' ? `Built-in: ${cell.builtIn}` : 'Built-in (default)');
        choice.type = 'button'; choice.addEventListener('click', () => choose(0)); list.append(choice);
      }
      if (!q || 'not assigned none off'.includes(q)) {
        const choice = element('button', `dest-item pm-default${cell.off ? ' current' : ''}`, 'Not assigned (pot does nothing here)');
        choice.type = 'button'; choice.addEventListener('click', () => choose(POTMAP_OFF)); list.append(choice);
      }
      for (const group of controller.destinationGroups()) {
        const items = group.items.filter((item) => item.id !== 0 && item.id !== POTMAP_OFF && item.id < (controller.session.potMap.field(cell.layer, cell.page, cell.pot).zones ?? POTMAP_OFF + 1) && (!q || `${group.group} ${item.name}`.toLocaleLowerCase('en').includes(q)));
        if (!items.length) continue;
        const head = element('div', 'dest-head'); head.dataset.mod = moduleKey(group.group); head.append(element('span', 'mod-dot'), element('span', '', group.group));
        list.append(head);
        for (const item of items) {
          const choice = element('button', `dest-item${item.id === cell.destId ? ' current' : ''}`, item.name);
          choice.type = 'button'; choice.dataset.mod = moduleKey(group.group); choice.addEventListener('click', () => choose(item.id)); list.append(choice);
        }
      }
      if (!list.children.length) list.append(element('p', 'dest-empty', 'Nothing found'));
    };
    search.addEventListener('input', () => { ui.query = search.value; fill(); });
    search.addEventListener('keydown', (event) => { if (event.key === 'Escape') { ui.popover = null; render(); } });
    pop.append(search, list); wrap.append(pop); fill(); queueMicrotask(() => search.focus());
    return wrap;
  }

  function render() {
    root.replaceChildren();
    root.onclick = () => { if (ui.popover !== null) { ui.popover = null; render(); } };
    const view = controller.view();
    if (view.readOnly) root.append(element('div', 'banner warning', view.reason ?? 'Read only'));
    const layers = controller.potMapView();
    if (!layers.length) { root.append(element('p', 'cv-empty', 'This module firmware has no pot map fields.')); return; }

    const toolbar = element('div', 'pm-toolbar');
    const switcher = element('div', 'segmented pm-layers'); switcher.setAttribute('role', 'tablist'); switcher.setAttribute('aria-label', 'Pot layer');
    for (const layer of layers) {
      const button = element('button', layer.layer === ui.layer ? 'active' : '', layer.label); button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(layer.layer === ui.layer));
      button.addEventListener('click', () => { ui.layer = layer.layer; ui.popover = null; render(); }); switcher.append(button);
    }
    const reset = element('button', 'quiet-button pm-reset-all', 'Reset all'); reset.type = 'button'; reset.disabled = view.readOnly;
    reset.addEventListener('click', () => controller.resetPotMapAll());
    toolbar.append(switcher, element('p', 'pm-hint', ui.layer === 0 ? 'Assignments replace the built-in function; the original parameter keeps its last value.' : 'Hold B1 to use this layer. Built-in functions are the same as normal unless noted.'), reset);
    const panel = element('section', `pm-panel${ui.collapsed ? ' collapsed' : ''}`);
    const head = element('button', 'pm-panel-head'); head.type = 'button'; head.setAttribute('aria-expanded', String(!ui.collapsed));
    head.append(element('h2', 'pm-panel-title', 'Pot map'), element('span', 'pm-panel-note', ui.collapsed ? `${layers[0].pages.flatMap((page) => page.cells).filter((cell) => cell.assigned || cell.off).length} changed from default` : ''), element('span', 'chev', ui.collapsed ? '\u2304' : '\u2303'));
    head.addEventListener('click', (event) => { event.stopPropagation(); setCollapsed(!ui.collapsed); });
    panel.append(head);
    if (ui.collapsed) { root.append(panel); return; }
    panel.append(toolbar);

    const scroll = element('div', 'pm-scroll');
    const grid = element('div', 'pm-grid');
    grid.append(element('div', 'pm-corner', 'Page'));
    for (let pot = 0; pot < 6; ++pot) grid.append(element('div', 'pm-col-head', `Pot ${pot + 1}`));
    const layer = layers[ui.layer];
    for (const page of layer.pages) {
      const rowHead = element('div', 'pm-row-head'); const modKey = /^Plaits (\d)/.test(page.label) ? `p${page.label.slice(-1)}` : /^Sampler (\d)/.test(page.label) ? `s${page.label.slice(-1)}` : /^FX/.test(page.label) ? 'fx' : 'gl'; rowHead.dataset.mod = modKey;
      rowHead.append(element('strong', '', page.label));
      const resetPage = element('button', 'pm-reset-page', '↺'); resetPage.type = 'button'; resetPage.title = `Reset ${page.label} to defaults`; resetPage.setAttribute('aria-label', `Reset ${page.label}`); resetPage.disabled = view.readOnly;
      resetPage.addEventListener('click', () => controller.resetPotMapPage(layer.layer, page.page)); rowHead.append(resetPage); grid.append(rowHead);
      for (const cell of page.cells) {
        const box = element('div', `pm-cell${cell.assigned ? ' assigned' : ''}${cell.off ? ' off' : ''}`); box.dataset.mod = modKey;
        box.append(picker(cell, view));
        if (cell.replaces) box.append(element('small', 'pm-replaces', cell.replaces));
        grid.append(box);
      }
    }
    scroll.append(grid); panel.append(scroll); root.append(panel);
  }

  const unsubscribe = controller.subscribe(render);
  render();
  return () => { unsubscribe(); root.onclick = null; root.replaceChildren(); };
}
