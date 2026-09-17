// Procedural, seamlessly tiling surface patterns drawn at real-world scale (cm).
// A generator returns a repeat unit (w×h cm) and a list of tiles; the renderer paints
// each tile (with wrap-around copies) and strokes grout lines on top.

import { mulberry32, hashInts, shade, rgba, hexToRgb, clamp } from '../util.js';

const SQ3 = Math.sqrt(3);

export const PATTERN_INFO = {
  solid: { label: 'Solid / paint', fields: [] },
  slab: { label: 'Slab (seamless)', fields: ['tileW', 'tileH'] },
  grid: { label: 'Square / grid', fields: ['tileW', 'tileH', 'grout'] },
  brick: { label: 'Offset (subway / brick)', fields: ['tileW', 'tileH', 'grout', 'offset'] },
  herringbone: { label: 'Herringbone', fields: ['tileW', 'tileH', 'grout'] },
  chevron: { label: 'Chevron', fields: ['tileW', 'tileH', 'grout'] },
  basketweave: { label: 'Basketweave', fields: ['tileW', 'grout'] },
  hex: { label: 'Hexagon', fields: ['tileW', 'grout'] },
  penny: { label: 'Penny round', fields: ['tileW', 'grout'] },
  fishscale: { label: 'Fish scale / fan', fields: ['tileW', 'grout'] },
  octagon: { label: 'Octagon & dot', fields: ['tileW', 'grout'] },
  diamond: { label: 'Diamond (45°)', fields: ['tileW', 'grout'] },
  checker: { label: 'Checkerboard', fields: ['tileW', 'grout'] },
  motif: { label: 'Cement / encaustic motif', fields: ['tileW', 'grout', 'motif', 'motifRotate'] },
  planks: { label: 'Planks (random stagger)', fields: ['tileW', 'tileH', 'grout'] },
  stripes: { label: 'Stripes', fields: ['tileW'] },
  plaid: { label: 'Plaid / check fabric', fields: ['tileW'] },
  image: { label: 'Photo tile', fields: ['tileW', 'tileH', 'grout', 'layout'] },
};

export const SURFACES = {
  flat: 'Flat / glazed', paint: 'Paint', marble: 'Marble', wood: 'Wood', terrazzo: 'Terrazzo',
  concrete: 'Concrete', speckle: 'Granite / quartz', zellige: 'Zellige (handmade)', stone: 'Travertine / stone',
  brick: 'Brick', fabric: 'Fabric weave', boucle: 'Bouclé', metal: 'Brushed metal', deco: 'Art-deco fan', jute: 'Jute / sisal',
};

export const MOTIFS = ['quatrefoil', 'star', 'ogee', 'petal', 'triangles', 'truchet', 'trellis', 'leaf', 'cross', 'circles'];
export const LAYOUTS = { grid: 'Grid', brick: 'Half offset', mirror: 'Mirror alternate', rotate: 'Rotate 90° alternate', random: 'Random rotation' };

export const PATTERN_DEFAULTS = {
  tileW: 30, tileH: 30, grout: 2, groutColor: '#d8d4cc', colors: ['#e8e4dc'], mix: 'first',
  variation: 0.04, surface: 'flat', veinColor: '#8a8a8a', offset: 0.5, motif: 'quatrefoil',
  motifRotate: false, grain: 0.025, layout: 'grid', chipColors: null,
};

const reps = (size, target = 90, max = 24) => clamp(Math.round(target / size), 1, max);
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function poly(pts, extra) { return { kind: 'poly', pts, ...extra }; }

function pick(p, i, j, rng) {
  const n = p.colors.length;
  if (n <= 1) return 0;
  if (p.mix === 'alternate') return (i + j) % n;
  if (p.mix === 'random') return Math.floor(rng() * n);
  return 0;
}

