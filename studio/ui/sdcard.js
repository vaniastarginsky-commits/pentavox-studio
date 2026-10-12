import { SdFilesClient, describeFsError, joinPath, parentPath, sanitizeFileName, validatePath } from '../model/sd_files.js';
import { createStoreZip } from '../model/zip.js';
import { samplerFolders, breadcrumbs, cardSummary, entryRow, formatSize, sortEntries } from './sdcard_vm.js';

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function button(text, className = '') { const node = el('button', className, text); node.type = 'button'; return node; }
function save(bytes, name, type = 'application/octet-stream') { const url = URL.createObjectURL(new Blob([bytes], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export function mountSdCard(root, { onError = (error) => console.error(error), onSuccess = () => {}, getClient = () => null, getInfo = () => null, getSampleSlotCount = () => 4 } = {}) {
  const state = { path: '/', entries: [], card: null, loading: false, problem: '', transfer: null, renaming: null, confirming: null, generation: 0 };
  const files = () => { const client = getClient(); const info = getInfo(); return client && info ? new SdFilesClient(client, info) : null; };

  const heading = el('div', 'sampler-heading'); const copy = el('div');
  copy.append(el('h1', '', 'SD card'), el('p', '', 'Browse the module’s card, send sample banks to it and take files back, without taking the card out. Uploads are written safely: a file only appears under its final name once it is complete and verified.'));
  const refresh = button('Refresh', 'primary'); heading.append(copy, refresh);
  const status = el('p', 'sdc-status'); const crumbs = el('nav', 'sdc-crumbs'); crumbs.setAttribute('aria-label', 'Folder');
  const toolbar = el('div', 'sdc-toolbar'); const table = el('div', 'sdc-table'); const transferBar = el('div', 'sdc-transfer');
  root.replaceChildren(heading, status, crumbs, toolbar, transferBar, table);

  const picker = document.createElement('input'); picker.type = 'file'; picker.multiple = true; picker.hidden = true;
  picker.addEventListener('change', () => { uploadFiles([...picker.files]); picker.value = ''; });
  table.addEventListener('dragover', (event) => { event.preventDefault(); table.classList.add('dragging'); });
  table.addEventListener('dragleave', () => table.classList.remove('dragging'));
  table.addEventListener('drop', (event) => { event.preventDefault(); table.classList.remove('dragging'); uploadFiles([...event.dataTransfer.files]); });

  async function load(path = state.path) {
    const client = files(); const generation = ++state.generation;
    state.path = path; state.renaming = null; state.confirming = null;
    if (!client) { state.card = null; state.entries = []; state.problem = 'Connect the module (top right) to browse its card.'; render(); return; }
    state.loading = true; state.problem = ''; render();
    try {
      const card = await client.cardInfo();
      const entries = await client.list(path);
      if (generation !== state.generation) return;
      state.card = card; state.entries = sortEntries(entries).map(entryRow);
    } catch (error) {
      if (generation !== state.generation) return;
      state.card = null; state.entries = []; state.problem = describeFsError(error);
      if (path !== '/' && error?.status === 12) { state.path = parentPath(path); state.loading = false; return load(state.path); }
    }
    state.loading = false; render();
  }

  async function runTransfer(label, task) {
    const controller = new AbortController(); state.transfer = { label, progress: 0, controller }; render();
    try { await task(controller.signal, (progress) => { if (state.transfer?.controller === controller) { state.transfer.progress = progress; renderTransfer(); } }); return true; }
    catch (error) { if (error?.name !== 'AbortError') onError(new Error(describeFsError(error), { cause: error })); return false; }
    finally { if (state.transfer?.controller === controller) state.transfer = null; }
  }

  async function uploadFiles(list) {
    const client = files(); if (!client || !list.length || state.transfer) return;
    const taken = new Set(state.entries.map((entry) => entry.name.toLowerCase())); let sent = 0;
    for (const file of list) {
      const name = sanitizeFileName(file.name);
      const overwrite = taken.has(name.toLowerCase());
      if (overwrite && !window.confirm(`${name} already exists on the card. Replace it?`)) continue;
      const path = joinPath(state.path, name); const problem = validatePath(path);
      if (problem) { onError(new Error(`${file.name}: ${problem}`)); continue; }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ok = await runTransfer(`Sending ${name}`, (signal, progress) => client.upload(path, bytes, { overwrite, signal, onProgress: progress }));
      if (!ok) break;
      sent += 1; taken.add(name.toLowerCase());
    }
    if (sent) onSuccess(`${sent} file${sent === 1 ? '' : 's'} written to ${state.path}`);
    await load();
  }

  async function downloadFile(entry) {
    const client = files(); if (!client || state.transfer) return;
    let bytes;
    const ok = await runTransfer(`Reading ${entry.name}`, async (signal, progress) => { bytes = await client.download(entry.path, { signal, onProgress: progress }); });
    if (ok) save(bytes, entry.name);
  }

  async function collect(client, path, prefix, out, signal, tick) {
    for (const entry of await client.list(path)) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (entry.directory) await collect(client, entry.path, `${prefix}${entry.name}/`, out, signal, tick);
      else if (!/\.part(meta)?$/i.test(entry.name)) { out.push({ name: `${prefix}${entry.name}`, data: await client.download(entry.path, { signal }) }); tick(out.length); }
    }
  }

  async function downloadFolder(entry) {
    const client = files(); if (!client || state.transfer) return;
    let archive;
    const ok = await runTransfer(`Reading ${entry.name}/`, async (signal, progress) => {
      const collected = []; await collect(client, entry.path, '', collected, signal, (count) => progress(Math.min(0.95, count / (count + 4))));
      if (!collected.length) throw new Error('That folder has no files to download');
      archive = createStoreZip(collected);
    });
    if (ok) save(archive, `${entry.name}.zip`, 'application/zip');
  }

  async function act(label, task) {
    const client = files(); if (!client) return;
    try { await task(client); } catch (error) { onError(new Error(describeFsError(error), { cause: error })); }
    await load();
  }

  const removeEntry = (entry) => act('delete', (client) => (entry.directory ? client.removeTree(entry.path) : client.remove(entry.path)));
  const renameEntry = (entry, name) => act('rename', (client) => client.rename(entry.path, joinPath(state.path, sanitizeFileName(name))));
  const makeFolder = (name) => act('mkdir', (client) => client.makeDirectory(joinPath(state.path, sanitizeFileName(name))));

  // ---------------------------------------------------------------- rendering
  function renderTransfer() {
    transferBar.replaceChildren(); transferBar.hidden = !state.transfer; if (!state.transfer) return;
    const meter = document.createElement('progress'); meter.max = 1; meter.value = state.transfer.progress;
    const cancel = button('Cancel', 'quiet-button'); cancel.addEventListener('click', () => state.transfer?.controller.abort());
    transferBar.append(el('span', '', `${state.transfer.label} · ${Math.round(state.transfer.progress * 100)}%`), meter, cancel);
  }

  function render() {
    refresh.disabled = state.loading || Boolean(state.transfer);
    status.textContent = state.loading ? 'Reading the card…' : state.problem || (state.card ? cardSummary(state.card) : '');
    status.classList.toggle('error', Boolean(state.problem));
    crumbs.replaceChildren(); const trail = breadcrumbs(state.path);
    trail.forEach((crumb, index) => {
      if (index === trail.length - 1) { crumbs.append(el('strong', '', crumb.name)); return; }
      const link = button(crumb.name, 'sdc-crumb'); link.addEventListener('click', () => load(crumb.path)); crumbs.append(link, el('span', 'sdc-sep', '/'));
    });
    const connected = Boolean(state.card); const busy = Boolean(state.transfer) || state.loading;
    toolbar.replaceChildren();
    const upload = button('Upload files…', 'primary'); upload.disabled = !connected || busy; upload.addEventListener('click', () => picker.click());
    const folder = el('form', 'sdc-newfolder'); const name = document.createElement('input'); name.placeholder = 'New folder name'; name.setAttribute('aria-label', 'New folder name'); name.maxLength = 64;
    const create = button('Create', 'quiet-button'); create.type = 'submit'; create.disabled = !connected || busy;
    folder.addEventListener('submit', (event) => { event.preventDefault(); if (name.value.trim()) makeFolder(name.value.trim()); }); folder.append(name, create);
    toolbar.append(upload, picker, folder);
    const quick = el('div', 'sdc-quick'); quick.append(el('span', '', 'Sampler folders:'));
    samplerFolders(getSampleSlotCount()).forEach((path, index) => { const go = button(`SLOT${index}`, 'quiet-button'); go.disabled = !connected || busy; go.addEventListener('click', () => load(path)); quick.append(go); });
    toolbar.append(quick);
    renderTransfer();

    table.replaceChildren();
    if (state.path !== '/') { const up = el('div', 'sdc-row sdc-up'); const link = button('↑ Up', 'quiet-button'); link.addEventListener('click', () => load(parentPath(state.path))); up.append(link); table.append(up); }
    for (const entry of state.entries) table.append(renderRow(entry, busy));
    if (connected && !state.entries.length && !state.loading) table.append(el('div', 'sdc-empty', 'This folder is empty. Drop files here or use Upload.'));
  }

  function renderRow(entry, busy) {
    const row = el('div', `sdc-row${entry.directory ? ' sdc-dir' : ''}${entry.stagedLeftover ? ' sdc-leftover' : ''}`);
    const nameCell = el('div', 'sdc-name');
    if (state.renaming === entry.path) {
      const form = el('form', 'sdc-rename'); const input = document.createElement('input'); input.value = entry.name; input.maxLength = 64; input.setAttribute('aria-label', `New name for ${entry.name}`);
      const ok = button('Rename', 'quiet-button'); ok.type = 'submit'; const cancel = button('Cancel', 'quiet-button'); cancel.addEventListener('click', () => { state.renaming = null; render(); });
      form.addEventListener('submit', (event) => { event.preventDefault(); const next = input.value.trim(); state.renaming = null; if (next && next !== entry.name) renameEntry(entry, next); else render(); });
      form.append(input, ok, cancel); nameCell.append(form); queueMicrotask(() => { input.focus(); input.select(); });
    } else if (entry.directory) {
      const open = button(`📁 ${entry.name}`, 'sdc-open'); open.addEventListener('click', () => load(entry.path)); nameCell.append(open);
    } else nameCell.append(el('span', '', entry.name));
    if (entry.locked) nameCell.append(el('em', 'sdc-tag', 'in use'));
    if (entry.stagedLeftover) nameCell.append(el('em', 'sdc-tag', 'unfinished upload'));
    const meta = el('div', 'sdc-meta', [entry.sizeText, entry.dateText].filter(Boolean).join(' · '));
    const actions = el('div', 'sdc-actions');
    const download = button(entry.directory ? 'Download .zip' : 'Download', 'quiet-button'); download.disabled = busy; download.addEventListener('click', () => (entry.directory ? downloadFolder(entry) : downloadFile(entry)));
    const rename = button('Rename', 'quiet-button'); rename.disabled = busy || !entry.canModify; rename.addEventListener('click', () => { state.renaming = entry.path; render(); });
    const remove = button(state.confirming === entry.path ? (entry.directory ? 'Really delete folder?' : 'Really delete?') : 'Delete', `quiet-button${state.confirming === entry.path ? ' danger' : ''}`); remove.disabled = busy || !entry.canModify;
    remove.addEventListener('click', () => { if (state.confirming === entry.path) { state.confirming = null; removeEntry(entry); } else { state.confirming = entry.path; render(); } });
    actions.append(download, rename, remove); row.append(nameCell, meta, actions); return row;
  }

  refresh.addEventListener('click', () => load());
  render();
  const dispose = () => { state.transfer?.controller.abort(); root.replaceChildren(); };
  dispose.show = () => { if (!state.card && !state.loading) load('/'); };
  dispose.refreshConnection = () => { state.card = null; state.path = '/'; load('/'); };
  return dispose;
}
