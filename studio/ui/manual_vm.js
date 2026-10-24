import { firmwarePanelPages } from '../model/firmware_panel.js';
// View-model of the Manual tab: everything about the module comes from the firmware's own descriptor
// (pages, buttons, jacks and built-in help), with compatibility mappings where older descriptors
// expose stored sampler fields instead of physical Looper controls. The panel geometry is the Alchemy Lab front panel in millimetres (alchemy-sdk panel template).
import { isLooperDescriptor } from '../model/panel_pots.js';

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

const SHIFT_NAMES = Object.freeze({ Aux: 'Aux send', 'Cross FM': 'Cross FM from the other Plaits', semitone: 'Semitone steps', 'Loop Bars': 'End (fine trim)' });
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
  let pages = describedPages(pager);
  if (isCompactBuild(pages)) {
    const sampler = pages.find((page) => page.name === 'Sampler 1');
    if (sampler) sampler.pots[1] = { ...sampler.pots[1], name: 'Sampler stutter', def: 0.5, live: false };
  }
  // Looper firmware retains the sampler's preset layout. Those stored fields
  // are not the physical controls (three of them live in looper_runtime).
  if (isLooperDescriptor(descriptor)) {
    const loop = pages.find((page) => /^(Sampler 1|Looper)$/.test(page.name));
    if (loop) {
      loop.name = 'Looper';
      const names = ['Loop 1 stutter', 'Loop 2 stutter', 'Crossfader', 'Record source', 'Loop length', 'Level'];
      const shifts = ['Loop 1 file', 'Loop 2 file', 'Direction', 'Sidechain EQ', '', 'Aux send'];
      loop.pots = loop.pots.map((pot, id) => ({ ...pot, name: names[id], shift: shifts[id],
        b2: 'Record / overdub; hold for undo / redo or new loop', live: id >= 3,
        def: id < 3 ? 0.5 : pot.def }));
      loop.note = 'Both loops play. The crossfader selects the recording loop at the next bar. Hold B1 for file selection, direction and sidechain. Stutter and crossfader values are not exposed by this firmware; use the physical pots.';
    }
  }
  if (Number(descriptor?.slice?.version) >= 1) {
    const sizeChange = Number(descriptor.slice.version) >= 18;
    const modeActivity = Number(descriptor.slice.version) >= 17;
    const slowFlange = Number(descriptor.slice.version) >= 16;
    const contextThrow = Number(descriptor.slice.version) >= 15;
    const longThrow = Number(descriptor.slice.version) >= 14;
    const phrasePlan = Number(descriptor.slice.version) >= 13;
    const artisticThrow = Number(descriptor.slice.version) >= 12;
    const adaptiveThrow = Number(descriptor.slice.version) >= 11;
    const throwMode = Number(descriptor.slice.version) >= 10;
    const gateMode = Number(descriptor.slice.version) >= 9;
    const colourMode = Number(descriptor.slice.version) >= 8;
    const fillMode = Number(descriptor.slice.version) >= 7;
    const grimoireMode = Number(descriptor.slice.version) >= 6;
    const carryMode = Number(descriptor.slice.version) >= 2;
    const reverseMode = Number(descriptor.slice.version) >= 3;
    const retriggerMode = Number(descriptor.slice.version) >= 5;
    const evolveMode = Number(descriptor.slice.version) >= 4;
    const names = ['Loop', 'Slice size', 'Jump probability', grimoireMode ? 'Return / Carry / Amen' : carryMode ? 'Return / Carry' : '', 'Seed', 'Dry / Slice'];
    const slice = { name: 'Slice', colour: '#aa33ff', perfIndex: null,
      note: (modeActivity ? 'Colour top left is Mode Activity: closed keeps the manual mode; opening increases change probability, check rate (8/4/2/1 clock bars), and mode diversity. A chosen mode persists until another change. Seeded decisions latch at bar boundaries, use available slice counts, and defer during artistic tails. ' + (sizeChange ? 'First-beat protection is the Looper setting "Protect first beat" in Studio; Rhythm top left is the chance that a beat is cut at another slice size (seeded, on the clock grid, never the first beat of a protected bar). The size ring (top right) shows the slice size being played, with a green dot on the pot\'s own size when a size change has moved away from it. The mode ring shows the mode being played; when Mode Activity has moved it away from the pot, a green dot marks the pot\'s own mode. ' : 'First-beat protection stays in Rhythm top left. ') + 'The six normal mode zones and Jump/Amen density control stay unchanged. ' : '') + (slowFlange ? 'Flange is a rare 4-8-beat phrase gesture with a 1-10 ms moving comb tap; its admission has an extra 1/4 draw. Later markers cannot feed or retime artistic gestures. Resonator/Flange remove bass accumulation in their feedback/wet path and compensate return gain; dry and LP Sweep are unchanged. While an artistic tail is active, new strong grid effects wait; manual Fill overrides this guard. Moving comb notches are not an independent frequency shifter. ' : '') + (contextThrow ? 'Artistic Throw uses one ranked candidate per two-bar source phrase. Seed streams for send/admission/family/rank are independent. Kick attacks are excluded; hats favour resonator/flange, snare/other favour tape/long. Busy/opening passages reduce the chance below the 2-20% upper bound. Short echoes avoid marked kick/snare attacks; source jumps or an occupied/pending tail can veto the event. Tape preserves the first repeated attack before a bounded Doppler glide; it is not a key-aware semitone pitch shifter. ' : '') + (longThrow ? 'Colour middle right: Clean / Tape / Resonator / Flange / Long / Hybrid. Long adds seeded 2/4/8-beat echoes, using the longest requested clock division that fits the four-second buffer. Time is held for the original throw and later markers cannot feed or retime it; then the short delay returns. Within each family zone chance rises from 2% to 20%. Long emits only the rare long throws; Hybrid mixes them with ordinary echoes. ' : '') + (phrasePlan ? 'Seeded variations repeat in two-bar pairs. Below 100%, strong grid accents have one opportunity per two beats with a recovery beat; Fill allows one per beat. At 100% the selected probability forces every cell. Source jumps and held Carry/Amen offsets exclude simultaneous roll/reverse/tape. Amen groups stay intact; marker Throw keeps its own guard. ' : '') + (!longThrow && artisticThrow ? 'Colour middle right: Clean / Tape / Resonator / Flange / Hybrid. Special events use an independent seeded 2-20% draw (increasing within each family zone) on selected throws, only on a quiet tail, with a cooldown. Resonator uses fixed high C/G, not automatic song-key tracking. Flange uses a moving short comb delay. ' : '') + (adaptiveThrow ? 'Throw has its own wet-only delay and bypasses shared reverb. Time follows clock and detected-hit spacing (1/32..1/4); feedback adapts to density and drum type. Original detected attacks are sent before grid Slice/stutter effects. No need to open the shared AUX delay. ' : '') + (throwMode ? 'Colour: top right marker-based AUX Throw chance; bottom left hit filter All/Kick/Snare/Hat/Other. Uses Studio cue/pvxt markers; no guessed grid fallback. Dry loop stays intact. Gate and Crush are removed. ' : '') + (!throwMode && gateMode ? 'Colour B1 + bottom left controls Gate chance; bottom right is shared Crush/Filter/Gate depth. Gate uses straight or swung pulses with smooth edges. Grimoire adds Gate; Colour pools include it. ' : '') + (throwMode ? 'B1 + long B2 switches Rhythm/Colour banks; cyan B1 is Colour. ' : colourMode ? 'B1 + long B2 switches Rhythm/Colour B1 banks. Colour: top right Crush chance, middle left LP/HP Sweep chance, bottom right shared depth. Cyan B1 indicates Colour. Normal controls are unchanged. ' : '') + (fillMode ? 'Hold B2 to queue a one-bar Fill at the next bar; orange B2 means queued, white means active. It returns automatically, without changing the seed. Retrigger copies decay; effect transitions are smoothed. ' : '') + (grimoireMode ? 'B1: top right Retrigger chance, middle left Reverse After chance, bottom right Tape Stop/Start chance, middle right Grimoire pool. One eligible effect is chosen per slice. Normal middle right: Return / Carry / Amen 2 / 4 / 8 / three-slice phrases; Jump probability controls Amen phrase chance. First beat is protected by default. ' : retriggerMode ? 'B1 + top left protects the first beat (on by default); B1 + top right selects Retrigger off / x2 / x4 / x8. Carry returns at each bar. ' : '') + (grimoireMode ? 'Carry returns to the original grid each bar. ' : carryMode ? 'Playback-only slice jumps. Middle right: left returns each slice to the original grid, right continues from the jumped position until another jump. ' : 'Playback-only slice jumps with return to the original grid. Middle right is unused in this firmware. ') + 'B2 makes a new pattern; hold B1 and tap B2 to enable or bypass. Runtime controls use the physical pots; they are not saved in presets.',
      pots: names.map((name, id) => ({ id, name, shift: modeActivity && id === 0 ? (sizeChange ? 'Rhythm: Slice size change chance; Colour: Mode Activity (chance / rate / diversity)' : 'Rhythm: Protect first beat; Colour: Mode Activity (chance / rate / diversity)') : retriggerMode && id === 0 ? 'Protect first beat: off / on' : throwMode && id === 1 ? 'Rhythm: Retrigger chance; Colour: AUX Throw chance' : colourMode && id === 1 ? 'Rhythm: Retrigger chance; Colour: Crush chance' : grimoireMode && id === 1 ? 'Retrigger probability' : retriggerMode && id === 1 ? 'Retrigger: off / x2 / x4 / x8' : colourMode && id === 2 ? 'Rhythm: Reverse After chance; Colour: Filter Sweep chance' : grimoireMode && id === 2 ? 'Reverse After probability' : reverseMode && id === 2 ? 'Reverse probability' : longThrow && id === 3 ? 'Rhythm: Grimoire; Colour: Clean / Tape / Resonator / Flange / Long / Hybrid' : artisticThrow && id === 3 ? 'Rhythm: Grimoire; Colour: Clean / Tape / Resonator / Flange / Hybrid' : throwMode && id === 3 ? 'Grimoire: all / rolls / reverse / tape / rolls+reverse / reverse+tape / filter' : gateMode && id === 3 ? 'Grimoire: all / rolls / reverse / tape / rolls+reverse / reverse+tape / crush / filter / colour / colour+rolls / gate' : colourMode && id === 3 ? 'Grimoire: all / rolls / reverse / tape / rolls+reverse / reverse+tape / crush / filter / colour / colour+rolls' : grimoireMode && id === 3 ? 'Grimoire: all / rolls / reverse / tape / rolls+reverse / reverse+tape' : throwMode && id === 5 ? 'Rhythm: Tape chance; Colour: Throw level / Filter depth' : colourMode && id === 5 ? 'Rhythm: Tape chance; Colour: depth' : grimoireMode && id === 5 ? 'Tape Stop/Start probability' : throwMode && id === 4 ? 'Rhythm: Evolve; Colour: All/Kick/Snare/Hat/Other' : gateMode && id === 4 ? 'Rhythm: Evolve; Colour: Gate probability' : evolveMode && id === 4 ? 'Evolve: off / 8 / 4 / 2 / 1 loops' : '', b2: colourMode ? 'Tap: new pattern; hold: Fill; B1 + tap B2: bypass; B1 + hold B2: Rhythm/Colour' : fillMode ? 'Tap: new pattern; hold: one-bar Fill; B1 + B2: enable / bypass' : 'New pattern; B1 + B2: enable / bypass', live: false, def: [0, .67, 0, 0, 0, 1][id] })) };
    const at = pages.findIndex((page) => page.name === 'Looper');
    if (at >= 0) {
      pages = pages.map((page) => ({ ...page, perfIndex: page.index }));
      pages.splice(at + 1, 0, slice);
      pages = pages.map((page, index) => ({ ...page, index }));
    }
  }
  return firmwarePanelPages(isCompactBuild(pages) ? [...pages, masterPage(pages)] : pages,descriptor);
}

