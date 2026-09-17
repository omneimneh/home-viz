// 3D visualisation: builds a three.js scene from the plan, lighting presets,
// orbit & first-person walk modes, and surface picking.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { store } from './store.js';
import { getMaterial, emissiveMaterials, setMaxAnisotropy, onTextureUpdate } from './materials/textures.js';
import { getMaterialDef, LIB_BY_ID } from './materials/library.js';
import { ITEM_BY_TYPE, THEME_DEFAULTS } from './catalog/items.js';
import { makeBuilder } from './catalog/builder.js';
import { buildOpening } from './catalog/openings3d.js';
import {
  wallLen, wallDir, wallNormal, wallSideRooms, resolveWallSide, wallExtensions, wallOpenings, wallHeight,
  resolveSlot, planBounds, roomAt,
} from './plan/model.js';
import { kelvinToRGB, polyArea, polyCentroid, projectOnSeg, debounce, clamp } from './util.js';

RectAreaLightUniformsLib.init();

export const SCENARIOS = {
  day: { label: 'Day', sunElev: 48, sunInt: 3.2, sunK: 5800, hemiSky: '#cfe0ff', hemiGround: '#9a8f80', hemi: 0.75, env: 0.45, win: 1.0, winK: 7000, sky: true, autoLights: false, exposure: 1.0 },
  golden: { label: 'Sunset', sunElev: 7, sunInt: 2.4, sunK: 2300, hemiSky: '#f4b58e', hemiGround: '#6a5040', hemi: 0.32, env: 0.22, win: 0.5, winK: 3200, sky: true, autoLights: true, exposure: 1.1 },
  overcast: { label: 'Overcast', sunElev: 60, sunInt: 0.2, sunK: 6500, hemiSky: '#dfe4ea', hemiGround: '#8d8d8d', hemi: 1.05, env: 0.5, win: 0.85, winK: 7500, sky: false, bg: '#b9c0c8', autoLights: false, exposure: 1.0 },
  night: { label: 'Night', sunElev: 35, sunInt: 0.05, sunK: 12000, hemiSky: '#1c2744', hemiGround: '#0a0a0a', hemi: 0.05, env: 0.035, win: 0, winK: 9000, sky: false, bg: '#070b16', autoLights: true, exposure: 1.0 },
};

const NO_COLLIDE = new Set(['curtains', 'floor_lamp', 'plant', 'towel_rail', 'shower']);
const POINT_POOL = 12, SHADOW_POOL = 4, RECT_POOL = 10;
const LIGHT_SCALE = 0.03; // candela per lumen-ish, tuned by eye for tone-mapped output

export class View3D {
  constructor(container) {
    this.container = container;
    this.state = {
      scenario: 'day', sunAz: 215, lights: 'auto', temp: 3000, brightness: 1, exposure: 1, tone: 'neutral',
      ceilings: 'auto', cutaway: false, doorAngle: 75, mode: 'orbit', shadows: true,
    };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    this.camera.position.set(8, 12, 14);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.sky = new Sky();
    this.sky.scale.setScalar(450);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
    this.scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.5);
    this.scene.add(this.hemi);
    this.bounce = new THREE.AmbientLight(0xffffff, 0);
    this.scene.add(this.bounce);

    // Fixed light pools: changing the number of lights forces every shader to
    // recompile (seconds on some GPUs), so edits only move/dim pooled lights.
    this.pointPool = [];
    for (let i = 0; i < POINT_POOL; i++) {
      const pl = new THREE.PointLight(0xffffff, 0, 6, 2);
      pl.position.set(0, -100, 0);
      if (i < SHADOW_POOL) {
        pl.castShadow = true;
        pl.shadow.mapSize.set(512, 512);
        pl.shadow.bias = -0.002;
        pl.shadow.radius = 3;
        pl.shadow.camera.near = 0.08;
      }
      pl.userData.cd = 0;
      this.scene.add(pl);
      this.pointPool.push(pl);
    }
    this.rectPool = [];
    for (let i = 0; i < RECT_POOL; i++) {
      const rl = new THREE.RectAreaLight(0xffffff, 0, 1, 1);
      rl.position.set(0, -100, 0);
      rl.userData.area = 0;
      this.scene.add(rl);
      this.rectPool.push(rl);
    }
    this.interiorLights = this.pointPool;
    this.windowLights = this.rectPool;

