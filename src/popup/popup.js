// Extension popup: connection, account overview, positions and defaults.
// The only place an API wallet private key can be typed — never on x.com.
import { fmtPct, fmtPx, fmtSize, fmtUsd, shortAddr, trend } from '../lib/format.js';
import { ICONS, h, icon, spinner } from '../lib/h.js';
import { rpc } from '../lib/rpc.js';

const app = document.getElementById('app');
const netSeg = document.getElementById('network');
const X_TAB_RE = /^https:\/\/(mobile\.)?(x|twitter)\.com\//;

let state = null;
let acct = null;
let markets = new Map();
const armed = new Map();
const closing = new Set();

async function applyTheme() {
  let theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  let accent = '';
  try {
    const { xTheme } = await chrome.storage.local.get('xTheme');
    if (xTheme?.theme) theme = xTheme.theme;
    if (xTheme?.accent) accent = xTheme.accent;
  } catch {}
  document.documentElement.dataset.theme = theme;
  if (accent) document.documentElement.style.setProperty('--accent', accent);
}

function field({ label, type = 'text', value = '', suffix, placeholder, inputmode, autocomplete = 'off' }) {
  const input = h('input', { type, value: String(value), placeholder, inputmode, autocomplete, spellcheck: 'false' });
  const el = h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input,
    suffix && h('span', { class: 'field-suffix' }, suffix));
  return { el, input };
}

function toggle(label, checked, onChange) {
  const input = h('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'toggle-row' }, h('span', null, label), h('span', { class: 'switch' }, input, h('span')));
}

// ---------- views ----------

function disconnectedView() {
  const keyField = field({ label: 'API wallet private key', type: 'password', autocomplete: 'off' });
  const userField = field({ label: 'Account address (optional)', placeholder: '0x…' });
  const msg = h('div', { class: 'form-msg error' });
  const importBtn = h('button', { class: 'btn-outline block big' }, 'Import key');
  importBtn.addEventListener('click', async () => {
    msg.textContent = '';
    importBtn.disabled = true;
    importBtn.replaceChildren(spinner(18));
    try {
      state = await rpc('key:import', { privateKey: keyField.input.value, user: userField.input.value });
      keyField.input.value = '';
      await refreshAccount();
      render();
    } catch (err) {
      msg.textContent = err.message;
      importBtn.disabled = false;
      importBtn.replaceChildren('Import key');
    }
  });

  return [
    h('section', { class: 'pad hero' },
      h('h1', null, 'Trade from your timeline'),
      h('p', null, 'Long or short any $cashtag on X with your Hyperliquid account.'),
      h('button', { class: 'btn-contrast block big', onclick: connectWithWallet }, 'Connect with browser wallet'),
      h('p', { class: 'fine' }, 'Opens on x.com, where your wallet signs a one-time approval for a trading-only key.')),
    h('div', { class: 'divider' }, 'or'),
    h('section', { class: 'pad' },
      h('h2', { class: 'section-title' }, 'Import an API wallet'),
      h('p', { class: 'fine' },
        'Create one at ', h('a', { href: `${state.appUrl}/API`, target: '_blank', rel: 'noopener noreferrer' }, 'app.hyperliquid.xyz/API'),
        ', then paste its private key. API wallets can trade but cannot withdraw.'),
      keyField.el, userField.el, importBtn, msg),
  ];
}

function positionRow(p) {
  const long = p.szi > 0;
  const m = markets.get(p.coin);
  const busy = closing.has(p.coin);
  const btn = h('button', { class: `btn-outline small${armed.has(p.coin) ? ' btn-danger' : ''}`, disabled: busy },
    busy ? spinner(16) : armed.has(p.coin) ? 'Confirm' : 'Close');
  btn.addEventListener('click', () => closePosition(p.coin));
  return h('div', { class: 'pos' },
    h('div', { class: 'pos-main' },
      h('div', { class: 'pos-top' }, p.coin,
        h('span', { class: `side-tag ${long ? 'long' : 'short'}` }, `${long ? 'Long' : 'Short'} ${p.leverage?.value ?? ''}x`)),
      h('div', { class: 'pos-sub' }, `${fmtSize(Math.abs(p.szi), m?.szDecimals ?? 4)} @ ${fmtPx(p.entryPx)}${p.liquidationPx ? ` · Liq ${fmtPx(p.liquidationPx)}` : ''}`)),
    h('div', { class: `pos-pnl ${trend(p.unrealizedPnl)}` },
      fmtUsd(p.unrealizedPnl, { sign: true }), h('small', null, fmtPct(p.returnOnEquity))),
    btn);
}

function connectedView() {
  const c = state.connection;
  const copyBtn = h('button', { class: 'copy', title: 'Copy address', 'aria-label': 'Copy address' }, icon(ICONS.copy, { size: 16 }));
  copyBtn.addEventListener('click', () => navigator.clipboard.writeText(c.user).catch(() => {}));

  const account = acct
    ? [
      h('div', { class: 'stat-label' }, 'Account value'),
      h('div', { class: 'stat-value' }, fmtUsd(acct.accountValue)),
      h('div', { class: 'stats' },
        h('span', null, 'PnL ', h('b', { class: trend(acct.unrealizedPnl) }, fmtUsd(acct.unrealizedPnl, { sign: true }))),
        h('span', null, 'Available ', h('b', null, fmtUsd(acct.withdrawable)))),
      !acct.unified && acct.accountValue <= 0 && acct.spotUsdc > 0
        && h('p', { class: 'note' }, `You have ${fmtUsd(acct.spotUsdc)} USDC in Spot. Transfer it to Perps on Hyperliquid to trade.`),
      acct.accountValue <= 0 && acct.spotUsdc <= 0
        && h('p', { class: 'note' }, 'Deposit USDC to Hyperliquid to start trading.'),
    ]
    : [h('div', { style: { padding: '16px 0' } }, spinner())];

  return [
    h('section', { class: 'pad' },
      h('div', { class: 'acct-top' },
        h('span', { class: 'addr' }, shortAddr(c.user)), copyBtn,
        h('span', { class: 'method' }, c.method === 'wallet' ? 'Wallet' : 'API key')),
      account),
    h('section', { class: 'sep' },
      h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Positions')),
      acct?.positions?.length
        ? acct.positions.map(positionRow)
        : h('p', { class: 'empty' }, acct ? 'No open positions.' : '')),
  ];
}

function settingsView() {
  const s = state.settings;
  const size = field({ label: 'Size', value: s.defaultUsd, suffix: '$', inputmode: 'decimal' });
  const lev = field({ label: 'Leverage', value: s.defaultLeverage, suffix: 'x', inputmode: 'numeric' });
  const slip = field({ label: 'Slippage', value: +(s.slippage * 100).toFixed(2), suffix: '%', inputmode: 'decimal' });
  const msg = h('div', { class: 'form-msg ok' });
  const save = async (patch) => {
    try {
      state = await rpc('settings:set', patch);
      msg.className = 'form-msg ok';
      msg.textContent = 'Saved';
      setTimeout(() => (msg.textContent = ''), 1200);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
    }
  };
  size.input.addEventListener('change', () => save({ defaultUsd: Number(size.input.value) }));
  lev.input.addEventListener('change', () => save({ defaultLeverage: Number(lev.input.value) }));
  slip.input.addEventListener('change', () => save({ slippage: Number(slip.input.value) / 100 }));

  return h('section', { class: 'pad sep' },
    h('h2', { class: 'section-title' }, 'Defaults'),
    h('div', { class: 'grid3' }, size.el, lev.el, slip.el),
    toggle('Show Long / Short on posts', s.showChips, (v) => save({ showChips: v })),
    toggle('Show account card in sidebar', s.showSidebar, (v) => save({ showSidebar: v })),
    toggle('Show Trade button on posts', s.showTradeButton, (v) => save({ showTradeButton: v })),
    toggle('Show price card when hovering a $cashtag', s.showHoverCard, (v) => save({ showHoverCard: v })),
    msg);
}

function footer() {
  const right = state.connection
    ? h('button', { class: 'btn-text-danger', onclick: disconnect }, 'Disconnect')
    : h('span');
  return h('footer', { class: 'foot' },
    h('a', { href: `${state.appUrl}/portfolio`, target: '_blank', rel: 'noopener noreferrer' }, 'Open Hyperliquid', icon(ICONS.external, { size: 16 })),
    right);
}

function render() {
  for (const b of netSeg.querySelectorAll('button')) b.classList.toggle('on', b.dataset.net === state.network);
  app.replaceChildren(
    ...(state.connection ? connectedView() : disconnectedView()),
    settingsView(),
    footer(),
  );
}

// ---------- actions ----------

async function connectWithWallet() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url && X_TAB_RE.test(tab.url)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'tt:open-connect' });
      window.close();
      return;
    } catch {
      // Content script not loaded yet in that tab (e.g. installed after it opened).
    }
  }
  await rpc('ui:requestConnect');
  if (tab?.url && X_TAB_RE.test(tab.url)) await chrome.tabs.reload(tab.id);
  else await chrome.tabs.create({ url: 'https://x.com/home' });
  window.close();
}

