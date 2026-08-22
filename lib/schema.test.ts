import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { tripFormSchema, PARTICIPANT_TYPE_LABELS, MAX_DESTINATION_LENGTH, MAX_STYLE_NOTES_LENGTH, MAX_MUST_SEE_LENGTH } from "./schema";

/**
 * Da quando lo schema rifiuta le date passate, le date fisse dei casi di prova
 * hanno una scadenza: il 2 settembre 2026 diventerebbero passato e mezzo file
 * fallirebbe da solo. L'orologio resta quindi fermo a prima di quelle date.
 */
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

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

  it("rifiuta più di 20 partecipanti", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      participants: Array.from({ length: 21 }, () => ({ type: "adulto" as const, age: 35 })),
    });
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

  it("rifiuta un viaggio che comincia ieri", () => {
    const yesterday = new Date();
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: yesterday, to: new Date(2026, 7, 5) },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un viaggio interamente nel passato", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: new Date(2020, 0, 10), to: new Date(2020, 0, 15) },
    });
    expect(result.success).toBe(false);
  });

  it("accetta un viaggio che comincia oggi", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: today, to: new Date(2026, 7, 5) },
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta una destinazione più lunga del limite accettato dal server", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      destination: "a".repeat(MAX_DESTINATION_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta note di stile più lunghe del limite accettato dal server", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      styleNotes: "a".repeat(MAX_STYLE_NOTES_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un 'cosa non vuoi perderti' più lungo del limite accettato dal server", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      mustSee: "a".repeat(MAX_MUST_SEE_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("accetta i campi di testo esattamente al limite", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      destination: "a".repeat(MAX_DESTINATION_LENGTH),
      styleNotes: "a".repeat(MAX_STYLE_NOTES_LENGTH),
      mustSee: "a".repeat(MAX_MUST_SEE_LENGTH),
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
    if (result.success) {
      expect(result.data.arrivalTime).toBe("15:30");
      expect(result.data.departureTime).toBe("09:00");
    }
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