    const groundMat = getMaterial(LIB_BY_ID['grass']);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), groundMat);
    const guv = this.ground.geometry.attributes.uv;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 400, guv.getY(i) * 400);
    this.ground.position.y = -0.03;
    this.ground.receiveShadow = true;
    this.ground.userData.noPick = true;
    this.scene.add(this.ground);

    this.houseGroup = new THREE.Group();
    this.scene.add(this.houseGroup);
    this.selHelper = null;
    this.hiddenMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

    // controls
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.maxPolarAngle = Math.PI * 0.49;
    this.orbit.minDistance = 1;
    this.orbit.maxDistance = 80;
    this.pointer = new PointerLockControls(this.camera, this.renderer.domElement);
    this.pointer.addEventListener('unlock', () => this.onUnlock?.());
    this.pointer.addEventListener('lock', () => this.onLock?.());
    this.keys = {};
    this.velocity = new THREE.Vector3();
    window.addEventListener('keydown', (e) => { if (this.state.mode === 'walk' && !isTyping(e)) this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    this.raycaster = new THREE.Raycaster();
    this.setupPicking();

    this.clock = new THREE.Clock();
    this.needsRender = true;
    this.orbit.addEventListener('change', () => (this.needsRender = true));
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();

    this.rebuildSoon = debounce(() => this.rebuild(), 60);
    store.on('change', () => this.rebuildSoon());
    store.on('select', () => this.updateSelection());
    store.on('load', () => { this.rebuild(); this.frameAll(); });
    onTextureUpdate(() => { this.needsRender = true; this.renderer.shadowMap.needsUpdate = true; });

    this.applyLighting();
    this.animate();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  // ------------------------------------------------------------ build
  matFor(def) { return getMaterial(def || LIB_BY_ID['paint-warm-white']); }

  rebuild() {
    const plan = store.plan;
    if (!plan) return;
    // dispose previous
    this.houseGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.scene.remove(this.houseGroup);
    this.houseGroup = new THREE.Group();
    this.scene.add(this.houseGroup);
    this.lightFixtures = [];
    this.windowSpecs = [];
    this.ceilingMeshes = [];
    this.collisionSegs = [];

    const H0 = plan.defaults.wallHeight;
    const cut = this.state.cutaway && this.state.mode === 'orbit' ? 120 : null;

    for (const w of plan.walls) this.buildWall(plan, w, cut);

    // floors & ceilings
    const sortedRooms = [...plan.rooms].sort((a, b) => polyArea(b.points) - polyArea(a.points));
    sortedRooms.forEach((r, i) => {
      if (r.points.length < 3) return;
      const shapeF = new THREE.Shape(r.points.map((p) => new THREE.Vector2(p.x / 100, -p.y / 100)));
      const fg = new THREE.ShapeGeometry(shapeF).rotateX(-Math.PI / 2);
      const floor = new THREE.Mesh(fg, this.matFor(getMaterialDef(plan, r.floorMat)));
      floor.position.y = 0.001 + i * 0.0006;
      floor.receiveShadow = true;
      floor.userData = { kind: 'floor', roomId: r.id };
      this.houseGroup.add(floor);

      const ch = (r.ceilingHeight || H0) / 100;
      const shapeC = new THREE.Shape(r.points.map((p) => new THREE.Vector2(p.x / 100, p.y / 100)));
      const cg = new THREE.ShapeGeometry(shapeC).rotateX(Math.PI / 2);
      const ceil = new THREE.Mesh(cg, this.matFor(getMaterialDef(plan, r.ceilingMat)));
      ceil.position.y = ch - i * 0.0006;
      ceil.castShadow = true;
      ceil.receiveShadow = true;
      ceil.userData = { kind: 'ceiling', roomId: r.id, realMat: ceil.material };
      this.ceilingMeshes.push(ceil);
      this.houseGroup.add(ceil);
    });

    // base slab under everything
    const bb = planBounds(plan);
    const slab = new THREE.Mesh(new THREE.BoxGeometry((bb.x1 - bb.x0) / 100 + 0.4, 0.04, (bb.y1 - bb.y0) / 100 + 0.4), new THREE.MeshStandardMaterial({ color: '#77736d', roughness: 1 }));
    slab.position.set((bb.x0 + bb.x1) / 200, -0.02, (bb.y0 + bb.y1) / 200);
    slab.receiveShadow = true;
    slab.userData.noPick = true;
    this.houseGroup.add(slab);

    // openings
    for (const o of plan.openings) {
      const w = plan.walls.find((x) => x.id === o.wallId);
      if (!w) continue;
      const L = wallLen(w);
      const half = Math.min(o.width, L) / 2;
      const off = clamp(o.offset, half, L - half);
      const d = wallDir(w);
      const getMat = (slot) => {
        if (slot === 'glass' || slot === 'frosted') return this.matFor(resolveSlot(plan, o, slot));
        const id = o.mats?.[slot] || plan.theme[slot] || THEME_DEFAULTS[slot];
        return this.matFor(getMaterialDef(plan, id));
      };
      const g = buildOpening({ ...o, offset: off }, w.thickness, getMat, this.state.doorAngle);
      g.position.set((w.a.x + d.x * off) / 100, 0, (w.a.y + d.y * off) / 100);
      g.rotation.y = -Math.atan2(d.y, d.x);
      g.userData = { kind: 'opening', openingId: o.id };
      if (cut != null) clipGroupAbove(g, cut / 100);
      this.houseGroup.add(g);
      if (o.kind === 'window') this.addWindowLight(plan, w, o, off);
    }

    // items
    for (const it of plan.items) this.buildItem(plan, it);
    this.buildRoomLights(plan);
    this.assignWindowLights();

    this.applyLighting();
    this.applyCeilingVisibility();
    this.updateSelection();
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  buildWall(plan, w, cut) {
    const L = wallLen(w);
    if (L < 1) return;
    const H = wallHeight(plan, w);
    const t = w.thickness;
    const ext = wallExtensions(plan, w);
    const d = wallDir(w), n = wallNormal(w);
    const sideRooms = wallSideRooms(plan, w);
    const A = resolveWallSide(plan, w, 'A', sideRooms);
    const B = resolveWallSide(plan, w, 'B', sideRooms);
    const interior = A.room ? A : B.room ? B : A;
    const ops = wallOpenings(plan, w).map(({ o, s, e }) => ({
      s, e, bottom: o.kind === 'window' ? o.sill : 0, top: Math.min(H, (o.kind === 'window' ? o.sill : 0) + o.height), door: o.kind === 'door',
    }));

    // collision: solid spans (doors are passable)
    let cur = -ext.a;
    for (const op of ops.filter((x) => x.door)) { if (op.s > cur) this.collisionSegs.push({ w, s: cur, e: op.s }); cur = op.e; }
    if (L + ext.b > cur) this.collisionSegs.push({ w, s: cur, e: L + ext.b });

    // u breakpoints
    const u0 = -ext.a, u1 = L + ext.b;
    const bps = new Set([u0, u1]);
    for (const op of ops) { bps.add(clamp(op.s, u0, u1)); bps.add(clamp(op.e, u0, u1)); }
    const us = [...bps].sort((a, b) => a - b);
    const rects = []; // {u0,u1,v0,v1, capL, capR}
    for (let i = 0; i + 1 < us.length; i++) {
      const a = us[i], b = us[i + 1];
      if (b - a < 0.01) continue;
      const mid = (a + b) / 2;
      const gaps = ops.filter((op) => op.s <= mid && op.e >= mid).map((op) => [op.bottom, op.top]).sort((x, y) => x[0] - y[0]);
      let v = 0;
      const pieces = [];
      for (const [g0, g1] of gaps) { if (g0 > v) pieces.push([v, g0]); v = Math.max(v, g1); }
      if (v < H) pieces.push([v, H]);
      for (const [v0, v1] of pieces) rects.push({ u0: a, u1: b, v0, v1 });
    }

    const geo = { vis: new QuadGeo(), hid: new QuadGeo() };
    const toWorld = (u, v, nn) => [(w.a.x + d.x * u + n.x * nn) / 100, v / 100, (w.a.y + d.y * u + n.y * nn) / 100];
    const nWorld = (lu, lv, ln) => [d.x * lu + n.x * ln, lv, d.y * lu + n.y * ln];
    const G = { Am: 0, Ab: 1, Bm: 2, Bb: 3, rev: 4, top: 5 };

    const emit = (target, grp, corners, normal, uvs) => target.quad(grp, corners.map((c) => toWorld(...c)), nWorld(...normal), uvs);

    const splitV = (v0, v1, band) => {
      // returns [[v0,v1,isBand]]
      if (!band) return [[v0, v1, false]];
      const out = [];
      const bs = [v0, v1, band.from, band.to].filter((x) => x >= v0 && x <= v1);
      const cuts = [...new Set(bs)].sort((a, b) => a - b);
      for (let k = 0; k + 1 < cuts.length; k++) {
        const m = (cuts[k] + cuts[k + 1]) / 2;
        out.push([cuts[k], cuts[k + 1], m >= band.from && m <= band.to]);
      }
      return out;
    };
    const splitCut = (v0, v1) => {
      if (cut == null || v1 <= cut) return [[v0, v1, 'vis']];
      if (v0 >= cut) return [[v0, v1, 'hid']];
      return [[v0, cut, 'vis'], [cut, v1, 'hid']];
    };

    for (const r of rects) {
      for (const [cv0, cv1, layer] of splitCut(r.v0, r.v1)) {
        const tg = geo[layer];
        const m = (x) => x / 100;
        // side A (+n)
        for (const [a, b, isBand] of splitV(cv0, cv1, A.band)) {
          emit(tg, isBand ? G.Ab : G.Am, [[r.u0, a, t / 2], [r.u1, a, t / 2], [r.u1, b, t / 2], [r.u0, b, t / 2]], [0, 0, 1],
            [[m(r.u0), m(a)], [m(r.u1), m(a)], [m(r.u1), m(b)], [m(r.u0), m(b)]]);
        }
        for (const [a, b, isBand] of splitV(cv0, cv1, B.band)) {
          emit(tg, isBand ? G.Bb : G.Bm, [[r.u0, a, -t / 2], [r.u1, a, -t / 2], [r.u1, b, -t / 2], [r.u0, b, -t / 2]], [0, 0, -1],
            [[-m(r.u0), m(a)], [-m(r.u1), m(a)], [-m(r.u1), m(b)], [-m(r.u0), m(b)]]);
        }
        // top / bottom
        const topIsWall = cv1 >= H - 0.01 || (layer === 'vis' && cv1 === cut);
        if (topIsWall || cv1 < H) {
          emit(tg, topIsWall ? G.top : G.rev, [[r.u0, cv1, -t / 2], [r.u1, cv1, -t / 2], [r.u1, cv1, t / 2], [r.u0, cv1, t / 2]], [0, 1, 0],
            [[m(r.u0), -m(t / 2)], [m(r.u1), -m(t / 2)], [m(r.u1), m(t / 2)], [m(r.u0), m(t / 2)]]);
        }
        if (cv0 > 0.01 && !(layer === 'hid' && cv0 === cut)) {
          emit(tg, G.rev, [[r.u0, cv0, -t / 2], [r.u1, cv0, -t / 2], [r.u1, cv0, t / 2], [r.u0, cv0, t / 2]], [0, -1, 0],
            [[m(r.u0), -m(t / 2)], [m(r.u1), -m(t / 2)], [m(r.u1), m(t / 2)], [m(r.u0), m(t / 2)]]);
        }
        // end caps / jambs
        for (const [u, s] of [[r.u0, -1], [r.u1, 1]]) {
          const isEnd = Math.abs(u - (s < 0 ? u0 : u1)) < 0.01;
          const covered = rects.some((q) => q !== r && Math.abs((s < 0 ? q.u1 : q.u0) - u) < 0.01 && q.v0 <= cv0 + 0.01 && q.v1 >= cv1 - 0.01);
          if (covered) continue;
          const grp = isEnd ? (ext[s < 0 ? 'a' : 'b'] > 0 ? G.top : G.rev) : G.rev;
          emit(tg, grp, [[u, cv0, -t / 2], [u, cv0, t / 2], [u, cv1, t / 2], [u, cv1, -t / 2]], [s, 0, 0],
            [[-m(t / 2), m(cv0)], [m(t / 2), m(cv0)], [m(t / 2), m(cv1)], [-m(t / 2), m(cv1)]]);
        }
      }
    }

    const mats = [
      this.matFor(getMaterialDef(plan, A.mat)),
      this.matFor(getMaterialDef(plan, A.band?.mat)),
      this.matFor(getMaterialDef(plan, B.mat)),
      this.matFor(getMaterialDef(plan, B.band?.mat)),
      this.matFor(getMaterialDef(plan, interior.mat)),
      this.matFor(LIB_BY_ID['wall-cut']),
    ];
    const vis = geo.vis.build();
    if (vis) {
      const mesh = new THREE.Mesh(vis, mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { kind: 'wall', wallId: w.id };
      this.houseGroup.add(mesh);
    }
    const hid = geo.hid.build();
    if (hid) {
      const mesh = new THREE.Mesh(hid, this.hiddenMat);
      mesh.castShadow = true;
      mesh.userData = { kind: 'wall', wallId: w.id, noPick: true };
      this.houseGroup.add(mesh);
    }
  }

  buildItem(plan, it) {
    const def = ITEM_BY_TYPE[it.type];
    if (!def) return;
    const g = new THREE.Group();
    const getMat = (slot) => this.matFor(resolveSlot(plan, it, slot));
    const b = makeBuilder(g, getMat, { kind: 'item', itemId: it.id });
    def.build(b, { w: it.w / 100, d: it.d / 100, h: it.h / 100 });
    let elev = it.elev ?? def.elev ?? 0;
    if (elev < 0) {
      const room = roomAt(plan, it);
      elev = room?.ceilingHeight || plan.defaults.wallHeight;
    }
    g.position.set(it.x / 100, elev / 100, it.y / 100);
    g.rotation.y = (-it.rot * Math.PI) / 180;
    g.userData = { kind: 'item', itemId: it.id };
    this.houseGroup.add(g);
    if (def.light && it.light?.on !== false) {
      this.lightFixtures.push({ it, def, group: g, elev, ceiling: (it.elev ?? def.elev) < 0, room: roomAt(plan, it) });
    }
    // tall floor-standing items block walking
    if (it.h > 60 && elev < 60 && !NO_COLLIDE.has(it.type)) this.collisionSegs.push({ box: it });
  }

  buildRoomLights(plan) {
    const lights = [];
    for (const r of plan.rooms) {
      if (r.points.length < 3) continue;
      const areaM2 = polyArea(r.points) / 10000;
      const ch = (r.ceilingHeight || plan.defaults.wallHeight) / 100;
      const fixtures = this.lightFixtures.filter((f) => f.ceiling && f.room === r);
      const lm = (r.light?.on === false ? 0 : 1) * 140 * areaM2 * (r.light?.power ?? 1);
      if (!lm) continue;
      if (fixtures.length) {
        fixtures.forEach((f) => { f.roomLumens = lm / fixtures.length; });
      } else {
        const c = polyCentroid(r.points);
        lights.push({ x: c.x / 100, y: ch - 0.12, z: c.y / 100, lm, shadow: true, prio: areaM2, range: Math.sqrt(areaM2) * 2.2 + 2 });
      }
    }
    for (const f of this.lightFixtures) {
      const lp = new THREE.Vector3(0, f.def.light.y, 0);
      f.group.updateMatrixWorld(true);
      lp.applyMatrix4(f.group.matrixWorld);
      const lm = f.ceiling ? (f.roomLumens || 600) : 500 * f.def.light.power * (f.it.light?.power ?? 1);
      lights.push({ x: lp.x, y: lp.y, z: lp.z, lm, shadow: f.ceiling, prio: f.ceiling ? 50 : 1, range: f.ceiling ? 7 : 4.5 });
    }
    lights.sort((a, b) => b.prio - a.prio);
    const shadowSlots = this.pointPool.slice(0, SHADOW_POOL), plainSlots = this.pointPool.slice(SHADOW_POOL);
    for (const pl of this.pointPool) { pl.userData.cd = 0; pl.position.set(0, -100, 0); }
    for (const l of lights) {
      const pl = (l.shadow && shadowSlots.shift()) || plainSlots.shift() || (l.shadow ? null : shadowSlots.shift());
      if (!pl) continue;
      pl.position.set(l.x, l.y, l.z);
      pl.distance = l.range;
      pl.userData.cd = (l.lm / (4 * Math.PI)) * LIGHT_SCALE;
      if (pl.castShadow) { pl.shadow.camera.far = l.range; pl.shadow.camera.updateProjectionMatrix(); }
    }
    for (const pl of this.pointPool.slice(0, SHADOW_POOL)) pl.castShadow = this.state.shadows;
  }

  addWindowLight(plan, w, o, off) {
    const sides = wallSideRooms(plan, w);
    if (!!sides.A === !!sides.B) return; // interior window or no room
    const inSign = sides.A ? 1 : -1;
    const d = wallDir(w), n = wallNormal(w);
    const W = o.width / 100, H = o.height / 100;
    const cx = (w.a.x + d.x * off) / 100 + (n.x * inSign * (w.thickness / 2 + 2)) / 100;
    const cz = (w.a.y + d.y * off) / 100 + (n.y * inSign * (w.thickness / 2 + 2)) / 100;
    const cy = ((o.kind === 'window' ? o.sill : 0) + o.height / 2) / 100;
    this.windowSpecs.push({ W, H, cx, cy, cz, tx: cx + n.x * inSign, tz: cz + n.y * inSign, frosted: o.style === 'frosted' });
  }

  assignWindowLights() {
    const specs = [...this.windowSpecs].sort((a, b) => b.W * b.H - a.W * a.H);
    this.rectPool.forEach((rl, i) => {
      const sp = specs[i];
      if (!sp) { rl.userData.area = 0; rl.position.set(0, -100, 0); return; }
      rl.width = sp.W; rl.height = sp.H;
      rl.position.set(sp.cx, sp.cy, sp.cz);
      rl.lookAt(sp.tx, sp.cy - 0.35, sp.tz);
      rl.userData.area = sp.W * sp.H;
      rl.userData.frosted = sp.frosted;
    });
  }

  // ------------------------------------------------------------ lighting
  setState(patch) {
    const needsRebuild = ['cutaway', 'doorAngle', 'shadows'].some((k) => k in patch && patch[k] !== this.state[k]);
    Object.assign(this.state, patch);
    if (needsRebuild) this.rebuild();
    else { this.applyLighting(); this.applyCeilingVisibility(); }
  }

  lightsOn() {
    const s = this.state;
    return s.lights === 'auto' ? SCENARIOS[s.scenario].autoLights : s.lights === 'on';
  }

  applyLighting() {
    const s = this.state, sc = SCENARIOS[s.scenario];
    const r = this.renderer;
    r.toneMapping = { neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, none: THREE.NoToneMapping }[s.tone] ?? THREE.NeutralToneMapping;
    r.toneMappingExposure = s.exposure * sc.exposure;

    // sun
    const elev = THREE.MathUtils.degToRad(sc.sunElev), az = THREE.MathUtils.degToRad(s.sunAz);
    const dir = new THREE.Vector3(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az));
    const plan = store.plan;
    const bb = plan ? planBounds(plan) : { x0: 0, y0: 0, x1: 600, y1: 600 };
    const c = new THREE.Vector3((bb.x0 + bb.x1) / 200, 0, (bb.y0 + bb.y1) / 200);
    const R = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) / 100 * 0.8 + 3;
    this.sun.position.copy(c).addScaledVector(dir, 40);
    this.sun.target.position.copy(c);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -R; cam.right = cam.top = R; cam.near = 1; cam.far = 90;
    cam.updateProjectionMatrix();
    this.sun.color.setRGB(...kelvinToRGB(sc.sunK));
    this.sun.intensity = s.scenario === 'night' ? 0.06 : sc.sunInt;
    if (s.scenario === 'night') this.sun.color.set('#8fa6d8');
    this.sun.castShadow = s.shadows;

    this.hemi.color.set(sc.hemiSky);
    this.hemi.groundColor.set(sc.hemiGround);
    this.hemi.intensity = sc.hemi;

    this.sky.visible = sc.sky;
    if (sc.sky) {
      this.sky.material.uniforms.sunPosition.value.copy(dir);
      this.scene.background = null;
    } else {
      this.scene.background = new THREE.Color(sc.bg);
    }

    for (const wl of this.windowLights || []) {
      wl.color.setRGB(...kelvinToRGB(sc.winK));
      wl.intensity = wl.userData.area ? sc.win * 2.2 * (wl.userData.frosted ? 0.6 : 1) * (s.scenario === 'golden' ? 1.2 : 1) : 0;
    }

    const on = this.lightsOn();
    // reflections: keep some environment when the room lights are on so metals/mirrors don't go black
    this.scene.environmentIntensity = Math.max(sc.env, on ? 0.22 * s.brightness : 0);
    const [lr, lg, lb] = kelvinToRGB(s.temp);
    const bright = s.brightness;
    for (const pl of this.interiorLights || []) {
      pl.color.setRGB(lr, lg, lb);
      pl.intensity = on ? pl.userData.cd * bright : 0;
    }
    // simple bounce approximation for artificial light
    this.bounce.color.setRGB(lr, lg, lb);
    this.bounce.intensity = on ? 0.16 * bright : 0;
    for (const m of emissiveMaterials) {
      m.emissive.setRGB(lr, lg, lb);
      m.emissiveIntensity = on ? 1.4 * bright : 0;
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  applyCeilingVisibility() {
    const s = this.state;
    const show = s.ceilings === 'show' || (s.ceilings === 'auto' && s.mode === 'walk');
    for (const m of this.ceilingMeshes || []) {
      m.material = show ? m.userData.realMat : this.hiddenMat;
      m.userData.noPick = !show;
    }
    this.needsRender = true;
  }

  // ------------------------------------------------------------ camera
  frameAll() {
    const plan = store.plan;
    if (!plan) return;
    const bb = planBounds(plan);
    const cx = (bb.x0 + bb.x1) / 200, cz = (bb.y0 + bb.y1) / 200;
    const w = (bb.x1 - bb.x0) / 100, d = (bb.y1 - bb.y0) / 100;
    // distance so the footprint fits the view horizontally and vertically
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dist = Math.max((w * 0.62) / Math.tan(hfov / 2), (d * 0.9 + 1.5) / Math.tan(vfov / 2)) + 1;
    this.orbit.target.set(cx, 0.4, cz);
    const dir = new THREE.Vector3(0.28, 1.05, 0.95).normalize();
    this.camera.position.set(cx, 0.4, cz).addScaledVector(dir, dist);
    this.orbit.update();
    this.needsRender = true;
  }

  setMode(mode) {
    if (mode === this.state.mode) return;
    const wasCut = this.state.cutaway;
    this.state.mode = mode;
    if (mode === 'walk') {
      this.orbit.enabled = false;
      // spawn at the orbit target (or first room centre) at eye height
      const plan = store.plan;
      let p = { x: this.orbit.target.x * 100, y: this.orbit.target.z * 100 };
      if (!roomAt(plan, p) && plan.rooms[0]) p = polyCentroid(plan.rooms[0].points);
      this.camera.position.set(p.x / 100, 1.6, p.y / 100);
      this.camera.rotation.set(0, 0, 0);
      this.camera.lookAt(p.x / 100 + 1, 1.5, p.y / 100);
      this.camera.fov = 70;
      this.camera.updateProjectionMatrix();
      this.resolveCollisions();
    } else {
      this.pointer.unlock();
      this.orbit.enabled = true;
      this.camera.fov = 55;
      this.camera.updateProjectionMatrix();
      this.frameAll();
    }
    if (wasCut) this.rebuild();
    this.applyCeilingVisibility();
  }

  teleport(px, py, lookAngle) {
    if (this.state.mode !== 'walk') this.setMode('walk');
    this.camera.position.set(px / 100, 1.6, py / 100);
    if (lookAngle != null) this.camera.rotation.set(0, lookAngle, 0, 'YXZ');
    this.needsRender = true;
  }

  lockPointer() { this.pointer.lock(); }

  resolveCollisions() {
    const pos = this.camera.position;
    const R = 25;
    for (let iter = 0; iter < 3; iter++) {
      for (const seg of this.collisionSegs || []) {
        if (seg.box) {
          const it = seg.box;
          const a = (-it.rot * Math.PI) / 180;
          const dx = pos.x * 100 - it.x, dy = pos.z * 100 - it.y;
          const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
          const hx = it.w / 2 + R * 0.6, hy = it.d / 2 + R * 0.6;
          if (Math.abs(lx) < hx && Math.abs(ly) < hy) {
            const px = hx - Math.abs(lx), py = hy - Math.abs(ly);
            let nlx = lx, nly = ly;
            if (px < py) nlx = Math.sign(lx || 1) * hx; else nly = Math.sign(ly || 1) * hy;
            const ca = Math.cos(-a), sa = Math.sin(-a);
            pos.x = (it.x + nlx * ca - nly * sa) / 100;
            pos.z = (it.y + nlx * sa + nly * ca) / 100;
          }
          continue;
        }
        const w = seg.w, d = wallDir(w);
        const a = { x: w.a.x + d.x * seg.s, y: w.a.y + d.y * seg.s };
        const b = { x: w.a.x + d.x * seg.e, y: w.a.y + d.y * seg.e };
        const p = { x: pos.x * 100, y: pos.z * 100 };
        const pr = projectOnSeg(p, a, b);
        const minD = R + w.thickness / 2;
        if (pr.d < minD) {
          const nx = pr.d > 0.01 ? (p.x - pr.x) / pr.d : -d.y, ny = pr.d > 0.01 ? (p.y - pr.y) / pr.d : d.x;
          pos.x = (pr.x + nx * minD) / 100;
          pos.z = (pr.y + ny * minD) / 100;
        }
      }
    }
  }

  // ------------------------------------------------------------ picking
  setupPicking() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5) return;
      if (this.state.mode === 'walk') {
        if (!this.pointer.isLocked) { this.pointer.lock(); return; }
        this.pickAt(0, 0);
      } else {
        const r = el.getBoundingClientRect();
        this.pickAt(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      }
    });
  }

  pickAt(nx, ny) {
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const hits = this.raycaster.intersectObject(this.houseGroup, true);
    for (const h of hits) {
      let o = h.object;
      if (o.userData.noPick || !o.visible || o.isLight) continue;
      const ud = o.userData;
      if (ud.kind === 'wall') {
        const grp = h.face?.materialIndex ?? 0;
        const focus = ['A', 'bandA', 'B', 'bandB', 'reveal', 'top'][grp];
        store.select({ type: 'wall', id: ud.wallId, focus });
        return;
      }
      if (ud.kind === 'floor') return store.select({ type: 'room', id: ud.roomId, focus: 'floor' });
      if (ud.kind === 'ceiling') return store.select({ type: 'room', id: ud.roomId, focus: 'ceiling' });
      if (ud.kind === 'item') return store.select({ type: 'item', id: ud.itemId, focus: ud.slot });
      if (ud.kind === 'opening') return store.select({ type: 'opening', id: ud.openingId, focus: ud.slot });
    }
    store.select(null);
  }

  updateSelection() {
    if (this.selHelper) {
      this.scene.remove(this.selHelper);
      this.selHelper.geometry?.dispose();
      this.selHelper = null;
    }
    const sel = store.selection;
    if (!sel) { this.needsRender = true; return; }
    let target = null;
    this.houseGroup.traverse((o) => {
      if (target) return;
      const ud = o.userData;
      if (sel.type === 'item' && ud.kind === 'item' && ud.itemId === sel.id && o.isGroup) target = o;
      if (sel.type === 'opening' && ud.kind === 'opening' && ud.openingId === sel.id && o.isGroup) target = o;
      if (sel.type === 'wall' && ud.kind === 'wall' && ud.wallId === sel.id && o.isMesh && !ud.noPick) target = o;
      if (sel.type === 'room' && ud.kind === (sel.focus === 'ceiling' ? 'ceiling' : 'floor') && ud.roomId === sel.id) target = o;
    });
    if (sel.type === 'room') {
      const r = store.find('room', sel.id);
      if (r) {
        const y = sel.focus === 'ceiling' ? (r.ceilingHeight || store.plan.defaults.wallHeight) / 100 - 0.02 : 0.02;
        const pts = r.points.map((p) => new THREE.Vector3(p.x / 100, y, p.y / 100));
        const g = new THREE.BufferGeometry().setFromPoints([...pts, pts[0]]);
        this.selHelper = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x2f8cff, depthTest: false }));
        this.selHelper.renderOrder = 999;
      }
    } else if (target) {
      this.selHelper = new THREE.BoxHelper(target, 0x2f8cff);
      this.selHelper.material.depthTest = false;
      this.selHelper.renderOrder = 999;
    }
    if (this.selHelper) this.scene.add(this.selHelper);
    this.needsRender = true;
  }

  // ------------------------------------------------------------ loop
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.state.mode === 'walk') this.walkStep(dt);
    else this.orbit.update();
    if (this.needsRender || this.state.mode === 'walk') {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
      this.onRender?.();
    }
  }

  walkStep(dt) {
    const k = this.keys;
    const speed = (k.ShiftLeft || k.ShiftRight ? 3.2 : 1.6);
    const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const side = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const turn = (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0);
    if (!fwd && !side && !turn) return;
    if (turn) {
      const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      e.y -= turn * dt * 1.6;
      this.camera.quaternion.setFromEuler(e);
    }
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    this.camera.position.addScaledVector(dir, fwd * speed * dt).addScaledVector(right, side * speed * dt);
    this.resolveCollisions();
    this.camera.position.y = 1.6;
    this.onMove?.();
  }

  /** Render the current view under several lighting presets into one image. */
  async compareLighting(presets) {
    const saved = { ...this.state };
    const w = this.renderer.domElement.width, h = this.renderer.domElement.height;
    const cols = 2, rows = Math.ceil(presets.length / 2);
    const tw = Math.round(w / 2), th = Math.round(h / 2);
    const out = document.createElement('canvas');
    out.width = tw * cols; out.height = th * rows;
    const ctx = out.getContext('2d');
    ctx.font = `${Math.max(14, Math.round(th / 16))}px system-ui, sans-serif`;
    for (let i = 0; i < presets.length; i++) {
      Object.assign(this.state, presets[i].state);
      this.applyLighting();
      this.renderer.render(this.scene, this.camera);
      const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
      ctx.drawImage(this.renderer.domElement, x, y, tw, th);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x + 8, y + 8, ctx.measureText(presets[i].label).width + 16, Math.round(th / 16) + 12);
      ctx.fillStyle = '#fff';
      ctx.fillText(presets[i].label, x + 16, y + 8 + Math.round(th / 16) + 2);
      await new Promise((r) => setTimeout(r, 0));
    }
    Object.assign(this.state, saved);
    this.applyLighting();
    return out;
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  cameraPlan() {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    return { x: this.camera.position.x * 100, y: this.camera.position.z * 100, yaw: e.y, walk: this.state.mode === 'walk' };
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
}

