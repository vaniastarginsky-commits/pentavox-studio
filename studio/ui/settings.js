import { builtAt, loadLatestCloudMeta } from '../build_flow.js';
import { changelogEntries, firmwareRows, loadChangelog } from '../firmware_info.js';

export function settingsLayout(groups) {
  const input = groups.find(group => group.key === 'input');
  const lighting = input?.items.filter(item => item.id === 's0.0') ?? [];
  const panels = [];
  const clock = groups.find(group => group.key === 'clock');
  if (clock) panels.push({ ...clock, title: 'Clock', items: clock.items.filter(item => !['s2.2', 's2.3'].includes(item.id)) });
  if (lighting.length) panels.push({ key: 'lighting', title: 'Lighting', mod: 'gl', items: lighting });
  if (input?.items.some(item => item.id !== 's0.0')) panels.push({ ...input, title: 'Input & output', items: input.items.filter(item => item.id !== 's0.0') });
  const voices = groups.find(group => group.key === 'voices'); if (voices) panels.push({ ...voices, title: 'Voices' });
  const advanced = groups.filter(group => !['clock', 'input', 'voices'].includes(group.key));
  const transitions = clock?.items.filter(item => ['s2.2', 's2.3'].includes(item.id)) ?? [];
  if (transitions.length) advanced.unshift({ key: 'clock-transition', title: 'Tempo transitions', mod: 'fx', items: transitions });
  return { panels, advanced };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountSettings(root, controller) {
  const RECENT_CHANGES = 3;   // the card shows this many entries of the changelog; the rest is behind "Show all"
  const ui = { open: new Set(['input', 'clock']), logAll: false, firmwareOpen: false };
  const firmware = { latest: null, builtAtMs: null, log: [] };
  root.classList.add('cc-page', 'instrument-settings');

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
    input.addEventListener('input', () => { out.textContent = text(input.value); fill(); if (item.id === 's0.0') { const preview = root.querySelector('.brightness-preview'); if (preview) preview.style.opacity = String(.12 + .88 * Number(input.value) / 100); } });
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
    const line = element('div', `instrument-setting${item.id === 'transport.bpm' ? ' setting-tempo' : item.id === 'transport.source' ? ' setting-source' : ''}`); line.dataset.setting = item.id;
    const text = element('span', 'cc-rtext'); text.append(element('b', '', item.label));
    if (item.hint) { const hint = element('small', '', item.hint.split('. ')[0]); hint.title = item.hint; text.append(hint); }
    const help = element('a', 'setting-help', '?'); help.href = `#manual/search:${encodeURIComponent(item.label)}`; help.setAttribute('aria-label', `Help for ${item.label}`); text.append(help);
    const ctrl = element('span', 'cc-ctrl');
    if (item.id === 'transport.bpm') {
      const input = document.createElement('input'); input.type = 'number'; input.min = item.min; input.max = item.max; input.step = item.step; input.value = item.value; input.inputMode = 'numeric'; input.setAttribute('aria-label', item.label); input.disabled = readOnly;
      input.addEventListener('change', () => { const value = Number(input.value); if (!Number.isFinite(value) || input.value === '') { input.value = item.value; return; } controller.updateSetting(item.id, value); });
      ctrl.append(input, element('span', 'tempo-unit', 'BPM'));
    } else if (item.control === 'segmented') ctrl.append(...segmented(item, readOnly));
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
    const entries = changelogEntries(firmware.log, ui.logAll ? 50 : RECENT_CHANGES);
    if (entries.length) {
      const list = element('ul', 'cc-fwlog');
      for (const entry of entries) {
        const item = element('li');
        item.append(element('time', '', entry.date ?? ''), element('span', `cc-fwarea ${entry.area ?? ''}`, entry.area ?? ''), element('span', '', entry.text));
        list.append(item);
      }
      card.append(list);
      if (firmware.log.length > RECENT_CHANGES) {
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
    const { panels, advanced } = settingsLayout(groups);
    const list = element('div', 'instrument-settings-grid');
    for (const group of panels) {
      const card = element('section', 'instrument-settings-card'); card.dataset.group = group.key;
      card.append(element('h2', '', group.title));
      const body = element('div', 'instrument-settings-fields');
      const items = group.key === 'clock' ? [...group.items].sort((a,b) => (a.id === 'transport.bpm' ? -2 : a.id === 'transport.source' ? -1 : 0) - (b.id === 'transport.bpm' ? -2 : b.id === 'transport.source' ? -1 : 0)) : group.items;
      for (const item of items) body.append(row(item, view.readOnly));
      card.append(body);
      list.append(card);
    }
    const extra = element('section', 'instrument-settings-advanced');
    for (const group of advanced) {
      const open = ui.open.has(group.key);
      const card = element('details', 'instrument-settings-extra'); card.open = open;
      card.append(element('summary', '', group.title));
      card.addEventListener('toggle', () => { if (card.open) ui.open.add(group.key); else ui.open.delete(group.key); });
      const body = element('div', 'instrument-settings-fields'); for (const item of group.items) body.append(row(item, view.readOnly));
      card.append(body); extra.append(card);
    }
    const details = element('details', 'firmware-details'); details.open = ui.firmwareOpen;
    details.addEventListener('toggle', () => { ui.firmwareOpen = details.open; });
    const version = controller.session?.info?.fwVersion ?? 'Unknown version';
    details.append(element('summary', '', 'Firmware and change history'), firmwareCard());
    root.append(list, extra, details);
  }

  let disposed = false;
  loadChangelog().then((log) => { if (!disposed) { firmware.log = log; render(); } });
  loadLatestCloudMeta().then((meta) => { if (!disposed && meta) { firmware.latest = meta; firmware.builtAtMs = builtAt(meta); render(); } });
  const unsubscribe = controller.subscribe(render);
  render();
  return () => { disposed = true; unsubscribe(); root.replaceChildren(); };
}
