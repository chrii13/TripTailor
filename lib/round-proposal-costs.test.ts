import { describe, it, expect } from "vitest";
import { roundToNearestFifty, roundProposalCosts } from "./round-proposal-costs";
import type { ProposalCosts } from "./discover-trips-schema";

describe("roundToNearestFifty", () => {
  it("arrotonda per eccesso oltre la metà dell'intervallo (>=100, cinquantina)", () => {
    expect(roundToNearestFifty(1176)).toBe(1200);
  });

  it("arrotonda per difetto sotto la metà dell'intervallo (>=100, cinquantina)", () => {
    expect(roundToNearestFifty(1124)).toBe(1100);
  });

  it("lascia invariato un valore già multiplo di 50", () => {
    expect(roundToNearestFifty(500)).toBe(500);
  });

  it("arrotonda zero a zero (un alloggio a costo zero in una gita in giornata è legittimo)", () => {
    expect(roundToNearestFifty(0)).toBe(0);
  });

  it("sotto i 100€ arrotonda alla cinquina, non alla cinquantina", () => {
    expect(roundToNearestFifty(22)).toBe(20);
    expect(roundToNearestFifty(23)).toBe(25);
  });

  it("un valore reale sotto la cinquina non diventa mai 0 (si legge come gratis)", () => {
    expect(roundToNearestFifty(1)).toBe(5);
    expect(roundToNearestFifty(2)).toBe(5);
    expect(roundToNearestFifty(10)).toBe(10);
  });

  it("al confine dei 100€ (escluso) resta sulla cinquina", () => {
    expect(roundToNearestFifty(99)).toBe(100);
  });

  it("da 100€ in su (incluso il confine) passa alla cinquantina", () => {
    expect(roundToNearestFifty(100)).toBe(100);
    expect(roundToNearestFifty(110)).toBe(100);
    expect(roundToNearestFifty(130)).toBe(150);
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

    // 68€ è sotto i 100€: arrotonda alla cinquina, non alla cinquantina.
    expect(roundProposalCosts(costs).travelPerPerson).toBe(70);
  });

  it("una gita in giornata con costi piccoli non mostra mai '~0€' per una voce reale", () => {
    const costs: ProposalCosts = {
      travelPerPerson: 10,
      travelTotal: 20,
      lodgingTotal: 0,
      onSiteTotal: 15,
      total: 35,
    };

    const rounded = roundProposalCosts(costs);

    expect(rounded.travelPerPerson).toBe(10);
    expect(rounded.travelTotal).toBe(20);
    expect(rounded.lodgingTotal).toBe(0); // alloggio a costo zero: legittimo, resta 0
    expect(rounded.onSiteTotal).toBe(15);
    expect(rounded.total).toBe(35);
    expect(rounded.total).toBe(rounded.travelTotal + rounded.lodgingTotal + rounded.onSiteTotal);
  });

  it("le righe mostrate sommano sempre al totale mostrato su un mix di importi piccoli e grandi", () => {
    const costs: ProposalCosts = {
      travelPerPerson: 5,
      travelTotal: 10,
      lodgingTotal: 780,
      onSiteTotal: 92,
      total: 882,
    };

    const rounded = roundProposalCosts(costs);

    expect(rounded.travelTotal).toBe(10);
    expect(rounded.lodgingTotal).toBe(800);
    expect(rounded.onSiteTotal).toBe(90);
    expect(rounded.total).toBe(rounded.travelTotal + rounded.lodgingTotal + rounded.onSiteTotal);
  });
});
