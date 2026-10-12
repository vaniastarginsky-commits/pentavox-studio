// What the Build and Flash buttons do when there is no build server on this machine: build in GitHub Actions, flash over WebUSB.
// (With the local serve.py the buttons keep talking to it; see ui/palette.js.) Pure functions with injected dependencies, so they are testable.

import { CloudBuild, CloudBuildError, cloudSettings, forgetGithubToken, githubToken } from './cloud_build.js';
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
export async function runCloudBuild({ recipe, compact, onStatus, token = githubToken(), settings = cloudSettings(), makeBuilder = (options) => new CloudBuild(options) }) {
  if (!token) throw new Error('A GitHub token is needed to build in the cloud (see the Studio README)');
  const builder = makeBuilder({ token, ...settings, onUnauthorized: forgetGithubToken });
  try {
    const result = await builder.build(recipe, { onStatus, compact });
    const kb = (result.image.byteLength / 1024).toFixed(0);
    onStatus({ state: 'built', image: 'cloud', stage: `done: ${(result.meta.commit ?? '').slice(0, 7)} · ${kb} KB`, margins: result.meta.margins ?? '', log: [] });
    return result;
  } catch (error) {
    onStatus({ state: 'failed', stage: 'build failed', log: String(error.log ?? error.message ?? error).split('\n').slice(-60) });
    throw error;
  }
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
    if (error?.name === 'NotFoundError') throw new Error('No DFU device was chosen. Put the module in DFU (Reboot to DFU) and try again');
    throw error;
  } finally {
    if (device) await device.close();
  }
}

export { CloudBuildError };
