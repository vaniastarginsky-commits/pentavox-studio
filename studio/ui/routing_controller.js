import { canAdd, cvNotesView, depthFromPct, rowsView, sourceGroups, sourceKey, usedBy } from './routing_vm.js';
import { engineSetView, voicesView } from './voices_vm.js';
import { rawFromDisplay, settingsView } from './settings_vm.js';
import { potMapView } from './potmap_vm.js';

function defaultTimer(fn, delay) { return setTimeout(fn, delay); }
function defaultClear(timer) { clearTimeout(timer); }

export class RoutingController {
  constructor(session, destinations, options = {}) {
    if (!session.table) throw new Error('session must be connected before creating the routing controller');
    this.session = session;
    this.destinations = destinations;
    this.bank = 'A';
    this.selectedKey = sourceKey(session.table.sources().find((source) => source.bank === 'A'));
    this.debounceMs = options.debounceMs ?? 300;
    this.setTimer = options.setTimer ?? defaultTimer;
    this.clearTimer = options.clearTimer ?? defaultClear;
    this.onChange = options.onChange ?? (() => {});
    this.onError = options.onError ?? (() => {});
    this.listeners = new Set();
    this.timer = null;
    this.flushing = null;
  }

  get source() {
    return this.session.table.sources().find((source) => sourceKey(source) === this.selectedKey)
      ?? this.session.table.sources().find((source) => source.bank === this.bank);
  }

  view() {
    const source = this.source;
    return {
      bank: this.bank,
      source,
      groups: sourceGroups(this.session.table, this.destinations, this.bank, this.session.settings),
      notes: this.session.settings ? cvNotesView(this.session.settings) : null,
      rows: source ? rowsView(this.session.table, source, this.destinations) : [],
      canAdd: Boolean(source) && canAdd(this.session.table, source),
      dirty: this.session.dirty,
      readOnly: this.session.readOnly,
      reason: this.session.reason,
    };
  }

  notify() {
    this.onChange(this.view());
    for (const listener of this.listeners) listener();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  selectBank(bank) {
    if (bank !== 'A' && bank !== 'B') throw new RangeError('bank must be A or B');
    this.bank = bank;
    const current = this.source;
    const equivalent = this.session.table.sources().find(
      (source) => source.bank === bank && source.key === current?.key && source.ch === current?.ch,
    );
    const fallback = this.session.table.sources().find((source) => source.bank === bank);
    this.selectedKey = sourceKey(equivalent ?? fallback);
    this.notify();
  }

  selectSource(key) {
    const source = this.session.table.sources().find((item) => sourceKey(item) === key);
    if (!source) throw new TypeError('unknown route source');
    this.bank = source.bank;
    this.selectedKey = key;
    this.notify();
  }

  /// The source a route action targets: `key` when given (several inputs can be open at once), else the selected one.
  #target(key) {
    return (key && this.session.table.sources().find((item) => sourceKey(item) === key)) || this.source;
  }

  addRoute(destId = 1, depthPct = 0, key) {
    const source = this.#target(key);
    if (!source || !canAdd(this.session.table, source)) return -1;
    let slot = -1;
    this.session.edit((table) => { slot = table.addRoute(source, Number(destId), depthFromPct(depthPct)); });
    this.#schedule();
    return slot;
  }

  updateRoute(k, { destId, depthPct }, key) {
    const source = this.#target(key);
    const current = this.session.table.get(source, k);
    this.session.edit((table) => table.set(source, k, {
      dest: destId === undefined ? current.dest : Number(destId),
      depth: depthPct === undefined ? current.depth : depthFromPct(depthPct),
    }));
    this.#schedule();
  }

  removeRoute(k, key) {
    const source = this.#target(key);
    this.session.edit((table) => table.removeRoute(source, k));
    this.#schedule();
  }

  rowsFor(source) { return rowsView(this.session.table, source, this.destinations); }

  usages(destId) { return usedBy(this.session.table, Number(destId)); }

  voicesView() { return voicesView(this.session.voices); }

  engineSetView() { return engineSetView(this.session.voices); }

  updateVoice(voice, changes) {
    this.session.editVoices((table) => {
      if (changes.engine !== undefined) table.setEngine(voice, Number(changes.engine));
      if (changes.stereo !== undefined) table.setStereo(voice, changes.stereo);
      if (changes.syncIn !== undefined) table.setSyncIn(voice, changes.syncIn);
    });
    this.#schedule();
  }

  settingsView() { return this.session.settings ? settingsView(this.session.settings, { looper: Boolean(this.session.loopIo), sliceVersion: Number(this.session.descriptor?.slice?.version) || 0 }) : []; }

  destinationGroups() { return this.session.destinationGroups(); }

