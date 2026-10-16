// Plays DX7 voices with the real Plaits six-op engine (dx7_engine.wasm, built from vendor/plaits) in an AudioWorklet.
import { voiceKey } from './model/dx7_syx.js';

const WORKLET = `
class Dx7Proc extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const imports = { wasi_snapshot_preview1: new Proxy({}, { get: () => () => 0 }), env: new Proxy({}, { get: () => () => 0 }) };
    this.e = new WebAssembly.Instance(options.processorOptions.module, imports).exports;
    if (this.e._initialize) this.e._initialize();
    this.e.dx7_init();
    this.pos = 0; this.avail = 0; this.frame = null;
    this.port.onmessage = ({ data }) => {
      const e = this.e;
      if (data.t === 'load') { new Uint8Array(e.memory.buffer, e.dx7_bank_buffer(), 4096).set(data.data); e.dx7_load(data.n); }
      else if (data.t === 'on') e.dx7_note_on(data.note, data.vel, data.idx);
      else if (data.t === 'off') e.dx7_note_off();
      else if (data.t === 'params') { e.dx7_set_timbre(data.timbre); e.dx7_set_morph(data.morph); }
    };
  }
  process(inputs, outputs) {
    const left = outputs[0][0];
    for (let i = 0; i < left.length; i += 1) {
      if (this.pos >= this.avail) { this.e.dx7_render_block(); this.frame = new Float32Array(this.e.memory.buffer, this.e.dx7_out(), 12); this.pos = 0; this.avail = 12; }
      left[i] = this.frame[this.pos++] * 0.8;
    }
    if (outputs[0].length > 1) outputs[0][1].set(left);
    return true;
  }
}
registerProcessor('dx7-proc', Dx7Proc);`;

export class DX7Audition {
  constructor({ fetchImpl = globalThis.fetch?.bind(globalThis), AudioContextClass = globalThis.AudioContext, AudioWorkletNodeClass = globalThis.AudioWorkletNode,
    compile = (bytes) => WebAssembly.compile(bytes), wasmUrl = new URL('./assets/dx7_engine.wasm', import.meta.url).href } = {}) {
    Object.assign(this, { fetchImpl, AudioContextClass, AudioWorkletNodeClass, compile, wasmUrl });
    this.node = null; this.loaded = '';
  }

  get ready() { return this.node !== null; }

  async start() {
    if (this.node) return;
    const response = await this.fetchImpl(this.wasmUrl);
    if (!response.ok) throw new Error(`Could not load dx7_engine.wasm (HTTP ${response.status}).`);
    const module = await this.compile(await response.arrayBuffer());
    const context = new this.AudioContextClass({ sampleRate: 48000 });
    const url = (globalThis.URL?.createObjectURL && globalThis.Blob) ? URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })) : 'data:text/javascript,';
    await context.audioWorklet.addModule(url);
    const node = new this.AudioWorkletNodeClass(context, 'dx7-proc', { outputChannelCount: [2], processorOptions: { module } });
    node.connect(context.destination);
    await context.resume();
    this.context = context; this.node = node;
  }

  /** Up to 32 voices; the engine picks one by index. Sending the same set again is skipped. */
  load(voices) {
    if (!this.node) return;
    const signature = voices.map(voiceKey).join('|');
    if (signature === this.loaded) return;
    const data = new Uint8Array(4096);
    voices.slice(0, 32).forEach((voice, i) => data.set(voice, i * 128));
    this.node.port.postMessage({ t: 'load', data, n: Math.min(32, voices.length) });
    this.loaded = signature;
  }

  noteOn(note, velocity, index) { this.node?.port.postMessage({ t: 'on', note, vel: velocity, idx: index }); }
  noteOff() { this.node?.port.postMessage({ t: 'off' }); }
  setParams(timbre, morph) { this.node?.port.postMessage({ t: 'params', timbre, morph }); }
}
