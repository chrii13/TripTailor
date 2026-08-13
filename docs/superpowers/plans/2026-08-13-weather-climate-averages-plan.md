# Weather (Historical Climate Averages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-year historical climate average (temperature range + rain likelihood) per trip day, computed server-side from real coordinates, fed into the AI prompt to influence activity choices and shown to the user alongside the generated itinerary — always as an average, never framed as a forecast, and never blocking generation if any step of the pipeline fails.

**Architecture:** Two new, self-contained `lib/` modules do the data work: `geocode-destination.ts` (LocationIQ forward search → coordinates) and `climate-forecast.ts` (Open-Meteo historical archive → per-day 5-year averages). `app/api/generate-itinerary/route.ts` calls both, in sequence, after validating the request and confirming `GEMINI_API_KEY` is configured but before building the prompt — a failure at either step degrades to `null` and generation proceeds exactly as it did before this feature existed. `buildItineraryPrompt` gains a second parameter for the (possibly-null) climate data; when present, it's rendered into the prompt with instructions to calibrate activities, replacing the old blanket "never mention weather" instruction. The route's JSON response gains a sibling `weather` field alongside `itinerary` — it is not part of `itineraryResponseSchema` (which constrains only what Gemini must produce) since this is data the route computes itself. The client threads this new field through the same `mode`/state pattern already used for `itinerary`, and `ItineraryResult` renders one extra line per day card when a match exists.

**Tech Stack:** Next.js 16 (App Router), TypeScript, zod v4, date-fns, vitest. No new npm dependency. No new environment variable — reuses `LOCATIONIQ_API_KEY` (already configured); Open-Meteo needs no key at all.

## Global Constraints

