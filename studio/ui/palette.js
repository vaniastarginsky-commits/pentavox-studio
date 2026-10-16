import { setDifferences, adoptModuleSet } from '../model/module_set.js';
import { BANK_LETTERS, PaletteModel, libraryEntries } from '../model/palette.js';
import { EngineAudition } from '../audition.js';
import { bankCardsView, buildButtonView, categoriesView, isCompactModule, libraryRowsView, memoryView, voiceTabCount } from './palette_vm.js';
import { lcdLabel, lcdSvg } from './lcd.js';
import { lastBackupInfo } from '../model/preset_backup.js';
import { apiFetch, servedLocally } from '../site.js';
import { describeBuild, loadLatestCloudBuild, localServerUp, runCloudBuild, runWebFlash } from '../build_flow.js';
import { mountWaveResourcesEditor } from './wave_resources_editor.js';

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
function icon(category, glyph, id) {
  const art = id ? HELP[id] : null;
  if (art?.icon) {
    const img = document.createElement('img');
    img.className = 'engine-icon'; img.src = `./assets/engine-icons/${art.icon}`; img.alt = ''; img.loading = 'lazy';
    img.title = category;
    return img;
  }
  const node = el('span', 'lcd-tile');
  node.innerHTML = lcdSvg(lcdLabel(art?.name || glyph || ''));
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

export function mountPalette(root, { catalog, sets, measured, help = {}, getVoiceTable = () => null, isDemo = () => false, getController = () => null, getClient = () => null, onEditBanks = () => {}, onError = () => {} }) {
  HELP = help;
  const model = new PaletteModel(catalog, sets, measured);
  const waveEditor = mountWaveResourcesEditor({ getResources: () => model.resources, onChange: (resources) => { model.setResources(resources); changed(); }, model, catalog, onError });
  try { const saved = JSON.parse(localStorage.getItem('pentavox.palette.recipe')); if (saved) model.importRecipe(migrateStockBankOrder(saved)); } catch { /* invalid local state falls back to stock */ }
  const audition = new EngineAudition(catalog.engines);
  const entries = libraryEntries(catalog);
  const state = { selected: [0, 0, 0], search: '', category: '', stereo: false, sync: false, absent: false, expanded: null, polling: null, voice: 0, busy: false, suggest: false, allVoices: false };

  root.innerHTML = `
    <div class="voice-header"></div>
    <div class="palette-workspace"><div class="palette-banks"></div><aside class="model-library"><div class="library-tools"></div><div class="library-list"></div><div class="library-foot"><span class="library-count"></span></div></aside></div>
    <div class="palette-build"><div class="build-summary"></div><details class="sets-menu"><summary>Sets &amp; recipe</summary><div class="palette-presets" aria-label="Preset sets"></div></details><div class="suggest-panel" hidden></div></div>`;
  const actions = el('div', 'build-actions');
  const presets = root.querySelector('.palette-presets');
  for (const [key, label] of [['stock', 'Plaits 1.2'], ['braids1', 'Braids 1'], ['braids2', 'Braids 2'], ['set1', 'Set 1'], ['set2', 'Set 2'], ['set3', 'Set 3']]) {
    const item = button(label, 'pill-button');
    item.addEventListener('click', () => { model.loadPreset(key, state.allVoices ? null : state.voice); if (state.allVoices) state.selected = [0, 0, 0]; else state.selected[state.voice] = 0; changed(); });
    presets.append(item);
  }
  const exportButton = button('Download recipe.json', 'pill-button');
  exportButton.addEventListener('click', () => downloadRecipe(model.recipe()));
  const importLabel = el('label', 'pill-button file-button', 'Import recipe.json');
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.json'; file.hidden = true;
  file.addEventListener('change', async () => { if (!file.files[0]) return; try { model.importRecipe(JSON.parse(await file.files[0].text())); changed(); } catch (error) { onError(error); } finally { file.value = ''; } });
  importLabel.append(file); presets.append(exportButton, importLabel);
  const everyVoice = el('label', 'preset-all'); const everyBox = document.createElement('input'); everyBox.type = 'checkbox';
  everyBox.addEventListener('change', () => { state.allVoices = everyBox.checked; });
  everyVoice.append(everyBox, el('span', '', 'apply a set to all voices')); presets.append(everyVoice);

  function persist() { try { localStorage.setItem('pentavox.palette.recipe', JSON.stringify(model.recipe())); } catch { /* optional */ } }
  function description(id) { return help[id]?.description || 'No description yet'; }
  function preview(id, stereo) { audition.preview(id, stereo).catch(onError); }

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
    keep.addEventListener('click', () => { dismissedSignature = signature; renderVoiceHeader(); });
    box.append(adopt, keep);
    return box;
  }

  function renderVoiceHeader() {
    const root_ = root.querySelector('.voice-header'); root_.replaceChildren();
    const tabs = el('div', 'voice-tabs'); tabs.setAttribute('role', 'tablist');
    const table = getVoiceTable();
    const voiceTotal = voiceTabCount(table);   // compact (two Plaits voices) unless the module reports three
    if (state.voice >= voiceTotal) state.voice = 0;
    for (let v = 0; v < voiceTotal; ++v) {
      const tab = button('', `voice-tab${state.voice === v ? ' active' : ''}`); tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(state.voice === v));
      let engineName = '—';
      try { const slot = table?.get(v)?.engine; if (slot != null) engineName = liveName(model.slotsOf(v)[slot]); } catch { /* not connected */ }
      tab.append(el('span', 'voice-num', String(v + 1)), el('span', 'voice-name', `Voice ${v + 1}`), el('span', 'voice-engine', engineName));
      tab.addEventListener('click', () => { state.voice = v; renderVoiceHeader(); renderBanks(); renderLibrary(); }); tabs.append(tab);
    }
    const row = el('div', 'voice-row'); row.append(tabs, actions); root_.append(row);
    const mismatch = moduleSetMismatch(table);
    if (mismatch) root_.append(mismatch);
    const controller = getController();
    if (!controller) { root_.append(el('p', 'voice-hint', 'Connect the module: then clicking a slot assigns the engine to the selected voice.')); return; }
    const view = controller.view();
    if (view.readOnly) root_.append(el('div', 'banner warning', view.reason ?? 'Read only'));
  }

  async function assignActiveVoice(slotIndex) {
    const controller = getController();
    if (!controller || controller.view().readOnly) return;
    try { await controller.assignVoiceEngine(state.voice, slotIndex); } catch (error) { onError(error); }
  }

  function renderBanks() {
    const voice = state.voice;
    const target = root.querySelector('.palette-banks'); target.replaceChildren();
    for (const bank of bankCardsView(model, voice, liveIndexFor(voice))) {
      const card = el('section', `palette-bank bank-${bank.colour}`);
      for (const slot of bank.slots) {
        const row = el('div', `palette-slot${state.selected[voice] === slot.index ? ' selected' : ''}${slot.live ? ' mine' : ''}`);
        row.dataset.index = String(slot.index); row.draggable = true;
        const select = button('', 'slot-main'); select.setAttribute('aria-label', `Slot ${slot.globalNumber}: ${slot.name}`);
        const identity = el('span', 'slot-identity'); identity.append(el('span', 'slot-number', slot.number), icon(slot.category, slot.icon, slot.id));
        const copy = el('span', 'slot-copy'); const sub = el('span', 'slot-sub'); sub.append(el('small', '', slot.category === slot.family ? slot.category : `${slot.category} · ${slot.family}`)); copy.append(el('strong', '', slot.name), sub);
        const badges = el('span', 'voice-badges'); if (slot.live) badges.append(el('span', '', String(voice + 1)));
        select.append(identity, copy, badges); select.addEventListener('click', () => { state.selected[voice] = slot.index; renderBanks(); assignActiveVoice(slot.index); });
        const stereo = button('Stereo', `stereo-pill${slot.stereoEnabled ? ' on' : ''}`); stereo.setAttribute('aria-pressed', String(slot.stereoEnabled));
        stereo.disabled = !slot.stereo; stereo.title = slot.stereo ? 'Stereo (enabled at build)' : slot.monoInPractice ? 'Stereo: left and right stay nearly identical on this engine' : 'Stereo: not supported by this engine';
        stereo.addEventListener('click', () => { model.setStereo(voice, slot.index, !slot.stereoEnabled); changed(); });
        const sync = button('Sync In', `stereo-pill sync-pill${slot.syncEnabled ? ' on' : ''}`); sync.setAttribute('aria-pressed', String(slot.syncEnabled));
        sync.disabled = !slot.sync; sync.title = slot.sync ? 'Sync In (enabled at build)' : 'Sync In: not supported by this engine';
        sync.addEventListener('click', () => { model.setSync(voice, slot.index, !slot.syncEnabled); changed(); });
        const play = button('▶', 'preview-button'); play.title = 'Preview'; play.addEventListener('click', () => preview(slot.id, slot.stereoEnabled));
        row.append(select, el('span', `size-chip slot-size ${slot.sizeClass}`, slot.sizeLabel));
        if (slot.dx7Bank) { const chip = button(`DX7 ${slot.dx7Bank}`, 'dx7-chip'); chip.title = `SD /DX7/BANK_${slot.dx7Bank}.SYX; click to edit the DX7 banks, Shift-click for the next bank`; chip.addEventListener('click', (event) => { if (event.shiftKey) { model.setBank(voice, slot.index, (slot.bank + 1) % BANK_LETTERS.length); changed(); } else onEditBanks(slot.dx7Bank); }); sub.append(chip); }
        row.append(stereo, sync, play);
        row.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/x-pentavox-slot', String(slot.index)));
        row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('drop-target'); });
        row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
        row.addEventListener('drop', (event) => { event.preventDefault(); row.classList.remove('drop-target'); const engineId = event.dataTransfer.getData('text/x-pentavox-engine'); const bankText = event.dataTransfer.getData('text/x-pentavox-bank'); const from = event.dataTransfer.getData('text/x-pentavox-slot'); try { if (engineId) model.place(voice, slot.index, engineId, bankText === '' ? {} : { bank: Number(bankText) }); else if (from !== '') model.swap(voice, Number(from), slot.index); } catch (error) { onError(error); } state.selected[voice] = slot.index; changed(); });
        card.append(row);
      }
      target.append(card);
    }
  }

  function placeInSelected(item) {
    try { model.place(state.voice, state.selected[state.voice], item.id, item.bank === undefined ? {} : { bank: item.bank }); } catch (error) { onError(error); return; }
    changed();
  }

  const tools = root.querySelector('.library-tools');
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search'; search.setAttribute('aria-label', 'Search engines');
  search.addEventListener('input', () => { state.search = search.value; renderLibrary(); });
  const filters = el('div', 'filter-chips');
  const category = document.createElement('select'); category.setAttribute('aria-label', 'Category'); category.append(new Option('All categories', ''));
  for (const value of categoriesView(catalog.engines)) category.append(new Option(value, value));
  category.addEventListener('change', () => { state.category = category.value; renderLibrary(); });
  const all = button('All', 'filter-chip active'); all.addEventListener('click', () => { state.category = ''; state.stereo = state.sync = state.absent = false; category.value = ''; renderLibrary(); });
  function toggleFilter(key, label) { const item = button(label, 'filter-chip'); item.dataset.filter = key; item.addEventListener('click', () => { state[key] = !state[key]; renderLibrary(); }); return item; }
  filters.append(all, category, toggleFilter('stereo', 'stereo only'), toggleFilter('sync', 'Sync In only'), toggleFilter('absent', 'not in the set'));
  tools.append(filters); root.querySelector('.library-foot').prepend(search);

  function renderLibrary() {
    const rows = libraryRowsView(entries, model.slotsOf(state.voice), state);
    root.querySelector('.library-count').textContent = `${rows.length} / ${entries.length}`;
    for (const chip of filters.querySelectorAll('[data-filter]')) chip.classList.toggle('active', state[chip.dataset.filter]);
    all.classList.toggle('active', !state.category && !state.stereo && !state.sync && !state.absent);
    const list = root.querySelector('.library-list'); list.replaceChildren();
    for (const item of rows) {
      const wrapper = el('article', `library-item${item.inSet ? ' in-set' : ''}${state.expanded === item.key ? ' expanded' : ''}`);
      wrapper.draggable = true; wrapper.dataset.id = item.key;
      const row = el('div', 'library-row'); row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-label', `Put ${item.name} in the selected slot`);
      row.append(icon(item.category, item.icon, item.id));
      const copy = el('span', 'library-copy'); copy.append(el('strong', '', item.name), el('small', '', item.category)); row.append(copy);
      const tail = el('span', 'library-tail');
      tail.append(el('span', `size-chip ${item.sizeClass}`, item.sizeLabel));
      if (item.dx7Bank) tail.append(el('span', 'dx7-chip', `DX7 ${item.dx7Bank}`));
      if (item.stereo) tail.append(el('span', 'stereo-pill on', 'Stereo'));
      if (item.sync) tail.append(el('span', 'stereo-pill on', 'Sync In'));
      const play = button('▶', 'preview-button'); play.title = 'Preview'; play.setAttribute('aria-label', `Preview ${item.name}`);
      play.addEventListener('click', (event) => { event.stopPropagation(); preview(item.id, false); });
      play.addEventListener('keydown', (event) => event.stopPropagation());
      tail.append(play);
      const chevron = button(state.expanded === item.key ? '⌃' : '⌄', 'chevron'); chevron.setAttribute('aria-label', state.expanded === item.key ? 'Hide details' : 'Show details');
      chevron.addEventListener('click', (event) => { event.stopPropagation(); state.expanded = state.expanded === item.key ? null : item.key; renderLibrary(); });
      tail.append(chevron); row.append(tail);
      row.addEventListener('click', () => placeInSelected(item));
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); placeInSelected(item); } });
      const details = el('div', 'library-details');
      details.append(el('p', '', `${item.category} · ${item.sizeLabel} · Stereo: ${item.stereo ? 'yes' : item.monoInPractice ? 'no (nearly mono)' : 'no'} · Sync In: ${item.sync ? 'yes' : 'no'}`));
      const info = help[item.id];
      if (info) {
        if (info.description) details.append(el('p', 'engine-summary', info.description));
        const knobs = el('dl', 'knob-help');
        [['harmonics', 'Harmonics'], ['timbre', 'Timbre'], ['morph', 'Morph'], ['macro', 'Twist']].forEach(([key, name], i) => {
          if (!info.controls?.[key]) return;
          const row = el('div', 'knob-row'); row.append(el('dt', '', name), el('dd', '', `${info.labels?.[i] ? info.labels[i] + ': ' : ''}${info.controls[key]}`)); knobs.append(row);
        });
        (info.outputs || []).forEach((text, i) => { const row = el('div', 'knob-row'); row.append(el('dt', '', i === 0 ? 'OUT' : 'AUX'), el('dd', '', text)); knobs.append(row); });
        if (info.trigger) { const row = el('div', 'knob-row'); row.append(el('dt', '', 'TRIG'), el('dd', '', info.trigger)); knobs.append(row); }
        details.append(knobs);
      }
      const sources = el('p', 'source-files', item.sources.join('\n')); details.append(sources);
      const expand = button(state.expanded === item.key ? 'Collapse' : 'Details', 'quiet-button'); expand.addEventListener('click', () => { state.expanded = state.expanded === item.key ? null : item.key; renderLibrary(); });
      details.append(expand); wrapper.append(row, details);
      wrapper.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/x-pentavox-engine', item.id); if (item.bank !== undefined) event.dataTransfer.setData('text/x-pentavox-bank', String(item.bank)); });
      list.append(wrapper);
    }
  }

  // A compact module has two Plaits voices; its AXI budget is not the one the estimate was calibrated on.
  function isCompact() { try { return isCompactModule(getVoiceTable()); } catch { return true; } }

  function renderSummary() {
    const summary = model.summary(); const view = memoryView(summary, { compact: isCompact() });
    const box = root.querySelector('.build-summary'); box.classList.toggle('over-budget', view.red);
    box.innerHTML = '';
    const meter = el('span', 'memory-meter'); meter.setAttribute('role', 'meter'); meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100'); meter.setAttribute('aria-valuenow', String(view.percent));
    const fill = el('span', 'memory-fill'); fill.style.width = `${view.percent}%`; meter.append(fill);
    box.append(meter, el('span', 'memory-text', `${view.usedLabel} · ${view.marginLabel}`));
    box.title = [view.classesLabel, view.hint].filter(Boolean).join('\n');
    updateActions(view);
    renderSuggestions(view.red);
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

  const build = button('Build', 'solid build-toggle'); const flash = button('Flash', 'primary'); const dfu = button('Reboot to DFU'); const copyLog = button('Copy log', 'pill-button'); const suggestButton = button('Suggest replacements', 'pill-button'); suggestButton.hidden = true;
  flash.disabled = true;
  suggestButton.addEventListener('click', () => { state.suggest = !state.suggest; renderSuggestions(model.summary().overBudget); });
  const progress = el('div', 'build-progress'); progress.hidden = true;
  const progressText = el('span', 'build-stage'); const progressBar = el('span', 'build-bar'); progressBar.append(el('i'));
  progress.append(progressText, progressBar);
  copyLog.hidden = true;
  let fullLog = '';
  let cloudResult = null;   // the image of the last cloud build (hosted page without a local build server): flashed over WebUSB
  copyLog.addEventListener('click', async () => { try { await navigator.clipboard.writeText(fullLog); copyLog.textContent = 'Saved'; setTimeout(() => { copyLog.textContent = 'Copy log'; }, 2000); } catch (error) { onError(error); } });
  const dx7Button = button('DX7 banks', 'pill-button'); dx7Button.title = 'Compose the six Six-op FM banks and write them to the SD card';
  dx7Button.addEventListener('click', () => onEditBanks('A'));
  const wavesButton = button('Wave tables', 'pill-button');
  wavesButton.addEventListener('click', () => waveEditor.open('wavetables'));
  const terrainButton = button('Wave Terrain', 'pill-button');
  terrainButton.addEventListener('click', () => waveEditor.open('terrain'));
  actions.append(progress, build, flash, dfu, dx7Button, wavesButton, terrainButton, copyLog, suggestButton);
  // Demo mode (a simulated module): nothing may be built or flashed, so the three buttons stay off with an explanation.
  const DEMO_HINT = 'Not available in demo mode: there is no real module';
  const inDemo = () => globalThis.document?.body?.classList.contains('demo-mode');
  function applyDemoLock() { if (!inDemo()) return; for (const control of [build, flash, dfu]) { control.disabled = true; control.title = DEMO_HINT; } }
  let operation = null;
  let operationVersion = 0;
  function updateActions(view = memoryView(model.summary(), { compact: isCompact() })) {
    const action = buildButtonView({ phase: state.phase, cancelling: operation?.cancelRequested || state.cancelPending, ...view });
    build.textContent = action.label; build.disabled = action.disabled; build.title = action.title;
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
    flash.disabled = busy || !status.image; updateActions();
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
  dfu.addEventListener('click', async () => { try { const client = getClient(); if (!client) throw new Error('Connect the module first'); await client.reboot(1); startPolling(); } catch (error) { onError(error); } });
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

  // The library's bottom (with the search) must stay above the sticky build bar: size it to the space left.
  let fitFrame = 0;
  function fitLibrary() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      const lib = root.querySelector('.model-library'); const bar = root.querySelector('.palette-build');
      if (!lib || !bar) return;
      const space = bar.getBoundingClientRect().top - lib.getBoundingClientRect().top - 12;
      lib.style.maxHeight = `${Math.max(280, Math.floor(space))}px`;
    });
  }
  addEventListener('scroll', fitLibrary, { passive: true }); addEventListener('resize', fitLibrary);

  function changed() { persist(); renderVoiceHeader(); renderBanks(); renderLibrary(); renderSummary(); }
  changed(); fitLibrary(); new ResizeObserver(fitLibrary).observe(document.body);
  return { refreshLive() { renderVoiceHeader(); renderBanks(); renderSummary(); }, dispose() { waveEditor.destroy(); removeEventListener('scroll', fitLibrary); removeEventListener('resize', fitLibrary); if (state.polling) clearInterval(state.polling); root.replaceChildren(); } };
}
