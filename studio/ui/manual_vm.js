// View-model of the Manual tab: everything about the module comes from the firmware's own descriptor
// (pages, knob names, shift layer, buttons, jacks, built-in help), so it cannot drift from the firmware that
// is connected. The panel geometry is the Alchemy Lab front panel in millimetres (alchemy-sdk panel template).

export const PANEL = Object.freeze({
  x: 56.36, y: 32.09, width: 60.6, height: 128.5,
  pots: Object.freeze([
    { id: 0, x: 69.16, y: 53.39 }, { id: 1, x: 104.16, y: 53.39 },
    { id: 2, x: 69.16, y: 81.39 }, { id: 3, x: 104.16, y: 81.39 },
    { id: 4, x: 69.16, y: 109.39 }, { id: 5, x: 104.16, y: 109.39 },
  ]),
  buttons: Object.freeze([{ id: 'b1', x: 86.66, y: 53.4 }, { id: 'b2', x: 86.66, y: 81.4 }, { id: 'b3', x: 86.66, y: 109.41 }]),
  usb: Object.freeze({ x: 86.66, y: 121.5, width: 9, height: 3.2 }),
  jackColumns: Object.freeze([63.1, 74.91, 86.69, 98.42, 110.31]),
  jackRows: Object.freeze([132.2, 145.15]),
});

/**
 * The ten jacks as a 2 x 5 grid of jack numbers: audio in on the left, audio out on the right, the six CV jacks between. The SDK
 * template gives the hole positions but not which hole carries which number, so the CV jacks are numbered in reading order.
 */
export const JACK_GRID = Object.freeze([[1, 3, 4, 5, 9], [2, 6, 7, 8, 10]]);

/** The short name printed under a jack in the drawing. */
export const jackLabel = (number) => ({ 1: 'IN L', 2: 'IN R', 9: 'OUT L', 10: 'OUT R' })[number] ?? `J${number}`;

export const POT_POSITIONS = Object.freeze(['top left', 'top right', 'middle left', 'middle right', 'bottom left', 'bottom right']);

