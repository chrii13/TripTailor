import { describe, it, expect } from "vitest";
import { resolveProposalDates } from "./discover-trips-proposal-dates";
import type { TripProposal } from "./discover-trips-schema";

function proposal(suggestedFrom?: string, suggestedTo?: string): TripProposal {
  return {
    destination: "Lisbona",
    country: "Portogallo",
    whyItFits: "Motivo",
    highlights: ["a", "b", "c"],
    costs: { travelPerPerson: 100, travelTotal: 200, lodgingTotal: 300, onSiteTotal: 100, total: 600 },
    ...(suggestedFrom ? { suggestedFrom } : {}),
    ...(suggestedTo ? { suggestedTo } : {}),
  };
}

describe("resolveProposalDates", () => {
  it("in modalità esatte usa sempre l'intervallo scelto dall'utente", () => {
    const exactRange = { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) };
    const result = resolveProposalDates(proposal(), "esatte", exactRange);
    expect(result).toEqual(exactRange);
  });

  it("in modalità flessibile usa la finestra suggerita dal modello", () => {
    const result = resolveProposalDates(proposal("2026-10-10", "2026-10-17"), "flessibili", {});
    expect(result.from).toEqual(new Date(2026, 9, 10));
    expect(result.to).toEqual(new Date(2026, 9, 17));
  });

  it("in modalità flessibile senza finestra suggerita omette le date, non ne calcola una", () => {
    const result = resolveProposalDates(proposal(), "flessibili", {
      from: new Date(2026, 8, 1),
      to: new Date(2026, 8, 5),
    });
    expect(result).toEqual({});
  });
});
