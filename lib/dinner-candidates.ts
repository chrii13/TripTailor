import type { Riquadro } from "./dinner-bounding-box";

// Dodici bastano a dare scelta reale entro dieci minuti a piedi. Misurato a Porto: 161
// locali entro 500 m — mandarli tutti al modello, su un viaggio di 14 giorni, significa
// duemila voci in un prompt solo, e un modello che sceglie peggio perché annega.
export const MAX_CANDIDATES = 12;

/**
 * Il raggio entro cui si cerca la cena di una sera, attorno alla sua tappa d'ancoraggio.
 *
 * Fino al 2026-08-26 era Overpass a farlo rispettare, perché ogni sera aveva la propria
 * interrogazione `around`. Ora la risposta è **una sola** per tutto l'itinerario e copre
 * un rettangolo largo chilometri: il raggio lo applica `selectNearbyCandidates`, in casa e
 * senza toccare la rete. È un filtro che non si può togliere credendolo ridondante — senza,
 * una sera si vedrebbe consigliato un locale dall'altra parte dell'itinerario.
 */
export const SEARCH_RADIUS_METERS = 600;

// Dal 2026-11-14 si interroga overpass.ch con una chiave (`OVERPASS_API_KEY`, piano gratuito:
// 10.000 interrogazioni al mese, uso commerciale escluso). L'istanza pubblica overpass-api.de
// risponde 406 a ogni nostra richiesta dal 2026-11-13: i gestori l'hanno messa sotto
// restrizioni e hanno bandito le piattaforme di deploy rapido. Cambiare User-Agent per
// aggirare il blocco è vietato dalle loro regole: non tornare lì mascherandosi.
// La chiave sta nel percorso, quindi l'indirizzo intero non va mai scritto in un log.
const overpassUrl = (chiave: string) => `https://api.overpass.ch/v1/${chiave}/interpreter`;

// Sull'istanza pubblica lo User-Agent di default di Node (undici) costava un **406** su ogni
// interrogazione: misurato il 2026-08-25, con la funzionalità morta in produzione e la suite
// tutta verde. overpass.ch non l'ha ancora preteso, ma presentarsi resta la regola di ogni
// servizio OpenStreetMap: non toglierlo e non lasciarlo vuoto.
const USER_AGENT = "TripTailor/1.0 (https://trip-tailor-ten.vercel.app)";

/** Un locale come arriva da OSM: senza distanza, perché non c'è un solo punto da cui misurarla. */
export interface OverpassPlace {
  name: string;
  lat: number;
  lon: number;
  cuisine?: string;
  openingHours?: string;
  street?: string;
}

/**
 * Un locale già riferito alla tappa di una sera: ha una distanza e un identificativo.
 *
 * Le coordinate restano anche dopo il calcolo della distanza, e non sono un residuo da
 * ripulire: sono ciò che permette al collegamento alla mappa di centrare il locale *giusto*
 * fra i suoi omonimi (vedi `lib/dinner-map-link.ts`). Al modello non vengono mostrate — il
 * prompt non le stampa — perché non gli servono per scegliere.
 */
export interface DinnerCandidate {
  id: number;
  name: string;
  distanceMeters: number;
  lat: number;
  lon: number;
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

export function parseOverpassPlaces(json: unknown): OverpassPlace[] {
  const elements = (json as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];

  return elements
    .map((raw): OverpassPlace | null => {
      const el = raw as OverpassElement;
      const name = el.tags?.name;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (!name || typeof lat !== "number" || typeof lon !== "number") return null;

      return {
        name,
        lat,
        lon,
        cuisine: el.tags?.cuisine,
        openingHours: el.tags?.opening_hours,
        street: el.tags?.["addr:street"],
      };
    })
    .filter((p): p is OverpassPlace => p !== null);
}

/**
 * I candidati di una sera, scelti in casa dall'elenco condiviso: nessuna rete, solo
 * aritmetica. È questo passo a rendere possibile una sola interrogazione per l'itinerario.
 */
export function selectNearbyCandidates(
  places: OverpassPlace[],
  lat: number,
  lon: number
): DinnerCandidate[] {
  return places
    .map((p) => ({
      name: p.name,
      distanceMeters: distanceMeters(lat, lon, p.lat, p.lon),
      lat: p.lat,
      lon: p.lon,
      cuisine: p.cuisine,
      openingHours: p.openingHours,
      street: p.street,
    }))
    .filter((c) => c.distanceMeters <= SEARCH_RADIUS_METERS)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_CANDIDATES)
    .map((c, index) => ({ id: index + 1, ...c }));
}

/**
 * Sull'istanza pubblica di allora (overpass-api.de, fino al 2026-11-13) i tempi di risposta
 * erano molto variabili e i fallimenti frequenti: misurate risposte fra 0,8s e 27s, più `429`
 * che arrivavano dopo 12-14 secondi di attesa. Su overpass.ch non è stato rimisurato. Il
 * timeout e la rinuncia silenziosa sono la protezione: una giornata senza consiglio è
 * accettabile, mezzo minuto di attesa per un errore no. Il tetto vero lo decide il chiamante
 * (`OVERPASS_TIMEOUT_MS` nella route), che deve stare nel proprio budget.
 */
async function interroga(filtro: string, timeoutMs: number): Promise<OverpassPlace[]> {
  const query = `[out:json][timeout:25];(node["amenity"="restaurant"]${filtro};way["amenity"="restaurant"]${filtro};);out center tags;`;

  // trim: uno spazio o un a capo incollato per errore nella variabile romperebbe l'indirizzo.
  const chiave = process.env.OVERPASS_API_KEY?.trim();
  if (!chiave) {
    console.error("Consigli cena: nessuna chiave Overpass configurata (OVERPASS_API_KEY)");
    return [];
  }

  try {
    const response = await fetch(overpassUrl(chiave), {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.error(`Consigli cena: Overpass ha risposto ${response.status}`);
      return [];
    }

    return parseOverpassPlaces(await response.json());
  } catch (error) {
    // Solo il messaggio, e ripulito: l'errore intero può portarsi dietro l'indirizzo con la chiave.
    const messaggio = (error instanceof Error ? `${error.name}: ${error.message}` : String(error))
      .split(chiave)
      .join("<chiave>");
    console.error(`Consigli cena: interrogazione Overpass fallita (${messaggio})`);
    return [];
  }
}

/**
 * L'interrogazione che serve tutto l'itinerario: un rettangolo, una richiesta. Le sei
 * richieste `around` ravvicinate misurate il 2026-08-26 producevano due `429` per pura
 * autolimitazione; una sola non ha nessuno con cui competere.
 *
 * È rimasta **l'unica** forma di interrogazione: dal 2026-08-26 anche le tappe troppo
 * lontane per il rettangolo comune ricevono un rettangolo proprio invece di un `around`
 * ciascuna (vedi `raggruppaPerRiquadri`). Una tappa isolata dà un rettangolo di 1,6 km per
 * lato, cioè 2,56 km²: costa quanto costava il raggio, e non moltiplica le richieste.
 */
export function fetchPlacesInBoundingBox(riquadro: Riquadro, timeoutMs: number): Promise<OverpassPlace[]> {
  const { sud, ovest, nord, est } = riquadro;
  return interroga(`(${sud},${ovest},${nord},${est})`, timeoutMs);
}
