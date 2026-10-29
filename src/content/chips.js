// Finds $CASHTAGS in timeline posts and adds a live price + Long / Short chip
// under the post text for every one that is listed on Hyperliquid.
import { change24h, fmtPct, fmtPx, fmtUsd, midOf, trend } from '../lib/format.js';
import { createHost, h } from './dom.js';
import {
  account, appState, marketFor, markets, positionFor, resolveSymbol,
} from './store.js';
import { openTrade } from './trade.js';

const CASHTAG_RE = /\$([A-Za-z][A-Za-z0-9]{0,9})(?![A-Za-z0-9])/g;
const CASHTAG_TEXT_RE = /^\$[A-Za-z][A-Za-z0-9]{0,9}$/;
const CASHTAG_LINK = 'a[href*="/search?q=%24"]';
const EMBEDDED_POST = '[data-slot="embedded-tweet-frame"]';
const MAX_PER_POST = 3;
const live = new Set(); // { host, update }

// X serves two layouts. The classic one labels posts with data-testid; the
// newer one has no labels, posts are plain <article>s and quoted posts are
// <article>s nested inside them. Work from structure that both share.
function topLevelPosts() {
  return [...document.querySelectorAll('article')].filter((a) => !a.parentElement?.closest('article'));
}

const ownedBy = (article, el) => el.closest('article') === article && !el.closest(EMBEDDED_POST);

/** Where the chip row goes: right after the post text, else just above the action bar. */
function anchorFor(article) {
  const legacy = article.querySelector('[data-testid="tweetText"]');
  if (legacy) return { el: legacy, after: true };
  const link = [...article.querySelectorAll(CASHTAG_LINK)]
    .find((a) => ownedBy(article, a) && CASHTAG_TEXT_RE.test(a.textContent.trim()));
  const text = link?.closest('div[dir="auto"]');
  if (text && ownedBy(article, text)) return { el: text, after: true };
  const bar = [...article.querySelectorAll('[role="group"]')].find((g) => ownedBy(article, g));
  return bar ? { el: bar, after: false } : null;
}

function tickersIn(article) {
  const coins = [];
  const add = (sym) => {
    const m = resolveSymbol(sym);
    if (m && !coins.includes(m.name)) coins.push(m.name);
  };
  for (const el of article.querySelectorAll('[data-testid="tweetText"]')) {
    for (const [, sym] of el.textContent.matchAll(CASHTAG_RE)) add(sym);
  }
  // X links every cashtag in post text (including quoted posts). Its own price
  // cards are links too, but their text isn't a bare "$TICKER", so they're skipped.
  for (const a of article.querySelectorAll(CASHTAG_LINK)) {
    const text = a.textContent.trim();
    if (CASHTAG_TEXT_RE.test(text)) add(text.slice(1));
  }
  return coins.slice(0, MAX_PER_POST);
}

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

function processArticle(article, enabled) {
  const existing = article.querySelector('tt-root[data-kind="chips"]');
  const anchor = enabled ? anchorFor(article) : null;
  if (!anchor) {
    existing?.remove();
    return;
  }
  const coins = tickersIn(article);
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
  const enabled = appState.get()?.settings?.showChips !== false;
  for (const article of topLevelPosts()) processArticle(article, enabled);
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
      document.querySelectorAll('tt-root[data-kind="chips"]').forEach((el) => el.remove());
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
