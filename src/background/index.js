// Service worker: owns the agent key, signs everything, talks to Hyperliquid.
// Content scripts and the popup only send it high-level requests.
import {
  APP_URLS, addressFromKey, buildApproveAgent, newAgentKey, recoverTypedDataSigner, splitSignature,
} from '../lib/hyperliquid.js';
import {
  closePosition, exchange, getAccount, getAssetData, getMarkets, info, invalidate, placeOrder,
} from './hl.js';
import * as store from './store.js';

const AGENT_NAME = 'Hypertag';
const X_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.x.com', 'mobile.twitter.com']);
const EXTENSION_ONLY = new Set(['key:import', 'disconnect', 'settings:set', 'ui:requestConnect']);
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function senderKind(sender) {
  if (sender.id !== chrome.runtime.id) return null;
  const url = sender.url || sender.tab?.url || '';
  if (url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) return 'extension';
  try {
    if (X_HOSTS.has(new URL(url).hostname)) return 'x';
  } catch {}
  return null;
}

async function active() {
  const settings = await store.getSettings();
  const conn = await store.getConnection(settings.network);
  return { settings, network: settings.network, conn };
}

async function requireConn() {
  const ctx = await active();
  if (!ctx.conn) throw new Error('Connect your Hyperliquid account first.');
  return ctx;
}

async function publicState() {
  const { settings, network, conn } = await active();
  return {
    settings,
    network,
    appUrl: APP_URLS[network],
    connected: await store.connectedNetworks(),
    connection: conn && {
      user: conn.user, agentAddress: conn.agentAddress, method: conn.method, createdAt: conn.createdAt,
    },
  };
}

async function broadcast() {
  const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
  for (const tab of tabs) chrome.tabs.sendMessage(tab.id, { type: 'tt:state-changed' }).catch(() => {});
}

const handlers = {
  'state:get': () => publicState(),

  'markets:get': async () => getMarkets((await store.getSettings()).network),

  'account:get': async () => {
    const { network, conn } = await active();
    return conn ? getAccount(network, conn.user) : null;
  },

  'asset:get': async ({ coin }) => {
    const { network, conn } = await active();
    return conn ? getAssetData(network, conn.user, String(coin)) : null;
  },

  // Step 1 of the wallet flow: mint a fresh agent key and hand back the
  // EIP-712 payload for the user's wallet to sign. The key never leaves here.
  'connect:prepare': async ({ user, chainId }) => {
    if (!ADDRESS_RE.test(user || '')) throw new Error('Wallet returned an invalid address');
    const chainHex = typeof chainId === 'number' ? `0x${chainId.toString(16)}` : String(chainId || '').toLowerCase();
    if (!/^0x[0-9a-f]+$/.test(chainHex)) throw new Error('Wallet returned an invalid chain id');
    const { network } = await active();
    const agent = newAgentKey();
    const { action, typedData } = buildApproveAgent({
      agentAddress: agent.address,
      agentName: AGENT_NAME,
      nonce: Date.now(),
      isMainnet: network === 'mainnet',
      signatureChainId: chainHex,
    });
    await store.setPending({
      network, user, agentKey: agent.privateKey, agentAddress: agent.address, action, typedData, createdAt: Date.now(),
    });
    return { typedData, network };
  },

  // Step 2: submit the signed approveAgent. The account we store is whoever
  // actually signed, recovered from the signature — not what the page claimed.
  'connect:finish': async ({ signature }) => {
    const pending = await store.takePending();
    if (!pending || Date.now() - pending.createdAt > 10 * 60 * 1000) throw new Error('Connection request expired. Please try again.');
    if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error('Wallet returned an invalid signature');
    const signer = await recoverTypedDataSigner(pending.typedData, signature);
    await exchange(pending.network, pending.action, pending.action.nonce, splitSignature(signature));
    await store.saveConnection(pending.network, {
      user: signer,
      agentKey: pending.agentKey,
      agentAddress: pending.agentAddress,
      agentName: AGENT_NAME,
      method: 'wallet',
      createdAt: Date.now(),
    });
    invalidate('account:');
    broadcast();
    return publicState();
  },

  // Alternative: paste an API wallet key created at app.hyperliquid.xyz/API.
  'key:import': async ({ privateKey, user }) => {
    let key = String(privateKey || '').trim();
    if (!key.startsWith('0x')) key = `0x${key}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('That is not a valid private key (expected 64 hex characters).');
    const { network } = await active();
    const agentAddress = addressFromKey(key);
    const role = await info(network, { type: 'userRole', user: agentAddress });
    if (['user', 'vault', 'subAccount'].includes(role?.role)) {
      throw new Error('This is a main wallet key. For safety, create an API wallet on Hyperliquid and paste that key instead.');
    }
    if (role?.role !== 'agent') throw new Error(`This key is not an approved API wallet on ${network}.`);
    let master = role?.data?.user;
    if (!ADDRESS_RE.test(master || '')) {
      if (!ADDRESS_RE.test(String(user || '').trim())) throw new Error('Enter the account address this API wallet trades for.');
      master = String(user).trim();
    }
    await store.saveConnection(network, {
      user: master, agentKey: key, agentAddress, agentName: null, method: 'import', createdAt: Date.now(),
    });
    invalidate('account:');
    broadcast();
    return publicState();
  },

  disconnect: async () => {
    const { network } = await active();
    await store.removeConnection(network);
    invalidate('account:');
    broadcast();
    return publicState();
  },

  'order:place': async (p) => {
    const { network, conn, settings } = await requireConn();
    return placeOrder(network, conn, settings, p);
  },

  'position:close': async ({ coin }) => {
    const { network, conn, settings } = await requireConn();
    return closePosition(network, conn, settings, String(coin));
  },

  'settings:set': async (patch) => {
    const before = await store.getSettings();
    const after = await store.updateSettings(patch);
    if (before.network !== after.network) invalidate('');
    broadcast();
    return publicState();
  },

  'ui:openPopup': async () => {
    try {
      await chrome.action.openPopup();
    } catch {
      await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    }
  },

  // Popup → "connect with wallet" when no x.com tab is focused: remember the
  // request so the next x.com page load opens the connect dialog.
  'ui:requestConnect': async () => {
    await chrome.storage.session.set({ connectRequestedAt: Date.now() });
  },

  'ui:consumeConnect': async () => {
    const { connectRequestedAt } = await chrome.storage.session.get('connectRequestedAt');
    await chrome.storage.session.remove('connectRequestedAt');
    return !!connectRequestedAt && Date.now() - connectRequestedAt < 2 * 60 * 1000;
  },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = msg && Object.hasOwn(handlers, msg.type) ? handlers[msg.type] : null;
  if (!handler) return false;
  const kind = senderKind(sender);
  if (!kind || (EXTENSION_ONLY.has(msg.type) && kind !== 'extension')) {
    sendResponse({ ok: false, error: 'Not allowed' });
    return false;
  }
  Promise.resolve()
    .then(() => handler(msg.payload || {}))
    .then(
      (result) => sendResponse({ ok: true, result }),
      (err) => sendResponse({ ok: false, error: err?.message || String(err) }),
    );
  return true;
});
