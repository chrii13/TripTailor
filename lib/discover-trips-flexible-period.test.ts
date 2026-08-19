import { describe, it, expect } from "vitest";
import { buildFlexibleMonthOptions } from "./discover-trips-flexible-period";

describe("buildFlexibleMonthOptions", () => {
  it("genera 13 mesi, dal mese corrente ai 12 successivi", () => {
    const options = buildFlexibleMonthOptions(new Date(2026, 7, 19)); // 19 agosto 2026
    expect(options).toHaveLength(13);
    expect(options[0].value).toBe("2026-08");
    expect(options[12].value).toBe("2027-08");
  });

  it("etichetta i mesi in italiano", () => {
    const options = buildFlexibleMonthOptions(new Date(2026, 7, 19));
    expect(options[0].label).toBe("agosto 2026");
    expect(options[2].label).toBe("ottobre 2026");
  });

  it("attraversa correttamente il cambio anno", () => {
    const options = buildFlexibleMonthOptions(new Date(2026, 11, 1)); // dicembre 2026
    expect(options[0].value).toBe("2026-12");
    expect(options[1].value).toBe("2027-01");
    expect(options[1].label).toBe("gennaio 2027");
  });

  it("ignora giorno e orario di partenza, usa sempre l'inizio mese", () => {
    const optionsEarly = buildFlexibleMonthOptions(new Date(2026, 7, 1));
    const optionsLate = buildFlexibleMonthOptions(new Date(2026, 7, 31, 23, 59));
    expect(optionsEarly.map((o) => o.value)).toEqual(optionsLate.map((o) => o.value));
  });
});