/** The compact firmware names the sampler's pot 4 "Loop Mode" and has no FX Granular page; the full build has the opposite. */
export function isCompactBuild(pages) {
  return !pages.some((page) => page.name === 'FX Granular') && (pages.some((page) => page.name === 'Looper')
    || pages.find((page) => /^Sampler \d+$/.test(page.name))?.pots[3]?.name === 'Loop Mode');
}

/**
 * The compact build's Master page. It lives in the FX Granular slot of the firmware and is not part of the HostLink pager, so
 * it is described here from the firmware's panel code: fw/include/pentavox/mod/panel_destination_map.h (what each knob sets),
 * panel_shift.h (B1 over a filter is its resonance), src/hw/panel_frame.cpp (ring colours and the output-level meter) and
 * app_parameters.h (factory values: filters centred, output level 0.85).
 */
export function masterPage(pages) {
  const colourOf = (name) => pages.find((page) => page.name === name)?.colour ?? '#888888';
  const knob = (id, name, def, colour, shift = '') => ({ id, name, shift, b2: '', def, colour });
  return {
    index: pages.length,
    name: 'Master',
    colour: '#b9b6ad',
    note: 'In the compact build this page takes the place of FX Granular, so B3 reaches it from FX Live. Each filter ring wears the colour of the voice it belongs to, a filter knob at centre is bypass, the Output level ring is a peak meter. Hold B1 for resonance, Phaser rate and Input Aux.',
    pots: [
      knob(0, 'Plaits 1 filter', 0.5, colourOf('Voice 1'), 'Filter resonance'),
      knob(1, 'Phaser mix', 0, '#00ffff', 'Phaser rate'),
      knob(2, 'Plaits 2 filter', 0.5, colourOf('Voice 2'), 'Filter resonance'),
      knob(3, 'Input level', 0.85, '#1919ff', 'Input Aux send'),
      knob(4, pages.some((page) => page.name === 'Looper') ? 'Looper filter' : 'Sampler filter', 0.5, colourOf(pages.some((page) => page.name === 'Looper') ? 'Looper' : 'Sampler 1'), 'Filter resonance'),
      knob(5, 'Output level', 0.85, '#9a9a9a'),
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
  if (pages.some((page) => page.name === 'Looper')) parts.push('2-loop looper');
  return parts.join(' · ');
}
