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

/**
 * Le date del viaggio sono date di *calendario*: vanno costruite come mezzanotte locale,
 * come fa `calendarDateSchema`, non con `new Date("2026-09-01")` che interpreta in UTC.
 */
const isoRequest: GenerateItineraryRequest = {
  ...baseRequest,
  dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) },
};

describe("buildItineraryPrompt", () => {
  it("include la destinazione", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("Kyoto");
  });

  it("include il numero di giorni calcolato dall'intervallo di date", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("5 giorni");
  });

  // `verifyItineraryDays` scarta l'intera risposta se una sola data non corrisponde,
  // e il fallimento è terminale (502, nessun ritentativo). Dare al modello le date già
  // nel formato che deve restituire toglie di mezzo l'unica conversione che poteva
  // sbagliare: dd/MM/yyyy è ambiguo con il formato americano.
  it("dà le date del viaggio in formato ISO, mai in dd/MM/yyyy", () => {
    const prompt = buildItineraryPrompt(isoRequest, null);
    expect(prompt).toContain("2026-09-01");
    expect(prompt).toContain("2026-09-05");
    expect(prompt).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("elenca una per una le date attese, in ordine, così che non vada dedotta nessuna", () => {
    const prompt = buildItineraryPrompt(isoRequest, null);
    expect(prompt).toContain(
      "2026-09-01, 2026-09-02, 2026-09-03, 2026-09-04, 2026-09-05"
    );
  });

  it("usa il formato ISO anche nelle righe di arrivo e partenza", () => {
    const prompt = buildItineraryPrompt(
      { ...isoRequest, arrivalTime: "14:30", departureTime: "09:00" },
      null
    );
    expect(prompt).toContain("il primo giorno (2026-09-01)");
    expect(prompt).toContain("l'ultimo giorno (2026-09-05)");
    expect(prompt).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
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

  it("vieta di nominare ristoranti e locali fra le attività: quelli li sceglie il blocco verificato", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    expect(prompt).toContain("non nominare ristoranti, bar o altri locali specifici");
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

  // Il prompt è scritto in italiano e il modello di solito segue la lingua dell'istruzione,
  // ma "di solito" non basta: con destinazioni anglofone tornavano descrizioni in inglese
  // dentro un itinerario per il resto italiano. Il test verifica la sostanza della regola
  // (lingua richiesta + tutti i campi testuali coperti + nomi propri salvi), non la
  // formulazione esatta, che può essere riscritta senza rompere nulla.
  it("chiede esplicitamente di scrivere in italiano tutti i campi testuali", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    const rule = prompt.split("\n").find((line) => /in italiano/i.test(line));
    expect(rule).toBeDefined();
    for (const field of [
      "title",
      "description",
      "estimatedCost",
      "openingHours",
      "about",
      "gettingThere",
      "tips",
    ]) {
      expect(rule).toContain(field);
    }
  });

  it("esclude i nomi propri dalla traduzione, con un esempio concreto", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    expect(prompt).toMatch(/nomi propri/i);
    expect(prompt).toMatch(/non vanno tradotti|non si traducono/i);
    expect(prompt).toMatch(/"[^"]+", non "[^"]+"/);
  });

  it("gli esempi della regola sui nomi propri non nominano un locale dove si mangia o si beve, altrimenti si contraddicono con il divieto sopra", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    expect(prompt).not.toContain("Temple Bar");
    expect(prompt).not.toContain("Mercado da Ribeira");
  });
});
