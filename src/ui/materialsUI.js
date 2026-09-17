// Material browser/picker, pattern editor and the "tile from photo" tool.
import { h, uid, clamp, deepClone } from '../util.js';
import { store } from '../store.js';
import { LIBRARY, CATEGORIES, getMaterialDef } from '../materials/library.js';
import { PATTERN_INFO, PATTERN_DEFAULTS, SURFACES, MOTIFS, LAYOUTS, renderPattern } from '../materials/patterns.js';
import { thumbImg } from '../materials/textures.js';
import { modal, toast } from './modal.js';

export function allMaterials() {
  const custom = Object.values(store.plan?.materials || {});
  return [...custom, ...LIBRARY];
}

/** A swatch grid with category chips + search. */
export function materialBrowser({ cat = 'all', current = null, onPick, onEdit, compact = false }) {
  const state = { cat, q: '' };
  const root = h('div', { class: 'mat-browser' + (compact ? ' compact' : '') });
  const chips = h('div', { class: 'chips' });
  const search = h('input', { type: 'search', placeholder: 'Search materials…', class: 'search', oninput: (e) => { state.q = e.target.value.toLowerCase(); renderGrid(); } });
  const actions = h('div', { class: 'row gap' },
    h('button', { class: 'btn small', onclick: () => openPhotoTile({ onSaved: (m) => { onPick?.(m.id); renderGrid(); } }) }, '📷 Tile from photo'),
    h('button', { class: 'btn small', onclick: () => openPatternEditor({ base: getMaterialDef(store.plan, current) || LIBRARY.find((m) => m.pattern === 'grid'), onSaved: (m) => { onPick?.(m.id); renderGrid(); } }) }, '✏️ New pattern'),
  );
  const grid = h('div', { class: 'swatch-grid' });
  root.append(search, chips, actions, grid);

  function renderChips() {
    chips.replaceChildren(...CATEGORIES.map(([id, label]) => h('button', {
      class: 'chip' + (state.cat === id ? ' active' : ''),
      onclick: () => { state.cat = id; renderChips(); renderGrid(); },
    }, label)));
  }
  function renderGrid() {
    const list = allMaterials().filter((m) => {
      if (state.cat === 'custom') { if (!m.custom) return false; }
      else if (state.cat !== 'all' && !m.cats?.includes(state.cat)) return false;
      if (state.q && !m.name.toLowerCase().includes(state.q)) return false;
      return !m.cats?.includes('misc') || state.cat === 'all' || state.cat === 'ceramic' || m.custom;
    });
    grid.replaceChildren(...list.map((m) => {
      const cell = h('div', {
        class: 'swatch' + (m.id === current ? ' active' : ''),
        title: m.name,
        onclick: () => { current = m.id; onPick?.(m.id); grid.querySelectorAll('.swatch.active').forEach((x) => x.classList.remove('active')); cell.classList.add('active'); },
      },
      thumbImg(m, 96),
      h('span', { class: 'swatch-name' }, m.name),
      h('button', {
        class: 'swatch-edit', title: m.custom ? 'Edit' : 'Duplicate & edit',
        onclick: (e) => { e.stopPropagation(); (onEdit || ((d) => openPatternEditor({ base: d, onSaved: (nm) => { onPick?.(nm.id); renderGrid(); } })))(m); },
      }, '✎'));
      return cell;
    }));
    if (!list.length) grid.append(h('div', { class: 'muted pad' }, 'No materials match.'));
  }
  renderChips();
  renderGrid();
  root.refresh = renderGrid;
  return root;
}

// ---------------------------------------------------------------- picker overlay
let pickerEl = null;
/**
 * Docked picker: applies materials live so the user can compare in 3D.
 * target: {title, cat, current, apply(id), inheritLabel?, clear?()}
 */