// ---------------- generators ----------------
const GEN = {
  solid(p) {
    return { w: 100, h: 100, tiles: [poly(rectPts(0, 0, 100, 100), { seamless: true, c: 0, seed: 7 })], grout: 0 };
  },
  slab(p) {
    const w = p.tileW, h = p.tileH;
    return { w, h, tiles: [poly(rectPts(0, 0, w, h), { seamless: true, c: 0, seed: 11 })], grout: 0 };
  },
  grid(p) {
    const w = p.tileW, h = p.tileH, nx = reps(w), ny = reps(h);
    const tiles = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const seed = hashInts(i, j, 1);
        tiles.push(poly(rectPts(i * w, j * h, w, h), { c: pick(p, i, j, mulberry32(seed)), seed, dir: w >= h ? 0 : Math.PI / 2 }));
      }
    return { w: nx * w, h: ny * h, tiles };
  },
  checker(p) {
    const w = p.tileW, n = reps(w, 90, 12) * 2;
    const tiles = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++)
        tiles.push(poly(rectPts(i * w, j * w, w, w), { c: (i + j) % Math.max(1, Math.min(2, p.colors.length)), seed: hashInts(i, j, 2) }));
    return { w: n * w, h: n * w, tiles };
  },
  brick(p) {
    const w = p.tileW, h = p.tileH, off = p.offset || 0;
    const period = off > 0 ? Math.max(1, Math.round(1 / off)) : 1;
    const nx = reps(w), rows = period * Math.max(1, Math.ceil(reps(h) / period));
    const tiles = [];
    for (let j = 0; j < rows; j++) {
      const shift = ((j * off) % 1) * w;
      for (let i = 0; i < nx; i++) {
        const seed = hashInts(i, j, 3);
        tiles.push(poly(rectPts(i * w + shift, j * h, w, h), { c: pick(p, i, j, mulberry32(seed)), seed, dir: w >= h ? 0 : Math.PI / 2 }));
      }
    }
    return { w: nx * w, h: rows * h, tiles };
  },
  herringbone(p) {
    const L = Math.max(p.tileW, p.tileH);
    const r = Math.max(2, Math.round(L / Math.min(p.tileW, p.tileH)));
    const W = L / r, U = 2 * L;
    const tiles = [];
    const mod = (v) => ((v % U) + U) % U;
    const n = Math.ceil(U / W) + 4;
    for (let s = -4; s <= 4; s++)
      for (let k = -n; k <= n; k++) {
        const ax = k * W + s * L, ay = k * W - s * L;
        if (ax < 0 || ax >= U - 1e-6 || ay < 0 || ay >= U - 1e-6) continue;
        const sh = hashInts(mod(ax), mod(ay), 4), sv = hashInts(mod(ax), mod(ay), 5);
        tiles.push(poly(rectPts(ax, ay, L, W), { c: pick(p, k, s, mulberry32(sh)), seed: sh, dir: 0 }));
        tiles.push(poly(rectPts(ax + L, ay + W - L, W, L), { c: pick(p, k + 1, s, mulberry32(sv)), seed: sv, dir: Math.PI / 2 }));
      }
    return { w: U, h: U, tiles };
  },
  chevron(p) {
    const L = Math.max(p.tileW, p.tileH), W = Math.min(p.tileW, p.tileH);
    const cw = L * Math.SQRT1_2, H = W * Math.SQRT2;
    const rows = Math.max(2, Math.ceil(90 / H));
    const cols = Math.max(1, Math.round(60 / (2 * cw)));
    const tiles = [];
    for (let c = 0; c < cols; c++)
      for (let j = 0; j < rows; j++) {
        const x = c * 2 * cw, y = j * H;
        const s1 = hashInts(c, j, 6), s2 = hashInts(c, j, 7);
        tiles.push(poly([[x, y + cw], [x + cw, y], [x + cw, y + H], [x, y + cw + H]], { c: pick(p, j, 0, mulberry32(s1)), seed: s1, dir: -Math.PI / 4 }));
        tiles.push(poly([[x + cw, y], [x + 2 * cw, y + cw], [x + 2 * cw, y + cw + H], [x + cw, y + H]], { c: pick(p, j, 1, mulberry32(s2)), seed: s2, dir: Math.PI / 4 }));
      }
    return { w: cols * 2 * cw, h: rows * H, tiles };
  },
  basketweave(p) {
    const S = p.tileW, n = reps(S * 2, 90, 8) * 2;
    const tiles = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = i * S, y = j * S, horiz = (i + j) % 2 === 0;
        for (let k = 0; k < 2; k++) {
          const seed = hashInts(i, j, k, 8);
          const pts = horiz ? rectPts(x, y + (k * S) / 2, S, S / 2) : rectPts(x + (k * S) / 2, y, S / 2, S);
          tiles.push(poly(pts, { c: pick(p, i, j, mulberry32(seed)), seed, dir: horiz ? 0 : Math.PI / 2 }));
        }
      }
    return { w: n * S, h: n * S, tiles };
  },
  hex(p) {
    const w = p.tileW, R = w / SQ3, hh = 2 * R, dy = 1.5 * R;
    const nx = reps(w, 80, 16), ny = 2 * Math.max(1, Math.round(reps(dy, 80, 16) / 2));
    const tiles = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const cx = i * w + (j % 2 ? w / 2 : 0) + w / 2, cy = j * dy + R;
        const pts = [];
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 6 + (k * Math.PI) / 3;
          pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
        }
        const seed = hashInts(i, j, 9);
        tiles.push(poly(pts, { c: pick(p, i, j, mulberry32(seed)), seed }));
      }
    void hh;
    return { w: nx * w, h: ny * dy, tiles };
  },
  penny(p) {
    const d = p.tileW, dy = (d * SQ3) / 2;
    const nx = reps(d, 40, 20), ny = 2 * Math.max(1, Math.round(reps(dy, 40, 20) / 2));
    const tiles = [];
    const r = d / 2 - (p.grout || 1) / 20;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const seed = hashInts(i, j, 10);
        tiles.push({ kind: 'circle', cx: i * d + (j % 2 ? d / 2 : 0) + d / 2, cy: j * dy + d / 2, r, c: pick(p, i, j, mulberry32(seed)), seed });
      }
    return { w: nx * d, h: ny * dy, tiles, noStroke: true };
  },
  fishscale(p) {
    const w = p.tileW, r = w / 2;
    const nx = reps(w, 60, 12), ny = 2 * Math.max(1, Math.round(reps(r, 60, 24) / 2));
    const tiles = [];
    for (let j = -2; j <= ny + 2; j++)
      for (let i = -1; i <= nx + 1; i++) {
        const jm = ((j % ny) + ny) % ny, im = ((i % nx) + nx) % nx;
        const seed = hashInts(im, jm, 11);
        tiles.push({ kind: 'circle', cx: i * w + (Math.abs(j) % 2 ? r : 0), cy: j * r, r, c: pick(p, im, jm, mulberry32(seed)), seed });
      }
    return { w: nx * w, h: ny * r, tiles, ordered: true, noWrap: true };
  },
  octagon(p) {
    const s = p.tileW, a = s / (1 + Math.SQRT2), c = (s - a) / 2;
    const n = reps(s, 60, 12);
    const tiles = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = i * s, y = j * s, seed = hashInts(i, j, 12);
        tiles.push(poly([[x + c, y], [x + c + a, y], [x + s, y + c], [x + s, y + c + a], [x + c + a, y + s], [x + c, y + s], [x, y + c + a], [x, y + c]], { c: 0, seed }));
        tiles.push(poly([[x + c, y], [x, y + c], [x - c, y], [x, y - c]], { c: p.colors.length > 1 ? 1 : 0, seed: seed + 1 }));
      }
    return { w: n * s, h: n * s, tiles };
  },
  diamond(p) {
    const d = p.tileW * Math.SQRT2, n = reps(d, 60, 12);
    const tiles = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = i * d, y = j * d;
        for (const [cx, cy, k] of [[x + d / 2, y + d / 2, 0], [x, y, 1]]) {
          const seed = hashInts(i, j, k, 13);
          tiles.push(poly([[cx, cy - d / 2], [cx + d / 2, cy], [cx, cy + d / 2], [cx - d / 2, cy]], { c: p.mix === 'first' ? 0 : k % p.colors.length, seed, dir: Math.PI / 4 }));
        }
      }
    return { w: n * d, h: n * d, tiles };
  },
  motif(p) {
    const s = p.tileW, n = reps(s, 80, 8) * (p.motifRotate ? 2 : 1);
    const tiles = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const seed = hashInts(i, j, 14);
        tiles.push(poly(rectPts(i * s, j * s, s, s), { c: 0, seed, motif: true, rot: p.motifRotate ? Math.floor(mulberry32(seed)() * 4) : 0 }));
      }
    return { w: n * s, h: n * s, tiles };
  },
  planks(p) {
    const W = Math.min(p.tileW, p.tileH), L = Math.max(p.tileW, p.tileH);
    const U = 2 * L, rows = Math.max(4, Math.round(120 / W));
    const tiles = [];
    for (let j = 0; j < rows; j++) {
      const rng = mulberry32(hashInts(j, 15));
      const start = rng() * L;
      const cuts = [0];
      const nPieces = rng() < 0.5 ? 2 : 3;
      if (nPieces === 2) cuts.push(L * (0.7 + rng() * 0.6));
      else { cuts.push(L * (0.45 + rng() * 0.3)); cuts.push(L * (1.15 + rng() * 0.4)); }
      cuts.push(U);
      for (let k = 0; k + 1 < cuts.length; k++) {
        const seed = hashInts(j, k, 16);
        tiles.push(poly(rectPts(start + cuts[k], j * W, cuts[k + 1] - cuts[k], W), { c: pick(p, k, j, mulberry32(seed)), seed, dir: 0 }));
      }
    }
    return { w: U, h: rows * W, tiles };
  },
  stripes(p) {
    const w = p.tileW, n = p.colors.length;
    const widths = p.widths || p.colors.map(() => w);
    const total = widths.reduce((a, b) => a + b, 0);
    const tiles = [];
    let x = 0;
    for (let i = 0; i < n; i++) {
      tiles.push(poly(rectPts(x, 0, widths[i], total), { c: i, seed: hashInts(i, 17), seamlessY: true }));
      x += widths[i];
    }
    return { w: total, h: total, tiles, grout: 0 };
  },
  plaid(p) {
    return { w: p.tileW, h: p.tileW, tiles: [poly(rectPts(0, 0, p.tileW, p.tileW), { c: 0, seed: 18, plaid: true })], grout: 0 };
  },
  image(p) {
    const w = p.tileW, h = p.tileH;
    const layout = p.layout || 'grid';
    const nx = layout === 'random' ? 4 : 2, ny = layout === 'random' ? 4 : 2;
    const tiles = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const seed = hashInts(i, j, 19);
        let x = i * w, rot = 0, flipX = false, flipY = false;
        if (layout === 'brick' && j % 2) x += w / 2;
        if (layout === 'mirror') { flipX = i % 2 === 1; flipY = j % 2 === 1; }
        if (layout === 'rotate') rot = (i + j) % 2;
        if (layout === 'random') rot = Math.floor(mulberry32(seed)() * 4);
        if (w !== h && rot % 2) rot = rot === 1 ? 2 : 0; // only 180° for non-square tiles
        tiles.push(poly(rectPts(x, j * h, w, h), { c: 0, seed, image: true, rot, flipX, flipY }));
      }
    return { w: nx * w, h: ny * h, tiles };
  },
};

