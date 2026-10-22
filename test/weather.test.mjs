import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchConditions, pointKey } from '../public/js/weather.js';

const p1 = { lat: 38.2, lon: 13.32 };
const p2 = { lat: 45.46, lon: 9.19 };

function fc(temp, rain = [0, 0, 0, 0, 0, 0]) {
  return {
    current: { temperature_2m: temp, wind_speed_10m: 10, wind_direction_10m: 90 },
    hourly: { time: rain.map((_, i) => `2026-10-22T1${i}:00`), precipitation_probability: rain },
  };
}
function mar(wave) {
  return { current: { wave_height: wave, wave_direction: wave == null ? null : 300, sea_surface_temperature: wave == null ? null : 23 } };
}
function fakeFetch(route) {
  const calls = [];
  const fn = async (url) => {
    calls.push(String(url));
    const body = route(String(url));
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

test('two points: coastal and inland', async () => {
  const f = fakeFetch((u) => (u.includes('marine') ? [mar(0.6), mar(null)] : [fc(22), fc(15)]));
  const m = await fetchConditions([p1, p2], { fetch: f, now: () => 1 });
  assert.equal(f.calls.length, 2);
  assert.equal(m.get(pointKey(p1)).wave, 0.6);
  assert.equal(m.get(pointKey(p1)).seaTemp, 23);
  assert.equal(m.get(pointKey(p2)).wave, null);
  assert.equal(m.get(pointKey(p2)).temp, 15);
  assert.ok(f.calls[0].includes('latitude=38.20,45.46') || f.calls[1].includes('latitude=38.20,45.46'));
});

test('rainPct is max of first 3 hours, rainNext has 6', async () => {
  const f = fakeFetch((u) => (u.includes('marine') ? mar(0.5) : fc(20, [10, 40, 20, 90, 0, 0])));
  const c = (await fetchConditions([{ lat: 40, lon: 14 }], { fetch: f, now: () => 1 })).get('40.00,14.00');
  assert.equal(c.rainPct, 40);
  assert.equal(c.rainNext.length, 6);
  assert.deepEqual(c.rainNext[3], { time: '2026-10-22T13:00', pct: 90 });
});

test('forecast failure gives null, no throw', async () => {
  const f = fakeFetch(() => new Error('offline'));
  const m = await fetchConditions([{ lat: 41, lon: 12 }], { fetch: f, now: () => 1 });
  assert.equal(m.get('41.00,12.00'), null);
});

test('marine failure keeps forecast values', async () => {
  const f = fakeFetch((u) => (u.includes('marine') ? new Error('down') : fc(19)));
  const c = (await fetchConditions([{ lat: 42, lon: 12 }], { fetch: f, now: () => 1 })).get('42.00,12.00');
  assert.equal(c.temp, 19);
  assert.equal(c.wave, null);
});

test('cache 10 minutes', async () => {
  let t = 1000;
  const f = fakeFetch((u) => (u.includes('marine') ? mar(1) : fc(18)));
  const pt = { lat: 43, lon: 11 };
  await fetchConditions([pt], { fetch: f, now: () => t });
  t += 9 * 60 * 1000;
  await fetchConditions([pt], { fetch: f, now: () => t });
  assert.equal(f.calls.length, 2);
  t += 2 * 60 * 1000;
  await fetchConditions([pt], { fetch: f, now: () => t });
  assert.equal(f.calls.length, 4);
});
