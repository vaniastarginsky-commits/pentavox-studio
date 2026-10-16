import { crc32 } from '../hostlink/frame.js';
import { HostLinkError } from '../hostlink/client.js';

// HostLink filesystem block (protocol section 8), commands 0x50..0x5B.
export const FS_COMMAND = Object.freeze({
  INFO: 0x50, LIST: 0x51, STAT: 0x52, OPEN_READ: 0x53, READ: 0x54, CLOSE: 0x55,
  OPEN_WRITE: 0x56, WRITE: 0x57, COMMIT: 0x58, DELETE: 0x59, MKDIR: 0x5a, RENAME: 0x5b,
});
export const FS_WRITE_FLAG = Object.freeze({ OVERWRITE: 1, MAKE_PARENTS: 2, RESUME: 4 });
export const FS_ENTRY_FLAG = Object.freeze({ DIRECTORY: 1, READ_ONLY: 2, LOCKED: 4 });
const SLOW_MS = 10_000;
const IO_MS = 5_000;
const MAX_PATH_BYTES = 192;
const MAX_SEGMENT_BYTES = 64;
const LIST_END = 0xffffffff;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

function u16(value) { const out = new Uint8Array(2); new DataView(out.buffer).setUint16(0, value, true); return out; }
function u32(value) { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value >>> 0, true); return out; }
function concat(...parts) { const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let at = 0; for (const part of parts) { out.set(part, at); at += part.length; } return out; }
function wireString(text) { const bytes = encoder.encode(text); return concat(Uint8Array.of(bytes.length), bytes); }
function dataView(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function need(bytes, length, what) { if (bytes.length < length) throw new HostLinkError(`${what}: response too short`, { code: 'BAD_STATUS' }); }

const BAD_CHARS = /[\\:*?"<>|]/;

/** Join a directory and a name into a normalized absolute path. */
export function joinPath(directory, name) { return directory === '/' ? `/${name}` : `${directory}/${name}`; }
export function parentPath(path) { const at = path.lastIndexOf('/'); return at <= 0 ? '/' : path.slice(0, at); }
export function baseName(path) { return path.slice(path.lastIndexOf('/') + 1); }

/** The module accepts printable ASCII only; replace everything else so an upload cannot be refused. */
export function sanitizeFileName(name) {
  let clean = String(name).normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/[\\:*?"<>|]/g, '_').replace(/^\s+/, '').replace(/[. ]+$/, '');
  if (!clean || clean === '.' || clean === '..') clean = 'file';
  if (clean.length > MAX_SEGMENT_BYTES) {
    const dot = clean.lastIndexOf('.');
    const extension = dot > 0 && clean.length - dot <= 8 ? clean.slice(dot) : '';
    clean = clean.slice(0, MAX_SEGMENT_BYTES - extension.length) + extension;
  }
  return clean;
}

/** Returns an error message, or '' when the path is acceptable to the module. */
export function validatePath(path) {
  if (!path.startsWith('/')) return 'The path must start with /';
  if (path.length > MAX_PATH_BYTES) return 'The path is longer than 192 characters';
  if (path === '/') return '';
  for (const segment of path.slice(1).split('/')) {
    if (!segment || segment.length > MAX_SEGMENT_BYTES) return 'Each name must be 1 to 64 characters';
    if (segment === '.' || segment === '..' || /[. ]$/.test(segment)) return 'A name cannot be . or .. or end with a dot or space';
    if (!/^[\x20-\x7e]+$/.test(segment) || BAD_CHARS.test(segment)) return 'Names may use printable ASCII only and not \\ : * ? " < > |';
  }
  return '';
}

export function fatDate(mtime) {
  if (!mtime) return null;
  const date = mtime >>> 16; const time = mtime & 0xffff;
  const year = 1980 + (date >> 9); const month = (date >> 5) & 15; const day = date & 31;
  if (month < 1 || month > 12 || day < 1) return null;
  const pad = (value) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(time >> 11)}:${pad((time >> 5) & 63)}`;
}

export class SdFilesClient {
  constructor(client, info, { retries = 3 } = {}) { this.client = client; this.info = info; this.retries = retries; }

  /** Card state. Rejects with FS_NO_CARD (status 11) when there is no usable card. */
  async cardInfo() {
    const { body } = await this.client.request(FS_COMMAND.INFO, new Uint8Array(), SLOW_MS);
    need(body, 13, 'FS_INFO');
    const view = dataView(body);
    return { mounted: body[0] === 1, fsType: body[1], freeKnown: (body[2] & 1) !== 0, busy: (body[2] & 2) !== 0, totalKiB: view.getUint32(3, true), freeKiB: view.getUint32(7, true), maxName: view.getUint16(11, true) };
  }

  async list(path) {
    const entries = [];
    let cookie = 0;
    for (;;) {
      const { body } = await this.client.request(FS_COMMAND.LIST, concat(u32(cookie), wireString(path)), SLOW_MS);
      need(body, 5, 'FS_LIST');
      const view = dataView(body);
      const next = view.getUint32(0, true); const count = body[4];
      let at = 5;
      for (let index = 0; index < count; index += 1) {
        need(body, at + 10, 'FS_LIST');
        const flags = body[at]; const size = view.getUint32(at + 1, true); const mtime = view.getUint32(at + 5, true); const length = body[at + 9];
        need(body, at + 10 + length, 'FS_LIST');
        const name = decoder.decode(body.subarray(at + 10, at + 10 + length));
        entries.push({ name, path: joinPath(path, name), directory: (flags & FS_ENTRY_FLAG.DIRECTORY) !== 0, readOnly: (flags & FS_ENTRY_FLAG.READ_ONLY) !== 0, locked: (flags & FS_ENTRY_FLAG.LOCKED) !== 0, size, mtime });
        at += 10 + length;
      }
      if (next === LIST_END) break;
      if (next === cookie && count === 0) throw new HostLinkError('FS_LIST: the listing did not advance', { code: 'BAD_STATUS' });
      cookie = next;
    }
    return entries;
  }

  async download(path, { onProgress = () => {}, signal } = {}) {
    const startedAt = performance.now();
    const { body: opened } = await this.client.request(FS_COMMAND.OPEN_READ, wireString(path), SLOW_MS);
    need(opened, 8, 'FS_OPEN_READ');
    const size = dataView(opened).getUint32(0, true);
    const bytes = new Uint8Array(size);
    const chunk = this.info.maxBody - 7;
    if (chunk <= 0) throw new Error('The module reports a HostLink frame size too small for file transfer');
    try {
      for (let offset = 0; offset < size;) {
        this.#notAborted(signal, 'Download cancelled');
        const { body } = await this.#retry(() => this.client.request(FS_COMMAND.READ, concat(u32(offset), u16(Math.min(chunk, size - offset))), IO_MS));
        need(body, 6, 'FS_READ');
        const view = dataView(body); const echoed = view.getUint32(0, true); const length = view.getUint16(4, true);
        if (echoed !== offset || length === 0 || length > body.length - 6 || offset + length > size) throw new HostLinkError('FS_READ: bad response range', { code: 'BAD_STATUS' });
        bytes.set(body.subarray(6, 6 + length), offset);
        offset += length; onProgress(offset / size);
      }
    } finally {
      try { await this.client.request(FS_COMMAND.CLOSE); } catch { /* the original error matters more */ }
    }
    onProgress(1);
    this.lastTransfer = { bytes: size, ms: performance.now() - startedAt, block: chunk };
    return bytes;
  }

  /** Atomic upload: the module stages into <path>.part and only a CRC-verified commit publishes the name. */
  async upload(path, bytes, { overwrite = false, makeParents = true, onProgress = () => {}, signal } = {}) {
    const startedAt = performance.now();
    const problem = validatePath(path);
    if (problem) throw new Error(problem);
    const flags = (overwrite ? FS_WRITE_FLAG.OVERWRITE : 0) | (makeParents ? FS_WRITE_FLAG.MAKE_PARENTS : 0);
    await this.client.request(FS_COMMAND.OPEN_WRITE, concat(Uint8Array.of(flags), u32(bytes.length), wireString(path)), SLOW_MS);
    const chunk = this.info.maxBody - 4;
    if (chunk <= 0) throw new Error('The module reports a HostLink frame size too small for file transfer');
    try {
      for (let offset = 0; offset < bytes.length; offset += chunk) {
        this.#notAborted(signal, 'Upload cancelled');
        const part = bytes.subarray(offset, offset + chunk);
        const { body } = await this.client.request(FS_COMMAND.WRITE, concat(u32(offset), part), IO_MS);
        need(body, 4, 'FS_WRITE');
        if (dataView(body).getUint32(0, true) !== offset + part.length) throw new HostLinkError('FS_WRITE: the module acknowledged a different byte count', { code: 'BAD_STATUS' });
        onProgress((offset + part.length) / bytes.length);
      }
      this.#notAborted(signal, 'Upload cancelled');
      await this.client.request(FS_COMMAND.COMMIT, u32(crc32(bytes)), SLOW_MS);
    } catch (error) {
      try { await this.client.request(FS_COMMAND.CLOSE); } catch { /* keep the original error */ }
      throw error;
    }
    onProgress(1);
    this.lastTransfer = { bytes: bytes.length, ms: performance.now() - startedAt, block: chunk };
  }

  /** First unused WAV number in each sampler folder (/SLOT0../SLOT3), so new files never collide with the card. */
  async nextFreeNumbers(slotCount = 4) {
    const next = [];
    for (let slot = 0; slot < slotCount; slot += 1) {
      let highest = 1;
      try {
        for (const entry of await this.list(`/SLOT${slot}`)) {
          const match = /^(\d{4})\.WAV$/i.exec(entry.name);
          if (match && !entry.directory) highest = Math.max(highest, Number(match[1]) + 1);
        }
      } catch (error) { if (!(error instanceof HostLinkError) || error.status !== 12) throw error; }
      next.push(Math.min(highest, 9999));
    }
    return next;
  }

  /** Ask the module to re-read /SLOT0../SLOT3 so freshly written files show up in the Selector. */
  async rescanLibraries() { await this.client.request(0x74); }

  async remove(path) { await this.client.request(FS_COMMAND.DELETE, wireString(path), SLOW_MS); }
  async makeDirectory(path) { const problem = validatePath(path); if (problem) throw new Error(problem); await this.client.request(FS_COMMAND.MKDIR, wireString(path), SLOW_MS); }
  async rename(from, to) { const problem = validatePath(to); if (problem) throw new Error(problem); await this.client.request(FS_COMMAND.RENAME, concat(wireString(from), wireString(to)), SLOW_MS); }

  /** Delete a folder and everything in it, leaves first (the module refuses to remove non-empty folders). */
  async removeTree(path) {
    for (const entry of await this.list(path)) {
      if (entry.directory) await this.removeTree(entry.path); else await this.remove(entry.path);
    }
    await this.remove(path);
  }

  async #retry(operation) {
    let last;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try { return await operation(); }
      catch (error) { last = error; if (!(error instanceof HostLinkError) || error.code !== 'TIMEOUT' || attempt === this.retries) throw error; }
    }
    throw last;
  }

  #notAborted(signal, message) { if (signal?.aborted) throw new DOMException(message, 'AbortError'); }
}

const STATUS_TEXT = new Map([
  [11, 'No SD card, or it is not FAT32. Insert a FAT32 card and press Refresh.'],
  [12, 'That file or folder does not exist.'],
  [13, 'That name already exists.'],
  [14, 'The module is using that file right now (for example a recording).'],
  [15, 'The SD card is full.'],
  [16, 'The card reported an error. Check that it is seated and try again.'],
  [9, 'The module is busy with the card. Try again in a moment.'],
  [3, 'The folder is not empty, or the module is not ready for that.'],
]);

/** User-facing message for a failed file operation. */
export function describeFsError(error) {
  if (error instanceof HostLinkError && error.status !== undefined && STATUS_TEXT.has(error.status)) return STATUS_TEXT.get(error.status);
  if (error instanceof HostLinkError && error.code === 'TIMEOUT') return 'The module did not answer. If it is busy with the card, wait and try again.';
  return error?.message ?? String(error);
}

/** One line about the last transfer, e.g. "1.1 MB in 9.2 s, 120 KB/s, 505-byte blocks". */
export function describeTransfer(last) {
  if (!last || !(last.ms > 0)) return '';
  const rate = last.bytes / 1024 / (last.ms / 1000);
  const size = last.bytes >= 1048576 ? `${(last.bytes / 1048576).toFixed(1)} MB` : `${Math.round(last.bytes / 1024)} KB`;
  return `${size} in ${(last.ms / 1000).toFixed(1)} s, ${Math.round(rate)} KB/s, ${last.block}-byte blocks`;
}
