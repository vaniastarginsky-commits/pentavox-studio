// What Studio says about firmware: when the one in the module was made, when the latest cloud build was, and a short change log.
// Pure functions, no DOM, so they are tested without a page.

/** The module reports "<short hash>@<commit date UTC>" (older builds: just the hash). */
export function parseFwGit(text) {
  const [hash = '', stamp = ''] = String(text ?? '').split('@');
  const date = Date.parse(stamp);
  return { hash: hash.trim(), date: Number.isFinite(date) ? date : null };
}

export function formatStamp(ms, locale) {
  return new Date(ms).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * 'same' (the module runs the latest cloud build), 'older' (a newer build exists), 'newer' (the module's commit is later than the whole cloud
 * build, a local build) or 'unknown' (no module hash or no build to compare). Hashes cannot tell older from newer, so the dates do when both are known.
 */
export function compareWithBuild(moduleHash, buildCommit, moduleDateMs = null, builtAtMs = null) {
  const mine = String(moduleHash ?? '').trim().toLowerCase();
  const built = String(buildCommit ?? '').trim().toLowerCase();
  if (!mine || mine === 'unknown' || !built) return 'unknown';
  if (built.startsWith(mine) || mine.startsWith(built)) return 'same';
  return Number.isFinite(moduleDateMs) && Number.isFinite(builtAtMs) && moduleDateMs !== null && builtAtMs !== null && moduleDateMs > builtAtMs ? 'newer' : 'older';
}

/** Rows for the Firmware card. `latest` is the meta.json of the latest cloud build, or null when it cannot be read. */
export function firmwareRows({ info, latest, builtAtMs = null, locale } = {}) {
  const rows = [];
  if (info) {
    const mod = parseFwGit(info.fwGit);
    const parts = [info.fwVersion, mod.hash].filter(Boolean);
    const when = mod.date === null ? 'build date unknown (older firmware)' : `made ${formatStamp(mod.date, locale)}`;
    rows.push({ label: 'In the module', text: `${parts.join(' · ')} · ${when}` });
  }
  if (latest) {
    const when = builtAtMs === null ? 'time unknown' : `built ${formatStamp(builtAtMs, locale)}`;
    rows.push({ label: 'Latest cloud build', text: `${String(latest.commit ?? '').slice(0, 7) || 'unknown'} · ${when}` });
    if (info) {
      const mod = parseFwGit(info.fwGit);
      const state = compareWithBuild(mod.hash, latest.commit, mod.date, builtAtMs);
      if (state === 'same') rows.push({ label: 'Status', text: 'the module runs the latest cloud build', state });
      else if (state === 'newer') rows.push({ label: 'Status', text: 'the module runs a newer build than the latest cloud build', state });
      else if (state === 'older') rows.push({ label: 'Status', text: 'a newer cloud build exists (Engines > Flash)', state });
    }
  }
  return rows;
}

/** Newest first; entries without a date go last. */
export function changelogEntries(raw, limit = 20) {
  const list = Array.isArray(raw) ? raw.filter((entry) => entry && typeof entry.text === 'string') : [];
  return list
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || a.index - b.index)
    .slice(0, limit);
}

export async function loadChangelog(fetchImpl = globalThis.fetch?.bind(globalThis), url = './changelog.json') {
  try {
    const response = await fetchImpl(url, { cache: 'no-cache' });
    return response.ok ? await response.json() : [];
  } catch { return []; }
}

const FW_KEY = 'pentavox.lastFwGit';

/** Remembers the firmware the connected module runs (its commit), so the Flash confirm can say what is new even when the module is in DFU and not connected. */
export function rememberModuleFirmware(info, storage = globalThis.localStorage) {
  const mod = parseFwGit(info?.fwGit);
  if (!mod.hash || mod.hash.toLowerCase() === 'unknown') return;
  try { storage?.setItem(FW_KEY, JSON.stringify({ hash: mod.hash, date: mod.date })); } catch { /* storage may be blocked */ }
}

/** The firmware commit the module reported when it was last connected: { hash, date } or null. */
export function lastModuleFirmware(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(FW_KEY) ?? 'null');
    return value && typeof value.hash === 'string' && value.hash ? { hash: value.hash, date: Number.isFinite(value.date) ? value.date : null } : null;
  } catch { return null; }
}
