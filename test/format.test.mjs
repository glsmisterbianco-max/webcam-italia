import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtTemp, fmtWind, fmtWave, fmtRain, rowSummary, fmtUpdated } from '../public/js/format.js';

test('fmtWind', () => {
  assert.equal(fmtWind(12, 315), '12 km/h NO');
  assert.equal(fmtWind(12.4, 0), '12 km/h N');
  assert.equal(fmtWind(20, 180), '20 km/h S');
  assert.equal(fmtWind(null, 10), '—');
});

test('fmtWave / fmtTemp / fmtRain', () => {
  assert.equal(fmtWave(0.6), '0,6 m');
  assert.equal(fmtWave(null), null);
  assert.equal(fmtTemp(24.4), '24°');
  assert.equal(fmtTemp(NaN), '—');
  assert.equal(fmtTemp(null), '—');
  assert.equal(fmtRain(30), '30%');
  assert.equal(fmtRain(null), '—');
});

const base = { temp: 24, wind: 12, windDir: 315, rainPct: 30, rainNext: [], wave: 0.6, waveDir: 300, seaTemp: 22 };

test('rowSummary with waves', () => {
  assert.equal(rowSummary(base), '24° · 12 km/h NO · onde 0,6 m · pioggia 30%');
});

test('rowSummary inland has no waves and no null text', () => {
  const s = rowSummary({ ...base, wave: null, seaTemp: null });
  assert.ok(!/onde|null|NaN|undefined/.test(s), s);
});

test('rowSummary(null) is a dash', () => {
  assert.equal(rowSummary(null), '—');
});

test('fmtUpdated', () => {
  const now = Date.parse('2026-10-22T13:40:00Z');
  assert.equal(fmtUpdated('2026-10-22T13:29:16Z', now), 'Aggiornata 11 min fa');
  assert.equal(fmtUpdated('2026-10-22T08:05:00Z', now), 'Aggiornata alle 10:05');
  assert.equal(fmtUpdated('2026-10-19T08:00:00Z', now), 'Ferma da 3 giorni');
  assert.equal(fmtUpdated(null, now), null);
  assert.equal(fmtUpdated('boh', now), null);
});
