import { placePopover } from './popover_place.js';
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
  'Sampler 1': 's1', 'Sampler 2': 's2', 'Looper': 's1', 'FX': 'fx', 'Global': 'gl',
});
const moduleKey = (group) => MODULE_KEYS[group] ?? 'gl';

// Panel naming: base CV jacks are CV 1..6 (J3..J8 on the faceplate).
function sourceTitle(source) {
  if (source.key === 'basecv') return { name: `CV ${source.ch + 1}`, tag: `J${source.ch + 3}` };
  return { name: source.name, tag: '' };
}

// Group heading: a short title plus a one-line hint, as the console shows it.
const GROUP_HINTS = Object.freeze({
  basecv: 'Jacks J3\u2013J8', panelpot: 'Pot 1\u20136 add to the knob you move', route: 'Exp CV 1\u20136 and Exp Pot 1\u20133',
});
const groupTitle = (title) => title.replace(/\s*\(.*\)\s*$/, '');

export function routingSections(groups) {
  return {
    cv: groups.map((group) => ({ ...group, sources: group.sources.filter((entry) => entry.source.key !== 'panelpot') })).filter((group) => group.sources.length),
    knobs: groups.map((group) => ({ ...group, sources: group.sources.filter((entry) => entry.source.key === 'panelpot') })).filter((group) => group.sources.length),
  };
}

export function routeSummary(source, rows, destinations) {
  const title = sourceTitle(source);
  return rows.map((row) => {
    const entry = destinations.byId(row.destId);
    return `${title.name} → ${entry ? `${entry.group} / ${entry.name}` : `#${row.destId}`} · ${pctText(row.depthPct)}`;
  }).join('; ');
}

