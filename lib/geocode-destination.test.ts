import { describe, it, expect, vi, afterEach } from "vitest";
import { geocodeDestination, geocodePlaceNear } from "./geocode-destination";

describe("geocodeDestination", () => {
  it("restituisce null senza chiamare LocationIQ quando la chiave non è configurata", async () => {
    const originalKey = process.env.LOCATIONIQ_API_KEY;
    delete process.env.LOCATIONIQ_API_KEY;

    try {
      const result = await geocodeDestination("Roma, Italia");
      expect(result).toBeNull();
    } finally {
      if (originalKey !== undefined) {
        process.env.LOCATIONIQ_API_KEY = originalKey;
      }
    }
  });
});

// Le forme sono quelle misurate con chiamate vere a LocationIQ il 2026-11-14: Tokyo torna
// come «province» con un riquadro che arriva alle isole Ogasawara, Shanghai come «locality»,
// Singapore con il solo paese. Fino a quel giorno tutte e tre restavano senza coordinate,
// cioè senza meteo, senza valigia e senza consigli sulla cena.
describe("geocodeDestination: quando le coordinate sono affidabili", () => {
  const chiaveOriginale = process.env.LOCATIONIQ_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (chiaveOriginale === undefined) delete process.env.LOCATIONIQ_API_KEY;
    else process.env.LOCATIONIQ_API_KEY = chiaveOriginale;
  });

  async function geocodifica(risultato: Record<string, unknown>) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [risultato] }));
    process.env.LOCATIONIQ_API_KEY = "chiave-finta";
    return geocodeDestination("una destinazione");
  }

  it("una città ha le sue coordinate", async () => {
    const out = await geocodifica({
      lat: "44.4938",
      lon: "11.3426",
      boundingbox: ["44.42", "44.55", "11.23", "11.43"],
      address: { city: "Bologna", state: "Emilia-Romagna", country_code: "it" },
    });
    expect(out).toEqual({ lat: 44.4938, lon: 11.3426, countryCode: "IT" });
  });

  it("Tokyo: una capitale ha coordinate anche se è schedata come provincia", async () => {
    const out = await geocodifica({
      lat: "35.6768",
      lon: "139.7638",
      boundingbox: ["20.21", "35.90", "135.85", "154.21"],
      address: { province: "Tokyo", country_code: "jp" },
      extratags: { place: "province", capital: "yes" },
    });
    expect(out).toEqual({ lat: 35.6768, lon: 139.7638, countryCode: "JP" });
  });

  it("Shanghai: una «locality» è un luogo preciso", async () => {
    const out = await geocodifica({
      lat: "31.2312",
      lon: "121.47",
      boundingbox: ["30.67", "31.87", "120.85", "122.25"],
      address: { locality: "Shanghai", country_code: "cn" },
    });
    expect(out).toEqual({ lat: 31.2312, lon: 121.47, countryCode: "CN" });
  });

  it("Singapore: un paese grande quanto una città ha le sue coordinate", async () => {
    const out = await geocodifica({
      lat: "1.3571",
      lon: "103.8194",
      boundingbox: ["1.13", "1.51", "103.56", "104.57"],
      address: { country: "Singapore", country_code: "sg" },
    });
    expect(out).toEqual({ lat: 1.3571, lon: 103.8194, countryCode: "SG" });
  });

  it("Toscana: una regione resta senza coordinate, ma col suo paese", async () => {
    const out = await geocodifica({
      lat: "43.4586",
      lon: "11.1389",
      boundingbox: ["42.24", "44.47", "9.69", "12.37"],
      address: { state: "Toscana", country_code: "it" },
    });
    expect(out).toEqual({ lat: null, lon: null, countryCode: "IT" });
  });

  it("Hokkaido: una provincia che non è una capitale resta senza coordinate", async () => {
    const out = await geocodifica({
      lat: "43.4519",
      lon: "142.8197",
      boundingbox: ["41.35", "45.56", "139.33", "148.89"],
      address: { province: "Hokkaido", country_code: "jp" },
      extratags: { place: "province" },
    });
    expect(out).toEqual({ lat: null, lon: null, countryCode: "JP" });
  });

  // Rovesciato (est < ovest, nord < sud) o vuoto darebbe un'area negativa o nulla, che
  // senza guardia passerebbe per «piccola».
  it.each([
    ["assente", undefined],
    ["con tre valori", ["42.0", "43.0", "12.0"]],
    ["con un valore che non è un numero", ["42.0", "43.0", "x", "13.0"]],
    ["rovesciato in longitudine", ["-21.9", "-12.2", "177.0", "-178.0"]],
    ["rovesciato in latitudine", ["43.0", "42.0", "12.0", "13.0"]],
    ["ridotto a un punto", ["42.0", "42.0", "12.0", "12.0"]],
  ])("un riquadro %s non basta a dare coordinate", async (_nome, boundingbox) => {
    const out = await geocodifica({
      lat: "42.6384",
      lon: "12.6743",
      boundingbox,
      address: { country: "Italia", country_code: "it" },
    });
    expect(out).toEqual({ lat: null, lon: null, countryCode: "IT" });
  });

  // I due lati della soglia, con riquadri della taglia di quelli veri: Mosca (~7.200 km²)
  // deve entrare, le Dolomiti (~10.400) restare fuori.
  it("uno stato grande quanto Mosca sta sotto la soglia", async () => {
    const out = await geocodifica({
      lat: "55.62",
      lon: "37.60",
      boundingbox: ["55.1", "56.0", "36.8", "38.0"],
      address: { state: "Mosca", country_code: "ru" },
    });
    expect(out).toEqual({ lat: 55.62, lon: 37.6, countryCode: "RU" });
  });

  it("una regione grande quanto le Dolomiti sta sopra la soglia", async () => {
    const out = await geocodifica({
      lat: "46.5",
      lon: "11.6",
      boundingbox: ["46.0", "47.0", "11.0", "12.3"],
      address: { state: "Trentino-Alto Adige", country_code: "it" },
    });
    expect(out).toEqual({ lat: null, lon: null, countryCode: "IT" });
  });

  it("solo capital=yes vale: un livello amministrativo numerico non è una capitale", async () => {
    const out = await geocodifica({
      lat: "43.4519",
      lon: "142.8197",
      boundingbox: ["41.35", "45.56", "139.33", "148.89"],
      address: { province: "Hokkaido", country_code: "jp" },
      extratags: { capital: "4" },
    });
    expect(out).toEqual({ lat: null, lon: null, countryCode: "JP" });
  });

  // Senza extratags=1 LocationIQ non manda `capital`, e Tokyo torna senza coordinate in
  // produzione con la suite verde: i test qui sopra simulano la risposta, non la richiesta.
  it("chiede a LocationIQ gli extratags, da cui dipende il riconoscimento delle capitali", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    process.env.LOCATIONIQ_API_KEY = "chiave-finta";
    await geocodeDestination("Tokyo, Giappone");
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("extratags")).toBe("1");
  });
});

