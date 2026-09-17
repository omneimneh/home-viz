// Sidebars, top bar, properties panel and 3D toolbar.
import { h, fmtM, fmtArea, polyArea, downloadText, deepClone, uid, kelvinToRGB } from '../util.js';
import { store } from '../store.js';
import { ITEMS, ITEM_CATS, ITEM_BY_TYPE, SLOT_LABELS, THEME_DEFAULTS } from '../catalog/items.js';
import { getMaterialDef } from '../materials/library.js';
import { thumbImg } from '../materials/textures.js';
import {
  ROOM_TYPES, DOOR_STYLES, WINDOW_STYLES, OPENING_PRESETS, wallLen, wallDir, wallSideRooms, resolveWallSide,
  splitWall, moveVertex, resolveSlot, ROOM_DEFAULTS,
} from '../plan/model.js';
import { SAMPLES, makeSample } from '../plan/samples.js';
import { THEMES, applyTheme } from '../plan/themes.js';
import { SCENARIOS } from '../view3d.js';
import { openPicker, closePicker, materialBrowser, openPhotoTile } from './materialsUI.js';
import { modal, toast } from './modal.js';
import { deleteSelection, duplicateSelection } from '../editor2d.js';

let editor, view;

export function initUI(ed, vw) {
  editor = ed; view = vw;
  buildTopbar();
  buildLeft();
  buildToolbar3d();
  renderProps();
  store.on('select', () => { closePicker(); renderProps(); });
  store.on('change', (d) => { if (!d.live) renderProps(); else renderPropsLive(); });
  store.on('load', () => { renderProps(); refreshLeft(); });
}

// ================================================================= top bar
function buildTopbar() {
  const bar = document.getElementById('topbar');
  const viewSeg = segmented([['plan', '2D plan'], ['split', 'Split'], ['3d', '3D']], 'split', (v) => setLayout(v));
  const undoBtn = h('button', { class: 'icon-btn', title: 'Undo (Ctrl+Z)', onclick: () => store.undo() }, '↶');
  const redoBtn = h('button', { class: 'icon-btn', title: 'Redo (Ctrl+Y)', onclick: () => store.redo() }, '↷');
  const nameInput = h('input', { class: 'plan-name', title: 'Plan name', onchange: (e) => store.update((p) => (p.name = e.target.value), 'rename') });
  store.on('load', () => (nameInput.value = store.plan.name));
  store.on('change', () => { if (document.activeElement !== nameInput) nameInput.value = store.plan.name; });
  bar.append(
    h('div', { class: 'brand' }, h('span', { class: 'logo' }, '⌂'), 'HomeViz'),
    h('div', { class: 'menu' },
      h('button', { class: 'btn ghost', onclick: openStart }, '📁 New / Samples'),
      h('button', { class: 'btn ghost', onclick: openSaves }, 'Open'),
      h('button', { class: 'btn ghost', onclick: saveAs }, 'Save'),
      h('button', { class: 'btn ghost', onclick: exportJSON }, 'Export'),
      h('button', { class: 'btn ghost', onclick: importJSON }, 'Import'),
    ),
    nameInput,
    h('div', { class: 'spacer' }),
    undoBtn, redoBtn,
    viewSeg,
    h('button', { class: 'icon-btn', title: 'Help', onclick: openHelp }, '?'),
  );
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveAs(); }
  });
}

export function setLayout(v) {
  const views = document.getElementById('views');
  views.className = 'layout-' + v;
  document.querySelectorAll('#topbar .seg button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  setTimeout(() => { editor.resize(); view.resize(); }, 30);
}

function openStart() {
  const m = modal({
    title: 'Start a plan',
    wide: true,
    body: h('div', {},
      h('p', { class: 'muted' }, 'Pick a sample to explore or edit, or start from a blank canvas. Your current plan is auto-saved; use Save to keep a named copy.'),
      h('div', { class: 'cards' }, ...SAMPLES.map((s) => h('button', { class: 'card', onclick: () => { store.load(makeSample(s.id)); m.close(); } },
        h('div', { class: 'card-art' }, samplePreview(s.id)),
        h('strong', {}, s.name), h('span', { class: 'muted small' }, s.desc))))),
  });
}
function samplePreview(id) {
  const c = h('canvas', { width: 220, height: 150 });
  const plan = makeSample(id);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f3ef'; ctx.fillRect(0, 0, 220, 150);
  if (!plan.walls.length) { ctx.fillStyle = '#999'; ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', 110, 90); return c; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  plan.walls.forEach((w) => [w.a, w.b].forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }));
  const s = Math.min(200 / (x1 - x0), 130 / (y1 - y0));
  ctx.translate(110 - ((x0 + x1) / 2) * s, 75 - ((y0 + y1) / 2) * s);
  ctx.scale(s, s);
  const tint = { living: '#e8dcc8', kitchen: '#dfe6e1', bedroom: '#e6dde6', bathroom: '#dce8ef', other: '#eee' };
  for (const r of plan.rooms) { ctx.fillStyle = tint[r.type] || '#eee'; ctx.beginPath(); r.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.fill(); }
  for (const it of plan.items) { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate((it.rot * Math.PI) / 180); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-it.w / 2, -it.d / 2, it.w, it.d); ctx.restore(); }
  ctx.strokeStyle = '#2d2f33';
  for (const w of plan.walls) { ctx.lineWidth = w.thickness; ctx.beginPath(); ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); ctx.stroke(); }
  return c;
}

