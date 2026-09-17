// Sample floor plans (cm). Built with a tiny DSL on top of the model helpers.
import { blankPlan, addWall, addRoom, addOpening, nearestWall, makeItem, normalizePlan, wallSideRooms } from './model.js';

function builder(name) {
  const plan = blankPlan(name);
  const api = {
    plan,
    ext(pts) {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        addWall(plan, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }, plan.defaults.extThickness);
      }
    },
    wall(x1, y1, x2, y2, t) { addWall(plan, { x: x1, y: y1 }, { x: x2, y: y2 }, t ?? plan.defaults.intThickness); },
    room(name, type, pts, opts = {}) { return addRoom(plan, pts.map(([x, y]) => ({ x, y })), { name, type, ...opts }); },
    rect(name, type, x0, y0, x1, y1, opts) { return api.room(name, type, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], opts); },
    open(kind, style, x, y, extra = {}) {
      const nw = nearestWall(plan, { x, y }, 20);
      if (!nw) { console.warn('no wall near', x, y); return null; }
      return addOpening(plan, kind, style, nw.wall, nw.offset, extra);
    },
    item(type, x, y, rot = 0, extra = {}) { const it = makeItem(type, x, y, rot, extra); plan.items.push(it); return it; },
    /** override finish on the side of the wall at (x,y) facing `room` */
    wallFinish(x, y, room, finish) {
      const nw = nearestWall(plan, { x, y }, 20);
      const sides = wallSideRooms(plan, nw.wall);
      const side = sides.A === room ? 'A' : 'B';
      Object.assign(nw.wall.sides[side], finish);
    },
  };
  return api;
}

// ------------------------------------------------------------------
// 1+1 apartment with open kitchen (≈ 56 m²)
// ------------------------------------------------------------------
function onePlusOne() {
  const B = builder('1+1 apartment – open kitchen');
  const { plan } = B;
  B.ext([[0, 0], [900, 0], [900, 650], [0, 650]]);
  B.wall(550, 0, 550, 370);
  B.wall(550, 370, 900, 370);
  B.wall(650, 370, 650, 650);

  const kitchen = B.rect('Kitchen', 'kitchen', 0, 0, 550, 290, { floorMat: 'encaustic-grey', band: { mat: 'zellige-white', from: 90, to: 145, where: 'counters' } });
  const living = B.room('Living & entry', 'living', [[0, 290], [550, 290], [550, 370], [650, 370], [650, 650], [0, 650]], { floorMat: 'oak-herringbone' });
  const bed = B.rect('Bedroom', 'bedroom', 550, 0, 900, 370, { floorMat: 'oak-planks', wallMat: 'paint-greige' });
  B.rect('Bathroom', 'bathroom', 650, 370, 900, 650, { floorMat: 'terrazzo-classic', wallMat: 'paint-sage', band: { mat: 'zellige-white', from: 0, to: 210, where: 'all' } });

  // openings
  B.open('window', 'casement', 180, 0, { width: 100, height: 110, sill: 105 });
  B.open('door', 'sliding', 0, 470, { width: 180 });
  B.open('window', 'casement', 470, 650, { width: 100 });
  B.open('window', 'casement', 900, 150, { width: 120 });
  B.open('window', 'frosted', 900, 505);
  B.open('door', 'entry', 600, 650, { width: 90, swing: 'A', flip: true });
  B.open('door', 'interior', 600, 370, { swing: 'B' });
  B.open('door', 'interior', 650, 440, { swing: 'A' });

  // kitchen run along the top wall
  B.item('fridge', 45, 44, 0);
  B.item('drawer_cabinet', 110, 40, 0);
  B.item('sink_cabinet', 180, 40, 0);
  B.item('dishwasher', 250, 40, 0);
  B.item('cooktop_cabinet', 310, 40, 0);
  B.item('base_cabinet', 370, 40, 0);
  B.item('wall_cabinet', 110, 27.5, 0);
  B.item('wall_cabinet', 370, 27.5, 0);
  B.item('range_hood', 310, 35, 0);
  B.item('led_strip', 110, 20, 0, { w: 60 });
  B.item('led_strip', 370, 20, 0, { w: 60 });
  B.item('island', 220, 215, 180, { w: 200 });
  for (const x of [160, 220, 280]) B.item('bar_stool', x, 280, 0);
  B.item('globe_pendant', 180, 215, 0, { elev: -1 });
  B.item('globe_pendant', 260, 215, 0, { elev: -1 });
  B.item('small_plant', 290, 215, 0, { elev: 92 });

  // living
  B.item('sofa', 270, 430, 0);
  B.item('rug', 270, 520, 0, { w: 240, d: 170, mats: { rug: 'rug-stripe' } });
  B.item('coffee_table', 270, 530, 0);
  B.item('tv_unit', 270, 619, 180);
  B.item('armchair', 95, 530, 270);
  B.item('side_table', 135, 410, 0);
  B.item('floor_lamp', 405, 400, 0);
  B.item('plant', 32, 620, 0);
  B.item('curtains', 12, 470, 270, { w: 220 });

  // bedroom
  B.item('bed_double', 722, 117.5, 0);
  B.item('nightstand', 590, 32, 0);
  B.item('nightstand', 855, 32, 0);
  B.item('table_lamp', 590, 32, 0, { elev: 50 });
  B.item('table_lamp', 855, 32, 0, { elev: 50 });
  B.item('wardrobe', 790, 335, 180, { w: 180 });
  B.item('rug', 722, 190, 0, { w: 240, d: 160, mats: { rug: 'rug-diamond' } });
  B.item('curtains', 888, 150, 90, { w: 160 });
  B.wallFinish(720, 0, bed, { mat: 'wallpaper-botanical' });

  // bathroom
  B.item('vanity', 740, 399, 0);
  B.item('mirror', 740, 376.5, 0);
  B.item('toilet', 720, 612.5, 180);
  B.item('shower', 845, 595, 180);
  B.item('washer', 860, 440, 90);

  // accent wall behind the TV
  B.wallFinish(270, 650, living, { mat: 'paint-sage' });
  void kitchen;

  Object.assign(plan.theme, { cabinet: 'cab-sage', countertop: 'ct-carrara', fabric: 'fab-oat', accent: 'fab-terracotta', wood: 'wood-oak', metal: 'metal-brass', rug: 'rug-jute' });
  return plan;
}

