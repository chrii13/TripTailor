import { describe, it, expect } from "vitest";
import { itineraryResponseSchema } from "./itinerary-schema";

const validResponse = {
  days: [
    {
      date: "2026-09-12",
      mattina: [
        {
          title: "Colazione al mercato locale",
          description: "Un giro tra le bancarelle per assaggiare specialità del posto.",
          estimatedCost: "~10€",
        },
      ],
      pomeriggio: [
        {
          title: "Visita al museo civico",
          description: "Collezione permanente di arte locale.",
          estimatedCost: "8€",
          openingHours: "9:00–18:00, chiuso il lunedì",
        },
      ],
      sera: [
        {
          title: "Passeggiata sul lungomare",
          description: "Vista sul tramonto.",
          estimatedCost: "Gratuito",
        },
      ],
    },
  ],
};

describe("itineraryResponseSchema", () => {
  it("accetta una risposta valida", () => {
    const result = itineraryResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it("accetta un'attività senza openingHours (campo opzionale)", () => {
    const result = itineraryResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.days[0].mattina[0].openingHours).toBeUndefined();
    }
  });

  it("rifiuta un giorno senza il campo 'sera'", () => {
    const { sera, ...dayWithoutSera } = validResponse.days[0];
    const result = itineraryResponseSchema.safeParse({ days: [dayWithoutSera] });
    expect(result.success).toBe(false);
  });

  it("rifiuta un'attività senza title", () => {
    const invalid = {
      days: [
        {
          ...validResponse.days[0],
          mattina: [{ description: "manca il titolo", estimatedCost: "5€" }],
        },
      ],
    };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta una risposta dove 'days' non è un array", () => {
    const result = itineraryResponseSchema.safeParse({ days: "non un array" });
    expect(result.success).toBe(false);
  });

  it("rifiuta una data non in formato ISO (es. 'giorno mese anno' in italiano)", () => {
    const invalid = {
      days: [
        {
          ...validResponse.days[0],
          date: "12 settembre 2026",
        },
      ],
    };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
