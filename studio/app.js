import { HostLinkClient } from './hostlink/client.js';
import { SimTransport } from './hostlink/transport_sim.js';
import { openWebSerial } from './hostlink/transport_webserial.js';
import { load } from './model/destinations.js';
import { StudioSession } from './model/session.js';
import { mountPalette } from './ui/palette.js';
import { mountPotMap } from './ui/potmap.js';
import { mountRouting } from './ui/routing.js';
import { mountSettings } from './ui/settings.js';
import { mountPresets } from './ui/presets.js';
import { mountDx7Editor } from './ui/dx7_editor.js';
import { mountMidiRouting } from './ui/midi_routing.js';
import { RoutingController } from './ui/routing_controller.js';
import { mountSessionFooter } from './ui/session_footer.js';
import { mountVoice } from './ui/voices.js';
import { mountSampler } from './ui/sampler.js';
import { mountSdCard } from './ui/sdcard.js';
import { mountKnobLocks } from './ui/knob_locks.js';
import { mountManual } from './ui/manual.js';
import { mountPanelDock } from './ui/panel_dock.js';
import { renderConnectionEmptyStates } from './ui/connection_empty.js';
import { apiFetch, siteUrl } from './site.js';
import { rememberModuleFirmware } from './firmware_info.js';
import { pairedDfuDevices } from './webdfu.js';

const connectButton = document.querySelector('#connect-button');
const demoButton = document.querySelector('#demo-button');
const demoBanner = document.getElementById('demo-banner');
let demoMode = new URLSearchParams(location.search).get('sim') === '1';
const connectionStatus = document.querySelector('#connection-status');
const routingRoot = document.querySelector('#routing-root');
// The pot map lives inside the CV routing tab (between Base CV and Panel pots), so it is a detached host the routing view adopts.
const potMapRoot = Object.assign(document.createElement('div'), { id: 'potmap-root' });
const settingsRoot = document.querySelector('#settings-root');
const presetsRoot = document.querySelector('#presets-root');
const midiRoot = document.querySelector('#midi-root');
const sessionFooter = document.querySelector('#session-footer');
const toast = document.querySelector('#toast');
let client;
let session;
let controller;
let paletteMount;
let unmountRouting;
let unmountPotMap;
let unmountSettings;
let unmountPresets;
let unmountMidi;
let unmountFooter;
let unmountVoices = [];
let unsubscribePaletteLive;
let unsubscribeDraft;
let toastTimer;
let activeTab = 'palette';
let buildVoiceCount=2;try { if(localStorage.getItem('pentavox.palette.variant')==='single-plaits')buildVoiceCount=1; } catch {}
globalThis.addEventListener?.('pentavox-profile',event=>{buildVoiceCount=event.detail.plaitsVoices;if(activeTab==='palette')document.querySelector('#page-crumb').textContent=`${buildVoiceCount===1?'One voice':'Two voices'}, three banks of eight`;});

let samplerMount;
let locksMount;

function showConnectionEmptyStates() {
  renderConnectionEmptyStates(
    [routingRoot, midiRoot, settingsRoot, presetsRoot],
    { connectButton, demoButton },
  );
}

showConnectionEmptyStates();

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function draftKey(info = session?.info) {
  return info ? `pentavox.studio.draft.${info.mcuUid}.${info.schemaHash}` : '';
}

function persistDraft() {
  if (demoMode) return;
  const key = draftKey();
  if (!key) return;
  try {
    const draft = session?.exportDraft();
    if (!draft) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ bytes: bytesToBase64(draft.bytes), owned: draft.owned }));
  } catch { /* Storage is a convenience; the module remains authoritative. */ }
}

const disconnectBanner = document.getElementById('disconnect-banner');
document.getElementById('banner-reconnect')?.addEventListener('click', () => connectButton.click());

// After "Reboot to DFU" (or during a flash) the serial link is gone on purpose: ask the composer server what the USB bus shows and say so,
// instead of a plain "Disconnected".
const disconnectText = document.getElementById('disconnect-text');
const DISCONNECTED_TEXT = disconnectText.textContent;
let dfuWatch = null;
let webFlash = null;   // 'choosing' | 'flashing' while this page flashes over WebUSB (palette.js reports it)
globalThis.addEventListener?.('pentavox-flash', (event) => {
  webFlash = event.detail === 'choosing' || event.detail === 'flashing' ? event.detail : null;
  if (dfuWatch) startDfuTick();
});

