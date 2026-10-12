function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountSettings(root, controller) {
  const ui = { open: new Set(['input', 'clock']) };

  function segmented(item, readOnly) {
    const box = element('div', item.twoRows ? 'set-seg two-rows' : 'set-seg'); box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', item.label);
    for (const option of item.options) {
      const button = element('button', `set-seg-btn${option.value === item.value ? ' on' : ''}`, option.label);
      button.type = 'button'; button.disabled = readOnly; button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(option.value === item.value));
      button.addEventListener('click', () => { if (option.value !== item.value) controller.updateSetting(item.id, option.value); });
      box.append(button);
    }
    return box;
  }

  function slider(item, readOnly) {
    const box = element('div', 'set-slider');
    const input = document.createElement('input'); input.type = 'range'; input.min = String(item.min); input.max = String(item.max); input.step = String(item.step);
    input.value = String(item.value); input.disabled = readOnly; input.setAttribute('aria-label', item.label);
    const out = element('output', '', `${item.value}${item.unit}`);
    input.addEventListener('input', () => { out.textContent = `${input.value}${item.unit}`; });
    input.addEventListener('change', () => controller.updateSetting(item.id, input.value));
    box.append(input, out);
    return box;
  }

  function toggle(item, readOnly) {
    const button = element('button', `set-switch${item.value ? ' on' : ''}`); button.type = 'button'; button.disabled = readOnly;
    button.setAttribute('role', 'switch'); button.setAttribute('aria-checked', String(item.value)); button.setAttribute('aria-label', item.label);
    button.append(element('span', 'set-knob'), element('span', 'set-switch-text', item.value ? 'On' : 'Off'));
    button.addEventListener('click', () => controller.updateSetting(item.id, !item.value));
    return button;
  }

  function dropdown(control, readOnly) {
    const label = element('label', 'set-select', ''); label.append(element('span', '', control.label));
    const select = document.createElement('select'); select.disabled = readOnly; select.setAttribute('aria-label', control.label);
    for (const option of control.options) select.append(new Option(option.label, String(option.value), false, option.value === control.value));
    select.addEventListener('change', () => controller.updateSetting(control.id, select.value));
    label.append(select);
    return label;
  }

  function row(item, readOnly) {
    const line = element('div', `set-row row-${item.control}`);
    const text = element('div', 'set-text'); text.append(element('strong', '', item.label));
    if (item.hint) text.append(element('small', '', item.hint));
    line.append(text);
    if (item.control === 'segmented') line.append(segmented(item, readOnly));
    else if (item.control === 'slider') line.append(slider(item, readOnly));
    else if (item.control === 'switch') line.append(toggle(item, readOnly));
    else { const box = element('div', 'set-multi'); for (const control of item.controls) box.append(dropdown(control, readOnly)); line.append(box); }
    return line;
  }

  function render() {
    root.replaceChildren();
    const view = controller.view();
    if (view.readOnly) root.append(element('div', 'banner warning', view.reason ?? 'Read only'));
    const groups = controller.settingsView();
    if (!groups.length) { root.append(element('p', 'cv-empty', 'This module firmware has no settings fields.')); return; }
    const list = element('div', 'cv-list');
    for (const group of groups) {
      const open = ui.open.has(group.key);
      const card = element('section', `cv-item${open ? ' open' : ''}`); card.dataset.mod = group.mod; card.dataset.group = group.key;
      const head = element('button', 'cv-head set-head'); head.type = 'button'; head.setAttribute('aria-expanded', String(open));
      const name = element('span', 'cv-name'); name.append(element('span', 'mod-dot'), element('strong', '', group.title));
      const chips = element('span', 'chips'); chips.append(element('span', 'chip-empty', group.summary || 'defaults'));
      head.append(name, chips, element('span', 'chev', open ? '⌃' : '⌄'));
      head.addEventListener('click', () => { if (open) ui.open.delete(group.key); else ui.open.add(group.key); render(); });
      card.append(head);
      if (open) { const body = element('div', 'cv-body'); for (const item of group.items) body.append(row(item, view.readOnly)); card.append(body); }
      list.append(card);
    }
    root.append(list);
  }

  const unsubscribe = controller.subscribe(render);
  render();
  return () => { unsubscribe(); root.replaceChildren(); };
}
