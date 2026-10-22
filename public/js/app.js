// Orchestrazione: mappa, lista, dettaglio, ricerca, posizione, preferiti, chiave.

import { dedupe, sortByDistance, inBounds } from './geo.js';
import { fetchWindyInBounds, fetchWindyById, WindyAuthError } from './windy.js';
import { loadOsm, osmInBounds } from './osm.js';
import { fetchConditions, pointKey } from './weather.js';
import { searchPlaces } from './geocode.js';
import { createFavorites } from './favorites.js';
import { createSettings } from './settings.js';
import { escapeHtml, renderList } from './list.js';
import { openDetail, updateImage, closeDetail } from './detail.js';
import { createMap } from './map.js';

const MAX_WINDY = 200;
const METEO_ROWS = 30;

export function windyNumericId(id) {
  const m = /^windy:(\d+)$/.exec(id || '');
  return m ? Number(m[1]) : null;
}

export async function loadView(bounds, center, { key, fetch, osmCams, maxWindy = MAX_WINDY, roadOnly = false }) {
  let windy = { cams: [], total: 0 };
  let windyError = null;
  try {
    windy = await fetchWindyInBounds(bounds, { key, fetch, max: maxWindy, roadOnly });
  } catch (e) {
    windyError = e instanceof WindyAuthError ? 'auth' : 'net';
  }
  // OSM non distingue le webcam stradali: in modalità strade restano fuori.
  const osm = roadOnly ? [] : osmInBounds(osmCams, bounds);
  const cams = sortByDistance(dedupe([...windy.cams, ...osm]), center);
  return { cams, total: windy.total, windyError };
}

export function locate(geolocation, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!geolocation) return resolve(null);
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      geolocation.getCurrentPosition(
        (p) => finish({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => finish(null),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
      );
    } catch {
      finish(null);
    }
  });
}

