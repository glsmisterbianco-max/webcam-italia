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

  // Windy e OSM in gruppi separati: le OSM (diretta sul sito) restano riconoscibili anche da lontano.
  const clusterOf = (cls) =>
    L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (c) =>
        L.divIcon({
          html: `<div><span>${c.getChildCount()}</span></div>`,
          className: `marker-cluster ${cls}`,
          iconSize: L.point(40, 40),
        }),
    });
  const windyCluster = clusterOf('cluster-windy');
  const osmCluster = clusterOf('cluster-osm');
  map.addLayer(windyCluster);
  map.addLayer(osmCluster);

  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML =
      '<span><i class="dot dot-windy"></i>Foto nell’app</span>' +
      '<span><i class="dot dot-osm"></i>Diretta sul sito</span>';
    return div;
  };
  legend.addTo(map);
  const markers = new Map();

  let timer;
  map.on('moveend', () => {
    clearTimeout(timer);
    timer = setTimeout(() => onMoveEnd(api.getBounds(), api.getCenter()), 400);
  });

  const api = {
    setCams(cams) {
      windyCluster.clearLayers();
      osmCluster.clearLayers();
      markers.clear();
      const windy = [];
      const osm = [];
      for (const cam of cams) {
        const isOsm = cam.source === 'osm';
        const m = L.circleMarker([cam.lat, cam.lon], {
          radius: isOsm ? 10 : 8,
          weight: 2,
          color: '#ffffff',
          fillColor: isOsm ? '#f07c00' : '#1d6fe0',
          fillOpacity: 1,
        });
        m.on('click', () => onSelect(cam));
        markers.set(cam.id, m);
        (isOsm ? osm : windy).push(m);
      }
      windyCluster.addLayers(windy);
      osmCluster.addLayers(osm);
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
      if (m) (osmCluster.hasLayer(m) ? osmCluster : windyCluster).zoomToShowLayer(m, () => m.setRadius(12));
    },
    invalidate() {
      map.invalidateSize();
    },
  };
  return api;
}
