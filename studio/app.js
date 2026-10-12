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
import { apiFetch, siteUrl } from './site.js';
import { pairedDfuDevices } from './webdfu.js';

const connectButton = document.querySelector('#connect-button');
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

let samplerMount;
let locksMount;

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(text) {
  const binary = atob(text);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function draftKey(info = session?.info) {
  return info ? `pentavox.studio.draft.${info.mcuUid}.${info.schemaHash}` : '';
}

function persistDraft() {
  const key = draftKey();
  if (!key) return;
  try {
    const draft = session?.exportDraft();
    if (!draft) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ bytes: bytesToBase64(draft.bytes), owned: draft.owned }));
  } catch { /* Storage is a convenience; the module remains authoritative. */ }
}

function restoreDraft(target) {
  try {
    const raw = localStorage.getItem(draftKey(target.info));
    if (!raw) return false;
    const draft = JSON.parse(raw);
    return target.restoreDraft(base64ToBytes(draft.bytes), draft.owned);
  } catch { return false; }
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
});

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
  return { ...catalog, engines: catalog.engines.map((engine) => ({ ...engine, name: help[engine.id]?.name ?? engine.name, ...(mono.has(engine.id) ? { stereo: false, monoInPractice: true } : {}) })) };
}

const dx7Editor = mountDx7Editor({ getClient: () => client, getInfo: () => session?.info, onError: showError, onSuccess: showSuccess });

assetsPromise.then((assets) => {
  paletteMount = mountPalette(document.querySelector('#palette-root'), {
    catalog: withCatalogNames(assets.composerCatalog, assets.help, assets.monoInPractice),
    sets: assets.sets,
    measured: assets.measured,
    help: assets.help,
    getVoiceTable: () => session?.voices,
    getController: () => controller,
    getClient: () => client,
    onEditBanks: (letter) => dx7Editor.open(letter),
    onError: showError,
  });
}).catch(showError);

function syncFooter() {
  const usesSession = activeTab === 'routing' || activeTab === 'palette' || activeTab === 'settings' || activeTab === 'midi';
  sessionFooter.hidden = !controller || !usesSession;
}

async function connect() {
  stopDfuWatch();
  connectButton.disabled = true;
  connectionStatus.textContent = 'Connecting…';
  try {
    persistDraft();
    if (client) { try { await client.close(); } catch { /* already disconnected */ } }
    const assets = await assetsPromise;
    const transport = new URLSearchParams(location.search).get('sim') === '1'
      ? Promise.all([fetchBytes('./tests/fixtures/descriptor.json'), fetchBytes('./tests/fixtures/live.bin'), fetchJson('./tests/fixtures/meta.json')])
        .then(([descriptor, live, meta]) => new SimTransport(descriptor, live, { schemaHash: meta.schemaHash }))
      : openWebSerial();
    client = new HostLinkClient(await transport);
    session = new StudioSession(client, load(assets.destinations), { paletteCatalog: assets.paletteCatalog, composerCatalog: assets.composerCatalog });
    const result = await session.connect();
    const restoredDraft = restoreDraft(session);
    if (restoredDraft && session.pending) await session.flushLive();
    if (!session.table || !session.voices) throw new Error(result.reason ?? 'This firmware has no live fields');
    client.onDisconnect(markDisconnected);
    session.onBusy = (busy) => document.body.classList.toggle('studio-busy', busy);
    controller?.dispose(); controller = new RoutingController(session, load(assets.destinations), { onError: showError });
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
    connectionStatus.textContent = `${result.info.moduleName} · ${result.info.fwVersion}${location.search.includes('sim=1') ? ' · simulator' : ''}`;
    connectButton.textContent = 'Reconnect'; connectButton.disabled = false; connectionStatus.dataset.state = 'on'; disconnectBanner.hidden = true; syncFooter();
    persistDraft();
    samplerMount.refreshConnection();
    sdcardMount.refreshConnection();
    locksMount.refreshConnection();
  } catch (error) {
    connectionStatus.textContent = error?.code === 'BUSY_PORT' ? 'Port busy' : 'Not connected'; connectionStatus.dataset.state = 'err';
    connectButton.disabled = false; showError(error);
    connectButton.textContent = 'Reconnect';
    samplerMount.refreshConnection();
  }
}

connectButton.addEventListener('click', connect);
for (const tab of document.querySelectorAll('[data-tab]')) {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    for (const button of document.querySelectorAll('[data-tab]')) {
      button.classList.toggle('active', button === tab);
      if (button === tab) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    }
    for (const panel of document.querySelectorAll('.tab-panel')) panel.hidden = panel.id !== `${activeTab}-tab`;
    syncFooter();
    if (activeTab === 'sampler') samplerMount.show();
    if (activeTab === 'locks') locksMount.show(); else locksMount.hide();
  });
}

if (new URLSearchParams(location.search).get('sim') === '1') connect();


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
