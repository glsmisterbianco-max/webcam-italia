import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeWindy, fetchWindyInBounds, fetchWindyById, WindyAuthError } from '../public/js/windy.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/windy-list.json', import.meta.url)));
const bounds = { north: 38, south: 37, east: 16, west: 14 };

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url: String(url), headers: opts.headers || {} });
    const { status = 200, body } = handler(String(url), calls.length - 1);
    return { ok: status < 400, status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

test('normalizeWindy maps fields', () => {
  assert.deepEqual(normalizeWindy(fixture.webcams[0]), {
    id: 'windy:1234', source: 'windy', name: 'Mondello: Spiaggia', place: 'Mondello, Sicilia',
    lat: 38.2, lon: 13.32, thumb: 'https://img/t.jpg', preview: 'https://img/p.jpg',
    player: 'https://player/day', page: 'https://www.windy.com/webcams/1234',
  });
});

test('normalizeWindy without coordinates is null', () => {
  assert.equal(normalizeWindy(fixture.webcams[1]), null);
});

test('fetchWindyInBounds builds bbox url and key header', async () => {
  const f = fakeFetch(() => ({ body: fixture }));
  const r = await fetchWindyInBounds(bounds, { key: 'K', fetch: f });
  assert.equal(f.calls.length, 1);
  const u = f.calls[0].url;
  assert.ok(u.includes('bbox=38,16,37,14'), u);
  assert.ok(u.includes('limit=50') && u.includes('offset=0'), u);
  assert.equal(f.calls[0].headers['x-windy-api-key'], 'K');
  assert.equal(r.cams.length, 1);
  assert.equal(r.total, 2);
});

function pageOf(total) {
  return () => ({
    body: { total, webcams: Array.from({ length: 50 }, (_, i) => ({ ...fixture.webcams[0], webcamId: i })) },
  });
}

test('pages by 50 until total', async () => {
  const f = fakeFetch(pageOf(120));
  await fetchWindyInBounds(bounds, { key: 'K', fetch: f });
  assert.deepEqual(f.calls.map(c => new URL(c.url).searchParams.get('offset')), ['0', '50', '100']);
});

test('pages stop at max', async () => {
  const f = fakeFetch(pageOf(120));
  await fetchWindyInBounds(bounds, { key: 'K', fetch: f, max: 100 });
  assert.equal(f.calls.length, 2);
});

test('no key means no network', async () => {
  const f = fakeFetch(() => ({ body: fixture }));
  assert.deepEqual(await fetchWindyInBounds(bounds, { key: null, fetch: f }), { cams: [], total: 0 });
  assert.equal(f.calls.length, 0);
});

test('401 throws WindyAuthError', async () => {
  const f = fakeFetch(() => ({ status: 401, body: {} }));
  await assert.rejects(fetchWindyInBounds(bounds, { key: 'bad', fetch: f }), WindyAuthError);
});

test('500 throws generic Error', async () => {
  const f = fakeFetch(() => ({ status: 500, body: {} }));
  await assert.rejects(fetchWindyInBounds(bounds, { key: 'K', fetch: f }), (e) => !(e instanceof WindyAuthError));
});

test('fetchWindyById', async () => {
  const f = fakeFetch(() => ({ body: fixture.webcams[0] }));
  const cam = await fetchWindyById(1234, { key: 'K', fetch: f });
  assert.ok(f.calls[0].url.includes('/webcams/1234?include=images,location,player,urls'), f.calls[0].url);
  assert.equal(cam.id, 'windy:1234');
});
