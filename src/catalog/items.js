// Furniture & fixtures catalogue. Dimensions in cm. Local frame: width along x,
// depth along z (front faces +z / plan +y), y up. build() receives metres.

export const SLOT_LABELS = {
  cabinet: 'Cabinet fronts', countertop: 'Countertop', wood: 'Wood', fabric: 'Upholstery', accent: 'Cushions / accent',
  metal: 'Metal / handles', ceramic: 'Ceramic', glass: 'Glass', appliance: 'Appliance', rug: 'Rug', bedding: 'Bedding',
  plant: 'Foliage', pot: 'Planter', lampshade: 'Lamp shade', screen: 'Screen', mirror: 'Mirror', art: 'Artwork', curtain: 'Curtain',
};

export const THEME_DEFAULTS = {
  cabinet: 'cab-white', countertop: 'ct-white-quartz', wood: 'wood-oak', fabric: 'fab-linen', accent: 'fab-sage',
  metal: 'metal-steel', ceramic: 'ceramic-white', glass: 'glass-clear', appliance: 'appliance-steel', rug: 'rug-jute',
  bedding: 'fab-white', plant: 'plant-green', pot: 'ceramic-sand', lampshade: 'lampshade', screen: 'screen',
  mirror: 'mirror', art: 'art-abstract', curtain: 'fab-linen', door: 'paint-pure-white', frame: 'paint-pure-white', bulb: 'bulb', soil: 'soil', frosted: 'glass-fluted',
};

const I = [];
const def = (o) => I.push({ elev: 0, slots: [], ...o });

