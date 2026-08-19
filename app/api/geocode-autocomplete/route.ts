import { NextResponse } from "next/server";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 100;
const FETCH_LIMIT = 20;
const DISPLAY_LIMIT = 6;

// La route abortisce già la propria fetch a 5s; questo è solo un tetto di sicurezza.
export const maxDuration = 10;

interface LocationIqResult {
  place_id: string;
  display_name: string;
  display_place?: string;
  address?: {
    country?: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.LOCATIONIQ_API_KEY;

  if (!apiKey) {
    console.error("Autocompletamento destinazione: LOCATIONIQ_API_KEY non configurata");
    return NextResponse.json({ results: [] }, { status: 502 });
  }

  const url = new URL("https://api.locationiq.com/v1/autocomplete");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(FETCH_LIMIT));
  url.searchParams.set("tag", "place:city,place:town,place:village,place:island,place:archipelago");
  url.searchParams.set("accept-language", "it");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ results: [] });
      }
      console.error(`Autocompletamento destinazione: LocationIQ ha risposto ${response.status}`);
      return NextResponse.json({ results: [] }, { status: 502 });
    }

    const data: LocationIqResult[] = await response.json();
    const normalizedQuery = query.toLocaleLowerCase("it");
    const results = data
      .filter((item) => (item.display_place ?? "").toLocaleLowerCase("it").startsWith(normalizedQuery))
      .slice(0, DISPLAY_LIMIT)
      .map((item) => ({
        id: item.place_id,
        label:
          item.display_place && item.address?.country
            ? `${item.display_place}, ${item.address.country}`
            : item.display_name,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Autocompletamento destinazione: chiamata a LocationIQ fallita", error);
    return NextResponse.json({ results: [] }, { status: 502 });
  }
}
