// Plan data model & geometry operations. Units: cm. Plan +x → world +x, plan +y → world +z.
import { uid, dist, projectOnSeg, pointInPoly, deepClone } from '../util.js';
import { ITEM_BY_TYPE, THEME_DEFAULTS } from '../catalog/items.js';
import { getMaterialDef } from '../materials/library.js';

export const ROOM_TYPES = { living: 'Living', kitchen: 'Kitchen', dining: 'Dining', bedroom: 'Bedroom', bathroom: 'Bathroom', hall: 'Hall / entry', office: 'Office', other: 'Other' };

export const ROOM_DEFAULTS = {
  living: { floorMat: 'oak-planks', wallMat: 'paint-warm-white', ceilingMat: 'paint-pure-white' },
  kitchen: { floorMat: 'porcelain-60-grey', wallMat: 'paint-warm-white', ceilingMat: 'paint-pure-white', band: { mat: 'subway-white', from: 90, to: 150, where: 'counters' } },
  dining: { floorMat: 'oak-planks', wallMat: 'paint-warm-white', ceilingMat: 'paint-pure-white' },
  bedroom: { floorMat: 'oak-planks', wallMat: 'paint-greige', ceilingMat: 'paint-pure-white' },
  bathroom: { floorMat: 'hex-white-marble', wallMat: 'paint-pure-white', ceilingMat: 'paint-pure-white', band: { mat: 'subway-white', from: 0, to: 210, where: 'all' } },
  hall: { floorMat: 'oak-planks', wallMat: 'paint-warm-white', ceilingMat: 'paint-pure-white' },
  office: { floorMat: 'oak-planks', wallMat: 'paint-sage', ceilingMat: 'paint-pure-white' },
  other: { floorMat: 'porcelain-60-beige', wallMat: 'paint-warm-white', ceilingMat: 'paint-pure-white' },
};

export const DOOR_STYLES = { interior: 'Interior door', entry: 'Entry door', glass: 'French glass door', double: 'Double doors', sliding: 'Sliding patio door', pocket: 'Pocket / sliding interior', passage: 'Open passage' };
export const WINDOW_STYLES = { casement: 'Casement (2 panes)', single: 'Single pane', sliding: 'Sliding', picture: 'Picture window', grid: 'Divided lites', frosted: 'Frosted (bathroom)', tall: 'Floor-to-ceiling' };

export const OPENING_PRESETS = {
  door: {
    interior: { width: 80, height: 210 }, entry: { width: 95, height: 215 }, glass: { width: 80, height: 210 },
    double: { width: 140, height: 215 }, sliding: { width: 220, height: 220 }, pocket: { width: 80, height: 210 }, passage: { width: 90, height: 215 },
  },
  window: {
    casement: { width: 120, height: 140, sill: 90 }, single: { width: 80, height: 120, sill: 100 }, sliding: { width: 160, height: 140, sill: 90 },
    picture: { width: 200, height: 160, sill: 60 }, grid: { width: 100, height: 140, sill: 90 }, frosted: { width: 60, height: 60, sill: 160 },
    tall: { width: 140, height: 230, sill: 5 },
  },
};

export function blankPlan(name = 'Untitled plan') {
  return {
    version: 1,
    name,
    defaults: { wallHeight: 260, extThickness: 20, intThickness: 10 },
    exteriorMat: 'exterior-render',
    theme: { ...THEME_DEFAULTS },
    materials: {},
    walls: [],
    openings: [],
    rooms: [],
    items: [],
  };
}

export function normalizePlan(p) {
  const base = blankPlan();
  const plan = { ...base, ...p, defaults: { ...base.defaults, ...(p.defaults || {}) }, theme: { ...base.theme, ...(p.theme || {}) } };
  for (const w of plan.walls) w.sides ||= { A: {}, B: {} };
  for (const r of plan.rooms) r.light ||= { on: true, power: 1 };
  for (const it of plan.items) it.mats ||= {};
  for (const o of plan.openings) o.mats ||= {};
  return plan;
}

