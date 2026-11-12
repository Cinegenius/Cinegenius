import { hasCoordinates } from './location-map';

/** City labels only. Exact private addresses must never be sent to this service. */
export async function geocodeLocationCities(cities: string[]): Promise<Record<string, { lat: number; lng: number }>> {
  const result: Record<string, { lat: number; lng: number }> = {};
  await Promise.all([...new Set(cities.filter(Boolean))].map(async city => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'CineGenius/1.0 (contact@cinegenius.de)' }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!data[0]) return;
      const point = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      if (hasCoordinates(point)) result[city] = point;
    } catch { /* Unknown coordinates stay unknown. */ }
  }));
  return result;
}
