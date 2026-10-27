// Optional neural activations for the hybrid detector: ADTOF Frame_RNN (ONNX) run in the browser with onnxruntime-web (WASM, one thread).
// Loaded lazily; any failure returns null and the caller falls back to the rule detector.
import { resampleLinear } from './wav.js';
const ADTOF_RATE = 44100;
let sessionPromise = null;

function loadSession(base) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import(new URL('./ort/ort.wasm.min.mjs', base).href);
      ort.env.wasm.wasmPaths = new URL('./ort/', base).href;
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create(new URL('./adtof/adtof_frame_rnn.onnx', base).href, { executionProviders: ['wasm'] });
      return { ort, session };
    })();
    sessionPromise.catch(() => { sessionPromise = null; });
  }
  return sessionPromise;
}

/** Mono 44.1 kHz in, frames x 5 activations (kick, snare, tom, hat, cymbal) at 100 fps out; null when the engine is unavailable. */
export async function adtofActivations(channels, sampleRate, { base = new URL('../vendor/', import.meta.url) } = {}) {
  try {
    const frames = channels[0].length; const mono = new Float32Array(frames);
    for (const channel of channels) for (let i = 0; i < frames; i += 1) mono[i] += channel[i] / channels.length;
    const audio = sampleRate === ADTOF_RATE ? { channels: [mono], sampleRate } : resampleLinear({ channels: [mono], sampleRate }, ADTOF_RATE);
    const { ort, session } = await loadSession(base);
    const out = await session.run({ waveform: new ort.Tensor('float32', audio.channels[0], [1, audio.channels[0].length]) });
    const flat = out.activations.data; const rows = out.activations.dims[1]; const result = [];
    for (let i = 0; i < rows; i += 1) result.push(Array.from(flat.subarray(i * 5, i * 5 + 5)));
    return result;
  } catch (error) {
    console.warn('Neural detector unavailable:', error); return null;
  }
}
