import { describe, expect, it } from "vitest";
import {
  MAX_DINNER_COMMENT_LENGTH,
  MAX_DINNER_COMMENT_TOLERANCE,
  dinnerSuggestionsResponseSchema,
} from "./dinner-suggestions-schema";

const parseComment = (comment: string) =>
  dinnerSuggestionsResponseSchema.safeParse({
    days: [{ date: "2026-10-10", chosenId: 1, comment }],
  }).success;

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

  // I due numeri divergono apposta: il prompt chiede 220, lo schema tollera fino a 300.
  // Una risposta contiene tutte le sere del viaggio, quindi bocciarla per un commento
  // di 221 caratteri lascerebbe senza consiglio anche le altre giornate.
  it("tollera uno sforamento breve del limite chiesto al modello", () => {
    expect(MAX_DINNER_COMMENT_LENGTH).toBeLessThan(MAX_DINNER_COMMENT_TOLERANCE);
    expect(parseComment("c".repeat(250))).toBe(true);
  });

  it("rifiuta il commento diventato un paragrafo", () => {
    expect(parseComment("c".repeat(301))).toBe(false);
  });
});
