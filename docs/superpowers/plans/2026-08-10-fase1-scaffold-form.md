# Fase 1 — Scaffold Next.js + Form di input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold un progetto Next.js funzionante con un form responsive che raccoglie destinazione, date, composizione gruppo (età) e budget/stile, valida i dati e mostra un riepilogo modificabile — senza logica AI/meteo/calendario.

**Architecture:** App Next.js (App Router, TypeScript) 100% client-side, nessun backend. Un singolo componente `ItineraryForm` possiede lo stato del form (react-hook-form + zod) e uno stato `mode: "form" | "summary"`; al submit valido mostra `TripSummary` al posto del form, senza cambiare route.

**Tech Stack:** Next.js (App Router, TS), Tailwind CSS, shadcn/ui, react-hook-form, zod, @hookform/resolvers, date-fns, react-day-picker (via shadcn Calendar), Vitest (solo per `lib/schema.ts`).

## Global Constraints

- Package manager: **npm** (non usare pnpm/yarn).
- Nessuna API route / backend in questa fase: dati solo in stato React, nessuna persistenza.
- Layout form: **singola pagina**, nessun wizard multi-step.
- Composizione gruppo: righe dinamiche per partecipante (tipo adulto/bambino + età), non conteggio semplice.
- Date viaggio: date range picker (check-in/check-out), non "numero di giorni".
- Budget: slider in € + campo note testuali libere per lo stile — non selezione a card.
- Riepilogo post-submit: **stessa pagina** (il form si trasforma in riepilogo), bottone "Modifica" torna al form con i dati precompilati. Nessuna route separata.
- Validazione: destinazione obbligatoria; data fine ≥ data inizio; almeno 1 partecipante; età ≥ 0.
- `.env.local` / `.env.local.example` contengono solo placeholder per `ANTHROPIC_API_KEY`, `OPENWEATHER_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — nessuna integrazione è attiva in questa fase.
- Il nome progetto **"App Itinerari" è provvisorio** — non hardcodarlo come titolo definitivo nell'app (usare un titolo neutro come "Pianifica il tuo viaggio").
- Fuori scope: generazione itinerario AI, meteo, export calendario, app mobile.

---

### Task 1: Scaffold progetto Next.js + variabili d'ambiente

**Files:**
- Create: intero scaffold Next.js (`package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, ecc. — generati da `create-next-app`)
- Create: `.env.local`
- Create: `.env.local.example`

**Interfaces:**
- Produces: progetto Next.js avviabile con `npm run dev`; repo git inizializzato con un primo commit.

- [ ] **Step 1: Sposta temporaneamente i file esistenti**

La cartella contiene già `CLAUDE.md` e `docs/`; `create-next-app` richiede una directory vuota (o quasi). Spostali temporaneamente fuori dal progetto:

```bash
mkdir -p ../_scaffold-backup
mv CLAUDE.md ../_scaffold-backup/
mv docs ../_scaffold-backup/
```

- [ ] **Step 2: Genera lo scaffold Next.js**

```bash
npx --yes create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --no-git --use-npm
```

Se il comando chiede conferme interattive (es. Turbopack), rispondi con i default proposti.

- [ ] **Step 3: Ripristina i file spostati**

```bash
mv ../_scaffold-backup/CLAUDE.md .
mv ../_scaffold-backup/docs .
rmdir ../_scaffold-backup
```

- [ ] **Step 4: Crea i file di variabili d'ambiente**

`.env.local.example`:
```
ANTHROPIC_API_KEY=
OPENWEATHER_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`.env.local` (stesso contenuto — è già ignorato da `.gitignore` generato da `create-next-app`, che include `.env*.local`):
```
ANTHROPIC_API_KEY=
OPENWEATHER_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 5: Verifica che il progetto parta**

```bash
npm run dev
```

Apri `http://localhost:3000`: deve mostrare la pagina di default di Next.js senza errori in console. Ferma il server (Ctrl+C).

