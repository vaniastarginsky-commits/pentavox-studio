import { mountLoopRecorder } from './ui/loop_recorder.js?v=3';
import { mountRoutingPanel } from './ui/routing_panel.js';
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
import { mountVoice } from './ui/voices.js';
import { mountSampler } from './ui/sampler.js';
import { mountSdCard } from './ui/sdcard.js';
import { mountPanelSkin } from './ui/panel_skin.js';
import { mountKnobLocks } from './ui/knob_locks.js';
import { mountManual } from './ui/manual.js';
import { mountPanelDock } from './ui/panel_dock.js';
import { renderConnectionEmptyStates } from './ui/connection_empty.js';
import { apiFetch, siteUrl } from './site.js';
import { rememberModuleFirmware } from './firmware_info.js';
import { pairedDfuDevices } from './webdfu.js';
import { mountNavigation, parseRoute } from './ui/navigation.js';

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
let unmountCvPanel, unmountMidiPanel;
let unmountVoices = [];
let unsubscribePaletteLive;
let unsubscribeDraft;
let toastTimer;
let activeTab = parseRoute(location.hash).tab;
let activePanelSection = 'live';
let navigation;
let buildVoiceCount=2;try { if(localStorage.getItem('pentavox.palette.variant')==='single-plaits')buildVoiceCount=1; } catch {}
let buildEngineBanks=3;
globalThis.addEventListener?.('pentavox-profile',event=>{buildVoiceCount=event.detail.plaitsVoices;buildEngineBanks=event.detail.engineBanks??3;if(activeTab==='palette')document.querySelector('#page-crumb').textContent=`${buildVoiceCount===1?'One voice':'Two voices'}, ${buildEngineBanks===4?'four':'three'} banks of eight`;});

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
    : inDfu ? 'The module is in DFU mode and ready to flash. After flashing, Studio reconnects by itself.' : DISCONNECTED_TEXT;
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
  if (session) session.readOnly = true;
  scheduleAutoConnect(1500, 20);   // a restarted or replugged module is opened again by itself
  disconnectBanner.hidden = false;
  showDisconnectedLabel();
  dx7Editor.refresh();
  startDfuWatch();
  connectButton.textContent = 'Reconnect';
  connectButton.disabled = false;
  showConnectionEmptyStates();
  syncFooter();
  pageDockMount.refreshConnection(); if (activeTab === 'panel') pageDockMount.show();
  samplerMount.refreshConnection();
  loopRecorderMount.refreshConnection();
  sdcardMount.refreshConnection();
  panelSkin.refreshConnection();
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
  getClient: () => connectionStatus.dataset.state === 'on' ? client : null,
  getInfo: () => session?.info,
  getSampleSlotCount: () => session?.sampleSlotCount ?? 4,
  getLoopIo: () => Boolean(session?.loopIo),
  onOpenSdTab: () => openSdDialog(),
});

locksMount = mountKnobLocks(document.querySelector('#locks-root'), {
  getSession: () => connectionStatus.dataset.state === 'on' ? session : null,
  onError: showError,
  onSuccess: showSuccess,
  onUndo: showUndo,
});

const loopRecorderMount=mountLoopRecorder(document.getElementById('loop-recorder'),{getSession:()=>connectionStatus.dataset.state==='on'?session:null,onOpenLooper:()=>navigation?.navigate('sampler')});

const sdDialog = document.querySelector('#sdcard-dialog');
document.getElementById('sdcard-nav').addEventListener('click', () => { closeNavigation(); openSdDialog(); });
function openSdDialog() { if (!sdDialog.open) sdDialog.showModal(); sdcardMount.show(); }
sdDialog.querySelector('.sd-dialog-close').addEventListener('click', () => sdDialog.close());
sdDialog.addEventListener('click', (event) => { if (event.target === sdDialog) sdDialog.close(); });
// What was changed in the full file manager shows up in the Sampler's slots right away.
sdDialog.addEventListener('close', () => { if (activeTab === 'sampler') samplerMount.show(); });