export function openPicker(target) {
  closePicker();
  const host = document.getElementById('left');
  const browser = materialBrowser({ cat: target.cat || 'all', current: target.current, onPick: (id) => target.apply(id) });
  pickerEl = h('div', { class: 'picker-overlay' },
    h('div', { class: 'picker-head' },
      h('div', {}, h('div', { class: 'muted small' }, 'Choose finish for'), h('strong', {}, target.title)),
      h('button', { class: 'btn primary small', onclick: closePicker }, 'Done')),
    target.clear ? h('button', { class: 'btn small ghost', onclick: () => { target.clear(); closePicker(); } }, target.inheritLabel || 'Reset to inherited') : null,
    h('div', { class: 'muted small' }, 'Click swatches to try them — the 3D view updates live.'),
    browser);
  host.append(pickerEl);
}
export function closePicker() {
  pickerEl?.remove();
  pickerEl = null;
}

// ---------------------------------------------------------------- pattern editor
export function openPatternEditor({ base, onSaved }) {
  const isEdit = !!base?.custom;
  const def = deepClone(base || LIBRARY[0]);
  if (!isEdit) { def.id = uid('mat'); def.name = (base?.name || 'Pattern') + ' (custom)'; }
  def.custom = true;
  def.params = { ...PATTERN_DEFAULTS, ...def.params };
  def.cats = def.cats?.filter((c) => c !== 'custom') || ['floor'];

  const preview = h('canvas', { width: 360, height: 360, class: 'pe-preview' });
  const unitInfo = h('div', { class: 'muted small' });
  const form = h('div', { class: 'pe-form' });
  const areaSel = h('select', { onchange: draw }, ...[60, 120, 240, 400].map((v) => h('option', { value: v, selected: v === 120 }, `${v / 100} m × ${v / 100} m`)));

  function draw() {
    const r = renderPattern(def, 768, { noBump: true });
    const ctx = preview.getContext('2d');
    const area = +areaSel.value;
    const pat = ctx.createPattern(r.canvas, 'repeat');
    const s = preview.width / area;
    pat.setTransform(new DOMMatrix().rotate(def.rot || 0).scale((s * r.w) / r.canvas.width, (s * r.h) / r.canvas.height));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, preview.width, preview.height);
    unitInfo.textContent = `Repeat unit ${r.w.toFixed(1)} × ${r.h.toFixed(1)} cm · preview shows ${area / 100} m square`;
    if (r.pending) r.pending.then(draw);
  }

  const P = def.params;
  const num = (label, key, opts = {}) => field(label, h('input', { type: 'number', value: P[key], step: opts.step || 0.5, min: opts.min ?? 0, oninput: (e) => { P[key] = +e.target.value; draw(); } }), opts.unit);
  const color = (label, key) => field(label, h('input', { type: 'color', value: P[key], oninput: (e) => { P[key] = e.target.value; draw(); } }));
  function colorsEditor() {
    const wrap = h('div', { class: 'colors' });
    const render = () => {
      wrap.replaceChildren(...P.colors.map((c, i) => h('span', { class: 'color-item' },
        h('input', { type: 'color', value: toHex(c), oninput: (e) => { P.colors[i] = e.target.value; draw(); } }),
        P.colors.length > 1 ? h('button', { class: 'x', onclick: () => { P.colors.splice(i, 1); render(); draw(); } }, '×') : '')),
      h('button', { class: 'btn small', onclick: () => { P.colors.push(P.colors.at(-1)); render(); draw(); } }, '+'));
    };
    render();
    return wrap;
  }
  function renderForm() {
    const info = PATTERN_INFO[def.pattern] || PATTERN_INFO.grid;
    const f = info.fields;
    form.replaceChildren(...[
      field('Name', h('input', { value: def.name, oninput: (e) => (def.name = e.target.value) })),
      field('Pattern', h('select', { onchange: (e) => { def.pattern = e.target.value; renderForm(); draw(); } },
        ...Object.entries(PATTERN_INFO).filter(([k]) => k !== 'image' || def.pattern === 'image').map(([k, v]) => h('option', { value: k, selected: k === def.pattern }, v.label)))),
      f.includes('tileW') ? num(def.pattern === 'penny' ? 'Diameter' : f.includes('tileH') ? 'Tile width' : 'Tile size', 'tileW', { unit: 'cm', min: 0.5 }) : null,
      f.includes('tileH') ? num('Tile height', 'tileH', { unit: 'cm', min: 0.5 }) : null,
      f.includes('grout') ? num('Grout / joint', 'grout', { unit: 'mm', step: 0.5 }) : null,
      f.includes('grout') ? color('Grout colour', 'groutColor') : null,
      f.includes('offset') ? field('Offset', h('select', { onchange: (e) => { P.offset = +e.target.value; draw(); } },
        ...[[0.5, '1/2 (running bond)'], [1 / 3, '1/3'], [0.25, '1/4'], [0, 'None (stack)']].map(([v, l]) => h('option', { value: v, selected: Math.abs(v - P.offset) < 0.01 }, l)))) : null,
      f.includes('motif') ? field('Motif', h('select', { onchange: (e) => { P.motif = e.target.value; draw(); } }, ...MOTIFS.map((m) => h('option', { value: m, selected: m === P.motif }, m)))) : null,
      f.includes('motifRotate') ? field('Random rotation', h('input', { type: 'checkbox', checked: !!P.motifRotate, onchange: (e) => { P.motifRotate = e.target.checked; draw(); } })) : null,
      f.includes('layout') ? field('Repeat', h('select', { onchange: (e) => { P.layout = e.target.value; draw(); } }, ...Object.entries(LAYOUTS).map(([k, v]) => h('option', { value: k, selected: k === P.layout }, v)))) : null,
      field('Colours', colorsEditor()),
      P.colors.length > 1 ? field('Colour mix', h('select', { onchange: (e) => { P.mix = e.target.value; draw(); } }, ...[['first', 'First colour only'], ['random', 'Random mix'], ['alternate', 'Alternate']].map(([v, l]) => h('option', { value: v, selected: v === P.mix }, l)))) : null,
      def.pattern !== 'image' ? field('Surface', h('select', { onchange: (e) => { P.surface = e.target.value; renderForm(); draw(); } }, ...Object.entries(SURFACES).map(([k, v]) => h('option', { value: k, selected: k === P.surface }, v)))) : null,
      P.surface === 'marble' ? color('Vein colour', 'veinColor') : null,
      field('Tile-to-tile variation', h('input', { type: 'range', min: 0, max: 0.3, step: 0.01, value: P.variation, oninput: (e) => { P.variation = +e.target.value; draw(); } })),
      field('Rotation', h('input', { type: 'number', value: def.rot || 0, step: 15, oninput: (e) => { def.rot = +e.target.value; draw(); } }), '°'),
      field('Glossiness', h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: 1 - (def.rough ?? 0.6), oninput: (e) => (def.rough = 1 - +e.target.value) })),
      field('Metallic', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: def.metal || 0, oninput: (e) => (def.metal = +e.target.value) })),
      field('Use for', catChecks(def)),
    ].filter(Boolean));
  }
  renderForm();
  draw();

  const m = modal({
    title: isEdit ? 'Edit material' : 'New pattern material',
    wide: true,
    body: h('div', { class: 'pe' }, form, h('div', { class: 'pe-side' }, preview, h('div', { class: 'row gap' }, h('span', { class: 'muted small' }, 'Preview area'), areaSel), unitInfo)),
    buttons: [
      isEdit ? { label: 'Delete', class: 'danger', onClick: () => { store.update((pl) => delete pl.materials[def.id], 'material'); m.close(); } } : null,
      { label: 'Cancel', onClick: () => m.close() },
      { label: isEdit ? 'Save changes' : 'Save material', class: 'primary', onClick: () => {
        store.update((pl) => { pl.materials[def.id] = deepClone(def); }, 'material');
        m.close();
        toast(`Saved “${def.name}”`);
        onSaved?.(def);
      } },
    ],
  });
}