function clipGroupAbove(g, y) {
  g.traverse((o) => {
    if (!o.isMesh) return;
    const box = new THREE.Box3().setFromObject(o);
    if (box.min.y > y - 0.001) o.visible = false;
  });
}

/** Accumulates quads into groups; builds an indexed BufferGeometry. */
class QuadGeo {
  constructor() { this.groups = new Map(); }
  quad(group, corners, normal, uvs) {
    // fix winding so the face points along `normal`
    const [p0, p1, p2] = corners;
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    let order = [0, 1, 2, 3];
    if (cx * normal[0] + cy * normal[1] + cz * normal[2] < 0) order = [0, 3, 2, 1];
    if (!this.groups.has(group)) this.groups.set(group, []);
    this.groups.get(group).push({ corners: order.map((i) => corners[i]), normal, uvs: order.map((i) => uvs[i]) });
  }
  build() {
    const pos = [], nor = [], uv = [], idx = [];
    const geo = new THREE.BufferGeometry();
    let start = 0;
    const keys = [...this.groups.keys()].sort((a, b) => a - b);
    if (!keys.length) return null;
    for (const g of keys) {
      const quads = this.groups.get(g);
      for (const q of quads) {
        const base = pos.length / 3;
        for (let i = 0; i < 4; i++) {
          pos.push(...q.corners[i]);
          nor.push(...q.normal);
          uv.push(...q.uvs[i]);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      geo.addGroup(start, quads.length * 6, g);
      start += quads.length * 6;
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
  }
}
