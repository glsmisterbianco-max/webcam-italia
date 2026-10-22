// Mappa Leaflet con i puntini raggruppati. Leaflet arriva come globale L.

const ITALY = [[35.4, 6.6], [47.1, 18.6]];

export function createMap(el, { onMoveEnd, onSelect }) {
  const L = window.L;
  const map = L.map(el, { zoomControl: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.fitBounds(ITALY);

  const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
  map.addLayer(cluster);
  const markers = new Map();

  let timer;
  map.on('moveend', () => {
    clearTimeout(timer);
    timer = setTimeout(() => onMoveEnd(api.getBounds(), api.getCenter()), 400);
  });

  const api = {
    setCams(cams) {
      cluster.clearLayers();
      markers.clear();
      const layers = cams.map((cam) => {
        const m = L.circleMarker([cam.lat, cam.lon], {
          radius: 8,
          weight: 2,
          color: cam.source === 'windy' ? '#ffffff' : '#1e9e55',
          fillColor: cam.source === 'windy' ? '#1d6fe0' : '#ffffff',
          fillOpacity: 1,
        });
        m.on('click', () => onSelect(cam));
        markers.set(cam.id, m);
        return m;
      });
      cluster.addLayers(layers);
    },
    flyTo(lat, lon, zoom = 12) {
      map.flyTo([lat, lon], zoom, { duration: 0.8 });
    },
    fitItaly() {
      map.fitBounds(ITALY);
    },
    getBounds() {
      const b = map.getBounds();
      return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
    },
    getCenter() {
      const c = map.getCenter();
      return { lat: c.lat, lon: c.lng };
    },
    highlight(id) {
      const m = markers.get(id);
      if (m) cluster.zoomToShowLayer(m, () => m.setStyle({ radius: 11 }));
    },
    invalidate() {
      map.invalidateSize();
    },
  };
  return api;
}
