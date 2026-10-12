// Per-voice engine palettes (recipe v2): three independent 24-slot sets, one per Plaits voice.
//
// A slot is { id, stereo, sync, bank? }.  stereo / sync are BUILD-TIME capability
// flags (stereo_enabled / sync_enabled in the recipe); bank (0|1|2 = SD /DX7/BANK_A|B|C.SYX)
// exists only for the six-op FM engine.
//
// Memory: the AXI image holds the UNION of every voice's engine CODE, so the
// estimate is taken over the distinct engine classes of all three sets.
export const SLOT_COUNT = 24;
export const VOICE_COUNT = 3;
export const BANK_LETTERS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);   // SD files BANK_A..F.SYX
export const MAX_BANKED_SLOTS = BANK_LETTERS.length;
// Engines that read a factory FM bank from the SD card (palette catalog `user_data_banks`).
export const BANKED_ENGINES = Object.freeze(['six_op']);

// Calibration of the static estimate against real ARM builds (tools/palette/build_recipe.py).
// Moving engine implementation text to the boot-copied SDRAM payload recovered
// 67,776 B from AXI in the stock build, so that verified gain is added to the
// previous 93,192 B calibration point:
//   3 x stock set  -> estimated AXI margin 160,968 B above the 16 KiB floor
//                     (real build 163,240 B),
//   per_voice_demo -> real AXI margin 158,376 B (the estimate is pessimistic).
// The 3 x stock point already contains the ~3.2 KB per-voice mechanism, so the code budget
// for the union is (static bytes of the stock union) + STOCK3_MARGIN_BYTES.
export const STOCK3_MARGIN_BYTES = 160968;
export const MECHANISM_BYTES = 3200;

function assertVoice(voice) {
  if (!Number.isInteger(voice) || voice < 0 || voice >= VOICE_COUNT) throw new RangeError('voice must be 0..2');
}

function assertSlot(index) {
  if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT) throw new RangeError('slot must be 0..23');
}

function bankName(bank) {
  return `Six-op FM · bank ${BANK_LETTERS[bank]}`;
}

export class PaletteModel {
  constructor(catalog, sets, measured = {}, preset = 'stock') {
    if (!Array.isArray(catalog?.engines) || !Array.isArray(catalog?.sec_sizes)) {
      throw new TypeError('invalid engine catalog');
    }
    this.catalog = catalog;
    this.sets = sets;
    this.measured = measured; // kept for API compatibility; the estimate is union based
    this.byId = new Map(catalog.engines.map((engine) => [engine.id, engine]));
    this.voices = [[], [], []];
    this.loadPreset(preset);
  }

  slotsOf(voice) {
    assertVoice(voice);
    return this.voices[voice];
  }

  isBanked(id) {
    return BANKED_ENGINES.includes(id);
  }

