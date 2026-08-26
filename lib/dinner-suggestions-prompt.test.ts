import { describe, expect, it } from "vitest";
import { buildDinnerSuggestionsPrompt } from "./dinner-suggestions-prompt";

const input = {
  destination: "Porto, Portogallo",
  participants: [{ type: "adulto" as const, age: 30 }],
  budget: 600,
  days: [
    {
      date: "2026-10-10",
      anchorTitle: "Ponte Luís I",
      candidates: [
        {
          id: 1,
          name: "Adega São Nicolau",
          distanceMeters: 120,
          cuisine: "regional",
          lat: 41.1408,
          lon: -8.6135,
        },
        { id: 2, name: "Dom Tonho", distanceMeters: 240, lat: 41.1401, lon: -8.6112 },
      ],
    },
  ],
};

describe("buildDinnerSuggestionsPrompt", () => {
  it("elenca i candidati con il loro identificativo", () => {
    const prompt = buildDinnerSuggestionsPrompt(input);
    expect(prompt).toContain("1. Adega São Nicolau");
    expect(prompt).toContain("2. Dom Tonho");
  });

  it("vieta esplicitamente di nominare locali fuori elenco", () => {
    const prompt = buildDinnerSuggestionsPrompt(input).toLowerCase();
    expect(prompt).toMatch(/solo.*elenco|esclusivamente.*elenco|non.*inventare/);
  });

  it("chiede di rispondere con l'identificativo, non con il nome", () => {
    expect(buildDinnerSuggestionsPrompt(input)).toMatch(/chosenId/);
  });

  it("chiede l'italiano e di non tradurre i nomi propri", () => {
    const prompt = buildDinnerSuggestionsPrompt(input).toLowerCase();
    expect(prompt).toContain("italiano");
    expect(prompt).toMatch(/nomi propri|non tradurre/);
  });

  it("non mostra al modello le coordinate dei locali", () => {
    // Le coordinate arrivano fino al client per il collegamento alla mappa, ma al modello
    // non servono per scegliere: nel prompt sarebbero solo rumore, moltiplicato per dodici
    // candidati per ogni giornata di viaggio.
    const prompt = buildDinnerSuggestionsPrompt(input);
    expect(prompt).not.toContain("41.1408");
    expect(prompt).not.toContain("-8.6135");
  });

  it("passa le date in formato ISO, come le riceverà indietro", () => {
    expect(buildDinnerSuggestionsPrompt(input)).toContain("2026-10-10");
  });
});
