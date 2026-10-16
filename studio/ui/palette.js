import { setDifferences, adoptModuleSet } from '../model/module_set.js';
import { BANK_LETTERS, PaletteModel, libraryEntries } from '../model/palette.js';
import { EngineAudition } from '../audition.js';
import { bankCardsView, buildButtonView, categoriesView, isCompactModule, libraryRowsView, memoryView, voiceTabCount } from './palette_vm.js';
import { lcdLabel, lcdSvg } from './lcd.js';
import { lastBackupInfo } from '../model/preset_backup.js';
import { apiFetch, servedLocally } from '../site.js';
import { describeBuild, loadLatestCloudBuild, localServerUp, runCloudBuild, runWebFlash } from '../build_flow.js';
import { mountWaveResourcesEditor } from './wave_resources_editor.js';
import { activeLinkJob, linkBusyMessage } from '../model/link_jobs.js';

/** The confirm text before flashing: a new firmware can change the preset layout, which resets every stored slot. */
export function flashWarning(backup = lastBackupInfo()) {
  const state = backup
    ? `A preset backup was made in this session (${backup.filled} filled slot${backup.filled === 1 ? '' : 's'}).`
    : 'No preset backup was made in this session. If the new firmware changes the preset layout, ALL stored presets are reset. Cancel and use Presets > Export backup first.';
  return `This replaces the current firmware.\n\n${state}\n\nIs the module already in DFU mode?`;
}

/**
 * A confirm that is not the native one. The device chooser of WebUSB opens only shortly after a click, and the time spent reading a native
 * confirm used it up ("Must be handling a user gesture"); the click on this dialog's button is the gesture that follows.
 */
export function confirmDialog(text, okLabel = 'OK') {
  return new Promise((resolve) => {
    const dialog = el('dialog', 'confirm-dialog');
    const cancel = button('Cancel'); const ok = button(okLabel, 'primary');
    const actions = el('div', 'confirm-actions'); actions.append(cancel, ok);
    dialog.append(el('pre', 'confirm-text', text), actions);
    const finish = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    cancel.addEventListener('click', () => finish(false));
    ok.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });   // Esc
    document.body.append(dialog);
    dialog.showModal();
    ok.focus();
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className = '') {
  const node = el('button', className, text);
  node.type = 'button';
  return node;
}

let HELP = {};

// Engine artwork: the PNG from Rubato's open catalog when it has one, else a
// four-letter LCD tile like their palette tool (tone = hardware bank colour).
const CATEGORY_HUE = Object.freeze({ 'Analog': 150, 'FM': 38, 'Wavetable': 200, 'Drums': 355, 'Chords': 270, 'Vocal': 20, 'Noise/texture': 190, 'Physical': 300, 'Other': 95 });

