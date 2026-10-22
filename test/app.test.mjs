import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadView, locate, windyNumericId, toggleGroup } from '../public/js/app.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/windy-list.json', import.meta.url)));
// Windy fixture cam is at 38.2, 13.32
const bounds = { north: 39, south: 37, east: 16, west: 12 };
const nearOsm = { id: 'osm:node/1', source: 'osm', name: 'a', place: '', lat: 38.2006, lon: 13.32, thumb: null, preview: null, player: null, page: 'https://a' };
const farOsm = { ...nearOsm, id: 'osm:node/2', lat: 37.5, lon: 15.08 };
const okWindy = async () => ({ ok: true, status: 200, json: async () => fixture });

test('loadView merges, dedupes and sorts by distance', async () => {
  const r = await loadView(bounds, { lat: 37.5, lon: 15.08 }, { key: 'K', fetch: okWindy, osmCams: [nearOsm, farOsm] });
  assert.deepEqual(r.cams.map(c => c.id), ['osm:node/2', 'windy:1234']);
  assert.equal(r.windyError, null);
  assert.equal(r.total, 2);
});

test('loadView with bad key returns OSM only and auth error', async () => {
  const bad = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const r = await loadView(bounds, { lat: 38, lon: 13 }, { key: 'bad', fetch: bad, osmCams: [nearOsm, farOsm] });
  assert.equal(r.windyError, 'auth');
  assert.deepEqual(r.cams.map(c => c.source), ['osm', 'osm']);
});

test('loadView with network error returns OSM and net', async () => {
  const down = async () => { throw new Error('offline'); };
  const r = await loadView(bounds, { lat: 38, lon: 13 }, { key: 'K', fetch: down, osmCams: [farOsm] });
  assert.equal(r.windyError, 'net');
  assert.equal(r.cams.length, 1);
});

test('loadView without key makes no Windy call', async () => {
  let calls = 0;
  const f = async () => { calls++; return okWindy(); };
  const r = await loadView(bounds, { lat: 38, lon: 13 }, { key: null, fetch: f, osmCams: [farOsm] });
  assert.equal(calls, 0);
  assert.equal(r.windyError, null);
});

test('locate returns null when permission denied', async () => {
  const geo = { getCurrentPosition: (_ok, err) => err({ code: 1 }) };
  assert.equal(await locate(geo), null);
});

test('locate returns null when no geolocation', async () => {
  assert.equal(await locate(undefined), null);
});

test('locate returns position', async () => {
  const geo = { getCurrentPosition: (ok) => ok({ coords: { latitude: 37.5, longitude: 15.1 } }) };
  assert.deepEqual(await locate(geo), { lat: 37.5, lon: 15.1 });
});

test('locate times out after 10s', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const p = locate({ getCurrentPosition: () => {} });
    mock.timers.tick(10000);
    assert.equal(await p, null);
  } finally {
    mock.timers.reset();
  }
});

test('windyNumericId', () => {
  assert.equal(windyNumericId('windy:1234'), 1234);
  assert.equal(windyNumericId('osm:node/1'), null);
});

const roadCam = { ...fixture.webcams[0], webcamId: 77, categories: [{ id: 'traffic' }] };
const mixed = { total: 2, webcams: [fixture.webcams[0], roadCam] };
function recFetch(body) {
  const urls = [];
  const f = async (u) => { urls.push(String(u)); return { ok: true, status: 200, json: async () => body }; };
  f.urls = urls;
  return f;
}
const all = { windy: true, osm: true, road: true };

test('groups: all on shows windy, road and osm', async () => {
  const f = recFetch(mixed);
  const r = await loadView(bounds, { lat: 38, lon: 13 }, { key: 'K', fetch: f, osmCams: [farOsm], groups: all });
  assert.deepEqual(r.cams.map(c => c.id).sort(), ['osm:node/2', 'windy:1234', 'windy:77']);
  assert.ok(!f.urls[0].includes('categories='));
});

test('groups: only road asks Windy for traffic and skips OSM', async () => {
  const f = recFetch({ total: 1, webcams: [roadCam] });
  const r = await loadView(bounds, { lat: 38, lon: 13 }, { key: 'K', fetch: f, osmCams: [farOsm], groups: { windy: false, osm: false, road: true } });
  assert.ok(f.urls[0].includes('categories=traffic'));
  assert.deepEqual(r.cams.map(c => c.id), ['windy:77']);
});

test('groups: windy without road drops road webcams', async () => {
  const f = recFetch(mixed);
  const r = await loadView(bounds, { lat: 38, lon: 13 }, { key: 'K', fetch: f, osmCams: [farOsm], groups: { windy: true, osm: false, road: false } });
  assert.deepEqual(r.cams.map(c => c.id), ['windy:1234']);
});

test('groups: only osm makes no Windy call', async () => {
  const f = recFetch(mixed);
  const r = await loadView(bounds, { lat: 38, lon: 13 }, { key: 'K', fetch: f, osmCams: [farOsm], groups: { windy: false, osm: true, road: false } });
  assert.equal(f.urls.length, 0);
  assert.deepEqual(r.cams.map(c => c.id), ['osm:node/2']);
});

test('toggleGroup keeps at least one group on', () => {
  assert.deepEqual(toggleGroup(all, 'osm'), { windy: true, osm: false, road: true });
  const one = { windy: false, osm: true, road: false };
  assert.deepEqual(toggleGroup(one, 'osm'), one);
});
