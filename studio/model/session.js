import { indexDescriptor } from './blob.js';
import { eraseLocks, findLockComponent, lockBytes, readLocks, withLockBytes, writeLockSlot } from './knob_locks.js';
import { merge3 } from './merge.js';
import { PotMapTable } from './potmap.js';
import { RouteTable } from './routes.js';
import { SettingsTable } from './settings.js';
import { VoiceTable } from './voices.js';

function readOnlyError() {
  return new Error('Studio session is read-only');
}

export class StudioSession {
  constructor(client, destinations, engineCatalogs = {}) {
    this.client = client;
    this.destinations = destinations;
    this.table = undefined;
    this.voices = undefined;
    this.settings = undefined;
    this.potMap = undefined;
    this.engineCatalogs = engineCatalogs;
    this.info = undefined;
    this.index = undefined;
    this.lockComponent = undefined;
    this.base = undefined;
    this.dirty = false;
    this.readOnly = false;
    this.reason = undefined;
    this.pending = false;
    this.granularEnabled = true;
    this.tapeEnabled = true;
    this.samplerVoices = 2;
    this.sampleSlotCount = 4;
    this.editedKeys = new Set();
  }

  async connect() {
    // Build all state in locals so a failed reconnect cannot half-replace the
    // currently displayed table.
    const info = await this.client.hello();
    const descriptor = await this.client.getDescriptor(info);
    const live = await this.client.getLive(info);
    const index = indexDescriptor(descriptor);
    let table;
    let voices;
    let readOnly = false;
    let reason;
    try {
      table = RouteTable.fromBlob(live, index);
      voices = VoiceTable.fromBlob(live, index, this.engineCatalogs);
      // The aggregate HostLink hash covers every managed component and is
      // intentionally different for the two- and three-Plaits-voice builds.
      // Studio addresses fields through the device descriptor, so compatibility
      // hinges on the one numeric ABI it interprets itself: DestinationId.
      if (table.destCount !== this.destinations.count) {
        readOnly = true;
        reason = table.destCount > this.destinations.count
          ? 'The firmware has routing destinations newer than Studio'
          : 'The firmware routing schema is not supported by Studio';
      }
    } catch (error) {
      readOnly = true;
      reason = 'The firmware has no supported routing fields';
    }

    let settings;
    try { settings = SettingsTable.fromBlob(live, index); } catch { /* firmware without Settings fields: the tab stays empty */ }
    let potMap;
    try { potMap = PotMapTable.fromBlob(live, index); } catch { /* older firmware: the tab stays empty */ }

    this.info = info;
    this.index = index;
    this.lockComponent = findLockComponent(descriptor.components);
    this.base = Uint8Array.from(live);
    this.table = table;
    this.voices = voices;
    this.settings = settings;
    this.potMap = potMap;
    this.granularEnabled = potMap?.capabilities?.granularEnabled ?? true;
    this.tapeEnabled = potMap?.capabilities?.tapeEnabled ?? true;
    this.samplerVoices = potMap?.capabilities?.samplerVoices ?? 2;
    const describedSampleSlots = [...index.values()].filter((field) =>
      field?.comp === 'settings' && /^Sample Library \d+$/.test(field?.name ?? '')).length;
    this.sampleSlotCount = describedSampleSlots || 4;
    this.readOnly = readOnly;
    this.reason = reason;
    this.dirty = false;
    this.pending = false;
    this.editedKeys.clear();
    return { info, readOnly, ...(reason ? { reason } : {}) };
  }

