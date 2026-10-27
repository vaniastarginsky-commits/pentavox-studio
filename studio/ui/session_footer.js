function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountSessionFooter(root, controller, { confirmOverwrite = globalThis.confirm } = {}) {
  const slot = document.createElement('select');
  slot.setAttribute('aria-label', 'Slot');
  for (let number = 1; number <= 16; ++number) {
    const option = element('option', '', `Slot ${number}`);
    option.value = String(number);
    slot.append(option);
  }
  const badge = element('span', 'dirty-badge', 'Not saved');
  badge.title = 'Changes are not saved on the module yet';
  const save = element('button', 'primary', 'Save to slot');
  save.type = 'button';
  save.addEventListener('click', async () => {
    const number = Number(slot.value);
    if (!confirmOverwrite?.(`Overwrite slot ${number}?`)) return;
    try { await controller.save(number); } catch (error) { controller.onError(error); }
  });
  const discard = element('button', '', 'Discard changes');
  discard.type = 'button';
  discard.addEventListener('click', async () => {
    try { await controller.discard(); } catch (error) { controller.onError(error); }
  });
  root.replaceChildren(badge, slot, save, discard);

  function render() {
    const view = controller.view();
    badge.classList.toggle('visible', view.dirty);
    save.disabled = view.readOnly;
    slot.disabled = view.readOnly;
    discard.disabled = view.readOnly || !view.dirty;
  }
  const unsubscribe = controller.subscribe(render);
  render();
  return () => { unsubscribe(); root.replaceChildren(); };
}
