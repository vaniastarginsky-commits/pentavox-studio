import { baseCvBuiltIn, baseCvFunction } from '../model/panel_pots.js';
import { POTMAP_OFF } from '../model/potmap.js';
import { sourceKey } from './routing_vm.js';
import { panelGuidePages, panelTargets } from './routing_panel.js';
import { ccLabel } from './midi_routing.js';
import { learnNextMessage } from '../model/midi_learn.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const label = source => source.key === 'basecv' ? `CV ${source.ch + 1}` : source.name;
const tag = source => source.key === 'basecv' ? `J${source.ch + 3}` : source.key === 'panelpot' ? 'Panel' : 'Expander';
const percent = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`;
const groupLabel = name => name === 'Global' ? 'Master' : name;
const groupColour = name => /^Plaits 1/.test(name) ? 'var(--rd-teal)' : /^Plaits [23]/.test(name) ? 'var(--rd-amber)' : name === 'FX' ? 'var(--rd-amber)' : 'var(--rd-blue)';
const sections = ['cv', 'midi', 'notes', 'knobs'];
const sectionFromHash = () => { const [page, part] = location.hash.slice(1).split('/'); return page === 'midi' ? 'midi' : page === 'routing' && sections.includes(part) ? part : 'cv'; };

/** Read views only during mount/navigation. Firmware tables remain the source of truth. */
export function mountPatchDesk(root, controller, { onError = () => {}, onUndo = null, learn = learnNextMessage } = {}) {
  const ui = { section: sectionFromHash(), source: null, route: undefined, midi: undefined, cc: 1, all: true, target: 'All', expanded: false, page: 0, layer: 0, mappingPage: 0, mappingPot: 0, additive: false, draft: null, picker: false, query: '', learning: null, learned: '', undo: null };
  let disposed = false;
  root.classList.add('patch-desk');
  const sources = () => controller.view().groups.flatMap(g => g.sources).filter(e => ui.section === 'knobs' ? e.source.key === 'panelpot' : e.source.key !== 'panelpot');
  const cvRows = () => sources().flatMap(e => controller.rowsFor(e.source).map(r => ({ ...r, key: e.key, source: e.source, id: `${e.key}/${r.k}` })));
  const midiView = () => controller.midiRoutesView();
  const midiRows = () => (midiView()?.routes ?? []).filter(r => r.dest !== 0);
  const selectedCv = () => cvRows().find(r => r.id === ui.route);
  const selectedMidi = () => midiRows().find(r => r.index === ui.midi);
  const readonly = () => controller.view().readOnly;
  function button(text, fn, cls = '', disabled = false) {
    const b = el('button', cls, text); b.type = 'button'; b.disabled = disabled;
    b.addEventListener('click', event => { if (!b.disabled) fn(event); }); return b;
  }
  function select(options, value, aria, fn, disabled = readonly()) {
    const n = el('select'); n.setAttribute('aria-label', aria); n.disabled = disabled;
    for (const [v, text] of options) n.append(new Option(text, String(v), false, String(v) === String(value)));
    n.addEventListener('change', () => { if (!n.disabled) fn(n.value); }); return n;
  }
  const safely = fn => { if (readonly()) return; try { fn(); } catch (error) { onError(error); } };
  function remember(text, undo) { ui.undo = () => safely(undo); if (onUndo) onUndo(text, ui.undo); }
  function rememberCv(key, text) {
    const source = controller.session.table.sources().find(s => sourceKey(s) === key);
    const slots = Array.from({ length: 4 }, (_, k) => controller.session.table.get(source, k));
    remember(text, () => controller.restoreRouteSlots(key, slots));
  }
  function rememberMidi(row, text, keys = ['cc', 'ch', 'dest', 'depth']) { const before = { cc: row.cc, ch: row.channel, dest: row.dest, depth: row.depth }, index = row.index; remember(text, () => controller.updateMidiRouteFields(index, Object.fromEntries(keys.map(key => [key, before[key]])))); }
  function chooseSection(section, navigate = true) {
    if (!sections.includes(section)) return;
    stopLearn(); ui.section = section; ui.draft = null; ui.picker = false; ui.query = '';
    if (navigate) location.hash = `routing/${section}`;
    render();
  }
  function stopLearn() { ui.learning?.abort(); ui.learning = null; }
  function showPicker() { ui.picker = true; ui.query = ''; render(); root.querySelector('.rd-picker-close')?.focus(); }
  function destinationName(id) { const entry = controller.destinations.byId(id); return entry ? `${groupLabel(entry.group)} / ${entry.name}` : `#${id}`; }
  function destinationButton(id, fn) {
    const entry = controller.destinations.byId(id), b = button('', fn, 'rd-destination', readonly());
    b.style.setProperty('--rd-route', groupColour(entry?.group));
    const copy = el('span', 'rd-dest-copy'); copy.append(el('small', '', entry ? groupLabel(entry.group) : 'Destination'), el('b', '', id ? entry?.name ?? `#${id}` : 'Choose parameter'));
    b.append(el('i', 'rd-dot'), copy); b.title = id ? destinationName(id) : 'Choose parameter'; return b;
  }
  function depthControl(value, name, commit, saveUndo) {
    const track = el('div', 'rd-depth-track'), input = el('input'); input.type = 'range'; input.min = '-100'; input.max = '100'; input.step = '1'; input.value = String(value); input.disabled = readonly(); input.setAttribute('aria-label', `${name} depth`);
    const numberWrap = el('label', 'rd-depth-number'), numeric = el('input'); numeric.type = 'number'; numeric.min = '-100'; numeric.max = '100'; numeric.step = '1'; numeric.value = String(value); numeric.disabled = readonly(); numeric.setAttribute('aria-label', `${name} depth, percent`);
    const fill = () => { track.style.setProperty('--start', `${Math.min(50, (Number(input.value) + 100) / 2)}%`); track.style.setProperty('--end', `${Math.max(50, (Number(input.value) + 100) / 2)}%`); };
    input.addEventListener('input', () => { numeric.value = input.value; fill(); });
    input.addEventListener('change', () => safely(() => { saveUndo(); commit(Number(input.value)); }));
    numeric.addEventListener('change', () => {
      const n = Number(numeric.value); if (numeric.value === '' || !Number.isFinite(n) || n < -100 || n > 100) { numeric.value = input.value; return; }
      safely(() => { saveUndo(); commit(n); });
    });
    track.append(input); numberWrap.append(numeric, el('span', '', '%')); fill(); return [track, numberWrap];
  }
  function selectCv(row) {
    ui.route = row.id; ui.source = row.key; ui.draft = null;
    followDestination(row.destId); render();
  }
  function followDestination(id) {
    for (const layer of [0, 1]) {
      const pages = panelGuidePages(controller, layer);
      const page = pages.findIndex((_, i) => panelTargets(controller, layer, i).some(t => t.destination === id));
      if (page >= 0) { ui.page = page; ui.layer = layer; return; }
    }
  }
  function beginRoute() {
    if (readonly()) return;
    if (ui.section === 'midi') {
      const free = midiView()?.routes.find(r => !r.dest); if (!free) return;
      ui.draft = { kind: 'midi', index: free.index, cc: ui.cc, channel: 0, depth: 50 }; ui.midi = null;
    } else {
      const source = sources().find(s => s.key === ui.source); if (!source?.canAdd) return;
      ui.draft = { kind: 'cv', key: source.key }; ui.route = null;
    }
    showPicker();
  }
  function chooseDestination(id) {
    safely(() => {
      if (ui.section === 'notes') return;
      if (ui.section === 'knobs' && !ui.additive) {
        const page = controller.potMapView()[ui.layer]?.pages[ui.mappingPage], pot = ui.mappingPot;
        if (!page || !controller.session.potMap?.field(ui.layer, page.page, pot)) return;
        const before = page.cells[pot].destId, layer = ui.layer, index = page.page;
        remember('Knob assignment changed', () => controller.updatePotMap(layer, index, pot, before));
        controller.updatePotMap(layer, index, pot, id); ui.picker = false; render(); return;
      }
      if (ui.section === 'midi') {
        const draft = ui.draft, row = draft ? midiView()?.routes.find(r => r.index === draft.index) : selectedMidi();
        if (!row) { beginRoute(); return; }
        if (!row.dest && !draft) return;
        rememberMidi(row, 'MIDI assignment changed', draft ? undefined : ['dest']); ui.draft = null; ui.midi = row.index; ui.cc = draft?.cc ?? row.cc;
        if (ui.target !== 'All' && ui.target !== controller.destinations.byId(id)?.group) ui.target = 'All';
        if (draft) ui.revealMidi = row.index;
        controller.updateMidiRouteFields(row.index, { ...(draft ? { cc: draft.cc, ch: draft.channel, depth: draft.depth } : {}), dest: id });
      } else {
        const draft = ui.draft, row = selectedCv(), key = draft?.key ?? row?.key;
        if (!key) { beginRoute(); return; }
        rememberCv(key, 'CV assignment changed'); ui.draft = null;
        if (draft) { const slot = controller.addRoute(id, 50, key); if (slot >= 0) ui.route = `${key}/${slot}`; }
        else controller.updateRoute(row.k, { destId: id }, key);
      }
      ui.picker = false; render();
    });
  }
  function renderSources(host) {
    const head = el('div', 'rd-section-head'); head.append(el('b', '', 'Sources'), el('small', '', ui.section === 'midi' ? 'MIDI' : ui.section === 'knobs' ? 'Panel' : 'CV')); host.append(head);
    const list = el('div', 'rd-source-list'); host.append(list);
    if (ui.section === 'midi') {
      const rows = midiRows(), controllers = rows.length ? [...new Set(rows.map(r => r.cc))] : [1, 74, 11, 128];
      for (const cc of controllers) {
        const n = rows.filter(r => r.cc === cc).length;
        const b = button('', () => { ui.cc = cc; const r = rows.find(r => r.cc === cc); ui.midi = r?.index ?? null; ui.draft = null; if (r) followDestination(r.dest); render(); }, 'rd-source'); b.classList.toggle('selected', ui.cc === cc);
        const text = el('span', 'rd-source-name'); text.append(el('b', '', cc === 128 ? 'Velocity' : `CC ${cc}`), el('small', '', ccLabel(cc).replace(/^CC \d+\s*·?\s*/, '') || 'Controller'));
        b.append(el('i', 'rd-jack'), text, el('small', 'rd-source-count', n || '·')); list.append(b);
      }
      host.append(el('p', 'rd-source-context', 'Learn captures the controller and its channel. Existing routes are read from the module.'));
    } else {
      const entries = sources(), base = entries.filter(e => e.source.key !== 'route'), expander = entries.filter(e => e.source.key === 'route');
      const add = (entry, parent) => {
        const b = button('', () => { ui.source = entry.key; ui.draft = null; const row = cvRows().find(r => r.key === entry.key); ui.route = row?.id ?? null; if (row) followDestination(row.destId); if (ui.section === 'knobs') ui.mappingPot = entry.source.ch; render(); }, 'rd-source'); b.classList.toggle('selected', ui.source === entry.key);
        const copy = el('span', 'rd-source-name'); copy.append(el('b', '', label(entry.source)), el('small', '', entry.source.key === 'basecv' ? baseCvBuiltIn(entry.source.ch, controller.session.settings) || tag(entry.source) : tag(entry.source)));
        const ticks = el('span', 'rd-slots'); ticks.setAttribute('aria-label', `${entry.count} of 4 routes`); for (let i = 0; i < 4; i++) ticks.append(el('i', i < entry.count ? 'filled' : ''));
        b.append(el('i', 'rd-jack'), copy, ticks); parent.append(b);
      };
      base.forEach(e => add(e, list));
      if (expander.length) { host.append(button(`Expander ${ui.expanded ? '−' : '+'} ${expander.length}`, () => { ui.expanded = !ui.expanded; render(); }, 'rd-expander')); if (ui.expanded) { const extra = el('div', 'rd-source-list'); expander.forEach(e => add(e, extra)); host.append(extra); } }
      host.append(el('p', 'rd-source-context', ui.section === 'knobs' ? 'Mapping replaces a knob function. Additional routes add modulation.' : 'Up to four destinations per input. Built-in jack functions remain separate.'));
    }
  }
  function toolbar(host, title) {
    const bar = el('div', 'rd-toolbar'); bar.append(el('h2', '', title)); host.append(bar); return bar;
  }
  function sourceFilter(bar) {
    const tabs = el('div', 'rd-scope');
    tabs.append(button('All', () => { ui.all = true; render(); }, ui.all ? 'selected' : ''), button('Selected input', () => { ui.all = false; render(); }, !ui.all ? 'selected' : '')); bar.append(tabs);
  }
  function renderCv(host) {
    const rows = cvRows(), current = sources().find(e => e.key === ui.source), bar = toolbar(host, 'Connections'); bar.append(el('span', 'rd-count', rows.length)); sourceFilter(bar); bar.append(button('+ Route', beginRoute, 'rd-primary', readonly() || !current?.canAdd));
    const head = el('div', 'rd-row rd-table-head'); head.append(el('span', '', 'Input'), el('span', '', 'Destination'), el('span', 'rd-depth-heading', 'Depth · −100 … +100%')); host.append(head);
    const list = el('div', 'rd-rows'); host.append(list);
    const visible = rows.filter(r => ui.all || r.key === ui.source);
    for (const row of visible) {
      const entry = controller.destinations.byId(row.destId), node = el('div', 'rd-row'); node.classList.toggle('selected', row.id === ui.route); node.style.setProperty('--rd-route', groupColour(entry?.group));
      const input = button(label(row.source), () => selectCv(row), 'rd-input-name');
      const dest = destinationButton(row.destId, () => { selectCv(row); showPicker(); });
      const depth = depthControl(row.depthPct, `${label(row.source)} to ${destinationName(row.destId)}`, n => controller.updateRoute(row.k, { depthPct: n }, row.key), () => rememberCv(row.key, 'CV depth changed'));
      const remove = button('×', () => safely(() => { rememberCv(row.key, 'CV route removed'); ui.route = null; controller.removeRoute(row.k, row.key); }), 'rd-remove', readonly()); remove.setAttribute('aria-label', `Remove ${label(row.source)} to ${destinationName(row.destId)}`);
      node.append(input, dest, ...depth, remove); list.append(node);
      if (row.duplicate) node.title = 'This input has multiple routes to this parameter; their values add up.';
    }
    if (!visible.length) list.append(el('p', 'rd-empty', 'Choose an input and add a parameter from the panel.'));
    if (ui.draft) host.append(el('div', 'rd-draft', 'New route — choose a parameter from the panel.'), button('Cancel', () => { ui.draft = null; ui.picker = false; render(); }, 'rd-quiet'));
    host.append(el('p', 'rd-hint', 'Zero adds no modulation. Negative depth inverts the signal.'));
    if (current?.source.key === 'basecv') {
      const fn = baseCvFunction(current.source.ch, controller.session.settings), built = el('div', 'rd-builtin'), text = el('span');
      text.append(el('b', '', `${label(current.source)} · built-in function`)); built.append(text);
      if (fn.editable) built.append(select(fn.options.map(o => [o.value, o.label]), fn.value, `${tag(current.source)} built-in function`, value => safely(() => controller.updateJackFunction(current.source.ch, value))));
      else built.append(el('small', '', baseCvBuiltIn(current.source.ch, controller.session.settings) || 'Not assigned'));
      host.append(built);
    }
    summary(host, selectedCv() ? `${label(selectedCv().source)} → ${destinationName(selectedCv().destId)}  ${percent(selectedCv().depthPct)}` : ui.draft ? 'Choose a parameter on the panel' : 'Input → parameter → depth', 'CV adds to the base knob value. The panel shows where each parameter lives.');
  }
  function renderMidi(host) {
    const view = midiView(); if (!view) { host.append(el('p', 'rd-empty', 'This firmware has no MIDI CC routing table.')); return; }
    const rows = midiRows(), bar = toolbar(host, 'MIDI connections'); bar.append(el('span', 'rd-count', `${rows.length}/${view.slots}`)); sourceFilter(bar);
    bar.append(button('+ Route', beginRoute, 'rd-primary', readonly() || !view.routes.some(r => !r.dest)));
    const filters = el('div', 'rd-midi-filters'), targetGroups = [...new Set(rows.map(r => controller.destinations.byId(r.dest)?.group).filter(Boolean))];
    if (ui.target !== 'All' && !targetGroups.includes(ui.target)) ui.target = 'All';
    filters.append(select([['All', 'All targets'], ...targetGroups.map(g => [g, groupLabel(g)])], ui.target, 'Filter MIDI targets', value => { ui.target = value; render(); }, false));
    filters.append(el('small', '', 'Any = all channels · Voice = target voice’s channel in Notes')); host.append(filters);
    const list = el('div', 'rd-rows'); host.append(list);
    for (const row of rows.filter(r => (ui.all || r.cc === ui.cc) && (ui.target === 'All' || controller.destinations.byId(r.dest)?.group === ui.target))) {
      const node = el('div', 'rd-midi-row'); node.setAttribute('data-midi-index', String(row.index)); node.classList.toggle('selected', row.index === ui.midi); node.style.setProperty('--rd-route', groupColour(controller.destinations.byId(row.dest)?.group));
      const inputs = el('div', 'rd-midi-input');
      inputs.append(select([[128, 'Velocity'], ...Array.from({ length: 128 }, (_, cc) => [cc, ccLabel(cc)])], row.cc, `Controller of MIDI route ${row.index + 1}`, value => safely(() => { rememberMidi(row, 'MIDI controller changed', ['cc']); ui.cc = Number(value); ui.midi = row.index; controller.updateMidiRoute(row.index, 'cc', value); })));
      const meta = el('div', 'rd-midi-meta');
      meta.append(select([[0, 'Any'], [17, 'Voice'], ...Array.from({ length: 16 }, (_, c) => [c + 1, `Ch ${c + 1}`])], row.channel, `Channel of MIDI route ${row.index + 1}`, value => safely(() => { rememberMidi(row, 'MIDI channel changed', ['ch']); controller.updateMidiRoute(row.index, 'ch', value); })));
      const supported = typeof globalThis.navigator?.requestMIDIAccess === 'function';
      const learnButton = button(ui.learning?.index === row.index ? 'Cancel' : 'Learn', () => startLearn(row), ui.learning?.index === row.index ? 'rd-learning' : 'rd-quiet', readonly() || !supported); learnButton.title = supported ? 'Capture a controller and channel from the next MIDI message' : 'MIDI Learn requires Web MIDI in Chrome or Edge. You can select CC and channel manually.'; learnButton.setAttribute('aria-label', `Learn MIDI route ${row.index + 1}`); meta.append(learnButton); inputs.append(meta);
      const dest = destinationButton(row.dest, () => { ui.midi = row.index; ui.cc = row.cc; ui.draft = null; followDestination(row.dest); showPicker(); });
      const depth = depthControl(row.depth, `MIDI route ${row.index + 1}`, n => controller.updateMidiRoute(row.index, 'depth', n), () => rememberMidi(row, 'MIDI depth changed', ['depth']));
      const remove = button('×', () => safely(() => { rememberMidi(row, 'MIDI route removed', ['dest']); ui.midi = null; controller.updateMidiRoute(row.index, 'dest', 0); }), 'rd-remove', readonly()); remove.setAttribute('aria-label', `Remove MIDI route ${row.index + 1}`);
      node.append(inputs, dest, ...depth, remove); list.append(node);
    }
    if (!list.children.length) list.append(el('p', 'rd-empty', 'No routes here. Add a route or change the filter.'));
    if (ui.draft?.kind === 'midi') {
      const pending = el('div', 'rd-draft', 'New route — choose a controller, channel and parameter in the panel.'); pending.append(button('Cancel', () => { ui.draft = null; ui.picker = false; render(); }, 'rd-quiet')); host.append(pending);
    }
    if (ui.learning || ui.learned) host.append(el('p', 'rd-learn-status', ui.learning ? 'Listening — move a MIDI controller. Escape cancels.' : ui.learned));
    const row = selectedMidi(); summary(host, row ? `${ccLabel(row.cc)} → ${destinationName(row.dest)}  ${percent(row.depth)}` : 'Controller → parameter → depth', 'Existing assignments come from the module. CV and MIDI can drive the same parameter; their values add up.');
  }
  async function startLearn(row) {
    if (ui.learning?.index === row.index) { stopLearn(); render(); return; }
    stopLearn(); const abort = new AbortController(); abort.index = row.index; ui.learning = abort; ui.learned = ''; render();
    try {
      const result = await learn({ signal: abort.signal });
      if (abort.signal.aborted || disposed || ui.learning !== abort || readonly()) return;
      // Only update the route originally selected for Learn; never reset its destination or depth.
      const current = midiView()?.routes.find(r => r.index === row.index); if (!current || current.dest !== row.dest) return;
      rememberMidi(current, 'MIDI controller learned', ['cc', 'ch']); ui.learning = null; ui.cc = result.cc; ui.midi = row.index;
      controller.updateMidiRouteFields(row.index, { cc: result.cc, ch: result.channel }); ui.learned = `${ccLabel(result.cc)} · Channel ${result.channel}`;
    } catch (error) { if (error?.name !== 'AbortError') onError(error); }
    finally { if (ui.learning === abort) ui.learning = null; if (!disposed) render(); }
  }
  function summary(host, title, text) { const box = el('div', 'rd-summary'); box.append(el('small', '', 'Selected connection'), el('b', '', title), el('p', '', text)); host.append(box); }
  function renderNotes(host) {
    toolbar(host, 'Notes & gates'); host.append(el('p', 'rd-hint', 'Choose what plays each voice. Pitch and gate sources can be different.'));
    for (const row of controller.view().notes?.rows ?? []) {
      const node = el('div', 'rd-note-row'); node.append(el('b', '', row.label));
      for (const control of row.controls) { const field = el('label'); field.append(el('small', '', control.label), select(control.options.map(o => [o.value, o.label]), control.value, `${row.label}: ${control.label}`, value => safely(() => controller.updateSetting(control.id, value)))); node.append(field); } host.append(node);
    }
    for (const conflict of controller.view().notes?.conflicts ?? []) host.append(el('p', 'rd-hint', conflict.text));
    summary(host, 'Pitch / gate → voice', 'Voice in the MIDI tab follows the channel chosen here. These settings do not change modulation routes.');
  }
  function renderMapping(host) {
    const layers = controller.potMapView(), layer = layers[ui.layer], pages = layer?.pages ?? [], page = pages[ui.mappingPage];
    const bar = toolbar(host, 'Knob mapping');
    bar.append(select(pages.map((p, i) => [i, p.label]), ui.mappingPage, 'Knob mapping page', value => { ui.mappingPage = Number(value); render(); }, false));
    const layerButton = button(ui.layer ? 'B1 Shift' : 'Normal', () => { ui.layer = 1 - ui.layer; render(); }, ui.layer ? 'rd-active' : ''); layerButton.setAttribute('aria-pressed', String(Boolean(ui.layer))); bar.append(layerButton);
    const mode = el('div', 'rd-mapping-mode'); mode.append(button('Replace function', () => { ui.additive = false; render(); }, !ui.additive ? 'selected' : ''), button('Additional modulation', () => { ui.additive = true; render(); }, ui.additive ? 'selected' : '')); host.append(mode);
    if (ui.additive) { renderCv(host); return; }
    if (!page) { host.append(el('p', 'rd-empty', 'This firmware has no knob mapping fields.')); return; }
    host.append(el('p', 'rd-hint', 'Replaces the physical knob’s function on this page and layer. The original parameter keeps its last value.'));
    const mappingRows = el('div', 'rd-map-list'); host.append(mappingRows);
    for (const cell of page.cells) {
      const row = el('div', 'rd-map-row'); row.classList.toggle('selected', ui.mappingPot === cell.pot);
      const choose = button('', () => { ui.mappingPot = cell.pot; ui.source = sources().find(e => e.source.ch === cell.pot)?.key ?? ui.source; showPicker(); }, 'rd-map-choice', readonly());
      const text = el('span'); text.append(el('b', '', cell.title), el('small', '', ['Upper left', 'Upper right', 'Middle left', 'Middle right', 'Lower left', 'Lower right'][cell.pot]));
      choose.append(el('i', 'rd-mini-knob'), text, el('small', 'rd-count', cell.off ? 'Off' : cell.assigned ? 'Custom' : 'Default'));
      row.append(choose, button('↺', () => safely(() => { const layer = ui.layer, index = page.page, before = cell.destId; remember('Knob restored', () => controller.updatePotMap(layer, index, cell.pot, before)); controller.updatePotMap(layer, index, cell.pot, 0); }), 'rd-quiet', readonly() || cell.isDefault)); mappingRows.append(row);
    }
    summary(host, `${page.label} · ${ui.layer ? 'B1' : 'Normal'} · Pot ${ui.mappingPot + 1}`, 'Choose a new function on the panel or search all available parameters. Default and Off are available in the picker.');
  }
  function renderPicker(host) {
    host.classList.toggle('open', ui.picker); host.setAttribute('aria-label', 'Choose destination');
    const head = el('div', 'rd-picker-head'); head.append(el('h2', '', 'Assign from panel'), button('×', () => { ui.picker = false; ui.draft = null; render(); }, 'rd-picker-close')); head.lastChild.setAttribute('aria-label', 'Close destination picker'); host.append(head);
    const selectedSource = sources().find(e => e.key === ui.source), row = selectedMidi();
    host.append(el('p', 'rd-picker-sub', ui.section === 'midi' ? `MIDI · ${ccLabel(ui.draft?.cc ?? row?.cc ?? ui.cc)}` : ui.section === 'knobs' && !ui.additive ? `New function for pot ${ui.mappingPot + 1}` : selectedSource ? `${label(selectedSource.source)} · ${tag(selectedSource.source)}` : 'Choose an input'));
    if (ui.draft?.kind === 'midi') {
      const fields = el('div', 'rd-new-midi');
      fields.append(select([[128, 'Velocity'], ...Array.from({ length: 128 }, (_, cc) => [cc, ccLabel(cc)])], ui.draft.cc, 'New MIDI controller', value => { ui.draft.cc = Number(value); const subtitle = host.querySelector('.rd-picker-sub'); if (subtitle) subtitle.textContent = `MIDI · ${ccLabel(ui.draft.cc)}`; }), select([[0, 'Any'], [17, 'Voice'], ...Array.from({ length: 16 }, (_, c) => [c + 1, `Ch ${c + 1}`])], ui.draft.channel, 'New MIDI channel', value => { ui.draft.channel = Number(value); }));
      host.append(fields);
    }
    const pages = panelGuidePages(controller, ui.layer); ui.page = Math.max(0, Math.min(ui.page, pages.length - 1));
    if (pages.length) {
      const tabs = el('div', 'rd-panel-pages');
      for (const [i, page] of pages.entries()) { const b = button(page.label.replace('FX live', 'FX').replace('Plaits 1', 'Plaits'), () => { ui.page = i; render(); }, i === ui.page ? 'selected' : ''); b.title = page.label; tabs.append(b); } host.append(tabs);
      const actions = el('div', 'rd-panel-actions'), shift = button(ui.layer ? 'B1 Shift' : 'B1 Normal', () => { ui.layer = 1 - ui.layer; render(); }, ui.layer ? 'rd-active' : ''); shift.setAttribute('aria-pressed', String(Boolean(ui.layer))); actions.append(shift, el('small', '', 'Click a knob to assign')); host.append(actions);
      const panel = el('div', 'rd-panel'), serial = el('div', 'rd-panel-title'); serial.append(el('span', '', 'PENTAVOX'), el('span', '', pages[ui.page].label)); panel.append(serial);
      const knobs = el('div', 'rd-knobs'), targets = panelTargets(controller, ui.layer, ui.page);
      const dest = ui.draft ? null : ui.section === 'midi' ? row?.dest : ui.section === 'knobs' && !ui.additive ? controller.potMapView()[ui.layer]?.pages[ui.mappingPage]?.cells[ui.mappingPot]?.destId : selectedCv()?.destId;
      for (const target of targets) {
        const available = Boolean(target.destination) && ui.section !== 'notes';
        const b = button('', () => { if (available) chooseDestination(target.destination); }, 'rd-knob', readonly());
        b.setAttribute('aria-label', `Assign ${target.title}`); b.setAttribute('aria-disabled', String(!available || readonly())); b.classList.toggle('unavailable', !available); b.classList.toggle('selected', Boolean(dest && dest === target.destination));
        b.title = available ? `${target.group} / ${target.title}${target.paired ? ` · ${ui.layer ? 'Normal' : 'B1'}: ${target.paired}` : ''}` : target.reason;
        b.innerHTML = '<svg viewBox="0 0 60 60" aria-hidden="true"><path class="rd-knob-track" d="M12 46a25 25 0 1 1 36 0"/><path class="rd-knob-fill" d="M12 46a25 25 0 1 1 36 0"/><circle cx="30" cy="29" r="19"/><path class="rd-knob-pointer" d="M30 29 37 18"/></svg>';
        b.append(el('span', '', target.title)); knobs.append(b);
      }
      const buttons = el('div', 'rd-panel-buttons'); for (let i = 0; i < 3; i++) buttons.append(el('i', i === 0 && ui.layer ? 'on' : '')); knobs.append(buttons); panel.append(knobs);
      const jacks = el('div', 'rd-panel-jacks'); for (let i = 0; i < 6; i++) jacks.append(el('i', ui.section !== 'midi' && selectedSource?.source.key === 'basecv' && selectedSource.source.ch === i ? 'on' : '')); panel.append(jacks); host.append(panel);
    }
    host.append(el('p', 'rd-hint', ui.section === 'notes' ? 'Note inputs are configured in the table. Parameter assignments are on CV and MIDI.' : 'Dimmed controls have no CV/MIDI destination in this firmware. Search includes parameters beyond the panel.'));
    const search = el('input', 'rd-search'); search.type = 'search'; search.placeholder = 'Find any parameter…'; search.value = ui.query; search.setAttribute('aria-label', 'Search routing destinations'); host.append(search);
    const results = el('div', 'rd-results'); host.append(results);
    function fill() {
      results.replaceChildren(); const q = ui.query.trim().toLowerCase(); results.hidden = !q && !(ui.section === 'knobs' && !ui.additive);
      if (ui.section === 'knobs' && !ui.additive) for (const [id, name] of [[0, 'Built-in (default)'], [POTMAP_OFF, 'Off — knob does nothing']]) results.append(button(name, () => chooseDestination(id), '', readonly()));
      if (!q) return;
      const mapping = ui.section === 'knobs' && !ui.additive, page = controller.potMapView()[ui.layer]?.pages[ui.mappingPage], zones = mapping && page ? controller.session.potMap?.field(ui.layer, page.page, ui.mappingPot)?.zones ?? POTMAP_OFF + 1 : Infinity;
      for (const group of controller.destinationGroups()) for (const item of group.items) {
        if (!item.id || (mapping && (item.id === POTMAP_OFF || item.id >= zones)) || !`${group.group} ${item.name}`.toLowerCase().includes(q)) continue;
        const b = button('', () => chooseDestination(item.id), '', readonly() || ui.section === 'notes'); b.append(el('b', '', item.name), el('small', '', groupLabel(group.group))); results.append(b);
      }
      if (!results.children.length) results.append(el('p', 'rd-hint', 'No matching parameters'));
    }
    search.addEventListener('input', () => { ui.query = search.value; fill(); });
    search.addEventListener('keydown', e => { if (e.key === 'Enter') results.querySelector('button')?.click(); }); fill();
  }
  function render() {
    if (disposed) return;
    const view = controller.view(), sourceEntries = sources(); if (!sourceEntries.some(e => e.key === ui.source)) ui.source = sourceEntries[0]?.key ?? null;
    if (ui.route === undefined && !ui.draft) ui.route = cvRows().find(r => r.key === ui.source)?.id ?? null;
    if (ui.midi === undefined && !ui.draft) { ui.midi = midiRows()[0]?.index ?? null; if (ui.midi !== null) ui.cc = selectedMidi()?.cc ?? ui.cc; }
    const oldScroll = root.querySelector('.rd-rows')?.scrollTop ?? 0;
    const oldSourceScroll = root.querySelector('.rd-sources')?.scrollTop ?? 0;
    root.replaceChildren();
    if (view.readOnly) root.append(el('p', 'rd-readonly', view.reason || 'Read only — reconnect to edit.'));
    const tabs = el('nav', 'rd-tabs'); tabs.setAttribute('aria-label', 'Routing tasks');
    for (const [section, title] of [['cv', 'CV'], ['midi', 'MIDI'], ['notes', 'Notes'], ['knobs', 'Knob mapping']]) { const b = button(title, () => chooseSection(section), ui.section === section ? 'selected' : ''); b.setAttribute('aria-pressed', String(ui.section === section)); tabs.append(b); } root.append(tabs);
    const desk = el('section', 'rd-desk'), sourceRail = el('aside', 'rd-sources'), routes = el('div', 'rd-routes'), picker = el('aside', 'rd-picker'); desk.setAttribute('aria-label', 'Routing workspace'); desk.append(sourceRail, routes, picker); root.append(desk);
    renderSources(sourceRail);
    if (ui.section === 'midi') renderMidi(routes); else if (ui.section === 'notes') renderNotes(routes); else if (ui.section === 'knobs') renderMapping(routes); else renderCv(routes);
    renderPicker(picker);
    const newRows = root.querySelector('.rd-rows'); if (newRows) newRows.scrollTop = oldScroll;
    sourceRail.scrollTop = oldSourceScroll;
    if (ui.revealMidi !== undefined) { root.querySelector(`[data-midi-index="${ui.revealMidi}"]`)?.scrollIntoView?.({ block: 'nearest' }); delete ui.revealMidi; }
    const footer = el('footer', 'rd-footer'); footer.append(el('span', '', readonly() ? 'Read only' : 'Edits apply to the playing module'), button('Undo', () => { const undo = ui.undo; ui.undo = null; undo?.(); render(); }, 'rd-quiet', readonly() || !ui.undo)); root.append(footer);
    const shade = button('', () => { ui.picker = false; ui.draft = null; render(); }, 'rd-shade'); shade.hidden = !ui.picker; shade.setAttribute('aria-label', 'Close destination picker'); root.append(shade);
  }
  const hashChanged = () => { if (['routing', 'midi'].includes(location.hash.slice(1).split('/')[0])) chooseSection(sectionFromHash(), false); else { stopLearn(); ui.picker = false; render(); } };
  const keyDown = event => { if (event.key === 'Escape') { stopLearn(); ui.draft = null; ui.picker = false; render(); } };
  globalThis.addEventListener('hashchange', hashChanged); root.addEventListener('keydown', keyDown);
  const unsubscribe = controller.subscribe(() => { if (readonly()) stopLearn(); render(); }); render();
  return () => { disposed = true; stopLearn(); unsubscribe(); globalThis.removeEventListener('hashchange', hashChanged); root.removeEventListener('keydown', keyDown); root.replaceChildren(); };
}
