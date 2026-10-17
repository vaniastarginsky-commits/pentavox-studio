// View model of the "Settings" tab: groups of controls, English labels,
// display <-> wire conversion. Pure functions, no DOM.
const GROUP_DEFS = Object.freeze([
  { key: 'input', title: 'Input, output and lighting', mod: 'gl' },
  { key: 'clock', title: 'Tempo and clock', mod: 'fx' },
  { key: 'voices', title: 'Plaits voices', mod: 'p1' },
  { key: 'sampler', title: 'Sampler', mod: 's1' },
  { key: 'sources', title: 'Notes from the CV expander', mod: 'p3' },
  { key: 'buttons', title: 'Expander buttons', mod: 'p2' },
]);

// The note-source fields are one contiguous list: Plaits first, then samplers.
// Count Plaits from the Palette fields in the live descriptor instead of
// assuming that every firmware has two samplers.
const titlesFor = (table) => {
  let voices = 0; while (table.has(`voice.${voices}.pitch_source`)) voices += 1;
  const plaits = Math.min(voices, Math.max(0, Number(table.plaitsVoices) || 0));
  const samplers = Math.min(voices - plaits,
    Math.max(0, Number(table.samplerVoices) || 0));
  return [
    ...Array.from({ length: plaits }, (_, i) => `Plaits ${i + 1}`),
    ...Array.from({ length: samplers }, (_, i) => `Sampler ${i + 1}`),
  ];
};
const SOURCE_LABELS = Object.freeze(['MIDI', 'CV 1', 'CV 2', 'CV 3', 'CV 4', 'CV 5', 'CV 6', 'Button 1', 'Button 2', 'Jack J3', 'Jack J4', 'Jack J5', 'Jack J6', 'Jack J7', 'Jack J8']);
const PITCH_LABELS = Object.freeze(['MIDI', 'CV 1', 'CV 2', 'CV 3', 'CV 4', 'CV 5', 'CV 6', 'Jack J3', 'Jack J4', 'Jack J5', 'Jack J6', 'Jack J7', 'Jack J8']);
const MIDI_CHANNEL_LABELS = Object.freeze(['Omni', ...Array.from({ length: 16 }, (_, index) => String(index + 1))]);
const ROLE_LABELS = Object.freeze(['Unused', 'Gate (while held)', 'Toggle', 'Voice gate', 'Next page', 'Shift: route bank B']);
const PARAM_LABELS = Object.freeze(['Choose an action', 'Stutter', 'FX freeze']);
const GATE_ROLES = Object.freeze([1, 2]);

