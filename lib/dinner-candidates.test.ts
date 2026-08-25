import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDinnerCandidates, MAX_CANDIDATES, parseOverpassRestaurants } from "./dinner-candidates";

// Il punto di riferimento dei test: Ribeira, Porto.
const LAT = 41.1404;
const LON = -8.6115;

function elemento(name: string | undefined, lat: number, lon: number, tags = {}) {
  return { type: "node", id: 1, lat, lon, tags: { amenity: "restaurant", ...(name ? { name } : {}), ...tags } };
}

describe("parseOverpassRestaurants", () => {
  it("scarta i locali senza nome: un consiglio senza nome non è un consiglio", () => {
    const json = { elements: [elemento(undefined, LAT, LON), elemento("Adega São Nicolau", LAT, LON)] };
    const out = parseOverpassRestaurants(json, LAT, LON);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Adega São Nicolau");
  });

  it("ordina per distanza crescente", () => {
    const json = {
      elements: [
        elemento("Lontano", LAT + 0.004, LON),
        elemento("Vicino", LAT + 0.0005, LON),
      ],
    };
    expect(parseOverpassRestaurants(json, LAT, LON).map((c) => c.name)).toEqual(["Vicino", "Lontano"]);
  });

  it("assegna identificativi progressivi da 1: il modello sceglie per id, non per nome", () => {
    const json = { elements: [elemento("A", LAT, LON), elemento("B", LAT + 0.001, LON)] };
    expect(parseOverpassRestaurants(json, LAT, LON).map((c) => c.id)).toEqual([1, 2]);
  });

  it("tronca a MAX_CANDIDATES tenendo i più vicini, non i primi dell'array: a Porto ce n'erano 161 entro 500 m", () => {
    // Ordine di arrivo dal più lontano (R0) al più vicino (R39): l'opposto dell'ordine
    // per distanza. Se l'implementazione troncasse prima di ordinare, sopravvivrebbero
    // R0..R11 (i primi dell'array, cioè i più lontani) invece dei 12 realmente più vicini.
    const elements = Array.from({ length: 40 }, (_, i) => elemento(`R${i}`, LAT + (39 - i) * 0.0001, LON));
    const out = parseOverpassRestaurants({ elements }, LAT, LON);
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
    const [conDati, nudo] = parseOverpassRestaurants(json, LAT, LON);
    expect(conDati.cuisine).toBe("regional");
    expect(conDati.openingHours).toBe("Mo-Su 19:00-23:00");
    expect(conDati.street).toBe("Rua São Nicolau");
    expect(nudo.cuisine).toBeUndefined();
    expect(nudo.openingHours).toBeUndefined();
  });

  it("usa il centro delle way, che non hanno lat/lon proprie", () => {
    const json = { elements: [{ type: "way", id: 9, center: { lat: LAT, lon: LON }, tags: { amenity: "restaurant", name: "In un edificio" } }] };
    expect(parseOverpassRestaurants(json, LAT, LON)).toHaveLength(1);
  });

  it("non esplode su una risposta malformata", () => {
    expect(parseOverpassRestaurants({}, LAT, LON)).toEqual([]);
    expect(parseOverpassRestaurants(null, LAT, LON)).toEqual([]);
    expect(parseOverpassRestaurants({ elements: "non un array" }, LAT, LON)).toEqual([]);
  });
});

describe("fetchDinnerCandidates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Senza User-Agent Overpass risponde 406 a *ogni* richiesta, cioè la funzionalità è
  // morta in produzione con la suite tutta verde: è successo davvero il 2026-08-25.
  // Questo test è l'unica rete contro il ritorno di quel difetto, perché il resto della
  // suite guarda solo il corpo della risposta.
  it("si presenta con uno User-Agent: senza, Overpass risponde 406", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDinnerCandidates(LAT, LON, 5_000);

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["User-Agent"]).toBeTruthy();
  });
});
