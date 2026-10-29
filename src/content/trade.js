// The trade sheet opened from a tweet chip: Market/Limit tabs, Long/Short,
// USD size, leverage slider, optional TP/SL and the current position.
import { MIN_ORDER_USD, roundSize } from '../lib/math.js';
import { change24h, fmtCompactUsd, fmtPct, fmtPx, fmtSize, fmtUsd, midOf, trend } from '../lib/format.js';
import { rpc } from '../lib/rpc.js';
import { openConnect } from './connect.js';
import { openDialog } from './dialog.js';
import { ICONS, h, icon, networkBadge, spinner } from './dom.js';
import {
  account, appState, isConnected, marketFor, markets, positionFor, refreshAccount,
} from './store.js';
import { toast } from './toast.js';

const TAKER_FEE = 0.00045;
const MAKER_FEE = 0.00015;

const cleanNumber = (v) => v.replace(/,/g, '.').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

function field({ label, value = '', suffix, placeholder, onInput }) {
  const input = h('input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', value, placeholder,
  });
  input.addEventListener('input', () => {
    const v = cleanNumber(input.value);
    if (v !== input.value) input.value = v;
    onInput(v);
  });
  const el = h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input,
    suffix && h('span', { class: 'field-suffix' }, suffix));
  return {
    el,
    input,
    set(v) {
      input.value = v;
    },
    invalid(flag) {
      el.classList.toggle('invalid', !!flag);
    },
  };
}

export function describeFill(res) {
  const verb = res.isBuy ? 'Bought' : 'Sold';
  if (res.status === 'filled') return `${verb} ${res.totalSz} ${res.coin} at $${fmtPx(res.avgPx)}`;
  if (res.status === 'resting') return `Limit order placed: ${res.isBuy ? 'buy' : 'sell'} ${res.sz} ${res.coin} at $${fmtPx(res.px)}`;
  return `Order sent for ${res.coin}`;
}

