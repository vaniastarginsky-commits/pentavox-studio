import { bpmFromName, reconcileTempo, weakBpmFromName } from '../model/tempo_hint.js';
import { audioFromBuffer, encodePcm16Wav, MAX_FRAMES, prepareAudio, readWavMarkers, TARGET_SAMPLE_RATE } from '../model/wav.js';
import { createStoreZip } from '../model/zip.js';
import { buildPeakPyramid, cap30, computePeaks, dragHandle, fitView, MAX_CLIP_SECONDS } from '../model/wave_edit.js';
import { exportSlices, SliceModel } from '../model/slices.js';
import { timeStretch } from '../model/timestretch.js';
import { rotateChannels, rotateMarkers } from '../model/rotate.js';
import { createSliceBar } from './slice_bar.js';
import { createBreakPanel, hasBreakPatterns } from './break_panel.js';
import { createWaveEditor } from './wave_editor.js';
import { buildSamplerPlan, mergeSamplerSlots, nextStartNumbers, sliceSummary, validateSamplerPlan } from './sampler_vm.js';
import { pcm16FromWav, SampleUploadClient } from '../model/sample_upload.js';
import { beginLinkJob } from '../model/link_jobs.js';
import { SdFilesClient, describeFsError, describeTransfer } from '../model/sd_files.js';
import { samplerFolders, cardSummary, formatSize, sortEntries } from './sdcard_vm.js';
import { LOOP_DIR, LOOP_SLOTS, LoopIoClient, describeLoopError, loopFileName, loopFiles, renumberProblem } from '../model/loop_io.js';

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function button(text, className = '') { const node = el('button', className, text); node.type = 'button'; return node; }
function seconds(value) { return `${value.toFixed(value < 10 ? 2 : 1)} s`; }
function download(bytes, name, type) { const url = URL.createObjectURL(new Blob([bytes], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export function mountSampler(root, { onError = (error) => console.error(error), onSuccess = () => {}, getClient = () => null, getInfo = () => null, getSampleSlotCount = () => 4, getLoopIo = () => false, onOpenSdTab = () => {} } = {}) {
  const state = { items: [], starts: [null, null, null, null], importing: false, exporting: false, selected: null, upload: null, card: null, cardInfo: null, cardFiles: [[], [], [], []], cardLoading: false, cardProblem: '', confirming: null, generation: 0 };
  // The looper image keeps its loops in /LOOPS (two loop slots, files numbered by the module) instead of the sampler's SLOT folders.
  const looper = () => Boolean(getLoopIo());
  const loop = { files: [], busy: false, message: '', failed: false, confirmErase: false };
  const loopClient = () => { const client = getClient(); return client ? new LoopIoClient(client) : null; };
  let audioContext; let editor = null; let sliceBar = null; let breakPanel = null; let refreshQueued = false; let hooks = { fields: () => {}, status: () => {} };
  const context = () => { audioContext ??= new AudioContext(); return audioContext; };
  const slotCount = () => Math.max(2, Math.min(4, Number(getSampleSlotCount()) || 4));
  const plan = () => buildSamplerPlan(state.items.map((item) => ({ ...item, frames: Math.round((item.trimEnd - item.trimStart) * TARGET_SAMPLE_RATE) })), state.starts, state.cardFiles, slotCount());
  const validation = () => validateSamplerPlan(plan(), state.cardFiles, slotCount());
  const files = () => { const client = getClient(); const info = getInfo(); return client && info ? new SdFilesClient(client, info) : null; };

  async function loadCard() {
    const client = files(); const generation = ++state.generation; state.confirming = null;
    if (!client) { state.cardInfo = null; state.cardFiles = [[], [], [], []]; state.cardLoading = false; state.cardProblem = 'Connect the module to see what is on the card'; refreshSide(); return; }
    state.cardLoading = true; state.cardProblem = ''; refreshSide();
    try {
      const info = await client.cardInfo();
      if (looper()) {
        const listing = await client.list(LOOP_DIR).catch((error) => { if (error?.status === 12) return []; throw error; });
        if (generation !== state.generation) return;
        state.cardInfo = info; loop.files = loopFiles(sortEntries(listing)); state.cardLoading = false; refreshSide(); return;
      }
      const entries = await Promise.all(samplerFolders(slotCount()).map(async (path) => { try { return await client.list(path); } catch (error) { if (error?.status === 12) return []; throw error; } }));
      if (generation !== state.generation) return;
      state.cardInfo = info; state.cardFiles = entries.map((slot) => sortEntries(slot).filter((entry) => !entry.directory && /\.wav$/i.test(entry.name)));
    } catch (error) {
      if (generation !== state.generation) return;
      state.cardInfo = null; state.cardFiles = [[], [], [], []]; state.cardProblem = describeFsError(error);
    }
    state.cardLoading = false; refreshSide();
  }

  async function decodedFile(file) {
    const buffer = await file.arrayBuffer();
    const marks = readWavMarkers(new Uint8Array(buffer.slice(0)));   // before decodeAudioData detaches the buffer
    const decoded = await context().decodeAudioData(buffer);
    const audio = audioFromBuffer(decoded); const duration = audio.channels[0].length / audio.sampleRate;
    const name = file.name.replace(/\.[^.]+$/, '') || 'sample';
    let bpm = marks?.bpm > 0 ? String(Number(marks.bpm.toFixed(2))) : ''; let beats = marks?.beats > 0 ? String(marks.beats) : '';
    let tempoAuto = false;   // true while bpm/beats came from the file name or a guess, so Detect may redo them
    if (!bpm && !beats) { const named = reconcileTempo(null, bpmFromName(name), duration, weakBpmFromName(name)); if (named) { bpm = String(named.bpm); beats = String(named.beats); tempoAuto = true; } }
    return { name, audio, duration, trimStart: 0, trimEnd: duration, normalize: true, channelMode: audio.channels.length > 1 ? 'stereo' : 'mono', bpm, beats, tempoAuto, slot: 0,
      slices: marks && marks.sampleRate > 0 && marks.slices.length > 1 ? new SliceModel(duration, { markers: marks.slices.filter((frame) => frame > 0).map((frame) => frame / marks.sampleRate), oneShot: marks.oneShot, playMode: marks.playMode, step: marks.step, playFilter: marks.playFilter, labels: marks.labels }) : new SliceModel(duration),
      pyramid: buildPeakPyramid(audio.channels, audio.sampleRate), view: fitView(duration), playhead: 0, scope: 'selection', loop: false,
      breakBank: marks?.breakBank ?? undefined };
  }

  async function importFiles(files, { slot = null, select = false } = {}) {
    state.importing = true; renderList();
    const first = state.items.length;
    for (const file of files) try { const item = await decodedFile(file); if (slot !== null) item.slot = slot; state.items.push(item); } catch (error) { onError(new Error(`Could not decode “${file.name}”`, { cause: error })); }
    state.importing = false;
    if ((select || !state.selected) && state.items.length > first) { state.selected = state.items[first]; renderEditor(); }
    refreshSide();
  }

  async function wavFor(item) {
    const audio = await prepareAudio(item.audio, item);
    const cut = item.slices ? exportSlices(item.slices.markers, item.slices.labels, item.trimStart, item.trimEnd, TARGET_SAMPLE_RATE) : { frames: [], labels: [] };
    return encodePcm16Wav(audio, { bpm: Number(item.bpm), beats: Number(item.beats), slices: cut.frames, labels: cut.labels, oneShot: item.slices?.oneShot ?? false, playMode: item.slices?.playMode ?? 0, step: item.slices?.step ?? 0, playFilter: item.slices?.playFilter ?? 0, breakBank: hasBreakPatterns(item.breakBank) ? item.breakBank : null });
  }

  async function sendToVoice(item, voice) {
    const client = getClient(); const info = getInfo();
    if (!client || !info) return onError(new Error('Connect the module before sending a sample'));
    const controller = new AbortController(); state.upload = { item, voice, progress: 0, controller }; hooks.status();
    const endJob = beginLinkJob(`Sending ${item.name}`);
    try {
      const pcm = pcm16FromWav(await wavFor(item));
      const result = await new SampleUploadClient(client, info).upload({ voice, ...pcm, signal: controller.signal, onProgress: (progress) => { if (state.upload?.controller === controller) { state.upload.progress = progress; hooks.status(); } } });
      const sliced = pcm.slices ? (result?.slicesSent ? ` with ${pcm.slices[5]} slices` : ' (this firmware cannot take slice markers: sent without them)') : '';
      const patterns = pcm.breakBytes && result?.slicesSent ? (result?.patternsSent ? ' and its break patterns' : ' (this firmware cannot take break patterns: sent without them)') : '';
      onSuccess(`Voice ${voice + 1} now plays ${item.name}${sliced}${patterns} (in memory, lost at power-off)`);
    } catch (error) {
      if (error?.name !== 'AbortError') onError(error);
    } finally {
      endJob();
      if (state.upload?.controller === controller) { state.upload = null; hooks.status(); }
    }
  }

  // ---------------------------------------------------------------- write straight to the SD card
  async function writeToCard(items) {
    const client = getClient(); const info = getInfo();
    if (!client || !info) return onError(new Error('Connect the module before writing to its card'));
    if (state.card) return;
    const current = plan(); const checked = validation();
    if (!checked.valid) return onError(new Error(checked.errors[0]));
    const chosen = current.filter((_, index) => items.includes(state.items[index]));
    const files = new SdFilesClient(client, info); const controller = new AbortController();
    state.card = { label: '', progress: 0, controller }; renderCardBar(); updateHeading();
    let written = 0; let lastRate = ''; const skipped = [];
    const endJob = beginLinkJob('Writing to the card');
    try {
      for (const [index, item] of chosen.entries()) {
        const path = `/SLOT${item.slot}/${item.fileName}`;
        state.card.label = `Writing ${item.name} to ${path} (${index + 1}/${chosen.length})`; state.card.progress = 0; state.card.size = 0; renderCardBar();
        const bytes = await wavFor(item); state.card.size = bytes.length; state.card.startedAt = performance.now();
        try { await files.upload(path, bytes, { overwrite: false, signal: controller.signal, onProgress: (progress) => { if (state.card) { state.card.progress = progress; renderCardBar(); } } }); written += 1; lastRate = describeTransfer(files.lastTransfer); }
        catch (error) { if (error?.status === 13) skipped.push(item.fileName); else throw error; }
      }
      if (written) { try { await files.rescanLibraries(); } catch { /* older firmware: the card is re-read at the next power-up */ } }
      if (skipped.length) onError(new Error(`${skipped.length} file${skipped.length === 1 ? ' was' : 's were'} not written because the name already exists on the card (${skipped.slice(0, 3).join(', ')}). Press “Use free numbers from card” and write again.`));
      if (written) { onSuccess(`${written} file${written === 1 ? '' : 's'} written to the card; the module re-reads its libraries now`); showResult(`Written ${written} file${written === 1 ? '' : 's'}. Last file: ${lastRate}`); }
    } catch (error) {
      if (error?.name !== 'AbortError') onError(new Error(describeFsError(error), { cause: error }));
    } finally { endJob(); state.card = null; renderCardBar(); updateHeading(); if (written) await loadCard(); }
  }

  async function downloadCardFile(entry) {
    const client = files(); if (!client || state.card) return;
    const controller = new AbortController(); state.card = { label: `Reading ${entry.name}`, progress: 0, controller, size: entry.size, startedAt: performance.now() }; renderCardBar(); updateHeading();
    const endJob = beginLinkJob(`Reading ${entry.name}`);
    try {
      const bytes = await client.download(entry.path, { signal: controller.signal, onProgress: (progress) => { if (state.card?.controller === controller) { state.card.progress = progress; renderCardBar(); } } });
      download(bytes, entry.name, 'audio/wav'); showResult(`Read ${entry.name}: ${describeTransfer(client.lastTransfer)}`);
    } catch (error) { if (error?.name !== 'AbortError') onError(new Error(describeFsError(error), { cause: error })); }
    finally { endJob(); if (state.card?.controller === controller) { state.card = null; renderCardBar(); updateHeading(); } }
  }

  // Reads a file from the card and puts it in the loaded list, ready to edit (trim, normalise, send back).
  async function openCardFile(entry, slot) {
    const client = files(); if (!client || state.card) return;
    const controller = new AbortController(); state.card = { label: `Reading ${entry.name}`, progress: 0, controller, size: entry.size, startedAt: performance.now() }; renderCardBar(); updateHeading();
    let bytes = null; const endJob = beginLinkJob(`Reading ${entry.name}`);
    try {
      bytes = await client.download(entry.path, { signal: controller.signal, onProgress: (progress) => { if (state.card?.controller === controller) { state.card.progress = progress; renderCardBar(); } } });
    } catch (error) { if (error?.name !== 'AbortError') onError(new Error(describeFsError(error), { cause: error })); }
    finally { endJob(); if (state.card?.controller === controller) { state.card = null; renderCardBar(); updateHeading(); } }
    if (bytes) {
      showResult(`Read ${entry.name}: ${describeTransfer(client.lastTransfer)}`); state.importing = true; renderList();
      const file = new File([bytes], `SLOT${slot} ${entry.name}`, { type: 'audio/wav' });
      try {
        const item = await decodedFile(file); item.slot = slot;
        state.items.push(item); state.selected = item; renderEditor();
      } catch (error) { onError(new Error(`Could not decode “${file.name}”`, { cause: error })); }
      finally { state.importing = false; refreshSide(); }
    }
  }

  async function deleteCardFile(entry) {
    const client = files(); if (!client || state.card) return;
    try { await client.remove(entry.path); if (looper()) await client.rescanLibraries().catch(() => {}); onSuccess(`${entry.name} deleted from the card`); }
    catch (error) { onError(new Error(describeFsError(error), { cause: error })); }
    await loadCard();
  }

  // Erase every loop in /LOOPS. The card's own listing is the source; a locked file stays.
  async function eraseAllLoops() {
    const client = files(); if (!client || loop.busy || state.card) return;
    const targets = loop.files.filter((file) => !file.locked); if (!targets.length) return;
    loop.busy = true; loop.failed = false; loop.confirmErase = false; let done = 0;
    const endJob = beginLinkJob('Erasing loops');
    try {
      for (const file of targets) {
        loop.message = `Erasing loops… ${done} of ${targets.length}`; refreshSide();
        await client.remove(file.path); done += 1;
      }
      loop.message = `Erased ${done} loops from the card`; onSuccess(loop.message);
    } catch (error) {
      loop.failed = true; loop.message = `Stopped after ${done} of ${targets.length}: ${describeFsError(error)}`; onError(new Error(loop.message, { cause: error }));
    } finally {
      endJob(); loop.busy = false; await client.rescanLibraries().catch(() => {}); await loadCard();
    }
  }

  async function eraseSlot(group) {
    const client = files();
    if (!client || state.card || state.cardLoading || !group.existing.length || group.existing.some((entry) => entry.locked)) return;
    if (!confirm(`Erase all ${group.existing.length} WAV files from Slot ${group.slot + 1} (SLOT${group.slot})? This cannot be undone.`)) return;
    const controller = new AbortController();
    let removed = 0;
    state.confirming = null;
    state.card = { label: `Erasing Slot ${group.slot + 1}`, progress: 0, controller };
    renderCardBar(); updateHeading(); renderPlan();
    try {
      for (const entry of group.existing) {
        if (controller.signal.aborted) break;
        await client.remove(entry.path);
        removed += 1;
        state.card.progress = removed / group.existing.length;
        renderCardBar();
      }
      onSuccess(`${removed} WAV files erased from Slot ${group.slot + 1}${controller.signal.aborted ? ' (cancelled)' : ''}`);
    } catch (error) { onError(new Error(`${removed} files erased. ${describeFsError(error)}`, { cause: error })); }
    finally {
      if (removed) {
        try { await client.rescanLibraries(); } catch (error) { onError(new Error(describeFsError(error), { cause: error })); }
      }
      state.card = null; renderCardBar(); updateHeading(); await loadCard();
    }
  }

  async function exportZip() {
    const current = plan(); const checked = validation(); if (!checked.valid) return onError(new Error(checked.errors[0]));
    state.exporting = true; updateHeading();
    try {
      const files = []; for (const item of current) files.push({ name: `SLOT${item.slot}/${item.fileName}`, data: await wavFor(item) });
      download(createStoreZip(files), 'pentavox_samples.zip', 'application/zip');
    } catch (error) { onError(error); } finally { state.exporting = false; updateHeading(); }
  }

  function field(labelText, input) { const label = el('label', 'sampler-field'); label.append(el('span', '', labelText), input); return label; }
  function numberInput(value, min, max, step, change, label) { const input = document.createElement('input'); input.type = 'number'; input.value = value; input.min = min; input.max = max; input.step = step; input.setAttribute('aria-label', label); input.addEventListener('change', () => change(Number(input.value))); return input; }

  // ---------------------------------------------------------------- skeleton (built once)

  const exportButton = button('Download SD folder (.zip)'); exportButton.addEventListener('click', exportZip);
  const cardButton = button('Write to SD card', 'primary'); cardButton.addEventListener('click', () => writeToCard(state.items));

  const cardBar = el('div', 'sdc-transfer'); cardBar.hidden = true;
  const workspace = el('div', 'sampler-workspace'); const main = el('section', 'sampler-main');
  const filesPane = el('aside', 'sampler-files'); const list = el('ul', 'sample-list'); list.setAttribute('aria-label', 'Loaded files');
  const picker = document.createElement('input'); picker.type = 'file'; picker.multiple = true; picker.accept = '.wav,.mp3,.flac,.ogg,.oga,.aif,.aiff,audio/*'; picker.hidden = true; picker.addEventListener('change', () => { importFiles([...picker.files]); picker.value = ''; });
  const drop = el('div', 'sample-drop'); drop.tabIndex = 0; drop.setAttribute('role', 'button'); drop.setAttribute('aria-label', 'Drop audio files here or press Enter to choose files');
  const dropTitle = el('strong'); const choose = button('Choose files'); choose.addEventListener('click', (event) => { event.stopPropagation(); picker.click(); });
  drop.append(dropTitle, el('span', '', 'WAV, MP3, FLAC, OGG, AIFF: any format Chrome can decode'), choose, picker);
  drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); }); drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (event) => { event.preventDefault(); drop.classList.remove('dragging'); importFiles([...event.dataTransfer.files]); });
  drop.addEventListener('keydown', (event) => { if (event.target === drop && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); picker.click(); } });
  const planPanel = el('aside', 'sd-plan');
  const listCard = el('section', 'sx-card sf-card'); const listHead = el('header', 'sx-chead'); const listCount = el('small', 'sf-count');
  listHead.append(el('h3', '', 'Files to convert'), listCount); listCard.append(listHead, list);
  filesPane.append(listCard, drop, planPanel);
  const editorHost = el('section', 'sampler-editor'); main.append(filesPane, editorHost);
  workspace.append(main); root.replaceChildren(cardBar, workspace);

  // Speed is shown in the bar itself: live while a transfer runs, then the finished line stays for a while.
  let resultTimer = null;
  function showResult(text) { state.result = text; clearTimeout(resultTimer); resultTimer = setTimeout(() => { state.result = ''; renderCardBar(); }, 20000); renderCardBar(); }
  function liveRate(card) {
    const seconds = (performance.now() - (card.startedAt ?? performance.now())) / 1000;
    return card.size && seconds > 0.5 && card.progress > 0 ? ` \u00b7 ${Math.round(card.progress * card.size / 1024 / seconds)} KB/s` : '';
  }
  function renderCardBar() {
    cardBar.replaceChildren();
    if (!state.card) {
      cardBar.hidden = !state.result; if (!state.result) return;
      const dismiss = button('Dismiss', 'quiet-button'); dismiss.addEventListener('click', () => { state.result = ''; renderCardBar(); });
      cardBar.append(el('span', '', state.result), dismiss); return;
    }
    cardBar.hidden = false;
    const meter = document.createElement('progress'); meter.max = 1; meter.value = state.card.progress;
    const cancel = button('Cancel', 'quiet-button'); cancel.addEventListener('click', () => state.card?.controller.abort());
    cardBar.append(el('span', '', `${state.card.label} \u00b7 ${Math.round(state.card.progress * 100)}%${liveRate(state.card)}`), meter, cancel);
  }

  function updateHeading() {
    const checked = validation();
    exportButton.textContent = state.exporting ? 'Building archive…' : 'Download SD folder (.zip)'; exportButton.disabled = state.exporting || !state.items.length || !checked.valid;
    const connected = Boolean(getClient() && getInfo());
    cardButton.textContent = state.card ? 'Working…' : 'Write to SD card'; cardButton.disabled = !connected || Boolean(state.card) || !state.items.length || !checked.valid;
    cardButton.title = !connected ? 'Connect the module first' : 'Write every file to its SLOT folder on the module\u2019s card';
  }

  // ---------------------------------------------------------------- file list
  function listWave(canvas, item) {
    const ratio = window.devicePixelRatio || 1; const w = 84; const h = 28; canvas.width = w * ratio; canvas.height = h * ratio; const ctx = canvas.getContext('2d');
    const peaks = computePeaks(item.pyramid, 0, item.duration, canvas.width); const colour = getComputedStyle(canvas).color; ctx.fillStyle = colour; const mid = canvas.height / 2;
    for (let c = 0; c < canvas.width; c += 1) {
      if (peaks.min[c] > peaks.max[c]) continue; const t = (c + 0.5) / canvas.width * item.duration; ctx.globalAlpha = t >= item.trimStart && t <= item.trimEnd ? 1 : 0.3;
      const top = Math.round(mid - peaks.max[c] * mid * 0.9); const bottom = Math.max(top + 1, Math.round(mid - peaks.min[c] * mid * 0.9)); ctx.fillRect(c, top, 1, bottom - top);
    }
  }

  function renderList() {
    const hadFocus = list.contains(document.activeElement); const slotCounts = validation().counts; let focusTarget = null;
    list.replaceChildren(); listCount.textContent = state.items.length ? String(state.items.length) : ''; dropTitle.textContent = state.importing ? 'Decoding…' : 'Drop audio files here'; choose.disabled = state.importing;
    for (const item of state.items) {
      const row = el('li', `sample-row${item === state.selected ? ' selected' : ''}`); const select = button('', 'sample-select'); select.setAttribute('aria-current', String(item === state.selected));
      const wave = el('canvas', 'sl-wave'); wave.setAttribute('aria-hidden', 'true'); const text = el('span', 'sl-text'); const trimmed = item.trimEnd - item.trimStart;
      const tempo = item.bpm && item.beats ? `${item.bpm} BPM · ${item.beats} beats · ` : '';
      text.append(el('strong', '', item.name), el('span', '', `${seconds(item.duration)} · ${item.audio.channels.length} ch`), el('span', '', `${tempo}${sliceSummary(item)}`));
      select.append(wave, text); const problem = trimmed > MAX_CLIP_SECONDS ? `Longer than ${MAX_CLIP_SECONDS} s after trimming` : slotCounts[item.slot] > 16 ? `Slot ${item.slot + 1} has more than 16 files` : '';
      if (problem) { const dot = el('span', 'sl-warn'); dot.title = problem; dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', problem); select.append(dot); }
      select.addEventListener('click', () => selectItem(item));
      const remove = button('✕', 'sl-remove', `Remove ${item.name}`); remove.addEventListener('click', () => removeItem(item));
      row.append(select, remove); list.append(row); listWave(wave, item); if (item === state.selected) focusTarget = select;
    }
    if (!state.items.length) list.append(el('li', 'sl-empty', 'No files yet'));
    if (hadFocus && focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function selectItem(item) { if (state.selected === item) return; state.selected = item; renderEditor(); renderList(); }
  function removeItem(item) {
    const index = state.items.indexOf(item); state.items = state.items.filter((other) => other !== item);
    if (state.selected === item) { state.selected = state.items[Math.min(index, state.items.length - 1)] ?? null; renderEditor(); }
    refreshSide();
  }

  // ---------------------------------------------------------------- editor panel
  function renderEditor() {
    breakPanel?.destroy(); breakPanel = null; sliceBar?.destroy(); sliceBar = null; editor?.destroy(); editor = null; editorHost.replaceChildren(); hooks = { fields: () => {}, status: () => {} }; const item = state.selected;
    if (!item) { editorHost.append(el('div', 'sampler-empty', 'Add one or more files. Their waveform and conversion settings will appear here.')); return; }
    const card = el('article', 'sample-card sx-card'); const head = el('header', 'sample-head sx-chead'); const title = el('div', 'sample-title');
    title.append(el('strong', '', item.name), el('span', '', `${seconds(item.duration)} · ${item.audio.channels.length} ch · ${item.audio.sampleRate.toLocaleString('en-US')} Hz`)); head.append(title); card.append(head);
    const body = el('div', 'se-body'); card.append(body);
    const selection = () => ({ start: item.trimStart, end: item.trimEnd });
    editor = createWaveEditor(item, { getContext: context, onError, onChange: () => { hooks.fields(); refreshSide(); } }); body.append(editor.el);
    sliceBar = createSliceBar(item, { editor, onChange: () => { hooks.fields(); renderList(); breakPanel?.refresh(); } });
    breakPanel = createBreakPanel(item, { getContext: context, onChange: () => hooks.status() });
    const controls = el('div', 'sample-controls se-fields');
    const startInput = numberInput(item.trimStart.toFixed(3), 0, item.duration, .001, (value) => { if (Number.isFinite(value)) editor.setSelection(dragHandle('start', value, selection(), item.duration)); hooks.fields(); refreshSide(); }, 'Trim start');
    const endInput = numberInput(item.trimEnd.toFixed(3), 0, item.duration, .001, (value) => { if (Number.isFinite(value)) editor.setSelection(dragHandle('end', value, selection(), item.duration)); hooks.fields(); refreshSide(); }, 'Trim end');
    controls.append(field('Start, s', startInput), field('End, s', endInput));
    const mode = document.createElement('select'); for (const [value, label] of [['mono', 'Mono'], ['stereo', 'Stereo']]) { const option = el('option', '', label); option.value = value; option.selected = item.channelMode === value; if (value === 'stereo' && item.audio.channels.length === 1) option.disabled = true; mode.append(option); } mode.addEventListener('change', () => { item.channelMode = mode.value; refreshSide(); }); controls.append(field('Channels', mode));
    const slot = document.createElement('select'); for (let index = 0; index < slotCount(); index += 1) { const option = el('option', '', `Slot ${index + 1}`); option.value = index; option.selected = item.slot === index; slot.append(option); } slot.addEventListener('change', () => { item.slot = Number(slot.value); refreshSide(); }); controls.append(field('SD folder', slot));
    const normalize = el('label', 'check-field'); const check = document.createElement('input'); check.type = 'checkbox'; check.checked = item.normalize; check.addEventListener('change', () => { item.normalize = check.checked; }); normalize.append(check, el('span', '', 'Normalize to −1 dBFS'));
    const bpmInput = numberInput(item.bpm, 1, 999, .01, (value) => { item.bpm = value > 0 ? value : ''; item.tempoAuto = false; updateStretch(); refreshSide(); }, 'Tempo in BPM');
    const beatsInput = numberInput(item.beats, 1, 99999, 1, (value) => { item.beats = Number.isInteger(value) && value > 0 ? value : ''; item.tempoAuto = false; updateTempoButtons(); refreshSide(); }, 'Beat count');
    const halfTempo = button('÷2'); halfTempo.title = 'Use the half-time alternative (halve tempo and beat count together)'; halfTempo.setAttribute('aria-label', 'Halve tempo and beat count');
    const doubleTempo = button('×2'); doubleTempo.title = 'Use the double-time alternative (double tempo and beat count together)'; doubleTempo.setAttribute('aria-label', 'Double tempo and beat count');
    const stretchInput = document.createElement('input'); stretchInput.type = 'number'; stretchInput.min = '1'; stretchInput.max = '999'; stretchInput.step = '.01'; stretchInput.value = item.stretchTarget ?? ''; stretchInput.setAttribute('aria-label', 'Stretch target in BPM');
    const stretchButton = button('Stretch'); const restoreButton = button('Restore original'); restoreButton.hidden = !item.original;
    function stretchRatio() { const source = Number(item.bpm); const target = Number(stretchInput.value); return source > 0 && target > 0 ? source / target : NaN; }
    function updateTempoButtons() {
      const bpm = Number(item.bpm); const beats = Number(item.beats); const valid = bpm > 0 && Number.isInteger(beats) && beats > 0;
      halfTempo.disabled = !valid || beats % 2 !== 0 || bpm / 2 < 1;
      doubleTempo.disabled = !valid || bpm * 2 > 999 || beats * 2 > 99999;
    }
    function updateStretch() { const ratio = stretchRatio(); stretchButton.disabled = item.stretching || !Number.isFinite(ratio) || Math.abs(ratio - 1) < 1e-9 || ratio < 0.5 || ratio > 2; stretchButton.textContent = item.stretching ? 'Stretching…' : 'Stretch'; updateTempoButtons(); }
    function scaleTempo(factor) {
      const bpm = Number(item.bpm); const beats = Number(item.beats); if (!(bpm > 0) || !Number.isInteger(beats) || !(beats > 0)) return;
      const nextBeats = beats * factor; if (!Number.isInteger(nextBeats) || nextBeats < 1) return;
      item.bpm = Number((bpm * factor).toFixed(4)); item.beats = nextBeats; item.tempoAuto = false;
      hooks.fields(); refreshSide(); renderList(); breakPanel?.refresh();
    }
    halfTempo.addEventListener('click', () => scaleTempo(0.5)); doubleTempo.addEventListener('click', () => scaleTempo(2));
    stretchInput.addEventListener('input', () => { item.stretchTarget = stretchInput.value; item.stretchError = false; updateStretch(); hooks.status(); });
    stretchButton.addEventListener('click', () => {
      const sourceBpm = Number(item.bpm); const targetBpm = Number(stretchInput.value); const ratio = stretchRatio(); const nextDuration = (item.trimEnd - item.trimStart) * ratio;
      if (nextDuration > MAX_CLIP_SECONDS + 1e-9) { item.stretchError = true; item.stretchStatus = `Stretching to ${targetBpm} BPM would make this clip ${seconds(nextDuration)}; the maximum is ${MAX_CLIP_SECONDS} s.`; hooks.status(); return; }
      item.stretching = true; item.stretchError = false; updateStretch();
      setTimeout(() => {
        try {
          item.original ??= { audio: { sampleRate: item.audio.sampleRate, channels: item.audio.channels.map((channel) => channel.slice()) }, duration: item.duration, trimStart: item.trimStart, trimEnd: item.trimEnd, markers: item.slices.markers, oneShot: item.slices.oneShot, playMode: item.slices.playMode, step: item.slices.step, playFilter: item.slices.playFilter, labels: item.slices.labels, bpm: item.bpm };
          const oldDuration = item.duration; const channels = timeStretch(item.audio.channels, item.audio.sampleRate, ratio); const duration = channels[0].length / item.audio.sampleRate; const scale = duration / oldDuration;
          item.audio = { sampleRate: item.audio.sampleRate, channels }; item.duration = duration; item.trimStart *= scale; item.trimEnd *= scale;
          item.slices = new SliceModel(duration, { markers: item.slices.markers.map((marker) => marker * scale), oneShot: item.slices.oneShot, playMode: item.slices.playMode, step: item.slices.step, playFilter: item.slices.playFilter, labels: item.slices.labels.map((label, i) => label) });
          item.bpm = targetBpm; item.tempoAuto = false; item.pyramid = buildPeakPyramid(channels, item.audio.sampleRate); item.view = fitView(duration); item.playhead = 0; delete item.audioBuffer;
          item.stretchStatus = `stretched ${sourceBpm} -> ${targetBpm} BPM, ${seconds(oldDuration)} -> ${seconds(duration)}`; item.stretching = false; renderEditor(); refreshSide();
        } catch (error) { item.stretching = false; updateStretch(); onError(error); }
      }, 0);
    });
    restoreButton.addEventListener('click', () => {
      const original = item.original; if (!original) return;
      item.audio = { sampleRate: original.audio.sampleRate, channels: original.audio.channels.map((channel) => channel.slice()) }; item.duration = original.duration; item.trimStart = original.trimStart; item.trimEnd = original.trimEnd;
      item.slices = new SliceModel(original.duration, { markers: original.markers, oneShot: original.oneShot, playMode: original.playMode, step: original.step, playFilter: original.playFilter, labels: original.labels }); item.bpm = original.bpm; item.tempoAuto = false;
      item.pyramid = buildPeakPyramid(item.audio.channels, item.audio.sampleRate); item.view = fitView(item.duration); item.playhead = 0; item.stretchTarget = ''; item.stretchError = false; item.stretchStatus = 'restored original audio and markers'; delete item.audioBuffer;
      renderEditor(); refreshSide();
    });
    // Shift start: a take recorded on MIDI Start begins with the previous cycle's tail (the DAW's audio arrives late), so the
    // first N ms are rotated to the end and the loop lines up. Negative values rotate the other way.
    const shiftInput = document.createElement('input'); shiftInput.type = 'number'; shiftInput.step = '1'; shiftInput.placeholder = 'ms'; shiftInput.setAttribute('aria-label', 'Shift the start of the loop by this many milliseconds');
    shiftInput.title = 'Moves the first N ms to the end of the loop (negative: the last N ms to the front). Fixes the late DAW audio on a take recorded on MIDI Start.';
    const shiftButton = button('Shift start');
    shiftButton.addEventListener('click', () => {
      const ms = Number(shiftInput.value); const rate = item.audio.sampleRate;
      if (!Number.isFinite(ms) || ms === 0) return;
      const frames = Math.round(ms / 1000 * rate); const length = item.audio.channels[0].length;
      if (!length || Math.abs(frames) >= length) { onError(new Error('That shift is longer than the clip')); return; }
      item.original ??= { audio: { sampleRate: rate, channels: item.audio.channels.map((channel) => channel.slice()) }, duration: item.duration, trimStart: item.trimStart, trimEnd: item.trimEnd, markers: item.slices.markers, oneShot: item.slices.oneShot, playMode: item.slices.playMode, step: item.slices.step, playFilter: item.slices.playFilter, labels: item.slices.labels, bpm: item.bpm };
      const channels = rotateChannels(item.audio.channels, frames); const moved = rotateMarkers(item.slices.markers, item.slices.labels, item.duration, frames / rate);
      item.audio = { sampleRate: rate, channels }; item.trimStart = 0; item.trimEnd = item.duration;
      item.slices = new SliceModel(item.duration, { markers: moved.markers, labels: moved.labels, oneShot: item.slices.oneShot, playMode: item.slices.playMode, step: item.slices.step, playFilter: item.slices.playFilter });
      item.pyramid = buildPeakPyramid(channels, rate); item.view = fitView(item.duration); item.playhead = 0; delete item.audioBuffer;
      item.stretchError = false; item.stretchStatus = `shifted the start by ${ms} ms (${ms > 0 ? 'the first' : 'the last'} ${Math.abs(ms)} ms moved to the ${ms > 0 ? 'end' : 'front'}); trim reset to the whole clip`;
      restoreButton.hidden = false; renderEditor(); refreshSide();
    });
    const tempoPanel = el('section', 'sx-panel sx-tempo'); const tempoHead = el('header', 'sx-phead'); tempoHead.append(el('h3', '', 'Tempo'));
    const tempoRow = el('div', 'sx-tempo-row'); const dot = () => el('span', 'sx-dot', '·');
    tempoRow.append(field('Tempo, BPM', bpmInput), field('Beats', beatsInput), halfTempo, doubleTempo, dot(), field('Stretch to, BPM', stretchInput), stretchButton, dot(), field('Shift start, ms', shiftInput), shiftButton, restoreButton);
    tempoPanel.append(tempoHead, tempoRow); updateStretch();
    const footer = el('footer', 'sample-status se-foot');
    body.append(controls, normalize, sliceBar.el, tempoPanel, breakPanel.el, footer); editorHost.append(card);
    hooks = {
      fields() { startInput.value = item.trimStart.toFixed(3); endInput.value = item.trimEnd.toFixed(3); bpmInput.value = item.bpm; beatsInput.value = item.beats; updateStretch(); },
      status() {
        footer.replaceChildren(); footer.classList.remove('error'); const index = state.items.indexOf(item); const planned = plan()[index]; if (!planned) return;
        const checked = validation(); const slotCount = checked.counts[item.slot]; const trimmedDuration = item.trimEnd - item.trimStart;
        const note = el('div', 'se-note');
        if (item.stretchError) { footer.classList.add('error'); note.classList.add('error'); note.append(el('span', '', item.stretchStatus)); }
        else if (trimmedDuration > MAX_CLIP_SECONDS) { footer.classList.add('error'); note.classList.add('error'); note.append(el('span', '', `The clip is ${seconds(trimmedDuration)}; the maximum is ${MAX_CLIP_SECONDS} s.`)); const trim = button('Trim to 30 s'); trim.addEventListener('click', () => { editor.setSelection(cap30(selection(), item.duration)); hooks.fields(); refreshSide(); }); note.append(trim); }
        else if (slotCount > 16) { footer.classList.add('error'); note.classList.add('error'); note.append(el('span', '', `Slot ${item.slot + 1} has more than 16 files, so this set cannot be exported.`)); }
        else note.append(el('span', '', item.stretchStatus || `${planned.fileName} · after conversion ${seconds(trimmedDuration)} / 48 kHz`));
        footer.append(note);
        const row = el('div', 'se-actions');
        const toCard = button('Write to SD card', 'primary'); toCard.disabled = !getClient() || !getInfo() || trimmedDuration > MAX_CLIP_SECONDS || Boolean(state.card) || !checked.valid; toCard.addEventListener('click', () => writeToCard([item]));
        const wav = button('Download WAV only'); wav.disabled = trimmedDuration > MAX_CLIP_SECONDS; wav.addEventListener('click', async () => { try { download(await wavFor(item), planned.fileName, 'audio/wav'); } catch (error) { onError(error); } }); row.append(toCard, wav, el('span', 'sx-dot', '·'));
        const connected = Boolean(getClient() && getInfo()); const tooLong = trimmedDuration > MAX_CLIP_SECONDS; const active = state.upload;
        const actions = el('div', 'sample-send-actions');
        actions.append(el('span', 'send-label', connected ? 'Play on the module:' : 'Connect the module (top right) to play this on it'));
        for (let voice = 0; voice < 2; voice += 1) {
          const send = button(`Send to voice ${voice + 1}`, 'send-button'); send.disabled = !connected || tooLong || Boolean(active);
          send.title = !connected ? 'Connect the module first' : tooLong ? 'The selection is longer than 30 seconds' : active ? 'Another sample upload is in progress' : `Send the current selection to sampler voice ${voice + 1}`;
          send.addEventListener('click', () => sendToVoice(item, voice)); actions.append(send);
        }
        row.append(actions); footer.append(row);
        if (active?.item === item) {
          const progress = el('div', 'sample-upload-progress'); const meter = document.createElement('progress'); meter.max = 1; meter.value = active.progress;
          const cancel = button('Cancel', 'quiet-button'); cancel.addEventListener('click', () => active.controller.abort());
          progress.append(el('span', '', `Sending to voice ${active.voice + 1} · ${Math.round(active.progress * 100)}%`), meter, cancel); footer.append(progress);
        }
      },
    };
    hooks.status();
  }

  // ---------------------------------------------------------------- live SD card panel
  async function saveLoop() {
    const loops = loopClient(); if (!loops || loop.busy) return;
    loop.busy = true; loop.failed = false; loop.message = 'Saving the loop that plays now…'; refreshSide();
    const endJob = beginLinkJob('Saving a loop');
    try {
      await loops.save();
      const status = await loops.finish({ onStatus: (now) => { if (now.state === 'working') { loop.message = 'Saving the loop that plays now…'; } } });
      if (status.state === 'failed') { loop.failed = true; loop.message = 'The module could not save the loop (card full or removed?)'; onError(new Error(loop.message)); }
      else { loop.message = `Saved ${loopFileName(status.lastNumber)} · ${(status.frames / 48000).toFixed(1)} s in ${(status.ms / 1000).toFixed(1)} s`; onSuccess(loop.message); }
    } catch (error) { if (error?.name !== 'AbortError') { loop.failed = true; loop.message = describeLoopError(error); onError(new Error(loop.message, { cause: error })); } }
    finally { endJob(); loop.busy = false; await loadCard(); }
  }

  async function loadLoop(file, slot) {
    const loops = loopClient(); if (!loops || loop.busy) return;
    loop.busy = true; loop.failed = false; loop.message = `Loading ${file.name} into loop ${slot + 1}…`; refreshSide();
    const endJob = beginLinkJob(`Loading ${file.name}`);
    try {
      await loops.load(slot, file.number);
      const status = await loops.finish();
      if (status.state === 'failed') { loop.failed = true; loop.message = `The module could not load ${file.name} (not a loop it can use?)`; onError(new Error(loop.message)); }
      else { loop.message = `${file.name} is loop ${slot + 1} now · it starts at the next bar line`; onSuccess(loop.message); }
    } catch (error) { if (error?.name !== 'AbortError') { loop.failed = true; loop.message = describeLoopError(error); onError(new Error(loop.message, { cause: error })); } }
    finally { endJob(); loop.busy = false; refreshSide(); }
  }

  async function renumberLoop(file) {
    const client = files(); if (!client || loop.busy || state.card) return;
    const answer = prompt(`New number for ${file.name} (1-9999)`, String(file.number)); if (answer === null) return;
    const problem = renumberProblem(loop.files, file.number, answer);
    if (problem) return onError(new Error(problem));
    if (Number(answer) === file.number) return;
    try { await client.rename(file.path, `${LOOP_DIR}/${loopFileName(Number(answer))}`); onSuccess(`${file.name} is now ${loopFileName(Number(answer))}`); await client.rescanLibraries().catch(() => {}); }
    catch (error) { onError(new Error(describeFsError(error), { cause: error })); }
    await loadCard();
  }

  function renderLoopPlan() {
    const pageY = window.scrollY; planPanel.replaceChildren();
    const card = el('section', 'sx-card sd-card loop-card'); const top = el('header', 'sx-chead sd-card-head'); top.append(el('h3', '', 'Loops on the SD card'));
    if (state.cardInfo) {
      const chip = el('span', 'sx-chip ok'); chip.append(el('span', 'sx-dotled'), document.createTextNode(cardSummary(state.cardInfo).split(' · ')[0])); top.append(chip);
    }
    top.append(el('span', 'sp'));
    const refresh = button(state.cardLoading ? 'Refreshing…' : 'Refresh', 'quiet-button'); refresh.disabled = state.cardLoading || loop.busy || !files(); refresh.addEventListener('click', loadCard); top.append(refresh);
    const all = button('Browse all files…', 'quiet-button'); all.addEventListener('click', onOpenSdTab); top.append(all);
    const body = el('div', 'sd-card-body');
    const save = button(loop.busy ? 'Working…' : 'Save loop', 'primary'); save.disabled = loop.busy || state.cardLoading || !loopClient() || !state.cardInfo;
    save.title = 'Save the loop that plays now to the next free /LOOPS/NNNN.WAV (the same as B1 + hold B2 on the module)'; save.addEventListener('click', saveLoop);
    const hint = el('small', loop.failed ? 'error' : '', loop.message || (state.cardInfo ? 'Save the loop that plays now, or load a file into one of the two loops.' : state.cardProblem || (state.cardLoading ? 'Reading the card…' : 'Connect the module to see its loops')));
    body.append(el('div', 'sd-live-actions', ''), hint); body.firstChild.append(save);
    const erasable = loop.files.filter((file) => !file.locked).length;
    if (erasable) {
      const erase = el('div', 'loop-erase');
      if (loop.confirmErase && !loop.busy) {
        const sure = button(`Erase all ${erasable}`, 'quiet-button danger confirming'); sure.addEventListener('click', eraseAllLoops);
        const cancel = button('Cancel', 'quiet-button'); cancel.addEventListener('click', () => { loop.confirmErase = false; renderPlan(); });
        erase.append(el('span', 'loop-erase-q', `Erase all ${erasable} loops from /LOOPS? This cannot be undone.`), cancel, sure);
      } else {
        const start = button('Erase all…', 'quiet-button danger'); start.disabled = loop.busy || Boolean(state.card) || state.cardLoading || !files();
        start.title = 'Delete every loop file in /LOOPS (asks first)'; start.addEventListener('click', () => { loop.confirmErase = true; renderPlan(); });
        erase.append(start);
      }
      body.append(erase);
    }
    const rows = el('div', 'sd-files loop-files');
    for (const file of loop.files) {
      const row = el('div', 'sd-file card-file loop-file'); const info = el('div', 'sd-file-info loop-file-info');
      info.append(el('code', '', file.name), el('span', '', `${file.seconds.toFixed(1)} s · ${formatSize(file.size)}`));
      const load = el('div', 'loop-file-load');
      for (let slot = 0; slot < LOOP_SLOTS; slot += 1) { const b = button(`Load → ${slot + 1}`, 'quiet-button load'); b.title = `Put this loop into loop slot ${slot + 1}`; b.disabled = loop.busy || Boolean(state.card); b.addEventListener('click', () => loadLoop(file, slot)); load.append(b); }
      const tools = el('div', 'loop-file-tools');
      const get = button('Download', 'quiet-button'); get.disabled = Boolean(state.card) || loop.busy; get.addEventListener('click', () => downloadCardFile(file));
      const number = button('Renumber…', 'quiet-button'); number.disabled = Boolean(state.card) || loop.busy; number.addEventListener('click', () => renumberLoop(file));
      const confirming = state.confirming === file.path;
      const remove = button(confirming ? 'Delete?' : 'Delete', `quiet-button danger${confirming ? ' confirming' : ''}`); remove.disabled = Boolean(state.card) || loop.busy || file.locked;
      remove.addEventListener('click', () => { if (confirming) { state.confirming = null; deleteCardFile(file); } else { state.confirming = file.path; renderPlan(); } });
      tools.append(get, number, remove); row.append(info, load, tools); rows.append(row);
    }
    if (!loop.files.length) rows.append(el('span', 'sd-empty', state.cardInfo ? 'No loops on the card yet' : 'No files to show'));
    const total = loop.files.reduce((sum, file) => sum + file.size, 0);
    const next = loopFileName(loop.files.reduce((top2, file) => Math.max(top2, file.number), 0) + 1);
    card.append(top, body, rows, el('footer', 'loop-foot', `${loop.files.length} loops · ${formatSize(total)} · the module numbers them, the next is ${next}`));
    planPanel.append(card); window.scrollTo(window.scrollX, pageY);
  }

  function renderPlan() {
  if (looper()) { renderLoopPlan(); return; }
    const currentPlan = plan(); const checked = validation(); const groups = mergeSamplerSlots(currentPlan, state.cardFiles, slotCount()); const defaults = nextStartNumbers(state.cardFiles, slotCount());
    // Rebuilding the panel collapses the page for a moment, which used to throw the scroll position to the top.
    const pageX = window.scrollX, pageY = window.scrollY; const listScroll = [...planPanel.querySelectorAll('.sd-files')].map((node) => node.scrollTop);
    const focusedConfirm = planPanel.contains(document.activeElement) && document.activeElement.dataset?.confirmFor;
    planPanel.replaceChildren();
    const sdCard = el('section', 'sx-card sd-card'); const top = el('header', 'sx-chead sd-card-head'); top.append(el('h3', '', 'SD card'));
    const cardState = el('div', 'sd-live-state'); const body = el('div', 'sd-card-body');
    if (state.cardInfo) {
      const summary = cardSummary(state.cardInfo); const kind = summary.split(' · ')[0];
      const chip = el('span', 'sx-chip ok'); chip.append(el('span', 'sx-dotled'), document.createTextNode(kind)); top.append(chip);
      if (state.cardInfo.freeKnown && state.cardInfo.totalKiB > 0) { const meter = document.createElement('progress'); meter.max = state.cardInfo.totalKiB; meter.value = Math.max(0, state.cardInfo.totalKiB - state.cardInfo.freeKiB); meter.setAttribute('aria-label', 'Space used'); cardState.append(meter); }
      cardState.append(el('small', '', summary));
    } else cardState.append(el('small', state.cardProblem ? 'error' : '', state.cardLoading ? 'Reading the card…' : state.cardProblem || 'Connect the module to see what is on the card'));
    top.append(el('span', 'sp'));
    const refresh = button(state.cardLoading ? 'Refreshing…' : 'Refresh', 'quiet-button'); refresh.disabled = state.cardLoading || Boolean(state.card) || !files(); refresh.addEventListener('click', loadCard); top.append(refresh);
    const all = button('Browse all files…', 'quiet-button'); all.addEventListener('click', onOpenSdTab);
    const actions = el('div', 'sd-live-actions'); actions.append(all, exportButton);
    body.append(cardState, actions);
    if (!checked.valid) { const warnings = el('div', 'sampler-warnings'); for (const error of checked.errors) warnings.append(el('p', '', error)); body.append(warnings); }
    body.append(cardButton); sdCard.append(top, body); planPanel.append(sdCard);
    const slots = el('div', `sd-slots${slotCount() === 2 ? ' two-slots' : ''}`); groups.forEach((group) => {
      const column = el('section', `sd-slot sx-card${group.overLimit ? ' over-limit' : ''}`); const header = el('header', 'sx-chead');
      header.append(el('strong', '', `Slot ${group.slot + 1}`), el('span', 'sd-slot-id', `SLOT${group.slot} · ${group.count}/16`), el('span', 'sp'));
      const startValue = state.starts[group.slot] ?? defaults[group.slot]; const start = numberInput(String(startValue).padStart(4, '0'), 0, 9999, 1, (value) => { state.starts[group.slot] = value; refreshSide(); }, `First number for slot ${group.slot + 1}`);
      const erase = button('Erase all', 'quiet-button danger');
      erase.title = `Delete all WAV files from Slot ${group.slot + 1}`;
      erase.disabled = Boolean(state.card) || state.cardLoading || !files() || !group.existing.length || group.existing.some((entry) => entry.locked);
      erase.addEventListener('click', () => eraseSlot(group)); header.append(erase); column.append(header);
      const numbering = el('label', 'sd-start'); numbering.append(el('span', '', 'Start numbering at'), start); column.append(numbering);
      const rows = el('div', 'sd-files');
      for (const entry of group.existing) {
        const row = el('div', 'sd-file card-file'); const info = el('div', 'sd-file-info'); info.append(el('code', '', entry.name), el('span', '', formatSize(entry.size)));
        const fileActions = el('div', 'sd-file-actions'); const edit = button('Edit', 'quiet-button'); edit.title = 'Read this file from the card into the list above for editing'; edit.disabled = Boolean(state.card); edit.addEventListener('click', () => openCardFile(entry, group.slot)); info.classList.add('openable'); info.title = 'Click to edit this file'; info.addEventListener('click', () => { if (!state.card) openCardFile(entry, group.slot); }); const get = button('Download', 'quiet-button'); get.disabled = Boolean(state.card); get.addEventListener('click', () => downloadCardFile(entry));
        const confirming = state.confirming === entry.path;
        const remove = button(confirming ? 'Delete?' : 'Delete', `quiet-button danger${confirming ? ' confirming' : ''}`); remove.disabled = Boolean(state.card) || entry.locked; remove.dataset.confirmFor = entry.path;
        remove.addEventListener('click', () => { if (confirming) { state.confirming = null; deleteCardFile(entry); } else { state.confirming = entry.path; renderPlan(); } });
        if (confirming) { const cancel = button('Cancel', 'quiet-button'); cancel.addEventListener('click', () => { state.confirming = null; renderPlan(); }); fileActions.append(remove, cancel); } else fileActions.append(edit, get, remove);
        row.append(info, fileActions); rows.append(row);
      }
      for (const item of group.planned) { const row = el('div', 'sd-file planned-file'); const info = el('div', 'sd-file-info'); info.append(el('code', '', item.fileName), el('span', '', seconds(item.trimEnd - item.trimStart))); row.append(info, el('em', 'sx-chip', 'to send')); rows.append(row); }
      if (!group.existing.length && !group.planned.length) rows.append(el('span', 'sd-empty', state.cardInfo ? 'No WAV files' : 'No files to show'));
      const cardBytes = group.existing.reduce((sum, entry) => sum + entry.size, 0); column.append(rows, el('footer', '', `${group.existing.length} on card · ${formatSize(cardBytes)} · ${group.planned.length} to send`)); slots.append(column);
    }); planPanel.append(slots);
    planPanel.querySelectorAll('.sd-files').forEach((node, index) => { node.scrollTop = listScroll[index] ?? 0; });
    window.scrollTo(pageX, pageY);
    if (focusedConfirm) planPanel.querySelector(`[data-confirm-for="${CSS.escape(focusedConfirm)}"]`)?.focus({ preventScroll: true });
  }

  // Everything except the editor itself. Coalesced, so a handle drag costs one pass per frame.
  function refreshSide() {
    if (refreshQueued) return; refreshQueued = true;
    requestAnimationFrame(() => { refreshQueued = false; updateHeading(); renderList(); renderPlan(); hooks.status(); });
  }

  const themeWatch = new MutationObserver(() => refreshSide()); themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  updateHeading(); renderList(); renderEditor(); renderPlan();
  const dispose = () => { ++state.generation; state.upload?.controller.abort(); state.card?.controller.abort(); breakPanel?.destroy(); sliceBar?.destroy(); editor?.destroy(); themeWatch.disconnect(); root.replaceChildren(); };
  dispose.show = () => loadCard();
  dispose.refreshConnection = () => { ++state.generation; state.cardInfo = null; state.cardFiles = Array.from({ length: slotCount() }, () => []); state.starts = Array.from({ length: slotCount() }, () => null); for (const item of state.items) if (item.slot >= slotCount()) item.slot = 0; state.cardProblem = ''; hooks.status(); loadCard(); };
  return dispose;
}
