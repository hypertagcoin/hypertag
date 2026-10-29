// Adds a live price + Long / Short chip under the post text for every $CASHTAG
// listed on Hyperliquid, and keeps the action-bar Trade button in sync.
import { change24h, fmtPct, fmtPx, fmtUsd, midOf, trend } from '../lib/format.js';
import { syncTradeButton } from './actions.js';
import { createHost, h } from './dom.js';
import { chipAnchorFor, tickersIn, topLevelPosts } from './posts.js';
import {
  account, appState, marketFor, markets, positionFor,
} from './store.js';
import { openTrade } from './trade.js';

const live = new Set(); // { host, update }

function buildChips(coins) {
  const { host, root } = createHost('chips');
  host.dataset.coins = coins.join(',');
  const row = h('div', { class: 'chips' });
  const updaters = coins.map((coin) => {
    const pxEl = h('span', { class: 'chip-px' });
    const chgEl = h('span', { class: 'chip-chg' });
    const posEl = h('span', { class: 'chip-pos', hidden: true });
    row.append(h('div', { class: 'chip' },
      h('button', { class: 'chip-coin', title: `Trade ${coin} on Hyperliquid`, onclick: () => openTrade({ coin, side: 'long' }) },
        h('span', { class: 'chip-sym' }, `$${coin}`), pxEl, chgEl, posEl),
      h('button', { class: 'pill pill-long', onclick: () => openTrade({ coin, side: 'long' }) }, 'Long'),
      h('button', { class: 'pill pill-short', onclick: () => openTrade({ coin, side: 'short' }) }, 'Short')));
    return () => {
      const m = marketFor(coin);
      pxEl.textContent = `$${fmtPx(midOf(m))}`;
      const chg = change24h(m);
      chgEl.textContent = fmtPct(chg);
      chgEl.className = `chip-chg ${trend(chg)}`;
      const p = positionFor(coin);
      posEl.hidden = !p;
      if (p) {
        posEl.className = `chip-pos ${p.szi > 0 ? 'long' : 'short'}`;
        posEl.textContent = `${p.szi > 0 ? 'Long' : 'Short'} ${fmtUsd(p.unrealizedPnl, { sign: true })}`;
      }
    };
  });
  root.append(row);
  const entry = { host, update: () => updaters.forEach((u) => u()) };
  entry.update();
  live.add(entry);
  return host;
}

function syncChips(article, coins, enabled) {
  const existing = article.querySelector('tt-root[data-kind="chips"]');
  const anchor = enabled ? chipAnchorFor(article) : null;
  if (!anchor) {
    existing?.remove();
    return;
  }
  const key = coins.join(',');
  const inPlace = existing
    && (anchor.after ? existing.previousElementSibling === anchor.el : existing.nextElementSibling === anchor.el);
  if (inPlace && existing.dataset.coins === key) return;
  existing?.remove();
  if (!coins.length) return;
  const host = buildChips(coins);
  if (anchor.after) anchor.el.after(host);
  else anchor.el.before(host);
}

function scan() {
  if (!markets.get().list.length) return;
  const settings = appState.get()?.settings || {};
  for (const article of topLevelPosts()) {
    const coins = tickersIn(article);
    syncChips(article, coins, settings.showChips !== false);
    syncTradeButton(article, coins, settings.showTradeButton !== false);
  }
  for (const entry of live) if (!entry.host.isConnected) live.delete(entry);
}

let pending = false;
function scheduleScan() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    scan();
  }, 120);
}

function updateAll() {
  for (const entry of live) {
    if (entry.host.isConnected) entry.update();
    else live.delete(entry);
  }
}

export function startChips() {
  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true, characterData: true });
  let network = null;
  markets.sub((snap) => {
    // Market list changed (first load / network switch): rebuild everything.
    if (snap.network !== network) {
      network = snap.network;
      document.querySelectorAll('tt-root[data-kind="chips"], tt-root[data-kind="tradebtn"]').forEach((el) => el.remove());
      live.clear();
      scan();
    } else {
      updateAll();
    }
  });
  account.sub(updateAll);
  appState.sub(scheduleScan);
  scheduleScan();
}
