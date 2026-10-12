// Ready-made modulation curves, as editable points. Categories follow how they are used.
import { fromSamples, SHAPES } from './curve_points.js';

const P = (x, y, extra = {}) => ({ x, y, ...extra });

function tile(cycles, shape, level = (index) => 1) {
  const points = [];
  for (let cycle = 0; cycle < cycles; ++cycle) {
    for (const point of SHAPES[shape]) points.push({ ...point, x: (cycle + point.x) / cycles, y: point.y * level(cycle) });
  }
  return points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
}

function stairs(values) {
  const points = [];
  values.forEach((value, index) => {
    points.push(P(index / values.length, value), P((index + 1) / values.length, value));
  });
  return points;
}

function randomValues(count, seed) {
  let state = seed >>> 0;
  return Array.from({ length: count }, () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.round((((t ^ (t >>> 14)) >>> 0) / 4294967296) * 20) / 20;
  });
}


const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Points from a function of time 0..1 (values clamped), simplified so the result stays editable. */
function fromFn(fn, count = 320, tolerance = 0.006) {
  return fromSamples(Array.from({ length: count }, (_, index) => clamp01(fn(index / (count - 1)))), tolerance, 90);
}

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A jagged random line: `count` points at uneven spacing, optionally eased. */
function jagged(count, seed, { ease = false, spread = 1 } = {}) {
  const next = rng(seed);
  const xs = Array.from({ length: count - 2 }, () => next()).sort((a, b) => a - b);
  return [0, ...xs, 1].map((x, index, all) => ({ x, y: Math.round((0.5 + (next() - 0.5) * spread) * 100) / 100, ...(ease && index < all.length - 1 ? { ease: true } : {}) }));
}

const pulses = (starts, width, high = 1) => {
  const points = [P(0, 0)];
  for (const start of starts) points.push(P(start, 0), P(start, high), P(start + width, high), P(start + width, 0));
  points.push(P(1, 0));
  return points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
};

const evenly = (count) => Array.from({ length: count }, (_, index) => index / count);
const duty = (cycles, fraction) => {
  const points = [];
  for (let cycle = 0; cycle < cycles; ++cycle) {
    const left = cycle / cycles; const width = 1 / cycles;
    points.push(P(left, 1), P(left + width * fraction, 1), P(left + width * fraction, 0), P(left + width, 0));
  }
  return points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
};

const decayingTeeth = (count) => tile(count, 'sawDown', (index) => 1 - index / (count + 1));

export const CATEGORIES = Object.freeze(['Periodic', 'Envelope', 'Sequence']);

