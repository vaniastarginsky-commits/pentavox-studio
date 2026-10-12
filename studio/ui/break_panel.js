// Break patterns panel for the Sampler tab: bank A-H, step grid, event inspector, generators, chain, browser preview.
// The model lives on the item (item.breakBank); the preview runs the same reference engine the firmware must match.
import { CONTINUE, HOME, PATTERN_STEPS, REPS, ROLL, defaultEvent, normalizePattern } from '../model/break_engine.js';
import { GENERATORS, beatRepeatOverlay, generate, generateSet } from '../model/break_generators.js';
import { PRESETS, presetPattern } from '../model/break_presets.js';
import { keyStripModel } from '../model/key_map.js';
import { beatRepeat } from '../model/break_repeat.js';
import { MAX_CHAIN, MAX_PATTERNS, normalizeBank } from '../model/break_pattern.js';
import { breakContext, renderBankAudio } from '../model/break_preview.js';

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function button(text, className = '') { const node = el('button', className, text); node.type = 'button'; return node; }
const LETTERS = 'ABCDEFGH';
const GENERATOR_NAMES = { jungle: 'Jungle (Amen)', dnb: 'Drum\'n\'bass', halftime: 'Half-time', funk: 'Funk break', breakcore: 'Breakcore', idm: 'IDM', cutproc: 'BBCut cuts', warp: 'Warp roll', squarepusher: 'Squarepusher', campanology: 'Campanology', recursive: 'Recursive', euclid: 'Euclid' };
const ROLL_NAMES = ['Even', 'Accelerate', 'Ritard'];
const typeClass = (label) => (/kick/.test(label) ? 'kick' : /snare/.test(label) ? 'snare' : /hat/.test(label) ? 'hat' : 'other');

export function hasBreakPatterns(bank) { return Boolean(bank?.patterns?.some((p) => p.events.length)); }

export function parseChain(text, count) {
  const out = []; for (const ch of text.toUpperCase().replace(/[^A-H]/g, '')) { const i = LETTERS.indexOf(ch); if (i >= count) return null; out.push(i); }
  return out.length <= MAX_CHAIN ? out : null;
}

