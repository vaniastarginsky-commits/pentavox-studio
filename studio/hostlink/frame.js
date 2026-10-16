const PROTOCOL_VERSION = 1;
const MAX_ACCUMULATED_BYTES = 2068;
const MAX_BODY_BYTES = 2048;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes, seed = 0) {
  let crc = ~seed >>> 0;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return ~crc >>> 0;
}

export function cobsEncode(input) {
  const output = new Uint8Array(input.length + Math.ceil(input.length / 254) + 1);
  let outputIndex = 0;
  let codeIndex = outputIndex++;
  let code = 1;

  for (const byte of input) {
    if (byte === 0) {
      output[codeIndex] = code;
      codeIndex = outputIndex++;
      code = 1;
    } else {
      output[outputIndex++] = byte;
      code += 1;
      if (code === 0xff) {
        output[codeIndex] = code;
        codeIndex = outputIndex++;
        code = 1;
      }
    }
  }

  output[codeIndex] = code;
  return output.subarray(0, outputIndex);
}

export function cobsDecode(input) {
  if (input.length === 0) return null;

  const output = new Uint8Array(input.length);
  let outputIndex = 0;
  let inputIndex = 0;
  while (inputIndex < input.length) {
    const code = input[inputIndex++];
    if (code === 0) return null;

    const runLength = code - 1;
    if (inputIndex + runLength > input.length) return null;
    for (let i = 0; i < runLength; i += 1) {
      const byte = input[inputIndex++];
      if (byte === 0) return null;
      output[outputIndex++] = byte;
    }
    if (code !== 0xff && inputIndex < input.length) output[outputIndex++] = 0;
  }

  return output.subarray(0, outputIndex);
}

export function buildFrame(type, seq, body) {
  const decoded = new Uint8Array(6 + body.length + 4);
  const view = new DataView(decoded.buffer);
  decoded[0] = PROTOCOL_VERSION;
  decoded[1] = type;
  view.setUint16(2, seq, true);
  view.setUint16(4, body.length, true);
  decoded.set(body, 6);
  view.setUint32(6 + body.length, crc32(decoded.subarray(0, 6 + body.length)), true);

  const encoded = cobsEncode(decoded);
  const framed = new Uint8Array(encoded.length + 1);
  framed.set(encoded);
  return framed;
}

export class FrameParser {
  constructor() {
    this.accumulator = [];
    this.overflow = false;
  }

  push(bytes) {
    const frames = [];
    for (const byte of bytes) {
      if (byte !== 0) {
        if (this.accumulator.length < MAX_ACCUMULATED_BYTES) {
          this.accumulator.push(byte);
        } else {
          this.overflow = true;
        }
        continue;
      }

      const encoded = Uint8Array.from(this.accumulator);
      const overflow = this.overflow;
      this.accumulator = [];
      this.overflow = false;
      if (overflow || encoded.length === 0) continue;

      const decoded = cobsDecode(encoded);
      if (!decoded || decoded.length < 10) continue;

      const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
      const bodyLength = decoded.length - 10;
      if (
        bodyLength > MAX_BODY_BYTES
        || decoded[0] !== PROTOCOL_VERSION
        || view.getUint16(4, true) !== bodyLength
        || crc32(decoded.subarray(0, decoded.length - 4)) !== view.getUint32(decoded.length - 4, true)
      ) {
        continue;
      }

      frames.push({
        type: decoded[1],
        seq: view.getUint16(2, true),
        body: decoded.slice(6, 6 + bodyLength),
      });
    }
    return frames;
  }
}