const pctText = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}%`;

function setFill(slider) {
  slider.style.setProperty('--p', `${(Number(slider.value) + 100) / 2}%`);
}

export function mountRouting(root, controller, { potMapHost = null } = {}) {
  const ui = { open: new Set(), popover: null, query: '' };   // several inputs can be open at once
  const destinations = controller.destinations;
  root.classList.add('cc-page');

  function destinationButton(row, view, route, key) {
    const pid = `${key}|${row.k}`;
    const entry = destinations.byId(row.destId);
    const button = element('button', 'cc-dbtn'); button.type = 'button'; button.disabled = view.readOnly;
    button.dataset.picker = pid;
    button.dataset.mod = moduleKey(entry?.group);
    const text = element('span', 'cc-dtext'); text.append(element('small', '', entry?.group ?? ''), element('strong', '', entry?.name ?? `#${row.destId}`));
    button.append(element('span', 'cc-ddot'), text);
    button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', String(ui.popover === pid));
    button.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = ui.popover === pid ? null : pid; ui.query = ''; render(); });
    route.append(button);
    if (ui.popover !== pid) return;
    const pop = element('div', 'cc-pop'); pop.addEventListener('click', (event) => event.stopPropagation());
    pop.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); ui.popover = null; render(); root.querySelector(`[data-picker="${pid}"]`)?.focus(); } });
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search destinations'; search.value = ui.query; search.setAttribute('aria-label', 'Search destinations');
    const list = element('div', 'cc-poplist'); list.setAttribute('role', 'listbox');
    const matches = () => {
      const q = ui.query.trim().toLocaleLowerCase('en');
      return controller.destinationGroups().flatMap((group) => group.items.filter((item) => item.id !== 0 && (!q || `${group.group} ${item.name}`.toLocaleLowerCase('en').includes(q))).map((item) => ({ group, item })));
    };
    const choose = (id) => { ui.popover = null; controller.updateRoute(row.k, { destId: id }, key); };
    const fill = () => {
      list.replaceChildren(); const q = ui.query.trim().toLocaleLowerCase('ru');
      for (const group of controller.destinationGroups()) {
        const items = group.items.filter((item) => item.id !== 0 && (!q || `${group.group} ${item.name}`.toLocaleLowerCase('ru').includes(q)));
        if (!items.length) continue;
        const head = element('h6', ''); head.dataset.mod = moduleKey(group.group); head.append(element('span', 'cc-ddot'), group.group);
        list.append(head);
        for (const item of items) {
          const choice = element('button', `cc-pi${item.id === row.destId ? ' cur' : ''}`, item.name); choice.type = 'button'; choice.dataset.mod = moduleKey(group.group);
          choice.addEventListener('click', () => choose(item.id));
          list.append(choice);
        }
      }
      if (!list.children.length) list.append(element('p', 'cc-nf', 'Nothing found'));
    };
    search.addEventListener('input', () => { ui.query = search.value; fill(); });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); ui.popover = null; render(); root.querySelector(`[data-picker="${pid}"]`)?.focus(); }
      else if (event.key === 'Enter') { event.preventDefault(); const first = matches()[0]?.item; if (first) choose(first.id); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); list.querySelector('.cc-pi')?.focus(); }
    });
    pop.append(search, list); route.append(pop); fill();
    queueMicrotask(() => { placePopover(button, pop); search.focus(); });
  }

  function routeCard(row, view, key) {
    const entry = destinations.byId(row.destId);
    const route = element('div', `cc-rrow${row.duplicate ? ' dup' : ''}`); route.dataset.mod = moduleKey(entry?.group);
    destinationButton(row, view, route, key);
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '-100'; slider.max = '100'; slider.step = '1'; slider.className = 'cc-dep';
    slider.value = String(row.depthPct); slider.disabled = view.readOnly; slider.setAttribute('aria-label', 'Depth'); setFill(slider);
    const numeric = document.createElement('input'); numeric.type = 'number'; numeric.min = '-100'; numeric.max = '100'; numeric.step = '1';
    numeric.value = String(row.depthPct); numeric.disabled = view.readOnly; numeric.setAttribute('aria-label', 'Depth, percent');
    slider.addEventListener('input', () => { numeric.value = slider.value; setFill(slider); });
    slider.addEventListener('change', () => controller.updateRoute(row.k, { depthPct: slider.value }, key));
    numeric.addEventListener('change', () => controller.updateRoute(row.k, { depthPct: numeric.value }, key));
    const depn = element('span', 'cc-depn'); depn.append(numeric, element('span', '', '%'));
    const remove = element('button', 'cc-quiet cc-danger', '×'); remove.type = 'button'; remove.title = 'Remove route'; remove.setAttribute('aria-label', 'Remove route'); remove.disabled = view.readOnly;
    remove.addEventListener('click', () => controller.removeRoute(row.k, key));
    route.append(slider, depn, remove);
    if (row.duplicate) route.append(element('small', 'cc-dupmsg', 'This input already has this destination: the values add up'));
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
    const box = element('span', 'cc-chips');
    if (!source.rows.length && !noteChips.length) {
      const info = fixed ? (fixed.fixed ? `Built in: ${fixed.fixed}` : (fixed.items.length ? `Panel: ${builtInSummary(fixed.items.filter((item) => !item.off)) || 'nothing assigned'}` : '')) : '';
      box.append(element('span', 'cc-muted', info || 'not assigned')); if (info) box.title = info;
      return box;
    }
    for (const note of noteChips) box.append(element('span', `cc-chip note cvn-${note.kind}`, note.label));
    for (const row of source.rows) {
      const entry = destinations.byId(row.destId);
      const chip = element('span', 'cc-chip'); chip.dataset.mod = moduleKey(entry?.group);
      chip.append(element('span', 'cc-ddot'), element('span', 'cc-route-arrow', '→'), entry ? `${entry.group} / ${entry.name}` : `#${row.destId}`, element('b', '', pctText(row.depthPct)));
      box.append(chip);
    }
    return box;
  }

  function card(title, hint, ...extra) {
    const section = element('section', 'cc-card');
    const header = element('header'); header.append(element('h3', '', title));
    if (hint) header.append(element('small', '', hint));
    section.append(header, ...extra);
    return section;
  }

  function notesTable(notes, readOnly) {
    const body = element('div', 'cc-body');
    const strip = element('div', 'cc-voices');
    for (const row of notes.rows) {
      const cell = element('div', 'cc-voice'); cell.dataset.mod = /^Plaits (\d)/.test(row.label) ? `p${row.label.slice(-1)}` : /^Sampler (\d)/.test(row.label) ? `s${row.label.slice(-1)}` : 'gl'; cell.append(element('b', '', row.label));
      for (const control of row.controls) {
        const select = document.createElement('select'); select.disabled = readOnly; select.setAttribute('aria-label', `${row.label}: ${control.label}`);
        for (const option of control.options) select.append(new Option(option.label, String(option.value), false, option.value === control.value));
        select.addEventListener('change', () => controller.updateSetting(control.id, select.value));
        const field = element('label', 'cc-field'); field.append(element('span', '', control.label.replace(/^MIDI ch$/, 'Ch')), select); cell.append(field);
      }
      strip.append(cell);
    }
    body.append(strip);
    for (const conflict of notes.conflicts) body.append(element('p', 'cc-warnline', conflict.text));
    return card('Notes: V/Oct and Gate', 'per voice, from CV, a jack or a button', body);
  }

  function sourceCard(entry, view) {
    const source = entry.source; const rows = controller.rowsFor(source);
    const open = ui.open.has(entry.key);
    const item = element('div', `cc-scard${open ? ' open' : ''}${rows.length ? ' used' : ''}`);
    const title = sourceTitle(source);
    item.title = routeSummary(source, rows, destinations);
    const head = element('button', 'cc-shead'); head.type = 'button'; head.setAttribute('aria-expanded', String(open));
    const name = element('span', 'cc-st'); name.append(element('b', '', title.name)); if (title.tag) name.append(element('small', 'cc-tag', title.tag));
    head.append(name, summaryChips({ rows, key: source.key }, builtIn(source), entry.noteChips), element('span', 'cc-cnt', `${rows.length}/4`), element('span', 'cc-chev', open ? '⌃' : '⌄'));
    head.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = null; if (open) ui.open.delete(entry.key); else ui.open.add(entry.key); render(); });
    item.append(head);
    if (!open) return item;
    const body = element('div', 'cc-sbody');
    if (source.key === 'basecv') {
      const fn = baseCvFunction(source.ch, controller.session.settings);
      if (fn.editable) {
        const field = element('label', 'cc-field cc-jackfn');
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
    const info = builtIn(source);
    if (info.fixed) body.append(element('p', 'cc-hint', `Built in: ${info.fixed}. This jack is used by the firmware itself.`));
    if (info.items.length) {
      const box = element('div', 'cc-onpanel');
      box.append(element('b', '', 'On the panel this pot controls'));
      const list = element('ul');
      for (const entryItem of info.items) { const li = element('li', entryItem.off ? 'off' : ''); li.append(element('span', 'cc-pg', entryItem.page), element('span', '', entryItem.name)); if (entryItem.remapped) li.append(element('em', 'cc-chip', 'Pot map')); list.append(li); }
      box.append(list); body.append(box);
    }
    if (rows.length) { const list = element('div', 'cc-rlist'); for (const row of rows) list.append(routeCard(row, view, entry.key)); body.append(list); }
    else body.append(element('p', 'cc-muted cc-none', 'No routes yet'));
    const add = element('button', 'cc-btn cc-add', '+ Add route'); add.type = 'button'; add.disabled = !entry.canAdd || view.readOnly;
    add.addEventListener('click', (event) => { event.stopPropagation(); controller.addRoute(1, 0, entry.key); });
    body.append(add);
    item.append(body);
    return item;
  }

  function render(view = controller.view()) {
    root.replaceChildren();
    root.onclick = () => { if (ui.popover !== null) { ui.popover = null; render(); } };
    if (view.readOnly) root.append(element('div', 'banner warning', view.reason ?? 'Read only'));

    // Bank B (shift layer) is hidden for now: it will come back as a separate pot-only feature.
    if (view.bank !== 'A') controller.selectBank('A');

    const head = element('div', 'cc-head');
    head.append(element('p', 'cc-lead', 'Choose note inputs, route CV, or change what the knobs control. Edits are heard immediately.'));
    const allKeys = view.groups.flatMap((group) => group.sources.map((entry) => entry.key));
    const expand = element('button', 'cc-btn', 'Expand all'); expand.type = 'button';
    expand.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = null; for (const key of allKeys) ui.open.add(key); render(); });
    const collapse = element('button', 'cc-btn', 'Collapse all'); collapse.type = 'button';
    collapse.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = null; ui.open.clear(); render(); });
    const tools = element('div', 'cc-tools'); tools.append(expand, collapse);
    head.append(tools);
    root.append(head);

    if (view.notes?.rows.length) {
      const notes = element('section', 'workflow-routing-section'); notes.setAttribute('aria-label', 'Notes');
      notes.append(element('h2', 'workflow-section-title', 'Notes'), notesTable(view.notes, view.readOnly)); root.append(notes);
    }
    const sections = routingSections(view.groups);
    for (const [key, title, hint] of [['cv', 'CV routing', 'Each source can add to four parameters. Negative depth inverts the signal.'], ['knobs', 'Knob mapping', 'Pot map replaces the normal knob function. Additional routes below add to it.']]) {
      if (!sections[key].length && !(key === 'knobs' && potMapHost)) continue;
      const section = element('section', 'workflow-routing-section'); section.setAttribute('aria-label', title);
      section.append(element('h2', 'workflow-section-title', title), element('p', 'workflow-section-hint', hint));
      if (key === 'knobs' && potMapHost) section.append(potMapHost);
      for (const group of sections[key]) {
        const list = element('div', 'cc-slist');
        for (const entry of group.sources) list.append(sourceCard(entry, view));
        section.append(card(key === 'knobs' ? 'Additional knob routes' : groupTitle(group.title), GROUP_HINTS[group.sources[0]?.source.key] ?? '', list));
      }
      root.append(section);
    }
  }

  const unsubscribe = controller.subscribe(() => render());
  render();
  return () => { unsubscribe(); root.onclick = null; root.replaceChildren(); };
}