function showDisconnectedLabel(status = {}) {
  const flashing = status.state === 'flashing';
  const inDfu = flashing || status.dfu === true;
  connectionStatus.textContent = flashing ? 'Flashing…' : inDfu ? 'In DFU' : 'Disconnected';
  connectionStatus.dataset.state = inDfu ? 'dfu' : 'err';
  disconnectText.textContent = flashing ? 'The firmware is being flashed. Reconnect when it finishes.'
    : inDfu ? 'The module is in DFU mode and ready to flash. After flashing, press Reconnect.' : DISCONNECTED_TEXT;
}

function stopDfuWatch() {
  if (dfuWatch) { clearInterval(dfuWatch); dfuWatch = null; }
  globalThis.navigator?.usb?.removeEventListener?.('connect', startDfuTick);
  globalThis.navigator?.usb?.removeEventListener?.('disconnect', startDfuTick);
}

let dfuTick = null;
function startDfuTick() { dfuTick?.(); }

function startDfuWatch() {
  if (dfuWatch) return;
  dfuTick = async () => {
    let status = null;
    try {
      const response = await apiFetch('/api/status', { cache: 'no-store' });
      if (response.ok) status = await response.json();
    } catch { /* no build server on this machine */ }
    if (!status) {
      // Without the server, WebUSB tells whether a DFU device that this site may use is plugged in.
      try { status = { dfu: (await pairedDfuDevices()).length > 0 }; } catch { status = {}; }
    }
    if (webFlash) status = { ...status, state: 'flashing' };
    if (dfuWatch) showDisconnectedLabel(status);
  };
  dfuWatch = setInterval(dfuTick, 2000);
  globalThis.navigator?.usb?.addEventListener?.('connect', startDfuTick);
  globalThis.navigator?.usb?.addEventListener?.('disconnect', startDfuTick);
  dfuTick();
}

function markDisconnected() {
  disconnectBanner.hidden = false;
  showDisconnectedLabel();
  startDfuWatch();
  connectButton.textContent = 'Reconnect';
  connectButton.disabled = false;
  showConnectionEmptyStates();
  samplerMount.refreshConnection();
  sdcardMount.refreshConnection();
  locksMount.refreshConnection();
}

function showToast(message, isError, action = null) {
  toast.replaceChildren(message);
  if (action) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'toast-action'; button.textContent = action.label;
    button.addEventListener('click', (event) => { event.stopPropagation(); clearTimeout(toastTimer); toast.classList.remove('visible'); action.run(); });
    toast.append(button);
  }
  toast.classList.toggle('error', isError);
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  // Errors stay long enough to read (a busy port, a preset reset); a click on the toast dismisses it early.
  toastTimer = setTimeout(() => toast.classList.remove('visible'), isError ? 10000 : action ? 8000 : 5000);
}

function showError(error) { showToast(error?.message ?? String(error), true); }

function showSuccess(message) { showToast(message, false); }

function showUndo(message, run) { showToast(message, false, { label: 'Undo', run }); }

toast.addEventListener('click', () => { clearTimeout(toastTimer); toast.classList.remove('visible'); });

samplerMount = mountSampler(document.querySelector('#sampler-root'), {
  onError: showError,
  onSuccess: showSuccess,
  getClient: () => client,
  getInfo: () => session?.info,
  getSampleSlotCount: () => session?.sampleSlotCount ?? 4,
  getLoopIo: () => Boolean(session?.loopIo),
  onOpenSdTab: () => openSdDialog(),
});

locksMount = mountKnobLocks(document.querySelector('#locks-root'), {
  getSession: () => session,
  onError: showError,
  onSuccess: showSuccess,
  onUndo: showUndo,
});

const sdDialog = document.querySelector('#sdcard-dialog');
function openSdDialog() { if (!sdDialog.open) sdDialog.showModal(); sdcardMount.show(); }
sdDialog.querySelector('.sd-dialog-close').addEventListener('click', () => sdDialog.close());
sdDialog.addEventListener('click', (event) => { if (event.target === sdDialog) sdDialog.close(); });
// What was changed in the full file manager shows up in the Sampler's slots right away.
sdDialog.addEventListener('close', () => samplerMount.show());

const sdcardMount = mountSdCard(document.querySelector('#sdcard-root'), {
  onError: showError,
  onSuccess: showSuccess,
  getClient: () => client,
  getInfo: () => session?.info,
  getSampleSlotCount: () => session?.sampleSlotCount ?? 4,
  getLoopIo: () => Boolean(session?.loopIo),
});

