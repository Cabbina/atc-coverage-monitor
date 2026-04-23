import Papa from 'papaparse';

export interface Airport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
}

let airportsCache: Map<string, Airport> | null = null;
let isFetching = false;

/**
 * Loads airport data from OurAirports CSV.
 * Caches results in memory for the duration of the server process.
 */
export async function loadAirports(): Promise<Map<string, Airport>> {
  if (airportsCache) return airportsCache;

  // Basic locking to prevent multiple parallel fetches
  if (isFetching) {
    while (isFetching) {
      await new Promise(r => setTimeout(r, 200));
    }
    return airportsCache || new Map();
  }

  isFetching = true;
  try {
    console.log('[Airports] Fetching OurAirports dataset...');
    const startTime = Date.now();

    const response = await fetch('https://davidmegginson.github.io/ourairports-data/airports.csv');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const csv = await response.text();

    const { data } = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    const map = new Map<string, Airport>();
    for (const row of data as any[]) {
      // We prioritize gps_code as it's the 4-letter ICAO code used in ATC networks
      const icao = (row.gps_code || row.ident)?.toString().toUpperCase();

      if (icao && row.latitude_deg !== undefined && row.longitude_deg !== undefined) {
        map.set(icao, {
          icao,
          name: row.name,
          lat: row.latitude_deg,
          lon: row.longitude_deg,
          country: row.iso_country,
        });
      }
    }

    airportsCache = map;
    console.log(`[Airports] Loaded ${map.size} airports in ${Date.now() - startTime}ms.`);
    return map;
  } catch (error) {
    console.error('[Airports] Failed to load airport data:', error);
    return new Map();
  } finally {
    isFetching = false;
  }
}
