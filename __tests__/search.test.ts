import { searchPlaces, type PlaceSearchResult } from '../src/geo/search';

describe('searchPlaces', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns idle when query is empty', async () => {
    const result = await searchPlaces('');
    expect(result).toEqual({ results: [], state: 'idle' });
  });

  it('returns error when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    const result = await searchPlaces('abc');
    expect(result).toEqual({ results: [], state: 'error' });
  });

  it('maps Nominatim results and ignores distance without origin', async () => {
    const data = [
      {
        place_id: '1',
        display_name: 'Rua A, Natal, RN, Brasil',
        lat: '-5.8',
        lon: '-35.2',
        address: {
          road: 'Rua A',
          house_number: '123',
          suburb: 'Centro',
          city: 'Natal',
          town: 'Natal',
          state: 'RN',
          country: 'Brasil'
        }
      }
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => data
    });

    const result = await searchPlaces('Rua A');
    expect(result.state).toBe('results');
    expect(result.results[0].name).toBe('Rua A, Natal, RN, Brasil');
    expect(result.results[0].address).toBe('Rua A 123, Natal - RN, Brasil');
    expect(result.results[0].distanceKm).toBeUndefined();
  });

  it('computes distanceKm when origin is provided', async () => {
    const data = [
      {
        place_id: '2',
        display_name: 'Rua B',
        lat: '-5.8',
        lon: '-35.2',
        address: { road: 'Rua B', city: 'Natal', state: 'RN', country: 'Brasil' }
      }
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => data
    });

    const result = await searchPlaces('Rua B', { lat: -5.79, lng: -35.21 });
    expect(result.state).toBe('results');
    expect(typeof result.results[0].distanceKm).toBe('number');
  });
});
