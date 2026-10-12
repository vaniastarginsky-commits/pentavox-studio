import { HostLinkError } from '../hostlink/client.js';

export const BACKUP_FORMAT = 'pentavox-presets';
export const BACKUP_VERSION = 1;
const STATUS_EMPTY_SLOT = 3;   // what the module answers when a slot holds nothing

const toBase64 = (bytes) => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};
const fromBase64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

// The last backup made in this page session, so the flash warning can say whether one exists.
let lastBackup = null;
export const lastBackupInfo = () => lastBackup;
export const forgetBackup = () => { lastBackup = null; };

function requireIdle(session) {
  if (session.readOnly || !session.table || !session.voices) throw new Error('Connect a module with an editable session first');
}

/**
 * Reads every stored slot into one JSON-able object. A slot can only be read by loading it into the module's live state, so the
 * live state is captured first and written back at the end (also when a read fails half-way).
 */
export async function exportBackup(session, { names = {}, onProgress = () => {}, now = () => new Date() } = {}) {
  requireIdle(session);
  if (session.pending) await session.flushLive();
  const { client, info } = session;
  const original = await client.getLive(info);
  const slots = [];
  try {
    for (let slot = 0; slot < info.slotCount; ++slot) {
      onProgress(slot + 1, info.slotCount);
      let data = null;
      try {
        await client.loadFromSlot(slot);
        data = toBase64(await client.getLive(info));
      } catch (error) {
        if (!(error instanceof HostLinkError) || error.status !== STATUS_EMPTY_SLOT) throw error;
      }
      slots.push({ slot: slot + 1, name: names[slot + 1] ?? '', data });
    }
  } finally {
    await client.writeBlob(info, 0xff, original);
  }
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now().toISOString(),
    mcuUid: info.mcuUid,
    schemaHash: info.schemaHash >>> 0,
    liveSize: info.liveSize,
    fwGit: info.fwGit ?? '',
    bootSlot: info.bootSlot + 1,
    slots,
  };
  lastBackup = { uid: info.mcuUid, at: backup.createdAt, filled: slots.filter((entry) => entry.data).length };
  return backup;
}

/** Checks a parsed backup against the connected module; returns the usable slots or throws with a reason a person can act on. */
export function checkBackup(backup, info) {
  if (backup?.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !Array.isArray(backup.slots)) {
    throw new Error('This file is not a Pentavox preset backup');
  }
  if ((backup.schemaHash >>> 0) !== (info.schemaHash >>> 0) || backup.liveSize !== info.liveSize) {
    throw new Error('This backup was made for a different firmware layout, so it cannot be written to this module as it is. Keep the file: it holds the raw sound data');
  }
  const bootSlot = info.bootSlot + 1;
  return backup.slots.filter((entry) => entry.data && entry.slot >= 1 && entry.slot <= info.slotCount && entry.slot !== bootSlot);
}

/** Writes the backup's slots back (the autosave slot is skipped: the module owns it). The live sound is restored afterwards. */
export async function importBackup(session, backup, { onProgress = () => {} } = {}) {
  requireIdle(session);
  const { client, info } = session;
  const usable = checkBackup(backup, info);
  if (session.pending) await session.flushLive();
  const original = await client.getLive(info);
  try {
    for (let i = 0; i < usable.length; ++i) {
      onProgress(i + 1, usable.length);
      const bytes = fromBase64(usable[i].data);
      if (bytes.length !== info.liveSize) throw new Error(`Slot ${usable[i].slot} in the file has the wrong size`);
      await client.writeBlob(info, 0xff, bytes);
      await client.saveToSlot(usable[i].slot - 1);
    }
  } finally {
    await client.writeBlob(info, 0xff, original);
  }
  return usable.map((entry) => entry.slot);
}
