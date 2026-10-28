let helpId = 0;
/** Inline help works with mouse, keyboard and touch, without leaving the current task. */
export function settingHelp(item, document = globalThis.document) {
  const wrap = document.createElement('span'); wrap.className = 'setting-help-wrap';
  const button = document.createElement('button'); button.className = 'setting-help'; button.type = 'button'; button.textContent = '?';
  button.setAttribute('aria-label', `Help for ${item.label}`); button.setAttribute('aria-expanded', 'false');
  const tip = document.createElement('span'); tip.className = 'setting-tooltip'; tip.id = `setting-tip-${++helpId}`; tip.hidden = true; tip.setAttribute('role', 'tooltip');
  tip.textContent = item.hint || item.label; button.setAttribute('aria-describedby', tip.id);
  let pinned = false;
  const show = () => { tip.hidden = false; button.setAttribute('aria-expanded', 'true');
    const rect = button.getBoundingClientRect?.();
    if (rect) { const width = Math.min(320, window.innerWidth - 24); tip.style.width = `${width}px`; tip.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`; tip.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - tip.offsetHeight - 12))}px`; }
  };
  const hide = () => { tip.hidden = true; button.setAttribute('aria-expanded', 'false'); };
  wrap.addEventListener('mouseenter', show); wrap.addEventListener('mouseleave', () => { if (!pinned) hide(); });
  button.addEventListener('focus', show); button.addEventListener('blur', () => { pinned = false; hide(); });
  button.addEventListener('click', () => { pinned = !pinned; pinned ? show() : hide(); });
  wrap.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); pinned = false; hide(); } });
  wrap.append(button, tip); return wrap;
}
