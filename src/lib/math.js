// Pure number helpers shared by the background, content script and popup.
// They mirror the rounding rules of the official Hyperliquid Python SDK.

export const MIN_ORDER_USD = 10;
const MAX_PERP_DECIMALS = 6;

/** Serialize a number the way Hyperliquid hashes it: max 8 decimals, no trailing zeros. */
export function floatToWire(x) {
  const n = typeof x === 'string' ? Number(x) : x;
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${x}`);
  let s = n.toFixed(8);
  if (Math.abs(Number(s) - n) >= 1e-12) throw new Error(`Too many decimals: ${x}`);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}

/** Prices: 5 significant figures and at most (6 - szDecimals) decimals for perps. */
export function roundPrice(px, szDecimals, isSpot = false) {
  if (!(px > 0)) throw new Error('Price must be greater than 0');
  const maxDecimals = Math.max(0, (isSpot ? 8 : MAX_PERP_DECIMALS) - szDecimals);
  return Number(Number(px.toPrecision(5)).toFixed(maxDecimals));
}

/** Sizes are rounded down to the asset's szDecimals. */
export function roundSize(sz, szDecimals) {
  if (!(sz > 0)) return 0;
  const f = 10 ** szDecimals;
  return Number((Math.floor(sz * f + 1e-9) / f).toFixed(szDecimals));
}

/** Aggressive limit price used to emulate a market order (IOC). */
export function slippagePrice(mid, isBuy, slippage, szDecimals) {
  return roundPrice(mid * (isBuy ? 1 + slippage : 1 - slippage), szDecimals);
}
