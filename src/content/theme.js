// Mirrors X's display settings: Default (light), Dim, Lights out — plus the
// user's chosen accent colour, read from links rendered in tweets.

let theme = 'dark';
let accent = '';

export function applyTheme(host) {
  host.dataset.theme = theme;
  if (accent) host.style.setProperty('--accent', accent);
  else host.style.removeProperty('--accent');
}

function rgb(color) {
  const parts = (color.match(/[\d.]+/g) || []).map(Number);
  if (parts.length < 3 || parts[3] === 0) return null;
  return parts;
}

function detect() {
  let nextTheme = theme;
  const declared = document.documentElement.dataset.theme; // set by X's newer layout
  const bg = document.body && rgb(getComputedStyle(document.body).backgroundColor);
  if (bg) {
    const [r, g, b] = bg;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    nextTheme = luminance > 128 ? 'light' : r + g + b > 30 ? 'dim' : 'dark';
  } else if (['light', 'dim', 'dark'].includes(declared)) {
    nextTheme = declared;
  }

  let nextAccent = accent;
  const link = document.querySelector('[data-testid="tweetText"] a, article a[href*="/search?q=%24"]');
  const c = link && rgb(getComputedStyle(link).color);
  if (c && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) > 60) nextAccent = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

  if (nextTheme === theme && nextAccent === accent) return;
  theme = nextTheme;
  accent = nextAccent;
  document.querySelectorAll('tt-root[data-tt-host]').forEach(applyTheme);
  try {
    chrome.storage.local.set({ xTheme: { theme, accent } });
  } catch {}
}

export function initTheme() {
  detect();
  new MutationObserver(detect).observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
  setInterval(detect, 4000);
}
