// Client Windy Webcams API v3 (piano Free).
// Le URL delle immagini scadono dopo pochi minuti: si chiedono al momento.

const BASE = 'https://api.windy.com/webcams/api/v3/webcams';
const INCLUDE = 'categories,images,location,player,urls';
const PAGE = 50;

export class WindyAuthError extends Error {}

const TIMEOUT_MS = 8000;
const httpUrl = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null);

export function normalizeWindy(w) {
  const loc = w?.location || {};
  if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return null;
  if (w.status && w.status !== 'active') return null;
  const img = w.images?.current || {};
  return {
    id: 'windy:' + w.webcamId,
    source: 'windy',
    name: w.title || 'Webcam',
    place: [loc.city, loc.region].filter(Boolean).join(', '),
    lat: loc.latitude,
    lon: loc.longitude,
    thumb: httpUrl(img.thumbnail),
    preview: httpUrl(img.preview),
    player: httpUrl(w.player?.day) ?? httpUrl(w.player?.lifetime),
    page: httpUrl(w.urls?.detail),
    updated: w.lastUpdatedOn || null,
    road: (w.categories || []).some((c) => c?.id === 'traffic'),
  };
}

async function get(url, key, fetch) {
  const res = await fetch(url, {
    headers: { 'x-windy-api-key': key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403) throw new WindyAuthError('Chiave Windy non valida');
  if (!res.ok) throw new Error('Windy HTTP ' + res.status);
  return res.json();
}

export async function fetchWindyInBounds(bounds, { key, fetch, max = 200, roadOnly = false }) {
  if (!key) return { cams: [], total: 0 };
  // Virgole non codificate: è il formato che l'API si aspetta.
  const bbox = [bounds.north, bounds.east, bounds.south, bounds.west].join(',');
  const cams = [];
  let total = 0;
  for (let offset = 0; offset < max; offset += PAGE) {
    const url =
      `${BASE}?bbox=${bbox}&limit=${PAGE}&offset=${offset}&include=${INCLUDE}` +
      (roadOnly ? '&categories=traffic' : '');
    const data = await get(url, key, fetch);
    total = data.total ?? 0;
    for (const w of data.webcams || []) {
      const c = normalizeWindy(w);
      if (c) cams.push(c);
    }
    if (offset + PAGE >= total) break;
  }
  return { cams, total };
}

export async function fetchWindyById(id, { key, fetch }) {
  if (!key) return null;
  return normalizeWindy(await get(`${BASE}/${id}?include=${INCLUDE}`, key, fetch));
}