export const CURVES = Object.freeze([
  { id: 'sine', category: 'Periodic', name: 'Sine', points: tile(1, 'sine') },
  { id: 'sine2', category: 'Periodic', name: 'Sine ×2', points: tile(2, 'sine') },
  { id: 'sine4', category: 'Periodic', name: 'Sine ×4', points: tile(4, 'sine') },
  { id: 'triangle', category: 'Periodic', name: 'Triangle', points: tile(1, 'triangle') },
  { id: 'triangle4', category: 'Periodic', name: 'Triangle ×4', points: tile(4, 'triangle') },
  { id: 'saw-up', category: 'Periodic', name: 'Ramp up', points: tile(1, 'sawUp') },
  { id: 'saw-down', category: 'Periodic', name: 'Ramp down', points: tile(1, 'sawDown') },
  { id: 'saw-up4', category: 'Periodic', name: 'Ramp up ×4', points: tile(4, 'sawUp') },
  { id: 'square', category: 'Periodic', name: 'Square', points: tile(1, 'square') },
  { id: 'square8', category: 'Periodic', name: 'Square ×8', points: tile(8, 'square') },
  { id: 'pulse', category: 'Periodic', name: 'Pulse 25%', points: [P(0, 1), P(0.25, 1), P(0.25, 0), P(1, 0)] },
  { id: 'wobble', category: 'Periodic', name: 'Wobble', points: tile(6, 'sine', (index) => 1 - index * 0.14) },
  { id: 'dual-ramp', category: 'Periodic', name: 'Dual ramp ups', points: [P(0, 0), P(0.5, 0.5), P(0.5, 0), P(1, 1)] },

  { id: 'attack', category: 'Envelope', name: 'Attack', points: [P(0, 1, { bend: -0.75 }), P(1, 0)] },
  { id: 'swell', category: 'Envelope', name: 'Swell', points: [P(0, 0, { bend: 0.75 }), P(1, 1)] },
  { id: 'expo-rise', category: 'Envelope', name: 'Expo rise', points: [P(0, 0, { bend: 0.9 }), P(0.97, 1), P(0.97, 0), P(1, 0)] },
  { id: 'pluck', category: 'Envelope', name: 'Pluck', points: [P(0, 0), P(0.04, 1, { bend: -0.6 }), P(1, 0)] },
  { id: 'pad', category: 'Envelope', name: 'Pad', points: [P(0, 0, { ease: true }), P(0.4, 1), P(0.6, 1, { ease: true }), P(1, 0)] },
  { id: 'hump', category: 'Envelope', name: 'Hump', points: [P(0, 0, { ease: true }), P(0.5, 1, { ease: true }), P(1, 0)] },
  { id: 'gate-fade', category: 'Envelope', name: 'Gate fade', points: [P(0, 1), P(0.5, 1), P(0.5, 1, { bend: -0.5 }), P(1, 0)] },
  { id: 'breach', category: 'Envelope', name: 'Breach', points: [P(0, 0.5, { ease: true }), P(0.1, 0.1, { ease: true }), P(0.2, 0.9, { ease: true }), P(0.32, 0.25, { ease: true }), P(0.45, 0.7, { ease: true }), P(0.6, 0.4, { ease: true }), P(1, 0.85, { bend: 0.3 })] },

  { id: 'bounce', category: 'Sequence', name: 'Bounce', points: [P(0, 0, { ease: true }), P(0.4, 1, { ease: true }), P(0.62, 0), ...decayingTeeth(6).map((point) => ({ ...point, x: 0.62 + point.x * 0.38 })).slice(1)] },
  { id: 'ratchet', category: 'Sequence', name: 'Ratchet decay', points: decayingTeeth(7) },
  { id: 'stairs-up', category: 'Sequence', name: 'Stairs up', points: stairs([0, 1, 2, 3, 4, 5, 6, 7].map((v) => v / 7)) },
  { id: 'stairs-down', category: 'Sequence', name: 'Stairs down', points: stairs([7, 6, 5, 4, 3, 2, 1, 0].map((v) => v / 7)) },
  { id: 'hold-8', category: 'Sequence', name: 'Sample & hold 8', points: stairs(randomValues(8, 7)) },
  { id: 'hold-16', category: 'Sequence', name: 'Sample & hold 16', points: stairs(randomValues(16, 21)) },
  { id: 'hold-4', category: 'Sequence', name: 'Sample & hold 4', points: stairs(randomValues(4, 3)) },
  { id: 'auto-wah', category: 'Sequence', name: 'Auto wah', points: [P(0, 0, { ease: true }), P(0.1, 1, { ease: true }), P(0.25, 0.1, { ease: true }), P(0.38, 0.8, { ease: true }), P(0.5, 0.05, { ease: true }), P(0.65, 0.95, { ease: true }), P(0.8, 0.1, { ease: true }), P(1, 0.6)] },
  { id: 'heartbeat', category: 'Sequence', name: 'Heartbeat', points: [P(0, 0), P(0.05, 1, { bend: -0.4 }), P(0.2, 0), P(0.3, 0), P(0.35, 0.7, { bend: -0.4 }), P(0.5, 0), P(1, 0)] },
  { id: 'offbeat', category: 'Sequence', name: 'Offbeat pulses', points: [P(0, 0), P(0.125, 0), P(0.125, 1), P(0.25, 1), P(0.25, 0), P(0.625, 0), P(0.625, 1), P(0.75, 1), P(0.75, 0), P(1, 0)] },

  // Periodic, more
  { id: 'sine3', category: 'Periodic', name: 'Sine ×3', points: tile(3, 'sine') },
  { id: 'sine8', category: 'Periodic', name: 'Sine ×8', points: tile(8, 'sine') },
  { id: 'triangle2', category: 'Periodic', name: 'Triangle ×2', points: tile(2, 'triangle') },
  { id: 'triangle8', category: 'Periodic', name: 'Triangle ×8', points: tile(8, 'triangle') },
  { id: 'saw-down4', category: 'Periodic', name: 'Ramp down ×4', points: tile(4, 'sawDown') },
  { id: 'saw-up8', category: 'Periodic', name: 'Ramp up ×8', points: tile(8, 'sawUp') },
  { id: 'saw-down8', category: 'Periodic', name: 'Ramp down ×8', points: tile(8, 'sawDown') },
  { id: 'square2', category: 'Periodic', name: 'Square ×2', points: tile(2, 'square') },
  { id: 'square4', category: 'Periodic', name: 'Square ×4', points: tile(4, 'square') },
  { id: 'pulse-10', category: 'Periodic', name: 'Pulse 10% ×4', points: duty(4, 0.1) },
  { id: 'pulse-25', category: 'Periodic', name: 'Pulse 25% ×4', points: duty(4, 0.25) },
  { id: 'pulse-75', category: 'Periodic', name: 'Pulse 75% ×4', points: duty(4, 0.75) },
  { id: 'soft-square', category: 'Periodic', name: 'Soft square', points: fromFn((t) => 0.5 + 0.5 * Math.tanh(4 * Math.sin(Math.PI * 4 * t))) },
  { id: 'arches', category: 'Periodic', name: 'Arches', points: fromFn((t) => Math.abs(Math.sin(Math.PI * 4 * t))) },
  { id: 'rectified', category: 'Periodic', name: 'Half sine', points: fromFn((t) => Math.max(0, Math.sin(Math.PI * 8 * t))) },
  { id: 'fm', category: 'Periodic', name: 'Warble', points: fromFn((t) => 0.5 + 0.5 * Math.sin(2 * Math.PI * (3 * t + 0.35 * Math.sin(2 * Math.PI * 7 * t)))) },
  { id: 'beating', category: 'Periodic', name: 'Beating', points: fromFn((t) => 0.5 + 0.25 * Math.sin(2 * Math.PI * 9 * t) + 0.25 * Math.sin(2 * Math.PI * 10 * t)) },
  { id: 'centrifugal', category: 'Periodic', name: 'Centrifugal force', points: fromFn((t) => 0.5 + 0.5 * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * 7 * t)) },
  { id: 'swing', category: 'Periodic', name: 'Swing', points: fromFn((t) => 0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * t) ** 3) },
  { id: 'edges', category: 'Periodic', name: 'Curves and edges', points: [P(0, 0, { ease: true }), P(0.1, 1, { ease: true }), P(0.18, 1, { ease: true }), P(0.3, 0), P(0.38, 1), P(0.5, 0), P(0.52, 0.2, { ease: true }), P(0.6, 0.9), P(1, 0.1)] },

  // Envelopes, more
  { id: 'attack-slow', category: 'Envelope', name: 'Slow attack', points: [P(0, 0, { bend: 0.5 }), P(0.9, 1), P(1, 0)] },
  { id: 'attack-fast', category: 'Envelope', name: 'Fast attack', points: [P(0, 0), P(0.03, 1), P(1, 0.7, { bend: -0.4 })] },
  { id: 'fade-in', category: 'Envelope', name: 'Fade in', points: [P(0, 0), P(1, 1)] },
  { id: 'fade-out', category: 'Envelope', name: 'Fade out', points: [P(0, 1), P(1, 0)] },
  { id: 'fade-in-out', category: 'Envelope', name: 'Fade in and out', points: [P(0, 0), P(0.5, 1), P(1, 0)] },
  { id: 'hit', category: 'Envelope', name: 'Hit', points: [P(0, 1, { bend: -0.9 }), P(0.5, 0), P(1, 0)] },
  { id: 'hit-double', category: 'Envelope', name: 'Double hit', points: [P(0, 1, { bend: -0.9 }), P(0.3, 0), P(0.5, 0), P(0.5, 0.7, { bend: -0.9 }), P(0.85, 0), P(1, 0)] },
  { id: 'stab', category: 'Envelope', name: 'Stab', points: [P(0, 0), P(0.02, 1), P(0.18, 1), P(0.2, 0), P(1, 0)] },
  { id: 'duck', category: 'Envelope', name: 'Ducking', points: [P(0, 1), P(0.04, 0.1), P(0.5, 1, { bend: 0.6 }), P(1, 1)] },
  { id: 'duck4', category: 'Envelope', name: 'Pump ×4', points: Array.from({ length: 4 }, (_, index) => [P(index / 4, 0.05), P((index + 0.9) / 4, 1, { bend: 0.6 })]).flat().concat(P(1, 1)) },
  { id: 'gate-short', category: 'Envelope', name: 'Short gate', points: pulses([0.05], 0.15) },
  { id: 'gate-long', category: 'Envelope', name: 'Long gate', points: pulses([0.1], 0.6) },
  { id: 'ramp-drop', category: 'Envelope', name: 'Ramp then drop', points: [P(0, 0), P(0.8, 1), P(0.8, 0), P(1, 0)] },
  { id: 'dip', category: 'Envelope', name: 'Dip', points: [P(0, 1), P(0.4, 0, { ease: true }), P(0.6, 0, { ease: true }), P(1, 1)] },
  { id: 'wave-out', category: 'Envelope', name: 'Fading wave', points: fromFn((t) => 0.5 + 0.5 * (1 - t) * Math.sin(2 * Math.PI * 4 * t)) },
  { id: 'wave-in', category: 'Envelope', name: 'Growing wave', points: fromFn((t) => 0.5 + 0.5 * t * Math.sin(2 * Math.PI * 4 * t)) },
  { id: 'cologne', category: 'Envelope', name: 'Cologne', points: [P(0, 0), P(0.06, 1), P(0.12, 0), P(0.18, 0.9), P(0.27, 0.15), P(0.55, 0.15), P(0.58, 0.28), P(0.61, 0.15), P(0.9, 0.15), P(1, 0)] },

  // Sequences, more
  { id: 'stairs-up4', category: 'Sequence', name: 'Stairs up ×4', points: stairs([0, 1, 2, 3].map((v) => v / 3)) },
  { id: 'stairs-down4', category: 'Sequence', name: 'Stairs down ×4', points: stairs([3, 2, 1, 0].map((v) => v / 3)) },
  { id: 'stairs-up16', category: 'Sequence', name: 'Stairs up ×16', points: stairs(Array.from({ length: 16 }, (_, index) => index / 15)) },
  { id: 'stairs-down16', category: 'Sequence', name: 'Stairs down ×16', points: stairs(Array.from({ length: 16 }, (_, index) => 1 - index / 15)) },
  { id: 'stairs-updown', category: 'Sequence', name: 'Stairs up and down', points: stairs([0, 1, 2, 3, 4, 3, 2, 1].map((v) => v / 4)) },
  { id: 'hold-32', category: 'Sequence', name: 'Sample & hold 32', points: stairs(randomValues(32, 5)) },
  { id: 'hold-6', category: 'Sequence', name: 'Sample & hold 6', points: stairs(randomValues(6, 11)) },
  { id: 'hold-12', category: 'Sequence', name: 'Sample & hold 12', points: stairs(randomValues(12, 17)) },
  { id: 'glide-8', category: 'Sequence', name: 'Random glide 8', points: [...randomValues(8, 9).map((y, index) => P(index / 8, y, { ease: true })), P(1, randomValues(8, 9)[0])] },
  { id: 'glide-16', category: 'Sequence', name: 'Random glide 16', points: [...randomValues(16, 13).map((y, index) => P(index / 16, y, { ease: true })), P(1, randomValues(16, 13)[0])] },
  { id: 'walk', category: 'Sequence', name: 'Random walk', points: jagged(24, 3, { ease: true, spread: 0.9 }) },
  { id: 'crooked-1', category: 'Sequence', name: 'Crooked I', points: jagged(40, 101) },
  { id: 'crooked-2', category: 'Sequence', name: 'Crooked II', points: jagged(30, 202) },
  { id: 'crooked-3', category: 'Sequence', name: 'Crooked III', points: jagged(55, 303) },
  { id: 'rising-ratchet', category: 'Sequence', name: 'Rising ratchet', points: tile(7, 'sawUp', (index) => 0.2 + index * 0.13) },
  { id: 'triple-ramp', category: 'Sequence', name: 'Triple ramp ups', points: [P(0, 0), P(0.33, 0.4), P(0.33, 0), P(0.66, 0.7), P(0.66, 0), P(1, 1)] },
  { id: 'triplets', category: 'Sequence', name: 'Triplet pulses', points: pulses(evenly(3), 0.1) },
  { id: 'sixteenths', category: 'Sequence', name: 'Sixteenth pulses', points: pulses(evenly(16), 0.03) },
  { id: 'dotted', category: 'Sequence', name: 'Dotted rhythm', points: pulses([0, 0.375, 0.5, 0.875], 0.06) },
  { id: 'clave', category: 'Sequence', name: 'Clave', points: pulses([0, 0.1875, 0.375, 0.625, 0.8125].map((v) => v), 0.05) },
  { id: 'zigzag', category: 'Sequence', name: 'Zigzag', points: [P(0, 0), P(0.1, 1), P(0.2, 0.2), P(0.3, 0.9), P(0.4, 0.1), P(0.5, 0.8), P(0.6, 0.3), P(0.7, 0.7), P(0.8, 0.4), P(0.9, 0.6), P(1, 0.5)] },
]);
