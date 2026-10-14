import { buildFrame, crc32, FrameParser } from './frame.js';
import { SimSdCard } from './transport_sim_fs.js';
import { decodeBank } from '../model/break_pattern.js';

const encoder = new TextEncoder();

function concat(...parts) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function wireString(value) {
  const bytes = encoder.encode(value);
  return concat(Uint8Array.of(bytes.length), bytes);
}

function view(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export class SimTransport {
  constructor(descriptorJsonBytes, liveBytes, { schemaHash, maxBody = 512 } = {}) {
    this.descriptorBytes = Uint8Array.from(descriptorJsonBytes);
    this.live = Uint8Array.from(liveBytes);
    this.schemaHash = schemaHash >>> 0;
    this.maxBody = maxBody;
    this.dataCallback = () => {};
    this.closed = false;
    this.writes = [];
    this.slots = [];
    this.rebootMode = null;
    this.blobTransactions = 0;
    this.parser = new FrameParser();
    this.transaction = null;
    this.sampleTransaction = null;
    this.sampleVoices = [null, null];
    this.sd = new SimSdCard({ maxBody });
  }

  onData(callback) {
    this.dataCallback = callback;
  }

  async write(bytes) {
    if (this.closed) throw new Error('SimTransport is closed');
    const copy = Uint8Array.from(bytes);
    this.writes.push(copy);
    for (const request of this.parser.push(copy)) {
      const response = this.#handle(request.type, request.body);
      queueMicrotask(() => {
        if (!this.closed) {
          this.dataCallback(buildFrame(request.type | 0x80, request.seq, response));
        }
      });
    }
  }

  mutateLive(offset, bytes) {
    if (offset < 0 || offset + bytes.length > this.live.length) {
      throw new RangeError('live mutation is out of range');
    }
    this.live.set(bytes, offset);
  }

  async close() {
    this.closed = true;
  }

  #handle(type, body) {
    switch (type) {
      case 0x01: return this.#hello(body);
      case 0x02: return this.#descriptor(body);
      case 0x12: return this.#blobBegin(body);
      case 0x13: return this.#blobData(body);
      case 0x14: return this.#blobCommit(body);
      case 0x20: return this.#getLive(body);
      case 0x30: return this.#save(body);
      case 0x31: return this.#load(body);
      case 0x40: return this.#reboot(body);
      case 0x50: case 0x51: case 0x52: case 0x53: case 0x54: case 0x55:
      case 0x56: case 0x57: case 0x58: case 0x59: case 0x5a: case 0x5b:
        return this.sd.handle(type, body);
      case 0x70: return this.#sampleBegin(body);
      case 0x71: return this.#sampleChunk(body);
      case 0x72: return this.#sampleCommit(body);
      case 0x75: return this.#sampleBreak(body);
      case 0x76: { const tx = this.sampleTransaction; if (!tx) return Uint8Array.of(3); if (body.length !== 2) return Uint8Array.of(2); tx.beats = view(body).getUint16(0, true); return Uint8Array.of(0); }
      case 0x74: this.rescans = (this.rescans ?? 0) + 1; return Uint8Array.of(0);
      case 0x73: this.sampleTransaction = null; return body.length ? Uint8Array.of(2) : Uint8Array.of(0);
      default: return Uint8Array.of(1);
    }
  }

  #hello(body) {
    if (body.length !== 0) return Uint8Array.of(2);
    return concat(
      Uint8Array.of(0, 1, 2, 16, 0),
      new Uint8Array(12),
      u32(this.schemaHash),
      u32(20448),
      u32(this.descriptorBytes.length),
      u32(crc32(this.descriptorBytes)),
      u16(this.maxBody),
      u16(this.live.length),
      wireString('pentavox'),
      wireString('Pentavox Simulator'),
      wireString('test'),
      wireString('sim'),
      wireString('test'),
    );
  }

  #descriptor(body) {
    if (body.length !== 6) return Uint8Array.of(2);
    const offset = view(body).getUint32(0, true);
    const maximum = view(body).getUint16(4, true);
    if (offset >= this.descriptorBytes.length || maximum === 0) return Uint8Array.of(2);
    const chunk = this.descriptorBytes.slice(offset, offset + maximum);
    return concat(Uint8Array.of(0), u32(offset), u16(chunk.length), chunk);
  }

  #getLive(body) {
    if (body.length !== 6) return Uint8Array.of(2);
    const offset = view(body).getUint32(0, true);
    const maximum = view(body).getUint16(4, true);
    if (offset >= this.live.length || maximum === 0) return Uint8Array.of(2);
    const chunk = this.live.slice(offset, offset + maximum);
    return concat(
      Uint8Array.of(0, 0xff), u32(offset), u16(chunk.length),
      u16(this.live.length), u32(this.schemaHash), chunk,
    );
  }

  #blobBegin(body) {
    if (body.length !== 9 || body[0] !== 0xff) return Uint8Array.of(2);
    const total = view(body).getUint32(1, true);
    const schemaHash = view(body).getUint32(5, true);
    if (schemaHash !== this.schemaHash) return Uint8Array.of(7);
    if (total !== this.live.length) return Uint8Array.of(2);
    this.transaction = { bytes: new Uint8Array(total), offset: 0 };
    this.blobTransactions += 1;
    return Uint8Array.of(0);
  }

  #blobData(body) {
    if (!this.transaction || body.length < 5) return Uint8Array.of(3);
    const offset = view(body).getUint32(0, true);
    const chunk = body.subarray(4);
    if (offset !== this.transaction.offset || offset + chunk.length > this.transaction.bytes.length) {
      this.transaction = null;
      return Uint8Array.of(2);
    }
    this.transaction.bytes.set(chunk, offset);
    this.transaction.offset += chunk.length;
    return Uint8Array.of(0);
  }

  #blobCommit(body) {
    const transaction = this.transaction;
    this.transaction = null;
    if (!transaction || body.length !== 4 || transaction.offset !== transaction.bytes.length) {
      return Uint8Array.of(3);
    }
    if (view(body).getUint32(0, true) !== crc32(transaction.bytes)) {
      return Uint8Array.of(4);
    }
    this.live = transaction.bytes;
    return Uint8Array.of(0);
  }

  #save(body) {
    if (body.length !== 1 || body[0] >= 16) return Uint8Array.of(5);
    this.slots[body[0]] = Uint8Array.from(this.live);
    return Uint8Array.of(0);
  }

  #load(body) {
    if (body.length !== 1 || body[0] >= 16) return Uint8Array.of(5);
    if (!this.slots[body[0]]) return Uint8Array.of(5);   // BAD_SLOT: what the firmware answers for an empty or invalid slot (HostLink OnLoadFromSlot)
    this.live = Uint8Array.from(this.slots[body[0]]);
    return Uint8Array.of(0);
  }

  #reboot(body) {
    if (body.length !== 1 || body[0] > 1) return Uint8Array.of(2);
    this.rebootMode = body[0];
    return Uint8Array.of(0);
  }

  #sampleBegin(body) {
    if (body.length < 15 || body[0] > 1) return Uint8Array.of(2);
    const frames = view(body).getUint32(1, true); const channels = body[5]; const sampleRate = view(body).getUint32(6, true); const rootNote = body[10];
    if (!frames || (channels !== 1 && channels !== 2) || !sampleRate || rootNote > 127) return Uint8Array.of(2);
    const total = frames * channels * 2;
    let slices = null;
    if (body.length > 15) {
      const block = body.subarray(15); const count = block[5];
      if (block.length < 7 || block[0] !== 1 || count > 32 || block.length < 6 + 4 * count + 1) return Uint8Array.of(2);
      const typeCount = block[6 + 4 * count];
      if ((typeCount !== 0 && typeCount !== count) || block.length !== 6 + 4 * count + 1 + typeCount) return Uint8Array.of(2);
      const dv = view(block); slices = { oneShot: (block[1] & 1) === 1, playMode: block[2], step: block[3], filter: block[4], starts: Array.from({ length: count }, (_, i) => dv.getUint32(6 + 4 * i, true)), types: Array.from(block.subarray(7 + 4 * count)) };
    }
    this.sampleTransaction = { slices, voice: body[0], frames, channels, sampleRate, rootNote, crc: view(body).getUint32(11, true), bytes: new Uint8Array(total), offset: 0, sequence: 0 };
    return Uint8Array.of(0);
  }

  // Break patterns for the open upload, in pieces: u16 total | u16 offset | data (the firmware's rules, incl. the answer to a resent last piece).
  #sampleBreak(body) {
    const tx = this.sampleTransaction;
    if (!tx) return Uint8Array.of(3);
    if (body.length < 5) return Uint8Array.of(2);
    const dv = view(body); const total = dv.getUint16(0, true); const offset = dv.getUint16(2, true); const data = body.subarray(4);
    if (!total || total > 4160) return Uint8Array.of(6);
    if (offset === 0) tx.stage = { total, bytes: new Uint8Array(total), got: 0 };
    const st = tx.stage;
    if (!st || st.total !== total) return Uint8Array.of(2);
    if (offset < st.got && offset + data.length === st.got) return concat(Uint8Array.of(0), u16(st.got));
    if (offset !== st.got || offset + data.length > total) return Uint8Array.of(2);
    st.bytes.set(data, offset); st.got += data.length;
    if (st.got === total) {
      const bank = decodeBank(st.bytes); tx.stage = null;
      if (!bank) return Uint8Array.of(2);
      tx.patterns = bank;
    }
    return concat(Uint8Array.of(0), u16(st.got));
  }

  #sampleChunk(body) {
    const tx = this.sampleTransaction;
    if (!tx || body.length < 8) return Uint8Array.of(3);
    const sequence = view(body).getUint32(0, true); const want = view(body).getUint32(4, true); const chunk = body.subarray(8);
    if (sequence !== tx.sequence || tx.offset + chunk.length > tx.bytes.length) return Uint8Array.of(2);
    if (crc32(chunk) !== want) return Uint8Array.of(4);
    tx.bytes.set(chunk, tx.offset); tx.offset += chunk.length; tx.sequence += 1;
    return concat(Uint8Array.of(0), u32(tx.sequence), u32(tx.offset));
  }

  #sampleCommit(body) {
    const tx = this.sampleTransaction; this.sampleTransaction = null;
    if (body.length || !tx || tx.offset !== tx.bytes.length) return Uint8Array.of(3);
    if (crc32(tx.bytes) !== tx.crc) return Uint8Array.of(4);
    this.sampleVoices[tx.voice] = tx;
    return Uint8Array.of(0);
  }
}