- Provider is **Open-Meteo** (`archive-api.open-meteo.com`), not OpenWeatherMap — free, keyless, no credit card. `OPENWEATHER_API_KEY` (an unused Fase-1 placeholder) is removed from `.env.local`, `.env.local.example`, and `CLAUDE.md` as part of this work.
- The feature always computes a **5-year historical average**, never a real forecast — this is deliberate (consistent behavior regardless of how far the trip is from today), not a fallback for when a "real" forecast is unavailable.
- Geocoding uses LocationIQ's **`/v1/search`** endpoint (forward geocoding, full-string lookup) — a different endpoint from `/v1/autocomplete`, which is already used elsewhere in this project for incremental typing and must not be reused for this.
- **Every step degrades to `null`, never to an error the user sees.** A missing/failed geocode, a failed or partial Open-Meteo fetch, or a missing `LOCATIONIQ_API_KEY` all result in `weather: null` in the final response — itinerary generation itself is never blocked or slowed down more than necessary by a weather-pipeline failure.
- The `GEMINI_API_KEY` configuration check in `route.ts` must run **before** the geocoding call — this is not just for fail-fast ordering, it's what keeps the route's existing "missing key → config error" test free of any real network call (that test's request body targets a real, currently-configured `LOCATIONIQ_API_KEY`, so if geocoding ran first, that test would silently start hitting the real LocationIQ API).
- `itineraryResponseSchema` (what Gemini's structured output must conform to) does **not** change — weather is a sibling field in the route's JSON response, never part of what the AI generates or what validates its output.
- No automated test may call the real LocationIQ or Open-Meteo APIs. The pure aggregation logic (turning several years of raw daily data into one set of averages) is a deterministic function with no network dependency and **is** unit-tested with fixture data — this is different from, and stricter than, "no test touches the network," so don't skip it.

---

### Task 1: Geocoding and climate-average data layer

**Files:**
- Create: `lib/geocode-destination.ts`
- Create: `lib/geocode-destination.test.ts`
- Create: `lib/climate-forecast.ts`
- Create: `lib/climate-forecast.test.ts`

**Interfaces:**
- Consumes: nothing from elsewhere in the codebase — both modules are self-contained.
- Produces:
  - `lib/geocode-destination.ts`: `export interface Coordinates { lat: number; lon: number }` and `export async function geocodeDestination(destination: string): Promise<Coordinates | null>`.
  - `lib/climate-forecast.ts`: `export interface DailyClimateAverage { date: string; tempMaxAvg: number; tempMinAvg: number; precipitationChance: number }`, `export function averageDailyClimate(responses: OpenMeteoArchiveResponse[], tripStart: Date): DailyClimateAverage[] | null` (pure, exported specifically so it's unit-testable), and `export async function getClimateAverages(lat: number, lon: number, tripStart: Date, tripEnd: Date): Promise<DailyClimateAverage[] | null>`. Task 2 imports `geocodeDestination`, `getClimateAverages`, and the `DailyClimateAverage` type; Task 3 imports the `DailyClimateAverage` type.

- [ ] **Step 1: Write the failing test for `geocodeDestination`**

Create `lib/geocode-destination.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { geocodeDestination } from "./geocode-destination";

describe("geocodeDestination", () => {
  it("restituisce null senza chiamare LocationIQ quando la chiave non è configurata", async () => {
    const originalKey = process.env.LOCATIONIQ_API_KEY;
    delete process.env.LOCATIONIQ_API_KEY;

    try {
      const result = await geocodeDestination("Roma, Italia");
      expect(result).toBeNull();
    } finally {
      if (originalKey !== undefined) {
        process.env.LOCATIONIQ_API_KEY = originalKey;
      }
    }
  });
});
```

This never reaches the network — the missing-key branch returns before any `fetch` call. The `try/finally` restore (not a plain assignment) matters: it's the same pattern this project's other env-var tests already use, specifically because a plain assignment would leak an empty/wrong key into later tests if an assertion above it threw.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module './geocode-destination'" (the file doesn't exist yet).

- [ ] **Step 3: Create `lib/geocode-destination.ts`**

```ts
interface LocationIqSearchResult {
  lat: string;
  lon: string;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export async function geocodeDestination(destination: string): Promise<Coordinates | null> {
  const apiKey = process.env.LOCATIONIQ_API_KEY;

  if (!apiKey) {
    return null;
  }

  const url = new URL("https://api.locationiq.com/v1/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", destination);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      return null;
    }

    const data: LocationIqSearchResult[] = await response.json();

    if (data.length === 0) {
      return null;
    }

    const lat = Number.parseFloat(data[0].lat);
    const lon = Number.parseFloat(data[0].lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }

    return { lat, lon };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — the 1 test in `lib/geocode-destination.test.ts` passes.

- [ ] **Step 5: Commit**

```bash
git add lib/geocode-destination.ts lib/geocode-destination.test.ts
git commit -m "feat: add LocationIQ forward-geocoding helper for destination coordinates"
```

- [ ] **Step 6: Write the failing tests for `averageDailyClimate`**

Create `lib/climate-forecast.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { averageDailyClimate } from "./climate-forecast";

function makeResponse(tempsMax: (number | null)[], tempsMin: (number | null)[], precipitation: (number | null)[]) {
  return {
    daily: {
      time: tempsMax.map((_, i) => `2025-09-0${i + 1}`),
      temperature_2m_max: tempsMax,
      temperature_2m_min: tempsMin,
      precipitation_sum: precipitation,
    },
  };
}

describe("averageDailyClimate", () => {
  it("restituisce null quando non ci sono risposte", () => {
    expect(averageDailyClimate([], new Date("2026-09-01"))).toBeNull();
  });

  it("calcola la media di temperatura e la percentuale di pioggia su più anni", () => {
    const responses = [
      makeResponse([28, 26], [18, 16], [0, 5]),
      makeResponse([24, 22], [14, 12], [2, 0]),
      makeResponse([26, 24], [16, 14], [3, 0]),
    ];

    const result = averageDailyClimate(responses, new Date("2026-09-01"));

    expect(result).toEqual([
      { date: "2026-09-01", tempMaxAvg: 26, tempMinAvg: 16, precipitationChance: 67 },
      { date: "2026-09-02", tempMaxAvg: 24, tempMinAvg: 14, precipitationChance: 33 },
    ]);
  });

  it("ignora gli anni con dati mancanti (null) per un giorno specifico", () => {
    const responses = [
      makeResponse([28], [18], [0]),
      makeResponse([null], [null], [null]),
      makeResponse([26], [16], [2]),
    ];

    const result = averageDailyClimate(responses, new Date("2026-09-01"));

    expect(result).toEqual([
      { date: "2026-09-01", tempMaxAvg: 27, tempMinAvg: 17, precipitationChance: 50 },
    ]);
  });

  it("usa il numero minimo di giorni tra le risposte quando differiscono", () => {
    const responses = [
      makeResponse([28, 26, 24], [18, 16, 14], [0, 0, 0]),
      makeResponse([24, 22], [14, 12], [0, 0]),
    ];

    const result = averageDailyClimate(responses, new Date("2026-09-01"));

    expect(result).toHaveLength(2);
  });

  it("restituisce null se nessun giorno ha dati validi", () => {
    const responses = [makeResponse([null], [null], [null])];

    expect(averageDailyClimate(responses, new Date("2026-09-01"))).toBeNull();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module './climate-forecast'" (the file doesn't exist yet).

- [ ] **Step 8: Create `lib/climate-forecast.ts`**

```ts
import { subYears, addDays, format } from "date-fns";

const HISTORY_YEARS = 5;

export interface DailyClimateAverage {
  date: string;
  tempMaxAvg: number;
  tempMinAvg: number;
  precipitationChance: number;
}

export interface OpenMeteoArchiveResponse {
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

async function fetchHistoricalYear(
  lat: number,
  lon: number,
  start: Date,
  end: Date
): Promise<OpenMeteoArchiveResponse | null> {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", format(start, "yyyy-MM-dd"));
  url.searchParams.set("end_date", format(end, "yyyy-MM-dd"));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("timezone", "auto");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

export function averageDailyClimate(
  responses: OpenMeteoArchiveResponse[],
  tripStart: Date
): DailyClimateAverage[] | null {
  if (responses.length === 0) {
    return null;
  }

  const dayCount = Math.min(...responses.map((response) => response.daily.time.length));
  const results: DailyClimateAverage[] = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const maxTemps: number[] = [];
    const minTemps: number[] = [];
    let rainYears = 0;
    let validYears = 0;

    for (const response of responses) {
      const max = response.daily.temperature_2m_max[dayIndex];
      const min = response.daily.temperature_2m_min[dayIndex];
      const precipitation = response.daily.precipitation_sum[dayIndex];

      if (max === null || min === null || precipitation === null) {
        continue;
      }

      maxTemps.push(max);
      minTemps.push(min);
      if (precipitation > 0) {
        rainYears += 1;
      }
      validYears += 1;
    }

    if (validYears === 0) {
      continue;
    }

    results.push({
      date: format(addDays(tripStart, dayIndex), "yyyy-MM-dd"),
      tempMaxAvg: Math.round(maxTemps.reduce((sum, value) => sum + value, 0) / validYears),
      tempMinAvg: Math.round(minTemps.reduce((sum, value) => sum + value, 0) / validYears),
      precipitationChance: Math.round((rainYears / validYears) * 100),
    });
  }

  return results.length > 0 ? results : null;
}

export async function getClimateAverages(
  lat: number,
  lon: number,
  tripStart: Date,
  tripEnd: Date
): Promise<DailyClimateAverage[] | null> {
  const fetches = Array.from({ length: HISTORY_YEARS }, (_, index) => {
    const yearsAgo = index + 1;
    return fetchHistoricalYear(lat, lon, subYears(tripStart, yearsAgo), subYears(tripEnd, yearsAgo));
  });

  const responses = await Promise.all(fetches);
  const successfulResponses = responses.filter(
    (response): response is OpenMeteoArchiveResponse => response !== null
  );

  return averageDailyClimate(successfulResponses, tripStart);
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 5 tests in `lib/climate-forecast.test.ts` pass.

- [ ] **Step 10: Run the full suite, typecheck, and build**

Run: `npm test`
Expected: PASS, full suite green (61 tests: the existing 55 plus 1 in `geocode-destination.test.ts` plus 5 in `climate-forecast.test.ts`).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (these two new files aren't imported anywhere yet, so this just confirms they compile cleanly).

- [ ] **Step 11: Commit**

```bash
git add lib/climate-forecast.ts lib/climate-forecast.test.ts
git commit -m "feat: add historical climate averaging from Open-Meteo archive data"
```

---

### Task 2: Wire weather into the prompt and the generation route

**Files:**
- Modify: `lib/itinerary-prompt.ts`
- Modify: `lib/itinerary-prompt.test.ts`
- Modify: `app/api/generate-itinerary/route.ts`
- Modify: `.env.local`
- Modify: `.env.local.example`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `geocodeDestination`, `Coordinates` from `lib/geocode-destination.ts` (Task 1); `getClimateAverages`, `DailyClimateAverage` from `lib/climate-forecast.ts` (Task 1).
- Produces: `buildItineraryPrompt(request: GenerateItineraryRequest, climate: DailyClimateAverage[] | null): string` (signature change — now takes 2 arguments, was 1). The route's success response becomes `{ itinerary: ItineraryResponse, weather: DailyClimateAverage[] | null }` — Task 3's client code reads this exact shape.

- [ ] **Step 1: Write the failing/updated prompt tests**

Replace the full contents of `lib/itinerary-prompt.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { buildItineraryPrompt } from "./itinerary-prompt";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";
import type { DailyClimateAverage } from "./climate-forecast";

const baseRequest: GenerateItineraryRequest = {
  destination: "Kyoto",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto", age: 34 }],
  budget: 2000,
  styleNotes: "",
};

describe("buildItineraryPrompt", () => {
  it("include la destinazione", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("Kyoto");
  });

  it("include il numero di giorni calcolato dall'intervallo di date", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("5 giorni");
  });

  it("include tipo (in forma inclusiva) ed età esatta di ogni partecipante", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      participants: [
        { type: "bambino", age: 7 },
        { type: "adulto", age: 40 },
      ],
    };
    const prompt = buildItineraryPrompt(request, null);
    expect(prompt).toContain("Bambino/a, 7 anni");
    expect(prompt).toContain("Adulto/a, 40 anni");
  });

  it("include il budget indicativo", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("2000€");
  });

  it("include le note sullo stile quando presenti", () => {
    const request: GenerateItineraryRequest = { ...baseRequest, styleNotes: "lusso, relax" };
    expect(buildItineraryPrompt(request, null)).toContain("lusso, relax");
  });

  it("include le linee guida per gruppi con bambini quando è presente un bambino", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      participants: [{ type: "bambino", age: 5 }],
    };
    expect(buildItineraryPrompt(request, null)).toContain("family-friendly");
  });

  it("istruisce a fornire un orario consigliato per ogni attività", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("suggestedTime");
  });

  it("istruisce a fornire i campi di approfondimento about/gettingThere/tips", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    expect(prompt).toContain("about");
    expect(prompt).toContain("gettingThere");
    expect(prompt).toContain("tips");
  });

  it("non impone un numero fisso di attività per fascia", () => {
    expect(buildItineraryPrompt(baseRequest, null)).toContain("Non imporre un numero fisso");
  });

  it("istruisce a dare la posizione esatta per la prima attività del giorno, senza presumere un punto di partenza", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    expect(prompt).toContain("primissima attività di ogni giornata");
    expect(prompt).toContain("non è possibile sapere da dove parte il viaggiatore");
  });

  it("non include alcuna sezione clima quando i dati climatici non sono disponibili", () => {
    expect(buildItineraryPrompt(baseRequest, null).toLowerCase()).not.toContain("clima");
  });

  it("include i dati climatici e l'istruzione di calibrare le attività quando disponibili", () => {
    const climate: DailyClimateAverage[] = [
      { date: "2026-09-01", tempMaxAvg: 26, tempMinAvg: 17, precipitationChance: 20 },
      { date: "2026-09-02", tempMaxAvg: 25, tempMinAvg: 16, precipitationChance: 60 },
    ];
    const prompt = buildItineraryPrompt(baseRequest, climate);
    expect(prompt).toContain("2026-09-01");
    expect(prompt).toContain("26°C/17°C");
    expect(prompt).toContain("20%");
    expect(prompt).toContain("2026-09-02");
    expect(prompt).toContain("60%");
    expect(prompt).toContain("calibrare le attività");
  });
});
```

Note the deliberate removal of the old `"non fa riferimento al meteo"` test that asserted the prompt never contains the word "meteo" — that assertion is no longer true by design (weather is now a real, referenced concept when climate data is available), so removing it is correct, not an oversight. Every remaining pre-existing test now passes `null` as the second argument since the function signature is changing from 1 parameter to 2.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — every test in this file fails because `buildItineraryPrompt` doesn't accept a second argument yet (TypeScript compile error surfaces as a test failure), and the two new climate-specific tests fail outright since there's no climate section in the prompt yet.

- [ ] **Step 3: Update `lib/itinerary-prompt.ts`**

Replace its full contents with:

```ts
import { differenceInCalendarDays, format } from "date-fns";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";
import { PARTICIPANT_TYPE_LABELS } from "./schema";
import type { DailyClimateAverage } from "./climate-forecast";

