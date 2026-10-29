# Chrome Web Store submission: Hypertag

Copy each block into the matching field of the Chrome Web Store Developer Dashboard.

- **Package:** `release/hypertag-<version>.zip` (build with `npm run package`, or download it from the GitHub Release; raise `version` in `static/manifest.json` before every new upload)
- **Store icon (128×128):** `static/icons/icon-128.png`

---

## Store listing tab

**Title** (taken from the manifest): Hypertag: Trade Hyperliquid from X

**Summary** (taken from the manifest): Long or short Hyperliquid perps from any $cashtag on X. Unofficial: not affiliated with X or Hyperliquid.

**Category:** Productivity → Tools

**Language:** English

**Description:**

```text
Hypertag puts Long and Short buttons under every $cashtag on X, so you can trade Hyperliquid perpetuals without leaving your feed.

WHAT IT DOES
• Live prices on posts: every $cashtag listed on Hyperliquid ($BTC, $ETH, $SOL, $HYPE and more) gets a small chip with the live price, the 24h change, and your PnL if you already hold that coin.
• A full trade sheet: tap Long or Short to open a sheet styled like X. Choose Market or Limit, size in USD, leverage, Cross or Isolated margin, and an optional take profit and stop loss. It previews the order value, margin and fee before you confirm.
• Positions in your sidebar: a card in X's right column shows your account value, PnL, available margin and open positions, each with a one-tap close.
• Looks native: it follows your X display setting (Lights out, Dim or Default) and your accent color.
• Testnet built in: switch to Hyperliquid Testnet in the popup to practice first.
• Meme tickers map automatically, so $PEPE on X trades kPEPE on Hyperliquid.

HOW CONNECTING WORKS
Hypertag uses a Hyperliquid API wallet: a trading-only key that can open and close positions but can never withdraw or transfer funds. Hyperliquid enforces this limit.
• Connect with your browser wallet (MetaMask, Rabby, Coinbase Wallet, OKX Wallet, Phantom or any EIP-6963 wallet). You sign one approval message. No gas, no transaction.
• Or paste an API wallet key you created on Hyperliquid into the extension popup.

PRIVACY
• No accounts, no analytics, no ads.
• Your trading key and settings stay in your browser. Orders are signed inside the extension and sent straight to Hyperliquid.
• Post text is read on your device to find cashtags and is never stored or sent anywhere.
Full policy: https://hypertag.trade/privacy

FEES
Hypertag adds no fees. You pay Hyperliquid's standard trading fees.

Hypertag is an independent tool and is not affiliated with, endorsed by or sponsored by X Corp. or Hyperliquid. Trading perpetual futures with leverage is high risk. Nothing here is financial advice.
```

**Homepage URL:** https://hypertag.trade

**Support URL:** https://github.com/hypertagcoin/hypertag/issues

**Graphic assets** (all 24-bit PNG with no alpha, as the store requires; regenerate with `npm run store-assets`):

| Field | File |
|---|---|
| Store icon (128×128) | `static/icons/icon-128.png` |
| Screenshot 1 | `store/screenshots/1-timeline.png`: live price chips under posts, plus the sidebar account card |
| Screenshot 2 | `store/screenshots/2-trade-sheet.png`: the trade sheet, Long BTC |
| Screenshot 3 | `store/screenshots/3-light-theme.png`: the same sheet in X's light theme, Short ETH |
| Screenshot 4 | `store/screenshots/4-connect.png`: connecting a browser wallet |
| Screenshot 5 | `store/screenshots/5-popup.png`: the toolbar popup |
| Small promo tile (440×280) | `store/promo-tile-440x280.png` |

The screenshots use fictional sample accounts and sample balances from `dev/harness.html`.

---

## Privacy practices tab

**Single purpose:**

```text
Let users trade Hyperliquid perpetual futures directly from $cashtags in posts on X (x.com): show live prices next to cashtags, and open, manage and close Hyperliquid positions without leaving X.
```

**Permission justification: `storage`**

```text
Saves the user's settings (network, default order size, leverage, slippage and display options) and the Hyperliquid API wallet the user approves or imports, so they stay connected between browser sessions. Everything is stored locally. The stored key is only used inside the extension to sign the orders the user confirms; it is never transmitted.
```

**Permission justification: host permissions (`https://x.com/*`, `https://twitter.com/*`)**

```text
The extension's single purpose is trading from X, so its content script runs on x.com and twitter.com. It finds $cashtags in the posts on screen, shows a live price with Long/Short buttons under them, opens the trade sheet, and shows the account card in X's sidebar. A small second script runs in the page context only so the user can connect their own browser wallet (such as MetaMask), which is only reachable from the page. Host access is also used to tell open X tabs to refresh after the user connects or disconnects.
```

**Permission justification: host permissions (`https://api.hyperliquid.xyz/*`, `https://api.hyperliquid-testnet.xyz/*`)**

```text
Hyperliquid's public API is the only service the extension talks to. It fetches market prices and the connected account's balance and positions, and submits the orders, leverage changes and API wallet approval that the user confirms. The testnet host is used only when the user switches to Testnet in the popup.
```

**Are you using remote code?** No, I am not using remote code.

```text
All JavaScript is bundled in the package. The extension only exchanges JSON data with Hyperliquid's API and never loads or evaluates code from the network.
```

### Data usage

Tick these three. Each one is handled as described, and only the order data shown below leaves the device.

| Category | What it is in Hypertag |
|---|---|
| **Financial and payment information** | Account address, balance, positions and the orders the user places. Sent to Hyperliquid to show the account and execute confirmed trades. |
| **Authentication information** | The Hyperliquid API wallet private key. Stored locally and used only to sign orders; never transmitted. |
| **Website content** | Text of posts on X, read on the device to find $cashtags. Never stored or transmitted. |

Leave the rest unticked: personally identifiable information, health information, personal communications, location, web history and user activity.

Tick all three certifications. They are all true for this code:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://hypertag.trade/privacy

---

## Distribution tab

- **Visibility:** Public, or Unlisted to soft-launch with a direct link first.
- **Regions:** check Hyperliquid's terms of use for restricted jurisdictions and exclude those regions.

---

## Notes for the reviewer (Test instructions field)

```text
No account is needed to see the main feature:
1. Install the extension and open https://x.com.
2. Open any post that mentions a cashtag such as $BTC or $ETH (for example, search X for "$BTC"). A chip with the live price and Long / Short buttons appears under the post text.
3. Click Long or Short to open the trade sheet. Without a connected account, its button reads "Connect Hyperliquid".

Placing orders requires a Hyperliquid account. To test without real funds, open the extension popup, switch the network to Testnet, and connect a browser wallet (such as MetaMask) whose address has Hyperliquid Testnet funds. Connecting asks the wallet for one signature (Hyperliquid "ApproveAgent"); no on-chain transaction is sent.

The extension only communicates with api.hyperliquid.xyz and api.hyperliquid-testnet.xyz. Privacy policy: https://hypertag.trade/privacy
```