// Fixed English labels for the hardware Settings page; the order is the display order.
const SIMPLE_ITEMS = Object.freeze([
  { id: 's1.0', short: 'input', group: 'input', control: 'slider', label: 'Input level', hint: 'How much of the Audio In signal reaches the effects and the sampler recording. 0 turns the input off.' },
  { id: 's2.1', short: 'input aux', group: 'input', control: 'slider', label: 'Input AUX / FX send', hint: 'How much of the external Audio In signal is sent through the effects. 0 % is fully dry; 100 % sends the whole input through the FX chain.' },
  { id: 's1.5', short: 'output', group: 'input', control: 'slider', label: 'Output level', hint: 'Final volume of the module\u2019s outputs, applied after all effects. 100 % is the original level; the control is a squared curve, so 50 % is about \u221212 dB.' },
  { id: 's0.0', short: 'brightness', group: 'input', control: 'slider', label: 'LED brightness', hint: 'Brightness of the panel LEDs. Brighter LEDs draw more power.' },
  { id: 'transport.source', group: 'clock', control: 'segmented', label: 'Clock source', hint: 'Auto prefers CV, then MIDI, then internal.', labels: ['Auto', 'Internal', 'CV', 'MIDI'] },
  { id: 'transport.bpm', group: 'clock', control: 'slider', label: 'Internal tempo', hint: 'Internal quarter-note tempo.', bpm: true },
  { id: 's0.1', short: 'PPQ', group: 'clock', control: 'segmented', label: 'Clock pulses per quarter note', hint: 'How many pulses on jack J8 make up one quarter note.', labels: ['1', '2', '4', '24'] },
  { id: 's0.3', group: 'clock', control: 'segmented', label: 'Tempo multiplier', hint: 'Module tempo relative to the incoming clock: ÷ is slower, × is faster.', labels: ['÷4', '÷3', '÷2', '×1', '×2', '×3', '×4'] },
  { id: 's2.0', short: 'grid', group: 'clock', control: 'segmented', label: 'Trigger quantize', hint: 'Grid used to quantize live slice jumps, stutter and freeze.', labels: ['Off', '1/16', '1/8', '1/4', '1 bar'] },
  { id: 's2.2', short: 'change', group: 'clock', control: 'segmented', label: 'Tempo change mode', hint: 'Glide bends the pitch like a tape delay when Delay Time, Rate or clock tempo changes. Crossfade blends between delay times without a pitch bend.', labels: ['Glide', 'Crossfade'] },
  { id: 's2.3', short: 'change time', group: 'clock', control: 'slider', label: 'Tempo change time', hint: 'Transition time for Delay Time, Rate and clock-tempo changes. Large Glide jumps may take longer to keep playback moving forwards. Small clock wobble is ignored.', tempoTime: true },
  { id: 's0.2', group: 'voices', control: 'segmented', label: 'Voice mode', hint: 'Split: each Plaits voice plays independently; set its MIDI channel in CV routing > Notes. Poly: the three voices share the notes. Unison: one note plays all three.', labels: ['Split', 'Poly', 'Unison'] },
  { id: 's0.5', short: 'threshold', group: 'sampler', control: 'segmented', label: 'Auto-record threshold', hint: 'What starts a recording after you arm it with B2: the input level, or Clock Loop, which starts on the next downbeat (J7 Reset or MIDI Start) and stops by itself after Record length.', show: [0, 1, 2, 3, 8], labels: ['Off', '−40 dB', '−30 dB', '−20 dB', 'Clock', 'Start', 'Reset', 'Reset+Stop', 'Clock Loop'] },
  { id: 's0.4', name: 'Sampler Stutter', short: 'stutter', group: 'sampler', control: 'segmented', label: 'Sampler stutter', hint: 'Clean repeats the slice as it is. Glitch drops, reverses and bit-crushes later repeats, more with each step; the first repeat is always clean. Slice does the same on the file\'s cue markers: the loop starts exactly on a marker and the pot picks how much of that slice repeats (a file without markers stutters on the clock grid).', labels: ['Clean', 'Glitch low', 'Glitch mid', 'Glitch high', 'Slice', 'Slice glitch low', 'Slice glitch mid', 'Slice glitch high'] },
  { id: 's2.5', short: 'sleep', group: 'voices', control: 'switch', label: 'Voice sleep', hint: 'On: a voice whose note has ended and whose sound has died away (about half a second of silence) stops being computed, which frees processor time. Off: every voice is always computed. If you ever hear a click when a voice wakes after silence, switch this off.' },
  { id: 's2.4', short: 'record', group: 'sampler', control: 'segmented', label: 'Record length', hint: 'Length of a Clock Loop take, in bars. A sample slot holds 30 s: 16 bars need 128 BPM or faster, 8 bars 64 BPM.', show: [0, 1, 3, 7, 15], labels: Array.from({ length: 16 }, (_, index) => `${index + 1}`) },
]);

const options = (labels, count = labels.length) => Array.from({ length: count }, (_, value) => ({ value, label: labels[value] ?? String(value) }));

function scaleOf(field) {
  const lo = Number(field.disp?.lo ?? 0);
  const hi = Number(field.disp?.hi ?? 1);
  return { lo, hi };
}

const tempoTimeMsFromRaw = (raw) => Math.round(5 * (200 ** raw));
const tempoTimeRawFromMs = (ms) => Math.log(ms / 5) / Math.log(200);

export function displayFromRaw(field, raw) {
  if (field.id === 'transport.bpm') return raw;
  if (field.id === 's2.3') return tempoTimeMsFromRaw(raw);
  const { lo, hi } = scaleOf(field);
  return Math.round((lo + raw * (hi - lo)) * 100);
}

export function rawFromDisplay(field, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError('setting must be a number');
  if (field.id === 'transport.bpm') return Math.max(20, Math.min(300, number));
  if (field.id === 's2.3') {
    return Math.max(0, Math.min(1, tempoTimeRawFromMs(number)));
  }
  const { lo, hi } = scaleOf(field);
  return Math.max(0, Math.min(1, (number / 100 - lo) / (hi - lo)));
}

function select(table, id, label, opts) {
  return { id, label, value: table.get(id), options: opts };
}

