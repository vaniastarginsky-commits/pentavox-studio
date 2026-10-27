// The panel dock: the module's front panel, drawn to scale, beside the tabs where its knobs and jacks are configured.
// It reads the same pager as the Manual tab (the connected module's descriptor, or the compact firmware's snapshot while nothing is connected),
// shows what each knob does on each page, and points from a control to the tab that sets it.
import { paintPerformanceFeedback, paintRuntimePots, performanceView } from './performance_feedback.js';
import { baseCvFunction } from '../model/panel_pots.js';
import { POT_POSITIONS, buttonCards, gestureLabel, isCompactBuild, jackLabel, jackList, panelPages } from './manual_vm.js';
import { drawPanel, paintLivePots, paintPots } from './panel_drawing.js';
import { PanelLive, decodePerf, percentText, perfFieldMap, perfKey } from './panel_live.js';

const SIG_LABELS = Object.freeze({ 'audio-in': 'Audio in', 'audio-out': 'Audio out', gate: 'Gate / CV', 'cv-bi': 'CV ±5 V', trig: 'Trigger' });

/** Return the page selected by conventional tab-list keys, or the current page for unrelated keys. */
export function pagerIndexForKey(current, count, key) {
  if (count < 1) return 0;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
  return current;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, handler) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

/**
 * @param root the dock element (an `aside`)
 * @param getDescriptor the connected module's descriptor, or null
 * @param loadSnapshot resolves the compact firmware's descriptor snapshot for when nothing is connected
 * @param getSettings the module's settings, for the "function now" line of a CV jack
 * @param getSession the connected StudioSession; optional so the static dock still works without the app hook
 * @param onNavigate called with a tab name ('routing' or 'manual') when the readout points to where a control is set
 */
