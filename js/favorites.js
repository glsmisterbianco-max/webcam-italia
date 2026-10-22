// Preferiti sul telefono. Le URL Windy scadono, quindi non si salvano mai.

const KEY = 'wi.favorites';

export function createFavorites(storage) {
  function read() {
    try {
      const v = JSON.parse(storage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  function write(list) {
    try {
      storage.setItem(KEY, JSON.stringify(list));
    } catch {
      // storage non disponibile
    }
  }

  const api = {
    list: read,
    has: (id) => read().some((c) => c.id === id),
    add(cam) {
      const list = read().filter((c) => c.id !== cam.id);
      list.push({ ...cam, thumb: null, preview: null, player: null });
      write(list);
    },
    remove(id) {
      write(read().filter((c) => c.id !== id));
    },
    toggle(cam) {
      if (api.has(cam.id)) {
        api.remove(cam.id);
        return false;
      }
      api.add(cam);
      return true;
    },
  };
  return api;
}
