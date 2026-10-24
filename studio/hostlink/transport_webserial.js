import { HostLinkError } from './client.js';

const ALCHEMY_VENDOR_ID = 0x0483;

export class WebSerialTransport {
  constructor(port) {
    this.port = port;
    this.dataCallback = () => {};
    this.reader = null;
    this.readTask = null;
    this.closing = false;
    this.disconnectCallback = () => {};
  }

  /** `interactive: false` never opens the port chooser: it takes a port this site was allowed before, or throws NO_PORT (for the automatic connect). */
  static async connect({ interactive = true } = {}) {
    if (!globalThis.navigator?.serial) {
      throw new HostLinkError('Web Serial is not available. Open Studio in Chrome or Edge.', {
        code: 'UNSUPPORTED',
      });
    }

    const authorised = (await navigator.serial.getPorts()).filter(
      (candidate) => candidate.getInfo?.().usbVendorId === ALCHEMY_VENDOR_ID,
    );
    let port = authorised.length === 1 || (!interactive && authorised.length > 0) ? authorised[0] : null;
    if (!port && !interactive) throw new HostLinkError('No module has been allowed yet', { code: 'NO_PORT' });
    if (!port) {
      try {
        port = await navigator.serial.requestPort({ filters: [{ usbVendorId: ALCHEMY_VENDOR_ID }] });
      } catch (error) {
        if (error.name !== 'NotFoundError') throw error;
        port = await navigator.serial.requestPort();
      }
    }

    try {
      // bufferSize: Chrome's default is 255 bytes. At file-transfer speeds (100 KB/s) the serial driver can outrun a
      // reader that small and drop bytes, which looks like a reply that never arrives. 1 MiB removes that limit.
      await port.open({ baudRate: 115200, bufferSize: 1 << 20 });
    } catch (error) {
      if (error.name === 'NetworkError' || error.name === 'InvalidStateError') {
        throw new HostLinkError(
          'Port busy. Close the official programmer and any other tabs using the module.',
          { code: 'BUSY_PORT' },
        );
      }
      throw error;
    }

    const transport = new WebSerialTransport(port);
    transport.readTask = transport.#readLoop();
    return transport;
  }

  onData(callback) {
    this.dataCallback = callback;
  }

  onDisconnect(callback) {
    this.disconnectCallback = callback;
  }

  async write(bytes) {
    if (!this.port.writable) throw new HostLinkError('The serial port is disconnected', { code: 'DISCONNECTED' });
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  }

  async close() {
    this.closing = true;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // The port may already be gone.
      }
    }
    try {
      await this.readTask;
    } catch {
      // Closing or unplugging terminates the read loop.
    }
    if (this.port.readable || this.port.writable) await this.port.close();
  }

  async #readLoop() {
    while (!this.closing && this.port.readable) {
      const reader = this.port.readable.getReader();
      this.reader = reader;
      try {
        while (!this.closing) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value?.length) this.dataCallback(value);
        }
      } catch {
        if (!this.closing) break;
      } finally {
        reader.releaseLock();
        if (this.reader === reader) this.reader = null;
      }
    }
    if (!this.closing) this.disconnectCallback();
  }
}

export async function openWebSerial(options) {
  return WebSerialTransport.connect(options);
}
