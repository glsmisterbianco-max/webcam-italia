// Pannello di dettaglio di una webcam.

import { escapeHtml } from './list.js';
import { fmtTemp, fmtWind, fmtWave, fmtRain, dirName } from './format.js';

function conditionsHtml(cond) {
  if (!cond) return '<p class="muted">Meteo non disponibile al momento.</p>';
  const cells = [
    ['Aria', fmtTemp(cond.temp)],
    ['Vento', fmtWind(cond.wind, cond.windDir)],
    ['Pioggia', fmtRain(cond.rainPct)],
  ];
  const wave = fmtWave(cond.wave);
  if (wave) cells.push(['Onde', `${wave} ${dirName(cond.waveDir)}`.trim()]);
  if (cond.seaTemp !== null && cond.seaTemp !== undefined) cells.push(['Mare', fmtTemp(cond.seaTemp)]);
  const stats = cells
    .map(([k, v]) => `<div class="stat"><b>${escapeHtml(v)}</b><span>${k}</span></div>`)
    .join('');
  const hours = (cond.rainNext || [])
    .map((h) => `<div><span>${escapeHtml(h.time.slice(11, 16))}</span><b>${escapeHtml(fmtRain(h.pct))}</b></div>`)
    .join('');
  return `<div class="stats">${stats}</div>` +
    (hours ? `<div class="rain-next"><div class="label">Pioggia prossime ore</div><div class="hours">${hours}</div></div>` : '');
}

export function openDetail(el, cam, cond, { isFav, onToggleFav, onImageError, onClose }) {
  const isWindy = cam.source === 'windy';
  const media = isWindy && cam.preview
    ? `<img class="preview" src="${escapeHtml(cam.preview)}" alt="Immagine della webcam">`
    : `<div class="preview preview-empty">📷<p>${isWindy ? 'Immagine non disponibile' : 'Questa webcam si guarda sul sito di chi la pubblica'}</p></div>`;
  const live = cam.page
    ? `<a class="btn ${isWindy ? '' : 'btn-primary'}" href="${escapeHtml(cam.page)}" target="_blank" rel="noopener">Guarda dal vivo</a>`
    : '';
  const timelapse = isWindy && cam.player ? `<button class="btn" data-act="timelapse">Timelapse</button>` : '';

  el.innerHTML = `
    <div class="detail-head">
      <button class="icon-btn" data-act="close" aria-label="Chiudi">✕</button>
      <div class="detail-title"><h2>${escapeHtml(cam.name)}</h2>
        ${cam.place ? `<div class="muted">${escapeHtml(cam.place)}</div>` : ''}</div>
      <button class="icon-btn fav" data-act="fav" aria-label="Preferito">${isFav ? '★' : '☆'}</button>
    </div>
    <div class="media">${media}</div>
    <div class="actions">${timelapse}${live}</div>
    ${conditionsHtml(cond)}
    <p class="attrib">${isWindy ? 'Webcam: <a href="https://www.windy.com/webcams" target="_blank" rel="noopener">Windy.com</a> · ' : ''}Meteo: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo.com</a></p>`;
  el.hidden = false;
  el.classList.add('open');

  const img = el.querySelector('img.preview');
  if (img) {
    let retried = false;
    img.addEventListener('error', () => {
      if (retried) return;
      retried = true;
      onImageError(cam);
    });
  }
  el.querySelector('[data-act="close"]').addEventListener('click', onClose);
  el.querySelector('[data-act="fav"]').addEventListener('click', (e) => {
    e.currentTarget.textContent = onToggleFav(cam) ? '★' : '☆';
  });
  const tl = el.querySelector('[data-act="timelapse"]');
  if (tl) {
    tl.addEventListener('click', () => {
      el.querySelector('.media').innerHTML =
        `<iframe class="preview" src="${escapeHtml(cam.player)}" loading="lazy" allowfullscreen title="Timelapse"></iframe>`;
    });
  }
}

// Sostituisce l'immagine dopo un nuovo recupero; se manca ancora mostra il messaggio.
export function updateImage(el, url) {
  const media = el.querySelector('.media');
  if (!media) return;
  if (!url) {
    media.innerHTML = '<div class="preview preview-empty">📷<p>Immagine non disponibile</p></div>';
    return;
  }
  const img = document.createElement('img');
  img.className = 'preview';
  img.alt = 'Immagine della webcam';
  img.addEventListener('error', () => updateImage(el, null), { once: true });
  img.src = url;
  media.replaceChildren(img);
}

export function closeDetail(el) {
  el.classList.remove('open');
  el.hidden = true;
  el.innerHTML = '';
}