function saveAs() {
  const input = h('input', { value: store.plan.name, style: { width: '100%' } });
  const m = modal({
    title: 'Save plan', body: h('div', {}, h('p', { class: 'muted' }, 'Saved in this browser. Use Export to get a file you can move between devices.'), input),
    buttons: [{ label: 'Cancel', onClick: () => m.close() }, { label: 'Save', class: 'primary', onClick: () => {
      const ok = store.saveAs(input.value.trim() || 'Untitled');
      m.close();
      toast(ok ? 'Plan saved' : 'Could not save — browser storage is full. Try Export instead.');
      store.changed('rename');
    } }],
  });
  setTimeout(() => input.select(), 50);
}
function openSaves() {
  const list = h('div', { class: 'save-list' });
  const render = () => {
    const saves = store.listSaves();
    list.replaceChildren(...(saves.length ? saves.map((s) => h('div', { class: 'save-row' },
      h('div', {}, h('strong', {}, s.name), h('div', { class: 'muted small' }, new Date(s.date).toLocaleString())),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn small primary', onclick: () => { store.load(s.plan); m.close(); } }, 'Open'),
        h('button', { class: 'btn small danger', onclick: () => { if (confirm(`Delete “${s.name}”?`)) { store.deleteSave(s.name); render(); } } }, 'Delete'))))
      : [h('p', { class: 'muted' }, 'No saved plans yet.')]));
  };
  render();
  const m = modal({ title: 'Open saved plan', body: list });
}
function exportJSON() {
  downloadText((store.plan.name || 'plan').replace(/[^\w-]+/g, '_') + '.homeviz.json', JSON.stringify(store.plan, null, 1));
}
function importJSON() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' });
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    f.text().then((t) => {
      try {
        const p = JSON.parse(t);
        if (!p.walls || !p.rooms) throw new Error('Not a HomeViz plan');
        store.load(p);
        toast('Plan imported');
      } catch (e) { toast('Import failed: ' + e.message); }
    });
  };
  inp.click();
}
function openHelp() {
  const row = (k, v) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, v));
  modal({
    title: 'How to use HomeViz',
    wide: true,
    body: h('div', { class: 'help' },
      h('ol', {},
        h('li', {}, h('strong', {}, 'Lay out: '), 'In the Build tab, draw rooms (drag a rectangle) or walls (click-click). Rooms define floors, ceilings and default wall finishes; walls are shared and split automatically at junctions.'),
        h('li', {}, h('strong', {}, 'Openings: '), 'Choose a door or window style, then click a wall. Drag it along the wall; flip the swing in the properties panel.'),
        h('li', {}, h('strong', {}, 'Furnish: '), 'Pick an item and click on the plan (or drag it in). Items snap to nearby walls. Drag the round handle to rotate.'),
        h('li', {}, h('strong', {}, 'Style: '), 'Apply a whole-home style in the Styles tab, then fine-tune: select a room/wall/item (in 2D or by clicking in 3D) and click a finish swatch in the properties panel.'),
        h('li', {}, h('strong', {}, 'Your own tiles: '), 'Materials tab → “Tile from photo”. Drag the 4 corners onto one tile, enter its real size and choose a repeat pattern.'),
        h('li', {}, h('strong', {}, 'Light: '), 'Use the 3D toolbar to switch Day / Sunset / Overcast / Night, set the bulb colour temperature (warm ↔ cool) and compare all lighting at once.'),
        h('li', {}, h('strong', {}, 'Walk: '), 'Press Walk, click the 3D view, then move around. In split view, the orange marker on the plan shows where you are — drag it to teleport.'),
      ),
      h('table', { class: 'keys' },
        row('V W B P D N', 'Select · Wall · Room · Polygon room · Door · Window'),
        row('Esc / Enter / double-click', 'Finish a wall chain or polygon'),
        row('Alt (hold)', 'Disable snapping'),
        row('Delete', 'Delete selection'),
        row('R / Q / E', 'Rotate item 90° / −15° / +15°'),
        row('Arrows (+Shift)', 'Nudge item 1 cm (10 cm)'),
        row('Ctrl+D / Ctrl+drag', 'Duplicate item'),
        row('Ctrl+Z / Ctrl+Y', 'Undo / redo'),
        row('Wheel / drag empty space', 'Zoom / pan the plan'),
        row('F', 'Fit plan to view'),
        row('Walk: WASD, Shift, Q/E', 'Move, run, turn'),
      ),
      h('p', { class: 'muted small' }, 'All measurements are metric: plan dimensions in centimetres, lengths shown in metres, areas in m².')),
  });
}

// ================================================================= left
let leftTab = 'build';
let leftBody;
function buildLeft() {
  const left = document.getElementById('left');
  const tabs = h('div', { class: 'tabs' });
  leftBody = h('div', { class: 'left-body' });
  const defs = [['build', 'Build'], ['furnish', 'Furnish'], ['styles', 'Styles'], ['materials', 'Materials']];
  const renderTabs = () => tabs.replaceChildren(...defs.map(([id, l]) => h('button', { class: 'tab' + (leftTab === id ? ' active' : ''), onclick: () => { leftTab = id; closePicker(); renderTabs(); refreshLeft(); } }, l)));
  renderTabs();
  left.append(tabs, leftBody);
  editor.onToolChange = () => { if (leftTab === 'build' || leftTab === 'furnish') refreshLeft(); };
  refreshLeft();
}
function refreshLeft() {
  if (!leftBody) return;
  const scroll = leftBody.scrollTop;
  leftBody.replaceChildren(({ build: buildTab, furnish: furnishTab, styles: stylesTab, materials: materialsTab })[leftTab]());
  leftBody.scrollTop = scroll;
}

