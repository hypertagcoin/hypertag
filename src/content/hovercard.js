// Hover a $CASHTAG link in a post to get an X-style card: price, 24h chart,
// funding / open interest / volume, your position and Long / Short buttons.
import {
  change24h, fmtCompactUsd, fmtPct, fmtPx, fmtSize, fmtUsd, midOf, trend,
} from '../lib/format.js';
import { rpc } from '../lib/rpc.js';
import { h, svgEl } from './dom.js';
import { openPopover } from './popover.js';
import { CASHTAG_LINK, marketForLink } from './posts.js';
import {
  account, appState, marketFor, markets, positionFor,
} from './store.js';
import { openTrade } from './trade.js';

const SHOW_DELAY = 350;
const HIDE_DELAY = 250;
const CHART_W = 268;
const CHART_H = 72;

let current = null; // { link, pop, unsubs }
let showTimer = 0;
let hideTimer = 0;

function hide() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  if (!current) return;
  current.unsubs.forEach((u) => u());
  current.pop.close();
  current = null;
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, HIDE_DELAY);
}

function drawChart(box, points) {
  if (points.length < 2) {
    box.replaceChildren('No chart data');
    return;
  }
  const closes = points.map((p) => p.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const xy = closes.map((c, i) => [
    (i / (closes.length - 1)) * CHART_W,
    4 + (1 - (c - min) / span) * (CHART_H - 8),
  ]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const color = closes[closes.length - 1] >= closes[0] ? 'var(--green)' : 'var(--red)';

  const svg = svgEl('svg', { viewBox: `0 0 ${CHART_W} ${CHART_H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const grad = svgEl('linearGradient', { id: 'hc-fill', x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(
    svgEl('stop', { offset: 0, 'stop-color': color, 'stop-opacity': 0.28 }),
    svgEl('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }),
  );
  const defs = svgEl('defs', {});
  defs.append(grad);
  svg.append(
    defs,
    svgEl('path', { d: `${line} L${CHART_W} ${CHART_H} L0 ${CHART_H} Z`, fill: 'url(#hc-fill)' }),
    svgEl('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }),
  );
  box.replaceChildren(svg);
}

function show(link, coin) {
  hide();
  const pop = openPopover({ kind: 'hovercard', anchor: link, width: 300 });
  const pxEl = h('div', { class: 'hc-px' });
  const chgEl = h('div', { class: 'hc-chg' });
  const chart = h('div', { class: 'hc-chart' }, 'Loading chart…');
  const fundingEl = h('b');
  const oiEl = h('b');
  const volEl = h('b');
  const posEl = h('div', { class: 'hc-pos', hidden: true });
  const trade = (side) => {
    hide();
    openTrade({ coin, side });
  };
  const m0 = marketFor(coin);

  pop.panel.append(h('div', { class: 'hc' },
    h('div', { class: 'hc-top' },
      h('div', null,
        h('div', { class: 'hc-sym' }, `$${coin}`),
        h('div', { class: 'hc-meta' }, `${coin}-USD · Perp · up to ${m0?.maxLeverage ?? '?'}x`)),
      h('div', { class: 'hc-price' }, pxEl, chgEl)),
    chart,
    h('div', { class: 'hc-stats' },
      h('div', null, 'Funding (1h)', fundingEl),
      h('div', null, 'Open interest', oiEl),
      h('div', null, '24h volume', volEl)),
    posEl,
    h('div', { class: 'hc-actions' },
      h('button', { class: 'hc-long', onclick: () => trade('long') }, 'Long'),
      h('button', { class: 'hc-short', onclick: () => trade('short') }, 'Short'))));

  const update = () => {
    const m = marketFor(coin) || m0;
    const mid = midOf(m);
    const chg = change24h(m);
    pxEl.textContent = `$${fmtPx(mid)}`;
    chgEl.textContent = `${fmtPct(chg)} 24h`;
    chgEl.className = `hc-chg ${trend(chg)}`;
    fundingEl.textContent = fmtPct(m?.funding, { decimals: 4 });
    oiEl.textContent = fmtCompactUsd((m?.openInterest || 0) * (mid || 0));
    volEl.textContent = fmtCompactUsd(m?.dayNtlVlm);
    const p = positionFor(coin);
    posEl.hidden = !p;
    if (p) {
      const long = p.szi > 0;
      posEl.replaceChildren(
        h('span', null, h('span', { class: `side-tag ${long ? 'long' : 'short'}` }, long ? 'Long' : 'Short'),
          ` ${fmtSize(Math.abs(p.szi), m?.szDecimals ?? 4)} ${coin}`),
        h('b', { class: trend(p.unrealizedPnl) }, `${fmtUsd(p.unrealizedPnl, { sign: true })} (${fmtPct(p.returnOnEquity)})`));
    }
    pop.place();
  };
  update();

  pop.host.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  pop.host.addEventListener('pointerleave', scheduleHide);
  current = { link, pop, unsubs: [markets.sub(update), account.sub(update)] };

  rpc('candles:get', { coin }).then((points) => {
    if (current?.pop === pop) drawChart(chart, points);
  }).catch((err) => {
    if (current?.pop === pop) chart.replaceChildren(err.message);
  });
}

export function startHoverCard() {
  document.addEventListener('pointerover', (e) => {
    const link = e.target instanceof Element ? e.target.closest(CASHTAG_LINK) : null;
    if (!link) return;
    if (current?.link === link) {
      clearTimeout(hideTimer);
      return;
    }
    if (appState.get()?.settings?.showHoverCard === false) return;
    const m = marketForLink(link);
    if (!m) return;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(link, m.name), SHOW_DELAY);
  });
  document.addEventListener('pointerout', (e) => {
    const link = e.target instanceof Element ? e.target.closest(CASHTAG_LINK) : null;
    if (!link || (e.relatedTarget instanceof Node && link.contains(e.relatedTarget))) return;
    clearTimeout(showTimer);
    if (current?.link === link) scheduleHide();
  });
  // Clicking the cashtag navigates to X search; scrolling moves the anchor away.
  document.addEventListener('click', (e) => {
    if (current && e.target instanceof Element && e.target.closest(CASHTAG_LINK) === current.link) hide();
  }, true);
  window.addEventListener('scroll', () => current && hide(), { passive: true });
}
