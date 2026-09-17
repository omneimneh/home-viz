// Shared helpers: ids, DOM, random, geometry, colour. All plan units are centimetres.

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const deepClone = (o) => JSON.parse(JSON.stringify(o));

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ---------- random ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashInts(...n) {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.round(v * 16) | 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- geometry (plan space, cm) ----------
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function projectOnSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy || 1e-9;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L2, 0, 1);
  const x = a.x + t * dx, y = a.y + t * dy;
  return { t, x, y, d: Math.hypot(p.x - x, p.y - y) };
}
export function pointInPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function polyArea(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  return Math.abs(s / 2);
}
export function polyCentroid(pts) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    x += (pts[j].x + pts[i].x) * f;
    y += (pts[j].y + pts[i].y) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-6) {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  // centroid may fall outside concave polygons; fall back to a point inside
  const c = { x: x / (3 * a), y: y / (3 * a) };
  if (pointInPoly(c, pts)) return c;
  return interiorPoint(pts) || c;
}
function interiorPoint(pts) {
  const ys = pts.map((p) => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  let best = null, bestW = 0;
  for (let k = 1; k < 10; k++) {
    const y = minY + ((maxY - minY) * k) / 10;
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > bestW) { bestW = xs[i + 1] - xs[i]; best = { x: (xs[i] + xs[i + 1]) / 2, y }; }
    }
  }
  return best;
}
export const fmtM = (cm, d = 2) => (cm / 100).toFixed(d) + ' m';
export const fmtArea = (cm2) => (cm2 / 10000).toFixed(1) + ' m²';

// ---------- colour ----------
export function hexToRgb(hex) {
  let s = String(hex || '#888').replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
/** Multiply brightness (amt 1 = same) and optionally shift hue-ish warmth. */
export function shade(hex, amt, warm = 0) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${clamp(r * amt + warm * 12, 0, 255) | 0},${clamp(g * amt + warm * 4, 0, 255) | 0},${clamp(b * amt - warm * 10, 0, 255) | 0})`;
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
/** Black-body colour temperature → linear-ish sRGB 0..1 (Tanner Helland approximation). */
export function kelvinToRGB(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function downloadText(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