export function mountPanelDock(root, { getDescriptor, loadSnapshot, getSettings = () => null, getSession = () => null, onNavigate = () => {}, onLiveError = () => {}, decorate = () => {}, onSelect = () => {}, inspectorRoot = null, isActive = () => true }) {
  const state = { page: 0, shift: false, selected: null, built: false, generation: 0 };
  let descriptor = null;
  let refs = null;
  let live = null;
  let liveFields = new Map();
  let liveValues = new Map();
  let feedback = null;

  const dockVisible = () => !root.hidden && !document.hidden && isActive() && globalThis.getComputedStyle?.(root).display !== 'none';
  const syncLive = () => live?.setActive(dockVisible());
  const visibilityObserver = globalThis.MutationObserver ? new MutationObserver(syncLive) : null;
  visibilityObserver?.observe(root, { attributes: true, attributeFilter: ['hidden'] });
  visibilityObserver?.observe(document.body, { attributes: true, attributeFilter: ['data-tab'] });
  document.addEventListener('visibilitychange', syncLive);

  async function show() {
    const wanted = getDescriptor?.() ?? null;
    if (state.built && (wanted ?? descriptor) === descriptor) { syncLive(); return; }
    const generation = ++state.generation;
    try {
      const next = wanted ?? await loadSnapshot();
      if (generation !== state.generation) return;
      descriptor = next;
      build();
    } catch (error) {
      root.querySelector('.dock-body')?.replaceChildren(el('p', 'dock-note', `The panel could not be loaded (${error?.message ?? error}).`));
    }
  }

  function refreshConnection() {
    live?.dispose(); live = null; liveFields = new Map(); liveValues = new Map(); feedback = null;
    if (state.built) { state.built = false; descriptor = null; }
  }

  const currentPage = () => { const pages = panelPages(descriptor); return pages[state.page] ?? pages[0]; };

  function jackText(jack) {
    const cv = jack.number - 3;
    let live = '';
    if (cv >= 0 && cv < 6 && getSettings()) {
      const fn = baseCvFunction(cv, getSettings());
      live = fn.value === 0 ? 'Function now: none.' : `Function now: ${fn.label}.`;
    }
    return [jack.help, live].filter(Boolean).join(' ');
  }

  function placeBubble(control) {
    const bubble = refs?.readout;
    const target = refs?.drawing.querySelector(`[data-control="${control}"]`);
    if (inspectorRoot || !bubble || !target || state.selected !== control) return;
    const figure = bubble.parentElement.getBoundingClientRect();
    const spot = target.getBoundingClientRect();
    bubble.hidden = false;
    const width = bubble.offsetWidth, height = bubble.offsetHeight;
    const keep = (value, size, room) => Math.max(8, Math.min(value, room - size - 8));
    const left = keep(spot.left + spot.width / 2 - figure.left - width / 2, width, figure.width);
    const below = spot.top + spot.height / 2 - figure.top < figure.height / 2;   // never cover the control being pointed at
    const top = keep(below ? spot.bottom - figure.top + 10 : spot.top - figure.top - height - 10, height, figure.height);
    bubble.style.left = `${left}px`; bubble.style.top = `${top}px`;
  }

  let hideTimer = null;
  const hideBubbleSoon = () => { if (inspectorRoot) return; clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (refs) describe(null); }, 220); };
  const keepBubble = () => clearTimeout(hideTimer);

  /** Tells the page that hosts the dock which page, layer and knob are shown (the colour inspector follows it). */
  function emitSelect(control) {
    const page = currentPage();
    if (!page) return;
    onSelect({ page: page.index, pageName: page.name, control, shift: state.shift, pot: control?.startsWith('pot') ? Number(control.slice(3)) : undefined });
  }

  function describe(control) {
    state.selected = control;
    if (inspectorRoot) inspectorRoot.dataset.control = control ?? '';
    emitSelect(control);
    const out = refs.readout;
    out.replaceChildren();
    const page = currentPage();
    const title = (context, name) => out.append(el('p', 'dock-context', context), el('h3', '', name));
    const goto = (label, tab) => out.append(button(label, 'dock-link', () => onNavigate(tab, { page: state.page, shift: state.shift, control })));
    if (!control) {
      out.hidden = !inspectorRoot;
      if (inspectorRoot) { title('Live controls', 'Select a control'); out.append(el('p', 'dock-note', 'Select a knob, button or jack to see its function, value and gestures. Hold B1 shows the alternate layer.')); }
      return;
    }
    out.hidden = false;
    // The description is a bubble over the drawing, so the module itself can use the whole dock.
    queueMicrotask(() => placeBubble(control));
    if (control.startsWith('pot')) {
      const id = Number(control.slice(3));
      const mode = performanceMode();
      const runtime = mode === 'slicer' || (mode === 'fm' && feedback?.fmLayer);
      const entry = runtime && mode === 'fm' ? { name: performanceView('fm', feedback).controls[id].label, live: false, b2: 'Hold B2 and use the physical pot' } : page?.pots[id];
      title(`${POT_POSITIONS[id]} · ${page?.name ?? ''}`, (state.shift && !runtime ? entry?.shift : entry?.name) || 'Not used on this page');
      const list = el('dl', 'dock-facts');
      list.append(el('dt', '', 'Hold B1'), el('dd', '', entry?.shift || (isCompactBuild(panelPages(descriptor)) ? 'Not used' : 'unchanged')));
      if (entry?.b2) list.append(el('dt', '', 'B2'), el('dd', '', entry.b2));
      out.append(el('strong', 'dock-value', '—'), el('p', 'dock-pickup', ''), list);
      if (runtime) out.append(el('p', 'dock-note dock-runtime-status', mode === 'fm' ? performanceView('fm', feedback).status : 'Use the module’s controls. B1 + tap B2 changes style, tap B2 makes a variation, hold B2 queues a Fill.'));
      else if (state.shift && !entry?.shift) out.append(el('p', 'dock-note', 'This knob has no alternate function on this page. Its ring is dark while B1 is held.'));
      else if (entry?.live === false) out.append(el('p', 'dock-note', 'Use the physical pot. This firmware does not expose its live value to Studio.'));
      else out.append(el('p', 'dock-note', 'The pointer shows the value. Exposed normal-layer controls can be dragged here or adjusted with arrow keys; hold Shift for larger steps.'));
      if (!runtime) goto('Set in CV routing', 'routing');
      goto('Help for this control', 'manual');
      updateInspectorValue();
      return;
    }
    if (/^b[123]$/.test(control)) {
      const card = buttonCards(descriptor).find((item) => item.id === control);
      title('Button', card?.name ?? control.toUpperCase());
      const list = el('dl', 'dock-facts');
      for (const action of card?.actions ?? []) list.append(el('dt', '', gestureLabel(action.gesture)), el('dd', '', action.label));
      out.append(list);
      goto('Read in the manual', 'manual');
      return;
    }
    if (control === 'usb') {
      title('Front panel', 'USB-C');
      out.append(el('p', 'dock-note', 'Studio, USB-MIDI and DFU firmware updates use this cable. USB-audio builds also send the stereo mix and the two audio inputs to the computer.'));
      goto('Read in the manual', 'manual');
      return;
    }
    if (control.startsWith('jack')) {
      const jack = jackList(descriptor).find((item) => item.number === Number(control.slice(4)));
      title(`Jack · ${SIG_LABELS[jack?.sig] ?? ''}`, jack ? `J${jack.number} · ${jack.name}` : control);
      out.append(el('p', 'dock-note', jack ? jackText(jack) : ''));
      if (jack && jack.number >= 3 && jack.number <= 8) goto('Set in CV routing', 'routing'); else goto('Read in the manual', 'manual');
    }
  }

  function performanceMode() {
    const page = currentPage();
    return /^Slicer/.test(page?.name) && Number(descriptor?.slice?.version) >= 19 ? 'slicer'
      : /^(Plaits|Voice) 1$/.test(page?.name) && descriptor?.panelFeedback ? 'fm' : null;
  }

  function updateInspectorValue() {
    if (!refs || !state.selected?.startsWith('pot')) return;
    const id = Number(state.selected.slice(3));
    const value = refs.readout.querySelector('.dock-value');
    const pickup = refs.readout.querySelector('.dock-pickup');
    if (!value || !pickup) return;
    const mode = performanceMode();
    if (mode === 'slicer' || (mode === 'fm' && feedback?.fmLayer)) {
      const view = performanceView(mode, feedback, state.shift);
      const c = view.controls[id];
      value.textContent = c.text;
      const status = refs.readout.querySelector('.dock-runtime-status');
      if (status && mode === 'fm') status.textContent = view.status;
      pickup.textContent = !feedback ? 'Live values require compatible panel feedback firmware.'
        : c.inactive ? 'Inactive for the selected source.'
        : c.pickup ? `Move the physical pot to ${percentText(c.target)} to catch the value. Pot now: ${percentText(c.physical)}.`
        : view.following ? 'Physical control caught.' : 'Stored runtime value; this is not the active physical layer.';
      return;
    }
    const data = !state.shift ? liveValues.get(perfKey(state.page, id)) : null;
    value.textContent = data?.text ?? '—';
    pickup.textContent = data ? 'Value read from the module.' : state.shift ? 'Use the physical pot for this layer; no live value is exposed.' : 'Live value is not available for this control.';
  }

  let inspectorContext = '';
  function paintDrawing() {
    const page = currentPage();
    if (!page) return;
    if (!state.shift && liveValues.size) paintLivePots(refs.potNodes, page, liveValues);
    else paintPots(refs.potNodes, page, state.shift);
    decorate(refs.potNodes, page, state.shift);
    const mode = performanceMode();
    refs.feedback.hidden = !mode;
    const context = `${state.page}:${state.shift}:${Boolean(feedback?.fmLayer)}`;
    if (inspectorRoot && context !== inspectorContext) { inspectorContext = context; describe(state.selected); }
    updateInspectorValue();
    refs.body.classList.toggle('has-performance', Boolean(mode));
    if (mode) {
      paintPerformanceFeedback(refs.feedback, mode, feedback, state.shift);
      if (feedback && (mode === 'slicer' || feedback.fmLayer)) paintRuntimePots(refs.potNodes, mode, feedback, state.shift);
    }
  }

  function paint() {
    const page = currentPage();
    if (!page) return;
    paintDrawing();
    emitSelect(state.selected);
    for (const tab of refs.tabs.querySelectorAll('[data-page]')) {
      const active = Number(tab.dataset.page) === state.page;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle('active', active);
    }
    refs.shiftToggle.setAttribute('aria-pressed', String(state.shift));
    refs.tabs.querySelector('.active')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    describe(state.selected);
  }

  function adjustPot(id, value, { flush = false } = {}) {
    if (state.shift || !live || (feedback?.fmLayer && /^(Plaits|Voice)/.test(currentPage()?.name))) return false;
    const key = perfKey(state.page, id);
    const field = liveFields.get(key);
    const next = Math.max(0, Math.min(1, value));
    if (!field || !live.queueWrite(field, next)) return false;
    liveValues.set(key, { field, value: next, text: percentText(next) });
    paintDrawing();
    if (flush) void live.flushWrites();
    return true;
  }

  function bindLivePot(node, id) {
    let drag = null;
    node.group.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || state.shift) return;
      const current = liveValues.get(perfKey(state.page, id));
      if (!current || !liveFields.has(perfKey(state.page, id))) return;
      drag = { pointerId: event.pointerId, y: event.clientY, value: current.value };
      node.group.setPointerCapture?.(event.pointerId);
      describe(`pot${id}`);
      event.preventDefault();
    });
    node.group.addEventListener('pointermove', (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      adjustPot(id, drag.value + (drag.y - event.clientY) / 160);
      event.preventDefault();
    });
    const finish = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      node.group.releasePointerCapture?.(event.pointerId);
      void live?.flushWrites();
    };
    node.group.addEventListener('pointerup', finish);
    node.group.addEventListener('pointercancel', finish);
    node.group.addEventListener('keydown', (event) => {
      const current = liveValues.get(perfKey(state.page, id));
      if (!current || state.shift) return;
      const step = event.shiftKey ? .05 : .01;
      const next = ({ ArrowUp: current.value + step, ArrowRight: current.value + step, ArrowDown: current.value - step, ArrowLeft: current.value - step, Home: 0, End: 1 })[event.key];
      if (next === undefined) return;
      if (adjustPot(id, next, { flush: true })) event.preventDefault();
    });
  }

  function build() {
    const pages = panelPages(descriptor);
    const body = root.querySelector('.dock-body');
    if (!pages.length) { body.replaceChildren(el('p', 'dock-note', 'This firmware does not describe its pages.')); state.built = true; return; }
    state.page = Math.min(state.page, pages.length - 1);
    const { drawing, potNodes } = drawPanel({ instrument: Boolean(inspectorRoot) });
    const figure = el('figure', 'dock-figure'); figure.append(drawing);
    const fullViewBox = drawing.getAttribute('viewBox');
    let showJacks = false;
    const framePanel = () => {
      if (!inspectorRoot) return;
      figure.classList.toggle('controls-only', !showJacks);
      drawing.setAttribute('viewBox', showJacks ? fullViewBox : '56.36 40 60.6 88');
      drawing.setAttribute('aria-label', showJacks ? 'Full front panel' : 'Six knobs and three buttons');
    };
    framePanel();

    const tabs = el('div', 'dock-pages'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Page');
    for (const page of pages) {
      const tab = button(page.name, 'dock-page', () => { state.page = page.index; paint(); });
      tab.dataset.page = String(page.index); tab.setAttribute('role', 'tab'); tab.title = page.name; tab.setAttribute('aria-label', page.name);
      tab.style.setProperty('--ring', page.colour);
      tab.addEventListener('keydown', (event) => {
        const next = pagerIndexForKey(state.page, pages.length, event.key);
        if (next === state.page && !['Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        state.page = next;
        paint();
        refs.tabs.querySelector(`[data-page="${next}"]`)?.focus();
      });
      tabs.append(tab);
    }
    const shiftToggle = button('Hold B1', 'dock-shift', () => { state.shift = !state.shift; paint(); });
    shiftToggle.title = 'Show what each knob does while B1 is held';
    const controls = el('div', 'dock-controls'); controls.append(tabs, shiftToggle);
    if (inspectorRoot) {
      const jacks = button('Show jacks', 'dock-jacks-toggle', () => {
        showJacks = !showJacks; framePanel(); jacks.textContent = showJacks ? 'Knobs only' : 'Show jacks';
        jacks.setAttribute('aria-pressed', String(showJacks));
      });
      jacks.setAttribute('aria-pressed', 'false'); jacks.title = 'Full panel with the module LED colours and jack assignments'; controls.append(jacks);
    }
    const readout = el('div', inspectorRoot ? 'dock-inspector' : 'dock-bubble'); readout.setAttribute('aria-live', 'polite'); readout.hidden = true;
    const status = getSession() ? null : el('p', 'dock-status', 'Module not connected. This is the factory layout; press Connect, or Demo, to see live knob values.');
    body.classList.toggle('has-status', Boolean(status));
    if (inspectorRoot) inspectorRoot.replaceChildren(readout); else figure.append(readout);
    const feedbackPanel = el('section', 'performance-feedback'); feedbackPanel.hidden = true; feedbackPanel.setAttribute('aria-label', 'Performance controls');
    body.replaceChildren(...[status, controls, figure, feedbackPanel].filter(Boolean));
    readout.addEventListener('pointerenter', keepBubble);
    readout.addEventListener('pointerleave', hideBubbleSoon);
    figure.addEventListener('click', (event) => { if (!event.target.closest('[data-control], .dock-bubble')) describe(null); });

    refs = { drawing, potNodes, tabs, shiftToggle, readout, body, feedback: feedbackPanel };
    for (const control of drawing.querySelectorAll('[data-control]')) {
      const id = control.dataset.control;
      control.addEventListener('mouseenter', () => { keepBubble(); describe(id); });
      control.addEventListener('mouseleave', hideBubbleSoon);
      control.addEventListener('focus', () => describe(id));
      control.addEventListener('click', () => describe(id));
      control.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); describe(id); } });
    }
    live?.dispose();
    const session = getSession();
    liveFields = perfFieldMap(session?.descriptor ?? descriptor);
    liveValues = session?.base ? decodePerf(session.descriptor, session.base) : new Map();
    live = session ? new PanelLive({
      getSession,
      isVisible: dockVisible,
      onValues: (values) => { liveValues = values; if (refs) paintDrawing(); },
      onFeedback: value => { feedback = value; if (refs) paintDrawing(); },
      onError: onLiveError,
    }) : null;
    potNodes.forEach((node) => bindLivePot(node, node.pot.id));
    state.built = true;
    if (inspectorRoot && !state.selected) state.selected = 'pot0';
    paint();
    syncLive();
  }

  return {
    show,
    refreshConnection,
    repaint() { if (refs) paintDrawing(); },
    dispose() { live?.dispose(); visibilityObserver?.disconnect(); document.removeEventListener('visibilitychange', syncLive); },
  };
}