async function disconnect() {
  if (!confirm('Disconnect this account? The trading key is deleted from this browser. You can also revoke it at app.hyperliquid.xyz/API.')) return;
  state = await rpc('disconnect');
  acct = null;
  render();
}

async function closePosition(coin) {
  if (closing.has(coin)) return;
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
    await rpc('position:close', { coin });
  } catch (err) {
    alert(err.message);
  } finally {
    closing.delete(coin);
    await refreshAccount();
    render();
  }
}

async function refreshAccount() {
  acct = state.connection ? await rpc('account:get').catch(() => acct) : null;
}

async function loadMarkets() {
  try {
    const snap = await rpc('markets:get');
    markets = new Map(snap.markets.map((m) => [m.name, m]));
  } catch {}
}

netSeg.addEventListener('click', async (e) => {
  const net = e.target.closest('button')?.dataset.net;
  if (!net || net === state?.network) return;
  state = await rpc('settings:set', { network: net });
  acct = null;
  render();
  await Promise.all([refreshAccount(), loadMarkets()]);
  render();
});

async function init() {
  if (!chrome.extension?.getViews?.({ type: 'popup' })?.includes(window)) document.body.classList.add('tab-mode');
  await applyTheme();
  app.replaceChildren(h('div', { class: 'center' }, spinner(32)));
  state = await rpc('state:get');
  await Promise.all([refreshAccount(), loadMarkets()]);
  render();
  setInterval(async () => {
    if (!state.connection || document.activeElement?.tagName === 'INPUT') return;
    await refreshAccount();
    render();
  }, 5000);
}

init().catch((err) => {
  app.replaceChildren(h('p', { class: 'pad form-msg error' }, err.message));
});
