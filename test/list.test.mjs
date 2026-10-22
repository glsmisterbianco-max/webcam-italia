import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRowHtml, escapeHtml } from '../public/js/list.js';

const osm = { id: 'osm:node/1', source: 'osm', name: 'Lido', place: 'Catania', lat: 37, lon: 15, thumb: null, preview: null, player: null, page: 'https://l' };
const windy = { ...osm, id: 'windy:1', source: 'windy', thumb: 'https://thumb' };
const cond = { temp: 24, wind: 12, windDir: 315, rainPct: 30, rainNext: [], wave: null, waveDir: null, seaTemp: null };
const noise = /null|undefined|NaN/;

test('osm row has no img', () => {
  const h = renderRowHtml(osm, cond, false);
  assert.ok(!h.includes('<img'), h);
  assert.ok(h.includes('Lido'));
});

test('windy row has thumbnail', () => {
  assert.ok(renderRowHtml(windy, cond, false).includes('src="https://thumb"'));
});

test('missing conditions shows dash and no noise', () => {
  const h = renderRowHtml(windy, null, false);
  assert.ok(h.includes('—'));
  assert.ok(!noise.test(h), h);
});

test('inland conditions have no noise', () => {
  assert.ok(!noise.test(renderRowHtml(osm, cond, false)));
});

test('name is escaped', () => {
  const h = renderRowHtml({ ...osm, name: '<script>x</script>' }, cond, false);
  assert.ok(!h.includes('<script>'), h);
  assert.equal(escapeHtml('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
});

test('favorite star', () => {
  assert.ok(renderRowHtml(osm, cond, true).includes('★'));
  assert.ok(!renderRowHtml(osm, cond, false).includes('★'));
});

test('osm row has live-on-site badge, windy row does not', () => {
  assert.ok(renderRowHtml(osm, cond, false).includes('Diretta sul sito'));
  assert.ok(!renderRowHtml(windy, cond, false).includes('Diretta sul sito'));
});

test('road webcam row has road badge', () => {
  assert.ok(renderRowHtml({ ...windy, road: true }, cond, false).includes('Strada'));
  assert.ok(!renderRowHtml(windy, cond, false).includes('Strada'));
});
