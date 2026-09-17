import { h } from '../util.js';

export function modal({ title, body, buttons = [], wide = false, onClose }) {
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const overlay = h('div', { class: 'modal-overlay', onmousedown: (e) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : '') },
      h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', onclick: close, title: 'Close' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      buttons.filter(Boolean).length ? h('div', { class: 'modal-foot' }, ...buttons.filter(Boolean).map((b) => h('button', { class: 'btn ' + (b.class || ''), onclick: b.onClick }, b.label))) : null));
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  return { close, el: overlay };
}

export function toast(msg, ms = 2600) {
  let host = document.getElementById('toasts');
  if (!host) { host = h('div', { id: 'toasts' }); document.body.append(host); }
  const t = h('div', { class: 'toast' }, msg);
  host.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}
