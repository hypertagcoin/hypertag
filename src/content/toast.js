// X-style toasts (blue bar, bottom-centre).
import { createHost, h } from './dom.js';

let host = null;
let list = null;

export function toast(message, { type = 'info', action, duration = 4500 } = {}) {
  if (!host || !host.isConnected) {
    const created = createHost('toast');
    host = created.host;
    list = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    created.root.append(list);
    document.body.append(host);
  }
  const el = h('div', { class: `toast ${type}` },
    h('span', null, message),
    action && h('button', {
      class: 'toast-action',
      onclick: () => {
        el.remove();
        action.onClick();
      },
    }, action.label));
  list.append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }, duration);
}
