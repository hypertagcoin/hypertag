// Finding posts and $CASHTAGS on x.com. X serves two layouts: the classic one
// labels posts with data-testid; the newer one has no labels, posts are plain
// <article>s and quoted posts are <article>s nested inside them. Everything
// here works from structure that both layouts share.
import { resolveSymbol } from './store.js';

const CASHTAG_RE = /\$([A-Za-z][A-Za-z0-9]{0,9})(?![A-Za-z0-9])/g;
export const CASHTAG_TEXT_RE = /^\$[A-Za-z][A-Za-z0-9]{0,9}$/;
export const CASHTAG_LINK = 'a[href*="/search?q=%24"]';
const EMBEDDED_POST = '[data-slot="embedded-tweet-frame"]';
const MAX_PER_POST = 3;

export function topLevelPosts() {
  return [...document.querySelectorAll('article')].filter((a) => !a.parentElement?.closest('article'));
}

export const ownedBy = (article, el) => el.closest('article') === article && !el.closest(EMBEDDED_POST);

/** The post's own Reply / Repost / Like bar (not a quoted post's). */
export function actionBarOf(article) {
  return [...article.querySelectorAll('[role="group"]')].find((g) => ownedBy(article, g)) || null;
}

/** Where the chip row goes: right after the post text, else just above the action bar. */
export function chipAnchorFor(article) {
  const legacy = article.querySelector('[data-testid="tweetText"]');
  if (legacy) return { el: legacy, after: true };
  const link = [...article.querySelectorAll(CASHTAG_LINK)]
    .find((a) => ownedBy(article, a) && CASHTAG_TEXT_RE.test(a.textContent.trim()));
  const text = link?.closest('div[dir="auto"]');
  if (text && ownedBy(article, text)) return { el: text, after: true };
  const bar = actionBarOf(article);
  return bar ? { el: bar, after: false } : null;
}

/** The Hyperliquid market behind a cashtag link, if it is a bare "$TICKER" link. */
export function marketForLink(a) {
  const text = a.textContent.trim();
  return CASHTAG_TEXT_RE.test(text) ? resolveSymbol(text.slice(1)) : null;
}

/** Up to three Hyperliquid markets mentioned in a post (including a quoted post). */
export function tickersIn(article) {
  const coins = [];
  const add = (sym) => {
    const m = resolveSymbol(sym);
    if (m && !coins.includes(m.name)) coins.push(m.name);
  };
  for (const el of article.querySelectorAll('[data-testid="tweetText"]')) {
    for (const [, sym] of el.textContent.matchAll(CASHTAG_RE)) add(sym);
  }
  // X links every cashtag in post text. Its own price cards are links too, but
  // their text isn't a bare "$TICKER", so they're skipped.
  for (const a of article.querySelectorAll(CASHTAG_LINK)) {
    const m = marketForLink(a);
    if (m && !coins.includes(m.name)) coins.push(m.name);
  }
  return coins.slice(0, MAX_PER_POST);
}
