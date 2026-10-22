// Estrae da OpenStreetMap le webcam pubbliche in Italia e scrive
// public/data/osm-webcams.json. Si lancia a mano: npm run build:osm

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const UA = 'WebcamItalia/1.0 (uso personale)';
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const QUERY =
  '[out:json][timeout:180];area["ISO3166-1"="IT"][admin_level=2]->.a;' +
  '(nwr["contact:webcam"](area.a);nwr["webcam"](area.a);nwr["camera:url"](area.a););out center tags;';
const URL_TAGS = ['contact:webcam', 'webcam', 'camera:url', 'website'];

export function parseOverpass(json) {
  const out = [];
  for (const el of json?.elements || []) {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const page = URL_TAGS.map((t) => tags[t]).find(Boolean);
    if (!page || !/^https?:\/\//i.test(page)) continue;
    out.push({
      id: `osm:${el.type}/${el.id}`,
      source: 'osm',
      name: tags.name || 'Webcam',
      place: tags['addr:city'] || '',
      lat,
      lon,
      thumb: null,
      preview: null,
      player: null,
      page,
    });
  }
  return out;
}

async function status(fetch, url, method, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA },
    });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

async function reachable(fetch, url, timeoutMs) {
  const head = await status(fetch, url, 'HEAD', timeoutMs);
  if (head > 0 && head < 400) return true;
  const get = await status(fetch, url, 'GET', timeoutMs);
  return get > 0 && get < 400;
}

export async function checkLinks(cams, { fetch, concurrency = 8, timeoutMs = 8000 }) {
  const ok = new Array(cams.length).fill(false);
  let next = 0;
  async function worker() {
    while (next < cams.length) {
      const i = next++;
      ok[i] = await reachable(fetch, cams[i].page, timeoutMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cams.length) }, worker));
  return cams.filter((_, i) => ok[i]);
}

async function queryOverpass() {
  const waits = [5000, 10000, 20000];
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const ep of ENDPOINTS) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(QUERY),
        });
        if (res.ok) return await res.json();
        console.warn(`${ep}: HTTP ${res.status}`);
      } catch (e) {
        console.warn(`${ep}: ${e.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, waits[attempt]));
  }
  throw new Error('Overpass non raggiungibile');
}

async function main() {
  const outFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'osm-webcams.json');
  mkdirSync(dirname(outFile), { recursive: true });
  let cams = [];
  try {
    const found = parseOverpass(await queryOverpass());
    console.log(`Trovate su OSM: ${found.length}`);
    cams = await checkLinks(found, { fetch });
    console.log(`Con link funzionante: ${cams.length}`);
  } catch (e) {
    console.error(`Errore: ${e.message}. Scrivo un elenco vuoto.`);
  }
  cams.sort((a, b) => (a.id < b.id ? -1 : 1));
  writeFileSync(outFile, JSON.stringify(cams));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