/** An LED colour as the firmware stores it is a dim value (#372D00): scale it so its brightest channel is full. */
export function ringColour(hex) {
  const value = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!value) return '#888888';
  const channels = [0, 2, 4].map((i) => parseInt(value[1].slice(i, i + 2), 16));
  const peak = Math.max(...channels);
  if (peak === 0) return '#888888';
  return `#${channels.map((c) => Math.round((c / peak) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** What the B1 shift layer does to a knob, read from the field help ("B1:Attack B2:engine/bank"); '' when nothing. */
export function shiftOf(help) {
  const match = /B1:(.*?)(?:\s+B2:|$)/.exec(String(help ?? ''));
  const text = match?.[1]?.trim() ?? '';
  return text === '-' ? '' : text;
}

const SHIFT_NAMES = Object.freeze({ Aux: 'Aux send', 'Cross FM': 'Cross FM from the other Plaits', semitone: 'Semitone steps', 'Loop Bars': 'Loop length' });
/** The firmware's short shift word as the manual spells it. */
export const shiftName = (text) => SHIFT_NAMES[text] ?? text;

/** B2's meaning on that page, from the same help string. */
export function b2Of(help) {
  const text = /B2:(.*)$/.exec(String(help ?? ''))?.[1]?.trim() ?? '';
  return text === '-' ? '' : text;
}

/** The performance pager: [{ index, name, colour, pots: [{ id, name, shift, b2 }] }]; [] when the firmware has none. */
export function panelPages(descriptor) {
  const pager = descriptor?.components?.find((component) => component.kind === 'pager' && Array.isArray(component.pageNames) && component.pots === 6);
  if (!pager) return [];
  const pages = describedPages(pager);
  return isCompactBuild(pages) ? [...pages, masterPage(pages)] : pages;
}

/** The compact firmware names the sampler's pot 4 "Loop Mode" and has no FX Granular page; the full build has the opposite. */
export function isCompactBuild(pages) {
  return !pages.some((page) => page.name === 'FX Granular') && pages.find((page) => /^Sampler \d+$/.test(page.name))?.pots[3]?.name === 'Loop Mode';
}

/**
 * The compact build's Master page. It lives in the FX Granular slot of the firmware and is not part of the HostLink pager, so
 * it is described here from the firmware's panel code: fw/include/pentavox/mod/panel_destination_map.h (what each knob sets),
 * panel_shift.h (B1 over a filter is its resonance), src/hw/panel_frame.cpp (ring colours and the output-level meter) and
 * app_parameters.h (factory values: filters centred, output level 0.85, drive shapers off).
 */
export function masterPage(pages) {
  const colourOf = (name) => pages.find((page) => page.name === name)?.colour ?? '#888888';
  const knob = (id, name, def, colour, shift = '') => ({ id, name, shift, b2: '', def, colour });
  return {
    index: pages.length,
    name: 'Master',
    colour: '#b9b6ad',
    note: 'In the compact build this page takes the place of FX Granular, so B3 reaches it from FX Live. Each filter ring wears the colour of the voice it belongs to, a filter knob at centre is bypass, the Output level ring is a peak meter and the two drive shapers are red.',
    pots: [
      knob(0, 'Plaits 1 filter', 0.5, colourOf('Voice 1'), 'Filter resonance'),
      knob(1, 'Plaits 2 filter', 0.5, colourOf('Voice 2'), 'Filter resonance'),
      knob(2, 'Sampler filter', 0.5, colourOf('Sampler 1'), 'Filter resonance'),
      knob(3, 'Output level', 0.85, '#9a9a9a'),
      knob(4, 'Chebyshev amount', 0, '#ff0000'),
      knob(5, 'Fold amount', 0, '#ff0000'),
    ],
  };
}

function describedPages(pager) {
  return pager.pageNames.map((name, index) => ({
    index,
    name,
    colour: ringColour(pager.pageColors?.[index]),
    pots: Array.from({ length: 6 }, (_, id) => {
      const field = pager.fields?.find((f) => f.page === index && f.pot === id);
      return { id, name: field?.name ?? '', shift: shiftName(shiftOf(field?.help)), b2: b2Of(field?.help), def: typeof field?.def === 'number' ? field.def : 0.5 };
    }),
  }));
}

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The firmware's help text uses **bold** and newlines only: escape everything, then allow those two. */
export function richText(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

/** Gesture cards of B1, B2, B3: [{ id, name, actions: [{ gesture, label, help }] }]. */
export function buttonCards(descriptor) {
  return (descriptor?.buttons ?? []).map((button) => ({ id: button.id, name: button.name, actions: button.actions ?? [] }));
}

// Older firmware help states the factory function of J3/J4/J7 ("default is FX freeze toggle"); the factory defaults have since
// changed (only J8 Clock is assigned), so the clauses about J3/J4/J7 are dropped and the true one about J8 stays. The function a jack really has comes from the live settings.
const withoutFactoryClaims = (text) => String(text).replace(/;\s*default is (?!clock)[^.]*\./, '.');

/** The ten jacks in panel order J1…J10: [{ number, id, name, sig, help }]. */
export function jackList(descriptor) {
  return (descriptor?.jacks ?? []).map((jack, index) => ({ number: index + 1, id: jack.id, name: jack.name, sig: jack.sig, help: withoutFactoryClaims(jack.help ?? '') }));
}

/** The firmware's own manual sections, minus the long destination list (the CV routing tab shows that one). */
export function manualSections(descriptor) {
  return (descriptor?.manual?.sections ?? [])
    .filter((section) => section.id !== 'route-destinations')
    .map((section) => ({ ...section, body: String(section.body ?? '').replace(/(J3-J8 functions are assigned in Studio);\s*defaults are[^.]*\./, '$1.') }));
}

const GESTURE_LABELS = Object.freeze({
  tap: 'Tap', hold: 'Hold', press: 'Press', 'hold+knob': 'Hold + knob', 'hold+b2': 'Hold + B2', 'hold+b3': 'Hold + B3', 'b1+b3': 'B1 + B3',
});
export const gestureLabel = (gesture) => GESTURE_LABELS[gesture] ?? gesture;

/** "2 Plaits voices · 1 sampler" from the page names, so it follows the firmware that is described. */
export function voiceSummary(pages) {
  const plaits = pages.filter((page) => /^Voice \d+$/.test(page.name)).length;
  const samplers = pages.filter((page) => /^Sampler \d+$/.test(page.name)).length;
  const parts = [];
  if (plaits) parts.push(`${plaits} Plaits voice${plaits === 1 ? '' : 's'}`);
  if (samplers) parts.push(`${samplers} sampler${samplers === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
