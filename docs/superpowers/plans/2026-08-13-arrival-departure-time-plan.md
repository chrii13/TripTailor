# Orario di Arrivo/Partenza Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere due campi opzionali al form — orario di arrivo e orario di partenza — che, se compilati, vengono usati dall'AI per calibrare in modo più realistico il primo e l'ultimo giorno dell'itinerario generato.

**Architecture:** Due campi stringa opzionali (`arrivalTime`, `departureTime`, formato `"HH:MM"`) attraversano l'intera pipeline esistente senza cambiarne la forma: schema del form → schema della richiesta API → prompt builder. Nessun nuovo endpoint, nessuna nuova dipendenza. La UI li espone come due `<input type="time">` dentro il popover "Date del viaggio" già esistente.

**Tech Stack:** Next.js (App Router, TypeScript), react-hook-form, zod, Tailwind/shadcn (componenti `Input`/`Label` già esistenti).

## Global Constraints

- Entrambi i campi sono **opzionali**, default `""` lato form — nessuna frizione per chi non li compila.
- **Nessuna validazione con regex**: si segue il pattern già usato per `styleNotes` (stringa opzionale, controllo di verità `if (value) {...}` dove serve), dato che `<input type="time">` garantisce già il formato `HH:MM` in condizioni normali d'uso.
- `itinerary-result.tsx` **non va modificato**: gli orari servono solo a guidare la generazione, non vanno mostrati nel riepilogo.
- Se il viaggio dura un solo giorno (`from === to`), entrambe le istruzioni (arrivo e partenza) si applicano allo stesso giorno — nessuna gestione speciale nel codice, è una conseguenza naturale di avere due istruzioni indipendenti nel prompt.
- Segui lo stile e le convenzioni già presenti nei file toccati (vedi codice esistente in ogni task).

---

### Task 1: Campi dati (schema form + schema richiesta API)

**Files:**
- Modify: `lib/schema.ts`
- Modify: `lib/generate-itinerary-request.ts`
- Test: `lib/schema.test.ts`
- Test: `lib/generate-itinerary-request.test.ts`

**Interfaces:**
- Produces: `TripFormValues.arrivalTime?: string`, `TripFormValues.departureTime?: string` (da `lib/schema.ts`, usati da Task 3). `GenerateItineraryRequest.arrivalTime?: string`, `GenerateItineraryRequest.departureTime?: string` (da `lib/generate-itinerary-request.ts`, usati da Task 2).

- [ ] **Step 1: Scrivi i test falliti per `tripFormSchema`**

Apri `lib/schema.test.ts` e aggiungi questi due test dentro il blocco `describe("tripFormSchema", ...)`, subito prima della riga `});` che lo chiude (dopo il test `"accetta un viaggio di esattamente 14 giorni"`):

```ts
  it("accetta un viaggio con orario di arrivo e partenza", () => {
    const result = tripFormSchema.safeParse({
      ...baseValid,
      arrivalTime: "15:30",
      departureTime: "09:00",
    });
    expect(result.success).toBe(true);
  });

  it("accetta un viaggio senza orario di arrivo/partenza (campi opzionali)", () => {
    const result = tripFormSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.arrivalTime).toBeUndefined();
      expect(result.data.departureTime).toBeUndefined();
    }
  });
```

- [ ] **Step 2: Esegui i test e verifica che passino già o fallizzino per il motivo giusto**

Run: `npm test -- lib/schema.test.ts`

Expected: i due nuovi test PASSANO comunque, perché Zod ignora per default le chiavi non dichiarate nello schema — quindi non è un "fallimento" nel senso stretto, ma serve comunque a verificare cosa succede prima della modifica. Se invece uno dei due test fallisce con un errore di validazione inatteso, fermati e controlla `baseValid` in cima al file.

- [ ] **Step 3: Aggiungi i campi a `tripFormSchema`**

In `lib/schema.ts`, nell'oggetto passato a `z.object({...})` per `tripFormSchema`, subito dopo la riga `styleNotes: z.string().optional(),` (riga 61) aggiungi:

