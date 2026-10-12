import { siteUrl } from './site.js';
const WORKLET = `
class PentavoxAudition extends AudioWorkletProcessor {
  constructor(options) {
    super(); this.modules = options.processorOptions.modules; this.instances = {}; this.current = null; this.frame = null; this.position = 12;
    this.imports = { wasi_snapshot_preview1: new Proxy({}, {get: () => () => 0}), env: new Proxy({}, {get: () => () => 0}) };
    this.port.onmessage = ({data}) => {
      if (data.type === 'engine') { const e = this.get(data.set); e.ae_set_engine(data.slot); e.ae_set_stereo(data.stereo ? 1 : 0); this.current = data.set; }
      if (data.type === 'on' && this.current) this.get(this.current).ae_note_on(data.note, data.velocity);
      if (data.type === 'off' && this.current) this.get(this.current).ae_note_off();
    };
  }
  get(name) {
    if (!this.instances[name]) { const instance = new WebAssembly.Instance(this.modules[name], this.imports); const e = instance.exports; if (e._initialize) e._initialize(); e.ae_init(); e.ae_set_params(.5,.5,.5,.5,.5); this.instances[name] = e; }
    return this.instances[name];
  }
  process(inputs, outputs) {
    const left = outputs[0][0], right = outputs[0][1] || left, e = this.current ? this.get(this.current) : null;
    for (let i = 0; i < left.length; ++i) { if (!e) { left[i] = right[i] = 0; continue; } if (this.position >= 12) { e.ae_render_block(); this.frame = new Float32Array(e.memory.buffer, e.ae_out(), 24); this.position = 0; } left[i] = this.frame[this.position * 2] * .8; right[i] = this.frame[this.position * 2 + 1] * .8; ++this.position; }
    return true;
  }
}
registerProcessor('pentavox-audition', PentavoxAudition);`;

export class EngineAudition {
  constructor(engines, { fetchImpl = globalThis.fetch } = {}) {
    this.byId = new Map(engines.map((engine) => [engine.id, engine]));
    // Not `this.fetch = fetchImpl`: calling window.fetch with `this` = this object throws "Illegal invocation".
    this.fetch = (...args) => fetchImpl(...args);
    this.context = null;
    this.node = null;
    this.timer = null;
  }

  async ensure() {
    if (this.node) return;
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error('Web Audio is not available in this browser');
    this.context = new AudioContext({ sampleRate: 48000 });
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await this.context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const modules = {};
    await Promise.all(['stock', 'set1', 'set2', 'set3'].map(async (set) => {
      const response = await this.fetch(siteUrl(`engines_${set}.wasm`));
      if (!response.ok) throw new Error(`Could not load engines_${set}.wasm`);
      modules[set] = await WebAssembly.compile(await response.arrayBuffer());
    }));
    this.node = new AudioWorkletNode(this.context, 'pentavox-audition', { outputChannelCount: [2], processorOptions: { modules } });
    this.node.connect(this.context.destination);
    await this.context.resume();
  }

  async preview(id, stereo = false) {
    const engine = this.byId.get(id);
    if (!engine) throw new TypeError(`unknown engine: ${id}`);
    await this.ensure();
    clearTimeout(this.timer);
    this.node.port.postMessage({ type: 'engine', set: engine.set, slot: engine.slot, stereo });
    this.node.port.postMessage({ type: 'on', note: 48, velocity: .8 });
    this.timer = setTimeout(() => this.node?.port.postMessage({ type: 'off' }), 900);
  }
}
