import { describe, it, expect } from "vitest";
import {
  clearExpiredFlexibleMonth,
  isDiscoverSearchExpired,
} from "./discover-trips-expired-search";

const OGGI = new Date(2026, 7, 24); // 24 agosto 2026, mezzanotte locale

describe("isDiscoverSearchExpired", () => {
  it("non considera scaduta una ricerca a date esatte che comincia oggi", () => {
    expect(
      isDiscoverSearchExpired(
        {
          dateMode: "esatte",
          dateRange: { from: new Date(2026, 7, 24), to: new Date(2026, 7, 28) },
          flexiblePeriod: {},
        },
        OGGI
      )
    ).toBe(false);
  });

  it("considera scaduta una ricerca a date esatte cominciata ieri", () => {
    expect(
      isDiscoverSearchExpired(
        {
          dateMode: "esatte",
          dateRange: { from: new Date(2026, 7, 23), to: new Date(2026, 7, 28) },
          flexiblePeriod: {},
        },
        OGGI
      )
    ).toBe(true);
  });

  it("non considera scaduta una ricerca a date esatte tutta nel futuro", () => {
    expect(
      isDiscoverSearchExpired(
        {
          dateMode: "esatte",
          dateRange: { from: new Date(2026, 9, 1), to: new Date(2026, 9, 8) },
          flexiblePeriod: {},
        },
        OGGI
      )
    ).toBe(false);
  });

  it("guarda solo il mese quando la ricerca era a periodo flessibile", () => {
    const flessibile = {
      dateMode: "flessibili" as const,
      // Date esatte rimaste nello stato del form ma non usate dalla ricerca.
      dateRange: { from: new Date(2020, 0, 1), to: new Date(2020, 0, 5) },
      flexiblePeriod: { month: "2026-10", nights: 7 },
    };
    expect(isDiscoverSearchExpired(flessibile, OGGI)).toBe(false);
  });

  it("considera scaduta una ricerca flessibile su un mese già finito", () => {
    expect(
      isDiscoverSearchExpired(
        {
          dateMode: "flessibili",
          dateRange: {},
          flexiblePeriod: { month: "2026-07", nights: 7 },
        },
        OGGI
      )
    ).toBe(true);
  });

  it("non considera scaduto il mese in corso", () => {
    expect(
      isDiscoverSearchExpired(
        {
          dateMode: "flessibili",
          dateRange: {},
          flexiblePeriod: { month: "2026-08", nights: 7 },
        },
        OGGI
      )
    ).toBe(false);
  });

  it("non segnala nulla quando il periodo salvato è incompleto", () => {
    expect(
      isDiscoverSearchExpired({ dateMode: "esatte", dateRange: {}, flexiblePeriod: {} }, OGGI)
    ).toBe(false);
    expect(
      isDiscoverSearchExpired({ dateMode: "flessibili", dateRange: {}, flexiblePeriod: {} }, OGGI)
    ).toBe(false);
  });
});

describe("clearExpiredFlexibleMonth", () => {
  it("toglie il mese quando è ormai passato", () => {
    const ripristinata = clearExpiredFlexibleMonth(
      {
        dateMode: "flessibili" as const,
        dateRange: {},
        flexiblePeriod: { month: "2026-07", nights: 7 },
      },
      OGGI
    );
    expect(ripristinata.flexiblePeriod.month).toBeUndefined();
    expect(ripristinata.flexiblePeriod.nights).toBe(7);
  });

  it("lascia intatto un mese ancora valido", () => {
    const originale = {
      dateMode: "flessibili" as const,
      dateRange: {},
      flexiblePeriod: { month: "2026-08", nights: 7 },
    };
    expect(clearExpiredFlexibleMonth(originale, OGGI)).toBe(originale);
  });

  it("non tocca una ricerca a date esatte, nemmeno con un mese fossile nello stato", () => {
    const originale = {
      dateMode: "esatte" as const,
      dateRange: { from: new Date(2026, 7, 24), to: new Date(2026, 7, 28) },
      flexiblePeriod: { month: "2020-01", nights: 3 },
    };
    expect(clearExpiredFlexibleMonth(originale, OGGI)).toBe(originale);
  });

  it("conserva gli altri campi della ricerca", () => {
    const ripristinata = clearExpiredFlexibleMonth(
      {
        dateMode: "flessibili" as const,
        dateRange: {},
        flexiblePeriod: { month: "2026-07", nights: 5 },
        departureCity: "Milano, Italia",
      },
      OGGI
    );
    expect(ripristinata.departureCity).toBe("Milano, Italia");
  });
});