  #engine(id) {
    const engine = this.byId.get(id);
    if (!engine) throw new TypeError(`unknown engine: ${id}`);
    return engine;
  }

  // Successive banked slots without an explicit bank take A, B, C.. in order (the firmware's old rule).
  #assignBanks(slots) {
    const taken = new Set(slots.filter((slot) => this.isBanked(slot.id) && slot.bank !== undefined).map((slot) => slot.bank));
    let next = 0;
    for (const slot of slots) {
      if (!this.isBanked(slot.id) || slot.bank !== undefined) continue;
      while (taken.has(next) && next < BANK_LETTERS.length - 1) ++next;
      slot.bank = next;
      taken.add(next);
    }
    return slots;
  }

  #checkBankedCount(slots) {
    if (slots.filter((slot) => this.isBanked(slot.id)).length > MAX_BANKED_SLOTS) {
      throw new RangeError(`at most ${MAX_BANKED_SLOTS} Six-op FM slots per set`);
    }
  }

  // voice === null loads the preset into all three voices.
  loadPreset(name, voice = null) {
    const ids = this.sets?.[name];
    if (!Array.isArray(ids) || ids.length !== SLOT_COUNT) throw new TypeError(`preset ${name} must contain 24 engines`);
    const stereo = name !== 'stock';
    const build = () => this.#assignBanks(ids.map((id) => {
      const engine = this.#engine(id);
      return { id, stereo: stereo && Boolean(engine.stereo), sync: false };
    }));
    const targets = voice === null ? [0, 1, 2] : [voice];
    for (const target of targets) { assertVoice(target); this.voices[target] = build(); }
  }

  move(voice, index, delta) {
    assertVoice(voice);
    assertSlot(index);
    if (delta !== -1 && delta !== 1) throw new RangeError('move delta must be -1 or 1');
    const target = index + delta;
    if (target < 0 || target >= SLOT_COUNT) return false;
    this.swap(voice, index, target);
    return true;
  }

  swap(voice, first, second) {
    assertVoice(voice);
    assertSlot(first);
    assertSlot(second);
    const slots = this.voices[voice];
    [slots[first], slots[second]] = [slots[second], slots[first]];
  }

  // opts.bank picks the DX7 bank for a six-op slot (default: the first bank not used in this voice).
  place(voice, index, engineId, opts = {}) {
    assertVoice(voice);
    assertSlot(index);
    this.#engine(engineId);
    const slots = this.voices[voice];
    const slot = { id: engineId, stereo: false, sync: false };
    if (this.isBanked(engineId)) {
      const others = slots.filter((_, i) => i !== index && this.isBanked(slots[i].id));
      if (others.length >= MAX_BANKED_SLOTS) throw new RangeError(`at most ${MAX_BANKED_SLOTS} Six-op FM slots per set`);
      let bank = opts.bank;
      if (bank === undefined) bank = BANK_LETTERS.map((_, b) => b).find((b) => !others.some((o) => o.bank === b)) ?? 0;
      if (!Number.isInteger(bank) || bank < 0 || bank >= BANK_LETTERS.length) throw new RangeError(`bank must be 0..${BANK_LETTERS.length - 1}`);
      slot.bank = bank;
    }
    slots[index] = slot;
  }

  setStereo(voice, index, enabled) {
    assertVoice(voice);
    assertSlot(index);
    const slot = this.voices[voice][index];
    slot.stereo = Boolean(enabled) && Boolean(this.#engine(slot.id).stereo);
  }

  setSync(voice, index, enabled) {
    assertVoice(voice);
    assertSlot(index);
    const slot = this.voices[voice][index];
    slot.sync = Boolean(enabled) && Boolean(this.#engine(slot.id).sync);
  }

  setBank(voice, index, bank) {
    assertVoice(voice);
    assertSlot(index);
    const slot = this.voices[voice][index];
    if (!this.isBanked(slot.id)) throw new TypeError('this engine does not read a DX7 bank');
    if (!Number.isInteger(bank) || bank < 0 || bank >= BANK_LETTERS.length) throw new RangeError(`bank must be 0..${BANK_LETTERS.length - 1}`);
    slot.bank = bank;
  }

  // Always recipe v2.
  recipe() {
    return {
      voices: this.voices.map((slots) => ({
        slots: slots.map((slot, slotIndex) => {
          const engine = this.#engine(slot.id);
          const out = {
            slot_index: slotIndex,
            engine_id: slot.id,
            stereo_enabled: Boolean(slot.stereo && engine.stereo),
            sync_enabled: Boolean(slot.sync && engine.sync),
          };
          if (this.isBanked(slot.id)) out.user_data_bank = slot.bank ?? 0;
          return out;
        }),
      })),
    };
  }

  #parseSet(recipeSlots, label) {
    if (!Array.isArray(recipeSlots) || recipeSlots.length !== SLOT_COUNT) {
      throw new TypeError(`${label}: recipe must contain exactly 24 slots`);
    }
    const next = Array(SLOT_COUNT);
    for (const source of recipeSlots) {
      assertSlot(source?.slot_index);
      if (next[source.slot_index]) throw new TypeError(`${label}: duplicate slot: ${source.slot_index}`);
      const engine = this.#engine(source.engine_id);
      const slot = {
        id: source.engine_id,
        stereo: Boolean(source.stereo_enabled && engine.stereo),
        sync: Boolean(source.sync_enabled && engine.sync),
      };
      if (this.isBanked(source.engine_id) && source.user_data_bank !== undefined) {
        if (!Number.isInteger(source.user_data_bank) || source.user_data_bank < 0 || source.user_data_bank >= BANK_LETTERS.length) {
          throw new TypeError(`${label}: user_data_bank must be 0..${BANK_LETTERS.length - 1}`);
        }
        slot.bank = source.user_data_bank;
      }
      next[source.slot_index] = slot;
    }
    if (next.some((slot) => !slot)) throw new TypeError(`${label}: recipe must fill all 24 slots`);
    this.#assignBanks(next);
    this.#checkBankedCount(next);
    return next;
  }

  // Accepts v2 ({voices:[3 x {slots}]}) or v1 ({slots}); v1 is replicated onto the three voices.
  // All-or-nothing: a bad recipe leaves the model untouched.
  importRecipe(recipe) {
    if (recipe && typeof recipe === 'object' && 'voices' in recipe) {
      if ('slots' in recipe) throw new TypeError('recipe has both slots (v1) and voices (v2)');
      if (!Array.isArray(recipe.voices) || recipe.voices.length !== VOICE_COUNT) {
        throw new TypeError('recipe v2 must contain exactly 3 voices');
      }
      this.voices = recipe.voices.map((voice, i) => this.#parseSet(voice?.slots, `voice ${i + 1}`));
      return 2;
    }
    if (!Array.isArray(recipe?.slots)) throw new TypeError('recipe must contain exactly 24 slots');
    const single = this.#parseSet(recipe.slots, 'recipe');
    this.voices = [0, 1, 2].map(() => single.map((slot) => ({ ...slot })));
    return 1;
  }

  // ---- memory estimate over the UNION of engine classes -------------------------------------

  bytesOfIds(ids) {
    const sections = new Set();
    for (const id of ids) {
      for (const section of this.#engine(id).secs ?? []) sections.add(section);
    }
    let total = 0;
    for (const section of sections) total += this.catalog.sec_sizes[section] ?? 0;
    return total;
  }

  unionIds() {
    const ids = new Set();
    for (const slots of this.voices) for (const slot of slots) ids.add(slot.id);
    return ids;
  }

  estimatedBytes() {
    return this.bytesOfIds(this.unionIds());
  }

  stockUnionBytes() {
    return this.bytesOfIds(new Set(this.sets.stock));
  }

  // Largest union code size the AXI image can take (stock set x3 + the measured margin).
  budgetBytes() {
    return this.stockUnionBytes() + STOCK3_MARGIN_BYTES;
  }

  estimatedMargin(ids = this.unionIds()) {
    return this.budgetBytes() - this.bytesOfIds(ids);
  }

  matchingPreset(voice) {
    assertVoice(voice);
    const slots = this.voices[voice];
    for (const [name, ids] of Object.entries(this.sets)) {
      if (ids.length === SLOT_COUNT && ids.every((id, index) => slots[index].id === id)) return name;
    }
    return null;
  }

  summary() {
    const union = this.unionIds();
    const unionBytes = this.bytesOfIds(union);
    const budget = this.budgetBytes();
    const margin = budget - unionBytes;
    return {
      perVoice: this.voices.map((slots) => ({ filled: slots.length, unique: new Set(slots.map((slot) => slot.id)).size })),
      unionClasses: union.size,
      unionBytes,
      budgetBytes: budget,
      estimatedMargin: margin,
      usedFraction: unionBytes / budget,
      overBudget: margin < 0,
      mechanismBytes: MECHANISM_BYTES,
    };
  }

  canBuild() {
    return !this.summary().overBudget;
  }

  // ---- replacement suggestions (never applied automatically) --------------------------------

  // The heaviest engine classes of the union, each with lighter same-category alternatives.
  suggestReplacements({ limit = 4, alternatives = 3 } = {}) {
    const union = this.unionIds();
    const total = this.bytesOfIds(union);
    const budget = this.budgetBytes();
    const rows = [];
    for (const id of union) {
      const without = new Set(union); without.delete(id);
      const cost = total - this.bytesOfIds(without);
      if (cost > 0) rows.push({ id, cost, without });
    }
    rows.sort((a, b) => b.cost - a.cost || a.id.localeCompare(b.id));
    return rows.slice(0, limit).map(({ id, cost, without }) => {
      const engine = this.#engine(id);
      const users = [];
      let needStereo = false;
      let needSync = false;
      this.voices.forEach((slots, voice) => {
        const mine = slots.filter((slot) => slot.id === id);
        if (mine.length) users.push(voice + 1);
        if (mine.some((slot) => slot.stereo)) needStereo = true;
        if (mine.some((slot) => slot.sync)) needSync = true;
      });
      const alts = [];
      for (const alt of this.catalog.engines) {
        if (alt.id === id || alt.cat !== engine.cat || this.isBanked(alt.id)) continue;
        if (needStereo && !alt.stereo) continue;
        if (needSync && !alt.sync) continue;
        const next = new Set(without); next.add(alt.id);
        const saved = total - this.bytesOfIds(next);
        if (saved > 0) alts.push({ id: alt.id, name: alt.name, savedBytes: saved, marginAfter: budget - (total - saved) });
      }
      alts.sort((a, b) => b.savedBytes - a.savedBytes || a.id.localeCompare(b.id));
      return {
        id, name: engine.name, category: engine.cat, costBytes: cost, voices: users,
        alternatives: alts.slice(0, alternatives),
      };
    });
  }

  // Swap one engine class for another in every voice that uses it (or only in `voices`, 0-based).
  // Capability flags survive when the new engine supports them.
  replaceEngine(fromId, toId, voices = [0, 1, 2]) {
    const to = this.#engine(toId);
    this.#engine(fromId);
    let changed = 0;
    for (const voice of voices) {
      assertVoice(voice);
      const slots = this.voices[voice];
      slots.forEach((slot, index) => {
        if (slot.id !== fromId) return;
        slots[index] = { id: toId, stereo: Boolean(slot.stereo && to.stereo), sync: Boolean(slot.sync && to.sync) };
        if (this.isBanked(toId)) this.#assignBanks(slots);
        ++changed;
      });
    }
    return changed;
  }
}

// Library rows: one per catalog engine, except the six-op engine which becomes three
// models, one per SD DX7 bank (slot field user_data_bank 0..5 = BANK_A..F.SYX).
export function libraryEntries(catalog) {
  const out = [];
  for (const engine of catalog.engines) {
    if (BANKED_ENGINES.includes(engine.id)) {
      for (let bank = 0; bank < BANK_LETTERS.length; ++bank) {
        out.push({ ...engine, key: `${engine.id}#${bank}`, bank, name: bankName(bank) });
      }
    } else {
      out.push({ ...engine, key: engine.id, bank: undefined });
    }
  }
  return out;
}