```ts
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
```

Il blocco risultante (righe 38-62 circa) deve essere:

```ts
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
    })
    .refine(
      (range) => {
        if (!range.from || !range.to) return true;
        const days = Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY) + 1;
        return days <= MAX_TRIP_DAYS;
      },
      { message: `Il viaggio non può superare i ${MAX_TRIP_DAYS} giorni` }
    ),
  participants: z.array(participantSchema).min(1, "Aggiungi almeno un partecipante"),
  budget: z.number().min(0),
  styleNotes: z.string().optional(),
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
});
```

- [ ] **Step 4: Esegui di nuovo i test di `schema.test.ts` e verifica che passino**

Run: `npm test -- lib/schema.test.ts`
Expected: PASS (tutti i test, inclusi i due nuovi che ora verificano esplicitamente i campi dichiarati).

- [ ] **Step 5: Scrivi il test per `generateItineraryRequestSchema`**

Apri `lib/generate-itinerary-request.test.ts` e aggiungi, subito prima dell'ultima riga `});` che chiude il `describe`:

```ts
  it("accetta un corpo con orario di arrivo e partenza e li passa invariati", () => {
    const result = generateItineraryRequestSchema.safeParse({
      ...baseValidBody,
      arrivalTime: "15:30",
      departureTime: "09:00",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.arrivalTime).toBe("15:30");
      expect(result.data.departureTime).toBe("09:00");
    }
  });
```

- [ ] **Step 6: Aggiungi i campi a `generateItineraryRequestSchema`**

In `lib/generate-itinerary-request.ts`, subito dopo la riga `styleNotes: z.string().max(1000).optional(),` (riga 25) aggiungi:

```ts
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
```

Il blocco `generateItineraryRequestSchema` risultante deve essere:

```ts
export const generateItineraryRequestSchema = z.object({
  destination: z.string().trim().min(1).max(200),
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
  styleNotes: z.string().max(1000).optional(),
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
});
```

- [ ] **Step 7: Esegui i test e verifica che passino**

Run: `npm test -- lib/generate-itinerary-request.test.ts`
Expected: PASS.

- [ ] **Step 8: Esegui l'intera suite per assicurarti di non aver rotto nulla**

Run: `npm test`
Expected: tutti i test passano (nessuna regressione).

- [ ] **Step 9: Commit**

```bash
git add lib/schema.ts lib/generate-itinerary-request.ts lib/schema.test.ts lib/generate-itinerary-request.test.ts
git commit -m "feat: add optional arrival/departure time fields to trip schema"
```

---

### Task 2: Istruzioni nel prompt AI

**Files:**
- Modify: `lib/itinerary-prompt.ts`
- Test: `lib/itinerary-prompt.test.ts`

**Interfaces:**
- Consumes: `GenerateItineraryRequest.arrivalTime?: string`, `GenerateItineraryRequest.departureTime?: string` (da Task 1).
- Produces: nessuna nuova interfaccia esportata — `buildItineraryPrompt` mantiene la stessa firma `(request: GenerateItineraryRequest, climate: DailyClimateAverage[] | null) => string`, usata da Task 3 indirettamente (tramite la route API, non toccata da questo piano).

- [ ] **Step 1: Scrivi i test falliti in `lib/itinerary-prompt.test.ts`**

Aggiungi questi quattro test dentro il blocco `describe("buildItineraryPrompt", ...)`, subito prima dell'ultima riga `});` che lo chiude:

