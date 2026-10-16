// Browser persistence for the DX7 editor: imported .syx voices and the unsaved bank draft.
// Storage can be missing or blocked (private window, thumbnails), so every call is wrapped and the editor
// works without it.

export function memoryBackend() {
  const data = new Map();
  return { get: async (key) => data.get(key), set: async (key, value) => { data.set(key, value); } };
}

export function indexedDbBackend(name = 'pentavox-studio-dx7') {
  let opening = null;
  const open = () => {
    opening ??= new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('kv');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return opening;
  };
  const run = async (mode, action) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = action(db.transaction('kv', mode).objectStore('kv'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  return { get: (key) => run('readonly', (store) => store.get(key)), set: (key, value) => run('readwrite', (store) => store.put(value, key)) };
}

const isList = (value) => Array.isArray(value) && value.every((item) => typeof item?.name === 'string' && typeof item?.b64 === 'string');
// Drafts saved when there were only banks A-C have no D-F lists; they read as empty.
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const isDraft = (value) => value && LETTERS.every((letter) => value[letter] === undefined || (Array.isArray(value[letter]) && value[letter].every((item) => typeof item === 'string'))) && ['A', 'B', 'C'].every((letter) => Array.isArray(value[letter]));

export class DX7Store {
  constructor(backend = globalThis.indexedDB ? indexedDbBackend() : memoryBackend()) { this.backend = backend; }

  async loadImports() { try { const value = await this.backend.get('imports'); return isList(value) ? value : []; } catch { return []; } }
  async saveImports(list) { try { await this.backend.set('imports', list); } catch { /* optional */ } }
  async loadDraft() { try { const value = await this.backend.get('draft'); return isDraft(value) ? value : null; } catch { return null; } }
  async saveDraft(draft) { try { await this.backend.set('draft', draft); } catch { /* optional */ } }
}
