// What the Build and Flash buttons do when there is no build server on this machine: build in GitHub Actions, flash over WebUSB.
// (With the local serve.py the buttons keep talking to it; see ui/palette.js.) Pure functions with injected dependencies, so they are testable.

import { BuildCancelledError, CloudBuild, CloudBuildError, cloudSettings, forgetGithubToken, githubToken } from './cloud_build.js';
import { FIRMWARE_ADDRESS, requestDfuDevice } from './webdfu.js';

/** Is the build server (serve.py) answering? A hosted page that cannot reach one falls back to the cloud. */
export async function localServerUp(apiFetch, timeoutMs = 1500) {
  try {
    const response = await Promise.race([
      apiFetch('/api/status', { cache: 'no-store' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return response.ok;
  } catch { return false; }
}

/**
 * Build in the cloud. onStatus gets the same shape the server's /api/status has ({ state, stage, image, margins, log }).
 * Resolves { image: Uint8Array, meta }; rejects after reporting a failed status.
 */
export async function runCloudBuild({ recipe, compact, looper = false, profile, diagnostic = false, onStatus, signal, token = githubToken(), settings = cloudSettings(), makeBuilder = (options) => new CloudBuild(options) }) {
  if (!token) throw new Error('A GitHub token is needed to build in the cloud (see the Studio README)');
  const builder = makeBuilder({ token, ...settings, onUnauthorized: forgetGithubToken });
  try {
    const result = await builder.build(recipe, { onStatus, compact, looper, ...(profile?{profile,diagnostic}:{}), signal });
    const kb = (result.image.byteLength / 1024).toFixed(0);
    onStatus({ state: 'built', image: 'cloud', profile:result.meta.profile,diagnostic:result.meta.diagnostic,stage: `done: ${(result.meta.commit ?? '').slice(0, 7)} · ${kb} KB`, margins: result.meta.margins ?? '', log: [] });
    return result;
  } catch (error) {
    if (error instanceof BuildCancelledError) {
      onStatus({ state: 'cancelled', stage: 'build cancelled', log: [] });
      return null;
    }
    onStatus({ state: 'failed', stage: 'build failed', log: String(error.log ?? error.message ?? error).split('\n').slice(-60) });
    throw error;
  }
}

/** Resume observation only: never dispatch another job after reloading Studio. */
export async function resumeCloudBuild({onStatus,onRecovered=()=>{},signal,token=githubToken(()=>''),settings=cloudSettings(),makeBuilder=options=>new CloudBuild(options)}={}) {
  if(!token) return null;
  const builder=makeBuilder({token,...settings,onUnauthorized:forgetGithubToken});
  const pending=await builder.recover();
  if(!pending) return null;
  onRecovered(pending);
  onStatus({state:'building',stage:'GitHub Actions: restoring build status'});
  const result=await builder.monitor(pending.request,{onStatus,signal});
  onStatus({state:'built',image:'cloud',profile:result.meta.profile,diagnostic:result.meta.diagnostic,stage:`GitHub Actions: complete · ${(result.meta.commit??'').slice(0,7)}`,margins:result.meta.margins??'',log:[]});
  return result;
}

/** The build the workflow published last, when a token is already saved in this browser (never asks for one); null when there is none. */
export async function loadLatestCloudBuild({ token = githubToken(() => ''), settings = cloudSettings(), makeBuilder = (options) => new CloudBuild(options) } = {}) {
  if (!token) return null;
  try { return await makeBuilder({ token, ...settings, onUnauthorized: forgetGithubToken }).latest(); } catch { return null; }
}

/** Only the meta.json of the latest cloud build (no image), for showing its date; null without a token, a build or a network. */
export async function loadLatestCloudMeta({ token = githubToken(() => ''), settings = cloudSettings(), makeBuilder = (options) => new CloudBuild(options) } = {}) {
  if (!token) return null;
  try { return await makeBuilder({ token, ...settings, onUnauthorized: forgetGithubToken }).latestMeta(); } catch { return null; }
}

/** When a published build was made: meta.built_at, or the time Studio put in the request id (base 36) for builds from before that field. */
export function builtAt(meta) {
  const stamp = Date.parse(meta?.built_at ?? '');
  if (Number.isFinite(stamp)) return stamp;
  const fromRequest = Number.parseInt(String(meta?.request ?? '').split('-')[0], 36);
  return fromRequest > Date.UTC(2024, 0, 1) && fromRequest < Date.UTC(2100, 0, 1) ? fromRequest : null;
}

function ago(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

/** The text that says which firmware is about to be flashed (shown in the confirm before Flash). */
export function describeBuild(meta, currentRecipe, { now = Date.now(), locale, changes = null, recent = [] } = {}) {
  const at = builtAt(meta);
  const lines = ['Firmware to flash (the last cloud build):'];
  lines.push(`Built: ${at === null ? 'unknown time' : `${new Date(at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })} (${ago(now - at)})`}`);
  lines.push(`Size: ${((meta.size ?? 0) / 1024).toFixed(0)} KB · commit ${(meta.commit ?? '').slice(0, 7) || 'unknown'}`);
  if (meta.profile) lines.push(`Variant: ${meta.profile} · ${meta.diagnostic ? 'diagnostic' : 'normal'}`);
  if (meta.margins) lines.push(String(meta.margins));
  if (meta.recipe === undefined) lines.push('Settings: not recorded for this build');
  else if (JSON.stringify(meta.recipe) === JSON.stringify(currentRecipe)) lines.push('Settings: the same as the engines chosen now in Studio');
  else lines.push('Settings: DIFFERENT from the engines chosen now in Studio (it was built from other ones; press Build to get the current ones)');
  lines.push(...describeChanges(changes, recent));
  return lines.join('\n');
}

/** The lines about what is new in the firmware to flash: from the commits since the module's (`changes`), else the changelog's recent firmware entries. */
export function describeChanges(changes, recent = []) {
  if (changes?.status === 'identical') return ['', 'The module already runs this build.'];
  if (changes?.status === 'behind') return ['', 'The module runs a newer firmware than this build: flashing it goes back.'];
  if (changes?.titles?.length) {
    const lines = ['', `What changed since the firmware in the module (${changes.base}):`, ...changes.titles.map((title) => `• ${title}`)];
    if (changes.total > changes.titles.length) lines.push(`… and ${changes.total - changes.titles.length} more`);
    return lines;
  }
  if (recent.length) return ['', 'Recent firmware changes:', ...recent.map((entry) => `• ${entry.date ? `${entry.date}: ` : ''}${entry.text}`)];
  return [];
}

/** The newest firmware entries of the changelog (what the confirm shows when the commits since the module's cannot be read). */
export function recentFirmwareChanges(entries, limit = 5) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => entry?.area === 'firmware' && typeof entry.text === 'string')
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))).slice(0, limit);
}

