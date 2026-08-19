import { describe, it, expect } from "vitest";
import { buildDiscoverTripsPrompt, PROPOSALS_COUNT } from "./discover-trips-prompt";
import type { DiscoverTripsRequest } from "./discover-trips-request";

const baseRequest: DiscoverTripsRequest = {
  departureCity: "Milano, Italia",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto", age: 34 }],
  budget: 1500,
};

describe("buildDiscoverTripsPrompt", () => {
  it("include la città di partenza", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain("Milano, Italia");
  });

  it("include le date e il numero di giorni", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toContain("01/09/2026");
    expect(prompt).toContain("05/09/2026");
    expect(prompt).toContain("5 giorni");
  });

  it("include il budget totale", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain("1500€");
  });

  it("include tipo ed età di ogni viaggiatore", () => {
    const prompt = buildDiscoverTripsPrompt({
      ...baseRequest,
      participants: [
        { type: "bambino", age: 7 },
        { type: "adulto", age: 40 },
      ],
    });
    expect(prompt).toContain("Bambino/a, 7 anni");
    expect(prompt).toContain("Adulto/a, 40 anni");
  });

  it("include il numero di viaggiatori, che determina il costo totale dei voli", () => {
    const prompt = buildDiscoverTripsPrompt({
      ...baseRequest,
      participants: [
        { type: "adulto", age: 30 },
        { type: "adulto", age: 32 },
      ],
    });
    expect(prompt).toContain("2 viaggiatori");
  });

  it("chiede il numero di proposte previsto", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain(`${PROPOSALS_COUNT} proposte`);
  });

  it("include il tipo di vacanza quando presente", () => {
    const prompt = buildDiscoverTripsPrompt({ ...baseRequest, vacationType: "montagna" });
    expect(prompt).toContain("Montagna");
  });

  it("non nomina alcun tipo di vacanza quando non è indicato", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).not.toContain("Tipo di vacanza");
  });

  it("chiede esplicitamente di non superare il budget", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain("non deve superare");
  });

  it("non chiede mai un itinerario giorno per giorno", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).not.toContain("giorno per giorno");
  });

  it("chiede il mezzo più sensato, non solo l'aereo", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toContain("treno");
    expect(prompt).toContain("traghetto");
  });

  it("chiede coerenza tra il mezzo fatturato e whyItFits", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toContain("coerente con quanto scritto in whyItFits");
  });
});
