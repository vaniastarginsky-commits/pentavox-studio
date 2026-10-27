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
export function loopShape(samples) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 48');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'lock-shape');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Recorded knob movement');
  if (samples.length > 1) {
    const step = 200 / (samples.length - 1);
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('points', samples.map((value, frame) => `${(frame * step).toFixed(1)},${(46 - value * 44).toFixed(1)}`).join(' '));
    svg.append(line);
  }
  return svg;
}

export function mountKnobLocks(root, { getSession, onError = () => {}, onSuccess = () => {}, onUndo = null, download = saveFile, pickFile = chooseFile, openEditor = openCurveEditor } = {}) {
  let slots = null;
  let timer = null;
  let visible = false;
  let busy = false;
  const openMenus = new Set();
  let helpOpen = false;
  let editor = null;   // the open curve editor; polling never redraws under it

  function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }
  function renderMessage(text) { root.replaceChildren(element('p', 'lock-empty', text)); }
  const destinations = () => getSession()?.destinations;
  const cannotEdit = () => busy || Boolean(getSession()?.readOnly);

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

  function summaryCard(entry) {
    const card = element('article', `lock-card${entry.active ? ` tone-${groupTone(entry.group)}` : ' empty'}`);
    const head = element('header', 'lock-head');
    head.append(element('span', 'lock-slot', `Loop ${entry.slot + 1}`), element('span', 'lock-secs', entry.active ? `${entry.seconds.toFixed(1)} s` : 'Free'));
    card.append(head);
    const title = element('div', 'lock-title');
    title.append(element('b', '', entry.name), element('small', '', entry.group));
    const open = element('button', 'lock-open');
    open.type = 'button'; open.disabled = cannotEdit();
    open.title = 'Open the curve editor';
    open.setAttribute('aria-label', `Edit loop ${entry.slot + 1}: ${entry.group} ${entry.name}`);
    open.append(loopShape(entry.samples));
    open.addEventListener('click', () => edit(entry.slot, draftFromLoop(slotLoop(entry), { bpm: storedBpm() })));
    card.append(title, open);
    const facts = element('div', 'lock-metrics');
    for (const [label, value] of [
      ['Range', `${percent(entry.min)}–${percent(entry.max)}`],
      ['Timing', entry.clocked ? `${entry.musicalTicks / 96} beats` : 'Free running'],
      ['When stopped', entry.exit === 'Latch' ? 'Keep last value' : 'Return to knob'],
    ]) { const fact = element('span'); fact.append(element('small', '', label), element('b', '', value)); facts.append(fact); }
    card.append(facts);
    const tools = element('div', 'lock-tools');
    tools.append(
      button('Edit curve', () => edit(entry.slot, draftFromLoop(slotLoop(entry), { bpm: storedBpm() })), { disabled: cannotEdit() }),
      actionMenu(entry.slot, 'More', [
        button('Replace from library', () => edit(entry.slot, draftFromLoop(slotLoop(entry), { bpm: storedBpm() }), { library: true }), { disabled: cannotEdit() }),
        button('Open curve file', () => openFileInto(entry.slot), { disabled: cannotEdit() }),
        button('Download curve', () => saveCurve(entry), { title: 'Download this curve as a file' }),
        button('Erase movement', () => eraseSlots([entry.slot], `Erased ${entry.group} · ${entry.name}`), { className: 'lock-erase', disabled: busy }),
      ]),
    );
    card.append(tools);
    return card;
  }

  function render() {
    if (!getSession()?.lockComponent) {
      renderMessage(getSession() ? 'This firmware has no recorded knob movements.' : 'Connect Pentavox to see recorded knob movements.');
      return;
    }
    const described = describeLocks(slots ?? [], destinations());
    const used = described.filter((entry) => entry.active).length;
    const head = element('div', 'lock-toolbar');
    const intro = element('div', 'lock-intro');
    intro.append(element('h2', '', 'Knob record'), element('p', 'lock-lede', 'Edit recorded movements or add a curve. Changes apply to the playing module at once.'));
    const actions = element('div', 'lock-actions');
    const count = element('span', 'lock-count'); count.append(element('b', '', String(used)), ` of ${LOCK_SLOTS} loops in use`);
    actions.append(
      count,
      button('Refresh', () => poll(true)),
      button('Erase all', () => eraseSlots(null, 'Erased all recorded movements'), { className: 'lock-erase-all', disabled: cannotEdit() || used === 0 }),
    );
    const free = described.filter(entry => !entry.active);
    if (free.length) {
      const slot = free[0].slot;
      actions.prepend(actionMenu(slot, 'Add movement', [
        button('Draw a curve', () => edit(slot, newDraft({ bpm: storedBpm() })), { disabled: cannotEdit() }),
        button('Choose from library', () => edit(slot, newDraft({ bpm: storedBpm() }), { library: true }), { disabled: cannotEdit() }),
        button('Open curve file', () => openFileInto(slot), { disabled: cannotEdit() }),
      ]));
    }
    head.append(intro, actions);
    const help = element('details', 'lock-help'); help.open = helpOpen;
    help.append(element('summary', '', 'Record on the module'));
    help.addEventListener('toggle', () => { helpOpen = help.open; });
    const hint = element('p', 'lock-hint');
    hint.append('Hold ', keycap('B3'), ' and move a knob: it records until you let go, then loops. Hold ', keycap('B1'), ' + ', keycap('B3'), ' and move a knob to erase its loop; keep holding the chord to erase every loop on the module.');
    help.append(hint, element('p', 'lock-refresh-note', 'Studio checks for new recordings every 2 seconds while this page is open.'));
    const grid = element('div', 'lock-grid');
    for (const entry of described.filter(entry => entry.active)) grid.append(summaryCard(entry));
    const available = element('p', 'lock-available', free.length ? `Free slots: ${free.map(entry => entry.slot + 1).join(', ')}. Add movement uses slot ${free[0].slot + 1}.` : 'All movement slots are in use. Edit or erase an existing movement to make room.');
    if (!used) grid.append(element('p', 'lock-empty', 'No recorded movements yet. Hold B3 and move a knob on the module, or add a curve here.'));
    root.replaceChildren(head, available, help, grid);
  }

  async function poll(announce = false) {
    const session = getSession();
    if (!session?.lockComponent || busy || editor) return;
    try {
      slots = await session.readKnobLocks();
      if (!root.contains?.(document.activeElement) || announce) render();
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
    if (visible) show(); else renderMessage(getSession() ? 'Open this tab to read the module.' : 'Connect Pentavox to see recorded knob movements.');
  }

  renderMessage('Connect Pentavox to see recorded knob movements.');
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
