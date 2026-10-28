import { exportBackup, importBackup, checkBackup } from '../model/preset_backup.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const NAMES_KEY = 'pentavox.studio.presetNames';
const observedLoads = new WeakMap();

/** Slot names live in this browser only (the module stores no names), keyed by the module's UID. */
export function loadPresetNames(uid, storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(`${NAMES_KEY}.${uid}`) ?? '{}') ?? {}; } catch { return {}; }
}

export function savePresetNames(uid, names, storage = globalThis.localStorage) {
  try { storage.setItem(`${NAMES_KEY}.${uid}`, JSON.stringify(names)); } catch { /* private window: names last until reload */ }
}

export function presetSlotList(info) {
  const count = Math.max(1, Math.min(16, Math.floor(Number(info?.slotCount)) || 0));
  return Array.from({ length: count }, (_, index) => ({ number: index + 1, autosave: index === (Number(info?.bootSlot) || 0) }));
}

function saveJson(object, fileName) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(object)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function mountPresets(root, controller, { onError = () => {}, onSuccess = () => {}, confirmAction = globalThis.confirm, storage = globalThis.localStorage, download = saveJson } = {}) {
  const info = controller.session.info;
  const uid = info?.mcuUid ?? 'unknown';
  const names = loadPresetNames(uid, storage);
  const slots = presetSlotList(info);
  let selected = slots.find((slot) => !slot.autosave)?.number ?? slots[0].number;
  let lastLoaded = observedLoads.get(controller.session) ?? null;   // Only loads observed here, never a claim about the module's active slot.
  let busy = false;
  const heading = element('div', 'page-bar');
  heading.append(element('p', 'page-hint', 'Choose a stored setup to load, or select a slot for the current setup.'));
  const state = element('p', 'preset-session-state'); state.setAttribute('role', 'status');
  const layout = element('div', 'preset-workspace');
  const list = element('div', 'preset-list'); list.setAttribute('aria-label', 'Stored setup slots');
  const detail = element('section', 'preset-detail'); detail.setAttribute('aria-label', 'Selected slot');
  layout.append(list, detail);
  const backup = element('details', 'preset-backup-section');
  backup.append(element('summary', '', 'Backup and restore'));
  const warning = element('p', 'preset-backup-warning', 'Export briefly loads each stored setup into the playing module, then restores the current setup. Mute your audio before exporting. Import overwrites matching slots; the autosave slot is skipped.');
  const backupBar = element('div', 'page-tools preset-backup');
  const exportButton = element('button', '', 'Export backup'); exportButton.type = 'button';
  const importButton = element('button', '', 'Import backup…'); importButton.type = 'button';
  const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'application/json,.json'; fileInput.hidden = true;
  const progress = element('span', 'midi-count', ''); progress.setAttribute('role', 'status');
  backupBar.append(exportButton, importButton, fileInput, progress);
  backup.append(warning, backupBar);
  const readOnly = () => Boolean(controller.session.readOnly || controller.view?.().readOnly);

  async function run(label, action, working = 'Working…') {
    if (busy || readOnly()) return;
    busy = true; render(); progress.textContent = working;
    try { await action(); onSuccess(label); } catch (error) { onError(error); }
    busy = false; render();
  }

  function loadSlot(number) {
    if (busy || readOnly()) return;
    if (controller.session.dirty && !confirmAction?.('Loading replaces the changes that are not saved on the module. Continue?')) return;
    run(`Loaded slot ${number}`, async () => { await controller.load(number); lastLoaded = number; observedLoads.set(controller.session, number); selected = number; }, `Loading slot ${number}…`);
  }

  function row(slot) {
    const item = element('div', `preset-row${slot.autosave ? ' autosave' : ''}${slot.number === selected ? ' selected' : ''}`);
    const pick = element('button', 'preset-pick'); pick.type = 'button'; pick.disabled = busy;
    pick.setAttribute('aria-pressed', String(slot.number === selected));
    pick.setAttribute('aria-label', `Select slot ${slot.number}${slot.autosave ? ', autosave' : ''}`);
    const number = element('span', 'preset-number', String(slot.number).padStart(2, '0'));
    const main = element('span', 'preset-main');
    main.append(element('strong', '', slot.autosave ? 'Autosave' : names[slot.number] || 'Unnamed setup'));
    const description = slot.autosave ? 'Written by the module' : 'Stored setup';
    main.append(element('small', '', lastLoaded === slot.number ? 'Last loaded in Studio' : description));
    pick.append(number, main);
    pick.addEventListener('click', () => { selected = slot.number; render(); });
    const load = element('button', 'preset-load', 'Load'); load.type = 'button'; load.disabled = busy || readOnly();
    load.setAttribute('aria-label', `Load slot ${slot.number}`);
    load.addEventListener('click', () => loadSlot(slot.number));
    item.append(pick, load);
    return item;
  }

  function renderDetail() {
    const slot = slots.find((entry) => entry.number === selected);
    const title = element('h2', '', `Slot ${selected}${slot.autosave ? ' · Autosave' : ''}`);
    const label = element('label', 'preset-name-field'); label.append(element('span', '', 'Name in this browser'));
    const name = document.createElement('input'); name.type = 'text'; name.maxLength = 40;
    name.value = slot.autosave ? 'Autosave' : names[selected] || ''; name.placeholder = 'Name this setup'; name.disabled = busy || slot.autosave;
    name.addEventListener('input', () => { const value = name.value.trim(); if (value) names[selected] = value; else delete names[selected]; savePresetNames(uid, names, storage); list.replaceChildren(...slots.map(row)); });
    label.append(name);
    const note = element('p', 'preset-detail-note', slot.autosave ? 'The module writes this slot automatically and starts from it. Choose another slot to save a setup manually.' : 'Saving replaces this slot with the configuration currently active on the module.');
    const save = element('button', 'primary preset-save-current', 'Save current setup'); save.type = 'button'; save.disabled = busy || slot.autosave || readOnly();
    save.addEventListener('click', () => {
      if (busy || slot.autosave || readOnly()) return;
      const number = slot.number;
      if (!confirmAction?.(`Overwrite slot ${number}${names[number] ? ` (${names[number]})` : ''} with the current setup?`)) return;
      run(`Saved to slot ${number}`, () => controller.save(number), `Saving slot ${number}…`);
    });
    const privacy = element('p', 'preset-name-note', 'Names are saved only in this browser and included in exported backups. The module stores configuration data without names.');
    const load = element('button', 'preset-detail-load', 'Load setup'); load.type = 'button'; load.disabled = busy || readOnly();
    load.addEventListener('click', () => loadSlot(selected));
    const actions = element('div', 'preset-detail-actions'); actions.append(load, save);
    detail.replaceChildren(title, label, actions, note, privacy);
  }

  const showProgress = (n, total) => { progress.textContent = `Slot ${n} of ${total}…`; };
  exportButton.addEventListener('click', () => {
    if (controller.session.dirty && !confirmAction?.('The changes that are not saved on the module will be sent to it first (the backup reads through the live sound). Continue?')) return;
    run('Backup downloaded', async () => {
      const backup = await exportBackup(controller.session, { names, onProgress: showProgress });
      download(backup, `pentavox-presets-${uid.slice(0, 8)}-${backup.createdAt.slice(0, 10)}.json`);
    });
  });
  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; fileInput.value = '';
    if (!file) return;
    let backup;
    try { backup = JSON.parse(await file.text()); checkBackup(backup, controller.session.info); } catch (error) { onError(error); return; }
    const count = checkBackup(backup, controller.session.info).length;
    if (!confirmAction?.(`Write ${count} stored slot${count === 1 ? '' : 's'} from this file to the module? Slots with the same numbers are overwritten.`)) return;
    run(`Imported ${count} slot${count === 1 ? '' : 's'}`, async () => {
      await importBackup(controller.session, backup, { onProgress: showProgress });
      for (const entry of backup.slots) if (entry.name && !names[entry.slot]) names[entry.slot] = entry.name;
      savePresetNames(uid, names, storage);
    });
  });

  function render() {
    exportButton.disabled = busy || readOnly(); importButton.disabled = busy || readOnly();
    list.setAttribute('aria-busy', String(busy));
    if (!busy) progress.textContent = '';
    const pending = controller.session.dirty ? ' Current module settings have changed.' : '';
    state.textContent = (readOnly() ? controller.session.reason || 'Read only: setups cannot be loaded or saved.' : lastLoaded ? `Last loaded in Studio: slot ${lastLoaded}. Slots hold alternate configurations.` : 'The module keeps the current setup automatically. Slots store alternate configurations.') + pending;
    list.replaceChildren(...slots.map(row));
    renderDetail();
  }
  const unsubscribe = controller.subscribe?.(render);
  render();
  root.replaceChildren(heading, state, layout, backup);
  return () => { unsubscribe?.(); root.replaceChildren(); };
}
