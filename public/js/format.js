// Testi brevi per righe e dettaglio. Mai "null" o "NaN" a schermo.

const DASH = '—';
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const ok = (n) => typeof n === 'number' && Number.isFinite(n);

export function fmtTemp(n) {
  return ok(n) ? `${Math.round(n)}°` : DASH;
}

export function dirName(deg) {
  return ok(deg) ? SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] : '';
}

export function fmtWind(kmh, deg) {
  if (!ok(kmh)) return DASH;
  return `${Math.round(kmh)} km/h ${dirName(deg)}`.trim();
}

export function fmtWave(m) {
  return ok(m) ? `${m.toFixed(1).replace('.', ',')} m` : null;
}

export function fmtRain(pct) {
  return ok(pct) ? `${Math.round(pct)}%` : DASH;
}

export function rowSummary(c) {
  if (!c) return DASH;
  const parts = [fmtTemp(c.temp), fmtWind(c.wind, c.windDir)];
  const wave = fmtWave(c.wave);
  if (wave) parts.push(`onde ${wave}`);
  if (ok(c.rainPct)) parts.push(`pioggia ${fmtRain(c.rainPct)}`);
  return parts.join(' · ');
}

const HHMM = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

// Età dell'immagine: distingue una webcam viva da una ferma.
export function fmtUpdated(iso, now = Date.now()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 60) return `Aggiornata ${min} min fa`;
  if (min < 24 * 60) return `Aggiornata alle ${HHMM.format(t)}`;
  const days = Math.floor(min / (24 * 60));
  return `Ferma da ${days} ${days === 1 ? 'giorno' : 'giorni'}`;
}
