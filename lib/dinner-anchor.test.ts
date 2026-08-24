import { describe, expect, it } from "vitest";
import { pickDinnerAnchor } from "./dinner-anchor";
import type { ItineraryDay } from "./itinerary-schema";

function attivita(title: string) {
  return {
    title,
    description: "d",
    estimatedCost: "~10€",
    suggestedTime: "09:00–10:00",
    details: { about: "a", gettingThere: "g", tips: "t" },
  };
}

function giornata(parti: Partial<ItineraryDay>): ItineraryDay {
  return { date: "2026-10-10", mattina: [], pomeriggio: [], sera: [], ...parti };
}

describe("pickDinnerAnchor", () => {
  it("prende l'ultima attività del pomeriggio: è lì che l'utente si trova verso le 19", () => {
    const day = giornata({
      pomeriggio: [attivita("Museo"), attivita("Ponte Luís I")],
      sera: [attivita("Passeggiata")],
    });
    expect(pickDinnerAnchor(day)).toBe("Ponte Luís I");
  });

  it("ripiega sulla prima attività della sera quando il pomeriggio è vuoto", () => {
    const day = giornata({ mattina: [attivita("Mercato")], sera: [attivita("Fado")] });
    expect(pickDinnerAnchor(day)).toBe("Fado");
  });

  it("restituisce null senza pomeriggio né sera: senza un punto, «vicino» non significa niente", () => {
    expect(pickDinnerAnchor(giornata({ mattina: [attivita("Mercato")] }))).toBeNull();
  });

  it("restituisce null su una giornata del tutto vuota", () => {
    expect(pickDinnerAnchor(giornata({}))).toBeNull();
  });
});
