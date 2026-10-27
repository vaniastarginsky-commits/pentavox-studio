import { draftFromLoop, newDraft } from '../model/curve_draft.js';
import { describeLocks, exportCurve, LOCK_SLOTS, parseCurve } from '../model/knob_locks.js';
import { openCurveEditor } from './curve_editor.js';

const POLL_MS = 2000;
const SVG_NS = 'http://www.w3.org/2000/svg';
const BPM_KEY = 'pentavox.studio.curveBpm';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, onClick, { className = '', disabled = false, title = '' } = {}) {
  const node = element('button', className, label);
  node.type = 'button'; node.disabled = disabled; if (title) node.title = title;
  node.addEventListener('click', onClick);
  return node;
}

const percent = (value) => `${Math.round(value * 100)}%`;

/** The coloured top edge of a loop card follows the owner of the parameter (Plaits 1, Plaits 2, Sampler, everything else). */
export function groupTone(group = '') {
  if (/^Plaits 1/i.test(group)) return 'p1';
  if (/^Plaits 2/i.test(group)) return 'p2';
  if (/^Plaits/i.test(group)) return 'p3';
  if (/^(Sampler|Looper)/i.test(group)) return 'sam';
  return 'fx';
}

function keycap(label) { return element('kbd', '', label); }

function storedBpm() { try { return Number(localStorage.getItem(BPM_KEY)) || 120; } catch { return 120; } }
function rememberBpm(bpm) { try { localStorage.setItem(BPM_KEY, String(bpm)); } catch { /* a convenience only */ } }

/** Loop shape as an SVG polyline: time left to right, knob position bottom to top. */
export function loopShape(samples, { clocked = false, span = 0 } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 320 136'); svg.setAttribute('class', 'lock-shape');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', samples.length ? 'Recorded knob movement' : 'Empty movement window');
  const add = (tag, attrs, text) => { const n = document.createElementNS(SVG_NS, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text !== undefined) n.textContent = text; svg.append(n); return n; };
  for (let i = 0; i <= 4; i++) {
    const x = 31 + i * 69; const y = 10 + i * 26;
    add('line', { x1: x, x2: x, y1: 10, y2: 114, class: 'lock-gridline' });
    add('line', { x1: 31, x2: 307, y1: y, y2: y, class: 'lock-gridline' });
    if (i % 2 === 0) add('text', { x: 26, y: y + 3, 'text-anchor': 'end', class: 'lock-axis' }, `${100 - i * 25}%`);
    if (samples.length && span) add('text', { x, y: 129, 'text-anchor': i === 4 ? 'end' : 'middle', class: 'lock-axis' }, `${Number((span * i / 4).toFixed(2))}${i === 4 ? clocked ? ' b' : ' s' : ''}`);
  }
  if (samples.length > 1) add('polyline', { class: 'lock-trace', fill: 'none', points: samples.map((value, i) => `${(31 + i / (samples.length - 1) * 276).toFixed(1)},${(114 - Math.max(0, Math.min(1, value)) * 104).toFixed(1)}`).join(' ') });
  return svg;
}

