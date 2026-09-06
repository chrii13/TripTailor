import { describe, it, expect } from "vitest";
import { budgetUsagePercent, derivePerPerson } from "./proposal-card";

describe("derivePerPerson", () => {
  it("ricava la cifra a persona dal totale mostrato, non da quella del modello", () => {
    // Caso del report: 4 viaggiatori, il modello dice 120 a persona ma 200 in totale.
    expect(derivePerPerson(200, 4)).toBe(50);
  });

  it("torna sempre col totale mostrato quando la divisione è esatta", () => {
    expect(derivePerPerson(480, 4) * 4).toBe(480);
  });

  it("non riarrotonda alla cinquantina quando la divisione non è esatta", () => {
    // 200 / 3 = 66,67: l'arrotondamento alla cinquantina darebbe 50 (×3 = 150),
    // una cifra che contraddirebbe di nuovo il totale accanto.
    expect(derivePerPerson(200, 3)).toBe(67);
  });

  it("con un solo viaggiatore la cifra a persona coincide col totale", () => {
    expect(derivePerPerson(235, 1)).toBe(235);
  });

  it("vale anche per la riga 'Per persona' del totale del viaggio", () => {
    // Caso della revisione: totale 700 con 3 viaggiatori. Alla cinquantina la
    // card mostrava "Per persona ~250 €", che per tre fa 750 — in contraddizione
    // col totale scritto due righe sopra. All'euro lo scarto scende a 1€.
    expect(derivePerPerson(700, 3)).toBe(233);
    expect(Math.abs(derivePerPerson(700, 3) * 3 - 700)).toBeLessThanOrEqual(2);
  });
});

describe("budgetUsagePercent", () => {
  it("arrotonda all'intero la quota di budget usata", () => {
    // 850 / 1200 = 70,83%.
    expect(budgetUsagePercent(850, 1200)).toBe(71);
  });

  it("non supera mai 100, nemmeno per arrotondamento", () => {
    // 1207 / 1200 = 100,58%: senza tetto l'arrotondamento darebbe 101 e il
    // riempimento sforerebbe il binario. Il caso non è teorico: basta una
    // proposta appena sopra il budget perché la cinquantina la faccia sfiorare.
    expect(budgetUsagePercent(1207, 1200)).toBe(100);
    // 1199 / 1200 = 99,92%: qui il tetto non c'entra, arrotonda a 100 da sé.
    expect(budgetUsagePercent(1199, 1200)).toBe(100);
  });

  it("blocca a 100 una proposta che sfora il budget", () => {
    expect(budgetUsagePercent(1500, 1200)).toBe(100);
  });

  it("con budget a zero non divide e non disegna nulla", () => {
    expect(budgetUsagePercent(850, 0)).toBeNull();
  });

  it("con budget mancante o non numerico non produce NaN", () => {
    expect(budgetUsagePercent(850, Number.NaN)).toBeNull();
    expect(budgetUsagePercent(850, -100)).toBeNull();
  });

  it("una proposta a costo zero usa zero per cento, non null", () => {
    expect(budgetUsagePercent(0, 1200)).toBe(0);
  });
});
