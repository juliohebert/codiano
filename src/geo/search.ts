export type PlaceSearchResult = {
  id: string;
  name: string;
  category?: string;
  address: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
};

export type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

function buildQuery(q: string, origin?: { lat: number; lng: number }, countryCode?: string) {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: '8',
    'accept-language': 'pt-BR,en'
  });

  if (origin) {
    const delta = 2;
    const south = origin.lat - delta;
    const north = origin.lat + delta;
    const west = origin.lng - delta;
    const east = origin.lng + delta;
    params.set('viewbox', `${west},${south},${east},${north}`);
    params.set('bounded', '0');
  }

  if (countryCode) {
    params.set('countrycodes', countryCode);
  }

  const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
  return url;
}

function clean(v?: string) {
  return (v ?? '').trim();
}

function pickCategory(item: { category?: string; type?: string; amenity?: string; shop?: string }): string | undefined {
  return clean(item.category) || clean(item.type) || clean(item.amenity) || clean(item.shop) || undefined;
}

function buildAddressText(item: { road?: string; house_number?: string; suburb?: string; city?: string; town?: string; state?: string; country?: string }): string {
  const street = [item.road, item.house_number].filter(Boolean).join(' ');
  const city = item.city || item.town || '';
  const state = item.state || '';
  const country = item.country || '';
  const cityRegion = [city, state].filter(Boolean).join(' - ');
  const parts = [street, cityRegion, country].filter(Boolean);
  return parts.join(', ');
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function searchPlaces(query: string, origin?: { lat: number; lng: number }, countryCode?: string): Promise<{ results: PlaceSearchResult[]; state: SearchState }> {
  const url = buildQuery(query, origin, countryCode);
  if (!url) return { results: [], state: 'idle' };

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Cotidiano/1.0 (contact@georeminder.app)'
      }
    });

    if (!response.ok) {
      return { results: [], state: 'error' };
    }

    const data = (await response.json()) as Array<{
      place_id: number | string;
      display_name: string;
      name?: string;
      category?: string;
      type?: string;
      amenity?: string;
      shop?: string;
      lat: string;
      lon: string;
      address?: {
        road?: string;
        house_number?: string;
        suburb?: string;
        city?: string;
        town?: string;
        state?: string;
        country?: string;
      };
    }>;

    if (!data.length) {
      return { results: [], state: 'empty' };
    }

    const results: PlaceSearchResult[] = data.map((item) => {
      const name = item.name || item.amenity || item.shop || item.display_name || 'Local';
      const category = pickCategory(item);
      const address = buildAddressText(item.address || {});
      const neighborhood = clean(item.address?.suburb);
      const city = clean(item.address?.city || item.address?.town);
      const state = clean(item.address?.state);
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      const distanceKm = origin ? haversineKm(origin.lat, origin.lng, latitude, longitude) : undefined;

      return {
        id: String(item.place_id),
        name,
        category,
        address,
        neighborhood,
        city,
        state,
        latitude,
        longitude,
        distanceKm
      };
    });

    return { results, state: 'results' };
  } catch {
    return { results: [], state: 'error' };
  }
}
