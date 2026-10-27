// The to-scale drawing of the front panel, shared by the Manual tab and the panel dock that sits beside the working tabs.
// It draws the plate, the six knobs with their LED rings, the three buttons, the USB-C port and the ten jacks, and paints the
// knobs for one page of the firmware's pager. Interaction (hover, click, readout) belongs to the caller.
import { JACK_GRID, PANEL, POT_POSITIONS, jackLabel } from './manual_vm.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const RING_DOTS = 13;            // the LEDs of a knob ring that sweep the arc (the other three sit at the bottom, unused here)
export const RING_START = -135;         // degrees clockwise from twelve o'clock: half past seven

export function svg(tag, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

export const clip = (text, max = 16) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
export const polar = (cx, cy, radius, degrees) => [cx + radius * Math.sin((degrees * Math.PI) / 180), cy - radius * Math.cos((degrees * Math.PI) / 180)];

const hitCircle = (cx, cy, radius) => svg('circle', { cx, cy, r: radius, class: 'mp-hit' });

export function drawPanel() {
  const { x, y, width, height } = PANEL;
  const drawing = svg('svg', { viewBox: `${x} ${y} ${width} ${height}`, class: 'mp-svg', role: 'group', 'aria-label': 'Front panel of the module, drawn to scale' });
  drawing.append(svg('rect', { x, y, width, height, rx: 1.4, class: 'mp-plate' }));
  drawing.append(svg('rect', { x: x + 1.6, y: y + 1.6, width: width - 3.2, height: height - 3.2, rx: 0.8, class: 'mp-inset' }));
  for (const [px, py] of [[63.49, 35.09], [111.13, 35.09], [63.49, 157.6], [111.13, 157.6]]) drawing.append(svg('rect', { x: px - 2.3, y: py - 1.2, width: 4.6, height: 2.4, rx: 1.2, class: 'mp-mount' }));

  const potNodes = PANEL.pots.map((pot) => {
    const group = svg('g', { class: 'mp-pot mp-control', tabindex: 0, role: 'button', 'data-control': `pot${pot.id}`, 'aria-label': `Knob ${pot.id + 1}, ${POT_POSITIONS[pot.id]}` });
    group.append(hitCircle(pot.x, pot.y, 11));
    const dots = Array.from({ length: RING_DOTS }, (_, i) => {
      const [dx, dy] = polar(pot.x, pot.y, 9.9, RING_START + i * (270 / (RING_DOTS - 1)));
      const dot = svg('circle', { cx: dx.toFixed(2), cy: dy.toFixed(2), r: 0.82, class: 'mp-dot' });
      group.append(dot);
      return dot;
    });
    const knob = svg('circle', { cx: pot.x, cy: pot.y, r: 6.5, class: 'mp-knob' });
    const needle = svg('line', { x1: pot.x, y1: pot.y - 2.2, x2: pot.x, y2: pot.y - 5.6, class: 'mp-needle' });
    const label = svg('text', { x: pot.x, y: pot.y + 13.8, class: 'mp-label', 'text-anchor': 'middle' });
    const valueLabel = svg('text', { x: pot.x, y: pot.y + 16.4, class: 'mp-value', 'text-anchor': 'middle' });
    group.append(knob, needle, label, valueLabel);
    drawing.append(group);
    return { pot, group, dots, needle, label, valueLabel };
  });

  for (const button of PANEL.buttons) {
    const group = svg('g', { class: 'mp-button mp-control', tabindex: 0, role: 'button', 'data-control': button.id, 'aria-label': `Button ${button.id.toUpperCase()}` });
    group.append(hitCircle(button.x, button.y, 6), svg('circle', { cx: button.x, cy: button.y, r: 4, class: 'mp-cap' }), svg('text', { x: button.x, y: button.y + 0.95, class: 'mp-cap-text', 'text-anchor': 'middle' }, button.id.toUpperCase()));
    drawing.append(group);
  }

  const usb = svg('g', { class: 'mp-usb mp-control', tabindex: 0, role: 'button', 'data-control': 'usb', 'aria-label': 'USB-C port' });
  usb.append(svg('rect', { x: PANEL.usb.x - 6, y: PANEL.usb.y - 5, width: 12, height: 10, rx: 2, class: 'mp-hit' }), svg('rect', { x: PANEL.usb.x - PANEL.usb.width / 2, y: PANEL.usb.y - PANEL.usb.height / 2, width: PANEL.usb.width, height: PANEL.usb.height, rx: 1.6, class: 'mp-usb-slot' }), svg('text', { x: PANEL.usb.x, y: PANEL.usb.y + 5.6, class: 'mp-label mp-small', 'text-anchor': 'middle' }, 'USB-C'));
  drawing.append(usb);

  JACK_GRID.forEach((row, rowIndex) => row.forEach((number, column) => {
    const cx = PANEL.jackColumns[column];
    const cy = PANEL.jackRows[rowIndex];
    const group = svg('g', { class: 'mp-jack mp-control', tabindex: 0, role: 'button', 'data-control': `jack${number}`, 'aria-label': `Jack ${jackLabel(number)}` });
    group.append(hitCircle(cx, cy, 5.6), svg('circle', { cx, cy, r: 4.5, class: 'mp-nut' }), svg('circle', { cx, cy, r: 2.5, class: 'mp-hole' }), svg('text', { x: cx, y: cy + 7.2, class: 'mp-label mp-small mp-mono', 'text-anchor': 'middle' }, jackLabel(number)));
    drawing.append(group);
  }));
  return { drawing, potNodes };
}

/** Light the rings, turn the needles and name the knobs for one page; `shift` shows the Hold B1 layer. */
export function paintPots(potNodes, page, shift = false) {
  for (const { pot, group, dots, needle, label, valueLabel } of potNodes) {
    const entry = page.pots[pot.id];
    const shifted = shift && entry.shift;
    group.style.setProperty('--ring', entry.colour ?? page.colour);
    const lit = Math.max(1, Math.round(entry.def * (RING_DOTS - 1)) + 1);
    dots.forEach((dot, i) => { dot.classList.toggle('lit', i < lit); dot.classList.remove('pickup-dot', 'pickup-target'); });
    needle.setAttribute('transform', `rotate(${(RING_START + entry.def * 270).toFixed(1)} ${pot.x} ${pot.y})`);
    label.textContent = clip((shift && entry.shift ? entry.shift : entry.name) || '·');
    valueLabel.textContent = '';
    group.setAttribute('role', 'button');
    for (const attribute of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) group.removeAttribute(attribute);
    group.classList.toggle('shifted', Boolean(shifted));
    group.classList.toggle('muted', shift && !shifted);
  }
}

/** Paint current live values over the page defaults and expose the pots as keyboard-operable sliders. */
export function paintLivePots(potNodes, page, values) {
  paintPots(potNodes, page, false);
  for (const { pot, group, dots, needle, valueLabel } of potNodes) {
    const live = values.get(`${page.index}:${pot.id}`);
    if (!live) continue;
    const value = Math.max(0, Math.min(1, live.value));
    const lit = Math.max(1, Math.round(value * (RING_DOTS - 1)) + 1);
    dots.forEach((dot, index) => dot.classList.toggle('lit', index < lit));
    needle.setAttribute('transform', `rotate(${(RING_START + value * 270).toFixed(1)} ${pot.x} ${pot.y})`);
    valueLabel.textContent = live.text;
    group.setAttribute('role', 'slider');
    group.setAttribute('aria-valuemin', '0');
    group.setAttribute('aria-valuemax', '100');
    group.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    group.setAttribute('aria-valuetext', live.text);
  }
}