// ---------- shared 2D symbols ----------
const rect2 = (ctx, x, y, w, h) => { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke(); };
const circ2 = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
const line2 = (ctx, x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
function counter2(ctx, w, d) { rect2(ctx, -w / 2, -d / 2, w, d); line2(ctx, -w / 2, d / 2 - 4, w / 2, d / 2 - 4); }

// ---------- kitchen helpers ----------
function fronts(b, w, h, d, y, n, opts = {}) {
  const gap = 0.004, fw = (w - gap * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + gap + fw / 2 + i * (fw + gap);
    b.box('cabinet', fw, h - gap * 2, 0.018, x, y + gap, d / 2 + 0.009);
    if (opts.drawers) {
      b.box('metal', Math.min(0.3, fw * 0.5), 0.012, 0.02, x, y + h - 0.06, d / 2 + 0.028);
    } else {
      const hx = n === 1 ? (fw / 2 - 0.04) : (i % 2 ? -fw / 2 + 0.04 : fw / 2 - 0.04);
      b.box('metal', 0.012, Math.min(0.18, h * 0.3), 0.02, x + hx, y + h - Math.min(0.24, h * 0.4), d / 2 + 0.028);
    }
  }
}
function baseUnit(b, p, opts = {}) {
  const { w, d, h } = p;
  const top = 0.04, plinth = 0.1;
  b.box('cabinet', w - 0.01, plinth, d - 0.08, 0, 0, -0.03);
  b.box('cabinet', w, h - top - plinth, d - 0.02, 0, plinth, -0.01);
  if (!opts.noFronts) fronts(b, w, h - top - plinth, d - 0.02, plinth, opts.doors || (w > 0.65 ? 2 : 1), opts);
  if (!opts.noTop) b.box('countertop', w, top, d + 0.02, 0, h - top, 0.01);
}

def({
  type: 'base_cabinet', name: 'Base cabinet', cat: 'Kitchen', w: 60, d: 60, h: 90, slots: ['cabinet', 'countertop', 'metal'],
  build: (b, p) => baseUnit(b, p), plan: counter2,
});
def({
  type: 'drawer_cabinet', name: 'Drawer cabinet', cat: 'Kitchen', w: 60, d: 60, h: 90, slots: ['cabinet', 'countertop', 'metal'],
  build: (b, p) => {
    baseUnit(b, p, { noFronts: true });
    const hh = (p.h - 0.14) / 3;
    for (let k = 0; k < 3; k++) {
      b.box('cabinet', p.w - 0.008, hh - 0.006, 0.018, 0, 0.1 + k * hh + 0.003, p.d / 2 - 0.001);
      b.box('metal', 0.3, 0.012, 0.02, 0, 0.1 + k * hh + hh - 0.06, p.d / 2 + 0.018);
    }
  },
  plan: counter2,
});
def({
  type: 'sink_cabinet', name: 'Sink cabinet', cat: 'Kitchen', w: 80, d: 60, h: 90, slots: ['cabinet', 'countertop', 'metal'],
  build: (b, p) => {
    baseUnit(b, p);
    const sw = Math.min(p.w - 0.16, 0.6);
    b.box('metal', sw, 0.006, 0.42, 0, p.h, 0.02);
    b.box('screen', sw - 0.04, 0.002, 0.38, 0, p.h + 0.006, 0.02, { cast: false });
    // faucet
    b.cyl('metal', 0.014, 0.018, 0.3, 0, p.h, -0.2);
    b.torus('metal', 0.08, 0.012, 0, p.h + 0.3, -0.12, { arc: Math.PI, ry: Math.PI / 2 });
  },
  plan: (ctx, w, d) => { counter2(ctx, w, d); ctx.save(); ctx.fillStyle = 'rgba(120,140,160,0.25)'; rect2(ctx, -Math.min(w - 16, 60) / 2, -19, Math.min(w - 16, 60), 42); ctx.restore(); circ2(ctx, 0, -23, 2); },
});
def({
  type: 'cooktop_cabinet', name: 'Cooktop + oven', cat: 'Kitchen', w: 60, d: 60, h: 90, slots: ['cabinet', 'countertop', 'metal', 'appliance'],
  build: (b, p) => {
    baseUnit(b, p, { noFronts: true });
    b.box('appliance', p.w - 0.02, 0.6, 0.02, 0, 0.14, p.d / 2 - 0.005);
    b.box('screen', p.w - 0.1, 0.36, 0.005, 0, 0.2, p.d / 2 + 0.008);
    b.box('metal', p.w - 0.14, 0.015, 0.03, 0, 0.66, p.d / 2 + 0.03);
    b.box('screen', Math.min(0.58, p.w - 0.02), 0.006, 0.5, 0, p.h, 0);
    for (const [x, z] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.12], [0.14, 0.12]])
      b.cyl('appliance', 0.07, 0.07, 0.001, x * (p.w / 0.6), p.h + 0.006, z, { cast: false });
  },
  plan: (ctx, w, d) => { counter2(ctx, w, d); for (const [x, y] of [[-0.23, -0.17], [0.23, -0.17], [-0.23, 0.2], [0.23, 0.2]]) circ2(ctx, x * w, y * d, Math.min(w, d) * 0.13); },
});
def({
  type: 'dishwasher', name: 'Dishwasher (integrated)', cat: 'Kitchen', w: 60, d: 60, h: 90, slots: ['cabinet', 'countertop', 'metal'],
  build: (b, p) => baseUnit(b, p, { doors: 1, drawers: true }), plan: counter2,
});
def({
  type: 'fridge', name: 'Fridge-freezer', cat: 'Kitchen', w: 70, d: 68, h: 200, slots: ['appliance', 'metal'],
  build: (b, p) => {
    b.rbox('appliance', p.w, p.h, p.d, 0.015);
    b.box('screen', p.w - 0.01, 0.004, 0.002, 0, p.h * 0.36, p.d / 2 + 0.001, { cast: false });
    b.box('metal', 0.02, 0.35, 0.03, -p.w / 2 + 0.06, p.h * 0.36 + 0.1, p.d / 2 + 0.02);
    b.box('metal', 0.02, 0.3, 0.03, -p.w / 2 + 0.06, p.h * 0.36 - 0.36, p.d / 2 + 0.02);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); line2(ctx, -w / 2, -d / 2, w / 2, d / 2); ctx.font = '10px sans-serif'; },
});
def({
  type: 'tall_oven', name: 'Tall oven unit', cat: 'Kitchen', w: 60, d: 60, h: 220, slots: ['cabinet', 'appliance', 'metal'],
  build: (b, p) => {
    b.box('cabinet', p.w, p.h, p.d - 0.02, 0, 0, -0.01);
    b.box('screen', p.w - 0.04, 0.58, 0.02, 0, 0.82, p.d / 2);
    b.box('screen', p.w - 0.04, 0.38, 0.02, 0, 1.42, p.d / 2);
    b.box('metal', p.w - 0.14, 0.015, 0.03, 0, 1.33, p.d / 2 + 0.02);
    fronts(b, p.w, 0.7, p.d - 0.02, 0.1, 1, { drawers: true });
    fronts(b, p.w, p.h - 1.82, p.d - 0.02, 1.82, 1);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); line2(ctx, -w / 2, -d / 2, w / 2, d / 2); line2(ctx, w / 2, -d / 2, -w / 2, d / 2); },
});
def({
  type: 'pantry', name: 'Tall pantry cabinet', cat: 'Kitchen', w: 60, d: 60, h: 220, slots: ['cabinet', 'metal'],
  build: (b, p) => { b.box('cabinet', p.w, p.h, p.d - 0.02, 0, 0, -0.01); fronts(b, p.w, p.h - 0.1, p.d - 0.02, 0.1, p.w > 0.65 ? 2 : 1); },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); line2(ctx, -w / 2, -d / 2, w / 2, d / 2); },
});
def({
  type: 'wall_cabinet', name: 'Wall cabinet', cat: 'Kitchen', w: 60, d: 35, h: 70, elev: 145, slots: ['cabinet', 'metal'],
  build: (b, p) => { b.box('cabinet', p.w, p.h, p.d - 0.02, 0, 0, -0.01); fronts(b, p.w, p.h, p.d - 0.02, 0, p.w > 0.65 ? 2 : 1); },
  plan: (ctx, w, d) => { ctx.setLineDash([4, 3]); rect2(ctx, -w / 2, -d / 2, w, d); ctx.setLineDash([]); },
});
def({
  type: 'open_shelf', name: 'Open wall shelf', cat: 'Kitchen', w: 90, d: 25, h: 4, elev: 150, slots: ['wood'],
  build: (b, p) => b.box('wood', p.w, p.h, p.d), plan: (ctx, w, d) => { ctx.setLineDash([4, 3]); rect2(ctx, -w / 2, -d / 2, w, d); ctx.setLineDash([]); },
});
def({
  type: 'range_hood', name: 'Chimney hood', cat: 'Kitchen', w: 60, d: 50, h: 100, elev: 150, slots: ['metal'],
  build: (b, p) => {
    b.box('metal', p.w, 0.06, p.d, 0, 0, 0);
    b.box('metal', p.w * 0.4, p.h - 0.06, p.d * 0.5, 0, 0.06, -p.d * 0.25);
  },
  plan: (ctx, w, d) => { ctx.setLineDash([4, 3]); rect2(ctx, -w / 2, -d / 2, w, d); ctx.setLineDash([]); },
});
def({
  type: 'island', name: 'Kitchen island', cat: 'Kitchen', w: 200, d: 90, h: 92, slots: ['cabinet', 'countertop', 'metal'],
  build: (b, p) => {
    const cd = p.d - 0.3;
    b.box('cabinet', p.w - 0.04, 0.1, cd - 0.08, 0, 0, p.d / 2 - cd / 2 - 0.03);
    b.box('cabinet', p.w - 0.04, p.h - 0.14, cd - 0.02, 0, 0.1, p.d / 2 - cd / 2 - 0.01);
    const n = Math.max(1, Math.round((p.w - 0.04) / 0.6));
    const zc = p.d / 2 - cd / 2;
    for (let i = 0; i < n; i++) {
      const uw = (p.w - 0.04) / n;
      const x = -p.w / 2 + 0.02 + uw / 2 + i * uw;
      b.box('cabinet', uw - 0.006, p.h - 0.15, 0.018, x, 0.105, zc + cd / 2);
      b.box('metal', Math.min(0.3, uw * 0.5), 0.012, 0.02, x, p.h - 0.2, zc + cd / 2 + 0.02);
    }
    b.box('countertop', p.w, 0.04, p.d, 0, p.h - 0.04, 0);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); ctx.setLineDash([3, 3]); line2(ctx, -w / 2 + 2, -d / 2 + 30, w / 2 - 2, -d / 2 + 30); ctx.setLineDash([]); },
});
def({
  type: 'microwave', name: 'Microwave', cat: 'Kitchen', w: 50, d: 38, h: 30, elev: 90, slots: ['appliance', 'screen'],
  build: (b, p) => { b.rbox('appliance', p.w, p.h, p.d, 0.01); b.box('screen', p.w * 0.62, p.h * 0.7, 0.004, -p.w * 0.14, p.h * 0.15, p.d / 2); },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});

