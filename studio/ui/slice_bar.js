import { beatMarkers, evenMarkers, MAX_MARKERS } from '../model/slices.js';
import { bpmFromName, reconcileTempo } from '../model/tempo_hint.js';
import { PLAY_FILTERS, PLAY_MODES, PLAY_STEPS } from '../model/wav.js';
import { detectOnsets, estimateTempo } from '../model/onsets.js';
import { classifyHits } from '../model/classify.js';

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function button(text, className = '') { const node = el('button', className, text); node.type = 'button'; return node; }

export function createSliceBar(item, { editor, onChange = () => {} }) {
  const root = el('section', 'sb sx-panel');
  const controls = el('div', 'sb-controls');

  const evenCount = document.createElement('input'); evenCount.type = 'number'; evenCount.min = '2'; evenCount.max = '32'; evenCount.step = '1'; evenCount.value = '8'; evenCount.setAttribute('aria-label', 'Number of even slices');
  const evenButton = button('Even');
  const beatsPerSlice = document.createElement('select'); beatsPerSlice.setAttribute('aria-label', 'Beats per slice');
  for (const value of [1, 2, 4]) { const option = el('option', '', String(value)); option.value = String(value); beatsPerSlice.append(option); }
  const beatsButton = button('Beats');
  const sensitivity = document.createElement('input'); sensitivity.type = 'range'; sensitivity.min = '0'; sensitivity.max = '1'; sensitivity.step = '0.05'; sensitivity.value = '0.5'; sensitivity.setAttribute('aria-label', 'Onset detection sensitivity');
  const paintSensitivity = () => sensitivity.style.setProperty('--p', `${Number(sensitivity.value) * 100}%`); sensitivity.addEventListener('input', paintSensitivity); paintSensitivity();
  const detectButton = button('Detect');
  const classifyButton = button('Classify');
  const filterButtons = [['kick', 'Kicks'], ['snare', 'Snares'], ['hat', 'Hats']].map(([type, label]) => [type, button(label, 'sb-filter')]);
  const clearButton = button('Clear'); const undoButton = button('Undo'); const redoButton = button('Redo');
  // Label the selected slice (click its number on the waveform first): Kick / Snare / Hat toggle, None clears; Delete removes its marker.
  const labelGroup = el('span', 'sb-group'); labelGroup.append(el('span', 'sb-hint', 'Label slice'));
  const labelSeg = el('span', 'sb-seg'); labelGroup.append(labelSeg);
  const labelButtons = [['kick', 'Kick', 'K'], ['snare', 'Snare', 'S'], ['hat', 'Hat', 'H'], ['none', 'None', 'None']].map(([action, text, short]) => { const b = button(short, 'sb-filter'); b.dataset.action = action; b.title = `${text} for the selected slice (click a slice number on the waveform first)`; b.setAttribute('aria-label', text); labelSeg.append(b); return b; });
  const removeButton = button('Delete marker', 'sb-filter sb-delete'); removeButton.title = 'Remove the selected slice marker (the slice joins the one before it)'; labelGroup.append(removeButton);
  const oneShot = el('label', 'sb-toggle'); const oneShotInput = document.createElement('input'); oneShotInput.type = 'checkbox'; oneShot.append(oneShotInput, el('span', '', 'One-shot'));
  const playMode = document.createElement('select'); playMode.setAttribute('aria-label', 'How the module plays the slices on its clock');
  PLAY_MODES.forEach((label, value) => { const option = el('option', '', label); option.value = String(value); playMode.append(option); });
  playMode.title = 'On the module, with a clock running: Normal plays the slice a note picks; Forward / Random / Repeat jump between slices on the grid';
  const playStep = document.createElement('select'); playStep.setAttribute('aria-label', 'Clock step between slice jumps');
  PLAY_STEPS.forEach((label, value) => { const option = el('option', '', label); option.value = String(value); playStep.append(option); });
  playStep.title = 'How often the module jumps to another slice';
  const playFilter = document.createElement('select'); playFilter.setAttribute('aria-label', 'Play only this drum type');
  PLAY_FILTERS.forEach((label, value) => { const option = el('option', '', label); option.value = String(value); playFilter.append(option); });
  const status = el('output', 'sb-status'); status.setAttribute('aria-live', 'polite');
  const noteLine = el('div', 'sb-note'); noteLine.setAttribute('aria-live', 'polite');

  evenCount.title = 'How many equal slices Even makes (2-32)'; evenButton.title = 'Cut the file into equal slices';
  beatsPerSlice.title = 'Beats in each slice for Beats'; beatsButton.title = 'Cut on the beat grid (needs a BPM)';
  const dot = () => el('span', 'sx-dot', '·');
  const row = () => el('div', 'sb-row');
  const row1 = row(); row1.append(evenCount, evenButton, dot(), beatsPerSlice, el('span', 'sb-hint', 'beats each'), beatsButton, dot(), el('span', 'sb-hint', 'Sensitivity'), sensitivity, detectButton, classifyButton);
  const row2 = row(); row2.append(el('span', 'sb-hint', 'Keep only'), ...filterButtons.map(([, node]) => node), clearButton, dot(), labelGroup);
  const row3 = row(); const playGroup = el('span', 'sb-group'); playGroup.append(el('span', 'sb-hint', 'Play mode'), playMode, playStep, el('span', 'sb-hint', 'only'), playFilter); row3.append(playGroup, oneShot);
  controls.append(row1, row2, row3, noteLine);
  const head = el('header', 'sx-phead'); head.append(el('h3', '', 'Slices'), status, el('span', 'sp'), undoButton, redoButton);
  root.append(head, controls);

  let timer = null; let destroyed = false; let note = '';
  const changed = () => { editor.refreshSlices(); onChange(); };
  function render() {
    const count = item.slices.sliceCount;
    beatsButton.disabled = !(Number(item.bpm) > 0);
    clearButton.disabled = item.slices.markers.length === 0;
    undoButton.disabled = !item.slices.canUndo; redoButton.disabled = !item.slices.canRedo;
    oneShotInput.checked = item.slices.oneShot;
    playMode.value = String(item.slices.playMode); playStep.value = String(item.slices.step); playStep.hidden = item.slices.playMode === 0; playMode.disabled = playStep.disabled = count <= 1;
    const labelled = item.slices.hasDrumLabels; playFilter.value = String(item.slices.playFilter); playFilter.disabled = count <= 1 || !labelled;
    playFilter.title = labelled ? 'Play only the kick, snare or hat slices: notes and the sequencer use just those' : 'Classify the slices first (kick / snare / hat labels)';
    const sel = item.sliceSel; const haveSel = sel >= 0 && sel < count;
    for (const b of labelButtons) b.disabled = !haveSel;
    removeButton.disabled = !haveSel || sel === 0;
    const current = haveSel ? String(item.slices.labels[sel]).split('+') : [];
    for (const b of labelButtons) b.classList.toggle('on', current.includes(b.dataset.action));
    const counts = { kick: 0, snare: 0, hat: 0 }; for (const label of item.slices.labels) for (const part of label.split('+')) if (part in counts) counts[part] += 1;
    const classified = counts.kick + counts.snare + counts.hat;
    const summary = count <= 1 ? 'No slices: 16 equal steps are used' : count >= 32 ? '32 max' : `${count} slices`;
    const labels = classified ? `${counts.kick} kicks, ${counts.snare} snares, ${counts.hat} hats` : '';
    status.textContent = [summary, labels].filter(Boolean).join(' · '); noteLine.textContent = note;
  }

  for (const b of labelButtons) b.addEventListener('click', () => { if (editor.labelSelected(b.dataset.action)) onChange(); });
  removeButton.addEventListener('click', () => { const i = item.sliceSel; if (i > 0 && item.slices.remove(i - 1)) { item.sliceSel = Math.min(i, item.slices.sliceCount - 1); changed(); } });
  editor.el.addEventListener('slice-select', () => render());

  function classify() { item.slices.setLabels(classifyHits(item.audio.channels, item.audio.sampleRate, [0, ...item.slices.markers])); }

  evenButton.addEventListener('click', () => {
    const count = Math.min(32, Math.max(2, Math.trunc(Number(evenCount.value) || 2))); evenCount.value = String(count);
    note = ''; item.slices.setMarkers(evenMarkers(item.duration, count)); changed();
  });
  beatsButton.addEventListener('click', () => {
    if (!(Number(item.bpm) > 0)) return;
    note = ''; item.slices.setMarkers(beatMarkers(item.duration, Number(item.bpm), Number(beatsPerSlice.value))); changed();
  });
  detectButton.addEventListener('click', () => {
    detectButton.textContent = 'Detecting…'; detectButton.disabled = true; clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null; if (destroyed) return;
      const onsets = detectOnsets(item.audio.channels, item.audio.sampleRate, { sensitivity: Number(sensitivity.value), maxOnsets: MAX_MARKERS });
      const sliceLabels = classifyHits(item.audio.channels, item.audio.sampleRate, [0, ...onsets]);
      // Tempo: fills empty fields, or redoes values that were themselves a guess (never a hand-typed or file-tagged one).
      // A BPM in the file name that fits the clip length beats the audio guess (settles half/double time).
      note = '';
      if ((!(Number(item.bpm) > 0) && !(Number(item.beats) > 0)) || item.tempoAuto) {
        const length = item.trimEnd - item.trimStart;
        const tempoOnsets = []; const tempoLabels = [];
        onsets.forEach((time, index) => { if (time >= item.trimStart && time < item.trimEnd) { tempoOnsets.push(time - item.trimStart); tempoLabels.push(sliceLabels[index + 1]); } });
        const guess = estimateTempo(tempoOnsets, length, { labels: tempoLabels });
        const hint = bpmFromName(item.name);
        const pick = reconcileTempo(guess, hint, length);
        if (pick) {
          item.bpm = pick.bpm; item.beats = pick.beats; item.tempoAuto = true;
          note = pick.source === 'name' ? `tempo from file name: ${pick.bpm} BPM, ${pick.beats} beats` : `tempo guessed: ${pick.bpm} BPM, ${pick.beats} beats`;
          if (pick.source === 'name' && guess && Math.abs(guess.bpm - pick.bpm) > pick.bpm * 0.03) note += ` (audio said ${guess.bpm})`;
          else if (pick.source === 'audio' && pick.alternatives?.length) {
            const alternative = pick.alternatives[0]; note += ` (${alternative.bpm} / ${alternative.beats} also fits)`;
          }
        } else note = 'tempo not detected: enter it by hand';
      }
      item.slices.setMarkers(onsets, sliceLabels);
      detectButton.textContent = 'Detect'; detectButton.disabled = false; render(); changed();
    }, 0);
  });
  classifyButton.addEventListener('click', () => { note = ''; classify(); changed(); });
  for (const [type, node] of filterButtons) node.addEventListener('click', () => {
    const before = item.slices.markers.length; item.slices.keepLabel(type); const kept = item.slices.markers.length;
    note = `${kept} ${type}${kept === 1 ? '' : 's'} kept${before === kept ? '' : `, ${before - kept} removed`}`; changed();
  });
  clearButton.addEventListener('click', () => { note = ''; item.slices.clear(); changed(); });
  undoButton.addEventListener('click', () => { note = ''; item.slices.undo(); changed(); });
  redoButton.addEventListener('click', () => { note = ''; item.slices.redo(); changed(); });
  playMode.addEventListener('change', () => { item.slices.setPlay(Number(playMode.value)); changed(); });
  playStep.addEventListener('change', () => { item.slices.setPlay(item.slices.playMode, Number(playStep.value)); changed(); });
  playFilter.addEventListener('change', () => { item.slices.setPlay(item.slices.playMode, item.slices.step, Number(playFilter.value)); changed(); });
  oneShotInput.addEventListener('change', () => { item.slices.setOneShot(oneShotInput.checked); changed(); });

  const off = item.slices.subscribe(render);
  document.addEventListener('change', render); render();
  return {
    el: root,
    destroy() { if (destroyed) return; destroyed = true; clearTimeout(timer); off(); document.removeEventListener('change', render); root.remove(); },
  };
}
