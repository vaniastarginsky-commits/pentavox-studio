import { BEAT_CHOICES, lengthSeconds, loopFromDraft, zeroLevel } from '../model/curve_draft.js';
import { CATEGORIES, CURVES } from '../model/curve_library.js';
import { bendForMidpoint, evalCurve, fromSamples, insertPoint, invertPoints, movePoint, removePoint, reversePoints, setBend, snapValue, spliceStroke, stampCells, toggleEase, toSamples } from '../model/curve_points.js';
import { exportCurve, paintCurve, parseCurve } from '../model/knob_locks.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 1000; const H = 380;
const PAD = { left: 30, right: 30, top: 16, bottom: 28 };
const PLOT = { x: PAD.left, y: PAD.top, w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom };
const POINT_HIT = 15; const HANDLE_HIT = 12;
const LIBRARY_KEY = 'pentavox.studio.curves';
const NOT_LOCKABLE = /^(Voice\dModel|Sampler\dSlot)$/;

const TOOLS = [
  { id: 'pointer', label: 'Points: drag to move, drag the white dot to bend, double-click to add or remove', icon: 'M5 3l12 8-5.2 1.3L9.5 18z' },
  { id: 'pencil', label: 'Pencil: draw freehand', icon: 'M4 16l1-4 9-9 3 3-9 9zM12 5l3 3' },
  { id: 'square', label: 'Square: drag across the grid to fill it with square pulses', icon: 'M3 15V6h5v9h5V6h4' },
  { id: 'sawDown', label: 'Ramp down: drag across the grid to fill it', icon: 'M3 5l6 10V5l6 10' },
  { id: 'sawUp', label: 'Ramp up: drag across the grid to fill it', icon: 'M3 15L9 5v10l6-10' },
  { id: 'triangle', label: 'Triangle: drag across the grid to fill it', icon: 'M2 15l4-10 4 10 4-10 3 10' },
  { id: 'sine', label: 'Sine: drag across the grid to fill it', icon: 'M2 10c2-9 5-9 7 0s5 9 8 0' },
];
const SHAPE_TOOLS = new Set(['square', 'sawDown', 'sawUp', 'triangle', 'sine']);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(tag, attributes = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function icon(path) {
  const root = svg('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true', class: 'tool-icon' });
  root.append(svg('path', { d: path, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return root;
}

function button(label, onClick, { className = '', title = '', disabled = false } = {}) {
  const node = el('button', className, label);
  node.type = 'button'; node.disabled = disabled;
  if (title) node.title = title;
  node.addEventListener('click', onClick);
  return node;
}

function option(select, value, label) { select.append(new Option(label, String(value))); }

function field(label, control) {
  const wrap = el('label', 'ce-field');
  wrap.append(el('span', '', label), control);
  return wrap;
}

function numberInput(value, { min, max, step }, onInput) {
  const input = el('input', 'ce-number');
  input.type = 'number'; input.min = min; input.max = max; input.step = step; input.value = String(value);
  input.addEventListener('input', () => { const number = Number(input.value); if (Number.isFinite(number)) onInput(number); });
  return input;
}

function readLibrary() {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]').filter((item) => Array.isArray(item.points)); } catch { return []; }
}

function writeLibrary(items) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(items)); return true; } catch { return false; }
}

/** A curve as a bare line drawing (no box, like a sketch of the shape). `detail` is how many samples the line is drawn from. */
export function curveThumb(points, { detail = 120, large = false } = {}) {
  const root = svg('svg', { viewBox: '0 0 240 80', preserveAspectRatio: 'none', class: `ce-thumb${large ? ' large' : ''}`, 'aria-hidden': 'true' });
  const samples = toSamples(points, detail);
  root.append(svg('polyline', { points: samples.map((value, index) => `${(2 + index * 236 / (detail - 1)).toFixed(1)},${(76 - value * 72).toFixed(1)}`).join(' ') }));
  return root;
}

/**
 * Opens the large curve editor. `draft` is mutated while editing; nothing reaches the module until Apply.
 * onApply(loop) may return a promise; if it throws the dialog stays open and shows the message.
 */
