import { describe, it, expect } from "vitest";
import { verifyItineraryDays } from "./verify-itinerary-days";

/**
 * Node rilegge `process.env.TZ` a ogni operazione su Date, quindi imporre il fuso a
 * runtime basta e non richiede di lanciare vitest due volte. Stessa scelta (e stesso
 * motivo) di calendar-date.test.ts: un test che gira nel fuso della macchina passa
 * ovunque e non fa da rete dove il codice gira davvero, cioè in UTC.
 */
function inTimeZone<T>(timeZone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return run();
  } finally {
    process.env.TZ = previous;
  }
}

/** Mezzanotte locale, come la ricostruisce calendarDateSchema dalla richiesta. */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function days(...dates: string[]) {
  return dates.map((date) => ({ date }));
}

describe("verifyItineraryDays", () => {
  it("accetta i giorni che coprono esattamente l'intervallo richiesto", () => {
    const result = verifyItineraryDays(
      days("2026-10-10", "2026-10-11", "2026-10-12"),
      localDate(2026, 10, 10),
      localDate(2026, 10, 12)
    );
    expect(result).toBe(true);
  });

  it("accetta un viaggio di un solo giorno", () => {
    const result = verifyItineraryDays(days("2026-10-10"), localDate(2026, 10, 10), localDate(2026, 10, 10));
    expect(result).toBe(true);
  });

  it("scarta una risposta senza nemmeno un giorno", () => {
    const result = verifyItineraryDays([], localDate(2026, 10, 10), localDate(2026, 10, 12));
    expect(result).toBe(false);
  });

  it("scarta un itinerario più corto dell'intervallo richiesto", () => {
    const result = verifyItineraryDays(
      days("2026-10-10", "2026-10-11"),
      localDate(2026, 10, 10),
      localDate(2026, 10, 12)
    );
    expect(result).toBe(false);
  });

  it("scarta un itinerario più lungo dell'intervallo richiesto", () => {
    const result = verifyItineraryDays(
      days("2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"),
      localDate(2026, 10, 10),
      localDate(2026, 10, 12)
    );
    expect(result).toBe(false);
  });

  it("scarta giorni duplicati anche quando il conteggio torna", () => {
    const result = verifyItineraryDays(
      days("2026-10-10", "2026-10-11", "2026-10-11"),
      localDate(2026, 10, 10),
      localDate(2026, 10, 12)
    );
    expect(result).toBe(false);
  });

  it("scarta giorni giusti ma in ordine sbagliato", () => {
    const result = verifyItineraryDays(
      days("2026-10-12", "2026-10-10", "2026-10-11"),
      localDate(2026, 10, 10),
      localDate(2026, 10, 12)
    );
    expect(result).toBe(false);
  });

  it("scarta una data fuori dall'intervallo richiesto, anche se ben formata", () => {
    const result = verifyItineraryDays(
      days("1999-10-10", "1999-10-11", "1999-10-12"),
      localDate(2026, 10, 10),
      localDate(2026, 10, 12)
    );
    expect(result).toBe(false);
  });

  it("attraversa il confine di mese e di anno", () => {
    const result = verifyItineraryDays(
      days("2026-12-30", "2026-12-31", "2027-01-01"),
      localDate(2026, 12, 30),
      localDate(2027, 1, 1)
    );
    expect(result).toBe(true);
  });

  // Il 29 marzo 2026 l'Italia passa all'ora legale: quel giorno dura 23 ore. Sommare
  // 24 ore alla volta a un timestamp salterebbe un giorno di calendario — è lo stesso
  // genere di slittamento che la regola sulle date di calendario esiste per evitare.
  // Il fuso va imposto a runtime, come in calendar-date.test.ts: CI e Vercel girano in
  // UTC, dove il 29 marzo dura 24 ore e il caso non proverebbe nulla.
  it("regge il giorno del cambio d'ora (23 ore) senza saltare una data", () => {
    const result = inTimeZone("Europe/Rome", () =>
      verifyItineraryDays(
        days("2026-03-28", "2026-03-29", "2026-03-30"),
        localDate(2026, 3, 28),
        localDate(2026, 3, 30)
      )
    );
    expect(result).toBe(true);
  });

  // Il caso opposto, e più insidioso: a São Paulo l'ora legale scattava a mezzanotte,
  // quindi il giorno *non ha* una mezzanotte e `new Date(y, m, d)` restituisce le 01:00.
  it("regge un fuso in cui il cambio d'ora cancella la mezzanotte", () => {
    const result = inTimeZone("America/Sao_Paulo", () =>
      verifyItineraryDays(
        days("2018-11-03", "2018-11-04", "2018-11-05"),
        localDate(2018, 11, 3),
        localDate(2018, 11, 5)
      )
    );
    expect(result).toBe(true);
  });

  it("scarta un intervallo incoerente (fine prima dell'inizio) invece di accettarlo per errore", () => {
    const result = verifyItineraryDays(days("2026-10-12"), localDate(2026, 10, 12), localDate(2026, 10, 10));
    expect(result).toBe(false);
  });
});
