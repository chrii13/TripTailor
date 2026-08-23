import { describe, it, expect } from "vitest";
import { buildDiscoverTripsPrompt, PROPOSALS_COUNT } from "./discover-trips-prompt";
import type { DiscoverTripsRequest } from "./discover-trips-request";

const baseRequest: DiscoverTripsRequest = {
  departureCity: "Milano, Italia",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto", age: 34 }],
  budget: 1500,
};

describe("buildDiscoverTripsPrompt", () => {
  it("include la città di partenza", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain("Milano, Italia");
  });

  // Stesso motivo di `itinerary-prompt`: il resto del prompt chiede già le date in ISO
  // (suggestedFrom/suggestedTo), quindi mescolare dd/MM/yyyy lascia al modello una
  // conversione ambigua con il formato americano — qui pagata in stagionalità sbagliata.
  it("include le date in formato ISO e il numero di giorni", () => {
    const prompt = buildDiscoverTripsPrompt({
      ...baseRequest,
      dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) },
    });
    expect(prompt).toContain("2026-09-01");
    expect(prompt).toContain("2026-09-05");
    expect(prompt).toContain("5 giorni");
    expect(prompt).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("include il budget totale", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain("1500€");
  });

  it("include tipo ed età di ogni viaggiatore", () => {
    const prompt = buildDiscoverTripsPrompt({
      ...baseRequest,
      participants: [
        { type: "bambino", age: 7 },
        { type: "adulto", age: 40 },
      ],
    });
    expect(prompt).toContain("Bambino/a, 7 anni");
    expect(prompt).toContain("Adulto/a, 40 anni");
  });

  it("include il numero di viaggiatori, che determina il costo totale dei voli", () => {
    const prompt = buildDiscoverTripsPrompt({
      ...baseRequest,
      participants: [
        { type: "adulto", age: 30 },
        { type: "adulto", age: 32 },
      ],
    });
    expect(prompt).toContain("2 viaggiatori");
  });

  it("chiede il numero di proposte previsto", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain(`${PROPOSALS_COUNT} proposte`);
  });

  it("chiede un numero pari di proposte, perché la griglia dei risultati è a due colonne", () => {
    expect(PROPOSALS_COUNT % 2).toBe(0);
  });

  it("include il tipo di vacanza quando presente, testuale così com'è scritto", () => {
    const prompt = buildDiscoverTripsPrompt({ ...baseRequest, vacationType: "montagna" });
    expect(prompt).toContain("montagna");
  });

  it("include una frase libera di tipo di vacanza senza passare per l'enum", () => {
    const prompt = buildDiscoverTripsPrompt({
      ...baseRequest,
      vacationType: "terme e relax in montagna",
    });
    expect(prompt).toContain("terme e relax in montagna");
  });

  it("non nomina alcun tipo di vacanza quando non è indicato", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).not.toContain("Tipo di vacanza");
  });

  it("chiede esplicitamente di non superare il budget", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain("non deve superare");
  });

  it("non chiede mai un itinerario giorno per giorno", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).not.toContain("giorno per giorno");
  });

  it("chiede il mezzo più sensato, non solo l'aereo", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toContain("treno");
    expect(prompt).toContain("traghetto");
  });

  it("chiede coerenza tra il mezzo fatturato e whyItFits", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toContain("coerente con quanto scritto in whyItFits");
  });

  it("in modalità date esatte non nomina mai suggestedFrom/suggestedTo", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).not.toContain("suggestedFrom");
    expect(prompt).not.toContain("suggestedTo");
  });

  it("chiede tutti i campi della ripartizione dei costi", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toContain("travelPerPerson");
    expect(prompt).toContain("travelTotal");
    expect(prompt).toContain("lodgingTotal");
    expect(prompt).toContain("onSiteTotal");
    expect(prompt).toContain("total:");
  });

  it("lega la stima del viaggio alla stagionalità e alla città di partenza", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toContain("Tieni conto della stagionalità");
    expect(prompt).toContain(`da ${baseRequest.departureCity}`);
  });

  it("chiede che le proposte siano diverse tra loro, non varianti della stessa idea", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toContain("devono essere diverse tra loro");
    expect(prompt).toContain("non varianti della stessa idea");
  });

  // Vedi il gemello in itinerary-prompt.test.ts: senza istruzione esplicita il modello
  // scivola in inglese sulle mete anglofone. Verifichiamo la sostanza, non la formulazione.
  it("chiede esplicitamente di scrivere in italiano i campi testuali della proposta", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    const rule = prompt.split("\n").find((line) => /in italiano/i.test(line));
    expect(rule).toBeDefined();
    for (const field of ["whyItFits", "highlights", "destination", "country"]) {
      expect(rule).toContain(field);
    }
  });

  it("esclude i nomi propri dalla traduzione, con un esempio concreto", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toMatch(/nomi propri/i);
    expect(prompt).toMatch(/non vanno tradotti|non si traducono/i);
    expect(prompt).toMatch(/"[^"]+", non "[^"]+"/);
  });
});

describe("buildDiscoverTripsPrompt con periodo flessibile", () => {
  const flexibleRequest: DiscoverTripsRequest = {
    departureCity: "Milano, Italia",
    flexiblePeriod: { month: "2026-10", nights: 7 },
    participants: [{ type: "adulto", age: 34 }],
    budget: 1500,
  };

  it("include il mese e il numero di notti al posto delle date esatte", () => {
    const prompt = buildDiscoverTripsPrompt(flexibleRequest);
    expect(prompt).toContain("2026-10");
    expect(prompt).toContain("7 notti");
  });

  it("chiede al modello di scegliere la finestra migliore dentro il mese", () => {
    const prompt = buildDiscoverTripsPrompt(flexibleRequest);
    expect(prompt).toMatch(/scegli|scegliere/);
    expect(prompt).toContain("7 notti");
  });

  it("chiede di motivare la scelta della finestra con prezzi, meteo o eventi", () => {
    const prompt = buildDiscoverTripsPrompt(flexibleRequest);
    expect(prompt).toContain("prezzi");
    expect(prompt).toContain("meteo");
    expect(prompt).toContain("eventi");
  });

  it("chiede suggestedFrom e suggestedTo in formato YYYY-MM-DD", () => {
    const prompt = buildDiscoverTripsPrompt(flexibleRequest);
    expect(prompt).toContain("suggestedFrom");
    expect(prompt).toContain("suggestedTo");
    expect(prompt).toContain("YYYY-MM-DD");
  });

  it("chiede che la finestra sia dentro il mese richiesto e lunga esattamente il numero di notti indicato", () => {
    const prompt = buildDiscoverTripsPrompt(flexibleRequest);
    expect(prompt).toContain("dentro");
    expect(prompt).toContain("2026-10");
  });

  it("mantiene il budget, il numero di proposte e la ripartizione dei costi", () => {
    const prompt = buildDiscoverTripsPrompt(flexibleRequest);
    expect(prompt).toContain("1500€");
    expect(prompt).toContain(`${PROPOSALS_COUNT} proposte`);
    expect(prompt).toContain("travelPerPerson");
    expect(prompt).toContain("lodgingTotal");
  });

  it("mantiene la richiesta di coerenza tra mezzo di trasporto e whyItFits", () => {
    const prompt = buildDiscoverTripsPrompt(flexibleRequest);
    expect(prompt).toContain("coerente con quanto scritto in whyItFits");
  });
});
