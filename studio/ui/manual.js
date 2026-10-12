import { baseCvFunction } from '../model/panel_pots.js';
import { JACK_GROUPS, PANEL, buttonCards, gestureLabel, jackList, manualSections, panelPages, richText } from './manual_vm.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIG_LABELS = Object.freeze({ 'audio-in': 'Audio in', 'audio-out': 'Audio out', gate: 'Gate / CV', 'cv-bi': 'CV ±5 V', trig: 'Trigger' });
const ANCHORS = Object.freeze([['manual-panel', 'The panel'], ['manual-studio', 'Using Studio'], ['manual-module', 'The module'], ['manual-flash', 'Flashing'], ['manual-help', 'Troubleshooting']]);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(tag, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

const clip = (text, max = 15) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * The Manual tab. The panel, the buttons, the jacks and the module's own help come from the firmware descriptor: the
 * connected module's, or the demo snapshot while nothing is connected. Studio's own pages come from manual.html.
 */
export function mountManual(root, { getDescriptor, getSettings = () => null, loadSnapshot, loadStatic }) {
  const state = { page: 0, shift: false, selected: null, source: '', built: false, generation: 0 };
  let descriptor = null;
  let staticDoc = null;
  let refs = null;

  async function show() {
    const wanted = getDescriptor?.() ?? null;
    if (state.built && (wanted ?? descriptor) === descriptor) return;
    const generation = ++state.generation;
    try {
      staticDoc ??= await loadStatic();
      const next = wanted ?? await loadSnapshot();
      if (generation !== state.generation) return;
      descriptor = next;
      state.source = wanted ? 'the connected module' : 'the demo module (connect yours to see its own pages)';
      build();
    } catch (error) {
      root.replaceChildren(el('p', 'manual-error', `The manual could not be loaded (${error?.message ?? error}).`));
    }
  }

  function refreshConnection() {
    if (state.built) { state.built = false; descriptor = null; }
  }

  // ------------------------------------------------------------------ the panel

  function drawPanel(pages) {
    const { x, y, width, height } = PANEL;
    const drawing = svg('svg', { viewBox: `${x} ${y} ${width} ${height}`, class: 'mp-svg', role: 'group', 'aria-label': 'Front panel of the module, to scale' });
    drawing.append(svg('rect', { x, y, width, height, rx: 1.2, class: 'mp-plate' }));
    for (const [px, py] of [[63.49, 35.09], [111.13, 35.09], [63.49, 157.6], [111.13, 157.6]]) drawing.append(svg('circle', { cx: px, cy: py, r: 1.6, class: 'mp-mount' }));

    const potNodes = PANEL.pots.map((pot) => {
      const group = svg('g', { class: 'mp-pot mp-control', tabindex: 0, role: 'button', 'data-control': `pot${pot.id}` });
      const ring = svg('circle', { cx: pot.x, cy: pot.y, r: 9.4, class: 'mp-ring' });
      const knob = svg('circle', { cx: pot.x, cy: pot.y, r: 6.3, class: 'mp-knob' });
      const tick = svg('line', { x1: pot.x, y1: pot.y - 1.5, x2: pot.x, y2: pot.y - 5.4, class: 'mp-tick' });
      const label = svg('text', { x: pot.x, y: pot.y + 13.6, class: 'mp-label', 'text-anchor': 'middle' });
      group.append(ring, knob, tick, label);
      drawing.append(group);
      return { pot, group, ring, label };
    });

    for (const button of PANEL.buttons) {
      const group = svg('g', { class: 'mp-button mp-control', tabindex: 0, role: 'button', 'data-control': button.id });
      group.append(svg('circle', { cx: button.x, cy: button.y, r: 3.6, class: 'mp-cap' }), svg('text', { x: button.x, y: button.y + 0.9, class: 'mp-cap-text', 'text-anchor': 'middle' }, button.id.toUpperCase()));
      drawing.append(group);
    }

    const usb = svg('g', { class: 'mp-usb mp-control', tabindex: 0, role: 'button', 'data-control': 'usb' });
    usb.append(svg('rect', { x: PANEL.usb.x - PANEL.usb.width / 2, y: PANEL.usb.y - PANEL.usb.height / 2, width: PANEL.usb.width, height: PANEL.usb.height, rx: 1.6, class: 'mp-usb-slot' }), svg('text', { x: PANEL.usb.x, y: PANEL.usb.y + 4.6, class: 'mp-label', 'text-anchor': 'middle' }, 'USB-C'));
    drawing.append(usb);

    for (const group of JACK_GROUPS) {
      const node = svg('g', { class: 'mp-jacks mp-control', tabindex: 0, role: 'button', 'data-control': `jacks-${group.id}` });
      for (const column of group.columns) {
        for (const row of PANEL.jackRows) {
          node.append(svg('circle', { cx: PANEL.jackColumns[column], cy: row, r: 4.4, class: 'mp-nut' }), svg('circle', { cx: PANEL.jackColumns[column], cy: row, r: 2.5, class: 'mp-hole' }));
        }
      }
      const centre = PANEL.jackColumns[group.columns[Math.floor(group.columns.length / 2)]];
      node.append(svg('text', { x: centre, y: 153.4, class: 'mp-label', 'text-anchor': 'middle' }, group.id === 'cv' ? 'CV  J3–J8' : group.id === 'in' ? 'IN' : 'OUT'));
      drawing.append(node);
    }
    return { drawing, potNodes };
  }

  function labelFor(page, pot) {
    const entry = page.pots[pot.id];
    if (state.shift) return entry.shift ? entry.shift : entry.name;
    return entry.name;
  }

  function paintPanel() {
    const pages = panelPages(descriptor);
    const page = pages[state.page] ?? pages[0];
    if (!page) return;
    for (const { pot, ring, label, group } of refs.potNodes) {
      ring.style.stroke = page.colour;
      const shifted = state.shift && page.pots[pot.id].shift;
      label.textContent = clip(labelFor(page, pot) || '·');
      group.classList.toggle('shifted', Boolean(shifted));
      group.classList.toggle('muted', state.shift && !shifted);
    }
    refs.drawing.classList.toggle('shift', state.shift);
    for (const tab of refs.tabs.querySelectorAll('[data-page]')) {
      const active = Number(tab.dataset.page) === state.page;
      tab.setAttribute('aria-selected', String(active));
      tab.classList.toggle('active', active);
    }
    refs.shiftToggle.setAttribute('aria-pressed', String(state.shift));
    describe(state.selected);
  }

  // The readout beside the drawing explains whatever is hovered, focused or last clicked.
  function describe(control) {
    state.selected = control;
    const out = refs.readout;
    out.replaceChildren();
    if (!control) {
      out.append(el('h3', '', 'Pick a control'), el('p', 'manual-muted', 'Hover or tap a knob, a button or the jacks. The page tabs change what the knobs do; “Hold B1” shows the shift layer.'));
      return;
    }
    const pages = panelPages(descriptor);
    const page = pages[state.page] ?? pages[0];
    if (control.startsWith('pot')) {
      const id = Number(control.slice(3));
      const entry = page?.pots[id];
      out.append(el('h3', '', `Knob ${id + 1} · ${entry?.name || 'not used on this page'}`), el('p', 'manual-muted', `${page?.name ?? ''} page`));
      const list = el('dl', 'manual-facts');
      list.append(el('dt', '', 'Normal'), el('dd', '', entry?.name || '—'));
      list.append(el('dt', '', 'Hold B1'), el('dd', '', entry?.shift || 'same as normal'));
      if (entry?.b2) list.append(el('dt', '', 'B2'), el('dd', '', entry.b2));
      out.append(list);
      return;
    }
    if (/^b[123]$/.test(control)) {
      const card = buttonCards(descriptor).find((item) => item.id === control);
      out.append(el('h3', '', card?.name ?? control.toUpperCase()));
      const list = el('dl', 'manual-facts');
      for (const action of card?.actions ?? []) list.append(el('dt', '', gestureLabel(action.gesture)), (() => { const dd = el('dd'); dd.append(el('strong', '', action.label), document.createTextNode(` — ${action.help}`)); return dd; })());
      out.append(list);
      return;
    }
    if (control === 'usb') {
      out.append(el('h3', '', 'USB-C'), el('p', '', 'One cable to the computer: Studio talks to the module over it (Chrome or Edge), it carries USB-MIDI, and it is where new firmware goes in when the module is in DFU mode.'));
      return;
    }
    const group = JACK_GROUPS.find((item) => `jacks-${item.id}` === control);
    if (group) {
      out.append(el('h3', '', group.label));
      const list = el('dl', 'manual-facts');
      for (const jack of jackList(descriptor).slice(group.from, group.to)) list.append(el('dt', '', `J${jack.number}`), el('dd', '', jackText(jack)));
      out.append(list, el('p', 'manual-muted', 'The ten jacks sit in a 2 × 5 grid; which hole carries which number inside a group is printed on the panel.'));
    }
  }

  function jackText(jack) {
    const cv = jack.number - 3;
    let live = '';
    if (cv >= 0 && cv < 6 && getSettings()) {
      const fn = baseCvFunction(cv, getSettings());
      live = fn.value === 0 ? ' Function now: none.' : ` Function now: ${fn.label}.`;
    }
    return `${jack.name} (${SIG_LABELS[jack.sig] ?? jack.sig}). ${jack.help}${live}`;
  }

  function buildPanelSection(pages) {
    const section = el('section', 'manual-section');
    section.id = 'manual-panel';
    section.append(el('h2', '', 'The panel'), el('p', 'manual-lead', 'The Alchemy Lab front panel, drawn to scale. Six knobs, three buttons, one USB-C port and ten jacks: every control changes meaning with the page.'));
    const stage = el('div', 'manual-stage');
    const { drawing, potNodes } = drawPanel(pages);
    const figure = el('figure', 'manual-figure');
    figure.append(drawing);

    const tabs = el('div', 'manual-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Page');
    for (const page of pages) {
      const tab = el('button', 'manual-tab');
      tab.type = 'button'; tab.dataset.page = String(page.index); tab.setAttribute('role', 'tab');
      const dot = el('i', 'manual-dot'); dot.style.background = page.colour;
      tab.append(dot, document.createTextNode(page.name));
      tab.addEventListener('click', () => { state.page = page.index; paintPanel(); });
      tabs.append(tab);
    }
    const shiftToggle = el('button', 'manual-shift', 'Hold B1');
    shiftToggle.type = 'button';
    shiftToggle.title = 'Show what each knob does while B1 is held';
    shiftToggle.addEventListener('click', () => { state.shift = !state.shift; paintPanel(); });
    const controls = el('div', 'manual-controls');
    controls.append(tabs, shiftToggle);

    const readout = el('aside', 'manual-readout');
    readout.setAttribute('aria-live', 'polite');
    const side = el('div', 'manual-side');
    side.append(controls, readout);
    stage.append(figure, side);
    section.append(stage);

    refs = { drawing, potNodes: potNodes.map((node) => ({ ...node })), tabs, shiftToggle, readout };
    for (const control of drawing.querySelectorAll('[data-control]')) {
      const id = control.dataset.control;
      control.addEventListener('mouseenter', () => describe(id));
      control.addEventListener('focus', () => describe(id));
      control.addEventListener('click', () => describe(id));
      control.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); describe(id); } });
    }
    return section;
  }

  // ------------------------------------------------------------------ the module's own text

  function buildModuleSection() {
    const section = el('section', 'manual-section');
    section.id = 'manual-module';
    section.append(el('h2', '', 'The module'));
    const preamble = descriptor?.manual?.preamble;
    if (preamble) section.append(el('p', 'manual-lead', preamble));

    section.append(el('h3', '', 'Buttons'));
    const cards = el('div', 'manual-cards');
    for (const card of buttonCards(descriptor)) {
      const node = el('article', 'manual-card');
      node.append(el('h4', '', card.name));
      const list = el('dl', 'manual-facts');
      for (const action of card.actions) {
        list.append(el('dt', '', gestureLabel(action.gesture)));
        const dd = el('dd'); dd.append(el('strong', '', action.label), document.createTextNode(` — ${action.help}`));
        list.append(dd);
      }
      node.append(list);
      cards.append(node);
    }
    section.append(cards);

    section.append(el('h3', '', 'Jacks'));
    const table = el('table', 'manual-table');
    const head = el('tr'); for (const label of ['Jack', 'Type', 'What it does']) head.append(el('th', '', label));
    table.append(el('thead')); table.firstChild.append(head);
    const body = el('tbody');
    for (const jack of jackList(descriptor)) {
      const row = el('tr');
      row.append(el('th', '', `J${jack.number}`), el('td', '', SIG_LABELS[jack.sig] ?? jack.sig), el('td', '', jackText(jack).replace(/^[^.]*\)\.\s*/, '')));
      body.append(row);
    }
    table.append(body);
    section.append(table);

    for (const item of manualSections(descriptor)) {
      section.append(el('h3', '', item.title));
      const text = el('p'); text.innerHTML = richText(item.body);
      section.append(text);
    }
    const module = descriptor?.module;
    if (module) section.append(el('p', 'manual-muted manual-source', `This part is the firmware's own help for ${module.name} ${module.fw}${module.git ? ` (${module.git})` : ''}, read from ${state.source}.`));
    return section;
  }

  // ------------------------------------------------------------------ assembly

  function build() {
    const pages = panelPages(descriptor);
    state.page = Math.min(state.page, Math.max(0, pages.length - 1));
    const article = el('article', 'manual');
    const nav = el('nav', 'manual-nav'); nav.setAttribute('aria-label', 'Manual sections');
    for (const [id, label] of ANCHORS) {
      const link = el('a', '', label); link.href = `#${id}`;
      link.addEventListener('click', (event) => { event.preventDefault(); article.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      nav.append(link);
    }
    const hero = el('header', 'manual-hero');
    hero.append(el('h1', '', 'Pentavox manual'), el('p', 'manual-lead', 'How to drive the module and how to use Studio with it. Hover or tap the panel below to see what each control does.'));
    article.append(hero, nav);
    article.append(pages.length ? buildPanelSection(pages) : el('p', 'manual-muted', 'This firmware does not describe its pages.'));
    const parts = new Map([...staticDoc.querySelectorAll('section[id]')].map((node) => [node.id, document.importNode(node, true)]));
    if (parts.has('manual-studio')) article.append(parts.get('manual-studio'));
    article.append(buildModuleSection());
    for (const id of ['manual-flash', 'manual-help']) if (parts.has(id)) article.append(parts.get(id));
    root.replaceChildren(article);
    state.built = true;
    if (pages.length) paintPanel();
  }

  return { show, refreshConnection };
}
