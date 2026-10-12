import { crc32 } from './frame.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function concat(...parts) { const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let at = 0; for (const part of parts) { out.set(part, at); at += part.length; } return out; }
function u16(value) { const out = new Uint8Array(2); new DataView(out.buffer).setUint16(0, value, true); return out; }
function u32(value) { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value >>> 0, true); return out; }
function view(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function readString(body, at) { const length = body[at]; return [decoder.decode(body.subarray(at + 1, at + 1 + length)), at + 1 + length]; }

const STATUS = { OK: 0, BAD_ARGS: 2, BAD_STATE: 3, BAD_CRC: 4, FS_NO_CARD: 11, FS_NO_FILE: 12, FS_EXISTS: 13, FS_LOCKED: 14 };
const FAT_EPOCH = (((2026 - 1980) << 9 | 10 << 5 | 5) << 16) | (12 << 11);

/** In-memory SD card for the simulator and tests. Implements protocol section 8 closely enough to exercise the Studio. */
export class SimSdCard {
  constructor({ present = true, maxBody = 512, pageSize = 4 } = {}) {
    this.present = present; this.maxBody = maxBody; this.pageSize = pageSize;
    this.files = new Map(); this.dirs = new Set(['/']); this.locked = new Set();
    this.read = null; this.write = null; this.cursor = null;
  }

  addFile(path, bytes) { this.#ensureParents(path); this.files.set(path, { bytes: Uint8Array.from(bytes), mtime: FAT_EPOCH }); }
  addDirectory(path) { this.#ensureParents(`${path}/x`); this.dirs.add(path); }
  #ensureParents(path) { let at = 0; while ((at = path.indexOf('/', at + 1)) > 0) this.dirs.add(path.slice(0, at)); }
  #parent(path) { const at = path.lastIndexOf('/'); return at <= 0 ? '/' : path.slice(0, at); }
  #children(path) {
    const out = [];
    for (const dir of this.dirs) if (dir !== '/' && this.#parent(dir) === path) out.push({ name: dir.slice(dir.lastIndexOf('/') + 1), directory: true, size: 0, mtime: FAT_EPOCH });
    for (const [file, entry] of this.files) if (this.#parent(file) === path) out.push({ name: file.slice(file.lastIndexOf('/') + 1), directory: false, size: entry.bytes.length, mtime: entry.mtime });
    return out;
  }

  handle(type, body) {
    if (!this.present) return Uint8Array.of(STATUS.FS_NO_CARD, 0xfe, 0, 0);
    switch (type) {
      case 0x50: return concat(Uint8Array.of(0, 1, 3, 1), u32(7_780_352), u32(7_000_000 - this.#used()), u16(64));
      case 0x51: return this.#list(body);
      case 0x52: return this.#stat(body);
      case 0x53: return this.#openRead(body);
      case 0x54: return this.#readChunk(body);
      case 0x55: this.read = null; this.write = null; return Uint8Array.of(0);
      case 0x56: return this.#openWrite(body);
      case 0x57: return this.#writeChunk(body);
      case 0x58: return this.#commit(body);
      case 0x59: return this.#delete(body);
      case 0x5a: return this.#mkdir(body);
      case 0x5b: return this.#rename(body);
      default: return Uint8Array.of(1);
    }
  }

  #used() { let total = 0; for (const entry of this.files.values()) total += Math.ceil(entry.bytes.length / 1024); return total; }

  #list(body) {
    let cookie = view(body).getUint32(0, true); const [path] = readString(body, 4);
    if (!this.dirs.has(path)) return Uint8Array.of(STATUS.FS_NO_FILE);
    const all = this.#children(path); const records = []; let index = cookie;
    while (index < all.length && records.length < this.pageSize) {
      const entry = all[index]; const name = encoder.encode(entry.name);
      const flags = (entry.directory ? 1 : 0) | (this.locked.has(`${path === '/' ? '' : path}/${entry.name}`) ? 4 : 0);
      records.push(concat(Uint8Array.of(flags), u32(entry.size), u32(entry.mtime), Uint8Array.of(name.length), name)); index += 1;
    }
    return concat(Uint8Array.of(0), u32(index >= all.length ? 0xffffffff : index), Uint8Array.of(records.length), ...records);
  }

  #stat(body) {
    const [path] = readString(body, 0);
    if (this.dirs.has(path)) return concat(Uint8Array.of(0, 1), u32(0), u32(FAT_EPOCH));
    const file = this.files.get(path);
    return file ? concat(Uint8Array.of(0, 0), u32(file.bytes.length), u32(file.mtime)) : Uint8Array.of(STATUS.FS_NO_FILE);
  }

  #openRead(body) {
    const [path] = readString(body, 0); const file = this.files.get(path);
    if (this.dirs.has(path)) return Uint8Array.of(STATUS.BAD_ARGS);
    if (!file) return Uint8Array.of(STATUS.FS_NO_FILE);
    this.read = file; this.write = null;
    return concat(Uint8Array.of(0), u32(file.bytes.length), u32(file.mtime));
  }

  #readChunk(body) {
    if (!this.read || body.length !== 6) return Uint8Array.of(STATUS.BAD_STATE);
    const offset = view(body).getUint32(0, true); const wanted = Math.min(view(body).getUint16(4, true), this.maxBody - 7);
    const chunk = this.read.bytes.slice(offset, offset + wanted);
    return concat(Uint8Array.of(0), u32(offset), u16(chunk.length), chunk);
  }

  #openWrite(body) {
    const flags = body[0]; const total = view(body).getUint32(1, true); const [path] = readString(body, 5);
    if (path.endsWith('.part') || path.endsWith('.partmeta')) return Uint8Array.of(STATUS.BAD_ARGS);
    if (this.files.has(path) && !(flags & 1)) return Uint8Array.of(STATUS.FS_EXISTS);
    if (!this.dirs.has(this.#parent(path))) { if (flags & 2) this.#ensureParents(path); else return Uint8Array.of(STATUS.FS_NO_FILE); }
    if (this.locked.has(path)) return Uint8Array.of(STATUS.FS_LOCKED);
    this.write = { path, flags, total, bytes: new Uint8Array(total), offset: 0 }; this.read = null;
    return concat(Uint8Array.of(0), u32(0));
  }

  #writeChunk(body) {
    const tx = this.write; if (!tx || body.length < 4) return Uint8Array.of(STATUS.BAD_STATE);
    const offset = view(body).getUint32(0, true); const data = body.subarray(4);
    if (offset !== tx.offset || offset + data.length > tx.total) return Uint8Array.of(STATUS.BAD_ARGS);
    tx.bytes.set(data, offset); tx.offset += data.length;
    return concat(Uint8Array.of(0), u32(tx.offset));
  }

  #commit(body) {
    const tx = this.write; if (!tx || body.length !== 4 || tx.offset !== tx.total) return Uint8Array.of(STATUS.BAD_STATE);
    if (view(body).getUint32(0, true) !== crc32(tx.bytes)) return Uint8Array.of(STATUS.BAD_CRC);
    this.files.set(tx.path, { bytes: tx.bytes, mtime: FAT_EPOCH }); this.write = null;
    return Uint8Array.of(0);
  }

  #delete(body) {
    const [path] = readString(body, 0);
    if (this.locked.has(path)) return Uint8Array.of(STATUS.FS_LOCKED);
    if (this.files.delete(path)) return Uint8Array.of(0);
    if (this.dirs.has(path) && path !== '/') { if (this.#children(path).length) return Uint8Array.of(STATUS.BAD_STATE); this.dirs.delete(path); return Uint8Array.of(0); }
    return Uint8Array.of(STATUS.FS_NO_FILE);
  }

  #mkdir(body) {
    const [path] = readString(body, 0);
    if (this.dirs.has(path) || this.files.has(path)) return Uint8Array.of(STATUS.FS_EXISTS);
    if (!this.dirs.has(this.#parent(path))) return Uint8Array.of(STATUS.FS_NO_FILE);
    this.dirs.add(path); return Uint8Array.of(0);
  }

  #rename(body) {
    const [from, next] = readString(body, 0); const [to] = readString(body, next);
    if (this.files.has(to) || this.dirs.has(to)) return Uint8Array.of(STATUS.FS_EXISTS);
    if (this.locked.has(from)) return Uint8Array.of(STATUS.FS_LOCKED);
    if (this.files.has(from)) { this.files.set(to, this.files.get(from)); this.files.delete(from); return Uint8Array.of(0); }
    if (this.dirs.has(from)) {
      for (const dir of [...this.dirs]) if (dir === from || dir.startsWith(`${from}/`)) { this.dirs.delete(dir); this.dirs.add(to + dir.slice(from.length)); }
      for (const [file, entry] of [...this.files]) if (file.startsWith(`${from}/`)) { this.files.delete(file); this.files.set(to + file.slice(from.length), entry); }
      return Uint8Array.of(0);
    }
    return Uint8Array.of(STATUS.FS_NO_FILE);
  }
}
