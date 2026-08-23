import { describe, it, expect } from "vitest";
import { itineraryResponseSchema, MAX_ACTIVITY_TITLE_LENGTH } from "./itinerary-schema";
import { MAX_TRIP_DAYS } from "./schema";

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

  it("rifiuta un'attività con suggestedTime in formato libero (niente orari)", () => {
    const invalid = {
      days: [
        {
          ...validResponse.days[0],
          mattina: [{ ...validActivity, suggestedTime: "verso mezzogiorno" }],
        },
      ],
    };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta un'attività con suggestedTime senza orario di fine", () => {
    const invalid = {
      days: [{ ...validResponse.days[0], mattina: [{ ...validActivity, suggestedTime: "09:00" }] }],
    };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accetta suggestedTime col trattino ASCII o con spazi attorno al trattino", () => {
    for (const suggestedTime of ["10:00-12:30", "10:00 – 12:30", "9:00 - 11:00"]) {
      const candidate = {
        days: [{ ...validResponse.days[0], mattina: [{ ...validActivity, suggestedTime }] }],
      };
      expect(itineraryResponseSchema.safeParse(candidate).success).toBe(true);
    }
  });

  // Una risposta è validata in blocco: una sola attività scartata butta via l'intera
  // generazione (502, nessun ritentativo). Sui separatori plausibili si è tolleranti.
  it("accetta suggestedTime con l'em dash e con spazi in testa o in coda", () => {
    for (const suggestedTime of [
      "09:00—11:00",
      "09:00 — 11:00",
      "09:00 – 11:00 ",
      " 09:00-11:00",
    ]) {
      const candidate = {
        days: [{ ...validResponse.days[0], mattina: [{ ...validActivity, suggestedTime }] }],
      };
      expect(itineraryResponseSchema.safeParse(candidate).success).toBe(true);
    }
  });

  it("rifiuta una risposta con zero giorni", () => {
    const result = itineraryResponseSchema.safeParse({ days: [] });
    expect(result.success).toBe(false);
  });

  // Il tetto sul numero di giorni non sta più qui (maxItems fa rifiutare lo schema da
  // Gemini, vedi itinerary-schema.ts): un itinerario troppo lungo passa lo schema e
  // viene fermato da verifyItineraryDays, che ha il proprio test per questo caso.
  it("accetta più giorni di quanti ne consenta il viaggio più lungo: il tetto lo impone verifyItineraryDays", () => {
    const days = Array.from({ length: MAX_TRIP_DAYS + 1 }, (_, index) => ({
      ...validResponse.days[0],
      date: `2026-09-${String(index + 1).padStart(2, "0")}`,
    }));
    const result = itineraryResponseSchema.safeParse({ days });
    expect(result.success).toBe(true);
  });

  it("accetta un titolo lungo quanto la tolleranza concessa sopra i 40 caratteri del prompt", () => {
    const candidate = {
      days: [
        {
          ...validResponse.days[0],
          mattina: [{ ...validActivity, title: "a".repeat(MAX_ACTIVITY_TITLE_LENGTH) }],
        },
      ],
    };
    expect(itineraryResponseSchema.safeParse(candidate).success).toBe(true);
  });

  it("rifiuta un titolo oltre la tolleranza (il layout della card è tarato sui 40 caratteri)", () => {
    const invalid = {
      days: [
        {
          ...validResponse.days[0],
          mattina: [{ ...validActivity, title: "a".repeat(MAX_ACTIVITY_TITLE_LENGTH + 1) }],
        },
      ],
    };
    expect(itineraryResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("rifiuta un titolo vuoto", () => {
    const invalid = {
      days: [{ ...validResponse.days[0], mattina: [{ ...validActivity, title: "" }] }],
    };
    expect(itineraryResponseSchema.safeParse(invalid).success).toBe(false);
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
