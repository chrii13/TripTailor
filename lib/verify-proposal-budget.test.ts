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
    const result = verifyProposalsAgainstBudget([proposal("Lisbona", 240, 400, 300)], 1500);
    expect(result).toHaveLength(1);
    expect(result[0].destination).toBe("Lisbona");
  });

  it("tiene la proposta che coincide esattamente con il budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Porto", 200, 300, 500)], 1000);
    expect(result).toHaveLength(1);
  });

  it("scarta le proposte che sfondano il budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Tokyo", 1400, 900, 700)], 1500);
    expect(result).toHaveLength(0);
  });

  it("scarta una proposta il cui totale dichiarato sta nel budget ma la cui somma reale lo supera", () => {
    const bugged = proposal("Oslo", 900, 800, 600, 1200);
    const result = verifyProposalsAgainstBudget([bugged], 1500);
    expect(result).toHaveLength(0);
  });

  it("riscrive il totale con la somma dei componenti", () => {
    const result = verifyProposalsAgainstBudget([proposal("Atene", 200, 300, 250, 1)], 2000);
    expect(result[0].costs.total).toBe(750);
  });

  it("ordina le proposte dalla più economica alla più costosa", () => {
    const result = verifyProposalsAgainstBudget(
      [proposal("Costosa", 500, 500, 400), proposal("Economica", 100, 200, 150), proposal("Media", 300, 300, 200)],
      2000
    );
    expect(result.map((p) => p.destination)).toEqual(["Economica", "Media", "Costosa"]);
  });

  it("restituisce un elenco vuoto quando nessuna proposta rientra nel budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Maldive", 2000, 3000, 1000)], 500);
    expect(result).toEqual([]);
  });

  it("non modifica l'array ricevuto in ingresso", () => {
    const input = [proposal("B", 300, 300, 300), proposal("A", 100, 100, 100)];
    verifyProposalsAgainstBudget(input, 5000);
    expect(input.map((p) => p.destination)).toEqual(["B", "A"]);
  });
});
