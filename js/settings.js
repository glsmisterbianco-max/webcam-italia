// Chiave Windy salvata solo sul telefono.

const KEY = 'wi.windyKey';

export function createSettings(storage) {
  return {
    getWindyKey() {
      try {
        return storage.getItem(KEY) || null;
      } catch {
        return null;
      }
    },
    setWindyKey(k) {
      const v = (k || '').trim();
      try {
        if (v) storage.setItem(KEY, v);
        else storage.removeItem(KEY);
      } catch {
        // storage non disponibile: la chiave vale solo per questa sessione
      }
    },
  };
}
