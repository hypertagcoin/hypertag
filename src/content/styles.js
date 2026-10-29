// X (x.com) design tokens and components, scoped inside our shadow roots.
// Values follow X's three display themes: Default, Dim and Lights out.

export const CSS = `
:host { all: initial; }
:host {
  --accent: #1d9bf0;
  --green: #00ba7c;
  --red: #f4212e;
  --up: #00ba7c;
  --down: #f4212e;
  --font: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  --bg: #000000;
  --surface: #16181c;
  --hover: rgba(231, 233, 234, 0.1);
  --hover-soft: rgba(231, 233, 234, 0.03);
  --text: #e7e9ea;
  --text2: #71767b;
  --border: #2f3336;
  --input-border: #333639;
  --outline: #536471;
  --contrast-bg: #eff3f4;
  --contrast-fg: #0f1419;
  --contrast-hover: #d7dbdc;
  --backdrop: rgba(91, 112, 131, 0.4);
  --shadow: rgba(255, 255, 255, 0.2) 0 0 15px, rgba(255, 255, 255, 0.15) 0 0 3px 1px;

  color-scheme: dark;
  font-family: var(--font);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
:host([data-theme="dim"]) {
  --bg: #15202b;
  --surface: #1e2732;
  --hover: rgba(247, 249, 249, 0.1);
  --hover-soft: rgba(247, 249, 249, 0.03);
  --text: #f7f9f9;
  --text2: #8b98a5;
  --border: #38444d;
  --input-border: #38444d;
  --outline: #536471;
}
:host([data-theme="light"]) {
  color-scheme: light;
  --up: #00996b;
  --bg: #ffffff;
  --surface: #f7f9f9;
  --hover: rgba(15, 20, 25, 0.1);
  --hover-soft: rgba(0, 0, 0, 0.03);
  --text: #0f1419;
  --text2: #536471;
  --border: #eff3f4;
  --input-border: #cfd9de;
  --outline: #cfd9de;
  --contrast-bg: #0f1419;
  --contrast-fg: #ffffff;
  --contrast-hover: #272c30;
  --backdrop: rgba(0, 0, 0, 0.4);
  --shadow: rgba(101, 119, 134, 0.2) 0 0 15px, rgba(101, 119, 134, 0.15) 0 0 3px 1px;
}

*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
button {
  font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
button:disabled { cursor: default; }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
h2, p { margin: 0; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.num { font-variant-numeric: tabular-nums; }
.up { color: var(--up); }
.down { color: var(--down); }
.flat { color: var(--text2); }
.icon { display: block; flex: none; }

/* ---------- shared buttons ---------- */
.btn-contrast {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 36px; padding: 0 16px; border-radius: 9999px;
  background: var(--contrast-bg); color: var(--contrast-fg);
  font-size: 15px; font-weight: 700; line-height: 20px; transition: background-color .2s;
}
.btn-contrast:hover:not(:disabled) { background: var(--contrast-hover); }
.btn-outline {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 36px; padding: 0 16px; border-radius: 9999px; border: 1px solid var(--outline);
  color: var(--text); font-size: 15px; font-weight: 700; line-height: 20px; transition: background-color .2s;
}
.btn-outline:hover:not(:disabled) { background: var(--hover); }
.btn-outline.small, .btn-contrast.small { min-height: 32px; padding: 0 14px; font-size: 14px; }
.btn-danger { border-color: transparent; background: var(--red); color: #fff; }
.btn-danger:hover:not(:disabled) { background: #dc1d29; }
.block { display: flex; width: 100%; }
.big { min-height: 52px; font-size: 17px; }
.badge {
  display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border-radius: 4px;
  font-size: 12px; font-weight: 700; line-height: 16px; vertical-align: middle;
}
.badge-testnet { background: rgba(255, 212, 0, 0.16); color: #ffd400; }
:host([data-theme="light"]) .badge-testnet { color: #a37f00; }
.spinner { animation: tt-spin .75s linear infinite; display: block; }
.spinner-track { stroke: color-mix(in srgb, var(--accent) 22%, transparent); }
.spinner-head { stroke: var(--accent); stroke-linecap: round; }
@keyframes tt-spin { to { transform: rotate(360deg); } }

/* ---------- tweet chips ---------- */
:host([data-kind="chips"]) { display: block; margin-top: 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  display: inline-flex; align-items: center; gap: 2px; height: 34px; padding: 3px;
  border: 1px solid var(--border); border-radius: 9999px; background: var(--bg);
  font-size: 14px; line-height: 18px; max-width: 100%;
}
.chip-coin {
  display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px 0 10px;
  border-radius: 9999px; white-space: nowrap; transition: background-color .2s; min-width: 0;
}
.chip-coin:hover { background: var(--hover); }
.chip-sym { font-weight: 700; color: var(--text); }
.chip-px { color: var(--text); font-variant-numeric: tabular-nums; }
.chip-chg { font-size: 13px; font-variant-numeric: tabular-nums; }
.chip-pos {
  font-size: 12px; font-weight: 700; padding: 1px 6px; border-radius: 4px; font-variant-numeric: tabular-nums;
}
.chip-pos.long { color: var(--up); background: rgba(0, 186, 124, 0.12); }
.chip-pos.short { color: var(--down); background: rgba(244, 33, 46, 0.12); }
.pill {
  height: 26px; padding: 0 12px; border-radius: 9999px; font-size: 13px; font-weight: 700;
  transition: background-color .2s; white-space: nowrap;
}
.pill-long { color: var(--up); background: rgba(0, 186, 124, 0.12); }
.pill-long:hover { background: rgba(0, 186, 124, 0.24); }
.pill-short { color: var(--down); background: rgba(244, 33, 46, 0.12); }
.pill-short:hover { background: rgba(244, 33, 46, 0.24); }

/* ---------- dialog shell ---------- */
:host([data-kind="dialog"]) { position: fixed; inset: 0; z-index: 2147483000; }
.backdrop {
  position: absolute; inset: 0; background: var(--backdrop);
  display: flex; align-items: flex-start; justify-content: center; padding: 5vh 16px;
  animation: tt-fade .15s ease-out;
}
.dialog {
  position: relative; width: 100%; background: var(--bg); color: var(--text);
  border-radius: 16px; display: flex; flex-direction: column; max-height: 90vh;
  overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--outline) transparent;
  animation: tt-pop .18s ease-out; box-shadow: var(--shadow);
}
:host([data-theme="dark"]) .dialog, :host([data-theme="dim"]) .dialog { box-shadow: none; }
.dlg-head {
  position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 20px;
  height: 53px; padding: 0 16px; border-radius: 16px 16px 0 0;
  background: color-mix(in srgb, var(--bg) 94%, transparent); backdrop-filter: blur(12px);
}
.dlg-title { flex: 1; min-width: 0; font-size: 20px; font-weight: 700; line-height: 24px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dlg-head-extra { display: flex; align-items: center; gap: 8px; }
.icon-btn {
  width: 36px; height: 36px; margin-left: -8px; border-radius: 9999px; flex: none;
  display: grid; place-items: center; color: var(--text); transition: background-color .2s;
}
.icon-btn:hover { background: var(--hover); }
.dlg-body { padding: 0 16px 16px; }
@media (max-width: 700px) {
  .backdrop { padding: 0; }
  .dialog { border-radius: 0; height: 100%; max-height: none; }
  .dlg-head { border-radius: 0; }
}
@keyframes tt-fade { from { opacity: 0; } }
@keyframes tt-pop { from { opacity: 0; transform: scale(.97); } }

/* ---------- tabs (X "For you / Following" style) ---------- */
.tabs { display: flex; border-bottom: 1px solid var(--border); margin: 0 -16px; }
.tab {
  flex: 1; height: 53px; display: flex; justify-content: center; color: var(--text2);
  font-size: 15px; font-weight: 500; transition: background-color .2s;
}
.tab:hover { background: var(--hover-soft); }
.tab > span { position: relative; display: inline-flex; align-items: center; height: 100%; }
.tab.on { color: var(--text); font-weight: 700; }
.tab.on > span::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 4px;
  border-radius: 9999px; background: var(--accent);
}

/* ---------- trade form ---------- */
.mkt { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 16px 0 12px; }
.mkt-name { display: flex; align-items: center; gap: 6px; font-size: 17px; font-weight: 800; line-height: 20px; }
.tag {
  height: 20px; padding: 0 6px; border-radius: 4px; background: var(--surface); color: var(--text2);
  font-size: 12px; font-weight: 700; line-height: 20px;
}
.mkt-sub { margin-top: 4px; color: var(--text2); font-size: 13px; line-height: 16px; font-variant-numeric: tabular-nums; }
.mkt-right { text-align: right; }
.mkt-px { font-size: 23px; font-weight: 800; line-height: 28px; font-variant-numeric: tabular-nums; }
.mkt-chg { font-size: 13px; line-height: 16px; font-variant-numeric: tabular-nums; }

.side { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 9999px; background: var(--surface); }
.seg { height: 36px; border-radius: 9999px; font-size: 15px; font-weight: 700; color: var(--text2); transition: background-color .2s, color .2s; }
.seg:hover:not(.on) { color: var(--text); }
.seg.long.on { background: var(--green); color: #fff; }
.seg.short.on { background: var(--red); color: #fff; }

.field {
  position: relative; display: flex; align-items: stretch; margin-top: 16px;
  border: 1px solid var(--input-border); border-radius: 4px; cursor: text;
  transition: border-color .15s, box-shadow .15s;
}
.field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.field-label {
  position: absolute; top: 8px; left: 8px; right: 8px; font-size: 13px; line-height: 16px;
  color: var(--text2); pointer-events: none; transition: color .15s;
}
.field:focus-within .field-label { color: var(--accent); }
.field input {
  flex: 1; width: 0; min-width: 0; padding: 28px 8px 8px; border: 0; outline: 0; background: transparent;
  color: var(--text); font: inherit; font-size: 17px; line-height: 20px; font-variant-numeric: tabular-nums;
}
.field input::placeholder { color: var(--text2); }
.field-suffix { display: flex; align-items: flex-end; padding: 0 12px 9px 0; color: var(--text2); font-size: 15px; }
.field.invalid { border-color: var(--red); }
.field.invalid .field-label { color: var(--red); }
.field-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.field-row .field { margin-top: 12px; }

.quick { display: flex; gap: 8px; margin-top: 12px; }
.quick button {
  flex: 1; height: 32px; border-radius: 9999px; border: 1px solid var(--outline);
  font-size: 13px; font-weight: 700; color: var(--text); transition: background-color .2s;
}
.quick button:hover { background: var(--hover); }
.hint { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; color: var(--text2); font-size: 13px; line-height: 16px; font-variant-numeric: tabular-nums; }

.section { margin-top: 20px; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-title { font-size: 15px; font-weight: 700; line-height: 20px; }
.section-tools { display: flex; align-items: center; gap: 12px; }
.lev-value { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; min-width: 40px; text-align: right; }
.mini-seg { display: inline-flex; padding: 2px; border-radius: 9999px; border: 1px solid var(--border); }
.mini-seg button { height: 26px; padding: 0 12px; border-radius: 9999px; font-size: 13px; font-weight: 700; color: var(--text2); }
.mini-seg button.on { background: var(--contrast-bg); color: var(--contrast-fg); }
.mini-seg button:disabled:not(.on) { opacity: .4; }
.range { position: relative; margin-top: 12px; }
input[type="range"] {
  -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 20px; margin: 0;
  background: transparent; cursor: pointer;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: 4px; border-radius: 9999px;
  background: linear-gradient(to right, var(--accent) var(--pct, 0%), color-mix(in srgb, var(--accent) 22%, transparent) var(--pct, 0%));
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 18px; height: 18px; margin-top: -7px; border-radius: 50%;
  background: var(--accent); border: 0; transition: box-shadow .15s;
}
input[type="range"]:hover::-webkit-slider-thumb, input[type="range"]:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 18%, transparent);
}
input[type="range"]:focus-visible { outline: none; }
.ticks { display: flex; justify-content: space-between; margin-top: 4px; color: var(--text2); font-size: 12px; font-variant-numeric: tabular-nums; }
.ticks button { color: inherit; font-size: inherit; padding: 2px; }
.ticks button:hover { color: var(--text); }

.check { display: flex; align-items: center; gap: 12px; margin-top: 20px; cursor: pointer; font-size: 15px; line-height: 20px; user-select: none; }
.check input { position: absolute; opacity: 0; pointer-events: none; }
.check-box {
  width: 20px; height: 20px; flex: none; border-radius: 4px; border: 2px solid var(--outline);
  display: grid; place-items: center; color: #fff; transition: background-color .15s, border-color .15s;
}
.check-box .icon { opacity: 0; }
.check input:checked + .check-box { background: var(--accent); border-color: var(--accent); }
.check input:checked + .check-box .icon { opacity: 1; }
.check input:focus-visible + .check-box { outline: 2px solid var(--accent); outline-offset: 2px; }

.rows { margin-top: 20px; padding-top: 12px; border-top: 1px solid var(--border); }
.row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 14px; line-height: 18px; color: var(--text2); }
.row b { color: var(--text); font-weight: 500; font-variant-numeric: tabular-nums; }
.form-msg { min-height: 0; margin-top: 12px; font-size: 13px; line-height: 16px; color: var(--text2); }
.form-msg:empty { display: none; }
.form-msg.error { color: var(--red); }
.form-msg.warn { color: #ffad1f; }
.submit {
  display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
  min-height: 52px; margin-top: 16px; border-radius: 9999px; color: #fff;
  font-size: 17px; font-weight: 700; line-height: 20px; transition: filter .2s, opacity .2s;
}
.submit.long { background: var(--green); }
.submit.short { background: var(--red); }
.submit.connect { background: var(--contrast-bg); color: var(--contrast-fg); }
.submit:hover:not(:disabled) { filter: brightness(.92); }
.submit:disabled { opacity: .5; }
.submit .spinner-track { stroke: rgba(255, 255, 255, .3); }
.submit .spinner-head { stroke: #fff; }
.disclaimer { margin-top: 12px; color: var(--text2); font-size: 12px; line-height: 16px; text-align: center; }

.posbox {
  display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 12px 16px;
  border: 1px solid var(--border); border-radius: 16px;
}
.posbox-main { flex: 1; min-width: 0; }
.posbox-label { color: var(--text2); font-size: 13px; line-height: 16px; }
.posbox-title { display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 15px; font-weight: 700; line-height: 20px; font-variant-numeric: tabular-nums; }
.posbox-sub { margin-top: 2px; color: var(--text2); font-size: 13px; line-height: 16px; font-variant-numeric: tabular-nums; }
.posbox-pnl { text-align: right; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.posbox-pnl small { display: block; font-size: 13px; font-weight: 400; }

/* ---------- sidebar card ---------- */
:host([data-kind="sidebar"]) { display: block; margin-bottom: 16px; }
.card { border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: var(--bg); }
.card-head { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
.card-title { flex: 1; font-size: 20px; font-weight: 800; line-height: 24px; }
.card-addr { color: var(--text2); font-size: 13px; font-variant-numeric: tabular-nums; }
.card-text { padding: 0 16px 12px; color: var(--text); font-size: 15px; line-height: 20px; }
.card-pad { padding: 0 16px 16px; }
.stat-label { color: var(--text2); font-size: 13px; line-height: 16px; }
.stat-value { font-size: 23px; font-weight: 800; line-height: 28px; font-variant-numeric: tabular-nums; }
.stats { display: flex; gap: 20px; margin-top: 8px; font-size: 14px; line-height: 18px; color: var(--text2); }
.stats b { font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.stats b.up { color: var(--up); } .stats b.down { color: var(--down); }
.pos-list { border-top: 1px solid var(--border); }
.pos { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background-color .2s; }
.pos:hover { background: var(--hover-soft); }
.pos-main { flex: 1; min-width: 0; }
.pos-top { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; line-height: 20px; }
.pos-sub { margin-top: 2px; color: var(--text2); font-size: 13px; line-height: 16px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pos-pnl { text-align: right; font-size: 14px; font-weight: 700; line-height: 18px; font-variant-numeric: tabular-nums; }
.pos-pnl small { display: block; font-size: 12px; font-weight: 400; }
.side-tag { height: 18px; padding: 0 5px; border-radius: 4px; font-size: 12px; font-weight: 700; line-height: 18px; }
.side-tag.long { color: var(--up); background: rgba(0, 186, 124, 0.12); }
.side-tag.short { color: var(--down); background: rgba(244, 33, 46, 0.12); }
.empty { padding: 12px 16px 16px; color: var(--text2); font-size: 15px; line-height: 20px; border-top: 1px solid var(--border); }
.card-foot {
  display: flex; align-items: center; gap: 4px; padding: 16px; color: var(--accent); font-size: 15px; line-height: 20px;
  border-top: 1px solid var(--border); transition: background-color .2s;
}
.card-foot:hover { background: var(--hover-soft); text-decoration: none; }

/* ---------- connect dialog ---------- */
.lead { margin-top: 4px; color: var(--text2); font-size: 15px; line-height: 20px; }
.wallets { display: flex; flex-direction: column; margin: 16px -16px 0; min-height: 64px; }
.wallets > .spinner { margin: 20px auto; }
.wallet-row {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px; text-align: left;
  font-size: 15px; font-weight: 700; line-height: 20px; transition: background-color .2s;
}
.wallet-row:hover { background: var(--hover-soft); }
.wallet-row img, .avatar { width: 40px; height: 40px; border-radius: 10px; flex: none; }
.avatar { display: grid; place-items: center; background: var(--surface); color: var(--text); font-size: 17px; font-weight: 800; }
.wallet-name { flex: 1; }
.wallet-row .icon { color: var(--text2); }
.no-wallet { padding: 12px 16px; color: var(--text2); font-size: 15px; line-height: 20px; }
.divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; color: var(--text); font-size: 15px; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.fine { margin-top: 12px; color: var(--text2); font-size: 13px; line-height: 16px; }
.center { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px 8px 8px; }
.center h3 { margin: 20px 0 8px; font-size: 23px; font-weight: 800; line-height: 28px; }
.center p { color: var(--text2); font-size: 15px; line-height: 20px; }
.center .actions { display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 28px; }
.done-mark { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: #fff; }
.fail-mark { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: rgba(244, 33, 46, .14); color: var(--red); }

/* ---------- toasts ---------- */
:host([data-kind="toast"]) { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483600; pointer-events: none; }
.toasts { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0 16px 24px; }
.toast {
  pointer-events: auto; display: flex; align-items: center; gap: 16px; max-width: min(600px, 100%);
  padding: 12px 16px; border-radius: 4px; background: var(--accent); color: #fff;
  font-size: 15px; line-height: 20px; box-shadow: rgba(101, 119, 134, 0.2) 0 0 15px, rgba(101, 119, 134, 0.15) 0 0 3px 1px;
  animation: tt-toast-in .2s ease-out;
}
.toast.error { background: var(--red); }
.toast.out { opacity: 0; transform: translateY(8px); transition: opacity .2s, transform .2s; }
.toast-action { font-weight: 700; white-space: nowrap; }
.toast-action:hover { text-decoration: underline; }
@keyframes tt-toast-in { from { opacity: 0; transform: translateY(8px); } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  .spinner { animation-duration: 1.5s !important; }
}
`;
