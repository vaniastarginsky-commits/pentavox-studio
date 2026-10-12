// Flash a firmware image over USB DFU (DfuSe) from the browser, with WebUSB. The STM32 in DFU mode is 0483:df11; this does what
// `dfu-util -a 0 -s 0x90040000:leave -D full.bin` does (tools/engine_composer/serve.py flash_job), without dfu-util.
//
// Safety: nothing is written unless the device's own memory layout (its alt-setting name string) says that the whole target range is
// erasable/writable flash. A device that describes something else gets an error, not a blind write.

export const DFU_VENDOR = 0x0483;
export const DFU_PRODUCT = 0xdf11;
export const FIRMWARE_ADDRESS = 0x90040000;

const REQ = { DNLOAD: 1, GETSTATUS: 3, CLRSTATUS: 4, ABORT: 6 };
const STATE = { dfuIDLE: 2, dfuDNLOAD_SYNC: 3, dfuDNBUSY: 4, dfuDNLOAD_IDLE: 5, dfuMANIFEST_SYNC: 6, dfuMANIFEST: 7, dfuMANIFEST_WAIT_RESET: 8, dfuERROR: 10 };
const CMD = { SET_ADDRESS: 0x21, ERASE: 0x41 };

/**
 * Parse a DfuSe alt-setting name: "@Internal Flash /0x08000000/04*016Kg,01*064Kg,07*128Kg" -> { name, segments: [{ start, end, sectorSize, erasable, writable }] }.
 * The name may carry several address groups: "@Flash /0x90000000/64*4Kg/0x90040000/60*64Kg/0x90400000/60*64Kg".
 */
export function parseMemoryLayout(descriptor) {
  const match = /^@([^/]*)((?:\/\s*0x[0-9a-fA-F]+\s*\/[^/]+)+)\s*$/.exec((descriptor ?? '').trim());
  if (!match) return null;
  const segments = [];
  for (const group of match[2].matchAll(/\/\s*(0x[0-9a-fA-F]+)\s*\/([^/]+)/g)) {
    let address = Number.parseInt(group[1], 16);
    for (const part of group[2].split(',')) {
      const m = /^\s*(\d+)\s*\*\s*(\d+)\s*([BKM ])?\s*([a-gA-G])\s*$/.exec(part);
      if (!m) return null;
      const count = Number(m[1]);
      const unit = { K: 1024, M: 1024 * 1024 }[m[3]?.trim()] ?? 1;
      const sectorSize = Number(m[2]) * unit;
      const flags = m[4].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0) + 1;   // a=1 readable, b=2 erasable, c=3 ... g=7 (bit 0 read, 1 erase, 2 write)
      segments.push({ start: address, end: address + count * sectorSize, sectorSize, readable: (flags & 1) !== 0, erasable: (flags & 2) !== 0, writable: (flags & 4) !== 0 });
      address += count * sectorSize;
    }
  }
  return { name: match[1].trim(), segments };
}

