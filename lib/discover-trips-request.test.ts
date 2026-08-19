import { describe, it, expect } from "vitest";
import { discoverTripsRequestSchema, VACATION_TYPES, getRequestNights } from "./discover-trips-request";

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

  it("accetta un tipo di vacanza libero, non solo quelli previsti", () => {
    const result = discoverTripsRequestSchema.safeParse({ ...validBody, vacationType: "crociera" });
    expect(result.success).toBe(true);
  });

  it("rifiuta un tipo di vacanza troppo lungo", () => {
    const result = discoverTripsRequestSchema.safeParse({
      ...validBody,
      vacationType: "a".repeat(101),
    });
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

  describe("periodo flessibile", () => {
    const flexibleBody = {
      departureCity: "Milano, Italia",
      flexiblePeriod: { month: "2026-10", nights: 7 },
      participants: [{ type: "adulto", age: 35 }],
      budget: 1500,
    };

    it("accetta una richiesta con periodo flessibile e senza dateRange", () => {
      expect(discoverTripsRequestSchema.safeParse(flexibleBody).success).toBe(true);
    });

    it("rifiuta una richiesta con sia dateRange che flexiblePeriod", () => {
      const result = discoverTripsRequestSchema.safeParse({
        ...validBody,
        flexiblePeriod: { month: "2026-10", nights: 7 },
      });
      expect(result.success).toBe(false);
    });

    it("rifiuta una richiesta senza dateRange né flexiblePeriod", () => {
      const withoutDates = {
        departureCity: validBody.departureCity,
        participants: validBody.participants,
        budget: validBody.budget,
      };
      const result = discoverTripsRequestSchema.safeParse(withoutDates);
      expect(result.success).toBe(false);
    });

    it("rifiuta un mese non nel formato YYYY-MM", () => {
      const result = discoverTripsRequestSchema.safeParse({
        ...flexibleBody,
        flexiblePeriod: { month: "ottobre 2026", nights: 7 },
      });
      expect(result.success).toBe(false);
    });

    it("rifiuta un numero di notti inferiore a 1", () => {
      const result = discoverTripsRequestSchema.safeParse({
        ...flexibleBody,
        flexiblePeriod: { month: "2026-10", nights: 0 },
      });
      expect(result.success).toBe(false);
    });

    it("accetta il massimo di notti consentito (13, un giorno in meno del massimo di 14 giorni)", () => {
      const result = discoverTripsRequestSchema.safeParse({
        ...flexibleBody,
        flexiblePeriod: { month: "2026-10", nights: 13 },
      });
      expect(result.success).toBe(true);
    });

    it("rifiuta un numero di notti superiore al massimo consentito", () => {
      const result = discoverTripsRequestSchema.safeParse({
        ...flexibleBody,
        flexiblePeriod: { month: "2026-10", nights: 14 },
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("getRequestNights", () => {
  it("calcola le notti da un intervallo di date esatte", () => {
    const request = discoverTripsRequestSchema.parse(validBody);
    expect(getRequestNights(request)).toBe(4);
  });

  it("usa direttamente il numero di notti quando il periodo è flessibile", () => {
    const request = discoverTripsRequestSchema.parse({
      departureCity: "Milano, Italia",
      flexiblePeriod: { month: "2026-10", nights: 7 },
      participants: [{ type: "adulto", age: 35 }],
      budget: 1500,
    });
    expect(getRequestNights(request)).toBe(7);
  });
});
