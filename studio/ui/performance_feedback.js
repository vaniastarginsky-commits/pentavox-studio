// Read-only performance controls. Wire layout: hw/panel_feedback.h, version 1.
export const FM_COLOURS = ['#00b4ff', '#aa46ff', '#ff6e00', '#ff50a0', '#46d264', '#ffbe28'];
export const SLICE_COLOURS = ['#2846ff', '#ff6e00', '#d2b46e', '#00b4dc', '#8c28dc', '#28c85a'];
const STYLES = ['Jungle', 'Break', 'IDM', 'Glitch', 'Calm'];
const WAVES = ['Sine', 'Triangle', 'Saw', 'Square', 'Sample & hold', 'Noise'];
const percent = x => `${Math.round(x * 100)}%`;

export function decodePanelFeedback(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 50 || bytes[0] !== 1) throw new Error('Unsupported panel feedback packet');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = at => Array.from(bytes.slice(at, at + 6), x => {
    if (x > 100) throw new Error('Invalid panel feedback value');
    return x / 100;
  });
  if (bytes[16] > 5 || bytes[17] > 2 || bytes[41] > 5 || bytes[42] > 2 || bytes[43] > 1 || bytes[44] > 1 || bytes[49] > 12) throw new Error('Invalid panel feedback state');
  return { page: bytes[1], fmLayer: Boolean(bytes[2] & 1), shift: Boolean(bytes[2] & 2), fmAvailable: Boolean(bytes[2] & 4), slicePage: Boolean(bytes[2] & 8), inputPresent: Boolean(bytes[2] & 16), caught: bytes[3], physical: values(4), logical: values(10), style: bytes[16], fill: bytes[17], applied: view.getUint32(18, true), slice: values(22), alternate: values(28), fm: values(34), capabilities: bytes[40], wave: bytes[41], source: bytes[42], exponential: Boolean(bytes[43]), tracked: Boolean(bytes[44]), seed: view.getUint32(45, true), rateZone: bytes[49] };
}

export function performanceView(mode, data, alternate = false) {
  const fm = mode === 'fm';
  const labels = fm ? ['Rate', 'Wave', 'Depth', 'Law', 'Tracking', 'Source'] : alternate ? ['Protect beat 1', 'Shuffle', 'Ghost', 'Finale', 'Throw level', 'Throw destination'] : ['Loop', 'Density', 'Edit', 'Throw chance', 'Seed', 'Wet'];
  const values = data ? fm ? data.fm : alternate ? data.alternate : data.slice : null;
  const following = Boolean(data && (fm ? data.fmLayer : data.slicePage && data.shift === alternate));
  let status = fm ? 'Hold B2 on Plaits. First catch Depth at zero, then turn it up.' : 'B1 + tap B2: next style. B2: variation. Hold B2: Fill.';
  const events = [];
  if (data && fm) {
    if (!data.fmAvailable) status = 'FM is not included in this firmware.';
    else if (values[2] <= .005) status = 'FM off — catch Depth at zero, then turn it up.';
    else if ((data.capabilities & 4) && !(data.capabilities & (data.exponential ? 2 : 1))) status = 'This engine does not support the selected audio-rate FM law.';
    else if (data.source === 1 && !data.inputPresent) status = 'External source selected — no input signal detected.';
    else if (!(data.capabilities & 4)) status = 'Play a note to check this engine’s FM support.';
    else status = 'FM configured. Hold B2 to edit; settings remain after release.';
  } else if (data) {
    const w = data.applied;
    if (data.slice[5] <= .005) events.push('Slicer off');
    else if (data.slice[1] <= .005) events.push('Automatic edits off');
    else if (w & (1 << 13)) events.push(w & (1 << 14) ? 'Active phrase' : 'Phrase skipped');
    else events.push('Waiting for playback');
    if (data.fill) events.push(data.fill === 1 ? 'Fill queued' : 'Fill playing');
    for (const [bit, label] of [[18, 'Shuffle'], [16, 'Ghost / double'], [17, 'Finale'], [19, 'Throw']]) if (w & (1 << bit)) events.push(label);
  }
  return { title: fm ? 'Plaits · FM' : `Slicer${data?.style ? ` · ${STYLES[data.style - 1]}` : ''}`, status, events, following, controls: labels.map((label, i) => {
    let shownValue = values?.[i] ?? 0;
    const chance = x => x <= .005 ? 0 : .5 * x * (1 + x);
    if (values && !fm) {
      if (!alternate && i === 3) shownValue = chance(values[i]);
      if (alternate && [1,2,3].includes(i)) { const edit = data.slice[2]; const gain = edit <= .5 ? edit * 2 : 1 + (edit - .5); shownValue = Math.min(1, chance(values[i]) * gain); }
    }
    let text = values ? percent(shownValue) : '—';
    if (values && fm) {
      if (i === 0) text = data.tracked ? `${[.25,.5,1,1.5,2,3,4,5,6,7,8,12,16][data.rateZone]}× note` : `${(.05 * 2 ** (values[0] * 15.29)).toFixed(values[0] < .5 ? 2 : 0)} Hz`;
      if (i === 1) text = WAVES[data.wave];
      if (i === 3) text = data.exponential ? 'Exponential' : 'Linear TZFM';
      if (i === 4) text = data.tracked ? 'Follows note' : 'Free';
      if (i === 5) text = ['Oscillator', 'External input', 'Both'][data.source];
    } else if (values && !alternate) {
      if (i === 0) text = values[0] < .34 ? 'Loop 1' : values[0] > .66 ? 'Loop 2' : 'Follows crossfader';
      if (i === 4) text = String(data.seed);
    } else if (values && alternate) {
      if (i === 0) text = values[0] >= .5 ? 'Protected' : 'Unprotected';
      if (i === 5) text = values[5] < .34 ? 'Delay' : values[5] > .66 ? 'Reverb' : 'Delay + reverb';
    }
    const inactive = Boolean(data && fm && data.source === 1 && [0, 1, 4].includes(i));
    const caught = !following || Boolean(data.caught & (1 << i));
    const colour = fm && data && i === 3 ? (data.exponential ? '#ff50a0' : '#00b4be') : fm && data && i === 4 ? (data.tracked ? '#46d264' : '#288c6e') : fm && data && i === 5 ? ['#ffbe28','#0096ff','#b450dc'][data.source] : (fm ? FM_COLOURS : SLICE_COLOURS)[i];
    return { label, value: shownValue, raw: values?.[i] ?? 0, text, inactive, pickup: !caught, physical: data?.physical[i] ?? 0, target: data?.logical[i] ?? 0, colour };
  }) };
}