// ---------- living ----------
function sofaPlan(ctx, w, d, arm = 18) {
  rect2(ctx, -w / 2, -d / 2, w, d);
  rect2(ctx, -w / 2, -d / 2, w, 20);
  rect2(ctx, -w / 2, -d / 2 + 20, arm, d - 20);
  rect2(ctx, w / 2 - arm, -d / 2 + 20, arm, d - 20);
}
function sofaBody(b, p, seats, opts = {}) {
  const { w, d, h } = p;
  const arm = opts.noArms ? 0 : 0.18, seatH = 0.44, legH = 0.1, backD = 0.2;
  // legs
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) b.cyl('wood', 0.02, 0.015, legH, x, 0, z);
  b.rbox('fabric', w, seatH - legH - 0.12, d, 0.02, 0, legH, 0);
  b.rbox('fabric', w, h - legH, backD, 0.04, 0, legH, -d / 2 + backD / 2);
  if (arm) for (const s of [-1, 1]) b.rbox('fabric', arm, 0.62 - legH, d, 0.05, s * (w / 2 - arm / 2), legH, 0);
  const sw = (w - 2 * arm) / seats;
  for (let i = 0; i < seats; i++) {
    const x = -w / 2 + arm + sw / 2 + i * sw;
    b.rbox('fabric', sw - 0.01, 0.14, d - backD - 0.02, 0.05, x, seatH - 0.12, backD / 2 + 0.005);
    b.rbox('fabric', sw - 0.03, h - seatH - 0.06, 0.16, 0.06, x, seatH, -d / 2 + backD + 0.07, { rx: -0.12 });
  }
  if (!opts.noPillows) {
    b.rbox('accent', 0.42, 0.42, 0.14, 0.06, -w / 2 + arm + 0.26, seatH, -d / 2 + backD + 0.2, { rx: -0.25, ry: 0.3 });
    b.rbox('accent', 0.42, 0.42, 0.14, 0.06, w / 2 - arm - 0.26, seatH, -d / 2 + backD + 0.2, { rx: -0.25, ry: -0.3 });
  }
}
def({
  type: 'sofa', name: 'Sofa 3-seat', cat: 'Living', w: 210, d: 92, h: 80, slots: ['fabric', 'accent', 'wood'],
  build: (b, p) => sofaBody(b, p, 3), plan: (ctx, w, d) => sofaPlan(ctx, w, d),
});
def({
  type: 'sofa2', name: 'Loveseat 2-seat', cat: 'Living', w: 160, d: 88, h: 80, slots: ['fabric', 'accent', 'wood'],
  build: (b, p) => sofaBody(b, p, 2), plan: (ctx, w, d) => sofaPlan(ctx, w, d),
});
def({
  type: 'sectional', name: 'Corner sofa (L)', cat: 'Living', w: 260, d: 170, h: 80, slots: ['fabric', 'accent', 'wood'],
  build: (b, p) => {
    const sd = 0.92;
    const g1 = { w: p.w, d: sd, h: p.h };
    // main run along back
    sofaBody(shift(b, 0, -p.d / 2 + sd / 2), g1, 3, { noPillows: false });
    // chaise on the right
    const cw = 0.9, cl = p.d - sd;
    const s = shift(b, p.w / 2 - cw / 2, -p.d / 2 + sd + cl / 2);
    s.rbox('fabric', cw, 0.22, cl, 0.02, 0, 0.1, 0);
    s.rbox('fabric', cw - 0.02, 0.14, cl, 0.05, 0, 0.32, 0);
    s.rbox('fabric', 0.18, 0.52, cl, 0.05, cw / 2 - 0.09, 0.1, 0);
  },
  plan: (ctx, w, d) => {
    const sd = 92;
    rect2(ctx, -w / 2, -d / 2, w, sd);
    rect2(ctx, w / 2 - 90, -d / 2 + sd, 90, d - sd);
    rect2(ctx, -w / 2, -d / 2, w, 20);
  },
});
function shift(b, dx, dz) {
  const wrap = {};
  for (const k of Object.keys(b)) {
    wrap[k] = (slot, ...a) => {
      const m = b[k](slot, ...a);
      m.position.x += dx; m.position.z += dz;
      return m;
    };
  }
  return wrap;
}
def({
  type: 'armchair', name: 'Armchair', cat: 'Living', w: 80, d: 82, h: 78, slots: ['fabric', 'accent', 'wood'],
  build: (b, p) => sofaBody(b, p, 1, { noPillows: true }), plan: (ctx, w, d) => sofaPlan(ctx, w, d, 14),
});
def({
  type: 'lounge_chair', name: 'Lounge chair (round)', cat: 'Living', w: 75, d: 75, h: 75, slots: ['fabric', 'metal'],
  build: (b, p) => {
    b.cyl('metal', 0.02, 0.02, 0.2, 0, 0, 0);
    b.cyl('metal', 0.22, 0.22, 0.02, 0, 0, 0);
    b.cyl('fabric', p.w / 2, p.w / 2 - 0.04, 0.2, 0, 0.2, 0);
    b.torus('fabric', p.w / 2 - 0.06, 0.06, 0, 0.46, 0, { arc: Math.PI, rx: Math.PI / 2, rz: Math.PI });
    b.torus('fabric', p.w / 2 - 0.06, 0.06, 0, 0.6, 0, { arc: Math.PI, rx: Math.PI / 2, rz: Math.PI });
  },
  plan: (ctx, w) => circ2(ctx, 0, 0, w / 2),
});
def({
  type: 'coffee_table', name: 'Coffee table', cat: 'Living', w: 110, d: 60, h: 40, slots: ['wood', 'metal'],
  build: (b, p) => {
    b.box('wood', p.w, 0.04, p.d, 0, p.h - 0.04, 0);
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.box('metal', 0.03, p.h - 0.04, 0.03, x * (p.w / 2 - 0.06), 0, z * (p.d / 2 - 0.06));
    b.box('wood', p.w - 0.12, 0.02, p.d - 0.12, 0, 0.1, 0);
  },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'round_coffee', name: 'Round coffee table', cat: 'Living', w: 80, d: 80, h: 38, slots: ['wood', 'metal'],
  build: (b, p) => { b.cyl('wood', p.w / 2, p.w / 2, 0.04, 0, p.h - 0.04, 0); b.cyl('metal', 0.1, 0.18, p.h - 0.04, 0, 0, 0); },
  plan: (ctx, w) => circ2(ctx, 0, 0, w / 2),
});
def({
  type: 'side_table', name: 'Side table', cat: 'Living', w: 45, d: 45, h: 55, slots: ['wood', 'metal'],
  build: (b, p) => { b.cyl('wood', p.w / 2, p.w / 2, 0.03, 0, p.h - 0.03, 0); b.cyl('metal', 0.02, 0.02, p.h - 0.03, 0, 0, 0); b.cyl('metal', 0.15, 0.15, 0.02, 0, 0, 0); },
  plan: (ctx, w) => circ2(ctx, 0, 0, w / 2),
});
def({
  type: 'tv_unit', name: 'TV unit + TV', cat: 'Living', w: 180, d: 42, h: 50, slots: ['wood', 'cabinet', 'metal', 'screen'],
  build: (b, p) => {
    b.box('wood', p.w, p.h - 0.1, p.d, 0, 0.1, 0);
    for (const x of [-1, 1]) b.box('metal', 0.03, 0.1, 0.03, x * (p.w / 2 - 0.08), 0, 0);
    const n = Math.max(2, Math.round(p.w / 0.6));
    const fw = p.w / n;
    for (let i = 0; i < n; i++) b.box('cabinet', fw - 0.006, p.h - 0.12, 0.012, -p.w / 2 + fw / 2 + i * fw, 0.11, p.d / 2 + 0.006);
    const tw = Math.min(1.45, p.w * 0.8), th = tw * 0.5625;
    b.box('screen', tw, th, 0.03, 0, p.h + 0.08, -0.05);
    b.box('metal', 0.25, 0.01, 0.18, 0, p.h, -0.05);
    b.box('metal', 0.05, 0.08, 0.02, 0, p.h, -0.07);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); ctx.lineWidth *= 2; line2(ctx, -w * 0.4, -d / 2 + 6, w * 0.4, -d / 2 + 6); },
});
def({
  type: 'tv_wall', name: 'Wall-mounted TV', cat: 'Living', w: 145, d: 6, h: 82, elev: 110, slots: ['screen'],
  build: (b, p) => b.box('screen', p.w, p.h, p.d), plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'bookshelf', name: 'Bookshelf', cat: 'Living', w: 100, d: 35, h: 200, slots: ['wood', 'accent', 'fabric'],
  build: (b, p) => {
    const t = 0.02;
    b.box('wood', t, p.h, p.d, -p.w / 2 + t / 2, 0, 0);
    b.box('wood', t, p.h, p.d, p.w / 2 - t / 2, 0, 0);
    b.box('wood', p.w, p.h, 0.01, 0, 0, -p.d / 2 + 0.005);
    const n = Math.max(2, Math.round(p.h / 0.38));
    for (let i = 0; i <= n; i++) {
      const y = (i * (p.h - t)) / n;
      b.box('wood', p.w - 2 * t, t, p.d, 0, y, 0);
      if (i < n) {
        // books
        let x = -p.w / 2 + t + 0.02;
        let k = i * 7;
        while (x < p.w / 2 - 0.12) {
          const bw = 0.025 + ((k * 37) % 5) * 0.006, bh = 0.2 + ((k * 13) % 6) * 0.018;
          if ((k * 11) % 9 === 0) { x += 0.1; k++; continue; }
          b.box((k % 3) ? 'accent' : 'fabric', bw, bh, p.d * 0.7, x + bw / 2, y + t, 0, { cast: false });
          x += bw + 0.002; k++;
        }
      }
    }
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); line2(ctx, -w / 2, 0, w / 2, 0); },
});
def({
  type: 'sideboard', name: 'Sideboard / console', cat: 'Living', w: 160, d: 45, h: 75, slots: ['wood', 'cabinet', 'metal'],
  build: (b, p) => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.box('metal', 0.03, 0.15, 0.03, x * (p.w / 2 - 0.05), 0, z * (p.d / 2 - 0.05));
    b.box('wood', p.w, p.h - 0.15, p.d, 0, 0.15, 0);
    fronts(b, p.w, p.h - 0.17, p.d, 0.16, Math.max(2, Math.round(p.w / 0.45)));
  },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'rug', name: 'Rug', cat: 'Living', w: 200, d: 140, h: 1, slots: ['rug'],
  build: (b, p) => b.box('rug', p.w, 0.012, p.d, 0, 0.001, 0, { cast: false }),
  plan: (ctx, w, d) => { ctx.setLineDash([6, 4]); rect2(ctx, -w / 2, -d / 2, w, d); ctx.setLineDash([]); },
});
def({
  type: 'round_rug', name: 'Round rug', cat: 'Living', w: 160, d: 160, h: 1, slots: ['rug'],
  build: (b, p) => b.cyl('rug', p.w / 2, p.w / 2, 0.012, 0, 0.001, 0, { cast: false, seg: 48 }),
  plan: (ctx, w) => { ctx.setLineDash([6, 4]); circ2(ctx, 0, 0, w / 2); ctx.setLineDash([]); },
});
def({
  type: 'plant', name: 'Plant (floor)', cat: 'Living', w: 50, d: 50, h: 140, slots: ['plant', 'pot'],
  build: (b, p) => {
    b.lathe('pot', [[0.001, 0], [p.w * 0.36, 0], [p.w * 0.42, 0.34], [p.w * 0.4, 0.36], [0.001, 0.36]]);
    b.cyl('soil', p.w * 0.38, p.w * 0.38, 0.01, 0, 0.33, 0);
    b.cyl('wood', 0.015, 0.02, p.h * 0.45, 0, 0.34, 0);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = p.w * 0.25 + (i % 3) * 0.05;
      const y = 0.34 + p.h * 0.35 + (i % 4) * (p.h * 0.12);
      b.sphere('plant', 0.16, Math.cos(a) * r, y, Math.sin(a) * r, { sy: 0.25, sx: 1, sz: 0.5, ry: -a, rz: 0.4 });
    }
    b.sphere('plant', p.w * 0.35, 0, 0.34 + p.h * 0.75, 0, { sy: 0.9 });
  },
  plan: (ctx, w) => { circ2(ctx, 0, 0, w / 2); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; line2(ctx, 0, 0, Math.cos(a) * w * 0.45, Math.sin(a) * w * 0.45); } },
});
def({
  type: 'small_plant', name: 'Plant (table)', cat: 'Living', w: 22, d: 22, h: 35, elev: 0, slots: ['plant', 'pot'],
  build: (b, p) => {
    b.cyl('pot', p.w * 0.4, p.w * 0.32, p.h * 0.35, 0, 0, 0);
    b.sphere('plant', p.w * 0.55, 0, p.h * 0.6, 0, { sy: 0.9 });
  },
  plan: (ctx, w) => circ2(ctx, 0, 0, w / 2),
});
def({
  type: 'wall_art', name: 'Wall art', cat: 'Living', w: 80, d: 3, h: 100, elev: 120, slots: ['art', 'wood'],
  build: (b, p) => { b.box('wood', p.w, p.h, p.d); b.plane('art', p.w - 0.06, p.h - 0.06, 0, p.h / 2, p.d / 2 + 0.001, { cast: false }); },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'curtains', name: 'Curtains', cat: 'Living', w: 200, d: 12, h: 250, slots: ['curtain', 'metal'],
  build: (b, p) => {
    b.cyl('metal', 0.012, 0.012, p.w + 0.2, 0, p.h - 0.02, -0.02, { rz: Math.PI / 2 }).position.y = p.h - 0.02;
    const panelW = p.w * 0.28;
    for (const s of [-1, 1]) {
      const folds = 7;
      for (let i = 0; i < folds; i++) {
        const x = s * (p.w / 2 - panelW / 2 + 0.1) + ((i - folds / 2) * panelW) / folds;
        b.cyl('curtain', 0.04, 0.045, p.h - 0.06, x, 0.01, (i % 2 ? 0.02 : -0.015), { seg: 10 });
      }
    }
  },
  plan: (ctx, w, d) => { ctx.setLineDash([2, 2]); rect2(ctx, -w / 2, -d / 2, w, d); ctx.setLineDash([]); },
});