function toolBtn(tool, icon, label, key, opts) {
  const active = editor.tool === tool && (!opts || Object.entries(opts).every(([k, v]) => editor.toolOpts[k] === v));
  return h('button', { class: 'tool' + (active ? ' active' : ''), title: `${label} (${key})`, onclick: () => editor.setTool(tool, opts) }, h('span', { class: 'tool-icon' }, icon), h('span', {}, label));
}

function buildTab() {
  const o = editor.toolOpts;
  const plan = store.plan;
  const doorStyles = Object.entries(DOOR_STYLES).map(([k, v]) => h('button', {
    class: 'list-btn' + (editor.tool === 'door' && o.doorStyle === k ? ' active' : ''),
    onclick: () => editor.setTool('door', { doorStyle: k }),
  }, h('span', {}, v), h('span', { class: 'muted small' }, `${OPENING_PRESETS.door[k].width} cm`)));
  const winStyles = Object.entries(WINDOW_STYLES).map(([k, v]) => h('button', {
    class: 'list-btn' + (editor.tool === 'window' && o.windowStyle === k ? ' active' : ''),
    onclick: () => editor.setTool('window', { windowStyle: k }),
  }, h('span', {}, v), h('span', { class: 'muted small' }, `${OPENING_PRESETS.window[k].width}×${OPENING_PRESETS.window[k].height}`)));

  return h('div', {},
    section('Tools',
      h('div', { class: 'tool-grid' },
        toolBtn('select', '↖', 'Select', 'V'),
        toolBtn('room', '▭', 'Room', 'B'),
        toolBtn('wall', '╱', 'Wall', 'W'),
        toolBtn('poly', '⬠', 'Polygon room', 'P'),
      ),
      editor.tool === 'room' || editor.tool === 'poly' ? h('div', { class: 'tool-opts' },
        field('Room type', select(ROOM_TYPES, o.roomType, (v) => (o.roomType = v))),
        field('Create walls', h('input', { type: 'checkbox', checked: o.createWalls, onchange: (e) => (o.createWalls = e.target.checked) })),
        h('div', { class: 'muted small' }, editor.tool === 'room' ? 'Drag a rectangle on the plan. Untick “Create walls” to make an open-plan zone (e.g. kitchen area in a living room).' : 'Click the corners, then click the first point or press Enter.')) : null,
      editor.tool === 'wall' || editor.tool === 'room' || editor.tool === 'poly' ? h('div', { class: 'tool-opts' },
        field('Wall type', select({ int: `Interior (${plan.defaults.intThickness} cm)`, ext: `Exterior (${plan.defaults.extThickness} cm)` }, o.wallThickness, (v) => (o.wallThickness = v))),
        editor.tool === 'wall' ? h('div', { class: 'muted small' }, 'Click to start, click again for each corner. Double-click, Enter or Esc to finish. Hold Alt to disable snapping.') : null) : null,
      field('Snap to', select({ 1: '1 cm', 5: '5 cm', 10: '10 cm', 25: '25 cm', 50: '50 cm' }, String(o.snap), (v) => (o.snap = +v))),
    ),
    section('Doors', h('div', { class: 'list' }, ...doorStyles), h('div', { class: 'muted small' }, 'Pick a style, then click a wall. Shift+click to place several.')),
    section('Windows', h('div', { class: 'list' }, ...winStyles)),
    section('Plan defaults',
      numField('Wall / ceiling height', plan.defaults.wallHeight, (v) => store.update((p) => (p.defaults.wallHeight = v), 'defaults'), 'cm'),
      numField('Exterior wall thickness', plan.defaults.extThickness, (v) => store.update((p) => (p.defaults.extThickness = v), 'defaults'), 'cm'),
      numField('Interior wall thickness', plan.defaults.intThickness, (v) => store.update((p) => (p.defaults.intThickness = v), 'defaults'), 'cm'),
    ),
  );
}

let furnishQuery = '';
function furnishTab() {
  const grid = h('div', {});
  const render = () => {
    const q = furnishQuery.toLowerCase();
    grid.replaceChildren(...ITEM_CATS.map((cat) => {
      const items = ITEMS.filter((i) => i.cat === cat && (!q || i.name.toLowerCase().includes(q)));
      if (!items.length) return null;
      return section(cat, h('div', { class: 'item-grid' }, ...items.map((it) => h('button', {
        class: 'item-card' + (editor.tool === 'item' && editor.toolOpts.itemType === it.type ? ' active' : ''),
        draggable: true,
        ondragstart: (e) => e.dataTransfer.setData('text/item-type', it.type),
        onclick: () => editor.setTool('item', { itemType: it.type, itemRot: 0 }),
        title: `${it.name} — ${it.w}×${it.d}×${it.h} cm`,
      }, itemIcon(it), h('span', { class: 'item-name' }, it.name), h('span', { class: 'muted tiny' }, `${it.w}×${it.d}`)))));
    }).filter(Boolean));
  };
  render();
  return h('div', {},
    h('input', { type: 'search', class: 'search', placeholder: 'Search furniture…', value: furnishQuery, oninput: (e) => { furnishQuery = e.target.value; render(); } }),
    h('div', { class: 'muted small pad-b' }, 'Click an item then click on the plan (R rotates while placing), or drag it onto the plan.'),
    grid);
}
function itemIcon(def) {
  const c = h('canvas', { width: 56, height: 44, class: 'item-icon' });
  const ctx = c.getContext('2d');
  const s = Math.min(46 / def.w, 36 / def.d);
  ctx.translate(28, 22);
  ctx.scale(s, s);
  ctx.fillStyle = '#e9e5dc';
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.2 / s;
  def.plan(ctx, def.w, def.d);
  return c;
}

