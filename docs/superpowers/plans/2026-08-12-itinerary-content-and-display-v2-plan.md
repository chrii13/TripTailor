# Itinerary Content & Display v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated itineraries more concrete and useful (specific time per activity, adaptive activity density per time slot, gender-inclusive language) and give the display a real visual hierarchy (day cards with a colored header, hover feedback, and a click-to-expand detail popup) — all confirmed via an interactive mockup in a prior session.

**Architecture:** Two independent layers, done as two tasks. Task 1 grows the AI-facing contract: the itinerary response schema gains two new required per-activity fields (`suggestedTime`, `details`), the prompt is rewritten to ask for them (and to stop assuming a fixed activity count per slot), and the generation token budget is raised to fit the richer content. Task 2 is purely presentational: a new `Dialog` UI primitive (added by hand, matching this project's existing `radix-ui`-consolidated-package convention — not the shadcn CLI), and a full rewrite of `ItineraryResult` to the card layout approved in the visual companion session. A three-way duplicated `TYPE_LABELS` constant (in `lib/itinerary-prompt.ts`, `components/itinerary-form/participant-row.tsx`, `components/itinerary-form/itinerary-result.tsx`) is consolidated into one export from `lib/schema.ts` as part of making it gender-inclusive, so the three call sites can't drift again.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, zod v4, `radix-ui` (already a dependency — verified it exports the `Dialog` namespace with `Root`/`Trigger`/`Portal`/`Overlay`/`Content`/`Close`/`Title`/`Description`), `lucide-react` (already a dependency — verified it exports `XIcon`), Tailwind v4, vitest.

## Global Constraints

- `suggestedTime` and `details` (`{ about, gettingThere, tips }`) are **required** on every activity — not optional like `openingHours`. Every activity must be explorable via the detail popup.
- `openingHours` keeps its existing meaning (when the place is generally open) and stays optional/contextual — it is a different concept from `suggestedTime` (when the traveler should specifically be there) and both coexist.
- The prompt must NOT impose a fixed number of activities per time slot — a single substantial activity (a major museum, a day trip) filling a whole slot is valid; 2-3 shorter activities is also valid. The model decides per slot, per the spec.
- Participant type labels are exactly `"Bambino/a"`, `"Ragazzo/a"`, `"Adulto/a"` — used identically in the UI (dropdown, popover, trip summary) and in the prompt's participant list.
- The visual design for the day card is exactly what was approved in the visual companion session (not up for re-interpretation): a solid `bg-primary`/`text-primary-foreground` header bar with "Giorno N" on the left and the date on the right, both vertically centered, title larger than the date; below it, time-of-day sections separated by a top border, no icons/emoji anywhere; each activity is a clickable row showing title, description, and a meta line with `suggestedTime` (left) and `estimatedCost` (right) in bold primary color; hover raises the row slightly (`-translate-y-0.5`) and tints the background with `bg-accent` — no scale/zoom transform (an earlier mockup iteration used one, it was explicitly replaced by the lift effect in the version the user approved).
- Every color used must already exist in `app/globals.css`'s theme tokens (`--primary`, `--primary-foreground`, `--card`, `--border`, `--accent`, `--muted-foreground`, etc.) — no new hex values introduced anywhere in this plan.
- No automated test may call the real Gemini API (unchanged project-wide rule). A real generation is used only for this plan's manual verification step, using the `GEMINI_API_KEY` already configured in `.env.local`.

---

### Task 1: Richer itinerary schema, prompt, and token budget

**Files:**
- Modify: `lib/schema.ts` (add shared `PARTICIPANT_TYPE_LABELS` export)
- Modify: `lib/itinerary-schema.ts` (add `suggestedTime`, `details` to `activitySchema`)
- Modify: `lib/itinerary-schema.test.ts`
- Modify: `lib/itinerary-prompt.ts` (use the new schema fields' instructions, adaptive activity density, inclusive labels)
- Modify: `lib/itinerary-prompt.test.ts`
- Modify: `app/api/generate-itinerary/route.ts` (raise `maxOutputTokens`)

**Interfaces:**
- Consumes: nothing new from outside this task.
- Produces:
  - `lib/schema.ts`: `export const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string>` — Task 2 imports this into `participant-row.tsx` and the rewritten `itinerary-result.tsx`, replacing their own local copies.
  - `lib/itinerary-schema.ts`: `activitySchema` now includes `suggestedTime: string` and `details: { about: string; gettingThere: string; tips: string }`, both required. `Activity` and the new `ActivityDetails` types are exported. Task 2's `ItineraryResult` rewrite reads `activity.suggestedTime` and `activity.details.{about,gettingThere,tips}` directly — the field names must match exactly.

- [ ] **Step 1: Write the failing test for the shared label export**

There isn't a dedicated test file for `lib/schema.ts` today (it's covered indirectly through `lib/schema.test.ts`'s `tripFormSchema` tests). Add a new, separate top-level `describe` block at the very end of `lib/schema.test.ts`, after the existing `describe("tripFormSchema", ...)` block's closing `});` — do not nest it inside that block:

```ts
describe("PARTICIPANT_TYPE_LABELS", () => {
  it("usa la forma inclusiva per tutti e tre i tipi", () => {
    expect(PARTICIPANT_TYPE_LABELS.bambino).toBe("Bambino/a");
    expect(PARTICIPANT_TYPE_LABELS.ragazzo).toBe("Ragazzo/a");
    expect(PARTICIPANT_TYPE_LABELS.adulto).toBe("Adulto/a");
  });
});
```

Add `PARTICIPANT_TYPE_LABELS` to the existing `import { tripFormSchema } from "./schema";` line at the top of the file, making it `import { tripFormSchema, PARTICIPANT_TYPE_LABELS } from "./schema";`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `PARTICIPANT_TYPE_LABELS` is not exported from `./schema` yet.

- [ ] **Step 3: Add `PARTICIPANT_TYPE_LABELS` to `lib/schema.ts`**

Insert this right after `export type ParticipantType = keyof typeof AGE_RANGES;` (before `export const participantSchema = ...`):

```ts
export const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string> = {
  bambino: "Bambino/a",
  ragazzo: "Ragazzo/a",
  adulto: "Adulto/a",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `lib/schema.test.ts` pass (17 tests: the 15 pre-existing plus the new `describe` block's 1 test — wait, re-count: the file currently has 15 tests in `describe("tripFormSchema", ...)`; this step adds exactly 1 new test in a new `describe` block, so 16 total in this file).

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts lib/schema.test.ts
git commit -m "feat: add shared gender-inclusive participant type labels"
```

- [ ] **Step 6: Write the failing tests for the richer activity schema**

Replace the full contents of `lib/itinerary-schema.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { itineraryResponseSchema } from "./itinerary-schema";

const validActivity = {
  title: "Visita al museo civico",
  description: "Collezione permanente di arte locale.",
  estimatedCost: "8€",
  suggestedTime: "9:00–11:00",
  details: {
    about: "Museo dedicato alla storia e all'arte locale, ospitato in un antico palazzo.",
    gettingThere: "A 10 minuti a piedi dalla stazione centrale.",
    tips: "Ingresso gratuito la prima domenica del mese.",
  },
};

const validResponse = {
  days: [
    {
      date: "2026-09-12",
      mattina: [
        {
          title: "Colazione al mercato locale",
          description: "Un giro tra le bancarelle per assaggiare specialità del posto.",
          estimatedCost: "~10€",
          suggestedTime: "8:00–9:00",
          details: {
            about: "Mercato coperto con prodotti tipici e street food.",
            gettingThere: "Nel centro storico, raggiungibile a piedi dal centro.",
            tips: "Meglio andarci presto per evitare la folla.",
          },
        },
      ],
      pomeriggio: [{ ...validActivity, openingHours: "9:00–18:00, chiuso il lunedì" }],
      sera: [
        {
          title: "Passeggiata sul lungomare",
          description: "Vista sul tramonto.",
          estimatedCost: "Gratuito",
          suggestedTime: "19:00–20:00",
          details: {
            about: "Lungomare pedonale con vista panoramica sul golfo.",
            gettingThere: "Adiacente al centro, facilmente raggiungibile a piedi.",
            tips: "Il tramonto migliore è verso fine estate.",
          },
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
      days: [{ ...validResponse.days[0], mattina: [{ ...validActivity, title: undefined }] }],
    };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta una risposta dove 'days' non è un array", () => {
    const result = itineraryResponseSchema.safeParse({ days: "non un array" });
    expect(result.success).toBe(false);
  });

  it("rifiuta una data non in formato ISO (es. 'giorno mese anno' in italiano)", () => {
    const invalid = { days: [{ ...validResponse.days[0], date: "12 settembre 2026" }] };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta un'attività senza suggestedTime", () => {
    const { suggestedTime, ...activityWithoutTime } = validActivity;
    const invalid = { days: [{ ...validResponse.days[0], mattina: [activityWithoutTime] }] };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta un'attività senza il campo details", () => {
    const { details, ...activityWithoutDetails } = validActivity;
    const invalid = { days: [{ ...validResponse.days[0], mattina: [activityWithoutDetails] }] };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rifiuta un'attività con details incompleto (manca gettingThere)", () => {
    const invalid = {
      days: [
        {
          ...validResponse.days[0],
          mattina: [{ ...validActivity, details: { about: "x", tips: "y" } }],
        },
      ],
    };
    const result = itineraryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — several new tests fail because `activitySchema` doesn't have `suggestedTime`/`details` yet, and the `validResponse`/`validActivity` fixtures (which now include those fields) fail the *current* schema's stricter-than-necessary shape in the "accetta" tests too (the current schema doesn't reject extra fields by default, so the "accepts" tests likely still pass, but the new "rejects" tests for `suggestedTime`/`details` fail because there's nothing to reject yet — `safeParse` succeeds when it should fail). Confirm the failures are in the new tests specifically.

- [ ] **Step 8: Update `lib/itinerary-schema.ts`**

Replace its full contents with:

```ts
import { z } from "zod";

export const activityDetailsSchema = z.object({
  about: z.string(),
  gettingThere: z.string(),
  tips: z.string(),
});

export const activitySchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedCost: z.string(),
  openingHours: z.string().optional(),
  suggestedTime: z.string(),
  details: activityDetailsSchema,
});

