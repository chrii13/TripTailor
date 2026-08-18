# Ricerca inversa: dal budget alle proposte di viaggio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a TripTailor un secondo percorso — l'utente indica budget, viaggiatori, date e città di partenza, e riceve cinque proposte di viaggio costificate (volo, alloggio, spese in loco) tra cui scegliere.

**Architecture:** Una sola chiamata a Gemini restituisce le proposte già costificate, con lo schema di risposta forzato via `responseJsonSchema`; una funzione pura lato server ricalcola i totali e scarta le proposte fuori budget. Il flusso vive su una route dedicata `/scopri`, separata da `/crea`, e ogni proposta rimanda a `/crea` precompilata, dove riparte il generatore di itinerari esistente.

**Tech Stack:** Next.js 16 (App Router), TypeScript, zod v4, react-hook-form + `@hookform/resolvers`, Tailwind CSS v4, shadcn/ui, framer-motion, `@google/genai`, vitest (environment `node`).

**Spec:** `docs/superpowers/specs/2026-08-18-ricerca-inversa-design.md`

## Global Constraints

- **Lingua:** tutto ciò che l'utente legge è in italiano. Anche i nomi dei test e i messaggi di commit sono in italiano, come nel resto del repository.
- **Commit:** ogni messaggio di commit termina con il trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Branch:** si lavora su `feature/ricerca-inversa`, già creato e contenente la spec.
- **Test:** vitest gira con `environment: "node"` — **non esiste jsdom nel progetto**. Si testano solo funzioni pure e route handler. I componenti React si verificano a mano nel browser, mai con test di rendering.
- **Alias di import:** `@/` risolve alla radice del progetto (`vitest.config.ts` e `tsconfig.json`).
- **Nessuna nuova dipendenza** in `package.json` e nessuna nuova variabile d'ambiente: si usano `GEMINI_API_KEY` e `GEMINI_API_KEY_BACKUP` già configurate.
- **Nessun colore o pattern visivo nuovo.** Token esistenti in `app/globals.css`: Canvas `--background`, Nebbia `--secondary`, Bosco `--primary`, Sole `--voltage`. Il Sole vale per **un solo elemento per schermata**. Niente gradienti, niente ombre: bordi `1px`. Pill `rounded-full` per bottoni e badge, `10px` per card e input.
- **Valuta:** euro, sempre. Tutti i costi sono numeri interi in euro.
- **Verifica finale di ogni task che tocca codice TypeScript:** `npm run lint` deve passare pulito.

---

## Struttura dei file

**Nuovi — logica pura e API:**

| File | Responsabilità |
|---|---|
| `lib/discover-trips-request.ts` | Schema zod della richiesta in ingresso alla route |
| `lib/discover-trips-schema.ts` | Schema zod della risposta attesa da Gemini |
| `lib/discover-trips-prompt.ts` | Costruzione del prompt (funzione pura) |
| `lib/verify-proposal-budget.ts` | Ricalcolo dei totali e filtro sul budget |
| `lib/crea-query-params.ts` | Codifica e decodifica dei parametri di prefill di `/crea` |
| `app/api/discover-trips/route.ts` | Route handler POST |

**Nuovi — interfaccia:**

| File | Responsabilità |
|---|---|
| `app/scopri/page.tsx` | Pagina con intestazione sticky, monta il form |
| `components/discover-trips/discover-form.tsx` | Form + stato (form → loading → risultati) |
| `components/discover-trips/proposal-card.tsx` | Scheda di una singola proposta |
| `components/discover-trips/discover-results.tsx` | Griglia delle proposte |
| `components/landing/reverse-search.tsx` | Sezione esplicativa sulla landing |

**Modificati:**

| File | Modifica |
|---|---|
| `components/itinerary-form/destination-autocomplete.tsx` | Reso generico e parametrico su nome/etichetta/placeholder |
| `components/itinerary-form/participant-row.tsx` | Reso generico sul tipo del form |
| `app/crea/page.tsx` | Legge i nuovi parametri di query |
| `components/itinerary-form/itinerary-form.tsx` | Accetta un prefill completo invece della sola destinazione |
| `components/landing/hero.tsx` | Secondo ingresso |
| `components/landing/how-it-works.tsx` | Sottotitolo di raccordo |
| `components/landing/site-nav.tsx` | Quarta voce di navigazione |
| `app/page.tsx` | Monta la nuova sezione |
| `CLAUDE.md` | Aggiornamento della Sezione 1 |

---

## Task 1: Schema della richiesta

**Files:**
- Create: `lib/discover-trips-request.ts`
- Test: `lib/discover-trips-request.test.ts`

**Interfaces:**
- Consumes: `participantSchema` e `MAX_TRIP_DAYS` da `lib/schema.ts`
- Produces: `discoverTripsRequestSchema` (zod), tipo `DiscoverTripsRequest`, costante `VACATION_TYPES` e tipo `VacationType`

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `lib/discover-trips-request.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { discoverTripsRequestSchema, VACATION_TYPES } from "./discover-trips-request";

const validBody = {
  departureCity: "Milano, Italia",
  dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
  participants: [{ type: "adulto", age: 35 }],
  budget: 1500,
};

describe("discoverTripsRequestSchema", () => {
  it("accetta una richiesta valida senza tipo di vacanza", () => {
    expect(discoverTripsRequestSchema.safeParse(validBody).success).toBe(true);
  });

  it("accetta ogni tipo di vacanza previsto", () => {
    for (const vacationType of VACATION_TYPES) {
      const result = discoverTripsRequestSchema.safeParse({ ...validBody, vacationType });
      expect(result.success, `tipo di vacanza rifiutato: ${vacationType}`).toBe(true);
    }
  });

  it("rifiuta un tipo di vacanza non previsto", () => {
    const result = discoverTripsRequestSchema.safeParse({ ...validBody, vacationType: "crociera" });
    expect(result.success).toBe(false);
  });

  it("rifiuta una città di partenza vuota", () => {
    const result = discoverTripsRequestSchema.safeParse({ ...validBody, departureCity: "   " });
    expect(result.success).toBe(false);
  });

  it("rifiuta un budget negativo", () => {
    expect(discoverTripsRequestSchema.safeParse({ ...validBody, budget: -1 }).success).toBe(false);
  });

  it("rifiuta un intervallo di date invertito", () => {
    const result = discoverTripsRequestSchema.safeParse({
      ...validBody,
      dateRange: { from: "2026-09-05T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un viaggio più lungo del massimo consentito", () => {
    const result = discoverTripsRequestSchema.safeParse({
      ...validBody,
      dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un partecipante con età fuori dalla fascia del suo tipo", () => {
    const result = discoverTripsRequestSchema.safeParse({
      ...validBody,
      participants: [{ type: "bambino", age: 40 }],
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un elenco di partecipanti vuoto", () => {
    expect(discoverTripsRequestSchema.safeParse({ ...validBody, participants: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx vitest run lib/discover-trips-request.test.ts
```

Atteso: FAIL — il modulo `./discover-trips-request` non esiste.

- [ ] **Step 3: Scrivi l'implementazione minima**

Crea `lib/discover-trips-request.ts`:

```ts
import { z } from "zod";
import { participantSchema, MAX_TRIP_DAYS } from "./schema";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const VACATION_TYPES = [
  "mare",
  "montagna",
  "citta-arte",
  "natura",
  "gastronomia",
  "relax",
] as const;

export type VacationType = (typeof VACATION_TYPES)[number];

export const VACATION_TYPE_LABELS: Record<VacationType, string> = {
  mare: "Mare",
  montagna: "Montagna",
  "citta-arte": "Città d'arte",
  natura: "Natura",
  gastronomia: "Gastronomia",
  relax: "Relax",
};

export const discoverTripsRequestSchema = z.object({
  departureCity: z.string().trim().min(1).max(200),
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
  participants: z.array(participantSchema).min(1).max(20),
  budget: z.number().min(0).max(1_000_000),
  vacationType: z.enum(VACATION_TYPES).optional(),
});

export type DiscoverTripsRequest = z.infer<typeof discoverTripsRequestSchema>;
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run lib/discover-trips-request.test.ts
```

Atteso: PASS, 9 test.

- [ ] **Step 5: Commit**

```bash
git add lib/discover-trips-request.ts lib/discover-trips-request.test.ts && git commit -m "feat: schema della richiesta per la ricerca inversa"
```

---

## Task 2: Schema della risposta di Gemini

