import { placePopover } from './popover_place.js';
import { POTMAP_OFF } from '../model/potmap.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const MODULE_KEYS = Object.freeze({
  'Plaits 1': 'p1', 'Plaits 2': 'p2', 'Plaits 3': 'p3',
  'Sampler 1': 's1', 'Sampler 2': 's2', 'Looper': 's1', 'FX': 'fx', 'Global': 'gl',
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
    const wrap = element('div', 'cc-pcwrap');
    const button = element('button', `cc-pcell${cell.assigned ? ' assigned' : ''}${cell.off ? ' off' : ''}`); button.type = 'button'; button.disabled = view.readOnly;
    button.dataset.mod = moduleKey(entry?.group);
    if (cell.assigned) {
      const top = element('span', 'cc-pctop'); top.append(element('span', 'cc-ddot'), element('small', '', cell.group));
      button.append(top, element('b', '', cell.title));
    } else {
      button.append(element('b', cell.off ? 'cc-muted' : '', cell.title));
      if (cell.isDefault) button.append(element('small', 'cc-def', 'default'));
    }
    if (cell.replaces) button.append(element('small', 'cc-rep', cell.replaces));
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', String(ui.popover === key));
    button.setAttribute('aria-label', `${cell.pageLabel} pot ${cell.pot + 1}: ${cell.assigned ? `${cell.group} ${cell.title}` : cell.off ? 'not assigned' : cell.title}`);
    button.addEventListener('click', (event) => {
      event.stopPropagation(); ui.popover = ui.popover === key ? null : key; ui.query = ''; render();
    });
    wrap.append(button);
    if (ui.popover !== key) return wrap;

    const pop = element('div', 'cc-pop'); pop.addEventListener('click', (event) => event.stopPropagation());
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search destinations'; search.value = ui.query; search.setAttribute('aria-label', 'Search destinations');
    const list = element('div', 'cc-poplist'); list.setAttribute('role', 'listbox');
    const choose = (destId) => { ui.popover = null; controller.updatePotMap(cell.layer, cell.page, cell.pot, destId); };
    const fill = () => {
      list.replaceChildren();
      const q = ui.query.trim().toLocaleLowerCase('en');
      if (!q || 'built-in default'.includes(q)) {
        const choice = element('button', `cc-pi extra${cell.destId === 0 ? ' cur' : ''}`, cell.builtIn !== '—' ? `Built-in: ${cell.builtIn}` : 'Built-in (default)');
        choice.type = 'button'; choice.addEventListener('click', () => choose(0)); list.append(choice);
      }
      if (!q || 'not assigned none off'.includes(q)) {
        const choice = element('button', `cc-pi extra${cell.off ? ' cur' : ''}`, 'Not assigned (pot does nothing here)');
        choice.type = 'button'; choice.addEventListener('click', () => choose(POTMAP_OFF)); list.append(choice);
      }
      for (const group of controller.destinationGroups()) {
        const items = group.items.filter((item) => item.id !== 0 && item.id !== POTMAP_OFF && item.id < (controller.session.potMap.field(cell.layer, cell.page, cell.pot).zones ?? POTMAP_OFF + 1) && (!q || `${group.group} ${item.name}`.toLocaleLowerCase('en').includes(q)));
        if (!items.length) continue;
        const head = element('h6', ''); head.dataset.mod = moduleKey(group.group); head.append(element('span', 'cc-ddot'), group.group);
        list.append(head);
        for (const item of items) {
          const choice = element('button', `cc-pi${item.id === cell.destId ? ' cur' : ''}`, item.name);
          choice.type = 'button'; choice.dataset.mod = moduleKey(group.group); choice.addEventListener('click', () => choose(item.id)); list.append(choice);
        }
      }
      if (!list.children.length) list.append(element('p', 'cc-nf', 'Nothing found'));
    };
    search.addEventListener('input', () => { ui.query = search.value; fill(); });
    search.addEventListener('keydown', (event) => { if (event.key === 'Escape') { ui.popover = null; render(); } });
    pop.append(search, list); wrap.append(pop); fill(); queueMicrotask(() => { placePopover(button, pop); search.focus(); });
    return wrap;
  }

  function render() {
    root.replaceChildren();
    root.classList.add('cc-page');
    root.onclick = () => { if (ui.popover !== null) { ui.popover = null; render(); } };
    const view = controller.view();
    if (view.readOnly) root.append(element('div', 'banner warning', view.reason ?? 'Read only'));
    const layers = controller.potMapView();
    if (!layers.length) { root.append(element('p', 'cc-muted', 'This module firmware has no pot map fields.')); return; }

    const panel = element('section', `cc-card cc-pm${ui.collapsed ? ' collapsed' : ''}`);
    const head = element('button', 'cc-pmhead'); head.type = 'button'; head.setAttribute('aria-expanded', String(!ui.collapsed));
    const changed = layers[0].pages.flatMap((page) => page.cells).filter((cell) => cell.assigned || cell.off).length;
    head.append(element('h3', '', 'Pot map'), element('small', '', ui.collapsed ? `${changed} changed from default` : 'Replace what a knob does on a page'), element('span', 'cc-sp'), element('span', 'cc-chev', ui.collapsed ? '⌄' : '⌃'));
    head.addEventListener('click', (event) => { event.stopPropagation(); setCollapsed(!ui.collapsed); });
    panel.append(head);
    if (ui.collapsed) { root.append(panel); return; }

    const body = element('div', 'cc-body');
    const bar = element('div', 'cc-pmbar');
    const switcher = element('div', 'cc-seg'); switcher.setAttribute('role', 'tablist'); switcher.setAttribute('aria-label', 'Pot layer');
    for (const layer of layers) {
      const button = element('button', layer.layer === ui.layer ? 'active' : '', layer.label); button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(layer.layer === ui.layer));
      button.setAttribute('aria-pressed', String(layer.layer === ui.layer));
      button.addEventListener('click', () => { ui.layer = layer.layer; ui.popover = null; render(); }); switcher.append(button);
    }
    const reset = element('button', 'cc-quiet', 'Reset all'); reset.type = 'button'; reset.disabled = view.readOnly;
    reset.addEventListener('click', () => controller.resetPotMapAll());
    bar.append(switcher, element('span', 'cc-sp'), reset);
    body.append(bar, element('p', 'cc-hint', ui.layer === 0 ? 'Assignments replace the built-in function; the original parameter keeps its last value.' : 'Hold B1 to use this layer. Built-in functions are the same as normal unless noted.'));

    const scroll = element('div', 'cc-pmwrap');
    const grid = element('div', 'cc-pmgrid');
    grid.append(element('div', 'cc-ph', 'Page'));
    for (let pot = 0; pot < 6; ++pot) grid.append(element('div', 'cc-ph', `Pot ${pot + 1}`));
    const layer = layers[ui.layer];
    for (const page of layer.pages) {
      const modKey = /^Plaits (\d)/.test(page.label) ? `p${page.label.slice(-1)}` : /^Sampler (\d)/.test(page.label) ? `s${page.label.slice(-1)}` : /^FX/.test(page.label) ? 'fx' : 'gl';
      const rowHead = element('div', 'cc-prow'); rowHead.dataset.mod = modKey;
      rowHead.append(element('span', '', page.label));
      const resetPage = element('button', 'cc-quiet', '↺'); resetPage.type = 'button'; resetPage.title = `Reset ${page.label} to defaults`; resetPage.setAttribute('aria-label', `Reset ${page.label}`); resetPage.disabled = view.readOnly;
      resetPage.addEventListener('click', () => controller.resetPotMapPage(layer.layer, page.page)); rowHead.append(resetPage); grid.append(rowHead);
      for (const cell of page.cells) {
        const box = picker({ ...cell, pageLabel: page.label }, view); box.dataset.mod = modKey;
        grid.append(box);
      }
    }
    scroll.append(grid); body.append(scroll); panel.append(body); root.append(panel);
  }

  const unsubscribe = controller.subscribe(render);
  render();
  return () => { unsubscribe(); root.onclick = null; root.replaceChildren(); };
}
