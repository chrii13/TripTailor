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

// Misurato il 2026-11-15 su 44 zone turistiche: LocationIQ risolve i nomi di zona senza
// confine amministrativo sull'omonimo o su una strada, e meteo e cena finivano nel posto
// sbagliato senza alcun errore.
describe("geocodeDestination: le zone turistiche", () => {
  const chiaveOriginale = process.env.LOCATIONIQ_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (chiaveOriginale === undefined) delete process.env.LOCATIONIQ_API_KEY;
    else process.env.LOCATIONIQ_API_KEY = chiaveOriginale;
  });

  async function domandaInviata(destinazione: string) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    process.env.LOCATIONIQ_API_KEY = "chiave-finta";
    await geocodeDestination(destinazione);
    return new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("q");
  }

  async function geocodifica(risultato: Record<string, unknown>) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [risultato] }));
    process.env.LOCATIONIQ_API_KEY = "chiave-finta";
    return geocodeDestination("una destinazione");
  }

  it.each([
    ["Salento, Italia", "Lecce, Italia"],
    ["Salento", "Lecce, Italia"],
    ["  SALENTO ,  italia ", "Lecce, Italia"],
    ["Maremma, Italia", "Grosseto, Italia"],
    ["Riviera Romagnola, Italia", "Rimini, Italia"],
    ["Versilia, Italia", "Viareggio, Italia"],
    ["Costa Smeralda, Italia", "Porto Cervo, Italia"],
    ["Costiera Amalfitana, Italia", "Amalfi, Italia"],
    ["Cotswolds, Regno Unito", "Cirencester, Regno Unito"],
    ["Cicladi, Grecia", "Grecia"],
    ["Patagonia, Argentina", "Argentina"],
    // Le scritture che aggiravano la tabella: paese in inglese, regione in mezzo, accento,
    // spazio doppio, virgola in coda.
    ["Salento, Italy", "Lecce, Italia"],
    ["Salento, Puglia, Italia", "Lecce, Italia"],
    ["Cotswolds, Inghilterra", "Cirencester, Regno Unito"],
    ["Cìcladi, Grecia", "Grecia"],
    ["Costiera  Amalfitana", "Amalfi, Italia"],
    ["Salento, Italia, ", "Lecce, Italia"],
  ])("«%s» si cerca come «%s»", async (destinazione, attesa) => {
    expect(await domandaInviata(destinazione)).toBe(attesa);
  });

  it("Salento in Colombia è una città vera e si cerca col suo nome", async () => {
    expect(await domandaInviata("Salento, Colombia")).toBe("Salento, Colombia");
  });

  it.each(["Lecce, Italia", "constructor", "__proto__"])(
    "«%s» non è in tabella e si cerca com'è scritta",
    async (destinazione) => {
      expect(await domandaInviata(destinazione)).toBe(destinazione);
    }
  );

  // Misurato lo stesso giorno: per «Lecce, Italia», «Siena, Italia», «Rimini, Italia» il primo
  // risultato è la PROVINCIA, e la città viene seconda. Il baricentro della provincia di Lecce
  // sta in campagna, a 23 km dalla città.
  describe("il capoluogo che arriva dopo la sua provincia", () => {
    const provincia = {
      lat: "40.1522",
      lon: "18.2260",
      class: "boundary",
      display_name: "Lecce, Puglia, Italia",
      boundingbox: ["39.78", "40.52", "17.76", "18.53"],
      address: { county: "Lecce", state: "Puglia", country_code: "it" },
    };
    const citta = {
      lat: "40.3570",
      lon: "18.1718",
      class: "boundary",
      display_name: "Lecce, Puglia, 73100, Italia",
      boundingbox: ["40.31", "40.51", "18.03", "18.31"],
      address: { city: "Lecce", county: "Lecce", state: "Puglia", country_code: "it" },
    };

    async function geocodificaElenco(risultati: Record<string, unknown>[]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => risultati }));
      process.env.LOCATIONIQ_API_KEY = "chiave-finta";
      return geocodeDestination("una destinazione");
    }

    it("vince la città omonima dentro la provincia", async () => {
      expect(await geocodificaElenco([provincia, citta])).toEqual({ lat: 40.357, lon: 18.1718, countryCode: "IT" });
    });

    // Il caso che cambia davvero l'esito: il riquadro della provincia di Grosseto (~9.600 km²)
    // sta sopra la soglia dei luoghi, quindi senza la città resterebbe senza coordinate.
    it("Grosseto: una provincia troppo grande per avere coordinate le prende dalla sua città", async () => {
      const grande = { ...provincia, boundingbox: ["42.2376", "43.1891", "10.7063", "11.8202"] };
      const dentro = { ...citta, lat: "42.7597", lon: "11.1137" };
      expect(await geocodificaElenco([grande])).toEqual({ lat: null, lon: null, countryCode: "IT" });
      expect(await geocodificaElenco([grande, dentro])).toEqual({ lat: 42.7597, lon: 11.1137, countryCode: "IT" });
    });

    // «Molise, Italia»: la regione viene prima, e il secondo risultato è il comune di Molise,
    // un paese di dieci km². Solo una «city» può fare da capoluogo.
    it("un paesino omonimo non sostituisce la regione", async () => {
      const paesino = { ...citta, address: { village: "Lecce", county: "Lecce", country_code: "it" } };
      expect(await geocodificaElenco([provincia, paesino])).toEqual({ lat: 40.1522, lon: 18.226, countryCode: "IT" });
    });

    // Gibuti misura 42.700 km², sotto il tetto d'area: a tenerlo fuori è l'indirizzo senza
    // «state» né «county», che è la firma di un paese.
    it("Gibuti: un paese piccolo non diventa la sua capitale omonima", async () => {
      const paese = {
        lat: "11.81",
        lon: "42.6",
        display_name: "Djibouti",
        boundingbox: ["10.9", "12.7", "41.7", "43.7"],
        address: { country: "Djibouti", country_code: "dj" },
      };
      const capitale = { lat: "11.5937", lon: "43.1473", display_name: "Djibouti, Djibouti", address: { city: "Djibouti", country_code: "dj" } };
      expect(await geocodificaElenco([paese, capitale])).toEqual({ lat: null, lon: null, countryCode: "DJ" });
    });

    it("oltre il tetto d'area uno stato non diventa la sua città omonima", async () => {
      const stato = { ...provincia, boundingbox: ["38.0", "41.0", "16.0", "19.0"] };
      expect(await geocodificaElenco([stato, citta])).toEqual({ lat: null, lon: null, countryCode: "IT" });
    });

    it("una città con un altro nome non la sostituisce", async () => {
      const out = await geocodificaElenco([provincia, { ...citta, display_name: "Gallipoli, Lecce, Puglia, Italia" }]);
      expect(out).toEqual({ lat: 40.1522, lon: 18.226, countryCode: "IT" });
    });

    it("un'omonima fuori dal riquadro non la sostituisce: è un altro posto", async () => {
      const out = await geocodificaElenco([provincia, { ...citta, lat: "45.5", lon: "9.2" }]);
      expect(out).toEqual({ lat: 40.1522, lon: 18.226, countryCode: "IT" });
    });

    it("un paese non diventa la sua capitale omonima: resta senza coordinate", async () => {
      const paese = {
        lat: "8.55",
        lon: "-80.1",
        display_name: "Panamá",
        boundingbox: ["5.5", "9.9", "-83.1", "-77.1"],
        address: { country: "Panamá", country_code: "pa" },
      };
      const capitale = {
        lat: "8.97",
        lon: "-79.53",
        display_name: "Panamá, Provincia de Panamá, Panamá",
        address: { city: "Panamá", country_code: "pa" },
      };
      expect(await geocodificaElenco([paese, capitale])).toEqual({ lat: null, lon: null, countryCode: "PA" });
    });

    it("chiede tre risultati, altrimenti la città non arriva mai", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
      vi.stubGlobal("fetch", fetchMock);
      process.env.LOCATIONIQ_API_KEY = "chiave-finta";
      await geocodeDestination("Lecce, Italia");
      expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("limit")).toBe("3");
    });
  });

  // «Cotswolds» tornava come una via di Hatfield, «Costa Smeralda» come l'aeroporto di Olbia:
  // l'indirizzo di una strada nomina una città, quindi senza questo filtro passano.
  it.each(["highway", "aeroway"])("un risultato di classe %s non dà coordinate", async (classe) => {
    const out = await geocodifica({
      lat: "51.75",
      lon: "-0.23",
      class: classe,
      boundingbox: ["51.74", "51.76", "-0.24", "-0.22"],
      address: { town: "Hatfield", country_code: "gb" },
    });
    expect(out).toEqual({ lat: null, lon: null, countryCode: "GB" });
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
