// The module's LED skin (HostLink commands 0x7D..0x7F): a custom colour and an effect for every ring of every page and layer.
// Firmware: fw/include/pentavox/hw/led_skin.h and led_skin_extension.h. Everything here that is not the wire is pure, so it is tested without a module.

export const SKIN_COMMAND = Object.freeze({ GET: 0x7d, SET: 0x7e, CONTROL: 0x7f, INFO: 0xff });
export const SKIN_OP = Object.freeze({ RESET: 1 });
export const SKIN_LAYERS = 16;
export const SKIN_POTS = 6;
export const SKIN_WARNINGS = 0xfe;
// What of a ring an entry dresses (firmware led_skin.h): the lit arc; the pip, when the firmware lights one; what measures against the arc (meters, the
// dim rulers of the divisions, an envelope's background); the running position dot.
export const SKIN_ELEMENTS = Object.freeze([
  { id: 'body', name: 'Ring', help: 'The lit arc: fills, bipolar arcs, steps, an envelope or a drive meter' },
  { id: 'pip', name: 'Pip', help: 'The bottom LED, whenever the firmware lights it (an off marker, a lock, the slot)' },
  { id: 'scale', name: 'Scale', help: 'Meters (one colour instead of green, yellow, red), the dim rulers of the divisions, an envelope’s background' },
  { id: 'dot', name: 'Position dot', help: 'The dot that runs round a ring: a loop’s playhead, the marker over a stutter ruler' },
]);
export const SKIN_WARNING_NAMES = Object.freeze(['New loop: blinking before the wipe', 'New loop: the flash after the wipe']);
export const SKIN_EFFECTS = Object.freeze(['Off', 'Steady', 'Breathe', 'Pulse', 'Blink', 'Beat', 'Bar', 'Modulation', 'Value', 'Output', 'Input', 'Sidechain', 'Loop']);
/** Effects 1..4 move on their own clock; from FOLLOW_FIRST on, brightness follows something the module is doing. */
export const SKIN_FOLLOW_FIRST = 5;
// Page slots, as the firmware's Page enum numbers them (the looper build reuses Sampler2 as the Slice page).
export const SKIN_PAGES = Object.freeze([
  { id: 0, name: 'Voice 1' }, { id: 1, name: 'Voice 2' }, { id: 2, name: 'Sampler / Looper' }, { id: 3, name: 'Slice' },
  { id: 4, name: 'FX Live' }, { id: 5, name: 'FX Granular' }, { id: 6, name: 'FX Tone' },
]);
export const layerOf = (page, shift) => page * 2 + (shift ? 1 : 0);
// The firmware numbers pages by its Page enum (Voice1, Voice2, Sampler1, Slice, FxLive, FxGranular, FxTone); the pager of the descriptor lists only the
// pages a build has, so a page is found by its name. 'Master' is the FX Tone page.
const PAGE_BY_NAME = Object.freeze({ 'Voice 1': 0, 'Voice 2': 1, 'Sampler 1': 2, Sampler: 2, Looper: 2, Slice: 3, 'FX Live': 4, 'FX Granular': 5, 'FX Tone': 6, Master: 6 });
export const skinPageOf = (name, fallback = 0) => PAGE_BY_NAME[name] ?? fallback;

// The colours picked on the physical LEDs (docs/led-palette-picked-2026-10-14.txt). Screen RGB is not the LED's colour; these are.
export const PICKED_COLOURS = Object.freeze([
  ['Bright green', [0, 255, 0]], ['Lime', [81, 255, 64]], ['Acid', [92, 227, 13]], ['Bright red', [255, 0, 0]], ['Light red', [255, 7, 10]],
  ['Coral', [255, 18, 54]], ['Orange', [255, 70, 0]], ['Light orange', [255, 141, 63]], ['Yellow', [255, 179, 0]], ['Bright yellow', [255, 255, 0]],
  ['Bright cyan', [0, 255, 255]], ['Light cyan', [77, 255, 255]], ['Sky blue', [0, 41, 255]], ['Light blue', [25, 25, 255]], ['Blue', [0, 0, 255]],
  ['Violet', [63, 0, 255]], ['Light violet', [59, 14, 255]], ['Pink', [255, 0, 255]], ['Light pink', [255, 30, 255]], ['White', [255, 255, 255]],
].map(([name, rgb]) => Object.freeze({ name, rgb: Object.freeze(rgb) })));

export const emptyRing = () => ({ r: 0, g: 0, b: 0, effect: 0 });
export const emptyPot = () => Object.fromEntries(SKIN_ELEMENTS.map((element) => [element.id, emptyRing()]));
export const emptySkin = () => ({ layers: Array.from({ length: SKIN_LAYERS }, () => Array.from({ length: SKIN_POTS }, emptyPot)), warnings: [emptyRing(), emptyRing()] });

