// Pure logic for the Sampler waveform editor: time/pixel mapping, zoom and pan,
// selection handle maths, peak computation and playback bounds. No DOM here.

export const MAX_CLIP_SECONDS = 30;
export const MIN_SELECTION = 0.001;      // 1 ms: the smallest selection a handle drag can leave
export const MIN_VIEW_SPAN = 0.005;      // 5 ms: deepest zoom
export const SNAP = 0.001;               // times snap to 1 ms

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function snapTime(time, step = SNAP) { return Number((Math.round(time / step) * step).toFixed(6)) || 0; }

export function minSelection(duration) { return Math.min(MIN_SELECTION, Math.max(0, duration)); }

// ---------------------------------------------------------------- view (zoom / pan)
// A view is { start, span } in seconds. The visible window is [start, start + span].
export function fitView(duration) { return { start: 0, span: Math.max(duration, 0) }; }

export function minSpan(duration) { return Math.min(MIN_VIEW_SPAN, Math.max(duration, 0)); }

export function clampView(view, duration) {
  const total = Math.max(duration, 0);
  const span = clamp(view.span, minSpan(total), total);
  return { start: clamp(view.start, 0, Math.max(0, total - span)), span };
}

export function timeToX(time, view, width) { return view.span > 0 ? (time - view.start) / view.span * width : 0; }
export function xToTime(x, view, width) { return width > 0 ? view.start + x / width * view.span : view.start; }

// factor > 1 zooms in. The time under `anchor` stays where it is on screen.
export function zoomAt(view, duration, factor, anchor) {
  if (!(factor > 0)) return clampView(view, duration);
  const span = clamp(view.span / factor, minSpan(duration), Math.max(duration, 0));
  const ratio = view.span > 0 ? (anchor - view.start) / view.span : 0;
  return clampView({ start: anchor - ratio * span, span }, duration);
}

export function panView(view, duration, deltaTime) { return clampView({ start: view.start + deltaTime, span: view.span }, duration); }

export function viewForSelection(start, end, duration, pad = 0.08) {
  const length = Math.max(end - start, minSelection(duration));
  const span = length * (1 + pad * 2);
  return clampView({ start: start - length * pad, span }, duration);
}

// Pan (without zooming) until `time` sits inside the view with a small margin.
export function ensureVisible(view, duration, time, margin = 0.04) {
  const edge = view.span * margin;
  if (time < view.start + edge) return clampView({ start: time - edge, span: view.span }, duration);
  if (time > view.start + view.span - edge) return clampView({ start: time - view.span + edge, span: view.span }, duration);
  return view;
}

export function isFit(view, duration) { return view.start <= 0 && view.span >= duration - 1e-9; }

// ---------------------------------------------------------------- selection
// A selection is { start, end } in seconds, 0 <= start <= end <= duration.
export function clampSelection(sel, duration) {
  const total = Math.max(duration, 0);
  const min = minSelection(total);
  const end = clamp(Number.isFinite(sel.end) ? sel.end : total, 0, total);
  const start = clamp(Number.isFinite(sel.start) ? sel.start : 0, 0, Math.max(0, end - min));
  return { start: snapTime(start), end: snapTime(Math.max(end, Math.min(total, start + min))) };
}

// Drag one handle to `time`. The handles never cross: the dragged one stops one minimum length short of the other.
export function dragHandle(which, time, sel, duration) {
  const total = Math.max(duration, 0);
  const min = minSelection(total);
  const target = snapTime(clamp(time, 0, total));
  if (which === 'start') return { start: Math.max(0, Math.min(target, sel.end - min)), end: sel.end };
  return { start: sel.start, end: Math.min(total, Math.max(target, sel.start + min)) };
}

export function nudgeHandle(which, sel, duration, delta) {
  return dragHandle(which, snapTime((which === 'start' ? sel.start : sel.end) + delta), sel, duration);
}

// Move the whole region by `delta`, keeping its length; it stops at both ends of the file.
export function moveRegion(sel, delta, duration) {
  const total = Math.max(duration, 0);
  const length = sel.end - sel.start;
  const start = snapTime(clamp(sel.start + delta, 0, Math.max(0, total - length)));
  return { start, end: snapTime(Math.min(total, start + length)) };
}

export function cap30(sel, duration) {
  return { start: sel.start, end: Math.min(duration, snapTime(sel.start + MAX_CLIP_SECONDS)) };
}
export function overCap(sel) { return sel.end - sel.start > MAX_CLIP_SECONDS + 1e-9; }

// Arrow-key step in seconds: plain 10 ms, Shift 100 ms, Alt 1 ms.
export function keyStep({ shiftKey = false, altKey = false } = {}) { return altKey ? 0.001 : shiftKey ? 0.1 : 0.01; }

// ---------------------------------------------------------------- peaks
const BASE_BLOCK = 64;
const LEVEL_FACTOR = 4;