// ---------- dining ----------
function tableLegs(b, p, top = 0.04, inset = 0.06) {
  b.box('wood', p.w, top, p.d, 0, p.h - top, 0);
  for (const x of [-1, 1]) for (const z of [-1, 1]) b.box('wood', 0.05, p.h - top, 0.05, x * (p.w / 2 - inset), 0, z * (p.d / 2 - inset));
}
def({
  type: 'dining_table', name: 'Dining table', cat: 'Dining', w: 160, d: 90, h: 75, slots: ['wood'],
  build: (b, p) => tableLegs(b, p), plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'round_table', name: 'Round dining table', cat: 'Dining', w: 110, d: 110, h: 75, slots: ['wood', 'metal'],
  build: (b, p) => { b.cyl('wood', p.w / 2, p.w / 2, 0.035, 0, p.h - 0.035, 0, { seg: 48 }); b.cyl('wood', 0.06, 0.06, p.h - 0.035, 0, 0, 0); b.cyl('wood', 0.3, 0.32, 0.04, 0, 0, 0); },
  plan: (ctx, w) => circ2(ctx, 0, 0, w / 2),
});
def({
  type: 'chair', name: 'Dining chair', cat: 'Dining', w: 46, d: 52, h: 82, slots: ['wood', 'fabric'],
  build: (b, p) => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.box('wood', 0.03, 0.45, 0.03, x * (p.w / 2 - 0.03), 0, z * (p.d / 2 - 0.03));
    b.rbox('fabric', p.w, 0.05, p.d, 0.015, 0, 0.44, 0);
    for (const x of [-1, 1]) b.box('wood', 0.03, p.h - 0.45, 0.03, x * (p.w / 2 - 0.03), 0.45, -p.d / 2 + 0.03);
    b.rbox('wood', p.w, 0.14, 0.025, 0.01, 0, p.h - 0.16, -p.d / 2 + 0.03);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); rect2(ctx, -w / 2, -d / 2, w, 6); },
});
def({
  type: 'bar_stool', name: 'Bar stool', cat: 'Dining', w: 40, d: 40, h: 75, slots: ['fabric', 'metal'],
  build: (b, p) => {
    b.cyl('metal', 0.02, 0.02, p.h - 0.05, 0, 0, 0);
    b.cyl('metal', 0.18, 0.2, 0.02, 0, 0, 0);
    b.torus('metal', 0.16, 0.008, 0, 0.3, 0, { rx: Math.PI / 2 });
    b.cyl('fabric', p.w / 2, p.w / 2 - 0.02, 0.06, 0, p.h - 0.06, 0);
  },
  plan: (ctx, w) => circ2(ctx, 0, 0, w / 2),
});
def({
  type: 'bench', name: 'Bench', cat: 'Dining', w: 140, d: 38, h: 45, slots: ['wood'],
  build: (b, p) => tableLegs(b, p, 0.04, 0.08), plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});