  // `value` is what the UI shows: percent for sliders, zone index for choices, boolean for switches.
  updateSetting(id, value) {
    this.session.editSettings((table) => {
      const field = table.field(id);
      if (field.type === 'f32') table.set(id, rawFromDisplay(field, value));
      else table.set(id, Number(value));
    });
    this.#schedule();
  }

  /** The MIDI CC table: every slot with a destination, plus how many slots the module has. */
  midiRoutesView() {
    const table = this.session.settings;
    if (!table || !table.has('midicc.0.dest')) return null;
    const routes = [];
    let count = 0;
    while (table.has(`midicc.${count}.dest`)) {
      const dest = table.get(`midicc.${count}.dest`);
      routes.push({
        index: count, cc: table.get(`midicc.${count}.cc`), channel: table.get(`midicc.${count}.ch`), dest,
        depth: Math.round((table.get(`midicc.${count}.depth`) * 2 - 1) * 100),
      });
      count += 1;
    }
    return { routes, slots: count, readOnly: this.session.readOnly };
  }

  /** key: cc | ch | dest (zone index) or depth (percent, -100..100). */
  updateMidiRoute(index, key, value) { this.updateMidiRouteFields(index,{[key]:value}); }

  updateMidiRouteFields(index,values) {
    const entries=Object.entries(values);
    if(!Number.isInteger(Number(index)) || entries.some(([key,value])=>!['cc','ch','dest','depth'].includes(key) || !Number.isFinite(Number(value))))throw new TypeError('Invalid MIDI route');
    if(entries.some(([key])=>!this.session.settings?.has(`midicc.${Number(index)}.${key}`)))throw new TypeError('Unknown MIDI route');
    this.session.editSettings(table=>{
      for(const [key,value] of entries)table.set(`midicc.${Number(index)}.${key}`,key==='depth'?(Math.max(-100,Math.min(100,Number(value)))/100+1)/2:Number(value));
    });
    this.#schedule();
  }

  updateJackFunction(jack, value) {
    const id = `jack.${Number(jack)}.function`;
    const next = Number(value);
    this.session.editSettings((table) => {
      // These global jobs are singleton inputs. Moving one to another jack
      // clears its old assignment instead of leaving two clocks/resets active.
      if (next !== 0) {
        for (let other = 0; other < 6; ++other) {
          const otherId = `jack.${other}.function`;
          if (otherId !== id && table.has(otherId) && table.get(otherId) === next)
            table.set(otherId, 0);
        }
      }
      table.set(id, next);
    });
    this.#schedule();
  }

  potMapView() { return this.session.potMap ? potMapView(this.session.potMap, this.destinations) : []; }

  updatePotMap(layer, page, pot, destId) {
    this.session.editPotMap((table) => table.set(Number(layer), Number(page), Number(pot), Number(destId)));
    this.#schedule();
  }

  resetPotMapPage(layer, page) {
    this.session.editPotMap((table) => table.reset(Number(layer), Number(page)));
    this.#schedule();
  }

  resetPotMapAll() {
    this.session.editPotMap((table) => table.reset());
    this.#schedule();
  }

  async assignVoiceEngine(voice, engine) {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    this.session.editVoices((table) => table.setEngine(voice, Number(engine)));
    this.notify();
    await this.flush();
  }

  async flush() {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.flushing) { this.flushAgain = true; return this.flushing; }
    // Edits made while a flush is in flight set `flushAgain` (or leave the session pending): run another flush for them before finishing,
    // so the caller's await covers every edit made so far, not just the ones the first write carried.
    this.flushing = (async () => {
      try {
        do {
          this.flushAgain = false;
          await this.session.flushLive();
          this.notify();
        } while (this.flushAgain || this.session.pending);
      } catch (error) {
        this.onError(error);
        throw error;
      } finally {
        this.flushing = null;
        this.flushAgain = false;
      }
    })();
    return this.flushing;
  }

  async save(slotOneBased) {
    const slot = Number(slotOneBased);
    if (!Number.isInteger(slot) || slot < 1 || slot > 16) throw new RangeError('slot must be 1..16');
    await this.flush();
    await this.session.saveToSlot(slot - 1);
    this.notify();
  }

  async load(slotOneBased) {
    const slot = Number(slotOneBased);
    if (!Number.isInteger(slot) || slot < 1 || slot > 16) throw new RangeError('slot must be 1..16');
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    await this.session.loadFromSlot(slot - 1);
    this.notify();
  }

  async discard() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    await this.session.discard();
    this.notify();
  }

  dispose() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  #schedule() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = this.setTimer(async () => {
      this.timer = null;
      try { await this.flush(); } catch { /* onError already reports it; local edits stay intact. */ }
    }, this.debounceMs);
    this.notify();
  }
}
