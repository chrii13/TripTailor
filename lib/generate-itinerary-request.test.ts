import { describe, it, expect } from "vitest";
import { generateItineraryRequestSchema } from "./generate-itinerary-request";

const baseValidBody = {
  destination: "Roma",
  dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
  participants: [{ type: "adulto", age: 35 }],
  budget: 1000,
  styleNotes: "",
};

describe("generateItineraryRequestSchema", () => {
  it("accetta un corpo valido con date come stringhe ISO e le converte in Date", () => {
    const result = generateItineraryRequestSchema.safeParse(baseValidBody);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateRange.from).toBeInstanceOf(Date);
      expect(result.data.dateRange.to).toBeInstanceOf(Date);
    }
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
      dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-16T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });

  it("accetta un viaggio di esattamente 14 giorni", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-14T00:00:00.000Z" },
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta una data di fine precedente alla data di inizio", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-09-05T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });
});