// ------------------------------------------------------------------
// Studio (≈ 33 m²)
// ------------------------------------------------------------------
function studio() {
  const B = builder('Studio apartment');
  const { plan } = B;
  B.ext([[0, 0], [600, 0], [600, 550], [0, 550]]);
  B.wall(400, 350, 600, 350);
  B.wall(400, 350, 400, 550);
  B.rect('Studio', 'living', 0, 0, 400, 550, { floorMat: 'ash-planks', wallMat: 'limewash' });
  B.rect('Kitchenette', 'kitchen', 400, 0, 600, 350, { floorMat: 'ash-planks', wallMat: 'limewash', band: { mat: 'finger-kitkat', from: 90, to: 150, where: 'counters' } });
  B.rect('Shower room', 'bathroom', 400, 350, 600, 550, { floorMat: 'microcement', wallMat: 'microcement', band: { mat: 'finger-kitkat', from: 0, to: 120, where: 'all' } });

  B.open('window', 'casement', 500, 0, { width: 100, sill: 105, height: 110 });
  B.open('window', 'grid', 200, 0, { width: 110 });
  B.open('window', 'tall', 0, 400, { width: 120 });
  B.open('window', 'casement', 100, 550, { width: 100 });
  B.open('window', 'frosted', 600, 450);
  B.open('door', 'entry', 345, 550, { swing: 'A' });
  B.open('door', 'pocket', 400, 400, { width: 75 });

  B.item('fridge', 556, 45, 90);
  B.item('sink_cabinet', 560, 125, 90);
  B.item('dishwasher', 560, 195, 90);
  B.item('cooktop_cabinet', 560, 255, 90);
  B.item('base_cabinet', 560, 315, 90);
  B.item('wall_cabinet', 572.5, 195, 90);
  B.item('open_shelf', 577.5, 125, 90, { w: 80 });
  B.item('range_hood', 565, 255, 90);
  B.item('round_table', 450, 175, 0, { w: 80, d: 80 });
  B.item('chair', 450, 115, 0);
  B.item('chair', 450, 235, 180);
  B.item('pendant', 450, 175, 0, { elev: -1 });

  B.item('bed_double', 117.5, 130, 270);
  B.item('nightstand', 32, 240, 270);
  B.item('table_lamp', 32, 240, 0, { elev: 50 });
  B.item('sofa2', 200, 380, 0);
  B.item('coffee_table', 200, 455, 0, { w: 90, d: 50 });
  B.item('tv_unit', 200, 519, 180, { w: 150 });
  B.item('round_rug', 200, 440, 0, { w: 180, d: 180, mats: { rug: 'rug-grey' } });
  B.item('plant', 360, 300, 0);
  B.item('floor_lamp', 330, 400, 0);
  B.item('wall_art', 11.5, 130, 270, { w: 100, h: 60, elev: 125 });

  B.item('toilet', 562.5, 395, 90);
  B.item('vanity', 429, 500, 270);
  B.item('round_mirror', 406.5, 500, 270);
  B.item('shower', 545, 495, 90);

  Object.assign(plan.theme, { cabinet: 'wood-oak', countertop: 'ct-concrete', fabric: 'fab-boucle', accent: 'fab-charcoal', wood: 'wood-light', metal: 'metal-black', rug: 'rug-grey', bedding: 'fab-linen', ceramic: 'ceramic-sand' });
  return plan;
}

