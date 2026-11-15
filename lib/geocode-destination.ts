interface LocationIqSearchResult {
  lat: string;
  lon: string;
  // [sud, nord, ovest, est], come stringhe.
  boundingbox?: string[];
  address?: {
    city?: string;
    town?: string;
    village?: string;
    locality?: string;
    island?: string;
    archipelago?: string;
    country_code?: string;
  };
  extratags?: { capital?: string };
}

// Fino a quest'area un risultato è «un posto solo» anche se LocationIQ lo scheda come stato
// o paese. Alle latitudini italiane è circa il quadrato di un grado di lato dentro cui
// `geocodePlaceNear` cerca le tappe. Misurato il 2026-11-14 sui riquadri veri: Monaco
// 261 km², Kuala Lumpur 372, Rio 2.660, Singapore 4.794, Malta 6.195, Mosca 7.207 stanno
// sotto; Dolomiti 10.386, Zanzibar 13.720, Dubai (l'emirato) 15.052, Toscana 54.750 sopra.
const AREA_MASSIMA_LUOGO_KM2 = 9_400;
const KM_PER_GRADO = 111;

function areaRiquadroKm2(boundingbox: string[] | undefined): number | null {
  if (!Array.isArray(boundingbox) || boundingbox.length !== 4) return null;
  const [sud, nord, ovest, est] = boundingbox.map(Number.parseFloat);
  if ([sud, nord, ovest, est].some(Number.isNaN)) return null;
  // Un riquadro rovesciato o vuoto darebbe un'area negativa o nulla, che passerebbe per
  // «piccola»: non è un'area, è un dato di cui non fidarsi.
  if (nord <= sud || est <= ovest) return null;
  const altezza = (nord - sud) * KM_PER_GRADO;
  const latitudineMedia = (sud + nord) / 2;
  const larghezza = (est - ovest) * KM_PER_GRADO * Math.cos((latitudineMedia * Math.PI) / 180);
  return altezza * larghezza;
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
  url.searchParams.set("extratags", "1");

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

    // Le coordinate servono al meteo e ai consigli sulla cena, e valgono solo per un posto
    // preciso: di una regione o di un paese (Toscana, Italia) resta il solo country_code.
    // Tre modi di riconoscerlo, perché le città-stato non hanno una «city» nell'indirizzo
    // (misurato il 2026-11-14, fino ad allora restavano senza meteo e senza cena):
    // l'indirizzo nomina un centro abitato; oppure è una capitale nazionale (Tokyo torna come
    // «province» con un riquadro che arriva alle isole Ogasawara); oppure il riquadro è
    // piccolo quanto una città (Singapore, Monaco, Kuala Lumpur).
    const area = areaRiquadroKm2(data[0].boundingbox);
    const hasPreciseCoordinates = !!(
      address?.city ||
      address?.town ||
      address?.village ||
      address?.locality ||
      address?.island ||
      address?.archipelago ||
      data[0].extratags?.capital === "yes" ||
      (area !== null && area <= AREA_MASSIMA_LUOGO_KM2)
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

// Mezzo grado attorno al punto: abbondante per una città, stretto abbastanza da escludere
// l'omonimo dall'altra parte del mondo. `bounded=1` rende il riquadro un vincolo e non un
// suggerimento.
const VIEWBOX_DEGREES = 0.5;

export async function geocodePlaceNear(
  query: string,
  near: { lat: number; lon: number },
  timeoutMs: number
): Promise<{ lat: number; lon: number } | null> {
  const apiKey = process.env.LOCATIONIQ_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://api.locationiq.com/v1/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set(
    "viewbox",
    [
      near.lon - VIEWBOX_DEGREES,
      near.lat + VIEWBOX_DEGREES,
      near.lon + VIEWBOX_DEGREES,
      near.lat - VIEWBOX_DEGREES,
    ].join(",")
  );
  url.searchParams.set("bounded", "1");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      console.error(`Consigli cena: LocationIQ ha risposto ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { lat: string; lon: string }[];
    if (!Array.isArray(data) || data.length === 0) return null;

    const lat = Number.parseFloat(data[0].lat);
    const lon = Number.parseFloat(data[0].lon);

    // Senza questa guardia un NaN arriverebbe fino alla query a Overpass (`around:600,NaN,NaN`),
    // dove non dà un errore chiaro ma risultati vuoti o insensati, lontano da dove nasce.
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }

    return { lat, lon };
  } catch (error) {
    console.error("Consigli cena: geocodifica della tappa fallita", error);
    return null;
  }
}
