// Content script entry for x.com / twitter.com.
import { rpc } from '../lib/rpc.js';
import { startChips } from './chips.js';
import { openConnect } from './connect.js';
import { startSidebar } from './sidebar.js';
import { refreshState, startPolling } from './store.js';
import { initTheme } from './theme.js';

function main() {
  initTheme();
  startPolling();
  startChips();
  startSidebar();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'tt:state-changed') refreshState().catch(() => {});
    if (msg?.type === 'tt:open-connect') openConnect();
  });

  // The popup asked to connect while no x.com tab was focused.
  rpc('ui:consumeConnect').then((yes) => yes && openConnect()).catch(() => {});
}

if (!window.__ttContent) {
  window.__ttContent = true;
  if (document.body) main();
  else document.addEventListener('DOMContentLoaded', main, { once: true });
}
