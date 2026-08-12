import { describe, it, expect } from "vitest";
import { itineraryResponseSchema } from "./itinerary-schema";

const validActivity = {
  title: "Visita al museo civico",
  description: "Collezione permanente di arte locale.",
  estimatedCost: "8€",
  suggestedTime: "9:00–11:00",
  details: {
    about: "Museo dedicato alla storia e all'arte locale, ospitato in un antico palazzo.",
    gettingThere: "A 10 minuti a piedi dalla stazione centrale.",
    tips: "Ingresso gratuito la prima domenica del mese.",
  },
};

const validResponse = {
  days: [
    {
      date: "2026-09-12",
      mattina: [
        {
          title: "Colazione al mercato locale",
          description: "Un giro tra le bancarelle per assaggiare specialità del posto.",
          estimatedCost: "~10€",
          suggestedTime: "8:00–9:00",
          details: {
            about: "Mercato coperto con prodotti tipici e street food.",
            gettingThere: "Nel centro storico, raggiungibile a piedi dal centro.",
            tips: "Meglio andarci presto per evitare la folla.",
          },
        },
      ],
      pomeriggio: [{ ...validActivity, openingHours: "9:00–18:00, chiuso il lunedì" }],
      sera: [
        {
          title: "Passeggiata sul lungomare",
          description: "Vista sul tramonto.",
          estimatedCost: "Gratuito",
          suggestedTime: "19:00–20:00",
          details: {
            about: "Lungomare pedonale con vista panoramica sul golfo.",
            gettingThere: "Adiacente al centro, facilmente raggiungibile a piedi.",
            tips: "Il tramonto migliore è verso fine estate.",
          },
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
      days: [{ ...validResponse.days[0], mattina: [{ ...validActivity, title: undefined }] }],
    };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta una risposta dove 'days' non è un array", () => {
    const result = itineraryResponseSchema.safeParse({ days: "non un array" });
    expect(result.success).toBe(false);
  });

  it("rifiuta una data non in formato ISO (es. 'giorno mese anno' in italiano)", () => {
    const invalid = { days: [{ ...validResponse.days[0], date: "12 settembre 2026" }] };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta un'attività senza suggestedTime", () => {
    const { suggestedTime, ...activityWithoutTime } = validActivity;
    const invalid = { days: [{ ...validResponse.days[0], mattina: [activityWithoutTime] }] };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta un'attività senza il campo details", () => {
    const { details, ...activityWithoutDetails } = validActivity;
    const invalid = { days: [{ ...validResponse.days[0], mattina: [activityWithoutDetails] }] };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta un'attività con details incompleto (manca gettingThere)", () => {
    const invalid = {
      days: [
        {
          ...validResponse.days[0],
          mattina: [{ ...validActivity, details: { about: "x", tips: "y" } }],
        },
      ],
    };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
