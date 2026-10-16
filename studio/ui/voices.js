function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountVoice(root, controller, voiceIndex, { help = {} } = {}) {
  let selected = controller.voicesView()[voiceIndex].engine;
  let assigning = false;
  async function assign(index) { if (assigning || controller.view().readOnly) return; assigning = true; selected = index; render(); try { await controller.assignVoiceEngine(voiceIndex, index); } finally { assigning = false; render(); } }
  function render() {
    root.replaceChildren(); const sessionView = controller.view(); const voice = controller.voicesView()[voiceIndex];
    if (sessionView.readOnly) root.append(element('div', 'banner warning', sessionView.reason ?? 'Read only'));
    const intro = element('div', 'voices-heading'); intro.append(element('h1', '', voice.title), element('p', '', 'Changes to this voice are sent to the module live.')); root.append(intro);
    const banks = controller.engineSetView(); const selectedSlot = banks.flatMap((bank) => bank.slots).find((slot) => slot.index === selected);
    const helpId = controller.session.engineCatalogs.composerCatalog?.engines?.find((engine) => engine.name === selectedSlot?.name)?.id;
    const selectedBar = element('div', 'selected-strip voice-selected-strip'); const copy = element('div', 'selected-copy'); copy.append(element('span', 'selected-kicker', `Slot ${selected + 1} selected`), element('strong', '', selectedSlot?.name ?? '—'), element('small', '', help[helpId]?.summary ?? 'No description yet'));
    const assignButton = element('button', 'assign-button', assigning ? 'Assigning…' : `Assign to voice ${voiceIndex + 1}`); assignButton.type = 'button'; assignButton.disabled = assigning || sessionView.readOnly || voice.engine === selected; assignButton.addEventListener('click', () => assign(selected)); selectedBar.append(copy, assignButton); root.append(selectedBar);
    const bankRoot = element('div', 'engine-banks voice-bank-copy');
    for (const bank of banks) { const column = element('section', `engine-bank bank-${['green', 'yellow', 'red'][bank.bank - 1]}`); const title = element('header', 'engine-bank-heading'); title.append(element('h2', '', ['Yellow', 'Green', 'Red'][bank.bank - 1]), element('span', '', '8/8')); column.append(title);
      for (const slot of bank.slots) { const row = element('button', `engine-slot${slot.index === voice.engine ? ' current' : ''}${slot.index === selected ? ' selected' : ''}`); row.type = 'button'; row.disabled = assigning || sessionView.readOnly; row.addEventListener('click', () => assign(slot.index)); row.append(element('span', 'slot-number', String(slot.slot).padStart(2, '0')), element('strong', 'slot-name', slot.name)); const marks = element('span', 'slot-marks'); if (slot.stereo) marks.append(element('span', '', 'Stereo')); for (const usedBy of slot.voices) marks.append(element('span', 'voice-use', String(usedBy))); row.append(marks); column.append(row); }
      bankRoot.append(column); }
    root.append(bankRoot, element('p', 'palette-note', 'The engine set is changed on the Engines tab (needs a rebuild).'));
  }
  const unsubscribe = controller.subscribe(render); render(); return () => { unsubscribe(); root.replaceChildren(); };
}

export function mountVoices(root, controller) {
  const holders = controller.voicesView().map(() => element("div"));
  root.replaceChildren(...holders);
  const unmount = holders.map((holder, index) => mountVoice(holder, controller, index));
  return () => { unmount.forEach((fn) => fn()); root.replaceChildren(); };
}
