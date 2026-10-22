// Mappa Leaflet con i puntini raggruppati. Leaflet arriva come globale L.

const ITALY = [[35.4, 6.6], [47.1, 18.6]];

export function createMap(el, { onMoveEnd, onSelect, onToggleGroup }) {
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
  const roadCluster = clusterOf('cluster-road');
  map.addLayer(windyCluster);
  map.addLayer(osmCluster);
  map.addLayer(roadCluster);

  // Legenda a pulsanti: ogni voce accende o spegne il suo gruppo di webcam.
  const legend = L.control({ position: 'bottomleft' });
  let legendEl;
  legend.onAdd = () => {
    legendEl = L.DomUtil.create('div', 'legend');
    legendEl.innerHTML =
      '<button type="button" data-group="windy" aria-pressed="true"><i class="dot dot-windy"></i>Foto nell’app</button>' +
      '<button type="button" data-group="osm" aria-pressed="true"><i class="dot dot-osm"></i>Diretta sul sito</button>' +
      '<button type="button" data-group="road" aria-pressed="true"><i class="dot dot-road"></i>Strade</button>';
    L.DomEvent.disableClickPropagation(legendEl);
    legendEl.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => onToggleGroup(b.dataset.group))
    );
    return legendEl;
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
      const groups = { windy: [], osm: [], road: [] };
      const look = {
        windy: { radius: 8, fillColor: '#1d6fe0' },
        osm: { radius: 10, fillColor: '#f07c00' },
        road: { radius: 9, fillColor: '#7b3fd1' },
      };
      [windyCluster, osmCluster, roadCluster].forEach((c) => c.clearLayers());
      markers.clear();
      for (const cam of cams) {
        const kind = cam.source === 'osm' ? 'osm' : cam.road ? 'road' : 'windy';
        const m = L.circleMarker([cam.lat, cam.lon], { ...look[kind], weight: 2, color: '#ffffff', fillOpacity: 1 });
        m.on('click', () => onSelect(cam));
        markers.set(cam.id, m);
        groups[kind].push(m);
      }
      windyCluster.addLayers(groups.windy);
      osmCluster.addLayers(groups.osm);
      roadCluster.addLayers(groups.road);
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
      const group = [windyCluster, osmCluster, roadCluster].find((c) => m && c.hasLayer(m));
      if (group) group.zoomToShowLayer(m, () => m.setRadius(12));
    },
    setGroups(groups) {
      legendEl.querySelectorAll('button').forEach((b) => {
        const on = !!groups[b.dataset.group];
        b.classList.toggle('off', !on);
        b.setAttribute('aria-pressed', String(on));
      });
    },
    invalidate() {
      map.invalidateSize();
    },
  };
  return api;
}
