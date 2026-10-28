import { potMapPages } from './potmap_vm.js';

/** Resolve only exact firmware destinations; built-in-only controls stay unavailable. */
export function panelTargets(controller, layer = 0, pageIndex = 0) {
  const page = controller.potMapView?.()[layer]?.pages[pageIndex];
  if (!page) return [];
  const physical = controller.session.potMap ? potMapPages(controller.session.potMap).find(item => item.index === page.page) : null;
  return page.cells.map(cell => {
    let entry = cell.assigned ? controller.destinations.byId(cell.destId) : null;
    if (!cell.off && !cell.assigned) {
      const symbol = layer === 0 ? physical?.pots[cell.pot] : null;
      if (symbol && !symbol.startsWith('builtin:')) entry = controller.destinations.entries.find(item => item.symbol === symbol);
      else if (layer === 1) {
        const group = page.label.startsWith('FX') ? 'FX' : page.label === 'Master' ? 'Global' : page.label;
        entry = controller.destinations.entries.find(item => item.group === group && item.name === cell.builtIn);
      }
    }
    return { pot: cell.pot, title: cell.title, destination: entry?.id ?? null, group: entry?.group ?? '', off: cell.off };
  });
}

export function mountRoutingPanel(root, controller, mode, { onError = () => {}, onSuccess = () => {}, isConnected = () => true } = {}) {
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const details = el('details', 'routing-panel-guide');
  const summary = el('summary', '', 'Choose a parameter on the panel');
  details.append(summary); root.replaceChildren(details);
  let pageIndex = 0, layer = 0, selected = 1, pinned = false, depthValue = '50';
  let sourceKey = controller.selectedKey, midiIndex = null;
  function render() {
    const old = details.querySelector('.routing-panel-body'); old?.remove();
    const pages = controller.potMapView?.()[layer]?.pages ?? [];
    if (!pages.length) { details.append(el('p', 'routing-panel-body', 'Panel assignments are not available on this firmware. Use the parameter lists below.')); return; }
    pageIndex = Math.min(pageIndex, pages.length - 1);
    const body = el('div', 'routing-panel-body');
    const preview = el('section', 'routing-panel-preview');
    const controls = el('div', 'routing-panel-controls');
    const page = el('select'); page.setAttribute('aria-label', 'Panel page');
    pages.forEach((item, index) => page.append(new Option(item.label, String(index), false, index === pageIndex)));
    page.addEventListener('change', () => { pageIndex = Number(page.value); pinned = false; render(); });
    const shift = el('button', '', 'B1 layer'); shift.type = 'button'; shift.setAttribute('aria-pressed', String(layer === 1));
    shift.addEventListener('click', () => { layer = layer ? 0 : 1; pinned = false; render(); });
    controls.append(page, shift); preview.append(controls);
    const targets = panelTargets(controller, layer, pageIndex);
    const knobs = el('div', 'routing-panel-knobs');
    const inspector = el('section', 'routing-panel-inspector');
    const name = el('h3'); const explanation = el('p', 'routing-panel-explanation');
    const source = el('select'); source.setAttribute('aria-label', mode === 'midi' ? 'MIDI route to assign' : 'CV source to assign');
    if (mode === 'midi') {
      const view = controller.midiRoutesView();
      for (const route of view?.routes ?? []) source.append(new Option(`Route ${route.index + 1} · CC ${route.cc}${route.dest ? ' · assigned' : ''}`, String(route.index)));
      midiIndex ??= view?.routes.find(route => !route.dest)?.index ?? view?.routes[0]?.index;
      source.value = String(midiIndex); source.addEventListener('change', () => { midiIndex = Number(source.value); });
    } else {
      for (const group of controller.view().groups) for (const item of group.sources) {
        if (item.source.key === 'panelpot') continue;
        source.append(new Option(item.source.key === 'basecv' ? `CV ${item.source.ch + 1} · J${item.source.ch + 3}` : item.source.name, item.key));
      }
      if (![...source.options].some(option => option.value === sourceKey)) sourceKey = source.options[0]?.value;
      source.value = sourceKey; source.addEventListener('change', () => { sourceKey = source.value; });
    }
    const sourceLabel = el('label', 'routing-panel-field', mode === 'midi' ? 'MIDI route' : 'CV input'); sourceLabel.append(source);
    const depth = el('input'); depth.type = 'number'; depth.min = '-100'; depth.max = '100'; depth.value = depthValue; depth.addEventListener('input', () => { depthValue = depth.value; }); depth.setAttribute('aria-label', 'Panel assignment depth, percent');
    const depthLabel = el('label', 'routing-panel-field', 'Depth, %'); depthLabel.append(depth);
    const apply = el('button', 'primary', mode === 'midi' ? 'Assign to MIDI route' : 'Add CV route'); apply.type = 'button';
    function select(pot) {
      selected = pot;
      const target = targets.find(item => item.pot === pot);
      name.textContent = target ? `${target.group ? `${target.group} / ` : ''}${target.title}` : 'Choose a knob';
      explanation.textContent = target?.destination ? 'Choose an input and apply. The route remains editable in the list below.' : 'This control has no modulation destination on this firmware. Choose another knob or use the parameter list.';
      apply.disabled = !target?.destination || !isConnected() || controller.view().readOnly || !source.options.length;
      for (const knob of knobs.children) knob.setAttribute('aria-pressed', String(Number(knob.dataset.pot) === pot));
    }
    for (const target of targets) {
      const knob = el('button', 'routing-panel-knob'); knob.type = 'button'; knob.dataset.pot = target.pot;
      knob.setAttribute('aria-label', `Panel knob ${target.pot + 1}: ${target.title}`);
      knob.classList.toggle('unavailable', !target.destination);
      knob.append(el('span', 'routing-panel-cap'), el('span', '', target.title));
      knob.addEventListener('mouseenter', () => { if (!pinned) select(target.pot); }); knob.addEventListener('focus', () => { if (!pinned) select(target.pot); }); knob.addEventListener('click', () => { pinned = true; select(target.pot); }); knobs.append(knob);
    }
    apply.addEventListener('click', () => {
      const target = targets.find(item => item.pot === selected);
      if (!target?.destination || !isConnected() || controller.view().readOnly || apply.disabled) return;
      const value = Number(depth.value);
      if (!Number.isFinite(value) || depth.value === '' || value < -100 || value > 100) { depth.focus(); return; }
      try {
        if (mode === 'midi') { controller.updateMidiRoute(midiIndex, 'dest', target.destination); controller.updateMidiRoute(midiIndex, 'depth', value); }
        else { const slot = controller.addRoute(target.destination, value, sourceKey); if (slot < 0) throw new Error('This input already has four routes. Remove one in the list first.'); }
        onSuccess(`Assigned ${target.title}`);
      } catch (error) { onError(error); }
    });
    preview.append(knobs); inspector.append(name, explanation, sourceLabel, depthLabel, apply);
    body.append(preview, inspector); details.append(body); select(selected);
  }
  details.addEventListener('toggle', () => { if (details.open) render(); });
  const unsubscribe = controller.subscribe(() => { if (details.open) render(); });
  return () => { unsubscribe(); root.replaceChildren(); };
}
