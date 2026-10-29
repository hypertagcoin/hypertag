// X-style modal shell: blurred sticky header with close button, rounded sheet,
// full-screen on narrow viewports. Escape or backdrop click closes it.
import { ICONS, createHost, h, icon } from './dom.js';

const stack = [];

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  e.stopPropagation();
  stack[stack.length - 1].close();
}, true);

export function openDialog({ title, width = 480, onClose } = {}) {
  const { host, root } = createHost('dialog');
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  const titleEl = h('h2', { class: 'dlg-title' }, title);
  const headExtra = h('div', { class: 'dlg-head-extra' });
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => api.close() }, icon(ICONS.close));
  const body = h('div', { class: 'dlg-body' });
  const dialog = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: { maxWidth: `${width}px` } },
    h('div', { class: 'dlg-head' }, closeBtn, titleEl, headExtra),
    body);
  const backdrop = h('div', { class: 'backdrop' }, dialog);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) api.close();
  });
  root.append(backdrop);
  document.body.append(host);

  const api = {
    host,
    body,
    headExtra,
    closed: false,
    setTitle(t) {
      titleEl.textContent = t;
    },
    focus(el) {
      requestAnimationFrame(() => (el || closeBtn).focus({ preventScroll: true }));
    },
    close() {
      if (api.closed) return;
      api.closed = true;
      stack.splice(stack.indexOf(api), 1);
      host.remove();
      document.documentElement.style.overflow = prevOverflow;
      onClose?.();
    },
  };
  stack.push(api);
  api.focus();
  return api;
}