**Files:**
- Create: `lib/discover-trips-schema.ts`
- Test: `lib/discover-trips-schema.test.ts`

**Interfaces:**
- Produces: `discoverTripsResponseSchema`, `tripProposalSchema`, tipi `TripProposal`, `ProposalCosts`, `DiscoverTripsResponse`

I costi sono numeri interi non negativi: servono per fare aritmetica in Task 3, quindi il vincolo va nello schema e non in un controllo sparso più a valle.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `lib/discover-trips-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { discoverTripsResponseSchema } from "./discover-trips-schema";

const validProposal = {
  destination: "Lisbona",
  country: "Portogallo",
  whyItFits: "Voli brevi e costo della vita contenuto per il periodo scelto.",
  highlights: ["Quartiere dell'Alfama", "Pastéis de Belém", "Gita a Sintra"],
  costs: {
    flightsPerPerson: 120,
    flightsTotal: 240,
    lodgingTotal: 400,
    onSiteTotal: 300,
    total: 940,
  },
};

describe("discoverTripsResponseSchema", () => {
  it("accetta una risposta conforme", () => {
    const result = discoverTripsResponseSchema.safeParse({ proposals: [validProposal] });
    expect(result.success).toBe(true);
  });

  it("rifiuta una proposta senza ripartizione dei costi", () => {
    const { costs: _costs, ...withoutCosts } = validProposal;
    const result = discoverTripsResponseSchema.safeParse({ proposals: [withoutCosts] });
    expect(result.success).toBe(false);
  });

  it("rifiuta costi non numerici", () => {
    const result = discoverTripsResponseSchema.safeParse({
      proposals: [{ ...validProposal, costs: { ...validProposal.costs, lodgingTotal: "400€" } }],
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta costi negativi", () => {
    const result = discoverTripsResponseSchema.safeParse({
      proposals: [{ ...validProposal, costs: { ...validProposal.costs, onSiteTotal: -50 } }],
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta una proposta senza destinazione", () => {
    const result = discoverTripsResponseSchema.safeParse({
      proposals: [{ ...validProposal, destination: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("accetta un elenco vuoto di proposte", () => {
    expect(discoverTripsResponseSchema.safeParse({ proposals: [] }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx vitest run lib/discover-trips-schema.test.ts
```

Atteso: FAIL — il modulo non esiste.

- [ ] **Step 3: Scrivi l'implementazione minima**

Crea `lib/discover-trips-schema.ts`:

```ts
import { z } from "zod";

const euros = z.number().int().min(0);

export const proposalCostsSchema = z.object({
  flightsPerPerson: euros,
  flightsTotal: euros,
  lodgingTotal: euros,
  onSiteTotal: euros,
  total: euros,
});

export const tripProposalSchema = z.object({
  destination: z.string().min(1),
  country: z.string().min(1),
  whyItFits: z.string().min(1),
  highlights: z.array(z.string().min(1)),
  costs: proposalCostsSchema,
});

export const discoverTripsResponseSchema = z.object({
  proposals: z.array(tripProposalSchema),
});

export type ProposalCosts = z.infer<typeof proposalCostsSchema>;
export type TripProposal = z.infer<typeof tripProposalSchema>;
export type DiscoverTripsResponse = z.infer<typeof discoverTripsResponseSchema>;
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run lib/discover-trips-schema.test.ts
```

Atteso: PASS, 6 test.

- [ ] **Step 5: Commit**

```bash
git add lib/discover-trips-schema.ts lib/discover-trips-schema.test.ts && git commit -m "feat: schema delle proposte di viaggio restituite dall'AI"
```

---

## Task 3: Verifica del budget

**Files:**
- Create: `lib/verify-proposal-budget.ts`
- Test: `lib/verify-proposal-budget.test.ts`

**Interfaces:**
- Consumes: `TripProposal` da `lib/discover-trips-schema.ts`
- Produces: `computeProposalTotal(proposal: TripProposal): number` e `verifyProposalsAgainstBudget(proposals: TripProposal[], budget: number): TripProposal[]`

Due decisioni fissate qui, entrambe verificate dai test:

1. Il campo `total` restituito dal modello **non è attendibile** e viene sostituito dalla somma dei componenti. Le proposte che escono da questa funzione hanno sempre `total` coerente con la ripartizione mostrata a schermo.
2. L'ordinamento è **per totale crescente**: chi ha un budget vincolato beneficia dal vedere per prime le proposte che gli lasciano margine.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `lib/verify-proposal-budget.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeProposalTotal, verifyProposalsAgainstBudget } from "./verify-proposal-budget";
import type { TripProposal } from "./discover-trips-schema";

function proposal(destination: string, flights: number, lodging: number, onSite: number, declaredTotal?: number): TripProposal {
  return {
    destination,
    country: "Paese",
    whyItFits: "Motivo",
    highlights: ["a", "b", "c"],
    costs: {
      flightsPerPerson: Math.round(flights / 2),
      flightsTotal: flights,
      lodgingTotal: lodging,
      onSiteTotal: onSite,
      total: declaredTotal ?? flights + lodging + onSite,
    },
  };
}

describe("computeProposalTotal", () => {
  it("somma volo, alloggio e spese in loco ignorando il totale dichiarato", () => {
    expect(computeProposalTotal(proposal("Lisbona", 240, 400, 300, 99))).toBe(940);
  });
});

