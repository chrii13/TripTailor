import { describe, it, expect } from "vitest";
import { budgetIsComparable, derivePerPerson } from "./proposal-card";

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

describe("budgetIsComparable", () => {
  // Non resta niente dei sei test sull'arrotondamento e sul tetto a 100:
  // proteggevano un numero che nessuno scrive piu' a schermo da quando la barra
  // e' stata tolta. Qui restano i casi che contano davvero, cioe' quelli in cui
  // la riga dei conti scriverebbe "su NaN euro".
  it("un budget positivo regge il confronto", () => {
    expect(budgetIsComparable(1200)).toBe(true);
  });

  it("un budget a zero no: non ci si puo' rapportare niente", () => {
    expect(budgetIsComparable(0)).toBe(false);
  });

  it("un budget negativo o non numerico no", () => {
    expect(budgetIsComparable(-100)).toBe(false);
    expect(budgetIsComparable(Number.NaN)).toBe(false);
    expect(budgetIsComparable(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
