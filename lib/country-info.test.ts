import { describe, it, expect } from "vitest";
import { getCountryInfo } from "./country-info";

describe("getCountryInfo", () => {
  it("restituisce valuta, lingua e fuso orario per un paese con un solo fuso (Giappone)", () => {
    const result = getCountryInfo("JP");
    expect(result).not.toBeNull();
    expect(result?.currency.code).toBe("JPY");
    expect(result?.currency.symbol).toBe("¥");
    expect(result?.languages).toContain("giapponese");
    expect(result?.timezones).toEqual(["UTC+9"]);
  });

  it("restituisce più fusi orari distinti per un paese con più fusi (Stati Uniti)", () => {
    const result = getCountryInfo("US");
    expect(result).not.toBeNull();
    expect(result?.timezones.length).toBeGreaterThan(1);
    for (const tz of result?.timezones ?? []) {
      expect(tz).toMatch(/^UTC[+-]\d+(:\d{2})?$/);
    }
  });

  it("accetta il codice paese anche in minuscolo", () => {
    const result = getCountryInfo("jp");
    expect(result).not.toBeNull();
    expect(result?.currency.code).toBe("JPY");
  });

  it("restituisce null per un codice paese non riconosciuto", () => {
    expect(getCountryInfo("ZZ")).toBeNull();
  });

  it("restituisce nome del paese in italiano e codice ISO normalizzato", () => {
    const result = getCountryInfo("pt");
    expect(result?.name).toBe("Portogallo");
    expect(result?.code).toBe("PT");
  });

  it("restituisce nomi delle lingue in italiano, non in inglese", () => {
    const result = getCountryInfo("FR");
    expect(result?.languages).toContain("francese");
    expect(result?.languages).not.toContain("French");
  });
});
