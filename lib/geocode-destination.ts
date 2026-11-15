interface LocationIqSearchResult {
  lat: string;
  lon: string;
  // La categoria OSM del risultato: «place», «boundary», ma anche «highway» o «aeroway».
  class?: string;
  display_name?: string;
  // [sud, nord, ovest, est], come stringhe.
  boundingbox?: string[];
  address?: {
    city?: string;
    town?: string;
    village?: string;
    locality?: string;
    island?: string;
    archipelago?: string;
    county?: string;
    state?: string;
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

// Una strada o un aeroporto non sono una destinazione: sono ciò che LocationIQ trova quando
// la zona cercata non esiste come luogo («Cotswolds» → una via di Hatfield, «Costa Smeralda»
// → l'aeroporto di Olbia, «Versilia» → uno svincolo). Il loro indirizzo nomina una città,
// quindi senza questo filtro passerebbero per posti precisi.
const CLASSI_NON_LUOGO = new Set(["highway", "aeroway"]);

// Le zone turistiche senza confine amministrativo, che LocationIQ risolve sull'omonimo o non
// trova affatto (misurato il 2026-11-15 su 44 zone: «Salento, Italia» è un paese in provincia
// di Salerno, «Maremma, Italia» una località in Liguria). Si cercano come la città che ne fa
// da base; le zone troppo estese per averne una si cercano come il loro paese, e restano
// senza coordinate come ogni regione. `paesi` evita di toccare gli omonimi veri: Salento, in
// Colombia, è una città. La lista è scritta a mano e copre solo le zone verificate.
// Tre rinunce volute: il Salento del Cilento (un paese di duemila abitanti, che
// l'autocompletamento propone proprio come «Salento, Italia») non è più raggiungibile;
// «Patagonia» senza paese vale Argentina; e una tappa a più di mezzo grado dalla città-base
// (Santa Maria di Leuca da Lecce, Pitigliano da Grosseto) non si geocodifica, quindi la cena
// di quella sera ripiega sul centro della base, come per ogni tappa lontana.
const ZONE_TURISTICHE: Record<string, { paesi: string[]; cerca: string }> = {
  salento: { paesi: ["italia", "italy"], cerca: "Lecce, Italia" },
  maremma: { paesi: ["italia", "italy"], cerca: "Grosseto, Italia" },
  "riviera romagnola": { paesi: ["italia", "italy"], cerca: "Rimini, Italia" },
  versilia: { paesi: ["italia", "italy"], cerca: "Viareggio, Italia" },
  "costa smeralda": { paesi: ["italia", "italy"], cerca: "Porto Cervo, Italia" },
  "costiera amalfitana": { paesi: ["italia", "italy"], cerca: "Amalfi, Italia" },
  cotswolds: { paesi: ["regno unito", "inghilterra", "uk", "england"], cerca: "Cirencester, Regno Unito" },
  cicladi: { paesi: ["grecia", "greece"], cerca: "Grecia" },
  patagonia: { paesi: ["argentina"], cerca: "Argentina" },
};

// Minuscole, senza accenti e senza spazi doppi: «Cìcladi» e «Costiera  Amalfitana» sono la
// stessa zona.
const normalizza = (testo: string) =>
  testo.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

// Del resto conta solo l'ultimo pezzo, cioè il paese: «Salento, Puglia, Italia» è il Salento.
function domandaPerLocationIq(destination: string): string {
  const parti = destination.split(",").map(normalizza).filter(Boolean);
  const nome = parti[0] ?? "";
  if (!Object.hasOwn(ZONE_TURISTICHE, nome)) return destination;
  const zona = ZONE_TURISTICHE[nome];
  return parti.length === 1 || zona.paesi.includes(parti[parti.length - 1]) ? zona.cerca : destination;
}

// Per «Lecce, Italia», «Siena, Italia», «Rimini, Italia» LocationIQ mette prima la PROVINCIA
// e poi la città (misurato il 2026-11-15): il baricentro della provincia di Lecce sta in
// campagna, a 23 km dalla città. Se il primo risultato è una provincia o uno stato, gli si
// preferisce una città («city», non un paesino: «Molise» è anche un comune di dieci km²)
// che porta lo stesso nome e sta dentro il suo riquadro. Vale anche per Dubai, emirato e
// città. Un paese non è mai sostituito dalla capitale omonima (Gibuti, Panama): lo si
// riconosce dall'indirizzo senza «state» né «county», e il tetto sull'area è la seconda
// difesa. Il riquadro della provincia di Grosseto, isole comprese, misura ~9.600 km².
// Il nome si confronta com'è scritto in `display_name`, cioè nella lingua locale: dove
// stato e città si scrivono diversi («Lëtzebuerg» e «Luxembourg») non succede niente.
const AREA_MASSIMA_PROVINCIA_KM2 = 50_000;

const primoNome = (r: LocationIqSearchResult) => r.display_name?.split(",")[0].trim().toLowerCase();

function capoluogoOmonimo(risultati: LocationIqSearchResult[]): LocationIqSearchResult | undefined {
  const [primo, ...altri] = risultati;
  const a = primo.address;
  if (a?.city || a?.town || a?.village || a?.locality || a?.island || a?.archipelago) return undefined;
  if (!a?.state && !a?.county) return undefined;
  const area = areaRiquadroKm2(primo.boundingbox);
  if (area === null || area > AREA_MASSIMA_PROVINCIA_KM2) return undefined;
  const [sud, nord, ovest, est] = primo.boundingbox!.map(Number.parseFloat);
  const nome = primoNome(primo);
  return altri.find((r) => {
    const lat = Number.parseFloat(r.lat);
    const lon = Number.parseFloat(r.lon);
    return (
      !!r.address?.city &&
      !!nome &&
      primoNome(r) === nome &&
      lat >= sud &&
      lat <= nord &&
      lon >= ovest &&
      lon <= est
    );
  });
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
  url.searchParams.set("q", domandaPerLocationIq(destination));
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "3");
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

    const scelto = capoluogoOmonimo(data) ?? data[0];
    const address = scelto.address;
    const countryCode = address?.country_code ? address.country_code.toUpperCase() : null;

    // Le coordinate servono al meteo e ai consigli sulla cena, e valgono solo per un posto
    // preciso: di una regione o di un paese (Toscana, Italia) resta il solo country_code.
    // Tre modi di riconoscerlo, perché le città-stato non hanno una «city» nell'indirizzo
    // (misurato il 2026-11-14, fino ad allora restavano senza meteo e senza cena):
    // l'indirizzo nomina un centro abitato; oppure è una capitale nazionale (Tokyo torna come
    // «province» con un riquadro che arriva alle isole Ogasawara); oppure il riquadro è
    // piccolo quanto una città (Singapore, Monaco, Kuala Lumpur).
    const area = areaRiquadroKm2(scelto.boundingbox);
    const hasPreciseCoordinates =
      !CLASSI_NON_LUOGO.has(scelto.class ?? "") &&
      !!(
        address?.city ||
        address?.town ||
        address?.village ||
        address?.locality ||
        address?.island ||
        address?.archipelago ||
        scelto.extratags?.capital === "yes" ||
        (area !== null && area <= AREA_MASSIMA_LUOGO_KM2)
      );

    if (!hasPreciseCoordinates) {
      return { lat: null, lon: null, countryCode };
    }

    const lat = Number.parseFloat(scelto.lat);
    const lon = Number.parseFloat(scelto.lon);

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
