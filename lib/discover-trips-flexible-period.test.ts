import { describe, it, expect } from "vitest";
import {
  buildFlexibleMonthOptions,
  isFlexibleMonthPast,
  isFlexibleMonthValue,
} from "./discover-trips-flexible-period";

describe("buildFlexibleMonthOptions", () => {
  it("genera 13 mesi, dal mese corrente ai 12 successivi", () => {
    const options = buildFlexibleMonthOptions(new Date(2026, 7, 19)); // 19 agosto 2026
    expect(options).toHaveLength(13);
    expect(options[0].value).toBe("2026-08");
    expect(options[12].value).toBe("2027-08");
  });

  it("etichetta i mesi in italiano con l'iniziale maiuscola", () => {
    const options = buildFlexibleMonthOptions(new Date(2026, 7, 19));
    expect(options[0].label).toBe("Agosto 2026");
    expect(options[2].label).toBe("Ottobre 2026");
  });

  it("attraversa correttamente il cambio anno", () => {
    const options = buildFlexibleMonthOptions(new Date(2026, 11, 1)); // dicembre 2026
    expect(options[0].value).toBe("2026-12");
    expect(options[1].value).toBe("2027-01");
    expect(options[1].label).toBe("Gennaio 2027");
  });

  it("ignora giorno e orario di partenza, usa sempre l'inizio mese", () => {
    const optionsEarly = buildFlexibleMonthOptions(new Date(2026, 7, 1));
    const optionsLate = buildFlexibleMonthOptions(new Date(2026, 7, 31, 23, 59));
    expect(optionsEarly.map((o) => o.value)).toEqual(optionsLate.map((o) => o.value));
  });
});

describe("isFlexibleMonthPast", () => {
  it("accetta il mese in corso, anche nel suo ultimo giorno", () => {
    expect(isFlexibleMonthPast("2026-08", new Date(2026, 7, 31))).toBe(false);
  });

  it("accetta un mese futuro", () => {
    expect(isFlexibleMonthPast("2026-12", new Date(2026, 7, 19))).toBe(false);
  });

  it("scarta il mese appena finito, il giorno dopo la mezzanotte", () => {
    expect(isFlexibleMonthPast("2026-08", new Date(2026, 8, 1))).toBe(true);
  });

  it("scarta un mese dell'anno precedente", () => {
    expect(isFlexibleMonthPast("2025-12", new Date(2026, 0, 1))).toBe(true);
  });

  it("non considera passato un mese di un anno successivo con numero più basso", () => {
    expect(isFlexibleMonthPast("2027-01", new Date(2026, 11, 31))).toBe(false);
  });
});

describe("isFlexibleMonthValue", () => {
  it("accetta un mese nel formato dell'elenco", () => {
    expect(isFlexibleMonthValue("2026-08")).toBe(true);
    expect(isFlexibleMonthValue("2027-01")).toBe(true);
    expect(isFlexibleMonthValue("2026-12")).toBe(true);
  });

  it("rifiuta un testo che non è una data", () => {
    expect(isFlexibleMonthValue("pippo")).toBe(false);
    expect(isFlexibleMonthValue("")).toBe(false);
  });

  it("rifiuta un numero di mese inesistente", () => {
    expect(isFlexibleMonthValue("2026-13")).toBe(false);
    expect(isFlexibleMonthValue("2026-00")).toBe(false);
  });

  it("rifiuta le forme quasi giuste", () => {
    expect(isFlexibleMonthValue("2026-8")).toBe(false);
    expect(isFlexibleMonthValue("2026-08-10")).toBe(false);
    expect(isFlexibleMonthValue(" 2026-08")).toBe(false);
  });
});
