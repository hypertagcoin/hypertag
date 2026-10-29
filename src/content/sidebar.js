// A "Hyperliquid" card in X's right sidebar, styled like "What's happening":
// account value, PnL and open positions with one-tap close.
import { fmtPct, fmtPx, fmtSize, fmtUsd, shortAddr, trend } from '../lib/format.js';
import { rpc } from '../lib/rpc.js';
import { openConnect } from './connect.js';
import { ICONS, createHost, h, icon, networkBadge, spinner } from './dom.js';
import {
  account, appState, marketFor, refreshAccount,
} from './store.js';
import { toast } from './toast.js';
import { openTrade } from './trade.js';

function findAnchor() {
  // Classic layout labels the right column; the newer one doesn't, so fall back
  // to the first card-sized region on the right-hand side of the page.
  const col = document.querySelector('[data-testid="sidebarColumn"]');
  const first = col?.querySelector('section, aside')
    || [...document.querySelectorAll('aside, section, [role="complementary"]')].find((el) => {
      const r = el.getBoundingClientRect();
      return r.left > window.innerWidth * 0.55 && r.width >= 250 && r.width <= 420 && !el.closest('article');
    });
  if (!first) return null;
  let block = first;
  while (block.parentElement && block.parentElement !== col && block.parentElement.children.length === 1) block = block.parentElement;
  return block;
}

function buildCard() {
  const { host, root } = createHost('sidebar');
  const card = h('div', { class: 'card' });
  root.append(card);
  const armed = new Map(); // coin -> timeout id for two-step close
  const closing = new Set();

  async function closePos(e, coin) {
    e.stopPropagation();
    if (!e.isTrusted || closing.has(coin)) return;
    if (!armed.has(coin)) {
      armed.set(coin, setTimeout(() => {
        armed.delete(coin);
        render();
      }, 3000));
      render();
      return;
    }
    clearTimeout(armed.get(coin));
    armed.delete(coin);
    closing.add(coin);
    render();
    try {
      const res = await rpc('position:close', { coin });
      toast(res.status === 'filled' ? `Closed ${coin} at $${fmtPx(res.avgPx)}` : `Close order sent for ${coin}`);
      await refreshAccount();
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      closing.delete(coin);
      render();
    }
  }

  function positionRow(p) {
    const long = p.szi > 0;
    const m = marketFor(p.coin);
    const closeBtn = closing.has(p.coin)
      ? h('span', { class: 'btn-outline small', 'aria-busy': 'true' }, spinner(16))
      : h('button', {
        class: `btn-outline small${armed.has(p.coin) ? ' btn-danger' : ''}`,
        onclick: (e) => closePos(e, p.coin),
      }, armed.has(p.coin) ? 'Confirm' : 'Close');
    return h('div', { class: 'pos', onclick: () => openTrade({ coin: p.coin, side: long ? 'long' : 'short' }) },
      h('div', { class: 'pos-main' },
        h('div', { class: 'pos-top' },
          p.coin,
          h('span', { class: `side-tag ${long ? 'long' : 'short'}` }, `${long ? 'Long' : 'Short'} ${p.leverage?.value ?? ''}x`)),
        h('div', { class: 'pos-sub' }, `${fmtSize(Math.abs(p.szi), m?.szDecimals ?? 4)} @ ${fmtPx(p.entryPx)}${p.liquidationPx ? ` · Liq ${fmtPx(p.liquidationPx)}` : ''}`)),
      h('div', { class: `pos-pnl ${trend(p.unrealizedPnl)}` },
        fmtUsd(p.unrealizedPnl, { sign: true }),
        h('small', null, fmtPct(p.returnOnEquity))),
      closeBtn);
  }

  function render() {
    const s = appState.get();
    const head = h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, 'Hyperliquid'),
      s && networkBadge(s.network),
      s?.connection && h('span', { class: 'card-addr' }, shortAddr(s.connection.user)));

    if (!s) {
      card.replaceChildren(head, h('div', { class: 'card-pad' }, spinner()));
      return;
    }
    if (!s.connection) {
      card.replaceChildren(head,
        h('p', { class: 'card-text' }, 'Connect your account to long or short any $cashtag right from your timeline.'),
        h('div', { class: 'card-pad' }, h('button', {
          class: 'btn-contrast',
          onclick: (e) => {
            if (e.isTrusted) openConnect();
          },
        }, 'Connect')));
      return;
    }

    const a = account.get();
    if (!a) {
      card.replaceChildren(head, h('div', { class: 'card-pad' }, spinner()));
      return;
    }
    const summary = h('div', { class: 'card-pad' },
      h('div', { class: 'stat-label' }, 'Account value'),
      h('div', { class: 'stat-value' }, fmtUsd(a.accountValue)),
      h('div', { class: 'stats' },
        h('span', null, 'PnL ', h('b', { class: trend(a.unrealizedPnl) }, fmtUsd(a.unrealizedPnl, { sign: true }))),
        h('span', null, 'Available ', h('b', null, fmtUsd(a.withdrawable)))));
    const positions = a.positions.length
      ? h('div', { class: 'pos-list' }, a.positions.map(positionRow))
      : h('p', { class: 'empty' }, a.unified || a.accountValue > 0 || a.spotUsdc <= 0
        ? 'No open positions. Tap Long or Short on any $cashtag to open one.'
        : `You have ${fmtUsd(a.spotUsdc)} USDC in Spot. Move it to Perps on Hyperliquid to trade.`);
    card.replaceChildren(head, summary, positions,
      h('a', { class: 'card-foot', href: `${s.appUrl}/portfolio`, target: '_blank', rel: 'noopener noreferrer' },
        'Open Hyperliquid', icon(ICONS.external, { size: 16 })));
  }

  render();
  return { host, render };
}

export function startSidebar() {
  let card = null;
  const ensure = () => {
    const enabled = appState.get()?.settings?.showSidebar !== false;
    const anchor = enabled ? findAnchor() : null;
    if (!anchor) {
      if (!enabled) card?.host.remove();
      return;
    }
    if (!card) card = buildCard();
    if (anchor.previousElementSibling !== card.host) anchor.before(card.host);
  };
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      ensure();
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });
  setInterval(ensure, 2000);
  appState.sub(() => {
    ensure();
    card?.render();
  });
  account.sub(() => card?.render());
  ensure();
}
