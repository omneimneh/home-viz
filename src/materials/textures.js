// Material definition → THREE material (cached), and thumbnail cache for the UI.
import * as THREE from 'three';
import { renderPattern, renderThumb } from './patterns.js';
import { hashStr } from '../util.js';

const matCache = new Map();
const thumbCache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(n) { maxAniso = n; }

/** Materials that emit light register here so the lighting rig can drive them. */
export const emissiveMaterials = new Set();
let onAsyncUpdate = () => {};
export function onTextureUpdate(fn) { onAsyncUpdate = fn; }

const defKey = (def) => def.id + ':' + hashStr(JSON.stringify([def.pattern, def.params, def.rough, def.metal, def.rot, def.kind, def.bump]));

function makeTexture(canvas, w, h, rot, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  // UVs are in metres; one texture repeat spans w×h cm
  t.repeat.set(100 / w, 100 / h);
  t.rotation = ((rot || 0) * Math.PI) / 180;
  t.needsUpdate = true;
  return t;
}

export function getMaterial(def) {
  if (!def) return fallbackMat;
  const key = defKey(def);
  const hit = matCache.get(key);
  if (hit) return hit;
  let mat;
  const kind = def.kind || 'pattern';
  if (kind === 'glass') {
    mat = new THREE.MeshPhysicalMaterial({ color: def.params?.colors?.[0] || '#dfeef0', roughness: 0.02, transmission: 0, transparent: true, opacity: 0.18, metalness: 0, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide });
  } else if (kind === 'frosted') {
    mat = new THREE.MeshPhysicalMaterial({ color: '#eef3f3', roughness: 0.35, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  } else if (kind === 'mirror') {
    mat = new THREE.MeshStandardMaterial({ color: '#c9d2d6', roughness: 0.06, metalness: 0.55, envMapIntensity: 1.6 });
  } else {
    const r = renderPattern(def, 1024);
    const map = makeTexture(r.canvas, r.w, r.h, def.rot, true);
    mat = new THREE.MeshStandardMaterial({ map, roughness: def.rough ?? 0.6, metalness: def.metal ?? 0 });
    if (r.bump) {
      mat.bumpMap = makeTexture(r.bump, r.w, r.h, def.rot, false);
      mat.bumpScale = def.bump ?? 0.6;
    }
    if (r.pending) {
      r.pending.then(() => {
        const r2 = renderPattern(def, 1024);
        map.image = r2.canvas;
        map.needsUpdate = true;
        if (mat.bumpMap && r2.bump) { mat.bumpMap.image = r2.bump; mat.bumpMap.needsUpdate = true; }
        onAsyncUpdate();
      });
    }
    if (kind === 'light') {
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveMap = map;
      mat.emissiveIntensity = 0;
      emissiveMaterials.add(mat);
    }
  }
  mat.name = def.id;
  matCache.set(key, mat);
  return mat;
}

const fallbackMat = new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.8 });

export function getThumb(def, size = 96) {
  const key = defKey(def) + ':' + size;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const r = renderThumb(def, size);
  const url = r.canvas.toDataURL();
  const rec = { url, pending: r.pending };
  thumbCache.set(key, rec);
  if (r.pending) r.pending.then(() => { thumbCache.delete(key); });
  return rec;
}

/** Lazily-rendered thumbnail <img>: rendering happens in idle time to keep the UI snappy. */
const queue = [];
let scheduled = false;
export function thumbImg(def, size = 96, cls = 'thumb') {
  const img = document.createElement('img');
  img.className = cls;
  img.alt = def?.name || '';
  img.width = img.height = size;
  if (!def) return img;
  const key = defKey(def) + ':' + size;
  const hit = thumbCache.get(key);
  if (hit) { img.src = hit.url; return img; }
  queue.push([img, def, size]);
  if (!scheduled) {
    scheduled = true;
    const run = () => {
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 16) {
        const [el, d, s] = queue.shift();
        if (!el.isConnected) continue; // panel was re-rendered
        try {
          const rec = getThumb(d, s);
          el.src = rec.url;
          if (rec.pending) rec.pending.then(() => { el.src = getThumb(d, s).url; });
        } catch (e) { console.warn('thumb failed', d.id, e); }
      }
      if (queue.length) setTimeout(run, 0);
      else scheduled = false;
    };
    setTimeout(run, 0);
  }
  return img;
}