function catChecks(def) {
  const wrap = h('div', { class: 'checks' });
  for (const [id, label] of CATEGORIES.filter(([c]) => !['all', 'custom'].includes(c))) {
    wrap.append(h('label', {}, h('input', { type: 'checkbox', checked: def.cats.includes(id), onchange: (e) => {
      def.cats = e.target.checked ? [...new Set([...def.cats, id])] : def.cats.filter((c) => c !== id);
    } }), label));
  }
  return wrap;
}

function field(label, input, unit) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-input' }, input, unit ? h('span', { class: 'unit' }, unit) : null));
}
function toHex(c) {
  if (c.startsWith('#')) return c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c;
  const m = c.match(/\d+/g);
  return m ? '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('') : '#888888';
}

// ---------------------------------------------------------------- photo tile
export function openPhotoTile({ onSaved } = {}) {
  const st = {
    img: null, quad: null, name: 'My tile', w: 20, h: 20, grout: 2, groutColor: '#d0ccc4', layout: 'grid', cats: ['floor', 'tile'],
    rough: 0.35, variation: 0, lockSquare: false,
  };
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' }, onchange: (e) => load(e.target.files[0]) });
  const drop = h('div', { class: 'drop' }, h('div', {}, '📷 ', h('strong', {}, 'Take or choose a photo'), ' of your tile, wallpaper or fabric'), h('div', { class: 'muted small' }, 'or drop an image here'));
  drop.onclick = () => file.click();
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); };

  const cropCanvas = h('canvas', { class: 'crop-canvas', width: 520, height: 400 });
  const warped = h('canvas', { class: 'warped', width: 160, height: 160 });
  const preview = h('canvas', { class: 'pt-preview', width: 300, height: 300 });
  const hint = h('div', { class: 'muted small' }, 'Drag the 4 corner handles onto the corners of one tile (or one full repeat of the pattern). Perspective is corrected automatically.');
  let view = { s: 1, ox: 0, oy: 0 };
  let warpedData = null;

  function load(f) {
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        st.img = img;
        const m = Math.min(img.width, img.height) * 0.25;
        st.quad = [[m, m], [img.width - m, m], [img.width - m, img.height - m], [m, img.height - m]];
        drop.style.display = 'none';
        cropWrap.style.display = '';
        layoutView();
        drawCrop();
        updateWarp();
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
  }
  function layoutView() {
    const { img } = st;
    const s = Math.min(cropCanvas.width / img.width, cropCanvas.height / img.height);
    view = { s, ox: (cropCanvas.width - img.width * s) / 2, oy: (cropCanvas.height - img.height * s) / 2 };
  }
  function drawCrop() {
    const ctx = cropCanvas.getContext('2d');
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    ctx.drawImage(st.img, view.ox, view.oy, st.img.width * view.s, st.img.height * view.s);
    const q = st.quad.map(([x, y]) => [x * view.s + view.ox, y * view.s + view.oy]);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, cropCanvas.width, cropCanvas.height);
    ctx.moveTo(q[0][0], q[0][1]);
    for (let i = 3; i >= 0; i--) ctx.lineTo(q[i][0], q[i][1]);
    ctx.closePath();
    ctx.fill('evenodd');
    ctx.strokeStyle = '#3d8bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    q.forEach(([x, y], i) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3d8bff';
      ctx.font = '10px sans-serif';
      ctx.fillText(['TL', 'TR', 'BR', 'BL'][i], x + 9, y - 9);
    });
  }
  let dragIdx = -1;
  const toImg = (e) => {
    const r = cropCanvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) * cropCanvas.width) / r.width, y = ((e.clientY - r.top) * cropCanvas.height) / r.height;
    return [(x - view.ox) / view.s, (y - view.oy) / view.s];
  };
  cropCanvas.onpointerdown = (e) => {
    if (!st.img) return;
    const p = toImg(e);
    let best = -1, bd = 20 / view.s;
    st.quad.forEach(([x, y], i) => { const d = Math.hypot(x - p[0], y - p[1]); if (d < bd) { bd = d; best = i; } });
    dragIdx = best;
    if (best < 0) {
      // start a new axis-aligned rectangle
      st.quad = [p, p, p, p].map((v) => [...v]);
      dragIdx = 2;
      st.newRect = p;
    }
    cropCanvas.setPointerCapture(e.pointerId);
  };
  cropCanvas.onpointermove = (e) => {
    if (dragIdx < 0) return;
    const [x, y] = toImg(e);
    const cx = clamp(x, 0, st.img.width), cy = clamp(y, 0, st.img.height);
    if (st.newRect) {
      const [x0, y0] = st.newRect;
      st.quad = [[x0, y0], [cx, y0], [cx, cy], [x0, cy]];
    } else st.quad[dragIdx] = [cx, cy];
    drawCrop();
  };
  cropCanvas.onpointerup = () => {
    dragIdx = -1;
    if (st.newRect) {
      // normalise orientation
      const xs = st.quad.map((q) => q[0]), ys = st.quad.map((q) => q[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      st.quad = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      st.newRect = null;
      drawCrop();
    }
    updateWarp();
  };

  function updateWarp() {
    if (!st.img) return;
    const aspect = st.w / st.h;
    const W = aspect >= 1 ? 512 : Math.round(512 * aspect);
    const H = aspect >= 1 ? Math.round(512 / aspect) : 512;
    warpedData = perspectiveWarp(st.img, st.quad, W, H);
    warped.width = W; warped.height = H;
    warped.getContext('2d').drawImage(warpedData, 0, 0);
    drawPreview();
  }
  function currentDef() {
    return {
      id: st.id || uid('photo'), name: st.name, custom: true, cats: st.cats, pattern: 'image', rough: st.rough, metal: 0, rot: 0, bump: 0.8, kind: 'pattern',
      params: { ...PATTERN_DEFAULTS, image: st.dataUrl, tileW: st.w, tileH: st.h, grout: st.grout, groutColor: st.groutColor, layout: st.layout, colors: ['#cccccc'], grain: 0, variation: st.variation },
    };
  }
  function drawPreview() {
    if (!warpedData) return;
    st.dataUrl = warpedData.toDataURL('image/jpeg', 0.88);
    const def = currentDef();
    const r = renderPattern(def, 512, { noBump: true });
    const go = () => {
      const r2 = renderPattern(def, 512, { noBump: true });
      const ctx = preview.getContext('2d');
      const area = Math.max(st.w, st.h) * 5;
      const pat = ctx.createPattern(r2.canvas, 'repeat');
      const s = preview.width / area;
      pat.setTransform(new DOMMatrix().scale((s * r2.w) / r2.canvas.width, (s * r2.h) / r2.canvas.height));
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, preview.width, preview.height);
      prevLabel.textContent = `Preview: ${(area / 100).toFixed(2)} m × ${(area / 100).toFixed(2)} m`;
    };
    if (r.pending) r.pending.then(go); else go();
  }
  const prevLabel = h('div', { class: 'muted small' });
  const inp = (label, key, type = 'number', unit, extra = {}) => field(label, h('input', {
    type, value: st[key], step: extra.step || 0.5, min: 0.5,
    oninput: (e) => {
      st[key] = type === 'number' ? +e.target.value : e.target.value;
      if (st.lockSquare && (key === 'w' || key === 'h')) { st.w = st.h = st[key]; syncWH(); }
      if (key === 'w' || key === 'h') updateWarp(); else drawPreview();
    },
  }), unit);
  const wInput = inp('Real width', 'w', 'number', 'cm');
  const hInput = inp('Real height', 'h', 'number', 'cm');
  function syncWH() { wInput.querySelector('input').value = st.w; hInput.querySelector('input').value = st.h; }
  const presetSel = h('select', { onchange: (e) => { const [w, hh] = e.target.value.split('x').map(Number); if (w) { st.w = w; st.h = hh; syncWH(); updateWarp(); } } },
    ...['', '10x10', '15x15', '20x20', '30x30', '60x60', '7.5x15', '7.5x30', '5x20', '30x60', '60x120', '100x100'].map((v) => h('option', { value: v }, v ? v.replace('x', ' × ') + ' cm' : 'Common sizes…')));

  const cropWrap = h('div', { class: 'crop-wrap', style: { display: 'none' } },
    cropCanvas, hint,
    h('div', { class: 'row gap' }, h('button', { class: 'btn small', onclick: () => { st.quad = [[0, 0], [st.img.width, 0], [st.img.width, st.img.height], [0, st.img.height]]; drawCrop(); updateWarp(); } }, 'Use whole photo'),
      h('button', { class: 'btn small', onclick: () => file.click() }, 'Choose another photo')));

  const form = h('div', { class: 'pt-form' },
    field('Name', h('input', { value: st.name, oninput: (e) => (st.name = e.target.value) })),
    field('Size preset', presetSel),
    wInput, hInput,
    field('Repeat pattern', h('select', { onchange: (e) => { st.layout = e.target.value; drawPreview(); } }, ...Object.entries(LAYOUTS).map(([k, v]) => h('option', { value: k }, v)))),
    inp('Grout width', 'grout', 'number', 'mm'),
    field('Grout colour', h('input', { type: 'color', value: st.groutColor, oninput: (e) => { st.groutColor = e.target.value; drawPreview(); } })),
    field('Finish', h('select', { onchange: (e) => (st.rough = +e.target.value) }, h('option', { value: 0.1 }, 'Glossy'), h('option', { value: 0.35, selected: true }, 'Satin'), h('option', { value: 0.8 }, 'Matte'))),
    field('Use for', catChecks(st)),
    h('div', { class: 'muted small' }, 'Tip: set the real size of the area you cropped. For patterned wallpaper or fabric, crop exactly one repeat and use grout 0.'),
    h('div', { class: 'row gap' }, h('div', {}, h('div', { class: 'muted small' }, 'Corrected tile'), warped), h('div', {}, prevLabel, preview)),
  );

  const m = modal({
    title: 'Create a tile from a photo',
    wide: true,
    body: h('div', { class: 'pt' }, h('div', { class: 'pt-left' }, drop, cropWrap, file), form),
    buttons: [
      { label: 'Cancel', onClick: () => m.close() },
      { label: 'Save material', class: 'primary', onClick: () => {
        if (!st.img) { toast('Choose a photo first'); return; }
        const def = currentDef();
        store.update((pl) => { pl.materials[def.id] = def; }, 'material');
        m.close();
        toast(`Saved “${def.name}” — find it under “My materials”`);
        onSaved?.(def);
      } },
    ],
  });
}

