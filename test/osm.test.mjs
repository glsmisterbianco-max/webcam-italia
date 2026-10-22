import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOverpass, checkLinks } from '../scripts/build-osm.mjs';
import { loadOsm, osmInBounds } from '../public/js/osm.js';

const overpass = {
  elements: [
    { type: 'node', id: 1, lat: 37.5, lon: 15.1, tags: { name: 'Lido Azzurro', 'contact:webcam': 'https://lido.example/cam', 'addr:city': 'Catania' } },
    { type: 'way', id: 2, center: { lat: 38.1, lon: 13.4 }, tags: { webcam: 'http://porto.example/live' } },
    { type: 'node', id: 3, lat: 40, lon: 14, tags: { 'contact:webcam': 'ftp://old.example/cam.jpg' } },
    { type: 'node', id: 4, lat: 41, lon: 12, tags: { name: 'Nessun link' } },
  ],
};

test('parseOverpass keeps http(s) webcams and maps fields', () => {
  const cams = parseOverpass(overpass);
  assert.deepEqual(cams.map(c => c.id), ['osm:node/1', 'osm:way/2']);
  assert.deepEqual(cams[0], {
    id: 'osm:node/1', source: 'osm', name: 'Lido Azzurro', place: 'Catania', lat: 37.5, lon: 15.1,
    thumb: null, preview: null, player: null, page: 'https://lido.example/cam',
  });
  assert.equal(cams[1].name, 'Webcam');
  assert.equal(cams[1].lat, 38.1);
});

test('checkLinks keeps reachable pages only', async () => {
  const cams = ['ok', 'dead', 'slow', 'nohead'].map((n) => ({ id: n, page: `https://${n}.example/` }));
  const fetch = (url, opts = {}) => {
    const host = new URL(url).hostname.split('.')[0];
    const method = opts.method || 'GET';
    if (host === 'ok') return Promise.resolve({ status: 200 });
    if (host === 'dead') return Promise.resolve({ status: 404 });
    if (host === 'nohead') return Promise.resolve({ status: method === 'HEAD' ? 405 : 200 });
    return new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new Error('abort'))));
  };
  const kept = await checkLinks(cams, { fetch, timeoutMs: 50 });
  assert.deepEqual(kept.map(c => c.id).sort(), ['nohead', 'ok']);
});

test('osmInBounds filters', () => {
  const cams = parseOverpass(overpass);
  assert.deepEqual(osmInBounds(cams, { north: 38, south: 37, east: 16, west: 14 }).map(c => c.id), ['osm:node/1']);
});

test('loadOsm returns [] on error', async () => {
  const cams = await loadOsm({ fetch: async () => { throw new Error('offline'); }, url: 'x-fail.json' });
  assert.deepEqual(cams, []);
});