export function buildItineraryPrompt(
  request: GenerateItineraryRequest,
  climate: DailyClimateAverage[] | null
): string {
  const { destination, dateRange, participants, budget, styleNotes } = request;
  const dayCount = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  const participantsList = participants
    .map((p) => `- ${PARTICIPANT_TYPE_LABELS[p.type]}, ${p.age} anni`)
    .join("\n");

  const climateSection =
    climate && climate.length > 0
      ? `\nClima tipico atteso (media degli ultimi 5 anni per queste date — non è una previsione esatta, ma un'indicazione di massima):\n${climate
          .map(
            (day) =>
              `- ${day.date}: ~${day.tempMaxAvg}°C/${day.tempMinAvg}°C, pioggia in circa ${day.precipitationChance}% degli anni passati`
          )
          .join("\n")}\nUsa questi dati per calibrare le attività di ogni giorno: nei giorni con probabilità di pioggia più alta, preferisci attività al coperto o facilmente spostabili; tieni conto delle temperature per il ritmo della giornata. Non è necessario menzionare esplicitamente il meteo nelle descrizioni delle attività — usalo solo per orientare le scelte.\n`
      : "";

  return `Genera un itinerario di viaggio dettagliato per il seguente viaggio.

Destinazione: ${destination}
Date: dal ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")} (${dayCount} giorni)
Budget indicativo totale: ${budget}€
Viaggiatori:
${participantsList}
${styleNotes ? `Note sullo stile di viaggio: ${styleNotes}` : ""}
${climateSection}
Genera un piano giorno per giorno, con una data (formato YYYY-MM-DD) per ogni giorno del viaggio, diviso in tre fasce orarie (mattina, pomeriggio, sera). Per ogni fascia, elenca una o più attività. Adatta il numero di attività alla situazione: se un'attività è sostanziosa e occupa ragionevolmente l'intera fascia (es. un grande museo, un'escursione fuori porta), lasciala da sola; altrimenti proponi 2-3 attività più brevi con orari che si susseguono senza sovrapporsi. Non imporre un numero fisso di attività per fascia: valuta caso per caso.

Per ogni attività fornisci:
- title: titolo breve.
- description: breve descrizione.
- estimatedCost: stima indicativa del costo (es. "~15€" o "Gratuito").
- suggestedTime: fascia oraria consigliata per quella specifica attività, nel formato "HH:MM–HH:MM" (es. "10:00–12:30") — deve rientrare nella fascia della giornata (mattina/pomeriggio/sera) e non sovrapporsi con le altre attività della stessa fascia.
- openingHours: orari di apertura/chiusura del luogo, solo dove pertinente (musei, monumenti, locali — non per attività generiche come una passeggiata). Ometti il campo quando non applicabile.
- details: un oggetto con tre campi pensati per un viaggiatore che non conosce affatto la zona:
  - about: cosa è il posto o l'attività.
  - gettingThere: come raggiungerlo. Per la primissima attività di ogni giornata non è possibile sapere da dove parte il viaggiatore (potrebbe essere l'alloggio, un'altra zona, ecc.): indica quindi la posizione esatta del luogo (zona/quartiere, indirizzo indicativo) e come raggiungerlo in generale (es. fermata metro/bus più vicina, punto di riferimento), non partendo da un punto preciso presunto. Per le attività successive nella stessa giornata, indica invece come arrivarci dall'attività precedente nell'itinerario.
  - tips: consigli pratici utili (es. quando evitare la fila, cosa portare, aspetti da sapere in anticipo).

Adatta ritmo e tipo di attività alla composizione del gruppo:
- Se sono presenti bambini/e (0-12 anni): ritmo rilassato, poche attività per fascia, pause frequenti, orari non troppo mattinieri, pasti a orari regolari. Preferisci parchi, zoo/acquari, musei interattivi/scientifici, attività family-friendly. Evita vita notturna, locali per adulti, trekking impegnativi o attività con lunghe attese in piedi/code.
- Se sono presenti ragazzi/e (13-25 anni) ma nessun bambino/a: ritmo più dinamico, mix di cultura leggera e intrattenimento, attività social/esperienziali (punti panoramici, esperienze fotografiche, sport leggeri/acquatici, escursioni brevi). Non presumere accesso a locali/nightlife per l'intera fascia, dato che include minorenni (13-17): resta su attività adatte anche a un/a sedicenne, a meno che tutti i "ragazzi/e" del gruppo abbiano età pari o superiore a 18 anni.
- Se sono presenti solo adulti/e (26+ anni), nessun bambino/a o ragazzo/a: ritmo più libero e denso, spazio a vita notturna, trekking impegnativi, esperienze enogastronomiche, cultura senza vincoli di tempo ridotti. Usa l'età precisa per calibrare il tono: un gruppo di ventenni e uno di cinquantenni sono entrambi "adulti" ma possono giustificare attività diverse.
- In gruppi misti, il ritmo si adatta al membro più vincolante: se ci sono bambini/e, la giornata resta family-friendly anche con adulti/e nel gruppo, con una sera tranquilla piuttosto che vita notturna.

Rispetta il budget indicativo indicato nella somma delle stime di costo.`;
}
```

The only removed sentence from the previous version is `Non fare alcun riferimento alle condizioni climatiche.` — everything else about the prompt (age-adaptation rules, activity fields, adaptive density) is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 13 tests in `lib/itinerary-prompt.test.ts` pass.

- [ ] **Step 5: Update `app/api/generate-itinerary/route.ts`**

Add two imports (alongside the existing ones):

```ts
import { geocodeDestination } from "@/lib/geocode-destination";
import { getClimateAverages } from "@/lib/climate-forecast";
```

Insert this block right after the existing `GEMINI_API_KEY` check (after its `return NextResponse.json({ error: "config" }, { status: 502 });`) and before the existing `const prompt = buildItineraryPrompt(parsedRequest.data);` line:

```ts
  const coordinates = await geocodeDestination(parsedRequest.data.destination);
  const climate = coordinates
    ? await getClimateAverages(
        coordinates.lat,
        coordinates.lon,
        parsedRequest.data.dateRange.from,
        parsedRequest.data.dateRange.to
      )
    : null;