// ---------------- painting ----------------
function tilePath(t) {
  const path = new Path2D();
  if (t.kind === 'circle') path.arc(t.cx, t.cy, t.r, 0, Math.PI * 2);
  else {
    path.moveTo(t.pts[0][0], t.pts[0][1]);
    for (let i = 1; i < t.pts.length; i++) path.lineTo(t.pts[i][0], t.pts[i][1]);
    path.closePath();
  }
  return path;
}
function bbox(t) {
  if (t.kind === 'circle') return { x: t.cx - t.r, y: t.cy - t.r, w: 2 * t.r, h: 2 * t.r };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of t.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function tileColor(p, t, rng) {
  const base = p.colors[t.c % p.colors.length] || '#cccccc';
  const v = p.variation || 0;
  const amt = 1 + (rng() - 0.5) * 2 * v;
  const warm = (rng() - 0.5) * v * 2;
  return shade(base, amt, warm);
}

function baseFill(ctx, p, t, b, rng, color) {
  ctx.fillStyle = color;
  ctx.fillRect(b.x - 0.5, b.y - 0.5, b.w + 1, b.h + 1);
}

function details(ctx, p, t, b, rng, color, env) {
  const surf = p.surface;
  const baseHex = p.colors[t.c % p.colors.length] || '#cccccc';
  if (t.motif) return drawMotif(ctx, p, t, b, rng);
  if (t.image) return drawImage(ctx, p, t, b, env);
  if (t.plaid) return drawPlaid(ctx, p, b);
  switch (surf) {
    case 'paint': blotches(ctx, b, rng, 14, baseHex, 0.04, 0.35); break;
    case 'marble': marble(ctx, p, b, rng, baseHex); break;
    case 'wood': wood(ctx, p, t, b, rng, baseHex); break;
    case 'terrazzo': terrazzo(ctx, p, b, rng, baseHex); break;
    case 'concrete': concrete(ctx, b, rng, baseHex); break;
    case 'speckle': speckle(ctx, p, b, rng, baseHex); break;
    case 'zellige': zellige(ctx, b, rng, baseHex); break;
    case 'stone': stone(ctx, b, rng, baseHex); break;
    case 'brick': blotches(ctx, b, rng, 6, baseHex, 0.12, 0.5); dots(ctx, b, rng, 0.6, [shade(baseHex, 0.7), shade(baseHex, 1.2)], 0.12); break;
    case 'fabric': fabric(ctx, b, baseHex, 0.18); break;
    case 'boucle': boucle(ctx, b, rng, baseHex); break;
    case 'jute': jute(ctx, b, rng, baseHex); break;
    case 'metal': metal(ctx, b, rng, baseHex); break;
    case 'deco': deco(ctx, p, t, baseHex); break;
    default: {
      if (t.seamless) break;
      // glazed tiles: faint soft highlight to break flatness
      const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      g.addColorStop(0, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.04)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }
  void color;
}

function blotches(ctx, b, rng, n, hex, alpha, sizeF) {
  for (let i = 0; i < n; i++) {
    const x = b.x + rng() * b.w, y = b.y + rng() * b.h, r = (0.2 + rng() * sizeF) * Math.max(b.w, b.h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = rng() < 0.5 ? shade(hex, 0.85) : shade(hex, 1.12);
    g.addColorStop(0, c.replace('rgb', 'rgba').replace(')', `,${alpha})`));
    g.addColorStop(1, c.replace('rgb', 'rgba').replace(')', ',0)'));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}
function dots(ctx, b, rng, density, colors, size) {
  const n = Math.min(6000, Math.round(b.w * b.h * density));
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    const s = size * (0.4 + rng());
    ctx.fillRect(b.x + rng() * b.w, b.y + rng() * b.h, s, s);
  }
}
function marble(ctx, p, b, rng, hex) {
  blotches(ctx, b, rng, 10, hex, 0.12, 0.6);
  const vein = p.veinColor || '#888';
  const S = Math.max(b.w, b.h);
  const nv = 2 + Math.floor(rng() * 3);
  ctx.lineCap = 'round';
  for (let v = 0; v < nv; v++) {
    // random walk crossing the tile
    let x = b.x + rng() * b.w, y = b.y - S * 0.1;
    let ang = Math.PI / 2 + (rng() - 0.5) * 1.6;
    const pts = [[x, y]];
    const step = S / 18;
    for (let k = 0; k < 26; k++) {
      ang += (rng() - 0.5) * 0.7;
      x += Math.cos(ang) * step; y += Math.sin(ang) * step;
      pts.push([x, y]);
    }
    const w0 = S * (0.004 + rng() * 0.01);
    for (const [lw, a] of [[w0 * 6, 0.05], [w0 * 2.5, 0.12], [w0, 0.55 + rng() * 0.3]]) {
      ctx.strokeStyle = rgba(vein, a);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) {
        const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
      }
      ctx.stroke();
    }
    // hairline branches
    ctx.lineWidth = w0 * 0.4;
    ctx.strokeStyle = rgba(vein, 0.35);
    for (let k = 0; k < 3; k++) {
      const s = pts[Math.floor(rng() * pts.length)];
      let bx = s[0], by = s[1], ba = rng() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      for (let q = 0; q < 8; q++) { ba += (rng() - 0.5) * 0.9; bx += Math.cos(ba) * step * 0.6; by += Math.sin(ba) * step * 0.6; ctx.lineTo(bx, by); }
      ctx.stroke();
    }
  }
}
function wood(ctx, p, t, b, rng, hex) {
  const dir = t.dir || 0;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  // tile-local extent along/across the grain
  let along, across;
  if (t.kind === 'poly' && t.pts.length === 4) {
    const e1 = Math.hypot(t.pts[1][0] - t.pts[0][0], t.pts[1][1] - t.pts[0][1]);
    const e2 = Math.hypot(t.pts[2][0] - t.pts[1][0], t.pts[2][1] - t.pts[1][1]);
    along = Math.max(e1, e2) * 1.6; across = Math.max(e1, e2) * 1.6;
  } else { along = Math.max(b.w, b.h) * 1.5; across = along; }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir);
  // tonal bands
  const tone = 0.9 + rng() * 0.2;
  ctx.fillStyle = shade(hex, tone).replace('rgb', 'rgba').replace(')', ',0.5)');
  ctx.fillRect(-along / 2, -across / 2, along, across);
  const lines = Math.round(across / 0.22);
  const phase = rng() * 10, freq = 0.02 + rng() * 0.04, amp = 0.3 + rng() * 1.2;
  for (let i = 0; i < lines; i++) {
    const y0 = -across / 2 + (i / lines) * across;
    const dark = rng();
    ctx.strokeStyle = dark < 0.5 ? rgba('#2a1606', 0.05 + rng() * 0.12) : rgba('#fff3dc', 0.03 + rng() * 0.05);
    ctx.lineWidth = 0.05 + rng() * 0.15;
    ctx.beginPath();
    for (let xx = -along / 2; xx <= along / 2; xx += along / 24) {
      const yy = y0 + Math.sin(xx * freq + phase + i * 0.05) * amp + Math.sin(xx * freq * 3.1 + i) * 0.15;
      if (xx === -along / 2) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  if (rng() < 0.35) {
    const kx = (rng() - 0.5) * along * 0.4, ky = (rng() - 0.5) * across * 0.3;
    for (let r = 3; r > 0; r--) {
      ctx.strokeStyle = rgba('#2a1606', 0.1 + (3 - r) * 0.08);
      ctx.lineWidth = 0.15;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function terrazzo(ctx, p, b, rng, hex) {
  blotches(ctx, b, rng, 6, hex, 0.06, 0.4);
  const chips = p.chipColors || ['#8a8a8a', '#d9d2c5', '#c9a58a', '#5f6b6a', '#ffffff'];
  const n = Math.min(4000, Math.round(b.w * b.h * 0.25));
  for (let i = 0; i < n; i++) {
    const x = b.x + rng() * b.w, y = b.y + rng() * b.h;
    const s = 0.2 + Math.pow(rng(), 3) * 1.8;
    ctx.fillStyle = chips[Math.floor(rng() * chips.length)];
    ctx.beginPath();
    const k = 3 + Math.floor(rng() * 3), a0 = rng() * 6;
    for (let q = 0; q < k; q++) {
      const a = a0 + (q / k) * Math.PI * 2, rr = s * (0.5 + rng() * 0.5);
      q ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.fill();
  }
}
function concrete(ctx, b, rng, hex) {
  blotches(ctx, b, rng, 40, hex, 0.1, 0.25);
  dots(ctx, b, rng, 0.08, [shade(hex, 0.6), shade(hex, 0.75)], 0.12);
}
function speckle(ctx, p, b, rng, hex) {
  blotches(ctx, b, rng, 8, hex, 0.06, 0.4);
  const cols = p.chipColors || [shade(hex, 0.4), shade(hex, 0.7), shade(hex, 1.4)];
  dots(ctx, b, rng, p.density ?? 1.2, cols, 0.18);
}
function zellige(ctx, b, rng, hex) {
  for (let i = 0; i < 5; i++) {
    const x = b.x + rng() * b.w, y = b.y + rng() * b.h, r = Math.max(b.w, b.h) * (0.3 + rng() * 0.5);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = rng() < 0.5;
    g.addColorStop(0, light ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = Math.min(b.w, b.h) * 0.05;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  void hex;
}
function stone(ctx, b, rng, hex) {
  blotches(ctx, b, rng, 10, hex, 0.1, 0.4);
  for (let i = 0; i < b.h / 1.2; i++) {
    const y = b.y + rng() * b.h;
    ctx.strokeStyle = rgba('#6b5a44', 0.05 + rng() * 0.1);
    ctx.lineWidth = 0.1 + rng() * 0.4;
    ctx.beginPath();
    ctx.moveTo(b.x, y);
    for (let x = b.x; x <= b.x + b.w; x += b.w / 10) ctx.lineTo(x, y + (rng() - 0.5) * 0.6);
    ctx.stroke();
  }
  dots(ctx, b, rng, 0.05, [rgba('#5a4a36', 0.5)], 0.4);
}
function fabric(ctx, b, hex, a) {
  const step = 0.18;
  ctx.lineWidth = step * 0.45;
  ctx.strokeStyle = shade(hex, 0.8).replace('rgb', 'rgba').replace(')', `,${a})`);
  ctx.beginPath();
  for (let x = b.x; x < b.x + b.w; x += step) { ctx.moveTo(x, b.y); ctx.lineTo(x, b.y + b.h); }
  ctx.stroke();
  ctx.strokeStyle = shade(hex, 1.15).replace('rgb', 'rgba').replace(')', `,${a})`);
  ctx.beginPath();
  for (let y = b.y; y < b.y + b.h; y += step) { ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); }
  ctx.stroke();
}
function boucle(ctx, b, rng, hex) {
  const n = Math.min(9000, Math.round(b.w * b.h * 3));
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rng() < 0.5 ? shade(hex, 0.85) : shade(hex, 1.08);
    ctx.beginPath();
    ctx.arc(b.x + rng() * b.w, b.y + rng() * b.h, 0.1 + rng() * 0.15, 0, 7);
    ctx.fill();
  }
}
function jute(ctx, b, rng, hex) {
  const step = 0.6;
  for (let y = b.y; y < b.y + b.h; y += step) {
    for (let x = b.x; x < b.x + b.w; x += step) {
      const odd = (Math.round((x - b.x) / step) + Math.round((y - b.y) / step)) % 2;
      ctx.fillStyle = shade(hex, odd ? 0.82 + rng() * 0.1 : 1.05 + rng() * 0.1);
      ctx.beginPath();
      ctx.ellipse(x + step / 2, y + step / 2, step * 0.5, step * 0.3, odd ? Math.PI / 2 : 0, 0, 7);
      ctx.fill();
    }
  }
}
function metal(ctx, b, rng, hex) {
  for (let i = 0; i < b.h * 4; i++) {
    const y = b.y + rng() * b.h;
    ctx.strokeStyle = rng() < 0.5 ? rgba('#ffffff', 0.05) : rgba('#000000', 0.05);
    ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); ctx.stroke();
  }
  void hex;
}
function deco(ctx, p, t, hex) {
  if (t.kind !== 'circle') return;
  ctx.strokeStyle = p.colors[1] || shade(hex, 0.7);
  ctx.lineWidth = t.r * 0.05;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.arc(t.cx, t.cy, t.r * (1 - k * 0.22), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlaid(ctx, p, b) {
  const c = p.colors;
  const s = b.w;
  const bands = [[0.0, 0.18, c[1] || '#444', 0.55], [0.3, 0.05, c[2] || '#ddd', 0.6], [0.55, 0.1, c[1] || '#444', 0.4], [0.8, 0.03, c[3] || c[2] || '#aa3333', 0.7]];
  for (const [o, w, col, a] of bands) {
    ctx.fillStyle = rgba(col, a * 0.6);
    ctx.fillRect(b.x + o * s, b.y, w * s, s);
    ctx.fillRect(b.x, b.y + o * s, s, w * s);
  }
  fabric(ctx, b, c[0], 0.2);
}

function drawMotif(ctx, p, t, b, rng) {
  const s = b.w, c = p.colors;
  const bg = c[0] || '#eee', c1 = c[1] || '#335', c2 = c[2] || c1, c3 = c[3] || c2;
  ctx.save();
  ctx.translate(b.x + s / 2, b.y + s / 2);
  ctx.rotate(((t.rot || 0) * Math.PI) / 2);
  ctx.translate(-s / 2, -s / 2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);
  const circle = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const polyF = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s))); ctx.closePath(); ctx.fill(); };
  switch (p.motif) {
    case 'quatrefoil': {
      for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) circle(x, y, s * 0.3, c1);
      for (const [x, y] of [[0.5, 0.3], [0.5, 0.7], [0.3, 0.5], [0.7, 0.5]]) circle(x * s, y * s, s * 0.14, c2);
      circle(s / 2, s / 2, s * 0.1, bg);
      circle(s / 2, s / 2, s * 0.05, c3);
      break;
    }
    case 'star': {
      const r1 = 0.42, r2 = 0.2;
      const pts = [];
      for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, r = k % 2 ? r2 : r1; pts.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]); }
      polyF(pts, c1);
      circle(s / 2, s / 2, s * 0.12, c2);
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) polyF([[x - 0.12, y], [x, y - 0.12], [x + 0.12, y], [x, y + 0.12]], c3);
      break;
    }
    case 'ogee': {
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(s / 2, 0);
      ctx.bezierCurveTo(s * 0.5, s * 0.25, s * 0.95, s * 0.25, s, s / 2);
      ctx.bezierCurveTo(s * 0.95, s * 0.75, s * 0.5, s * 0.75, s / 2, s);
      ctx.bezierCurveTo(s * 0.5, s * 0.75, s * 0.05, s * 0.75, 0, s / 2);
      ctx.bezierCurveTo(s * 0.05, s * 0.25, s * 0.5, s * 0.25, s / 2, 0);
      ctx.fill();
      ctx.lineWidth = s * 0.03;
      ctx.strokeStyle = c2;
      ctx.stroke();
      circle(s / 2, s / 2, s * 0.08, c2);
      break;
    }
    case 'petal': {
      ctx.fillStyle = c1;
      for (let k = 0; k < 4; k++) {
        ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(Math.PI / 4 + (k * Math.PI) / 2);
        ctx.beginPath(); ctx.ellipse(s * 0.2, 0, s * 0.2, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      circle(s / 2, s / 2, s * 0.07, c2);
      for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) circle(x, y, s * 0.15, c2);
      for (const [x, y] of [[s / 2, 0], [0, s / 2], [s, s / 2], [s / 2, s]]) circle(x, y, s * 0.06, c3);
      break;
    }
    case 'triangles':
      polyF([[0, 0], [1, 0], [0, 1]], c1);
      if (c2 !== c1) polyF([[0, 0], [0.5, 0], [0, 0.5]], c2);
      break;
    case 'truchet':
      ctx.strokeStyle = c1;
      ctx.lineWidth = s * 0.16;
      ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(s, s, s / 2, Math.PI, Math.PI * 1.5); ctx.stroke();
      break;
    case 'trellis':
      ctx.strokeStyle = c1;
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(s / 2, 0); ctx.quadraticCurveTo(s * 0.8, s * 0.2, s, s / 2);
      ctx.quadraticCurveTo(s * 0.8, s * 0.8, s / 2, s);
      ctx.quadraticCurveTo(s * 0.2, s * 0.8, 0, s / 2);
      ctx.quadraticCurveTo(s * 0.2, s * 0.2, s / 2, 0);
      ctx.stroke();
      for (const [x, y] of [[s / 2, 0], [0, s / 2], [s, s / 2], [s / 2, s]]) circle(x, y, s * 0.05, c2);
      break;
    case 'leaf': {
      for (let k = 0; k < 7; k++) {
        const x = rng() * s, y = rng() * s, a = rng() * Math.PI * 2, L = s * (0.12 + rng() * 0.12);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = k % 3 === 0 ? c2 : c1;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(L * 0.5, -L * 0.35, L, 0);
        ctx.quadraticCurveTo(L * 0.5, L * 0.35, 0, 0);
        ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.25); ctx.lineWidth = s * 0.004;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'cross':
      polyF([[0.4, 0.15], [0.6, 0.15], [0.6, 0.4], [0.85, 0.4], [0.85, 0.6], [0.6, 0.6], [0.6, 0.85], [0.4, 0.85], [0.4, 0.6], [0.15, 0.6], [0.15, 0.4], [0.4, 0.4]], c1);
      for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) circle(x, y, s * 0.1, c2);
      break;
    case 'circles':
    default:
      ctx.strokeStyle = c1; ctx.lineWidth = s * 0.04;
      for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s], [s / 2, s / 2]]) { ctx.beginPath(); ctx.arc(x, y, s * 0.35, 0, Math.PI * 2); ctx.stroke(); }
      circle(s / 2, s / 2, s * 0.08, c2);
  }
  ctx.restore();
  // printed cement tiles are matte and slightly uneven
  blotches(ctx, b, rng, 3, '#888888', 0.05, 0.4);
}

