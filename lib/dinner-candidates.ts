// Dodici bastano a dare scelta reale entro dieci minuti a piedi. Misurato a Porto: 161
// locali entro 500 m — mandarli tutti al modello, su un viaggio di 14 giorni, significa
// duemila voci in un prompt solo, e un modello che sceglie peggio perché annega.
export const MAX_CANDIDATES = 12;

const SEARCH_RADIUS_METERS = 600;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Overpass rifiuta con **406 Not Acceptable** le richieste che arrivano con lo
// User-Agent di default di Node (undici): misurato il 2026-08-25 su ogni singola
// interrogazione, cioè con la funzionalità completamente morta in produzione mentre
// l'intera suite era verde. La stessa identica richiesta fatta con `curl` passava, perché
// curl un suo User-Agent ce l'ha: è la differenza che ha portato alla diagnosi. Con questa
// intestazione la stessa query risponde 200 con 178 locali. Non toglierla e non lasciarla
// vuota: è l'unica cosa che separa questa funzionalità dal non funzionare affatto.
const USER_AGENT = "TripTailor/1.0 (https://trip-tailor-ten.vercel.app)";

export interface DinnerCandidate {
  id: number;
  name: string;
  distanceMeters: number;
  cuisine?: string;
  openingHours?: string;
  street?: string;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function parseOverpassRestaurants(json: unknown, lat: number, lon: number): DinnerCandidate[] {
  const elements = (json as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];

  return elements
    .map((raw): Omit<DinnerCandidate, "id"> | null => {
      const el = raw as OverpassElement;
      const name = el.tags?.name;
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (!name || typeof elLat !== "number" || typeof elLon !== "number") return null;

      return {
        name,
        distanceMeters: distanceMeters(lat, lon, elLat, elLon),
        cuisine: el.tags?.cuisine,
        openingHours: el.tags?.opening_hours,
        street: el.tags?.["addr:street"],
      };
    })
    .filter((c): c is Omit<DinnerCandidate, "id"> => c !== null)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_CANDIDATES)
    .map((c, index) => ({ id: index + 1, ...c }));
}

/**
 * Overpass pubblico ha tempi di risposta molto variabili: quattro interrogazioni vere
 * attorno a Bologna, il 2026-08-25, hanno dato 1,0s, 8,4s (504), 10,6s (504) e 17,3s. I
 * fallimenti sono frequenti e possono essere costosi: misurate anche risposte 500/504 dopo
 * 46-55 secondi. Il timeout e la rinuncia silenziosa sono la protezione: una giornata senza
 * consiglio è accettabile, mezzo minuto di attesa per un errore no. Il tetto vero lo decide
 * il chiamante (OVERPASS_TIMEOUT_MS nella route), che deve stare nel proprio budget.
 */
export async function fetchDinnerCandidates(
  lat: number,
  lon: number,
  timeoutMs: number
): Promise<DinnerCandidate[]> {
  const query = `[out:json][timeout:10];(node["amenity"="restaurant"](around:${SEARCH_RADIUS_METERS},${lat},${lon});way["amenity"="restaurant"](around:${SEARCH_RADIUS_METERS},${lat},${lon}););out center tags;`;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.error(`Consigli cena: Overpass ha risposto ${response.status}`);
      return [];
    }

    return parseOverpassRestaurants(await response.json(), lat, lon);
  } catch (error) {
    console.error("Consigli cena: interrogazione Overpass fallita", error);
    return [];
  }
}
