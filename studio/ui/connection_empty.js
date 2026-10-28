export const CONNECTION_HINT = 'WebUSB/WebSerial needs desktop Chrome or Edge; iPhone/iPad/Safari can only use the Demo';

const TASKS = {
  'routing-root': ['Connect to edit CV routes', 'Choose where notes come from, route CV to sound parameters and remap the panel knobs.', 'CV input → Timbre · Depth +50%'],
  'midi-root': ['Connect to edit MIDI routes', 'Use MIDI Learn to assign a controller, then choose a parameter and its depth.', 'MIDI CC → Parameter · Depth'],
  'settings-root': ['Connect to edit module settings', 'Set input and output levels, clock, tempo and the options your firmware supports.', 'Clock source · Tempo · Input / output'],
  'presets-root': ['Connect to manage setup presets', 'Load a configuration from the module, save the current configuration or download a backup.', 'Current setup → Stored slot'],
};

export function connectionEmptyCopy(id) { return TASKS[id] ?? ['Connect your module', 'Connect to read this module’s settings, or explore the Demo.', 'Studio ↔ Pentavox']; }

function button(document, label, className, target) {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = className;
  control.textContent = label;
  control.addEventListener('click', () => target.click());
  return control;
}

export function renderConnectionEmptyState(root, { connectButton, demoButton, document = globalThis.document }) {
  const empty = document.createElement('section');
  empty.className = 'connection-empty';
  empty.setAttribute('aria-labelledby', `${root.id}-empty-title`);

  const heading = document.createElement('h2');
  heading.id = `${root.id}-empty-title`;
  const [title, description, example] = connectionEmptyCopy(root.id);
  heading.textContent = title;

  const hint = document.createElement('p');
  hint.textContent = description;
  const preview = document.createElement('p'); preview.className = 'empty-example'; preview.textContent = example;
  const browser = document.createElement('p'); browser.className = 'browser-hint'; browser.textContent = CONNECTION_HINT;

  const actions = document.createElement('div');
  actions.className = 'connection-empty-actions';
  actions.append(
    button(document, 'Connect', 'primary', connectButton),
    button(document, 'Explore Demo', '', demoButton),
  );

  empty.append(heading, hint, actions, preview, browser);
  root.classList.add('disconnected');
  root.replaceChildren(empty);
}

export function renderConnectionEmptyStates(roots, controls) {
  for (const root of roots) renderConnectionEmptyState(root, controls);
}
