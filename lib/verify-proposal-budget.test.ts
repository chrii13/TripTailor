import { describe, it, expect } from "vitest";
import { computeProposalTotal, verifyProposalsAgainstBudget } from "./verify-proposal-budget";
import type { TripProposal } from "./discover-trips-schema";

function proposal(destination: string, flights: number, lodging: number, onSite: number, declaredTotal?: number): TripProposal {
  return {
    destination,
    country: "Paese",
    whyItFits: "Motivo",
    highlights: ["a", "b", "c"],
    costs: {
      flightsPerPerson: Math.round(flights / 2),
      flightsTotal: flights,
      lodgingTotal: lodging,
      onSiteTotal: onSite,
      total: declaredTotal ?? flights + lodging + onSite,
    },
  };
}

describe("computeProposalTotal", () => {
  it("somma volo, alloggio e spese in loco ignorando il totale dichiarato", () => {
    expect(computeProposalTotal(proposal("Lisbona", 240, 400, 300, 99))).toBe(940);
  });
});

describe("verifyProposalsAgainstBudget", () => {
  it("tiene le proposte che rientrano nel budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Lisbona", 240, 400, 300)], 1500, 1, 1);
    expect(result).toHaveLength(1);
    expect(result[0].destination).toBe("Lisbona");
  });

  it("tiene la proposta che coincide esattamente con il budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Porto", 200, 300, 500)], 1000, 1, 1);
    expect(result).toHaveLength(1);
  });

  it("scarta le proposte che sfondano il budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Tokyo", 1400, 900, 700)], 1500, 1, 1);
    expect(result).toHaveLength(0);
  });

  it("scarta una proposta il cui totale dichiarato sta nel budget ma la cui somma reale lo supera", () => {
    const bugged = proposal("Oslo", 900, 800, 600, 1200);
    const result = verifyProposalsAgainstBudget([bugged], 1500, 1, 1);
    expect(result).toHaveLength(0);
  });

  it("riscrive il totale con la somma dei componenti", () => {
    const result = verifyProposalsAgainstBudget([proposal("Atene", 200, 300, 250, 1)], 2000, 1, 1);
    expect(result[0].costs.total).toBe(750);
  });

  it("ordina le proposte dalla più economica alla più costosa", () => {
    const result = verifyProposalsAgainstBudget(
      [proposal("Costosa", 500, 500, 400), proposal("Economica", 100, 200, 150), proposal("Media", 300, 300, 200)],
      2000,
      1,
      1
    );
    expect(result.map((p) => p.destination)).toEqual(["Economica", "Media", "Costosa"]);
  });

  it("restituisce un elenco vuoto quando nessuna proposta rientra nel budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Maldive", 2000, 3000, 1000)], 500, 1, 1);
    expect(result).toEqual([]);
  });

  it("non modifica l'array ricevuto in ingresso", () => {
    const input = [proposal("B", 300, 300, 300), proposal("A", 100, 100, 100)];
    verifyProposalsAgainstBudget(input, 5000, 1, 1);
    expect(input.map((p) => p.destination)).toEqual(["B", "A"]);
  });

  it("scarta una proposta con alloggio più spese in loco sotto la soglia di plausibilità, anche se il totale rientra nel budget", () => {
    // 2 viaggiatori, 3 notti → soglia 25 * 2 * 3 = 150€. Qui lodging+onSite = 100€.
    const result = verifyProposalsAgainstBudget([proposal("Bivacco", 50, 50, 50)], 1000, 2, 3);
    expect(result).toHaveLength(0);
  });

  it("tiene una proposta con alloggio più spese in loco esattamente sulla soglia di plausibilità", () => {
    // 2 viaggiatori, 2 notti → soglia 25 * 2 * 2 = 100€. Qui lodging+onSite = 100€ esatti.
    const result = verifyProposalsAgainstBudget([proposal("Soglia", 50, 50, 50)], 1000, 2, 2);
    expect(result).toHaveLength(1);
  });

  it("scarta tutte le proposte per una famiglia di 4 con 200€ e 14 notti (budget impossibile)", () => {
    // Soglia: 25 * 4 * 14 = 1400€. Con 200€ totali di budget nessuna proposta può arrivarci.
    const proposals = [
      proposal("Meta1", 20, 20, 20),
      proposal("Meta2", 30, 5, 5),
      proposal("Meta3", 40, 10, 10),
      proposal("Meta4", 50, 0, 0),
      proposal("Meta5", 25, 25, 25),
    ];
    const result = verifyProposalsAgainstBudget(proposals, 200, 4, 14);
    expect(result).toEqual([]);
  });

  it("con un viaggio di un giorno (nights = 0) usa una notte per la soglia, senza dividere per zero né accettare tutto", () => {
    // 2 viaggiatori, nights = 0 → Math.max(0, 1) = 1 notte → soglia 25 * 2 * 1 = 50€.
    const sottoSoglia = verifyProposalsAgainstBudget([proposal("Gita", 20, 0, 40)], 1000, 2, 0);
    expect(sottoSoglia).toHaveLength(0);

    const sullaSoglia = verifyProposalsAgainstBudget([proposal("Gita", 20, 0, 50)], 1000, 2, 0);
    expect(sullaSoglia).toHaveLength(1);
  });
});
