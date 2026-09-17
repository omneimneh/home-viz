import './style.css';
import { store } from './store.js';
import { Editor2D } from './editor2d.js';
import { View3D } from './view3d.js';
import { initUI, setLayout } from './ui/panels.js';
import { makeSample } from './plan/samples.js';

const editor = new Editor2D(document.getElementById('plan-pane'));
const view = new View3D(document.getElementById('view3d'));

const saved = store.restore();
store.load(saved && saved.walls ? saved : makeSample('one-plus-one'));
initUI(editor, view);
store.emit('load');

// keep the 2D walk marker in sync with the 3D camera
let lastMarker = '';
view.onRender = () => {
  const c = view.cameraPlan();
  const key = c.walk ? `${c.x | 0},${c.y | 0},${c.yaw.toFixed(2)}` : 'off';
  if (key !== lastMarker) {
    lastMarker = key;
    editor.cameraMarker = c;
    editor.draw();
  }
};
editor.onCameraMove = (x, y, yaw) => view.teleport(x, y, yaw);

window.homeviz = { store, editor, view, setLayout };
