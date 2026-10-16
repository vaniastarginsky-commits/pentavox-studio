/** A MIDI message a route can learn: a controller change (cc 0..119) or a note-on (its velocity, cc 128). channel is 1..16. */
export function parseLearnMessage(data) {
  if (!data || data.length < 3) return null;
  const kind = data[0] & 0xf0;
  const channel = (data[0] & 0x0f) + 1;
  if (kind === 0xb0 && data[1] < 120) return { cc: data[1], channel };
  if (kind === 0x90 && data[2] > 0) return { cc: 128, channel };   // the table's "note velocity" source
  return null;
}

export const LEARN_TIMEOUT_MS = 15000;

/**
 * Waits for the next learnable message from any MIDI input of this computer (Web MIDI: Chrome and Edge ask for permission the first
 * time). Resolves with {cc, channel}; rejects on timeout or when cancelled through `signal`.
 */
export async function learnNextMessage({ signal, timeoutMs = LEARN_TIMEOUT_MS, midi = globalThis.navigator, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (typeof midi?.requestMIDIAccess !== 'function') throw new Error('This browser has no Web MIDI; use Chrome or Edge');
  const access = await midi.requestMIDIAccess();
  const inputs = [...access.inputs.values()];
  if (inputs.length === 0) throw new Error('No MIDI input found on this computer. Connect a controller first');
  return new Promise((resolve, reject) => {
    let timer;
    const done = (finish) => {
      for (const input of inputs) input.onmidimessage = null;
      clearTimer(timer);
      signal?.removeEventListener('abort', onAbort);
      finish();
    };
    const onAbort = () => done(() => reject(new DOMException('cancelled', 'AbortError')));
    for (const input of inputs) {
      input.onmidimessage = (event) => {
        const learned = parseLearnMessage(event.data);
        if (learned) done(() => resolve(learned));
      };
    }
    timer = setTimer(() => done(() => reject(new Error('No controller moved in 15 seconds'))), timeoutMs);
    if (signal?.aborted) onAbort(); else signal?.addEventListener('abort', onAbort);
  });
}