const manualMount = mountManual(document.querySelector('#manual-root'), {
  getDescriptor: () => (demoMode ? null : session?.descriptor ?? null),   // the demo module is a different build; the manual describes the real one
  getSettings: () => session?.settings ?? null,
  // Nothing real connected: the compact firmware's pages, buttons and jacks (studio/gen_manual_snapshot.py).
  loadSnapshot: () => fetchJson('./manual_module.json'),
  loadStatic: async () => {
    const response = await fetch('./manual.html', { cache: 'no-cache' });
    if (!response.ok) throw new Error('manual.html is missing');
    return new DOMParser().parseFromString(await response.text(), 'text/html');
  },
});

// The dock hangs under the sticky header, whose height changes with the window width and the session controls.
{
  const header = document.querySelector('.app-header');
  const fit = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  new ResizeObserver(fit).observe(header); fit();
}

// The front-panel dock reads the same descriptor as the manual and points from a control to the tab that sets it.
const dock = document.getElementById('panel-dock');
const dockToggle = document.getElementById('dock-toggle');
const dockMount = mountPanelDock(dock, {
  getDescriptor: () => (demoMode ? null : session?.descriptor ?? null),
  getSettings: () => session?.settings ?? null,
  loadSnapshot: () => fetchJson('./manual_module.json'),
  onNavigate: (tab) => document.querySelector(`[data-tab="${tab}"]`)?.click(),
  getSession: () => (connectionStatus.dataset.state === 'on' ? session : null),
  onLiveError: showError,
});
function setDock(open, remember = true) {
  dock.hidden = !open;
  dockToggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('dock-open', open);
  if (open) dockMount.show();
  if (remember) try { localStorage.setItem('pentavox.studio.dock', open ? '1' : '0'); } catch { /* optional */ }
}
dockToggle.addEventListener('click', () => setDock(dock.hidden));
dock.querySelector('.dock-close').addEventListener('click', () => { setDock(false); dockToggle.focus(); });
dock.addEventListener('keydown', (event) => { if (event.key === 'Escape') { setDock(false); dockToggle.focus(); } });
// The panel never opens by itself on load; the Panel button opens it.
setDock(false, false);

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchJson(url, fallback) {
  try { const response = await fetch(url); if (!response.ok) throw new Error(); return await response.json(); }
  catch (error) { if (fallback !== undefined) return fallback; throw new Error(`Could not load ${url}`, { cause: error }); }
}

const assetsPromise = Promise.all([
  fetchJson('./destinations.json'),
  fetchJson(siteUrl('palette/catalog.json')),
  fetchJson(siteUrl('catalog_ui.json')),
  fetchJson(siteUrl('sets.json')),
  fetchJson(siteUrl('measured.json')),
  fetchJson('./engine_help.json', {}),
  fetchJson(siteUrl('stereo_mono.json'), { engines: [] }),
]).then(([destinations, paletteCatalog, composerCatalog, sets, measured, help, stereoMono]) => ({ destinations, paletteCatalog, composerCatalog, sets, measured, help, monoInPractice: new Set(stereoMono.engines ?? []) }));

// Display names follow the original catalog (Mutable Instruments / Rubato Plaits Lab). The session keeps
// the firmware-matched names, so only the palette view gets the renamed copy.
// Engines whose L and R stay nearly identical with stereo on (measured) lose the Stereo switch.
function withCatalogNames(catalog, help, mono = new Set()) {
  return { ...catalog, engines: catalog.engines.map((engine) => ({ ...engine, firmwareName: engine.name, name: help[engine.id]?.name ?? engine.name, ...(mono.has(engine.id) ? { stereo: false, monoInPractice: true } : {}) })) };
}

let pendingBank = 'A';
const dx7Editor = mountDx7Editor({ getClient: () => client, getInfo: () => session?.info, onError: showError, onSuccess: showSuccess });

assetsPromise.then((assets) => {
  paletteMount = mountPalette(document.querySelector('#palette-root'), {
    catalog: withCatalogNames(assets.composerCatalog, assets.help, assets.monoInPractice),
    sets: assets.sets,
    measured: assets.measured,
    help: assets.help,
    getVoiceTable: () => session?.voices,
    isDemo: () => demoMode,   // the simulated module's set is not a real mismatch
    getController: () => controller,
    getClient: () => client,
    onEditBanks: (letter) => { pendingBank = letter; document.querySelector('[data-tab="dx7"]')?.click(); },
    onError: showError,
  });
}).catch(showError);

