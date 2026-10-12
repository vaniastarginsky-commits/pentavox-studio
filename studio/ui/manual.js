import { baseCvFunction } from '../model/panel_pots.js';
import { JACK_GRID, PANEL, POT_POSITIONS, buttonCards, gestureLabel, jackLabel, jackList, manualSections, panelPages, richText, voiceSummary } from './manual_vm.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIG_LABELS = Object.freeze({ 'audio-in': 'Audio in', 'audio-out': 'Audio out', gate: 'Gate / CV', 'cv-bi': 'CV ±5 V', trig: 'Trigger' });
const ANCHORS = Object.freeze([['manual-panel', 'Panel'], ['manual-studio', 'Studio'], ['manual-module', 'Module'], ['manual-flash', 'Flashing'], ['manual-help', 'Help']]);
const RING_DOTS = 13;            // the LEDs of a knob ring that sweep the arc (the other three sit at the bottom, unused here)
const RING_START = -135;         // degrees clockwise from twelve o'clock: half past seven

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

const clip = (text, max = 14) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const polar = (cx, cy, radius, degrees) => [cx + radius * Math.sin((degrees * Math.PI) / 180), cy - radius * Math.cos((degrees * Math.PI) / 180)];

function table(head, rows, className = '') {
  const wrap = el('div', `manual-tablewrap ${className}`.trim());
  const node = el('table', 'manual-table');
  const top = el('tr');
  for (const label of head) top.append(el('th', '', label));
  const thead = el('thead'); thead.append(top);
  const tbody = el('tbody');
  for (const cells of rows) {
    const row = el('tr');
    cells.forEach((cell, index) => {
      const node2 = el(index === 0 ? 'th' : 'td');
      if (index === 0) node2.scope = 'row';
      if (cell instanceof Node) node2.append(cell); else node2.textContent = cell;
      row.append(node2);
    });
    tbody.append(row);
  }
  node.append(thead, tbody);
  wrap.append(node);
  return wrap;
}

function heading(id, title, sub) {
  const section = el('section', 'manual-section');
  section.id = id;
  const head = el('header', 'manual-head');
  head.append(el('h2', '', title));
  if (sub) head.append(el('p', 'manual-sub', sub));
  section.append(head);
  return section;
}

const strongThen = (label, text) => { const frag = document.createDocumentFragment(); frag.append(el('strong', '', label), document.createTextNode(text ? ` ${text}` : '')); return frag; };

