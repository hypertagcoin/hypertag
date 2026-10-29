// Tiny DOM helpers shared by the content script and popup. No innerHTML
// anywhere: x.com may enforce Trusted Types, and building nodes directly
// keeps tweet-derived text inert.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export const ICONS = {
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7',
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M19 14v4.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5H10'],
  key: ['M15.5 7.5a3.5 3.5 0 1 1-3.36 4.48L4 20H2v-3l8.02-8.02A3.5 3.5 0 0 1 15.5 7.5z', 'M16 10h.01'],
  copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
  alert: ['M12 8v5', 'M12 16.5h.01', 'M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
};

export function icon(paths, { size = 20, stroke = 2 } = {}) {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', class: 'icon' });
  for (const d of [].concat(paths)) {
    svg.append(svgEl('path', {
      d, fill: 'none', stroke: 'currentColor', 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
  }
  return svg;
}

export function spinner(size = 26) {
  const svg = svgEl('svg', { viewBox: '0 0 32 32', width: size, height: size, class: 'spinner', 'aria-label': 'Loading' });
  svg.append(
    svgEl('circle', { cx: 16, cy: 16, r: 14, fill: 'none', 'stroke-width': 4, class: 'spinner-track' }),
    svgEl('circle', { cx: 16, cy: 16, r: 14, fill: 'none', 'stroke-width': 4, class: 'spinner-head', 'stroke-dasharray': 88, 'stroke-dashoffset': 66 }),
  );
  return svg;
}