// ---------- bedroom ----------
function bed(b, p) {
  const { w, d } = p;
  b.box('wood', w, 0.25, d, 0, 0.05, 0);
  for (const x of [-1, 1]) for (const z of [-1, 1]) b.box('wood', 0.05, 0.05, 0.05, x * (w / 2 - 0.05), 0, z * (d / 2 - 0.05));
  b.rbox('fabric', w + 0.04, p.h, 0.08, 0.03, 0, 0.05, -d / 2 - 0.02);
  b.rbox('bedding', w - 0.04, 0.22, d - 0.1, 0.05, 0, 0.3, 0.02);
  // duvet
  b.rbox('bedding', w + 0.02, 0.08, d * 0.62, 0.035, 0, 0.47, d * 0.18);
  b.rbox('accent', w + 0.03, 0.085, 0.45, 0.035, 0, 0.475, d / 2 - 0.35);
  const n = w > 1.2 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i ? 1 : -1) * w * 0.24;
    b.rbox('bedding', Math.min(0.66, w / n - 0.08), 0.14, 0.4, 0.06, x, 0.5, -d / 2 + 0.3, { rx: -0.15 });
    b.rbox('accent', Math.min(0.45, w / n - 0.2), 0.3, 0.1, 0.05, x, 0.52, -d / 2 + 0.46, { rx: -0.3 });
  }
}
function bedPlan(ctx, w, d) {
  rect2(ctx, -w / 2, -d / 2, w, d);
  const n = w > 120 ? 2 : 1;
  for (let i = 0; i < n; i++) rect2(ctx, -w / 2 + 8 + (i * (w - 8)) / n, -d / 2 + 8, (w - 8) / n - 8, 32);
  line2(ctx, -w / 2, -d / 2 + 60, w / 2, -d / 2 + 60);
}
def({ type: 'bed_double', name: 'Double bed 160×200', cat: 'Bedroom', w: 170, d: 215, h: 110, slots: ['fabric', 'bedding', 'accent', 'wood'], build: bed, plan: bedPlan });
def({ type: 'bed_king', name: 'King bed 180×200', cat: 'Bedroom', w: 190, d: 215, h: 115, slots: ['fabric', 'bedding', 'accent', 'wood'], build: bed, plan: bedPlan });
def({ type: 'bed_single', name: 'Single bed 90×200', cat: 'Bedroom', w: 100, d: 210, h: 90, slots: ['fabric', 'bedding', 'accent', 'wood'], build: bed, plan: bedPlan });
def({
  type: 'nightstand', name: 'Nightstand', cat: 'Bedroom', w: 45, d: 40, h: 50, slots: ['wood', 'cabinet', 'metal'],
  build: (b, p) => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.cyl('wood', 0.015, 0.012, 0.15, x * (p.w / 2 - 0.04), 0, z * (p.d / 2 - 0.04));
    b.box('wood', p.w, p.h - 0.15, p.d, 0, 0.15, 0);
    b.box('cabinet', p.w - 0.03, (p.h - 0.15) * 0.45, 0.012, 0, p.h - (p.h - 0.15) * 0.5, p.d / 2 + 0.006);
    b.box('metal', 0.1, 0.01, 0.015, 0, p.h - (p.h - 0.15) * 0.3, p.d / 2 + 0.015);
  },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'wardrobe', name: 'Wardrobe', cat: 'Bedroom', w: 200, d: 60, h: 230, slots: ['cabinet', 'metal'],
  build: (b, p) => { b.box('cabinet', p.w, p.h, p.d - 0.02, 0, 0, -0.01); fronts(b, p.w, p.h - 0.08, p.d - 0.02, 0.08, Math.max(1, Math.round(p.w / 0.5))); b.box('cabinet', p.w - 0.02, 0.08, 0.01, 0, 0, p.d / 2 - 0.03); },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); line2(ctx, -w / 2, -d / 2, w / 2, d / 2); line2(ctx, w / 2, -d / 2, -w / 2, d / 2); },
});
def({
  type: 'dresser', name: 'Chest of drawers', cat: 'Bedroom', w: 100, d: 48, h: 85, slots: ['wood', 'cabinet', 'metal'],
  build: (b, p) => {
    b.box('wood', p.w, p.h - 0.1, p.d, 0, 0.1, 0);
    for (const x of [-1, 1]) b.box('wood', 0.04, 0.1, p.d - 0.06, x * (p.w / 2 - 0.05), 0, 0);
    const rows = 3, rh = (p.h - 0.14) / rows;
    for (let r = 0; r < rows; r++) {
      b.box('cabinet', p.w - 0.04, rh - 0.01, 0.012, 0, 0.12 + r * rh, p.d / 2 + 0.006);
      b.box('metal', 0.14, 0.012, 0.02, 0, 0.12 + r * rh + rh / 2, p.d / 2 + 0.02);
    }
  },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'desk', name: 'Desk', cat: 'Bedroom', w: 120, d: 60, h: 75, slots: ['wood', 'metal', 'screen'],
  build: (b, p) => {
    b.box('wood', p.w, 0.03, p.d, 0, p.h - 0.03, 0);
    for (const x of [-1, 1]) { b.box('metal', 0.04, p.h - 0.03, 0.04, x * (p.w / 2 - 0.05), 0, -p.d / 2 + 0.06); b.box('metal', 0.04, p.h - 0.03, 0.04, x * (p.w / 2 - 0.05), 0, p.d / 2 - 0.06); }
    b.box('screen', 0.55, 0.33, 0.02, 0, p.h + 0.12, -p.d / 2 + 0.12);
    b.box('metal', 0.04, 0.12, 0.04, 0, p.h, -p.d / 2 + 0.1);
  },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'office_chair', name: 'Office chair', cat: 'Bedroom', w: 60, d: 60, h: 100, slots: ['fabric', 'metal'],
  build: (b, p) => {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; b.box('metal', 0.03, 0.03, 0.28, Math.sin(a) * 0.14, 0.03, Math.cos(a) * 0.14, { ry: a }); }
    b.cyl('metal', 0.025, 0.025, 0.4, 0, 0.05, 0);
    b.rbox('fabric', 0.5, 0.08, 0.48, 0.03, 0, 0.45, 0.02);
    b.rbox('fabric', 0.46, 0.5, 0.06, 0.03, 0, 0.55, -0.24, { rx: -0.1 });
  },
  plan: (ctx, w, d) => { circ2(ctx, 0, 0, w / 2); rect2(ctx, -w * 0.38, -d / 2, w * 0.76, 8); },
});
def({
  type: 'vanity_table', name: 'Dressing table', cat: 'Bedroom', w: 100, d: 45, h: 75, slots: ['wood', 'mirror'],
  build: (b, p) => { tableLegs(b, p, 0.03); b.cyl('wood', 0.3, 0.3, 0.02, 0, p.h + 0.2, -p.d / 2 + 0.03, { rx: Math.PI / 2 }); b.cyl('mirror', 0.28, 0.28, 0.005, 0, p.h + 0.2, -p.d / 2 + 0.045, { rx: Math.PI / 2 }); },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});

