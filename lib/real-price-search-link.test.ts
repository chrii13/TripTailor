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
});
