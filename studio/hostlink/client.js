import { FrameParser, buildFrame, crc32 } from './frame.js';

const RESPONSE_FLAG = 0x80;
const ERROR_TYPE = 0xff;
const COMMIT_TIMEOUT_MS = 10_000;

const COMMAND = Object.freeze({
  HELLO: 0x01,
  GET_DESCRIPTOR: 0x02,
  BLOB_BEGIN: 0x12,
  BLOB_DATA: 0x13,
  BLOB_COMMIT: 0x14,
  GET_LIVE: 0x20,
  SAVE_TO_SLOT: 0x30,
  LOAD_FROM_SLOT: 0x31,
  REBOOT: 0x40,
  // The Chopper PVXE pattern session (docs/protocol/hostlink.md:0x64-0x67): the module keeps a receive session
  // open for the whole upload, so these four commands belong to exactly one held transaction.
  PVXE_BEGIN: 0x64,
  PVXE_CHUNK: 0x65,
  PVXE_COMMIT: 0x66,
  PVXE_ABORT: 0x67,
});

// 32 byte envelope + 8 patterns x (4 byte header + 256 events x 12 bytes). The same number the firmware buffer
// is sized for and the chopper descriptor advertises as pvxeMax; a bank this model encodes cannot exceed it.
export const PVXE_MAX_BYTES = 32 + 8 * (4 + 256 * 12);

// Names for the commit result byte, in the module's order.
const PVXE_RESULTS = Object.freeze(['staged', 'gridAdapted']);

const STATUS_NAMES = [
  'OK',
  'UNSUPPORTED',
  'BAD_ARGS',
  'BAD_STATE',
  'BAD_CRC',
  'BAD_SLOT',
  'TOO_LARGE',
  'SCHEMA_MISMATCH',
  'FLASH_FAIL',
  'BUSY',
  'FRAME_ERROR',
  'FS_NO_CARD',
  'FS_NO_FILE',
  'FS_EXISTS',
  'FS_LOCKED',
  'FS_FULL',
  'FS_IO',
  'UPLOAD_RECORDING',
  'UPLOAD_SLOT_BUSY',
];

export class HostLinkError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'HostLinkError';
    this.status = status;
    this.code = code;
  }
}

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

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireLength(bytes, minimum, context) {
  if (bytes.length < minimum) {
    throw new HostLinkError(`${context}: response too short`, { code: 'BAD_STATUS' });
  }
}

function readWireString(bytes, offset) {
  requireLength(bytes, offset + 1, 'HELLO');
  const length = bytes[offset];
  const end = offset + 1 + length;
  requireLength(bytes, end, 'HELLO');
  return [new TextDecoder('ascii').decode(bytes.subarray(offset + 1, end)), end];
}