let resetOverrides = false;
function stylesTab() {
  const plan = store.plan;
  return h('div', {},
    section('Whole-home styles',
      h('div', { class: 'muted small pad-b' }, 'Applies coordinated floors, wall finishes, backsplashes, bathroom tiles and furniture finishes by room type. Undo with Ctrl+Z.'),
      h('label', { class: 'check-line' }, h('input', { type: 'checkbox', checked: resetOverrides, onchange: (e) => (resetOverrides = e.target.checked) }), 'Also clear individual wall & furniture overrides'),
      h('div', { class: 'theme-list' }, ...THEMES.map((t) => h('button', {
        class: 'theme-card',
        onclick: () => { store.update((p) => applyTheme(p, t, { resetWalls: resetOverrides }), 'theme'); toast(`Applied ${t.name}`); refreshLeft(); },
      }, h('div', { class: 'theme-swatches' }, ...t.colors.map((c) => h('span', { style: { background: c } }))),
      h('div', { class: 'theme-mats' }, ...[t.rooms.living.floorMat, t.rooms.kitchen.band?.mat, t.slots.countertop, t.slots.fabric].filter(Boolean).map((id) => thumbImg(getMaterialDef(plan, id), 40, 'mini'))),
      h('strong', {}, t.name))))),
    section('Furniture & fixture finishes (global)',
      h('div', { class: 'muted small pad-b' }, 'Every item uses these unless you override a finish on the item itself.'),
      ...Object.keys(SLOT_LABELS).map((slot) => slotRow(SLOT_LABELS[slot], plan.theme[slot] || THEME_DEFAULTS[slot], {
        cat: slotCat(slot),
        apply: (id) => store.update((p) => (p.theme[slot] = id), 'theme'),
      })),
      slotRow('Door leaves', plan.theme.door, { cat: 'cabinet', apply: (id) => store.update((p) => (p.theme.door = id), 'theme') }),
      slotRow('Window & door frames', plan.theme.frame, { cat: 'cabinet', apply: (id) => store.update((p) => (p.theme.frame = id), 'theme') }),
      slotRow('Exterior walls', plan.exteriorMat, { cat: 'wall', apply: (id) => store.update((p) => (p.exteriorMat = id), 'exterior') }),
    ),
  );
}
function slotCat(slot) {
  return { cabinet: 'cabinet', countertop: 'counter', wood: 'wood', fabric: 'fabric', accent: 'fabric', bedding: 'fabric', curtain: 'fabric', lampshade: 'fabric', metal: 'metal', ceramic: 'ceramic', glass: 'ceramic', rug: 'rug', appliance: 'metal', pot: 'ceramic' }[slot] || 'all';
}

function materialsTab() {
  const browser = materialBrowser({
    cat: 'all',
    onPick: (id) => {
      const t = activeTarget();
      if (t) { t.apply(id); toast(`Applied to ${t.title}`); }
      else toast('Select a room, wall or item first — or click ✎ to edit this material');
    },
  });
  const t = activeTarget();
  return h('div', {},
    h('div', { class: 'target-box' }, t ? ['Clicking a swatch applies it to ', h('strong', {}, t.title)] : 'Select a floor, wall or item (in 2D or 3D) to apply materials here.'),
    browser);
}

// what the Materials tab applies to, based on the selection focus
function activeTarget() {
  const sel = store.selection;
  const obj = store.selected();
  if (!obj) return null;
  if (sel.type === 'room') {
    const f = sel.focus === 'ceiling' ? 'ceilingMat' : sel.focus === 'walls' ? 'wallMat' : 'floorMat';
    return { title: `${obj.name} · ${{ floorMat: 'floor', wallMat: 'walls', ceilingMat: 'ceiling' }[f]}`, apply: (id) => store.update(() => (obj[f] = id), 'material') };
  }
  if (sel.type === 'wall') {
    const side = sel.focus?.endsWith('B') ? 'B' : 'A';
    const band = sel.focus?.startsWith('band');
    return {
      title: `wall side ${side}${band ? ' (tiled band)' : ''}`,
      apply: (id) => store.update(() => {
        const s = obj.sides[side];
        if (band) {
          const r = resolveWallSide(store.plan, obj, side);
          s.band = { mat: id, from: r.band?.from ?? 90, to: r.band?.to ?? 150 };
        } else s.mat = id;
      }, 'material'),
    };
  }
  if (sel.type === 'item') {
    const def = ITEM_BY_TYPE[obj.type];
    const slot = sel.focus && def.slots.includes(sel.focus) ? sel.focus : def.slots[0];
    return { title: `${def.name} · ${SLOT_LABELS[slot] || slot}`, apply: (id) => store.update(() => (obj.mats[slot] = id), 'material') };
  }
  if (sel.type === 'opening') {
    const slot = sel.focus === 'door' ? 'door' : 'frame';
    return { title: `${obj.kind} ${slot}`, apply: (id) => store.update(() => (obj.mats[slot] = id), 'material') };
  }
  return null;
}

// ================================================================= right (properties)
const right = () => document.getElementById('right');
function renderProps() {
  const el = right();
  if (!el) return;
  const sel = store.selection;
  const obj = store.selected();
  let body;
  if (!obj) body = planProps();
  else if (sel.type === 'room') body = roomProps(obj, sel);
  else if (sel.type === 'wall') body = wallProps(obj, sel);
  else if (sel.type === 'opening') body = openingProps(obj);
  else if (sel.type === 'item') body = itemProps(obj, sel);
  const scroll = el.scrollTop;
  el.replaceChildren(body);
  el.scrollTop = scroll;
  if (leftTab === 'materials') refreshLeft();
}
let liveT;
function renderPropsLive() {
  clearTimeout(liveT);
  liveT = setTimeout(renderProps, 150);
}