// ---------------- walls ----------------
export const wallLen = (w) => dist(w.a, w.b);
export function wallDir(w) {
  const L = wallLen(w) || 1;
  return { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L };
}
/** Unit normal pointing to side A. */
export function wallNormal(w) {
  const d = wallDir(w);
  return { x: -d.y, y: d.x };
}

export function makeWall(plan, a, b, thickness) {
  return {
    id: uid('w'),
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    thickness: thickness ?? plan.defaults.intThickness,
    height: null,
    sides: { A: {}, B: {} },
  };
}

function collinearOverlap(w, a, b) {
  const L = dist(a, b);
  if (L < 1) return null;
  const pa = projectOnSeg(w.a, a, b), pb = projectOnSeg(w.b, a, b);
  // both endpoints of w must lie on the infinite line a-b
  const dx = (b.x - a.x) / L, dy = (b.y - a.y) / L;
  const off = (p) => Math.abs((p.x - a.x) * -dy + (p.y - a.y) * dx);
  if (off(w.a) > 1 || off(w.b) > 1) return null;
  const ta = ((w.a.x - a.x) * dx + (w.a.y - a.y) * dy) / L;
  const tb = ((w.b.x - a.x) * dx + (w.b.y - a.y) * dy) / L;
  void pa; void pb;
  const lo = Math.max(0, Math.min(ta, tb)), hi = Math.min(1, Math.max(ta, tb));
  return hi - lo > 1e-3 ? [lo, hi] : null;
}

/** Add a wall, skipping any portion that overlaps an existing collinear wall. Returns created walls. */
export function addWall(plan, a, b, thickness) {
  if (dist(a, b) < 5) return [];
  let segs = [[0, 1]];
  for (const w of plan.walls) {
    const ov = collinearOverlap(w, a, b);
    if (!ov) continue;
    const next = [];
    for (const [s, e] of segs) {
      if (ov[1] <= s || ov[0] >= e) { next.push([s, e]); continue; }
      if (ov[0] > s) next.push([s, ov[0]]);
      if (ov[1] < e) next.push([ov[1], e]);
    }
    segs = next;
  }
  const L = dist(a, b);
  const out = [];
  for (const [s, e] of segs) {
    if ((e - s) * L < 5) continue;
    const p = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const w = makeWall(plan, p(s), p(e), thickness);
    plan.walls.push(w);
    out.push(w);
  }
  for (const w of out) splitAtJunctions(plan, w);
  return out;
}

