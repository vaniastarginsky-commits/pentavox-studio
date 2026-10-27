import { placePopover } from './popover_place.js';
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
const MODULE_KEYS = Object.freeze({ 'Plaits 1': 'p1', 'Plaits 2': 'p2', 'Plaits 3': 'p3', 'Sampler 1': 's1', 'Sampler 2': 's2', 'Looper': 's1', 'FX': 'fx', 'Global': 'gl' });
export const VELOCITY = 128;
const depthText = (value) => `${value > 0 ? '+' : value < 0 ? '\u2212' : ''}${Math.abs(value)} %`;
const setFill = (input) => input.style.setProperty('--p', `${(Number(input.value) + 100) / 2}%`);
export const ccLabel = (cc) => (cc === VELOCITY ? 'Note velocity' : CC_NAMES[cc] ? `CC ${cc} · ${CC_NAMES[cc]}` : `CC ${cc}`);
export const midiLearnFeedback = ({ cc, channel }) => `Learned ${ccLabel(cc)} · Channel ${channel}`;

export function mountMidiRouting(root, controller, { onError = () => {}, onUndo = null, learn = learnNextMessage } = {}) {
  root.classList.add('cc-page');
  const ui = { extra: 0, used: 0, learning: null, learned: '', popover: null, query: '', filter: 'All' };   // blank rows the user asked for; a blank row that got a destination stops counting

  function ccSelect(route, readOnly) {
    const select = element('select', 'cc-ccsel'); select.disabled = readOnly; select.setAttribute('aria-label', `Controller of route ${route.index + 1}`);
    const velocity = new Option(ccLabel(VELOCITY), String(VELOCITY)); select.append(velocity);
    for (let cc = 0; cc < 128; ++cc) select.append(new Option(ccLabel(cc), String(cc)));
    select.value = String(route.cc);
    select.addEventListener('change', () => controller.updateMidiRoute(route.index, 'cc', select.value));
    // The Learn column stays (empty) where the browser has no Web MIDI, so the table columns line up.
    const learnCell = typeof globalThis.navigator?.requestMIDIAccess === 'function' ? learnButton(route, readOnly) : element('span');
    return [select, learnCell];
  }

  function stopLearning() { ui.learning?.abort.abort(); }

  function learnButton(route, readOnly) {
    const active = ui.learning?.index === route.index;
    const button = element('button', `cc-quiet cc-learn${active ? ' on' : ''}`, active ? 'Cancel' : 'Learn');
    button.type = 'button'; button.disabled = readOnly;
    button.title = active ? 'Listening: move a knob or press a key on your MIDI controller (Esc cancels)' : 'Fill controller and channel from the next MIDI message your controller sends';
    button.setAttribute('aria-label', active ? `Cancel learning for route ${route.index + 1}` : `Learn controller of route ${route.index + 1}`);
    button.addEventListener('click', async () => {
      if (active) { stopLearning(); return; }
      stopLearning();
      const abort = new AbortController();
      ui.learned = ''; ui.learning = { index: route.index, abort };
      render();
      try {
        const { cc, channel } = await learn({ signal: abort.signal });
        if (abort.signal.aborted || ui.learning?.abort !== abort) return;
        controller.updateMidiRoute(route.index, 'cc', cc);
        controller.updateMidiRoute(route.index, 'ch', channel);
        ui.learned = midiLearnFeedback({ cc, channel });
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
    const select = element('select', 'cc-chsel'); select.disabled = readOnly; select.setAttribute('aria-label', `Channel of route ${route.index + 1}`);
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
    const wrap = element('div', 'cc-dwrap');
    const label = route.dest === 0 ? 'Choose a parameter…' : entry ? `${entry.group} · ${entry.name}` : controller.destinations.label(route.dest);   // a removed destination stays visible
    const button = element('button', `cc-dbtn${route.dest === 0 ? ' empty' : ''}`); button.type = 'button'; button.disabled = readOnly; button.title = label;
    button.dataset.midiPicker = String(route.index);
    if (route.dest === 0 || !entry) button.append(element('span', 'cc-muted', label));
    else { const text = element('span', 'cc-dtext'); text.append(element('small', '', entry.group), element('strong', '', entry.name)); button.append(text); }
    button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-label', `Destination of route ${route.index + 1}: ${label}`);
    button.addEventListener('click', (event) => { event.stopPropagation(); ui.popover = ui.popover === route.index ? null : route.index; ui.query = ''; render(); });
    wrap.append(button);
    if (ui.popover !== route.index) return wrap;
    const pop = element('div', 'cc-pop'); pop.addEventListener('click', (event) => event.stopPropagation());
    pop.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); ui.popover = null; render(); root.querySelector(`[data-midi-picker="${route.index}"]`)?.focus(); } });
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search parameters'; search.value = ui.query; search.setAttribute('aria-label', 'Search parameters');
    const list = element('div', 'cc-poplist'); list.setAttribute('role', 'listbox');
    const choose = (id) => {
      ui.popover = null;
      // The table follows the route: a parameter of another module moves the row to that target's tab.
      const target = tabOf(id);
      if (ui.filter !== 'All' && target && target !== ui.filter) ui.filter = target;
      controller.updateMidiRoute(route.index, 'dest', id); render();
    };
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
        const head = element('h6', ''); head.dataset.mod = MODULE_KEYS[group.group] ?? 'gl'; head.append(element('span', 'cc-ddot'), group.group);
        list.append(head);
        for (const item of items) {
          const choice = element('button', `cc-pi${item.id === route.dest ? ' cur' : ''}`, item.name); choice.type = 'button'; choice.dataset.mod = MODULE_KEYS[group.group] ?? 'gl';
          choice.addEventListener('click', () => choose(item.id));
          list.append(choice);
        }
      }
      if (!list.children.length) list.append(element('p', 'cc-nf', 'Nothing found'));
    };
    search.addEventListener('input', () => { ui.query = search.value; fill(); });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); ui.popover = null; render(); root.querySelector(`[data-midi-picker="${route.index}"]`)?.focus(); }
      else if (event.key === 'Enter') { event.preventDefault(); const first = matches()[0]?.items[0]; if (first) choose(first.id); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); list.querySelector('.cc-pi')?.focus(); }
    });
    pop.append(search, list); fill(); wrap.append(pop);
    queueMicrotask(() => { placePopover(button, pop); search.focus(); });
    return wrap;
  }

  function depthControl(route, readOnly) {
    const box = element('div', 'cc-mdep');
    const input = document.createElement('input'); input.type = 'range'; input.min = '-100'; input.max = '100'; input.step = '1'; input.value = String(route.depth);
    input.disabled = readOnly; input.setAttribute('aria-label', `Depth of route ${route.index + 1}`); setFill(input);
    const out = element('output', '', depthText(route.depth));
    input.addEventListener('input', () => { out.textContent = depthText(Number(input.value)); setFill(input); });
    input.addEventListener('change', () => controller.updateMidiRoute(route.index, 'depth', input.value));
    box.append(input, out);
    return box;
  }

  // Target tabs come from the destination groups the firmware offers; "Global" reads as "Master".
  const tabLabel = (group) => (group === 'Global' ? 'Master' : group);
  const tabOf = (destId) => { const entry = destId ? controller.destinations.byId(destId) : null; return entry ? tabLabel(entry.group) : null; };

  function render() {
    const view = controller.midiRoutesView();
    if (!view) { root.replaceChildren(element('p', '', 'This firmware has no MIDI CC routing.')); return; }
    const used = view.routes.filter((route) => route.dest !== 0);
    if (used.length > ui.used) ui.extra = Math.max(0, ui.extra - (used.length - ui.used));
    ui.used = used.length;
    const empty = view.routes.filter((route) => route.dest === 0);
    const blank = empty.slice(0, used.length === 0 ? Math.max(1, ui.extra) : ui.extra);   // blank rows stay visible on every tab until they get a parameter
    const names = [...new Set(controller.destinationGroups().map((group) => tabLabel(group.group)))];
    const tabs = ['All', ...names.filter((name) => name !== 'Master'), ...names.filter((name) => name === 'Master')];
    if (!tabs.includes(ui.filter)) ui.filter = 'All';
    const countOf = (tab) => (tab === 'All' ? used.length : used.filter((route) => tabOf(route.dest) === tab).length);
    const visible = [...used.filter((route) => ui.filter === 'All' || tabOf(route.dest) === ui.filter), ...blank];

    const head = element('div', 'cc-head');
    head.append(element('p', 'cc-lead', 'MIDI controller → parameter. Use Learn to capture a control and its channel; depth sets how much it adds.'));
    const count = element('span', 'cc-count'); count.append(element('b', '', String(used.length)), ` of ${view.slots}`);
    head.append(count);
    if (ui.learning || ui.learned) {
      const feedback = element('div', 'workflow-midi-feedback'); feedback.setAttribute('role', 'status');
      feedback.append(element('span', '', ui.learning ? `Move a MIDI control · Route ${ui.learning.index + 1}` : ui.learned));
      if (ui.learning) { const cancel = element('button', '', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', stopLearning); feedback.append(cancel); }
      head.append(feedback);
    }

    const card = element('section', 'cc-card');
    const header = element('header');
    const seg = element('div', 'cc-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Show target');
    for (const tab of tabs) {
      const button = element('button', ui.filter === tab ? 'active' : ''); button.type = 'button'; button.setAttribute('aria-pressed', String(ui.filter === tab));
      button.append(`${tab} `, element('small', '', String(countOf(tab))));
      button.addEventListener('click', () => { ui.filter = tab; ui.popover = null; render(); });
      seg.append(button);
    }
    const add = element('button', 'cc-btn', '+ Add route'); add.type = 'button';
    add.disabled = view.readOnly || empty.length <= ui.extra;
    add.addEventListener('click', () => { ui.extra += 1; render(); });
    header.append(seg, element('span', 'cc-sp'), add);
    card.append(header);

    const perDest = new Map();
    for (const route of used) perDest.set(route.dest, (perDest.get(route.dest) ?? 0) + 1);
    if (!visible.length) {
      const box = element('div', 'cc-body'); const note = element('div', 'cc-empty');
      note.append(element('b', '', `No routes for ${ui.filter === 'All' ? 'the module' : ui.filter}`), 'Press “+ Add route” and pick a controller and a parameter.');
      box.append(note); card.append(box);
    } else {
      const table = element('div', 'cc-mtable');
      const columns = element('div', 'cc-mhead'); columns.setAttribute('aria-hidden', 'true');
      for (const label of ['', 'Controller', '', 'Channel', 'Parameter', 'Depth', '']) columns.append(element('span', '', label));
      table.append(columns);
      for (const route of visible) {
        const sharedBy = route.dest === 0 ? 0 : perDest.get(route.dest);
        const row = element('div', `cc-mrow${route.dest === 0 ? ' unassigned' : ''}${sharedBy > 1 ? ' shared' : ''}`);
        if (sharedBy > 1) row.title = `${sharedBy} routes drive this parameter; their values add up.`;
        const group = controller.destinations.byId(route.dest)?.group;
        row.dataset.mod = MODULE_KEYS[group] ?? 'gl';
        const clear = element('button', 'cc-quiet cc-danger', '×'); clear.type = 'button'; clear.title = 'Remove this route'; clear.disabled = view.readOnly || route.dest === 0;
        clear.setAttribute('aria-label', `Remove route ${route.index + 1}`);
        clear.addEventListener('click', () => {
          const before = { ...route };
          controller.updateMidiRoute(route.index, 'dest', 0);
          // The row keeps its controller, channel and depth, so Undo only has to put the destination back.
          onUndo?.(`Route ${route.index + 1} removed`, () => controller.updateMidiRoute(before.index, 'dest', before.dest));
        });
        const depth = depthControl(route, view.readOnly);
        if (sharedBy > 1) { const badge = element('span', 'cc-badge', `×${sharedBy}`); badge.title = `${sharedBy} routes drive this parameter; their values add up.`; badge.dataset.shared = ''; depth.append(badge); }
        row.append(element('span', 'cc-ddot'), ...ccSelect(route, view.readOnly), channelSelect(route, view.readOnly), destPicker(row, route, view.readOnly), depth, clear);
        table.append(row);
      }
      card.append(table);
    }
    root.replaceChildren(head, card);
  }

  const onKey = (event) => { if (event.key === 'Escape') stopLearning(); };
  const onOutside = () => { if (ui.popover !== null) { ui.popover = null; render(); } };
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onOutside);
  const unsubscribe = controller.subscribe(render);
  render();
  return () => { stopLearning(); document.removeEventListener('keydown', onKey); document.removeEventListener('click', onOutside); unsubscribe?.(); root.replaceChildren(); };
}
