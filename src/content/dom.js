// Content-script DOM: shadow-root hosts that carry the X-styled stylesheet.
import { h } from '../lib/h.js';
import { CSS } from './styles.js';
import { applyTheme } from './theme.js';

export { ICONS, h, icon, spinner } from '../lib/h.js';

export function networkBadge(network) {
  return network === 'testnet' ? h('span', { class: 'badge badge-testnet' }, 'Testnet') : null;
}

// Events that must not bubble out to x.com: tweet click-through navigation,
// keyboard shortcuts (j/k/l/r…), React handlers on the article, etc.
const ISOLATED_EVENTS = [
  'click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup',
  'touchstart', 'touchend', 'keydown', 'keyup', 'keypress', 'input', 'change', 'focusin', 'focusout',
];

/** A <tt-root> element with a closed shadow root carrying our X-styled stylesheet. */
export function createHost(kind) {
  const host = document.createElement('tt-root');
  host.dataset.ttHost = '';
  host.dataset.kind = kind;
  applyTheme(host);
  const root = host.attachShadow({ mode: 'closed' });
  root.append(h('style', null, CSS));
  for (const type of ISOLATED_EVENTS) host.addEventListener(type, (e) => e.stopPropagation());
  return { host, root };
}
