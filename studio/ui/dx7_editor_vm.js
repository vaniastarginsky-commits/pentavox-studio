// State and derived view of the DX7 bank editor: filters, sort, paging, cursor, active bank. No DOM.
import { filterPatches, PAGE_SIZE, pageOf, sortPatches, sourceGroups } from '../model/dx7_catalog.js';
import { BANK_SIZE } from '../model/dx7_banks.js';
import { voiceKey } from '../model/dx7_syx.js';

export class EditorState {
  constructor(catalog, banks) {
    this.catalog = catalog; this.banks = banks;
    this.query = ''; this.tags = new Set(); this.category = null; this.sortKey = 'name';
    this.page = 0; this.cursor = 0; this.activeBank = 'A';
    this.groups = sourceGroups(catalog);
    this.#refresh();
  }

  #refresh() {
    const filtered = filterPatches(this.catalog.patches, { query: this.query, category: this.category, tags: [...this.tags] });
    this.list = sortPatches(filtered, this.sortKey);
  }

  #changed() { this.#refresh(); this.page = 0; this.cursor = 0; }

  /** Imported patches join the library; a voice already there is skipped. Returns how many were new. */
  addPatches(patches) {
    const known = new Set(this.catalog.patches.map((p) => voiceKey(p.voice)));
    let added = 0;
    for (const patch of patches) {
      const key = voiceKey(patch.voice);
      if (known.has(key)) continue;
      known.add(key); this.catalog.patches.push(patch); added += 1;
    }
    if (added) this.#refresh();
    return added;
  }

  setQuery(text) { this.query = text; this.#changed(); }
  toggleTag(tag) { if (this.tags.has(tag)) this.tags.delete(tag); else this.tags.add(tag); this.#changed(); }
  setCategory(category) { this.category = category; this.#changed(); }
  setSort(key) { this.sortKey = key; this.#changed(); }
  setPage(page) { this.page = pageOf(this.list, page).page; this.cursor = 0; }
  setActiveBank(letter) { this.activeBank = letter; }

  get view() {
    const { items, pages, page } = pageOf(this.list, this.page);
    const total = this.list.length;
    const from = total ? page * PAGE_SIZE + 1 : 0;
    return { rows: items, total, page, pages, rangeLabel: `${from}–${page * PAGE_SIZE + items.length} of ${total}` };
  }

  moveCursor(delta) {
    const last = Math.max(0, this.view.rows.length - 1);
    this.cursor = Math.min(last, Math.max(0, this.cursor + delta));
  }
  get cursorPatch() { return this.view.rows[this.cursor] ?? null; }

  addCursor() { const patch = this.cursorPatch; return patch ? this.banks.add(this.activeBank, patch) : false; }

  startFrom(sourceId) {
    for (const group of this.groups) {
      const item = group.items.find((candidate) => candidate.id === sourceId);
      if (item) { this.banks.load(this.activeBank, item.patches.slice(0, BANK_SIZE)); return true; }
    }
    return false;
  }

  bankCounts() { return Object.fromEntries(Object.keys(this.banks.banks).map((letter) => [letter, this.banks.count(letter)])); }
  counterLabel(letter) { return `${this.banks.count(letter)}/${BANK_SIZE}`; }
}
