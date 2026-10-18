// Build the firmware without a Mac: dispatch the `studio-build` GitHub Actions workflow of the firmware repository and read the result back.
//
//   Studio --(workflow_dispatch, recipe)--> Actions builds --(commits full.bin + meta.json to branch studio-builds)--> Studio reads them
//
// Everything goes through api.github.com with a fine-grained token of the user (Actions: write, Contents: read on the firmware repository).
// The token lives in this browser only. Results travel through the contents API, which allows cross-origin reads; artifacts do not.

const API = 'https://api.github.com';
const NETWORK_ATTEMPTS = 4;
const DEFAULTS = { repo: 'vaniastarginsky-commits/PENTAVOX', buildRef: 'compact-cleanup', workflow: 'studio-build.yml', workflowRef: 'main', resultBranch: 'studio-builds' };

function storage() { try { return globalThis.localStorage ?? null; } catch { return null; } }
function read(key) { try { return storage()?.getItem(key) ?? null; } catch { return null; } }
function write(key, value) { try { storage()?.setItem(key, value); } catch { /* a convenience only */ } }

export function cloudSettings() {
  return {
    repo: read('pentavox.cloud.repo') || DEFAULTS.repo,
    buildRef: read('pentavox.cloud.ref') || DEFAULTS.buildRef,
  };
}

/** The GitHub token, asked once and kept in this browser. */
export function githubToken(ask = () => globalThis.prompt?.('GitHub token for cloud builds (fine-grained: Actions write + Contents read on the firmware repository):')) {
  let token = read('pentavox.github');
  if (!token) {
    token = (ask() ?? '').trim();
    if (token) write('pentavox.github', token);
  }
  return token;
}

export function forgetGithubToken() { try { storage()?.removeItem('pentavox.github'); } catch { /* ignore */ } }

export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export class CloudBuildError extends Error {
  constructor(message, { status = 0, log = '' } = {}) { super(message); this.name = 'CloudBuildError'; this.status = status; this.log = log; }
}

export class BuildCancelledError extends Error {
  constructor() { super('Build cancelled'); this.name = 'BuildCancelledError'; }
}

export class CloudBuild {
  constructor({ token, repo, buildRef, fetchImpl = globalThis.fetch?.bind(globalThis), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now(), onUnauthorized = () => {} } = {}) {
    this.token = token;
    this.repo = repo ?? DEFAULTS.repo;
    this.buildRef = buildRef ?? DEFAULTS.buildRef;
    this.fetch = fetchImpl;
    this.sleep = sleep;
    this.now = now;
    this.onUnauthorized = onUnauthorized;
  }