```ts
  it("include l'istruzione di orario di arrivo quando presente", () => {
    const request: GenerateItineraryRequest = { ...baseRequest, arrivalTime: "15:30" };
    const prompt = buildItineraryPrompt(request, null);
    expect(prompt).toContain("15:30");
    expect(prompt).toContain("non pianificare attività prima di quell'orario");
  });

  it("include l'istruzione di orario di partenza quando presente", () => {
    const request: GenerateItineraryRequest = { ...baseRequest, departureTime: "09:00" };
    const prompt = buildItineraryPrompt(request, null);
    expect(prompt).toContain("09:00");
    expect(prompt).toContain("concludi le attività con un margine ragionevole");
  });

  it("non include alcuna istruzione di arrivo/partenza quando i campi sono assenti", () => {
    const prompt = buildItineraryPrompt(baseRequest, null);
    expect(prompt).not.toContain("arriva a destinazione");
    expect(prompt).not.toContain("riparte");
  });

  it("include entrambe le istruzioni quando il viaggio dura un solo giorno", () => {
    const request: GenerateItineraryRequest = {
      ...baseRequest,
      dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-01") },
      arrivalTime: "10:00",
      departureTime: "20:00",
    };
    const prompt = buildItineraryPrompt(request, null);
    expect(prompt).toContain("10:00");
    expect(prompt).toContain("20:00");
  });
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- lib/itinerary-prompt.test.ts`
Expected: FAIL sui 4 nuovi test (il testo delle istruzioni non esiste ancora nel prompt generato).

- [ ] **Step 3: Aggiungi la logica al prompt builder**

In `lib/itinerary-prompt.ts`, cambia la riga di destructuring (riga 10):

```ts
  const { destination, dateRange, participants, budget, styleNotes } = request;
```

in:

```ts
  const { destination, dateRange, participants, budget, styleNotes, arrivalTime, departureTime } = request;
```

Poi, subito dopo il blocco `participantsList` (dopo la riga che chiude `.join("\n");` per `participantsList`, prima della definizione di `climateSection`), aggiungi:

```ts
  const arrivalDepartureLines: string[] = [];
  if (arrivalTime) {
    arrivalDepartureLines.push(
      `Il viaggiatore arriva a destinazione il primo giorno (${format(dateRange.from, "dd/MM/yyyy")}) alle ${arrivalTime}: non pianificare attività prima di quell'orario, lasciando un margine ragionevole per il trasferimento e il check-in in alloggio.`
    );
  }
  if (departureTime) {
    arrivalDepartureLines.push(
      `Il viaggiatore riparte l'ultimo giorno (${format(dateRange.to, "dd/MM/yyyy")}) alle ${departureTime}: concludi le attività con un margine ragionevole prima di quell'orario, per il rientro verso aeroporto/stazione.`
    );
  }
  const arrivalDepartureSection =
    arrivalDepartureLines.length > 0 ? `\n${arrivalDepartureLines.join("\n")}\n` : "";