function icon(category, glyph, id, bank) {
  const art = id ? HELP[id] : null;
  const file = bank !== undefined && bank !== null && bank < 3 ? `dx7-bank-${BANK_LETTERS[bank].toLowerCase()}.png` : art?.icon;   // artwork exists for banks A-C only
  if (file) {
    const img = document.createElement('img');
    img.className = 'engine-icon'; img.src = `./assets/engine-icons/${file}`; img.alt = ''; img.loading = 'lazy';
    img.title = category;
    return img;
  }
  const node = el('span', 'lcd-tile');
  node.innerHTML = lcdSvg(lcdLabel(art?.name || glyph || ''));
  node.style.setProperty('--h', String(CATEGORY_HUE[category] ?? 0));
  node.title = category;
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function downloadRecipe(recipe) {
  const blob = new Blob([JSON.stringify(recipe, null, 1)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'palette_recipe.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 2000);
}

// Recipes saved before the banks were put in Pentavox order (green = original eight, yellow = six-op set)
// still start with the Plaits 1.2 "new engines" bank: phase distortion, three six-ops, wave terrain, string
// machine and chiptune sit in slots 1-7 (slot 0 may have been replaced by hand). Such a voice gets its first
// two banks swapped, which is what the stock set looks like now; any other layout is left alone.
const OLD_BANK_SIGNATURE = [[1, 'phase_distortion'], [2, 'six_op'], [3, 'six_op'], [4, 'six_op'], [5, 'wave_terrain'], [6, 'string_machine'], [7, 'chiptune']];
function migrateStockBankOrder(recipe) {
  if (!Array.isArray(recipe?.voices)) return recipe;
  return {
    ...recipe,
    voices: recipe.voices.map((voice) => {
      const slots = voice?.slots;
      if (!Array.isArray(slots) || slots.length !== 24 || !OLD_BANK_SIGNATURE.every(([i, id]) => slots[i]?.engine_id === id)) return voice;
      const swapped = [...slots.slice(8, 16), ...slots.slice(0, 8), ...slots.slice(16)];
      return { ...voice, slots: swapped.map((slot, slot_index) => ({ ...slot, slot_index })) };
    }),
  };
}

const PRESETS = [['stock', 'Plaits 1.2'], ['braids1', 'Braids 1'], ['braids2', 'Braids 2'], ['set1', 'Set 1'], ['set2', 'Set 2'], ['set3', 'Set 3']];
const PRESET_LABEL = Object.fromEntries(PRESETS);
const SVG_STEREO = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5.5" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10.5" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const SVG_SYNC = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 0 1 8.6-3.4M13 8a5 5 0 0 1-8.6 3.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12.2 1.8v3.2H9M3.8 14.2V11H7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BANK_NAMES = ['Green', 'Yellow', 'Red'];
const slotKey = (slot) => (slot.bank === undefined ? slot.id : `${slot.id}#${slot.bank}`);

function svg(markup, className = '') {
  const holder = el('span', `eg-ico ${className}`.trim());
  holder.innerHTML = markup; holder.setAttribute('aria-hidden', 'true');
  return holder;
}

export function mountPalette(root, { catalog, sets, measured, help = {}, getVoiceTable = () => null, isDemo = () => false, getController = () => null, getClient = () => null, onEditBanks = () => {}, onError = () => {} }) {
  HELP = help;
  const model = new PaletteModel(catalog, sets, measured);
  const waveEditor = mountWaveResourcesEditor({ getResources: () => model.resources, onChange: (resources) => { model.setResources(resources); changed(); }, model, catalog, onError });
  try { const saved = JSON.parse(localStorage.getItem('pentavox.palette.recipe')); if (saved) model.importRecipe(migrateStockBankOrder(saved)); } catch { /* invalid local state falls back to stock */ }
  const audition = new EngineAudition(catalog.engines);
  const entries = libraryEntries(catalog);
  // view: 0..2 shows one voice (large rows), 'both' stacks every voice in the dense table. voice = the voice that receives clicks and library picks.
  const state = { selected: [0, 0, 0], search: '', category: '', stereo: false, sync: false, absent: false, expanded: null, polling: null, voice: 0, busy: false, suggest: false, view: 'both', tab: 'browse', diff: false, hl: null, hover: null, drag: null };

  root.innerHTML = `
    <div class="eg">
      <div class="eg-bar"><div class="eg-seg" role="group" aria-label="Which voices to show"></div><span class="eg-stats"></span><span class="eg-sp"></span></div>
      <div class="eg-notes"></div>
      <div class="eg-split">
        <div class="eg-board"></div>
        <aside class="eg-dock" aria-label="Engine library and selected slot">
          <div class="eg-tabs" role="tablist"></div>
          <div class="eg-tools"></div>
          <div class="eg-list"></div>
        </aside>
      </div>
      <div class="eg-status"><div class="eg-meter"><div class="eg-track" role="meter" aria-valuemin="0" aria-valuemax="100"><i></i><u></u></div><small class="memory-text"></small></div><div class="eg-steps"></div><div class="suggest-panel" hidden></div></div>
    </div>`;
  const $ = (selector) => root.querySelector(selector);
  const actions = $('.eg-steps');

  // ---- top bar: voice filter, stats, compare, ready-made sets, more ----
  const bar = $('.eg-bar');
  const diffButton = button('Compare voices'); diffButton.setAttribute('aria-pressed', 'false');
  diffButton.title = 'Mark the engines that are in only one voice';
  diffButton.addEventListener('click', () => { state.diff = !state.diff; renderBoard(); });
  const setPick = document.createElement('select'); setPick.setAttribute('aria-label', 'Ready-made set'); setPick.append(new Option('Ready-made set…', ''));
  for (const [key, label] of PRESETS) setPick.append(new Option(label, key));
  const setTarget = document.createElement('select'); setTarget.setAttribute('aria-label', 'Apply to');
  const setApply = button('Apply');
  setApply.addEventListener('click', () => {
    if (!setPick.value) { setPick.focus(); return; }
    const all = setTarget.value === 'all'; const voice = Number(setTarget.value);
    try { model.loadPreset(setPick.value, all ? null : voice); } catch (error) { onError(error); return; }
    if (all) state.selected = [0, 0, 0]; else state.selected[voice] = 0;
    changed();
  });
  const setGroup = el('span', 'eg-setgroup'); setGroup.append(setPick, setTarget, setApply);
  // recipe files and the editors that used to be buttons beside Build
  const more = el('details', 'eg-more'); more.append(el('summary', '', 'Recipe & editors'));
  const moreList = el('div', 'eg-more-list'); more.append(moreList);
  const exportButton = button('Download recipe.json');
  exportButton.addEventListener('click', () => { more.open = false; downloadRecipe(model.recipe()); });
  const importLabel = el('label', 'eg-file', 'Import recipe.json');
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.json'; file.hidden = true;
  file.addEventListener('change', async () => { more.open = false; if (!file.files[0]) return; try { model.importRecipe(JSON.parse(await file.files[0].text())); changed(); } catch (error) { onError(error); } finally { file.value = ''; } });
  importLabel.append(file);
  const dx7Button = button('DX7 banks'); dx7Button.title = 'Compose the six Six-op FM banks and write them to the SD card';
  dx7Button.addEventListener('click', () => { more.open = false; onEditBanks('A'); });
  const wavesButton = button('Wave tables');
  wavesButton.addEventListener('click', () => { more.open = false; document.querySelector('[data-tab="wavetable"]') ? document.querySelector('[data-tab="wavetable"]').click() : waveEditor.open('wavetables'); });
  const terrainButton = button('Wave terrain');
  terrainButton.addEventListener('click', () => { more.open = false; document.querySelector('[data-tab="terrain"]') ? document.querySelector('[data-tab="terrain"]').click() : waveEditor.open('terrain'); });
  moreList.append(exportButton, importLabel, dx7Button, wavesButton, terrainButton);
  bar.append(diffButton, setGroup, more);

  function persist() { try { localStorage.setItem('pentavox.palette.recipe', JSON.stringify(model.recipe())); } catch { /* optional */ } }
  function preview(id, stereo) { audition.preview(id, stereo).catch(onError); }
  function voiceTotal() { return voiceTabCount(getVoiceTable()); }
  function shownVoices() { const total = voiceTotal(); return state.view === 'both' ? Array.from({ length: total }, (_, v) => v) : [Math.min(state.view, total - 1)]; }
  function kb(bytes) { return (bytes / 1024).toFixed(1); }

  function liveName(slot) {
    if (!slot) return '—';
    const engine = model.byId.get(slot.id);
    return slot.bank === undefined ? engine?.name ?? '—' : `Six-op · ${BANK_LETTERS[slot.bank]}`;
  }

  function liveIndexFor(voice) {
    try { const index = getVoiceTable()?.get(voice)?.engine; return Number.isInteger(index) ? index : null; } catch { return null; }
  }

  // The module says which engine class sits in every slot; Studio's own copy of the sets lives in this browser. Never changed silently.
  let dismissedSignature = null;
  function moduleSetMismatch(table) {
    if (!table?.voiceLabels || isDemo()) return null;
    const labels = table.voiceLabels.slice(0, voiceTabCount(table));
    const signature = JSON.stringify(labels);
    if (signature === dismissedSignature) return null;
    let differences;
    try { differences = setDifferences(model, labels, catalog.engines); } catch { return null; }
    const total = differences.reduce((sum, voice) => sum + voice.length, 0);
    if (!total) return null;
    const box = el('div', 'banner warning module-set');
    const where = differences.map((voice, v) => (voice.length ? `Voice ${v + 1}: ${voice.length}` : '')).filter(Boolean).join(', ');
    box.append(el('span', 'module-set-text', `The module holds a different engine set than Studio shows (${where} slot${total === 1 ? '' : 's'}). Names below may not be the ones that play.`));
    const adopt = button('Use the module’s set', 'pill-button solid');
    adopt.addEventListener('click', () => { adoptModuleSet(model, differences); changed(); });
    const keep = button('Keep Studio’s', 'pill-button');
    keep.addEventListener('click', () => { dismissedSignature = signature; renderNotes(); });
    box.append(adopt, keep);
    return box;
  }

  // ---- the voice filter, the stat chips and the notes under the bar ----
  function renderSeg() {
    const seg = $('.eg-seg'); seg.replaceChildren();
    const total = voiceTotal();
    if (state.view !== 'both' && state.view >= total) state.view = 'both';
    if (state.voice >= total) state.voice = 0;
    const choices = [...Array.from({ length: total }, (_, v) => [v, `Voice ${v + 1}`]), ['both', 'Both']];
    for (const [value, label] of choices) {
      const item = button(label); item.dataset.voices = String(value); item.setAttribute('aria-pressed', String(state.view === value));
      item.addEventListener('click', () => { state.view = value; if (value !== 'both') state.voice = value; renderSeg(); renderBoard(); renderDock(); });
      seg.append(item);
    }
    const targets = [...Array.from({ length: total }, (_, v) => [String(v), `to Voice ${v + 1}`]), ['all', 'to all voices']];
    const kept = setTarget.value; setTarget.replaceChildren(...targets.map(([value, label]) => new Option(label, value)));
    setTarget.value = targets.some(([value]) => value === kept) ? kept : String(state.voice);
  }

  function renderStats() {
    const holder = $('.eg-stats'); holder.replaceChildren();
    const total = voiceTotal();
    let stereoOn = 0; let stereoCan = 0; let syncOn = 0; let syncCan = 0; let repeats = 0;
    const keys = Array.from({ length: total }, (_, v) => new Set(model.slotsOf(v).map(slotKey)));
    for (let v = 0; v < total; ++v) {
      const seen = new Set();
      for (const slot of model.slotsOf(v)) {
        const engine = model.byId.get(slot.id);
        if (slot.stereo) ++stereoOn; if (engine?.stereo) ++stereoCan;
        if (slot.sync) ++syncOn; if (engine?.sync) ++syncCan;
        const key = slotKey(slot); if (seen.has(key)) ++repeats; seen.add(key);
      }
    }
    const chip = (html, tone = '') => { const node = el('span', `eg-chip ${tone}`.trim()); node.innerHTML = html; holder.append(node); };
    chip(`${SVG_STEREO}Stereo <b>${stereoOn}/${stereoCan}</b>`);
    chip(`${SVG_SYNC}Sync In <b>${syncOn}/${syncCan}</b>`);
    chip(`classes <b>${model.summary().unionClasses}</b>`);
    chip(`repeats <b>${repeats}</b>`, repeats ? 'warn' : 'ok');
    for (let v = 0; v < total; ++v) {
      const others = new Set(keys.flatMap((set, other) => (other === v ? [] : [...set])));
      chip(`only in ${v + 1} <b>${[...keys[v]].filter((key) => !others.has(key)).length}</b>`);
    }
    diffButton.setAttribute('aria-pressed', String(state.diff)); diffButton.classList.toggle('on', state.diff);
  }

  function renderNotes() {
    const notes = $('.eg-notes'); notes.replaceChildren();
    const table = getVoiceTable();
    const mismatch = moduleSetMismatch(table);
    if (mismatch) notes.append(mismatch);
    const controller = getController();
    if (!controller) { notes.append(el('p', 'voice-hint', 'Connect the module: then clicking a slot assigns the engine to the selected voice.')); return; }
    const view = controller.view();
    if (view.readOnly) notes.append(el('div', 'banner warning', view.reason ?? 'Read only'));
  }

  async function assignActiveVoice(slotIndex) {
    const controller = getController();
    if (!controller || controller.view().readOnly) return;
    try { await controller.assignVoiceEngine(state.voice, slotIndex); } catch (error) { onError(error); }
  }

  // ---- the board: one table per voice, three bank columns ----
  function pill(kind, slot, square) {
    const isStereo = kind === 'stereo';
    const can = isStereo ? slot.stereo : slot.sync; const on = isStereo ? slot.stereoEnabled : slot.syncEnabled;
    const node = button('', `eg-pill ${isStereo ? 'st' : 'sy'}${on ? ' on' : ''}${square ? ' sq' : ''}`);
    node.dataset.act = kind; node.setAttribute('aria-pressed', String(on)); node.disabled = !can;
    node.innerHTML = (isStereo ? SVG_STEREO : SVG_SYNC) + (square ? '' : `<span>${isStereo ? 'Stereo' : 'Sync In'}</span>`);
    node.setAttribute('aria-label', isStereo ? 'Stereo' : 'Sync In');
    node.title = isStereo
      ? (can ? `Stereo: ${on ? 'on (left and right differ), click to turn off' : 'off (mono), click to turn on'}; enabled at build` : slot.monoInPractice ? 'Stereo: left and right stay nearly identical on this engine' : 'Stereo: not supported by this engine')
      : (can ? `Sync In: ${on ? 'on, the oscillator follows the bar reset; click to turn off' : 'off, click to turn on'}; enabled at build` : 'Sync In: not supported by this engine');
    return node;
  }

  function slotRow(slot, voice, dense, others) {
    const key = slotKey(slot);
    const unique = state.diff && !others.has(key);
    const row = el('div', `eg-slot${state.selected[voice] === slot.index && state.voice === voice ? ' sel' : ''}${slot.live ? ' mine' : ''}${unique ? ' uniq' : ''}${state.diff && !unique ? ' shared' : ''}${state.hl === key ? ' hl' : ''}`);
    row.dataset.v = String(voice); row.dataset.i = String(slot.index); row.draggable = true; row.tabIndex = 0; row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `Voice ${voice + 1}, slot ${slot.globalNumber}: ${slot.name}${slot.live ? ' (playing on the module)' : ''}`);
    const name = el('span', 'eg-nm'); name.append(el('b', '', slot.name));
    if (dense) row.title = `${slot.name} · ${slot.sizeLabel}`;
    if (slot.dx7Bank) {
      const chip = button(slot.dx7Bank, 'eg-dx7'); chip.dataset.act = 'dx7'; chip.title = `DX7 bank ${slot.dx7Bank} (SD /DX7/BANK_${slot.dx7Bank}.SYX): click to edit the DX7 banks, Shift-click for the next bank`;
      name.append(chip);
    }
    if (!dense) name.append(el('small', '', `${slot.number.replace(/^0/, '')} · ${slot.category} · ${slot.sizeLabel}`));
    const play = button('▶', 'eg-play'); play.dataset.act = 'play'; play.title = 'Audition this engine'; play.setAttribute('aria-label', `Audition ${slot.name}`);
    const pills = el('span', `eg-pills${dense ? ' sqs' : ''}`); pills.append(pill('stereo', slot, dense), pill('sync', slot, dense));
    const live = slot.live ? el('i', 'eg-live-dot') : null; if (live) live.title = 'Plays on the module now';
    row.append(el('span', 'eg-nn', slot.number), ...(live ? [live] : []), icon(slot.category, slot.icon, slot.id, slot.bank), name, pills, play);
    return row;
  }

  function renderBoard() {
    const target = $('.eg-board'); target.replaceChildren();
    const dense = state.view === 'both';
    const total = voiceTotal();
    const legend = el('div', 'eg-legend');
    legend.innerHTML = `<span class="eg-pill st on static">${SVG_STEREO}<span>Stereo</span></span><span>two output channels (the voice switches it on the module)</span><span class="eg-pill sy on static">${SVG_SYNC}<span>Sync In</span></span><span>restarts the timbre on the bar reset</span><span class="eg-pill static off">${SVG_SYNC}<span>Sync In</span></span><span>off<span class="eg-faint"> · hatched: the engine cannot</span></span>`;
    target.append(legend);
    for (const voice of shownVoices()) {
      const others = new Set(); for (let v = 0; v < total; ++v) if (v !== voice) for (const slot of model.slotsOf(v)) others.add(slotKey(slot));
      const section = el('section', `eg-voice ${dense ? 'dense' : 'comfy'}`); section.dataset.voice = String(voice);
      const head = el('header'); const preset = model.matchingPreset(voice);
      head.append(el('h4', '', `Voice ${voice + 1}`), el('span', 'eg-src', PRESET_LABEL[preset] ?? 'Custom set'));
      const liveIndex = liveIndexFor(voice);
      if (liveIndex !== null) head.append(el('span', 'eg-src eg-liveline', `on the module: ${liveName(model.slotsOf(voice)[liveIndex])}`));
      if (state.diff) head.append(el('span', 'eg-src', `only here: ${model.slotsOf(voice).filter((slot) => !others.has(slotKey(slot))).length}`));
      head.append(el('span', 'eg-sp'));
      for (const [kind, label] of [['stereo', 'Stereo: all'], ['sync', 'Sync In: all']]) {
        const bulk = button(label); bulk.dataset.bulk = kind; bulk.dataset.v = String(voice);
        bulk.title = `Turn ${label.split(':')[0]} on for every slot of this voice that supports it (or off when all are on)`;
        head.append(bulk);
      }
      const banks = el('div', 'eg-banks');
      for (const bank of bankCardsView(model, voice, liveIndex)) {
        const column = el('div', `eg-bank bank-${bank.colour}`); column.append(el('h5', '', `Bank ${bank.name}`));
        for (const slot of bank.slots) column.append(slotRow(slot, voice, dense, others));
        banks.append(column);
      }
      section.append(head, banks); target.append(section);
    }
    renderStats();
  }

  function bulk(voice, kind) {
    const slots = model.slotsOf(voice); const field = kind === 'stereo' ? 'stereo' : 'sync';
    const capable = slots.map((slot, index) => [model.byId.get(slot.id)?.[field], slot, index]).filter(([can]) => can);
    const any = capable.some(([, slot]) => !slot[field]);
    for (const [, , index] of capable) (kind === 'stereo' ? model.setStereo : model.setSync).call(model, voice, index, any);
    changed();
  }

  function select(voice, index) { state.voice = voice; state.selected[voice] = index; if (state.view !== 'both') state.view = voice; renderSeg(); renderBoard(); renderDock(); assignActiveVoice(index); }

  function clearPlaying() { for (const node of root.querySelectorAll('.eg-play.on, .eg-insp-actions .primary.on')) { node.classList.remove('on'); node.textContent = node.dataset.label || '▶'; node.title = node.dataset.title || node.title; } }
  audition.onstop = clearPlaying;
  function markPlaying(selector) {
    clearPlaying();
    const node = root.querySelector(selector); if (!node) return;
    node.dataset.label = node.textContent; node.dataset.title = node.title;
    node.classList.add('on'); node.textContent = '■'; node.title = 'Stop';
  }
  const isPlaying = (node) => node.classList.contains('on');

  const board = $('.eg-board');
  board.addEventListener('click', (event) => {
    const bulkButton = event.target.closest('[data-bulk]');
    if (bulkButton) { bulk(Number(bulkButton.dataset.v), bulkButton.dataset.bulk); return; }
    const row = event.target.closest('.eg-slot'); if (!row) return;
    const voice = Number(row.dataset.v); const index = Number(row.dataset.i); const slot = model.slotsOf(voice)[index];
    const control = event.target.closest('button');
    if (control?.dataset.act === 'play') { if (isPlaying(control)) { audition.stop(); return; } preview(slot.id, slot.stereo); markPlaying(`.eg-slot[data-v="${voice}"][data-i="${index}"] .eg-play`); return; }
    if (control?.dataset.act === 'dx7') { if (event.shiftKey) { model.setBank(voice, index, (slot.bank + 1) % BANK_LETTERS.length); changed(); } else onEditBanks(BANK_LETTERS[slot.bank]); return; }
    if (control?.dataset.act === 'stereo') { if (!control.disabled) { model.setStereo(voice, index, !slot.stereo); changed(); } return; }
    if (control?.dataset.act === 'sync') { if (!control.disabled) { model.setSync(voice, index, !slot.sync); changed(); } return; }
    select(voice, index);
  });
  board.addEventListener('keydown', (event) => {
    if ((event.key !== 'Enter' && event.key !== ' ') || !event.target.classList?.contains('eg-slot')) return;
    event.preventDefault(); select(Number(event.target.dataset.v), Number(event.target.dataset.i));
  });
  board.addEventListener('dragstart', (event) => {
    const row = event.target.closest?.('.eg-slot'); if (!row) return;
    state.drag = { type: 'slot', voice: Number(row.dataset.v), index: Number(row.dataset.i) };
    try { event.dataTransfer.setData('text/x-pentavox-slot', row.dataset.i); event.dataTransfer.effectAllowed = 'move'; } catch { /* some browsers */ }
  });
  board.addEventListener('dragover', (event) => {
    const row = event.target.closest?.('.eg-slot'); if (!row || !state.drag) return;
    if (state.drag.type === 'slot' && state.drag.voice !== Number(row.dataset.v)) return;   // slots swap inside one voice only
    event.preventDefault();
    for (const node of board.querySelectorAll('.eg-slot.drop-target')) if (node !== row) node.classList.remove('drop-target');
    row.classList.add('drop-target');
  });
  board.addEventListener('drop', (event) => {
    const row = event.target.closest?.('.eg-slot'); const drag = state.drag; if (!row || !drag) return;
    const voice = Number(row.dataset.v); const index = Number(row.dataset.i);
    if (drag.type === 'slot' && drag.voice !== voice) return;
    event.preventDefault(); state.drag = null;
    try { if (drag.type === 'engine') model.place(voice, index, drag.id, drag.bank === undefined ? {} : { bank: drag.bank }); else model.swap(voice, drag.index, index); } catch (error) { onError(error); }
    state.voice = voice; state.selected[voice] = index; changed();
  });
  root.addEventListener('dragend', () => { state.drag = null; for (const node of root.querySelectorAll('.drop-target')) node.classList.remove('drop-target'); });

  function placeInSelected(item) {
    try { model.place(state.voice, state.selected[state.voice], item.id, item.bank === undefined ? {} : { bank: item.bank }); } catch (error) { onError(error); return; }
    changed();
  }

  // ---- the dock: library and selected slot ----
  const tabs = $('.eg-tabs');
  const tabBrowse = button('', 'eg-tab'); tabBrowse.setAttribute('role', 'tab'); const tabSlot = button('Selected slot', 'eg-tab'); tabSlot.setAttribute('role', 'tab');
  tabBrowse.addEventListener('click', () => { state.tab = 'browse'; renderDock(); });
  tabSlot.addEventListener('click', () => { state.tab = 'slot'; renderDock(); });
  tabs.append(tabBrowse, tabSlot);

  const tools = $('.eg-tools');
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search name, family, description'; search.setAttribute('aria-label', 'Search engines');
  search.addEventListener('input', () => { state.search = search.value; renderLibrary(); });
  const cats = el('div', 'eg-chips'); const flags = el('div', 'eg-chips eg-flags');
  const allChip = button('All', 'eg-fchip');
  allChip.addEventListener('click', () => { state.category = ''; state.stereo = state.sync = state.absent = false; renderLibrary(); });
  cats.append(allChip);
  const present = categoriesView(catalog.engines);
  const catOrder = [...Object.keys(CATEGORY_HUE).filter((name) => present.includes(name)), ...present.filter((name) => !(name in CATEGORY_HUE))];
  for (const value of catOrder) {
    const chip = button('', 'eg-fchip'); chip.dataset.cat = value; chip.append(el('i', 'eg-dot'), document.createTextNode(value));
    chip.firstChild.style.setProperty('--h', String(CATEGORY_HUE[value] ?? 0));
    chip.addEventListener('click', () => { state.category = state.category === value ? '' : value; renderLibrary(); });
    cats.append(chip);
  }
  const hint = el('span', 'eg-hint'); hint.append(svg(SVG_STEREO, 'cap'), document.createTextNode('Stereo '), svg(SVG_SYNC, 'cap sy'), document.createTextNode('Sync In'));
  flags.append(hint);
  for (const [key, label] of [['stereo', 'Stereo only'], ['sync', 'Sync In only'], ['absent', 'Not in the kit']]) {
    const chip = button(label, 'eg-fchip'); chip.dataset.filter = key;
    chip.addEventListener('click', () => { state[key] = !state[key]; renderLibrary(); });
    flags.append(chip);
  }
  tools.append(search, cats, flags);
  const list = $('.eg-list');

  function usedIn(key) { return Array.from({ length: voiceTotal() }, (_, v) => model.slotsOf(v).some((slot) => slotKey(slot) === key)); }

  function renderDock() {
    tabBrowse.setAttribute('aria-selected', String(state.tab === 'browse')); tabSlot.setAttribute('aria-selected', String(state.tab === 'slot'));
    tools.hidden = state.tab !== 'browse';
    if (state.tab === 'browse') renderLibrary(); else renderInspector();
  }

  function renderLibrary() {
    if (state.tab !== 'browse') return;
    const rows = libraryRowsView(entries, model.slotsOf(state.voice), state);
    tabBrowse.textContent = `Library · ${rows.length === entries.length ? entries.length : `${rows.length} / ${entries.length}`}`;
    for (const chip of flags.querySelectorAll('[data-filter]')) { chip.classList.toggle('on', state[chip.dataset.filter]); chip.setAttribute('aria-pressed', String(state[chip.dataset.filter])); }
    for (const chip of cats.querySelectorAll('[data-cat]')) { chip.classList.toggle('on', state.category === chip.dataset.cat); chip.setAttribute('aria-pressed', String(state.category === chip.dataset.cat)); }
    allChip.classList.toggle('on', !state.category && !state.stereo && !state.sync && !state.absent);
    const top = list.scrollTop; list.replaceChildren();
    if (!rows.length) list.append(el('p', 'eg-empty', 'Nothing found. Clear the filters.'));
    for (const item of rows) {
      const open = state.expanded === item.key;
      const wrapper = el('article', `eg-lib${item.inSet ? ' in-set' : ''}${open ? ' expanded' : ''}`);
      wrapper.draggable = true; wrapper.dataset.id = item.key;
      const row = el('div', 'eg-lib-row'); row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-expanded', String(open)); row.setAttribute('aria-label', `${item.name}: show details`);
      const copy = el('span', 'eg-lib-copy'); copy.append(el('b', '', item.name), el('small', '', `${item.category} · ${item.sizeLabel}`));
      const caps = el('span', 'eg-caps');
      if (item.dx7Bank) caps.append(el('span', 'eg-cap-text', `DX7 ${item.dx7Bank}`));
      if (item.stereo) { const cap = svg(SVG_STEREO, 'cap'); cap.title = 'Stereo'; caps.append(cap); }
      if (item.sync) { const cap = svg(SVG_SYNC, 'cap sy'); cap.title = 'Sync In'; caps.append(cap); }
      const use = el('span', 'eg-use'); use.title = 'Already in voices';
      usedIn(item.key).forEach((yes, v) => use.append(el('i', yes ? 'y' : '', String(v + 1))));
      const play = button('▶', 'eg-play'); play.dataset.act = 'play'; play.title = 'Audition'; play.setAttribute('aria-label', `Audition ${item.name}`);
      const add = button('+', 'eg-add'); add.dataset.act = 'add'; add.title = `Put into Voice ${state.voice + 1}, slot ${state.selected[state.voice] + 1}`; add.setAttribute('aria-label', `Put ${item.name} into the selected slot`);
      row.append(icon(item.category, item.icon, item.id, item.bank), copy, caps, use, play, add);
      const toggle = () => { state.expanded = open ? null : item.key; renderLibrary(); };
      row.addEventListener('click', (event) => {
        const control = event.target.closest('button');
        if (control?.dataset.act === 'play') { if (isPlaying(control)) { audition.stop(); return; } preview(item.id, false); markPlaying(`.eg-lib[data-id="${CSS.escape(item.key)}"] .eg-play`); return; }
        if (control?.dataset.act === 'add') { placeInSelected(item); return; }
        toggle();
      });
      row.addEventListener('keydown', (event) => { if (event.target === row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); toggle(); } });
      wrapper.append(row);
      if (open) wrapper.append(engineDetails(item));
      wrapper.addEventListener('dragstart', (event) => { state.drag = { type: 'engine', id: item.id, bank: item.bank }; try { event.dataTransfer.setData('text/x-pentavox-engine', item.id); if (item.bank !== undefined) event.dataTransfer.setData('text/x-pentavox-bank', String(item.bank)); event.dataTransfer.effectAllowed = 'copy'; } catch { /* some browsers */ } });
      wrapper.addEventListener('mouseenter', () => { state.hover = item; renderMeter(); });
      wrapper.addEventListener('mouseleave', () => { state.hover = null; renderMeter(); });
      list.append(wrapper);
    }
    list.scrollTop = top;
  }

  // description, what the four knobs do, outputs, source files: shared by the library rows and the slot inspector
  function engineDetails(item) {
    const details = el('div', 'eg-more-info');
    details.append(el('p', 'eg-facts', `${item.category} · ${item.sizeLabel} · Stereo: ${item.stereo ? 'yes' : item.monoInPractice ? 'no (nearly mono)' : 'no'} · Sync In: ${item.sync ? 'yes' : 'no'}`));
    const info = help[item.id];
    if (info) {
      if (info.description) details.append(el('p', 'engine-summary', info.description));
      const knobs = el('dl', 'eg-knobs');
      [['harmonics', 'Harmonics'], ['timbre', 'Timbre'], ['morph', 'Morph'], ['macro', 'Twist']].forEach(([key, name], i) => {
        if (!info.controls?.[key]) return;
        const row = el('div'); row.append(el('dt', '', name), el('dd', '', `${info.labels?.[i] ? info.labels[i] + ': ' : ''}${info.controls[key]}`)); knobs.append(row);
      });
      (info.outputs || []).forEach((text, i) => { const row = el('div'); row.append(el('dt', '', i === 0 ? 'OUT' : 'AUX'), el('dd', '', text)); knobs.append(row); });
      if (info.trigger) { const row = el('div'); row.append(el('dt', '', 'TRIG'), el('dd', '', info.trigger)); knobs.append(row); }
      if (knobs.children.length) details.append(knobs);
    }
    if (item.sources?.length) details.append(el('p', 'source-files', item.sources.join('\n')));
    return details;
  }

  function renderInspector() {
    list.replaceChildren();
    const voice = state.voice; const index = state.selected[voice];
    const slot = bankCardsView(model, voice, liveIndexFor(voice)).flatMap((bank) => bank.slots)[index];
    const panel = el('div', 'eg-insp');
    const head = el('div', 'eg-insp-head'); const copy = el('div');
    copy.append(el('h4', '', slot.name), el('div', 'eg-sub', `Voice ${voice + 1} · Bank ${BANK_NAMES[Math.floor(index / 8)]} · slot ${index % 8 + 1}`), el('div', 'eg-sub', slot.category + (slot.live ? ' · plays on the module now' : '')));
    head.append(icon(slot.category, slot.icon, slot.id, slot.bank), copy);
    const row = el('div', 'eg-insp-actions');
    const play = button('▶ Audition', 'primary'); play.addEventListener('click', () => { if (play.classList.contains('on')) { audition.stop(); return; } preview(slot.id, slot.stereoEnabled); clearPlaying(); play.dataset.label = '▶ Audition'; play.classList.add('on'); play.textContent = '■ Stop'; });
    const replace = button('Replace from library'); replace.addEventListener('click', () => { state.tab = 'browse'; renderDock(); search.focus(); });
    const find = button('Find in kit'); find.title = 'Outline the same engine in the voices';
    find.addEventListener('click', () => { state.hl = slotKey(model.slotsOf(voice)[index]); renderBoard(); setTimeout(() => { state.hl = null; renderBoard(); }, 2600); });
    row.append(play, replace, find);
    panel.append(head, row);
    const info = help[slot.id];
    panel.append(el('p', 'eg-desc', info?.description || 'No description yet'));
    const details = engineDetails(slot); details.querySelector('.eg-facts')?.remove(); details.querySelector('.engine-summary')?.remove();
    if (details.children.length) { panel.append(el('div', 'eg-sub2', 'What the knobs do'), details); }
    const control = (kind, title, markup, can, on, text) => {
      const box = el('div', 'eg-ctl'); const label = el('b'); label.innerHTML = markup + title;
      const toggle = button('', `eg-sw${kind === 'sync' ? ' ok' : ''}`); toggle.setAttribute('role', 'switch'); toggle.setAttribute('aria-checked', String(on)); toggle.setAttribute('aria-label', title); toggle.disabled = !can;
      toggle.addEventListener('click', () => { (kind === 'stereo' ? model.setStereo : model.setSync).call(model, voice, index, !on); changed(); });
      box.append(label, toggle, el('small', '', text)); return box;
    };
    panel.append(
      control('stereo', 'Stereo', SVG_STEREO, slot.stereo, slot.stereoEnabled, slot.stereo ? 'The engine renders left and right differently. Chosen at build; on the module each voice then switches Stereo itself.' : slot.monoInPractice ? 'Left and right stay nearly identical on this engine.' : 'This engine is mono: both channels are the same.'),
      control('sync', 'Sync In', SVG_SYNC, slot.sync, slot.syncEnabled, slot.sync ? 'Lets the oscillator be hard-synced to the module’s bar reset, so the timbre restarts on the beat. Costs code once for the whole kit.' : 'This engine has no sync input.'),
    );
    const usage = usedIn(slotKey(model.slotsOf(voice)[index]));
    const facts = el('dl', 'eg-dl');
    for (const [name, value] of [['Code', slot.sizeLabel], ['In voices', usage.map((yes, v) => (yes ? String(v + 1) : '–')).join(' ')], ['Class', slot.id]]) facts.append(el('dt', '', name), el('dd', '', value));
    panel.append(facts);
    if (slot.dx7Bank) {
      const dx7 = el('div', 'eg-insp-actions'); const edit = button(`Edit DX7 bank ${slot.dx7Bank}`); const next = button('Next bank');
      edit.addEventListener('click', () => onEditBanks(slot.dx7Bank));
      next.addEventListener('click', () => { model.setBank(voice, index, (slot.bank + 1) % BANK_LETTERS.length); changed(); });
      dx7.append(edit, next); panel.append(dx7);
    }
    list.append(panel);
  }

  // A compact module has two Plaits voices; its AXI budget is not the one the estimate was calibrated on.
  function isCompact() { try { return isCompactModule(getVoiceTable()); } catch { return true; } }

  // What replacing the selected slot with the hovered library engine would do to the union code size.
  function ghostBytes() {
    const item = state.hover; if (!item) return 0;
    const ids = new Set();
    model.voices.forEach((slots, v) => slots.forEach((slot, i) => ids.add(v === state.voice && i === state.selected[v] ? item.id : slot.id)));
    return model.bytesOfIds(ids) - model.estimatedBytes();
  }

  let lastView = null;
  function renderMeter() {
    const summary = model.summary(); const view = lastView ?? memoryView(summary, { compact: isCompact() });
    const box = $('.eg-meter'); const status = $('.eg-status');
    const track = $('.eg-track'); const fill = track.querySelector('i'); const ghostBar = track.querySelector('u');
    const ghost = ghostBytes(); const pct = view.percent; const ghostPct = Math.min(100, Math.abs(ghost) / summary.budgetBytes * 100);
    fill.style.width = `${pct}%`; ghostBar.style.left = `${ghost >= 0 ? pct : Math.max(0, pct - ghostPct)}%`; ghostBar.style.width = `${ghostPct}%`; ghostBar.classList.toggle('less', ghost < 0);
    track.setAttribute('aria-valuenow', String(pct));
    status.classList.toggle('over-budget', view.red);
    const text = box.querySelector('.memory-text'); text.replaceChildren();
    const used = el('b', '', `${kb(summary.unionBytes)} KB`);
    text.append('code ≈ ', used, ` of ${kb(summary.budgetBytes)} KB · ${view.marginLabel} · classes: `, el('b', '', String(summary.unionClasses)));
    if (ghost) text.append(' · ', el('b', `eg-ghost${ghost < 0 ? ' less' : ''}`, `${ghost > 0 ? '+' : '−'}${kb(Math.abs(ghost))} KB`), ' if replaced');
    box.title = [view.classesLabel, view.hint].filter(Boolean).join('\n');
  }

  function renderSummary() {
    const summary = model.summary(); lastView = memoryView(summary, { compact: isCompact() });
    renderMeter(); updateActions(lastView);
    renderSuggestions(lastView.red);
  }

  function renderSuggestions(red) {
    const panel = root.querySelector('.suggest-panel');
    suggestButton.hidden = !red;
    if (!red) state.suggest = false;
    panel.hidden = !state.suggest;
    if (panel.hidden) return;
    panel.replaceChildren(el('strong', '', 'The heaviest engines in the set and lighter replacements from the same category (nothing is replaced automatically)'));
    const rows = model.suggestReplacements();
    if (!rows.length) panel.append(el('p', '', 'No suitable replacements in the library.'));
    for (const row of rows) {
      const line = el('div', 'suggest-row');
      line.append(el('span', 'suggest-engine', `${row.name} · ${(row.costBytes / 1024).toFixed(1)} KB · voice ${row.voices.join(', ')}`));
      if (!row.alternatives.length) line.append(el('small', '', 'nothing lighter in the category'));
      for (const alt of row.alternatives) {
        const swap = button(`${alt.name} −${(alt.savedBytes / 1024).toFixed(1)} KB`, 'pill-button suggest-swap');
        swap.title = `Replace ${row.name} with ${alt.name} in every voice that uses it`;
        swap.addEventListener('click', () => { model.replaceEngine(row.id, alt.id); changed(); });
        line.append(swap);
      }
      panel.append(line);
    }
  }

  const build = button('1 · Build', 'primary build-toggle'); const flash = button('2 · Flash'); const dfu = button('Reboot to DFU', 'quiet'); dfu.title = 'Put the module into its bootloader'; const copyLog = button('Copy log', 'pill-button'); const suggestButton = button('Suggest replacements', 'pill-button'); suggestButton.hidden = true;
  flash.disabled = true;
  suggestButton.addEventListener('click', () => { state.suggest = !state.suggest; renderSuggestions(model.summary().overBudget); });
  const progress = el('div', 'build-progress'); progress.hidden = true;
  const progressText = el('span', 'build-stage'); const progressBar = el('span', 'build-bar'); progressBar.append(el('i'));
  progress.append(progressText, progressBar);
  copyLog.hidden = true;
  let fullLog = '';
  let cloudResult = null;   // the image of the last cloud build (hosted page without a local build server): flashed over WebUSB
  copyLog.addEventListener('click', async () => { try { await navigator.clipboard.writeText(fullLog); copyLog.textContent = 'Saved'; setTimeout(() => { copyLog.textContent = 'Copy log'; }, 2000); } catch (error) { onError(error); } });
  actions.append(build, el('span', 'eg-arrow', '→'), flash, dfu, copyLog, suggestButton);
  $('.eg-meter').append(progress);
  // Demo mode (a simulated module): nothing may be built or flashed, so the three buttons stay off with an explanation.
  const DEMO_HINT = 'Not available in demo mode: there is no real module';
  const inDemo = () => globalThis.document?.body?.classList.contains('demo-mode');
  function applyDemoLock() { if (!inDemo()) return; for (const control of [build, flash, dfu]) { control.disabled = true; control.title = DEMO_HINT; } }
  let operation = null;
  let operationVersion = 0;
  function updateActions(view = memoryView(model.summary(), { compact: isCompact() })) {
    const action = buildButtonView({ phase: state.phase, cancelling: operation?.cancelRequested || state.cancelPending, ...view });
    build.textContent = `1 · ${action.label}`; build.disabled = action.disabled; build.title = action.title;
    applyDemoLock();
  }
  globalThis.addEventListener?.('pentavox-demo', () => { flash.disabled = state.busy || !state.hasImage; dfu.disabled = false; flash.title = dfu.title = ''; updateActions(); });
  function renderBuild(status) {
    fullLog = [status.stage, status.margins, ...(status.log ?? [])].filter(Boolean).join('\n');
    copyLog.hidden = !fullLog;
    const failed = status.state === 'error' || status.state === 'failed';
    const busy = ['building', 'cancelling', 'flashing'].includes(status.state);
    progress.hidden = !(busy || failed || (state.touched && status.stage));
    progress.classList.toggle('failed', failed); progress.classList.toggle('busy', busy);
    progressText.textContent = status.stage ?? status.state ?? '';
    state.phase = status.state; state.busy = busy; state.hasImage = !!status.image;
    state.buildId = status.build_id ?? null;
    if (operation?.route === 'local' && operation.id && status.build_id && operation.id !== status.build_id)
      operation = null; // another browser has started a different local build
    if (!busy) operation = null;
    flash.disabled = busy || !status.image; flash.classList.toggle('primary', !flash.disabled); build.classList.toggle('primary', flash.disabled); updateActions();
    if (!busy && state.polling) { clearInterval(state.polling); state.polling = null; }
  }
  async function poll() {
    // A stale local status must not overwrite a cloud build or its route probe.
    if (operation && (operation.route !== 'local' || !operation.started)) return;
    const expectedOperation = operation; const expectedVersion = operationVersion;
    try {
      const response = await apiFetch('/api/status', { cache: 'no-store' });
      if (!response.ok) return;
      const status = await response.json();
      if (operation !== expectedOperation || operationVersion !== expectedVersion) return;
      if (operation && (operation.route !== 'local' || !operation.started)) return;
      renderBuild(status);
    } catch { /* composer server is optional */ }
  }
  function startPolling() { state.touched = true; if (!state.polling) state.polling = setInterval(poll, 1500); poll(); }
  async function cancelLocal(op) {
    if (op?.cancelInFlight || state.cancelPending) return;
    if (op) op.cancelInFlight = true;
    state.cancelPending = true; updateActions();
    const buildId = op?.id ?? state.buildId;
    try {
      const response = await apiFetch('/api/cancel', { method: 'POST', body: JSON.stringify({ build_id: buildId }) });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || `Cancel failed (${response.status})`);
      startPolling();
    } catch (error) {
      if (op) { op.cancelRequested = false; op.cancelInFlight = false; }
      onError(error);
    } finally { state.cancelPending = false; updateActions(); }
  }
  build.addEventListener('click', async () => {
    if (state.phase === 'building') {
      if (operation?.cancelRequested) return;
      if (operation) {
        operation.cancelRequested = true; operation.controller.abort(); updateActions();
        progressText.textContent = 'cancelling the build';
        if (operation.route === 'local' && operation.started) await cancelLocal(operation);
      } else await cancelLocal(null);  // a local build recovered after a reload
      return;
    }
    if (state.busy || state.cancelPending || inDemo()) return;
    if (!isCompact() && !model.canBuild()) { onError(new Error('The set does not fit in AXI: replace heavy engines first')); return; }
    const op = { controller: new AbortController(), route: 'starting', started: false, cancelRequested: false };
    operationVersion += 1;
    operation = op; cloudResult = null; state.touched = true;
    const recipe = model.recipe(); const compact = isCompact();
    renderBuild({ state: 'building', stage: 'starting the build' });
    try {
      const cloud = !servedLocally() && !(await localServerUp(apiFetch));
      if (op.cancelRequested) { renderBuild({ state: 'cancelled', stage: 'build cancelled' }); return; }
      if (cloud) {
        op.route = 'cloud';
        const result = await runCloudBuild({ recipe, compact, onStatus: renderBuild, signal: op.controller.signal });
        if (result) cloudResult = result;
        return;
      }
      op.route = 'local';
      const response = await apiFetch('/api/build', { method: 'POST', body: JSON.stringify(recipe) });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || `Build failed (${response.status})`);
      op.id = result.build_id;
      op.started = true;
      if (op.cancelRequested) await cancelLocal(op);
      startPolling();
    } catch (error) {
      renderBuild({ state: 'failed', stage: 'build failed', log: [String(error.message ?? error)] });
      onError(error);
    }
  });
  flash.addEventListener('click', async () => {
    if (cloudResult) {
      const about = cloudResult.meta ? `${describeBuild(cloudResult.meta, model.recipe())}\n\n` : '';
      if (!(await confirmDialog(about + flashWarning(), 'Flash'))) return;
      try { await runWebFlash({ image: cloudResult.image, onStatus: renderBuild, onFlashState: (flashState) => globalThis.dispatchEvent?.(new CustomEvent('pentavox-flash', { detail: flashState })) }); } catch (error) { onError(error); }
      return;
    }
    if (!confirm(flashWarning())) return;
    try { const response = await apiFetch('/api/flash', { method: 'POST', body: '{}' }); const result = await response.json(); if (result.error) throw new Error(result.error); startPolling(); } catch (error) { onError(error); }
  });
  dfu.addEventListener('click', async () => { try { const client = getClient(); if (!client) throw new Error('Connect the module first'); if (activeLinkJob()) throw new Error(linkBusyMessage()); await client.reboot(1); startPolling(); } catch (error) { onError(error); } });
  poll();
  // A hosted page with no build server: the last cloud build is already published, so Flash is ready without building again.
  if (!servedLocally()) {
    localServerUp(apiFetch).then(async (up) => {
      if (up || cloudResult || state.busy || state.touched) return;
      const latest = await loadLatestCloudBuild();
      if (!latest || cloudResult || state.busy || state.touched) return;
      cloudResult = latest; state.touched = true;
      renderBuild({ state: 'built', image: 'cloud', stage: `last cloud build: ${(latest.meta.commit ?? '').slice(0, 7)} · ${(latest.image.byteLength / 1024).toFixed(0)} KB, ready to flash`, margins: latest.meta.margins ?? '', log: [] });
    });
  }

  function changed() { persist(); renderSeg(); renderNotes(); renderBoard(); renderDock(); renderSummary(); }
  changed();
  return { waves: waveEditor, refreshLive() { renderSeg(); renderNotes(); renderBoard(); renderDock(); renderSummary(); }, dispose() { waveEditor.destroy(); if (state.polling) clearInterval(state.polling); root.replaceChildren(); } };
}
