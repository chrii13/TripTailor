import { afterAll, afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import { verifyProposalsAgainstSuggestedWindow } from "./verify-suggested-window";
import type { TripProposal } from "./discover-trips-schema";

/**
 * Da quando il filtro scarta anche le finestre già trascorse, le date fisse dei
 * casi di prova hanno una scadenza: l'orologio resta fermo a prima di quelle date.
 */
const FROZEN_NOW = new Date("2026-09-15T12:00:00.000Z");

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.setSystemTime(FROZEN_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

function proposal(destination: string, suggestedFrom?: string, suggestedTo?: string): TripProposal {
  return {
    destination,
    country: "Paese",
    whyItFits: "Motivo",
    highlights: ["a", "b", "c"],
    costs: { travelPerPerson: 100, travelTotal: 200, lodgingTotal: 300, onSiteTotal: 100, total: 600 },
    ...(suggestedFrom ? { suggestedFrom } : {}),
    ...(suggestedTo ? { suggestedTo } : {}),
  };
}

describe("verifyProposalsAgainstSuggestedWindow", () => {
  it("in modalità date esatte (nessun periodo flessibile) lascia passare tutte le proposte invariate", () => {
    const proposals = [proposal("Lisbona"), proposal("Porto")];
    const result = verifyProposalsAgainstSuggestedWindow(proposals, undefined);
    expect(result).toEqual(proposals);
  });

  it("tiene una proposta con finestra coerente col mese e col numero di notti richiesti", () => {
    const proposals = [proposal("Lisbona", "2026-10-05", "2026-10-12")];
    const result = verifyProposalsAgainstSuggestedWindow(proposals, { month: "2026-10", nights: 7 });
    expect(result).toHaveLength(1);
  });

  it("scarta una proposta senza suggestedFrom/suggestedTo quando il periodo è flessibile", () => {
    const proposals = [proposal("Lisbona")];
    const result = verifyProposalsAgainstSuggestedWindow(proposals, { month: "2026-10", nights: 7 });
    expect(result).toHaveLength(0);
  });

  it("scarta una proposta la cui durata non corrisponde al numero di notti richiesto", () => {
    const proposals = [proposal("Lisbona", "2026-10-05", "2026-10-10")];
    const result = verifyProposalsAgainstSuggestedWindow(proposals, { month: "2026-10", nights: 7 });
    expect(result).toHaveLength(0);
  });

  it("scarta una proposta il cui inizio è fuori dal mese richiesto", () => {
    const proposals = [proposal("Lisbona", "2026-09-28", "2026-10-05")];
    const result = verifyProposalsAgainstSuggestedWindow(proposals, { month: "2026-10", nights: 7 });
    expect(result).toHaveLength(0);
  });

  it("scarta una finestra che inizia il 28 di un mese di 31 giorni e sconfina di 5 notti nel mese successivo", () => {
    const proposals = [proposal("Lisbona", "2026-10-28", "2026-11-02")];
    const result = verifyProposalsAgainstSuggestedWindow(proposals, { month: "2026-10", nights: 5 });
    expect(result).toHaveLength(0);
  });

  it("tiene solo le proposte valide scartando le altre", () => {
    const proposals = [
      proposal("Valida", "2026-10-05", "2026-10-12"),
      proposal("FuoriMese", "2026-11-01", "2026-11-08"),
    ];
    const result = verifyProposalsAgainstSuggestedWindow(proposals, { month: "2026-10", nights: 7 });
    expect(result.map((p) => p.destination)).toEqual(["Valida"]);
  });

  /**
   * Col mese corrente scelto a fine mese, tutte le finestre dentro il mese possono
   * essere già trascorse: il filtro deve scartarle, non proporre un viaggio passato.
   */
  it("scarta una finestra dentro il mese richiesto ma già trascorsa", () => {
    vi.setSystemTime(new Date("2026-10-28T12:00:00.000Z"));
    const proposals = [proposal("Lisbona", "2026-10-05", "2026-10-12")];
    const result = verifyProposalsAgainstSuggestedWindow(proposals, { month: "2026-10", nights: 7 });
    expect(result).toHaveLength(0);
  });

  it("tiene una finestra che comincia oggi", () => {
    vi.setSystemTime(new Date("2026-10-05T12:00:00.000Z"));
    const proposals = [proposal("Lisbona", "2026-10-05", "2026-10-12")];
    const result = verifyProposalsAgainstSuggestedWindow(proposals, { month: "2026-10", nights: 7 });
    expect(result).toHaveLength(1);
  });
});
