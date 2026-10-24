import { indexDescriptor, readField, writeField } from '../model/blob.js';
import { panelPages } from './manual_vm.js';

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const perfKey = (page, pot) => `${page}:${pot}`;

/** The indexed f32 fields that are physically controlled by the performance pager. */
export function perfFieldMap(descriptor) {
  const component = descriptor?.components?.find((item) => item.id === 'perf' && item.kind === 'pager');
  // The offline snapshot lists the same controls without field ids: nothing live to index.
  if (!component || !(component.fields ?? []).every((field) => typeof field.id === 'string')) return new Map();
  const index = indexDescriptor(descriptor);
  const indexed = new Map([...index.values()].filter((field) => field.comp === component.id).map((field) => [field.id, field]));
  const fields = new Map();
  const pages = panelPages(descriptor);
  for (const source of component.fields ?? []) {
    const field = indexed.get(source.id);
    if (!field || field.type !== 'f32' || !Number.isInteger(field.page) || !Number.isInteger(field.pot)) continue;
    const page = pages.find((page) => (page.perfIndex === undefined ? page.index : page.perfIndex) === field.page);
    if (page?.pots[field.pot]?.live === false) continue;
    fields.set(perfKey(page?.index ?? field.page, field.pot), field);
  }
  return fields;
}

export const percentText = (value) => `${Math.round(clamp01(value) * 100)}%`;

/** Decode just the performance controls; polling this function has no write side effects. */
export function decodePerf(descriptor, bytes) {
  const values = new Map();
  for (const [key, field] of perfFieldMap(descriptor)) {
    const value = clamp01(readField(bytes, field));
    values.set(key, { field, value, text: percentText(value) });
  }
  return values;
}

/**
 * Single-flight live reader/writer for the dock. Reads run at roughly 10 Hz while active. Writes are fresh-read/merge/write
 * transactions to live target 0xff and are only queued by an explicit knob edit.
 */
export class PanelLive {
  constructor({
    getSession,
    onValues = () => {},
    onError = () => {},
    isVisible = () => true,
    intervalMs = 100,
    writeDelayMs = 80,
    setTimer = (...args) => globalThis.setTimeout(...args),
    clearTimer = (...args) => globalThis.clearTimeout(...args),
  }) {
    this.getSession = getSession;
    this.onValues = onValues;
    this.onError = onError;
    this.isVisible = isVisible;
    this.intervalMs = intervalMs;
    this.writeDelayMs = writeDelayMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.pending = new Map();
    this.active = false;
    this.operation = null;
    this.pollTimer = null;
    this.writeTimer = null;
  }

  setActive(active) {
    this.active = Boolean(active);
    this.#clearPoll();
    if (!this.active) {
      this.#clearWrite();
      this.pending.clear();
      return;
    }
    this.#schedulePoll(0);
  }

  #session() {
    const session = this.getSession?.();
    return session?.client && session?.info && session?.descriptor ? session : null;
  }

  #canRun(session = this.#session()) {
    return Boolean(this.active && this.isVisible() && session && !session.busy);
  }

  #canWrite(session = this.#session()) {
    return Boolean(this.#canRun(session) && !session.readOnly && !session.pending);
  }

  #clearPoll() {
    if (this.pollTimer !== null) this.clearTimer(this.pollTimer);
    this.pollTimer = null;
  }

  #clearWrite() {
    if (this.writeTimer !== null) this.clearTimer(this.writeTimer);
    this.writeTimer = null;
  }

  #schedulePoll(delay = this.intervalMs) {
    this.#clearPoll();
    if (!this.active) return;
    this.pollTimer = this.setTimer(() => {
      this.pollTimer = null;
      void this.pollNow();
    }, delay);
  }

  #scheduleWrite(delay = this.writeDelayMs) {
    this.#clearWrite();
    if (!this.active || !this.pending.size) return;
    this.writeTimer = this.setTimer(() => {
      this.writeTimer = null;
      void this.flushWrites();
    }, delay);
  }

  async pollNow() {
    const session = this.#session();
    if (!this.#canRun(session) || this.operation) {
      this.#schedulePoll();
      return false;
    }
    this.operation = 'poll';
    try {
      const bytes = await session.client.getLive(session.info);
      if (this.#canRun(session)) this.onValues(decodePerf(session.descriptor, bytes));
      return true;
    } catch {
      // Connection lifecycle owns disconnect reporting. A poll is observational and must stay quiet.
      return false;
    } finally {
      this.operation = null;
      if (this.pending.size) this.#scheduleWrite(); else this.#schedulePoll();
    }
  }

  queueWrite(field, value) {
    const session = this.#session();
    if (!this.#canRun(session) || session.readOnly || !field) return false;
    this.pending.set(field.id, { field, value: clamp01(value) });
    this.#clearPoll();
    // Throttle, not debounce: a drag fires events faster than the delay, so a timer that restarts on every one would never fire until release.
    if (this.writeTimer === null) this.#scheduleWrite();
    return true;
  }

  async flushWrites() {
    this.#clearWrite();
    const session = this.#session();
    if (!session) { this.pending.clear(); return false; }
    if (!this.active || !this.isVisible()) return false;
    if (session.busy) { this.#scheduleWrite(); return false; }
    if (session.readOnly) { this.pending.clear(); return false; }
    if (!this.#canWrite(session)) {
      this.#scheduleWrite();
      return false;
    }
    if (this.operation) {
      this.#scheduleWrite();
      return false;
    }
    const edits = [...this.pending.values()];
    if (!edits.length) return false;
    this.pending.clear();
    this.operation = 'write';
    try {
      const fresh = await session.client.getLive(session.info);
      const output = Uint8Array.from(fresh);
      for (const { field, value } of edits) writeField(output, field, value);
      await session.client.writeBlob(session.info, 0xff, output);
      if (this.#canRun(session)) this.onValues(decodePerf(session.descriptor, output));
      return true;
    } catch (error) {
      this.onError(error);
      return false;
    } finally {
      this.operation = null;
      if (this.pending.size) this.#scheduleWrite(); else this.#schedulePoll();
    }
  }

  dispose() {
    this.setActive(false);
  }
}