function planProps() {
  const plan = store.plan;
  const area = plan.rooms.reduce((s, r) => s + polyArea(r.points), 0);
  return h('div', {},
    h('h3', {}, 'Plan'),
    h('div', { class: 'stats' },
      stat('Rooms', plan.rooms.length), stat('Floor area', fmtArea(area)), stat('Walls', plan.walls.length), stat('Items', plan.items.length)),
    section('Rooms', ...plan.rooms.map((r) => h('button', { class: 'list-btn', onclick: () => store.select({ type: 'room', id: r.id, focus: 'floor' }) },
      h('span', { class: 'row gap' }, thumbImg(getMaterialDef(plan, r.floorMat), 24, 'mini'), r.name), h('span', { class: 'muted small' }, fmtArea(polyArea(r.points)))))),
    section('Getting started',
      h('ul', { class: 'tips' },
        h('li', {}, 'Click a room, wall or furniture item in the plan — or click any surface in the 3D view — to change its finish.'),
        h('li', {}, 'Try the Styles tab for complete looks, then compare lighting with the ◐ Compare button in the 3D toolbar.'),
        h('li', {}, 'Materials → “Tile from photo” turns a photo of your own tile into a real-scale material.'))),
  );
}
function stat(l, v) { return h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, v), h('div', { class: 'muted small' }, l)); }

function roomProps(r, sel) {
  const plan = store.plan;
  const upd = (fn) => store.update(() => fn(r), 'room');
  const band = r.band;
  return h('div', {},
    header('Room', r.name),
    field('Name', h('input', { value: r.name, onchange: (e) => upd((x) => (x.name = e.target.value)) })),
    field('Type', select(ROOM_TYPES, r.type, (v) => upd((x) => (x.type = v)))),
    h('div', { class: 'muted small' }, `Area ${fmtArea(polyArea(r.points))}`),
    section('Finishes',
      slotRow('Floor', r.floorMat, { cat: 'floor', focus: sel.focus === 'floor', apply: (id) => upd((x) => (x.floorMat = id)), title: `${r.name} · floor` }),
      slotRow('Walls', r.wallMat, { cat: 'wall', focus: sel.focus === 'walls', apply: (id) => upd((x) => (x.wallMat = id)), title: `${r.name} · walls` }),
      slotRow('Ceiling', r.ceilingMat, { cat: 'ceiling', focus: sel.focus === 'ceiling', apply: (id) => upd((x) => (x.ceilingMat = id)), title: `${r.name} · ceiling` }),
      h('label', { class: 'check-line' }, h('input', { type: 'checkbox', checked: !!band?.mat, onchange: (e) => upd((x) => {
        x.band = e.target.checked ? { ...(ROOM_DEFAULTS[x.type]?.band || { mat: 'subway-white', from: 0, to: 120, where: 'all' }) } : null;
      }) }), 'Tiled band on walls (backsplash / wainscot)'),
      band?.mat ? h('div', { class: 'indent' },
        slotRow('Band tiles', band.mat, { cat: 'tile', apply: (id) => upd((x) => (x.band.mat = id)), title: `${r.name} · wall tiles` }),
        h('div', { class: 'row2' },
          numField('From', band.from, (v) => upd((x) => (x.band.from = v)), 'cm'),
          numField('To', band.to, (v) => upd((x) => (x.band.to = v)), 'cm')),
        field('Apply to', select({ all: 'All walls', counters: 'Walls behind counters' }, band.where || 'all', (v) => upd((x) => (x.band.where = v)))),
        h('div', { class: 'row gap wrap' }, ...[['Backsplash', 90, 150, 'counters'], ['Wainscot', 0, 110, 'all'], ['Shower height', 0, 210, 'all'], ['Full height', 0, 400, 'all']].map(([l, f, t, wh]) => h('button', { class: 'btn small', onclick: () => upd((x) => Object.assign(x.band, { from: f, to: t, where: wh })) }, l)))) : null,
    ),
    section('Ceiling & lighting',
      numField('Ceiling height', r.ceilingHeight || plan.defaults.wallHeight, (v) => upd((x) => (x.ceilingHeight = v)), 'cm'),
      h('label', { class: 'check-line' }, h('input', { type: 'checkbox', checked: r.light?.on !== false, onchange: (e) => upd((x) => (x.light.on = e.target.checked)) }), 'Ceiling light (auto, unless the room has ceiling fixtures)'),
      rangeField('Light output', r.light?.power ?? 1, 0.2, 3, 0.1, (v) => upd((x) => (x.light.power = v)), (v) => `${Math.round(v * 140)} lm/m²`),
    ),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn small', onclick: () => store.update((p) => {
        for (const w of p.walls) { const sr = wallSideRooms(p, w); for (const s of ['A', 'B']) if (sr[s] === r) w.sides[s] = {}; }
      }, 'reset') }, 'Reset wall overrides'),
      h('button', { class: 'btn small danger', onclick: deleteSelection }, 'Delete room')),
    h('p', { class: 'muted small' }, 'Deleting a room keeps its walls. Drag the square handles on the plan to reshape it.'),
  );
}

