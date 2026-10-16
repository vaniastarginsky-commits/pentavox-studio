import { FS_ENTRY_FLAG, baseName, fatDate, joinPath, parentPath } from '../model/sd_files.js';

export const SAMPLER_FOLDERS = Object.freeze(['/SLOT0', '/SLOT1', '/SLOT2', '/SLOT3']);
export function samplerFolders(count = 4) { return SAMPLER_FOLDERS.slice(0, count); }

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 100 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatKiB(kib) { return formatSize(kib * 1024); }

/** Breadcrumb segments for a path: [{ name, path }], starting with the card root. */
export function breadcrumbs(path) {
  const crumbs = [{ name: 'SD card', path: '/' }];
  let at = '/';
  for (const segment of path.split('/').filter(Boolean)) { at = joinPath(at, segment); crumbs.push({ name: segment, path: at }); }
  return crumbs;
}

/** Folders first, then files, each A-Z; the module returns directory order. */
export function sortEntries(entries) {
  return [...entries].sort((a, b) => (a.directory === b.directory ? a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) : a.directory ? -1 : 1));
}

export function entryRow(entry) {
  return {
    ...entry,
    kind: entry.directory ? 'Folder' : 'File',
    sizeText: entry.directory ? '' : formatSize(entry.size),
    dateText: fatDate(entry.mtime) ?? '',
    stagedLeftover: /\.part(meta)?$/i.test(entry.name),
    canModify: !entry.locked,
  };
}

export function cardSummary(card) {
  if (!card.mounted) return 'No card';
  const type = card.fsType === 3 ? 'FAT32' : card.fsType === 2 ? 'FAT16' : 'FAT';
  const space = card.freeKnown ? `${formatKiB(card.freeKiB)} free of ${formatKiB(card.totalKiB)}` : `${formatKiB(card.totalKiB)} total`;
  return `${type} · ${space}${card.busy ? ' · module busy' : ''}`;
}

export function uniqueName(name, taken) {
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name; const extension = dot > 0 ? name.slice(dot) : '';
  for (let index = 2; ; index += 1) { const candidate = `${stem} (${index})${extension}`; if (!taken.has(candidate.toLowerCase())) return candidate; }
}

export { FS_ENTRY_FLAG, baseName, parentPath };
