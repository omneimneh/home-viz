// Parametric doors & windows. Built in a local frame centred on the opening at floor
// level on the wall centreline: x along the wall, z towards side A, y up. Metres.
import * as THREE from 'three';
import { makeBuilder } from './builder.js';

export function buildOpening(o, wallT, getMat, doorAngle = 70) {
  const g = new THREE.Group();
  const b = makeBuilder(g, getMat, { kind: 'opening', openingId: o.id });
  const W = o.width / 100, H = o.height / 100, T = wallT / 100;
  const sill = (o.sill || 0) / 100;
  const fw = 0.05; // frame width
  if (o.kind === 'door') buildDoor(b, g, o, W, H, T, fw, getMat, doorAngle);
  else buildWindow(b, o, W, H, T, sill, fw);
  return g;
}

function casing(b, W, H, T, y0 = 0, withBottom = false) {
  const cw = 0.07, cd = 0.015;
  for (const s of [1, -1]) {
    const z = s * (T / 2 + cd / 2);
    b.box('frame', cw, H + cw, cd, -W / 2 - cw / 2, y0 - (withBottom ? cw : 0), z);
    b.box('frame', cw, H + cw, cd, W / 2 + cw / 2, y0 - (withBottom ? cw : 0), z);
    b.box('frame', W + 2 * cw, cw, cd, 0, y0 + H, z);
    if (withBottom) b.box('frame', W + 2 * cw, cw, cd, 0, y0 - cw, z);
  }
  // jamb lining covering the wall reveal
  b.box('frame', 0.02, H, T, -W / 2 + 0.01, y0, 0);
  b.box('frame', 0.02, H, T, W / 2 - 0.01, y0, 0);
  b.box('frame', W, 0.02, T, 0, y0 + H - 0.02, 0);
}

function leaf(b, g, getMat, o, lw, H, hingeX, dir, swingSign, angle, style, zBase) {
  // dir: +1 leaf extends to +x from hinge, -1 to -x
  const pivot = new THREE.Group();
  pivot.position.set(hingeX, 0, zBase);
  const rad = (angle * Math.PI) / 180;
  pivot.rotation.y = (dir > 0 ? -1 : 1) * swingSign * rad;
  g.add(pivot);
  const lb = makeBuilder(pivot, getMat, { kind: 'opening', openingId: o.id });
  const t = style === 'entry' ? 0.06 : 0.04;
  const cx = (dir * lw) / 2;
  const zc = swingSign * (t / 2);
  if (style === 'glass') {
    const s = 0.1;
    lb.box('door', s, H, t, cx - (dir * (lw - s)) / 2, 0, zc);
    lb.box('door', s, H, t, cx + (dir * (lw - s)) / 2, 0, zc);
    lb.box('door', lw, s, t, cx, 0, zc);
    lb.box('door', lw, 0.2, t, cx, 0, zc);
    lb.box('door', lw, s, t, cx, H - s, zc);
    lb.box('door', lw - 2 * s, 0.03, t * 0.6, cx, H / 2, zc);
    lb.box('glass', lw - 2 * s, H - 0.3, 0.008, cx, 0.2, zc, { cast: false });
  } else {
    lb.box('door', lw, H, t, cx, 0, zc);
    if (style === 'entry' || style === 'double') {
      for (const s of [1, -1]) for (const [py, ph] of [[0.15, 0.7], [1.0, 0.95]]) {
        lb.box('door', lw - 0.2, Math.min(ph, H - py - 0.12), 0.012, cx, py, zc + s * (t / 2 + 0.004), {});
      }
    }
  }
  // handle on both faces
  const hx = dir * (lw - 0.07);
  for (const s of [1, -1]) {
    lb.box('metal', 0.02, 0.02, 0.05, hx, 1.03, zc + s * (t / 2 + 0.025));
    lb.box('metal', 0.13, 0.02, 0.02, hx - dir * 0.055, 1.03, zc + s * (t / 2 + 0.05));
  }
  return pivot;
}