function syncFooter() {
  const usesSession = activeTab === 'routing' || activeTab === 'palette' || activeTab === 'settings' || activeTab === 'midi';
  sessionFooter.hidden = !controller || !usesSession;
}

async function connect({ demo = false } = {}) {
  demoMode = demo;
  demoBanner.hidden = !demo;
  document.body.classList.toggle('demo-mode', demo);
  globalThis.dispatchEvent(new Event('pentavox-demo'));
  stopDfuWatch();
  connectButton.disabled = true;
  connectionStatus.textContent = 'Connecting…';
  try {
    persistDraft();
    if (client) { try { await client.close(); } catch { /* already disconnected */ } }
    const assets = await assetsPromise;
    const transport = demoMode
      ? Promise.all([fetchBytes('./tests/fixtures/compact/descriptor.json'), fetchBytes('./tests/fixtures/compact/live.bin'), fetchJson('./tests/fixtures/compact/meta.json')])
        .then(([descriptor, live, meta]) => new SimTransport(descriptor, live, { schemaHash: meta.schemaHash }))
      : openWebSerial();
    client = new HostLinkClient(await transport);
    session = new StudioSession(client, load(assets.destinations), { paletteCatalog: assets.paletteCatalog, composerCatalog: assets.composerCatalog });
    const result = await session.connect();
    rememberModuleFirmware(session.info);
    // Connecting never writes to the module: an old draft would overwrite what the module holds now (a voice engine changed on the panel,
    // a loaded preset), so it is dropped (persistDraft below clears it) instead of being restored and flushed.
    if (!session.table || !session.voices) throw new Error(result.reason ?? 'This firmware has no live fields');
    client.onDisconnect(markDisconnected);
    session.onBusy = (busy) => document.body.classList.toggle('studio-busy', busy);
    controller?.dispose(); controller = new RoutingController(session, session.destinations, { onError: showError });
    unmountRouting?.(); unmountPotMap?.(); unmountSettings?.(); unmountPresets?.(); unmountMidi?.(); unmountFooter?.(); unmountVoices.forEach((dispose) => dispose()); unsubscribePaletteLive?.(); unsubscribeDraft?.();
    routingRoot.classList.remove('disconnected'); unmountRouting = mountRouting(routingRoot, controller, { potMapHost: potMapRoot });
    unmountPotMap = mountPotMap(potMapRoot, controller);
    settingsRoot.classList.remove('disconnected'); unmountSettings = mountSettings(settingsRoot, controller);
    presetsRoot.classList.remove('disconnected'); unmountPresets = mountPresets(presetsRoot, controller, { onError: showError, onSuccess: showSuccess });
    midiRoot.classList.remove('disconnected'); unmountMidi = mountMidiRouting(midiRoot, controller, { onError: showError, onUndo: showUndo });
    unmountVoices = [];
    unmountFooter = mountSessionFooter(sessionFooter, controller);
    unsubscribePaletteLive = controller.subscribe(() => paletteMount?.refreshLive());
    unsubscribeDraft = controller.subscribe(persistDraft);
    paletteMount?.refreshLive();
    connectionStatus.textContent = demoMode ? 'Demo module' : `${result.info.moduleName} · ${result.info.fwVersion}`;
    connectButton.textContent = 'Reconnect'; connectButton.disabled = false; connectionStatus.dataset.state = 'on'; disconnectBanner.hidden = true; syncFooter();
    persistDraft();
    samplerMount.refreshConnection();
    sdcardMount.refreshConnection();
    locksMount.refreshConnection();
    manualMount.refreshConnection(); if (activeTab === 'manual') manualMount.show();
    dockMount.refreshConnection(); if (!dock.hidden) dockMount.show();
  } catch (error) {
    demoBanner.hidden = true;
    document.body.classList.remove('demo-mode');
    globalThis.dispatchEvent(new Event('pentavox-demo'));
    connectionStatus.textContent = error?.code === 'BUSY_PORT' ? 'Port busy' : 'Not connected'; connectionStatus.dataset.state = 'err';
    connectButton.disabled = false; showError(error);
    connectButton.textContent = 'Reconnect';
    samplerMount.refreshConnection();
  }
}

