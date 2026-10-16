// The three DX7 banks being composed. Each holds up to 32 patches ({ id, name, voice, ... }).
import { buildBankSyx, parseSyx, voiceKey, voiceName, voiceAlgorithm, deriveTags } from './dx7_syx.js';

export const BANK_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const BANK_SIZE = 32;

export class DX7Banks {
  constructor() { this.banks = Object.fromEntries(BANK_LETTERS.map((letter) => [letter, []])); }

  count(bank) { return this.banks[bank].length; }
  has(bank, patch) { const key = voiceKey(patch.voice); return this.banks[bank].some((p) => voiceKey(p.voice) === key); }

  add(bank, patch) {
    const list = this.banks[bank];
    if (!list || list.length >= BANK_SIZE || this.has(bank, patch)) return false;
    list.push(patch);
    return true;
  }

  remove(bank, index) { this.banks[bank].splice(index, 1); }
  clear(bank) { this.banks[bank] = []; }
  load(bank, patches) { this.banks[bank] = patches.slice(0, BANK_SIZE); }

  /** Moves a patch inside a bank or into another one. Returns false when nothing could move. */
  move(fromBank, fromIndex, toBank, toIndex) {
    const from = this.banks[fromBank]; const to = this.banks[toBank];
    if (!from || !to || fromIndex < 0 || fromIndex >= from.length) return false;
    if (fromBank === toBank) {
      const [patch] = from.splice(fromIndex, 1);
      from.splice(Math.min(Math.max(0, toIndex), from.length), 0, patch);
      return true;
    }
    if (to.length >= BANK_SIZE || this.has(toBank, from[fromIndex])) return false;
    const [patch] = from.splice(fromIndex, 1);
    to.splice(Math.min(Math.max(0, toIndex), to.length), 0, patch);
    return true;
  }

  /** The three .SYX byte arrays; null for an empty bank (it is not written). */
  toFiles() {
    const out = {};
    for (const letter of BANK_LETTERS) out[letter] = this.banks[letter].length ? buildBankSyx(this.banks[letter].map((p) => p.voice)) : null;
    return out;
  }

  static fromFiles(files) {
    const banks = new DX7Banks();
    for (const letter of BANK_LETTERS) {
      const bytes = files?.[letter];
      if (!bytes) continue;
      const seen = new Set();
      const patches = [];
      parseSyx(bytes).voices.forEach((voice, index) => {
        const key = voiceKey(voice);
        if (seen.has(key)) return;                       // a spread short bank repeats voices: show each once
        seen.add(key);
        patches.push({ id: `sd-${letter}-${index + 1}`, name: voiceName(voice), cat: 'Other', tags: deriveTags(voice), algo: voiceAlgorithm(voice), rom: null, romLabel: null, slot: index + 1, src: `SD bank ${letter}`, voice });
      });
      banks.load(letter, patches);
    }
    return banks;
  }
}