  #rememberDirty(model) {
    for (const key of model?.dirtyKeys?.() ?? []) this.editedKeys.add(key);
  }

  #currentBlob() {
    const routes = this.table.toBlob(this.base);
    const voices = this.voices.toBlob(routes);
    const settings = this.settings ? this.settings.toBlob(voices) : voices;
    return this.potMap ? this.potMap.toBlob(settings) : settings;
  }

  exportDraft() {
    if (!this.dirty || !this.table || !this.voices) return null;
    return { bytes: this.#currentBlob(), owned: [...this.editedKeys] };
  }

  restoreDraft(bytes, owned = []) {
    if (!(bytes instanceof Uint8Array) || bytes.length !== this.base?.length) return false;
    this.table = RouteTable.fromBlob(bytes, this.index);
    this.voices = VoiceTable.fromBlob(bytes, this.index, this.engineCatalogs);
    if (this.settings) this.settings = SettingsTable.fromBlob(bytes, this.index);
    if (this.potMap) this.potMap = PotMapTable.fromBlob(bytes, this.index);
    this.editedKeys = new Set(owned.filter((key) => this.index.has(key)));
    this.dirty = true;
    this.pending = this.editedKeys.size > 0;
    return true;
  }

  edit(fn) {
    if (this.readOnly || !this.table) throw readOnlyError();
    fn(this.table);
    this.#rememberDirty(this.table);
    this.dirty = true;
    this.pending = true;
  }

  editVoices(fn) {
    if (this.readOnly || !this.voices) throw readOnlyError();
    fn(this.voices);
    this.#rememberDirty(this.voices);
    this.dirty = true;
    this.pending = true;
  }

  editSettings(fn) {
    if (this.readOnly || !this.settings) throw readOnlyError();
    fn(this.settings);
    this.#rememberDirty(this.settings);
    this.dirty = true;
    this.pending = true;
  }

  editPotMap(fn) {
    if (this.readOnly || !this.potMap) throw readOnlyError();
    fn(this.potMap);
    this.#rememberDirty(this.potMap);
    this.dirty = true;
    this.pending = true;
  }

  async flushLive() {
    if (this.readOnly || !this.table || !this.voices) throw readOnlyError();
    if (!this.pending) return;
    const fresh = await this.client.getLive(this.info);
    const mine = this.#currentBlob();
    const owned = new Set([...this.editedKeys, ...this.table.dirtyKeys(), ...this.voices.dirtyKeys(), ...(this.settings?.dirtyKeys() ?? []), ...(this.potMap?.dirtyKeys() ?? [])]);
    const output = merge3(this.base, fresh, mine, this.index, owned);
    await this.client.writeBlob(this.info, 0xff, output);
    this.base = output;
    this.table = RouteTable.fromBlob(output, this.index);
    this.voices = VoiceTable.fromBlob(output, this.index, this.engineCatalogs);
    if (this.settings) this.settings = SettingsTable.fromBlob(output, this.index);
    if (this.potMap) this.potMap = PotMapTable.fromBlob(output, this.index);
    this.pending = false;
  }

  /** Destinations this firmware can actually route to, grouped for pickers (voice counts, FX blocks and the compact Master page follow the descriptor). */
  destinationGroups() {
    const compact = this.voices?.voiceCount === 2 && this.samplerVoices === 1 && !this.granularEnabled && !this.tapeEnabled;
    return this.destinations.groups({
      masterPage: compact,
      stutter: !compact,
      plaitsVoices: this.voices?.voiceCount,
      granularEnabled: this.granularEnabled,
      tapeEnabled: this.tapeEnabled,
      samplerVoices: this.samplerVoices,
    });
  }

  /** Recorded knob movements as the module holds them right now (read fresh; they change while it is played). */
  async readKnobLocks() {
    if (!this.lockComponent) return null;
    return readLocks(await this.client.getLive(this.info), this.lockComponent);
  }

  /** Empties the given lock slots (all when omitted) on the module; only that component of a fresh live image changes.
   *  Returns the new slots and the previous raw bytes so the caller can offer Undo. */
  async eraseKnobLocks(slots = null) {
    if (this.readOnly || !this.lockComponent) throw readOnlyError();
    const fresh = await this.client.getLive(this.info);
    const previous = lockBytes(fresh, this.lockComponent);
    return { previous, slots: await this.#writeLocks(eraseLocks(fresh, this.lockComponent, slots)) };
  }

  /** Writes one loop into a slot (replacing what was there). Same return shape as eraseKnobLocks. */
  async writeKnobLock(slot, loop) {
    if (this.readOnly || !this.lockComponent) throw readOnlyError();
    const fresh = await this.client.getLive(this.info);
    const previous = lockBytes(fresh, this.lockComponent);
    return { previous, slots: await this.#writeLocks(writeLockSlot(fresh, this.lockComponent, slot, loop)) };
  }

  async restoreKnobLocks(previous) {
    if (this.readOnly || !this.lockComponent) throw readOnlyError();
    const fresh = await this.client.getLive(this.info);
    return this.#writeLocks(withLockBytes(fresh, this.lockComponent, previous));
  }

  async #writeLocks(blob) {
    await this.client.writeBlob(this.info, 0xff, blob);
    this.base = await this.client.getLive(this.info);
    return readLocks(this.base, this.lockComponent);
  }

  async saveToSlot(slot) {
    if (this.readOnly || !this.table || !this.voices) throw readOnlyError();
    if (this.pending) await this.flushLive();
    await this.client.saveToSlot(slot);
    this.dirty = false;
    this.editedKeys.clear();
  }

  /** Replaces the module's live state with a stored slot, then re-reads it; unsaved edits are dropped. */
  async loadFromSlot(slot) {
    if (this.readOnly || !this.table || !this.voices) throw readOnlyError();
    await this.client.loadFromSlot(slot);
    await this.discard();
  }

  async discard() {
    if (this.readOnly || !this.table || !this.voices) throw readOnlyError();
    const live = await this.client.getLive(this.info);
    const table = RouteTable.fromBlob(live, this.index);
    const voices = VoiceTable.fromBlob(live, this.index, this.engineCatalogs);
    this.base = Uint8Array.from(live);
    this.table = table;
    this.voices = voices;
    if (this.settings) this.settings = SettingsTable.fromBlob(live, this.index);
    if (this.potMap) this.potMap = PotMapTable.fromBlob(live, this.index);
    this.dirty = false;
    this.pending = false;
    this.editedKeys.clear();
  }
}