// A browser without WebSerial (iPhone/iPad, Safari, Firefox) cannot reach a module, and without WebUSB it cannot flash one: say so and offer the Demo.
{
  const nav = globalThis.navigator;
  const missing = !nav?.serial ? 'connect to a module' : !nav?.usb ? 'flash firmware' : '';
  if (missing) {
    connectButton.disabled = !nav?.serial;
    if (!nav?.serial) connectButton.title = 'This browser has no WebSerial';
    document.getElementById('unsupported-text').textContent = `This browser cannot ${missing} (no ${nav?.serial ? 'WebUSB' : 'WebSerial'}). Use Chrome or Edge on a computer; the Demo works here.`;
    document.getElementById('unsupported-banner').hidden = false;
    document.getElementById('unsupported-demo').addEventListener('click', () => connect({ demo: true }));
  }
}
connectButton.addEventListener('click', () => connect());
demoButton.addEventListener('click', () => connect({ demo: true }));
for (const tab of document.querySelectorAll('[data-tab]')) {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    for (const button of document.querySelectorAll('[data-tab]')) {
      button.classList.toggle('active', button === tab);
      if (button === tab) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    }
    for (const panel of document.querySelectorAll('.tab-panel')) panel.hidden = panel.id !== `${activeTab}-tab`;
    syncFooter();
    document.body.dataset.tab = activeTab;
    if (activeTab === 'sampler') samplerMount.show();
    if (activeTab === 'locks') locksMount.show(); else locksMount.hide();
    if (activeTab === 'manual') manualMount.show();
    if (activeTab !== 'dx7' && dx7Editor.dialog.open) dx7Editor.dialog.close();
    if (activeTab !== 'wavetable' && activeTab !== 'terrain' && paletteMount?.waves.dialog.open) paletteMount.waves.close();
    if (activeTab === 'dx7') { const letter = pendingBank; pendingBank = 'A'; dx7Editor.open(letter); }
    if ((activeTab === 'wavetable' || activeTab === 'terrain') && paletteMount) { document.getElementById(`${activeTab}-tab`).append(paletteMount.waves.dialog); paletteMount.waves.open(activeTab); }
  });
}

document.body.dataset.tab = activeTab;
if (demoMode) connect({ demo: true });


// Light/dark override on top of the system setting (persisted; falls back to the system theme).
{
  const root = document.documentElement;
  const button = document.getElementById('theme-toggle');
  const current = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const label = () => { if (button) { const dark = current() === 'dark'; button.textContent = dark ? '☀' : '☾'; button.title = dark ? 'Light theme' : 'Dark theme'; } };
  button?.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('pentavox.studio.theme', next); } catch { /* optional */ }
    label();
  });
  label();
}


// The three editors (DX7 banks, Wave tables, Wave terrain) are full pages: their dialogs are shown inline in the matching tab.
function asPage(dialog, hostFor) {
  dialog.classList.add('as-page');
  dialog.showModal = () => { const host = hostFor(); if (host && dialog.parentNode !== host) host.append(dialog); if (!dialog.open) dialog.show(); };
  dialog.addEventListener('click', (event) => { if (event.target === dialog) event.stopImmediatePropagation(); }, true);
}
asPage(dx7Editor.dialog, () => document.getElementById('dx7-tab'));
assetsPromise.then(() => { if (paletteMount) asPage(paletteMount.waves.dialog, () => document.getElementById(`${activeTab}-tab`)); });

// Page title and crumb in the top bar, like the Console design.
{
  const TITLES = {
    palette: ['Engines', `${buildVoiceCount===1?'One voice':'Two voices'}, three banks of eight`], dx7: ['DX7 banks', 'Six-op patches on the SD card'], wavetable: ['Wave tables', 'Harmonics banks for the Wavetable engine'],
    terrain: ['Wave terrain', 'Terrains for the Wave Terrain engine'], sampler: ['Sampler', 'SD card, two slots'], presets: ['Presets', 'Stored sounds'],
    routing: ['CV routing', 'Notes, jacks J3 to J8, pot map'], midi: ['MIDI routing', 'One table for the module'], locks: ['Knob record', 'Loops recorded with B3'],
    settings: ['Settings', 'Tempo, levels, voices'], manual: ['Manual', 'Using Studio'],
  };
  const title = document.getElementById('page-title'); const crumb = document.getElementById('page-crumb');
  // The slot, Save to slot and Discard controls belong to the module's stored settings; an engine set is a build, so the Engines page has none of them.
  const show = (tab) => { const [t, c] = TITLES[tab] || [tab, '']; title.textContent = t; crumb.textContent = c; document.documentElement.dataset.studioTab = tab; };
  for (const tab of document.querySelectorAll('[data-tab]')) tab.addEventListener('click', () => show(tab.dataset.tab));
  show(activeTab);
}