/** Warp quad region of image into a WxH canvas (homography, bilinear sampling). */
export function perspectiveWarp(img, quad, W, H) {
  const maxSrc = 1600;
  const sc = Math.min(1, maxSrc / Math.max(img.width, img.height));
  const src = document.createElement('canvas');
  src.width = Math.round(img.width * sc); src.height = Math.round(img.height * sc);
  const sctx = src.getContext('2d');
  sctx.drawImage(img, 0, 0, src.width, src.height);
  const sd = sctx.getImageData(0, 0, src.width, src.height).data;
  const q = quad.map(([x, y]) => [x * sc, y * sc]);
  const Hm = homography([[0, 0], [1, 0], [1, 1], [0, 1]], q);
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const octx = out.getContext('2d');
  const od = octx.createImageData(W, H);
  const sw = src.width, sh = src.height;
  for (let j = 0; j < H; j++) {
    const v = (j + 0.5) / H;
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W;
      const z = Hm[6] * u + Hm[7] * v + 1;
      const x = (Hm[0] * u + Hm[1] * v + Hm[2]) / z;
      const y = (Hm[3] * u + Hm[4] * v + Hm[5]) / z;
      const x0 = clamp(Math.floor(x), 0, sw - 2), y0 = clamp(Math.floor(y), 0, sh - 2);
      const fx = clamp(x - x0, 0, 1), fy = clamp(y - y0, 0, 1);
      const o = (j * W + i) * 4;
      for (let c = 0; c < 3; c++) {
        const a = sd[(y0 * sw + x0) * 4 + c], b = sd[(y0 * sw + x0 + 1) * 4 + c];
        const cc = sd[((y0 + 1) * sw + x0) * 4 + c], d = sd[((y0 + 1) * sw + x0 + 1) * 4 + c];
        od.data[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
      }
      od.data[o + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

function homography(from, to) {
  // solve 8x8 for h (h33 = 1)
  const A = [], b = [];
  for (let k = 0; k < 4; k++) {
    const [x, y] = from[k], [X, Y] = to[k];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }
  return solve(A, b);
}
function solve(A, b) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}
