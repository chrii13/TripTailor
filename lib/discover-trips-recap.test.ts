import { describe, it, expect } from "vitest";
import { formatSearchPeriod, getSearchNights } from "./discover-trips-recap";

describe("getSearchNights", () => {
  it("calcola le notti da un intervallo di date esatte", () => {
    expect(
      getSearchNights({
        dateMode: "esatte",
        dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) },
        flexiblePeriod: {},
      })
    ).toBe(4);
  });

  it("restituisce 0 in modalità esatte senza date", () => {
    expect(getSearchNights({ dateMode: "esatte", dateRange: {}, flexiblePeriod: {} })).toBe(0);
  });

  it("usa direttamente il numero di notti in modalità flessibile", () => {
    expect(
      getSearchNights({
        dateMode: "flessibili",
        dateRange: {},
        flexiblePeriod: { month: "2026-10", nights: 7 },
      })
    ).toBe(7);
  });
});

describe("formatSearchPeriod", () => {
  it("mostra l'intervallo di date in modalità esatte", () => {
    const label = formatSearchPeriod({
      dateMode: "esatte",
      dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) },
      flexiblePeriod: {},
    });
    expect(label).toBe("01 Sep - 05 Sep");
  });

  it("segnala il viaggio in giornata in modalità esatte", () => {
    const label = formatSearchPeriod({
      dateMode: "esatte",
      dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 1) },
      flexiblePeriod: {},
    });
    expect(label).toBe("01 Sep (in giornata)");
  });

  it("non mostra mai un intervallo di date in modalità flessibile", () => {
    const label = formatSearchPeriod({
      dateMode: "flessibili",
      dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) },
      flexiblePeriod: { month: "2026-10", nights: 7 },
    });
    expect(label).not.toMatch(/set/);
    expect(label).toBe("ottobre 2026 · 7 notti");
  });

  it("non mostra mai un mese in modalità esatte", () => {
    const label = formatSearchPeriod({
      dateMode: "esatte",
      dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) },
      flexiblePeriod: { month: "2026-10", nights: 7 },
    });
    expect(label).not.toMatch(/ottobre/);
  });

  it("usa il singolare per una sola notte", () => {
    const label = formatSearchPeriod({
      dateMode: "flessibili",
      dateRange: {},
      flexiblePeriod: { month: "2026-10", nights: 1 },
    });
    expect(label).toBe("ottobre 2026 · 1 notte");
  });
});
