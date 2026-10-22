import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, inBounds, dedupe, sortByDistance } from '../public/js/geo.js';

const catania = { lat: 37.5079, lon: 15.0830 };
const palermo = { lat: 38.1157, lon: 13.3615 };

test('distanceKm Catania-Palermo ~166 km', () => {
  const d = distanceKm(catania, palermo);
  assert.ok(d > 160 && d < 172, `got ${d}`);
});

test('inBounds', () => {
  const b = { north: 38, south: 37, east: 16, west: 14 };
  assert.equal(inBounds(catania, b), true);
  assert.equal(inBounds(palermo, b), false);
});

test('dedupe drops OSM near Windy, keeps far OSM', () => {
  const w = { id: 'windy:1', source: 'windy', ...catania };
  const near = { id: 'osm:node/1', source: 'osm', lat: 37.5085, lon: 15.0830 };
  const far = { id: 'osm:node/2', source: 'osm', ...palermo };
  assert.deepEqual(dedupe([near, w, far]).map(c => c.id), ['windy:1', 'osm:node/2']);
});

test('sortByDistance', () => {
  const cams = [{ id: 'p', ...palermo }, { id: 'c', ...catania }];
  assert.deepEqual(sortByDistance(cams, catania).map(c => c.id), ['c', 'p']);
  assert.deepEqual(cams.map(c => c.id), ['p', 'c']);
});
