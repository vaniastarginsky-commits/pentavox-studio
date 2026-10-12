// Where Studio finds its data files and its build server.
//
// Studio is served from two places: the local composer server (serve.py: http://127.0.0.1:8766/studio/) and a static site (GitHub Pages:
// https://<user>.github.io/<repo>/studio/). Data files sit next to the studio folder in both, so they are addressed relative to this module,
// never from the server root. Build / Flash / DFU status need serve.py, which on the static site is the one running on the user's own machine.

/** Absolute URL of a file that lives beside the studio/ folder (palette/catalog.json, sets.json, engines_stock.wasm ...). */
export const siteUrl = (path) => new URL(`../${path}`, import.meta.url).href;

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const DEFAULT_LOCAL_SERVER = 'http://127.0.0.1:8766';

function storage() { try { return globalThis.localStorage ?? null; } catch { return null; } }
function read(key) { try { return storage()?.getItem(key) ?? null; } catch { return null; } }
function write(key, value) { try { storage()?.setItem(key, value); } catch { /* a convenience only */ } }

/** True when the page itself comes from serve.py (same origin, no token). */
export function servedLocally(location = globalThis.location) {
  return !location || LOCAL_HOSTS.has(location.hostname);
}

/** Base URL of serve.py ('' = same origin). */
export function apiBase(location = globalThis.location) {
  if (servedLocally(location)) return '';
  const chosen = read('pentavox.server');
  return (chosen || DEFAULT_LOCAL_SERVER).replace(/\/+$/, '');
}

/** The access token serve.py printed at start (needed for Build/Flash from a static site). Asked once, kept in this browser. */
export function apiToken(ask = () => globalThis.prompt?.('Pentavox build server token (printed when serve.py starts, or in ~/.pentavox-build/api-token):')) {
  let token = read('pentavox.token');
  if (!token) {
    token = (ask() ?? '').trim();
    if (token) write('pentavox.token', token);
  }
  return token;
}

export function forgetToken() { try { storage()?.removeItem('pentavox.token'); } catch { /* ignore */ } }

const DEFAULT_PORT = 8766;
const PORT_SPAN = 20;                 // serve.py tries 8766..8785 until one is free
let lastDiscovery = 0;

/** serve.py moves to the next free port when 8766 is taken: look for it (GET /api/status only) and remember the one that answers. */
async function discoverServer(fetchImpl, headers, now = Date.now) {
  if (now() - lastDiscovery < 30_000) return null;        // do not probe on every poll
  lastDiscovery = now();
  for (let port = DEFAULT_PORT + 1; port < DEFAULT_PORT + PORT_SPAN; port += 1) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 600) : null;
      const response = await fetchImpl(`${base}/api/status`, { cache: 'no-store', headers, signal: controller?.signal });
      if (timer) clearTimeout(timer);
      if (response.ok || response.status === 401) { write('pentavox.server', base); return base; }
    } catch { /* nothing on this port */ }
  }
  return null;
}

/**
 * fetch() against serve.py. A same-origin page needs nothing extra. A hosted page sends the token on every call: POSTs (Build/Flash) ask for it
 * once and keep it; GETs (status polling) use the saved one but never prompt. A 401 forgets the saved token so the next click asks again.
 * When the default port does not answer, the neighbouring ports are tried once in a while.
 */
export async function apiFetch(path, init = {}, { location = globalThis.location, fetchImpl = globalThis.fetch.bind(globalThis), now = Date.now } = {}) {
  const base = apiBase(location);
  const headers = { ...(init.headers ?? {}) };
  if (base) {
    if ((init.method ?? 'GET') !== 'GET') {
      const token = apiToken();
      if (!token) throw new Error('A build server token is needed to build or flash from this page');
      headers['X-Pentavox-Token'] = token;
    } else {
      const saved = read('pentavox.token');
      if (saved) headers['X-Pentavox-Token'] = saved;
    }
  }
  let response;
  try {
    response = await fetchImpl(`${base}${path}`, { ...init, headers });
  } catch (error) {
    if (!base || read('pentavox.server')) throw error;     // same-origin, or an address the user chose: report as is
    const found = await discoverServer(fetchImpl, headers, now);
    if (!found) throw error;
    response = await fetchImpl(`${found}${path}`, { ...init, headers });
  }
  if (response.status === 401) forgetToken();
  return response;
}
