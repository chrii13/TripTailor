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