export const itineraryDaySchema = z.object({
  date: z.iso.date(),
  mattina: z.array(activitySchema),
  pomeriggio: z.array(activitySchema),
  sera: z.array(activitySchema),
});

export const itineraryResponseSchema = z.object({
  days: z.array(itineraryDaySchema),
});

export type ActivityDetails = z.infer<typeof activityDetailsSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 9 tests in `lib/itinerary-schema.test.ts` pass.

- [ ] **Step 10: Commit**

```bash
git add lib/itinerary-schema.ts lib/itinerary-schema.test.ts
git commit -m "feat: require suggestedTime and details on every itinerary activity"
```

- [ ] **Step 11: Write the failing/updated prompt tests**

Replace the full contents of `lib/itinerary-prompt.test.ts` with:

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

  it("include tipo (in forma inclusiva) ed età esatta di ogni partecipante", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      participants: [
        { type: "bambino", age: 7 },
        { type: "adulto", age: 40 },
      ],
    };
    const prompt = buildItineraryPrompt(request);
    expect(prompt).toContain("Bambino/a, 7 anni");
    expect(prompt).toContain("Adulto/a, 40 anni");
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

  it("istruisce a fornire un orario consigliato per ogni attività", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("suggestedTime");
  });

  it("istruisce a fornire i campi di approfondimento about/gettingThere/tips", () => {
    const prompt = buildItineraryPrompt(baseRequest);
    expect(prompt).toContain("about");
    expect(prompt).toContain("gettingThere");
    expect(prompt).toContain("tips");
  });

  it("non impone un numero fisso di attività per fascia", () => {
    expect(buildItineraryPrompt(baseRequest)).toContain("Non imporre un numero fisso");
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the updated "forma inclusiva" test fails against the current prompt (still says "Bambino, 7 anni"), and the three new tests fail since the current prompt has none of that instructional text yet.

- [ ] **Step 13: Update `lib/itinerary-prompt.ts`**

Replace its full contents with:

```ts
import { differenceInCalendarDays, format } from "date-fns";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";
import { PARTICIPANT_TYPE_LABELS } from "./schema";

export function buildItineraryPrompt(request: GenerateItineraryRequest): string {
  const { destination, dateRange, participants, budget, styleNotes } = request;
  const dayCount = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  const participantsList = participants
    .map((p) => `- ${PARTICIPANT_TYPE_LABELS[p.type]}, ${p.age} anni`)
    .join("\n");

  return `Genera un itinerario di viaggio dettagliato per il seguente viaggio.

Destinazione: ${destination}
Date: dal ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")} (${dayCount} giorni)
Budget indicativo totale: ${budget}€
Viaggiatori:
${participantsList}
${styleNotes ? `Note sullo stile di viaggio: ${styleNotes}` : ""}

Genera un piano giorno per giorno, con una data (formato YYYY-MM-DD) per ogni giorno del viaggio, diviso in tre fasce orarie (mattina, pomeriggio, sera). Per ogni fascia, elenca una o più attività. Adatta il numero di attività alla situazione: se un'attività è sostanziosa e occupa ragionevolmente l'intera fascia (es. un grande museo, un'escursione fuori porta), lasciala da sola; altrimenti proponi 2-3 attività più brevi con orari che si susseguono senza sovrapporsi. Non imporre un numero fisso di attività per fascia: valuta caso per caso.

Per ogni attività fornisci:
- title: titolo breve.
- description: breve descrizione.
- estimatedCost: stima indicativa del costo (es. "~15€" o "Gratuito").
- suggestedTime: fascia oraria consigliata per quella specifica attività, nel formato "HH:MM–HH:MM" (es. "10:00–12:30") — deve rientrare nella fascia della giornata (mattina/pomeriggio/sera) e non sovrapporsi con le altre attività della stessa fascia.
- openingHours: orari di apertura/chiusura del luogo, solo dove pertinente (musei, monumenti, locali — non per attività generiche come una passeggiata). Ometti il campo quando non applicabile.
- details: un oggetto con tre campi pensati per un viaggiatore che non conosce affatto la zona:
  - about: cosa è il posto o l'attività.
  - gettingThere: come raggiungerlo, tenendo conto di dove si trova il viaggiatore nell'itinerario in quel momento.
  - tips: consigli pratici utili (es. quando evitare la fila, cosa portare, aspetti da sapere in anticipo).

Adatta ritmo e tipo di attività alla composizione del gruppo:
- Se sono presenti bambini/e (0-12 anni): ritmo rilassato, poche attività per fascia, pause frequenti, orari non troppo mattinieri, pasti a orari regolari. Preferisci parchi, zoo/acquari, musei interattivi/scientifici, attività family-friendly. Evita vita notturna, locali per adulti, trekking impegnativi o attività con lunghe attese in piedi/code.
- Se sono presenti ragazzi/e (13-25 anni) ma nessun bambino/a: ritmo più dinamico, mix di cultura leggera e intrattenimento, attività social/esperienziali (punti panoramici, esperienze fotografiche, sport leggeri/acquatici, escursioni brevi). Non presumere accesso a locali/nightlife per l'intera fascia, dato che include minorenni (13-17): resta su attività adatte anche a un/a sedicenne, a meno che tutti i "ragazzi/e" del gruppo abbiano età pari o superiore a 18 anni.
- Se sono presenti solo adulti/e (26+ anni), nessun bambino/a o ragazzo/a: ritmo più libero e denso, spazio a vita notturna, trekking impegnativi, esperienze enogastronomiche, cultura senza vincoli di tempo ridotti. Usa l'età precisa per calibrare il tono: un gruppo di ventenni e uno di cinquantenni sono entrambi "adulti" ma possono giustificare attività diverse.
- In gruppi misti, il ritmo si adatta al membro più vincolante: se ci sono bambini/e, la giornata resta family-friendly anche con adulti/e nel gruppo, con una sera tranquilla piuttosto che vita notturna.

Non fare alcun riferimento alle condizioni climatiche. Rispetta il budget indicativo indicato nella somma delle stime di costo.`;
}
```

- [ ] **Step 14: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 10 tests in `lib/itinerary-prompt.test.ts` pass.

- [ ] **Step 15: Raise the generation token budget**

In `app/api/generate-itinerary/route.ts`, change:

```ts
        maxOutputTokens: 24000,
```

to:

```ts
        maxOutputTokens: 50000,
```

This is the only change in this file for this task — everything else (model, timeout, retry policy, thinking budget) stays as-is.

- [ ] **Step 16: Run the full suite, typecheck, and build**

Run: `npm test`
Expected: PASS, full suite green.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds. Note: this will fail if `components/itinerary-form/itinerary-result.tsx` or `components/itinerary-form/participant-row.tsx` don't type-check against the new `Activity`/`PARTICIPANT_TYPE_LABELS` shapes — but this task does NOT touch those files, so if the build fails here, it's almost certainly because those files still reference the old `activitySchema` shape or a local `TYPE_LABELS` that no longer matches something — in which case just confirm the build error is pre-existing/expected (those files are Task 2's responsibility) rather than something this task's changes broke. If genuinely unsure, report it rather than guessing.

- [ ] **Step 17: Commit**

```bash
git add lib/itinerary-prompt.ts lib/itinerary-prompt.test.ts app/api/generate-itinerary/route.ts
git commit -m "feat: adaptive activity density, inclusive language, and richer prompt instructions"
```

---

### Task 2: Card-based day display with detail popup

**Files:**
- Create: `components/ui/dialog.tsx`
- Modify: `components/itinerary-form/itinerary-result.tsx` (full rewrite)
- Modify: `components/itinerary-form/participant-row.tsx` (replace local `TYPE_LABELS` with the shared import)

**Interfaces:**
- Consumes: `PARTICIPANT_TYPE_LABELS` from `lib/schema.ts` (Task 1), `Activity`/`ItineraryResponse` types from `lib/itinerary-schema.ts` (Task 1 — `Activity` now has `suggestedTime` and `details.{about,gettingThere,tips}`), `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` from this task's own new `components/ui/dialog.tsx`.
- Produces: nothing new consumed elsewhere — this is the top of the component tree for the result view.

- [ ] **Step 1: Create `components/ui/dialog.tsx`**

This mirrors the project's existing `components/ui/popover.tsx` pattern exactly (same `"use client"` + `radix-ui`-consolidated-package import style, same `data-slot` convention) — it is NOT run through the shadcn CLI, it's the standard shadcn/ui "new-york" style `Dialog` component written directly, verified against the installed `radix-ui` package (its `Dialog` export has `Root`, `Trigger`, `Portal`, `Overlay`, `Content`, `Close`, `Title`, `Description` — all used below) and `lucide-react` (`XIcon`, used below).

```tsx
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
```

- [ ] **Step 2: Replace `components/itinerary-form/itinerary-result.tsx` entirely**

```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PARTICIPANT_TYPE_LABELS, type TripFormValues } from "@/lib/schema";
import type { Activity, ItineraryResponse } from "@/lib/itinerary-schema";

interface ItineraryResultProps {
  tripData: TripFormValues;
  itinerary: ItineraryResponse;
  onEdit: () => void;
}

const SLOTS = [
  { key: "mattina", label: "Mattina" },
  { key: "pomeriggio", label: "Pomeriggio" },
  { key: "sera", label: "Sera" },
] as const;

export function ItineraryResult({ tripData, itinerary, onEdit }: ItineraryResultProps) {
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

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
            {tripData.participants.map((p) => `${PARTICIPANT_TYPE_LABELS[p.type]} (${p.age})`).join(", ")}
          </span>
          <span>
            <span className="text-muted-foreground">Budget: </span>
            {tripData.budget}€
          </span>
        </div>

        <div className="space-y-6">
          {itinerary.days.map((day, dayIndex) => {
            const parsedDate = new Date(day.date);
            const formattedDate = Number.isNaN(parsedDate.getTime())
              ? day.date
              : format(parsedDate, "dd/MM/yyyy");
            return (
              <div key={dayIndex} className="overflow-hidden rounded-2xl border">
                <div className="flex items-center justify-between gap-3 bg-primary px-4 py-4 text-primary-foreground">
                  <p className="font-display text-2xl">Giorno {dayIndex + 1}</p>
                  <p className="text-base opacity-85">{formattedDate}</p>
                </div>
                <div className="bg-card px-4 pb-1">
                  {SLOTS.map(
                    ({ key, label }) =>
                      day[key].length > 0 && (
                        <div key={key} className="border-t py-3 first:border-t-0">
                          <p className="mb-2 text-xs font-bold tracking-wide text-primary uppercase">
                            {label}
                          </p>
                          <div className="space-y-1">
                            {day[key].map((activity, activityIndex) => (
                              <button
                                key={activityIndex}
                                type="button"
                                onClick={() => setSelectedActivity(activity)}
                                className="w-full rounded-lg p-2 text-left transition hover:-translate-y-0.5 hover:bg-accent"
                              >
                                <p className="text-sm font-medium">{activity.title}</p>
                                <p className="text-sm text-muted-foreground">{activity.description}</p>
                                <div className="mt-1.5 flex justify-between text-xs font-semibold text-primary">
                                  <span>{activity.suggestedTime}</span>
                                  <span>{activity.estimatedCost}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button type="button" variant="outline" onClick={onEdit} className="w-full">
          Modifica
        </Button>
      </CardContent>

      <Dialog open={selectedActivity !== null} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent>
          {selectedActivity && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedActivity.title}</DialogTitle>
                <DialogDescription>
                  {selectedActivity.suggestedTime} · {selectedActivity.estimatedCost}
                  {selectedActivity.openingHours ? ` · ${selectedActivity.openingHours}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-foreground">Cosa è</p>
                  <p className="text-muted-foreground">{selectedActivity.details.about}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Come arrivarci</p>
                  <p className="text-muted-foreground">{selectedActivity.details.gettingThere}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Consigli</p>
                  <p className="text-muted-foreground">{selectedActivity.details.tips}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
```

Notes on this rewrite, versus the current file:
- The per-slot `<ul>/<li>` list is replaced by clickable `<button>` rows (each opens the shared `Dialog` with that activity's full detail) inside a single bordered, rounded day card with a solid-color header bar — matching the approved mockup exactly (title left/date right/both vertically centered in the header; no icons or emoji; hover lifts the row and tints it with `bg-accent`; time+cost on their own line, bold, primary color).
- `openingHours` is no longer shown directly on the card face (the approved mockup didn't show it there either) — it now appears in the popup's description line, alongside `suggestedTime` and `estimatedCost`, only when present.
- `SLOTS`'s `key`/`label` pairs and the `Number.isNaN` date-parsing guard are unchanged from the current file — no reason to touch what already works.

- [ ] **Step 3: Update `components/itinerary-form/participant-row.tsx`**

Change the import line from:

```ts
import { AGE_RANGES, type ParticipantType, type TripFormValues } from "@/lib/schema";
```

to:

```ts
import { AGE_RANGES, PARTICIPANT_TYPE_LABELS, type ParticipantType, type TripFormValues } from "@/lib/schema";
```

Delete the local constant:

```ts
const TYPE_LABELS: Record<ParticipantType, string> = {
  bambino: "Bambino",
  ragazzo: "Ragazzo",
  adulto: "Adulto",
};
```

Then replace every remaining use of `TYPE_LABELS` in the file with `PARTICIPANT_TYPE_LABELS` (there are two: `Object.keys(TYPE_LABELS)` and `{TYPE_LABELS[t]}` inside the `SelectItem` mapping). Leave everything else in the file untouched.

- [ ] **Step 4: Run the full suite, lint, typecheck, and build**

Run: `npm test`
Expected: PASS, full suite green (same count as the end of Task 1 — this task adds no new automated tests, it's a UI task verified by build/lint/typecheck + manual browser verification, matching this project's established pattern for UI-only tasks).

Run: `npm run lint`
Expected: no new errors (the pre-existing `react-hooks/incompatible-library` warning in `itinerary-form.tsx` is expected and unrelated).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual browser verification with a real generation**

`.env.local` already has a working `GEMINI_API_KEY` (confirmed functional in a prior session). Run `npm run dev`, open the app, and generate a real itinerary (any valid trip — a multi-day trip with a mix of participant types is a good test since it exercises both the new content and the inclusive labels).

Verify, live:
1. The trip-parameters summary bar at the top shows participant labels as "Bambino/a (age)" / "Ragazzo/a (age)" / "Adulto/a (age)" per the actual participants entered.
2. Each day renders as a card with a solid-color green header ("Giorno N" left, date right, both vertically centered), no icons/emoji anywhere in the card.
3. At least one time slot has more than one activity with non-overlapping `suggestedTime` ranges, AND at least one slot (if the generated trip has one) has a single substantial activity alone — confirming the prompt's adaptive instruction is actually working, not just accepted by the schema. If the specific generation happens to have exactly one activity per slot throughout, that's not a failure by itself, but note it in the report — regenerate once more if needed to see the multi-activity case.
4. Hovering an activity row visibly lifts it and tints the background — no jarring layout shift.
5. Clicking an activity opens the dialog with the title, the meta line (time · cost · opening hours when present), and all three detail sections (Cosa è / Come arrivarci / Consigli) populated with real, non-empty text. Confirm the dialog closes via the X button, clicking the backdrop, and the Escape key (all three are Radix `Dialog` built-ins — if any doesn't work, that's a real bug to report, not an assumption to skip).
6. "Modifica" still returns to the form with all fields intact (unchanged behavior, but confirm nothing broke).

Report exactly what you observed for each of the 6 points above — don't report success on a point you didn't actually check.

- [ ] **Step 6: Commit**

```bash
git add components/ui/dialog.tsx components/itinerary-form/itinerary-result.tsx components/itinerary-form/participant-row.tsx
git commit -m "feat: card-based day layout with click-to-expand activity details"
```