export function mountKnobLocks(root, { getSession, onError = () => {}, onSuccess = () => {}, onUndo = null, download = saveFile, pickFile = chooseFile, openEditor = openCurveEditor } = {}) {
  let slots = null;
  let timer = null;
  let visible = false;
  let busy = false;
  const openMenus = new Set();
  let helpOpen = false;
  let selectedSlot = 0;
  let editor = null;   // the open curve editor; polling never redraws under it

  function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }
  function renderMessage(text) { root.replaceChildren(element('p', 'lock-empty', text)); }
  const destinations = () => getSession()?.destinations;
  const cannotEdit = () => busy || !getSession()?.lockComponent || slots === null || Boolean(getSession()?.readOnly);

  function slotLoop(entry) {
    return { dest: entry.dest, exit: entry.exit, samples: entry.samples, musicalTicks: entry.musicalTicks, recordBase: entry.recordBase };
  }

  function actionMenu(key, label, actions) {
    const menu = element('details', 'lock-action-menu'); menu.open = openMenus.has(key);
    const trigger = element('summary', '', label);
    trigger.setAttribute('aria-label', `${label} for loop ${key + 1}`);
    const choices = element('div', 'lock-action-choices'); choices.append(...actions);
    for (const action of actions) action.addEventListener('click', () => { openMenus.delete(key); menu.open = false; });
    menu.addEventListener('toggle', () => { if (menu.open) openMenus.add(key); else openMenus.delete(key); });
    menu.addEventListener('keydown', (event) => { if (event.key === 'Escape') { menu.open = false; openMenus.delete(key); trigger.focus(); } });
    menu.append(trigger, choices);
    return menu;
  }

  const timeOf = entry => entry.clocked ? `${Number((entry.musicalTicks / 96).toFixed(2))} beats` : `${entry.seconds.toFixed(1)} s`;
  function summaryCard(entry, known) {
    const card = element('article', `lock-card${entry.active ? ` tone-${groupTone(entry.group)}` : ' empty'}${entry.slot === selectedSlot ? ' selected' : ''}`);
    const head = element('header', 'lock-head');
    const select = button('', () => { selectedSlot = entry.slot; render(); root.querySelector?.(`[data-select-slot="${entry.slot}"]`)?.focus({ preventScroll: true }); }, { className: 'lock-select' });
    select.setAttribute('data-select-slot', String(entry.slot)); select.setAttribute('aria-label', `Select movement slot ${entry.slot + 1}`); select.setAttribute('aria-pressed', String(entry.slot === selectedSlot));
    select.append(element('span', 'lock-slot', String(entry.slot + 1)), element('span', 'lock-window-title', entry.active ? entry.name : known ? 'Empty' : 'Not connected'));
    if (entry.active) select.append(element('small', 'lock-owner', entry.group));
    head.append(select);
    if (entry.active) head.append(button('Edit', () => edit(entry.slot, draftFromLoop(slotLoop(entry), { bpm: storedBpm() })), { className: 'lock-card-edit', disabled: cannotEdit() }));
    head.append(actionMenu(entry.slot, 'More', entry.active ? [
      button('Replace from library', () => edit(entry.slot, draftFromLoop(slotLoop(entry), { bpm: storedBpm() }), { library: true }), { disabled: cannotEdit() }),
      button('Open curve file', () => openFileInto(entry.slot), { disabled: cannotEdit() }),
      button('Download curve', () => saveCurve(entry)),
      button('Erase movement', () => eraseSlots([entry.slot], `Erased ${entry.group} · ${entry.name}`), { className: 'lock-erase', disabled: cannotEdit() }),
    ] : [button('Open curve file', () => openFileInto(entry.slot), { disabled: cannotEdit() })]));
    card.append(head);
    if (!entry.active) {
      const stage = element('div', 'lock-empty-stage'); stage.append(loopShape([]));
      const choices = element('div', 'lock-empty-actions');
      choices.append(button('Draw a curve', () => edit(entry.slot, newDraft({ bpm: storedBpm() })), { className: 'lock-draw', disabled: cannotEdit() }), button('Library', () => edit(entry.slot, newDraft({ bpm: storedBpm() }), { library: true }), { disabled: cannotEdit() }));
      stage.append(choices); card.append(stage);
      return card;
    }
    const open = button('', () => edit(entry.slot, draftFromLoop(slotLoop(entry), { bpm: storedBpm() })), { className: 'lock-open', disabled: cannotEdit() });
    open.setAttribute('aria-label', `Edit loop ${entry.slot + 1}: ${entry.group} ${entry.name}`);
    open.append(loopShape(entry.samples, { clocked: entry.clocked, span: entry.clocked ? entry.musicalTicks / 96 : entry.seconds })); card.append(open);
    const facts = element('div', 'lock-window-facts'); facts.append(element('span', '', timeOf(entry)), element('span', '', entry.exit === 'Latch' ? 'Keep last value' : 'Returns to knob'));
    card.append(facts); return card;
  }

  function render() {
    const session = getSession(); const known = slots !== null;
    const placeholders = Array.from({ length: LOCK_SLOTS }, (_, slot) => ({ slot, active: false, dest: 0, samples: [], exit: 'Return', seconds: 0 }));
    const described = describeLocks(slots ?? placeholders, destinations() ?? { byId: () => null });
    const used = described.filter(entry => entry.active).length;
    const head = element('div', 'lock-toolbar');
    const hint = element('p', 'lock-record-hint', !session?.lockComponent ? session ? 'This firmware does not expose knob recording.' : 'Connect the module to read its movements, or explore the Demo.' : 'Hold B3 and turn a knob to record a movement.');
    const actions = element('div', 'lock-actions');
    const free = described.find(entry => !entry.active);
    actions.append(button('Import curve', () => openFileInto(free?.slot ?? selectedSlot), { disabled: cannotEdit() }), button('Refresh', () => poll(true), { disabled: busy || !session?.lockComponent }), element('span', 'lock-count', known ? `${used} of ${LOCK_SLOTS} slots` : `${LOCK_SLOTS} movement slots`));
    head.append(hint, actions);
    const grid = element('div', 'lock-grid');
    for (const entry of described) grid.append(summaryCard(entry, known));
    const selected = described.find(entry => entry.slot === selectedSlot) ?? described[0];
    const bar = element('div', `lock-selection-bar tone-${groupTone(selected?.group)}`);
    bar.append(element('b', '', selected?.active ? `${selected.name} · ${selected.group}` : `Slot ${selectedSlot + 1} · ${known ? 'Empty' : 'Awaiting connection'}`));
    if (selected?.active) bar.append(element('span', '', timeOf(selected)), element('span', '', selected.exit === 'Latch' ? 'Keep last value' : 'Returns to knob'));
    bar.append(button(selected?.active ? 'Edit curve' : 'Draw a curve', () => selected?.active ? edit(selected.slot, draftFromLoop(slotLoop(selected), { bpm: storedBpm() })) : edit(selectedSlot, newDraft({ bpm: storedBpm() })), { className: 'primary', disabled: cannotEdit() }));
    const help = element('details', 'lock-help'); help.open = helpOpen;
    help.append(element('summary', '', 'Recording gestures & erase'));
    help.addEventListener('toggle', () => { helpOpen = help.open; });
    const text = element('p', 'lock-hint'); text.append('Hold ', keycap('B3'), ' and move a knob to record. Hold ', keycap('B1'), ' + ', keycap('B3'), ' and move a knob to erase its movement. Keep holding the chord to erase every movement.');
    help.append(text, button('Erase all movements', () => eraseSlots(null, 'Erased all recorded movements'), { className: 'lock-erase-all', disabled: cannotEdit() || !used }));
    root.replaceChildren(head, grid, bar, help);
  }

  async function poll(announce = false) {
    const session = getSession();
    if (!session?.lockComponent || busy || editor) return;
    try {
      const next = await session.readKnobLocks();
      const changed = JSON.stringify(next) !== JSON.stringify(slots);
      const focused = root.contains?.(document.activeElement);
      slots = next;
      if (changed || announce) { render(); if (focused) root.querySelector?.(`[data-select-slot="${selectedSlot}"]`)?.focus({ preventScroll: true }); }
    }
    catch (error) { stopPolling(); if (announce || visible) onError(error); }
  }

  async function writeSlots(action) {
    busy = true; render();
    try { return await action(); } finally { busy = false; render(); }
  }

  function announce(message, result, session) {
    slots = result.slots;
    const undo = async () => {
      try {
        const restored = await writeSlots(() => session.restoreKnobLocks(result.previous));
        if (restored) { slots = restored; render(); }
      } catch (error) { onError(error); }
    };
    if (onUndo) onUndo(message, undo); else onSuccess(message);
  }

  async function eraseSlots(which, message) {
    const session = getSession();
    if (!session || cannotEdit()) return;
    try {
      const result = await writeSlots(() => session.eraseKnobLocks(which));
      announce(message, result, session);
    } catch (error) { onError(error); }
    render();
  }

  function edit(slot, draft, { library = false } = {}) {
    const session = getSession();
    if (!session || editor || cannotEdit()) return;
    selectedSlot = slot;
    const handle = openEditor({
      draft,
      destinations: destinations(),
      destinationGroups: () => session.destinationGroups(),
      title: `Loop ${slot + 1}`,
      startInLibrary: library,
      download,
      pickFile,
      onSaveBpm: rememberBpm,
      onApply: async (loop) => {
        if (session !== getSession() || cannotEdit()) throw new Error('The module is read only or busy. Reconnect before applying this movement.');
        const result = await writeSlots(() => session.writeKnobLock(slot, loop));
        announce(`Loop ${slot + 1} written to the module`, result, session);
      },
    });
    editor = handle;
    handle.dialog.addEventListener('close', () => { editor = null; render(); poll(); });
  }

  async function openFileInto(slot) {
    try {
      const text = await pickFile();
      if (text == null) return;
      const loop = parseCurve(text, destinations());
      edit(slot, draftFromLoop(loop, { bpm: storedBpm() }));
    } catch (error) { onError(error); }
  }

  function saveCurve(loop) {
    try {
      const name = (destinations().byId(loop.dest)?.symbol ?? 'curve').replace(/[^A-Za-z0-9]+/g, '_');
      download(`${name}.pvcurve.json`, JSON.stringify(exportCurve(loop, destinations()), null, 1));
    } catch (error) { onError(error); }
  }

  function show() {
    visible = true; stopPolling();
    render();
    if (!getSession()?.lockComponent) return;
    poll(true);
    timer = setInterval(poll, POLL_MS);
  }

  function hide() { visible = false; stopPolling(); }

  function refreshConnection() {
    slots = null; openMenus.clear(); stopPolling();
    editor?.close();
    if (visible) show(); else render();
  }

  render();
  return { show, hide, refreshConnection };
}

function saveFile(name, text) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function chooseFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      file.text().then(resolve, reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