const clampByte = (v) => Math.max(0, Math.min(255, Math.round(Number(v) || 0)));
function putRing(out, at, ring) {
  const effect = Math.round(Number(ring.effect) || 0);
  if (effect < 0 || effect >= SKIN_EFFECTS.length) throw new RangeError(`Unknown effect ${ring.effect}`);
  out.set([clampByte(ring.r), clampByte(ring.g), clampByte(ring.b), effect], at);
}
const getRing = (body, at) => ({ r: body[at], g: body[at + 1], b: body[at + 2], effect: body[at + 3] });

/** A layer goes out as 1 + 6 pots x 4 elements x 4 bytes. */
export function encodeLayer(layer, pots) {
  if (!Number.isInteger(layer) || layer < 0 || layer >= SKIN_LAYERS) throw new RangeError(`Layer ${layer} is outside 0..${SKIN_LAYERS - 1}`);
  if (pots.length !== SKIN_POTS) throw new RangeError(`A layer has ${SKIN_POTS} rings`);
  const out = new Uint8Array(1 + SKIN_POTS * SKIN_ELEMENTS.length * 4);
  out[0] = layer;
  pots.forEach((pot, p) => SKIN_ELEMENTS.forEach((element, e) => putRing(out, 1 + (p * SKIN_ELEMENTS.length + e) * 4, pot[element.id])));
  return out;
}
export function decodeLayer(body) {
  if (body.length !== 1 + SKIN_POTS * SKIN_ELEMENTS.length * 4) throw new RangeError(`A layer reply is ${1 + SKIN_POTS * SKIN_ELEMENTS.length * 4} bytes`);
  const pots = Array.from({ length: SKIN_POTS }, (_, p) => Object.fromEntries(SKIN_ELEMENTS.map((element, e) => [element.id, getRing(body, 1 + (p * SKIN_ELEMENTS.length + e) * 4)])));
  return { layer: body[0], pots };
}
export function encodeWarnings(warnings) {
  if (warnings.length !== 2) throw new RangeError('There are two new-loop warnings');
  const out = new Uint8Array(1 + 8);
  out[0] = SKIN_WARNINGS;
  warnings.forEach((ring, i) => putRing(out, 1 + i * 4, ring));
  return out;
}
export function decodeWarnings(body) {
  if (body.length !== 9 || body[0] !== SKIN_WARNINGS) throw new RangeError('A warnings reply is 9 bytes');
  return [getRing(body, 1), getRing(body, 5)];
}
export function decodeInfo(body) {
  if (body.length < 5) throw new RangeError('An info reply is at least 5 bytes');
  return { format: body[0], layers: body[1], pots: body[2], effects: body[3], elements: body[4] ?? SKIN_ELEMENTS.length };
}

export const toHex = ({ r, g, b }) => `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`;
export function fromHex(text) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(text).trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// How a ring looks on screen at a moment: the CSS colour, with the effect's brightness. Mirrors the firmware's SkinLevel.
export function breath(timeMs, periodMs) {
  const phase = (timeMs % periodMs) / periodMs;
  const tri = phase < 0.5 ? 2 * phase : 2 * (1 - phase);
  return 0.15 + 0.85 * (tri * tri * (3 - 2 * tri));
}
export function effectLevel(effect, timeMs) {
  switch (effect) {
    case 2: return breath(timeMs, 1250);
    case 3: return breath(timeMs, 500);
    case 4: return (timeMs % 500) < 250 ? 1 : 0;
    default: return 1;
  }
}

/** The 13 LED positions of a ring as angles in degrees clockwise from 12 o'clock (the LED at 6 o'clock is the pip). */
export function ledAngles() { return Array.from({ length: 12 }, (_, hour) => hour * 30); }

export class LedSkinClient {
  constructor(client) { this.client = client; }
  async info() { const { body } = await this.client.request(SKIN_COMMAND.GET, Uint8Array.of(SKIN_COMMAND.INFO)); return decodeInfo(body); }
  async readLayer(layer) { const { body } = await this.client.request(SKIN_COMMAND.GET, Uint8Array.of(layer)); return decodeLayer(body); }
  async readWarnings() { const { body } = await this.client.request(SKIN_COMMAND.GET, Uint8Array.of(SKIN_WARNINGS)); return decodeWarnings(body); }
  async readAll(onProgress = () => {}) {
    const layers = [];
    for (let layer = 0; layer < SKIN_LAYERS; ++layer) { layers.push((await this.readLayer(layer)).pots); onProgress((layer + 1) / (SKIN_LAYERS + 1)); }
    return { layers, warnings: await this.readWarnings() };
  }
  async writeLayer(layer, pots) { await this.client.request(SKIN_COMMAND.SET, encodeLayer(layer, pots)); }
  async writeWarnings(warnings) { await this.client.request(SKIN_COMMAND.SET, encodeWarnings(warnings)); }
  async control(op) { await this.client.request(SKIN_COMMAND.CONTROL, Uint8Array.of(op)); }
  reset() { return this.control(SKIN_OP.RESET); }
}