function wallProps(w, sel) {
  const plan = store.plan;
  const L = wallLen(w);
  const sides = wallSideRooms(plan, w);
  const upd = (fn) => store.update(() => fn(w), 'wall');
  const sideBox = (s) => {
    const res = resolveWallSide(plan, w, s, sides);
    const own = w.sides[s] || {};
    const label = sides[s] ? sides[s].name : 'Exterior';
    const bandMode = own.band?.none ? 'none' : own.band?.mat ? 'custom' : 'inherit';
    const focused = sel.focus === s || sel.focus === 'band' + s;
    return h('div', { class: 'side-box' + (focused ? ' focused' : '') },
      h('div', { class: 'side-title' }, `Side ${s} — ${label}`),
      slotRow('Finish', res.mat, {
        cat: 'wall', inherited: !own.mat && (sides[s] ? 'from room' : 'exterior'), focus: sel.focus === s, title: `${label} wall`,
        apply: (id) => upd((x) => (x.sides[s].mat = id)),
        clear: own.mat ? () => upd((x) => delete x.sides[s].mat) : null,
      }),
      field('Tiled band', select({ inherit: sides[s]?.band?.mat ? 'From room' : 'From room (none)', none: 'None', custom: 'Custom' }, bandMode, (v) => upd((x) => {
        if (v === 'inherit') delete x.sides[s].band;
        if (v === 'none') x.sides[s].band = { none: true };
        if (v === 'custom') x.sides[s].band = { mat: res.band?.mat || 'subway-white', from: res.band?.from ?? 90, to: res.band?.to ?? 150 };
      }))),
      res.band ? h('div', { class: 'indent' },
        slotRow('Band tiles', res.band.mat, { cat: 'tile', focus: sel.focus === 'band' + s, inherited: bandMode !== 'custom' && 'from room', title: `${label} wall tiles`, apply: (id) => upd((x) => {
          x.sides[s].band = { mat: id, from: res.band.from, to: res.band.to };
        }) }),
        bandMode === 'custom' ? h('div', { class: 'row2' },
          numField('From', res.band.from, (v) => upd((x) => (x.sides[s].band.from = v)), 'cm'),
          numField('To', res.band.to, (v) => upd((x) => (x.sides[s].band.to = v)), 'cm')) : h('div', { class: 'muted small' }, `${res.band.from}–${res.band.to} cm`)) : null,
    );
  };
  return h('div', {},
    header('Wall', fmtM(L)),
    numField('Length', Math.round(L * 10) / 10, (v) => store.update(() => {
      const d = wallDir(w);
      moveVertex(plan, { ...w.b }, { x: w.a.x + d.x * v, y: w.a.y + d.y * v }, 0.5);
    }, 'wall'), 'cm'),
    h('div', { class: 'row2' },
      numField('Thickness', w.thickness, (v) => upd((x) => (x.thickness = v)), 'cm'),
      numField('Height', w.height || plan.defaults.wallHeight, (v) => upd((x) => (x.height = v)), 'cm')),
    sideBox('A'), sideBox('B'),
    h('div', { class: 'muted small' }, 'Tip: click a wall surface in the 3D view to jump straight to that side.'),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn small', onclick: () => store.update((p) => splitWall(p, w, 0.5), 'split') }, 'Split in half'),
      h('button', { class: 'btn small', onclick: () => upd((x) => { [x.a, x.b] = [x.b, x.a]; [x.sides.A, x.sides.B] = [x.sides.B, x.sides.A]; for (const o of plan.openings) if (o.wallId === x.id) { o.offset = L - o.offset; o.swing = o.swing === 'A' ? 'B' : 'A'; o.flip = !o.flip; } }) }, 'Swap sides'),
      h('button', { class: 'btn small danger', onclick: deleteSelection }, 'Delete wall')),
  );
}

function openingProps(o) {
  const plan = store.plan;
  const upd = (fn) => store.update(() => fn(o), 'opening');
  const styles = o.kind === 'door' ? DOOR_STYLES : WINDOW_STYLES;
  const w = plan.walls.find((x) => x.id === o.wallId);
  return h('div', {},
    header(o.kind === 'door' ? 'Door' : 'Window', styles[o.style]),
    field('Style', select(styles, o.style, (v) => upd((x) => { x.style = v; const pr = OPENING_PRESETS[x.kind][v]; x.width = pr.width; x.height = pr.height; if (x.kind === 'window') x.sill = pr.sill; }))),
    h('div', { class: 'row2' },
      numField('Width', o.width, (v) => upd((x) => (x.width = v)), 'cm'),
      numField('Height', o.height, (v) => upd((x) => (x.height = v)), 'cm')),
    o.kind === 'window' ? numField('Sill height', o.sill, (v) => upd((x) => (x.sill = v)), 'cm') : null,
    numField('Position along wall', Math.round(o.offset), (v) => upd((x) => (x.offset = v)), 'cm'),
    w ? h('div', { class: 'muted small' }, `Wall length ${fmtM(wallLen(w))}`) : null,
    o.kind === 'door' && o.style !== 'passage' ? h('div', { class: 'row gap' },
      h('button', { class: 'btn small', onclick: () => upd((x) => (x.swing = x.swing === 'A' ? 'B' : 'A')) }, '⇅ Flip swing side'),
      h('button', { class: 'btn small', onclick: () => upd((x) => (x.flip = !x.flip)) }, '⇄ Flip hinge')) : null,
    section('Finishes',
      o.kind === 'door' && !['passage', 'sliding'].includes(o.style) ? slotRow('Door leaf', o.mats.door || plan.theme.door, { cat: 'cabinet', inherited: !o.mats.door, apply: (id) => upd((x) => (x.mats.door = id)), clear: o.mats.door ? () => upd((x) => delete x.mats.door) : null, title: 'door leaf' }) : null,
      slotRow('Frame', o.mats.frame || plan.theme.frame, { cat: 'cabinet', inherited: !o.mats.frame, apply: (id) => upd((x) => (x.mats.frame = id)), clear: o.mats.frame ? () => upd((x) => delete x.mats.frame) : null, title: 'frame' }),
    ),
    h('button', { class: 'btn small danger', onclick: deleteSelection }, 'Delete'),
  );
}

