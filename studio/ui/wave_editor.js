import {
  buildPeakPyramid, clampView, computePeaks, dragHandle, ensureVisible, fitView, formatClock, isFit, keyStep, minSelection, moveRegion,
  nudgeHandle, panView, playBounds, positionAt, rulerTicks, startPosition, timeToX, viewForSelection, xToTime, zoomAt, MAX_CLIP_SECONDS,
} from '../model/wave_edit.js';
import { labelAfter } from '../model/slices.js';

const RULER = 24;       // px reserved for the time ruler at the top of the canvas
const PAD_COLOURS = ['bg', 'ruler', 'grid', 'ink', 'muted', 'wave', 'dim', 'accent', 'head'];

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function button(text, className = '', label = '') { const node = el('button', className, text); node.type = 'button'; if (label) { node.title = label; node.setAttribute('aria-label', label); } return node; }
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const sec = (value) => `${value.toFixed(3)} s`;

// The wave editor for one item. It owns the canvas, the handles, the overview strip and the transport.
// item: { audio, duration, trimStart, trimEnd } plus editor state it adds itself (view, playhead, scope, loop).
// getContext(): the shared AudioContext. onChange(): the selection moved (handles, region or keyboard).
export function createWaveEditor(item, { getContext, onChange = () => {}, onError = (error) => console.error(error) }) {
  item.pyramid ??= buildPeakPyramid(item.audio.channels, item.audio.sampleRate);
  item.view = clampView(item.view ?? fitView(item.duration), item.duration);
  item.playhead ??= item.trimStart; item.scope ??= 'selection'; item.loop ??= false;

  const root = el('div', 'we');
  const stage = el('div', 'we-stage'); stage.tabIndex = 0; stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', `Waveform of ${item.name}. Drag the handles to set start and end, click to move the playhead, scroll to zoom, Space to play.`);
  const canvas = el('canvas', 'we-canvas'); canvas.setAttribute('aria-hidden', 'true');
  const region = el('div', 'we-region');
  const handles = {};
  for (const which of ['start', 'end']) {
    const handle = el('div', `we-handle we-${which}`); handle.tabIndex = 0; handle.dataset.which = which; handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-label', which === 'start' ? 'Selection start' : 'Selection end'); handle.setAttribute('aria-orientation', 'horizontal');
    handle.append(el('span', 'we-tip')); handles[which] = handle;
  }
  const playhead = el('div', 'we-playhead'); playhead.setAttribute('aria-hidden', 'true');
  stage.append(canvas, region, playhead, handles.start, handles.end);
  const markerLayer = el('div', 'we-markers'); stage.append(markerLayer);
  // The selected slice is what Kick / Snare / Hat / None (the buttons under the waveform, or the keys K S H 0) and Delete act on.
  function selectSlice(index) {
    item.sliceSel = index; selectedMarker = index - 1; renderMarkers();
    root.dispatchEvent(new CustomEvent('slice-select', { detail: index }));
  }
  function labelSelected(action) {
    const i = item.sliceSel; if (!item.slices || !(i >= 0) || i >= item.slices.sliceCount) return false;
    if (!item.slices.setLabel(i, labelAfter(item.slices.labels[i], action))) return false;
    invalidate({ wave: false }); onChange(); return true;
  }
  let markerNodes = [];
  function renderMarkers() {
    const model = item.slices; const markers = model ? model.markers : []; const labels = model ? model.labels : []; const count = model ? markers.length + 1 : 0;
    while (markerNodes.length > count) markerNodes.pop().remove();
    while (markerNodes.length < count) {
      const node = el('div', 'we-marker'); node.tabIndex = 0; const badge = el('button', 'we-marker-badge'); badge.type = 'button'; node.append(badge); markerLayer.append(node); markerNodes.push(node);
    }
    const w = width();
    markerNodes.forEach((node, i) => {
      const markerTime = i === 0 ? 0 : markers[i - 1]; const x = timeToX(markerTime, item.view, w);
      node.style.transform = `translateX(${x.toFixed(2)}px)`; node.classList.toggle('offscreen', x < -1 || x > w + 1);
      node.dataset.index = String(i - 1); node.classList.toggle('fixed', i === 0); node.classList.toggle('selected', i === item.sliceSel);
      const badge = node.firstChild; const label = labels[i]; const short = String(label).split('+').map((part) => ({ kick: 'K', snare: 'S', hat: 'H' }[part] ?? '')).filter(Boolean).join('+');
      badge.textContent = `${i + 1}${short ? ` ${short}` : ''}`;
      const description = `Slice ${i + 1}${short ? `, ${String(label).replace('+', ' with ')}` : ''}: click to select and hear it (K S H 0 set its label)${i === 0 ? '' : ', drag the line to move it, Delete removes it'}`;
      badge.title = description; badge.setAttribute('aria-label', description);
      badge.dataset.slice = String(i);
    });
  }

  const overview = el('div', 'we-overview'); const overviewCanvas = el('canvas', 'we-ov-canvas'); overviewCanvas.setAttribute('aria-hidden', 'true');
  const windowBox = el('div', 'we-ov-window'); overview.append(overviewCanvas, windowBox);

  const transport = el('div', 'we-transport');
  const playButton = button('Play', 'we-play primary');
  const scope = el('div', 'we-seg'); scope.setAttribute('role', 'radiogroup'); scope.setAttribute('aria-label', 'Playback scope');
  const scopeButtons = {};
  for (const [value, label] of [['selection', 'Selection'], ['whole', 'Whole file']]) { const b = button(label); b.setAttribute('role', 'radio'); scopeButtons[value] = b; b.addEventListener('click', () => setScope(value)); scope.append(b); }
  const loopButton = button('Loop', 'we-loop'); loopButton.title = 'Loop the selection';
  const time = el('output', 'we-time'); time.setAttribute('aria-label', 'Playhead time'); const length = el('output', 'we-length'); length.setAttribute('aria-label', 'Selection length');
  const zoom = el('div', 'we-zoom'); zoom.setAttribute('role', 'group'); zoom.setAttribute('aria-label', 'Zoom');
  const zoomOut = button('−', 'we-icon', 'Zoom out'); const zoomIn = button('+', 'we-icon', 'Zoom in'); const zoomSel = button('Zoom to selection'); const zoomFit = button('Fit');
  zoom.append(zoomOut, zoomIn, zoomSel, zoomFit);
  transport.append(playButton, scope, loopButton, time, length, zoom);
  root.append(stage, overview, transport);

  // ------------------------------------------------------------ state
  let destroyed = false; let dirty = true; let overviewDirty = true; let frame = 0; let colours = null; let drag = null; let ovDrag = null;
  let markerDrag = null; let selectedMarker = -1; let audition = null;
  let playing = false; let source = null; let anchorPos = 0; let anchorTime = 0; let readPos = item.playhead;
  const sel = () => ({ start: item.trimStart, end: item.trimEnd });
  const bounds = () => audition ?? playBounds(sel(), item.duration, item.scope);
  const width = () => stage.clientWidth;

  function requestFrame() { if (!frame && !destroyed) frame = requestAnimationFrame(tick); }
  function invalidate({ wave = true, ov = false } = {}) { if (wave) dirty = true; if (ov) overviewDirty = true; requestFrame(); }

  // ------------------------------------------------------------ colours (resolved from CSS tokens, theme aware)
  function resolveColours() {
    const probe = el('span'); probe.style.display = 'none'; root.append(probe); const out = {};
    for (const name of PAD_COLOURS) { probe.style.color = `var(--we-${name})`; out[name] = getComputedStyle(probe).color; }
    probe.remove(); return out;
  }

  // ------------------------------------------------------------ drawing
  function sizeCanvas(target, w, h) {
    const ratio = window.devicePixelRatio || 1; const pw = Math.max(1, Math.round(w * ratio)); const ph = Math.max(1, Math.round(h * ratio));
    if (target.width !== pw || target.height !== ph) { target.width = pw; target.height = ph; }
    return ratio;
  }

  function drawWaveColumns(ctx, peaks, columns, y0, h, view, ratio) {
    const inside = new Path2D(); const outside = new Path2D(); const mid = y0 + h / 2; const amp = h / 2 * 0.94;
    const s0 = item.trimStart; const s1 = item.trimEnd; const per = view.span / columns;
    for (let c = 0; c < columns; c += 1) {
      const lo = peaks.min[c]; const hi = peaks.max[c]; if (lo > hi) continue;
      const top = Math.round((mid - hi * amp) * ratio); let bottom = Math.round((mid - lo * amp) * ratio); if (bottom <= top) bottom = top + 1;
      const t = view.start + (c + 0.5) * per; (t >= s0 && t <= s1 ? inside : outside).rect(c, top, 1, bottom - top);
    }
    ctx.fillStyle = colours.dim; ctx.fill(outside); ctx.fillStyle = colours.wave; ctx.fill(inside);
  }

  function draw() {
    dirty = false; const w = width(); const h = stage.clientHeight; if (w < 2 || h < 2) return;
    colours ??= resolveColours();
    const ratio = sizeCanvas(canvas, w, h); const ctx = canvas.getContext('2d'); const view = item.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(ratio, ratio);
    ctx.fillStyle = colours.bg; ctx.fillRect(0, 0, w, h); ctx.fillStyle = colours.ruler; ctx.fillRect(0, 0, w, RULER);
    const { ticks } = rulerTicks(view, w); ctx.font = '11px ui-sans-serif, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    for (const tick of ticks) {
      const x = Math.round(timeToX(tick.t, view, w)) + 0.5; if (x < -1 || x > w + 1) continue;
      ctx.strokeStyle = colours.grid; ctx.beginPath(); ctx.moveTo(x, tick.major ? RULER - 9 : RULER - 4); ctx.lineTo(x, tick.major ? h : RULER); ctx.stroke();
      if (tick.major) { ctx.fillStyle = colours.muted; ctx.fillText(tick.label, x + 5, RULER / 2 - 1); }
    }
    ctx.strokeStyle = colours.grid; ctx.beginPath(); const mid = Math.round(RULER + (h - RULER) / 2) + 0.5; ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    const columns = canvas.width; const peaks = computePeaks(item.pyramid, view.start, view.start + view.span, columns);
    ctx.setTransform(1, 0, 0, 1, 0, 0); drawWaveColumns(ctx, peaks, columns, RULER, h - RULER, view, ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const xs = timeToX(item.trimStart, view, w); const xe = timeToX(item.trimEnd, view, w);
    ctx.globalAlpha = 0.14; ctx.fillStyle = colours.accent; ctx.fillRect(xs, RULER, xe - xs, h - RULER);
    ctx.globalAlpha = 0.58; ctx.fillStyle = colours.bg; ctx.fillRect(0, RULER, Math.max(0, xs), h - RULER); ctx.fillRect(Math.min(w, xe), RULER, Math.max(0, w - xe), h - RULER);
    ctx.globalAlpha = 1;
  }

  function drawOverview() {
    overviewDirty = false; const w = overview.clientWidth; const h = overview.clientHeight; if (w < 2 || h < 2) return; colours ??= resolveColours();
    const ratio = sizeCanvas(overviewCanvas, w, h); const ctx = overviewCanvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, overviewCanvas.width, overviewCanvas.height);
    const columns = overviewCanvas.width; const peaks = computePeaks(item.pyramid, 0, item.duration, columns); const mid = h / 2; const amp = h / 2 * 0.9;
    const inside = new Path2D(); const outside = new Path2D(); const per = item.duration / columns;
    for (let c = 0; c < columns; c += 1) {
      const lo = peaks.min[c]; const hi = peaks.max[c]; if (lo > hi) continue; const top = Math.round((mid - hi * amp) * ratio); let bottom = Math.round((mid - lo * amp) * ratio); if (bottom <= top) bottom = top + 1;
      const t = (c + 0.5) * per; (t >= item.trimStart && t <= item.trimEnd ? inside : outside).rect(c, top, 1, bottom - top);
    }
    ctx.fillStyle = colours.dim; ctx.fill(outside); ctx.fillStyle = colours.wave; ctx.fill(inside);
  }

  // ------------------------------------------------------------ layout of the DOM overlays
  function layout() {
    const w = width(); const view = item.view; const xs = timeToX(item.trimStart, view, w); const xe = timeToX(item.trimEnd, view, w);
    const left = clamp(xs, -60, w + 60); const right = clamp(xe, -60, w + 60);
    region.style.left = `${left}px`; region.style.width = `${Math.max(0, right - left)}px`;
    for (const [which, x] of [['start', xs], ['end', xe]]) {
      const handle = handles[which]; handle.style.transform = `translateX(${x.toFixed(2)}px)`; handle.classList.toggle('offscreen', x < -1 || x > w + 1);
      const value = which === 'start' ? item.trimStart : item.trimEnd; const min = minSelection(item.duration);
      handle.setAttribute('aria-valuemin', which === 'start' ? '0' : String(Number((item.trimStart + min).toFixed(3))));
      handle.setAttribute('aria-valuemax', which === 'start' ? String(Number(Math.max(0, item.trimEnd - min).toFixed(3))) : String(Number(item.duration.toFixed(3))));
      handle.setAttribute('aria-valuenow', String(Number(value.toFixed(3)))); handle.setAttribute('aria-valuetext', `${which === 'start' ? 'Start' : 'End'} ${sec(value)}`);
      handle.firstChild.textContent = sec(value);
    }
    playhead.style.transform = `translateX(${timeToX(readPos, view, w).toFixed(2)}px)`; playhead.classList.toggle('offscreen', readPos < view.start || readPos > view.start + view.span);
    const ow = overview.clientWidth; const total = item.duration || 1;
    windowBox.style.left = `${(view.start / total * ow).toFixed(2)}px`; windowBox.style.width = `${Math.max(6, view.span / total * ow).toFixed(2)}px`;
    zoomFit.disabled = isFit(view, item.duration); zoomOut.disabled = zoomFit.disabled; zoomIn.disabled = view.span <= Math.min(0.005, item.duration) + 1e-9;
    const len = item.trimEnd - item.trimStart; length.textContent = `Selection ${sec(len)}${len > MAX_CLIP_SECONDS ? ' · over 30 s' : ''}`; length.classList.toggle('over', len > MAX_CLIP_SECONDS + 1e-9);
    time.textContent = `${formatClock(readPos)} / ${formatClock(item.duration)}`;
    playButton.textContent = playing ? 'Pause' : 'Play'; playButton.setAttribute('aria-pressed', String(playing)); playButton.title = playing ? 'Pause (Space)' : 'Play (Space)';
    for (const [value, b] of Object.entries(scopeButtons)) { b.setAttribute('aria-checked', String(item.scope === value)); b.classList.toggle('active', item.scope === value); }
    loopButton.setAttribute('aria-pressed', String(item.loop)); loopButton.classList.toggle('active', item.loop);
    loopButton.title = item.scope === 'whole' ? 'Loop the whole file' : 'Loop the selection';
    renderMarkers();
  }

  function tick() {
    frame = 0; if (destroyed) return;
    if (playing) {
      if (!stage.isConnected || !stage.offsetParent || document.hidden) { pause(); }
      else { const result = currentPosition(); readPos = result.pos; if (result.ended) stopPlayback(bounds().start); }
    }
    if (dirty) draw(); if (overviewDirty) drawOverview();
    layout(); if (playing) requestFrame();
  }

  // ------------------------------------------------------------ playback
  function audioBuffer(ctx) {
    if (!item.audioBuffer) {
      const buffer = ctx.createBuffer(item.audio.channels.length, item.audio.channels[0].length, item.audio.sampleRate);
      item.audio.channels.forEach((channel, index) => buffer.copyToChannel(channel, index)); item.audioBuffer = buffer;
    }
    return item.audioBuffer;
  }
  function killSource() { if (source) { source.onended = null; try { source.stop(); } catch { /* already stopped */ } try { source.disconnect(); } catch { /* ignore */ } source = null; } }
  function currentPosition() { return positionAt({ anchorPos, elapsed: getContext().currentTime - anchorTime, bounds: bounds(), loop: audition ? false : item.loop }); }
  function startSource(pos) {
    killSource(); const ctx = getContext(); const b = bounds(); const node = ctx.createBufferSource(); node.buffer = audioBuffer(ctx);
    if (item.loop) { node.loop = true; node.loopStart = b.start; node.loopEnd = b.end; }
    node.connect(ctx.destination); node.start(0, pos); if (!item.loop) { try { node.stop(ctx.currentTime + Math.max(0, b.end - pos)); } catch { /* ignore */ } }
    source = node; anchorPos = pos; anchorTime = ctx.currentTime; readPos = pos;
  }
  // The bounds changed while playing (handle drag, scope or loop toggle): keep the position, move the loop or stop point.
  function rebase(from) {
    if (!playing || !source) return; const ctx = getContext(); const b = bounds(); anchorPos = from; anchorTime = ctx.currentTime;
    if (item.loop) { source.loop = true; source.loopStart = b.start; source.loopEnd = b.end; }
    else { source.loop = false; try { source.stop(ctx.currentTime + Math.max(0, b.end - from)); } catch { /* ignore */ } }
  }
  function stopPlayback(pos) { audition = null; playing = false; killSource(); if (Number.isFinite(pos)) { item.playhead = pos; readPos = pos; } invalidate({ wave: false }); }
  function pause() { if (playing) stopPlayback(currentPosition().pos); }
  async function togglePlay() {
    if (playing) { pause(); return; }
    try {
      const ctx = getContext(); if (ctx.state !== 'running') await ctx.resume(); if (destroyed) return;
      audition = null; startSource(startPosition(item.playhead, bounds())); playing = true; requestFrame();
    } catch (error) { onError(error); }
  }
  function sliceRange(index) {
    const markers = item.slices.markers; const starts = [0, ...markers]; const start = starts[index];
    const next = starts[index + 1] ?? item.duration;
    const end = item.slices.oneShot ? next : item.duration;
    return { start, end };
  }
  async function auditionSlice(index) {
    if (!item.slices || index < 0 || index > item.slices.markers.length) return;
    try {
      const ctx = getContext(); if (ctx.state !== 'running') await ctx.resume(); if (destroyed) return;
      const range = sliceRange(index); const wasLoop = item.loop; item.loop = false; audition = range;
      try { startSource(range.start); playing = true; requestFrame(); } finally { item.loop = wasLoop; }
    } catch (error) { onError(error); }
  }
  function setPlayhead(t) {
    const target = clamp(t, 0, item.duration);
    if (playing) { const b = bounds(); const pos = startPosition(target, b); startSource(pos); item.playhead = pos; readPos = pos; }
    else { item.playhead = target; readPos = target; }
    invalidate({ wave: false });
  }
  function setScope(value) {
    if (item.scope === value) return; const cur = playing ? currentPosition().pos : null; item.scope = value;
    if (playing) { const b = bounds(); startSource(cur >= b.start && cur < b.end ? cur : b.start); }
    invalidate({ wave: false });
  }
  function setLoop(value) {
    const cur = playing ? currentPosition().pos : null; item.loop = value;
    if (playing) { const b = bounds(); startSource(cur >= b.start && cur < b.end ? cur : b.start); }
    invalidate({ wave: false });
  }

  // ------------------------------------------------------------ selection and view changes
  function setSelection(next) {
    if (next.start === item.trimStart && next.end === item.trimEnd) return;
    const cur = playing ? currentPosition().pos : null; item.trimStart = next.start; item.trimEnd = next.end;
    if (playing) rebase(cur);
    invalidate({ ov: true }); onChange();
  }
  function setView(view) { item.view = clampView(view, item.duration); invalidate(); }

  // ------------------------------------------------------------ pointer: stage
  const stageX = (event) => event.clientX - stage.getBoundingClientRect().left;
  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return; const x = stageX(event); const w = width(); const handle = event.target.closest?.('.we-handle');
    if (handle) { const which = handle.dataset.which; drag = { kind: 'handle', which, grab: xToTime(x, item.view, w) - (which === 'start' ? item.trimStart : item.trimEnd) }; handle.classList.add('dragging'); handle.focus({ preventScroll: true }); }
    else if (event.target.closest?.('.we-region')) drag = { kind: 'region', x0: x, t0: xToTime(x, item.view, w), sel0: sel(), moved: false };
    else { drag = { kind: 'seek' }; setPlayhead(xToTime(x, item.view, w)); stage.focus({ preventScroll: true }); }
    stage.setPointerCapture(event.pointerId); stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag) return; const x = stageX(event); const w = width(); const t = xToTime(x, item.view, w);
    if (drag.kind === 'handle') setSelection(dragHandle(drag.which, t - drag.grab, sel(), item.duration));
    else if (drag.kind === 'region') { if (!drag.moved && Math.abs(x - drag.x0) < 3) return; drag.moved = true; setSelection(moveRegion(drag.sel0, t - drag.t0, item.duration)); }
    else setPlayhead(t);
  });
  const endDrag = (event) => {
    if (!drag) return; if (drag.kind === 'region' && !drag.moved && event.type === 'pointerup') { stage.focus({ preventScroll: true }); setPlayhead(drag.t0); }
    for (const handle of Object.values(handles)) handle.classList.remove('dragging'); stage.classList.remove('dragging'); drag = null;
  };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag); stage.addEventListener('lostpointercapture', endDrag);

  markerLayer.addEventListener('pointerdown', (event) => {
    const badge = event.target.closest?.('.we-marker-badge'); if (badge) { event.stopPropagation(); return; }
    const node = event.target.closest?.('.we-marker'); if (!node || node.classList.contains('fixed')) return;
    event.stopPropagation(); const index = Number(node.dataset.index);
    item.slices.beginDrag(index); markerDrag = { index }; node.setPointerCapture(event.pointerId); selectedMarker = index; node.focus?.();
  });
  markerLayer.addEventListener('pointermove', (event) => {
    if (!markerDrag) return; item.slices.dragTo(markerDrag.index, xToTime(stageX(event), item.view, width()));
  });
  const endMarkerDrag = () => { if (!markerDrag) return; item.slices.endDrag(); markerDrag = null; onChange(); };
  markerLayer.addEventListener('pointerup', endMarkerDrag); markerLayer.addEventListener('pointercancel', endMarkerDrag);
  markerLayer.addEventListener('click', (event) => {
    const badge = event.target.closest?.('.we-marker-badge'); if (!badge) return;
    const index = Number(badge.dataset.slice); selectSlice(index); auditionSlice(index);
  });
  stage.addEventListener('dblclick', (event) => {
    if (!item.slices || event.target.closest?.('.we-handle, .we-marker')) return;
    if (item.slices.add(xToTime(stageX(event), item.view, width())) >= 0) onChange();
  });
  stage.addEventListener('keydown', (event) => {
    if (!item.slices) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedMarker >= 0) { event.preventDefault(); if (item.slices.remove(selectedMarker)) { selectedMarker = -1; onChange(); } }
    else if (!event.ctrlKey && !event.metaKey && !event.altKey && { k: 'kick', s: 'snare', h: 'hat', 0: 'none' }[event.key.toLowerCase()] && item.sliceSel >= 0) {
      event.preventDefault(); labelSelected({ k: 'kick', s: 'snare', h: 'hat', 0: 'none' }[event.key.toLowerCase()]);
    }
    else if (event.key.toLowerCase() === 'm' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); if (item.slices.add(readPos) >= 0) onChange(); }
  });

  stage.addEventListener('wheel', (event) => {
    event.preventDefault(); const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1; const w = width();
    const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (horizontal && !event.ctrlKey) { const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * scale; setView(panView(item.view, item.duration, delta / w * item.view.span)); return; }
    const factor = Math.exp(-event.deltaY * scale * (event.ctrlKey ? 0.01 : 0.0015)); setView(zoomAt(item.view, item.duration, factor, xToTime(stageX(event), item.view, w)));
  }, { passive: false });

  // keyboard: handles nudge, Space plays
  for (const [which, handle] of Object.entries(handles)) handle.addEventListener('keydown', (event) => {
    const dir = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : 0; if (!dir) return;
    event.preventDefault(); event.stopPropagation(); const next = nudgeHandle(which, sel(), item.duration, dir * keyStep(event)); setSelection(next);
    item.view = ensureVisible(item.view, item.duration, which === 'start' ? next.start : next.end); invalidate();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) return; if (!event.target.closest?.('.we-stage')) return;
    event.preventDefault(); togglePlay();
  });

  // ------------------------------------------------------------ pointer: overview strip
  function overviewMove(event) {
    if (!ovDrag) return; const ow = overview.clientWidth; const x = event.clientX - overview.getBoundingClientRect().left; const t = x / ow * item.duration;
    setView({ start: t - ovDrag.grab, span: item.view.span });
  }
  overview.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return; const ow = overview.clientWidth; const x = event.clientX - overview.getBoundingClientRect().left; const t = x / ow * item.duration;
    const inside = t >= item.view.start && t <= item.view.start + item.view.span; ovDrag = { grab: inside ? t - item.view.start : item.view.span / 2 };
    overview.setPointerCapture(event.pointerId); overviewMove(event);
  });
  overview.addEventListener('pointermove', overviewMove);
  for (const type of ['pointerup', 'pointercancel']) overview.addEventListener(type, () => { ovDrag = null; });

  // ------------------------------------------------------------ transport buttons
  playButton.addEventListener('click', () => togglePlay());
  loopButton.addEventListener('click', () => setLoop(!item.loop));
  const centre = () => item.view.start + item.view.span / 2;
  zoomIn.addEventListener('click', () => setView(zoomAt(item.view, item.duration, 2, centre())));
  zoomOut.addEventListener('click', () => setView(zoomAt(item.view, item.duration, 0.5, centre())));
  zoomSel.addEventListener('click', () => setView(viewForSelection(item.trimStart, item.trimEnd, item.duration)));
  zoomFit.addEventListener('click', () => setView(fitView(item.duration)));

  // ------------------------------------------------------------ lifecycle
  const onVisibility = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVisibility);
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => invalidate({ ov: true })) : null; resize?.observe(stage); resize?.observe(overview);
  const retheme = () => { colours = null; invalidate({ ov: true }); };
  const themeWatch = new MutationObserver(retheme); themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  const scheme = window.matchMedia?.('(prefers-color-scheme: dark)'); scheme?.addEventListener?.('change', retheme);
  const offSlices = item.slices?.subscribe(() => { invalidate({ wave: false }); });
  invalidate({ ov: true });

  return {
    el: root,
    // The numeric fields or the Trim button changed item.trimStart / trimEnd from outside.
    syncFromItem() { const cur = playing ? currentPosition().pos : null; if (playing) rebase(cur); invalidate({ ov: true }); },
    // Move the handles to a selection (used by the numeric fields).
    setSelection,
    selection: sel,
    pause,
    auditionSlice,
    refreshSlices() { invalidate({ wave: false }); },
    labelSelected,
    selectSlice,
    destroy() {
      if (destroyed) return; if (playing) item.playhead = currentPosition().pos; destroyed = true; playing = false; killSource(); cancelAnimationFrame(frame);
      offSlices?.(); document.removeEventListener('visibilitychange', onVisibility); resize?.disconnect(); themeWatch.disconnect(); scheme?.removeEventListener?.('change', retheme); root.remove();
    },
  };
}
