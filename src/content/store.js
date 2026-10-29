// Shared client-side state for the content script: extension state, market
// snapshot and the connected account. Polls only while the tab is visible.
import { STALE_MESSAGE, extensionAlive, rpc } from '../lib/rpc.js';

function createStore(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const fn of subs) fn(value);
    },
    sub(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export const appState = createStore(null);
export const markets = createStore({ network: null, list: [], byName: new Map(), bySymbol: new Map() });
export const account = createStore(null);

export const marketFor = (coin) => markets.get().byName.get(coin) || null;
export const resolveSymbol = (sym) => markets.get().bySymbol.get(sym.toUpperCase()) || null;
export const positionFor = (coin) => account.get()?.positions?.find((p) => p.coin === coin) || null;
export const isConnected = () => !!appState.get()?.connection;

function indexMarkets({ network, markets: list }) {
  const byName = new Map();
  const bySymbol = new Map();
  for (const m of list) {
    byName.set(m.name, m);
    if (m.delisted) continue;
    // kPEPE, kBONK… trade 1000 tokens per contract; $PEPE on X should map to kPEPE.
    const k = /^k([A-Z0-9]+)$/.exec(m.name);
    if (k && !bySymbol.has(k[1])) bySymbol.set(k[1], m);
  }
  for (const m of list) if (!m.delisted) bySymbol.set(m.name.toUpperCase(), m);
  return { network, list, byName, bySymbol };
}

export async function refreshMarkets() {
  markets.set(indexMarkets(await rpc('markets:get')));
}

export async function refreshAccount() {
  if (!isConnected()) {
    if (account.get()) account.set(null);
    return;
  }
  account.set(await rpc('account:get'));
}

export async function refreshState() {
  const prevNetwork = appState.get()?.network;
  appState.set(await rpc('state:get'));
  if (prevNetwork && prevNetwork !== appState.get().network) {
    account.set(null);
    await refreshMarkets().catch(() => {});
  }
  await refreshAccount().catch(() => {});
}

const timers = [];
function every(ms, fn) {
  timers.push(setInterval(async () => {
    if (!extensionAlive()) {
      timers.forEach(clearInterval);
      return;
    }
    if (document.visibilityState !== 'visible') return;
    try {
      await fn();
    } catch (err) {
      if (err.message === STALE_MESSAGE) timers.forEach(clearInterval);
    }
  }, ms));
}

export function startPolling() {
  refreshState().catch(() => {});
  refreshMarkets().catch(() => {});
  every(3000, refreshMarkets);
  every(5000, refreshAccount);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && extensionAlive()) {
      refreshMarkets().catch(() => {});
      refreshAccount().catch(() => {});
    }
  });
}