function itemProps(it, sel) {
  const def = ITEM_BY_TYPE[it.type];
  const plan = store.plan;
  const upd = (fn) => store.update(() => fn(it), 'item');
  return h('div', {},
    header('Item', def.name),
    h('div', { class: 'row3' },
      numField('Width', it.w, (v) => upd((x) => (x.w = v)), 'cm'),
      numField('Depth', it.d, (v) => upd((x) => (x.d = v)), 'cm'),
      numField('Height', it.h, (v) => upd((x) => (x.h = v)), 'cm')),
    h('div', { class: 'row3' },
      numField('X', it.x, (v) => upd((x) => (x.x = v)), 'cm'),
      numField('Y', it.y, (v) => upd((x) => (x.y = v)), 'cm'),
      numField('Rotation', it.rot, (v) => upd((x) => (x.rot = ((v % 360) + 360) % 360)), '°')),
    (it.elev ?? def.elev) >= 0 ? numField('Elevation from floor', it.elev ?? def.elev, (v) => upd((x) => (x.elev = v)), 'cm') : h('div', { class: 'muted small' }, 'Mounted on the ceiling'),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn small', onclick: () => upd((x) => (x.rot = (x.rot + 90) % 360)) }, '⟳ 90°'),
      h('button', { class: 'btn small', onclick: () => upd((x) => { x.w = def.w; x.d = def.d; x.h = def.h; }) }, 'Default size'),
      h('button', { class: 'btn small', onclick: duplicateSelection }, 'Duplicate')),
    section('Finishes',
      ...def.slots.map((slot) => slotRow(SLOT_LABELS[slot] || slot, resolveSlot(plan, it, slot)?.id, {
        cat: slotCat(slot), inherited: !it.mats[slot], focus: sel.focus === slot, title: `${def.name} · ${SLOT_LABELS[slot] || slot}`,
        apply: (id) => upd((x) => (x.mats[slot] = id)),
        clear: it.mats[slot] ? () => upd((x) => delete x.mats[slot]) : null,
      })),
      h('div', { class: 'muted small' }, 'Finishes marked “global” follow the Styles tab.')),
    def.light ? section('Light',
      h('label', { class: 'check-line' }, h('input', { type: 'checkbox', checked: it.light?.on !== false, onchange: (e) => upd((x) => { x.light = { ...(x.light || {}), on: e.target.checked }; }) }), 'Light on'),
      (it.elev ?? def.elev) >= 0 ? rangeField('Output', it.light?.power ?? 1, 0.2, 3, 0.1, (v) => upd((x) => { x.light = { ...(x.light || {}), power: v }; }), (v) => `${Math.round(v * 500 * def.light.power)} lm`) : h('div', { class: 'muted small' }, 'Ceiling fixtures share the room’s light output (see room settings).')) : null,
    h('button', { class: 'btn small danger', onclick: deleteSelection }, 'Delete item'),
  );
}

