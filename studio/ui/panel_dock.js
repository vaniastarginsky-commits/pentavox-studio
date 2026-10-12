// The panel dock: the module's front panel, drawn to scale, beside the tabs where its knobs and jacks are configured.
// It reads the same pager as the Manual tab (the connected module's descriptor, or the compact firmware's snapshot while nothing is connected),
// shows what each knob does on each page, and points from a control to the tab that sets it.
import { baseCvFunction } from '../model/panel_pots.js';
import { POT_POSITIONS, buttonCards, gestureLabel, jackLabel, jackList, panelPages } from './manual_vm.js';
import { drawPanel, paintPots } from './panel_drawing.js';

const SIG_LABELS = Object.freeze({ 'audio-in': 'Audio in', 'audio-out': 'Audio out', gate: 'Gate / CV', 'cv-bi': 'CV ±5 V', trig: 'Trigger' });

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
 * @param onNavigate called with a tab name ('routing' or 'manual') when the readout points to where a control is set
 */
export function mountPanelDock(root, { getDescriptor, loadSnapshot, getSettings = () => null, onNavigate = () => {} }) {
  const state = { page: 0, shift: false, selected: null, built: false, generation: 0 };
  let descriptor = null;
  let refs = null;

  async function show() {
    const wanted = getDescriptor?.() ?? null;
    if (state.built && (wanted ?? descriptor) === descriptor) return;
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

  function describe(control) {
    state.selected = control;
    const out = refs.readout;
    out.replaceChildren();
    const page = currentPage();
    const title = (context, name) => out.append(el('p', 'dock-context', context), el('h3', '', name));
    const goto = (label, tab) => out.append(button(label, 'dock-link', () => onNavigate(tab)));
    if (!control) {
      title('Front panel', 'Point at a control');
      out.append(el('p', 'dock-note', 'Hover or tap a knob, a button or a jack to see what it does. Rings show the factory positions.'));
      return;
    }
    if (control.startsWith('pot')) {
      const id = Number(control.slice(3));
      const entry = page?.pots[id];
      title(`${POT_POSITIONS[id]} · ${page?.name ?? ''}`, entry?.name || 'Not used on this page');
      const list = el('dl', 'dock-facts');
      list.append(el('dt', '', 'Hold B1'), el('dd', '', entry?.shift || 'unchanged'));
      if (entry?.b2) list.append(el('dt', '', 'B2'), el('dd', '', entry.b2));
      out.append(list);
      goto('Set in CV routing', 'routing');
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
      out.append(el('p', 'dock-note', 'Studio talks to the module over this cable, it carries USB-MIDI, and new firmware goes in here in DFU mode.'));
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

  function paint() {
    const page = currentPage();
    if (!page) return;
    paintPots(refs.potNodes, page, state.shift);
    for (const tab of refs.tabs.querySelectorAll('[data-page]')) {
      const active = Number(tab.dataset.page) === state.page;
      tab.setAttribute('aria-selected', String(active));
      tab.classList.toggle('active', active);
    }
    refs.shiftToggle.setAttribute('aria-pressed', String(state.shift));
    refs.pageName.textContent = page.name;
    describe(state.selected);
  }

  function build() {
    const pages = panelPages(descriptor);
    const body = root.querySelector('.dock-body');
    if (!pages.length) { body.replaceChildren(el('p', 'dock-note', 'This firmware does not describe its pages.')); state.built = true; return; }
    state.page = Math.min(state.page, pages.length - 1);
    const { drawing, potNodes } = drawPanel();
    const figure = el('figure', 'dock-figure'); figure.append(drawing);

    const tabs = el('div', 'dock-pages'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Page');
    for (const page of pages) {
      const tab = button('', 'dock-page', () => { state.page = page.index; paint(); });
      tab.dataset.page = String(page.index); tab.setAttribute('role', 'tab'); tab.title = page.name; tab.setAttribute('aria-label', page.name);
      tab.style.setProperty('--ring', page.colour);
      tabs.append(tab);
    }
    const pageName = el('span', 'dock-pagename');
    const shiftToggle = button('Hold B1', 'dock-shift', () => { state.shift = !state.shift; paint(); });
    shiftToggle.title = 'Show what each knob does while B1 is held';
    const controls = el('div', 'dock-controls'); controls.append(tabs, shiftToggle);
    const readout = el('div', 'dock-readout'); readout.setAttribute('aria-live', 'polite');
    body.replaceChildren(figure, el('div', 'dock-pagebar', ''), controls, readout);
    body.querySelector('.dock-pagebar').append(pageName);

    refs = { drawing, potNodes, tabs, shiftToggle, readout, pageName };
    for (const control of drawing.querySelectorAll('[data-control]')) {
      const id = control.dataset.control;
      control.addEventListener('mouseenter', () => describe(id));
      control.addEventListener('focus', () => describe(id));
      control.addEventListener('click', () => describe(id));
      control.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); describe(id); } });
    }
    state.built = true;
    paint();
  }

  return { show, refreshConnection };
}
