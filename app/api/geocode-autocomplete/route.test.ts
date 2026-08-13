import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/geocode-autocomplete", () => {
  it("restituisce un array vuoto senza chiamare LocationIQ quando la query è assente", async () => {
    const request = new Request("http://localhost/api/geocode-autocomplete");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([]);
  });

  it("restituisce un array vuoto senza chiamare LocationIQ quando la query è troppo corta", async () => {
    const request = new Request("http://localhost/api/geocode-autocomplete?q=ro");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([]);
  });
});
