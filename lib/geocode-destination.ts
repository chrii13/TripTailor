interface LocationIqSearchResult {
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    island?: string;
    archipelago?: string;
    country_code?: string;
  };
}

export interface Coordinates {
  lat: number | null;
  lon: number | null;
  countryCode: string | null;
}

export async function geocodeDestination(destination: string): Promise<Coordinates | null> {
  const apiKey = process.env.LOCATIONIQ_API_KEY;

  if (!apiKey) {
    return null;
  }

  const url = new URL("https://api.locationiq.com/v1/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", destination);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("tag", "place:city,place:town,place:village,place:island,place:archipelago");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });

    if (!response.ok) {
      console.error(`Geolocalizzazione destinazione: LocationIQ ha risposto ${response.status}`);
      return null;
    }

    const data: LocationIqSearchResult[] = await response.json();

    if (data.length === 0) {
      return null;
    }

    const address = data[0].address;
    const countryCode = address?.country_code ? address.country_code.toUpperCase() : null;

    // Il fuso di precisione protegge solo la qualità delle coordinate per il meteo:
    // luoghi non abbastanza specifici (es. Tokyo, Shanghai, tag'd come divisioni
    // amministrative) restituiscono comunque un country_code utilizzabile.
    const hasPreciseCoordinates = !!(
      address?.city ||
      address?.town ||
      address?.village ||
      address?.island ||
      address?.archipelago
    );

    if (!hasPreciseCoordinates) {
      return { lat: null, lon: null, countryCode };
    }

    const lat = Number.parseFloat(data[0].lat);
    const lon = Number.parseFloat(data[0].lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return { lat: null, lon: null, countryCode };
    }

    return { lat, lon, countryCode };
  } catch (error) {
    console.error("Geolocalizzazione destinazione: chiamata a LocationIQ fallita", error);
    return null;
  }
}
