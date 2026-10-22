import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPlaces } from '../public/js/geocode.js';

function fakeFetch(body) {
  const calls = [];
  const fn = async (url) => { calls.push(String(url)); return { ok: true, status: 200, json: async () => body }; };
  fn.calls = calls;
  return fn;
}

test('url has countryCode and encoded name, maps fields', async () => {
  const f = fakeFetch({ results: [{ name: 'San Vito Lo Capo', admin1: 'Sicilia', admin2: 'Trapani', latitude: 38.17, longitude: 12.73 }] });
  const r = await searchPlaces('San Vito', { fetch: f });
  assert.ok(f.calls[0].includes('countryCode=IT'), f.calls[0]);
  assert.ok(f.calls[0].includes('name=San%20Vito'), f.calls[0]);
  assert.deepEqual(r, [{ name: 'San Vito Lo Capo', detail: 'Trapani, Sicilia', lat: 38.17, lon: 12.73 }]);
});

test('short query does not fetch', async () => {
  const f = fakeFetch({});
  assert.deepEqual(await searchPlaces(' a ', { fetch: f }), []);
  assert.equal(f.calls.length, 0);
});

test('missing results gives []', async () => {
  assert.deepEqual(await searchPlaces('Xyzzy', { fetch: fakeFetch({ generationtime_ms: 1 }) }), []);
});

test('network error gives []', async () => {
  assert.deepEqual(await searchPlaces('Roma', { fetch: async () => { throw new Error('x'); } }), []);
});