export function paintPerformanceFeedback(root, mode, data, alternate = false) {
  const vm = performanceView(mode, data, alternate);
  root.replaceChildren();
  const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  root.append(el('h3', 'performance-title', vm.title), el('p', 'performance-status', vm.status));
  if (!data) root.append(el('p', 'performance-status', 'Live state requires firmware with panel feedback. This is a control guide.'));
  const grid = el('div', 'performance-grid');
  for (const c of vm.controls) {
    const cell = el('div', `performance-control${c.inactive ? ' inactive' : ''}${c.pickup ? ' needs-pickup' : ''}`);
    cell.style.setProperty('--control-colour', c.colour);
    cell.append(el('span', 'performance-label', c.label), el('strong', 'performance-value', c.text));
    const meter = el('meter', 'performance-meter'); meter.min = 0; meter.max = 1; meter.value = c.value; meter.setAttribute('aria-label', c.label); cell.append(meter);
    cell.append(el('small', 'performance-pickup', c.inactive ? 'Not used for external input' : c.pickup ? `Catch at ${percent(c.target)} · pot ${percent(c.physical)}` : vm.following ? 'Control caught' : 'Use the module’s controls'));
    grid.append(cell);
  }
  root.append(grid);
  if (vm.events.length) root.append(el('p', 'performance-events', vm.events.join(' · ')));
}

/** Runtime pots remain read-only; never turn a Slicer/FM control into a stored sampler/Plaits slider. */
export function paintRuntimePots(nodes, mode, data, alternate = false) {
  const vm = performanceView(mode, data, alternate);
  for (const { pot, group, dots, needle, label, valueLabel } of nodes) {
    const c = vm.controls[pot.id];
    group.style.setProperty('--ring', c.colour);
    group.classList.toggle('muted', c.inactive);
    group.classList.remove('shifted');
    const value = c.value;
    const step = mode === 'fm' && [1,3,4,5].includes(pot.id);
    const at = Math.round(value * (dots.length - 1));
    dots.forEach((dot, i) => { dot.classList.toggle('lit', !c.inactive && (step ? i === at : i <= at)); dot.classList.remove('pickup-dot', 'pickup-target'); });
    if (c.pickup) dots[Math.round(c.target * (dots.length - 1))]?.classList.add('pickup-target');
    if (c.pickup) dots[Math.min(dots.length - 1, Math.floor(c.physical * dots.length))]?.classList.add('pickup-dot');
    needle.setAttribute('transform', `rotate(${(-135 + (vm.following ? c.physical : c.raw) * 270).toFixed(1)} ${pot.x} ${pot.y})`);
    label.textContent = c.label;
    valueLabel.textContent = c.text.length > 16 ? c.text.slice(0, 15) + '…' : c.text;
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `${c.label}: ${c.text}${c.pickup ? ', move physical knob to catch value' : ''}`);
    for (const key of ['aria-valuemin','aria-valuemax','aria-valuenow','aria-valuetext']) group.removeAttribute(key);
  }
}