const sdcardMount = mountSdCard(document.querySelector('#sdcard-root'), {
  onError: showError,
  onSuccess: showSuccess,
  getClient: () => connectionStatus.dataset.state === 'on' ? client : null,
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

// The panel hangs under the sticky header, whose height changes with the window width and the session controls.
{
  const header = document.querySelector('.app-header');
  const fit = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  new ResizeObserver(fit).observe(header); fit();
}

// The front-panel dock reads the same descriptor as the manual and points from a control to the tab that sets it.
// The colour inspector follows the front panel on the Panel page and tints the rings both docks draw.
const panelSkin = mountPanelSkin(document.querySelector('#panel-skin-root'), {
  getClient: () => connectionStatus.dataset.state === 'on' ? client : null,
  getDescriptor: () => (demoMode ? null : session?.descriptor ?? null),
  onError: showError,
  onSuccess: showSuccess,
  onChange: () => pageDockMount.repaint(),
});
const dockOptions = {
  getDescriptor: () => (demoMode ? null : session?.descriptor ?? null),
  getSettings: () => session?.settings ?? null,
  loadSnapshot: () => fetchJson('./manual_module.json'),
  onNavigate: (tab, context) => {
    const section = tab === 'manual' && context ? `control:${context.page}:${context.control}:${context.shift ? 'shift' : 'normal'}` : '';
    navigation?.navigate(tab, section);
  },
  getSession: () => (connectionStatus.dataset.state === 'on' ? session : null),
  onLiveError: showError,
  decorate: (nodes, page, shift) => panelSkin.decorate(nodes, page, shift),
};
const pageDock = document.getElementById('panel-page-dock');
const pageDockMount = mountPanelDock(pageDock, { ...dockOptions, inspectorRoot: document.getElementById('panel-control-inspector'), onSelect: (selection) => panelSkin.select(selection), isActive: () => activeTab === 'panel' && activePanelSection !== 'settings' });
// Three task modes keep settings reachable without scrolling past the whole panel.
function showPanelSection(name) {
  activePanelSection = ['live', 'colours'].includes(name) ? name : 'live';
  const liveVisible = activePanelSection !== 'settings';
  document.querySelector('#panel-tab .panel-page').dataset.section = activePanelSection;
  document.getElementById('panel-live-section').hidden = !liveVisible;
  document.getElementById('panel-control-inspector').hidden = activePanelSection !== 'live';
  document.getElementById('panel-skin-root').hidden = activePanelSection !== 'colours';
  document.querySelector('#panel-tab .panel-side').hidden = activePanelSection === 'live';
  for (const button of document.querySelectorAll('.panel-subtabs [data-sub]')) {
    const active = button.dataset.sub === activePanelSection;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
  }
  if (activeTab === 'panel') pageDockMount.show();
}
for (const button of document.querySelectorAll('.panel-subtabs [data-sub]')) {
  button.addEventListener('click', () => navigation.navigate('panel', button.dataset.sub));
  button.addEventListener('keydown', event => {
    const modes = ['live', 'colours'];
    let index = modes.indexOf(activePanelSection);
    if (event.key === 'ArrowRight') index = (index + 1) % modes.length;
    else if (event.key === 'ArrowLeft') index = (index + modes.length - 1) % modes.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = modes.length - 1;
    else return;
    event.preventDefault(); navigation.navigate('panel', modes[index]);
    document.getElementById(`panel-sub-${modes[index]}`).focus();
  });
}

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
const dx7Editor = mountDx7Editor({ getClient: () => connectionStatus.dataset.state === 'on' ? client : null, getInfo: () => session?.info, onError: showError, onSuccess: showSuccess });

assetsPromise.then((assets) => {
  paletteMount = mountPalette(document.querySelector('#palette-root'), {
    catalog: withCatalogNames(assets.composerCatalog, assets.help, assets.monoInPractice),
    sets: assets.sets,
    measured: assets.measured,
    help: assets.help,
    getVoiceTable: () => session?.voices,
    isDemo: () => demoMode,   // the simulated module's set is not a real mismatch
    getController: () => controller,
    getClient: () => connectionStatus.dataset.state === 'on' ? client : null,
    onEditBanks: (letter) => { pendingBank = letter; document.querySelector('[data-tab="dx7"]')?.click(); },
    onError: showError,
  });
  asPage(paletteMount.waves.dialog, () => document.getElementById(`${activeTab}-tab`));
  if (activeTab === 'wavetable' || activeTab === 'terrain') navigation?.render();
}).catch(showError);

function syncFooter() {
  refreshWorkspace();
}

// Automatic connect, as the Hermetic Modular site does it: a module this site was allowed once is opened without a click when the page loads and
// again whenever it comes back (replugged, restarted, flashed). A module in DFU has no serial port, so there is nothing to open until it leaves DFU.
// Off with localStorage 'pentavox.studio.autoconnect' = '0'. Never while a flash is going on, in the Demo, or while another connect is running.
const AUTO_CONNECT_KEY = 'pentavox.studio.autoconnect';
const ALCHEMY_VENDOR_ID = 0x0483;
let autoTimer = null;
let autoTries = 0;
function autoConnectEnabled() {
  try { return localStorage.getItem(AUTO_CONNECT_KEY) !== '0'; } catch { return true; }
}
async function hasAllowedPort() {
  try { return ((await globalThis.navigator?.serial?.getPorts?.()) ?? []).some((port) => port.getInfo?.().usbVendorId === ALCHEMY_VENDOR_ID); } catch { return false; }
}
function scheduleAutoConnect(delay = 700, tries = 8) {
  if (!globalThis.navigator?.serial || !autoConnectEnabled()) return;
  autoTries = tries;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(runAutoConnect, delay);
}
async function runAutoConnect() {
  autoTimer = null;
  if (!autoConnectEnabled() || demoMode || webFlash || connectButton.disabled || connectionStatus.dataset.state === 'on') return;
  if (await hasAllowedPort() && await connect({ auto: true })) return;
  if (--autoTries > 0) autoTimer = setTimeout(runAutoConnect, 1500);   // the module may still be starting: HostLink answers a moment after the port appears
}

async function connect({ demo = false, auto = false } = {}) {
  demoMode = demo;
  demoBanner.hidden = !demo;
  document.body.classList.toggle('demo-mode', demo);
  globalThis.dispatchEvent(new Event('pentavox-demo'));
  stopDfuWatch();
  connectButton.disabled = true;
  connectionStatus.textContent = 'Connecting…'; connectionStatus.dataset.state = 'connecting';
  if (session) { session.readOnly = true; controller?.notify(); }
  dx7Editor.refresh(); syncFooter();
  try {
    persistDraft();
    if (client) { try { await client.close(); } catch { /* already disconnected */ } }
    const assets = await assetsPromise;
    const transport = demoMode
      ? Promise.all([fetchBytes('./tests/fixtures/compact/descriptor.json'), fetchBytes('./tests/fixtures/compact/live.bin'), fetchJson('./tests/fixtures/compact/meta.json')])
        .then(([descriptor, live, meta]) => new SimTransport(descriptor, live, { schemaHash: meta.schemaHash }))
      : openWebSerial({ interactive: !auto });
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
    unmountCvPanel?.(); unmountMidiPanel?.();
    unmountRouting?.(); unmountPotMap?.(); unmountSettings?.(); unmountPresets?.(); unmountMidi?.(); unmountVoices.forEach((dispose) => dispose()); unsubscribePaletteLive?.(); unsubscribeDraft?.();
    routingRoot.classList.remove('disconnected'); unmountRouting = mountRouting(routingRoot, controller, { potMapHost: potMapRoot });
    unmountPotMap = mountPotMap(potMapRoot, controller);
    settingsRoot.classList.remove('disconnected'); unmountSettings = mountSettings(settingsRoot, controller);
    presetsRoot.classList.remove('disconnected'); unmountPresets = mountPresets(presetsRoot, controller, { onError: showError, onSuccess: showSuccess });
    unmountCvPanel = mountRoutingPanel(document.getElementById('cv-panel-helper'), controller, 'cv', { onError: showError, onSuccess: showSuccess, onUndo: showUndo, isConnected: () => connectionStatus.dataset.state === 'on' });
    unmountMidiPanel = mountRoutingPanel(document.getElementById('midi-panel-helper'), controller, 'midi', { onError: showError, onSuccess: showSuccess, onUndo: showUndo, isConnected: () => connectionStatus.dataset.state === 'on' });
    midiRoot.classList.remove('disconnected'); unmountMidi = mountMidiRouting(midiRoot, controller, { onError: showError, onUndo: showUndo });
    unmountVoices = [];
    unsubscribePaletteLive = controller.subscribe(() => paletteMount?.refreshLive());
    unsubscribeDraft = controller.subscribe(() => { persistDraft(); refreshWorkspace(); });
    paletteMount?.refreshLive();
    connectionStatus.textContent = demoMode ? 'Demo module' : `${result.info.moduleName} · ${result.info.fwVersion}`;
    connectButton.textContent = 'Reconnect'; connectButton.disabled = false; connectionStatus.dataset.state = 'on'; disconnectBanner.hidden = true; syncFooter(); dx7Editor.refresh();
    persistDraft();
    samplerMount.refreshConnection();
  loopRecorderMount.refreshConnection();
    sdcardMount.refreshConnection();
    panelSkin.refreshConnection();
    locksMount.refreshConnection();
    manualMount.refreshConnection(); if (activeTab === 'manual') manualMount.openSection(parseRoute(location.hash).section);
    pageDockMount.refreshConnection(); if (activeTab === 'panel') pageDockMount.show();
    refreshWorkspace();
    return true;
  } catch (error) {
    demoBanner.hidden = true;
    document.body.classList.remove('demo-mode');
    globalThis.dispatchEvent(new Event('pentavox-demo'));
    connectionStatus.textContent = error?.code === 'BUSY_PORT' ? 'Port busy' : 'Not connected'; connectionStatus.dataset.state = 'err';
    connectButton.disabled = false;
    if (!auto) showError(error);   // an automatic try fails quietly: the next one follows
    connectButton.textContent = 'Reconnect';
    samplerMount.refreshConnection();
  loopRecorderMount.refreshConnection(); dx7Editor.refresh(); syncFooter();
    return false;
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
globalThis.navigator?.serial?.addEventListener?.('connect', () => scheduleAutoConnect(700, 12));   // a module this site may use was plugged in
globalThis.addEventListener?.('pentavox-flash', (event) => { if (event.detail === 'done') scheduleAutoConnect(2500, 14); });   // the module restarts after a flash
assetsPromise.then(() => scheduleAutoConnect(300, 3)).catch(() => {});
demoButton.addEventListener('click', () => connect({ demo: true }));
// Small navigation symbols share a single stroke and never replace the readable names.
{
  const paths = { palette:'M3 12h3l3-7 5 14 3-7h4', dx7:'M4 5h16M4 12h16M4 19h16', wavetable:'M3 8q4-6 9 0t9 0M3 16q4-6 9 0t9 0', terrain:'M3 19 8 5l5 14M9 19l7-14 5 14', sampler:'M4 9v6M8 5v14M12 8v8M16 3v18M20 9v6', presets:'M6 3h9l4 4v14H6zM9 10h7M9 14h7M9 18h4', routing:'M6 5v14M6 12h12M16 10l2 2-2 2', midi:'M4 4h16v16H4zM8 8h1M15 8h1M8 15h8', locks:'M3 12q4-12 9 0t9 0', panel:'M4 3h16v18H4zM8 8h1M15 8h1M8 15h1M15 15h1', settings:'M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0', manual:'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3zM12 6v15' };
  for (const link of document.querySelectorAll('.tabs [data-tab]')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true'); svg.classList.add('nav-icon');
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[link.dataset.tab] ?? paths.presets); svg.append(path); link.prepend(svg);
  }
}

document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); document.getElementById('main-workspace').focus(); });
const menuButton = document.getElementById('menu-toggle');
const navScrim = document.getElementById('nav-scrim');
function closeNavigation() {
  document.querySelector('.content').inert = false;
  document.querySelector('.side').removeAttribute('aria-modal');
  document.querySelector('.side').removeAttribute('role');
  document.body.classList.remove('navigation-open'); menuButton?.setAttribute('aria-expanded', 'false');
  if (navScrim) navScrim.hidden = true;
}
menuButton.addEventListener('click', () => {
  const open = !document.body.classList.contains('navigation-open');
  if (!open) { closeNavigation(); return; }
  document.querySelector('.content').inert = true;
  document.querySelector('.side').setAttribute('role', 'dialog'); document.querySelector('.side').setAttribute('aria-modal', 'true');
  document.body.classList.toggle('navigation-open', open); menuButton.setAttribute('aria-expanded', String(open)); navScrim.hidden = !open;
  if (open) document.querySelector('.side .tabs [aria-current="page"]')?.focus();
});
navScrim.addEventListener('click', () => { closeNavigation(); menuButton.focus(); });
document.getElementById('close-navigation').addEventListener('click', () => { closeNavigation(); menuButton.focus(); });
matchMedia('(max-width: 960px)').addEventListener('change', event => { if (!event.matches) closeNavigation(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('navigation-open')) { closeNavigation(); menuButton.focus(); }
});
// The menu is a disclosure; keep keyboard focus inside its visible links while open.
document.querySelector('.side').addEventListener('keydown', event => {
  if (event.key !== 'Tab' || !document.body.classList.contains('navigation-open')) return;
  const items = [...document.querySelectorAll('.side a, .side button')];
  if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
});