/** The commits between the module's firmware and the build to flash; null when the module's commit is unknown, there is no token or GitHub does not answer in time. */
export async function loadChangesForFlash({ moduleHash, meta, token = githubToken(() => ''), settings = cloudSettings(), makeBuilder = (options) => new CloudBuild(options), timeoutMs = 6000 } = {}) {
  const head = String(meta?.commit ?? '').trim();
  const base = String(moduleHash ?? '').trim();
  if (!token || !head || !base || base.toLowerCase() === 'unknown') return null;
  try {
    const builder = makeBuilder({ token, ...settings, onUnauthorized: forgetGithubToken });
    const result = await Promise.race([builder.changesSince(base, head), new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
    return result ? { ...result, base: base.slice(0, 7) } : null;
  } catch { return null; }
}

/** Flash an image over WebUSB DFU. Must be called from a click (the device chooser needs a user gesture). */
export async function runWebFlash({ image, onStatus, requestDevice = requestDfuDevice, address = FIRMWARE_ADDRESS, onFlashState = () => {} }) {
  let device = null;
  onFlashState('choosing');
  try {
    device = await requestDevice();
    await device.open();
    onFlashState('flashing');
    onStatus({ state: 'flashing', stage: 'flashing: starting', image: 'cloud' });
    let last = 0;
    await device.flash(image, address, ({ phase, done, total }) => {
      const now = Date.now();
      if (phase !== 'leave' && done !== total && now - last < 150) return;     // do not repaint on every block
      last = now;
      onStatus({ state: 'flashing', stage: `flashing: ${phase} ${done}/${total}`, image: 'cloud' });
    });
    onStatus({ state: 'built', stage: 'flashed; the module restarts by itself. Press Reconnect', image: 'cloud' });
    onFlashState('done');
  } catch (error) {
    onFlashState('error');
    onStatus({ state: 'built', stage: 'flash failed', image: 'cloud', log: [String(error.message ?? error)] });
    if (error?.name === 'NotFoundError') throw Object.assign(new Error('No DFU device was chosen. Put the module in DFU (Reboot to DFU) and try again: the next time the list shows every USB device'), { noDfuDevice: true });
    throw error;
  } finally {
    if (device) await device.close();
  }
}

export { CloudBuildError };