async function init() {
  const $ = (s) => document.querySelector(s);
  const fetch = window.fetch.bind(window);
  const settings = createSettings(localStorage);
  const favorites = createFavorites(localStorage);
  const listEl = $('#list');
  const detailEl = $('#detail');
  const banner = $('#banner');

  let mode = 'area'; // 'area' | 'fav'
  let roadOnly = false; // solo webcam di strade e autostrade
  let userPos = null;
  let seq = 0;
  let current = []; // cam visibili nella lista
  let lastRefresh = 0;
  const conds = new Map(); // pointKey -> Conditions|null

  // --- banner e chiave ---------------------------------------------------
  let bannerTimer = null;
  let lastWindyError = null;
  function showBanner(text, { sticky = false, onClick = null } = {}) {
    clearTimeout(bannerTimer);
    bannerTimer = null;
    banner.textContent = text;
    banner.hidden = false;
    banner.onclick = onClick;
    if (!sticky) {
      bannerTimer = setTimeout(() => {
        bannerTimer = null;
        updateKeyBanner(lastWindyError);
      }, 5000);
    }
  }
  function updateKeyBanner(windyError) {
    lastWindyError = windyError;
    if (bannerTimer) return; // un avviso temporaneo è ancora visibile
    if (!settings.getWindyKey() || windyError === 'auth') {
      showBanner('Chiave Windy mancante o non valida — tocca per inserirla', { sticky: true, onClick: openKeybox });
    } else {
      banner.hidden = true;
      banner.onclick = null;
    }
  }
  function openKeybox() {
    $('#keyinput').value = settings.getWindyKey() || '';
    $('#keybox').hidden = false;
    $('#keyinput').focus();
  }
  $('#keycancel').addEventListener('click', () => ($('#keybox').hidden = true));
  $('#keyform').addEventListener('submit', (e) => {
    e.preventDefault();
    settings.setWindyKey($('#keyinput').value);
    $('#keybox').hidden = true;
    refresh();
  });

  // --- lista --------------------------------------------------------------
  function render(header) {
    renderList(
      listEl,
      current.map((cam) => ({ cam, cond: conds.get(pointKey(cam)) ?? null, isFav: favorites.has(cam.id) })),
      { onSelect: showDetail, header }
    );
  }
  async function loadConditions(mySeq, header) {
    const pts = current.slice(0, METEO_ROWS);
    if (!pts.length) return;
    const got = await fetchConditions(pts, { fetch });
    if (mySeq !== seq) return;
    got.forEach((v, k) => conds.set(k, v));
    render(header);
  }

  // --- vista mappa ----------------------------------------------------------
  const osmCams = await loadOsm({ fetch });
  const map = createMap($('#map'), { onMoveEnd: () => refresh(), onSelect: showDetail });

  async function refresh() {
    if (mode !== 'area') return;
    const mySeq = ++seq;
    const bounds = map.getBounds();
    const center = map.getCenter();
    const key = settings.getWindyKey();
    const near = userPos && inBounds(userPos, bounds) ? userPos : center;
    if (key && !roadOnly) {
      // Le webcam OSM sono già in memoria: si mostrano subito, Windy arriva dopo.
      current = sortByDistance(osmInBounds(osmCams, bounds), near);
      map.setCams(current);
      render('Caricamento webcam…');
    }
    const r = await loadView(bounds, near, {
      key, fetch, osmCams, roadOnly,
    });
    if (mySeq !== seq) return;
    current = r.cams;
    map.setCams(current);
    const shownWindy = current.filter((c) => c.source === 'windy').length;
    let header;
    if (r.total > shownWindy && r.total > MAX_WINDY) {
      header = `Mostrate ${current.length} webcam — avvicina la mappa per vederle tutte (${r.total} Windy in zona)`;
    } else if (userPos && inBounds(userPos, bounds)) {
      header = `Vicino a te · ${current.length} webcam`;
    } else {
      header = `In questa zona · ${current.length} webcam`;
    }
    if (roadOnly) {
      header = key
        ? `Strade e autostrade · ${current.length} webcam`
        : 'Strade e autostrade: serve la chiave Windy (tocca la striscia gialla)';
    }
    if (r.windyError === 'net') header += ' · Windy non raggiungibile';
    lastRefresh = Date.now();
    updateKeyBanner(r.windyError);
    render(header);
    loadConditions(mySeq, header);
  }

  // --- dettaglio --------------------------------------------------------------
  async function showDetail(cam) {
    if (!cam) return;
    const key = settings.getWindyKey();
    const wid = windyNumericId(cam.id);
    if (wid && !cam.preview && key) {
      cam = (await fetchWindyById(wid, { key, fetch }).catch(() => null)) || cam;
    }
    const cond = (await fetchConditions([cam], { fetch })).get(pointKey(cam)) ?? null;
    conds.set(pointKey(cam), cond);
    openDetail(detailEl, cam, cond, {
      isFav: favorites.has(cam.id),
      onToggleFav: (c) => {
        const now = favorites.toggle(c);
        if (mode === 'fav') showFavorites();
        else render(listEl.querySelector('.list-header')?.textContent);
        return now;
      },
      onImageError: async (c) => {
        const fresh = wid && key ? await fetchWindyById(wid, { key, fetch }).catch(() => null) : null;
        updateImage(detailEl, fresh?.preview || null);
      },
      onClose: hideDetail,
    });
    if (!history.state?.detail) history.pushState({ detail: true }, '');
  }
  function hideDetail() {
    if (history.state?.detail) history.back(); // popstate chiude il pannello
    else closeDetail(detailEl);
  }
  window.addEventListener('popstate', () => {
    if (!detailEl.hidden) closeDetail(detailEl);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !detailEl.hidden) hideDetail();
  });

  // Riaperta dopo un po': immagini Windy scadute e meteo vecchio, si ricarica.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 10 * 60 * 1000) return;
    if (mode === 'fav') showFavorites();
    else refresh();
  });

  // --- preferiti ----------------------------------------------------------
  function showFavorites() {
    mode = 'fav';
    seq++;
    $('#btn-fav').classList.add('active');
    current = favorites.list();
    map.setCams(current);
    const header = current.length ? `Preferiti · ${current.length}` : 'Preferiti — nessuno ancora. Apri una webcam e tocca ☆';
    render(header);
    loadConditions(seq, header);
  }
  $('#btn-road').addEventListener('click', () => {
    roadOnly = !roadOnly;
    $('#btn-road').classList.toggle('active', roadOnly);
    if (mode === 'fav') {
      mode = 'area';
      $('#btn-fav').classList.remove('active');
    }
    // Le webcam stradali sono poche: si mostra tutta l'Italia.
    if (roadOnly) map.fitItaly();
    refresh();
  });
  $('#btn-fav').addEventListener('click', () => {
    if (mode === 'fav') {
      mode = 'area';
      $('#btn-fav').classList.remove('active');
      refresh();
    } else {
      showFavorites();
    }
  });

  // --- posizione ------------------------------------------------------------
  async function goToMe() {
    const pos = await locate(navigator.geolocation);
    if (pos) {
      userPos = pos;
      if (mode === 'fav') $('#btn-fav').click();
      map.flyTo(pos.lat, pos.lon, 11);
    } else {
      showBanner('Posizione non disponibile');
    }
    return pos;
  }
  $('#btn-locate').addEventListener('click', goToMe);

  // --- ricerca --------------------------------------------------------------
  const search = $('#search');
  const results = $('#results');
  let searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const q = search.value;
      const found = await searchPlaces(q, { fetch });
      if (q !== search.value) return;
      if (!found.length) {
        results.hidden = q.trim().length < 2;
        results.innerHTML = '<li>Nessun risultato</li>';
        return;
      }
      results.innerHTML = found
        .map((p, i) => `<li tabindex="0" data-i="${i}">${escapeHtml(p.name)}<small>${escapeHtml(p.detail)}</small></li>`)
        .join('');
      results.hidden = false;
      results.querySelectorAll('li[data-i]').forEach((li) =>
        li.addEventListener('click', () => {
          const p = found[Number(li.dataset.i)];
          results.hidden = true;
          search.value = p.name;
          search.blur();
          if (mode === 'fav') {
            mode = 'area';
            $('#btn-fav').classList.remove('active');
          }
          map.flyTo(p.lat, p.lon, 12);
        })
      );
    }, 300);
  });
  search.addEventListener('blur', () => setTimeout(() => (results.hidden = true), 200));

  // --- avvio ------------------------------------------------------------------
  // Si mostra subito l'Italia; quando arriva la posizione la mappa si sposta.
  updateKeyBanner(null);
  refresh();
  goToMe();
}

if (typeof document !== 'undefined') init();
