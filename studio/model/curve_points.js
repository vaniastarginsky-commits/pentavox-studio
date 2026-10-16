// Editable curve model: a list of points, each starting a segment to the next one.
//   { x, y, bend?, ease? }  x and y in 0..1, x non-decreasing (equal x = a vertical edge).
//   bend (-1..1): power curve on the segment, 0 is straight. ease: cosine S-curve (wins over bend).
// The module stores dense samples; toSamples/fromSamples convert at the boundary.

export const clamp01 = (value) => Math.min(1, Math.max(0, value));
const BEND_RANGE = 3;   // bend 1 = exponent 2^3
const exponent = (bend) => 2 ** (bend * BEND_RANGE);

export function segmentShape(point, u) {
  if (point.ease) return (1 - Math.cos(Math.PI * u)) / 2;
  return point.bend ? u ** exponent(point.bend) : u;
}

export function evalCurve(points, t) {
  let index = 0;
  for (let next = 1; next < points.length && points[next].x <= t; ++next) index = next;
  const from = points[index];
  const to = points[index + 1];
  if (!to) return from.y;
  const u = (t - from.x) / (to.x - from.x);
  return from.y + (to.y - from.y) * segmentShape(from, u);
}

export function toSamples(points, count) {
  return Array.from({ length: count }, (_, frame) => clamp01(evalCurve(points, count === 1 ? 0 : frame / (count - 1))));
}