// ------------------------------------------------------------------
// 2+1 family apartment (≈ 88 m²)
// ------------------------------------------------------------------
function twoPlusOne() {
  const B = builder('2+1 family apartment');
  const { plan } = B;
  B.ext([[0, 0], [1100, 0], [1100, 800], [0, 800]]);
  B.wall(0, 300, 400, 300);
  B.wall(400, 300, 600, 300);
  B.wall(400, 0, 400, 300);
  B.wall(600, 0, 600, 300);
  B.wall(600, 150, 720, 150);
  B.wall(720, 0, 720, 800);
  B.wall(720, 420, 1100, 420);

  B.rect('Kitchen', 'kitchen', 0, 0, 400, 300, { floorMat: 'hex-terracotta', wallMat: 'limewash', band: { mat: 'encaustic-blue', from: 90, to: 150, where: 'counters' } });
  B.rect('Bathroom', 'bathroom', 400, 0, 600, 300, { floorMat: 'encaustic-star', band: { mat: 'zellige-blue', from: 0, to: 120, where: 'all' }, wallMat: 'limewash' });
  B.rect('Laundry', 'other', 600, 0, 720, 150, { floorMat: 'porcelain-60-beige' });
  const living = B.room('Living, dining & hall', 'living', [[0, 300], [600, 300], [600, 150], [720, 150], [720, 800], [0, 800]], { floorMat: 'travertine', wallMat: 'limewash' });
  B.rect('Main bedroom', 'bedroom', 720, 0, 1100, 420, { floorMat: 'oak-planks', wallMat: 'paint-clay' });
  B.rect('Kids room', 'bedroom', 720, 420, 1100, 800, { floorMat: 'ash-planks', wallMat: 'paint-soft-blue' });

  B.open('door', 'passage', 200, 300, { width: 200, height: 220 });
  B.open('door', 'interior', 600, 225, { swing: 'A' });
  B.open('door', 'interior', 670, 150, { width: 70, swing: 'A' });
  B.open('door', 'interior', 720, 330, { swing: 'B' });
  B.open('door', 'interior', 720, 500, { swing: 'B' });
  B.open('door', 'entry', 660, 800, { swing: 'A' });
  B.open('window', 'casement', 180, 0, { width: 100, height: 110, sill: 105 });
  B.open('window', 'frosted', 500, 0);
  B.open('window', 'picture', 0, 550, { width: 180 });
  B.open('window', 'grid', 150, 800, { width: 120 });
  B.open('door', 'glass', 450, 800, { width: 140 });
  B.open('window', 'casement', 1000, 0);
  B.open('window', 'casement', 980, 800);

  // kitchen
  B.item('fridge', 45, 44, 0);
  B.item('drawer_cabinet', 110, 40, 0);
  B.item('sink_cabinet', 180, 40, 0);
  B.item('dishwasher', 250, 40, 0);
  B.item('cooktop_cabinet', 310, 40, 0);
  B.item('base_cabinet', 367.5, 40, 0, { w: 55 });
  B.item('base_cabinet', 40, 100, 270);
  B.item('base_cabinet', 40, 160, 270);
  B.item('drawer_cabinet', 40, 220, 270);
  B.item('wall_cabinet', 110, 27.5, 0);
  B.item('wall_cabinet', 250, 27.5, 0);
  B.item('wall_cabinet', 367.5, 27.5, 0, { w: 55 });
  B.item('range_hood', 310, 35, 0);
  B.item('open_shelf', 22.5, 160, 270, { w: 120 });
  B.item('round_table', 250, 180, 0, { w: 90, d: 90 });
  B.item('chair', 250, 115, 0);
  B.item('chair', 250, 245, 180);
  B.item('pendant', 250, 180, 0, { elev: -1 });

  // living & dining
  B.item('dining_table', 150, 420, 0);
  B.item('chair', 110, 355, 0); B.item('chair', 190, 355, 0);
  B.item('chair', 110, 485, 180); B.item('chair', 190, 485, 180);
  B.item('pendant', 110, 420, 0, { elev: -1 });
  B.item('pendant', 190, 420, 0, { elev: -1 });
  B.item('sectional', 400, 540, 0);
  B.item('rug', 390, 640, 0, { w: 280, d: 200, mats: { rug: 'rug-terracotta' } });
  B.item('coffee_table', 360, 665, 0);
  B.item('tv_unit', 360, 769, 180);
  B.item('bookshelf', 22.5, 700, 270, { w: 120 });
  B.item('plant', 560, 760, 0);
  B.item('floor_lamp', 250, 700, 0);
  B.item('shoe_cabinet', 697.5, 640, 90);
  B.item('curtains', 12, 550, 270, { w: 220 });

  // bathroom
  B.item('bathtub', 500, 47.5, 0);
  B.item('toilet_classic', 439, 160, 270);
  B.item('vanity', 470, 271, 180);
  B.item('mirror', 470, 293.5, 180);
  B.item('towel_rail', 575, 291, 180);
  // laundry
  B.item('washer', 640, 40, 0);
  B.item('washer', 690, 40, 0, { w: 50 });

  // main bedroom
  B.item('bed_king', 982.5, 210, 90);
  B.item('nightstand', 1067, 90, 90);
  B.item('nightstand', 1067, 330, 90);
  B.item('table_lamp', 1067, 90, 0, { elev: 50 });
  B.item('table_lamp', 1067, 330, 0, { elev: 50 });
  B.item('wardrobe', 820, 40, 0, { w: 180 });
  B.item('dresser', 900, 391, 180);
  B.item('rug', 950, 210, 90, { w: 240, d: 260, mats: { rug: 'rug-jute' } });

  // kids room
  B.item('bed_single', 985, 520, 90, { mats: { bedding: 'fab-gingham' } });
  B.item('nightstand', 1068, 610, 90);
  B.item('desk', 820, 760, 180);
  B.item('office_chair', 820, 700, 180);
  B.item('bookshelf', 1072, 720, 90);
  B.item('round_rug', 880, 610, 0, { w: 150, d: 150, mats: { rug: 'rug-blue' } });

  const wf = (x, y, room, f) => B.wallFinish(x, y, room, f);
  wf(360, 800, living, { mat: 'paint-terracotta' });

  Object.assign(plan.theme, { cabinet: 'cab-white', countertop: 'ct-butcher', fabric: 'fab-linen', accent: 'fab-terracotta', wood: 'wood-teak', metal: 'metal-brass', rug: 'rug-terracotta', ceramic: 'ceramic-white' });
  return plan;
}

export const SAMPLES = [
  { id: 'one-plus-one', name: '1+1 apartment (open kitchen)', desc: '≈56 m² · bedroom, living + open kitchen, bathroom', make: onePlusOne },
  { id: 'studio', name: 'Studio', desc: '≈33 m² · open plan with kitchenette & shower room', make: studio },
  { id: 'two-plus-one', name: '2+1 family apartment', desc: '≈88 m² · 2 bedrooms, separate kitchen, laundry', make: twoPlusOne },
  { id: 'blank', name: 'Blank canvas', desc: 'Start from scratch', make: () => blankPlan('New plan') },
];

export function makeSample(id) {
  const s = SAMPLES.find((x) => x.id === id) || SAMPLES[0];
  return normalizePlan(s.make());
}
