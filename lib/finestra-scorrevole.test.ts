import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { finestraScorrevole } from "./finestra-scorrevole";

const { attendi } = vi.hoisted(() => ({
  attendi: vi.fn<(ms: number) => Promise<void>>(async () => {}),
}));
vi.mock("./attesa", () => ({ attendi }));

// L'orologio è finto e non avanza da solo: ogni prova decide quanto tempo è passato.
let adesso = 1_000_000;

beforeEach(() => {
  attendi.mockClear();
  adesso = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => adesso);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("finestraScorrevole", () => {
  it("aspetta il tempo che manca all'intervallo, non l'intervallo intero", async () => {
    const finestra = finestraScorrevole(1_000);
    adesso += 300;

    expect(finestra.attesaMs()).toBe(700);
    await finestra.distanzia();
    expect(attendi).toHaveBeenCalledWith(700);
  });

  // È la proprietà che rende la finestra preferibile a una pausa fissa: chi ha già
  // consumato l'intervallo aspettando la risposta non lo paga una seconda volta.
  it("non aspetta affatto quando l'intervallo è già trascorso", async () => {
    const finestra = finestraScorrevole(1_000);
    adesso += 4_000;

    await finestra.distanzia();
    expect(attendi).not.toHaveBeenCalled();
  });

  it("conta la finestra successiva dalla fine dell'attesa, non dall'apertura precedente", async () => {
    const finestra = finestraScorrevole(1_000);

    adesso += 1_000;
    await finestra.distanzia();
    adesso += 400;

    expect(finestra.attesaMs()).toBe(600);
  });

  // Il caso di chi non ha nulla da cui distanziarsi: la prima interrogazione Overpass di un
  // itinerario parte subito, e solo la seconda paga la finestra.
  it("con inizio all'epoch la prima finestra è già scaduta", async () => {
    const finestra = finestraScorrevole(1_000, 0);

    expect(finestra.attesaMs()).toBeLessThan(0);
    await finestra.distanzia();
    expect(attendi).not.toHaveBeenCalled();

    adesso += 200;
    expect(finestra.attesaMs()).toBe(800);
  });
});
