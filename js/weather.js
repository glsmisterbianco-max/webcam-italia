// Condizioni meteo-marine da Open-Meteo (gratuito, senza chiave).
// Una chiamata forecast e una marine per tutti i punti non in cache.

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const MARINE = 'https://marine-api.open-meteo.com/v1/marine';
const TTL = 10 * 60 * 1000;
const TIMEOUT_MS = 8000;
const cache = new Map(); // pointKey -> { at, value }

export const pointKey = (p) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const asArray = (d) => (Array.isArray(d) ? d : [d]);

async function getJson(fetch, url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error('Open-Meteo HTTP ' + res.status);
  return res.json();
}

function fromForecast(f) {
  const cur = f?.current || {};
  const times = f?.hourly?.time || [];
  const probs = f?.hourly?.precipitation_probability || [];
  const rainNext = times.slice(0, 6).map((time, i) => ({ time, pct: num(probs[i]) ?? 0 }));
  const first3 = probs.slice(0, 3).map(num).filter((v) => v !== null);
  return {
    temp: num(cur.temperature_2m),
    wind: num(cur.wind_speed_10m),
    windDir: num(cur.wind_direction_10m),
    rainPct: first3.length ? Math.max(...first3) : null,
    rainNext,
  };
}

function fromMarine(m) {
  const cur = m?.current || {};
  return {
    wave: num(cur.wave_height),
    waveDir: num(cur.wave_direction),
    seaTemp: num(cur.sea_surface_temperature),
  };
}

export async function fetchConditions(points, { fetch, now = Date.now }) {
  const out = new Map();
  const todo = [];
  for (const p of points) {
    const k = pointKey(p);
    const hit = cache.get(k);
    if (hit && now() - hit.at < TTL) out.set(k, hit.value);
    else if (!todo.some((t) => pointKey(t) === k)) todo.push(p);
  }
  if (!todo.length) return out;

  const lat = todo.map((p) => p.lat.toFixed(2)).join(',');
  const lon = todo.map((p) => p.lon.toFixed(2)).join(',');
  const coords = `latitude=${lat}&longitude=${lon}`;
  const [fc, mr] = await Promise.allSettled([
    getJson(
      fetch,
      `${FORECAST}?${coords}&current=temperature_2m,wind_speed_10m,wind_direction_10m` +
        `&hourly=precipitation_probability&forecast_hours=6&timezone=Europe%2FRome`
    ),
    getJson(fetch, `${MARINE}?${coords}&current=wave_height,wave_direction,sea_surface_temperature`),
  ]);
  const fcList = fc.status === 'fulfilled' ? asArray(fc.value) : null;
  const mrList = mr.status === 'fulfilled' ? asArray(mr.value) : null;

  todo.forEach((p, i) => {
    const k = pointKey(p);
    if (!fcList || !fcList[i]) {
      out.set(k, null); // non in cache: si riprova al prossimo giro
      return;
    }
    const sea = mrList?.[i] ? fromMarine(mrList[i]) : { wave: null, waveDir: null, seaTemp: null };
    const value = { ...fromForecast(fcList[i]), ...sea };
    cache.set(k, { at: now(), value });
    out.set(k, value);
  });
  return out;
}
