import { describe, it, expect } from "vitest";
import { discoverTripsRequestSchema, VACATION_TYPES } from "./discover-trips-request";

const validBody = {
  departureCity: "Milano, Italia",
  dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
  participants: [{ type: "adulto", age: 35 }],
  budget: 1500,
};

describe("discoverTripsRequestSchema", () => {
  it("accetta una richiesta valida senza tipo di vacanza", () => {
    expect(discoverTripsRequestSchema.safeParse(validBody).success).toBe(true);
  });

  it("accetta ogni tipo di vacanza previsto", () => {
    for (const vacationType of VACATION_TYPES) {
      const result = discoverTripsRequestSchema.safeParse({ ...validBody, vacationType });
      expect(result.success, `tipo di vacanza rifiutato: ${vacationType}`).toBe(true);
    }
  });

  it("rifiuta un tipo di vacanza non previsto", () => {
    const result = discoverTripsRequestSchema.safeParse({ ...validBody, vacationType: "crociera" });
    expect(result.success).toBe(false);
  });

  it("rifiuta una città di partenza vuota", () => {
    const result = discoverTripsRequestSchema.safeParse({ ...validBody, departureCity: "   " });
    expect(result.success).toBe(false);
  });

  it("rifiuta un budget negativo", () => {
    expect(discoverTripsRequestSchema.safeParse({ ...validBody, budget: -1 }).success).toBe(false);
  });

  it("rifiuta un intervallo di date invertito", () => {
    const result = discoverTripsRequestSchema.safeParse({
      ...validBody,
      dateRange: { from: "2026-09-05T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un viaggio più lungo del massimo consentito", () => {
    const result = discoverTripsRequestSchema.safeParse({
      ...validBody,
      dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un partecipante con età fuori dalla fascia del suo tipo", () => {
    const result = discoverTripsRequestSchema.safeParse({
      ...validBody,
      participants: [{ type: "bambino", age: 40 }],
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un elenco di partecipanti vuoto", () => {
    expect(discoverTripsRequestSchema.safeParse({ ...validBody, participants: [] }).success).toBe(false);
  });
});
