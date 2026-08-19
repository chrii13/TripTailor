import { describe, it, expect } from "vitest";
import { stripSuggestedWindowIfExact } from "./strip-suggested-window";
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

describe("stripSuggestedWindowIfExact", () => {
  it("rimuove suggestedFrom/suggestedTo in modalità date esatte", () => {
    const proposals = [proposal("2026-10-10", "2026-10-14")];
    const result = stripSuggestedWindowIfExact(proposals, false);
    expect(result[0]).not.toHaveProperty("suggestedFrom");
    expect(result[0]).not.toHaveProperty("suggestedTo");
  });

  it("lascia invariate le proposte senza suggestedFrom/suggestedTo in modalità date esatte", () => {
    const proposals = [proposal()];
    const result = stripSuggestedWindowIfExact(proposals, false);
    expect(result).toEqual(proposals);
  });

  it("lascia invariate le proposte in modalità periodo flessibile", () => {
    const proposals = [proposal("2026-10-10", "2026-10-17")];
    const result = stripSuggestedWindowIfExact(proposals, true);
    expect(result).toEqual(proposals);
  });

  it("preserva gli altri campi della proposta", () => {
    const proposals = [proposal("2026-10-10", "2026-10-14")];
    const result = stripSuggestedWindowIfExact(proposals, false);
    expect(result[0].destination).toBe("Lisbona");
    expect(result[0].costs.total).toBe(600);
  });
});
