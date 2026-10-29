// Floating X-style panels (hover card, Trade menu) anchored to an element:
// below it when there's room, otherwise above, and kept inside the viewport.
import { createHost, h } from './dom.js';

const GAP = 8;

export function openPopover({ kind, anchor, width, align = 'center' }) {
  const { host, root } = createHost('popover');
  const panel = h('div', { class: `popover popover-${kind}`, style: { width: `${width}px` } });
  root.append(panel);
  document.body.append(host);

  function place() {
    const r = anchor.getBoundingClientRect();
    const ph = panel.offsetHeight;
    const fitsBelow = r.bottom + GAP + ph <= window.innerHeight - GAP;
    const top = fitsBelow || r.top - GAP - ph < GAP ? r.bottom + GAP : r.top - GAP - ph;
    const left = align === 'end' ? r.right - width : r.left + r.width / 2 - width / 2;
    host.style.left = `${Math.round(Math.max(GAP, Math.min(left, window.innerWidth - width - GAP)))}px`;
    host.style.top = `${Math.round(Math.max(GAP, top))}px`;
  }

  return {
    host,
    panel,
    place,
    close() {
      host.remove();
    },
  };
}