export function noteSourceRows(table, labels = {}) {
  const rows = [];
  const titles = titlesFor(table);
  for (let voice = 0; voice < titles.length; ++voice) {
    const pitch = `voice.${voice}.pitch_source`;
    const gate = `voice.${voice}.gate_source`;
    const midi = `voice.${voice}.midi_channel`;
    if (!table.has(pitch) || !table.has(gate)) continue;
    const controls = [
      select(table, pitch, labels.pitch ?? 'Pitch', options(PITCH_LABELS, Number(table.field(pitch).zones))),
      select(table, gate, labels.gate ?? 'Gate', options(SOURCE_LABELS, Number(table.field(gate).zones))),
    ];
    // Keep the strip compact when MIDI drives neither part of this voice.
    if (table.has(midi) && (table.get(pitch) === 0 || table.get(gate) === 0))
      controls.push(select(table, midi, 'MIDI ch', options(MIDI_CHANNEL_LABELS, Number(table.field(midi).zones))));
    rows.push({
      voice,
      label: titles[voice],
      controls,
    });
  }
  return rows;
}

export function settingsView(table) {
  const groups = new Map(GROUP_DEFS.map((def) => [def.key, { ...def, items: [], summary: '' }]));
  for (const spec of SIMPLE_ITEMS) {
    if (!table.has(spec.id)) continue;
    const field = table.field(spec.id);
    if (spec.name && field.name !== spec.name) continue;   // one slot id, different meaning in the full and the compact build (s0.4: Sampler Choke / Sampler Stutter)
    const raw = table.get(spec.id);
    const item = { id: spec.id, control: spec.control, label: spec.label, hint: spec.hint, short: spec.short ?? '', twoRows: spec.twoRows === true };
    if (spec.control === 'slider') {
      if (spec.bpm) {
        Object.assign(item, { min: 20, max: 300, step: 1, unit: ' BPM', value: raw });
      } else if (spec.tempoTime) {
        Object.assign(item, {
          min: 5,
          max: 1000,
          step: 1,
          unit: ' ms',
          value: displayFromRaw(field, raw),
        });
      } else {
        const { lo, hi } = scaleOf(field);
        Object.assign(item, {
          min: Math.round(lo * 100),
          max: Math.round(hi * 100),
          step: 1,
          unit: '%',
          value: displayFromRaw(field, raw),
        });
      }
    } else if (spec.control === 'switch') {
      item.value = raw !== 0;
    } else {
      // `show` trims the choices to the ones worth offering; a value the module already holds (an old preset, a hand-set mode) stays visible.
      item.options = options(spec.labels, Number(field.zones)).filter((option) => !spec.show || spec.show.includes(option.value) || option.value === raw);
      item.value = raw;
    }
    groups.get(spec.group).items.push(item);
  }
  for (const row of noteSourceRows(table)) groups.get('sources').items.push({ control: 'multi', label: row.label, controls: row.controls });
  for (let button = 0; button < 2; ++button) {
    const role = `button.${button}.role`;
    const param = `button.${button}.param`;
    if (!table.has(role) || !table.has(param)) continue;
    const controls = [select(table, role, 'Function', options(ROLE_LABELS, Math.min(ROLE_LABELS.length, Number(table.field(role).zones))))];
    if (GATE_ROLES.includes(table.get(role))) controls.push(select(table, param, 'Action', options(PARAM_LABELS)));
    groups.get('buttons').items.push({ control: 'multi', label: `Button ${button + 1} (SW${button + 1})`, controls });
  }
  const result = [...groups.values()].filter((group) => group.items.length);
  for (const group of result) group.summary = summarize(group);
  return result;
}

function summarize(group) {
  const parts = [];
  for (const item of group.items) {
    if (item.control === 'multi') {
      const labels = item.controls.map((control) => control.options.find((option) => option.value === control.value)?.label ?? '');
      if (group.key === 'sources') { if (labels.some((text) => text !== 'MIDI')) parts.push(`${item.label}: ${labels.join(' / ')}`); }
      else parts.push(`SW${item.label.match(/\d/)[0]}: ${labels[0]}`);
    } else if (item.control === 'slider') parts.push(`${item.short} ${item.value}${item.unit ?? '%'}`);
    else if (item.control === 'switch') { if (item.value) parts.push(item.short); }
    else parts.push(`${item.short ? `${item.short} ` : ''}${item.options.find((option) => option.value === item.value)?.label ?? ''}`);
  }
  return parts.join(' · ');
}
