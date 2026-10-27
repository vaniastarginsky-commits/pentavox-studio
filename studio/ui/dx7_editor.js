// DX7 bank editor: a sheet over the Engines page. Library on the left (3,500 Palette patches + imports),
// the six six-op banks on the right. Reads and writes /DX7/BANK_A..F.SYX on the module's SD card.
import { DX7Audition } from '../audition_dx7.js';
import { BANK_LETTERS, BANK_SIZE, DX7Banks } from '../model/dx7_banks.js';
import { buildCatalog, CATEGORIES, checkShape, patchFrom, SOUND_TAGS } from '../model/dx7_catalog.js';
import { readBanksFromSd, writeBanksToSd } from '../model/dx7_sd.js';
import { DX7Store } from '../model/dx7_store.js';
import { SdFilesClient, describeFsError } from '../model/sd_files.js';
import { b64ToBytes, bytesToB64, parseSyx, voiceKey } from '../model/dx7_syx.js';
import { EditorState } from './dx7_editor_vm.js';

const DATA = './data/dx7/';
const PITCHES = [['C2', 36], ['C3', 48], ['C4', 60]];
const SORTS = [['name', 'Name (A–Z)'], ['nameDesc', 'Name (Z–A)'], ['category', 'Category'], ['algorithm', 'Algorithm'], ['source', 'Cartridge order']];
const MISSING_CATALOG = 'The full Palette catalog is unavailable. Factory and community banks remain available. Run python3 tools/dx7_composer/fetch_palette_library.py to add the full Palette catalog (about 3,500 patches).';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className = '', title = '') {
  const node = el('button', className, text);
  node.type = 'button';
  if (title) node.title = title;
  return node;
}
async function fetchJson(name) {
  try { const response = await fetch(DATA + name); return response.ok ? await response.json() : null; } catch { return null; }
}
async function fetchFactory() {
  try { const response = await fetch('./assets/dx7_factory.bin'); return response.ok ? new Uint8Array(await response.arrayBuffer()) : null; } catch { return null; }
}
function download(name, bytes) {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 2000);
}
const sameBytes = (a, b) => a.length === b.length && a.every((byte, i) => byte === b[i]);

export function dx7EmptyMessage({ libraryCount, filteredCount }) {
  if (!libraryCount) return 'No patches are available. Import a .syx file to start a library.';
  return filteredCount ? '' : 'No patches match these filters. Clear the search or choose another category.';
}