// ---------- bathroom ----------
def({
  type: 'toilet', name: 'Toilet (wall-hung)', cat: 'Bathroom', w: 38, d: 55, h: 40, slots: ['ceramic', 'metal'],
  build: (b, p) => {
    b.lathe('ceramic', [[0.0, 0], [0.13, 0.0], [0.18, 0.12], [0.19, 0.2], [0.17, 0.2], [0.0, 0.18]], 0, p.h - 0.2, 0.04, { sx: (p.w / 2) / 0.19, sz: 1.35 });
    b.rbox('ceramic', p.w * 0.95, 0.03, 0.46, 0.012, 0, p.h, 0.03);
    b.rbox('ceramic', p.w * 0.9, 0.3, 0.16, 0.04, 0, p.h - 0.26, -p.d / 2 + 0.08);
    // flush plate
    b.box('metal', 0.22, 0.15, 0.012, 0, 0.95, -p.d / 2 + 0.006);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, 14); ctx.beginPath(); ctx.ellipse(0, 6, w / 2, d / 2 - 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); },
});
def({
  type: 'toilet_classic', name: 'Toilet (close-coupled)', cat: 'Bathroom', w: 38, d: 68, h: 80, slots: ['ceramic', 'metal'],
  build: (b, p) => {
    b.lathe('ceramic', [[0.0, 0], [0.1, 0.0], [0.12, 0.2], [0.18, 0.36], [0.19, 0.41], [0.0, 0.39]], 0, 0, 0.06, { sx: 1, sz: 1.35 });
    b.rbox('ceramic', 0.37, 0.03, 0.46, 0.012, 0, 0.41, 0.06);
    b.rbox('ceramic', 0.36, 0.38, 0.17, 0.03, 0, 0.42, -p.d / 2 + 0.09);
    b.box('metal', 0.04, 0.012, 0.03, 0.1, 0.72, -p.d / 2 + 0.18);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, 18); ctx.beginPath(); ctx.ellipse(0, 10, w / 2, d / 2 - 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); },
});
def({
  type: 'vanity', name: 'Vanity with basin', cat: 'Bathroom', w: 80, d: 48, h: 85, slots: ['cabinet', 'countertop', 'ceramic', 'metal'],
  build: (b, p) => {
    b.box('cabinet', p.w, 0.5, p.d - 0.02, 0, 0.3, -0.01);
    fronts(b, p.w, 0.5, p.d - 0.02, 0.3, 1, { drawers: true });
    b.box('countertop', p.w, 0.03, p.d, 0, p.h - 0.05, 0);
    b.lathe('ceramic', [[0.0, 0], [0.12, 0.0], [0.19, 0.08], [0.2, 0.12], [0.18, 0.12], [0.0, 0.03]], 0, p.h - 0.02, 0.03, { sx: 1.2, sz: 0.9 });
    b.cyl('metal', 0.014, 0.014, 0.22, 0, p.h - 0.02, -p.d / 2 + 0.06);
    b.box('metal', 0.02, 0.02, 0.14, 0, p.h + 0.18, -p.d / 2 + 0.12);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); ctx.beginPath(); ctx.ellipse(0, 3, 22, 16, 0, 0, Math.PI * 2); ctx.stroke(); },
});
def({
  type: 'bathtub', name: 'Bathtub', cat: 'Bathroom', w: 170, d: 75, h: 58, slots: ['ceramic', 'metal', 'cabinet'],
  build: (b, p) => {
    const t = 0.07, H = p.h;
    // apron (cabinet slot) on the outside, ceramic rim and basin inside
    b.box('cabinet', p.w, H - 0.02, 0.02, 0, 0, p.d / 2 - 0.01);
    b.box('cabinet', 0.02, H - 0.02, p.d, -p.w / 2 + 0.01, 0, 0);
    b.box('cabinet', 0.02, H - 0.02, p.d, p.w / 2 - 0.01, 0, 0);
    b.box('ceramic', p.w, H - 0.02, 0.02, 0, 0, -p.d / 2 + 0.01);
    b.box('ceramic', p.w, 0.03, t, 0, H - 0.03, -p.d / 2 + t / 2);
    b.box('ceramic', p.w, 0.03, t, 0, H - 0.03, p.d / 2 - t / 2);
    b.box('ceramic', t, 0.03, p.d - 2 * t, -p.w / 2 + t / 2, H - 0.03, 0);
    b.box('ceramic', t, 0.03, p.d - 2 * t, p.w / 2 - t / 2, H - 0.03, 0);
    b.box('ceramic', p.w - 2 * t, 0.02, p.d - 2 * t, 0, 0.12, 0);
    b.box('ceramic', p.w - 2 * t, H - 0.15, 0.01, 0, 0.12, -p.d / 2 + t);
    b.box('ceramic', p.w - 2 * t, H - 0.15, 0.01, 0, 0.12, p.d / 2 - t);
    b.box('ceramic', 0.01, H - 0.15, p.d - 2 * t, -p.w / 2 + t, 0.12, 0);
    b.box('ceramic', 0.01, H - 0.15, p.d - 2 * t, p.w / 2 - t, 0.12, 0);
    b.cyl('metal', 0.015, 0.015, 0.12, p.w / 2 - 0.12, H, -p.d / 2 + 0.04);
    b.box('metal', 0.02, 0.02, 0.12, p.w / 2 - 0.12, H + 0.1, -p.d / 2 + 0.09);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); ctx.beginPath(); ctx.roundRect(-w / 2 + 8, -d / 2 + 8, w - 16, d - 16, 20); ctx.stroke(); },
});
def({
  type: 'shower', name: 'Walk-in shower', cat: 'Bathroom', w: 90, d: 90, h: 200, slots: ['ceramic', 'glass', 'metal'],
  build: (b, p) => {
    b.box('ceramic', p.w, 0.03, p.d, 0, 0, 0, { cast: false });
    b.box('screen', 0.12, 0.002, 0.03, 0, 0.03, 0, { cast: false });
    b.box('glass', 0.008, p.h, p.d * 0.8, -p.w / 2 + 0.01, 0.03, p.d / 2 - p.d * 0.4, { cast: false });
    b.box('glass', p.w * 0.6, p.h, 0.008, -p.w / 2 + p.w * 0.3, 0.03, p.d / 2 - 0.004, { cast: false });
    b.box('metal', 0.02, 0.02, p.d * 0.8, -p.w / 2 + 0.01, p.h + 0.03, p.d / 2 - p.d * 0.4);
    b.cyl('metal', 0.012, 0.012, 1.2, p.w / 2 - 0.05, 0.9, -p.d / 2 + 0.04);
    b.box('metal', 0.02, 0.02, 0.32, p.w / 2 - 0.05, 2.08, -p.d / 2 + 0.2);
    b.cyl('metal', 0.12, 0.12, 0.01, p.w / 2 - 0.05, 2.06, -p.d / 2 + 0.34);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); line2(ctx, -w / 2, -d / 2, w / 2, d / 2); line2(ctx, w / 2, -d / 2, -w / 2, d / 2); circ2(ctx, 0, 0, 3); },
});
def({
  type: 'mirror', name: 'Mirror', cat: 'Bathroom', w: 70, d: 3, h: 80, elev: 110, slots: ['mirror', 'metal'],
  build: (b, p) => { b.rbox('metal', p.w, p.h, p.d, 0.01); b.box('mirror', p.w - 0.02, p.h - 0.02, 0.003, 0, 0.01, p.d / 2); },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'round_mirror', name: 'Round mirror', cat: 'Bathroom', w: 60, d: 3, h: 60, elev: 115, slots: ['mirror', 'metal'],
  build: (b, p) => { b.cyl('metal', p.w / 2, p.w / 2, p.d, 0, p.h / 2, 0, { rx: Math.PI / 2 }).position.y = p.h / 2; const m = b.cyl('mirror', p.w / 2 - 0.012, p.w / 2 - 0.012, 0.003, 0, 0, p.d / 2, { rx: Math.PI / 2 }); m.position.y = p.h / 2; },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'washer', name: 'Washing machine', cat: 'Bathroom', w: 60, d: 60, h: 85, slots: ['appliance', 'glass', 'metal'],
  build: (b, p) => {
    b.rbox('appliance', p.w, p.h, p.d, 0.012);
    const door = b.cyl('metal', 0.17, 0.17, 0.03, 0, 0, p.d / 2, { rx: Math.PI / 2 }); door.position.y = 0.42;
    const glass = b.cyl('screen', 0.13, 0.13, 0.035, 0, 0, p.d / 2, { rx: Math.PI / 2 }); glass.position.y = 0.42;
    b.box('screen', 0.5, 0.08, 0.005, 0, p.h - 0.12, p.d / 2);
  },
  plan: (ctx, w, d) => { rect2(ctx, -w / 2, -d / 2, w, d); circ2(ctx, 0, 0, w * 0.3); },
});
def({
  type: 'towel_rail', name: 'Towel radiator', cat: 'Bathroom', w: 50, d: 8, h: 120, elev: 30, slots: ['metal', 'accent'],
  build: (b, p) => {
    for (const x of [-1, 1]) b.cyl('metal', 0.015, 0.015, p.h, x * (p.w / 2 - 0.015), 0, 0);
    for (let i = 0; i < 12; i++) { const m = b.cyl('metal', 0.01, 0.01, p.w, 0, 0, 0, { rz: Math.PI / 2 }); m.position.y = 0.05 + (i * (p.h - 0.1)) / 11; }
    b.box('accent', p.w - 0.06, 0.5, 0.03, 0, p.h - 0.62, 0.03);
  },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});

