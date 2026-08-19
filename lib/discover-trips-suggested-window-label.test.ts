import { describe, it, expect } from "vitest";
import { formatSuggestedWindowLabel } from "./discover-trips-suggested-window-label";
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

describe("formatSuggestedWindowLabel", () => {
  it("formatta la finestra in italiano", () => {
    expect(formatSuggestedWindowLabel(proposal("2026-10-10", "2026-10-17"))).toBe("10 ott - 17 ott");
  });

  it("restituisce null quando la proposta non ha una finestra suggerita", () => {
    expect(formatSuggestedWindowLabel(proposal())).toBeNull();
  });
});
