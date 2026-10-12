import { baseCvBuiltIn, baseCvFunction, builtInSummary, panelPotBuiltIn } from '../model/panel_pots.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Destination module -> colour key (styled in top.css as --mod).
const MODULE_KEYS = Object.freeze({
  'Plaits 1': 'p1', 'Plaits 2': 'p2', 'Plaits 3': 'p3',
  'Sampler 1': 's1', 'Sampler 2': 's2', 'FX': 'fx', 'Global': 'gl',
});
const moduleKey = (group) => MODULE_KEYS[group] ?? 'gl';

// Panel naming: base CV jacks are CV 1..6 (J3..J8 on the faceplate).
function sourceTitle(source) {
  if (source.key === 'basecv') return { name: `CV ${source.ch + 1}`, tag: `J${source.ch + 3}` };
  return { name: source.name, tag: '' };
}

const pctText = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}%`;

function setFill(slider) {
  const value = Number(slider.value);
  const lo = Math.min(50, 50 + value / 2); const hi = Math.max(50, 50 + value / 2);
  slider.style.setProperty('--lo', `${lo}%`); slider.style.setProperty('--hi', `${hi}%`);
}

export function mountRouting(root, controller, { potMapHost = null } = {}) {
  const ui = { open: new Set(), popover: null, query: '' };   // several inputs can be open at once
  const destinations = controller.destinations;

  function destinationButton(row, view, route, key) {
    const pid = `${key}|${row.k}`;
    const entry = destinations.byId(row.destId);
    const button = element('button', 'dest-btn'); button.type = 'button'; button.disabled = view.readOnly;
    button.dataset.mod = moduleKey(entry?.group);
    button.append(element('span', 'mod-dot'), element('span', 'dest-group', entry?.group ?? ''), element('strong', '', entry?.name ?? `#${row.destId}`));
    button.setAttribute('aria-haspopup', 'listbox');
    button.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = ui.popover === pid ? null : pid; ui.query = ''; render(); });
    route.append(button);
    if (ui.popover !== pid) return;
    const pop = element('div', 'dest-pop'); pop.addEventListener('click', (event) => event.stopPropagation());
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search destinations'; search.value = ui.query; search.setAttribute('aria-label', 'Search destinations');
    const list = element('div', 'dest-list'); list.setAttribute('role', 'listbox');
    const fill = () => {
      list.replaceChildren(); const q = ui.query.trim().toLocaleLowerCase('ru');
      for (const group of controller.destinationGroups()) {
        const items = group.items.filter((item) => item.id !== 0 && (!q || `${group.group} ${item.name}`.toLocaleLowerCase('ru').includes(q)));
        if (!items.length) continue;
        const head = element('div', 'dest-head'); head.dataset.mod = moduleKey(group.group); head.append(element('span', 'mod-dot'), element('span', '', group.group));
        list.append(head);
        for (const item of items) {
          const choice = element('button', `dest-item${item.id === row.destId ? ' current' : ''}`, item.name); choice.type = 'button'; choice.dataset.mod = moduleKey(group.group);
          choice.addEventListener('click', () => { ui.popover = null; controller.updateRoute(row.k, { destId: item.id }, key); });
          list.append(choice);
        }
      }
      if (!list.children.length) list.append(element('p', 'dest-empty', 'Nothing found'));
    };
    search.addEventListener('input', () => { ui.query = search.value; fill(); });
    search.addEventListener('keydown', (event) => { if (event.key === 'Escape') { ui.popover = null; render(); } });
    pop.append(search, list); route.append(pop); fill();
    queueMicrotask(() => search.focus());
  }

  function routeCard(row, view, key) {
    const entry = destinations.byId(row.destId);
    const route = element('div', `route-card${row.duplicate ? ' duplicate' : ''}`); route.dataset.mod = moduleKey(entry?.group);
    destinationButton(row, view, route, key);
    const depth = element('div', 'depth');
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '-100'; slider.max = '100'; slider.step = '1';
    slider.value = String(row.depthPct); slider.disabled = view.readOnly; slider.setAttribute('aria-label', 'Depth'); setFill(slider);
    const numeric = document.createElement('input'); numeric.type = 'number'; numeric.min = '-100'; numeric.max = '100'; numeric.step = '1';
    numeric.value = String(row.depthPct); numeric.disabled = view.readOnly; numeric.setAttribute('aria-label', 'Depth, percent');
    slider.addEventListener('input', () => { numeric.value = slider.value; setFill(slider); });
    slider.addEventListener('change', () => controller.updateRoute(row.k, { depthPct: slider.value }, key));
    numeric.addEventListener('change', () => controller.updateRoute(row.k, { depthPct: numeric.value }, key));
    depth.append(slider, numeric, element('span', 'unit', '%'));
    const remove = element('button', 'icon-button', '×'); remove.type = 'button'; remove.title = 'Remove route'; remove.setAttribute('aria-label', 'Remove route'); remove.disabled = view.readOnly;
    remove.addEventListener('click', () => controller.removeRoute(row.k, key));
    route.append(depth, remove);
    if (row.duplicate) route.append(element('span', 'duplicate-hint', 'This input already has this destination: the values add up'));
    return route;
  }

  // What the firmware itself does with this input, independent of routes: panel pots drive a
  // different parameter on every page, and a few base CV jacks have a fixed job.
  // The Pot map is the truth for what a pot does on each page: its assignments replace the built-in function.
  function panelPotItems(pot) {
    const normal = controller.potMapView()[0];
    if (!normal) return panelPotBuiltIn(pot, destinations);
    return normal.pages.map((page) => ({ page: page.label, cell: page.cells[pot] }))
      .filter(({ cell }) => cell.off || (cell.title && cell.title !== 'Not used'))
      .map(({ page, cell }) => ({ page, name: cell.off ? 'Not assigned' : cell.title, off: cell.off, remapped: cell.assigned }));
  }

  function builtIn(source) {
    if (source.key === 'panelpot') return { items: panelPotItems(source.ch), fixed: '' };
    if (source.key === 'basecv') return { items: [], fixed: baseCvBuiltIn(source.ch, controller.session.settings) };
    return { items: [], fixed: '' };
  }

  function summaryChips(source, fixed = null, noteChips = []) {
    const box = element('span', 'chips');
    if (!source.rows.length && !noteChips.length) {
      const info = fixed ? (fixed.fixed || (fixed.items.length ? `Panel: ${builtInSummary(fixed.items.filter((item) => !item.off)) || 'nothing assigned'}` : '')) : '';
      box.append(element('span', 'chip-empty', info || 'not assigned')); if (info) box.title = info;
      return box;
    }
    for (const note of noteChips) box.append(element('span', `chip cvn-input-chip cvn-${note.kind}`, note.label));
    for (const row of source.rows) {
      const entry = destinations.byId(row.destId);
      const chip = element('span', 'chip'); chip.dataset.mod = moduleKey(entry?.group);
      chip.append(element('span', 'mod-dot'), element('span', '', entry?.name ?? `#${row.destId}`), element('b', '', pctText(row.depthPct)));
      box.append(chip);
    }
    return box;
  }

  function notesTable(notes, readOnly) {
    const section = element('section', 'cvn-section');
    section.append(element('h2', 'cvn-title', 'Notes: V/Oct and Gate'));
    const strip = element('div', 'cvn-strip');
    for (const row of notes.rows) {
      const cell = element('div', 'cvn-voice-cell'); cell.dataset.mod = /^Plaits (\d)/.test(row.label) ? `p${row.label.slice(-1)}` : /^Sampler (\d)/.test(row.label) ? `s${row.label.slice(-1)}` : 'gl'; cell.append(element('strong', 'cvn-voice', row.label));
      for (const control of row.controls) {
        const select = document.createElement('select'); select.className = 'cvn-select'; select.disabled = readOnly; select.setAttribute('aria-label', `${row.label}: ${control.label}`);
        for (const option of control.options) select.append(new Option(option.label, String(option.value), false, option.value === control.value));
        select.addEventListener('change', () => controller.updateSetting(control.id, select.value));
        const field = element('label', 'cvn-field'); field.append(element('span', '', control.label.replace(/ from$/, '').replace(/^MIDI ch$/, 'Ch')), select); cell.append(field);
      }
      strip.append(cell);
    }
    section.append(strip);
    if (notes.conflicts.length) {
      const hints = element('div', 'cvn-conflicts');
      for (const conflict of notes.conflicts) hints.append(element('p', 'cvn-conflict', conflict.text));
      section.append(hints);
    }
    return section;
  }

  function render(view = controller.view()) {
    root.replaceChildren();
    root.onclick = () => { if (ui.popover !== null) { ui.popover = null; render(); } };
    if (view.readOnly) root.append(element('div', 'banner warning', view.reason ?? 'Read only'));

    // Bank B (shift layer) is hidden for now: it will come back as a separate pot-only feature.
    if (view.bank !== 'A') controller.selectBank('A');

    const bar = element('div', 'cv-toolbar');
    const allKeys = view.groups.flatMap((group) => group.sources.map((entry) => entry.key));
    const expand = element('button', 'quiet-button', 'Expand all'); expand.type = 'button';
    expand.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = null; for (const key of allKeys) ui.open.add(key); render(); });
    const collapse = element('button', 'quiet-button', 'Collapse all'); collapse.type = 'button';
    collapse.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = null; ui.open.clear(); render(); });
    bar.append(expand, collapse);
    root.append(bar);

    if (view.notes?.rows.length) root.append(notesTable(view.notes, view.readOnly));

    for (const group of view.groups) {
      if (potMapHost && group.title.startsWith('Panel pots')) root.append(potMapHost);
      const panel = element('section', 'cv-panel'); const list = element('div', 'cv-list');
      panel.append(element('h2', 'cv-panel-title', group.title), list); root.append(panel);
      for (const entry of group.sources) {
        const source = entry.source; const rows = controller.rowsFor(source);
        const open = ui.open.has(entry.key);
        const card = element('section', `cv-item${open ? ' open' : ''}${rows.length ? ' used' : ''}`);
        const title = sourceTitle(source);
        const head = element('button', 'cv-head'); head.type = 'button'; head.setAttribute('aria-expanded', String(open));
        const name = element('span', 'cv-name'); name.append(element('strong', '', title.name)); if (title.tag) name.append(element('small', '', title.tag));
        head.append(name, summaryChips({ rows, key: source.key }, builtIn(source), entry.noteChips), element('span', 'cv-count', rows.length ? `${rows.length}/4` : ''), element('span', 'chev', open ? '⌃' : '⌄'));
        head.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = null; if (open) ui.open.delete(entry.key); else ui.open.add(entry.key); render(); });
        card.append(head);
        if (open) {
          const body = element('div', 'cv-body');
          if (source.key === 'basecv') {
            const fn = baseCvFunction(source.ch, controller.session.settings);
            if (fn.editable) {
              const field = element('label', 'cv-jack-function');
              field.append(element('span', '', 'Built-in function'));
              const select = document.createElement('select');
              select.disabled = view.readOnly;
              select.setAttribute('aria-label', `J${source.ch + 3} built-in function`);
              for (const option of fn.options)
                select.append(new Option(option.label, String(option.value), false, option.value === fn.value));
              select.addEventListener('change', () => controller.updateJackFunction(source.ch, select.value));
              field.append(select); body.append(field);
            }
          }
          for (const row of rows) body.append(routeCard(row, view, entry.key));
          const info = builtIn(source);
          if (info.fixed) body.append(element('p', 'cv-builtin', `Built in: ${info.fixed}. This jack is used by the firmware itself.`));
          if (info.items.length) {
            const box = element('div', 'cv-builtin');
            box.append(element('strong', '', 'On the panel this pot controls'));
            const list = element('ul', 'cv-builtin-list');
            for (const item of info.items) { const li = element('li', item.off ? 'off' : ''); li.append(element('span', 'cv-builtin-page', item.page), element('span', '', item.name)); if (item.remapped) li.append(element('em', 'cv-remapped', 'Pot map')); list.append(li); }
            box.append(list); body.append(box);
          }
          if (!rows.length) body.append(element('p', 'cv-empty', 'No routes yet'));
          const add = element('button', 'add-button', '+ Add route'); add.type = 'button'; add.disabled = !entry.canAdd || view.readOnly;
          add.addEventListener('click', (event) => { event.stopPropagation(); controller.addRoute(1, 0, entry.key); });
          body.append(add);
          card.append(body);
        }
        list.append(card);
      }
    }

  }

  const unsubscribe = controller.subscribe(() => render());
  render();
  return () => { unsubscribe(); root.onclick = null; root.replaceChildren(); };
}
