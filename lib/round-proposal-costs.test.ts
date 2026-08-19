import { describe, it, expect } from "vitest";
import { roundToNearestFifty, roundProposalCosts } from "./round-proposal-costs";
import type { ProposalCosts } from "./discover-trips-schema";

describe("roundToNearestFifty", () => {
  it("arrotonda per eccesso oltre la metà dell'intervallo", () => {
    expect(roundToNearestFifty(1176)).toBe(1200);
  });

  it("arrotonda per difetto sotto la metà dell'intervallo", () => {
    expect(roundToNearestFifty(1124)).toBe(1100);
  });

  it("lascia invariato un valore già multiplo di 50", () => {
    expect(roundToNearestFifty(500)).toBe(500);
  });

  it("arrotonda zero a zero", () => {
    expect(roundToNearestFifty(0)).toBe(0);
  });
});

describe("roundProposalCosts", () => {
  it("deriva il totale dalla somma delle voci arrotondate, non dall'arrotondamento del totale reale", () => {
    const costs: ProposalCosts = {
      travelPerPerson: 68,
      travelTotal: 136,
      lodgingTotal: 421,
      onSiteTotal: 317,
      total: 874,
    };

    const rounded = roundProposalCosts(costs);

    expect(rounded.travelTotal).toBe(150);
    expect(rounded.lodgingTotal).toBe(400);
    expect(rounded.onSiteTotal).toBe(300);
    // 150 + 400 + 300 = 850, diverso dall'arrotondamento diretto di 874 (che darebbe 900):
    // è la prova che il totale mostrato è la somma delle righe mostrate.
    expect(rounded.total).toBe(850);
    expect(rounded.total).toBe(rounded.travelTotal + rounded.lodgingTotal + rounded.onSiteTotal);
  });

  it("arrotonda il costo di viaggio a persona indipendentemente dal totale di viaggio", () => {
    const costs: ProposalCosts = {
      travelPerPerson: 68,
      travelTotal: 136,
      lodgingTotal: 0,
      onSiteTotal: 0,
      total: 136,
    };

    expect(roundProposalCosts(costs).travelPerPerson).toBe(50);
  });
});
