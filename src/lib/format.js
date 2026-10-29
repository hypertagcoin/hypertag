// Display formatting shared by the content script and popup.

const pxFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const ok = (n) => n != null && Number.isFinite(n);

export const midOf = (m) => m?.midPx ?? m?.markPx ?? null;

export function change24h(m) {
  const mid = midOf(m);
  return ok(mid) && m?.prevDayPx ? (mid - m.prevDayPx) / m.prevDayPx : null;
}

export function fmtPx(n) {
  return ok(n) ? pxFormat.format(n) : '—';
}

export function fmtUsd(n, { sign = false, decimals = 2 } = {}) {
  if (!ok(n)) return '—';
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const prefix = n < 0 && Math.abs(n) >= 0.5 * 10 ** -decimals ? '-' : sign && n > 0 ? '+' : '';
  return `${prefix}$${body}`;
}

export function fmtCompactUsd(n) {
  return ok(n) ? `$${compactFormat.format(n)}` : '—';
}

export function fmtPct(n, { sign = true, decimals = 2 } = {}) {
  if (!ok(n)) return '—';
  return `${sign && n > 0 ? '+' : ''}${(n * 100).toFixed(decimals)}%`;
}

export function fmtSize(n, decimals) {
  return ok(n) ? n.toLocaleString('en-US', { maximumFractionDigits: decimals }) : '—';
}

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export const trend = (n) => (ok(n) && n !== 0 ? (n > 0 ? 'up' : 'down') : 'flat');
