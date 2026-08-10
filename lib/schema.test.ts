import { describe, it, expect } from "vitest";
import { tripFormSchema } from "./schema";

const baseValid = {
  destination: "Roma",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto" as const, age: 35 }],
  budget: 1000,
  styleNotes: "",
};

describe("tripFormSchema", () => {
  it("accetta un viaggio valido", () => {
    const result = tripFormSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("rifiuta una destinazione vuota", () => {
    const result = tripFormSchema.safeParse({ ...baseValid, destination: "" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un viaggio senza date selezionate", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: undefined, to: undefined },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta una data di fine precedente alla data di inizio", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: new Date("2026-09-05"), to: new Date("2026-09-01") },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta zero partecipanti", () => {
    const result = tripFormSchema.safeParse({ ...baseValid, participants: [] });
    expect(result.success).toBe(false);
  });

  it("rifiuta un'età negativa", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      participants: [{ type: "adulto", age: -1 }],
    });
    expect(result.success).toBe(false);
  });
});
