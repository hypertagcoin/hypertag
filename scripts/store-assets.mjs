// Renders Chrome Web Store images into store/: five 1280x800 screenshots of
// the real UI (driven through dev/harness.html with trusted clicks) and the
// 440x280 small promo tile. All are 24-bit PNGs with no alpha, as the store
// requires. Run `npm run store-assets` (set CHROME_PATH if Chrome isn't found).
import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p));
if (!CHROME) throw new Error('Chrome not found: set CHROME_PATH');

const OUT = 'store/screenshots';
const W = 1280;
const H = 800;
const FONT = 'Segoe UI, -apple-system, Helvetica Neue, Arial, sans-serif';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- serve the repo root so the harness can load dist/ ----
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    const body = await readFile(join(process.cwd(), path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});

async function open(url, viewport = { width: W, height: H, deviceScaleFactor: 1 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  // Open the extension's closed shadow roots so the script can find buttons to click.
  await page.evaluateOnNewDocument(() => {
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      return attach.call(this, { ...init, mode: 'open' });
    };
  });
  await page.goto(`${base}${url}`, { waitUntil: 'load' });
  await sleep(1500); // markets load, chips and sidebar render
  return page;
}

/** Real mouse click (isTrusted) on an element inside one of our shadow roots. */
async function clickIn(page, hostSel, innerSel, nth = 0) {
  const point = await page.evaluate((h, s, i) => {
    const el = document.querySelector(h)?.shadowRoot?.querySelectorAll(s)[i];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, hostSel, innerSel, nth);
  if (!point) throw new Error(`Not found: ${hostSel} ${innerSel}`);
  await page.mouse.click(point.x, point.y);
}

const flatPng = (input) => sharp(input).flatten({ background: '#000' }).removeAlpha().png({ compressionLevel: 9 });

async function shoot(page, name) {
  await flatPng(await page.screenshot({ type: 'png' })).toFile(`${OUT}/${name}.png`);
  await page.close();
  console.log(`${OUT}/${name}.png`);
}

mkdirSync(OUT, { recursive: true });

// 1. Timeline with live chips and the sidebar account card.
await shoot(await open('/dev/harness.html?theme=dark'), '1-timeline');

// 2. Trade sheet: Long BTC with a $250 size.
{
  const page = await open('/dev/harness.html?theme=dark');
  await clickIn(page, 'tt-root[data-kind="chips"]', '.pill-long');
  await sleep(500);
  await page.keyboard.type('250');
  await sleep(400);
  await shoot(page, '2-trade-sheet');
}

// 3. Same sheet in X's light theme, shorting ETH.
{
  const page = await open('/dev/harness.html?theme=light');
  await clickIn(page, 'tt-root[data-kind="chips"]', '.pill-short', 1); // first post's second chip: ETH
  await sleep(500);
  await page.keyboard.type('500');
  await sleep(400);
  await shoot(page, '3-light-theme');
}

// 4. Connect dialog (Dim theme, logged out) listing the browser wallet.
{
  const page = await open('/dev/harness.html?theme=dim&connected=0');
  await clickIn(page, 'tt-root[data-kind="sidebar"]', '.btn-contrast');
  await sleep(1200);
  await shoot(page, '4-connect');
}

// 5. Toolbar popup, framed on a branded background with a caption.
{
  const page = await open('/dev/popup-harness.html?theme=dark', { width: 600, height: 900, deviceScaleFactor: 1 });
  // Render at the real popup size, not the harness's full-height tab layout.
  await page.evaluate(() => document.body.classList.remove('tab-mode'));
  await page.addStyleTag({ content: 'html { background: #000 !important; } body { margin: 0 !important; outline: 0 !important; }' });
  await sleep(300);
  const popup = await (await page.$('body')).screenshot({ type: 'png' });
  await page.close();
  const meta = await sharp(popup).metadata();
  const scale = Math.min(1, 700 / meta.height);
  const pw = Math.round(meta.width * scale);
  const ph = Math.round(meta.height * scale);
  const radius = 18;
  const mask = Buffer.from(`<svg width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="${radius}" fill="#fff"/></svg>`);
  const framed = await sharp(popup).resize(pw, ph).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const left = W - pw - 150;
  const top = Math.round((H - ph) / 2);
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="g" cx="70%" cy="50%" r="60%"><stop offset="0" stop-color="#79f7e3" stop-opacity=".22"/><stop offset="1" stop-color="#79f7e3" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="#000"/>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="${left - 1}" y="${top - 1}" width="${pw + 2}" height="${ph + 2}" rx="${radius + 1}" fill="none" stroke="#2f3336" stroke-width="2"/>
    <text x="100" y="330" font-family="${FONT}" font-size="58" font-weight="800" letter-spacing="-2" fill="#e7e9ea">Your account,</text>
    <text x="100" y="400" font-family="${FONT}" font-size="58" font-weight="800" letter-spacing="-2" fill="#79f7e3">one click away.</text>
    <text x="102" y="460" font-family="${FONT}" font-size="24" fill="#8b98a5">Balance, positions, defaults and a</text>
    <text x="102" y="494" font-family="${FONT}" font-size="24" fill="#8b98a5">Mainnet / Testnet switch in the toolbar.</text>
  </svg>`);
  await flatPng(await sharp(bg).composite([{ input: framed, left, top }]).png().toBuffer()).toFile(`${OUT}/5-popup.png`);
  console.log(`${OUT}/5-popup.png`);
}

// Small promo tile, 440x280.
{
  const logo = await sharp('static/icons/icon-128.png').extract({ left: 16, top: 16, width: 96, height: 96 }).resize(104, 104).png().toBuffer();
  const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280">
    <defs>
      <radialGradient id="g" cx="25%" cy="50%" r="70%"><stop offset="0" stop-color="#79f7e3" stop-opacity=".28"/><stop offset="1" stop-color="#79f7e3" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="440" height="280" fill="#000"/>
    <rect width="440" height="280" fill="url(#g)"/>
    <text x="172" y="128" font-family="${FONT}" font-size="40" font-weight="800" letter-spacing="-1.5" fill="#e7e9ea">Hypertag</text>
    <text x="173" y="164" font-family="${FONT}" font-size="21" font-weight="700" fill="#79f7e3">Trade the timeline.</text>
    <text x="173" y="194" font-family="${FONT}" font-size="15" fill="#8b98a5">Long or short any $cashtag on X</text>
  </svg>`);
  await flatPng(await sharp(tile).composite([{ input: logo, left: 44, top: 88 }]).png().toBuffer()).toFile('store/promo-tile-440x280.png');
  console.log('store/promo-tile-440x280.png');
}

await browser.close();
server.close();