```

Infine, nel template literal ritornato dalla funzione, subito dopo la riga `${styleNotes ? \`Note sullo stile di viaggio: ${styleNotes}\` : ""}` e prima di `${climateSection}`, aggiungi `${arrivalDepartureSection}` su una riga propria. Il blocco del template diventa:

```
${participantsList}
${styleNotes ? `Note sullo stile di viaggio: ${styleNotes}` : ""}
${arrivalDepartureSection}
${climateSection}
Genera un piano giorno per giorno, ...
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- lib/itinerary-prompt.test.ts`
Expected: PASS (tutti i test, inclusi i 4 nuovi e quelli preesistenti).

- [ ] **Step 5: Esegui l'intera suite**

Run: `npm test`
Expected: tutti i test passano.

- [ ] **Step 6: Commit**

```bash
git add lib/itinerary-prompt.ts lib/itinerary-prompt.test.ts
git commit -m "feat: use arrival/departure time to calibrate first and last day in the AI prompt"
```

---

### Task 3: Campi nel form (UI)

**Files:**
- Modify: `components/itinerary-form/itinerary-form.tsx`

**Interfaces:**
- Consumes: `TripFormValues.arrivalTime?: string`, `TripFormValues.departureTime?: string` (da Task 1), tramite `register("arrivalTime")` / `register("departureTime")` di react-hook-form (`register` è già distrutto da `useForm` in questo file).

Questo file non ha test automatici dedicati (nessun componente del form ha test unitari in questo progetto — la verifica di UI/comportamento AI è sempre manuale nel browser, stesso principio già seguito per le fasi precedenti). La verifica di questo task è quindi: build/lint puliti + verifica manuale end-to-end.

- [ ] **Step 1: Aggiungi i due campi ai `defaultValues`**

In `components/itinerary-form/itinerary-form.tsx`, l'oggetto `defaultValues` (righe 26-32) diventa:

```ts
const defaultValues: TripFormValues = {
  destination: "",
  dateRange: { from: undefined, to: undefined },
  participants: [{ type: "adulto", age: undefined }],
  budget: 1000,
  styleNotes: "",
  arrivalTime: "",
  departureTime: "",
};
```

- [ ] **Step 2: Aggiungi i due input dentro il popover "Date del viaggio"**

Nello stesso file, trova il blocco `<PopoverContent className="w-auto p-0" align="start">` che contiene il componente `<Calendar ... />` (tra le righe 188-201). Subito dopo il tag di chiusura `/>` di `<Calendar>` e prima del tag di chiusura `</PopoverContent>`, aggiungi:

```tsx
                  <div className="grid grid-cols-2 gap-3 border-t p-3">
                    <div className="space-y-1">
                      <Label htmlFor="arrival-time" className="text-xs text-muted-foreground">
                        Arrivo (opzionale)
                      </Label>
                      <Input id="arrival-time" type="time" {...register("arrivalTime")} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="departure-time" className="text-xs text-muted-foreground">
                        Partenza (opzionale)
                      </Label>
                      <Input id="departure-time" type="time" {...register("departureTime")} />
                    </div>
                  </div>
```

Il blocco `PopoverContent` completo diventa:

```tsx
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
                  <div className="grid grid-cols-2 gap-3 border-t p-3">
                    <div className="space-y-1">
                      <Label htmlFor="arrival-time" className="text-xs text-muted-foreground">
                        Arrivo (opzionale)
                      </Label>
                      <Input id="arrival-time" type="time" {...register("arrivalTime")} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="departure-time" className="text-xs text-muted-foreground">
                        Partenza (opzionale)
                      </Label>
                      <Input id="departure-time" type="time" {...register("departureTime")} />
                    </div>
                  </div>
                </PopoverContent>
```

`Input` e `Label` sono già importati in cima al file (`import { Input } from "@/components/ui/input";` e `import { Label } from "@/components/ui/label";`) — non serve aggiungere import.

- [ ] **Step 3: Esegui lint e test**

Run: `npm run lint && npm test`
Expected: nessun nuovo errore/warning introdotto, tutti i test passano.

- [ ] **Step 4: Verifica manuale nel browser**

Avvia il server (`npm run dev` se non già attivo) e nel browser:

1. Apri il form, inserisci una destinazione, apri il popover "Date del viaggio".
2. Verifica che sotto il calendario compaiano i due campi "Arrivo (opzionale)" e "Partenza (opzionale)", ciascuno con un selettore orario nativo del browser.
3. Seleziona un intervallo di 2 giorni, imposta "Arrivo" a un orario pomeridiano (es. 16:00) e lascia "Partenza" vuoto.
4. Completa "Chi viaggia" e "Budget", genera l'itinerario.
5. Controlla che la prima attività del Giorno 1 abbia un `suggestedTime` che inizia dopo le 16:00 (con margine per il trasferimento) — non alle 8-9 del mattino come accadrebbe senza il vincolo.
6. Ripeti con un nuovo viaggio impostando anche "Partenza" all'ultimo giorno (es. 10:00) e verifica che le attività dell'ultimo giorno finiscano prima di quell'orario, con margine.
7. Ripeti con un viaggio di un solo giorno impostando sia arrivo che partenza, e verifica che entrambi i vincoli siano rispettati sull'unico giorno generato.

- [ ] **Step 5: Commit**

```bash
git add components/itinerary-form/itinerary-form.tsx
git commit -m "feat: add optional arrival/departure time inputs to the trip form"
```
