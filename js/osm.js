// Webcam OpenStreetMap: file statico generato da scripts/build-osm.mjs.

import { inBounds } from './geo.js';

const loaded = new Map(); // url -> Cam[]

export async function loadOsm({ fetch, url = 'data/osm-webcams.json' }) {
  if (loaded.has(url)) return loaded.get(url);
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const cams = Array.isArray(data) ? data : [];
    loaded.set(url, cams);
    return cams;
  } catch {
    return [];
  }
}

export function osmInBounds(cams, bounds) {
  return cams.filter((c) => inBounds(c, bounds));
}