describe("geocodePlaceNear", () => {
  const chiaveOriginale = process.env.LOCATIONIQ_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (chiaveOriginale === undefined) {
      delete process.env.LOCATIONIQ_API_KEY;
    } else {
      process.env.LOCATIONIQ_API_KEY = chiaveOriginale;
    }
  });

  it("vincola la ricerca alle vicinanze: senza, «Mercado do Bolhão» può finire in un altro continente", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "41.1496", lon: "-8.6109" }],
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.LOCATIONIQ_API_KEY = "chiave-finta";

    const out = await geocodePlaceNear("Mercado do Bolhão", { lat: 41.1404, lon: -8.6115 }, 2500);

    expect(out).toEqual({ lat: 41.1496, lon: -8.6109 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("viewbox")).toBeTruthy();
    expect(url.searchParams.get("bounded")).toBe("1");
  });

  it("restituisce null quando le coordinate non sono numeri: un NaN finirebbe nella query a Overpass", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ lat: "non-un-numero", lon: "-8.61" }],
      })
    );
    process.env.LOCATIONIQ_API_KEY = "chiave-finta";

    expect(await geocodePlaceNear("Tappa malformata", { lat: 41.14, lon: -8.61 }, 2500)).toBeNull();
  });

  it("restituisce null quando LocationIQ non trova nulla, senza lanciare", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    process.env.LOCATIONIQ_API_KEY = "chiave-finta";
    expect(await geocodePlaceNear("Posto inesistente", { lat: 41.14, lon: -8.61 }, 2500)).toBeNull();
  });
});