/** Sector start addresses to erase for [address, address + length); throws unless every byte lies in erasable + writable flash. */
export function planErase(layout, address, length) {
  if (!layout) throw new Error('The DFU device did not describe its memory layout; refusing to write');
  const end = address + length;
  const sectors = [];
  let covered = address;
  for (const segment of layout.segments) {
    if (segment.end <= address || segment.start >= end) continue;
    if (!segment.erasable || !segment.writable) throw new Error(`0x${segment.start.toString(16)} is not writable flash on this DFU device`);
    if (segment.start > covered) break;
    for (let sector = segment.start; sector < segment.end; sector += segment.sectorSize) {
      if (sector + segment.sectorSize <= address || sector >= end) continue;
      sectors.push(sector);
    }
    covered = Math.max(covered, Math.min(segment.end, end));
  }
  if (covered < end) throw new Error(`The image (0x${address.toString(16)} + ${length} bytes) does not fit the flash this DFU device describes`);
  return sectors;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const le32 = (value) => [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];

export class DfuDevice {
  constructor(usbDevice, { sleep = wait } = {}) {
    this.device = usbDevice;
    this.sleep = sleep;
    this.interfaceNumber = 0;
    this.alternate = 0;
    this.transferSize = 1024;
  }

  /** Open the device, claim the DFU interface (alt 0) and read its layout. */
  async open() {
    const { device } = this;
    await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);
    const found = device.configuration.interfaces.find((iface) => iface.alternates.some((alt) => alt.interfaceClass === 0xfe && alt.interfaceSubclass === 1));
    if (!found) throw new Error('This USB device has no DFU interface');
    this.interfaceNumber = found.interfaceNumber;
    await device.claimInterface(this.interfaceNumber);
    const alt = found.alternates.find((a) => a.alternateSetting === this.alternate) ?? found.alternates[0];
    await device.selectAlternateInterface(this.interfaceNumber, alt.alternateSetting);
    let name = alt.interfaceName;
    let fallback = '';
    if (!name) {      // Chrome leaves interfaceName empty for some devices that dfu-util reads fine: read the string descriptor ourselves
      try { name = await this.readInterfaceName(this.interfaceNumber, alt.alternateSetting); fallback = ', read from the descriptors'; } catch (error) { fallback = `, descriptor read failed: ${error.message ?? error}`; }
    }
    this.layout = parseMemoryLayout(name);
    this.layoutSource = `alt ${alt.alternateSetting} of ${found.alternates.length}, name ${JSON.stringify(name ?? null)}${fallback}`;   // shown when the layout cannot be read
    return this;
  }

  async getDescriptor(type, index, langId, length) {
    const result = await this.device.controlTransferIn({ requestType: 'standard', recipient: 'device', request: 6, value: (type << 8) | index, index: langId }, length);
    if (result.status !== 'ok' || !result.data || result.data.byteLength < 2) throw new Error(`GET_DESCRIPTOR ${type}/${index} failed`);
    return new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
  }

  /** The name string of an interface/alt setting, found through the configuration descriptor (iInterface) and the string descriptor. */
  async readInterfaceName(interfaceNumber, alternate) {
    const head = await this.getDescriptor(2, 0, 0, 4);
    const total = head[2] | (head[3] << 8);
    const config = await this.getDescriptor(2, 0, 0, total);
    let iInterface = 0;
    for (let i = 0; i + 9 <= config.length && config[i] > 0; i += config[i]) {
      if (config[i + 1] === 4 && config[i + 2] === interfaceNumber && config[i + 3] === alternate) { iInterface = config[i + 8]; break; }
    }
    if (!iInterface) throw new Error('the interface has no name string');
    const languages = await this.getDescriptor(3, 0, 0, 255);
    const langId = languages.length >= 4 ? languages[2] | (languages[3] << 8) : 0x0409;
    const text = await this.getDescriptor(3, iInterface, langId, 255);
    return new TextDecoder('utf-16le').decode(text.subarray(2, Math.min(text[0], text.length)));
  }

  async close() { try { await this.device.close(); } catch { /* already gone */ } }

  controlOut(request, value, data) {
    return this.device.controlTransferOut({ requestType: 'class', recipient: 'interface', request, value, index: this.interfaceNumber }, data);
  }

  async status() {
    const result = await this.device.controlTransferIn({ requestType: 'class', recipient: 'interface', request: REQ.GETSTATUS, value: 0, index: this.interfaceNumber }, 6);
    if (result.status !== 'ok' || result.data.byteLength < 6) throw new Error('DFU GETSTATUS failed');
    const d = result.data;
    return { status: d.getUint8(0), pollTimeout: d.getUint8(1) | (d.getUint8(2) << 8) | (d.getUint8(3) << 16), state: d.getUint8(4) };
  }

  /** Poll until the device leaves dfuDNBUSY; throws on an error status. */
  async settle(what) {
    for (let guard = 0; guard < 2000; guard += 1) {
      const s = await this.status();
      if (s.state === STATE.dfuERROR || s.status !== 0) throw new Error(`DFU error during ${what} (status ${s.status}, state ${s.state})`);
      if (s.state !== STATE.dfuDNBUSY && s.state !== STATE.dfuDNLOAD_SYNC && s.state !== STATE.dfuMANIFEST_SYNC) return s;
      await this.sleep(Math.max(s.pollTimeout, 1));
    }
    throw new Error(`DFU timed out during ${what}`);
  }

  async command(code, address, what) {
    await this.controlOut(REQ.DNLOAD, 0, Uint8Array.from([code, ...le32(address)]));
    await this.settle(what);
  }

  async clearError() {
    let s = await this.status();
    if (s.state === STATE.dfuERROR) { await this.device.controlTransferOut({ requestType: 'class', recipient: 'interface', request: REQ.CLRSTATUS, value: 0, index: this.interfaceNumber }); s = await this.status(); }
    if (s.state !== STATE.dfuIDLE) { await this.device.controlTransferOut({ requestType: 'class', recipient: 'interface', request: REQ.ABORT, value: 0, index: this.interfaceNumber }); await this.status(); }
  }

  /**
   * Erase the sectors under the image, write it, then leave DFU (the module boots the new firmware).
   * onProgress({ phase: 'erase' | 'write' | 'leave', done, total }).
   */
  async flash(image, address = FIRMWARE_ADDRESS, onProgress = () => {}) {
    if (!this.layout) throw new Error(`The DFU device did not describe its memory layout; refusing to write (${this.layoutSource})`);
    const sectors = planErase(this.layout, address, image.byteLength);   // throws before anything is touched
    await this.clearError();
    for (let i = 0; i < sectors.length; i += 1) {
      onProgress({ phase: 'erase', done: i, total: sectors.length });
      await this.command(CMD.ERASE, sectors[i], `erase at 0x${sectors[i].toString(16)}`);
    }
    onProgress({ phase: 'erase', done: sectors.length, total: sectors.length });
    await this.command(CMD.SET_ADDRESS, address, 'set address');
    const size = this.transferSize;
    const blocks = Math.ceil(image.byteLength / size);
    for (let block = 0; block < blocks; block += 1) {
      onProgress({ phase: 'write', done: block, total: blocks });
      await this.controlOut(REQ.DNLOAD, block + 2, image.subarray(block * size, (block + 1) * size));
      await this.settle(`write block ${block}`);
    }
    onProgress({ phase: 'write', done: blocks, total: blocks });
    // Leave: set the pointer to the start address, then an empty download starts the manifestation (the device resets, so a failing
    // GETSTATUS afterwards is the expected end).
    onProgress({ phase: 'leave', done: 0, total: 1 });
    await this.command(CMD.SET_ADDRESS, address, 'set leave address');
    await this.controlOut(REQ.DNLOAD, 0, new Uint8Array(0));
    try { await this.status(); } catch { /* the device reset */ }
    onProgress({ phase: 'leave', done: 1, total: 1 });
  }
}

/** Ask the user to pick the DFU device (must run from a click). */
export async function requestDfuDevice(usb = globalThis.navigator?.usb) {
  if (!usb) throw new Error('This browser has no WebUSB. Use Chrome or Edge.');
  const device = await usb.requestDevice({ filters: [{ vendorId: DFU_VENDOR, productId: DFU_PRODUCT }] });
  return new DfuDevice(device);
}

/** Devices already allowed for this site (to show "In DFU" without a prompt). */
export async function pairedDfuDevices(usb = globalThis.navigator?.usb) {
  if (!usb) return [];
  const devices = await usb.getDevices();
  return devices.filter((d) => d.vendorId === DFU_VENDOR && d.productId === DFU_PRODUCT);
}
