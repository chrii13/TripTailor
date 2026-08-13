interface LocationIqSearchResult {
  lat: string;
  lon: string;
}

export interface Coordinates {
  lat: number;
  lon: number;
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

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      return null;
    }

    const data: LocationIqSearchResult[] = await response.json();

    if (data.length === 0) {
      return null;
    }

    const lat = Number.parseFloat(data[0].lat);
    const lon = Number.parseFloat(data[0].lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }

    return { lat, lon };
  } catch {
    return null;
  }
}
