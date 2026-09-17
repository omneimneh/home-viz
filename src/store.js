// Central app state: the plan, selection, undo/redo, persistence.
import { deepClone, debounce } from './util.js';
import { normalizePlan } from './plan/model.js';

const AUTOSAVE_KEY = 'homeviz.autosave.v1';
const SAVES_KEY = 'homeviz.saves.v1';

class Store extends EventTarget {
  constructor() {
    super();
    this.plan = null;
    this.selection = null; // {type:'wall'|'room'|'opening'|'item', id, focus?}
    this.undoStack = [];
    this.redoStack = [];
    this.saveSoon = debounce(() => this.autosave(), 600);
  }

  load(plan, { keepHistory = false } = {}) {
    this.plan = normalizePlan(deepClone(plan));
    this.selection = null;
    if (!keepHistory) { this.undoStack = []; this.redoStack = []; }
    this.emit('load');
    this.emit('change', { reason: 'load' });
    this.emit('select');
    this.saveSoon();
  }

  /** Snapshot for undo before a mutation. */
  checkpoint() {
    this.undoStack.push(JSON.stringify(this.plan));
    if (this.undoStack.length > 120) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Mutate the plan with an undo checkpoint and notify listeners. */
  update(fn, reason = 'edit') {
    this.checkpoint();
    fn(this.plan);
    this.changed(reason);
  }

  /** Notify without creating a checkpoint (for live drags after checkpoint()). */
  changed(reason = 'edit', live = false) {
    this.emit('change', { reason, live });
    if (!live) this.saveSoon();
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.plan));
    this.plan = JSON.parse(this.undoStack.pop());
    this.validateSelection();
    this.changed('undo');
  }
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.plan));
    this.plan = JSON.parse(this.redoStack.pop());
    this.validateSelection();
    this.changed('redo');
  }

  select(sel) {
    this.selection = sel;
    this.emit('select');
  }
  validateSelection() {
    const s = this.selection;
    if (s && !this.find(s.type, s.id)) this.select(null);
    else this.emit('select');
  }
  find(type, id) {
    const p = this.plan;
    const list = { wall: p.walls, room: p.rooms, opening: p.openings, item: p.items }[type];
    return list?.find((x) => x.id === id) || null;
  }
  selected() {
    return this.selection ? this.find(this.selection.type, this.selection.id) : null;
  }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  on(type, fn) {
    this.addEventListener(type, (e) => fn(e.detail));
  }

  // ---------- persistence ----------
  autosave() {
    try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.plan)); }
    catch (e) { console.warn('autosave failed (storage full?)', e); }
  }
  restore() {
    try {
      const s = localStorage.getItem(AUTOSAVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }
  listSaves() {
    try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]'); } catch { return []; }
  }
  saveAs(name) {
    const saves = this.listSaves().filter((s) => s.name !== name);
    this.plan.name = name;
    saves.unshift({ name, date: new Date().toISOString(), plan: this.plan });
    try {
      localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
      return true;
    } catch (e) {
      console.warn(e);
      return false;
    }
  }
  deleteSave(name) {
    localStorage.setItem(SAVES_KEY, JSON.stringify(this.listSaves().filter((s) => s.name !== name)));
  }
}

export const store = new Store();