export function mountDx7Editor({ getClient = () => null, getInfo = () => null, onError = () => {}, onSuccess = () => {} } = {}) {
  const dialog = el('dialog', 'dx7-dialog');
  dialog.setAttribute('aria-label', 'DX7 banks');
  document.body.append(dialog);

  const audition = new DX7Audition();
  const store = new DX7Store();
  const imports = [];                  // { name, b64 } of every imported file, kept in the browser
  const ui = { state: null, notice: '', pitch: 48, busy: false, timer: null, importCounter: 0, loaded: false, loadError: '' };
  let loading = null;
  let patchById = new Map();

  const files = () => { const client = getClient(); const info = getInfo(); return client && info ? new SdFilesClient(client, info) : null; };

  // ---- loading -------------------------------------------------------------------------------------
  function ensureLoaded() {
    if (ui.loaded) return Promise.resolve();
    if (loading) return loading;
    loading = loadCatalog().then(() => { ui.loaded = true; }).catch((error) => { ui.state = null; throw error; }).finally(() => { loading = null; });
    return loading;
  }
  async function loadCatalog() {
    const [sample, rom, stock, factory, saved, community] = await Promise.all([
      fetchJson('dx7-catalog-sample.json'), fetchJson('dx7-rom-catalog.json'), fetchJson('dx7-stock-banks.json'), fetchFactory(), store.loadImports(),
      fetchJson('dx7-community-banks.json'),
    ]);
    const problem = checkShape(sample, rom, stock);
    const usable = !problem;
    ui.notice = problem ?? (sample || rom ? '' : MISSING_CATALOG);
    const catalog = buildCatalog({ sample: usable ? sample ?? [] : [], rom: usable ? rom : null, stock: usable ? stock : null, factory, community: community ?? [] });
    ui.state = new EditorState(catalog, new DX7Banks());
    for (const entry of saved) { imports.push(entry); importPatches(entry.name, b64ToBytes(entry.b64), false); }
    const draft = await store.loadDraft();
    if (draft) {
      const byKey = new Map(ui.state.catalog.patches.map((p) => [voiceKey(p.voice), p]));
      for (const letter of BANK_LETTERS) ui.state.banks.load(letter, (draft[letter] ?? []).map((b64) => { const voice = b64ToBytes(b64); return byKey.get(b64) ?? patchFrom({ id: `draft-${letter}-${b64.slice(0, 8)}`, src: 'Draft' }, voice); }));
    }
    indexPatches();
  }
  function indexPatches() { patchById = new Map(ui.state.catalog.patches.map((p) => [p.id, p])); }
  function importPatches(name, bytes, fresh = true) {
    const { voices, notes } = parseSyx(bytes);
    const patches = voices.map((voice) => { ui.importCounter += 1; return patchFrom({ id: `imp-${ui.importCounter}`, src: name }, voice); });
    const added = ui.state.addPatches(patches);
    if (fresh) { indexPatches(); if (voices.length) { imports.push({ name, b64: bytesToB64(bytes) }); store.saveImports(imports); } }
    return { found: voices.length, added, notes };
  }
  function saveDraft() {
    const draft = {};
    for (const letter of BANK_LETTERS) draft[letter] = ui.state.banks.banks[letter].map((p) => voiceKey(p.voice));
    store.saveDraft(draft);
  }

  // ---- audition ------------------------------------------------------------------------------------
  async function play(patch) {
    if (!patch) return;
    try { await audition.start(); } catch (error) { onError(error); return; }
    audition.load([patch.voice]);
    audition.noteOn(ui.pitch, 0.8, 0);
    clearTimeout(ui.timer);
    ui.timer = setTimeout(() => audition.noteOff(), 1100);
  }

  // ---- frame ---------------------------------------------------------------------------------------
  const header = el('header', 'dx7-head');
  const titleBlock = el('div', 'dx7-title');
  titleBlock.append(el('h2', '', 'DX7 banks'), el('p', 'dx7-sub', 'Choose patches from the library, arrange a bank, then write it to the module’s SD card.'));
  const sdStatus = el('span', 'dx7-sd-status');
  const readButton = button('Read from SD', 'dx7-ghost', 'Load the six banks currently on the card');
  const writeButton = button('Write to SD', 'primary', 'Write the banks to /DX7/BANK_A.SYX to BANK_F.SYX');
  const closeButton = button('Close', 'dx7-close');
  const headActions = el('div', 'dx7-head-actions'); headActions.append(sdStatus, readButton, writeButton, closeButton);
  header.append(titleBlock, headActions);

  const notice = el('p', 'dx7-notice');
  notice.setAttribute('role', 'status');
  const loadingState = el('section', 'workflow-dx7-loading'); loadingState.setAttribute('role', 'status');
  const loadingText = el('p', '', 'Loading the patch library…');
  const retry = button('Retry loading', 'dx7-ghost'); retry.hidden = true; retry.addEventListener('click', () => open(ui.state?.activeBank ?? 'A'));
  loadingState.append(loadingText, retry);
  const library = el('section', 'dx7-library');
  const banksColumn = el('aside', 'dx7-banks');
  const body = el('div', 'dx7-body'); body.append(library, banksColumn);
  dialog.append(header, notice, loadingState, body); body.hidden = true;

  // library parts
  const search = el('input', 'dx7-search'); search.type = 'search'; search.placeholder = 'Search patch names…'; search.setAttribute('aria-label', 'Search patch names');
  const picker = el('input'); picker.type = 'file'; picker.multiple = true; picker.accept = '.syx,.sys,.bin'; picker.hidden = true;
  const importButton = button('Import .syx', 'dx7-ghost', 'Add voices from .syx files (or drop them here)');
  const toolbar = el('div', 'dx7-toolbar'); toolbar.append(search, importButton, picker);
  const soundChips = el('div', 'dx7-chips'); soundChips.setAttribute('aria-label', 'Sound');
  const categoryChips = el('div', 'dx7-chips'); categoryChips.setAttribute('aria-label', 'Category');
  const meta = el('div', 'dx7-meta');
  const rangeLabel = el('span', 'dx7-range');
  const pitchSelect = el('select', 'dx7-select'); pitchSelect.setAttribute('aria-label', 'Audition pitch');
  for (const [label, note] of PITCHES) { const option = el('option', '', label); option.value = String(note); pitchSelect.append(option); }
  pitchSelect.value = '48';
  const sortSelect = el('select', 'dx7-select'); sortSelect.setAttribute('aria-label', 'Sort');
  for (const [key, label] of SORTS) { const option = el('option', '', label); option.value = key; sortSelect.append(option); }
  const sortBox = el('div', 'dx7-meta-tools'); sortBox.append(el('span', '', 'Pitch'), pitchSelect, el('span', '', 'Sort'), sortSelect);
  meta.append(rangeLabel, sortBox);
  const hint = el('p', 'dx7-hint', 'Click the list, then ↑ ↓ to audition, Enter to add, Space to replay.');
  const table = el('div', 'dx7-table'); table.tabIndex = 0; table.setAttribute('role', 'listbox'); table.setAttribute('aria-label', 'Patches');
  const pager = el('div', 'dx7-pager');
  library.append(el('h3', 'workflow-editor-heading', 'Library'), toolbar, soundChips, categoryChips, meta, hint, table, pager);

  // ---- rendering: library ---------------------------------------------------------------------------
  function renderChips() {
    const { state } = ui;
    soundChips.replaceChildren(...SOUND_TAGS.map(({ id, label }) => {
      const chip = button(label, `dx7-chip${state.tags.has(id) ? ' on' : ''}`); chip.setAttribute('aria-pressed', String(state.tags.has(id)));
      chip.addEventListener('click', () => { state.toggleTag(id); renderLibrary(); });
      return chip;
    }));
    const all = button('All categories', `dx7-chip${state.category === null ? ' on' : ''}`);
    all.addEventListener('click', () => { state.setCategory(null); renderLibrary(); });
    categoryChips.replaceChildren(all, ...CATEGORIES.map((name) => {
      const chip = button(name, `dx7-chip${state.category === name ? ' on' : ''}`);
      chip.addEventListener('click', () => { state.setCategory(state.category === name ? null : name); renderLibrary(); });
      return chip;
    }));
  }

  function renderTable() {
    const { state } = ui; const view = state.view;
    rangeLabel.textContent = view.rangeLabel;
    const rows = view.rows.map((patch, index) => {
      const row = el('div', `dx7-row${index === state.cursor ? ' cursor' : ''}`); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(index === state.cursor));
      row.draggable = true; row.dataset.index = String(index);
      const inBank = state.banks.has(state.activeBank, patch);
      const playButton = button('▶', 'dx7-play', 'Audition'); playButton.dataset.act = 'play';
      const tags = patch.tags.filter((tag) => SOUND_TAGS.some((t) => t.id === tag)).map((tag) => SOUND_TAGS.find((t) => t.id === tag).label).join(' · ');
      const addButton = button(inBank ? '✓' : '+', 'dx7-add', inBank ? 'Already in this bank' : `Add to bank ${state.activeBank}`); addButton.dataset.act = 'add'; addButton.disabled = inBank;
      row.append(playButton, el('span', 'dx7-name', patch.name), el('span', 'dx7-cat', patch.cat), el('span', 'dx7-tags', ''), addButton);
      if (patch.romLabel) row.querySelector('.dx7-tags').append(el('span', 'dx7-badge', `${patch.romLabel} · ${patch.slot}`), tags);
      else row.querySelector('.dx7-tags').append(tags);
      return row;
    });
    table.replaceChildren(...rows);
    if (!rows.length) {
      const empty = el('div', 'dx7-empty'); empty.append(el('p', '', dx7EmptyMessage({ libraryCount: state.catalog.patches.length, filteredCount: view.total })));
      if (state.catalog.patches.length) { const reset = button('Clear filters', 'dx7-ghost'); reset.addEventListener('click', () => { state.setQuery(''); search.value = ''; state.tags.clear(); state.setCategory(null); renderLibrary(); }); empty.append(reset); }
      table.append(empty);
    }
    pager.replaceChildren();
    if (view.pages > 1) {
      const prev = button('‹ Prev', 'dx7-ghost'); prev.disabled = view.page === 0;
      const next = button('Next ›', 'dx7-ghost'); next.disabled = view.page >= view.pages - 1;
      prev.addEventListener('click', () => { state.setPage(view.page - 1); renderTable(); table.scrollTop = 0; });
      next.addEventListener('click', () => { state.setPage(view.page + 1); renderTable(); table.scrollTop = 0; });
      pager.append(prev, el('span', 'dx7-page', `Page ${view.page + 1} of ${view.pages}`), next);
    }
  }
  function keepCursorVisible() { table.querySelector('.dx7-row.cursor')?.scrollIntoView({ block: 'nearest' }); }
  function renderLibrary() { renderChips(); renderTable(); }

  // ---- rendering: banks ------------------------------------------------------------------------------
  const tabs = el('div', 'dx7-tabs'); tabs.setAttribute('role', 'tablist');
  const startFrom = el('select', 'dx7-select dx7-start'); startFrom.setAttribute('aria-label', 'Start from a bank or cartridge');
  const slots = el('ol', 'dx7-slots');
  const bankActions = el('div', 'dx7-bank-actions');
  const clearButton = button('Clear bank', 'dx7-ghost');
  const downloadButton = button('Download .syx', 'dx7-ghost', 'Save this bank as a .syx file');
  bankActions.append(clearButton, downloadButton);
  const bankHeading = el('div', 'workflow-bank-heading'); const bankTitle = el('h3', 'workflow-editor-heading');
  bankHeading.append(bankTitle, el('p', '', 'Edits stay in Studio until you write to SD. A six-op engine uses the bank named on its chip.'));
  banksColumn.append(bankHeading, tabs, el('label', 'dx7-start-label', 'Start from'), startFrom, slots, bankActions);

  function renderStartFrom() {
    startFrom.replaceChildren();
    const first = el('option', '', 'a bank or cartridge…'); first.value = ''; startFrom.append(first);
    for (const group of ui.state.groups) {
      const optgroup = el('optgroup'); optgroup.label = group.label;
      for (const item of group.items) { const option = el('option', '', item.label); option.value = item.id; optgroup.append(option); }
      startFrom.append(optgroup);
    }
  }

  function renderTabs() {
    const { state } = ui;
    tabs.replaceChildren(...BANK_LETTERS.map((letter) => {
      const count = state.banks.count(letter);
      const tab = button('', `dx7-tab${letter === state.activeBank ? ' active' : ''}`); tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(letter === state.activeBank));
      tab.dataset.bank = letter;
      const meter = el('span', 'dx7-meter'); meter.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < BANK_SIZE; i += 1) meter.append(el('i', i < count ? 'on' : ''));
      tab.append(el('span', 'dx7-tab-letter', letter), el('span', 'dx7-tab-count', state.counterLabel(letter)), meter);
      tab.addEventListener('click', () => { state.setActiveBank(letter); renderBanks(); renderTable(); });
      tab.addEventListener('dragover', (event) => { event.preventDefault(); tab.classList.add('drop'); });
      tab.addEventListener('dragleave', () => tab.classList.remove('drop'));
      tab.addEventListener('drop', (event) => { event.preventDefault(); tab.classList.remove('drop'); dropOn(letter, state.banks.count(letter), event); });
      return tab;
    }));
  }

  function renderSlots() {
    const { state } = ui; const letter = state.activeBank; const list = state.banks.banks[letter];
    slots.replaceChildren(...Array.from({ length: BANK_SIZE }, (_, i) => {
      const patch = list[i];
      const item = el('li', `dx7-slot${patch ? '' : ' empty'}`); item.dataset.index = String(i);
      item.append(el('span', 'dx7-slot-n', String(i + 1).padStart(2, '0')));
      if (patch) {
        item.draggable = true;
        const playButton = button('▶', 'dx7-play', 'Audition'); playButton.addEventListener('click', () => play(patch));
        const remove = button('×', 'dx7-remove', 'Remove from bank'); remove.addEventListener('click', () => { state.banks.remove(letter, i); changed(); });
        item.append(playButton, el('span', 'dx7-name', patch.name), remove);
        item.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/x-dx7-slot', `${letter}:${i}`));
      } else item.append(el('span', 'dx7-slot-empty', 'empty'));
      item.addEventListener('dragover', (event) => { event.preventDefault(); item.classList.add('drop'); });
      item.addEventListener('dragleave', () => item.classList.remove('drop'));
      item.addEventListener('drop', (event) => { event.preventDefault(); item.classList.remove('drop'); dropOn(letter, i, event); });
      return item;
    }));
    clearButton.disabled = !list.length; downloadButton.disabled = !list.length;
  }
  function renderBanks() { bankTitle.textContent = `Selected bank ${ui.state.activeBank}`; renderTabs(); renderSlots(); }
  function changed() { renderBanks(); renderTable(); saveDraft(); }

  function dropOn(letter, index, event) {
    const { state } = ui;
    const slot = event.dataTransfer.getData('text/x-dx7-slot');
    const patchId = event.dataTransfer.getData('text/x-dx7-patch');
    if (slot) { const [from, at] = slot.split(':'); state.banks.move(from, Number(at), letter, index); changed(); return; }
    const patch = patchById.get(patchId);
    if (patch && state.banks.add(letter, patch)) { state.banks.move(letter, state.banks.count(letter) - 1, letter, index); changed(); }
  }

  // ---- header state and SD ---------------------------------------------------------------------------
  function renderHeader() {
    const connected = Boolean(files());
    sdStatus.textContent = connected ? 'Module connected' : 'Module not connected';
    sdStatus.dataset.state = connected ? 'on' : 'off';
    readButton.disabled = !connected || ui.busy || !ui.loaded; writeButton.disabled = !connected || ui.busy || !ui.loaded;
    readButton.textContent = ui.busy && ui.operation === 'read' ? 'Reading banks…' : 'Read from SD';
    writeButton.textContent = ui.busy && ui.operation === 'write' ? 'Writing banks…' : 'Write to SD';
    writeButton.title = connected ? 'Write the banks to /DX7/BANK_A.SYX to BANK_F.SYX' : 'Connect the module to write to its SD card. Download .syx works without it.';
    notice.textContent = ui.notice; notice.hidden = !ui.notice;
  }

  async function readFromSd() {
    const client = files(); if (!client) return;
    const { state } = ui;
    if (BANK_LETTERS.some((letter) => state.banks.count(letter)) && !confirm('Replace the banks in the editor with the ones on the card?')) return;
    ui.busy = true; ui.operation = 'read'; renderHeader();
    try {
      const loaded = DX7Banks.fromFiles(await readBanksFromSd(client));
      const byKey = new Map(state.catalog.patches.map((p) => [voiceKey(p.voice), p]));
      for (const letter of BANK_LETTERS) state.banks.load(letter, loaded.banks[letter].map((p) => byKey.get(voiceKey(p.voice)) ?? p));
      changed(); onSuccess('Banks read from the SD card.');
    } catch (error) { onError(new Error(describeFsError(error))); } finally { ui.busy = false; renderHeader(); }
  }

  async function writeToSd() {
    const client = files(); if (!client) return;
    const bytes = ui.state.banks.toFiles();
    const letters = BANK_LETTERS.filter((letter) => bytes[letter]);
    if (!letters.length) { onError(new Error('All six banks are empty. Add patches first.')); return; }
    ui.busy = true; ui.operation = 'write'; renderHeader();
    try {
      let existing = null;
      try { existing = await readBanksFromSd(client); } catch { /* unreadable: ask anyway */ }
      const replaced = letters.filter((letter) => existing?.[letter] && !sameBytes(existing[letter], bytes[letter]));
      if (replaced.length && !confirm(`This replaces ${replaced.map((l) => `BANK_${l}.SYX`).join(', ')} on the card. Continue?`)) return;
      const { written } = await writeBanksToSd(client, bytes);
      try { await client.rescanLibraries(); } catch { /* older firmware: the banks load at the next start */ }
      onSuccess(`Banks ${written.join(', ')} written to the SD card and reloaded by the module.`);
    } catch (error) { onError(new Error(error?.status !== undefined ? describeFsError(error) : error.message)); } finally { ui.busy = false; renderHeader(); }
  }

  // ---- events ----------------------------------------------------------------------------------------
  search.addEventListener('input', () => { ui.state.setQuery(search.value); renderTable(); });
  sortSelect.addEventListener('change', () => { ui.state.setSort(sortSelect.value); renderTable(); });
  pitchSelect.addEventListener('change', () => { ui.pitch = Number(pitchSelect.value); });
  startFrom.addEventListener('change', () => {
    const id = startFrom.value; startFrom.value = '';
    if (!id) return;
    const { state } = ui;
    if (state.banks.count(state.activeBank) && !confirm(`Replace bank ${state.activeBank} with this set?`)) return;
    state.startFrom(id); changed();
  });
  clearButton.addEventListener('click', () => { const { state } = ui; if (confirm(`Clear bank ${state.activeBank}?`)) { state.banks.clear(state.activeBank); changed(); } });
  downloadButton.addEventListener('click', () => { const letter = ui.state.activeBank; const bytes = ui.state.banks.toFiles()[letter]; if (bytes) download(`PENTAVOX_BANK_${letter}.SYX`, bytes); });
  readButton.addEventListener('click', readFromSd);
  writeButton.addEventListener('click', writeToSd);
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { clearTimeout(ui.timer); audition.noteOff(); });

  async function importFiles(list) {
    const messages = [];
    for (const file of list) {
      const result = importPatches(file.name, new Uint8Array(await file.arrayBuffer()));
      messages.push(result.found ? `${file.name}: ${result.found} voices, ${result.added} new` : `${file.name}: no DX7 voices found`);
    }
    renderLibrary(); renderStartFrom();
    if (messages.length) onSuccess(messages.join('. '));
  }
  importButton.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => { importFiles([...picker.files]); picker.value = ''; });
  library.addEventListener('dragover', (event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); library.classList.add('dragging'); } });
  library.addEventListener('dragleave', (event) => { if (!library.contains(event.relatedTarget)) library.classList.remove('dragging'); });
  library.addEventListener('drop', (event) => { if (event.dataTransfer.files.length) { event.preventDefault(); library.classList.remove('dragging'); importFiles([...event.dataTransfer.files]); } });

  table.addEventListener('click', (event) => {
    const row = event.target.closest('.dx7-row'); if (!row) return;
    const { state } = ui; state.cursor = Number(row.dataset.index); const patch = state.cursorPatch;
    if (event.target.closest('[data-act="add"]')) { if (state.addCursor()) changed(); return; }
    renderTable(); table.focus({ preventScroll: true }); play(patch);
  });
  table.addEventListener('dragstart', (event) => {
    const row = event.target.closest('.dx7-row'); if (!row) return;
    event.dataTransfer.setData('text/x-dx7-patch', ui.state.view.rows[Number(row.dataset.index)].id);
  });
  table.addEventListener('keydown', (event) => {
    const { state } = ui;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); state.moveCursor(event.key === 'ArrowDown' ? 1 : -1); renderTable(); keepCursorVisible(); play(state.cursorPatch);
    } else if (event.key === 'Enter') { event.preventDefault(); if (state.addCursor()) changed(); }
    else if (event.key === ' ') { event.preventDefault(); play(state.cursorPatch); }
    else if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault(); state.setPage(state.view.page + (event.key === 'PageDown' ? 1 : -1)); renderTable(); table.scrollTop = 0;
    }
  });

  let openRequest = 0;
  async function open(letter = 'A') {
    const request = ++openRequest;
    if (!dialog.open) dialog.showModal();
    loadingState.hidden = ui.loaded; body.hidden = !ui.loaded; retry.hidden = true;
    loadingText.textContent = 'Loading the patch library…'; loadingState.setAttribute('role', 'status'); dialog.setAttribute('aria-busy', String(!ui.loaded));
    renderHeader();
    try { await ensureLoaded(); } catch (error) {
      ui.loadError = error?.message ?? String(error); loadingText.textContent = `The patch library could not be loaded. ${ui.loadError}`;
      retry.hidden = false; loadingState.setAttribute('role', 'alert'); dialog.setAttribute('aria-busy', 'false'); onError(error); return;
    }
    if (!dialog.open || request !== openRequest) return;
    loadingState.hidden = true; body.hidden = false; dialog.setAttribute('aria-busy', 'false');
    ui.state.setActiveBank(BANK_LETTERS.includes(letter) ? letter : 'A');
    renderStartFrom(); renderLibrary(); renderBanks(); renderHeader();
    table.focus({ preventScroll: true });
  }

  return { open, dialog, close: () => dialog.close(), refresh: renderHeader };
}
