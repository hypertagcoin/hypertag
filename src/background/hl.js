// Hyperliquid REST client, market/account snapshots and order placement.
import {
  API_URLS, orderAction, orderWire, signL1Action, updateLeverageAction,
} from '../lib/hyperliquid.js';
import { MIN_ORDER_USD, floatToWire, roundPrice, roundSize, slippagePrice } from '../lib/math.js';

const TRIGGER_SLIPPAGE = 0.1; // limit bound for market TP/SL once triggered
const num = (v) => (v == null || v === '' ? null : Number(v));

async function post(network, path, body) {
  const res = await fetch(API_URLS[network] + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(typeof data === 'string' && data ? data : `Hyperliquid API error (${res.status})`);
  return data;
}

export const info = (network, body) => post(network, '/info', body);

const FRIENDLY_ERRORS = [
  [/User or API Wallet .* does not exist/i, 'Your trading key is not approved on Hyperliquid. Reconnect from the extension popup.'],
  [/Must deposit before performing actions/i, 'Deposit USDC to Hyperliquid before trading.'],
];
function friendly(message) {
  for (const [re, text] of FRIENDLY_ERRORS) if (re.test(message)) return text;
  return message;
}

export async function exchange(network, action, nonce, signature) {
  const data = await post(network, '/exchange', { action, nonce, signature, vaultAddress: null });
  if (data?.status !== 'ok') {
    const msg = typeof data?.response === 'string' ? data.response : JSON.stringify(data);
    throw new Error(friendly(msg));
  }
  return data.response;
}

// Nonces must be unique per signer; keep them strictly increasing.
let lastNonce = 0;
function nextNonce() {
  lastNonce = Math.max(Date.now(), lastNonce + 1);
  return lastNonce;
}

async function sendL1(conn, network, action) {
  const nonce = nextNonce();
  const signature = await signL1Action({
    privateKey: conn.agentKey, action, nonce, isMainnet: network === 'mainnet',
  });
  return exchange(network, action, nonce, signature);
}

// ---- cached snapshots ----------------------------------------------------

const cache = new Map();
function cached(key, ttlMs, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise;
  const promise = load().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}
export const invalidate = (prefix) => {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
};

export function getMarkets(network) {
  return cached(`markets:${network}`, 2500, async () => {
    const [meta, ctxs] = await info(network, { type: 'metaAndAssetCtxs' });
    const markets = meta.universe.map((u, index) => {
      const c = ctxs[index] || {};
      return {
        name: u.name,
        index,
        szDecimals: u.szDecimals,
        maxLeverage: u.maxLeverage,
        onlyIsolated: !!u.onlyIsolated || u.marginMode === 'strictIsolated' || u.marginMode === 'noCross',
        delisted: !!u.isDelisted,
        markPx: num(c.markPx),
        midPx: num(c.midPx),
        prevDayPx: num(c.prevDayPx),
        funding: num(c.funding),
        openInterest: num(c.openInterest),
        dayNtlVlm: num(c.dayNtlVlm),
      };
    });
    return { network, at: Date.now(), markets };
  });
}

export function getAccount(network, user) {
  return cached(`account:${network}:${user}`, 2000, async () => {
    const [ch, spot, abstraction] = await Promise.all([
      info(network, { type: 'clearinghouseState', user }),
      info(network, { type: 'spotClearinghouseState', user }).catch(() => null),
      info(network, { type: 'userAbstraction', user }).catch(() => null),
    ]);
    const positions = (ch.assetPositions || [])
      .map((ap) => ap.position)
      .filter((p) => Number(p.szi) !== 0)
      .map((p) => ({
        coin: p.coin,
        szi: Number(p.szi),
        entryPx: num(p.entryPx),
        positionValue: num(p.positionValue),
        unrealizedPnl: num(p.unrealizedPnl),
        returnOnEquity: num(p.returnOnEquity),
        liquidationPx: num(p.liquidationPx),
        leverage: p.leverage,
        marginUsed: num(p.marginUsed),
      }));
    const usdc = spot?.balances?.find((b) => b.coin === 'USDC');
    const usdcTotal = usdc ? Number(usdc.total) : 0;
    const usdcFree = usdc ? Math.max(0, usdcTotal - Number(usdc.hold || 0)) : 0;
    // Unified / portfolio-margin accounts keep collateral as spot USDC: margin in
    // use is a hold on it, and the perps-only figures read ~0. Hyperliquid's own
    // "Account Value" for these accounts equals the spot USDC balance.
    const unified = abstraction === 'unifiedAccount' || abstraction === 'portfolioMargin';
    return {
      user,
      at: Date.now(),
      unified,
      accountValue: unified ? usdcTotal : num(ch.marginSummary?.accountValue) ?? 0,
      totalMarginUsed: num(ch.marginSummary?.totalMarginUsed) ?? 0,
      totalNtlPos: num(ch.marginSummary?.totalNtlPos) ?? 0,
      withdrawable: unified ? usdcFree : num(ch.withdrawable) ?? 0,
      spotUsdc: usdcFree,
      unrealizedPnl: positions.reduce((s, p) => s + (p.unrealizedPnl || 0), 0),
      positions,
    };
  });
}

/** Last 24h of 15-minute closes, for the hover card's mini chart. */
export function getCandles(network, coin) {
  return cached(`candles:${network}:${coin}`, 60_000, async () => {
    const endTime = Date.now();
    const rows = await info(network, {
      type: 'candleSnapshot',
      req: { coin, interval: '15m', startTime: endTime - 24 * 3600_000, endTime },
    });
    return (rows || []).map((r) => ({ t: r.t, c: Number(r.c) }));
  });
}

export async function getAssetData(network, user, coin) {
  const d = await info(network, { type: 'activeAssetData', user, coin });
  return {
    coin,
    leverage: d.leverage, // { type: 'cross' | 'isolated', value }
    availableToTrade: (d.availableToTrade || []).map(Number), // [long, short] in USDC
    maxTradeSzs: (d.maxTradeSzs || []).map(Number),
  };
}

// ---- trading -------------------------------------------------------------

function parseStatus(response) {
  const statuses = response?.data?.statuses || [];
  const first = statuses[0];
  if (!first) return { status: 'ok' };
  if (typeof first === 'object' && first.error) throw new Error(friendly(first.error));
  if (first.filled) return { status: 'filled', totalSz: Number(first.filled.totalSz), avgPx: Number(first.filled.avgPx), oid: first.filled.oid };
  if (first.resting) return { status: 'resting', oid: first.resting.oid };
  return { status: typeof first === 'string' ? first : 'ok' };
}

async function findMarket(network, coin) {
  const { markets } = await getMarkets(network);
  const m = markets.find((x) => x.name === coin);
  if (!m) throw new Error(`${coin} is not listed on Hyperliquid`);
  if (m.delisted) throw new Error(`${coin} is delisted`);
  return m;
}

/**
 * @param {object} p
 * @param {string} p.coin
 * @param {boolean} p.isBuy
 * @param {'market'|'limit'} p.orderType
 * @param {number} p.usd notional in USD
 * @param {number} [p.limitPx]
 * @param {number} p.leverage
 * @param {boolean} p.isCross
 * @param {number} [p.tp] take-profit trigger price
 * @param {number} [p.sl] stop-loss trigger price
 */
export async function placeOrder(network, conn, settings, p) {
  invalidate(`markets:${network}`);
  const m = await findMarket(network, p.coin);
  const mid = m.midPx ?? m.markPx;
  if (!mid) throw new Error('No price available for this market');

  const isMarket = p.orderType !== 'limit';
  const px = isMarket ? slippagePrice(mid, p.isBuy, settings.slippage, m.szDecimals) : roundPrice(Number(p.limitPx), m.szDecimals);
  const refPx = isMarket ? mid : px;
  const sz = roundSize(Number(p.usd) / refPx, m.szDecimals);
  if (!(sz > 0)) throw new Error('Order size is too small');
  if (sz * refPx < MIN_ORDER_USD) throw new Error(`Minimum order value is $${MIN_ORDER_USD}`);

  const leverage = Math.round(Number(p.leverage));
  if (!(leverage >= 1 && leverage <= m.maxLeverage)) throw new Error(`Leverage must be between 1x and ${m.maxLeverage}x`);
  const isCross = m.onlyIsolated ? false : !!p.isCross;

  const current = await getAssetData(network, conn.user, m.name).catch(() => null);
  if (!current || current.leverage?.value !== leverage || (current.leverage?.type === 'cross') !== isCross) {
    await sendL1(conn, network, updateLeverageAction({ asset: m.index, isCross, leverage }));
  }

  const orders = [orderWire({
    asset: m.index, isBuy: p.isBuy, px, sz, orderType: { limit: { tif: isMarket ? 'Ioc' : 'Gtc' } },
  })];
  for (const [kind, raw] of [['tp', p.tp], ['sl', p.sl]]) {
    if (!raw) continue;
    const trigger = roundPrice(Number(raw), m.szDecimals);
    const mustBeAbove = p.isBuy === (kind === 'tp');
    if (mustBeAbove ? trigger <= refPx : trigger >= refPx) {
      throw new Error(`${kind === 'tp' ? 'Take profit' : 'Stop loss'} must be ${mustBeAbove ? 'above' : 'below'} the entry price`);
    }
    orders.push(orderWire({
      asset: m.index,
      isBuy: !p.isBuy,
      px: slippagePrice(trigger, !p.isBuy, TRIGGER_SLIPPAGE, m.szDecimals),
      sz,
      reduceOnly: true,
      orderType: { trigger: { isMarket: true, triggerPx: trigger, tpsl: kind } },
    }));
  }

  const response = await sendL1(conn, network, orderAction(orders, orders.length > 1 ? 'normalTpsl' : 'na'));
  invalidate(`account:${network}`);
  return { coin: m.name, isBuy: p.isBuy, sz, px, ...parseStatus(response) };
}

export async function closePosition(network, conn, settings, coin) {
  invalidate(`account:${network}`);
  invalidate(`markets:${network}`);
  const [account, m] = await Promise.all([getAccount(network, conn.user), findMarket(network, coin)]);
  const pos = account.positions.find((x) => x.coin === coin);
  if (!pos) throw new Error(`No open ${coin} position`);
  const isBuy = pos.szi < 0;
  const mid = m.midPx ?? m.markPx;
  const action = orderAction([orderWire({
    asset: m.index,
    isBuy,
    px: slippagePrice(mid, isBuy, settings.slippage, m.szDecimals),
    sz: Number(floatToWire(Math.abs(pos.szi))),
    reduceOnly: true,
    orderType: { limit: { tif: 'Ioc' } },
  })]);
  const response = await sendL1(conn, network, action);
  invalidate(`account:${network}`);
  return { coin, isBuy, ...parseStatus(response) };
}
