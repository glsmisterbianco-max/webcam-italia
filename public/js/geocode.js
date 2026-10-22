// Ricerca località in Italia (Open-Meteo Geocoding, gratuito).

const URL_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

export async function searchPlaces(q, { fetch }) {
  const name = (q || '').trim();
  if (name.length < 2) return [];
  try {
    const res = await fetch(
      `${URL_BASE}?name=${encodeURIComponent(name)}&count=6&language=it&countryCode=IT`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r) => ({
      name: r.name,
      detail: [r.admin2, r.admin1].filter(Boolean).join(', '),
      lat: r.latitude,
      lon: r.longitude,
    }));
  } catch {
    return [];
  }
}
