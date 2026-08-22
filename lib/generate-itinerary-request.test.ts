import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { generateItineraryRequestSchema } from "./generate-itinerary-request";

/**
 * Da quando lo schema rifiuta le date passate, le date fisse dei casi di prova
 * hanno una scadenza: l'orologio resta fermo a prima di quelle date.
 */
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

const baseValidBody = {
  destination: "Roma",
  dateRange: { from: "2026-09-01", to: "2026-09-05" },
  participants: [{ type: "adulto", age: 35 }],
  budget: 1000,
  styleNotes: "",
};

describe("generateItineraryRequestSchema", () => {
  it("accetta un corpo valido con date yyyy-MM-dd e le converte in mezzanotte locale", () => {
    const result = generateItineraryRequestSchema.safeParse(baseValidBody);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateRange.from).toEqual(new Date(2026, 8, 1));
      expect(result.data.dateRange.to).toEqual(new Date(2026, 8, 5));
    }
  });

  it("rifiuta una data con ora e fuso, che farebbe slittare il giorno", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta una data inesistente invece di farla scivolare al mese dopo", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-02-31", to: "2026-03-02" },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta una destinazione vuota", () => {
    const result = generateItineraryRequestSchema.safeParse({ ...baseValidBody, destination: "" });
    expect(result.success).toBe(false);
  });

  it("rifiuta zero partecipanti", () => {
    const result = generateItineraryRequestSchema.safeParse({ ...baseValidBody, participants: [] });
    expect(result.success).toBe(false);
  });

  it("rifiuta un viaggio di più di 14 giorni", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-09-01", to: "2026-09-16" },
    });
    expect(result.success).toBe(false);
  });

  it("accetta un viaggio di esattamente 14 giorni", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-09-01", to: "2026-09-14" },
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta una data di fine precedente alla data di inizio", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-09-05", to: "2026-09-01" },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta più di 20 partecipanti", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      participants: Array.from({ length: 21 }, () => ({ type: "adulto", age: 35 })),
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un viaggio nel passato costruito a mano", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2020-01-10", to: "2020-01-15" },
    });
    expect(result.success).toBe(false);
  });

  it("accetta un viaggio che comincia oggi", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-08-01", to: "2026-08-05" },
    });
    expect(result.success).toBe(true);
  });

  it("accetta un corpo con orario di arrivo e partenza e li passa invariati", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      arrivalTime: "15:30",
      departureTime: "09:00",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.arrivalTime).toBe("15:30");
      expect(result.data.departureTime).toBe("09:00");
    }
  });

  it("rifiuta un orario di arrivo troppo lungo", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      arrivalTime: "123456",
    });
    expect(result.success).toBe(false);
  });
});
