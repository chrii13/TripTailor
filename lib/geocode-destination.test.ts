import { describe, it, expect } from "vitest";
import { geocodeDestination } from "./geocode-destination";

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
