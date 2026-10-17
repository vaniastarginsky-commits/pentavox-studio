import { builtAt, loadLatestCloudMeta } from '../build_flow.js';
import { changelogEntries, firmwareRows, loadChangelog } from '../firmware_info.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountSettings(root, controller) {
  const ui = { open: new Set(['input', 'clock']), logAll: false };
  const firmware = { latest: null, builtAtMs: null, log: [] };
  root.classList.add('cc-page');

  function segmented(item, readOnly) {
    const box = element('div', item.twoRows ? 'cc-seg two' : 'cc-seg'); box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', item.label);
    for (const option of item.options) {
      const on = option.value === item.value;
      const button = element('button', on ? 'active' : '', option.label);
      button.type = 'button'; button.disabled = readOnly; button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(on)); button.setAttribute('aria-pressed', String(on));
      button.addEventListener('click', () => { if (!on) controller.updateSetting(item.id, option.value); });
      box.append(button);
    }
    return [box];
  }

  function slider(item, readOnly) {
    const input = document.createElement('input'); input.type = 'range'; input.min = String(item.min); input.max = String(item.max); input.step = String(item.step);
    input.value = String(item.value); input.disabled = readOnly; input.setAttribute('aria-label', item.label);
    const fill = () => input.style.setProperty('--p', `${((Number(input.value) - item.min) / (item.max - item.min)) * 100}%`);
    fill();
    const text = (value) => `${value}${item.unit === '%' ? ' %' : item.unit}`;
    const out = element('output', '', text(item.value));
    input.addEventListener('input', () => { out.textContent = text(input.value); fill(); });
    input.addEventListener('change', () => controller.updateSetting(item.id, input.value));
    return [input, out];
  }

  function toggle(item, readOnly) {
    const button = element('button', 'cc-sw'); button.type = 'button'; button.disabled = readOnly;
    button.setAttribute('role', 'switch'); button.setAttribute('aria-checked', String(item.value)); button.setAttribute('aria-label', item.label);
    button.addEventListener('click', () => controller.updateSetting(item.id, !item.value));
    return [button, element('span', 'cc-swl', item.value ? 'On' : 'Off')];
  }

  function dropdown(control, readOnly) {
    const label = element('label', 'cc-mini'); label.append(element('span', '', control.label));
    const select = document.createElement('select'); select.disabled = readOnly; select.setAttribute('aria-label', control.label);
    for (const option of control.options) select.append(new Option(option.label, String(option.value), false, option.value === control.value));
    select.addEventListener('change', () => controller.updateSetting(control.id, select.value));
    label.append(select);
    return label;
  }

  function row(item, readOnly) {
    const line = element('div', 'cc-row2');
    const text = element('span', 'cc-rtext'); text.append(element('b', '', item.label));
    if (item.hint) text.append(element('small', '', item.hint));
    const ctrl = element('span', 'cc-ctrl');
    if (item.control === 'segmented') ctrl.append(...segmented(item, readOnly));
    else if (item.control === 'slider') ctrl.append(...slider(item, readOnly));
    else if (item.control === 'switch') ctrl.append(...toggle(item, readOnly));
    else for (const control of item.controls) ctrl.append(dropdown(control, readOnly));
    line.append(text, ctrl);
    return line;
  }

  /** When the firmware in the module and the latest cloud build were made, and the short change log. */
  function firmwareCard() {
    const card = element('section', 'cc-card cc-fwcard');
    card.append(element('h3', '', 'Firmware'));
    const rows = firmwareRows({ info: controller.session?.info, latest: firmware.latest, builtAtMs: firmware.builtAtMs });
    for (const entry of rows) {
      const line = element('p', entry.state ? `cc-fwrow ${entry.state}` : 'cc-fwrow');
      line.append(element('b', '', entry.label), element('span', '', entry.text));
      card.append(line);
    }
    const entries = changelogEntries(firmware.log, ui.logAll ? 50 : 6);
    if (entries.length) {
      const list = element('ul', 'cc-fwlog');
      for (const entry of entries) {
        const item = element('li');
        item.append(element('time', '', entry.date ?? ''), element('span', `cc-fwarea ${entry.area ?? ''}`, entry.area ?? ''), element('span', '', entry.text));
        list.append(item);
      }
      card.append(list);
      if (firmware.log.length > 6) {
        const more = element('button', 'cc-fwmore', ui.logAll ? 'Show fewer' : 'Show all'); more.type = 'button';
        more.addEventListener('click', () => { ui.logAll = !ui.logAll; render(); });
        card.append(more);
      }
    }
    return card;
  }

  function render() {
    root.replaceChildren();
    const view = controller.view();
    if (view.readOnly) root.append(element('div', 'banner warning', view.reason ?? 'Read only'));
    const groups = controller.settingsView();
    if (!groups.length) { root.append(element('p', 'cc-muted', 'This module firmware has no settings fields.')); return; }
    root.append(element('p', 'cc-lead', 'The same list as the module’s own Settings page (hold B2 + B3). Changes are heard at once; Save to slot keeps them.'));
    root.append(firmwareCard());
    const list = element('div', 'cc-setlist');
    for (const group of groups) {
      const open = ui.open.has(group.key);
      const card = element('section', `cc-card cc-setcard${open ? ' open' : ''}`); card.dataset.mod = group.mod; card.dataset.group = group.key;
      const head = element('button', 'cc-sethead'); head.type = 'button'; head.setAttribute('aria-expanded', String(open));
      head.append(element('span', 'cc-ddot'), element('h3', '', group.title), element('span', 'cc-chip', group.summary || 'defaults'), element('span', 'cc-sp'), element('span', 'cc-chev', open ? '⌃' : '⌄'));
      head.addEventListener('click', () => { if (open) ui.open.delete(group.key); else ui.open.add(group.key); render(); });
      card.append(head);
      if (open) { const body = element('div', 'cc-setbody'); for (const item of group.items) body.append(row(item, view.readOnly)); card.append(body); }
      list.append(card);
    }
    root.append(list);
  }

  let disposed = false;
  loadChangelog().then((log) => { if (!disposed) { firmware.log = log; render(); } });
  loadLatestCloudMeta().then((meta) => { if (!disposed && meta) { firmware.latest = meta; firmware.builtAtMs = builtAt(meta); render(); } });
  const unsubscribe = controller.subscribe(render);
  render();
  return () => { disposed = true; unsubscribe(); root.replaceChildren(); };
}
