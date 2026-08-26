import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_CANDIDATES,
  SEARCH_RADIUS_METERS,
  fetchPlacesInBoundingBox,
  parseOverpassPlaces,
  selectNearbyCandidates,
} from "./dinner-candidates";

// Il punto di riferimento dei test: Ribeira, Porto.
const LAT = 41.1404;
const LON = -8.6115;

function elemento(name: string | undefined, lat: number, lon: number, tags = {}) {
  return { type: "node", id: 1, lat, lon, tags: { amenity: "restaurant", ...(name ? { name } : {}), ...tags } };
}

// I due passi si compongono sempre così: si legge la risposta una volta sola, e poi si
// sceglie da quell'unico elenco una sera per volta.
function candidati(json: unknown, lat = LAT, lon = LON) {
  return selectNearbyCandidates(parseOverpassPlaces(json), lat, lon);
}

describe("parseOverpassPlaces", () => {
  it("scarta i locali senza nome: un consiglio senza nome non è un consiglio", () => {
    const json = { elements: [elemento(undefined, LAT, LON), elemento("Adega São Nicolau", LAT, LON)] };
    const out = parseOverpassPlaces(json);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Adega São Nicolau");
  });

  it("usa il centro delle way, che non hanno lat/lon proprie", () => {
    const json = { elements: [{ type: "way", id: 9, center: { lat: LAT, lon: LON }, tags: { amenity: "restaurant", name: "In un edificio" } }] };
    expect(parseOverpassPlaces(json)).toHaveLength(1);
  });

  it("non esplode su una risposta malformata", () => {
    expect(parseOverpassPlaces({})).toEqual([]);
    expect(parseOverpassPlaces(null)).toEqual([]);
    expect(parseOverpassPlaces({ elements: "non un array" })).toEqual([]);
  });

  // parseOverpassPlaces non conosce nessun punto di riferimento: è il presupposto
  // dell'interrogazione unica sul rettangolo, dove la stessa risposta serve tutte le sere.
  it("non calcola distanze: la risposta è una sola per tutte le sere", () => {
    const [luogo] = parseOverpassPlaces({ elements: [elemento("Uno", LAT, LON)] });
    expect(luogo).not.toHaveProperty("distanceMeters");
    expect(luogo.lat).toBe(LAT);
    expect(luogo.lon).toBe(LON);
  });
});

describe("selectNearbyCandidates", () => {
  it("ordina per distanza crescente", () => {
    const json = {
      elements: [
        elemento("Lontano", LAT + 0.004, LON),
        elemento("Vicino", LAT + 0.0005, LON),
      ],
    };
    expect(candidati(json).map((c) => c.name)).toEqual(["Vicino", "Lontano"]);
  });

  it("assegna identificativi progressivi da 1: il modello sceglie per id, non per nome", () => {
    const json = { elements: [elemento("A", LAT, LON), elemento("B", LAT + 0.001, LON)] };
    expect(candidati(json).map((c) => c.id)).toEqual([1, 2]);
  });

  it("tronca a MAX_CANDIDATES tenendo i più vicini, non i primi dell'array: a Porto ce n'erano 161 entro 500 m", () => {
    // Ordine di arrivo dal più lontano (R0) al più vicino (R39): l'opposto dell'ordine
    // per distanza. Se l'implementazione troncasse prima di ordinare, sopravvivrebbero
    // R0..R11 (i primi dell'array, cioè i più lontani) invece dei 12 realmente più vicini.
    const elements = Array.from({ length: 40 }, (_, i) => elemento(`R${i}`, LAT + (39 - i) * 0.0001, LON));
    const out = candidati({ elements });
    expect(out).toHaveLength(MAX_CANDIDATES);
    const attesi = Array.from({ length: MAX_CANDIDATES }, (_, i) => `R${39 - i}`); // R39 (più vicino) ... R28
    expect(out.map((c) => c.name)).toEqual(attesi);
  });

  it("riporta i campi opzionali solo quando ci sono: il 71% dei locali non ha la cucina", () => {
    const json = {
      elements: [
        elemento("Con dati", LAT, LON, { cuisine: "regional", opening_hours: "Mo-Su 19:00-23:00", "addr:street": "Rua São Nicolau" }),
        elemento("Nudo", LAT + 0.001, LON),
      ],
    };
    const [conDati, nudo] = candidati(json);
    expect(conDati.cuisine).toBe("regional");
    expect(conDati.openingHours).toBe("Mo-Su 19:00-23:00");
    expect(conDati.street).toBe("Rua São Nicolau");
    expect(nudo.cuisine).toBeUndefined();
    expect(nudo.openingHours).toBeUndefined();
  });

  // Con l'interrogazione `around` era Overpass a garantire il raggio; sul rettangolo
  // condiviso la risposta copre tutte le tappe, quindi il filtro deve farlo questa
  // funzione. Senza, una sera si vedrebbe consigliato un locale a chilometri di distanza,
  // dall'altra parte dell'itinerario.
  it("scarta i locali oltre il raggio di ricerca: il rettangolo è largo, la sera no", () => {
    const oltre = SEARCH_RADIUS_METERS + 400;
    const json = {
      elements: [
        elemento("A due passi", LAT, LON),
        elemento("Dall'altra parte", LAT + oltre / 111_320, LON),
      ],
    };
    expect(candidati(json).map((c) => c.name)).toEqual(["A due passi"]);
  });

  it("due sere vicine pescano dallo stesso elenco, ciascuna coi propri più vicini", () => {
    const luoghi = parseOverpassPlaces({
      elements: [
        elemento("Nord", LAT + 0.002, LON),
        elemento("Sud", LAT - 0.002, LON),
      ],
    });

    expect(selectNearbyCandidates(luoghi, LAT + 0.002, LON).map((c) => c.name)).toEqual(["Nord", "Sud"]);
    expect(selectNearbyCandidates(luoghi, LAT - 0.002, LON).map((c) => c.name)).toEqual(["Sud", "Nord"]);
  });
});

