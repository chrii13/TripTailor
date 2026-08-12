import { describe, it, expect } from "vitest";
import { buildItineraryPrompt } from "./itinerary-prompt";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";

const baseRequest: GenerateItineraryRequest = {
  destination: "Kyoto",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto", age: 34 }],
  budget: 2000,
  styleNotes: "",
};

describe("buildItineraryPrompt", () => {
  it("include la destinazione", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("Kyoto");
  });

  it("include il numero di giorni calcolato dall'intervallo di date", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("5 giorni");
  });

  it("include tipo (in forma inclusiva) ed età esatta di ogni partecipante", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      participants: [
        { type: "bambino", age: 7 },
        { type: "adulto", age: 40 },
      ],
    };
    const prompt = buildItineraryPrompt(request);
    expect(prompt).toContain("Bambino/a, 7 anni");
    expect(prompt).toContain("Adulto/a, 40 anni");
  });

  it("include il budget indicativo", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("2000€");
  });

  it("include le note sullo stile quando presenti", () => {
    const request: GenerateItineraryRequest = { ...baseRequest, styleNotes: "lusso, relax" };
    expect(buildItineraryPrompt(request)).toContain("lusso, relax");
  });

  it("include le linee guida per gruppi con bambini quando è presente un bambino", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      participants: [{ type: "bambino", age: 5 }],
    };
    expect(buildItineraryPrompt(request)).toContain("family-friendly");
  });

  it("non fa riferimento al meteo", () => {
    expect(buildItineraryPrompt(baseRequest).toLowerCase()).not.toContain("meteo");
  });

  it("istruisce a fornire un orario consigliato per ogni attività", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("suggestedTime");
  });

  it("istruisce a fornire i campi di approfondimento about/gettingThere/tips", () => {
    const prompt = buildItineraryPrompt(baseRequest);
    expect(prompt).toContain("about");
    expect(prompt).toContain("gettingThere");
    expect(prompt).toContain("tips");
  });

  it("non impone un numero fisso di attività per fascia", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("Non imporre un numero fisso");
  });
});
