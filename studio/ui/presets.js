import { exportBackup, importBackup, checkBackup } from '../model/preset_backup.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const NAMES_KEY = 'pentavox.studio.presetNames';

/** Slot names live in this browser only (the module stores no names), keyed by the module's UID. */
export function loadPresetNames(uid, storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(`${NAMES_KEY}.${uid}`) ?? '{}') ?? {}; } catch { return {}; }
}

export function savePresetNames(uid, names, storage = globalThis.localStorage) {
  try { storage.setItem(`${NAMES_KEY}.${uid}`, JSON.stringify(names)); } catch { /* private window: names last until reload */ }
}

export function presetSlotList(info) {
  const count = Math.max(1, Math.min(16, Number(info?.slotCount) || 0));
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
  const heading = element('div', 'page-bar');
  heading.append(element('p', 'page-hint', 'Load a stored sound set into the module or save the current one. Slot 1 is the autosave: the module writes it by itself and starts from it. Names are kept in this browser.'));
  const backupBar = element('div', 'page-tools preset-backup');
  const exportButton = element('button', '', 'Export backup'); exportButton.type = 'button';
  exportButton.title = 'Download every stored slot as one file. The module plays each slot briefly while it is read; the current sound is put back afterwards.';
  const importButton = element('button', '', 'Import backup…'); importButton.type = 'button';
  importButton.title = 'Write the slots of a backup file to the module (slot 1, the autosave, is skipped).';
  const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'application/json,.json'; fileInput.hidden = true;
  const progress = element('span', 'midi-count', '');
  backupBar.append(exportButton, importButton, fileInput, progress);
  const list = element('div', 'preset-list');
  let busy = false;

  async function run(label, action, working = 'Working…') {
    if (busy) return;
    busy = true; render(); progress.textContent = working;
    try { await action(); onSuccess(label); } catch (error) { onError(error); }
    busy = false; render();
  }

  function row(slot) {
    const item = element('div', `preset-row${slot.autosave ? ' autosave' : ''}`);
    const number = element('span', 'preset-number', String(slot.number));
    const name = document.createElement('input');
    name.type = 'text'; name.maxLength = 40; name.value = names[slot.number] ?? ''; name.disabled = slot.autosave;
    name.placeholder = slot.autosave ? 'Autosave' : 'Unnamed';
    name.setAttribute('aria-label', `Name of slot ${slot.number}`);
    name.addEventListener('change', () => { const value = name.value.trim(); if (value) names[slot.number] = value; else delete names[slot.number]; savePresetNames(uid, names, storage); });
    const load = element('button', 'solid', 'Load'); load.type = 'button'; load.disabled = busy;
    load.addEventListener('click', () => {
      if (controller.session.dirty && !confirmAction?.('Loading replaces the changes that are not saved on the module. Continue?')) return;
      run(`Loaded slot ${slot.number}`, () => controller.load(slot.number), `Loading slot ${slot.number}…`);
    });
    const save = element('button', '', 'Save here'); save.type = 'button'; save.disabled = busy || slot.autosave;
    save.title = slot.autosave ? 'The module overwrites this slot by itself' : '';
    save.addEventListener('click', () => {
      if (!confirmAction?.(`Overwrite slot ${slot.number}${names[slot.number] ? ` (${names[slot.number]})` : ''} with the current sound?`)) return;
      run(`Saved to slot ${slot.number}`, () => controller.save(slot.number), `Saving slot ${slot.number}…`);
    });
    item.append(number, name, load, save);
    return item;
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
    exportButton.disabled = busy; importButton.disabled = busy;
    list.setAttribute('aria-busy', String(busy));
    if (!busy) progress.textContent = '';
    list.replaceChildren(...slots.map(row));
  }
  render();
  root.replaceChildren(heading, backupBar, list);
  return () => { root.replaceChildren(); };
}
