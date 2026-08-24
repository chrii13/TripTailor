import { describe, it, expect } from "vitest";
import { dinnerSuggestionsRequestSchema } from "./dinner-suggestions-request";

const corpoValido = {
  destination: "Roma",
  participants: [{ type: "adulto", age: 35 }],
  budget: 1200,
  styleNotes: "Cucina locale, niente code",
  days: [
    { date: "2026-09-10", anchorTitle: "Colosseo" },
    { date: "2026-09-11", anchorTitle: "Musei Vaticani" },
  ],
};

describe("dinnerSuggestionsRequestSchema", () => {
  it("accetta un corpo valido", () => {
    const parsed = dinnerSuggestionsRequestSchema.safeParse(corpoValido);
    expect(parsed.success).toBe(true);
  });

  it("lascia le date come stringhe di calendario, non le trasforma in Date", () => {
    const parsed = dinnerSuggestionsRequestSchema.parse(corpoValido);
    expect(parsed.days[0].date).toBe("2026-09-10");
  });

  it("non pretende le coordinate: la route geocodifica la destinazione da sé", () => {
    const parsed = dinnerSuggestionsRequestSchema.safeParse(corpoValido);
    expect(parsed.success).toBe(true);
    expect(parsed.success && "coordinates" in parsed.data).toBe(false);
  });

  it("rifiuta una data non in formato yyyy-MM-dd", () => {
    const parsed = dinnerSuggestionsRequestSchema.safeParse({
      ...corpoValido,
      days: [{ date: "10/09/2026", anchorTitle: "Colosseo" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta un elenco di giornate vuoto", () => {
    const parsed = dinnerSuggestionsRequestSchema.safeParse({ ...corpoValido, days: [] });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta una tappa senza titolo", () => {
    const parsed = dinnerSuggestionsRequestSchema.safeParse({
      ...corpoValido,
      days: [{ date: "2026-09-10", anchorTitle: "   " }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta una destinazione vuota", () => {
    const parsed = dinnerSuggestionsRequestSchema.safeParse({ ...corpoValido, destination: "" });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta un elenco di partecipanti vuoto", () => {
    const parsed = dinnerSuggestionsRequestSchema.safeParse({ ...corpoValido, participants: [] });
    expect(parsed.success).toBe(false);
  });

  it("accetta l'assenza delle note di stile", () => {
    const { styleNotes: _styleNotes, ...senzaNote } = corpoValido;
    expect(dinnerSuggestionsRequestSchema.safeParse(senzaNote).success).toBe(true);
  });
});