/**
 * The Manual tab. The panel, the buttons, the jacks and the module's own help come from the firmware descriptor: the
 * connected module's, or the snapshot of the compact firmware while nothing is connected. Studio's own pages come from manual.html.
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
      state.source = wanted ? 'the connected module' : 'the compact firmware (connect your module to read its own)';
      build();
    } catch (error) {
      root.replaceChildren(el('p', 'manual-error', `The manual could not be loaded (${error?.message ?? error}). Reload the page to try again.`));
    }
  }

  function refreshConnection() {
    if (state.built) { state.built = false; descriptor = null; }
  }

  const currentPage = () => { const pages = panelPages(descriptor); return pages[state.page] ?? pages[0]; };

  // ------------------------------------------------------------------ the drawing

  function drawPanel(pages) {
    const { x, y, width, height } = PANEL;
    const drawing = svg('svg', { viewBox: `${x} ${y} ${width} ${height}`, class: 'mp-svg', role: 'group', 'aria-label': 'Front panel of the module, drawn to scale' });
    drawing.append(svg('rect', { x, y, width, height, rx: 1.4, class: 'mp-plate' }));
    drawing.append(svg('rect', { x: x + 1.6, y: y + 1.6, width: width - 3.2, height: height - 3.2, rx: 0.8, class: 'mp-inset' }));
    for (const [px, py] of [[63.49, 35.09], [111.13, 35.09], [63.49, 157.6], [111.13, 157.6]]) drawing.append(svg('rect', { x: px - 2.3, y: py - 1.2, width: 4.6, height: 2.4, rx: 1.2, class: 'mp-mount' }));

    const potNodes = PANEL.pots.map((pot) => {
      const group = svg('g', { class: 'mp-pot mp-control', tabindex: 0, role: 'button', 'data-control': `pot${pot.id}`, 'aria-label': `Knob ${pot.id + 1}, ${POT_POSITIONS[pot.id]}` });
      const dots = Array.from({ length: RING_DOTS }, (_, i) => {
        const [dx, dy] = polar(pot.x, pot.y, 9.9, RING_START + i * (270 / (RING_DOTS - 1)));
        const dot = svg('circle', { cx: dx.toFixed(2), cy: dy.toFixed(2), r: 0.82, class: 'mp-dot' });
        group.append(dot);
        return dot;
      });
      const knob = svg('circle', { cx: pot.x, cy: pot.y, r: 6.5, class: 'mp-knob' });
      const needle = svg('line', { x1: pot.x, y1: pot.y - 2.2, x2: pot.x, y2: pot.y - 5.6, class: 'mp-needle' });
      const label = svg('text', { x: pot.x, y: pot.y + 14.4, class: 'mp-label', 'text-anchor': 'middle' });
      group.append(knob, needle, label);
      drawing.append(group);
      return { pot, group, dots, needle, label };
    });

    for (const button of PANEL.buttons) {
      const group = svg('g', { class: 'mp-button mp-control', tabindex: 0, role: 'button', 'data-control': button.id, 'aria-label': `Button ${button.id.toUpperCase()}` });
      group.append(svg('circle', { cx: button.x, cy: button.y, r: 4, class: 'mp-cap' }), svg('text', { x: button.x, y: button.y + 0.95, class: 'mp-cap-text', 'text-anchor': 'middle' }, button.id.toUpperCase()));
      drawing.append(group);
    }

    const usb = svg('g', { class: 'mp-usb mp-control', tabindex: 0, role: 'button', 'data-control': 'usb', 'aria-label': 'USB-C port' });
    usb.append(svg('rect', { x: PANEL.usb.x - PANEL.usb.width / 2, y: PANEL.usb.y - PANEL.usb.height / 2, width: PANEL.usb.width, height: PANEL.usb.height, rx: 1.6, class: 'mp-usb-slot' }), svg('text', { x: PANEL.usb.x, y: PANEL.usb.y + 5.6, class: 'mp-label mp-small', 'text-anchor': 'middle' }, 'USB-C'));
    drawing.append(usb);

    JACK_GRID.forEach((row, rowIndex) => row.forEach((number, column) => {
      const cx = PANEL.jackColumns[column];
      const cy = PANEL.jackRows[rowIndex];
      const group = svg('g', { class: 'mp-jack mp-control', tabindex: 0, role: 'button', 'data-control': `jack${number}`, 'aria-label': `Jack ${jackLabel(number)}` });
      group.append(svg('circle', { cx, cy, r: 4.5, class: 'mp-nut' }), svg('circle', { cx, cy, r: 2.5, class: 'mp-hole' }), svg('text', { x: cx, y: cy + 7.2, class: 'mp-label mp-small mp-mono', 'text-anchor': 'middle' }, jackLabel(number)));
      drawing.append(group);
    }));
    return { drawing, potNodes };
  }

  function paintPanel() {
    const page = currentPage();
    if (!page) return;
    for (const { pot, group, dots, needle, label } of refs.potNodes) {
      const entry = page.pots[pot.id];
      const shifted = state.shift && entry.shift;
      group.style.setProperty('--ring', page.colour);
      const lit = Math.max(1, Math.round(entry.def * (RING_DOTS - 1)) + 1);
      dots.forEach((dot, i) => dot.classList.toggle('lit', i < lit));
      needle.setAttribute('transform', `rotate(${(RING_START + entry.def * 270).toFixed(1)} ${pot.x} ${pot.y})`);
      label.textContent = clip((state.shift && entry.shift ? entry.shift : entry.name) || '·');
      group.classList.toggle('shifted', Boolean(shifted));
      group.classList.toggle('muted', state.shift && !shifted);
    }
    for (const tab of refs.tabs.querySelectorAll('[data-page]')) {
      const active = Number(tab.dataset.page) === state.page;
      tab.setAttribute('aria-selected', String(active));
      tab.classList.toggle('active', active);
    }
    refs.shiftToggle.setAttribute('aria-pressed', String(state.shift));
    refs.pots.replaceWith(refs.pots = potsTable(page));
    describe(state.selected);
  }

  function potsTable(page) {
    const rows = page.pots.map((pot) => [
      strongThen(`P${pot.id + 1}`, POT_POSITIONS[pot.id]),
      pot.name || '—',
      pot.shift || 'unchanged',
      pot.b2 || '—',
    ]);
    const node = table(['Knob', `${page.name}, normal`, 'Hold B1', 'B2 does'], rows, 'manual-pots');
    node.style.setProperty('--ring', page.colour);
    return node;
  }

  // ------------------------------------------------------------------ the readout

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
    const title = (context, name) => { out.append(el('h3', '', name), el('p', 'manual-sub', context)); };
    if (!control) {
      title('Select a control', 'The panel');
      out.append(el('p', '', 'Hover or tap a knob, a button, the USB-C port or a jack. The page tabs change what the knobs do, and Hold B1 shows the shift layer.'));
      return;
    }
    if (control.startsWith('pot')) {
      const id = Number(control.slice(3));
      const entry = page?.pots[id];
      title(`P${id + 1} · ${POT_POSITIONS[id]} · ${page?.name ?? ''}`, entry?.name || 'Not used on this page');
      const list = el('dl', 'manual-facts');
      list.append(el('dt', '', 'Normal'), el('dd', '', entry?.name || '—'), el('dt', '', 'Hold B1'), el('dd', '', entry?.shift || 'unchanged'));
      if (entry?.b2) list.append(el('dt', '', 'B2'), el('dd', '', entry.b2));
      out.append(list, el('p', 'manual-muted', 'After a page change a knob has to catch its stored value before it takes over, so nothing jumps.'));
      return;
    }
    if (/^b[123]$/.test(control)) {
      const card = buttonCards(descriptor).find((item) => item.id === control);
      title('Button', card?.name ?? control.toUpperCase());
      const list = el('dl', 'manual-facts');
      for (const action of card?.actions ?? []) list.append(el('dt', '', gestureLabel(action.gesture)), (() => { const dd = el('dd'); dd.append(strongThen(action.label, `· ${action.help}`)); return dd; })());
      out.append(list);
      return;
    }
    if (control === 'usb') {
      title('Front panel', 'USB-C');
      out.append(el('p', '', 'One cable to the computer. Studio talks to the module over it (Chrome or Edge), it carries USB-MIDI, and it is where new firmware goes in when the module is in DFU mode.'));
      return;
    }
    if (control.startsWith('jack')) {
      const jack = jackList(descriptor).find((item) => item.number === Number(control.slice(4)));
      title(`Jack · ${SIG_LABELS[jack?.sig] ?? ''}`, jack ? `J${jack.number} · ${jack.name}` : control);
      out.append(el('p', '', jack ? jackText(jack) : ''), el('p', 'manual-muted', 'The CV jacks are numbered here in reading order. The panel template gives the holes but not which is which, so the numbers printed on your panel are the authority.'));
    }
  }

  // ------------------------------------------------------------------ the panel section

  function buildPanelSection(pages) {
    const section = heading('manual-panel', 'The panel', 'Drawn to scale from the SDK’s KiCad template. The rings show each knob’s factory position.');
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
    const pots = el('div');
    const side = el('div', 'manual-side');
    side.append(controls, readout, pots);
    stage.append(figure, side);
    section.append(stage);

    refs = { drawing, potNodes, tabs, shiftToggle, readout, pots };
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

  function buildModuleSection(pages) {
    const section = heading('manual-module', 'The module', 'Buttons, jacks and page colours as the firmware itself reports them.');

    section.append(el('h3', '', 'Buttons'));
    const buttonRows = [];
    for (const card of buttonCards(descriptor)) {
      card.actions.forEach((action, index) => buttonRows.push([index === 0 ? card.name : '', gestureLabel(action.gesture), strongThen(action.label, `· ${action.help}`)]));
    }
    section.append(table(['Button', 'Gesture', 'What it does'], buttonRows, 'manual-buttons'));

    section.append(el('h3', '', 'Jacks'));
    section.append(table(['Jack', 'Type', 'What it does'], jackList(descriptor).map((jack) => [`J${jack.number} · ${jackLabel(jack.number)}`, SIG_LABELS[jack.sig] ?? jack.sig, jackText(jack)])));

    section.append(el('h3', '', 'Page colours'));
    section.append(el('p', 'manual-muted', 'The rings take the colour of the page you are on, so you can tell where you are without looking at a screen.'));
    section.append(table(['Page', 'Ring', 'Knobs'], pages.map((page) => {
      const ring = el('span', 'manual-swatch'); ring.style.setProperty('--ring', page.colour);
      return [page.name, ring, page.pots.map((pot) => pot.name).filter(Boolean).join(' · ')];
    })));

    for (const item of manualSections(descriptor)) {
      section.append(el('h3', '', item.title));
      const text = el('p'); text.innerHTML = richText(item.body);
      section.append(text);
    }

    section.append(el('h3', '', 'On the SD card'));
    const sd = el('pre', 'manual-code');
    sd.textContent = ['/SLOT0 … SLOT3    sample library: WAV files, one folder per sample slot', '                  (the Sampler tab writes them as pentavox_samples.zip)', '/DX7/BANK_A.SYX   DX7 banks for the Six-op FM engines (BANK_B, BANK_C the same)'].join('\n');
    section.append(sd);

    const module = descriptor?.module;
    if (module) section.append(el('p', 'manual-muted manual-source', `This part is the firmware’s own help for ${module.name} ${module.fw}${module.git ? ` (${module.git})` : ''}, read from ${state.source}.`));
    return section;
  }

  // ------------------------------------------------------------------ assembly

  function build() {
    const pages = panelPages(descriptor);
    state.page = Math.min(state.page, Math.max(0, pages.length - 1));
    const article = el('article', 'manual');

    const hero = el('header', 'manual-hero');
    const title = el('div', 'manual-title');
    title.append(el('h1', '', 'Pentavox'), el('p', 'manual-sub', [voiceSummary(pages), 'Alchemy Lab firmware'].filter(Boolean).join(' · ')));
    // The firmware's own one-line summary lists every effect of the full build, so the lead is written here instead.
    hero.append(title, el('p', 'manual-lead', 'How the panel works, what each page does, and how to set the module up in Studio and flash new firmware.'));

    const nav = el('nav', 'manual-nav'); nav.setAttribute('aria-label', 'Manual sections');
    for (const [id, label] of ANCHORS) {
      const link = el('a', '', label); link.href = `#${id}`;
      link.addEventListener('click', (event) => { event.preventDefault(); article.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      nav.append(link);
    }

    article.append(hero, nav);
    article.append(pages.length ? buildPanelSection(pages) : el('p', 'manual-muted', 'This firmware does not describe its pages.'));
    const parts = new Map([...staticDoc.querySelectorAll('section[id]')].map((node) => [node.id, document.importNode(node, true)]));
    if (parts.has('manual-studio')) article.append(parts.get('manual-studio'));
    article.append(buildModuleSection(pages));
    for (const id of ['manual-flash', 'manual-help']) if (parts.has(id)) article.append(parts.get(id));
    root.replaceChildren(article);
    state.built = true;
    if (pages.length) paintPanel();
  }

  return { show, refreshConnection };
}
