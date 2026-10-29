// Read-only performance controls. Wire layout: hw/panel_feedback.h, versions 1/2.
export const FM_COLOURS = ['#00b4ff', '#aa46ff', '#ff6e00', '#ff50a0', '#46d264', '#ffbe28'];
export const SLICE_COLOURS = ['#2846ff', '#ff6e00', '#d2b46e', '#00b4dc', '#8c28dc', '#28c85a'];
export const REVERB_MODEL_COLOURS = ['#0000ff','#3f00ff','#ffb300','#00ffff','#ff00ff','#00ff00','#ff0000','#ff4600','#a0bedc'];
export const THROW_DESTINATION_COLOURS = ['#ff8700',REVERB_MODEL_COLOURS[1]];
const blendColour=(a,b,x)=>`rgb(${[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-x)+parseInt(b.slice(i,i+2),16)*x)).join(' ')})`;
const STYLES = ['Jungle', 'Break', 'IDM', 'Glitch', 'Calm'];
const WAVES = ['Sine', 'Triangle', 'Saw', 'Square', 'Sample & hold', 'Noise'];
const percent = x => `${Math.round(x * 100)}%`;

export function decodePanelFeedback(bytes) {
  if (!(bytes instanceof Uint8Array) || !((bytes[0]===1 && bytes.length===50)||(bytes[0]===2 && bytes.length===51))) throw new Error('Unsupported panel feedback packet');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = at => Array.from(bytes.slice(at, at + 6), x => {
    if (x > 100) throw new Error('Invalid panel feedback value');
    return x / 100;
  });
  if (bytes[16] > 5 || bytes[17] > 2 || bytes[41] > 5 || bytes[42] > 2 || bytes[43] > 1 || bytes[44] > 1 || bytes[49] > 12 || (bytes[0]===2 && bytes[50]>8)) throw new Error('Invalid panel feedback state');
  return { ...(bytes[0]===2?{reverbModel:bytes[50]}:{}), page: bytes[1], fmLayer: Boolean(bytes[2] & 1), shift: Boolean(bytes[2] & 2), fmAvailable: Boolean(bytes[2] & 4), slicePage: Boolean(bytes[2] & 8), inputPresent: Boolean(bytes[2] & 16), caught: bytes[3], physical: values(4), logical: values(10), style: bytes[16], fill: bytes[17], applied: view.getUint32(18, true), slice: values(22), alternate: values(28), fm: values(34), capabilities: bytes[40], wave: bytes[41], source: bytes[42], exponential: Boolean(bytes[43]), tracked: Boolean(bytes[44]), seed: view.getUint32(45, true), rateZone: bytes[49] };
}

