import { describe, it, expect } from "vitest";
import { computeDeadline, getCallAttemptBudget } from "./gemini-call-budget";

describe("computeDeadline", () => {
  it("somma il budget utilizzabile all'istante di partenza", () => {
    expect(computeDeadline(1_000, 55_000)).toBe(56_000);
  });
});

describe("getCallAttemptBudget", () => {
  it("concede il tetto per chiamata quando il tempo restante lo supera ampiamente", () => {
    const deadline = 100_000;
    const now = 10_000; // 90_000ms restanti
    const budget = getCallAttemptBudget(deadline, now, 50_000, 10_000);

    expect(budget.remainingMs).toBe(90_000);
    expect(budget.callTimeoutMs).toBe(50_000);
  });

  it("accorcia il timeout al tempo restante quando è sotto al tetto per chiamata", () => {
    const deadline = 100_000;
    const now = 80_000; // 20_000ms restanti, sotto il tetto di 50_000
    const budget = getCallAttemptBudget(deadline, now, 50_000, 10_000);

    expect(budget.remainingMs).toBe(20_000);
    expect(budget.callTimeoutMs).toBe(20_000);
  });

  it("rinuncia (callTimeoutMs null) quando il tempo restante è sotto la soglia minima", () => {
    const deadline = 100_000;
    const now = 95_000; // 5_000ms restanti, sotto la soglia minima di 10_000
    const budget = getCallAttemptBudget(deadline, now, 50_000, 10_000);

    expect(budget.remainingMs).toBe(5_000);
    expect(budget.callTimeoutMs).toBeNull();
  });

  it("concede ancora un tentativo quando il tempo restante è esattamente pari alla soglia minima", () => {
    const deadline = 100_000;
    const now = 90_000; // esattamente 10_000ms restanti, pari alla soglia minima
    const budget = getCallAttemptBudget(deadline, now, 50_000, 10_000);

    expect(budget.remainingMs).toBe(10_000);
    expect(budget.callTimeoutMs).toBe(10_000);
  });

  it("rinuncia quando il tempo restante è anche solo 1ms sotto la soglia minima", () => {
    const deadline = 100_000;
    const now = 90_001; // 9_999ms restanti, appena sotto la soglia minima
    const budget = getCallAttemptBudget(deadline, now, 50_000, 10_000);

    expect(budget.remainingMs).toBe(9_999);
    expect(budget.callTimeoutMs).toBeNull();
  });

  it("appena sopra la soglia minima concede un timeout pari al tempo restante", () => {
    const deadline = 100_000;
    const now = 89_999; // 10_001ms restanti, appena sopra la soglia minima
    const budget = getCallAttemptBudget(deadline, now, 50_000, 10_000);

    expect(budget.callTimeoutMs).toBe(10_001);
  });

  it("restituisce comunque un remainingMs negativo quando la scadenza è già passata", () => {
    const deadline = 100_000;
    const now = 120_000;
    const budget = getCallAttemptBudget(deadline, now, 50_000, 10_000);

    expect(budget.remainingMs).toBe(-20_000);
    expect(budget.callTimeoutMs).toBeNull();
  });

  it("il guinzaglio si accorcia progressivamente su tentativi successivi verso la scadenza", () => {
    const deadline = 100_000;
    const perCallCap = 50_000;
    const minRemaining = 10_000;

    const first = getCallAttemptBudget(deadline, 10_000, perCallCap, minRemaining);
    const second = getCallAttemptBudget(deadline, 60_000, perCallCap, minRemaining);
    const third = getCallAttemptBudget(deadline, 92_000, perCallCap, minRemaining);

    expect(first.callTimeoutMs).toBe(50_000);
    expect(second.callTimeoutMs).toBe(40_000);
    expect(third.callTimeoutMs).toBeNull();
  });
});
