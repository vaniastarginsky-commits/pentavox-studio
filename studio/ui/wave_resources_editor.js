// Sampled resource editor. Equations and file validation live in the pure model;
// drawing and audition both read exactly the signed samples saved in the recipe.
import {
  defaultResources, normalizeResources, sampleWavetableEquation, sampleTerrainEquation,
  importPaletteResources, importWavetableWav, decodeResourceEntry,
} from '../model/wave_resources.js';

const FACTORY_NAMES = {
  wavetable: ['Harmonic Ladder', 'Pulse & Sync', 'Shape Mosaic'],
  terrain: ['Asymmetric Saddle', 'Pinched Crossing', 'Resonant Cross', 'Offset Folds', 'Twin Wells', 'Wavetable Terrain: Bank 3', 'Wavetable Terrain: Bank 2', 'Wavetable Terrain: Bank 1'],
};
const EXAMPLES = {
  wavetable: [['Sine to harmonics', 'sin(phi)*(1-x)+sin(3*phi)*x'], ['Phase modulation', 'sin(phi + 4*x*sin(phi*(1+3*y)))'], ['Odd harmonics', '(sin(phi)+x*sin(3*phi)+y*sin(5*phi))/3']],
  terrain: [['Ripples', 'sin(8*pi*(x*x+y*y))'], ['Crossed waves', 'sin(4*pi*x)*cos(4*pi*y)'], ['Folded surface', 'sin(6*pi*x+3*sin(4*pi*y))']],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function button(text, action, className = '') { const node = el('button', className, text); node.type = 'button'; if (action) node.addEventListener('click', action); return node; }
function label(text, control) { const node = el('label', 'wr-label'); node.append(el('span', '', text), control); return node; }
function range(name, value, onInput) { const input = el('input'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '.01'; input.value = value; input.setAttribute('aria-label', name); input.addEventListener('input', () => onInput(Number(input.value))); return input; }
const mix = (a, b, amount) => a + (b - a) * amount;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Small pure helpers also exercise the interpolation used by browser audition.
export function readResourceSample(samples, kind, phase, x = .5, y = .5) {
  if (!samples || samples.length !== (kind === 'wavetable' ? 8192 : 4096)) return 0;
  if (kind === 'wavetable') {
    const gx = clamp(x, 0, 1) * 7; const gy = clamp(y, 0, 1) * 7;
    const xi = Math.floor(gx); const yi = Math.floor(gy); const p = ((phase % 1 + 1) % 1) * 128; const pi = Math.floor(p);
    const wave = (xx, yy) => { const index = (yy * 8 + xx) * 128; return mix(samples[index + pi], samples[index + (pi + 1) % 128], p - pi); };
    return mix(mix(wave(xi, yi), wave(Math.min(7, xi + 1), yi), gx - xi), mix(wave(xi, Math.min(7, yi + 1)), wave(Math.min(7, xi + 1), Math.min(7, yi + 1)), gx - xi), gy - yi) / 127;
  }
  const gx = clamp(x, 0, 1) * 62; const gy = clamp(y, 0, 1) * 62; const xi = Math.floor(gx); const yi = Math.floor(gy);
  const at = (xx, yy) => samples[yy * 64 + xx];
  return mix(mix(at(xi, yi), at(Math.min(63, xi + 1), yi), gx - xi), mix(at(xi, Math.min(63, yi + 1)), at(Math.min(63, xi + 1), Math.min(63, yi + 1)), gx - xi), gy - yi) / 128;
}
export function resourcePreviewCycle(samples, kind, { x = .5, y = .5, radius = .3, length = 1024 } = {}) {
  const cycle = new Float32Array(length);
  for (let i = 0; i < length; i += 1) { const phase = i / length; const angle = phase * 2 * Math.PI; cycle[i] = readResourceSample(samples, kind, phase, kind === 'terrain' ? x + Math.cos(angle) * radius : x, kind === 'terrain' ? y + Math.sin(angle) * radius : y); }
  return cycle;
}

export function explicitWaveResources(resources, kinds) {
  return normalizeResources(Object.fromEntries([...kinds].map((key) => [key, resources[key]])));
}

export function waveBuildMessage(kind) {
  const engine = kind === 'terrain' ? 'Wave Terrain' : 'Wavetable';
  return `Saved in this browser for the next build. Select ${engine} in Engines to include these resources. The connected module is unchanged.`;
}

export function mountWaveResourcesEditor({ getResources = defaultResources, onChange = () => {}, onError = () => {} } = {}) {
  const dialog = el('dialog', 'wr-dialog'); dialog.setAttribute('aria-label', 'Customize waves'); document.body.append(dialog);
  const header = el('header', 'wr-header'); const title = el('h2', '', 'Customize waves'); const close = button('Close', () => dialog.close()); header.append(title, close);
  const tabs = el('div', 'wr-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Wave resource type');
  const layout = el('div', 'wr-layout'); const sidebar = el('section', 'wr-library'); const body = el('section', 'wr-detail'); const status = el('p', 'wr-status'); status.setAttribute('role', 'status');
  const buildState = el('span', 'workflow-build-state');
  const openEngines = button('Open Engines', () => globalThis.dispatchEvent(new CustomEvent('pentavox-navigate', { detail: { tab: 'palette' } })), 'workflow-open-engines');
  const footer = el('footer', 'wr-footer'); footer.append(buildState, openEngines, button('Done', () => dialog.close(), 'primary'));
  dialog.append(header, tabs, layout, status, footer); layout.append(sidebar, body);
  let draft = null; let persistedKinds = new Set(); let kind = 'wavetable'; let selected = 0; let factory = null; let community = []; let loading = null; let destroyed = false;
  let x = .5; let y = .5; let radius = .3; let view = 'surface'; let context = null; let source = null; let timer = null; let busy = false;
  const tabButtons = {};
  for (const [key, text] of [['wavetable', 'Wave Tables'], ['terrain', 'Wave Terrain']]) { const tab = button(text, () => { stop(); kind = key; selected = 0; notice(); render(); }); tab.setAttribute('role', 'tab'); tabButtons[key] = tab; tabs.append(tab); }
  function notice(text = '', error = false) { status.textContent = text; status.classList.toggle('wr-error', error); }
  function stop() { clearTimeout(timer); timer = null; if (source) { try { source.stop(); } catch {} source.disconnect(); source = null; } }
  function save(changedKinds = [kind]) { for (const key of changedKinds) persistedKinds.add(key); draft = normalizeResources(draft); onChange(clone(explicitWaveResources(draft, persistedKinds))); }
  function entries() { return draft[kind].entries; }
  function entryName(entry) { return entry.type === 'factory' ? factory?.[kind]?.[entry.index]?.name ?? FACTORY_NAMES[kind][entry.index] ?? `Factory ${entry.index + 1}` : entry.name || 'Untitled'; }
  function samplesFor(entry) {
    if (!entry) return null;
    if (entry.type !== 'factory') return decodeResourceEntry(entry, kind);
    const value = factory?.[kind]?.[entry.index];
    if (!value?.data) return null;
    return decodeResourceEntry({ type: 'sampled', name: value.name || 'Factory', data: value.data }, kind);
  }
  async function loadAssets() {
    if (loading) return loading;
    loading = Promise.allSettled(['factory.json', 'init-crioxica.json'].map(async (file) => { const response = await fetch(`./data/waves/${file}`); if (!response.ok) throw new Error('Missing wave library'); return response.json(); })).then(([stock, imported]) => {
      if (stock.status === 'fulfilled') factory = stock.value;
      if (imported.status === 'fulfilled') community = imported.value.terrain?.entries ?? [];
    });
    return loading;
  }
  async function guard(action) { if (busy) return; busy = true; try { await action(); } catch (error) { notice(error.message || String(error), true); onError(error); } finally { busy = false; } }
  function add(entry) { if (entries().length >= 16) throw new Error('A bank can contain at most 16 entries. Remove an entry first.'); entries().push(entry); selected = entries().length - 1; save(); notice('Added to this browser’s draft. Select the matching engine to include it in your next build.'); render(); }
  function renderLibrary() {
    sidebar.replaceChildren(); sidebar.append(el('h3', '', 'Resources'));
    sidebar.append(el('p', 'wr-hint', kind === 'wavetable' ? 'Harmonics banks for the Wavetable engine.' : 'Surfaces for the Wave Terrain engine.'));
    sidebar.append(el('p', 'wr-hint', 'Order follows the Harmonics knob. Use the arrows to move an entry.'));
    const list = el('ol', 'wr-entry-list');
    entries().forEach((entry, index) => {
      const row = el('li', index === selected ? 'wr-entry selected' : 'wr-entry'); const pick = button(entryName(entry), () => { stop(); selected = index; notice(); render(); }, 'wr-entry-pick'); pick.setAttribute('aria-pressed', String(index === selected));
      const actions = el('div', 'wr-entry-actions');
      for (const [delta, text, description] of [[-1, '↑', 'Move earlier'], [1, '↓', 'Move later']]) { const control = button(text, () => { stop(); const next = index + delta; [entries()[index], entries()[next]] = [entries()[next], entries()[index]]; selected = next; save(); render(); }); control.disabled = index + delta < 0 || index + delta >= entries().length; control.setAttribute('aria-label', `${description}: ${entryName(entry)}`); actions.append(control); }
      const remove = button('×', () => { stop(); entries().splice(index, 1); selected = Math.max(0, Math.min(selected, entries().length - 1)); save(); render(); }); remove.disabled = entries().length <= 1; remove.setAttribute('aria-label', `Remove ${entryName(entry)}`); actions.append(remove); row.append(pick, actions); list.append(row);
    }); sidebar.append(list);
    const stock = el('select'); stock.setAttribute('aria-label', 'Factory resource to add'); FACTORY_NAMES[kind].forEach((text, index) => { const option = el('option', '', text); option.value = index; stock.append(option); });
    const stockRow = el('div', 'wr-add-row'); const addFactory = button('Add factory', () => guard(() => add({ type: 'factory', index: Number(stock.value) }))); addFactory.disabled = entries().length >= 16; stockRow.append(stock, addFactory); sidebar.append(stockRow);
    if (kind === 'wavetable') { const mirrored = el('input'); mirrored.type = 'checkbox'; mirrored.checked = draft.wavetable.mirrored; mirrored.addEventListener('change', () => { draft.wavetable.mirrored = mirrored.checked; save(); }); sidebar.append(label('Mirror bank scan', mirrored)); }
    else if (community.length) { const select = el('select'); select.setAttribute('aria-label', 'Community terrain'); community.forEach((item, index) => { const option = el('option', '', item.name); option.value = index; select.append(option); }); const row = el('div', 'wr-add-row'); row.append(select, button('Add iNit terrain', () => guard(() => { const value = community[Number(select.value)]; add({ type: 'sampled', name: value.name, data: value.data, equation: value.equation }); }))); sidebar.append(row); }
    const reset = button('Restore factory order', () => { stop(); draft[kind] = clone(defaultResources()[kind]); selected = 0; persistedKinds.delete(kind); save([]); notice('Factory defaults restored.'); render(); }); sidebar.append(reset);
  }
  async function play(samples) {
    stop(); const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext; if (!Audio) throw new Error('Audio preview is unavailable in this browser.');
    context ??= new Audio(); await context.resume();
    const cycle = resourcePreviewCycle(samples, kind, { x, y, radius }); const buffer = context.createBuffer(1, cycle.length, context.sampleRate); buffer.copyToChannel(cycle, 0);
    const oscillator = context.createBufferSource(); source = oscillator; oscillator.buffer = buffer; oscillator.loop = true; oscillator.playbackRate.value = 130.8128 * cycle.length / context.sampleRate;
    const gain = context.createGain(); gain.gain.setValueAtTime(0, context.currentTime); gain.gain.linearRampToValueAtTime(.18, context.currentTime + .025); gain.gain.setValueAtTime(.18, context.currentTime + 1.45); gain.gain.linearRampToValueAtTime(0, context.currentTime + 1.5); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 1.52); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); if (source === oscillator) source = null; };
    timer = setTimeout(() => { if (source === oscillator) source = null; }, 1600);
  }
  function renderDetail() {
    body.replaceChildren(); const entry = entries()[selected]; if (!entry) return;
    const heading = el('div', 'wr-detail-heading'); heading.append(el('h3', '', entryName(entry)), el('span', 'wr-hint', entry.type === 'factory' ? 'Factory' : kind === 'wavetable' ? '64 waves · 128 samples' : '64 × 64 sampled surface')); body.append(heading);
    body.append(el('h4', 'workflow-preview-title', 'Preview'));
    const samples = samplesFor(entry); const canvas = el('canvas', 'wr-canvas'); canvas.width = 720; canvas.height = samples ? 320 : 90; canvas.classList.toggle('preview-unavailable', !samples); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', kind === 'wavetable' ? 'Selected wave shape' : 'Sampled terrain surface'); body.append(canvas);
    const plot = () => draw(canvas, samples, kind, { x, y, radius, view }); plot();
    const controls = el('div', 'wr-controls'); controls.hidden = !samples; controls.append(label('X', range('Preview X position', x, (value) => { x = value; stop(); plot(); })), label('Y', range('Preview Y position', y, (value) => { y = value; stop(); plot(); })));
    if (kind === 'terrain') { controls.append(label('Orbit size', range('Preview orbit size', radius * 2, (value) => { radius = value / 2; stop(); plot(); }))); const toggle = button(view === 'surface' ? 'Show 2D' : 'Show 3D', () => { view = view === 'surface' ? 'map' : 'surface'; renderDetail(); }); controls.append(toggle); }
    const audition = button('Preview C3', () => guard(() => play(samples))); audition.disabled = !samples; controls.append(audition, button('Stop', stop)); body.append(controls);
    body.append(el('p', 'wr-hint', samples ? kind === 'wavetable' ? `${entry.type === 'factory' ? 'Factory preview is approximate. ' : ''}Raw bank audition reads the saved wave grid at X / Y. The firmware engine adds processing, so its sound may differ.` : `${entry.type === 'factory' ? 'Factory preview is approximate. ' : ''}Raw bank audition follows a circular orbit over the saved surface. X / Y move its centre. The firmware engine adds processing, so its sound may differ.` : 'Factory preview data is unavailable. This entry still uses the original factory resource on the module.'));
    if (entry.type !== 'factory') { const name = el('input'); name.type = 'text'; name.value = entry.name; name.maxLength = 80; name.addEventListener('change', () => guard(() => { entry.name = name.value.trim() || 'Untitled'; save(); render(); })); body.append(label('Name', name)); }
    const editor = el('details', 'wr-equation workflow-disclosure'); editor.open = entry.type !== 'factory' && Boolean(entry.equation); editor.append(el('summary', '', entry.type === 'factory' ? 'Create from equation' : 'Edit or create an equation'));
    const name = el('input'); name.type = 'text'; name.value = entry.type === 'factory' ? kind === 'terrain' ? 'My terrain' : 'My wave bank' : entry.name; name.maxLength = 80; const equation = el('textarea'); equation.rows = 3; equation.spellcheck = false; equation.value = entry.equation ?? EXAMPLES[kind][0][1];
    editor.append(label('New bank name', name), label('Equation', equation), el('p', 'wr-hint', kind === 'wavetable' ? 'phi: 0…2π over a cycle. x / y: positions in the wave grid. Functions: sin, cos, tan, abs, sqrt, exp, log, min, max. Use ^ for powers.' : 'x / y: −1…1 across the surface. Functions: sin, cos, tan, abs, sqrt, exp, log, min, max. Use ^ for powers.'));
    const exampleRow = el('div', 'wr-examples'); for (const [text, value] of EXAMPLES[kind]) exampleRow.append(button(text, () => { equation.value = value; })); editor.append(exampleRow);
    const generate = (replace) => guard(() => { const sampled = (kind === 'wavetable' ? sampleWavetableEquation : sampleTerrainEquation)(name.value.trim() || 'Untitled', equation.value); stop(); if (replace) { entries()[selected] = sampled; save(); notice('Updated in this browser’s draft. Select the matching engine to include it in your next build.'); render(); } else add(sampled); });
    const equationActions = el('div', 'wr-actions'); const create = button('Add sampled bank', () => generate(false), 'primary'); create.disabled = entries().length >= 16; equationActions.append(create); if (entry.type !== 'factory') equationActions.append(button('Replace selected', () => generate(true))); editor.append(equationActions); body.append(editor);
    const importSection = el('details', 'workflow-disclosure'); importSection.append(el('summary', '', 'Import and export'));
    const imports = el('div', 'wr-imports'); const wavMode = el('select'); wavMode.setAttribute('aria-label', 'WAV layout'); for (const [value, text] of [['64', 'WAV: 64 waves'], ['1', 'WAV: single cycle']]) { const option = el('option', '', text); option.value = value; wavMode.append(option); } const input = el('input'); input.type = 'file'; input.accept = kind === 'wavetable' ? '.json,.wav,application/json,audio/wav' : '.json,application/json'; input.hidden = true;
    input.addEventListener('change', () => guard(async () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 16 * 1024 * 1024) throw new Error('Choose a file smaller than 16 MB.');
      if (/\.wav$/i.test(file.name)) { if (kind !== 'wavetable') throw new Error('WAV import is available in Wave Tables.'); add(await importWavetableWav(file.name.replace(/\.wav$/i, ''), await file.arrayBuffer(), { waveCount: Number(wavMode.value) })); }
      else { const imported = importPaletteResources(JSON.parse(await file.text())); draft = normalizeResources({ ...draft, ...imported }); selected = 0; stop(); save(Object.keys(imported)); notice('Imported into this browser’s draft. Select the matching engines to include these resources in your next build.'); render(); }
      input.value = '';
    })); if (kind === 'wavetable') imports.append(wavMode); imports.append(input, button(kind === 'wavetable' ? 'Import Palette JSON / WAV' : 'Import Palette JSON', () => { input.value = ''; input.click(); }));
    imports.append(button('Export wave banks', () => { const blob = new Blob([JSON.stringify({ resources: draft }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = el('a'); anchor.href = url; anchor.download = 'pentavox-wave-banks.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })); importSection.append(imports); body.append(importSection);
    if (kind === 'wavetable') importSection.append(el('p', 'wr-hint', 'Choose the WAV layout before importing: 64 consecutive waves, or one cycle repeated across the bank. Each wave is resampled to 128 samples. Palette JSON imports both wave sections.'));
  }
  function render() { if (!draft || destroyed) return; buildState.textContent = waveBuildMessage(kind); for (const [key, tab] of Object.entries(tabButtons)) { tab.setAttribute('aria-selected', String(key === kind)); tab.tabIndex = key === kind ? 0 : -1; } renderLibrary(); renderDetail(); }
  tabs.addEventListener('keydown', (event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); kind = event.key === 'Home' ? 'wavetable' : event.key === 'End' ? 'terrain' : kind === 'wavetable' ? 'terrain' : 'wavetable'; selected = 0; stop(); notice(); render(); tabButtons[kind].focus(); });
  dialog.addEventListener('close', stop);
  return {
    dialog,
    async open(nextKind = 'wavetable') { if (destroyed) return; stop(); const saved = normalizeResources(getResources() ?? {}); persistedKinds = new Set(Object.keys(saved)); draft = { ...defaultResources(), ...saved }; kind = nextKind === 'terrain' ? 'terrain' : 'wavetable'; selected = 0; notice(); render(); if (!dialog.open) dialog.showModal(); await loadAssets(); if (!destroyed && dialog.open) render(); },
    close() { stop(); dialog.close(); }, render,
    destroy() { destroyed = true; stop(); if (context) { context.close().catch(() => {}); context = null; } dialog.remove(); },
  };
}

function draw(canvas, samples, kind, { x, y, radius, view }) {
  const ctx = canvas.getContext('2d'); if (!ctx) return; const w = canvas.width; const h = canvas.height;
  const css = getComputedStyle(canvas); const accent = css.getPropertyValue('--accent').trim() || '#df4f2f'; const line = css.getPropertyValue('--line').trim() || '#d7d0c5'; const muted = css.getPropertyValue('--muted').trim() || '#6c6962';
  ctx.clearRect(0, 0, w, h); if (!samples) { ctx.fillStyle = muted; ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Preview unavailable', w / 2, h / 2); return; }
  if (kind === 'wavetable') {
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20, h / 2); ctx.lineTo(w - 20, h / 2); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 512; i += 1) { const value = readResourceSample(samples, kind, i / 512, x, y); const px = 20 + i / 512 * (w - 40); const py = h / 2 - value * (h / 2 - 24); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); return;
  }
  if (view === 'map') {
    const side = h - 24; const left = (w - side) / 2; for (let yy = 0; yy < 63; yy += 1) for (let xx = 0; xx < 63; xx += 1) { const value = samples[yy * 64 + xx] / 128; ctx.fillStyle = `hsl(${190 - value * 50} 50% ${50 + value * 30}%)`; ctx.fillRect(left + xx * side / 63, 12 + (62 - yy) * side / 63, Math.ceil(side / 63), Math.ceil(side / 63)); }
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 100; i += 1) { const angle = i / 100 * Math.PI * 2; const px = left + clamp(x + Math.cos(angle) * radius, 0, 1) * side; const py = 12 + (1 - clamp(y + Math.sin(angle) * radius, 0, 1)) * side; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); return;
  }
  const project = (xx, yy, z) => [w / 2 + (xx - yy) * w * .32, h * .62 + (xx + yy - 1) * h * .29 - z * h * .22];
  ctx.lineWidth = 1; ctx.strokeStyle = accent; for (let row = 0; row <= 32; row += 1) { ctx.beginPath(); for (let col = 0; col <= 64; col += 1) { const xx = col / 64; const yy = row / 32; const [px, py] = project(xx, yy, readResourceSample(samples, 'terrain', 0, xx, yy)); if (col) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.globalAlpha = .35 + row / 32 * .6; ctx.stroke(); } ctx.globalAlpha = 1;
  ctx.strokeStyle = muted; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 100; i += 1) { const angle = i / 100 * Math.PI * 2; const xx = clamp(x + Math.cos(angle) * radius, 0, 1); const yy = clamp(y + Math.sin(angle) * radius, 0, 1); const [px, py] = project(xx, yy, readResourceSample(samples, 'terrain', 0, xx, yy)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
}