/** Split walls so that T-junctions become segment endpoints (lets each segment take its own finish). */
export function splitAtJunctions(plan, nw) {
  // existing walls hit by the new wall's endpoints
  for (const k of ['a', 'b']) {
    for (const w of [...plan.walls]) {
      if (w === nw) continue;
      const pr = projectOnSeg(nw[k], w.a, w.b);
      const L = wallLen(w);
      if (pr.d < 1 && pr.t * L > 2 && (1 - pr.t) * L > 2) splitWall(plan, w, pr.t);
    }
  }
  // existing endpoints lying inside the new wall
  const queue = [nw];
  while (queue.length) {
    const cur = queue.pop();
    for (const w of plan.walls) {
      if (w === cur) continue;
      let hit = false;
      for (const k of ['a', 'b']) {
        const pr = projectOnSeg(w[k], cur.a, cur.b);
        const L = wallLen(cur);
        if (pr.d < 1 && pr.t * L > 2 && (1 - pr.t) * L > 2) {
          queue.push(splitWall(plan, cur, pr.t));
          queue.push(cur);
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
  }
}

const COUNTER_SLOTS = new Set(['countertop']);
/** True when a counter-type item stands with its back against this wall side. */
export function wallSideHasCounters(plan, w, side) {
  const n = wallNormal(w);
  const sgn = side === 'A' ? 1 : -1;
  const d = wallDir(w);
  const L = wallLen(w);
  for (const it of plan.items) {
    const def = ITEM_BY_TYPE[it.type];
    if (!def || !def.slots.some((s) => COUNTER_SLOTS.has(s)) || it.type === 'island') continue;
    const a = (it.rot * Math.PI) / 180, s = Math.sin(a), c = Math.cos(a);
    const front = { x: -s, y: c };
    if ((front.x * n.x + front.y * n.y) * sgn < 0.7) continue;
    const back = { x: it.x - (front.x * it.d) / 2, y: it.y - (front.y * it.d) / 2 };
    const rel = { x: back.x - w.a.x, y: back.y - w.a.y };
    const off = (rel.x * n.x + rel.y * n.y) * sgn - w.thickness / 2;
    const along = rel.x * d.x + rel.y * d.y;
    if (Math.abs(off) < 15 && along > -it.w / 2 + 5 && along < L + it.w / 2 - 5) return true;
  }
  return false;
}

export function addRectRoom(plan, x0, y0, x1, y1, opts = {}) {
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  const t = opts.thickness ?? plan.defaults.intThickness;
  const pts = [{ x: ax, y: ay }, { x: bx, y: ay }, { x: bx, y: by }, { x: ax, y: by }];
  if (opts.walls !== false) for (let i = 0; i < 4; i++) addWall(plan, pts[i], pts[(i + 1) % 4], t);
  return addRoom(plan, pts, opts);
}

export function addRoom(plan, pts, opts = {}) {
  const type = opts.type || 'living';
  const d = ROOM_DEFAULTS[type] || ROOM_DEFAULTS.other;
  const room = {
    id: uid('r'),
    name: opts.name || ROOM_TYPES[type] || 'Room',
    type,
    points: pts.map((p) => ({ x: p.x, y: p.y })),
    floorMat: opts.floorMat || d.floorMat,
    wallMat: opts.wallMat || d.wallMat,
    ceilingMat: opts.ceilingMat || d.ceilingMat,
    band: opts.band !== undefined ? opts.band : d.band ? { ...d.band } : null,
    ceilingHeight: opts.ceilingHeight ?? null,
    light: { on: true, power: 1, ...(opts.light || {}) },
  };
  plan.rooms.push(room);
  return room;
}

export function roomAt(plan, p) {
  // smallest room containing p (zones can be nested)
  let best = null, bestA = Infinity;
  for (const r of plan.rooms) {
    if (r.points.length < 3 || !pointInPoly(p, r.points)) continue;
    const a = Math.abs(areaOf(r.points));
    if (a < bestA) { best = r; bestA = a; }
  }
  return best;
}
function areaOf(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  return s / 2;
}

/** Which room each side of a wall faces (null = exterior). */
export function wallSideRooms(plan, w) {
  const n = wallNormal(w);
  const off = w.thickness / 2 + 4;
  const res = { A: null, B: null };
  for (const t of [0.5, 0.25, 0.75, 0.1, 0.9]) {
    const p = { x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t };
    res.A ||= roomAt(plan, { x: p.x + n.x * off, y: p.y + n.y * off });
    res.B ||= roomAt(plan, { x: p.x - n.x * off, y: p.y - n.y * off });
  }
  return res;
}

export function wallHeight(plan, w) {
  return w.height || plan.defaults.wallHeight;
}

/** Resolved finish for a wall side: {mat, band:{mat,from,to}|null, room} */
export function resolveWallSide(plan, w, side, sideRooms) {
  const room = (sideRooms || wallSideRooms(plan, w))[side];
  const s = w.sides?.[side] || {};
  const mat = s.mat || (room ? room.wallMat : plan.exteriorMat);
  let band = null;
  if (s.band?.none) band = null;
  else if (s.band?.mat) band = s.band;
  else if (room?.band?.mat) {
    if (room.band.where !== 'counters' || wallSideHasCounters(plan, w, side)) band = room.band;
  }
  return { mat, band, room };
}

/** How far each wall end should extend to close corners. */
export function wallExtensions(plan, w) {
  const d = wallDir(w);
  const ext = { a: 0, b: 0 };
  for (const o of plan.walls) {
    if (o === w) continue;
    const od = wallDir(o);
    if (Math.abs(d.x * od.x + d.y * od.y) > 0.98) continue; // parallel
    for (const k of ['a', 'b']) {
      const pr = projectOnSeg(w[k], o.a, o.b);
      if (pr.d < 1.5) {
        const sinA = Math.sqrt(Math.max(0.05, 1 - (d.x * od.x + d.y * od.y) ** 2));
        ext[k] = Math.max(ext[k], o.thickness / 2 / sinA - 0.08);
      }
    }
  }
  return ext;
}

/** Openings on a wall sorted by offset, clamped into the wall. */
export function wallOpenings(plan, w) {
  const L = wallLen(w);
  return plan.openings
    .filter((o) => o.wallId === w.id)
    .map((o) => {
      const half = Math.min(o.width, L - 2) / 2;
      const c = Math.min(Math.max(o.offset, half + 1), L - half - 1);
      return { o, s: c - half, e: c + half };
    })
    .sort((m, n) => m.s - n.s);
}

export function openingPos(plan, o) {
  const w = plan.walls.find((x) => x.id === o.wallId);
  if (!w) return null;
  const d = wallDir(w);
  return { x: w.a.x + d.x * o.offset, y: w.a.y + d.y * o.offset, wall: w, dir: d };
}

export function addOpening(plan, kind, style, wall, offset, extra = {}) {
  const pre = OPENING_PRESETS[kind][style] || {};
  const o = {
    id: uid('o'),
    wallId: wall.id,
    kind,
    style,
    offset,
    width: pre.width,
    height: pre.height,
    sill: kind === 'window' ? pre.sill : 0,
    flip: false,
    swing: 'A',
    mats: {},
    ...extra,
  };
  plan.openings.push(o);
  return o;
}

export function nearestWall(plan, p, maxD = 30) {
  let best = null;
  for (const w of plan.walls) {
    const pr = projectOnSeg(p, w.a, w.b);
    if (pr.d < maxD && (!best || pr.d < best.d)) best = { wall: w, d: pr.d, t: pr.t, offset: pr.t * wallLen(w), x: pr.x, y: pr.y };
  }
  return best;
}

export function deleteWall(plan, id) {
  plan.walls = plan.walls.filter((w) => w.id !== id);
  plan.openings = plan.openings.filter((o) => o.wallId !== id);
}

/** Split wall at param t (0..1); openings are redistributed. */
export function splitWall(plan, w, t) {
  const L = wallLen(w);
  const p = { x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t };
  const w2 = deepClone(w);
  w2.id = uid('w');
  w2.a = { ...p };
  w.b = { ...p };
  plan.walls.push(w2);
  for (const o of plan.openings) {
    if (o.wallId !== w.id) continue;
    if (o.offset > t * L) { o.wallId = w2.id; o.offset -= t * L; }
  }
  return w2;
}

// ---------------- items ----------------
export function makeItem(type, x, y, rot = 0, extra = {}) {
  const d = ITEM_BY_TYPE[type];
  return { id: uid('i'), type, x, y, rot, w: d.w, d: d.d, h: d.h, elev: d.elev, mats: {}, ...extra };
}

export function resolveSlot(plan, owner, slot) {
  const id = owner?.mats?.[slot] || plan.theme?.[slot] || THEME_DEFAULTS[slot];
  return getMaterialDef(plan, id) || getMaterialDef(plan, THEME_DEFAULTS[slot]);
}

export function itemCorners(it) {
  const a = (it.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({ x: it.x + (u * it.w * c) / 2 - (v * it.d * s) / 2, y: it.y + (u * it.w * s) / 2 + (v * it.d * c) / 2 }));
}

export function planBounds(plan) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); };
  plan.walls.forEach((w) => { add(w.a); add(w.b); });
  plan.rooms.forEach((r) => r.points.forEach(add));
  plan.items.forEach((i) => add(i));
  if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 600, y1: 400 };
  return { x0, y0, x1, y1 };
}

/** Move every wall endpoint / room vertex that coincides with `from`. */
export function moveVertex(plan, from, to, tol = 1) {
  for (const w of plan.walls) for (const k of ['a', 'b']) if (dist(w[k], from) < tol) { w[k].x = to.x; w[k].y = to.y; }
  for (const r of plan.rooms) for (const p of r.points) if (dist(p, from) < tol) { p.x = to.x; p.y = to.y; }
}
