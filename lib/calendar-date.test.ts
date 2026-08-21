import { afterAll, describe, expect, it } from "vitest";
import { discoverTripsRequestSchema } from "./discover-trips-request";
import { buildDiscoverTripsRequestBody } from "./discover-trips-request-body";
import { buildDiscoverTripsPrompt } from "./discover-trips-prompt";
import { generateItineraryRequestSchema } from "./generate-itinerary-request";
import { buildGenerateItineraryRequestBody } from "./generate-itinerary-request-body";
import { buildItineraryPrompt } from "./itinerary-prompt";
import { buildCreaHref, decodeCreaPrefill } from "./crea-query-params";
import { formatCalendarDate } from "./calendar-date";
import { resolveProposalDates } from "./discover-trips-proposal-dates";
import type { TripProposal } from "./discover-trips-schema";

/**
 * Il difetto che questi test presidiano non si vede in locale, dove browser e server
 * condividono il fuso: si vede solo quando il client sta a un offset positivo (l'Italia)
 * e il server gira in UTC (Vercel). Per riprodurlo davvero il test deve quindi *cambiare
 * fuso a metà strada*: costruisce le date come le costruisce il browser di un utente
 * italiano, poi le rilegge come le rilegge il server.
 *
 * Node rilegge `process.env.TZ` a ogni operazione su Date, quindi cambiarlo a runtime è
 * sufficiente e non richiede di lanciare vitest due volte con TZ diversi. È l'approccio
 * più solido dei due possibili: fissare TZ per l'intero processo proverebbe solo che il
 * codice è coerente *dentro* un fuso, che è esattamente la condizione in cui il difetto
 * non si manifesta.
 */
const ORIGINAL_TZ = process.env.TZ;

function inTimeZone<T>(timeZone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return run();
  } finally {
    process.env.TZ = previous;
  }
}

afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

/** Il salto di rete: quello che sopravvive è solo ciò che JSON sa rappresentare. */
function overTheWire<T>(body: T): unknown {
  return JSON.parse(JSON.stringify(body));
}

const CLIENT_TZ = "Europe/Rome"; // UTC+2 il 10 ottobre
const SERVER_TZ = "UTC"; // Vercel

const participants = [{ type: "adulto" as const, age: 30 }];

describe("date di calendario fra client e server (fusi diversi)", () => {
  it("l'itinerario mantiene le date scelte quando il server sta in UTC", () => {
    const body = inTimeZone(CLIENT_TZ, () =>
      overTheWire(
        buildGenerateItineraryRequestBody({
          destination: "Lisbona",
          dateRange: { from: new Date(2026, 9, 10), to: new Date(2026, 9, 12) },
          participants,
          budget: 1000,
        })
      )
    );

    const prompt = inTimeZone(SERVER_TZ, () => {
      const parsed = generateItineraryRequestSchema.parse(body);
      return buildItineraryPrompt(parsed, null);
    });

    expect(prompt).toContain("dal 10/10/2026 al 12/10/2026");
    expect(prompt).toContain("(3 giorni)");
  });

  it("le proposte di /scopri mantengono le date scelte quando il server sta in UTC", () => {
    const body = inTimeZone(CLIENT_TZ, () =>
      overTheWire(
        buildDiscoverTripsRequestBody({
          departureCity: "Milano",
          dateMode: "esatte",
          dateRange: { from: new Date(2026, 9, 10), to: new Date(2026, 9, 12) },
          flexiblePeriod: {},
          participants,
          budget: 1500,
        })
      )
    );

    const prompt = inTimeZone(SERVER_TZ, () => {
      const parsed = discoverTripsRequestSchema.parse(body);
      return buildDiscoverTripsPrompt(parsed);
    });

    expect(prompt).toContain("dal 10/10/2026 al 12/10/2026");
  });

  it("la finestra suggerita passa da /scopri a /crea senza slittare di un giorno", () => {
    const proposal = {
      destination: "Porto",
      country: "Portogallo",
      whyItFits: "…",
      highlights: ["a", "b", "c"],
      costs: { travelPerPerson: 100, travelTotal: 100, lodgingTotal: 300, onSiteTotal: 200, total: 600 },
      suggestedFrom: "2026-10-10",
      suggestedTo: "2026-10-12",
    } as TripProposal;

    const body = inTimeZone(CLIENT_TZ, () => {
      const dates = resolveProposalDates(proposal, "flessibili", {});
      const href = buildCreaHref({ destination: "Porto", ...dates });
      const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
      const prefill = decodeCreaPrefill({
        destination: params.get("destination") ?? undefined,
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
      });
      return overTheWire(
        buildGenerateItineraryRequestBody({
          destination: prefill.destination!,
          dateRange: { from: prefill.from, to: prefill.to },
          participants,
          budget: 600,
        })
      );
    });

    const prompt = inTimeZone(SERVER_TZ, () =>
      buildItineraryPrompt(generateItineraryRequestSchema.parse(body), null)
    );

    expect(prompt).toContain("dal 10/10/2026 al 12/10/2026");
  });

  it("regge anche fra i due fusi più distanti fra loro", () => {
    const body = inTimeZone("Pacific/Kiritimati", () =>
      overTheWire(
        buildGenerateItineraryRequestBody({
          destination: "Lisbona",
          dateRange: { from: new Date(2026, 9, 10), to: new Date(2026, 9, 12) },
          participants,
          budget: 1000,
        })
      )
    );

    const prompt = inTimeZone("Pacific/Niue", () =>
      buildItineraryPrompt(generateItineraryRequestSchema.parse(body), null)
    );

    expect(prompt).toContain("dal 10/10/2026 al 12/10/2026");
  });
});

describe("formatCalendarDate", () => {
  /**
   * Le intestazioni dei giorni (a schermo e nel PDF) formattano la data che arriva dal
   * modello, già "yyyy-MM-dd". Con `new Date("2026-09-01")` — mezzanotte UTC — un utente
   * a offset negativo leggerebbe il giorno prima: qui il fuso è quello del solo lettore,
   * quindi basta un fuso negativo per far emergere il difetto.
   */
  it("mostra lo stesso giorno di calendario anche a offset negativo", () => {
    inTimeZone("America/New_York", () => {
      expect(formatCalendarDate("2026-09-01")).toBe("01/09/2026");
    });
  });

  it("mostra lo stesso giorno di calendario a offset positivo", () => {
    inTimeZone(CLIENT_TZ, () => {
      expect(formatCalendarDate("2026-09-01")).toBe("01/09/2026");
    });
  });

  it("restituisce la stringa intatta se non è una data valida", () => {
    expect(formatCalendarDate("12 settembre 2026")).toBe("12 settembre 2026");
  });
});
