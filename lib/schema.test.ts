import { describe, it, expect } from "vitest";
import { tripFormSchema, PARTICIPANT_TYPE_LABELS } from "./schema";

const baseValid = {
  destination: "Roma",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto" as const, age: 35 }],
  budget: 1000,
  styleNotes: "",
};

describe("tripFormSchema", () => {
  it("accetta un viaggio valido", () => {
    const result = tripFormSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("rifiuta una destinazione vuota", () => {
    const result = tripFormSchema.safeParse({ ...baseValid, destination: "" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un viaggio senza date selezionate", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: undefined, to: undefined },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta una data di fine precedente alla data di inizio", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: new Date("2026-09-05"), to: new Date("2026-09-01") },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta zero partecipanti", () => {
    const result = tripFormSchema.safeParse({ ...baseValid, participants: [] });
    expect(result.success).toBe(false);
  });

  it("rifiuta un'età negativa", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      participants: [{ type: "adulto", age: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it("accetta una data di fine uguale alla data di inizio", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-01") },
    });
    expect(result.success).toBe(true);
  });

  it("accetta un'età pari a zero per un bambino", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      participants: [{ type: "bambino", age: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta un'età fuori range per il tipo bambino (0-12)", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      participants: [{ type: "bambino", age: 15 }],
    });
    expect(result.success).toBe(false);
  });

  it("accetta un ragazzo nel range 13-25", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      participants: [{ type: "ragazzo", age: 18 }],
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta un ragazzo fuori range (26 anni, dovrebbe essere adulto)", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      participants: [{ type: "ragazzo", age: 26 }],
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un partecipante senza età selezionata", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      participants: [{ type: "adulto", age: undefined }],
    });
    expect(result.success).toBe(false);
  });

  it("accetta i confini esatti di ogni fascia (12 bambino, 13 e 25 ragazzo, 26 adulto)", () => {
    const cases = [
      { type: "bambino" as const, age: 12 },
      { type: "ragazzo" as const, age: 13 },
      { type: "ragazzo" as const, age: 25 },
      { type: "adulto" as const, age: 26 },
    ];
    for (const participant of cases) {
      const result = tripFormSchema.safeParse({
        ...baseValid,
        participants: [participant],
      });
      expect(result.success).toBe(true);
    }
  });

  it("rifiuta un viaggio di più di 14 giorni", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-16") },
    });
    expect(result.success).toBe(false);
  });

  it("accetta un viaggio di esattamente 14 giorni", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-14") },
    });
    expect(result.success).toBe(true);
  });

  it("accetta un viaggio con orario di arrivo e partenza", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      arrivalTime: "15:30",
      departureTime: "09:00",
    });
    expect(result.success).toBe(true);
  });

  it("accetta un viaggio senza orario di arrivo/partenza (campi opzionali)", () => {
    const result = tripFormSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.arrivalTime).toBeUndefined();
      expect(result.data.departureTime).toBeUndefined();
    }
  });
});

describe("PARTICIPANT_TYPE_LABELS", () => {
  it("usa la forma inclusiva per tutti e tre i tipi", () => {
    expect(PARTICIPANT_TYPE_LABELS.bambino).toBe("Bambino/a");
    expect(PARTICIPANT_TYPE_LABELS.ragazzo).toBe("Ragazzo/a");
    expect(PARTICIPANT_TYPE_LABELS.adulto).toBe("Adulto/a");
  });
});
