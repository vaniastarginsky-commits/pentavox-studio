// The colour inspector of the Panel page: for the ring selected on the front panel, its colours and motion (ring, pip, scale, position dot) on the
// page and layer shown, plus the two new-loop warnings and the buttons that store the skin on the module. The front panel above it shows the module
// live; changes go to the module as they are made (firmware: led_skin.h, HostLink 0x7D..0x7F).
import {
  LedSkinClient, PICKED_COLOURS, SKIN_ELEMENTS, SKIN_EFFECTS, SKIN_FOLLOW_FIRST, SKIN_LAYERS, SKIN_POTS, SKIN_WARNING_NAMES, emptyRing, emptySkin, fromHex, layerOf, skinPageOf, toHex,
} from '../model/led_skin.js';

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function button(text, className = '') { const node = el('button', className, text); node.type = 'button'; return node; }
const EFFECT_HELP = ['Keep the firmware’s own colours', 'A steady colour', 'A slow breath, 1.25 s', 'A quick pulse, 0.5 s', 'Blinking, 2 Hz',
  'Flashes on every beat of the clock and fades out', 'Rises through the bar, restarting on the downbeat', 'Brighter the further modulation moves this control',
  'Brighter the higher the control is set', 'Follows the output level', 'Follows the input level', 'Follows the sidechain detector', 'Follows the looper’s own detector'];

