import { describe, expect, it } from "vitest";
import { dinnerSuggestionsResponseSchema } from "./dinner-suggestions-schema";

describe("dinnerSuggestionsResponseSchema", () => {
  it("accetta una risposta ben formata", () => {
    const out = dinnerSuggestionsResponseSchema.safeParse({
      days: [{ date: "2026-10-10", chosenId: 3, comment: "Piccola adega, pesce del giorno." }],
    });
    expect(out.success).toBe(true);
  });

  it("rifiuta una data che non sia di calendario", () => {
    const out = dinnerSuggestionsResponseSchema.safeParse({
      days: [{ date: "10/10/2026", chosenId: 1, comment: "c" }],
    });
    expect(out.success).toBe(false);
  });

  it("rifiuta un identificativo non intero: gli id dei candidati sono interi", () => {
    const out = dinnerSuggestionsResponseSchema.safeParse({
      days: [{ date: "2026-10-10", chosenId: 1.5, comment: "c" }],
    });
    expect(out.success).toBe(false);
  });

  it("rifiuta un commento vuoto: senza il perché il consiglio non vale", () => {
    const out = dinnerSuggestionsResponseSchema.safeParse({
      days: [{ date: "2026-10-10", chosenId: 1, comment: "" }],
    });
    expect(out.success).toBe(false);
  });
});