navigation = mountNavigation({
  links: document.querySelectorAll('.tabs [data-tab]'), panels: document.querySelectorAll('.tab-panel'),
  onChange: route => {
    const changed = activeTab !== route.tab;
    const fromMenu = document.body.classList.contains('navigation-open');
    activeTab = route.tab; document.body.dataset.tab = activeTab;
    closeNavigation(); syncFooter();
    if (changed || activeTab === 'panel') document.getElementById('main-workspace').scrollTop = 0;
    if (fromMenu) document.getElementById('main-workspace').focus({ preventScroll: true });
    if (activeTab === 'sampler') samplerMount.show();
    if (activeTab === 'panel') { showPanelSection(route.section); panelSkin.show(); }
    if (activeTab === 'locks') locksMount.show(); else locksMount.hide();
    if (activeTab === 'manual') manualMount.openSection(route.section);
    if (activeTab !== 'dx7' && dx7Editor.dialog.open) dx7Editor.dialog.close();
    if (activeTab !== 'wavetable' && activeTab !== 'terrain' && paletteMount?.waves.dialog.open) paletteMount.waves.close();
    if (activeTab === 'dx7') { const letter = pendingBank; pendingBank = 'A'; dx7Editor.open(letter); }
    if ((activeTab === 'wavetable' || activeTab === 'terrain') && paletteMount) {
      document.getElementById(`${activeTab}-tab`).append(paletteMount.waves.dialog); paletteMount.waves.open(activeTab);
    }
  },
});
globalThis.addEventListener('pentavox-navigate', event => {
  if (event.detail?.tab) navigation.navigate(event.detail.tab, event.detail.section ?? '');
});

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