// ================================================================= 3D toolbar
function buildToolbar3d() {
  const tb = document.getElementById('view-toolbar');
  const s = view.state;
  const set = (patch) => { view.setState(patch); render(); };
  const tempSwatch = h('span', { class: 'temp-swatch' });
  const hint = document.getElementById('walk-hint');
  view.onLock = () => hint.classList.add('locked');
  view.onUnlock = () => hint.classList.remove('locked');

  function render() {
    const [r, g, b] = kelvinToRGB(s.temp);
    tempSwatch.style.background = `rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0})`;
    tb.replaceChildren(
      h('div', { class: 'tb-group' },
        segmented([['orbit', '🛰 Orbit'], ['walk', '🚶 Walk']], s.mode, (v) => { view.setMode(v); hint.style.display = v === 'walk' ? '' : 'none'; render(); })),
      h('div', { class: 'tb-group' },
        segmented(Object.entries(SCENARIOS).map(([k, v]) => [k, { day: '☀️ ', golden: '🌇 ', overcast: '☁️ ', night: '🌙 ' }[k] + v.label]), s.scenario, (v) => set({ scenario: v }))),
      h('div', { class: 'tb-group' },
        h('span', { class: 'tb-label' }, 'Lights'),
        segmented([['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], s.lights, (v) => set({ lights: v }))),
      h('div', { class: 'tb-group' },
        tempSwatch,
        h('input', { type: 'range', min: 2200, max: 6500, step: 100, value: s.temp, title: 'Bulb colour temperature', oninput: (e) => { s.temp = +e.target.value; view.applyLighting(); tempLabel.textContent = s.temp + ' K'; const [r2, g2, b2] = kelvinToRGB(s.temp); tempSwatch.style.background = `rgb(${r2 * 255 | 0},${g2 * 255 | 0},${b2 * 255 | 0})`; } }),
        tempLabel,
        ...[[2700, 'Warm'], [4000, 'Neutral'], [6000, 'Cool']].map(([k, l]) => h('button', { class: 'btn tiny' + (s.temp === k ? ' active' : ''), onclick: () => set({ temp: k }) }, l))),
      h('div', { class: 'tb-group' },
        h('button', { class: 'btn small', onclick: () => (more.hidden = !more.hidden) }, '⚙ More'),
        h('button', { class: 'btn small', onclick: compare, title: 'Render this view under 4 lighting setups' }, '◐ Compare'),
        h('button', { class: 'btn small', onclick: snapshot, title: 'Save a PNG of this view' }, '📸')),
    );
    tempLabel.textContent = s.temp + ' K';
    more.replaceChildren(
      rangeField('Light brightness', s.brightness, 0.2, 3, 0.05, (v) => { s.brightness = v; view.applyLighting(); }, (v) => `${Math.round(v * 100)}%`),
      rangeField('Exposure', s.exposure, 0.3, 2.5, 0.05, (v) => { s.exposure = v; view.applyLighting(); }, (v) => v.toFixed(2)),
      rangeField('Sun direction', s.sunAz, 0, 360, 5, (v) => { s.sunAz = v; view.applyLighting(); }, (v) => `${v}°`),
      rangeField('Doors open', s.doorAngle, 0, 90, 5, (v) => view.setState({ doorAngle: v }), (v) => `${v}°`, true),
      field('Tone mapping', select({ neutral: 'Neutral (true colour)', aces: 'ACES filmic', agx: 'AgX', none: 'None' }, s.tone, (v) => set({ tone: v }))),
      field('Ceilings', select({ auto: 'Auto (hidden in orbit)', show: 'Always show', hide: 'Always hide' }, s.ceilings, (v) => set({ ceilings: v }))),
      h('label', { class: 'check-line' }, h('input', { type: 'checkbox', checked: s.cutaway, onchange: (e) => set({ cutaway: e.target.checked }) }), 'Cut walls at 1.2 m (orbit)'),
      h('label', { class: 'check-line' }, h('input', { type: 'checkbox', checked: s.shadows, onchange: (e) => set({ shadows: e.target.checked }) }), 'Shadows'),
      h('button', { class: 'btn small', onclick: () => view.frameAll() }, 'Reset camera'),
    );
  }
  const tempLabel = h('span', { class: 'tb-value' });
  const more = h('div', { class: 'tb-more', hidden: true });
  document.getElementById('view-pane').append(more);
  render();

  async function compare() {
    const presets = [
      { label: '☀️ Day', state: { scenario: 'day', lights: 'off' } },
      { label: '🌇 Sunset + 2700 K', state: { scenario: 'golden', lights: 'on', temp: 2700 } },
      { label: '🌙 Night · warm 2700 K', state: { scenario: 'night', lights: 'on', temp: 2700 } },
      { label: '🌙 Night · cool 6000 K', state: { scenario: 'night', lights: 'on', temp: 6000 } },
    ];
    toast('Rendering lighting comparison…', 1200);
    const canvas = await view.compareLighting(presets);
    const img = h('img', { src: canvas.toDataURL('image/jpeg', 0.92), class: 'compare-img' });
    modal({
      title: 'Lighting comparison', wide: true,
      body: h('div', {}, img, h('p', { class: 'muted small' }, 'Same camera and finishes under four lighting setups. Colours are rendered with neutral tone mapping by default for faithful hue.')),
      buttons: [{ label: 'Download', class: 'primary', onClick: () => { const a = h('a', { href: img.src, download: 'lighting-comparison.jpg' }); a.click(); } }],
    });
  }
  function snapshot() {
    const a = h('a', { href: view.snapshot(), download: `${store.plan.name || 'view'}.png` });
    a.click();
  }
}

// ================================================================= widgets
function section(title, ...children) {
  return h('section', { class: 'section' }, h('h4', {}, title), ...children);
}
function header(kind, name) {
  return h('div', { class: 'prop-head' }, h('span', { class: 'kind' }, kind), h('h3', {}, name));
}
function field(label, input) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-input' }, input));
}
function numField(label, value, onChange, unit) {
  const inp = h('input', { type: 'number', value: Math.round(value * 10) / 10, step: 1, onchange: (e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); } });
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-input' }, inp, unit ? h('span', { class: 'unit' }, unit) : null));
}
function rangeField(label, value, min, max, step, onInput, fmt, commitOnly = false) {
  const val = h('span', { class: 'unit' }, fmt(value));
  const inp = h('input', { type: 'range', min, max, step, value });
  inp.addEventListener(commitOnly ? 'change' : 'input', (e) => { const v = +e.target.value; val.textContent = fmt(v); onInput(v); });
  if (commitOnly) inp.addEventListener('input', (e) => (val.textContent = fmt(+e.target.value)));
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-input' }, inp, val));
}
function select(options, value, onChange) {
  return h('select', { onchange: (e) => onChange(e.target.value) }, ...Object.entries(options).map(([k, v]) => h('option', { value: k, selected: String(k) === String(value) }, v)));
}
function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'seg' });
  wrap.append(...options.map(([k, l]) => h('button', {
    class: k === value ? 'active' : '', 'data-v': k,
    onclick: () => { wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === k)); onChange(k); },
  }, l)));
  return wrap;
}
function slotRow(label, matId, { cat = 'all', apply, clear, inherited = false, focus = false, title } = {}) {
  const def = getMaterialDef(store.plan, matId);
  return h('div', { class: 'slot-row' + (focus ? ' focused' : '') },
    h('button', {
      class: 'slot-btn',
      onclick: () => openPicker({ title: title || label, cat, current: matId, apply, clear, inheritLabel: 'Use inherited finish' }),
    },
    thumbImg(def, 40, 'mini'),
    h('span', { class: 'slot-text' }, h('span', { class: 'slot-label' }, label, inherited ? h('span', { class: 'badge' }, typeof inherited === 'string' ? inherited : 'global') : null), h('span', { class: 'slot-mat' }, def?.name || '—'))),
    clear ? h('button', { class: 'icon-btn small', title: 'Reset to inherited', onclick: clear }, '↺') : null);
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
}

export { openPhotoTile, uid, deepClone };
