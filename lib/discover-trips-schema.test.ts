import { describe, it, expect } from "vitest";
import { discoverTripsResponseSchema } from "./discover-trips-schema";

const validProposal = {
  destination: "Lisbona",
  country: "Portogallo",
  whyItFits: "Voli brevi e costo della vita contenuto per il periodo scelto.",
  highlights: ["Quartiere dell'Alfama", "Pastéis de Belém", "Gita a Sintra"],
  costs: {
    travelPerPerson: 120,
    travelTotal: 240,
    lodgingTotal: 400,
    onSiteTotal: 300,
    total: 940,
  },
};

describe("discoverTripsResponseSchema", () => {
  it("accetta una risposta conforme", () => {
    const result = discoverTripsResponseSchema.safeParse({ proposals: [validProposal] });
    expect(result.success).toBe(true);
  });

  it("rifiuta una proposta senza ripartizione dei costi", () => {
    const withoutCosts = {
      destination: validProposal.destination,
      country: validProposal.country,
      whyItFits: validProposal.whyItFits,
      highlights: validProposal.highlights,
    };
    const result = discoverTripsResponseSchema.safeParse({ proposals: [withoutCosts] });
    expect(result.success).toBe(false);
  });

  it("rifiuta costi non numerici", () => {
    const result = discoverTripsResponseSchema.safeParse({
      proposals: [{ ...validProposal, costs: { ...validProposal.costs, lodgingTotal: "400€" } }],
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta costi negativi", () => {
    const result = discoverTripsResponseSchema.safeParse({
      proposals: [{ ...validProposal, costs: { ...validProposal.costs, onSiteTotal: -50 } }],
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta una proposta senza destinazione", () => {
    const result = discoverTripsResponseSchema.safeParse({
      proposals: [{ ...validProposal, destination: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("accetta un elenco vuoto di proposte", () => {
    expect(discoverTripsResponseSchema.safeParse({ proposals: [] }).success).toBe(true);
  });
});
