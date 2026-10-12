function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountEngineSet(root, controller, { dfuButton } = {}) {
  const running = element('section', 'running-set');
  const heading = element('div', 'section-heading');
  heading.append(element('h1', '', 'What is in the module now'), element('p', '', 'The 24-engine set compiled into the connected firmware.'));
  const bankRoot = element('div', 'engine-banks');
  running.append(heading, bankRoot);

  const composer = element('section', 'composer-section');
  const composerHeading = element('div', 'composer-heading');
  composerHeading.append(
    element('h1', '', 'Change the set (needs a rebuild and flash)'),
    element('p', '', 'Engines are compiled into the firmware. Pick a new set, then use Build + Flash in the composer below.'),
  );
  if (dfuButton) composerHeading.append(dfuButton);
  const iframe = document.createElement('iframe');
  iframe.title = 'Pentavox engine composer';
  iframe.src = '/engine_composer.html';
  composer.append(composerHeading, iframe);
  root.replaceChildren(running, composer);

  function render() {
    bankRoot.replaceChildren();
    for (const bank of controller.engineSetView()) {
      const column = element('section', 'engine-bank');
      const title = element('header', 'engine-bank-heading');
      title.append(element('h2', '', bank.title), element('span', '', bank.range));
      column.append(title);
      for (const slot of bank.slots) {
        const row = element('div', `engine-slot${slot.voices.length ? ' in-use' : ''}`);
        row.append(element('span', 'slot-number', String(slot.slot)), element('strong', 'slot-name', slot.name));
        const marks = element('span', 'slot-marks');
        if (slot.stereo) marks.append(element('span', 'capability-mark', 'Stereo'));
        if (slot.dx7Bank) marks.append(element('span', 'dx7-mark', `DX7 · bank ${slot.dx7Bank}`));
        if (slot.voices.length) marks.append(element('span', 'voice-use', `Plaits ${slot.voices.join(', ')}`));
        row.append(marks);
        column.append(row);
      }
      bankRoot.append(column);
    }
  }
  const unsubscribe = controller.subscribe(render);
  render();
  return () => { unsubscribe(); root.replaceChildren(); };
}