export function mountPanelSkin(root, { getClient = () => null, getDescriptor = () => null, onError = (e) => console.error(e), onSuccess = () => {}, onChange = () => {} } = {}) {
  const state = { skin: emptySkin(), page: 0, shift: false, pot: 0, element: 0, loaded: false, problem: '', busy: false, pending: new Set(), warningsPending: false, timer: null };
  const supported = () => Boolean(getClient() && getDescriptor()?.ledSkin);
  const skinClient = () => (supported() ? new LedSkinClient(getClient()) : null);
  const layer = () => layerOf(state.page, state.shift);
  const entry = () => state.skin.layers[layer()][state.pot][SKIN_ELEMENTS[state.element].id];

  const head = el('div', 'skin-head'); const title = el('h2', 'skin-title'); const status = el('span', 'skin-status');
  head.append(title, status);
  const elementBar = el('div', 'skin-bar'); const editor = el('div', 'skin-editor'); const warnings = el('div', 'skin-warnings'); const actions = el('div', 'skin-actions');
  const reset = button('Reset all colours');
  const note = el('p', 'skin-help', 'Colours are part of the preset: they are stored with it by Save to slot, and a preset brings its own back.');
  actions.append(reset, note);
  root.replaceChildren(head, elementBar, editor, warnings, actions);

  function renderEditor() {
    const ring = entry(); editor.replaceChildren();
    const element = SKIN_ELEMENTS[state.element];
    editor.append(el('p', 'skin-help', element.help));
    const swatches = el('div', 'skin-swatches');
    for (const colour of PICKED_COLOURS) {
      const swatch = button('', 'skin-swatch'); swatch.title = `${colour.name} (${colour.rgb.join(', ')})`; swatch.setAttribute('aria-label', colour.name);
      swatch.style.background = `rgb(${colour.rgb.join(',')})`;
      swatch.setAttribute('aria-pressed', String(ring.r === colour.rgb[0] && ring.g === colour.rgb[1] && ring.b === colour.rgb[2]));
      swatch.addEventListener('click', () => change({ r: colour.rgb[0], g: colour.rgb[1], b: colour.rgb[2], effect: ring.effect || 1 }));
      swatches.append(swatch);
    }
    editor.append(swatches);
    editor.append(sliders(ring, change), motion(ring, change));
    const copyRow = el('div', 'skin-copy');
    const toPage = button('Copy to every ring of this page layer', 'quiet-button'); const toAll = button('Copy to every ring of every page', 'quiet-button');
    toPage.addEventListener('click', () => copyElement(false)); toAll.addEventListener('click', () => copyElement(true));
    copyRow.append(toPage, toAll); editor.append(copyRow);
  }
  function sliders(ring, apply) {
    const box = el('div', 'skin-sliders');
    for (const [key, name] of [['r', 'Red'], ['g', 'Green'], ['b', 'Blue']]) {
      const row = el('label', 'skin-slider'); row.append(el('span', '', name));
      const input = document.createElement('input'); input.type = 'range'; input.min = '0'; input.max = '255'; input.value = String(ring[key]);
      const value = el('output', '', String(ring[key]));
      input.addEventListener('input', () => { value.textContent = input.value; apply({ ...ring, [key]: Number(input.value), effect: ring.effect || 1 }); });
      row.append(input, value); box.append(row);
    }
    const hexRow = el('label', 'skin-slider'); hexRow.append(el('span', '', 'Hex'));
    const hex = document.createElement('input'); hex.type = 'text'; hex.value = toHex(ring); hex.maxLength = 7; hex.size = 8;
    hex.addEventListener('change', () => { const parsed = fromHex(hex.value); if (parsed) apply({ ...parsed, effect: ring.effect || 1 }); else hex.value = toHex(ring); });
    hexRow.append(hex); box.append(hexRow);
    return box;
  }
  function motion(ring, apply) {
    const box = el('div', 'skin-effects-group');
    const row = (label, from, to) => {
      const line = el('div', 'skin-effects'); line.setAttribute('role', 'group'); line.setAttribute('aria-label', label);
      line.append(el('span', 'skin-effects-label', label));
      SKIN_EFFECTS.slice(from, to).forEach((name, offset) => {
        const index = from + offset;
        const item = button(name, 'quiet-button'); item.setAttribute('aria-pressed', String(ring.effect === index)); item.title = EFFECT_HELP[index];
        item.addEventListener('click', () => apply({ ...ring, effect: index })); line.append(item);
      });
      return line;
    };
    box.append(row('Motion', 0, SKIN_FOLLOW_FIRST), row('Follows', SKIN_FOLLOW_FIRST, SKIN_EFFECTS.length));
    return box;
  }

  function renderWarnings() {
    warnings.replaceChildren(el('h3', '', 'New-loop warning'), el('p', 'skin-help', 'B2 held for five seconds wipes the loop of the slot: first the panel blinks, then it flashes. Colour them here; Off keeps the firmware’s own.'));
    SKIN_WARNING_NAMES.forEach((name, index) => {
      const ring = state.skin.warnings[index];
      const block = el('div', 'skin-warning'); block.append(el('h4', '', name));
      const apply = (next) => { state.skin.warnings[index] = { r: next.r, g: next.g, b: next.b, effect: next.effect }; state.warningsPending = true; queueFlush(); renderWarnings(); renderStatus(); onChange(); };
      const swatches = el('div', 'skin-swatches skin-swatches-small');
      for (const colour of PICKED_COLOURS) {
        const swatch = button('', 'skin-swatch'); swatch.title = colour.name; swatch.setAttribute('aria-label', `${name}: ${colour.name}`); swatch.style.background = `rgb(${colour.rgb.join(',')})`;
        swatch.setAttribute('aria-pressed', String(ring.r === colour.rgb[0] && ring.g === colour.rgb[1] && ring.b === colour.rgb[2]));
        swatch.addEventListener('click', () => apply({ r: colour.rgb[0], g: colour.rgb[1], b: colour.rgb[2], effect: ring.effect || 1 }));
        swatches.append(swatch);
      }
      block.append(swatches, motion(ring, apply)); warnings.append(block);
    });
  }

  function renderBar() {
    elementBar.replaceChildren();
    SKIN_ELEMENTS.forEach((element, index) => {
      const ring = state.skin.layers[layer()][state.pot][element.id];
      const item = button(element.name, 'quiet-button'); item.setAttribute('aria-pressed', String(state.element === index)); item.title = element.help;
      if (ring.effect) { const chip = el('span', 'skin-chip'); chip.style.background = `rgb(${ring.r},${ring.g},${ring.b})`; item.prepend(chip); }
      item.addEventListener('click', () => { state.element = index; render(); }); elementBar.append(item);
    });
  }
  function renderStatus() {
    const connected = Boolean(getClient()); const can = supported();
    status.textContent = !connected ? 'Module not connected' : !can ? 'This firmware has no colour skin' : state.problem ? state.problem : !state.loaded ? 'Reading the module…' : 'Live on the module; Save to slot keeps them in the preset';
    status.dataset.state = !can ? 'off' : state.problem ? 'err' : 'ok';
    for (const control of [reset]) control.disabled = !can || !state.loaded || state.busy;
    root.dataset.available = String(can);
  }
  function render() {
    title.textContent = `Colours · ring ${state.pot + 1} · ${state.pageName ?? `page ${state.page + 1}`}${state.shift ? ' · B1 held' : ''}`;
    renderBar(); renderEditor(); renderWarnings(); renderStatus();
  }

  function change(next) {
    const l = layer();
    state.skin.layers[l][state.pot][SKIN_ELEMENTS[state.element].id] = { r: next.r, g: next.g, b: next.b, effect: next.effect };
    state.pending.add(l); queueFlush(); renderBar(); renderEditor(); renderStatus(); onChange();
  }
  function copyElement(everywhere) {
    const id = SKIN_ELEMENTS[state.element].id; const ring = { ...entry() };
    const layers = everywhere ? [...Array(SKIN_LAYERS).keys()] : [layer()];
    for (const l of layers) { for (let pot = 0; pot < SKIN_POTS; ++pot) state.skin.layers[l][pot][id] = { ...ring }; state.pending.add(l); }
    queueFlush(); renderStatus(); onChange();
  }
  // Writes are batched: a slider drag changes a layer many times a second, the module needs the last state of it.
  function queueFlush() { clearTimeout(state.timer); state.timer = setTimeout(flush, 120); }
  async function flush() {
    const client = skinClient(); if (!client) return;
    const layers = [...state.pending]; state.pending.clear(); const sendWarnings = state.warningsPending; state.warningsPending = false;
    try {
      for (const l of layers) await client.writeLayer(l, state.skin.layers[l]);
      if (sendWarnings) await client.writeWarnings(state.skin.warnings);
      state.problem = '';
    } catch (error) { state.problem = 'The module did not take the colours'; onError(error); }
    renderStatus();
  }
  async function load() {
    const client = skinClient(); state.loaded = false; state.problem = ''; renderStatus();
    if (!client) return;
    try {
      await client.info();
      state.skin = await client.readAll();
      state.loaded = true;
    } catch (error) { state.problem = 'Could not read the colours'; onError(error); }
    render(); onChange();
  }
  async function run(task, done) {
    const client = skinClient(); if (!client || state.busy) return;
    state.busy = true; renderStatus();
    try { await flush(); await task(client); if (done) onSuccess(done); } catch (error) { onError(error); }
    state.busy = false;
  }
  reset.addEventListener('click', async () => { await run((client) => client.reset(), 'The rings are back to the firmware colours (Save to slot keeps that)'); await load(); });
  // A preset was loaded and brought its colours: read them again.
  globalThis.addEventListener?.('pentavox-skin-changed', () => { if (supported()) setTimeout(load, 300); });

  render();
  return {
    /** The front panel's selection: its page (and the page's name), the B1 layer and the pot. */
    select({ page, pageName, shift, pot }) {
      const moved = skinPageOf(pageName, page) !== state.page || shift !== state.shift || (pot !== undefined && pot !== state.pot);
      state.page = skinPageOf(pageName, page); state.pageName = pageName; state.shift = Boolean(shift);
      if (pot !== undefined) state.pot = pot;
      if (moved || !title.textContent) render();
    },
    show() { render(); if (supported() && !state.loaded && !state.busy) load(); },
    refreshConnection() { state.loaded = false; state.skin = emptySkin(); render(); if (root.offsetParent !== null && supported()) load(); },
    /** Tints the rings drawn by the panel dock with what the skin gives them on the page and layer shown. */
    decorate(potNodes, page, shift) {
      const l = layerOf(skinPageOf(page.name, page.index), shift);
      for (const { pot, group } of potNodes) {
        const ring = state.skin.layers[l]?.[pot.id]?.body ?? emptyRing();
        if (ring.effect) { group.style.setProperty('--ring', `rgb(${ring.r},${ring.g},${ring.b})`); group.dataset.skinEffect = String(ring.effect); }
        else delete group.dataset.skinEffect;
      }
    },
    selected: () => ({ page: state.page, shift: state.shift, pot: state.pot }),
  };
}
