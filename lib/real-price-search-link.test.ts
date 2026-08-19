import { describe, it, expect } from "vitest";
import { buildRealPriceSearchQuery, buildRealPriceSearchUrl } from "./real-price-search-link";

describe("buildRealPriceSearchQuery", () => {
  it("compone città di partenza, destinazione e data in italiano", () => {
    expect(
      buildRealPriceSearchQuery("Milano", "Vienna", new Date("2026-09-20T00:00:00"))
    ).toBe("viaggio Milano Vienna 20 settembre 2026");
  });

  it("non nomina un mezzo di trasporto specifico", () => {
    const query = buildRealPriceSearchQuery("Roma", "Tokyo", new Date("2026-12-01T00:00:00"));
    expect(query).not.toMatch(/volo|flight|aereo/i);
  });

  it("riduce la città di partenza al primo segmento quando arriva come 'Città, Paese'", () => {
    const query = buildRealPriceSearchQuery(
      "Milano, Italia",
      "Barcellona",
      new Date("2026-09-30T00:00:00")
    );
    expect(query).toBe("viaggio Milano Barcellona 30 settembre 2026");
  });

  it("riduce la città di partenza al primo segmento anche con una stringa amministrativa lunga", () => {
    const query = buildRealPriceSearchQuery(
      "Città Metropolitana di Roma Capitale, Lazio, Italia",
      "Vienna",
      new Date("2026-09-20T00:00:00")
    );
    expect(query).toBe("viaggio Città Metropolitana di Roma Capitale Vienna 20 settembre 2026");
  });

  it("aggiunge il paese di destinazione quando fornito", () => {
    const query = buildRealPriceSearchQuery(
      "Milano",
      "Valencia",
      new Date("2026-09-30T00:00:00"),
      "Spagna"
    );
    expect(query).toBe("viaggio Milano Valencia Spagna 30 settembre 2026");
  });
});

describe("buildRealPriceSearchUrl", () => {
  it("produce un URL di ricerca Google semplice, non Google Flights", () => {
    const url = buildRealPriceSearchUrl("Milano", "Vienna", new Date("2026-09-20T00:00:00"));
    expect(url).toBe(
      "https://www.google.com/search?q=viaggio%20Milano%20Vienna%2020%20settembre%202026"
    );
    expect(url).not.toContain("flights");
  });

  it("effettua l'escaping di caratteri speciali nella destinazione", () => {
    const url = buildRealPriceSearchUrl(
      "Milano",
      "São Paulo, Brasile",
      new Date("2026-05-05T00:00:00")
    );
    expect(url).toContain(encodeURIComponent("São Paulo, Brasile"));
    expect(url).not.toContain(" ");
  });

  it("riduce la città di partenza al primo segmento e aggiunge il paese di destinazione", () => {
    const url = buildRealPriceSearchUrl(
      "Milano, Italia",
      "Barcellona",
      new Date("2026-09-30T00:00:00"),
      "Spagna"
    );
    expect(url).toBe(
      "https://www.google.com/search?q=" +
        encodeURIComponent("viaggio Milano Barcellona Spagna 30 settembre 2026")
    );
  });
});
