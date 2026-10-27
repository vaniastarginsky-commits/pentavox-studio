export const CONNECTION_HINT = 'WebUSB/WebSerial needs desktop Chrome or Edge; iPhone/iPad/Safari can only use the Demo';

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
  heading.textContent = 'Not connected';

  const hint = document.createElement('p');
  hint.textContent = CONNECTION_HINT;

  const actions = document.createElement('div');
  actions.className = 'connection-empty-actions';
  actions.append(
    button(document, 'Connect', 'primary', connectButton),
    button(document, 'Demo', '', demoButton),
  );

  empty.append(heading, hint, actions);
  root.classList.add('disconnected');
  root.replaceChildren(empty);
}

export function renderConnectionEmptyStates(roots, controls) {
  for (const root of roots) renderConnectionEmptyState(root, controls);
}
