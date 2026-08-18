import { describe, it, expect } from "vitest";
import { buildItineraryPrompt } from "./itinerary-prompt";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";
import type { DailyClimateAverage } from "./climate-forecast";

const baseRequest: GenerateItineraryRequest = {
  destination: "Kyoto",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto", age: 34 }],
  budget: 2000,
  styleNotes: "",
};

describe("buildItineraryPrompt", () => {
  it("include la destinazione", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("Kyoto");
  });

  it("include il numero di giorni calcolato dall'intervallo di date", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("5 giorni");
  });

  it("include tipo (in forma inclusiva) ed età esatta di ogni partecipante", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      participants: [
        { type: "bambino", age: 7 },
        { type: "adulto", age: 40 },
      ],
    };
    const prompt = buildItineraryPrompt(request, null);
    expect(prompt).toContain("Bambino/a, 7 anni");
    expect(prompt).toContain("Adulto/a, 40 anni");
  });

  it("include il budget indicativo", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("2000€");
  });

  it("include la tappa imperdibile quando presente", () => {
    const prompt = buildItineraryPrompt(
      { ...baseRequest, mustSee: "Fushimi Inari all'alba" },
      null
    );
    expect(prompt).toContain("Fushimi Inari all'alba");
    expect(prompt).toContain("Tappa imperdibile");
  });

  it("non menziona la tappa imperdibile quando il campo è vuoto o assente", () => {
    expect(buildItineraryPrompt(baseRequest, null)).not.toContain("Tappa imperdibile");
    expect(
      buildItineraryPrompt({ ...baseRequest, mustSee: "   " }, null)
    ).not.toContain("Tappa imperdibile");
  });
  it("include le note sullo stile quando presenti", () => {
    const request: GenerateItineraryRequest = { ...baseRequest, styleNotes: "lusso, relax" };
    expect(buildItineraryPrompt(request, null)).toContain("lusso, relax");
  });

  it("include le linee guida per gruppi con bambini quando è presente un bambino", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      participants: [{ type: "bambino", age: 5 }],
    };
    expect(buildItineraryPrompt(request, null)).toContain("family-friendly");
  });

  it("istruisce a fornire un orario consigliato per ogni attività", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("suggestedTime");
  });

  it("istruisce a fornire i campi di approfondimento about/gettingThere/tips", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    expect(prompt).toContain("about");
    expect(prompt).toContain("gettingThere");
    expect(prompt).toContain("tips");
  });

  it("non impone un numero fisso di attività per fascia", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("Non imporre un numero fisso");
  });

  it("istruisce a dare la posizione esatta per la prima attività del giorno, senza presumere un punto di partenza", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    expect(prompt).toContain("primissima attività di ogni giornata");
    expect(prompt).toContain("non è possibile sapere da dove parte il viaggiatore");
  });

  it("non include alcuna sezione clima quando i dati climatici non sono disponibili", () => {
    expect(buildItineraryPrompt(baseRequest, null).toLowerCase()).not.toContain("clima");
  });

  it("include i dati climatici e l'istruzione di calibrare le attività quando disponibili", () => {
    const climate: DailyClimateAverage[] = [
      { date: "2026-09-01", tempMaxAvg: 26, tempMinAvg: 17, precipitationChance: 20 },
      { date: "2026-09-02", tempMaxAvg: 25, tempMinAvg: 16, precipitationChance: 60 },
    ];
    const prompt = buildItineraryPrompt(baseRequest, climate);
    expect(prompt).toContain("2026-09-01");
    expect(prompt).toContain("26°C/17°C");
    expect(prompt).toContain("20%");
    expect(prompt).toContain("2026-09-02");
    expect(prompt).toContain("60%");
    expect(prompt).toContain("calibrare le attività");
  });

  it("include l'istruzione di orario di arrivo quando presente", () => {
    const request: GenerateItineraryRequest = { ...baseRequest, arrivalTime: "15:30" };
    const prompt = buildItineraryPrompt(request, null);
    expect(prompt).toContain("15:30");
    expect(prompt).toContain("non pianificare attività prima di quell'orario");
  });

  it("include l'istruzione di orario di partenza quando presente", () => {
    const request: GenerateItineraryRequest = { ...baseRequest, departureTime: "09:00" };
    const prompt = buildItineraryPrompt(request, null);
    expect(prompt).toContain("09:00");
    expect(prompt).toContain("concludi le attività con un margine ragionevole");
  });

  it("non include alcuna istruzione di arrivo/partenza quando i campi sono assenti", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    expect(prompt).not.toContain("arriva a destinazione");
    expect(prompt).not.toContain("riparte");
  });

  it("include entrambe le istruzioni quando il viaggio dura un solo giorno", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-01") },
      arrivalTime: "11:45",
      departureTime: "20:00",
    };
    const prompt = buildItineraryPrompt(request, null);
    expect(prompt).toContain("arriva a destinazione il primo giorno");
    expect(prompt).toContain("11:45");
    expect(prompt).toContain("riparte l'ultimo giorno");
    expect(prompt).toContain("20:00");
  });
});
