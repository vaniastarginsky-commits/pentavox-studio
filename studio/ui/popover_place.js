// Positions a dropdown list (search + grouped choices) under its button without clipping:
// the list is fixed to the viewport, flips above the button near the bottom edge and follows
// the page while it scrolls. Used by the CV routing, Pot map and MIDI routing pickers.
export function placePopover(anchor, pop, { width = 320, height = 360 } = {}) {
  const place = () => {
    if (!pop.isConnected || !anchor.isConnected) { stop(); return; }
    const rect = anchor.getBoundingClientRect();
    const w = Math.min(width, window.innerWidth - 16);
    const h = Math.min(height, window.innerHeight - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    let top = rect.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 4);
    pop.style.left = `${left}px`; pop.style.top = `${top}px`; pop.style.width = `${w}px`; pop.style.maxHeight = `${h}px`;
  };
  const stop = () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
  place();
}