- [ ] **Step 6: Inizializza git e crea il primo commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project"
```

---

### Task 2: Setup shadcn/ui e componenti necessari

**Files:**
- Create: `components.json` (config shadcn)
- Create: `lib/utils.ts` (helper `cn`, generato da shadcn)
- Create: `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/card.tsx`, `components/ui/popover.tsx`, `components/ui/calendar.tsx`, `components/ui/slider.tsx`
- Modify: `package.json` (nuove dipendenze: radix-ui primitives, class-variance-authority, react-day-picker, date-fns, lucide-react, ecc.)

**Interfaces:**
- Consumes: progetto Next.js da Task 1.
- Produces: componenti UI in `@/components/ui/*` e helper `cn` in `@/lib/utils`, usati da Task 4 e Task 5.

- [ ] **Step 1: Inizializza shadcn/ui**

```bash
npx --yes shadcn@latest init -y -b neutral
```

Se il comando chiede conferme interattive, rispondi: TypeScript = sì, stile = New York (o default), colore base = Neutral, CSS variables = sì.

- [ ] **Step 2: Aggiungi i componenti necessari al form**

```bash
npx --yes shadcn@latest add button input label card popover calendar slider
```

- [ ] **Step 3: Verifica che il progetto compili ancora**

```bash
npm run build
```

Expected: build completata senza errori (la homepage di default non usa ancora i nuovi componenti, ma devono compilare).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add shadcn/ui components"
```

---

### Task 3: Schema di validazione (zod) con test

**Files:**
- Create: `lib/schema.ts`
- Create: `lib/schema.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (aggiunge `vitest` come devDependency e script `test`)

**Interfaces:**
- Produces: `tripFormSchema` (zod schema), `TripFormValues` (tipo inferito), `Participant` (tipo inferito), tutti esportati da `@/lib/schema`. Usati da Task 4 e Task 5.

- [ ] **Step 1: Installa Vitest e aggiungi lo script di test**

```bash
npm install -D vitest
```

Aggiungi in `package.json` dentro `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 2: Crea la config di Vitest**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Scrivi i test (falliranno perché lo schema non esiste ancora)**

`lib/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { tripFormSchema } from "./schema";

const baseValid = {
  destination: "Roma",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-05") },
  participants: [{ type: "adulto" as const, age: 35 }],
  budget: 1000,
  styleNotes: "",
};

describe("tripFormSchema", () => {
  it("accetta un viaggio valido", () => {
    const result = tripFormSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("rifiuta una destinazione vuota", () => {
    const result = tripFormSchema.safeParse({ ...baseValid, destination: "" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un viaggio senza date selezionate", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: undefined, to: undefined },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta una data di fine precedente alla data di inizio", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      dateRange: { from: new Date("2026-09-05"), to: new Date("2026-09-01") },
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta zero partecipanti", () => {
    const result = tripFormSchema.safeParse({ ...baseValid, participants: [] });
    expect(result.success).toBe(false);
  });

  it("rifiuta un'età negativa", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      participants: [{ type: "adulto", age: -1 }],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Esegui i test e verifica che falliscano**

```bash
npm test
```

Expected: FAIL — `Cannot find module './schema'` (o simile).

- [ ] **Step 5: Implementa lo schema**

`lib/schema.ts`:
```ts
import { z } from "zod";

export const participantSchema = z.object({
  type: z.enum(["adulto", "bambino"]),
  age: z.coerce.number().int().min(0, "L'età non può essere negativa"),
});

export const tripFormSchema = z.object({
  destination: z.string().trim().min(1, "Inserisci una destinazione"),
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
    }),
  participants: z.array(participantSchema).min(1, "Aggiungi almeno un partecipante"),
  budget: z.number().min(0),
  styleNotes: z.string().optional(),
});

export type TripFormValues = z.infer<typeof tripFormSchema>;
export type Participant = z.infer<typeof participantSchema>;
```

- [ ] **Step 6: Esegui i test e verifica che passino**

```bash
npm test
```

Expected: PASS — tutti i 6 test verdi.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add trip form validation schema"
```

---

### Task 4: Form principale (destinazione, date, gruppo, budget)

**Files:**
- Create: `components/itinerary-form/participant-row.tsx`
- Create: `components/itinerary-form/itinerary-form.tsx`
- Modify: `app/page.tsx` (renderizza `<ItineraryForm />`)
- Modify: `package.json` (aggiunge `react-hook-form`, `@hookform/resolvers`, `date-fns`)

**Interfaces:**
- Consumes: `tripFormSchema`, `TripFormValues` da `@/lib/schema` (Task 3); `Button`, `Input`, `Label`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Popover`, `PopoverTrigger`, `PopoverContent`, `Calendar`, `Slider` da `@/components/ui/*` (Task 2); `cn` da `@/lib/utils` (Task 2).
- Produces: componente `ItineraryForm` esportato da `@/components/itinerary-form/itinerary-form` — usato da Task 5 (che vi aggiunge il riepilogo) e da `app/page.tsx`.
  - `ParticipantRow` props: `{ index: number; register: UseFormRegister<TripFormValues>; onRemove: () => void; canRemove: boolean }`.

- [ ] **Step 1: Installa le dipendenze del form**

```bash
npm install react-hook-form @hookform/resolvers date-fns
```

- [ ] **Step 2: Crea il componente riga partecipante**

`components/itinerary-form/participant-row.tsx`:
```tsx
"use client";

import type { UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TripFormValues } from "@/lib/schema";

interface ParticipantRowProps {
  index: number;
  register: UseFormRegister<TripFormValues>;
  onRemove: () => void;
  canRemove: boolean;
}

export function ParticipantRow({ index, register, onRemove, canRemove }: ParticipantRowProps) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <Label htmlFor={`participants.${index}.type`}>Tipo</Label>
        <select
          id={`participants.${index}.type`}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          {...register(`participants.${index}.type` as const)}
        >
          <option value="adulto">Adulto</option>
          <option value="bambino">Bambino</option>
        </select>
      </div>
      <div className="w-24">
        <Label htmlFor={`participants.${index}.age`}>Età</Label>
        <Input
          id={`participants.${index}.age`}
          type="number"
          min={0}
          {...register(`participants.${index}.age` as const, { valueAsNumber: true })}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="Rimuovi partecipante"
      >
        ×
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Crea il form principale**

`components/itinerary-form/itinerary-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { tripFormSchema, type TripFormValues } from "@/lib/schema";
import { ParticipantRow } from "./participant-row";

const defaultValues: TripFormValues = {
  destination: "",
  dateRange: { from: undefined, to: undefined },
  participants: [{ type: "adulto", age: 30 }],
  budget: 1000,
  styleNotes: "",
};

export function ItineraryForm() {
  const [submittedData, setSubmittedData] = useState<TripFormValues | null>(null);

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

  const onSubmit = (data: TripFormValues) => {
    setSubmittedData(data);
  };

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Pianifica il tuo viaggio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="destination">Destinazione</Label>
            <Input id="destination" placeholder="Es. Roma, Italia" {...register("destination")} />
            {errors.destination && (
              <p className="text-sm text-red-600">{errors.destination.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Date del viaggio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
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

          <div className="space-y-3">
            <Label>Composizione gruppo</Label>
            {fields.map((field, index) => (
              <ParticipantRow
                key={field.id}
                index={index}
                register={register}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ type: "adulto", age: 30 })}
            >
              + Aggiungi persona
            </Button>
            {errors.participants && !Array.isArray(errors.participants) && (
              <p className="text-sm text-red-600">{errors.participants.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget indicativo: {budget}€</Label>
            <Slider
              id="budget"
              min={0}
              max={10000}
              step={100}
              value={[budget]}
              onValueChange={([value]) => setValue("budget", value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="styleNotes">Note sullo stile di viaggio</Label>
            <Input
              id="styleNotes"
              placeholder="Es. lusso, economico, avventura..."
              {...register("styleNotes")}
            />
          </div>

          <Button type="submit" className="w-full">
            Genera itinerario
          </Button>
        </form>

        {submittedData && (
          <pre className="mt-6 overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(submittedData, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Renderizza il form nella pagina**

Modifica `app/page.tsx` così:
```tsx
import { ItineraryForm } from "@/components/itinerary-form/itinerary-form";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <ItineraryForm />
    </main>
  );
}
```

- [ ] **Step 5: Verifica manuale nel browser**

```bash
npm run dev
```

Apri `http://localhost:3000` e verifica:
- Il form appare con tutti i campi (destinazione, date, gruppo, budget, note).
- Cliccando "Genera itinerario" senza compilare nulla, compaiono i messaggi di errore (destinazione obbligatoria, date obbligatorie).
- "+ Aggiungi persona" aggiunge una riga; il bottone di rimozione è disabilitato quando resta 1 sola riga.
- Selezionando un intervallo di date valido, compilando destinazione e partecipanti, il submit mostra il JSON dei dati sotto al form.

Ferma il server (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add itinerary input form"
```

---

### Task 5: Riepilogo viaggio e toggle form/riepilogo

**Files:**
- Create: `components/itinerary-form/trip-summary.tsx`
- Modify: `components/itinerary-form/itinerary-form.tsx`

**Interfaces:**
- Consumes: `TripFormValues` da `@/lib/schema` (Task 3); `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle` da `@/components/ui/*` (Task 2).
- Produces: componente `TripSummary` esportato da `@/components/itinerary-form/trip-summary`, props `{ data: TripFormValues; onEdit: () => void }`.

- [ ] **Step 1: Crea il componente di riepilogo**

`components/itinerary-form/trip-summary.tsx`:
```tsx
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripFormValues } from "@/lib/schema";

interface TripSummaryProps {
  data: TripFormValues;
  onEdit: () => void;
}

export function TripSummary({ data, onEdit }: TripSummaryProps) {
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Riepilogo viaggio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Destinazione</p>
          <p className="font-medium">{data.destination}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Date</p>
          <p className="font-medium">
            {data.dateRange.from && data.dateRange.to
              ? `${format(data.dateRange.from, "dd/MM/yyyy")} - ${format(data.dateRange.to, "dd/MM/yyyy")}`
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Partecipanti</p>
          <ul className="list-inside list-disc font-medium">
            {data.participants.map((p, i) => (
              <li key={i}>
                {p.type === "adulto" ? "Adulto" : "Bambino"}, {p.age} anni
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Budget indicativo</p>
          <p className="font-medium">{data.budget}€</p>
        </div>
        {data.styleNotes && (
          <div>
            <p className="text-sm text-muted-foreground">Note sullo stile</p>
            <p className="font-medium">{data.styleNotes}</p>
          </div>
        )}
        <Button type="button" variant="outline" onClick={onEdit} className="w-full">
          Modifica
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Aggiungi lo stato `mode` e collega il riepilogo**

In `components/itinerary-form/itinerary-form.tsx`:

1. Aggiungi l'import:
```tsx
import { TripSummary } from "./trip-summary";
```

2. Sostituisci
```tsx
export function ItineraryForm() {
  const [submittedData, setSubmittedData] = useState<TripFormValues | null>(null);
```
con
```tsx
export function ItineraryForm() {
  const [mode, setMode] = useState<"form" | "summary">("form");
  const [submittedData, setSubmittedData] = useState<TripFormValues | null>(null);
```

3. Sostituisci
```tsx
  const onSubmit = (data: TripFormValues) => {
    setSubmittedData(data);
  };
```
con
```tsx
  const onSubmit = (data: TripFormValues) => {
    setSubmittedData(data);
    setMode("summary");
  };

  const handleEdit = () => {
    setMode("form");
  };
```

4. Subito dopo la chiusura della graffa di `onSubmit`/`handleEdit` (prima del `return`), aggiungi:
```tsx
  if (mode === "summary" && submittedData) {
    return <TripSummary data={submittedData} onEdit={handleEdit} />;
  }
```

5. Rimuovi il blocco finale che mostrava il JSON grezzo:
```tsx
        {submittedData && (
          <pre className="mt-6 overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(submittedData, null, 2)}
          </pre>
        )}
```
(elimina queste righe da dentro `<CardContent>`, restano solo `<form>...</form>`).

- [ ] **Step 3: Verifica manuale nel browser**

```bash
npm run dev
```

Apri `http://localhost:3000` e verifica:
- Compilando il form correttamente e cliccando "Genera itinerario", il form scompare e appare il riepilogo con tutti i dati corretti (destinazione, date formattate, elenco partecipanti, budget, note).
- Cliccando "Modifica", si torna al form con **tutti i valori precompilati** come inseriti prima (nessun dato perso).
- L'URL resta `http://localhost:3000` in entrambe le fasi (nessuna navigazione).

Ferma il server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add trip summary view with edit toggle"
```

---

### Task 6: Metadata pagina e verifica responsive finale

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: nessuna nuova interfaccia — task di rifinitura e verifica end-to-end.

- [ ] **Step 1: Aggiorna i metadata della pagina**

Modifica `app/layout.tsx` impostando title/description neutri (il nome progetto è provvisorio, non va hardcodato):
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pianifica il tuo viaggio",
  description: "Crea itinerari di viaggio personalizzati in pochi passi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verifica end-to-end desktop + mobile**

```bash
npm run dev
```

Apri `http://localhost:3000` negli strumenti sviluppatore del browser:
- A larghezza desktop (≥1024px): il form è centrato, leggibile, nessun overflow orizzontale.
- A larghezza mobile (~375px): tutti i campi restano usabili, il date range picker è utilizzabile a schermo intero, i bottoni non sono tagliati.
- Ripeti il flusso completo: compila → submit → riepilogo → "Modifica" → dati intatti nel form.

Ferma il server (Ctrl+C).

- [ ] **Step 3: Verifica finale build + test**

```bash
npm run build
npm test
```

Expected: entrambi i comandi completano senza errori.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: finalize page metadata and verify responsive layout"
```