// ---------- lights ----------
def({
  type: 'ceiling_light', name: 'Ceiling light (flush)', cat: 'Lighting', w: 40, d: 40, h: 10, elev: -1, slots: ['lampshade'],
  light: { y: -0.08, power: 1.0 },
  build: (b, p) => { b.cyl('lampshade', p.w / 2, p.w / 2 - 0.03, p.h, 0, -p.h, 0, { cast: false }); },
  plan: (ctx, w) => { circ2(ctx, 0, 0, w / 2); line2(ctx, -w / 2, 0, w / 2, 0); line2(ctx, 0, -w / 2, 0, w / 2); },
});
def({
  type: 'pendant', name: 'Pendant lamp', cat: 'Lighting', w: 35, d: 35, h: 90, elev: -1, slots: ['lampshade', 'metal'],
  light: { y: -0.8, power: 0.8 },
  build: (b, p) => {
    b.cyl('metal', 0.004, 0.004, p.h - 0.25, 0, -(p.h - 0.25), 0, { cast: false });
    b.cyl('metal', 0.05, 0.05, 0.02, 0, -0.02, 0, { cast: false });
    b.cyl('lampshade', 0.04, p.w / 2, 0.25, 0, -p.h, 0, { cast: false, open: true });
    b.sphere('bulb', 0.04, 0, -p.h + 0.03, 0, { cast: false });
  },
  plan: (ctx, w) => { circ2(ctx, 0, 0, w / 2); circ2(ctx, 0, 0, 3); },
});
def({
  type: 'globe_pendant', name: 'Globe pendant', cat: 'Lighting', w: 30, d: 30, h: 80, elev: -1, slots: ['lampshade', 'metal'],
  light: { y: -0.65, power: 0.8 },
  build: (b, p) => { b.cyl('metal', 0.004, 0.004, p.h - p.w, 0, -(p.h - p.w), 0, { cast: false }); b.sphere('lampshade', p.w / 2, 0, -p.h + p.w / 2, 0, { cast: false }); },
  plan: (ctx, w) => circ2(ctx, 0, 0, w / 2),
});
def({
  type: 'floor_lamp', name: 'Floor lamp', cat: 'Lighting', w: 40, d: 40, h: 160, slots: ['lampshade', 'metal'],
  light: { y: 1.4, power: 0.5 },
  build: (b, p) => {
    b.cyl('metal', 0.15, 0.15, 0.02, 0, 0, 0);
    b.cyl('metal', 0.01, 0.01, p.h - 0.3, 0, 0.02, 0);
    b.cyl('lampshade', p.w * 0.35, p.w / 2, 0.3, 0, p.h - 0.3, 0, { open: true, cast: false });
  },
  plan: (ctx, w) => { circ2(ctx, 0, 0, w / 2); circ2(ctx, 0, 0, 3); },
});
def({
  type: 'table_lamp', name: 'Table lamp', cat: 'Lighting', w: 30, d: 30, h: 45, elev: 50, slots: ['lampshade', 'ceramic'],
  light: { y: 0.32, power: 0.3 },
  build: (b, p) => {
    b.lathe('ceramic', [[0.001, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.2], [0.015, 0.24], [0.001, 0.24]]);
    b.cyl('lampshade', p.w * 0.35, p.w / 2, 0.22, 0, 0.22, 0, { open: true, cast: false });
  },
  plan: (ctx, w) => circ2(ctx, 0, 0, w / 2),
});
def({
  type: 'wall_sconce', name: 'Wall sconce', cat: 'Lighting', w: 15, d: 15, h: 25, elev: 170, slots: ['lampshade', 'metal'],
  light: { y: 0.12, power: 0.25 },
  build: (b, p) => { b.box('metal', 0.08, 0.12, 0.01, 0, 0.06, -p.d / 2 + 0.005); b.cyl('lampshade', 0.05, 0.07, p.h, 0, 0, 0.0, { cast: false, open: true }); },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'led_strip', name: 'LED strip (under cabinet)', cat: 'Lighting', w: 120, d: 3, h: 1, elev: 144, slots: ['bulb'],
  light: { y: -0.02, power: 0.25, rect: true },
  build: (b, p) => b.box('bulb', p.w, 0.008, 0.02, 0, 0, 0, { cast: false }),
  plan: (ctx, w, d) => { ctx.setLineDash([2, 2]); rect2(ctx, -w / 2, -d / 2, w, d); ctx.setLineDash([]); },
});

