// A "Trade" button in each post's Reply / Repost / Like bar. Clicking it opens
// an X-style menu with one-tap market presets (tap, then tap again to confirm)
// and a link to the full trade sheet.
import { change24h, fmtPct, fmtPx, fmtSize, fmtUsd, midOf, trend } from '../lib/format.js';
import { rpc } from '../lib/rpc.js';
import { openConnect } from './connect.js';
import {
  ICONS, createHost, h, icon, spinner,
} from './dom.js';
import { openPopover } from './popover.js';
import { actionBarOf } from './posts.js';
import {
  appState, isConnected, marketFor, positionFor, refreshAccount,
} from './store.js';
import { toast } from './toast.js';
import { describeFill, openTrade } from './trade.js';

const PRESETS = [25, 50, 100];
const CONFIRM_MS = 3000;

let menu = null; // { pop, button, cleanup }

function closeMenu() {
  if (!menu) return;
  menu.cleanup();
  menu.button.setAttribute('aria-expanded', 'false');
  menu.pop.close();
  menu = null;
}

/** Leverage and margin mode a preset uses: the open position's, else the defaults. */
function presetTerms(coin) {
  const m = marketFor(coin);
  const pos = positionFor(coin);
  const settings = appState.get()?.settings || {};
  const leverage = Math.max(1, Math.min(m?.maxLeverage ?? 1, Math.round(pos?.leverage?.value ?? settings.defaultLeverage ?? 5)));
  const isCross = m?.onlyIsolated ? false : pos ? pos.leverage?.type === 'cross' : true;
  return { leverage, isCross };
}

function openMenu(button, coins) {
  if (menu?.button === button) {
    closeMenu();
    return;
  }
  closeMenu();
  const pop = openPopover({ kind: 'menu', anchor: button, width: 288, align: 'end' });
  const st = { coin: coins[0], armed: null, busy: null, timer: 0 };

  async function place(isBuy, usd) {
    const { leverage, isCross } = presetTerms(st.coin);
    st.busy = `${isBuy}:${usd}`;
    render();
    try {
      const res = await rpc('order:place', {
        coin: st.coin, isBuy, orderType: 'market', usd, leverage, isCross, tp: null, sl: null,
      });
      toast(describeFill(res));
      refreshAccount().catch(() => {});
      closeMenu();
    } catch (err) {
      toast(err.message, { type: 'error' });
      st.busy = null;
      if (menu?.pop === pop) render();
    }
  }

  function onPreset(e, isBuy, usd) {
    if (!e.isTrusted || st.busy) return;
    const key = `${isBuy}:${usd}`;
    clearTimeout(st.timer);
    if (st.armed !== key) {
      st.armed = key;
      st.timer = setTimeout(() => {
        st.armed = null;
        if (menu?.pop === pop) render();
      }, CONFIRM_MS);
      render();
      return;
    }
    st.armed = null;
    place(isBuy, usd);
  }

  function presetButton(isBuy, usd) {
    const key = `${isBuy}:${usd}`;
    const side = isBuy ? 'long' : 'short';
    let label = `${isBuy ? 'Long' : 'Short'} $${usd}`;
    if (st.armed === key) label = 'Confirm';
    return h('button', {
      class: `qbtn ${side}${st.armed === key ? ' armed' : ''}`,
      disabled: !!st.busy,
      onclick: (e) => onPreset(e, isBuy, usd),
    }, st.busy === key ? spinner(16) : label);
  }

  function render() {
    const coin = st.coin;
    const m = marketFor(coin);
    const chg = change24h(m);
    const pos = positionFor(coin);
    const parts = [];
    if (coins.length > 1) {
      parts.push(h('div', { class: 'mn-coins' }, coins.map((c) => h('button', {
        class: `mn-coin${c === coin ? ' on' : ''}`,
        onclick: () => {
          st.coin = c;
          st.armed = null;
          render();
        },
      }, `$${c}`))));
    }
    parts.push(h('div', { class: 'mn-head' },
      h('span', { class: 'mn-sym' }, `$${coin}`),
      h('span', { class: 'mn-px' }, `$${fmtPx(midOf(m))}`, h('small', { class: trend(chg) }, fmtPct(chg)))));

    if (!isConnected()) {
      parts.push(
        h('p', { class: 'mn-text' }, 'Connect your Hyperliquid account to trade in one tap.'),
        h('button', {
          class: 'mn-item',
          onclick: (e) => {
            if (!e.isTrusted) return;
            closeMenu();
            openConnect();
          },
        }, 'Connect Hyperliquid', icon(ICONS.chevron, { size: 18 })),
      );
    } else {
      const { leverage, isCross } = presetTerms(coin);
      parts.push(
        h('div', { class: 'mn-sub' }, `Market order · ${leverage}x ${isCross ? 'Cross' : 'Isolated'} · tap twice to confirm`),
        h('div', { class: 'mn-grid' },
          PRESETS.map((usd) => presetButton(true, usd)),
          PRESETS.map((usd) => presetButton(false, usd))),
      );
      if (pos) {
        const long = pos.szi > 0;
        parts.push(h('div', { class: 'mn-pos' },
          h('span', null, h('span', { class: `side-tag ${long ? 'long' : 'short'}` }, long ? 'Long' : 'Short'),
            ` ${fmtSize(Math.abs(pos.szi), m?.szDecimals ?? 4)} ${coin}`),
          h('b', { class: trend(pos.unrealizedPnl) }, fmtUsd(pos.unrealizedPnl, { sign: true }))));
      }
      parts.push(h('button', {
        class: 'mn-item',
        onclick: () => {
          closeMenu();
          openTrade({ coin, side: 'long' });
        },
      }, 'Open trade sheet', icon(ICONS.chevron, { size: 18 })));
    }
    pop.panel.replaceChildren(h('div', { class: 'mn' }, parts));
    pop.place();
  }

  // Close on outside click, Escape or scroll, like X's own menus.
  const onDown = (e) => {
    if (e.target !== pop.host && e.target !== button.getRootNode().host) closeMenu();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') closeMenu();
  };
  const onScroll = () => closeMenu();
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, { passive: true });
  menu = {
    pop,
    button,
    cleanup() {
      clearTimeout(st.timer);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll);
    },
  };
  button.setAttribute('aria-expanded', 'true');
  render();
}

function buildButton(coins) {
  const { host, root } = createHost('tradebtn');
  host.dataset.coins = coins.join(',');
  const button = h('button', {
    class: 'act',
    title: 'Trade on Hyperliquid',
    'aria-label': `Trade ${coins.map((c) => `$${c}`).join(', ')} on Hyperliquid`,
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
  }, icon(ICONS.trade, { size: 18 }), h('span', null, 'Trade'));
  button.addEventListener('click', (e) => {
    if (e.isTrusted) openMenu(button, coins);
  });
  root.append(button);
  return host;
}

export function syncTradeButton(article, coins, enabled) {
  const bar = enabled && coins.length ? actionBarOf(article) : null;
  const existing = article.querySelector('tt-root[data-kind="tradebtn"]');
  if (!bar) {
    existing?.remove();
    return;
  }
  const key = coins.join(',');
  if (existing && existing.parentElement === bar && existing.dataset.coins === key) return;
  existing?.remove();
  bar.append(buildButton(coins));
}