  async api(path, { method = 'GET', body, accept = 'application/vnd.github+json' } = {}) {
    const init = {
      method,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${this.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    };
    // A dropped connection ("Failed to fetch") during a 5-minute poll must not throw away a build that is still running on GitHub:
    // reads are retried with a short back-off. A POST is sent once (a second dispatch would start a second build).
    const attempts = method === 'GET' ? NETWORK_ATTEMPTS : 1;
    let response;
    for (let attempt = 1; ; attempt += 1) {
      try { response = await this.fetch(`${API}${path}`, init); break; } catch (cause) {
        if (attempt >= attempts) throw new CloudBuildError(`Network problem reaching GitHub (${cause?.message ?? cause}). The build, if one was started, keeps running there: check your connection and try again.`);
        await this.sleep(500 * attempt);
      }
    }
    if (response.status === 401) { this.onUnauthorized(); throw new CloudBuildError('GitHub rejected the token (401). It was forgotten: click Build again to enter a new one.', { status: 401 }); }
    return response;
  }

  async json(path, options) {
    const response = await this.api(path, options);
    if (!response.ok) throw new CloudBuildError(`GitHub ${response.status} for ${path}`, { status: response.status });
    return response.json();
  }

  /** Start a build; resolves with the request id that names the run. */
  async start(recipe, { compact = true, looper = false } = {}) {
    const encodedRecipe = toBase64(JSON.stringify(recipe));
    if (encodedRecipe.length > 60000) throw new CloudBuildError('This recipe is too large for cloud Build. Remove some custom wave/terrain banks, or download recipe.json and build with the local Studio server.');
    const request = `${this.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const response = await this.api(`/repos/${this.repo}/actions/workflows/${DEFAULTS.workflow}/dispatches`, {
      method: 'POST',
      body: { ref: DEFAULTS.workflowRef, inputs: { ref: this.buildRef, recipe_b64: encodedRecipe, compact: String(compact), looper: String(looper), request } },
    });
    if (response.status === 404) throw new CloudBuildError(`The workflow ${DEFAULTS.workflow} was not found in ${this.repo} (is it on ${DEFAULTS.workflowRef}, and does the token have Actions: write?)`, { status: 404 });
    if (response.status !== 204) throw new CloudBuildError(`GitHub did not start the build (${response.status}): ${(await response.text()).slice(0, 200)}`, { status: response.status });
    return request;
  }

  /** The run that carries this request id in its title, or null while GitHub has not created it yet. */
  async findRun(request) {
    const data = await this.json(`/repos/${this.repo}/actions/workflows/${DEFAULTS.workflow}/runs?event=workflow_dispatch&per_page=15`);
    return (data.workflow_runs ?? []).find((run) => (run.display_title ?? run.name ?? '').includes(request)) ?? null;
  }

  async cancelRun(run) {
    const response = await this.api(`/repos/${this.repo}/actions/runs/${run.id}/cancel`, { method: 'POST' });
    // A completion can race the click. Let the next status read resolve that.
    if (response.status !== 202 && response.status !== 409)
      throw new CloudBuildError(`Could not cancel the GitHub build (${response.status}). It may still be running on GitHub.`, { status: response.status });
  }

  async waitForPoll(ms, signal) {
    if (!signal || signal.aborted) return this.sleep(ms);
    let wake;
    const interrupted = new Promise((resolve) => { wake = resolve; signal.addEventListener('abort', wake, { once: true }); });
    try { await Promise.race([this.sleep(ms), interrupted]); }
    finally { signal.removeEventListener('abort', wake); }
  }

  /** A short "what is it doing" line for a run: the step in progress. */
  async stage(run) {
    try {
      const data = await this.json(`/repos/${this.repo}/actions/runs/${run.id}/jobs`);
      const steps = data.jobs?.[0]?.steps ?? [];
      const current = steps.find((s) => s.status === 'in_progress') ?? steps.find((s) => s.status === 'queued');
      return current ? current.name : '';
    } catch (error) {
      if (error instanceof CloudBuildError && error.status === 401) throw error;
      return '';
    }
  }

  async resultText(path) {
    const response = await this.api(`/repos/${this.repo}/contents/${path}?ref=${DEFAULTS.resultBranch}&t=${this.now()}`, { accept: 'application/vnd.github.raw+json' });
    if (!response.ok) throw new CloudBuildError(`Could not read ${path} from ${DEFAULTS.resultBranch} (${response.status})`, { status: response.status });
    return response;
  }

  /** The published full.bin of a successful build, size-checked against its meta. */
  async image(meta) {
    const image = new Uint8Array(await (await this.resultText('full.bin')).arrayBuffer());
    if (meta.size && image.byteLength !== meta.size) throw new CloudBuildError(`The downloaded image is ${image.byteLength} bytes, expected ${meta.size}`);
    return image;
  }

  /** meta.json (+ full.bin when the build succeeded) published by the workflow for this request. */
  async result(request) {
    const meta = JSON.parse(await (await this.resultText('meta.json')).text());
    if (meta.request !== request) throw new CloudBuildError('The published result belongs to another build; try again', { status: 409 });
    let log = '';
    try { log = await (await this.resultText('build.log')).text(); } catch { /* the log is a convenience */ }
    if (!meta.ok) return { meta, log, image: null };
    return { meta, log, image: await this.image(meta) };
  }

  /** The build the workflow published last (whatever its request), to flash without building again; null when there is none. */
  /** The meta.json of the latest published build, without downloading the image (null when none, or the last one failed). */
  async latestMeta() {
    try {
      const meta = JSON.parse(await (await this.resultText('meta.json')).text());
      return meta.ok ? meta : null;
    } catch (error) {
      if (error instanceof CloudBuildError && error.status === 404) return null;
      throw error;
    }
  }

  async latest() {
    let meta;
    try { meta = JSON.parse(await (await this.resultText('meta.json')).text()); } catch (error) {
      if (error instanceof CloudBuildError && error.status === 404) return null;
      throw error;
    }
    if (!meta.ok) return null;
    return { meta, image: await this.image(meta) };
  }

  /**
   * Run a whole build. onStatus({ state: 'building', stage }) as it progresses. Resolves { image, meta, log }; rejects CloudBuildError
   * (with .log) when the workflow fails or times out.
   */
  async build(recipe, { onStatus = () => {}, compact = true, looper = false, pollMs = 5000, timeoutMs = 50 * 60 * 1000, signal } = {}) {
    if (signal?.aborted) throw new BuildCancelledError();
    onStatus({ state: 'building', stage: 'starting the cloud build' });
    const request = await this.start(recipe, { compact, looper });
    const deadline = this.now() + timeoutMs;
    let run = null;
    let cancelSent = false;
    while (this.now() < deadline) {
      await this.waitForPoll(pollMs, signal);
      run = run ?? await this.findRun(request);
      if (!run) { onStatus({ state: 'building', stage: signal?.aborted ? 'cancelling: waiting for GitHub to register the run' : 'waiting for GitHub to start the run' }); continue; }
      const current = await this.json(`/repos/${this.repo}/actions/runs/${run.id}`);
      if (current.status === 'completed') {
        if (current.conclusion === 'cancelled') throw new BuildCancelledError();
        const result = await this.result(request);
        if (current.conclusion !== 'success' || !result.image) throw new CloudBuildError('The cloud build failed', { log: result.log });
        return result;
      }
      if (signal?.aborted) {
        if (!cancelSent) { await this.cancelRun(run); cancelSent = true; }
        onStatus({ state: 'building', stage: 'cancelling the cloud build' });
        continue;
      }
      const step = await this.stage(run);
      onStatus({ state: 'building', stage: `cloud build: ${current.status === 'queued' ? 'queued' : step || 'running'}` });
    }
    throw new CloudBuildError(signal?.aborted
      ? 'GitHub has not confirmed cancellation. The build may still be running there.'
      : 'The cloud build did not finish in time');
  }
}