describe("verifyProposalsAgainstBudget", () => {
  it("tiene le proposte che rientrano nel budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Lisbona", 240, 400, 300)], 1500);
    expect(result).toHaveLength(1);
    expect(result[0].destination).toBe("Lisbona");
  });

  it("tiene la proposta che coincide esattamente con il budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Porto", 200, 300, 500)], 1000);
    expect(result).toHaveLength(1);
  });

  it("scarta le proposte che sfondano il budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Tokyo", 1400, 900, 700)], 1500);
    expect(result).toHaveLength(0);
  });

  it("scarta una proposta il cui totale dichiarato sta nel budget ma la cui somma reale lo supera", () => {
    const bugged = proposal("Oslo", 900, 800, 600, 1200);
    const result = verifyProposalsAgainstBudget([bugged], 1500);
    expect(result).toHaveLength(0);
  });

  it("riscrive il totale con la somma dei componenti", () => {
    const result = verifyProposalsAgainstBudget([proposal("Atene", 200, 300, 250, 1)], 2000);
    expect(result[0].costs.total).toBe(750);
  });

  it("ordina le proposte dalla più economica alla più costosa", () => {
    const result = verifyProposalsAgainstBudget(
      [proposal("Costosa", 500, 500, 400), proposal("Economica", 100, 200, 150), proposal("Media", 300, 300, 200)],
      2000
    );
    expect(result.map((p) => p.destination)).toEqual(["Economica", "Media", "Costosa"]);
  });

  it("restituisce un elenco vuoto quando nessuna proposta rientra nel budget", () => {
    const result = verifyProposalsAgainstBudget([proposal("Maldive", 2000, 3000, 1000)], 500);
    expect(result).toEqual([]);
  });

  it("non modifica l'array ricevuto in ingresso", () => {
    const input = [proposal("B", 300, 300, 300), proposal("A", 100, 100, 100)];
    verifyProposalsAgainstBudget(input, 5000);
    expect(input.map((p) => p.destination)).toEqual(["B", "A"]);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx vitest run lib/verify-proposal-budget.test.ts
```

Atteso: FAIL — il modulo non esiste.

- [ ] **Step 3: Scrivi l'implementazione minima**

Crea `lib/verify-proposal-budget.ts`:

```ts
import type { TripProposal } from "./discover-trips-schema";

export function computeProposalTotal(proposal: TripProposal): number {
  const { flightsTotal, lodgingTotal, onSiteTotal } = proposal.costs;
  return flightsTotal + lodgingTotal + onSiteTotal;
}

export function verifyProposalsAgainstBudget(
  proposals: TripProposal[],
  budget: number
): TripProposal[] {
  return proposals
    .map((proposal) => ({ proposal, total: computeProposalTotal(proposal) }))
    .filter(({ total }) => total <= budget)
    .sort((a, b) => a.total - b.total)
    .map(({ proposal, total }) => ({
      ...proposal,
      costs: { ...proposal.costs, total },
    }));
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run lib/verify-proposal-budget.test.ts
```

Atteso: PASS, 9 test.

- [ ] **Step 5: Commit**

```bash
git add lib/verify-proposal-budget.ts lib/verify-proposal-budget.test.ts && git commit -m "feat: verifica dei totali delle proposte contro il budget dichiarato"
```

---

## Task 4: Costruzione del prompt

**Files:**
- Create: `lib/discover-trips-prompt.ts`
- Test: `lib/discover-trips-prompt.test.ts`

**Interfaces:**
- Consumes: `DiscoverTripsRequest` e `VACATION_TYPE_LABELS` da `lib/discover-trips-request.ts`, `PARTICIPANT_TYPE_LABELS` da `lib/schema.ts`
- Produces: `buildDiscoverTripsPrompt(request: DiscoverTripsRequest): string` e la costante esportata `PROPOSALS_COUNT = 5`

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `lib/discover-trips-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildDiscoverTripsPrompt, PROPOSALS_COUNT } from "./discover-trips-prompt";
import type { DiscoverTripsRequest } from "./discover-trips-request";

const baseRequest: DiscoverTripsRequest = {
  departureCity: "Milano, Italia",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto", age: 34 }],
  budget: 1500,
};

describe("buildDiscoverTripsPrompt", () => {
  it("include la città di partenza", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain("Milano, Italia");
  });

  it("include le date e il numero di giorni", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).toContain("01/09/2026");
    expect(prompt).toContain("05/09/2026");
    expect(prompt).toContain("5 giorni");
  });

  it("include il budget totale", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain("1500€");
  });

  it("include tipo ed età di ogni viaggiatore", () => {
    const prompt = buildDiscoverTripsPrompt({
      ...baseRequest,
      participants: [
        { type: "bambino", age: 7 },
        { type: "adulto", age: 40 },
      ],
    });
    expect(prompt).toContain("Bambino/a, 7 anni");
    expect(prompt).toContain("Adulto/a, 40 anni");
  });

  it("include il numero di viaggiatori, che determina il costo totale dei voli", () => {
    const prompt = buildDiscoverTripsPrompt({
      ...baseRequest,
      participants: [
        { type: "adulto", age: 30 },
        { type: "adulto", age: 32 },
      ],
    });
    expect(prompt).toContain("2 viaggiatori");
  });

  it("chiede il numero di proposte previsto", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain(`${PROPOSALS_COUNT} proposte`);
  });

  it("include il tipo di vacanza quando presente", () => {
    const prompt = buildDiscoverTripsPrompt({ ...baseRequest, vacationType: "montagna" });
    expect(prompt).toContain("Montagna");
  });

  it("non nomina alcun tipo di vacanza quando non è indicato", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).not.toContain("Tipo di vacanza");
  });

  it("chiede esplicitamente di non superare il budget", () => {
    expect(buildDiscoverTripsPrompt(baseRequest)).toContain("non deve superare");
  });

  it("non chiede mai un itinerario giorno per giorno", () => {
    const prompt = buildDiscoverTripsPrompt(baseRequest);
    expect(prompt).not.toContain("giorno per giorno");
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx vitest run lib/discover-trips-prompt.test.ts
```

Atteso: FAIL — il modulo non esiste.

- [ ] **Step 3: Scrivi l'implementazione minima**

Crea `lib/discover-trips-prompt.ts`:

```ts
import { differenceInCalendarDays, format } from "date-fns";
import type { DiscoverTripsRequest } from "./discover-trips-request";
import { VACATION_TYPE_LABELS } from "./discover-trips-request";
import { PARTICIPANT_TYPE_LABELS } from "./schema";

export const PROPOSALS_COUNT = 5;

export function buildDiscoverTripsPrompt(request: DiscoverTripsRequest): string {
  const { departureCity, dateRange, participants, budget, vacationType } = request;
  const dayCount = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  const travelerCount = participants.length;
  const participantsList = participants
    .map((p) => `- ${PARTICIPANT_TYPE_LABELS[p.type]}, ${p.age} anni`)
    .join("\n");

  const vacationTypeSection = vacationType
    ? `\nTipo di vacanza desiderato: ${VACATION_TYPE_LABELS[vacationType]}. Tutte le proposte devono essere coerenti con questo tipo di vacanza.\n`
    : "";

  return `Il viaggiatore non ha ancora scelto una destinazione: sa solo quanto può spendere, quando parte, da dove e con chi. Proponi ${PROPOSALS_COUNT} proposte di viaggio compatibili con questi vincoli.

Città di partenza: ${departureCity}
Date: dal ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")} (${dayCount} giorni)
Budget totale disponibile per l'intero gruppo: ${budget}€
Viaggiatori: ${travelerCount} ${travelerCount === 1 ? "viaggiatore" : "viaggiatori"}
${participantsList}
${vacationTypeSection}
Per ogni proposta fornisci:
- destination: la città di destinazione.
- country: il paese in cui si trova.
- whyItFits: una frase che spiega perché questa meta funziona con il budget, il periodo e la composizione del gruppo indicati. Parla al viaggiatore, non di lui.
- highlights: esattamente tre punti salienti brevi (massimo 40 caratteri l'uno), cose concrete che si possono fare o vedere lì. Non frasi generiche come "cultura e relax".
- costs: la ripartizione completa della spesa, in euro, come numeri interi senza simboli né testo:
  - flightsPerPerson: costo indicativo del volo andata e ritorno per una persona, da ${departureCity} nel periodo indicato. Tieni conto della stagionalità: le stesse date in alta stagione costano più che in bassa.
  - flightsTotal: flightsPerPerson moltiplicato per ${travelerCount}.
  - lodgingTotal: costo complessivo dell'alloggio per l'intero gruppo per ${dayCount} giorni, coerente con il numero di persone.
  - onSiteTotal: spese in loco per l'intero gruppo (pasti, trasporti locali, ingressi, attività) per l'intera durata.
  - total: la somma esatta di flightsTotal, lodgingTotal e onSiteTotal.

Vincoli da rispettare:
- Il totale di ogni proposta non deve superare ${budget}€. Una proposta fuori budget è inutile: meglio una meta più vicina o più economica.
- Le ${PROPOSALS_COUNT} proposte devono essere diverse tra loro per meta e carattere del viaggio, non varianti della stessa idea né città dello stesso paese.
- Le destinazioni devono essere raggiungibili dalla città di partenza indicata nell'arco di date indicato.
- Adatta le mete alla composizione del gruppo: con bambini/e evita viaggi con voli molto lunghi o mete faticose.
- Le cifre sono stime indicative: restituisci numeri realistici e prudenti, senza mai spacciarli per prezzi verificati.`;
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run lib/discover-trips-prompt.test.ts
```

Atteso: PASS, 10 test.

- [ ] **Step 5: Commit**

```bash
git add lib/discover-trips-prompt.ts lib/discover-trips-prompt.test.ts && git commit -m "feat: prompt per la ricerca inversa delle mete"
```

---

## Task 5: Route API

**Files:**
- Create: `app/api/discover-trips/route.ts`
- Test: `app/api/discover-trips/route.test.ts`

**Interfaces:**
- Consumes: `discoverTripsRequestSchema`, `buildDiscoverTripsPrompt`, `discoverTripsResponseSchema`, `verifyProposalsAgainstBudget`, `getGeminiApiKeys`, `classifyGenerationError`
- Produces: `POST(request: Request)`. Risposta di successo: `{ proposals: TripProposal[] }`. Risposta di errore: `{ error: ErrorCode }` con `ErrorCode` da `lib/generate-itinerary-errors.ts`

Il modello di riferimento è `app/api/generate-itinerary/route.ts`: stessa struttura, stessa rotazione delle chiavi, stesso fallback di modello. **Nessuna chiamata a LocationIQ e nessuna chiamata a Open-Meteo.**

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `app/api/discover-trips/route.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

const validBody = {
  departureCity: "Milano, Italia",
  dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
  participants: [{ type: "adulto", age: 35 }],
  budget: 1500,
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/discover-trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/discover-trips", () => {
  it("rifiuta un Content-Type non JSON con 400 prima di chiamare Gemini", async () => {
    const request = new Request("http://localhost/api/discover-trips", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "ciao",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_response");
  });

  it("rifiuta un corpo non valido con 400 prima di chiamare Gemini", async () => {
    const response = await POST(jsonRequest({ departureCity: "" }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_response");
  });

  it("rifiuta un corpo JSON malformato con 400 senza lanciare un'eccezione non gestita", async () => {
    const response = await POST(jsonRequest("not valid json{"));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_response");
  });

  it("restituisce l'errore 'config' quando nessuna chiave Gemini è configurata", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const originalBackupKey = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "";
    process.env.GEMINI_API_KEY_BACKUP = "";

    try {
      const response = await POST(jsonRequest(validBody));

      expect(response.status).toBe(502);
      expect((await response.json()).error).toBe("config");
    } finally {
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
      if (originalBackupKey === undefined) {
        delete process.env.GEMINI_API_KEY_BACKUP;
      } else {
        process.env.GEMINI_API_KEY_BACKUP = originalBackupKey;
      }
    }
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx vitest run app/api/discover-trips/route.test.ts
```

Atteso: FAIL — il modulo `./route` non esiste.

- [ ] **Step 3: Scrivi l'implementazione minima**

Crea `app/api/discover-trips/route.ts`:

```ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { discoverTripsRequestSchema } from "@/lib/discover-trips-request";
import { discoverTripsResponseSchema } from "@/lib/discover-trips-schema";
import { buildDiscoverTripsPrompt } from "@/lib/discover-trips-prompt";
import { verifyProposalsAgainstBudget } from "@/lib/verify-proposal-budget";
import { classifyGenerationError } from "@/lib/generate-itinerary-errors";
import { getGeminiApiKeys } from "@/lib/gemini-api-keys";

const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error(`Ricerca inversa: Content-Type non valido (${contentType ?? "assente"})`);
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  const parsedRequest = discoverTripsRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "invalid_response",
        details: parsedRequest.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    console.error("Ricerca inversa: nessuna chiave Gemini configurata (GEMINI_API_KEY)");
    return NextResponse.json({ error: "config" }, { status: 502 });
  }

  const prompt = buildDiscoverTripsPrompt(parsedRequest.data);

  let responseText: string | undefined;
  let finishReason: string | undefined;
  let firstCode: ReturnType<typeof classifyGenerationError> | undefined;

  modelLoop:
  for (let m = 0; m < GEMINI_MODELS.length; m++) {
    const model = GEMINI_MODELS[m];
    for (let i = 0; i < apiKeys.length; i++) {
      const client = new GoogleGenAI({ apiKey: apiKeys[i] });
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(discoverTripsResponseSchema),
            maxOutputTokens: 20000,
            thinkingConfig: { thinkingBudget: 1024 },
            httpOptions: {
              timeout: 120_000,
              retryOptions: { attempts: 2, httpStatusCodes: [408, 500, 502, 503, 504] },
            },
          },
        });
        responseText = response.text;
        finishReason = response.candidates?.[0]?.finishReason;
        break modelLoop;
      } catch (error) {
        const code = classifyGenerationError(error);
        firstCode ??= code;
        const hasNextKey = i < apiKeys.length - 1;
        const hasNextModel = m < GEMINI_MODELS.length - 1;

        if (code === "rate_limit" && hasNextKey) {
          console.error(
            `Ricerca inversa: chiave Gemini #${i + 1} in rate limit (modello ${model}), tentativo con la chiave successiva`
          );
          continue;
        }

        if ((code === "rate_limit" || code === "network") && hasNextModel) {
          console.error(
            `Ricerca inversa: modello ${model} non disponibile (${code}), tentativo con il modello successivo`
          );
          continue modelLoop;
        }

        const finalCode = firstCode ?? code;
        console.error(`Ricerca inversa fallita (${finalCode}):`, error);
        const status = finalCode === "rate_limit" ? 429 : 502;
        return NextResponse.json({ error: finalCode }, { status });
      }
    }
  }

  if (!responseText) {
    console.error("Ricerca inversa: risposta vuota da Gemini");
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  let parsedProposals: unknown;
  try {
    parsedProposals = JSON.parse(responseText);
  } catch (error) {
    console.error(
      `Ricerca inversa: JSON non valido nella risposta di Gemini (finishReason: ${finishReason})`,
      error,
      responseText
    );
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  const parsedResult = discoverTripsResponseSchema.safeParse(parsedProposals);

  if (!parsedResult.success) {
    console.error("Ricerca inversa: risposta non conforme allo schema atteso", parsedResult.error);
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  const proposals = verifyProposalsAgainstBudget(
    parsedResult.data.proposals,
    parsedRequest.data.budget
  );

  return NextResponse.json({ proposals });
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run app/api/discover-trips/route.test.ts
```

Atteso: PASS, 4 test.

- [ ] **Step 5: Verifica che l'intera suite sia verde e il lint pulito**

```bash
npm test && npm run lint
```

Atteso: tutti i test passano, nessun errore di lint.

- [ ] **Step 6: Commit**

```bash
git add app/api/discover-trips && git commit -m "feat: route che genera le proposte di viaggio dal budget"
```

---

## Task 6: Parametri di prefill di `/crea`

**Files:**
- Create: `lib/crea-query-params.ts`
- Test: `lib/crea-query-params.test.ts`

**Interfaces:**
- Consumes: `AGE_RANGES`, `ParticipantType`, `Participant` da `lib/schema.ts`
- Produces:
  - `type CreaPrefill = { destination?: string; from?: Date; to?: Date; budget?: number; participants?: Participant[] }`
  - `type CreaSearchParams = { destination?: string; from?: string; to?: string; budget?: string; p?: string }`
  - `buildCreaHref(prefill: CreaPrefill): string`
  - `decodeCreaPrefill(params: CreaSearchParams): CreaPrefill`

Decisione fissata qui: se **un solo** partecipante nella stringa è malformato, si scarta **l'intero** elenco. Un gruppo ricostruito a metà sarebbe peggio di un gruppo da ricompilare, perché l'utente potrebbe non accorgersi che manca qualcuno.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `lib/crea-query-params.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCreaHref, decodeCreaPrefill } from "./crea-query-params";

describe("buildCreaHref", () => {
  it("costruisce un link con tutti i parametri", () => {
    const href = buildCreaHref({
      destination: "Lisbona, Portogallo",
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-05T00:00:00.000Z"),
      budget: 1500,
      participants: [
        { type: "adulto", age: 30 },
        { type: "bambino", age: 7 },
      ],
    });

    expect(href.startsWith("/crea?")).toBe(true);
    const params = new URLSearchParams(href.slice("/crea?".length));
    expect(params.get("destination")).toBe("Lisbona, Portogallo");
    expect(params.get("from")).toBe("2026-09-01");
    expect(params.get("to")).toBe("2026-09-05");
    expect(params.get("budget")).toBe("1500");
    expect(params.get("p")).toBe("adulto:30,bambino:7");
  });

  it("omette i parametri assenti", () => {
    const href = buildCreaHref({ destination: "Roma" });
    const params = new URLSearchParams(href.slice("/crea?".length));
    expect(params.get("destination")).toBe("Roma");
    expect(params.get("budget")).toBeNull();
    expect(params.get("p")).toBeNull();
  });
});

describe("decodeCreaPrefill", () => {
  it("fa il percorso inverso di buildCreaHref", () => {
    const prefill = {
      destination: "Lisbona, Portogallo",
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-05T00:00:00.000Z"),
      budget: 1500,
      participants: [{ type: "adulto" as const, age: 30 }],
    };
    const params = Object.fromEntries(
      new URLSearchParams(buildCreaHref(prefill).slice("/crea?".length))
    );

    const decoded = decodeCreaPrefill(params);

    expect(decoded.destination).toBe("Lisbona, Portogallo");
    expect(decoded.budget).toBe(1500);
    expect(decoded.participants).toEqual([{ type: "adulto", age: 30 }]);
    expect(decoded.from?.getFullYear()).toBe(2026);
    expect(decoded.from?.getMonth()).toBe(8);
    expect(decoded.from?.getDate()).toBe(1);
  });

  it("restituisce un oggetto vuoto quando non c'è alcun parametro", () => {
    expect(decodeCreaPrefill({})).toEqual({});
  });

  it("ignora una data malformata invece di produrre una data non valida", () => {
    const decoded = decodeCreaPrefill({ from: "non-una-data", to: "2026-09-05" });
    expect(decoded.from).toBeUndefined();
    expect(decoded.to).toBeDefined();
  });

  it("ignora un budget non numerico", () => {
    expect(decodeCreaPrefill({ budget: "tanti soldi" }).budget).toBeUndefined();
  });

  it("ignora un budget negativo", () => {
    expect(decodeCreaPrefill({ budget: "-100" }).budget).toBeUndefined();
  });

  it("decodifica più partecipanti", () => {
    const decoded = decodeCreaPrefill({ p: "adulto:30,bambino:7,ragazzo:20" });
    expect(decoded.participants).toEqual([
      { type: "adulto", age: 30 },
      { type: "bambino", age: 7 },
      { type: "ragazzo", age: 20 },
    ]);
  });

  it("scarta l'intero elenco se un tipo di partecipante non esiste", () => {
    expect(decodeCreaPrefill({ p: "adulto:30,cane:4" }).participants).toBeUndefined();
  });

  it("scarta l'intero elenco se un'età è fuori dalla fascia del suo tipo", () => {
    expect(decodeCreaPrefill({ p: "adulto:30,bambino:40" }).participants).toBeUndefined();
  });

  it("scarta l'intero elenco se un'età non è un numero", () => {
    expect(decodeCreaPrefill({ p: "adulto:trenta" }).participants).toBeUndefined();
  });

  it("scarta un elenco di partecipanti vuoto", () => {
    expect(decodeCreaPrefill({ p: "" }).participants).toBeUndefined();
  });

  it("ignora una destinazione composta solo da spazi", () => {
    expect(decodeCreaPrefill({ destination: "   " }).destination).toBeUndefined();
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx vitest run lib/crea-query-params.test.ts
```

Atteso: FAIL — il modulo non esiste.

- [ ] **Step 3: Scrivi l'implementazione minima**

Crea `lib/crea-query-params.ts`:

```ts
import { format } from "date-fns";
import { AGE_RANGES, type Participant, type ParticipantType } from "./schema";

export type CreaPrefill = {
  destination?: string;
  from?: Date;
  to?: Date;
  budget?: number;
  participants?: Participant[];
};

export type CreaSearchParams = {
  destination?: string;
  from?: string;
  to?: string;
  budget?: string;
  p?: string;
};

const PARTICIPANT_TYPES = ["bambino", "ragazzo", "adulto"] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isParticipantType(value: string): value is ParticipantType {
  return (PARTICIPANT_TYPES as readonly string[]).includes(value);
}

export function buildCreaHref(prefill: CreaPrefill): string {
  const params = new URLSearchParams();

  if (prefill.destination?.trim()) params.set("destination", prefill.destination.trim());
  if (prefill.from) params.set("from", format(prefill.from, "yyyy-MM-dd"));
  if (prefill.to) params.set("to", format(prefill.to, "yyyy-MM-dd"));
  if (prefill.budget !== undefined) params.set("budget", String(prefill.budget));
  if (prefill.participants?.length) {
    params.set("p", prefill.participants.map((p) => `${p.type}:${p.age}`).join(","));
  }

  return `/crea?${params.toString()}`;
}

function decodeDate(value: string | undefined): Date | undefined {
  if (!value || !DATE_PATTERN.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function decodeBudget(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const budget = Number(value);
  if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000) return undefined;
  return budget;
}

function decodeParticipants(value: string | undefined): Participant[] | undefined {
  if (!value) return undefined;

  const participants: Participant[] = [];
  for (const chunk of value.split(",")) {
    const [type, rawAge] = chunk.split(":");
    if (!type || !isParticipantType(type)) return undefined;

    const age = Number(rawAge);
    if (!Number.isInteger(age)) return undefined;

    const range = AGE_RANGES[type];
    if (age < range.min || age > range.max) return undefined;

    participants.push({ type, age });
  }

  return participants.length > 0 ? participants : undefined;
}

export function decodeCreaPrefill(params: CreaSearchParams): CreaPrefill {
  const prefill: CreaPrefill = {};

  const destination = params.destination?.trim();
  if (destination) prefill.destination = destination;

  const from = decodeDate(params.from);
  if (from) prefill.from = from;

  const to = decodeDate(params.to);
  if (to) prefill.to = to;

  const budget = decodeBudget(params.budget);
  if (budget !== undefined) prefill.budget = budget;

  const participants = decodeParticipants(params.p);
  if (participants) prefill.participants = participants;

  return prefill;
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run lib/crea-query-params.test.ts
```

Atteso: PASS, 13 test.

- [ ] **Step 5: Commit**

```bash
git add lib/crea-query-params.ts lib/crea-query-params.test.ts && git commit -m "feat: codifica dei dati di viaggio nei parametri di /crea"
```

---

## Task 7: `/crea` accetta il prefill completo

**Files:**
- Modify: `app/crea/page.tsx`
- Modify: `components/itinerary-form/itinerary-form.tsx:66-92` (l'interfaccia `ItineraryFormProps` e l'inizializzazione di `useForm`)

**Interfaces:**
- Consumes: `decodeCreaPrefill`, `CreaPrefill`, `CreaSearchParams` da `lib/crea-query-params.ts`
- Produces: `<ItineraryForm prefill={...} />` — la prop `initialDestination` viene **sostituita** da `prefill?: CreaPrefill`

Questo task non ha test automatici: `itinerary-form.tsx` è un componente client e vitest gira in environment `node`. La verifica è manuale nel browser, ed è specificata nello Step 4.

- [ ] **Step 1: Aggiorna la pagina**

Sostituisci integralmente il blocco di tipi e la funzione in `app/crea/page.tsx`, lasciando invariato tutto il markup dell'intestazione:

```tsx
import { decodeCreaPrefill, type CreaSearchParams } from "@/lib/crea-query-params";

type CreaPageProps = {
  searchParams: Promise<CreaSearchParams>;
};

export default async function Crea({ searchParams }: CreaPageProps) {
  const prefill = decodeCreaPrefill(await searchParams);
  // ...intestazione invariata...
  // <ItineraryForm prefill={prefill} />
}
```

- [ ] **Step 2: Aggiorna il form**

In `components/itinerary-form/itinerary-form.tsx`, sostituisci l'interfaccia delle prop e l'inizializzazione dei valori:

```tsx
import type { CreaPrefill } from "@/lib/crea-query-params";

interface ItineraryFormProps {
  prefill?: CreaPrefill;
}

export function ItineraryForm({ prefill }: ItineraryFormProps) {
  // ...

  const initialValues: TripFormValues = {
    ...defaultValues,
    ...(prefill?.destination ? { destination: prefill.destination } : {}),
    ...(prefill?.budget !== undefined ? { budget: prefill.budget } : {}),
    ...(prefill?.participants?.length ? { participants: prefill.participants } : {}),
    ...(prefill?.from || prefill?.to
      ? { dateRange: { from: prefill.from, to: prefill.to } }
      : {}),
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: initialValues,
  });
```

- [ ] **Step 3: Verifica che build e lint passino**

```bash
npm run lint && npm run build
```

Atteso: nessun errore. In particolare non deve restare alcun riferimento a `initialDestination`.

- [ ] **Step 4: Verifica manuale nel browser**

Avvia `npm run dev` e controlla, uno per uno:

1. `/crea` senza parametri → form vuoto con i valori di default, esattamente come prima.
2. `/crea?destination=Roma` → destinazione precompilata (comportamento storico, non deve essersi rotto: le card delle mete gettonate sulla landing usano ancora questo link).
3. `/crea?destination=Lisbona&from=2026-09-01&to=2026-09-05&budget=1500&p=adulto:30,bambino:7` → destinazione, date, budget e **due** viaggiatori con le età giuste.
4. `/crea?p=cane:4&budget=abc&from=domani` → form ai valori di default, nessun errore in console, pagina che si carica normalmente.

- [ ] **Step 5: Commit**

```bash
git add app/crea/page.tsx components/itinerary-form/itinerary-form.tsx && git commit -m "feat: /crea si precompila con date, budget e viaggiatori"
```

---

## Task 8: Componenti di form riutilizzabili

**Files:**
- Modify: `components/itinerary-form/destination-autocomplete.tsx`
- Modify: `components/itinerary-form/participant-row.tsx`
- Modify: `components/itinerary-form/itinerary-form.tsx` (adegua le chiamate)

**Interfaces:**
- Produces:
  - `<PlaceAutocomplete<T> control={...} name={...} label={...} placeholder={...} id={...} error={...} />` — il file resta `destination-autocomplete.tsx` e il componente resta esportato come `DestinationAutocomplete`
  - `<ParticipantRow<T> index control setValue onRemove canRemove error />` generico

Entrambi i componenti sono oggi legati a `Control<TripFormValues>`. Devono diventare generici perché il form di `/scopri` ha un tipo di valori diverso. Il comportamento visibile in `/crea` **non deve cambiare in nulla**.

- [ ] **Step 1: Rendi generico l'autocomplete**

In `components/itinerary-form/destination-autocomplete.tsx`, sostituisci l'interfaccia delle prop e la firma, lasciando invariata tutta la logica di fetch, debounce e navigazione da tastiera:

```tsx
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

interface DestinationAutocompleteProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  id: string;
  error?: string;
}

export function DestinationAutocomplete<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  id,
  error,
}: DestinationAutocompleteProps<T>) {
```

Nel corpo, sostituisci i valori fissi con le prop:

- `<Label htmlFor="destination">` → `<Label htmlFor={id}>`
- il testo `Destinazione` dentro la `Label` → `{label}`
- `name="destination"` nel `Controller` → `name={name}`
- `id="destination"` sull'`Input` → `id={id}`
- `placeholder="Es. Roma, Italia"` → `placeholder={placeholder}`
- `aria-controls="destination-suggestions"` → `` aria-controls={`${id}-suggestions`} ``
- `` id={`destination-option-${...}`} `` → `` id={`${id}-option-${...}`} ``
- `aria-activedescendant` → `` highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined ``
- `id="destination-suggestions"` sulla `ul` → `` id={`${id}-suggestions`} ``
- `value={field.value}` → `value={field.value ?? ""}` (con il tipo generico il valore non è più garantito come stringa)

- [ ] **Step 2: Rendi generica la riga partecipante**

In `components/itinerary-form/participant-row.tsx`:

```tsx
import {
  Controller,
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type UseFormSetValue,
} from "react-hook-form";
import { AGE_RANGES, PARTICIPANT_TYPE_LABELS, type ParticipantType } from "@/lib/schema";

interface ParticipantRowProps<T extends FieldValues> {
  index: number;
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  onRemove: () => void;
  canRemove: boolean;
  error?: string;
}

export function ParticipantRow<T extends FieldValues>({
  index,
  control,
  setValue,
  onRemove,
  canRemove,
  error,
}: ParticipantRowProps<T>) {
  const typeName = `participants.${index}.type` as Path<T>;
  const ageName = `participants.${index}.age` as Path<T>;
  const type = useWatch({ control, name: typeName }) as ParticipantType;
  const range = AGE_RANGES[type];
  const ages = Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);
```

Nel resto del componente usa `typeName` e `ageName` al posto delle stringhe letterali nei `Controller` e negli `htmlFor`/`id`. Dove `setValue` riceve un valore, il generico richiede un cast: usa la forma
`setValue(ageName, undefined as never)` per l'azzeramento dell'età al cambio di tipo, mantenendo identico il comportamento attuale.

- [ ] **Step 3: Adegua le chiamate in `itinerary-form.tsx`**

```tsx
<DestinationAutocomplete
  control={control}
  name="destination"
  id="destination"
  label="Destinazione"
  placeholder="Es. Roma, Italia"
  error={errors.destination?.message}
/>
```

Le chiamate a `<ParticipantRow ... />` non cambiano: il generico si inferisce dal `control` passato.

- [ ] **Step 4: Verifica che build e lint passino**

```bash
npm run lint && npm run build
```

Atteso: nessun errore, nessun `any` introdotto.

- [ ] **Step 5: Verifica manuale che `/crea` non sia cambiata**

Con `npm run dev`, su `/crea`:

1. Il campo Destinazione mostra ancora etichetta "Destinazione", icona e placeholder "Es. Roma, Italia".
2. Digitando almeno 3 caratteri compaiono i suggerimenti; le frecce su/giù li scorrono, Invio ne seleziona uno, Esc chiude l'elenco.
3. Nel pannello "Chi viaggia", cambiando il tipo di un partecipante l'età si azzera e il menu delle età mostra la fascia corretta.
4. Aggiunta e rimozione di un partecipante funzionano come prima.

- [ ] **Step 6: Commit**

```bash
git add components/itinerary-form && git commit -m "refactor: campo luogo e riga viaggiatore riutilizzabili da altri form"
```

---

## Task 9: Form di `/scopri`

**Files:**
- Create: `app/scopri/page.tsx`
- Create: `components/discover-trips/discover-form.tsx`

**Interfaces:**
- Consumes: `VACATION_TYPES`, `VACATION_TYPE_LABELS` da `lib/discover-trips-request.ts`; `DestinationAutocomplete` e `ParticipantRow` da Task 8; `TripProposal` da `lib/discover-trips-schema.ts`
- Produces: `discoverFormSchema` e `DiscoverFormValues` esportati da `components/discover-trips/discover-form.tsx`; il componente `<DiscoverForm />`

Lo schema del form vive accanto al form (non in `lib/schema.ts`) perché `lib/discover-trips-request.ts` è lo schema del *contratto di rete*, con le date già coerced: quello del form ha date opzionali finché l'utente non le sceglie, esattamente come `tripFormSchema` rispetto a `generateItineraryRequestSchema`.

In questo task il risultato non viene ancora disegnato: al termine della chiamata le proposte finiscono nello stato e si mostra un segnaposto testuale. La griglia arriva in Task 10. Questo mantiene il task testabile da solo.

- [ ] **Step 1: Crea la pagina**

Crea `app/scopri/page.tsx`, ricalcando l'intestazione di `app/crea/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DiscoverForm } from "@/components/discover-trips/discover-form";

export default function Scopri() {
  return (
    <div className="min-h-screen bg-secondary">
      <div className="sticky top-0 z-20 bg-secondary">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-5 sm:px-0">
          <Link
            href="/"
            className="font-display text-sm font-[725] tracking-[0.15em] whitespace-nowrap text-primary uppercase transition-opacity hover:opacity-70"
          >
            TripTailor
          </Link>
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-accent"
          >
            <ArrowLeft className="size-4 motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5" />
            Home
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-0">
        <DiscoverForm />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Crea il form**

Crea `components/discover-trips/discover-form.tsx`. Struttura da seguire, modellata su `itinerary-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Compass, Euro, Loader2, Plus, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { participantSchema, MAX_TRIP_DAYS } from "@/lib/schema";
import { VACATION_TYPES, VACATION_TYPE_LABELS, type VacationType } from "@/lib/discover-trips-request";
import type { TripProposal } from "@/lib/discover-trips-schema";
import type { ErrorCode } from "@/lib/generate-itinerary-errors";
import { DestinationAutocomplete } from "@/components/itinerary-form/destination-autocomplete";
import { ParticipantRow } from "@/components/itinerary-form/participant-row";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const discoverFormSchema = z.object({
  departureCity: z.string().trim().min(1, "Inserisci la città da cui parti"),
  dateRange: z
    .object({ from: z.date().optional(), to: z.date().optional() })
    .refine((range) => !!range.from && !!range.to, { message: "Seleziona le date di inizio e fine" })
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
  participants: z.array(participantSchema).min(1, "Aggiungi almeno un viaggiatore").max(20, "Massimo 20 viaggiatori"),
  budget: z.number().min(0),
  vacationType: z.enum(VACATION_TYPES).optional(),
});

export type DiscoverFormValues = z.infer<typeof discoverFormSchema>;

const defaultValues: DiscoverFormValues = {
  departureCity: "",
  dateRange: { from: undefined, to: undefined },
  participants: [{ type: "adulto", age: undefined }],
  budget: 1000,
};

const LOADING_MESSAGES = [
  "Confrontiamo le mete possibili…",
  "Stimiamo voli e alloggi…",
  "Scartiamo quelle fuori budget…",
  "Mettiamo in fila le proposte…",
];

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  network: "Non siamo riusciti a contattare il servizio. Controlla la connessione e riprova.",
  config: "Si è verificato un problema tecnico. Riprova tra poco.",
  rate_limit: "Troppe richieste in questo momento, riprova tra qualche secondo.",
  invalid_response: "Non siamo riusciti a trovare proposte. Riprova.",
};

const MAX_PARTICIPANTS = 20;
```

Stato e invio, per esteso. `submitted` conserva i valori inviati perché servono a Task 10 per costruire i link verso `/crea`. `isErrorCode` viene ricreata qui invece di essere importata da `itinerary-form.tsx`: sono cinque righe, e importarla accoppierebbe due form che non hanno altro in comune.

```tsx
function isErrorCode(value: unknown): value is ErrorCode {
  return (
    value === "network" ||
    value === "config" ||
    value === "rate_limit" ||
    value === "invalid_response"
  );
}

export function DiscoverForm() {
  const [mode, setMode] = useState<"form" | "loading" | "results">("form");
  const [proposals, setProposals] = useState<TripProposal[]>([]);
  const [submitted, setSubmitted] = useState<DiscoverFormValues | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DiscoverFormValues>({
    resolver: zodResolver(discoverFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "participants" });

  const onSubmit = async (values: DiscoverFormValues) => {
    setApiError(null);
    setMode("loading");

    try {
      const response = await fetch("/api/discover-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json();

      if (!response.ok) {
        const code = isErrorCode(body?.error) ? body.error : "invalid_response";
        setApiError(ERROR_MESSAGES[code]);
        setMode("form");
        return;
      }

      setProposals(body.proposals ?? []);
      setSubmitted(values);
      setMode("results");
    } catch {
      setApiError(ERROR_MESSAGES.network);
      setMode("form");
    }
  };
```

`apiError`, quando presente, si mostra sopra la CTA nella fascia che chiude la card, con lo stesso stile del messaggio di errore di `itinerary-form.tsx`.

Campi, nell'ordine, dentro una `Card` con la stessa struttura di `/crea`:

1. **Città di partenza** — `<DestinationAutocomplete control={control} name="departureCity" id="departure-city" label="Da dove parti" placeholder="Es. Milano, Italia" error={errors.departureCity?.message} />`
2. **Date del viaggio** — bottone compatto con `CalendarIcon` che apre un `Popover` con `<Calendar mode="range" />`, **senza etichetta sopra**, identico a `/crea`. Il testo del bottone è `"Quando parti"` se non ci sono date, altrimenti l'intervallo formattato con `format(date, "dd MMM")`.
3. **Chi viaggia** — bottone compatto con `Users` che apre un `Popover` con le `ParticipantRow`, **senza etichetta sopra**, identico a `/crea`.
4. **Budget** — etichetta `"Budget totale"`, `Slider` con `Euro`, stesso range e passo di `/crea`.
5. **Tipo di vacanza** — etichetta `"Che tipo di vacanza cerchi?"` con la precisazione `(facoltativo)`, resa come una fila di chip `rounded-full` selezionabili in modo esclusivo, uno per ogni voce di `VACATION_TYPES`, etichettati con `VACATION_TYPE_LABELS`. Cliccare il chip già attivo lo deseleziona, perché il campo è opzionale e deve poter tornare vuoto. Chip attivo: `bg-primary text-primary-foreground`; inattivo: `border border-border text-primary hover:bg-accent`.

**L'asimmetria delle etichette è deliberata e va rispettata:** Date e Chi viaggia non hanno etichetta sopra, tutti gli altri campi sì. È la stessa scelta già fatta in `/crea` e documentata in `CLAUDE.md` — non "correggerla".

La CTA vive in una fascia `bg-secondary` che chiude la card, come in `/crea`, con testo `"Trova i miei viaggi"` e `Loader2` rotante durante il caricamento.

In modalità `"results"`, per ora:

```tsx
<p>Trovate {proposals.length} proposte.</p>
<Button variant="outline" onClick={() => setMode("form")}>Modifica</Button>
```

- [ ] **Step 3: Verifica che build e lint passino**

```bash
npm run lint && npm run build
```

Atteso: nessun errore.

- [ ] **Step 4: Verifica manuale nel browser**

Con `npm run dev`, su `/scopri`:

1. Inviare il form vuoto mostra gli errori di validazione su partenza, date e età del viaggiatore.
2. L'autocomplete della città di partenza propone suggerimenti dopo 3 caratteri.
3. I chip del tipo di vacanza si selezionano e si deselezionano; se ne può tenere attivo al massimo uno.
4. Con dati validi compare il caricamento e poi il conteggio delle proposte.
5. "Modifica" riporta al form con i dati ancora compilati.
6. La pagina è leggibile a 375px di larghezza.

- [ ] **Step 5: Commit**

```bash
git add app/scopri components/discover-trips && git commit -m "feat: form di /scopri per cercare viaggi partendo dal budget"
```

---

## Task 10: Griglia delle proposte

**Files:**
- Create: `components/discover-trips/proposal-card.tsx`
- Create: `components/discover-trips/discover-results.tsx`
- Modify: `components/discover-trips/discover-form.tsx` (sostituisce il segnaposto di Task 9)

**Interfaces:**
- Consumes: `TripProposal` da `lib/discover-trips-schema.ts`, `buildCreaHref` da `lib/crea-query-params.ts`, `Participant` da `lib/schema.ts`
- Produces: `<ProposalCard proposal={...} href={...} />` e `<DiscoverResults proposals={...} dateRange={...} participants={...} onEdit={...} />`

`DiscoverResults` riceve i singoli dati che le servono, **non** l'intero `DiscoverFormValues`: importare quel tipo da `discover-form.tsx`, che a sua volta importa `DiscoverResults`, creerebbe un ciclo di import senza alcun guadagno.

- [ ] **Step 1: Crea la scheda della singola proposta**

Crea `components/discover-trips/proposal-card.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight, Bed, MapPin, Plane, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TripProposal } from "@/lib/discover-trips-schema";

interface ProposalCardProps {
  proposal: TripProposal;
  href: string;
}

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function ProposalCard({ proposal, href }: ProposalCardProps) {
  const { costs } = proposal;

  return (
    <Card className="flex h-full flex-col border-border shadow-none">
      <CardContent className="flex flex-1 flex-col gap-4 pt-6">
        <div>
          <h3 className="font-display text-xl font-[725] tracking-[-0.01em] text-primary uppercase">
            {proposal.destination}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {proposal.country}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">{proposal.whyItFits}</p>

        <ul className="space-y-1.5 text-sm text-primary">
          {proposal.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-voltage" />
              {highlight}
            </li>
          ))}
        </ul>

        <dl className="mt-auto space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Plane className="size-4" />
              Volo ({euro.format(costs.flightsPerPerson)} a persona)
            </dt>
            <dd className="font-medium text-primary">{euro.format(costs.flightsTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Bed className="size-4" />
              Alloggio
            </dt>
            <dd className="font-medium text-primary">{euro.format(costs.lodgingTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="size-4" />
              Spese in loco
            </dt>
            <dd className="font-medium text-primary">{euro.format(costs.onSiteTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <dt className="font-semibold text-primary">Totale</dt>
            <dd className="font-display text-lg font-[725] text-primary">
              {euro.format(costs.total)}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          Stime indicative generate dall&apos;AI, non prezzi prenotabili.
        </p>

        <Button asChild variant="outline" className="w-full gap-2 border-primary shadow-none">
          <Link href={href}>
            Crea l&apos;itinerario
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Crea la griglia**

Crea `components/discover-trips/discover-results.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { buildCreaHref } from "@/lib/crea-query-params";
import type { TripProposal } from "@/lib/discover-trips-schema";
import type { Participant } from "@/lib/schema";
import { ProposalCard } from "./proposal-card";

interface DiscoverResultsProps {
  proposals: TripProposal[];
  dateRange: { from?: Date; to?: Date };
  participants: Participant[];
  onEdit: () => void;
}

export function DiscoverResults({
  proposals,
  dateRange,
  participants,
  onEdit,
}: DiscoverResultsProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-[725] tracking-[-0.01em] text-primary uppercase">
          {proposals.length > 0 ? "Dove puoi andare" : "Nessuna proposta"}
        </h2>
        <Button variant="outline" onClick={onEdit} className="border-primary shadow-none">
          Modifica la ricerca
        </Button>
      </div>

      {proposals.length === 0 ? (
        <p className="text-muted-foreground">
          Con questo budget non troviamo proposte per queste date. Prova ad alzare il budget, ad
          accorciare il viaggio o a spostare il periodo.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {proposals.map((proposal) => (
            <ProposalCard
              key={`${proposal.destination}-${proposal.country}`}
              proposal={proposal}
              href={buildCreaHref({
                destination: `${proposal.destination}, ${proposal.country}`,
                from: dateRange.from,
                to: dateRange.to,
                budget: proposal.costs.total,
                participants,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Nota sul budget passato a `/crea`: si passa il **totale della proposta**, non il budget originale dell'utente. Il generatore di itinerari userà quel numero per calibrare le attività, e il totale della proposta è ciò che l'utente ha accettato di spendere per quella meta.

- [ ] **Step 3: Sostituisci il segnaposto nel form**

In `components/discover-trips/discover-form.tsx`, al posto del blocco testuale di Task 9:

```tsx
{mode === "results" && submitted && (
  <DiscoverResults
    proposals={proposals}
    dateRange={submitted.dateRange}
    participants={submitted.participants}
    onEdit={() => setMode("form")}
  />
)}
```

- [ ] **Step 4: Verifica che build e lint passino**

```bash
npm run lint && npm run build
```

Atteso: nessun errore.

- [ ] **Step 5: Verifica manuale nel browser**

Con `npm run dev`, su `/scopri`, con una ricerca reale:

1. Le schede mostrano meta, paese, motivo, tre punti salienti e i quattro importi.
2. Il totale di ogni scheda è uguale alla somma dei tre importi sopra di esso.
3. Nessun totale supera il budget indicato nel form.
4. La riga sulle stime è leggibile, non un grigio smorto.
5. "Crea l'itinerario" apre `/crea` con destinazione, date, budget e viaggiatori già compilati, e da lì l'itinerario si genera davvero.
6. La griglia passa a una colonna sotto i 640px e le schede restano allineate in altezza sopra.
7. Con un budget volutamente basso (es. 100€ per 5 giorni) compare il messaggio di nessuna proposta, non una griglia vuota.

- [ ] **Step 6: Commit**

```bash
git add components/discover-trips && git commit -m "feat: griglia delle proposte con la ripartizione dei costi"
```

---

## Task 11: Landing

**Files:**
- Create: `components/landing/reverse-search.tsx`
- Modify: `app/page.tsx`
- Modify: `components/landing/hero.tsx:56-68` (il blocco delle CTA)
- Modify: `components/landing/how-it-works.tsx:60-63` (il sottotitolo)
- Modify: `components/landing/site-nav.tsx:10-14` (`NAV_LINKS`)

**Interfaces:**
- Produces: `<ReverseSearch />`, sezione con `id="scopri"`

- [ ] **Step 1: Crea la sezione**

Crea `components/landing/reverse-search.tsx`, seguendo le convenzioni delle sezioni esistenti (`scroll-mt-20`, reveal on-scroll, `useReducedMotion`). La sezione precedente (`HowItWorks`) ha sfondo `bg-secondary`, quindi questa usa lo sfondo Canvas di default per mantenere l'alternanza:

```tsx
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReverseSearch() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="scopri" className="scroll-mt-20 px-4 py-16 sm:px-8 sm:py-24">
      <motion.div
        className="mx-auto max-w-5xl"
        initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <span className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          E se non sai dove andare
        </span>
        <h2 className="mt-3 font-display text-3xl font-[725] tracking-[-0.01em] text-primary uppercase sm:text-5xl">
          Parti dal budget, non dalla meta.
        </h2>
        <p className="mt-4 max-w-xl text-balance text-muted-foreground">
          Dicci quanto vuoi spendere, quando parti, da dove e con chi. Ti proponiamo cinque viaggi
          possibili, ognuno con la stima di volo, alloggio e spese sul posto: scegli quello che ti
          convince e da lì costruiamo l&apos;itinerario.
        </p>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="mt-8 gap-2 border-primary px-8 shadow-none has-[>svg]:px-8"
        >
          <Link href="/scopri">
            <Compass className="size-4" />
            Scopri dove puoi andare
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Montala nella pagina**

In `app/page.tsx`, importa `ReverseSearch` e inseriscila **tra `<HowItWorks />` e `<FinalCta />`**.

- [ ] **Step 3: Aggiungi il secondo ingresso nell'hero**

In `components/landing/hero.tsx`, dentro il `motion.div` delle CTA, aggiungi un bottone secondario **dopo** quello primario e **prima** del link "Guarda come funziona":

```tsx
<Button asChild size="lg" variant="outline" className="gap-2 border-primary px-8 shadow-none has-[>svg]:px-8">
  <Link href="/scopri">Non so dove andare</Link>
</Button>
```

Il bottone primario resta l'unico elemento con il Sole.

- [ ] **Step 4: Raccorda "Come funziona"**

In `components/landing/how-it-works.tsx`, sostituisci il paragrafo sotto il titolo:

```tsx
<p className="mt-3 text-muted-foreground">
  Dal racconto del tuo viaggio all&apos;itinerario pronto, in quattro passi. Vale se la meta ce
  l&apos;hai già in mente: se non ce l&apos;hai, si parte dal budget.
</p>
```

I quattro passi e la numerazione **non si toccano**.

- [ ] **Step 5: Aggiungi la voce di navigazione**

In `components/landing/site-nav.tsx`, aggiungi a `NAV_LINKS`, in ultima posizione:

```tsx
{ id: "scopri", label: "Dal budget" },
```

L'etichetta è volutamente corta: le voci sono a `text-xs` con `gap-0.5` sotto i 640px e la barra ospita anche logo e bottone.

- [ ] **Step 6: Verifica che build e lint passino**

```bash
npm run lint && npm run build
```

Atteso: nessun errore.

- [ ] **Step 7: Verifica manuale nel browser**

Con `npm run dev`, sulla home:

1. L'hero mostra due bottoni: solo il primo è giallo Sole.
2. La nuova sezione compare tra "Come funziona" e la CTA finale, con l'alternanza chiaro/scuro coerente rispetto alle sezioni adiacenti.
3. La quarta voce della nav non manda a capo né sovrappone il logo a 375px di larghezza. **Se la barra si rompe, la correzione è nascondere la voce sotto `sm` con `hidden sm:inline-flex`, non accorciare le altre etichette.**
4. La voce "Dal budget" si evidenzia quando la sezione è a schermo (`IntersectionObserver` già presente).
5. Entrambi i percorsi funzionano: "Crea il tuo itinerario" → `/crea`, "Non so dove andare" e "Scopri dove puoi andare" → `/scopri`.
6. Con "riduci animazioni" attivo nel sistema operativo, la sezione compare senza animazione.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx components/landing && git commit -m "feat: la landing racconta anche il percorso che parte dal budget"
```

---

## Task 12: Aggiornamento della memoria di progetto

**Files:**
- Modify: `CLAUDE.md` (Sezione 1 — Project Snapshot)

Il file impone di aggiornare la Sezione 1 quando l'architettura cambia, e vieta di toccare le Sezioni 2-6.

- [ ] **Step 1: Aggiorna la Sezione 1**

Aggiungi alla struttura dei file le nuove route e i nuovi componenti, e una voce che descrive la funzionalità:

```
app/
  scopri/
    page.tsx             # intestazione sticky + <DiscoverForm>
  api/
    discover-trips/
      route.ts           # budget+viaggiatori+date+partenza → proposte costificate
components/
  discover-trips/
    discover-form.tsx    # form + stato + chiamata API
    discover-results.tsx # griglia delle proposte
    proposal-card.tsx    # scheda singola con ripartizione costi
  landing/
    reverse-search.tsx   # sezione landing sul percorso dal budget
lib/
  discover-trips-request.ts  # schema richiesta
  discover-trips-schema.ts   # schema risposta AI
  discover-trips-prompt.ts   # prompt (funzione pura)
  verify-proposal-budget.ts  # ricalcolo totali + filtro budget
  crea-query-params.ts       # prefill di /crea via query string
```

Aggiungi inoltre una riga alle convenzioni:

> Ricerca inversa (aggiunta 2026-08-18): `/scopri` chiede budget, viaggiatori, date e città di partenza — **mai la destinazione**, che è ciò che la funzionalità deve scoprire — e restituisce 5 proposte con stime AI di volo/alloggio/spese in loco. I totali sono ricalcolati e filtrati lato server (`verify-proposal-budget.ts`): il campo `total` restituito dal modello non è considerato attendibile. Ogni proposta rimanda a `/crea` precompilata. Le cifre sono stime dichiarate come tali nell'interfaccia, non prezzi prenotabili.

- [ ] **Step 2: Verifica che la suite completa sia verde**

```bash
npm test && npm run lint && npm run build
```

Atteso: tutti i test passano, nessun errore di lint, build completata.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md && git commit -m "docs: memoria di progetto aggiornata con la ricerca inversa"
```

---

## Verifica finale prima del merge

- [ ] `npm test` — tutta la suite verde, inclusi i circa 47 nuovi test
- [ ] `npm run lint` — pulito
- [ ] `npm run build` — completata senza errori
- [ ] `/crea` funziona esattamente come prima per chi arriva dalla landing o dalle mete gettonate
- [ ] Il percorso completo funziona end-to-end: home → `/scopri` → proposte → `/crea` precompilata → itinerario generato