// ---------- misc ----------
def({
  type: 'shoe_cabinet', name: 'Shoe cabinet', cat: 'Misc', w: 100, d: 35, h: 100, slots: ['cabinet', 'wood', 'metal'],
  build: (b, p) => { b.box('cabinet', p.w, p.h, p.d - 0.02, 0, 0, -0.01); fronts(b, p.w, p.h - 0.02, p.d - 0.02, 0.01, 2); b.box('wood', p.w + 0.02, 0.02, p.d + 0.01, 0, p.h, 0); },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'coat_rack', name: 'Coat hooks + bench', cat: 'Misc', w: 100, d: 35, h: 180, slots: ['wood', 'metal', 'fabric'],
  build: (b, p) => {
    b.box('wood', p.w, 0.04, p.d, 0, 0.44, 0);
    for (const x of [-1, 1]) b.box('wood', 0.04, 0.44, p.d, x * (p.w / 2 - 0.02), 0, 0);
    b.box('wood', p.w, 0.12, 0.02, 0, 1.6, -p.d / 2 + 0.01);
    for (let i = 0; i < 5; i++) b.cyl('metal', 0.008, 0.008, 0.08, -p.w / 2 + 0.1 + (i * (p.w - 0.2)) / 4, 1.62, -p.d / 2 + 0.05, { rx: Math.PI / 2.4 });
    b.rbox('fabric', 0.45, 0.9, 0.12, 0.05, -p.w * 0.2, 0.72, -p.d / 2 + 0.1);
  },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'radiator', name: 'Radiator', cat: 'Misc', w: 100, d: 10, h: 60, elev: 15, slots: ['metal'],
  build: (b, p) => { const n = Math.round(p.w / 0.06); for (let i = 0; i < n; i++) b.rbox('appliance', 0.045, p.h, p.d, 0.01, -p.w / 2 + 0.03 + i * (p.w / n), 0, 0); },
  plan: (ctx, w, d) => rect2(ctx, -w / 2, -d / 2, w, d),
});
def({
  type: 'column', name: 'Column / box-out', cat: 'Misc', w: 30, d: 30, h: 260, slots: ['cabinet'],
  build: (b, p) => b.box('cabinet', p.w, p.h, p.d),
  plan: (ctx, w, d) => { ctx.save(); ctx.fillStyle = '#555'; rect2(ctx, -w / 2, -d / 2, w, d); ctx.restore(); },
});

export const ITEMS = I;
export const ITEM_BY_TYPE = Object.fromEntries(I.map((i) => [i.type, i]));
export const ITEM_CATS = [...new Set(I.map((i) => i.cat))];