function simplify(xs, ys, epsilon) {
  const keep = new Uint8Array(xs.length);
  keep[0] = 1; keep[xs.length - 1] = 1;
  const stack = [[0, xs.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let worst = -1; let distance = epsilon;
    for (let index = first + 1; index < last; ++index) {
      const along = (xs[index] - xs[first]) / (xs[last] - xs[first]);
      const error = Math.abs(ys[index] - (ys[first] + (ys[last] - ys[first]) * along));
      if (error > distance) { distance = error; worst = index; }
    }
    if (worst >= 0) { keep[worst] = 1; stack.push([first, worst], [worst, last]); }
  }
  return xs.flatMap((x, index) => (keep[index] ? [{ x, y: ys[index] }] : []));
}

/** Dense samples to editable points (Ramer–Douglas–Peucker); the tolerance grows until at most `maxPoints` remain. */
export function fromSamples(samples, epsilon = 0.004, maxPoints = 120) {
  if (samples.length < 2) return [{ x: 0, y: samples[0] ?? 0.5 }, { x: 1, y: samples[0] ?? 0.5 }];
  const xs = samples.map((_, frame) => frame / (samples.length - 1));
  let points = simplify(xs, samples, epsilon);
  for (let tolerance = epsilon; points.length > maxPoints; tolerance *= 1.5) points = simplify(xs, samples, tolerance);
  return points;
}

const clone = (points) => points.map((point) => ({ ...point }));

export function insertPoint(points, x, y) {
  const output = clone(points);
  let index = 1;
  while (index < output.length && output[index].x <= x) ++index;
  output.splice(index, 0, { x: clamp01(x), y: clamp01(y) });
  return { points: output, index };
}

export function removePoint(points, index) {
  if (points.length <= 2) return clone(points);
  const output = clone(points);
  output.splice(index, 1);
  output[0].x = 0; output[output.length - 1].x = 1;
  return output;
}

/** Moves a point; x stays between its neighbours (equal is allowed: that makes a vertical edge), the ends keep x 0 and 1. */
export function movePoint(points, index, x, y) {
  const output = clone(points);
  const last = output.length - 1;
  const low = index === 0 ? 0 : output[index - 1].x;
  const high = index === last ? 1 : output[index + 1].x;
  output[index].x = index === 0 ? 0 : index === last ? 1 : Math.min(high, Math.max(low, x));
  output[index].y = clamp01(y);
  return output;
}

export function setBend(points, index, bend) {
  const output = clone(points);
  output[index].bend = Math.min(1, Math.max(-1, bend));
  delete output[index].ease;
  if (Math.abs(output[index].bend) < 0.02) delete output[index].bend;
  return output;
}

export function toggleEase(points, index) {
  const output = clone(points);
  if (output[index].ease) delete output[index].ease; else { output[index].ease = true; delete output[index].bend; }
  return output;
}

/** The bend that makes the segment pass through `y` at its middle (what dragging the white handle asks for). */
export function bendForMidpoint(from, to, y) {
  if (to.y === from.y) return 0;
  const middle = Math.min(0.996, Math.max(0.004, (y - from.y) / (to.y - from.y)));
  return Math.min(1, Math.max(-1, Math.log2(Math.log(middle) / Math.log(0.5)) / BEND_RANGE));
}

export function reversePoints(points) {
  const count = points.length;
  return points.map((_, index) => {
    const source = points[count - 1 - index];
    const params = index < count - 1 ? points[count - 2 - index] : {};
    const point = { x: 1 - source.x, y: source.y };
    if (params.ease) point.ease = true; else if (params.bend) point.bend = -params.bend;
    return point;
  });
}

export const invertPoints = (points) => points.map((point) => ({ ...point, y: 1 - point.y }));

// One cycle of each drawable shape, x and y in 0..1.
export const SHAPES = Object.freeze({
  square: [{ x: 0, y: 1 }, { x: 0.5, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }],
  sawDown: [{ x: 0, y: 1 }, { x: 1, y: 0 }],
  sawUp: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  triangle: [{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 0 }],
  sine: [{ x: 0, y: 0, ease: true }, { x: 0.5, y: 1, ease: true }, { x: 1, y: 0 }],
});

const same = (a, b) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

// Swaps the range [from, to] for `stamped`; anchors hold the old curve's value at both ends, so the stamp's edges are vertical steps.
function replaceRange(points, from, to, stamped) {
  const before = from > 0 ? [{ x: from, y: evalCurve(points, from) }] : [];
  const after = to < 1 ? [{ x: to, y: evalCurve(points, to) }] : [];
  const merged = [...points.filter((point) => point.x < from).map((point) => ({ ...point })), ...before, ...stamped, ...after,
    ...points.filter((point) => point.x > to).map((point) => ({ ...point }))];
  const output = merged.filter((point, index) => index === 0 || !same(point, merged[index - 1]));
  output[0].x = 0; output[output.length - 1].x = 1;
  return output;
}

/** Replaces x0..x1 with `cells` equal cycles of a shape that swings between 0 and 1. The curve outside that range is kept. */
export function stampShape(points, x0, x1, shape, cells = 1) {
  const from = Math.min(x0, x1); const to = Math.max(x0, x1);
  if (to - from < 1e-6) return clone(points);
  const stamped = [];
  const width = (to - from) / cells;
  for (let cell = 0; cell < cells; ++cell) {
    for (const point of SHAPES[shape]) stamped.push({ ...point, x: from + (cell + point.x) * width });
  }
  return replaceRange(points, from, to, stamped);
}

/**
 * Stamps one cycle of `shape` per grid cell from `firstCell` on, each swinging between `baseline` and that cell's own
 * peak (`peaks[k]`, 0..1): drawing across the grid draws the amplitude. `cols` is the number of cells across the loop.
 */
export function stampCells(points, firstCell, peaks, cols, shape, baseline) {
  if (!peaks.length) return clone(points);
  const stamped = [];
  peaks.forEach((peak, offset) => {
    const left = (firstCell + offset) / cols; const width = 1 / cols;
    for (const point of SHAPES[shape]) {
      stamped.push({ ...point, x: left + point.x * width, y: baseline + (peak - baseline) * point.y });
    }
  });
  return replaceRange(points, firstCell / cols, Math.min(1, (firstCell + peaks.length) / cols), stamped);
}

/** Replaces the range [from, to] with a hand-drawn dense stroke (an array of samples over the whole 0..1 span). */
export function spliceStroke(points, dense, from, to) {
  const count = dense.length;
  // One extra sample on each side anchors the stroke to the curve that was there.
  const first = Math.max(0, Math.floor(Math.min(from, to) * (count - 1)) - 1);
  const last = Math.min(count - 1, Math.ceil(Math.max(from, to) * (count - 1)) + 1);
  if (last <= first) return clone(points);
  const xs = []; const ys = [];
  for (let frame = first; frame <= last; ++frame) { xs.push(frame / (count - 1)); ys.push(dense[frame]); }
  const drawn = simplify(xs, ys, 0.004);
  const lowX = xs[0]; const highX = xs[xs.length - 1];
  const output = [...points.filter((point) => point.x < lowX), ...drawn, ...points.filter((point) => point.x > highX)].map((point) => ({ ...point }));
  output[0].x = 0; output[output.length - 1].x = 1;
  return output;
}

export function snapValue(value, steps) { return steps > 0 ? Math.round(value * steps) / steps : value; }