```

Change the existing prompt-building line from:

```ts
  const prompt = buildItineraryPrompt(parsedRequest.data);
```

to:

```ts
  const prompt = buildItineraryPrompt(parsedRequest.data, climate);
```

Change the final success response from:

```ts
  return NextResponse.json({ itinerary: parsedResult.data });
```

to:

```ts
  return NextResponse.json({ itinerary: parsedResult.data, weather: climate });
```

Nothing else in this file changes — the `GEMINI_API_KEY` check staying *before* the new geocoding call (not after) is required, not incidental: it's what keeps the file's existing third test (`"restituisce l'errore 'config' quando GEMINI_API_KEY non è configurata"`) free of any real network call, since that test's request body targets a destination string against a `LOCATIONIQ_API_KEY` that actually is configured in this environment.

- [ ] **Step 6: Run the full suite, typecheck, and build**

Run: `npm test`
Expected: PASS, full suite green (61 tests — this task changes existing files but adds no new test files itself; the 6 new tests from Task 1 are already counted). Specifically confirm all 3 pre-existing tests in `app/api/generate-itinerary/route.test.ts` still pass unchanged.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Update the environment files**

In `.env.local`, remove the line `OPENWEATHER_API_KEY=` entirely (don't touch any other line).

Make the identical removal in `.env.local.example`.

- [ ] **Step 8: Update `CLAUDE.md`**

Read the file first to find the exact current wording before editing precisely.

In the "Tech Stack" bullet, replace `Meteo: OpenWeatherMap (fase futura).` with `Meteo: Open-Meteo (\`archive-api.open-meteo.com\`, nessuna chiave — media climatica storica sugli ultimi 5 anni, non una previsione).` — leave the rest of that bullet's sentence (about Calendario/Mobile) untouched.

Remove the line `- \`OPENWEATHER_API_KEY\` — OpenWeatherMap (fase futura, meteo)` from "Required Environment Variables" entirely.

Don't touch anything else in the file.

- [ ] **Step 9: Commit**

```bash
git add lib/itinerary-prompt.ts lib/itinerary-prompt.test.ts app/api/generate-itinerary/route.ts .env.local .env.local.example CLAUDE.md
git commit -m "feat: feed historical climate averages into itinerary generation"
```

---

### Task 3: Display climate averages in the itinerary result

**Files:**
- Modify: `components/itinerary-form/itinerary-form.tsx`
- Modify: `components/itinerary-form/itinerary-result.tsx`

**Interfaces:**
- Consumes: `DailyClimateAverage` type from `lib/climate-forecast.ts` (Task 1); the route's response shape `{ itinerary, weather }` (Task 2).
- Produces: nothing consumed elsewhere — this is the top of the component tree for the result view.

- [ ] **Step 1: Update `components/itinerary-form/itinerary-form.tsx`**

Add an import (alongside the existing `ItineraryResponse` type import):

```ts
import type { DailyClimateAverage } from "@/lib/climate-forecast";
```

Add a new state variable, right after the existing `const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);` line:

```ts
  const [weather, setWeather] = useState<DailyClimateAverage[] | null>(null);
```

In `onSubmit`'s success path, right after `setItinerary(body.itinerary);`, add:

```ts
      setWeather(body.weather ?? null);
```

Change the render condition's JSX from:

```tsx
  if (mode === "result" && submittedData && itinerary) {
    return <ItineraryResult tripData={submittedData} itinerary={itinerary} onEdit={handleEdit} />;
  }
```

to:

```tsx
  if (mode === "result" && submittedData && itinerary) {
    return (
      <ItineraryResult
        tripData={submittedData}
        itinerary={itinerary}
        weather={weather}
        onEdit={handleEdit}
      />
    );
  }
```

Nothing else in this file changes.

- [ ] **Step 2: Update `components/itinerary-form/itinerary-result.tsx`**

Add an import (alongside the existing `Activity`/`ItineraryResponse` type import):

```ts
import type { DailyClimateAverage } from "@/lib/climate-forecast";
```

Add `weather` to the props interface:

```ts
interface ItineraryResultProps {
  tripData: TripFormValues;
  itinerary: ItineraryResponse;
  weather: DailyClimateAverage[] | null;
  onEdit: () => void;
}
```

Add `weather` to the destructured props:

```ts
export function ItineraryResult({ tripData, itinerary, weather, onEdit }: ItineraryResultProps) {
```

Inside the `itinerary.days.map((day, dayIndex) => { ... })` callback, right after the existing `const formattedDate = ...` computation and before the `return (`, add:

```ts
            const dayWeather = weather?.find((entry) => entry.date === day.date);
```

Inside the returned JSX, right after the day-header `<div className="flex items-center justify-between gap-3 bg-primary ...">...</div>` block and as the very first child of the `<div className="bg-card px-4 pb-1">` block (i.e., before the `{SLOTS.map(...)}` call), add:

```tsx
                  {dayWeather && (
                    <p className="py-2 text-xs text-muted-foreground">
                      Clima tipico: ~{dayWeather.tempMaxAvg}°C/{dayWeather.tempMinAvg}°C · pioggia in
                      circa {dayWeather.precipitationChance}% degli anni passati
                    </p>
                  )}
```

This relies on the existing `first:border-t-0` class already present on each time-of-day section's wrapper `<div>`: when the weather line renders, it becomes the actual first child of the `bg-card` container, so the first time-of-day section is no longer `:first-child` and correctly regains its `border-t` — producing exactly one visual divider between the weather line and "Mattina", with no code change needed to the `SLOTS.map` block itself. Don't add any border classes to the weather `<p>` itself.

Nothing else in this file changes.

- [ ] **Step 3: Run the full suite, lint, typecheck, and build**

Run: `npm test`
Expected: PASS, full suite green (61 tests — this task adds no new automated tests, consistent with this project's established pattern for UI-only tasks).

Run: `npm run lint`
Expected: no new errors.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual browser verification with a real generation**

`.env.local` already has working `GEMINI_API_KEY` and `LOCATIONIQ_API_KEY` values. Run `npm run dev`, open the app, and generate a real itinerary for a well-known destination (e.g. a city that geocodes unambiguously).

Verify, live:
1. The generation completes normally (weather-pipeline work happens before the Gemini call, so watch whether it visibly adds noticeable delay — a couple of seconds is expected and fine, anything that feels like it dramatically lengthens the wait is worth flagging).
2. Each day card shows a "Clima tipico: ..." line with a temperature range and a rain percentage, positioned above "Mattina" and below the green header bar, in small muted text — confirm it does NOT look like an error state and matches the existing typographic style (no icons/emoji).
3. Spot-check that the numbers are plausible for the season and destination you tested (not, say, a summer city showing a wildly implausible temperature) — this is a sanity check on the geocoding/date-shifting logic, not a precision check.
4. Read a couple of the generated activities and judge whether the choices plausibly reflect the climate data if the destination/season combination has a meaningfully high or low rain chance (e.g., mostly-indoor activities on a day flagged with a high rain percentage) — this can't be verified with certainty (the AI's actual reasoning isn't inspectable), but note what you observe.
5. Confirm "Modifica" still works and returns to the form with all fields intact (unrelated to this task, but confirm nothing broke).

If you want to specifically test the graceful-degradation path (no weather data), you can temporarily rename or blank `LOCATIONIQ_API_KEY` in `.env.local`, restart the dev server, generate once, and confirm the itinerary still generates successfully with no "Clima tipico" line on any day card and no visible error — then restore the real key and restart again before finishing.

Report exactly what you observed for each of the 5 points above.

- [ ] **Step 5: Commit**

```bash
git add components/itinerary-form/itinerary-form.tsx components/itinerary-form/itinerary-result.tsx
git commit -m "feat: display historical climate averages on each day card"
```
