import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettings } from '../public/js/settings.js';
import { createFavorites } from '../public/js/favorites.js';

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
const brokenStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
};
const cam = {
  id: 'windy:1', source: 'windy', name: 'Mondello', place: 'Palermo', lat: 38.2, lon: 13.3,
  thumb: 'https://t', preview: 'https://x', player: 'https://p', page: 'https://w',
};

test('favorites strip expiring image urls', () => {
  const f = createFavorites(memStorage());
  f.add(cam);
  const saved = f.list()[0];
  assert.equal(saved.preview, null);
  assert.equal(saved.thumb, null);
  assert.equal(saved.player, null);
  assert.equal(saved.name, 'Mondello');
  assert.equal(f.has('windy:1'), true);
});

test('toggle returns new state', () => {
  const f = createFavorites(memStorage());
  assert.equal(f.toggle(cam), true);
  assert.equal(f.toggle(cam), false);
  assert.deepEqual(f.list(), []);
});

test('add twice keeps one entry', () => {
  const f = createFavorites(memStorage());
  f.add(cam); f.add(cam);
  assert.equal(f.list().length, 1);
});

test('corrupted favorites json gives empty list', () => {
  const s = memStorage();
  s.setItem('wi.favorites', '{rotto');
  assert.deepEqual(createFavorites(s).list(), []);
});

test('blank windy key is removed', () => {
  const st = createSettings(memStorage());
  st.setWindyKey('abc');
  assert.equal(st.getWindyKey(), 'abc');
  st.setWindyKey('  ');
  assert.equal(st.getWindyKey(), null);
});

test('throwing storage never crashes', () => {
  const st = createSettings(brokenStorage);
  const f = createFavorites(brokenStorage);
  assert.equal(st.getWindyKey(), null);
  st.setWindyKey('k');
  assert.deepEqual(f.list(), []);
  assert.equal(f.has('x'), false);
  f.add(cam); f.remove('windy:1'); f.toggle(cam);
});
