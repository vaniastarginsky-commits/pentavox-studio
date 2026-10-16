// Jobs that use the module's USB link and must not be cut off: a card or sample transfer dies if the module is sent to DFU meanwhile
// (and a half-written file is left on the card). Each transfer registers itself here; "Reboot to DFU" asks before it runs.
const active = new Map();
let nextId = 1;

/** Register a running job; call the returned function when it ends (success, failure or abort). */
export function beginLinkJob(label) {
  const id = nextId++;
  active.set(id, label);
  return () => { active.delete(id); };
}

/** The label of a running job, or null when the link is free. */
export function activeLinkJob() {
  for (const label of active.values()) return label;
  return null;
}

export function linkBusyMessage(label = activeLinkJob()) {
  return label ? `${label} is still in progress. Wait for it to finish, or cancel it, before rebooting the module to DFU.` : '';
}
