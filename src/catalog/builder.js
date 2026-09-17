// Primitive helpers for simple parametric furniture. All UVs are in metres so
// real-scale textures line up across pieces.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

function scaleBoxUVs(geo, w, h, d) {
  const uv = geo.attributes.uv;
  const idx = geo.index;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (const g of geo.groups) {
    const [su, sv] = dims[g.materialIndex] || [1, 1];
    const seen = new Set();
    for (let i = g.start; i < g.start + g.count; i++) {
      const v = idx ? idx.getX(i) : i;
      if (seen.has(v)) continue;
      seen.add(v);
      uv.setXY(v, uv.getX(v) * su, uv.getY(v) * sv);
    }
  }
  uv.needsUpdate = true;
  return geo;
}
function scaleCylUVs(geo, r, h) {
  const uv = geo.attributes.uv;
  const idx = geo.index;
  for (const g of geo.groups) {
    const seen = new Set();
    const [su, sv] = g.materialIndex === 0 ? [2 * Math.PI * r, h] : [2 * r, 2 * r];
    for (let i = g.start; i < g.start + g.count; i++) {
      const v = idx ? idx.getX(i) : i;
      if (seen.has(v)) continue;
      seen.add(v);
      uv.setXY(v, uv.getX(v) * su, uv.getY(v) * sv);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function makeBuilder(group, getMat, tag = {}) {
  const add = (geo, slot, x, y, z, o = {}) => {
    const mesh = new THREE.Mesh(geo, getMat(slot));
    mesh.position.set(x, y, z);
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rz) mesh.rotation.z = o.rz;
    mesh.castShadow = o.cast ?? true;
    mesh.receiveShadow = true;
    mesh.userData = { ...tag, slot };
    group.add(mesh);
    return mesh;
  };
  return {
    /** box with bottom at y, centred at x/z */
    box(slot, w, h, d, x = 0, y = 0, z = 0, o = {}) {
      const geo = scaleBoxUVs(new THREE.BoxGeometry(w, h, d), w, h, d);
      return add(geo, slot, x, y + h / 2, z, o);
    },
    rbox(slot, w, h, d, r, x = 0, y = 0, z = 0, o = {}) {
      r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
      const geo = new RoundedBoxGeometry(w, h, d, 3, Math.max(0.001, r));
      scaleBoxUVs(geo, w, h, d);
      return add(geo, slot, x, y + h / 2, z, o);
    },
    cyl(slot, rTop, rBot, h, x = 0, y = 0, z = 0, o = {}) {
      const geo = scaleCylUVs(new THREE.CylinderGeometry(rTop, rBot, h, o.seg || 28, 1, !!o.open), Math.max(rTop, rBot), h);
      return add(geo, slot, x, y + h / 2, z, o);
    },
    sphere(slot, r, x = 0, y = 0, z = 0, o = {}) {
      const geo = new THREE.SphereGeometry(r, 24, 16, 0, Math.PI * 2, 0, o.thetaLen || Math.PI);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, uv.getY(i) * Math.PI * r);
      const m = add(geo, slot, x, y, z, o);
      if (o.sy) m.scale.y = o.sy;
      if (o.sx) m.scale.x = o.sx;
      if (o.sz) m.scale.z = o.sz;
      return m;
    },
    lathe(slot, pts, x = 0, y = 0, z = 0, o = {}) {
      const geo = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 32);
      const uv = geo.attributes.uv;
      const r = Math.max(...pts.map((p) => p[0]));
      const hh = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, uv.getY(i) * hh);
      const m = add(geo, slot, x, y, z, { cast: true, ...o });
      m.material = getMat(slot);
      if (o.sx) m.scale.x = o.sx;
      if (o.sz) m.scale.z = o.sz;
      return m;
    },
    torus(slot, R, r, x, y, z, o = {}) {
      const geo = new THREE.TorusGeometry(R, r, 10, 28, o.arc || Math.PI * 2);
      return add(geo, slot, x, y, z, o);
    },
    plane(slot, w, h, x, y, z, o = {}) {
      const geo = new THREE.PlaneGeometry(w, h);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
      return add(geo, slot, x, y, z, o);
    },
  };
}