export function openCurveEditor({ draft, destinations, destinationGroups = () => destinations.groups(), title = 'Edit curve', startInLibrary = false, onApply, onSaveBpm = () => {}, download, pickFile }) {
  const dialog = el('dialog', 'curve-dialog');
  dialog.setAttribute('aria-label', title);
  document.body.append(dialog);

  const state = {
    tool: 'pointer', snap: true, perBeat: 4, freeCols: 16, rows: 4,
    selected: null, hover: null, history: [], future: [], drag: null, preview: null, previewPoints: null, view: startInLibrary ? 'library' : 'edit', category: 'All', query: '', libSelection: null,
    busy: false, error: '', status: '',
  };
  const gridCols = () => (draft.mode === 'sync' ? Math.min(128, Math.round(draft.beats * state.perBeat)) : state.freeCols);

  // ---- history -------------------------------------------------------------
  const snapshot = () => JSON.stringify(draft.points);
  function commit(points) {
    state.history.push(snapshot()); if (state.history.length > 100) state.history.shift();
    state.future = [];
    draft.points = points;
  }
  function undo() { if (!state.history.length) return; state.future.push(snapshot()); draft.points = JSON.parse(state.history.pop()); state.selected = null; refresh(); }
  function redo() { if (!state.future.length) return; state.history.push(snapshot()); draft.points = JSON.parse(state.future.pop()); state.selected = null; refresh(); }

  // ---- coordinates -----------------------------------------------------------
  const toView = (x, y) => [PLOT.x + x * PLOT.w, PLOT.y + (1 - y) * PLOT.h];
  const plate = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ce-plate', role: 'application', tabindex: '0' });
  plate.setAttribute('aria-label', 'Curve plate. Arrow keys nudge the selected point.');
  function fromEvent(event) {
    const box = plate.getBoundingClientRect();
    const vx = ((event.clientX - box.left) / box.width) * W; const vy = ((event.clientY - box.top) / box.height) * H;
    return { vx, vy, x: Math.min(1, Math.max(0, (vx - PLOT.x) / PLOT.w)), y: Math.min(1, Math.max(0, 1 - (vy - PLOT.y) / PLOT.h)) };
  }
  const snapped = (position, event) => (state.snap && !event.altKey
    ? { x: snapValue(position.x, gridCols()), y: snapValue(position.y, state.rows) }
    : { x: position.x, y: position.y });

  // ---- plate rendering ---------------------------------------------------------
  function drawGrid() {
    const group = svg('g', { class: 'ce-grid' });
    const cols = gridCols();
    const sync = draft.mode === 'sync';
    const major = sync ? state.perBeat : Math.max(1, cols / 4);
    for (let col = 0; col <= cols; ++col) {
      const [x] = toView(col / cols, 0);
      group.append(svg('line', { x1: x, x2: x, y1: PLOT.y, y2: PLOT.y + PLOT.h, class: col % major === 0 ? 'major' : 'minor' }));
    }
    for (let row = 0; row <= state.rows; ++row) {
      const [, y] = toView(0, row / state.rows);
      group.append(svg('line', { x1: PLOT.x, x2: PLOT.x + PLOT.w, y1: y, y2: y, class: row === 0 || row === state.rows || row * 2 === state.rows ? 'major' : 'minor' }));
    }
    // Time labels sit on the major lines: beats when synced, seconds otherwise.
    const seconds = lengthSeconds(draft);
    const labels = sync ? draft.beats : 4;
    for (let index = 0; index < labels; ++index) {
      const [x] = toView(index / labels, 0);
      const text = svg('text', { x: x + 5, y: H - 9, class: 'ce-tick' });
      text.textContent = sync ? String(index + 1) : `${(seconds * index / labels).toFixed(seconds < 4 ? 2 : 1)} s`;
      group.append(text);
    }
    return group;
  }

  function curvePath(sampler) {
    const steps = 480; const coordinates = [];
    for (let step = 0; step <= steps; ++step) {
      const x = step / steps; const [vx, vy] = toView(x, sampler(x));
      coordinates.push(`${vx.toFixed(1)},${vy.toFixed(1)}`);
    }
    return coordinates;
  }

  function drawCurve() {
    const group = svg('g');
    const dense = state.preview;
    const shown = state.previewPoints ?? draft.points;
    const sampler = dense ? (x) => dense[Math.round(x * (dense.length - 1))] : (x) => evalCurve(shown, x);
    const coordinates = curvePath(sampler);
    // The zero level is "no change to the knob": the fill reaches from it to the curve, so you see what the loop adds or takes away.
    const zero = zeroLevel(draft); const [, zeroY] = toView(0, zero);
    group.append(svg('polygon', { points: `${PLOT.x},${zeroY} ${coordinates.join(' ')} ${PLOT.x + PLOT.w},${zeroY}`, class: 'ce-fill' }));
    group.append(svg('line', { x1: PLOT.x, x2: PLOT.x + PLOT.w, y1: zeroY, y2: zeroY, class: 'ce-zero' }));
    const asRecorded = draft.recordedBase !== undefined && Math.abs(zero - draft.recordedBase) < 0.005 && !draft.bipolar;
    const label = svg('text', { x: PLOT.x + PLOT.w - 6, y: zeroY + (zero > 0.85 ? 16 : -6), class: 'ce-zero-label', 'text-anchor': 'end' });
    label.textContent = `no change · ${Math.round(zero * 100)}%${asRecorded ? ' (where the knob was recorded)' : ''}`;
    group.append(label);
    group.append(svg('polyline', { points: coordinates.join(' '), class: 'ce-line' }));
    if (dense || state.previewPoints) return group;
    draft.points.forEach((point, index) => {
      const next = draft.points[index + 1];
      if (next && next.x > point.x && next.y !== point.y) {
        const middle = (point.x + next.x) / 2;
        const [hx, hy] = toView(middle, evalCurve(draft.points, middle));
        group.append(svg('circle', { cx: hx, cy: hy, r: 5, class: 'ce-handle', 'data-handle': String(index) }));
      }
    });
    draft.points.forEach((point, index) => {
      const [vx, vy] = toView(point.x, point.y);
      group.append(svg('circle', { cx: vx, cy: vy, r: state.selected === index ? 9 : 7, class: `ce-point${state.selected === index ? ' selected' : ''}`, 'data-point': String(index) }));
    });
    return group;
  }

  function drawOverlay() { return svg('g'); }

  function renderPlate() { plate.replaceChildren(drawGrid(), drawCurve(), drawOverlay()); }

  const rowSnap = (value, event) => (state.snap && !event.altKey ? snapValue(value, state.rows) : value);
  function previewStamp() {
    const drag = state.drag;
    const peaks = [];
    for (let cell = drag.first; cell <= drag.last; ++cell) peaks.push(drag.peaks.get(cell) ?? zeroLevel(draft));
    state.previewPoints = stampCells(draft.points, drag.first, peaks, drag.cols, state.tool, zeroLevel(draft));
  }

  // ---- pointer handling ---------------------------------------------------------
  function hitTest(position) {
    const near = (x, y, radius) => Math.hypot(position.vx - toView(x, y)[0], position.vy - toView(x, y)[1]) <= radius;
    let best = -1; let bestDistance = POINT_HIT;
    draft.points.forEach((point, index) => {
      const [px, py] = toView(point.x, point.y);
      const distance = Math.hypot(position.vx - px, position.vy - py);
      if (distance <= bestDistance) { best = index; bestDistance = distance; }
    });
    if (best >= 0) return { point: best };
    const zeroView = toView(0, zeroLevel(draft))[1];
    for (let index = 0; index < draft.points.length - 1; ++index) {
      const a = draft.points[index]; const b = draft.points[index + 1];
      if (b.x > a.x && b.y !== a.y && near((a.x + b.x) / 2, evalCurve(draft.points, (a.x + b.x) / 2), HANDLE_HIT)) return { handle: index };
    }
    if (Math.abs(position.vy - zeroView) <= 9 && position.vx >= PLOT.x && position.vx <= PLOT.x + PLOT.w) return { zero: true };
    return {};
  }

  plate.addEventListener('pointerdown', (event) => {
    if (state.busy || event.button !== 0) return;
    plate.focus({ preventScroll: true });
    const position = fromEvent(event);
    plate.setPointerCapture(event.pointerId);
    if (state.tool === 'pointer') {
      const hit = hitTest(position);
      if (hit.point !== undefined) { state.selected = hit.point; state.drag = { kind: 'point', index: hit.point, before: snapshot(), moved: false }; }
      else if (hit.handle !== undefined) { state.selected = hit.handle; state.drag = { kind: 'bend', index: hit.handle, before: snapshot(), moved: false }; }
      else if (hit.zero) { state.selected = null; state.drag = { kind: 'zero' }; }
      else { state.selected = null; state.drag = null; }
    } else if (state.tool === 'pencil') {
      const dense = toSamples(draft.points, 401);
      const frame = Math.round(position.x * 400);
      dense[frame] = position.y;
      state.preview = dense;
      state.drag = { kind: 'pencil', frame, value: position.y, from: position.x, to: position.x };
    } else if (SHAPE_TOOLS.has(state.tool)) {
      // Each grid cell gets one cycle whose peak follows the mouse height as it crosses that cell.
      const cols = gridCols(); const cell = Math.min(cols - 1, Math.floor(position.x * cols));
      state.drag = { kind: 'stamp', cols, first: cell, last: cell, peaks: new Map([[cell, rowSnap(position.y, event)]]), lastCell: cell, lastY: rowSnap(position.y, event) };
      previewStamp();
    }
    light();
  });

  plate.addEventListener('pointermove', (event) => {
    const position = fromEvent(event);
    state.hover = position;
    const drag = state.drag;
    if (!drag) {
      if (state.tool === 'pointer') { const hit = hitTest(position); plate.style.cursor = hit.point !== undefined ? 'grab' : hit.handle !== undefined || hit.zero ? 'ns-resize' : ''; } else plate.style.cursor = '';
      updateReadout(); return;
    }
    if (drag.kind === 'zero') {
      const level = Math.min(1, Math.max(0, rowSnap(position.y, event)));
      draft.recordBase = level; draft.bipolar = Math.abs(level - 0.5) < 0.005;
      light(); renderFooter(); return;
    }
    if (drag.kind === 'point') {
      const target = snapped(position, event);
      draft.points = movePoint(draft.points, drag.index, target.x, target.y);
      drag.moved = true;
    } else if (drag.kind === 'bend') {
      const a = draft.points[drag.index]; const b = draft.points[drag.index + 1];
      draft.points = setBend(draft.points, drag.index, bendForMidpoint(a, b, position.y));
      drag.moved = true;
    } else if (drag.kind === 'pencil') {
      const frame = Math.round(position.x * 400);
      state.preview = paintCurve(state.preview, drag.frame, frame, drag.value, position.y);
      drag.frame = frame; drag.value = position.y;
      drag.from = Math.min(drag.from, position.x); drag.to = Math.max(drag.to, position.x);
    } else if (drag.kind === 'stamp') {
      const cell = Math.min(drag.cols - 1, Math.floor(position.x * drag.cols)); const y = rowSnap(position.y, event);
      // Cells crossed in one move share the heights between the old and new mouse position, so a fast drag leaves no gaps.
      const step = cell >= drag.lastCell ? 1 : -1;
      for (let at = drag.lastCell; at !== cell + step; at += step) {
        const span = cell === drag.lastCell ? 1 : (at - drag.lastCell) / (cell - drag.lastCell);
        drag.peaks.set(at, rowSnap(drag.lastY + (y - drag.lastY) * span, event));
      }
      drag.lastCell = cell; drag.lastY = y;
      drag.first = Math.min(drag.first, cell); drag.last = Math.max(drag.last, cell);
      previewStamp();
    }
    light();
  });

  function finishDrag(event) {
    const drag = state.drag;
    state.drag = null;
    if (!drag) return;
    if (drag.kind === 'point' || drag.kind === 'bend') {
      if (drag.moved) { state.history.push(drag.before); if (state.history.length > 100) state.history.shift(); state.future = []; }
    } else if (drag.kind === 'pencil') {
      const strokeSamples = state.preview; state.preview = null;
      commit(spliceStroke(draft.points, strokeSamples, drag.from, drag.to));
    } else if (drag.kind === 'stamp') {
      if (state.previewPoints) { commit(state.previewPoints); state.selected = null; }
      state.previewPoints = null;
    }
    refresh();
  }
  plate.addEventListener('pointerup', finishDrag);
  plate.addEventListener('pointercancel', () => { state.drag = null; state.preview = null; state.previewPoints = null; refresh(); });
  plate.addEventListener('pointerleave', () => { state.hover = null; updateReadout(); });

  plate.addEventListener('dblclick', (event) => {
    if (state.tool !== 'pointer' || state.busy) return;
    const position = fromEvent(event);
    const hit = hitTest(position);
    if (hit.point !== undefined) {
      if (hit.point > 0 && hit.point < draft.points.length - 1) { commit(removePoint(draft.points, hit.point)); state.selected = null; }
    } else if (hit.handle === undefined) {
      const target = snapped(position, event);
      const result = insertPoint(draft.points, target.x, target.y);
      commit(result.points); state.selected = result.index;
    }
    refresh();
  });

  plate.addEventListener('keydown', (event) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (state.selected === null) return;
    const point = draft.points[state.selected];
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (state.selected > 0 && state.selected < draft.points.length - 1) { commit(removePoint(draft.points, state.selected)); state.selected = null; refresh(); }
    } else if (event.key.toLowerCase() === 'e') {
      event.preventDefault(); commit(toggleEase(draft.points, state.selected)); refresh();
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const big = event.shiftKey ? 10 : 1;
      const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      const dy = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
      commit(movePoint(draft.points, state.selected, point.x + (dx * big) / 400, point.y + (dy * big) / 200));
      refresh();
    }
  });

  // ---- layout ------------------------------------------------------------------------
  const header = el('header', 'ce-header');
  const body = el('div', 'ce-body');
  const footer = el('footer', 'ce-footer');
  dialog.append(header, body, footer);

  function destinationSelect() {
    const select = el('select', 'ce-dest');
    select.setAttribute('aria-label', 'Parameter this loop moves');
    option(select, 0, 'Choose a parameter…');
    const available = destinationGroups();
    if (draft.dest && !available.some((group) => group.items.some((item) => item.id === draft.dest))) {
      option(select, draft.dest, `${destinations.label(draft.dest)} (not in this firmware)`);
    }
    for (const group of available) {
      const items = group.items.filter((item) => !NOT_LOCKABLE.test(item.symbol ?? '') && item.id !== 0);
      if (!items.length) continue;
      const section = document.createElement('optgroup'); section.label = group.group;
      // The closed select shows only the chosen option's text, so each one names its owner (Plaits 1, Sampler 1, FX…).
      for (const item of items) section.append(new Option(`${group.group} · ${item.name}`, String(item.id)));
      select.append(section);
    }
    select.value = String(draft.dest);
    select.addEventListener('change', () => { draft.dest = Number(select.value); refresh(); });
    return select;
  }

  function renderHeader() {
    header.replaceChildren(
      el('h2', 'ce-title', title),
      destinationSelect(),
      button('Curves', () => { state.view = state.view === 'library' ? 'edit' : 'library'; refresh(); }, { className: state.view === 'library' ? 'active' : '', title: 'Ready-made and saved curves' }),
      button('Open file', openFile, { title: 'Load a curve from a file' }),
      button('Save file', saveFile, { title: 'Download this curve as a file' }),
      button('Close', () => dialog.close(), { className: 'ce-close', title: 'Close without applying' }),
    );
    header.lastChild.textContent = '×'; header.lastChild.setAttribute('aria-label', 'Close without applying');
  }

  const readout = el('output', 'ce-readout');
  function updateReadout() {
    if (!state.hover) { readout.textContent = state.status || ' '; return; }
    const { x, y } = state.hover;
    const where = draft.mode === 'sync' ? `beat ${(1 + x * draft.beats).toFixed(2)}` : `${(x * lengthSeconds(draft)).toFixed(2)} s`;
    readout.textContent = `${where}   ${Math.round(y * 100)}%`;
  }

  function toolbar() {
    const bar = el('div', 'ce-toolbar');
    const tools = el('div', 'ce-tools'); tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', 'Tool');
    for (const tool of TOOLS) {
      const item = el('button', `ce-tool${state.tool === tool.id ? ' active' : ''}`);
      item.type = 'button'; item.title = tool.label; item.setAttribute('aria-label', tool.label.split(':')[0]); item.setAttribute('aria-pressed', String(state.tool === tool.id));
      item.append(icon(tool.icon));
      item.addEventListener('click', () => { state.tool = tool.id; refresh(); plate.focus({ preventScroll: true }); });
      tools.append(item);
    }
    const polar = button('±', () => { draft.bipolar = !draft.bipolar; draft.recordBase = 0; draft.recordedBase = undefined; refresh(); }, { className: `ce-toggle ce-polar${draft.bipolar ? ' active' : ''}`, title: draft.bipolar ? 'Bipolar: the knob shifts the curve; at noon the curve plays as drawn over the full range' : 'Unipolar: the curve only adds to the knob; the bottom means no change' });
    polar.setAttribute('aria-pressed', String(draft.bipolar)); polar.setAttribute('aria-label', 'Bipolar');
    tools.append(polar);
    const snap = el('div', 'ce-snap');
    const toggle = button('Snap', () => { state.snap = !state.snap; refresh(); }, { className: `ce-toggle${state.snap ? ' active' : ''}`, title: 'Hold Alt while dragging to ignore the grid' });
    toggle.setAttribute('aria-pressed', String(state.snap));
    const columns = el('select', 'ce-small'); columns.setAttribute('aria-label', draft.mode === 'sync' ? 'Grid steps per beat' : 'Grid columns');
    for (const value of draft.mode === 'sync' ? [1, 2, 4, 8] : [4, 8, 16, 32]) option(columns, value, draft.mode === 'sync' ? `${value} per beat` : `${value} columns`);
    columns.value = String(draft.mode === 'sync' ? state.perBeat : state.freeCols);
    columns.addEventListener('change', () => { if (draft.mode === 'sync') state.perBeat = Number(columns.value); else state.freeCols = Number(columns.value); refresh(); });
    const rows = el('select', 'ce-small'); rows.setAttribute('aria-label', 'Grid rows');
    for (const value of [2, 4, 8, 16]) option(rows, value, `${value} rows`);
    rows.value = String(state.rows);
    rows.addEventListener('change', () => { state.rows = Number(rows.value); refresh(); });
    const snapGroup = el('div', 'ce-snap-group'); snapGroup.append(toggle);
    snap.append(snapGroup, columns, rows);
    bar.append(tools, readout, snap);
    return bar;
  }

  function lengthControls() {
    const group = el('div', 'ce-length');
    const modes = el('div', 'ce-segment'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Length is');
    for (const [id, label, hint] of [['free', 'Free', 'Length in seconds; runs on its own'], ['sync', 'Synced', 'Length in beats; restarts on the clock so it stays with the grid']]) {
      const item = button(label, () => { draft.mode = id; refresh(); }, { className: draft.mode === id ? 'active' : '', title: hint });
      item.setAttribute('aria-pressed', String(draft.mode === id));
      modes.append(item);
    }
    group.append(modes);
    if (draft.mode === 'free') {
      group.append(field('Seconds', numberInput(draft.seconds, { min: 0.1, max: 20, step: 0.1 }, (value) => { draft.seconds = Math.min(20, Math.max(0.1, value)); renderPlate(); renderFooter(); updateReadout(); })));
    } else {
      const beats = el('select', 'ce-small'); beats.setAttribute('aria-label', 'Length in beats');
      for (const value of BEAT_CHOICES) option(beats, value, value === 1 ? '1 beat' : `${value} beats`);
      beats.value = String(draft.beats);
      beats.addEventListener('change', () => { draft.beats = Number(beats.value); refresh(); });
      group.append(field('Length', beats), field('Tempo', numberInput(draft.bpm, { min: 20, max: 300, step: 1 }, (value) => { draft.bpm = Math.min(300, Math.max(20, value)); onSaveBpm(draft.bpm); renderPlate(); renderFooter(); updateReadout(); })));
    }
    const exit = el('select', 'ce-small'); exit.setAttribute('aria-label', 'When the loop is erased or stops');
    option(exit, 'Return', 'Knob returns'); option(exit, 'Latch', 'Knob stays');
    exit.value = draft.exit;
    exit.addEventListener('change', () => { draft.exit = exit.value; });
    group.append(field('At the end', exit));
    const edit = el('div', 'ce-edit');
    edit.append(
      button('Undo', undo, { disabled: !state.history.length }), button('Redo', redo, { disabled: !state.future.length }),
      button('Reverse', () => { commit(reversePoints(draft.points)); state.selected = null; refresh(); }),
      button('Flip', () => { commit(invertPoints(draft.points)); refresh(); }, { title: 'Turn the curve upside down' }),
      button('Smooth point', () => { if (state.selected !== null) { commit(toggleEase(draft.points, state.selected)); refresh(); } }, { disabled: state.selected === null, title: 'Switch the segment after the selected point between straight and S-shaped (key E)' }),
    );
    group.append(edit);
    return group;
  }

  // ---- library ----------------------------------------------------------------------------
  function libraryView() {
    const view = el('div', 'ce-library');
    const mine = () => readLibrary().map((item) => ({ ...item, category: 'Saved', user: true }));
    const everything = () => [...CURVES, ...mine()];
    const categories = ['All', ...CATEGORIES, 'Saved'];

    const side = el('nav', 'ce-lib-side'); side.setAttribute('aria-label', 'Curve categories');
    const main = el('div', 'ce-lib-main');
    const search = el('input', 'ce-search'); search.type = 'search'; search.placeholder = 'Search curves'; search.value = state.query; search.setAttribute('aria-label', 'Search curves');
    search.addEventListener('input', () => { state.query = search.value; renderGrid(); });
    const grid = el('div', 'ce-lib-grid'); grid.setAttribute('role', 'listbox'); grid.setAttribute('aria-label', 'Curves');
    main.append(search, grid);
    const side2 = el('aside', 'ce-lib-preview');
    view.append(side, main, side2);

    function visibleItems() {
      const query = state.query.trim().toLowerCase();
      return everything().filter((item) => (state.category === 'All' || item.category === state.category) && (!query || item.name.toLowerCase().includes(query)));
    }

    function use(item) {
      commit(item.points.map((point) => ({ ...point })));
      state.selected = null; state.view = 'edit'; state.status = `Loaded “${item.name}”`; state.libSelection = null; refresh();
    }

    function renderSide() {
      side.replaceChildren(el('h3', 'ce-lib-heading', 'Curves'));
      const counts = (name) => everything().filter((item) => name === 'All' || item.category === name).length;
      for (const name of categories) {
        const entry = el('button', `ce-lib-cat${state.category === name ? ' active' : ''}`); entry.type = 'button';
        entry.append(el('span', '', name), el('small', '', String(counts(name))));
        entry.addEventListener('click', () => { state.category = name; renderSide(); renderGrid(); });
        side.append(entry);
      }
    }

    function renderPreview() {
      const item = everything().find((candidate) => candidate.id === state.libSelection);
      side2.replaceChildren();
      if (!item) { side2.append(el('p', 'ce-lib-hint', 'Pick a curve to preview it. Double-click one to use it right away.')); }
      else {
        side2.append(el('h3', 'ce-lib-heading', item.name), curveThumb(item.points, { detail: 240, large: true }),
          el('p', 'ce-lib-hint', `${item.points.length} points · ${item.category}. Using it replaces the curve in the editor; Undo brings the old one back.`));
        const actions = el('div', 'ce-lib-actions');
        actions.append(button('Use curve', () => use(item), { className: 'primary' }));
        if (item.user) actions.append(button('Delete', () => { writeLibrary(readLibrary().filter((saved) => saved.id !== item.id)); state.libSelection = null; renderSide(); renderGrid(); renderPreview(); }));
        side2.append(actions);
      }
      const save = el('form', 'ce-lib-save');
      const name = el('input', 'ce-search'); name.placeholder = 'Name the curve in the editor'; name.setAttribute('aria-label', 'Name for the current curve');
      const submit = button('Save to my curves', () => {}, { title: 'Keeps the editor’s current curve in this browser' });
      submit.type = 'submit';
      save.addEventListener('submit', (event) => {
        event.preventDefault();
        const label = name.value.trim();
        if (!label) { name.focus(); return; }
        const items = readLibrary(); const id = `user-${Date.now()}`;
        items.push({ id, name: label, points: draft.points.map((point) => ({ ...point })) });
        state.status = writeLibrary(items) ? `Saved “${label}” in this browser` : 'This browser would not store the curve; use Save file instead';
        state.category = 'Saved'; state.libSelection = id; name.value = '';
        renderSide(); renderGrid(); renderPreview();
      });
      save.append(name, submit);
      side2.append(save);
    }

    function renderGrid() {
      const items = visibleItems();
      grid.replaceChildren();
      if (!items.length) grid.append(el('p', 'ce-lib-empty', state.category === 'Saved' && !state.query ? 'Nothing saved yet. Name the curve you are editing and save it here.' : 'No curve matches.'));
      for (const item of items) {
        const card = el('button', `ce-lib-item${state.libSelection === item.id ? ' selected' : ''}`); card.type = 'button';
        card.setAttribute('role', 'option'); card.setAttribute('aria-selected', String(state.libSelection === item.id));
        card.append(el('span', 'ce-lib-name', item.name), curveThumb(item.points, { detail: 160 }));
        card.addEventListener('click', () => { state.libSelection = item.id; for (const other of grid.children) { const on = other === card; other.classList.toggle('selected', on); other.setAttribute('aria-selected', String(on)); } renderPreview(); });
        card.addEventListener('dblclick', () => use(item));
        grid.append(card);
      }
    }

    renderSide(); renderGrid(); renderPreview();
    return view;
  }

  // ---- files ------------------------------------------------------------------------------------
  function currentLoopForFile() {
    const frames = Math.min(400, Math.max(2, Math.round(lengthSeconds(draft) * 20)));
    return { dest: draft.dest, exit: draft.exit, bipolar: draft.bipolar, samples: toSamples(draft.points, frames) };
  }
  function saveFile() {
    const symbol = destinations.byId(draft.dest)?.symbol ?? 'curve';
    download?.(`${symbol.replace(/[^A-Za-z0-9]+/g, '_')}.pvcurve.json`, JSON.stringify(exportCurve(currentLoopForFile(), destinations), null, 1));
  }
  async function openFile() {
    try {
      const text = await pickFile?.();
      if (text == null) return;
      const loop = parseCurve(text, destinations);
      commit(fromSamples(loop.samples));
      draft.exit = loop.exit;
      if (typeof loop.bipolar === 'boolean') { draft.bipolar = loop.bipolar; draft.recordBase = 0; }
      if (loop.dest) draft.dest = loop.dest;
      if (draft.mode === 'free') draft.seconds = Math.round((loop.samples.length / 20) * 10) / 10;
      state.selected = null; state.status = 'Loaded the curve from the file'; state.error = '';
      refresh();
    } catch (error) { state.error = error.message; refresh(); }
  }

  // ---- footer / apply ------------------------------------------------------------------------------
  function renderFooter() {
    const result = loopFromDraft(draft);
    const message = el('p', `ce-message${state.error || (result.error && draft.dest) ? ' error' : ''}`);
    message.textContent = state.error || result.error
      || (`${result.frames} points over ${draft.mode === 'sync' ? `${draft.beats} beats` : `${lengthSeconds(draft).toFixed(1)} s`}. `
        + (draft.bipolar ? 'The knob shifts the whole curve up and down; with the knob at noon it plays exactly as drawn. ' : `The dashed line (${Math.round(zeroLevel(draft) * 100)}%) is no change: the curve moves the knob up and down from there, and the knob shifts it. Drag the line to move it. `)
        + (draft.mode === 'sync' ? "Synced loops follow the module's MIDI Start and Stop." : 'Applying restarts the loop on the module.'));
    const apply = button(state.busy ? 'Applying…' : 'Apply to module', apply_, { className: 'primary', disabled: state.busy || Boolean(result.error) });
    footer.replaceChildren(message, button('Cancel', () => dialog.close(), { disabled: state.busy }), apply);
  }

  async function apply_() {
    const result = loopFromDraft(draft);
    if (result.error) return;
    state.busy = true; state.error = ''; refresh();
    try { await onApply(result.loop); dialog.close('applied'); }
    catch (error) { state.error = error?.message ?? String(error); state.busy = false; refresh(); }
  }

  // While dragging only the plate and the readout change.
  function light() { renderPlate(); updateReadout(); }

  function refresh() {
    renderHeader();
    body.replaceChildren();
    if (state.view === 'library') body.append(libraryView());
    else { renderPlate(); body.append(plate, toolbar(), lengthControls()); }
    updateReadout();
    renderFooter();
    dialog.classList.toggle('busy', state.busy);
  }

  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('cancel', (event) => { if (state.busy) event.preventDefault(); });
  refresh();
  dialog.showModal();
  plate.focus({ preventScroll: true });
  return { dialog, close: () => dialog.close() };
}