// Build once per file: min/max over all channels per BASE_BLOCK samples, then coarser levels.
export function buildPeakPyramid(channels, sampleRate) {
  const length = channels[0]?.length ?? 0;
  const levels = [];
  if (length > 0) {
    const count = Math.ceil(length / BASE_BLOCK);
    const min = new Float32Array(count).fill(1); const max = new Float32Array(count).fill(-1);
    for (const channel of channels) {
      for (let block = 0; block < count; block += 1) {
        const end = Math.min(length, (block + 1) * BASE_BLOCK);
        let lo = min[block]; let hi = max[block];
        for (let i = block * BASE_BLOCK; i < end; i += 1) { const v = channel[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
        min[block] = lo; max[block] = hi;
      }
    }
    levels.push({ block: BASE_BLOCK, min, max });
    while (levels[levels.length - 1].min.length > 8) {
      const prev = levels[levels.length - 1]; const next = Math.ceil(prev.min.length / LEVEL_FACTOR);
      const lo = new Float32Array(next).fill(1); const hi = new Float32Array(next).fill(-1);
      for (let i = 0; i < prev.min.length; i += 1) { const j = Math.floor(i / LEVEL_FACTOR); if (prev.min[i] < lo[j]) lo[j] = prev.min[i]; if (prev.max[i] > hi[j]) hi[j] = prev.max[i]; }
      levels.push({ block: prev.block * LEVEL_FACTOR, min: lo, max: hi });
    }
  }
  return { channels, sampleRate, length, levels, cache: new Map() };
}

// Min/max per column for the window [t0, t1]. Columns outside the file come back empty (min > max).
// The last result per (window, columns) is memoised on the pyramid.
export function computePeaks(pyramid, t0, t1, columns) {
  const key = `${t0}|${t1}|${columns}`;
  const hit = pyramid.cache.get(key); if (hit) return hit;
  const min = new Float32Array(columns).fill(1); const max = new Float32Array(columns).fill(-1);
  const { sampleRate, length, channels, levels } = pyramid;
  const perColumn = (t1 - t0) * sampleRate / Math.max(1, columns);
  if (length > 0 && perColumn > 0) {
    let level = null; for (const candidate of levels) if (candidate.block <= perColumn) level = candidate;
    for (let c = 0; c < columns; c += 1) {
      const s0 = Math.max(0, Math.floor((t0 * sampleRate) + c * perColumn)); const s1 = Math.min(length, Math.max(s0 + 1, Math.ceil((t0 * sampleRate) + (c + 1) * perColumn)));
      if (s0 >= length || (t0 * sampleRate) + (c + 1) * perColumn <= 0) continue;
      let lo = 1; let hi = -1;
      if (!level) { for (const channel of channels) for (let i = s0; i < s1; i += 1) { const v = channel[i]; if (v < lo) lo = v; if (v > hi) hi = v; } }
      else {
        const b0 = Math.floor(s0 / level.block); const b1 = Math.min(level.min.length, Math.max(b0 + 1, Math.ceil(s1 / level.block)));
        for (let b = b0; b < b1; b += 1) { if (level.min[b] < lo) lo = level.min[b]; if (level.max[b] > hi) hi = level.max[b]; }
      }
      min[c] = lo; max[c] = hi;
    }
  }
  const result = { min, max };
  if (pyramid.cache.size > 24) pyramid.cache.delete(pyramid.cache.keys().next().value);
  pyramid.cache.set(key, result); return result;
}

// ---------------------------------------------------------------- ruler
const MANTISSAS = [1, 2, 5];
export function tickStep(span, width, minPixels = 80) {
  if (!(span > 0) || !(width > 0)) return 1;
  const target = span / Math.max(1, Math.floor(width / minPixels));
  const exponent = Math.floor(Math.log10(target));
  for (const power of [exponent, exponent + 1]) for (const m of MANTISSAS) { const step = m * 10 ** power; if (step >= target * (1 - 1e-9)) return Number(step.toPrecision(6)); }
  return 10 ** (exponent + 1);
}

export function formatTick(time, step) {
  if (step >= 1 && time >= 60) { const total = Math.round(time); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; }
  const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9));
  return `${time.toFixed(decimals)} s`;
}

export function rulerTicks(view, width, minPixels = 80) {
  const step = tickStep(view.span, width, minPixels); const ticks = [];
  if (!(view.span > 0)) return { step, ticks };
  const mantissa = Math.round(step / 10 ** Math.floor(Math.log10(step) + 1e-9));
  const minor = step / (mantissa === 2 ? 4 : 5);
  const first = Math.floor(view.start / minor); const last = Math.ceil((view.start + view.span) / minor);
  for (let i = first; i <= last; i += 1) {
    const t = Number((i * minor).toPrecision(9)); if (t < view.start - minor || t > view.start + view.span + minor) continue;
    const major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
    ticks.push({ t, major, label: major ? formatTick(Math.round(t / step) * step, step) : '' });
  }
  return { step, ticks };
}

// ---------------------------------------------------------------- playback
export function playBounds(sel, duration, scope) {
  return scope === 'whole' ? { start: 0, end: Math.max(duration, 0) } : { start: sel.start, end: sel.end };
}

// Where playback should begin: at the playhead if it is inside the bounds, otherwise at the start.
export function startPosition(playhead, bounds) {
  return Number.isFinite(playhead) && playhead >= bounds.start && playhead < bounds.end - 1e-6 ? playhead : bounds.start;
}

// Playhead position `elapsed` seconds after playback began at `anchorPos`.
export function positionAt({ anchorPos, elapsed, bounds, loop }) {
  const raw = anchorPos + Math.max(0, elapsed); const length = bounds.end - bounds.start;
  if (raw < bounds.end) return { pos: raw, ended: false };
  if (loop && length > 0) return { pos: bounds.start + ((raw - bounds.start) % length), ended: false };
  return { pos: bounds.end, ended: true };
}

export function formatClock(time) {
  const safe = Math.max(0, time); const minutes = Math.floor(safe / 60); const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(3).padStart(6, '0')}`;
}
