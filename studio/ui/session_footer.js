import { presetSlotList } from './presets.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountSessionFooter(root, controller, { confirmOverwrite = globalThis.confirm } = {}) {
  const slots = presetSlotList(controller.session?.info);
  let busy = false;
  const slot = document.createElement('select');
  slot.setAttribute('aria-label', 'Save destination');
  for (const entry of slots) {
    const option = element('option', '', `Slot ${entry.number}${entry.autosave ? ' · Autosave' : ''}`);
    option.value = String(entry.number); option.disabled = entry.autosave;
    slot.append(option);
  }
  slot.value = String(slots.find((entry) => !entry.autosave)?.number ?? slots[0].number);
  const badge = element('span', 'dirty-badge', 'Not saved to a slot');
  badge.title = 'Changes affect the current sound. Save current sound to keep them in a chosen slot.';
  const save = element('button', 'primary', 'Save current sound'); save.type = 'button';
  const writable = () => slots.some((entry) => entry.number === Number(slot.value) && !entry.autosave);
  save.addEventListener('click', async () => {
    if (busy || controller.view().readOnly || !writable()) return;
    const number = Number(slot.value);
    if (!confirmOverwrite?.(`Overwrite slot ${number} with the current sound?`)) return;
    busy = true; render();
    try { await controller.save(number); } catch (error) { controller.onError(error); }
    finally { busy = false; render(); }
  });
  const discard = element('button', '', 'Discard changes'); discard.type = 'button';
  discard.addEventListener('click', async () => {
    if (busy || controller.view().readOnly || !controller.view().dirty) return;
    busy = true; render();
    try { await controller.discard(); } catch (error) { controller.onError(error); }
    finally { busy = false; render(); }
  });
  slot.addEventListener('change', render);
  root.replaceChildren(badge, slot, save, discard);

  function render() {
    const view = controller.view();
    badge.classList.toggle('visible', view.dirty);
    save.disabled = busy || view.readOnly || !writable();
    save.setAttribute('aria-label', `Save current sound to slot ${slot.value}`);
    slot.disabled = busy || view.readOnly || !slots.some((entry) => !entry.autosave);
    discard.disabled = busy || view.readOnly || !view.dirty;
    root.setAttribute('aria-busy', String(busy));
  }
  const unsubscribe = controller.subscribe(render);
  render();
  return () => { unsubscribe(); root.replaceChildren(); };
}