// Context says where this editor's changes go, using only observed state.
function refreshWorkspace() {
  const connected = connectionStatus.dataset.state === 'on';
  for (const id of ['cv-panel-helper', 'midi-panel-helper']) document.getElementById(id).hidden = !connected;
  const loops = Boolean(session?.loopIo);
  const slots = session?.sampleSlotCount ?? 4;
  const titles = {
    palette: ['Engines', `${buildVoiceCount === 1 ? 'One voice' : 'Two voices'}, ${buildEngineBanks === 4 ? 'four' : 'three'} banks of eight`],
    dx7: ['DX7 banks', 'Six-op patches on the SD card'], wavetable: ['Wave tables', 'Resources for the next firmware build'],
    terrain: ['Wave terrain', 'Resources for the next firmware build'], sampler: [loops ? 'Loops' : 'Sampler', loops ? 'Prepare audio and manage the loop library' : `Prepare audio and manage ${slots} sample slots`],
    presets: ['Setup presets', 'Stored module configurations'], routing: ['CV routing', 'Notes, modulation and knob mapping'], midi: ['MIDI routing', 'Controllers to sound parameters'],
    locks: ['Knob record', 'Recorded and drawn movements'], panel: ['Live panel', 'Controls and colours on the module'], settings: ['Settings', 'Clock, levels and module preferences'], manual: ['Manual', 'Controls, gestures and Studio help'],
  };
  const [title, crumb] = titles[activeTab] ?? [activeTab, ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-crumb').textContent = crumb;
  document.documentElement.dataset.studioTab = activeTab;
  const samplerLink = document.querySelector('.tabs [data-tab="sampler"]');
  for (const node of samplerLink.childNodes) if (node.nodeType === Node.TEXT_NODE) node.textContent = loops ? 'Loops' : 'Sampler';
  const settingsLink = document.querySelector('.settings-shortcut');
  if (activeTab === 'settings') settingsLink.setAttribute('aria-current','page'); else settingsLink.removeAttribute('aria-current');
  const heading = document.getElementById('workspace-heading');
  heading.hidden = true;
  document.getElementById('workspace-title').textContent = title;
  document.getElementById('workspace-description').textContent = activeTab === 'locks' ? 'Record on the module. Shape it here.' : crumb;
  const status = document.getElementById('workspace-state');
  if (!status) return;
  let text = '';
  if (['wavetable', 'terrain'].includes(activeTab)) text = 'Saved in this browser. Matching engines include these resources in the next build.';
  else if (activeTab === 'dx7') text = 'Prepare banks in Studio. Write banks to SD to use them on the module.';
  else if (activeTab === 'sampler') text = 'Audio preparation stays on this computer until you send files to the module’s SD card.';
  else if (activeTab === 'locks') text = connected ? 'Edits apply to the playing module. Curve files can also be kept on this computer.' : 'Connect to read recorded movements, or explore the Demo.';
  else if (['panel', 'settings', 'routing', 'midi'].includes(activeTab) && connected) text = controller?.view().readOnly ? `Read only. ${controller.view().reason ?? ''}` : '';
  if (demoMode && connected && !['wavetable', 'terrain', 'sampler', 'dx7'].includes(activeTab)) text = '';
  status.hidden = !text || (connected && !controller?.view().readOnly);
  if (status.textContent !== text) status.textContent = text;
}
navigation.render();
if (demoMode) connect({ demo: true });
