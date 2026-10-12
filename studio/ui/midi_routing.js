import { learnNextMessage } from '../model/midi_learn.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Standard names for the controllers people actually use; the rest show as "CC n".
const CC_NAMES = Object.freeze({
  1: 'Mod wheel', 2: 'Breath', 4: 'Foot', 5: 'Portamento time', 7: 'Volume', 10: 'Pan', 11: 'Expression', 64: 'Sustain',
  71: 'Resonance', 72: 'Release', 73: 'Attack', 74: 'Brightness', 75: 'Sound 6', 76: 'Sound 7', 77: 'Sound 8', 78: 'Sound 9', 79: 'Sound 10',
  91: 'Effects send', 93: 'Chorus send',
});
const MODULE_KEYS = Object.freeze({ 'Plaits 1': 'p1', 'Plaits 2': 'p2', 'Plaits 3': 'p3', 'Sampler 1': 's1', 'Sampler 2': 's2', 'FX': 'fx', 'Global': 'gl' });
export const VELOCITY = 128;
export const ccLabel = (cc) => (cc === VELOCITY ? 'Note velocity' : CC_NAMES[cc] ? `CC ${cc} · ${CC_NAMES[cc]}` : `CC ${cc}`);

export function mountMidiRouting(root, controller, { onError = () => {}, onUndo = null, learn = learnNextMessage } = {}) {
  const ui = { extra: 0, used: 0, learning: null, popover: null, query: '' };   // blank rows the user asked for; a blank row that got a destination stops counting

  function ccSelect(route, readOnly) {
    const select = element('select', 'midi-cc'); select.disabled = readOnly; select.setAttribute('aria-label', `Controller of route ${route.index + 1}`);
    const velocity = new Option(ccLabel(VELOCITY), String(VELOCITY)); select.append(velocity);
    for (let cc = 0; cc < 128; ++cc) select.append(new Option(ccLabel(cc), String(cc)));
    select.value = String(route.cc);
    select.addEventListener('change', () => controller.updateMidiRoute(route.index, 'cc', select.value));
    const cell = element('div', 'midi-cc-cell');
    cell.append(select);
    if (typeof globalThis.navigator?.requestMIDIAccess === 'function') cell.append(learnButton(route, readOnly));
    return cell;
  }

  function stopLearning() { ui.learning?.abort.abort(); }

  function learnButton(route, readOnly) {
    const active = ui.learning?.index === route.index;
    const button = element('button', `midi-learn${active ? ' listening' : ''}`, active ? '…' : 'Learn');
    button.type = 'button'; button.disabled = readOnly;
    button.title = active ? 'Listening: move a knob or press a key on your MIDI controller (Esc cancels)' : 'Fill controller and channel from the next MIDI message your controller sends';
    button.setAttribute('aria-label', active ? `Cancel learning for route ${route.index + 1}` : `Learn controller of route ${route.index + 1}`);
    button.addEventListener('click', async () => {
      if (active) { stopLearning(); return; }
      stopLearning();
      const abort = new AbortController();
      ui.learning = { index: route.index, abort };
      render();
      try {
        const { cc, channel } = await learn({ signal: abort.signal });
        controller.updateMidiRoute(route.index, 'cc', cc);
        controller.updateMidiRoute(route.index, 'ch', channel);
      } catch (error) {
        if (error?.name !== 'AbortError') onError(error);
      } finally {
        if (ui.learning?.abort === abort) ui.learning = null;
        render();
      }
    });
    return button;
  }

  function channelSelect(route, readOnly) {
    const select = element('select', 'midi-ch'); select.disabled = readOnly; select.setAttribute('aria-label', `Channel of route ${route.index + 1}`);
    select.append(new Option('Any ch', '0'));
    select.append(new Option('Voice', '17'));   // the MIDI channel chosen for the voice this parameter belongs to
    for (let channel = 1; channel <= 16; ++channel) select.append(new Option(`Ch ${channel}`, String(channel)));
    select.title = 'Voice: the channel set for the voice that owns the parameter (CV routing, Notes).';
    select.value = String(route.channel);
    select.addEventListener('change', () => controller.updateMidiRoute(route.index, 'ch', select.value));
    return select;
  }

  // The same searchable picker as the CV routing page: a button that opens a grouped, filterable list.
  function destPicker(row, route, readOnly) {
    const entry = controller.destinations.byId(route.dest);
    const text = route.dest === 0 ? 'Choose a parameter…' : entry ? `${entry.group} · ${entry.name}` : controller.destinations.label(route.dest);   // a removed destination stays visible
    const button = element('button', `midi-dest-btn${route.dest === 0 ? ' empty' : ''}`, text);
    button.type = 'button'; button.disabled = readOnly; button.title = text;
    button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-label', `Destination of route ${route.index + 1}: ${text}`);
    button.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = ui.popover === route.index ? null : route.index; ui.query = ''; render(); });
    if (ui.popover !== route.index) return [button];
    const pop = element('div', 'dest-pop midi-pop'); pop.addEventListener('click', (event) => event.stopPropagation());
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search parameters'; search.value = ui.query; search.setAttribute('aria-label', 'Search parameters');
    const list = element('div', 'dest-list'); list.setAttribute('role', 'listbox');
    const choose = (id) => { ui.popover = null; controller.updateMidiRoute(route.index, 'dest', id); render(); };
    const matches = () => {
      const q = ui.query.trim().toLocaleLowerCase('en');
      return controller.destinationGroups().map((group) => ({
        group,
        items: group.items.filter((item) => item.id !== 0 && (!q || `${group.group} ${item.name}`.toLocaleLowerCase('en').includes(q))),
      })).filter(({ items }) => items.length > 0);
    };
    const fill = () => {
      list.replaceChildren();
      for (const { group, items } of matches()) {
        const head = element('div', 'dest-head'); head.dataset.mod = MODULE_KEYS[group.group] ?? 'gl'; head.append(element('span', 'mod-dot'), element('span', '', group.group));
        list.append(head);
        for (const item of items) {
          const choice = element('button', `dest-item${item.id === route.dest ? ' current' : ''}`, item.name); choice.type = 'button'; choice.dataset.mod = MODULE_KEYS[group.group] ?? 'gl';
          choice.addEventListener('click', () => choose(item.id));
          list.append(choice);
        }
      }
      if (!list.children.length) list.append(element('p', 'dest-empty', 'Nothing found'));
    };
    search.addEventListener('input', () => { ui.query = search.value; fill(); });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { ui.popover = null; render(); button.focus(); }
      else if (event.key === 'Enter') { const first = matches()[0]?.items[0]; if (first) choose(first.id); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); list.querySelector('.dest-item')?.focus(); }
    });
    pop.append(search, list); fill();
    queueMicrotask(() => search.focus());
    return [button, pop];
  }

  function depthControl(route, readOnly) {
    const box = element('div', 'midi-depth');
    const input = document.createElement('input'); input.type = 'range'; input.min = '-100'; input.max = '100'; input.step = '1'; input.value = String(route.depth);
    input.disabled = readOnly; input.setAttribute('aria-label', `Depth of route ${route.index + 1}`);
    const out = element('output', '', `${route.depth > 0 ? '+' : ''}${route.depth} %`);
    input.addEventListener('input', () => { out.textContent = `${Number(input.value) > 0 ? '+' : ''}${input.value} %`; });
    input.addEventListener('change', () => controller.updateMidiRoute(route.index, 'depth', input.value));
    box.append(input, out);
    return box;
  }

  function render() {
    const view = controller.midiRoutesView();
    if (!view) { root.replaceChildren(element('p', '', 'This firmware has no MIDI CC routing.')); return; }
    const used = view.routes.filter((route) => route.dest !== 0);
    if (used.length > ui.used) ui.extra = Math.max(0, ui.extra - (used.length - ui.used));
    ui.used = used.length;
    const empty = view.routes.filter((route) => route.dest === 0);
    const visible = [...used, ...empty.slice(0, used.length === 0 ? Math.max(1, ui.extra) : ui.extra)];
    const bar = element('div', 'page-bar');
    bar.append(element('p', 'page-hint', 'One table for the module: a row listens to a controller (or note velocity) on a channel and adds its value times the depth to a parameter. A negative depth inverts; several rows may drive one parameter.'));
    const tools = element('div', 'page-tools');
    const add = element('button', 'quiet-button', '+ Add route'); add.type = 'button';
    add.disabled = view.readOnly || empty.length <= ui.extra;
    add.addEventListener('click', () => { ui.extra += 1; render(); });
    tools.append(element('span', 'midi-count', `${used.length} of ${view.slots}`), add);
    bar.append(tools);
    const list = element('div', 'midi-list');
    // Column headers: one per visible table column (the list is 1, 2 or 3 columns wide depending on the window).
    for (const cls of ['', ' col2', ' col3']) {
      const head = element('div', `midi-head${cls}`);
      head.setAttribute('aria-hidden', 'true');
      for (const label of ['', 'Controller', 'Channel', 'Parameter', 'Depth', '']) head.append(element('span', '', label));
      list.append(head);
    }
    const perDest = new Map();
    for (const route of used) perDest.set(route.dest, (perDest.get(route.dest) ?? 0) + 1);
    for (const route of visible) {
      const sharedBy = route.dest === 0 ? 0 : perDest.get(route.dest);
      const row = element('div', `midi-row${route.dest === 0 ? ' unassigned' : ''}${sharedBy > 1 ? ' shared' : ''}`);
      if (sharedBy > 1) { row.dataset.shared = `×${sharedBy}`; row.title = `${sharedBy} routes drive this parameter; their values add up.`; }
      const group = controller.destinations.byId(route.dest)?.group;
      row.dataset.mod = MODULE_KEYS[group] ?? 'gl';
      const clear = element('button', 'midi-clear', '×'); clear.type = 'button'; clear.title = 'Remove this route'; clear.disabled = view.readOnly || route.dest === 0;
      clear.setAttribute('aria-label', `Remove route ${route.index + 1}`);
      clear.addEventListener('click', () => {
        const before = { ...route };
        controller.updateMidiRoute(route.index, 'dest', 0);
        // The row keeps its controller, channel and depth, so Undo only has to put the destination back.
        onUndo?.(`Route ${route.index + 1} removed`, () => controller.updateMidiRoute(before.index, 'dest', before.dest));
      });
      row.append(element('span', 'mod-dot'), ccSelect(route, view.readOnly), channelSelect(route, view.readOnly), ...destPicker(row, route, view.readOnly), depthControl(route, view.readOnly), clear);
      list.append(row);
    }
    root.replaceChildren(bar, list);
  }

  const onKey = (event) => { if (event.key === 'Escape') stopLearning(); };
  const onOutside = () => { if (ui.popover !== null) { ui.popover = null; render(); } };
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onOutside);
  const unsubscribe = controller.subscribe(render);
  render();
  return () => { stopLearning(); document.removeEventListener('keydown', onKey); document.removeEventListener('click', onOutside); unsubscribe?.(); root.replaceChildren(); };
}