const imageCache = new Map();
export function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const rec = { img: new Image(), ready: false, promise: null };
  rec.promise = new Promise((res) => {
    rec.img.onload = () => { rec.ready = true; res(rec.img); };
    rec.img.onerror = () => res(null);
  });
  rec.img.src = src;
  imageCache.set(src, rec);
  return rec;
}

function drawImage(ctx, p, t, b, env) {
  const rec = p.image ? loadImage(p.image) : null;
  if (!rec || !rec.ready) { env.pending = rec?.promise; return; }
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.rotate(((t.rot || 0) * Math.PI) / 2);
  ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
  ctx.drawImage(rec.img, -b.w / 2, -b.h / 2, b.w, b.h);
  ctx.restore();
}

/**
 * Render a pattern definition.
 * @returns {{canvas, bump, w, h, pending}} w/h = physical repeat size in cm.
 */
export function renderPattern(def, maxPx = 1024, opts = {}) {
  const p = { ...PATTERN_DEFAULTS, ...(def.params || {}) };
  if (!Array.isArray(p.colors) || !p.colors.length) p.colors = ['#cccccc'];
  const gen = GEN[def.pattern] || GEN.solid;
  const g = gen(p);
  const ppc = Math.min(opts.maxPpc || 14, maxPx / Math.max(g.w, g.h));
  const cw = Math.max(4, Math.round(g.w * ppc)), ch = Math.max(4, Math.round(g.h * ppc));
  const sx = cw / g.w, sy = ch / g.h;
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  const groutMM = g.grout ?? p.grout;
  const groutCm = groutMM / 10;
  ctx.fillStyle = groutCm > 0 || g.noStroke ? p.groutColor : p.colors[0];
  ctx.fillRect(0, 0, g.w, g.h);

  const env = { pending: null };
  const offsets = g.noWrap ? [[0, 0]] : [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  const items = g.tiles.map((t) => ({ t, b: bbox(t), path: tilePath(t) }));
  const visible = (b, ox, oy) => b.x + ox < g.w && b.x + b.w + ox > 0 && b.y + oy < g.h && b.y + b.h + oy > 0;

  const strokeTile = (it) => {
    if (groutCm <= 0 || g.noStroke) return;
    ctx.strokeStyle = p.groutColor;
    ctx.lineWidth = groutCm;
    ctx.lineJoin = 'miter';
    ctx.stroke(it.path);
  };
  const seamless = items.filter((it) => it.t.seamless);
  // seamless tiles: bases first, then details (so wrapped details are not overpainted)
  for (const phase of [0, 1])
    for (const it of seamless)
      for (const [ox, oy] of offsets) {
        const rng = mulberry32(it.t.seed);
        const color = tileColor(p, it.t, rng);
        ctx.save();
        ctx.translate(ox * g.w, oy * g.h);
        if (phase === 0) baseFill(ctx, p, it.t, it.b, rng, color);
        else details(ctx, p, it.t, it.b, rng, color, env);
        ctx.restore();
      }
  const regular = items.filter((it) => !it.t.seamless);
  for (const it of regular) {
    for (const [ox, oy] of offsets) {
      const dx = ox * g.w, dy = oy * g.h;
      if (!visible(it.b, dx, dy)) continue;
      const rng = mulberry32(it.t.seed);
      const color = tileColor(p, it.t, rng);
      ctx.save();
      ctx.translate(dx, dy);
      ctx.save();
      ctx.clip(it.path);
      baseFill(ctx, p, it.t, it.b, rng, color);
      details(ctx, p, it.t, it.b, rng, color, env);
      ctx.restore();
      if (g.ordered) strokeTile(it);
      ctx.restore();
    }
  }
  if (!g.ordered)
    for (const it of regular)
      for (const [ox, oy] of offsets) {
        if (!visible(it.b, ox * g.w, oy * g.h)) continue;
        ctx.save();
        ctx.translate(ox * g.w, oy * g.h);
        strokeTile(it);
        ctx.restore();
      }

  if (p.grain > 0 && !opts.noGrain) addGrain(ctx, cw, ch, p.grain, def.pattern === 'solid' ? 7 : 3);

  // bump map: grout recessed, tiles raised
  let bump = null;
  if (!opts.noBump && (groutCm > 0 || g.noStroke) && def.pattern !== 'solid' && def.pattern !== 'slab') {
    bump = document.createElement('canvas');
    bump.width = cw; bump.height = ch;
    const b = bump.getContext('2d');
    b.setTransform(sx, 0, 0, sy, 0, 0);
    b.fillStyle = '#000';
    b.fillRect(0, 0, g.w, g.h);
    b.filter = `blur(${Math.max(0.6, groutCm * sx * 0.35)}px)`;
    for (const it of regular)
      for (const [ox, oy] of offsets) {
        if (!visible(it.b, ox * g.w, oy * g.h)) continue;
        b.save();
        b.translate(ox * g.w, oy * g.h);
        b.fillStyle = '#fff';
        b.fill(it.path);
        if (groutCm > 0 && !g.noStroke) { b.strokeStyle = '#000'; b.lineWidth = groutCm * 1.2; b.stroke(it.path); }
        b.restore();
      }
  }
  return { canvas, bump, w: g.w, h: g.h, pending: env.pending };
}

function addGrain(ctx, w, h, amt, period) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const rng = mulberry32(12345);
  const a = amt * 255;
  for (let i = 0; i < d.length; i += 4 * (period > 3 ? 1 : 1)) {
    const n = (rng() - 0.5) * a;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Small preview swatch: repeats the unit to show ~`areaCm` of surface. */
export function renderThumb(def, size = 96) {
  const r = renderPattern(def, 384, { noBump: true, maxPpc: 8 });
  const p = { ...PATTERN_DEFAULTS, ...(def.params || {}) };
  let area = Math.max(r.w, r.h);
  if (def.pattern === 'solid') area = 100;
  else if (def.pattern === 'slab') area = Math.min(r.w, r.h) * 0.6;
  else area = clamp(Math.max(p.tileW, p.tileH) * 3.2, 20, Math.max(r.w, r.h) * 1.5);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const pat = ctx.createPattern(r.canvas, 'repeat');
  const scale = size / area;
  pat.setTransform(new DOMMatrix().scale((scale * r.w) / r.canvas.width, (scale * r.h) / r.canvas.height));
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, size, size);
  return { canvas: c, pending: r.pending };
}

export { hexToRgb };
