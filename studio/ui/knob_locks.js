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
  let editor = null;   // the open curve editor; polling never redraws under it

  function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }
  function renderMessage(text) { root.replaceChildren(element('p', 'lock-empty', text)); }
  const destinations = () => getSession()?.destinations;

  function slotLoop(entry) {
    return { dest: entry.dest, exit: entry.exit, samples: entry.samples, musicalTicks: entry.musicalTicks, recordBase: entry.recordBase };
  }

  function summaryCard(entry) {
    const card = element('article', `lock-card${entry.active ? '' : ' empty'}`);
    const head = element('header', 'lock-head');
    head.append(element('span', 'lock-slot', `Loop ${entry.slot + 1}`));
    if (!entry.active) {
      card.append(head, element('p', 'lock-free', 'Free. Hold B3 and move a knob to record one, or draw it here.'));
      const tools = element('div', 'lock-tools');
      tools.append(
        button('New curve', () => edit(entry.slot, newDraft({ bpm: storedBpm() })), { disabled: busy }),
        button('Curves', () => edit(entry.slot, newDraft({ bpm: storedBpm() }), { library: true }), { disabled: busy, title: 'Start from a ready-made curve' }),
        button('Open file', () => openFileInto(entry.slot), { disabled: busy }),
      );
      card.append(tools);
      return card;
    }
    const title = element('div', 'lock-title');
    title.append(element('b', '', entry.name), element('small', '', entry.group));
    head.append(title);
    const open = element('button', 'lock-open');
    open.type = 'button'; open.disabled = busy;
    open.title = 'Open the editor';
    open.setAttribute('aria-label', `Edit loop ${entry.slot + 1}: ${entry.group} ${entry.name}`);
    open.append(loopShape(entry.samples));
    open.addEventListener('click', () => edit(entry.slot, draftFromLoop(slotLoop(entry), { bpm: storedBpm() })));
    card.append(head, open);
    card.append(element('p', 'lock-facts', [`${entry.seconds.toFixed(1)} s`, `range ${percent(entry.min)}–${percent(entry.max)}`,
      entry.exit === 'Latch' ? 'latches where it stops' : 'returns to the knob', entry.clocked ? `synced, ${entry.musicalTicks / 96} beats` : 'free running'].join(' · ')));
    const tools = element('div', 'lock-tools');
    tools.append(
      button('Edit', () => edit(entry.slot, draftFromLoop(slotLoop(entry), { bpm: storedBpm() })), { disabled: busy }),
      button('Curves', () => edit(entry.slot, draftFromLoop(slotLoop(entry), { bpm: storedBpm() }), { library: true }), { disabled: busy, title: 'Replace this loop with a ready-made curve' }),
      button('Save file', () => saveCurve(entry), { title: 'Download this curve as a file' }),
      button('Erase', () => eraseSlots([entry.slot], `Erased ${entry.group} · ${entry.name}`), { className: 'lock-erase', disabled: busy }),
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
    head.append(element('h2', '', 'Knob record'), element('span', 'lock-count', `${used} of ${LOCK_SLOTS} loops in use`));
    head.append(
      button('Refresh', () => poll(true)),
      button('Erase all', () => eraseSlots(null, 'Erased all recorded movements'), { className: 'lock-erase-all', disabled: busy || used === 0 }),
    );
    const hint = element('p', 'lock-hint', 'Hold B3 and move a knob to record its movement as a loop, or open a loop to edit it, or start a new curve. Erase on the module with B1+B3 and a knob (hold the chord for all). Changes apply to the playing module at once.');
    const grid = element('div', 'lock-grid');
    for (const entry of described) grid.append(summaryCard(entry));
    root.replaceChildren(head, hint, grid);
  }

  async function poll(announce = false) {
    const session = getSession();
    if (!session?.lockComponent || busy || editor) return;
    try { slots = await session.readKnobLocks(); render(); }
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
    if (!session || busy) return;
    try {
      const result = await writeSlots(() => session.eraseKnobLocks(which));
      announce(message, result, session);
    } catch (error) { onError(error); }
    render();
  }

  function edit(slot, draft, { library = false } = {}) {
    const session = getSession();
    if (!session || editor) return;
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
    slots = null; stopPolling();
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
