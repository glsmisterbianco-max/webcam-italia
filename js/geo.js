// Utilità geografiche pure: distanze, riquadri, doppioni, ordinamento.

const R_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;

export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export function inBounds(p, b) {
  return p.lat <= b.north && p.lat >= b.south && p.lon <= b.east && p.lon >= b.west;
}

// Una webcam OSM vicina a una Windy è quasi sempre la stessa: si tiene la Windy.
export function dedupe(cams, radiusM = 150) {
  const windy = cams.filter((c) => c.source === 'windy');
  const limitKm = radiusM / 1000;
  return cams.filter(
    (c) => c.source !== 'osm' || !windy.some((w) => distanceKm(c, w) <= limitKm)
  );
}

export function sortByDistance(cams, from) {
  return cams
    .map((c) => ({ c, d: distanceKm(c, from) }))
    .sort((x, y) => x.d - y.d)
    .map((x) => x.c);
}