export class HostLinkClient {
  constructor(transport, { timeoutMs = 1500 } = {}) {
    this.transport = transport;
    this.timeoutMs = timeoutMs;
    this.sequence = 1;
    this.parser = new FrameParser();
    this.pending = null;
    this.queue = Promise.resolve();
    transport.onData((bytes) => this.#onData(bytes));
  }

  onDisconnect(callback) {
    this.transport.onDisconnect?.(callback);
  }

  request(type, body = new Uint8Array(), timeoutMs = this.timeoutMs) {
    const operation = this.queue.then(() => this.#requestNow(type, body, timeoutMs));
    this.queue = operation.catch(() => {});
    return operation;
  }

  /**
   * Run a multi-request operation (a chunked read, BLOB_BEGIN..COMMIT) as ONE unit of the queue: no other request is sent between its
   * steps. `work` receives a `send(type, body, timeoutMs)` that talks to the module directly. Without this, two operations interleave
   * their chunks, and a snapshot read in two pieces can come from two different firmware states.
   */
  #transaction(work) {
    const operation = this.queue.then(() => work((type, body = new Uint8Array(), timeoutMs = this.timeoutMs) => this.#requestNow(type, body, timeoutMs)));
    this.queue = operation.catch(() => {});
    return operation;
  }

  async hello() {
    const { body } = await this.request(COMMAND.HELLO);
    requireLength(body, 36, 'HELLO');
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    let offset = 0;
    const protocolVersion = body[offset++];
    if (protocolVersion !== 1) {
      throw new HostLinkError(`HELLO: unsupported protocol version ${protocolVersion}`, { code: 'BAD_STATUS' });
    }
    const board = body[offset++];
    const slotCount = body[offset++];
    const bootSlot = body[offset++];
    const mcuUid = hex(body.subarray(offset, offset + 12));
    offset += 12;
    const schemaHash = view.getUint32(offset, true); offset += 4;
    const blobCapacity = view.getUint32(offset, true); offset += 4;
    const descriptorLen = view.getUint32(offset, true); offset += 4;
    const descriptorCrc = view.getUint32(offset, true); offset += 4;
    const maxBody = view.getUint16(offset, true); offset += 2;
    const liveSize = view.getUint16(offset, true); offset += 2;
    let moduleId;
    let moduleName;
    let fwVersion;
    let fwGit;
    let sdkVersion;
    [moduleId, offset] = readWireString(body, offset);
    [moduleName, offset] = readWireString(body, offset);
    [fwVersion, offset] = readWireString(body, offset);
    [fwGit, offset] = readWireString(body, offset);
    [sdkVersion] = readWireString(body, offset);
    return {
      board,
      slotCount,
      bootSlot,
      schemaHash,
      blobCapacity,
      descriptorLen,
      descriptorCrc,
      maxBody,
      liveSize,
      moduleId,
      moduleName,
      fwVersion,
      fwGit,
      sdkVersion,
      mcuUid,
    };
  }

  async getDescriptor(info) {
    return this.#transaction(async (send) => {
      if (info.descriptorLen === 0) return {};
      const chunkMaximum = info.maxBody - 7;
      if (chunkMaximum <= 0) {
        throw new HostLinkError('GET_DESCRIPTOR: maxBody too small', { code: 'BAD_STATUS' });
      }

      const bytes = new Uint8Array(info.descriptorLen);
      let offset = 0;
      while (offset < bytes.length) {
        const { body } = await send(
          COMMAND.GET_DESCRIPTOR,
          concat(u32(offset), u16(Math.min(chunkMaximum, bytes.length - offset))),
        );
        requireLength(body, 6, 'GET_DESCRIPTOR');
        const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
        const echoedOffset = view.getUint32(0, true);
        const length = view.getUint16(4, true);
        if (echoedOffset !== offset || length === 0 || length > body.length - 6 || offset + length > bytes.length) {
          throw new HostLinkError('GET_DESCRIPTOR: bad response range', { code: 'BAD_STATUS' });
        }
        bytes.set(body.subarray(6, 6 + length), offset);
        offset += length;
      }

      if (crc32(bytes) !== (info.descriptorCrc >>> 0)) {
        throw new HostLinkError('Descriptor CRC mismatch', { code: 'CRC' });
      }
      return JSON.parse(new TextDecoder().decode(bytes));
    });
  }

  async getLive(info) {
    return this.#transaction(async (send) => {
      const chunkMaximum = info.maxBody - 14;
      if (chunkMaximum <= 0) {
        throw new HostLinkError('GET_LIVE: maxBody too small', { code: 'BAD_STATUS' });
      }

      const bytes = new Uint8Array(info.liveSize);
      let offset = 0;
      while (offset < bytes.length) {
        const { body } = await send(
          COMMAND.GET_LIVE,
          concat(u32(offset), u16(Math.min(chunkMaximum, bytes.length - offset))),
        );
        requireLength(body, 13, 'GET_LIVE');
        const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
        const target = body[0];
        const echoedOffset = view.getUint32(1, true);
        const length = view.getUint16(5, true);
        const total = view.getUint16(7, true);
        const schemaHash = view.getUint32(9, true);
        if (
          target !== 0xff
          || echoedOffset !== offset
          || total !== bytes.length
          || schemaHash !== (info.schemaHash >>> 0)
          || length === 0
          || length > body.length - 13
          || offset + length > bytes.length
        ) {
          throw new HostLinkError('GET_LIVE: inconsistent snapshot', { code: 'BAD_STATUS' });
        }
        bytes.set(body.subarray(13, 13 + length), offset);
        offset += length;
      }
      return bytes;
    });
  }

  async writeBlob(info, target, bytes) {
    return this.#transaction(async (send) => {
      await send(
        COMMAND.BLOB_BEGIN,
        concat(Uint8Array.of(target), u32(bytes.length), u32(info.schemaHash)),
      );

      const chunkMaximum = info.maxBody - 4;
      if (chunkMaximum <= 0) {
        throw new HostLinkError('BLOB_DATA: maxBody too small', { code: 'BAD_STATUS' });
      }
      for (let offset = 0; offset < bytes.length; offset += chunkMaximum) {
        const chunk = bytes.subarray(offset, offset + chunkMaximum);
        await send(COMMAND.BLOB_DATA, concat(u32(offset), chunk));
      }
      await send(COMMAND.BLOB_COMMIT, u32(crc32(bytes)), COMMIT_TIMEOUT_MS);
    });
  }

  /**
   * Send one encoded PVXE bank into a Chopper slot while the module runs.
   *
   * One transaction holds the queue for the whole session, because the module keeps the receive buffer between
   * chunks: an interleaved request would either be refused Busy by that session or have its own answer stolen.
   * Every failure path aborts, since a module left holding a half-received session answers Busy to the next
   * attempt - which the user would read as an unexplained refusal of the file they were about to resend.
   *
   * The chunk body carries a per-chunk CRC over the payload bytes only, and the sequence number is a chunk
   * index rather than a byte offset like the blob commands; telling those two apart is what the module checks.
   *
   * The commit result is returned rather than interpreted: GridAdapted is a success that says which grid the
   * pattern landed on, and NoGrid is a refusal with a reason - the slot has no loop for it to follow.
   */
  async uploadPvxe(info, slot, bytes, { signal, onProgress = () => {} } = {}) {
    if (slot !== 0 && slot !== 1) {
      throw new HostLinkError('PVXE pattern slots are the two Choppers, 0 and 1', { code: 'BAD_ARGS' });
    }
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > PVXE_MAX_BYTES)
      throw new HostLinkError(`PVXE bank must be 1 to ${PVXE_MAX_BYTES} bytes`, { code: 'BAD_ARGS' });
    // Four bytes of sequence and four of CRC precede the payload inside one frame body.
    const chunkMaximum = info.maxBody - 8;
    if (chunkMaximum <= 0) throw new HostLinkError('PVXE_CHUNK: maxBody too small', { code: 'BAD_STATUS' });
    return this.#transaction(async (send) => {
      const abort = async () => {
        try { await send(COMMAND.PVXE_ABORT, new Uint8Array(0)); } catch { /* the failure being reported wins */ }
      };
      try {
        await send(COMMAND.PVXE_BEGIN, Uint8Array.of(slot));
        let index = 0;
        for (let offset = 0; offset < bytes.length; offset += chunkMaximum, index += 1) {
          if (signal?.aborted) {
            await abort();
            throw new HostLinkError('PVXE upload cancelled', { code: 'CANCELLED' });
          }
          const chunk = bytes.subarray(offset, offset + chunkMaximum);
          const { body } = await send(COMMAND.PVXE_CHUNK, concat(u32(index), u32(crc32(chunk)), chunk));
          requireLength(body, 8, 'PVXE_CHUNK');
          const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
          onProgress({
            sent: Math.min(offset + chunk.length, bytes.length),
            total: bytes.length,
            // The module's own count: trusting it is what makes a resumed duplicate look like progress.
            received: view.getUint32(4, true),
          });
        }
        const committed = await send(COMMAND.PVXE_COMMIT, new Uint8Array(0), COMMIT_TIMEOUT_MS);
        const reply = committed.body;
        requireLength(reply, 21, 'PVXE_COMMIT');
        const view = new DataView(reply.buffer, reply.byteOffset, reply.byteLength);
        const code = reply[0];
        if (code === 2) return { result: 'noGrid', code, reason: 'the slot has no loop for the pattern to follow' };
        if (code > 1) throw new HostLinkError(`PVXE_COMMIT returned an unknown result ${code}`, { code: 'BAD_STATUS' });
        return {
          result: PVXE_RESULTS[code],
          code,
          authoredQuarters: view.getUint32(1, true),
          loadedQuarters: view.getUint32(5, true),
          windowQuarters: view.getUint32(9, true),
          authoredFrames: view.getUint32(13, true),
          loadedFrames: view.getUint32(17, true),
        };
      } catch (error) {
        await abort();
        throw error;
      }
    });
  }

  async saveToSlot(slot) {
    await this.request(COMMAND.SAVE_TO_SLOT, Uint8Array.of(slot), COMMIT_TIMEOUT_MS);
  }

  async loadFromSlot(slot) {
    await this.request(COMMAND.LOAD_FROM_SLOT, Uint8Array.of(slot), COMMIT_TIMEOUT_MS);
  }

  async reboot(mode) {
    await this.request(COMMAND.REBOOT, Uint8Array.of(mode));
  }

  async close() {
    await this.transport.close();
  }

  #requestNow(type, body, timeoutMs) {
    const seq = this.sequence;
    this.sequence = (this.sequence + 1) & 0xffff;
    if (this.sequence === 0) this.sequence = 1;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.seq !== seq) return;
        this.pending = null;
        reject(new HostLinkError(`No reply to command 0x${type.toString(16)}`, { code: 'TIMEOUT' }));
      }, timeoutMs);

      this.pending = { seq, type, resolve, reject, timer };
      Promise.resolve(this.transport.write(buildFrame(type, seq, body))).catch((error) => {
        if (this.pending?.seq !== seq) return;
        clearTimeout(timer);
        this.pending = null;
        reject(error instanceof HostLinkError ? error : new HostLinkError(error.message, { code: error.code }));
      });
    });
  }

  #onData(bytes) {
    for (const frame of this.parser.push(bytes)) {
      const pending = this.pending;
      if (!pending || frame.seq !== pending.seq) continue;
      if (frame.type !== ERROR_TYPE && frame.type !== (pending.type | RESPONSE_FLAG)) continue;

      clearTimeout(pending.timer);
      this.pending = null;
      if (frame.body.length === 0) {
        pending.reject(new HostLinkError('Empty reply from the device', { code: 'BAD_STATUS' }));
        continue;
      }
      const status = frame.body[0];
      if (frame.type === ERROR_TYPE || status !== 0) {
        const name = STATUS_NAMES[status] ?? `DEVICE_ERROR_${status}`;
        pending.reject(new HostLinkError(`The device returned ${name}`, { status, code: 'BAD_STATUS' }));
        continue;
      }
      pending.resolve({ status, body: frame.body.slice(1) });
    }
  }
}
