import { NextResponse } from "next/server";

const MIN_QUERY_LENGTH = 3;

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

  if (query.length < MIN_QUERY_LENGTH) {
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
  url.searchParams.set("limit", "6");
  url.searchParams.set("tag", "place:city,place:town,place:village");
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
    const results = data.map((item) => ({
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