describe("interrogazioni Overpass", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch() {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const corpoInviato = (fetchMock: ReturnType<typeof mockFetch>) =>
    (fetchMock.mock.calls[0][1].body as URLSearchParams).get("data") ?? "";

  // Senza User-Agent Overpass risponde 406 a *ogni* richiesta, cioè la funzionalità è
  // morta in produzione con la suite tutta verde: è successo davvero il 2026-08-25.
  // Questo test è l'unica rete contro il ritorno di quel difetto, perché il resto della
  // suite guarda solo il corpo della risposta.
  it("si presenta con uno User-Agent: senza, Overpass risponde 406", async () => {
    const fetchMock = mockFetch();
    await fetchPlacesInBoundingBox({ sud: 41, ovest: -9, nord: 42, est: -8 }, 5_000);
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>)["User-Agent"]).toBeTruthy();
  });

  it("scrive il rettangolo nell'ordine che Overpass si aspetta: sud,ovest,nord,est", async () => {
    const fetchMock = mockFetch();
    await fetchPlacesInBoundingBox({ sud: 41.1, ovest: -8.7, nord: 41.2, est: -8.5 }, 5_000);
    expect(corpoInviato(fetchMock)).toContain("(41.1,-8.7,41.2,-8.5)");
  });

  it("interroga il rettangolo una volta sola per nodi e way", async () => {
    const fetchMock = mockFetch();
    await fetchPlacesInBoundingBox({ sud: 41.1, ovest: -8.7, nord: 41.2, est: -8.5 }, 5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Dal 2026-08-26 il rettangolo è l'unica forma di interrogazione: anche una tappa isolata
  // ne riceve uno proprio (1,6 km per lato) invece di un `around`, così due grappoli di
  // tappe distanti costano due richieste e non una per tappa. Il raggio di ricerca resta,
  // ma lo applica `selectNearbyCandidates` in casa.
  it("non usa più interrogazioni a raggio: il rettangolo è l'unica forma", async () => {
    const fetchMock = mockFetch();
    await fetchPlacesInBoundingBox({ sud: 41.1, ovest: -8.7, nord: 41.2, est: -8.5 }, 5_000);
    expect(corpoInviato(fetchMock)).not.toContain("around:");
  });

  it("un errore di Overpass diventa un elenco vuoto, mai un'eccezione", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchPlacesInBoundingBox({ sud: 41, ovest: -9, nord: 42, est: -8 }, 5_000)).resolves.toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(
      fetchPlacesInBoundingBox({ sud: 41, ovest: -9, nord: 42, est: -8 }, 5_000)
    ).resolves.toEqual([]);
  });
});