function buildDoor(b, g, o, W, H, T, fw, getMat, angle) {
  const style = o.style;
  casing(b, W, H, T);
  if (style === 'passage') return;
  const swingSign = o.swing === 'B' ? -1 : 1;
  const zFace = swingSign * (T / 2 - 0.0);
  const lwAll = W - 0.02;
  if (style === 'sliding') {
    // two glazed panels, one slid open
    const pw = W / 2 + 0.03, open = Math.min(1, angle / 90) * (W / 2 - 0.1);
    for (const [i, off] of [[0, 0], [1, -open]]) {
      const x = (i ? W / 4 : -W / 4) + off;
      const z = (i ? 0.03 : -0.03);
      b.box('frame', pw, 0.06, 0.05, x, 0, z);
      b.box('frame', pw, 0.06, 0.05, x, H - 0.08, z);
      b.box('frame', 0.06, H - 0.02, 0.05, x - pw / 2 + 0.03, 0, z);
      b.box('frame', 0.06, H - 0.02, 0.05, x + pw / 2 - 0.03, 0, z);
      b.box('glass', pw - 0.1, H - 0.14, 0.01, x, 0.06, z, { cast: false });
    }
    return;
  }
  if (style === 'pocket') {
    const open = Math.min(1, angle / 90) * (W - 0.15);
    const lb = makeBuilder(g, getMat, { kind: 'opening', openingId: o.id });
    lb.box('door', lwAll, H - 0.01, 0.035, -open * (o.flip ? -1 : 1), 0, 0);
    return;
  }
  const double = style === 'double' || (style === 'glass' && W >= 1.2);
  if (double) {
    const lw = lwAll / 2;
    leaf(b, g, getMat, o, lw, H - 0.01, -W / 2 + 0.01, 1, swingSign, angle, style === 'double' ? 'double' : 'glass', zFace);
    leaf(b, g, getMat, o, lw, H - 0.01, W / 2 - 0.01, -1, swingSign, angle, style === 'double' ? 'double' : 'glass', zFace);
  } else {
    const hingeLeft = !o.flip;
    leaf(b, g, getMat, o, lwAll, H - 0.01, hingeLeft ? -W / 2 + 0.01 : W / 2 - 0.01, hingeLeft ? 1 : -1, swingSign, angle, style, zFace);
  }
  void fw;
}

function sash(b, x, y, w, h, z, depth, glassSlot = 'glass', grid = null) {
  const f = 0.05;
  b.box('frame', w, f, depth, x, y, z);
  b.box('frame', w, f, depth, x, y + h - f, z);
  b.box('frame', f, h - 2 * f, depth, x - w / 2 + f / 2, y + f, z);
  b.box('frame', f, h - 2 * f, depth, x + w / 2 - f / 2, y + f, z);
  b.box(glassSlot, w - 2 * f, h - 2 * f, 0.008, x, y + f, z, { cast: false });
  if (grid) {
    const [nx, ny] = grid;
    for (let i = 1; i < nx; i++) b.box('frame', 0.02, h - 2 * f, depth * 0.6, x - w / 2 + f + (i * (w - 2 * f)) / nx, y + f, z);
    for (let j = 1; j < ny; j++) b.box('frame', w - 2 * f, 0.02, depth * 0.6, x, y + f + (j * (h - 2 * f)) / ny, z);
  }
}

function buildWindow(b, o, W, H, T, sill, fw) {
  const style = o.style;
  const depth = 0.07;
  // outer frame
  b.box('frame', W, fw, depth, 0, sill, 0);
  b.box('frame', W, fw, depth, 0, sill + H - fw, 0);
  b.box('frame', fw, H - 2 * fw, depth, -W / 2 + fw / 2, sill + fw, 0);
  b.box('frame', fw, H - 2 * fw, depth, W / 2 - fw / 2, sill + fw, 0);
  // reveal lining & sills (interior on both sides for simplicity; exterior sill on the outer face)
  b.box('frame', 0.015, H, T, -W / 2, sill, 0);
  b.box('frame', 0.015, H, T, W / 2, sill, 0);
  b.box('frame', W, 0.015, T, 0, sill + H - 0.015, 0);
  for (const s of [1, -1]) b.box('frame', W + 0.06, 0.025, T / 2 + 0.03, 0, sill - 0.025, s * (T / 4 + 0.015));

  const iw = W - 2 * fw, ih = H - 2 * fw, y0 = sill + fw;
  const glass = style === 'frosted' ? 'frosted' : 'glass';
  switch (style) {
    case 'casement':
      sash(b, -iw / 4, y0, iw / 2, ih, 0, 0.05, glass);
      sash(b, iw / 4, y0, iw / 2, ih, 0, 0.05, glass);
      break;
    case 'sliding':
      sash(b, -iw / 4 + 0.02, y0, iw / 2 + 0.04, ih, -0.015, 0.03, glass);
      sash(b, iw / 4 - 0.02, y0, iw / 2 + 0.04, ih, 0.015, 0.03, glass);
      break;
    case 'grid':
      sash(b, -iw / 4, y0, iw / 2, ih, 0, 0.05, glass, [2, 3]);
      sash(b, iw / 4, y0, iw / 2, ih, 0, 0.05, glass, [2, 3]);
      break;
    case 'tall': {
      const tr = Math.min(0.5, ih * 0.22);
      sash(b, 0, y0, iw, ih - tr, 0, 0.05, glass);
      sash(b, 0, y0 + ih - tr, iw, tr, 0, 0.05, glass);
      break;
    }
    default:
      sash(b, 0, y0, iw, ih, 0, 0.04, glass);
  }
}
