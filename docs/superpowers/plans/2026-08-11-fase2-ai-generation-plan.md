# Fase 2 — Generazione itinerario via Claude API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing trip-planning form to a real, server-side Claude API call that generates a structured day-by-day itinerary, with loading/result UI states and typed error handling.

**Architecture:** A Next.js Route Handler (`app/api/generate-itinerary/route.ts`) receives the already-collected trip data, builds a prompt, calls Claude Sonnet 5 via the Anthropic TypeScript SDK using structured outputs (`client.messages.parse` + `zodOutputFormat`), validates the result against a zod schema, and returns either the itinerary or a generic error code. The client (`ItineraryForm`) calls this route directly on submit — no more static summary screen — and renders a `loading`, `result`, or (via a banner over the form) error state.

**Tech Stack:** Next.js 16 (App Router), React 19, react-hook-form + zod (`@hookform/resolvers`), `@anthropic-ai/sdk` (already installed via `npm install @anthropic-ai/sdk`), Tailwind v4, vitest.

## Global Constraints

- Model string is exactly `claude-sonnet-5` (Claude Sonnet 5) — do not substitute another model.
- Server-side call uses `client.messages.parse(...)` with `output_config: { format: zodOutputFormat(itineraryResponseSchema) }` — structured output, not free text.
- Per-request timeout is `30_000` (30s, milliseconds) passed as the SDK's request-options `{ timeout: 30_000 }` second argument — this is the SDK's own `AbortController`-backed timeout, no manual `AbortController` needed.
- `ANTHROPIC_API_KEY` is read server-side only (via `new Anthropic()`'s default env resolution) and must never be sent to or read by client code.
- Trip length cap: `MAX_TRIP_DAYS = 14` (inclusive of both start and end date). Enforced both client-side (form validation, blocks submit) and server-side (request validation, defense in depth).
- No streaming (`stream` is never set) — this is a deliberate product decision (loading state shows rotating messages instead), not an oversight.
- Error codes are exactly `"network" | "config" | "rate_limit" | "invalid_response"`, mapped to these exact Italian user-facing messages:
  - `network` → "Non siamo riusciti a contattare il servizio di generazione. Controlla la connessione e riprova."
  - `config` → "Si è verificato un problema tecnico. Riprova tra poco."
  - `rate_limit` → "Troppe richieste in questo momento, riprova tra qualche secondo."
  - `invalid_response` → "Non siamo riusciti a generare l'itinerario. Riprova."
- No persistence of the generated itinerary — it lives only in component state and is lost on refresh (consistent with Fase 1's client-only approach).
- Generated itinerary results are never tested against the real Claude API in the automated suite (non-deterministic, costs money) — only the zod schemas and the error-classification function are unit-tested, per the approved spec.

---

### Task 1: Trip-length cap + itinerary/request zod schemas

**Files:**
- Modify: `lib/schema.ts`
- Modify: `lib/schema.test.ts`
- Create: `lib/itinerary-schema.ts`
- Create: `lib/itinerary-schema.test.ts`
- Create: `lib/generate-itinerary-request.ts`
- Create: `lib/generate-itinerary-request.test.ts`

**Interfaces:**
- Consumes: `participantSchema` from `lib/schema.ts` (already exists, unchanged).
- Produces:
  - `lib/schema.ts`: `export const MAX_TRIP_DAYS = 14;` (new export, used by Task 1's own request schema).
  - `lib/itinerary-schema.ts`: `activitySchema`, `itineraryDaySchema`, `itineraryResponseSchema` (zod schemas) and their inferred types `Activity`, `ItineraryDay`, `ItineraryResponse`. Task 3 (API route) and Task 4 (UI) both import `itineraryResponseSchema` / `ItineraryResponse`.
  - `lib/generate-itinerary-request.ts`: `generateItineraryRequestSchema` (zod schema) and inferred type `GenerateItineraryRequest`. Task 2 (prompt builder) and Task 3 (API route) both import this.

- [ ] **Step 1: Write the failing test for the 14-day cap in the existing form schema**

Open `lib/schema.test.ts` and add these two tests inside the existing `describe("tripFormSchema", ...)` block (right before the closing `});` on line 115):

```ts
  it("rifiuta un viaggio di più di 14 giorni", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-16") },
    });
    expect(result.success).toBe(false);
  });

  it("accetta un viaggio di esattamente 14 giorni", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-14") },
    });
    expect(result.success).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm test`
Expected: FAIL — the two new tests fail because `tripFormSchema` doesn't yet enforce a 14-day cap (all 15 tests run, 2 fail).

- [ ] **Step 3: Add the 14-day cap to `lib/schema.ts`**

Open `lib/schema.ts`. Add a new exported constant right after the `AGE_RANGES` block (after line 7, before `export type ParticipantType`):

```ts
export const MAX_TRIP_DAYS = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
```

Then add a third `.refine(...)` to the `dateRange` schema inside `tripFormSchema` (after the existing "data di fine deve essere successiva" refine, i.e. right after line 41's closing `}),` and before `participants: z.array(...)`):

```ts
    .refine(
      (range) => {
        if (!range.from || !range.to) return true;
        const days = Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY) + 1;
        return days <= MAX_TRIP_DAYS;
      },
      { message: `Il viaggio non può superare i ${MAX_TRIP_DAYS} giorni` }
    ),
```

The full `dateRange` field should now read:

```ts
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .refine((range) => !!range.from && !!range.to, {
      message: "Seleziona le date di inizio e fine",
    })
    .refine((range) => !range.from || !range.to || range.to >= range.from, {
      message: "La data di fine deve essere successiva o uguale alla data di inizio",
    })
    .refine(
      (range) => {
        if (!range.from || !range.to) return true;
        const days = Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY) + 1;
        return days <= MAX_TRIP_DAYS;
      },
      { message: `Il viaggio non può superare i ${MAX_TRIP_DAYS} giorni` }
    ),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all 15 tests in `lib/schema.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts lib/schema.test.ts
git commit -m "feat: cap trip length at 14 days"
```

- [ ] **Step 6: Write the failing test for the itinerary response schema**

Create `lib/itinerary-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { itineraryResponseSchema } from "./itinerary-schema";

const validResponse = {
  days: [
    {
      date: "2026-09-12",
      mattina: [
        {
          title: "Colazione al mercato locale",
          description: "Un giro tra le bancarelle per assaggiare specialità del posto.",
          estimatedCost: "~10€",
        },
      ],
      pomeriggio: [
        {
          title: "Visita al museo civico",
          description: "Collezione permanente di arte locale.",
          estimatedCost: "8€",
          openingHours: "9:00–18:00, chiuso il lunedì",
        },
      ],
      sera: [
        {
          title: "Passeggiata sul lungomare",
          description: "Vista sul tramonto.",
          estimatedCost: "Gratuito",
        },
      ],
    },
  ],
};

describe("itineraryResponseSchema", () => {
  it("accetta una risposta valida", () => {
    const result = itineraryResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it("accetta un'attività senza openingHours (campo opzionale)", () => {
    const result = itineraryResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.days[0].mattina[0].openingHours).toBeUndefined();
    }
  });

  it("rifiuta un giorno senza il campo 'sera'", () => {
    const { sera, ...dayWithoutSera } = validResponse.days[0];
    const result = itineraryResponseSchema.safeParse({ days: [dayWithoutSera] });
    expect(result.success).toBe(false);
  });

  it("rifiuta un'attività senza title", () => {
    const invalid = {
      days: [
        {
          ...validResponse.days[0],
          mattina: [{ description: "manca il titolo", estimatedCost: "5€" }],
        },
      ],
    };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta una risposta dove 'days' non è un array", () => {
    const result = itineraryResponseSchema.safeParse({ days: "non un array" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module './itinerary-schema'" (file doesn't exist yet).

- [ ] **Step 8: Create `lib/itinerary-schema.ts`**

```ts
import { z } from "zod";

export const activitySchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedCost: z.string(),
  openingHours: z.string().optional(),
});

export const itineraryDaySchema = z.object({
  date: z.string(),
  mattina: z.array(activitySchema),
  pomeriggio: z.array(activitySchema),
  sera: z.array(activitySchema),
});

export const itineraryResponseSchema = z.object({
  days: z.array(itineraryDaySchema),
});

export type Activity = z.infer<typeof activitySchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 5 tests in `lib/itinerary-schema.test.ts` pass.

- [ ] **Step 10: Commit**

```bash
git add lib/itinerary-schema.ts lib/itinerary-schema.test.ts
git commit -m "feat: add zod schema for the generated itinerary response"
```

- [ ] **Step 11: Write the failing test for the server-side request schema**

Create `lib/generate-itinerary-request.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateItineraryRequestSchema } from "./generate-itinerary-request";

const baseValidBody = {
  destination: "Roma",
  dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
  participants: [{ type: "adulto", age: 35 }],
  budget: 1000,
  styleNotes: "",
};

describe("generateItineraryRequestSchema", () => {
  it("accetta un corpo valido con date come stringhe ISO e le converte in Date", () => {
    const result = generateItineraryRequestSchema.safeParse(baseValidBody);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateRange.from).toBeInstanceOf(Date);
      expect(result.data.dateRange.to).toBeInstanceOf(Date);
    }
  });

  it("rifiuta una destinazione vuota", () => {
    const result = generateItineraryRequestSchema.safeParse({ ...baseValidBody, destination: "" });
    expect(result.success).toBe(false);
  });

  it("rifiuta zero partecipanti", () => {
    const result = generateItineraryRequestSchema.safeParse({ ...baseValidBody, participants: [] });
    expect(result.success).toBe(false);
  });

  it("rifiuta un viaggio di più di 14 giorni", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-16T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });

  it("accetta un viaggio di esattamente 14 giorni", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-14T00:00:00.000Z" },
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta una data di fine precedente alla data di inizio", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      dateRange: { from: "2026-09-05T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module './generate-itinerary-request'" (file doesn't exist yet).

- [ ] **Step 13: Create `lib/generate-itinerary-request.ts`**

```ts
import { z } from "zod";
import { participantSchema, MAX_TRIP_DAYS } from "./schema";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const generateItineraryRequestSchema = z.object({
  destination: z.string().trim().min(1),
  dateRange: z
    .object({
      from: z.coerce.date(),
      to: z.coerce.date(),
    })
    .refine((range) => range.to >= range.from, {
      message: "La data di fine deve essere successiva o uguale alla data di inizio",
    })
    .refine(
      (range) => {
        const days = Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY) + 1;
        return days <= MAX_TRIP_DAYS;
      },
      { message: `Il viaggio non può superare i ${MAX_TRIP_DAYS} giorni` }
    ),
  participants: z.array(participantSchema).min(1),
  budget: z.number().min(0),
  styleNotes: z.string().optional(),
});

export type GenerateItineraryRequest = z.infer<typeof generateItineraryRequestSchema>;
```

- [ ] **Step 14: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 6 tests in `lib/generate-itinerary-request.test.ts` pass, and the full suite (now 15 + 5 + 6 = 26 tests) is green.

- [ ] **Step 15: Commit**

```bash
git add lib/generate-itinerary-request.ts lib/generate-itinerary-request.test.ts
git commit -m "feat: add server-side request schema for itinerary generation"
```

---

### Task 2: Prompt builder + Anthropic error classifier

**Files:**
- Create: `lib/itinerary-prompt.ts`
- Create: `lib/itinerary-prompt.test.ts`
- Create: `lib/generate-itinerary-errors.ts`
- Create: `lib/generate-itinerary-errors.test.ts`

**Interfaces:**
- Consumes: `GenerateItineraryRequest` type from `lib/generate-itinerary-request.ts` (Task 1), `ParticipantType` from `lib/schema.ts` (existing), `@anthropic-ai/sdk` default export (already installed — `npm install @anthropic-ai/sdk` has been run and it's in `package.json`'s dependencies).
- Produces:
  - `lib/itinerary-prompt.ts`: `export function buildItineraryPrompt(request: GenerateItineraryRequest): string`. Task 3 (API route) calls this.
  - `lib/generate-itinerary-errors.ts`: `export type ErrorCode = "network" | "config" | "rate_limit" | "invalid_response";` and `export function classifyAnthropicError(error: unknown): ErrorCode`. Task 3 (API route) calls `classifyAnthropicError`; Task 4 (client UI) imports the `ErrorCode` type only (via `import type`, so the Anthropic SDK is never bundled into client code).

- [ ] **Step 1: Write the failing test for the prompt builder**

Create `lib/itinerary-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildItineraryPrompt } from "./itinerary-prompt";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";

const baseRequest: GenerateItineraryRequest = {
  destination: "Kyoto",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto", age: 34 }],
  budget: 2000,
  styleNotes: "",
};

describe("buildItineraryPrompt", () => {
  it("include la destinazione", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("Kyoto");
  });

  it("include il numero di giorni calcolato dall'intervallo di date", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("5 giorni");
  });

  it("include tipo ed età esatta di ogni partecipante", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      participants: [
        { type: "bambino", age: 7 },
        { type: "adulto", age: 40 },
      ],
    };
    const prompt = buildItineraryPrompt(request);
    expect(prompt).toContain("Bambino, 7 anni");
    expect(prompt).toContain("Adulto, 40 anni");
  });

  it("include il budget indicativo", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("2000€");
  });

  it("include le note sullo stile quando presenti", () => {
    const request: GenerateItineraryRequest = { ...baseRequest, styleNotes: "lusso, relax" };
    expect(buildItineraryPrompt(request)).toContain("lusso, relax");
  });

  it("include le linee guida per gruppi con bambini quando è presente un bambino", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      participants: [{ type: "bambino", age: 5 }],
    };
    expect(buildItineraryPrompt(request)).toContain("family-friendly");
  });

  it("non fa riferimento al meteo", () => {
    expect(buildItineraryPrompt(baseRequest).toLowerCase()).not.toContain("meteo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module './itinerary-prompt'" (file doesn't exist yet). Note: the last test (`non fa riferimento al meteo`) is checking the prompt never *mentions* weather as a topic to include — it will still pass once the file below is created, since the instruction text itself only says not to reference weather, never using the word as a topic elsewhere.

- [ ] **Step 3: Create `lib/itinerary-prompt.ts`**

```ts
import { differenceInCalendarDays, format } from "date-fns";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";
import type { ParticipantType } from "./schema";

const TYPE_LABELS: Record<ParticipantType, string> = {
  bambino: "Bambino",
  ragazzo: "Ragazzo",
  adulto: "Adulto",
};

export function buildItineraryPrompt(request: GenerateItineraryRequest): string {
  const { destination, dateRange, participants, budget, styleNotes } = request;
  const dayCount = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  const participantsList = participants
    .map((p) => `- ${TYPE_LABELS[p.type]}, ${p.age} anni`)
    .join("\n");

  return `Genera un itinerario di viaggio dettagliato per il seguente viaggio.

Destinazione: ${destination}
Date: dal ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")} (${dayCount} giorni)
Budget indicativo totale: ${budget}€
Viaggiatori:
${participantsList}
${styleNotes ? `Note sullo stile di viaggio: ${styleNotes}` : ""}

Genera un piano giorno per giorno, con una data (formato YYYY-MM-DD) per ogni giorno del viaggio, diviso in tre fasce orarie (mattina, pomeriggio, sera). Per ogni fascia, elenca una o più attività con titolo, breve descrizione, una stima indicativa del costo (es. "~15€" o "Gratuito") e, dove pertinente (musei, monumenti, locali — non per attività generiche come una passeggiata), orari di apertura e chiusura indicativi.

Adatta ritmo e tipo di attività alla composizione del gruppo:
- Se sono presenti bambini (0-12 anni): ritmo rilassato, poche attività per fascia, pause frequenti, orari non troppo mattinieri, pasti a orari regolari. Preferisci parchi, zoo/acquari, musei interattivi/scientifici, attività family-friendly. Evita vita notturna, locali per adulti, trekking impegnativi o attività con lunghe attese in piedi/code.
- Se sono presenti ragazzi (13-25 anni) ma nessun bambino: ritmo più dinamico, mix di cultura leggera e intrattenimento, attività social/esperienziali (punti panoramici, esperienze fotografiche, sport leggeri/acquatici, escursioni brevi). Non presumere accesso a locali/nightlife per l'intera fascia, dato che include minorenni (13-17): resta su attività adatte anche a un sedicenne, a meno che tutti i "ragazzi" del gruppo abbiano età pari o superiore a 18 anni.
- Se sono presenti solo adulti (26+ anni), nessun bambino/ragazzo: ritmo più libero e denso, spazio a vita notturna, trekking impegnativi, esperienze enogastronomiche, cultura senza vincoli di tempo ridotti. Usa l'età precisa per calibrare il tono: un gruppo di ventenni e uno di cinquantenni sono entrambi "adulti" ma possono giustificare attività diverse.
- In gruppi misti, il ritmo si adatta al membro più vincolante: se ci sono bambini, la giornata resta family-friendly anche con adulti nel gruppo, con una sera tranquilla piuttosto che vita notturna.

Non fare alcun riferimento al meteo. Rispetta il budget indicativo indicato nella somma delle stime di costo.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 7 tests in `lib/itinerary-prompt.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add lib/itinerary-prompt.ts lib/itinerary-prompt.test.ts
git commit -m "feat: add itinerary prompt builder with age-based adaptation rules"
```

- [ ] **Step 6: Write the failing test for the error classifier**

Create `lib/generate-itinerary-errors.test.ts`. This constructs real instances of the Anthropic SDK's exception classes (verified against the installed `node_modules/@anthropic-ai/sdk/src/core/error.ts`) rather than mocks, so the test exercises the exact `instanceof` chain the route handler will hit in production:

```ts
import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { classifyAnthropicError } from "./generate-itinerary-errors";

describe("classifyAnthropicError", () => {
  it("classifica un errore di autenticazione (401) come 'config'", () => {
    const error = new Anthropic.AuthenticationError(401, {}, "Invalid API key", new Headers());
    expect(classifyAnthropicError(error)).toBe("config");
  });

  it("classifica un errore di permessi (403) come 'config'", () => {
    const error = new Anthropic.PermissionDeniedError(403, {}, "Forbidden", new Headers());
    expect(classifyAnthropicError(error)).toBe("config");
  });

  it("classifica un rate limit (429) come 'rate_limit'", () => {
    const error = new Anthropic.RateLimitError(429, {}, "Rate limited", new Headers());
    expect(classifyAnthropicError(error)).toBe("rate_limit");
  });

  it("classifica un errore di connessione come 'network'", () => {
    const error = new Anthropic.APIConnectionError({ message: "Connection error" });
    expect(classifyAnthropicError(error)).toBe("network");
  });

  it("classifica un errore 5xx come 'network'", () => {
    const error = new Anthropic.InternalServerError(500, {}, "Server error", new Headers());
    expect(classifyAnthropicError(error)).toBe("network");
  });

  it("classifica un errore 400 generico come 'invalid_response'", () => {
    const error = new Anthropic.BadRequestError(400, {}, "Bad request", new Headers());
    expect(classifyAnthropicError(error)).toBe("invalid_response");
  });

  it("classifica un errore non riconosciuto come 'invalid_response'", () => {
    expect(classifyAnthropicError(new Error("qualcosa di inatteso"))).toBe("invalid_response");
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module './generate-itinerary-errors'" (file doesn't exist yet).

- [ ] **Step 8: Create `lib/generate-itinerary-errors.ts`**

`APIConnectionError` is a subclass of `APIError` in the TypeScript SDK (unlike Python, where they're siblings), so it must be checked before any general `APIError` fallback. This classifier only needs the specific subclasses below — there is no general `APIError` fallback branch because anything not explicitly matched should land on `invalid_response`.

```ts
import Anthropic from "@anthropic-ai/sdk";

export type ErrorCode = "network" | "config" | "rate_limit" | "invalid_response";

export function classifyAnthropicError(error: unknown): ErrorCode {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "config";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "rate_limit";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "network";
  }
  if (error instanceof Anthropic.InternalServerError) {
    return "network";
  }
  return "invalid_response";
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 7 tests in `lib/generate-itinerary-errors.test.ts` pass, full suite green.

- [ ] **Step 10: Commit**

```bash
git add lib/generate-itinerary-errors.ts lib/generate-itinerary-errors.test.ts
git commit -m "feat: classify Anthropic SDK errors into user-facing error codes"
```

---

### Task 3: API route

**Files:**
- Create: `app/api/generate-itinerary/route.ts`
- Create: `app/api/generate-itinerary/route.test.ts`

**Interfaces:**
- Consumes:
  - `generateItineraryRequestSchema`, `GenerateItineraryRequest` from `lib/generate-itinerary-request.ts` (Task 1)
  - `itineraryResponseSchema` from `lib/itinerary-schema.ts` (Task 1)
  - `buildItineraryPrompt` from `lib/itinerary-prompt.ts` (Task 2)
  - `classifyAnthropicError` from `lib/generate-itinerary-errors.ts` (Task 2)
  - `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod` (verified present at `node_modules/@anthropic-ai/sdk/helpers/zod.d.ts`)
- Produces: `POST` handler at `app/api/generate-itinerary/route.ts`, consumed by Task 4 (client fetch call to `/api/generate-itinerary`). On success it returns `{ itinerary: ItineraryResponse }` with status 200. On failure it returns `{ error: ErrorCode }` with status 400 (bad request body), 429 (`rate_limit`), or 502 (`config` / `network` / `invalid_response`).

- [ ] **Step 1: Write the failing test for the request-validation branch**

Create `app/api/generate-itinerary/route.test.ts`. This test never reaches the Anthropic API — an invalid body is rejected before any network call is made, so it needs no API key and makes no real request:

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/generate-itinerary", () => {
  it("rifiuta un corpo non valido con 400 prima di chiamare Claude", async () => {
    const request = new Request("http://localhost/api/generate-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: "" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_response");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module './route'" (file doesn't exist yet).

- [ ] **Step 3: Create `app/api/generate-itinerary/route.ts`**

```ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { generateItineraryRequestSchema } from "@/lib/generate-itinerary-request";
import { itineraryResponseSchema } from "@/lib/itinerary-schema";
import { buildItineraryPrompt } from "@/lib/itinerary-prompt";
import { classifyAnthropicError } from "@/lib/generate-itinerary-errors";

export async function POST(request: Request) {
  const body = await request.json();
  const parsedRequest = generateItineraryRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  const prompt = buildItineraryPrompt(parsedRequest.data);
  const client = new Anthropic();

  try {
    const response = await client.messages.parse(
      {
        model: "claude-sonnet-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: zodOutputFormat(itineraryResponseSchema),
        },
      },
      { timeout: 30_000 }
    );

    if (!response.parsed_output) {
      console.error("Generazione itinerario: risposta non conforme allo schema atteso", response);
      return NextResponse.json({ error: "invalid_response" }, { status: 502 });
    }

    return NextResponse.json({ itinerary: response.parsed_output });
  } catch (error) {
    const code = classifyAnthropicError(error);
    console.error(`Generazione itinerario fallita (${code}):`, error);
    const status = code === "rate_limit" ? 429 : 502;
    return NextResponse.json({ error: code }, { status });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. If the test instead fails with an error about `next/server` or `NextResponse` not resolving in the vitest (Node) environment, report this back rather than working around it — it likely means `vitest.config.ts` needs a Next.js-aware test environment, which is a project-wide config change outside this task's scope.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds and the route list includes `ƒ /api/generate-itinerary` (dynamic — not prerendered as static, since it's a POST handler that reads the request body).

- [ ] **Step 6: Commit**

```bash
git add app/api/generate-itinerary/route.ts app/api/generate-itinerary/route.test.ts
git commit -m "feat: add /api/generate-itinerary route calling Claude with structured output"
```

---

### Task 4: Client UI — loading/result states, itinerary display, form wiring

**Files:**
- Create: `components/itinerary-form/itinerary-result.tsx`
- Modify: `components/itinerary-form/itinerary-form.tsx` (full rewrite of the submit flow and render — current content is 241 lines, replaced entirely by the version below)
- Delete: `components/itinerary-form/trip-summary.tsx` (superseded by `itinerary-result.tsx` — the static read-only summary screen this fed is gone; nothing will import it after this task)

**Interfaces:**
- Consumes:
  - `tripFormSchema`, `TripFormValues`, `ParticipantType` from `lib/schema.ts` (existing)
  - `type ErrorCode` from `lib/generate-itinerary-errors.ts` (Task 2) — imported with `import type` only, so the Anthropic SDK is never bundled client-side
  - `type ItineraryResponse` from `lib/itinerary-schema.ts` (Task 1)
  - `ParticipantRow` from `./participant-row.tsx` (existing, unchanged)
  - `POST /api/generate-itinerary` (Task 3), called via `fetch`
- Produces: `ItineraryResult` component (`{ tripData: TripFormValues; itinerary: ItineraryResponse; onEdit: () => void }` props), used only by `ItineraryForm`.

- [ ] **Step 1: Create `components/itinerary-form/itinerary-result.tsx`**

```tsx
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParticipantType, TripFormValues } from "@/lib/schema";
import type { ItineraryResponse } from "@/lib/itinerary-schema";

interface ItineraryResultProps {
  tripData: TripFormValues;
  itinerary: ItineraryResponse;
  onEdit: () => void;
}

const TYPE_LABELS: Record<ParticipantType, string> = {
  bambino: "Bambino",
  ragazzo: "Ragazzo",
  adulto: "Adulto",
};

const SLOTS = [
  { key: "mattina", label: "Mattina" },
  { key: "pomeriggio", label: "Pomeriggio" },
  { key: "sera", label: "Sera" },
] as const;

export function ItineraryResult({ tripData, itinerary, onEdit }: ItineraryResultProps) {
  return (
    <Card className="relative mx-auto w-full max-w-2xl overflow-hidden shadow-[0_20px_50px_-12px_color-mix(in_oklch,var(--primary)_25%,transparent)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
      <CardHeader className="px-8 pt-8">
        <CardTitle className="font-display text-2xl font-semibold">Il tuo itinerario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <span>
            <span className="text-muted-foreground">Destinazione: </span>
            {tripData.destination}
          </span>
          {tripData.dateRange.from && tripData.dateRange.to && (
            <span>
              <span className="text-muted-foreground">Date: </span>
              {format(tripData.dateRange.from, "dd/MM/yyyy")} - {format(tripData.dateRange.to, "dd/MM/yyyy")}
            </span>
          )}
          <span>
            <span className="text-muted-foreground">Viaggiatori: </span>
            {tripData.participants.map((p) => `${TYPE_LABELS[p.type]} (${p.age})`).join(", ")}
          </span>
          <span>
            <span className="text-muted-foreground">Budget: </span>
            {tripData.budget}€
          </span>
        </div>

        <div className="space-y-6">
          {itinerary.days.map((day, dayIndex) => (
            <div key={dayIndex} className="space-y-3">
              <h3 className="font-display text-lg font-semibold">
                Giorno {dayIndex + 1} — {format(new Date(day.date), "dd/MM/yyyy")}
              </h3>
              {SLOTS.map(
                ({ key, label }) =>
                  day[key].length > 0 && (
                    <div key={key} className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{label}</p>
                      <ul className="space-y-2">
                        {day[key].map((activity, activityIndex) => (
                          <li key={activityIndex} className="rounded-md border p-3">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-medium">{activity.title}</span>
                              <span className="shrink-0 text-sm text-muted-foreground">
                                {activity.estimatedCost}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
                            {activity.openingHours && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Orari: {activity.openingHours}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
              )}
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={onEdit} className="w-full">
          Modifica
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Replace `components/itinerary-form/itinerary-form.tsx` entirely**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Euro, Loader2, MapPin, Plus, Sparkles, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { tripFormSchema, type TripFormValues } from "@/lib/schema";
import type { ErrorCode } from "@/lib/generate-itinerary-errors";
import type { ItineraryResponse } from "@/lib/itinerary-schema";
import { ParticipantRow } from "./participant-row";
import { ItineraryResult } from "./itinerary-result";

const defaultValues: TripFormValues = {
  destination: "",
  dateRange: { from: undefined, to: undefined },
  participants: [{ type: "adulto", age: undefined }],
  budget: 1000,
  styleNotes: "",
};

const LOADING_MESSAGES = [
  "Stiamo consultando le mappe…",
  "Cerchiamo i posti migliori…",
  "Controlliamo gli orari di apertura…",
  "Chiediamo consiglio a un local…",
  "Ottimizziamo il tuo itinerario…",
  "Prepariamo le valigie (metaforicamente)…",
];

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  network:
    "Non siamo riusciti a contattare il servizio di generazione. Controlla la connessione e riprova.",
  config: "Si è verificato un problema tecnico. Riprova tra poco.",
  rate_limit: "Troppe richieste in questo momento, riprova tra qualche secondo.",
  invalid_response: "Non siamo riusciti a generare l'itinerario. Riprova.",
};

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    value === "network" ||
    value === "config" ||
    value === "rate_limit" ||
    value === "invalid_response"
  );
}

export function ItineraryForm() {
  const [mode, setMode] = useState<"form" | "loading" | "result">("form");
  const [submittedData, setSubmittedData] = useState<TripFormValues | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "participants",
  });

  const dateRange = watch("dateRange");
  const budget = watch("budget");
  const participants = watch("participants");
  const travelerSummary = `${participants.length} ${participants.length === 1 ? "viaggiatore" : "viaggiatori"}`;
  const participantsError = Array.isArray(errors.participants)
    ? "Completa i dati di ogni viaggiatore"
    : errors.participants?.message;

  useEffect(() => {
    if (mode !== "loading") return;

    setLoadingMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => {
        if (LOADING_MESSAGES.length <= 1) return prev;
        let next = Math.floor(Math.random() * LOADING_MESSAGES.length);
        while (next === prev) {
          next = Math.floor(Math.random() * LOADING_MESSAGES.length);
        }
        return next;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [mode]);

  const onSubmit = async (data: TripFormValues) => {
    setApiError(null);
    setMode("loading");

    try {
      const response = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(isErrorCode(body?.error) ? body.error : "invalid_response");
      }

      setSubmittedData(data);
      setItinerary(body.itinerary);
      setMode("result");
    } catch (error) {
      const code = error instanceof Error && isErrorCode(error.message) ? error.message : "invalid_response";
      setApiError(ERROR_MESSAGES[code]);
      setMode("form");
    }
  };

  const handleEdit = () => {
    setMode("form");
  };

  if (mode === "result" && submittedData && itinerary) {
    return <ItineraryResult tripData={submittedData} itinerary={itinerary} onEdit={handleEdit} />;
  }

  return (
    <Card className="relative mx-auto w-full max-w-2xl overflow-hidden shadow-[0_20px_50px_-12px_color-mix(in_oklch,var(--primary)_25%,transparent)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
      <CardHeader className="px-8 pt-8">
        <CardTitle className="font-display text-2xl font-semibold">
          Pianifica il tuo viaggio
        </CardTitle>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className={cn("space-y-8", mode === "loading" && "pointer-events-none opacity-60")}>
            <div className="space-y-2">
              <Label htmlFor="destination">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Destinazione
              </Label>
              <Input id="destination" placeholder="Es. Roma, Italia" {...register("destination")} />
              {errors.destination && (
                <p className="text-sm text-red-600">{errors.destination.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Date del viaggio"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                      : "Seleziona le date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange as DateRange | undefined}
                    onSelect={(range) => {
                      setValue(
                        "dateRange",
                        { from: range?.from, to: range?.to },
                        { shouldValidate: true }
                      );
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              {errors.dateRange && (
                <p className="text-sm text-red-600">{errors.dateRange.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Chi viaggia"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      participantsError && "border-destructive"
                    )}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    {travelerSummary}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm" align="start">
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <ParticipantRow
                        key={field.id}
                        index={index}
                        control={control}
                        setValue={setValue}
                        onRemove={() => remove(index)}
                        canRemove={fields.length > 1}
                        error={
                          Array.isArray(errors.participants)
                            ? errors.participants[index]?.age?.message
                            : undefined
                        }
                      />
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => append({ type: "adulto", age: undefined })}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4" />
                      Aggiungi viaggiatore
                    </Button>
                    <PopoverClose asChild>
                      <Button type="button" className="w-full">
                        Fatto
                      </Button>
                    </PopoverClose>
                  </div>
                </PopoverContent>
              </Popover>
              {participantsError && <p className="text-sm text-red-600">{participantsError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-amount">
                <Euro className="h-4 w-4 text-muted-foreground" />
                Budget indicativo
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  aria-label="Budget indicativo in euro"
                  min={0}
                  max={10000}
                  step={50}
                  value={[budget]}
                  onValueChange={([value]) => setValue("budget", value, { shouldValidate: true })}
                  className="flex-1"
                />
                <div className="relative w-28 shrink-0">
                  <Input
                    id="budget-amount"
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={budget}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      const clamped = Number.isNaN(next) ? 0 : Math.min(10000, Math.max(0, next));
                      setValue("budget", clamped, { shouldValidate: true });
                    }}
                    className="pr-7"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="styleNotes">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Stile di viaggio
              </Label>
              <Input
                id="styleNotes"
                placeholder="Es. lusso, economico, avventura..."
                {...register("styleNotes")}
              />
            </div>
          </div>

          {apiError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {apiError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={mode === "loading"}>
            {mode === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {LOADING_MESSAGES[loadingMessageIndex]}
              </>
            ) : (
              "Genera itinerario"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

Notes on this rewrite, versus the current file:
- `mode` changes from `"form" | "summary"` to `"form" | "loading" | "result"`. There is no separate `"error"` mode — an API error sets `apiError` and returns to `"form"`, per the approved spec ("torna alla vista form con un banner d'errore in cima").
- The `mode === "loading" && "pointer-events-none opacity-60"` wrapper disables and dims every field above the submit button while a request is in flight, without needing a `disabled` prop threaded through every individual field.
- The submit button itself stays fully visible (not dimmed) and swaps its label for a spinner + the current rotating message while `mode === "loading"`.
- `TripSummary` import is replaced by `ItineraryResult`.

- [ ] **Step 3: Delete the now-unused static summary component**

```bash
git rm components/itinerary-form/trip-summary.tsx
```

- [ ] **Step 4: Run the full automated suite, lint, and build**

Run: `npm test`
Expected: PASS, full suite green (26 tests from Task 1 + 7 from Task 2's prompt test + 7 from Task 2's error test + 1 from Task 3 = 41 tests — exact count may vary slightly if a prior task's step count differed, but there must be zero failures).

Run: `npm run lint`
Expected: no new errors (the pre-existing `react-hooks/incompatible-library` warning on the `participants` line is expected and unrelated to this change).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev`, open the app in a browser.

Verify the golden path and edge cases:
1. Fill in a valid trip (destination, a date range under 14 days, at least one participant with an age, a budget) and submit.
2. Confirm the form freezes (fields dimmed, unclickable) and the submit button shows a spinner with rotating Italian messages that change roughly every 4.5s, without visibly repeating the same message back-to-back.
3. Since `.env.local`'s `ANTHROPIC_API_KEY` is currently an empty string, the request will reach Anthropic's API and get rejected with 401 — confirm this surfaces as the `config` error banner ("Si è verificato un problema tecnico. Riprova tra poco.") above the submit button, that the form has returned to `"form"` mode, and that all previously entered field values are still intact.
4. Select a date range spanning more than 14 days and confirm the form shows the "Il viaggio non può superare i 14 giorni" validation error and blocks submission (never reaches the loading state).
5. Take a screenshot of both the loading state and the error-banner state for the report.

If a real `ANTHROPIC_API_KEY` has been added to `.env.local` by this point, also verify the success path: submit a valid trip, wait for the response, and confirm `ItineraryResult` renders the compact trip-parameters header plus a day-by-day breakdown with activities, costs, and opening hours where applicable, and that "Modifica" returns to the form with all fields intact. If no key is available yet, skip this and note it as deferred in the report — it is not blocking for this task.

- [ ] **Step 6: Commit**

```bash
git add components/itinerary-form/itinerary-form.tsx components/itinerary-form/itinerary-result.tsx
git commit -m "feat: wire itinerary form to real generation, add loading and result states"
```