export function createBreakPanel(item, { getContext, onChange = () => {} }) {
  const root = el('section', 'bk');
  item.breakBank ??= { patterns: [{ steps: 16, events: [] }], chain: [0] };
  item.breakSel ??= 0; item.breakEvent ??= null; item.breakGen ??= { kind: 'jungle', mode: 'embed', density: 0.5, seed: 1 };
  item.breakGen.mode ??= 'embed';
  let play = null; let raf = 0; let destroyed = false;
  const bank = () => item.breakBank;
  const pattern = () => bank().patterns[item.breakSel] ?? bank().patterns[0];
  const ctx = () => breakContext(item);

  function commit(next) { item.breakBank = normalizeBank(next); item.breakSel = Math.min(item.breakSel, item.breakBank.patterns.length - 1); if (!item.breakBank.chain.length) item.breakBank.chain = [0]; render(); restartPreview(); onChange(); }
  function setPattern(p) { const patterns = bank().patterns.slice(); patterns[item.breakSel] = normalizePattern(p); commit({ ...bank(), patterns }); }
  function setEvent(step, patch) { const p = pattern(); setPattern({ ...p, events: p.events.map((e) => (e.step === step ? { ...e, ...patch } : e)) }); }

  // ------------------------------------------------------------ preview
  function stopPreview() { if (play) { try { play.source.stop(); } catch { /* already stopped */ } play = null; } cancelAnimationFrame(raf); paintHead(null); }
  function startPreview(phase = 0) {
    const c = ctx(); if (!c) return;
    stopPreview();
    const { channels, steps, grains } = renderBankAudio(bank(), item.audio.channels, c);
    if (!channels[0]?.length) return;
    const audio = getContext(); const buffer = audio.createBuffer(channels.length, channels[0].length, c.sampleRate); channels.forEach((data, i) => buffer.copyToChannel(data, i));
    const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true; source.connect(audio.destination);
    const offset = (phase * c.stepSec) % buffer.duration; source.start(0, offset);
    play = { source, started: audio.currentTime - offset, steps, stepSec: c.stepSec, audio, grains };
    const tick = () => { if (!play || destroyed) return; paintHead(((play.audio.currentTime - play.started) / play.stepSec) % play.steps); raf = requestAnimationFrame(tick); };
    tick();
  }
  function restartPreview() { if (!play) return; const phase = ((play.audio.currentTime - play.started) / play.stepSec) % play.steps; startPreview(phase); }
  let headCells = [];
  function paintHead(position) {
    headCells.forEach((cell) => cell.classList.remove('head')); if (position === null) return;
    // which pattern of the chain is sounding, and the step inside it
    let offset = 0; const chain = bank().chain.length ? bank().chain : [0];
    for (const index of chain) { const steps = bank().patterns[index]?.steps ?? 0; if (position < offset + steps) { if (index === item.breakSel) headCells[Math.floor(position - offset)]?.classList.add('head'); return; } offset += steps; }
  }

  // ------------------------------------------------------------ render
  function render() {
    const c = ctx(); root.replaceChildren(); headCells = [];
    root.append(el('h3', 'bk-title', 'Break patterns'));
    if (!c) { root.append(el('p', 'bk-note', 'Cut the file into slices first (Even, Beats or Detect), then build or generate patterns here.')); return; }
    const p = pattern();
    // bank tabs
    const bar = el('div', 'bk-row');
    bank().patterns.forEach((_, i) => { const tab = button(LETTERS[i], `bk-tab${i === item.breakSel ? ' on' : ''}`); tab.addEventListener('click', () => { item.breakSel = i; item.breakEvent = null; render(); }); bar.append(tab); });
    const add = button('+', 'bk-tab'); add.title = 'Add an empty pattern'; add.disabled = bank().patterns.length >= MAX_PATTERNS;
    add.addEventListener('click', () => { item.breakSel = bank().patterns.length; commit({ ...bank(), patterns: [...bank().patterns, { steps: p.steps, events: [] }] }); });
    const del = button('Delete', 'quiet-button'); del.disabled = bank().patterns.length <= 1; del.title = 'Delete this pattern and take it out of the chain';
    del.addEventListener('click', () => { const gone = item.breakSel; const chain = bank().chain.filter((i) => i !== gone).map((i) => (i > gone ? i - 1 : i)); commit({ patterns: bank().patterns.filter((_, i) => i !== gone), chain }); });
    const steps = document.createElement('select'); steps.setAttribute('aria-label', 'Pattern length');
    for (const n of PATTERN_STEPS) { const o = el('option', '', `${n / 16} bar${n > 16 ? 's' : ''} (${n} steps)`); o.value = n; o.selected = n === p.steps; steps.append(o); }
    steps.addEventListener('change', () => setPattern({ ...p, steps: Number(steps.value) }));
    const clear = button('Clear', 'quiet-button'); clear.addEventListener('click', () => setPattern({ ...p, events: [] }));
    bar.append(add, del, steps, clear); root.append(bar);
    // generators
    const g = item.breakGen; const gen = el('div', 'bk-row');
    const kind = document.createElement('select'); kind.setAttribute('aria-label', 'Generator');
    for (const k of GENERATORS) { const o = el('option', '', GENERATOR_NAMES[k]); o.value = k; o.selected = g.kind === k; kind.append(o); }
    kind.addEventListener('change', () => { g.kind = kind.value; });
    const mode = document.createElement('select'); mode.setAttribute('aria-label', 'Generator mode');
    for (const [value, label] of [['embed', 'Embed'], ['replace', 'Replace']]) { const o = el('option', '', label); o.value = value; o.selected = g.mode === value; mode.append(o); }
    mode.addEventListener('change', () => { g.mode = mode.value; syncDensity(); });
    const density = document.createElement('input'); density.type = 'range'; density.setAttribute('aria-label', 'Density');
    const amount = el('span', 'bk-hint', '');
    // Embed: how many ornaments, whatever the pattern length (0 = the untouched break, steps = as full as it gets). Replace: 0-1 density.
    const syncDensity = () => {
      if (g.mode === 'embed') {
        g.count = Math.min(g.count ?? 4, p.steps);
        density.min = '0'; density.max = String(p.steps); density.step = '1'; density.value = g.count;
        density.title = 'Ornaments: how many steps get a slice, whatever the pattern length'; amount.textContent = `ornaments ${g.count}`;
      } else {
        density.min = '0'; density.max = '1'; density.step = '0.05'; density.value = g.density;
        density.title = 'Density: how busy the pattern is'; amount.textContent = 'density';
      }
    };
    density.addEventListener('input', () => { if (g.mode === 'embed') g.count = Math.trunc(Number(density.value)); else g.density = Number(density.value); syncDensity(); });
    syncDensity();
    const seed = document.createElement('input'); seed.type = 'number'; seed.min = '1'; seed.step = '1'; seed.value = g.seed; seed.setAttribute('aria-label', 'Seed'); seed.title = 'Same seed, same pattern';
    seed.addEventListener('change', () => { g.seed = Math.max(1, Math.trunc(Number(seed.value)) || 1); });
    const run = () => setPattern(generate(g.kind, { steps: p.steps, fileSteps: c.fileSteps, sliceStarts: c.sliceStarts, labels: c.labels, density: g.density, count: g.count ?? 4, seed: g.seed, mode: g.mode }));
    const make = button('Generate', 'primary'); make.addEventListener('click', run);
    const makeSet = button('Generate set', 'quiet-button'); makeSet.title = 'A calm, B busier, C a fill, and the chain A A B A A B C';
    makeSet.addEventListener('click', () => { item.breakSel = 0; item.breakEvent = null; commit(generateSet(g.kind, { fileSteps: c.fileSteps, sliceStarts: c.sliceStarts, labels: c.labels, density: g.density, count: g.count ?? 4, seed: g.seed, mode: g.mode })); });
    const dice = button('New seed', 'quiet-button'); dice.addEventListener('click', () => { g.seed = 1 + Math.floor(Math.random() * 99999); run(); });
    item.breakRepeats ??= 2;
    const repeats = document.createElement('input'); repeats.type = 'number'; repeats.min = '1'; repeats.max = '32'; repeats.step = '1'; repeats.value = item.breakRepeats; repeats.className = 'bk-count'; repeats.setAttribute('aria-label', 'Number of repeats');
    repeats.addEventListener('change', () => { item.breakRepeats = Math.max(1, Math.min(32, Math.trunc(Number(repeats.value)) || 1)); });
    const repeat = button('Beat repeat', 'quiet-button'); repeat.title = 'Repeat the hit that has just sounded, in shaped rolls, on musical places (never on a kick or snare); the number is how many';
    repeat.addEventListener('click', () => setPattern(beatRepeat(p, { fileSteps: c.fileSteps, sliceStarts: c.sliceStarts, labels: c.labels }, { count: item.breakRepeats, seed: g.seed })));
    gen.append(kind, mode, amount, density, el('span', 'bk-hint', 'seed'), seed, make, makeSet, dice, repeat, repeats); root.append(gen);
    // ready-made patterns
    item.breakPreset ??= PRESETS[0].id;
    const pre = el('div', 'bk-row'); const info = el('span', 'bk-hint', '');
    const choose = document.createElement('select'); choose.setAttribute('aria-label', 'Ready-made pattern');
    for (const x of PRESETS) { const o = el('option', '', `${x.name} - ${x.genre}`); o.value = x.id; o.selected = item.breakPreset === x.id; choose.append(o); }
    const describe = () => { const x = PRESETS.find((q) => q.id === item.breakPreset); info.textContent = `${x.bpm[0]}-${x.bpm[1]} BPM, ${x.bars.length} bar${x.bars.length > 1 ? 's' : ''}, ${x.source === 'transcription' ? 'transcribed from the record' : 'standard genre placement'}. ${x.note}`; };
    choose.addEventListener('change', () => { item.breakPreset = choose.value; describe(); });
    const load = button('Load preset', 'primary'); load.title = 'Lay this groove on the file\'s own kicks, snares and hats (the seed picks which ones)';
    load.addEventListener('click', () => setPattern(presetPattern(item.breakPreset, { fileSteps: c.fileSteps, sliceStarts: c.sliceStarts, labels: c.labels }, g.seed)));
    describe(); pre.append(el('span', 'bk-hint', 'preset'), choose, load, info); root.append(pre);
    root.append(renderKeyStrip(c), renderGrid(p, c), renderInspector(p, c), renderTransport());
  }

  // The fixed key map: which MIDI note plays which slice (C3 = 60 ... C6 = 96; kicks, snares, hats, other).
  function renderKeyStrip(c) {
    const wrap = el('div', 'bk-keys-wrap'); wrap.append(el('p', 'bk-hint', 'Keys C3-C6 play the slices (permanent map: kicks C3-B3, snares C4-B4, hats C5-B5, other C6)'));
    const strip = el('div', 'bk-keys');
    for (const k of keyStripModel(c.labels, c.sliceStarts.length)) {
      const cell = el('div', `bk-key ${k.slice ? `r-${k.role}` : 'empty'}${k.name.length === 3 && k.name[1] === '#' ? ' black' : ''}`); cell.title = k.slice ? `${k.name} (note ${k.note}) plays slice ${k.slice}` : `${k.name}: empty`;
      cell.append(el('small', '', k.name), el('b', '', k.slice ? String(k.slice) : '')); strip.append(cell);
    }
    wrap.append(strip); return wrap;
  }

  function renderGrid(p, c) {
    const grid = el('div', 'bk-grid'); grid.style.setProperty('--cols', Math.min(16, p.steps));
    const owner = new Map(); for (const e of p.events) for (let s = e.step; s < e.step + e.len; s += 1) owner.set(s, e);
    const natural = (s) => c.sliceStarts.findIndex((st) => Math.round(st) === s % c.fileSteps);
    for (let s = 0; s < p.steps; s += 1) {
      const e = owner.get(s); const start = e && e.step === s; const cell = button('', 'bk-step'); cell.dataset.step = s;
      if (s % 4 === 0) cell.classList.add('beat');
      const nat = natural(s); if (nat >= 0 && !e) { cell.append(el('i', 'bk-nat', String(nat + 1))); cell.classList.add(`n-${typeClass(c.labels[nat])}`); }
      if (e) {
        const srcLabel = e.src >= 0 ? c.labels[Math.min(e.src, c.labels.length - 1)] : 'other';
        cell.classList.add('ev', start ? 'start' : 'tail', e.src >= 0 ? typeClass(srcLabel) : 'cont'); if (!e.gate) cell.classList.add('rest');
        if (item.breakEvent === e.step) cell.classList.add('sel');
        if (start) cell.append(el('b', '', e.src >= 0 ? String(e.src + 1) : e.src === HOME ? 'home' : '·'), el('small', '', `${e.reps > 1 ? `×${e.reps}` : ''}${e.rev ? ' R' : ''}${!e.gate ? ' –' : ''}`.trim()));
      }
      cell.setAttribute('aria-label', e ? `Step ${s + 1}, event` : `Step ${s + 1}, empty`);
      cell.addEventListener('click', () => {
        if (e) item.breakEvent = e.step;
        else { setPattern({ ...p, events: [...p.events, { ...defaultEvent(s), src: HOME }] }); item.breakEvent = s; render(); return; }
        render();
      });
      cell.addEventListener('keydown', (event) => { if ((event.key === 'Delete' || event.key === 'Backspace') && e) { event.preventDefault(); item.breakEvent = null; setPattern({ ...p, events: p.events.filter((x) => x !== e) }); } });
      headCells.push(cell); grid.append(cell);
    }
    return grid;
  }

  function renderInspector(p, c) {
    const box = el('div', 'bk-inspector'); const e = p.events.find((x) => x.step === item.breakEvent);
    if (!e) { box.append(el('span', 'bk-hint', 'Click an empty step to add an event, a step with an event to edit it. Delete removes it.')); return box; }
    const sel = (label, options, value, change) => { const s = document.createElement('select'); s.setAttribute('aria-label', label); options.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; o.selected = String(v) === String(value); s.append(o); }); s.addEventListener('change', () => change(s.value)); const f = el('label', 'bk-field'); f.append(el('span', '', label), s); return f; };
    const num = (label, value, min, max, stepBy, change) => { const i = document.createElement('input'); i.type = 'number'; i.min = min; i.max = max; i.step = stepBy; i.value = value; i.setAttribute('aria-label', label); i.addEventListener('change', () => change(Number(i.value))); const f = el('label', 'bk-field'); f.append(el('span', '', label), i); return f; };
    const check = (label, value, change) => { const i = document.createElement('input'); i.type = 'checkbox'; i.checked = value; i.addEventListener('change', () => change(i.checked)); const f = el('label', 'bk-field check'); f.append(i, el('span', '', label)); return f; };
    const sources = [[CONTINUE, 'Continue'], [HOME, 'Home (natural place)'], ...c.sliceStarts.map((_, i) => [i, `Slice ${i + 1} (${c.labels[i]})`])];
    box.append(
      el('strong', '', `Step ${e.step + 1}`),
      sel('Plays', sources, e.src, (v) => setEvent(e.step, { src: Number(v) })),
      num('Length', e.len, 1, p.steps - e.step, 1, (v) => setEvent(e.step, { len: v })),
      sel('Repeats', REPS.map((r) => [r, String(r)]), e.reps, (v) => setEvent(e.step, { reps: Number(v) })),
      sel('Roll', ROLL_NAMES.map((n, i) => [i, n]), e.roll, (v) => setEvent(e.step, { roll: Number(v) })),
      num('Level start', e.amp0, 0, 1, 0.05, (v) => setEvent(e.step, { amp0: v })), num('Level end', e.amp1, 0, 1, 0.05, (v) => setEvent(e.step, { amp1: v })),
      num('Pitch start, st', e.pitch0, -12, 12, 1, (v) => setEvent(e.step, { pitch0: v })), num('Pitch end, st', e.pitch1, -12, 12, 1, (v) => setEvent(e.step, { pitch1: v })),
      check('Reverse', e.rev, (v) => setEvent(e.step, { rev: v })), check('Sounds', e.gate, (v) => setEvent(e.step, { gate: v })));
    const remove = button('Remove event', 'quiet-button'); remove.addEventListener('click', () => { item.breakEvent = null; setPattern({ ...p, events: p.events.filter((x) => x !== e) }); }); box.append(remove);
    return box;
  }

  function renderTransport() {
    const row = el('div', 'bk-row');
    const chain = document.createElement('input'); chain.type = 'text'; chain.className = 'bk-chain'; chain.value = bank().chain.map((i) => LETTERS[i]).join(' '); chain.setAttribute('aria-label', 'Chain of patterns'); chain.placeholder = 'A A A B';
    chain.title = 'The order the module plays the patterns in, repeating. Letters A-H, for example “A A A B”.';
    chain.addEventListener('change', () => { const parsed = parseChain(chain.value, bank().patterns.length); if (!parsed) { chain.classList.add('bad'); chain.title = `Use letters of existing patterns, at most ${MAX_CHAIN}`; return; } commit({ ...bank(), chain: parsed }); });
    const playButton = button(play ? 'Stop' : 'Play preview', play ? '' : 'primary'); playButton.addEventListener('click', () => { if (play) stopPreview(); else startPreview(); render(); });
    row.append(el('span', 'bk-hint', 'chain'), chain, playButton, el('span', 'bk-hint', 'Preview plays at the file\u2019s own tempo. Patterns are saved in the WAV. On the module: Play = Break (slice bar), Loop mode = Sync, Loop bars = the file\u2019s length, clock running.'));
    return row;
  }

  render();
  return { el: root, refresh: render, destroy() { destroyed = true; stopPreview(); } };
}
