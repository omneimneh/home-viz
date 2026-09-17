// 2D floor-plan editor on a canvas. World units: cm.
import { store } from './store.js';
import { ITEM_BY_TYPE } from './catalog/items.js';
import { getMaterialDef } from './materials/library.js';
import { renderPattern } from './materials/patterns.js';
import {
  wallLen, wallDir, wallNormal, wallOpenings, addWall, addRectRoom, addRoom, addOpening, nearestWall,
  makeItem, itemCorners, planBounds, moveVertex, deleteWall, resolveSlot, OPENING_PRESETS,
} from './plan/model.js';
import { dist, projectOnSeg, pointInPoly, polyArea, polyCentroid, fmtM, fmtArea, clamp, uid, deepClone } from './util.js';

const COLORS = {
  bg: '#f4f3ef', grid: '#e4e2dc', grid2: '#d3d0c8', wall: '#2d2f33', wallSel: '#1f6feb', text: '#2d2f33',
  sel: '#1f6feb', hover: 'rgba(31,111,235,0.35)', dim: '#6b6f76', preview: 'rgba(31,111,235,0.8)',
};

const patternCache = new Map();
function floorPattern(ctx, def) {
  if (!def) return null;
  const key = def.id + JSON.stringify(def.params);
  let rec = patternCache.get(key);
  if (!rec) {
    const r = renderPattern(def, 256, { noBump: true, maxPpc: 3 });
    rec = { canvas: r.canvas, w: r.w, h: r.h };
    patternCache.set(key, rec);
    if (r.pending) r.pending.then(() => { patternCache.delete(key); store.emit('redraw2d'); });
  }
  const pat = ctx.createPattern(rec.canvas, 'repeat');
  const m = new DOMMatrix().rotate(def.rot || 0).scale(rec.w / rec.canvas.width, rec.h / rec.canvas.height);
  pat.setTransform(m);
  return pat;
}
const avgCache = new Map();
function avgColor(def) {
  if (!def) return '#ddd';
  const key = def.id + JSON.stringify(def.params);
  if (avgCache.has(key)) return avgCache.get(key);
  let col = def.params?.colors?.[0] || '#dddddd';
  try {
    const r = renderPattern(def, 64, { noBump: true, maxPpc: 1, noGrain: true });
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d');
    x.drawImage(r.canvas, 0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    col = `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch { /* ignore */ }
  avgCache.set(key, col);
  return col;
}

export class Editor2D {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'plan-canvas';
    this.canvas.tabIndex = 0;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.scale = 0.8; // px per cm
    this.ox = 60; this.oy = 60;
    this.tool = 'select';
    this.toolOpts = { wallThickness: 'int', roomType: 'living', createWalls: true, doorStyle: 'interior', windowStyle: 'casement', itemType: null, itemRot: 0, snap: 5 };
    this.drag = null;
    this.hover = null;
    this.draft = null; // in-progress wall chain / polygon
    this.mouse = { x: 0, y: 0, wx: 0, wy: 0 };
    this.cameraMarker = null;
    this.onToolChange = null;

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.bind();
    store.on('change', () => this.draw());
    store.on('select', () => this.draw());
    store.on('redraw2d', () => this.draw());
    store.on('load', () => { this.fit(); this.draw(); });
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.max(1, r.width * dpr);
    this.canvas.height = Math.max(1, r.height * dpr);
    this.canvas.style.width = r.width + 'px';
    this.canvas.style.height = r.height + 'px';
    this.dpr = dpr;
    this.draw();
  }

  fit() {
    if (!store.plan || !this.w) return;
    const bb = planBounds(store.plan);
    const pad = 60;
    const sw = (this.w - pad * 2) / Math.max(200, bb.x1 - bb.x0);
    const sh = (this.h - pad * 2) / Math.max(200, bb.y1 - bb.y0);
    this.scale = clamp(Math.min(sw, sh), 0.1, 6);
    this.ox = this.w / 2 - ((bb.x0 + bb.x1) / 2) * this.scale;
    this.oy = this.h / 2 - ((bb.y0 + bb.y1) / 2) * this.scale;
    this.draw();
  }

  setTool(tool, opts = {}) {
    this.tool = tool;
    Object.assign(this.toolOpts, opts);
    this.draft = null;
    this.drag = null;
    this.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    this.onToolChange?.(tool);
    this.draw();
    this.canvas.focus();
  }

  toWorld(px, py) { return { x: (px - this.ox) / this.scale, y: (py - this.oy) / this.scale }; }
  toScreen(x, y) { return { x: x * this.scale + this.ox, y: y * this.scale + this.oy }; }

  snapPt(p, { free = false, from = null, exclude = null } = {}) {
    const plan = store.plan;
    const tolW = 12 / this.scale;
    const walls = exclude ? plan.walls.filter((w) => dist(w.a, exclude) > 0.5 && dist(w.b, exclude) > 0.5) : plan.walls;
    // vertices
    let best = null;
    for (const w of walls) for (const k of ['a', 'b']) {
      const d = dist(p, w[k]);
      if (d < tolW && (!best || d < best.d)) best = { d, x: w[k].x, y: w[k].y, kind: 'vertex' };
    }
    if (best) return best;
    let q = { ...p };
    if (from && !free) {
      // angle snap to 45° increments
      const dx = p.x - from.x, dy = p.y - from.y;
      const L = Math.hypot(dx, dy);
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      q = { x: from.x + Math.cos(a) * L, y: from.y + Math.sin(a) * L };
      const s = this.toolOpts.snap;
      const Ls = Math.round(L / s) * s;
      q = { x: from.x + Math.cos(a) * Ls, y: from.y + Math.sin(a) * Ls };
      // align with other vertices on the constrained axis
      for (const w of plan.walls) for (const k of ['a', 'b']) {
        if (Math.abs(Math.cos(a)) > 0.99 && Math.abs(w[k].x - q.x) < tolW) q.x = w[k].x;
        if (Math.abs(Math.sin(a)) > 0.99 && Math.abs(w[k].y - q.y) < tolW) q.y = w[k].y;
      }
      return { ...q, kind: 'angle' };
    }
    // on wall line
    const nw = nearestWall({ walls }, p, tolW);
    if (nw && !free) return { x: nw.x, y: nw.y, kind: 'wall' };
    if (!free) {
      const s = this.toolOpts.snap;
      q = { x: Math.round(p.x / s) * s, y: Math.round(p.y / s) * s };
    }
    return { ...q, kind: 'grid' };
  }

  // ------------------------------------------------------------ hit testing
  hitTest(p) {
    const plan = store.plan;
    const tol = 8 / this.scale;
    const sel = store.selection;
    // camera marker
    if (this.cameraMarker?.walk) {
      const c = this.cameraMarker;
      const tip = { x: c.x - Math.sin(c.yaw) * (40 / this.scale), y: c.y - Math.cos(c.yaw) * (40 / this.scale) };
      if (dist(p, tip) < tol * 1.5) return { type: 'camRot' };
      if (dist(p, c) < tol * 2) return { type: 'cam' };
    }
    // selected item handles
    if (sel?.type === 'item') {
      const it = store.find('item', sel.id);
      if (it) {
        const h = this.rotHandle(it);
        if (dist(p, h) < tol * 1.2) return { type: 'itemRot', item: it };
      }
    }
    // selected room vertices
    if (sel?.type === 'room') {
      const r = store.find('room', sel.id);
      if (r) for (let i = 0; i < r.points.length; i++) if (dist(p, r.points[i]) < tol) return { type: 'roomVertex', room: r, index: i };
    }
    // wall endpoints
    for (const w of plan.walls) for (const k of ['a', 'b']) if (dist(p, w[k]) < tol) return { type: 'vertex', wall: w, pt: { ...w[k] } };
    // items (non-rugs first, higher elevation first)
    const items = [...plan.items].sort((a, b) => rank(b) - rank(a));
    for (const it of items) if (pointInPoly(p, itemCorners(it))) return { type: 'item', item: it };
    // openings
    for (const o of plan.openings) {
      const w = plan.walls.find((x) => x.id === o.wallId);
      if (!w) continue;
      const pr = projectOnSeg(p, w.a, w.b);
      const off = pr.t * wallLen(w);
      if (pr.d < w.thickness / 2 + tol && Math.abs(off - o.offset) < o.width / 2) return { type: 'opening', opening: o, wall: w };
    }
    // walls
    for (const w of plan.walls) {
      const pr = projectOnSeg(p, w.a, w.b);
      if (pr.d < w.thickness / 2 + tol * 0.5) return { type: 'wall', wall: w };
    }
    // rooms (smallest first)
    const rooms = [...plan.rooms].sort((a, b) => polyArea(a.points) - polyArea(b.points));
    for (const r of rooms) if (pointInPoly(p, r.points)) return { type: 'room', room: r };
    return null;
  }

  rotHandle(it) {
    const a = (it.rot * Math.PI) / 180;
    const L = it.d / 2 + 22 / this.scale;
    return { x: it.x - Math.sin(a) * L, y: it.y + Math.cos(a) * L };
  }

  // ------------------------------------------------------------ events
  bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const f = Math.exp(-e.deltaY * 0.0015);
      const ns = clamp(this.scale * f, 0.08, 8);
      this.ox = px - ((px - this.ox) * ns) / this.scale;
      this.oy = py - ((py - this.oy) * ns) / this.scale;
      this.scale = ns;
      this.draw();
    }, { passive: false });
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('dblclick', (e) => this.onDbl(e));
    c.addEventListener('keydown', (e) => this.onKey(e));
    c.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
    // drag & drop from catalog
    c.addEventListener('dragover', (e) => e.preventDefault());
    c.addEventListener('drop', (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/item-type');
      if (!type) return;
      const r = c.getBoundingClientRect();
      const p = this.toWorld(e.clientX - r.left, e.clientY - r.top);
      this.placeItem(type, p);
    });
  }

  evtWorld(e) {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const w = this.toWorld(px, py);
    this.mouse = { x: px, y: py, wx: w.x, wy: w.y };
    return w;
  }

  onDown(e) {
    this.canvas.focus();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.evtWorld(e);
    if (e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceDown)) {
      if (e.button === 2 && this.draft) { this.finishDraft(); return; }
      this.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: this.ox, oy: this.oy };
      return;
    }
    const plan = store.plan;
    const free = e.altKey;
    switch (this.tool) {
      case 'select': {
        const hit = this.hitTest(p);
        if (!hit) {
          store.select(null);
          this.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: this.ox, oy: this.oy };
          return;
        }
        this.startSelectDrag(hit, p, e);
        return;
      }
      case 'wall': {
        const s = this.snapPt(p, { free, from: this.draft?.pts.at(-1) });
        if (!this.draft) this.draft = { kind: 'wall', pts: [s] };
        else {
          const last = this.draft.pts.at(-1);
          if (dist(last, s) < 3) return this.finishDraft();
          store.update((pl) => addWall(pl, last, s, this.thickness()), 'wall');
          this.draft.pts.push(s);
          // closing a loop ends the chain
          if (dist(s, this.draft.pts[0]) < 1 && this.draft.pts.length > 2) this.finishDraft();
        }
        this.draw();
        return;
      }
      case 'room': {
        const s = this.snapPt(p, { free });
        this.drag = { type: 'roomRect', a: s, b: s };
        return;
      }
      case 'poly': {
        const s = this.snapPt(p, { free, from: this.draft?.pts.at(-1) });
        if (!this.draft) this.draft = { kind: 'poly', pts: [s] };
        else if (this.draft.pts.length > 2 && dist(s, this.draft.pts[0]) < 12 / this.scale) this.finishDraft();
        else this.draft.pts.push(s);
        this.draw();
        return;
      }
      case 'door':
      case 'window': {
        const nw = nearestWall(plan, p, 40 / this.scale + 20);
        if (!nw) return;
        const style = this.tool === 'door' ? this.toolOpts.doorStyle : this.toolOpts.windowStyle;
        let created;
        store.update((pl) => {
          const w = pl.walls.find((x) => x.id === nw.wall.id);
          const n = wallNormal(w);
          const side = (p.x - nw.x) * n.x + (p.y - nw.y) * n.y >= 0 ? 'A' : 'B';
          created = addOpening(pl, this.tool, style, w, Math.round(nw.offset), { swing: side });
        }, 'opening');
        store.select({ type: 'opening', id: created.id });
        if (!e.shiftKey) this.setTool('select');
        return;
      }
      case 'item': {
        this.placeItem(this.toolOpts.itemType, p, e.shiftKey);
        return;
      }
    }
  }

  placeItem(type, p, keepTool = false) {
    const def = ITEM_BY_TYPE[type];
    if (!def) return;
    const it = makeItem(type, Math.round(p.x), Math.round(p.y), this.toolOpts.itemRot || 0);
    this.snapItemToWall(it, true);
    store.update((pl) => pl.items.push(it), 'item');
    store.select({ type: 'item', id: it.id });
    if (!keepTool) this.setTool('select');
  }

  startSelectDrag(hit, p, e) {
    const plan = store.plan;
    switch (hit.type) {
      case 'cam':
        this.drag = { type: 'cam' };
        return;
      case 'camRot':
        this.drag = { type: 'camRot' };
        return;
      case 'item': {
        store.select({ type: 'item', id: hit.item.id });
        store.checkpoint();
        this.drag = { type: 'item', item: hit.item, dx: p.x - hit.item.x, dy: p.y - hit.item.y, moved: false, dup: e.ctrlKey || e.metaKey };
        return;
      }
      case 'itemRot':
        store.checkpoint();
        this.drag = { type: 'itemRot', item: hit.item };
        return;
      case 'opening':
        store.select({ type: 'opening', id: hit.opening.id });
        store.checkpoint();
        this.drag = { type: 'opening', opening: hit.opening, wall: hit.wall };
        return;
      case 'vertex':
        store.checkpoint();
        this.drag = { type: 'vertex', from: hit.pt, cur: { ...hit.pt } };
        store.select({ type: 'wall', id: hit.wall.id });
        return;
      case 'roomVertex':
        store.checkpoint();
        this.drag = { type: 'roomVertex', room: hit.room, index: hit.index };
        return;
      case 'wall': {
        store.select({ type: 'wall', id: hit.wall.id });
        store.checkpoint();
        const w = hit.wall;
        this.drag = { type: 'wall', wall: w, start: p, a0: { ...w.a }, b0: { ...w.b }, curA: { ...w.a }, curB: { ...w.b } };
        return;
      }
      case 'room':
        store.select({ type: 'room', id: hit.room.id, focus: 'floor' });
        this.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: this.ox, oy: this.oy, click: true };
        return;
    }
    void plan;
  }

  onMove(e) {
    const p = this.evtWorld(e);
    const d = this.drag;
    const plan = store.plan;
    if (!d) {
      if (this.tool === 'select') {
        const hit = this.hitTest(p);
        this.hover = hit;
        const cur = !hit ? 'grab' : { vertex: 'move', roomVertex: 'move', itemRot: 'alias', item: 'move', opening: 'ew-resize', wall: 'pointer', room: 'default', cam: 'move', camRot: 'alias' }[hit.type];
        this.canvas.style.cursor = cur || 'default';
      }
      this.draw();
      return;
    }
    const free = e.altKey;
    switch (d.type) {
      case 'pan':
        this.ox = d.ox + e.clientX - d.sx;
        this.oy = d.oy + e.clientY - d.sy;
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 3) d.click = false;
        break;
      case 'item': {
        const it = d.item;
        if (d.dup && !d.moved) {
          const copy = deepClone(it);
          copy.id = uid('i');
          plan.items.push(copy);
          d.item = copy;
          store.select({ type: 'item', id: copy.id });
        }
        d.moved = true;
        const s = free ? 1 : this.toolOpts.snap;
        d.item.x = Math.round((p.x - d.dx) / s) * s;
        d.item.y = Math.round((p.y - d.dy) / s) * s;
        if (!free) this.snapItemToWall(d.item, false);
        store.changed('move', true);
        break;
      }
      case 'itemRot': {
        const it = d.item;
        let a = (Math.atan2(p.y - it.y, p.x - it.x) * 180) / Math.PI - 90;
        if (!e.shiftKey) a = Math.round(a / 15) * 15;
        it.rot = ((a % 360) + 360) % 360;
        store.changed('rotate', true);
        break;
      }
      case 'opening': {
        const w = d.wall;
        const pr = projectOnSeg(p, w.a, w.b);
        const L = wallLen(w), o = d.opening;
        const s = free ? 1 : this.toolOpts.snap;
        o.offset = clamp(Math.round((pr.t * L) / s) * s, o.width / 2, L - o.width / 2);
        store.changed('move', true);
        break;
      }
      case 'vertex': {
        const s = this.snapPt(p, { free, exclude: d.cur });
        const target = { x: s.x, y: s.y };
        moveVertex(plan, d.cur, target, 0.5);
        d.cur = { ...target };
        store.changed('vertex', true);
        break;
      }
      case 'roomVertex': {
        const s = this.snapPt(p, { free });
        d.room.points[d.index] = { x: s.x, y: s.y };
        store.changed('room', true);
        break;
      }
      case 'wall': {
        const w = d.wall, n = wallNormal(w);
        const step = free ? 1 : this.toolOpts.snap;
        const off = Math.round(((p.x - d.start.x) * n.x + (p.y - d.start.y) * n.y) / step) * step;
        const na = { x: d.a0.x + n.x * off, y: d.a0.y + n.y * off };
        const nb = { x: d.b0.x + n.x * off, y: d.b0.y + n.y * off };
        // move connected geometry along
        const ca = { ...d.curA }, cb = { ...d.curB };
        moveVertex(plan, ca, na, 0.5);
        moveVertex(plan, cb, nb, 0.5);
        d.curA = na; d.curB = nb;
        store.changed('wall', true);
        break;
      }
      case 'roomRect':
        d.b = this.snapPt(p, { free });
        break;
      case 'cam':
        this.onCameraMove?.(p.x, p.y, null);
        break;
      case 'camRot': {
        const c = this.cameraMarker;
        if (c) this.onCameraMove?.(c.x, c.y, Math.atan2(-(p.x - c.x), -(p.y - c.y)));
        break;
      }
    }
    this.draw();
  }

  onUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const p = this.evtWorld(e);
    switch (d.type) {
      case 'item':
        if (!d.moved) store.undoStack.pop();
        store.changed('move');
        break;
      case 'itemRot': case 'opening': case 'roomVertex':
        store.changed('edit');
        break;
      case 'vertex': case 'wall':
        store.changed('edit');
        break;
      case 'roomRect': {
        const { a, b } = d;
        if (Math.abs(a.x - b.x) > 20 && Math.abs(a.y - b.y) > 20) {
          let room;
          store.update((pl) => {
            room = addRectRoom(pl, a.x, a.y, b.x, b.y, { type: this.toolOpts.roomType, walls: this.toolOpts.createWalls, thickness: this.thickness() });
          }, 'room');
          store.select({ type: 'room', id: room.id });
        }
        break;
      }
    }
    void p;
    this.draw();
  }

  onDbl(e) {
    if (this.draft) { this.finishDraft(); return; }
    const p = this.evtWorld(e);
    if (this.tool === 'select' && this.cameraMarker?.walk) this.onCameraMove?.(p.x, p.y, null);
  }

  finishDraft() {
    const d = this.draft;
    this.draft = null;
    if (d?.kind === 'poly' && d.pts.length >= 3) {
      let room;
      store.update((pl) => {
        if (this.toolOpts.createWalls) for (let i = 0; i < d.pts.length; i++) addWall(pl, d.pts[i], d.pts[(i + 1) % d.pts.length], this.thickness());
        room = addRoom(pl, d.pts, { type: this.toolOpts.roomType });
      }, 'room');
      store.select({ type: 'room', id: room.id });
    }
    this.draw();
  }

  thickness() {
    const plan = store.plan;
    return this.toolOpts.wallThickness === 'ext' ? plan.defaults.extThickness : plan.defaults.intThickness;
  }

  onKey(e) {
    if (e.code === 'Space') { this.spaceDown = e.type === 'keydown'; }
    const sel = store.selection;
    const it = sel?.type === 'item' ? store.find('item', sel.id) : null;
    if (e.key === 'Escape') {
      if (this.draft) { this.finishDraft(); return; }
      if (this.tool !== 'select') this.setTool('select');
      else store.select(null);
      return;
    }
    if (e.key === 'Enter' && this.draft) { this.finishDraft(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { deleteSelection(); e.preventDefault(); return; }
    if ((e.key === 'r' || e.key === 'R') && this.tool === 'item') { this.toolOpts.itemRot = (this.toolOpts.itemRot + 90) % 360; this.draw(); return; }
    if (it && ['r', 'R', 'q', 'e'].includes(e.key)) {
      const delta = e.key === 'q' ? -15 : e.key === 'e' ? 15 : 90;
      store.update(() => { it.rot = (((it.rot + delta) % 360) + 360) % 360; }, 'rotate');
      return;
    }
    if (it && e.key.startsWith('Arrow')) {
      const s = e.shiftKey ? 10 : 1;
      store.update(() => {
        if (e.key === 'ArrowLeft') it.x -= s;
        if (e.key === 'ArrowRight') it.x += s;
        if (e.key === 'ArrowUp') it.y -= s;
        if (e.key === 'ArrowDown') it.y += s;
      }, 'nudge');
      e.preventDefault();
      return;
    }
    if (it && (e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSelection(); return; }
    const k = e.key.toLowerCase();
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (k === 'v') this.setTool('select');
      if (k === 'w') this.setTool('wall');
      if (k === 'b') this.setTool('room');
      if (k === 'p') this.setTool('poly');
      if (k === 'd' && !it) this.setTool('door');
      if (k === 'n') this.setTool('window');
      if (k === 'f') this.fit();
    }
  }

  /** If an item is close to a wall, turn its back to the wall and push it flush. */
  snapItemToWall(it, placing) {
    const plan = store.plan;
    const def = ITEM_BY_TYPE[it.type];
    if (!def || ['rug', 'round_rug', 'ceiling_light', 'pendant', 'globe_pendant'].includes(it.type)) return;
    let best = null;
    for (const w of plan.walls) {
      const pr = projectOnSeg(it, w.a, w.b);
      if (pr.t <= 0 || pr.t >= 1) continue;
      const n = wallNormal(w);
      const side = (it.x - pr.x) * n.x + (it.y - pr.y) * n.y >= 0 ? 1 : -1;
      const gap = pr.d - w.thickness / 2 - it.d / 2;
      const lim = placing ? Math.max(40, it.d) : 18;
      if (gap < lim && gap > -it.d && (!best || gap < best.gap)) best = { w, pr, n, side, gap };
    }
    if (!best) return;
    const { pr, n, side, w } = best;
    // front must face away from the wall: front vector (-sin, cos) == side*n
    const rot = (Math.atan2(-side * n.x, side * n.y) * 180) / Math.PI;
    const cur = it.rot;
    const nr = ((Math.round(rot) % 360) + 360) % 360;
    if (placing || Math.abs(((cur - nr + 540) % 360) - 180) < 50) {
      it.rot = nr;
      const off = w.thickness / 2 + it.d / 2 + 0.5;
      it.x = Math.round((pr.x + side * n.x * off) * 2) / 2;
      it.y = Math.round((pr.y + side * n.y * off) * 2) / 2;
    }
  }

  // ------------------------------------------------------------ drawing
  draw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = null; this.render(); });
  }

  render() {
    const plan = store.plan;
    const ctx = this.ctx;
    if (!plan) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawGrid();
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
    const px = 1 / this.scale; // one screen pixel in cm
    const sel = store.selection;

    // rooms
    for (const r of plan.rooms) {
      if (r.points.length < 3) continue;
      ctx.beginPath();
      r.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      const pat = floorPattern(ctx, getMaterialDef(plan, r.floorMat));
      ctx.fillStyle = pat || '#ddd';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      const isSel = sel?.type === 'room' && sel.id === r.id;
      const isHover = this.hover?.type === 'room' && this.hover.room === r;
      if (isSel || isHover) {
        ctx.fillStyle = isSel ? 'rgba(31,111,235,0.12)' : 'rgba(31,111,235,0.06)';
        ctx.fill();
        ctx.lineWidth = 2 * px;
        ctx.strokeStyle = COLORS.sel;
        ctx.setLineDash([6 * px, 4 * px]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // items: rugs first, then by elevation
    const items = [...plan.items].sort((a, b) => rank(a) - rank(b));
    for (const it of items) this.drawItem(it, sel?.type === 'item' && sel.id === it.id, this.hover?.item === it, px);

    // walls
    for (const w of plan.walls) this.drawWall(w, sel, px);
    for (const o of plan.openings) this.drawOpening(o, sel, px);

    // vertex dots
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 1.2 * px;
    if (this.tool !== 'select' || sel?.type === 'wall' || this.hover?.type === 'vertex') {
      for (const w of plan.walls) for (const k of ['a', 'b']) {
        ctx.beginPath();
        ctx.arc(w[k].x, w[k].y, 3.5 * px, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
    }

    // labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of plan.rooms) {
      if (r.points.length < 3) continue;
      const c = polyCentroid(r.points);
      const fs = 13 * px;
      ctx.font = `600 ${fs}px system-ui, sans-serif`;
      const t1 = r.name, t2 = fmtArea(polyArea(r.points));
      const wdt = Math.max(ctx.measureText(t1).width, ctx.measureText(t2).width) + 12 * px;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      roundRect(ctx, c.x - wdt / 2, c.y - fs * 1.35, wdt, fs * 2.7, 4 * px);
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(t1, c.x, c.y - fs * 0.55);
      ctx.font = `${fs * 0.9}px system-ui, sans-serif`;
      ctx.fillStyle = COLORS.dim;
      ctx.fillText(t2, c.x, c.y + fs * 0.6);
    }

    // selected item handles
    if (sel?.type === 'item') {
      const it = store.find('item', sel.id);
      if (it) {
        const h = this.rotHandle(it);
        ctx.strokeStyle = COLORS.sel;
        ctx.lineWidth = 1.5 * px;
        ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(h.x, h.y); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(h.x, h.y, 6 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        this.drawItemDims(it, px);
      }
    }
    if (sel?.type === 'room') {
      const r = store.find('room', sel.id);
      if (r) for (const p of r.points) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = COLORS.sel; ctx.lineWidth = 1.5 * px;
        ctx.beginPath(); ctx.rect(p.x - 4 * px, p.y - 4 * px, 8 * px, 8 * px); ctx.fill(); ctx.stroke();
      }
    }

    this.drawToolPreview(px);
    this.drawCamera(px);
  }

  drawGrid() {
    const ctx = this.ctx;
    const steps = [[10, COLORS.grid, 0.5], [100, COLORS.grid2, 1]];
    for (const [s, col, lw] of steps) {
      if (s * this.scale < 6) continue;
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      const x0 = Math.floor(-this.ox / this.scale / s) * s, x1 = (this.w - this.ox) / this.scale;
      for (let x = x0; x < x1; x += s) { const sx = Math.round(x * this.scale + this.ox) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, this.h); }
      const y0 = Math.floor(-this.oy / this.scale / s) * s, y1 = (this.h - this.oy) / this.scale;
      for (let y = y0; y < y1; y += s) { const sy = Math.round(y * this.scale + this.oy) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(this.w, sy); }
      ctx.stroke();
    }
    // scale bar
    ctx.fillStyle = COLORS.dim;
    ctx.font = '11px system-ui, sans-serif';
    const len = [50, 100, 200, 500, 1000].find((l) => l * this.scale > 60) || 1000;
    const x = 14, y = this.h - 16;
    ctx.fillRect(x, y, len * this.scale, 3);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmtM(len, len < 100 ? 1 : 0), x, y - 3);
  }

  wallPoly(w, ext = true) {
    const d = wallDir(w), n = wallNormal(w), t = w.thickness / 2;
    const ea = ext ? extensionFor(w, 'a') : 0, eb = ext ? extensionFor(w, 'b') : 0;
    const a = { x: w.a.x - d.x * ea, y: w.a.y - d.y * ea }, b = { x: w.b.x + d.x * eb, y: w.b.y + d.y * eb };
    return [
      { x: a.x + n.x * t, y: a.y + n.y * t }, { x: b.x + n.x * t, y: b.y + n.y * t },
      { x: b.x - n.x * t, y: b.y - n.y * t }, { x: a.x - n.x * t, y: a.y - n.y * t },
    ];
  }

  drawWall(w, sel, px) {
    const ctx = this.ctx;
    const plan = store.plan;
    const pts = this.wallPoly(w);
    const isSel = sel?.type === 'wall' && sel.id === w.id;
    const isHover = this.hover?.type === 'wall' && this.hover.wall === w;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = isSel ? COLORS.wallSel : isHover ? '#4a5a78' : COLORS.wall;
    ctx.fill();
    // cut openings
    const d = wallDir(w), n = wallNormal(w), t = w.thickness / 2 + 0.6;
    for (const { s, e } of wallOpenings(plan, w)) {
      ctx.beginPath();
      const q = (u, v) => ({ x: w.a.x + d.x * u + n.x * v, y: w.a.y + d.y * u + n.y * v });
      [q(s, t), q(e, t), q(e, -t), q(s, -t)].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = '#fbfaf7';
      ctx.fill();
    }
    // dimension
    const L = wallLen(w);
    if (L * this.scale > 45) {
      const side = isSel || this.scale > 0.5;
      if (side) {
        const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
        const off = w.thickness / 2 + 10 * px;
        let ang = Math.atan2(d.y, d.x);
        if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
        // put label on exterior-ish side (side B)
        ctx.save();
        ctx.translate(mid.x - n.x * off, mid.y - n.y * off);
        ctx.rotate(ang);
        ctx.font = `${10.5 * px}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isSel ? COLORS.sel : COLORS.dim;
        ctx.fillText(fmtM(L), 0, 0);
        ctx.restore();
      }
    }
  }

  drawOpening(o, sel, px) {
    const ctx = this.ctx;
    const plan = store.plan;
    const w = plan.walls.find((x) => x.id === o.wallId);
    if (!w) return;
    const d = wallDir(w), n = wallNormal(w);
    const L = wallLen(w);
    const off = clamp(o.offset, o.width / 2, L - o.width / 2);
    const s = off - o.width / 2, e = off + o.width / 2;
    const t = w.thickness / 2;
    const q = (u, v) => ({ x: w.a.x + d.x * u + n.x * v, y: w.a.y + d.y * u + n.y * v });
    const isSel = sel?.type === 'opening' && sel.id === o.id;
    const isHover = this.hover?.type === 'opening' && this.hover.opening === o;
    ctx.strokeStyle = isSel ? COLORS.sel : isHover ? '#4a6fb0' : '#3b3f45';
    ctx.lineWidth = (isSel ? 2 : 1.2) * px;
    const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    // jambs
    line(q(s, t), q(s, -t));
    line(q(e, t), q(e, -t));
    if (o.kind === 'window') {
      line(q(s, t * 0.35), q(e, t * 0.35));
      line(q(s, -t * 0.35), q(e, -t * 0.35));
      line(q(s, t), q(e, t));
      line(q(s, -t), q(e, -t));
      if (o.style === 'casement' || o.style === 'grid') line(q(off, t * 0.35), q(off, -t * 0.35));
    } else if (o.style === 'sliding' || o.style === 'pocket') {
      line(q(s, 2), q(off + 10, 2));
      line(q(off - 10, -2), q(e, -2));
    } else if (o.style !== 'passage') {
      const sg = o.swing === 'B' ? -1 : 1;
      const leaves = o.style === 'double' || (o.style === 'glass' && o.width >= 120)
        ? [[s, 1, o.width / 2], [e, -1, o.width / 2]]
        : [[o.flip ? e : s, o.flip ? -1 : 1, o.width]];
      for (const [hu, dir, lw] of leaves) {
        const hinge = q(hu, sg * t);
        const tip = q(hu, sg * (t + lw));
        line(hinge, tip);
        // arc from closed position to open (90°)
        const closed = q(hu + dir * lw, sg * t);
        const a0 = Math.atan2(closed.y - hinge.y, closed.x - hinge.x);
        const a1 = Math.atan2(tip.y - hinge.y, tip.x - hinge.x);
        ctx.beginPath();
        let da = a1 - a0;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        ctx.setLineDash([3 * px, 3 * px]);
        ctx.arc(hinge.x, hinge.y, lw, a0, a1, da < 0);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (isSel) {
      const c = q(off, 0);
      ctx.font = `${10 * px}px system-ui, sans-serif`;
      ctx.fillStyle = COLORS.sel;
      ctx.textAlign = 'center';
      ctx.fillText(`${o.width} cm`, c.x + n.x * (t + 14 * px), c.y + n.y * (t + 14 * px));
    }
  }

  drawItem(it, isSel, isHover, px) {
    const ctx = this.ctx;
    const def = ITEM_BY_TYPE[it.type];
    if (!def) return;
    const plan = store.plan;
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate((it.rot * Math.PI) / 180);
    const slot = def.slots[0];
    const fill = avgColor(resolveSlot(plan, it, slot));
    const elevated = (it.elev ?? def.elev) > 0 || (it.elev ?? def.elev) < 0;
    ctx.globalAlpha = elevated ? 0.55 : it.type.includes('rug') ? 0.8 : 0.92;
    ctx.fillStyle = fill;
    ctx.strokeStyle = isSel ? COLORS.sel : isHover ? '#4a6fb0' : '#3a3d42';
    ctx.lineWidth = (isSel ? 2 : 1) * px;
    def.plan(ctx, it.w, it.d);
    ctx.globalAlpha = 1;
    if (isSel || isHover) {
      ctx.strokeStyle = isSel ? COLORS.sel : 'rgba(31,111,235,0.6)';
      ctx.lineWidth = 1.5 * px;
      ctx.setLineDash([4 * px, 3 * px]);
      ctx.strokeRect(-it.w / 2, -it.d / 2, it.w, it.d);
      ctx.setLineDash([]);
    }
    // front indicator
    if (isSel) {
      ctx.fillStyle = COLORS.sel;
      ctx.beginPath();
      ctx.moveTo(-5 * px, it.d / 2 + 2 * px); ctx.lineTo(5 * px, it.d / 2 + 2 * px); ctx.lineTo(0, it.d / 2 + 8 * px);
      ctx.fill();
    }
    ctx.restore();
  }

  drawItemDims(it, px) {
    const ctx = this.ctx;
    ctx.font = `${10 * px}px system-ui, sans-serif`;
    ctx.fillStyle = COLORS.sel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const cs = itemCorners(it);
    const maxY = Math.max(...cs.map((c) => c.y));
    ctx.fillText(`${it.w} × ${it.d} cm`, it.x, maxY + 12 * px);
  }

  drawToolPreview(px) {
    const ctx = this.ctx;
    const m = { x: this.mouse.wx, y: this.mouse.wy };
    const plan = store.plan;
    ctx.lineWidth = 2 * px;
    ctx.strokeStyle = COLORS.preview;
    ctx.fillStyle = COLORS.preview;
    const label = (text, x, y) => {
      ctx.font = `600 ${11 * px}px system-ui, sans-serif`;
      const w = ctx.measureText(text).width + 8 * px;
      ctx.fillStyle = 'rgba(31,111,235,0.92)';
      roundRect(ctx, x - w / 2, y - 8 * px, w, 16 * px, 3 * px);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    };
    if (this.tool === 'wall' || this.tool === 'poly') {
      const pts = this.draft?.pts || [];
      const snap = this.snapPt(m, { from: pts.at(-1) });
      ctx.beginPath();
      ctx.arc(snap.x, snap.y, 4 * px, 0, Math.PI * 2);
      ctx.fill();
      if (pts.length) {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.lineTo(snap.x, snap.y);
        if (this.tool === 'poly') ctx.closePath();
        ctx.lineWidth = this.tool === 'wall' ? this.thickness() : 2 * px;
        ctx.strokeStyle = this.tool === 'wall' ? 'rgba(31,111,235,0.45)' : COLORS.preview;
        ctx.stroke();
        const last = pts.at(-1);
        label(fmtM(dist(last, snap)), (last.x + snap.x) / 2, (last.y + snap.y) / 2 - 14 * px);
      }
    }
    if (this.drag?.type === 'roomRect') {
      const { a, b } = this.drag;
      ctx.fillStyle = 'rgba(31,111,235,0.12)';
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      ctx.lineWidth = this.toolOpts.createWalls ? this.thickness() : 2 * px;
      ctx.strokeStyle = 'rgba(31,111,235,0.5)';
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      label(`${fmtM(Math.abs(a.x - b.x))} × ${fmtM(Math.abs(a.y - b.y))}`, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    if ((this.tool === 'door' || this.tool === 'window') && plan) {
      const nw = nearestWall(plan, m, 40 / this.scale + 20);
      if (nw) {
        const style = this.tool === 'door' ? this.toolOpts.doorStyle : this.toolOpts.windowStyle;
        const width = OPENING_PRESETS[this.tool][style].width;
        const d = wallDir(nw.wall);
        ctx.lineWidth = nw.wall.thickness + 4;
        ctx.strokeStyle = 'rgba(31,111,235,0.6)';
        ctx.beginPath();
        ctx.moveTo(nw.x - (d.x * width) / 2, nw.y - (d.y * width) / 2);
        ctx.lineTo(nw.x + (d.x * width) / 2, nw.y + (d.y * width) / 2);
        ctx.stroke();
        label(`${width} cm`, nw.x, nw.y - nw.wall.thickness - 12 * px);
      }
    }
    if (this.tool === 'item' && this.toolOpts.itemType) {
      const def = ITEM_BY_TYPE[this.toolOpts.itemType];
      const it = makeItem(def.type, Math.round(m.x), Math.round(m.y), this.toolOpts.itemRot);
      this.snapItemToWall(it, true);
      ctx.globalAlpha = 0.6;
      this.drawItem(it, true, false, px);
      ctx.globalAlpha = 1;
    }
  }

  drawCamera(px) {
    const c = this.cameraMarker;
    if (!c?.walk) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(c.x, c.y);
    const dirx = -Math.sin(c.yaw), diry = -Math.cos(c.yaw);
    const ang = Math.atan2(diry, dirx);
    ctx.fillStyle = 'rgba(255,140,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 90 * px, ang - 0.55, ang + 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff8c00';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * px;
    ctx.beginPath(); ctx.arc(0, 0, 7 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(dirx * 40 * px, diry * 40 * px, 5 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

function rank(it) {
  if (it.type === 'rug' || it.type === 'round_rug') return -1000;
  const e = it.elev ?? 0;
  return e < 0 ? 5000 : e + (it.h || 0) * 0.001;
}

function extensionFor(w, k) {
  const plan = store.plan;
  const d = wallDir(w);
  let ext = 0;
  for (const o of plan.walls) {
    if (o === w) continue;
    const od = wallDir(o);
    if (Math.abs(d.x * od.x + d.y * od.y) > 0.98) continue;
    if (projectOnSeg(w[k], o.a, o.b).d < 1.5) ext = Math.max(ext, o.thickness / 2);
  }
  return ext;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function deleteSelection() {
  const sel = store.selection;
  if (!sel) return;
  store.update((pl) => {
    if (sel.type === 'wall') deleteWall(pl, sel.id);
    if (sel.type === 'room') pl.rooms = pl.rooms.filter((r) => r.id !== sel.id);
    if (sel.type === 'opening') pl.openings = pl.openings.filter((o) => o.id !== sel.id);
    if (sel.type === 'item') pl.items = pl.items.filter((i) => i.id !== sel.id);
  }, 'delete');
  store.select(null);
}

export function duplicateSelection() {
  const sel = store.selection;
  if (sel?.type !== 'item') return;
  const it = store.find('item', sel.id);
  const copy = deepClone(it);
  copy.id = uid('i');
  copy.x += 20; copy.y += 20;
  store.update((pl) => pl.items.push(copy), 'duplicate');
  store.select({ type: 'item', id: copy.id });
}
