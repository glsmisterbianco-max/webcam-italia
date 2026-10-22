// Lista delle webcam sotto la mappa.

import { rowSummary } from './format.js';

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderRowHtml(cam, cond, isFav) {
  const thumb = cam.thumb
    ? `<img class="thumb" src="${escapeHtml(cam.thumb)}" alt="" loading="lazy">`
    : `<div class="thumb thumb-empty" aria-hidden="true">📷</div>`;
  const place = cam.place ? `<div class="row-place">${escapeHtml(cam.place)}</div>` : '';
  return (
    `<li class="row" data-id="${escapeHtml(cam.id)}" tabindex="0">${thumb}` +
    `<div class="row-text"><div class="row-name">${escapeHtml(cam.name)}` +
    `${isFav ? ' <span class="star">★</span>' : ''}</div>${place}` +
    `<div class="row-meteo">${escapeHtml(rowSummary(cond))}</div></div></li>`
  );
}

// rows: [{ cam, cond, isFav }]
export function renderList(el, rows, { onSelect, header }) {
  const body = rows.length
    ? rows.map((r) => renderRowHtml(r.cam, r.cond, r.isFav)).join('')
    : '<li class="empty">Nessuna webcam in questa zona. Allontana la mappa.</li>';
  el.innerHTML = `<div class="list-header">${escapeHtml(header || '')}</div><ul>${body}</ul>`;
  const byId = new Map(rows.map((r) => [r.cam.id, r.cam]));
  el.querySelectorAll('.row').forEach((li) => {
    const pick = () => onSelect(byId.get(li.dataset.id));
    li.addEventListener('click', pick);
    li.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
  });
}