export function performanceView(mode, data, alternate = false, lite = false) {
  const fm = mode === 'fm';
  const labels = fm ? ['Rate', 'Wave', 'Depth', 'Law', 'Tracking', 'Source'] : alternate ? (lite ? ['Retrigger', 'Shuffle', 'Ghost', 'Throw destination', 'Seed', 'Finale'] : ['Evolve (seed)', 'Shuffle', 'Ghost', 'Finale', 'Throw level', 'Throw destination']) : (lite ? ['Loop', 'Activity', 'Detail', 'Throw', 'Seed chance', 'Mix'] : ['Loop', 'Density', 'Edit', 'Throw chance', 'Seed', 'Wet']);
  const values = data ? fm ? data.fm : alternate ? data.alternate : data.slice : null;
  const following = Boolean(data && (fm ? data.fmLayer : data.slicePage && data.shift === alternate));
  let status = fm ? 'Hold B2 on Plaits. First catch Depth at zero, then turn it up.' : lite ? 'B1 + tap B2: recall Jungle demo. B2: variation. Hold B2: Fill.' : 'B1 + tap B2: next style. B2: variation. Hold B2: Fill.';
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
      if ((!alternate && i === 3) || (lite && alternate && i === 0)) shownValue = chance(values[i]);

      if (alternate && (lite ? [1,2,5] : [1,2,3]).includes(i)) { const edit = data.slice[2]; const gain = edit <= .5 ? edit * 2 : 1 + (edit - .5); shownValue = Math.min(1, chance(values[i]) * gain); }
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
      if (i === 4) text = lite ? (values[4] <= .005 ? 'Off' : percent(values[4])) : String(data.seed);
    } else if (values && alternate) {
      if (i === 0 && !lite) text = values[0] >= .5 ? 'Protected' : 'Unprotected';
      if (lite && i === 4) text = String(data.seed);
      if (i === (lite ? 3 : 5)) text = values[i] === 0 ? 'Delay' : values[i] === 1 ? 'Reverb' : 'Delay + reverb';
    }
    const inactive = Boolean(data && fm && data.source === 1 && [0, 1, 4].includes(i));
    const caught = !following || Boolean(data.caught & (1 << i));
    let colour = fm && data && i === 3 ? (data.exponential ? '#ff50a0' : '#00b4be') : fm && data && i === 4 ? (data.tracked ? '#46d264' : '#288c6e') : fm && data && i === 5 ? ['#ffbe28','#0096ff','#b450dc'][data.source] : !fm && lite && alternate && i === 0 ? '#ff6e00' : (fm ? FM_COLOURS : SLICE_COLOURS)[i];
    const destinationMix = !fm && alternate && i === (lite ? 3 : 5) ? values?.[i] ?? .5 : null;
    const destinationColours=[THROW_DESTINATION_COLOURS[0],REVERB_MODEL_COLOURS[data?.reverbModel]??REVERB_MODEL_COLOURS[1]];
    if(destinationMix!==null)colour=blendColour(...destinationColours,destinationMix);
    return { destinationMix, destinationColours, label, value: shownValue, raw: values?.[i] ?? 0, text, inactive, pickup: !caught, physical: data?.physical[i] ?? 0, target: data?.logical[i] ?? 0, colour };
  }) };
}

export function paintPerformanceFeedback(root, mode, data, alternate = false, lite = false) {
  const vm = performanceView(mode, data, alternate, lite);
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
    if(c.destinationMix!==null) {
      const legend=el('small','performance-destinations');
      const d=el('span','',`Delay ${percent(Math.min(1,2-2*c.destinationMix))}`),r=el('span','',`Reverb ${percent(Math.min(1,2*c.destinationMix))}`);
      d.style.setProperty('--destination-colour',c.destinationColours[0]);r.style.setProperty('--destination-colour',c.destinationColours[1]);legend.append(d,' · ',r);cell.append(legend);
    }
    cell.append(el('small', 'performance-pickup', c.inactive ? 'Not used for external input' : c.pickup ? `Catch at ${percent(c.target)} · pot ${percent(c.physical)}` : vm.following ? 'Control caught' : 'Use the module’s controls'));
    grid.append(cell);
  }
  root.append(grid);
  if (vm.events.length) root.append(el('p', 'performance-events', vm.events.join(' · ')));
}

/** Runtime pots remain read-only; never turn a Slicer/FM control into a stored sampler/Plaits slider. */
export function paintRuntimePots(nodes, mode, data, alternate = false, lite = false) {
  const vm = performanceView(mode, data, alternate, lite);
  for (const { pot, group, dots, needle, label, valueLabel } of nodes) {
    const c = vm.controls[pot.id];
    group.style.setProperty('--ring', c.colour);
    group.classList.toggle('muted', c.inactive);
    group.classList.remove('shifted');
    const value = c.value;
    const step = mode === 'fm' && [1,3,4,5].includes(pot.id);
    const at = Math.round(value * (dots.length - 1));
    dots.forEach((dot, i) => { dot.classList.toggle('lit', !c.inactive && (step ? i === at : i <= at)); dot.classList.remove('pickup-dot', 'pickup-target'); });
    dots.forEach(dot=>dot.style.removeProperty('--ring'));
    if(c.destinationMix!==null) {
      const last=dots.length-1;const cursor=Math.round(c.destinationMix*last);
      dots.forEach((dot,i)=>{const x=i/last;dot.style.setProperty('--ring',blendColour(...c.destinationColours,x));dot.classList.toggle('lit',i===cursor || (i===0 && c.destinationMix<1) || (i===last && c.destinationMix>0));});
    }
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
