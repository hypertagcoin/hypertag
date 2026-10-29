// "Connect Hyperliquid" dialog. The extension mints a fresh API (agent) key,
// the user's wallet signs one approveAgent message, and from then on orders
// are signed locally by that key. It can trade but can never withdraw.
import { shortAddr } from '../lib/format.js';
import { rpc } from '../lib/rpc.js';
import { openDialog } from './dialog.js';
import { ICONS, h, icon, networkBadge, spinner } from './dom.js';
import { appState, refreshAccount } from './store.js';
import { listWallets, walletCall } from './wallet.js';

let current = null;

function avatar(name) {
  return h('span', { class: 'avatar', 'aria-hidden': 'true' }, (name || '?').trim().charAt(0).toUpperCase());
}

export function openConnect() {
  if (current && !current.closed) return;
  const network = appState.get()?.network || 'mainnet';
  const dlg = openDialog({ title: 'Connect Hyperliquid', width: 440 });
  current = dlg;
  const badge = networkBadge(network);
  if (badge) dlg.headExtra.append(badge);
  pick();

  async function pick() {
    const list = h('div', { class: 'wallets' }, spinner());
    dlg.body.replaceChildren(
      h('p', { class: 'lead' },
        'Approve a trading-only API wallet with your browser wallet. It can open and close positions, but it can never withdraw your funds.'),
      list,
      h('div', { class: 'divider' }, 'or'),
      h('button', { class: 'btn-outline block', onclick: () => rpc('ui:openPopup').catch(() => {}) },
        icon(ICONS.key, { size: 18 }), 'Import an API wallet key'),
      h('p', { class: 'fine' },
        `You'll sign one message on ${network === 'testnet' ? 'Hyperliquid Testnet' : 'Hyperliquid'}. No gas, no transaction.`),
    );
    let wallets = [];
    try {
      wallets = await listWallets();
    } catch {}
    if (dlg.closed) return;
    list.replaceChildren(...(wallets.length
      ? wallets.map(walletRow)
      : [h('p', { class: 'no-wallet' }, 'No browser wallet found. Install MetaMask, Rabby or another EVM wallet and reload this page, or import an API wallet key instead.')]));
  }

  function walletRow(w) {
    let img = avatar(w.name);
    if (w.icon) {
      img = h('img', { src: w.icon, alt: '', width: 40, height: 40 });
      img.addEventListener('error', () => img.replaceWith(avatar(w.name)), { once: true });
    }
    return h('button', {
      class: 'wallet-row',
      onclick: (e) => {
        if (e.isTrusted) connect(w);
      },
    }, img, h('span', { class: 'wallet-name' }, w.name), icon(ICONS.chevron, { size: 18 }));
  }

  async function connect(w) {
    const status = h('h3', null, `Opening ${w.name}…`);
    const detail = h('p', null, 'Check your wallet for a request.');
    dlg.body.replaceChildren(h('div', { class: 'center' }, spinner(40), status, detail));
    try {
      const accounts = await walletCall('eth_requestAccounts', [], w.id);
      const user = accounts?.[0];
      if (!user) throw new Error('No account was selected in your wallet.');
      const chainId = await walletCall('eth_chainId', [], w.id);
      const { typedData } = await rpc('connect:prepare', { user, chainId });
      status.textContent = 'Approve your trading key';
      detail.textContent = `Sign the "ApproveAgent" message in ${w.name} for ${shortAddr(user)}.`;
      const signature = await walletCall('eth_signTypedData_v4', [user, JSON.stringify(typedData)], w.id);
      status.textContent = 'Registering with Hyperliquid…';
      detail.textContent = 'Almost there.';
      const state = await rpc('connect:finish', { signature });
      if (dlg.closed) return;
      appState.set(state);
      refreshAccount().catch(() => {});
      done(state);
    } catch (err) {
      if (!dlg.closed) failed(err);
    }
  }

  function done(state) {
    dlg.body.replaceChildren(h('div', { class: 'center' },
      h('div', { class: 'done-mark' }, icon(ICONS.check, { size: 30, stroke: 3 })),
      h('h3', null, "You're connected"),
      h('p', null, `${shortAddr(state.connection?.user)} can now trade from your timeline. Look for Long / Short under any $cashtag.`),
      h('div', { class: 'actions' }, h('button', { class: 'btn-contrast big', onclick: () => dlg.close() }, 'Start trading'))));
  }

  function failed(err) {
    dlg.body.replaceChildren(h('div', { class: 'center' },
      h('div', { class: 'fail-mark' }, icon(ICONS.alert, { size: 28 })),
      h('h3', null, "Couldn't connect"),
      h('p', null, err?.message || 'Something went wrong.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn-contrast big', onclick: pick }, 'Try again'),
        h('button', { class: 'btn-outline big', onclick: () => dlg.close() }, 'Cancel'))));
  }
}