export function openTrade({ coin, side = 'long' }) {
  const m0 = marketFor(coin);
  if (!m0) {
    toast(`${coin} isn't available on Hyperliquid`, { type: 'error' });
    return;
  }
  const settings = appState.get()?.settings || {};
  const pos0 = positionFor(coin);
  const clampLev = (v) => Math.max(1, Math.min(m0.maxLeverage, Math.round(v) || 1));

  const st = {
    side,
    type: 'market',
    usd: String(settings.defaultUsd ?? 50),
    limitPx: '',
    leverage: clampLev(pos0?.leverage?.value ?? settings.defaultLeverage ?? 5),
    cross: m0.onlyIsolated ? false : pos0 ? pos0.leverage?.type === 'cross' : true,
    tpsl: false,
    tp: '',
    sl: '',
    asset: null,
    submitting: false,
    serverError: '',
    closeArmed: false,
  };

  const dlg = openDialog({ title: 'Trade', width: 480, onClose: () => unsubs.forEach((u) => u()) });
  const badge = networkBadge(appState.get()?.network);
  if (badge) dlg.headExtra.append(badge);

  // --- tabs
  const tabMarket = h('button', { class: 'tab', onclick: () => set({ type: 'market' }) }, h('span', null, 'Market'));
  const tabLimit = h('button', {
    class: 'tab',
    onclick: () => {
      if (!st.limitPx) {
        const mid = midOf(marketFor(coin));
        if (mid) limitField.set(fmtPx(mid).replace(/,/g, ''));
        st.limitPx = limitField.input.value;
      }
      set({ type: 'limit' });
      limitField.input.focus();
    },
  }, h('span', null, 'Limit'));

  // --- market header
  const pxEl = h('div', { class: 'mkt-px' });
  const chgEl = h('div', { class: 'mkt-chg' });
  const subEl = h('div', { class: 'mkt-sub' });
  const header = h('div', { class: 'mkt' },
    h('div', null,
      h('div', { class: 'mkt-name' }, `${coin}-USD`, h('span', { class: 'tag' }, 'PERP'), h('span', { class: 'tag' }, `${m0.maxLeverage}x`)),
      subEl),
    h('div', { class: 'mkt-right' }, pxEl, chgEl));

  // --- side
  const longBtn = h('button', { class: 'seg long', onclick: () => set({ side: 'long' }) }, 'Long');
  const shortBtn = h('button', { class: 'seg short', onclick: () => set({ side: 'short' }) }, 'Short');

  // --- inputs
  const limitField = field({ label: 'Limit price', suffix: 'USD', onInput: (v) => set({ limitPx: v }) });
  const usdField = field({ label: 'Size', suffix: 'USD', value: st.usd, onInput: (v) => set({ usd: v }) });
  const quick = h('div', { class: 'quick' },
    [0.1, 0.25, 0.5, 1].map((pct) => h('button', { onclick: () => setPct(pct) }, pct === 1 ? 'Max' : `${pct * 100}%`)));
  const sizeCoin = h('span');
  const availEl = h('span');

  // --- leverage
  const levValue = h('span', { class: 'lev-value' });
  const slider = h('input', {
    type: 'range', min: '1', max: String(m0.maxLeverage), step: '1', value: String(st.leverage), 'aria-label': 'Leverage',
  });
  slider.addEventListener('input', () => set({ leverage: Number(slider.value) }));
  const tickValues = [...new Set([1, Math.round(m0.maxLeverage / 4), Math.round(m0.maxLeverage / 2), Math.round((m0.maxLeverage * 3) / 4), m0.maxLeverage])]
    .filter((v) => v >= 1);
  const ticks = h('div', { class: 'ticks' }, tickValues.map((v) => h('button', {
    onclick: () => {
      slider.value = String(v);
      set({ leverage: v });
    },
  }, `${v}x`)));
  const crossBtn = h('button', { onclick: () => set({ cross: true }), disabled: m0.onlyIsolated }, 'Cross');
  const isoBtn = h('button', { onclick: () => set({ cross: false }) }, 'Isolated');

  // --- TP / SL
  const tpslInput = h('input', { type: 'checkbox' });
  tpslInput.addEventListener('change', () => set({ tpsl: tpslInput.checked }));
  const tpField = field({ label: 'Take profit', suffix: 'USD', onInput: (v) => set({ tp: v }) });
  const slField = field({ label: 'Stop loss', suffix: 'USD', onInput: (v) => set({ sl: v }) });
  const tpslBox = h('div', { class: 'field-row' }, tpField.el, slField.el);

  // --- summary + submit
  const rowValue = h('b');
  const rowMargin = h('b');
  const rowFee = h('b');
  const rowSlip = h('b');
  const slipRow = h('div', { class: 'row' }, h('span', null, 'Max slippage'), rowSlip);
  const msg = h('div', { class: 'form-msg' });
  const submit = h('button', { class: 'submit', onclick: onSubmit });

  // --- position
  const posBox = h('div', { class: 'posbox', hidden: true });

  dlg.body.append(
    h('div', { class: 'tabs' }, tabMarket, tabLimit),
    header,
    h('div', { class: 'side' }, longBtn, shortBtn),
    limitField.el,
    usdField.el,
    h('div', { class: 'hint' }, sizeCoin, availEl),
    quick,
    h('div', { class: 'section' },
      h('div', { class: 'section-head' },
        h('span', { class: 'section-title' }, 'Leverage'),
        h('div', { class: 'section-tools' }, h('div', { class: 'mini-seg' }, crossBtn, isoBtn), levValue)),
      h('div', { class: 'range' }, slider, ticks)),
    h('label', { class: 'check' }, tpslInput, h('span', { class: 'check-box' }, icon(ICONS.check, { size: 14, stroke: 3 })), 'Take profit / Stop loss'),
    tpslBox,
    h('div', { class: 'rows' },
      h('div', { class: 'row' }, h('span', null, 'Order value'), rowValue),
      h('div', { class: 'row' }, h('span', null, 'Margin required'), rowMargin),
      h('div', { class: 'row' }, h('span', null, 'Est. fee'), rowFee),
      slipRow),
    msg,
    submit,
    posBox,
  );

  const unsubs = [markets.sub(update), account.sub(update), appState.sub(update)];
  if (isConnected()) {
    rpc('asset:get', { coin }).then((a) => {
      st.asset = a;
      if (!dlg.closed) update();
    }).catch(() => {});
  }
  update();
  dlg.focus(usdField.input);
  usdField.input.select();

  function set(patch) {
    Object.assign(st, patch, { serverError: '' });
    update();
  }

  function available() {
    const a = st.asset?.availableToTrade;
    if (a?.length === 2) return a[st.side === 'long' ? 0 : 1];
    const acct = account.get();
    return acct ? acct.withdrawable : null;
  }

  function setPct(pct) {
    const avail = available();
    if (!(avail > 0)) {
      toast(isConnected() ? 'No margin available. Deposit USDC on Hyperliquid first.' : 'Connect your account to size by balance.');
      return;
    }
    const usd = Math.floor(avail * st.leverage * pct * (pct === 1 ? 0.98 : 1) * 100) / 100;
    usdField.set(String(usd));
    set({ usd: String(usd) });
  }

  function validate(m, refPx, sz) {
    const usd = Number(st.usd);
    if (st.type === 'limit' && !(Number(st.limitPx) > 0)) return { field: 'limit', text: 'Enter a limit price' };
    if (!(usd > 0)) return { field: 'usd', text: 'Enter an order size' };
    if (!(sz > 0) || sz * refPx < MIN_ORDER_USD) return { field: 'usd', text: `Minimum order value is $${MIN_ORDER_USD}` };
    if (st.tpsl) {
      const long = st.side === 'long';
      const tp = Number(st.tp);
      const sl = Number(st.sl);
      if (!tp && !sl) return { field: 'tp', text: 'Enter a take-profit or stop-loss price' };
      if (tp && (long ? tp <= refPx : tp >= refPx)) return { field: 'tp', text: `Take profit must be ${long ? 'above' : 'below'} ${fmtPx(refPx)}` };
      if (sl && (long ? sl >= refPx : sl <= refPx)) return { field: 'sl', text: `Stop loss must be ${long ? 'below' : 'above'} ${fmtPx(refPx)}` };
    }
    return null;
  }

  function update() {
    if (dlg.closed) return;
    const m = marketFor(coin) || m0;
    const mid = midOf(m);
    const connected = isConnected();
    const long = st.side === 'long';

    pxEl.textContent = `$${fmtPx(mid)}`;
    const chg = change24h(m);
    chgEl.textContent = `${fmtPct(chg)} 24h`;
    chgEl.className = `mkt-chg ${trend(chg)}`;
    subEl.textContent = `Funding ${fmtPct(m.funding, { decimals: 4 })} · OI ${fmtCompactUsd((m.openInterest || 0) * (mid || 0))} · Vol ${fmtCompactUsd(m.dayNtlVlm)}`;

    tabMarket.classList.toggle('on', st.type === 'market');
    tabLimit.classList.toggle('on', st.type === 'limit');
    longBtn.classList.toggle('on', long);
    shortBtn.classList.toggle('on', !long);
    limitField.el.hidden = st.type !== 'limit';
    tpslBox.hidden = !st.tpsl;
    slipRow.hidden = st.type !== 'market';

    const refPx = st.type === 'limit' && Number(st.limitPx) > 0 ? Number(st.limitPx) : mid;
    const sz = refPx ? roundSize((Number(st.usd) || 0) / refPx, m.szDecimals) : 0;
    const notional = sz * (refPx || 0);
    const margin = notional / st.leverage;
    const avail = available();

    sizeCoin.textContent = `≈ ${fmtSize(sz, m.szDecimals)} ${coin}`;
    availEl.textContent = connected && avail != null ? `Available ${fmtUsd(avail)}` : '';
    levValue.textContent = `${st.leverage}x`;
    slider.style.setProperty('--pct', `${m0.maxLeverage > 1 ? ((st.leverage - 1) / (m0.maxLeverage - 1)) * 100 : 100}%`);
    crossBtn.classList.toggle('on', st.cross);
    isoBtn.classList.toggle('on', !st.cross);

    rowValue.textContent = fmtUsd(notional);
    rowMargin.textContent = fmtUsd(margin);
    rowFee.textContent = fmtUsd(notional * (st.type === 'market' ? TAKER_FEE : MAKER_FEE), { decimals: notional * TAKER_FEE < 1 ? 4 : 2 });
    rowSlip.textContent = fmtPct(settings.slippage ?? 0.03, { sign: false, decimals: 1 });

    const problem = validate(m, refPx, sz);
    limitField.invalid(problem?.field === 'limit' && st.limitPx);
    tpField.invalid(problem?.field === 'tp' && st.tp);
    slField.invalid(problem?.field === 'sl' && st.sl);

    if (st.serverError) {
      msg.className = 'form-msg error';
      msg.textContent = st.serverError;
    } else if (connected && !problem && avail != null && margin > avail * 1.001) {
      msg.className = 'form-msg warn';
      msg.textContent = `This needs ${fmtUsd(margin)} margin but only ${fmtUsd(avail)} is available.`;
    } else if (problem && (Number(st.usd) > 0 || st.type === 'limit')) {
      msg.className = 'form-msg';
      msg.textContent = problem.text;
    } else {
      msg.textContent = '';
    }

    submit.replaceChildren();
    if (!connected) {
      submit.className = 'submit connect';
      submit.disabled = false;
      submit.append('Connect Hyperliquid');
    } else {
      submit.className = `submit ${st.side}`;
      submit.disabled = !!problem || st.submitting;
      if (st.submitting) submit.append(spinner(22));
      else submit.append(`${long ? 'Long' : 'Short'} ${coin}${st.type === 'limit' ? ' · Limit' : ''}`);
    }

    renderPosition(m);
  }

  function renderPosition(m) {
    const p = positionFor(coin);
    posBox.hidden = !p;
    if (!p) return;
    const isLong = p.szi > 0;
    const lev = p.leverage ? `${p.leverage.value}x ${p.leverage.type === 'cross' ? 'Cross' : 'Isolated'}` : '';
    const closeBtn = h('button', {
      class: `btn-outline small${st.closeArmed ? ' btn-danger' : ''}`,
      onclick: (e) => onClose(e),
    }, st.closeArmed ? 'Confirm' : 'Close');
    posBox.replaceChildren(
      h('div', { class: 'posbox-main' },
        h('div', { class: 'posbox-label' }, 'Your position'),
        h('div', { class: 'posbox-title' },
          h('span', { class: `side-tag ${isLong ? 'long' : 'short'}` }, isLong ? 'Long' : 'Short'),
          `${fmtSize(Math.abs(p.szi), m.szDecimals)} ${coin}`),
        h('div', { class: 'posbox-sub' }, `Entry ${fmtPx(p.entryPx)} · Liq ${p.liquidationPx ? fmtPx(p.liquidationPx) : '—'} · ${lev}`)),
      h('div', { class: `posbox-pnl ${trend(p.unrealizedPnl)}` },
        fmtUsd(p.unrealizedPnl, { sign: true }),
        h('small', null, fmtPct(p.returnOnEquity))),
      closeBtn);
  }

  async function onClose(e) {
    if (!e.isTrusted) return;
    if (!st.closeArmed) {
      st.closeArmed = true;
      update();
      setTimeout(() => {
        st.closeArmed = false;
        if (!dlg.closed) update();
      }, 3000);
      return;
    }
    st.closeArmed = false;
    try {
      const res = await rpc('position:close', { coin });
      toast(res.status === 'filled' ? `Closed ${coin} at $${fmtPx(res.avgPx)}` : `Close order sent for ${coin}`);
      refreshAccount().catch(() => {});
    } catch (err) {
      st.serverError = err.message;
      update();
    }
  }

  async function onSubmit(e) {
    if (!e.isTrusted) return;
    if (!isConnected()) {
      dlg.close();
      openConnect();
      return;
    }
    if (st.submitting) return;
    st.submitting = true;
    update();
    try {
      const res = await rpc('order:place', {
        coin,
        isBuy: st.side === 'long',
        orderType: st.type,
        usd: Number(st.usd),
        limitPx: st.type === 'limit' ? Number(st.limitPx) : null,
        leverage: st.leverage,
        isCross: st.cross,
        tp: st.tpsl ? Number(st.tp) || null : null,
        sl: st.tpsl ? Number(st.sl) || null : null,
      });
      toast(describeFill(res));
      refreshAccount().catch(() => {});
      dlg.close();
    } catch (err) {
      st.serverError = err.message;
    } finally {
      st.submitting = false;
      update();
    }
  }
}
