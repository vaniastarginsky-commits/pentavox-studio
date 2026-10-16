import { crc32 } from '../hostlink/frame.js';

const encoder = new TextEncoder();
function concat(parts) { const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }

export function createStoreZip(files) {
  const local = [];
  const central = [];
  let localOffset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name.replaceAll('\\', '/'));
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);
    const header = new Uint8Array(30 + name.length); const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true); view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true); header.set(name, 30); local.push(header, data);
    const entry = new Uint8Array(46 + name.length); const ev = new DataView(entry.buffer);
    ev.setUint32(0, 0x02014b50, true); ev.setUint16(4, 20, true); ev.setUint16(6, 20, true); ev.setUint16(8, 0x0800, true);
    ev.setUint16(10, 0, true); ev.setUint32(16, crc, true); ev.setUint32(20, data.length, true); ev.setUint32(24, data.length, true);
    ev.setUint16(28, name.length, true); ev.setUint32(42, localOffset, true); entry.set(name, 46); central.push(entry);
    localOffset += header.length + data.length;
  }
  const centralBytes = concat(central); const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralBytes.length, true); endView.setUint32(16, localOffset, true);
  return concat([...local, centralBytes, end]);
}
