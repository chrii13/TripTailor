# Consigli sulla cena — piano di implementazione

> **Per chi esegue:** SUB-SKILL RICHIESTA: usare `superpowers:subagent-driven-development`
> (consigliata) oppure `superpowers:executing-plans` per implementare questo piano un
> compito alla volta. I passi usano caselle (`- [ ]`) per il tracciamento.

**Obiettivo:** per ogni giornata dell'itinerario, consigliare un ristorante che **esiste
davvero**, scelto dal modello fra candidati presi da OpenStreetMap e verificato dal codice.

**Architettura:** due tempi. L'itinerario compare come oggi; una seconda richiesta a
`/api/dinner-suggestions` geocodifica la tappa che precede la cena, cerca i ristoranti
vicini su Overpass, li passa a Gemini che ne **sceglie uno per identificativo**, e il codice
verifica che quell'identificativo fosse fra i candidati. Nome e indirizzo mostrati vengono
sempre dai dati OSM, mai dalla risposta del modello.

**Tecnologie:** Next.js 16 App Router, TypeScript, zod, vitest (due ambienti: node e jsdom),
LocationIQ (già in uso), Overpass API (nuova, gratuita e senza chiave), Gemini (già in uso).

**Spec:** `docs/superpowers/specs/2026-08-24-consigli-cena-design.md`

## Vincoli globali

- **Punto di ritorno già salvato:** tag `prima-consigli-cena`. Non spostarlo, non cancellarlo.
- **Date di calendario:** solo stringhe `yyyy-MM-dd` sul filo, ricostruite come mezzanotte
  locale via `lib/calendar-date.ts`. Mai `new Date("2026-10-10")`, mai `Date` dentro
  `JSON.stringify`. Vale anche nei test.
- **`responseJsonSchema` non accetta `maxItems`**: Gemini rifiuta con `400 INVALID_ARGUMENT`
  lo schema di risposta che lo contiene. Un tetto sul numero di elementi va imposto **dopo**
  il `safeParse`. `minItems`, `minLength` e `maxLength` passano.
- **Lingua:** ogni testo generato dal modello e mostrato a schermo è in italiano; i nomi
  propri non si traducono.
- **Sistema visivo:** token di `app/globals.css`, niente ombre né gradienti, bordi 1px,
  `rounded-lg` (10px) per le card, `rounded-full` per i bottoni. Nessun marchio di terzi
  nelle schede.
- **Nessun errore di questa fase deve produrre una schermata d'errore:** l'itinerario è già
  a schermo, ogni fallimento degrada in silenzio.
- **Overpass pubblico è instabile:** timeout stretto (5s), fallimento silenzioso. Misurato:
  risponde in 1-2s quando va, ma può restituire 500/504 dopo 46-55s.
- **`npm test` deve restare verde a ogni commit.** Baseline all'inizio: 376 test su 36 file,
  lint 0 errori / 5 warning preesistenti.

---

## Struttura dei file

| File | Responsabilità |
|---|---|
| `lib/dinner-anchor.ts` | scegliere la tappa che precede la cena, per giornata |
| `lib/dinner-candidates.ts` | interrogare Overpass, normalizzare e limitare i candidati |
| `lib/verify-dinner-choice.ts` | il cancello: l'identificativo scelto è fra i candidati? |
| `lib/dinner-suggestions-schema.ts` | schema della risposta del modello |
| `lib/dinner-suggestions-prompt.ts` | prompt (funzione pura) |
| `lib/dinner-suggestions-request.ts` | schema della richiesta alla nostra route |
| `app/api/dinner-suggestions/route.ts` | orchestrazione, budget di tempo, errori |
| `components/itinerary-form/itinerary-result.tsx` | richiesta differita e resa del blocco |
| `lib/itinerary-prompt.ts` | (modifica) le attività non nominano più locali |
| `components/landing/site-footer.tsx` | (modifica) attribuzione OpenStreetMap |

---

### Task 1: Scelta della tappa d'ancoraggio

**File:**
- Creare: `lib/dinner-anchor.ts`
- Test: `lib/dinner-anchor.test.ts`

**Interfacce:**
- Consuma: `ItineraryDay` da `lib/itinerary-schema.ts`
- Produce: `pickDinnerAnchor(day: ItineraryDay): string | null` — il titolo della tappa
  d'ancoraggio, o `null` se la giornata non ne ha una.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
import { describe, expect, it } from "vitest";
import { pickDinnerAnchor } from "./dinner-anchor";
import type { ItineraryDay } from "./itinerary-schema";

function attivita(title: string) {
  return {
    title,
    description: "d",
    estimatedCost: "~10€",
    suggestedTime: "09:00–10:00",
    details: { about: "a", gettingThere: "g", tips: "t" },
  };
}

function giornata(parti: Partial<ItineraryDay>): ItineraryDay {
  return { date: "2026-10-10", mattina: [], pomeriggio: [], sera: [], ...parti };
}

describe("pickDinnerAnchor", () => {
  it("prende l'ultima attività del pomeriggio: è lì che l'utente si trova verso le 19", () => {
    const day = giornata({
      pomeriggio: [attivita("Museo"), attivita("Ponte Luís I")],
      sera: [attivita("Passeggiata")],
    });
    expect(pickDinnerAnchor(day)).toBe("Ponte Luís I");
  });

  it("ripiega sulla prima attività della sera quando il pomeriggio è vuoto", () => {
    const day = giornata({ mattina: [attivita("Mercato")], sera: [attivita("Fado")] });
    expect(pickDinnerAnchor(day)).toBe("Fado");
  });

  it("restituisce null senza pomeriggio né sera: senza un punto, «vicino» non significa niente", () => {
    expect(pickDinnerAnchor(giornata({ mattina: [attivita("Mercato")] }))).toBeNull();
  });

  it("restituisce null su una giornata del tutto vuota", () => {
    expect(pickDinnerAnchor(giornata({}))).toBeNull();
  });
});
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Comando: `npx vitest run lib/dinner-anchor.test.ts`
Atteso: FALLISCE, `Failed to resolve import "./dinner-anchor"`.

- [ ] **Passo 3: scrivere l'implementazione minima**

```ts
import type { ItineraryDay } from "./itinerary-schema";

/**
 * La tappa che dice dove si trova l'utente all'ora di cena. È l'ultima del pomeriggio
 * perché la sera si mangia dove il pomeriggio è finito; se il pomeriggio è vuoto vale la
 * prima della sera. Senza nessuna delle due non c'è un punto attorno a cui cercare, e un
 * consiglio "vicino" a niente non è un consiglio.
 */
export function pickDinnerAnchor(day: ItineraryDay): string | null {
  const pomeriggio = day.pomeriggio.at(-1);
  if (pomeriggio) return pomeriggio.title;

  const sera = day.sera.at(0);
  if (sera) return sera.title;

  return null;
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Comando: `npx vitest run lib/dinner-anchor.test.ts`
Atteso: PASSA, 4 test.

- [ ] **Passo 5: committare**

```bash
git add lib/dinner-anchor.ts lib/dinner-anchor.test.ts
git commit -m "feat: scelta della tappa che precede la cena"
```

---

### Task 2: Candidati da OpenStreetMap

**File:**
- Creare: `lib/dinner-candidates.ts`
- Test: `lib/dinner-candidates.test.ts`

**Interfacce:**
- Produce:
  - `export const MAX_CANDIDATES = 12`
  - `export interface DinnerCandidate { id: number; name: string; distanceMeters: number; cuisine?: string; openingHours?: string; street?: string; }`
  - `parseOverpassRestaurants(json: unknown, lat: number, lon: number): DinnerCandidate[]`
    — pura: normalizza, calcola la distanza, scarta i senza nome, ordina per distanza,
    tronca a `MAX_CANDIDATES`, assegna `id` progressivi da 1.
  - `fetchDinnerCandidates(lat: number, lon: number, timeoutMs: number): Promise<DinnerCandidate[]>`
    — impura: interroga Overpass, restituisce `[]` su qualsiasi errore.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
import { describe, expect, it } from "vitest";
import { MAX_CANDIDATES, parseOverpassRestaurants } from "./dinner-candidates";

// Il punto di riferimento dei test: Ribeira, Porto.
const LAT = 41.1404;
const LON = -8.6115;

function elemento(name: string | undefined, lat: number, lon: number, tags = {}) {
  return { type: "node", id: 1, lat, lon, tags: { amenity: "restaurant", ...(name ? { name } : {}), ...tags } };
}

describe("parseOverpassRestaurants", () => {
  it("scarta i locali senza nome: un consiglio senza nome non è un consiglio", () => {
    const json = { elements: [elemento(undefined, LAT, LON), elemento("Adega São Nicolau", LAT, LON)] };
    const out = parseOverpassRestaurants(json, LAT, LON);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Adega São Nicolau");
  });

  it("ordina per distanza crescente", () => {
    const json = {
      elements: [
        elemento("Lontano", LAT + 0.004, LON),
        elemento("Vicino", LAT + 0.0005, LON),
      ],
    };
    expect(parseOverpassRestaurants(json, LAT, LON).map((c) => c.name)).toEqual(["Vicino", "Lontano"]);
  });

  it("assegna identificativi progressivi da 1: il modello sceglie per id, non per nome", () => {
    const json = { elements: [elemento("A", LAT, LON), elemento("B", LAT + 0.001, LON)] };
    expect(parseOverpassRestaurants(json, LAT, LON).map((c) => c.id)).toEqual([1, 2]);
  });

  it("tronca a MAX_CANDIDATES: a Porto ce n'erano 161 entro 500 m", () => {
    const elements = Array.from({ length: 40 }, (_, i) => elemento(`R${i}`, LAT + i * 0.0001, LON));
    expect(parseOverpassRestaurants({ elements }, LAT, LON)).toHaveLength(MAX_CANDIDATES);
  });

  it("riporta i campi opzionali solo quando ci sono: il 71% dei locali non ha la cucina", () => {
    const json = {
      elements: [
        elemento("Con dati", LAT, LON, { cuisine: "regional", opening_hours: "Mo-Su 19:00-23:00", "addr:street": "Rua São Nicolau" }),
        elemento("Nudo", LAT + 0.001, LON),
      ],
    };
    const [conDati, nudo] = parseOverpassRestaurants(json, LAT, LON);
    expect(conDati.cuisine).toBe("regional");
    expect(conDati.openingHours).toBe("Mo-Su 19:00-23:00");
    expect(conDati.street).toBe("Rua São Nicolau");
    expect(nudo.cuisine).toBeUndefined();
    expect(nudo.openingHours).toBeUndefined();
  });

  it("usa il centro delle way, che non hanno lat/lon proprie", () => {
    const json = { elements: [{ type: "way", id: 9, center: { lat: LAT, lon: LON }, tags: { amenity: "restaurant", name: "In un edificio" } }] };
    expect(parseOverpassRestaurants(json, LAT, LON)).toHaveLength(1);
  });

  it("non esplode su una risposta malformata", () => {
    expect(parseOverpassRestaurants({}, LAT, LON)).toEqual([]);
    expect(parseOverpassRestaurants(null, LAT, LON)).toEqual([]);
    expect(parseOverpassRestaurants({ elements: "non un array" }, LAT, LON)).toEqual([]);
  });
});
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Comando: `npx vitest run lib/dinner-candidates.test.ts`
Atteso: FALLISCE, `Failed to resolve import "./dinner-candidates"`.

- [ ] **Passo 3: scrivere l'implementazione minima**

```ts
// Dodici bastano a dare scelta reale entro dieci minuti a piedi. Misurato a Porto: 161
// locali entro 500 m — mandarli tutti al modello, su un viaggio di 14 giorni, significa
// duemila voci in un prompt solo, e un modello che sceglie peggio perché annega.
export const MAX_CANDIDATES = 12;

const SEARCH_RADIUS_METERS = 600;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export interface DinnerCandidate {
  id: number;
  name: string;
  distanceMeters: number;
  cuisine?: string;
  openingHours?: string;
  street?: string;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function parseOverpassRestaurants(json: unknown, lat: number, lon: number): DinnerCandidate[] {
  const elements = (json as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];

  return elements
    .map((raw) => {
      const el = raw as OverpassElement;
      const name = el.tags?.name;
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (!name || typeof elLat !== "number" || typeof elLon !== "number") return null;

      return {
        name,
        distanceMeters: distanceMeters(lat, lon, elLat, elLon),
        cuisine: el.tags?.cuisine,
        openingHours: el.tags?.opening_hours,
        street: el.tags?.["addr:street"],
      };
    })
    .filter((c): c is Omit<DinnerCandidate, "id"> => c !== null)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_CANDIDATES)
    .map((c, index) => ({ id: index + 1, ...c }));
}

/**
 * Overpass pubblico risponde in 1-2 secondi quando va, ma i fallimenti sono frequenti e
 * costosi: misurate risposte 500/504 dopo 46-55 secondi. Il timeout stretto e la rinuncia
 * silenziosa sono la protezione: una giornata senza consiglio è accettabile, mezzo minuto
 * di attesa per un errore no.
 */
export async function fetchDinnerCandidates(
  lat: number,
  lon: number,
  timeoutMs: number
): Promise<DinnerCandidate[]> {
  const query = `[out:json][timeout:10];(node["amenity"="restaurant"](around:${SEARCH_RADIUS_METERS},${lat},${lon});way["amenity"="restaurant"](around:${SEARCH_RADIUS_METERS},${lat},${lon}););out center tags;`;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.error(`Consigli cena: Overpass ha risposto ${response.status}`);
      return [];
    }

    return parseOverpassRestaurants(await response.json(), lat, lon);
  } catch (error) {
    console.error("Consigli cena: interrogazione Overpass fallita", error);
    return [];
  }
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Comando: `npx vitest run lib/dinner-candidates.test.ts`
Atteso: PASSA, 7 test.

- [ ] **Passo 5: committare**

```bash
git add lib/dinner-candidates.ts lib/dinner-candidates.test.ts
git commit -m "feat: candidati ristorante da OpenStreetMap"
```

---

### Task 3: Il cancello di verifica

**File:**
- Creare: `lib/verify-dinner-choice.ts`
- Test: `lib/verify-dinner-choice.test.ts`

**Interfacce:**
- Consuma: `DinnerCandidate` da `lib/dinner-candidates.ts`
- Produce: `resolveDinnerChoice(candidates: DinnerCandidate[], chosenId: number): DinnerCandidate | null`

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
import { describe, expect, it } from "vitest";
import { resolveDinnerChoice } from "./verify-dinner-choice";
import type { DinnerCandidate } from "./dinner-candidates";

const candidati: DinnerCandidate[] = [
  { id: 1, name: "Adega São Nicolau", distanceMeters: 120 },
  { id: 2, name: "Dom Tonho", distanceMeters: 240 },
];

describe("resolveDinnerChoice", () => {
  it("restituisce il candidato quando l'identificativo esiste", () => {
    expect(resolveDinnerChoice(candidati, 2)?.name).toBe("Dom Tonho");
  });

  it("scarta un identificativo inventato: è il cancello contro i locali inesistenti", () => {
    expect(resolveDinnerChoice(candidati, 99)).toBeNull();
  });

  it("scarta lo zero e i negativi, che gli identificativi partono da 1", () => {
    expect(resolveDinnerChoice(candidati, 0)).toBeNull();
    expect(resolveDinnerChoice(candidati, -1)).toBeNull();
  });

  it("scarta qualunque scelta su un elenco vuoto", () => {
    expect(resolveDinnerChoice([], 1)).toBeNull();
  });
});
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Comando: `npx vitest run lib/verify-dinner-choice.test.ts`
Atteso: FALLISCE, `Failed to resolve import "./verify-dinner-choice"`.

- [ ] **Passo 3: scrivere l'implementazione minima**

```ts
import type { DinnerCandidate } from "./dinner-candidates";

/**
 * Il cancello. Il modello restituisce un identificativo, non un nome: se quell'id non è
 * fra i candidati che gli abbiamo dato, la scelta si scarta. Un identificativo inventato
 * non produce un locale inventato, produce uno scarto.
 *
 * Nome, indirizzo e distanza mostrati a schermo vengono da qui — cioè dai dati OSM — e
 * mai dalla risposta del modello.
 */
export function resolveDinnerChoice(
  candidates: DinnerCandidate[],
  chosenId: number
): DinnerCandidate | null {
  return candidates.find((candidate) => candidate.id === chosenId) ?? null;
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Comando: `npx vitest run lib/verify-dinner-choice.test.ts`
Atteso: PASSA, 4 test.

- [ ] **Passo 5: committare**

```bash
git add lib/verify-dinner-choice.ts lib/verify-dinner-choice.test.ts
git commit -m "feat: il cancello che scarta le scelte fuori elenco"
```

---

### Task 4: Schema e prompt della scelta

**File:**
- Creare: `lib/dinner-suggestions-schema.ts`, `lib/dinner-suggestions-prompt.ts`
- Test: `lib/dinner-suggestions-schema.test.ts`, `lib/dinner-suggestions-prompt.test.ts`
- Modificare: `lib/gemini-response-json-schema.test.ts` (aggiungere il nuovo schema al controllo)

**Interfacce:**
- Produce:
  - `dinnerSuggestionsResponseSchema` — `{ days: [{ date: string; chosenId: number; comment: string }] }`
  - `MAX_DINNER_COMMENT_LENGTH = 220`
  - `buildDinnerSuggestionsPrompt(input: DinnerPromptInput): string` dove
    `DinnerPromptInput = { destination: string; participants: Participant[]; budget: number; styleNotes?: string; days: { date: string; anchorTitle: string; candidates: DinnerCandidate[] }[] }`

- [ ] **Passo 1: scrivere i test che falliscono**

```ts
// lib/dinner-suggestions-schema.test.ts
import { describe, expect, it } from "vitest";
import { dinnerSuggestionsResponseSchema } from "./dinner-suggestions-schema";

describe("dinnerSuggestionsResponseSchema", () => {
  it("accetta una risposta ben formata", () => {
    const out = dinnerSuggestionsResponseSchema.safeParse({
      days: [{ date: "2026-10-10", chosenId: 3, comment: "Piccola adega, pesce del giorno." }],
    });
    expect(out.success).toBe(true);
  });

  it("rifiuta una data che non sia di calendario", () => {
    const out = dinnerSuggestionsResponseSchema.safeParse({
      days: [{ date: "10/10/2026", chosenId: 1, comment: "c" }],
    });
    expect(out.success).toBe(false);
  });

  it("rifiuta un identificativo non intero: gli id dei candidati sono interi", () => {
    const out = dinnerSuggestionsResponseSchema.safeParse({
      days: [{ date: "2026-10-10", chosenId: 1.5, comment: "c" }],
    });
    expect(out.success).toBe(false);
  });

  it("rifiuta un commento vuoto: senza il perché il consiglio non vale", () => {
    const out = dinnerSuggestionsResponseSchema.safeParse({
      days: [{ date: "2026-10-10", chosenId: 1, comment: "" }],
    });
    expect(out.success).toBe(false);
  });
});
```

```ts
// lib/dinner-suggestions-prompt.test.ts
import { describe, expect, it } from "vitest";
import { buildDinnerSuggestionsPrompt } from "./dinner-suggestions-prompt";

const input = {
  destination: "Porto, Portogallo",
  participants: [{ type: "adulto" as const, age: 30 }],
  budget: 600,
  days: [
    {
      date: "2026-10-10",
      anchorTitle: "Ponte Luís I",
      candidates: [
        { id: 1, name: "Adega São Nicolau", distanceMeters: 120, cuisine: "regional" },
        { id: 2, name: "Dom Tonho", distanceMeters: 240 },
      ],
    },
  ],
};

describe("buildDinnerSuggestionsPrompt", () => {
  it("elenca i candidati con il loro identificativo", () => {
    const prompt = buildDinnerSuggestionsPrompt(input);
    expect(prompt).toContain("1. Adega São Nicolau");
    expect(prompt).toContain("2. Dom Tonho");
  });

  it("vieta esplicitamente di nominare locali fuori elenco", () => {
    const prompt = buildDinnerSuggestionsPrompt(input).toLowerCase();
    expect(prompt).toMatch(/solo.*elenco|esclusivamente.*elenco|non.*inventare/);
  });

  it("chiede di rispondere con l'identificativo, non con il nome", () => {
    expect(buildDinnerSuggestionsPrompt(input)).toMatch(/chosenId/);
  });

  it("chiede l'italiano e di non tradurre i nomi propri", () => {
    const prompt = buildDinnerSuggestionsPrompt(input).toLowerCase();
    expect(prompt).toContain("italiano");
    expect(prompt).toMatch(/nomi propri|non tradurre/);
  });

  it("passa le date in formato ISO, come le riceverà indietro", () => {
    expect(buildDinnerSuggestionsPrompt(input)).toContain("2026-10-10");
  });
});
```

- [ ] **Passo 2: eseguire i test e verificare che falliscano**

Comando: `npx vitest run lib/dinner-suggestions-schema.test.ts lib/dinner-suggestions-prompt.test.ts`
Atteso: FALLISCONO, moduli non risolti.

- [ ] **Passo 3: scrivere l'implementazione minima**

```ts
// lib/dinner-suggestions-schema.ts
import { z } from "zod";

export const MAX_DINNER_COMMENT_LENGTH = 220;

export const dinnerSuggestionsResponseSchema = z.object({
  // Nessun .max() sull'array: Gemini rifiuta `maxItems` nel responseJsonSchema (vedi
  // CLAUDE.md). Il numero di giornate è comunque quello che gli abbiamo dato, e le
  // giornate senza corrispondenza vengono ignorate a valle.
  days: z
    .array(
      z.object({
        date: z.iso.date(),
        chosenId: z.number().int(),
        comment: z.string().min(1).max(MAX_DINNER_COMMENT_LENGTH),
      })
    )
    .min(1),
});

export type DinnerSuggestionsResponse = z.infer<typeof dinnerSuggestionsResponseSchema>;
```

```ts
// lib/dinner-suggestions-prompt.ts
import type { Participant } from "./schema";
import type { DinnerCandidate } from "./dinner-candidates";
import { MAX_DINNER_COMMENT_LENGTH } from "./dinner-suggestions-schema";

export interface DinnerPromptDay {
  date: string;
  anchorTitle: string;
  candidates: DinnerCandidate[];
}

export interface DinnerPromptInput {
  destination: string;
  participants: Participant[];
  budget: number;
  styleNotes?: string;
  days: DinnerPromptDay[];
}

function descriviCandidato(candidate: DinnerCandidate): string {
  const dettagli = [
    `${candidate.distanceMeters} m`,
    candidate.cuisine ? `cucina: ${candidate.cuisine}` : null,
    candidate.openingHours ? `orari: ${candidate.openingHours}` : null,
    candidate.street ? `via: ${candidate.street}` : null,
  ].filter(Boolean);

  return `  ${candidate.id}. ${candidate.name} (${dettagli.join(", ")})`;
}

function descriviGruppo(participants: Participant[]): string {
  return participants.map((p) => `${p.type} di ${p.age} anni`).join(", ");
}

export function buildDinnerSuggestionsPrompt(input: DinnerPromptInput): string {
  const giornate = input.days
    .map(
      (day) =>
        `Giornata ${day.date} — a fine pomeriggio il viaggiatore si trova a "${day.anchorTitle}".\nLocali disponibili:\n${day.candidates.map(descriviCandidato).join("\n")}`
    )
    .join("\n\n");

  return `Stai consigliando dove cenare a chi sta viaggiando a ${input.destination}.

Gruppo: ${descriviGruppo(input.participants)}. Budget complessivo del viaggio: ${input.budget} euro.${
    input.styleNotes ? `\nStile di viaggio dichiarato: ${input.styleNotes}` : ""
  }

Per ogni giornata ricevi un elenco numerato di locali che esistono davvero, con la distanza dal punto in cui il viaggiatore si trova. Scegline uno per giornata.

${giornate}

Regole, in ordine di importanza:

1. Scegli SOLO fra i locali dell'elenco di quella giornata, indicandone il numero nel campo "chosenId". Non nominare, non suggerire e non inventare locali che non siano in elenco: se nessuno ti convince, scegli comunque il meno peggio fra quelli dati.
2. Il campo "date" deve riportare la stringa esatta della giornata così com'è scritta qui sopra.
3. Nel campo "comment" spiega in italiano perché quello, per questa sera e per questo gruppo: massimo ${MAX_DINNER_COMMENT_LENGTH} caratteri. Scrivi al viaggiatore, non di lui.
4. Non tradurre i nomi propri dei locali e dei luoghi: "Adega São Nicolau" resta tale, non diventa "Cantina San Nicola". In italiano va la prosa attorno al nome, non il nome.
5. Molti locali non hanno indicato cucina né orari: è normale, non è un motivo per scartarli. Usa quello che sai del posto e della zona.
6. Varia: non scegliere lo stesso tipo di locale tutte le sere.`;
}
```

- [ ] **Passo 4: aggiungere il nuovo schema alla rete di sicurezza**

In `lib/gemini-response-json-schema.test.ts`, aggiungere `dinnerSuggestionsResponseSchema`
all'elenco degli schemi ispezionati, con lo stesso controllo sulle chiavi rifiutate da
Gemini. È la rete che ha già intercettato `maxItems` una volta.

- [ ] **Passo 5: eseguire i test e verificare che passino**

Comando: `npx vitest run lib/dinner-suggestions-schema.test.ts lib/dinner-suggestions-prompt.test.ts lib/gemini-response-json-schema.test.ts`
Atteso: PASSANO.

- [ ] **Passo 6: committare**

```bash
git add lib/dinner-suggestions-schema.ts lib/dinner-suggestions-prompt.ts lib/dinner-suggestions-schema.test.ts lib/dinner-suggestions-prompt.test.ts lib/gemini-response-json-schema.test.ts
git commit -m "feat: schema e prompt della scelta del ristorante"
```

---

### Task 5: Geocodifica della tappa

**File:**
- Modificare: `lib/geocode-destination.ts`
- Test: `lib/geocode-destination.test.ts`

**Interfacce:**
- Produce: `geocodePlaceNear(query: string, near: { lat: number; lon: number }, timeoutMs: number): Promise<{ lat: number; lon: number } | null>`

**Perché qui e non in un file nuovo:** condivide chiave, client e gestione errori con
`geocodeDestination`, e sono le uniche due chiamate a LocationIQ del progetto.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
it("vincola la ricerca alle vicinanze: senza, «Mercado do Bolhão» può finire in un altro continente", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ lat: "41.1496", lon: "-8.6109" }],
  });
  vi.stubGlobal("fetch", fetchMock);
  process.env.LOCATIONIQ_API_KEY = "chiave-finta";

  const out = await geocodePlaceNear("Mercado do Bolhão", { lat: 41.1404, lon: -8.6115 }, 2500);

  expect(out).toEqual({ lat: 41.1496, lon: -8.6109 });
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.get("viewbox")).toBeTruthy();
  expect(url.searchParams.get("bounded")).toBe("1");
});

it("restituisce null quando LocationIQ non trova nulla, senza lanciare", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  process.env.LOCATIONIQ_API_KEY = "chiave-finta";
  expect(await geocodePlaceNear("Posto inesistente", { lat: 41.14, lon: -8.61 }, 2500)).toBeNull();
});
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Comando: `npx vitest run lib/geocode-destination.test.ts`
Atteso: FALLISCE, `geocodePlaceNear is not a function`.

- [ ] **Passo 3: scrivere l'implementazione minima**

```ts
// Mezzo grado attorno al punto: abbondante per una città, stretto abbastanza da escludere
// l'omonimo dall'altra parte del mondo. `bounded=1` rende il riquadro un vincolo e non un
// suggerimento.
const VIEWBOX_DEGREES = 0.5;

export async function geocodePlaceNear(
  query: string,
  near: { lat: number; lon: number },
  timeoutMs: number
): Promise<{ lat: number; lon: number } | null> {
  const apiKey = process.env.LOCATIONIQ_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://api.locationiq.com/v1/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set(
    "viewbox",
    [near.lon - VIEWBOX_DEGREES, near.lat + VIEWBOX_DEGREES, near.lon + VIEWBOX_DEGREES, near.lat - VIEWBOX_DEGREES].join(",")
  );
  url.searchParams.set("bounded", "1");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      console.error(`Consigli cena: LocationIQ ha risposto ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { lat: string; lon: string }[];
    if (!Array.isArray(data) || data.length === 0) return null;

    return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
  } catch (error) {
    console.error("Consigli cena: geocodifica della tappa fallita", error);
    return null;
  }
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Comando: `npx vitest run lib/geocode-destination.test.ts`
Atteso: PASSA.

- [ ] **Passo 5: committare**

```bash
git add lib/geocode-destination.ts lib/geocode-destination.test.ts
git commit -m "feat: geocodifica di una tappa vincolata alle vicinanze"
```

---

### Task 6: La route

**File:**
- Creare: `app/api/dinner-suggestions/route.ts`, `lib/dinner-suggestions-request.ts`
- Test: `app/api/dinner-suggestions/route.test.ts`, `lib/dinner-suggestions-request.test.ts`

**Interfacce:**
- Consuma: tutto quanto sopra.
- Produce: `POST /api/dinner-suggestions` → `{ suggestions: { date: string; name: string; comment: string; distanceMeters: number; street?: string; openingHours?: string }[] }`.
  Le giornate senza consiglio **non compaiono** nell'array.

**Comportamento richiesto:**
- `export const maxDuration = 60`
- Tetto complessivo di **20 secondi** per la fase geocodifica + Overpass
  (`PRE_MODEL_PHASE_MS`), poi il residuo alla chiamata al modello, con lo stesso schema di
  `getCallAttemptBudget` già usato altrove.
- Geocodifica e Overpass **in parallelo fra le giornate** (`Promise.all`): sono indipendenti
  e la fase ha un tetto condiviso.
- Se la geocodifica di una tappa fallisce si usano le coordinate della destinazione.
- Giornate senza candidati: escluse dal prompt e assenti dalla risposta.
- Se **nessuna** giornata ha candidati: `200` con `{ suggestions: [] }`, non un errore.
- Ogni scelta passa da `resolveDinnerChoice`; le scelte scartate spariscono in silenzio.
- Errori del modello: `200` con `{ suggestions: [] }`. **Questa route non restituisce mai
  un errore al client**: l'itinerario è già a schermo.

- [ ] **Passo 1: scrivere i test che falliscono**

Coprire almeno: richiesta malformata → `400`; nessun candidato → `200` con array vuoto;
scelta con id inventato → quella giornata assente; modello che fallisce → `200` con array
vuoto; risposta valida → nome e distanza presi **dai candidati** e non dalla risposta del
modello. Usare la simulazione di `@google/genai` già presente in
`app/api/generate-itinerary/route.test.ts` e la simulazione di `fetch` per Overpass e
LocationIQ.

- [ ] **Passo 2: eseguire i test e verificare che falliscano**

Comando: `npx vitest run app/api/dinner-suggestions/route.test.ts`

- [ ] **Passo 3: scrivere lo schema della richiesta**

```ts
// lib/dinner-suggestions-request.ts
import { z } from "zod";
import { participantSchema } from "./schema";
import { calendarDateSchema } from "./calendar-date";

export const dinnerSuggestionsRequestSchema = z.object({
  destination: z.string().trim().min(1).max(200),
  coordinates: z.object({ lat: z.number(), lon: z.number() }),
  participants: z.array(participantSchema).min(1).max(20),
  budget: z.number().min(0).max(1_000_000),
  styleNotes: z.string().max(1000).optional(),
  days: z
    .array(
      z.object({
        // La data resta una stringa di calendario: qui non serve un oggetto Date, serve
        // riconoscere la giornata nella risposta del modello. Lo schema condiviso vale
        // comunque come validazione del formato.
        date: calendarDateSchema,
        anchorTitle: z.string().trim().min(1).max(200),
      })
    )
    .min(1),
});

export type DinnerSuggestionsRequest = z.infer<typeof dinnerSuggestionsRequestSchema>;
```

- [ ] **Passo 4: scrivere la route**

Struttura, seguendo `app/api/generate-itinerary/route.ts` per il ciclo su modelli e chiavi:

```ts
export const maxDuration = 60;

// Geocodifica e Overpass hanno un tetto condiviso: sono la fase che precede il modello,
// e senza un tetto un Overpass appeso si mangerebbe il budget della scelta. 20 secondi
// bastano per una decina di giornate in parallelo e lasciano al modello il resto.
const PRE_MODEL_PHASE_MS = 20_000;
const GEOCODE_TIMEOUT_MS = 2_500;
const OVERPASS_TIMEOUT_MS = 5_000;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const deadline = startTime + (maxDuration - 5) * 1000;

  // ...validazione del corpo come in generate-itinerary: 400 su corpo malformato...

  const { destination, coordinates, participants, budget, styleNotes, days } = parsed.data;

  // Fase 1 — candidati. Le giornate sono indipendenti: in parallelo, con tetto condiviso.
  const preModelDeadline = Math.min(deadline, startTime + PRE_MODEL_PHASE_MS);

  const perGiornata = await Promise.all(
    days.map(async (day) => {
      if (Date.now() >= preModelDeadline) return null;

      const punto =
        (await geocodePlaceNear(`${day.anchorTitle}, ${destination}`, coordinates, GEOCODE_TIMEOUT_MS)) ??
        coordinates;

      const candidates = await fetchDinnerCandidates(punto.lat, punto.lon, OVERPASS_TIMEOUT_MS);
      return candidates.length > 0 ? { ...day, candidates } : null;
    })
  );

  const conCandidati = perGiornata.filter((g) => g !== null);

  // Nessun candidato da nessuna parte: non è un errore, è una risposta onesta.
  if (conCandidati.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // Fase 2 — la scelta. Una sola chiamata per tutto l'itinerario.
  // ...ciclo su modelli e chiavi identico a generate-itinerary, con classifyFinishReason
  //    letto prima del JSON.parse e responseJsonSchema da dinnerSuggestionsResponseSchema...

  // Fase 3 — il cancello.
  const suggestions = parsedResponse.data.days.flatMap((scelta) => {
    const giornata = conCandidati.find((g) => g.date === scelta.date);
    if (!giornata) return [];

    const locale = resolveDinnerChoice(giornata.candidates, scelta.chosenId);
    if (!locale) {
      console.error(`Consigli cena: identificativo ${scelta.chosenId} fuori elenco per ${scelta.date}`);
      return [];
    }

    // Nome, via, distanza e orari vengono dai dati OSM. Della risposta del modello
    // sopravvive solo il commento.
    return [{
      date: giornata.date,
      name: locale.name,
      distanceMeters: locale.distanceMeters,
      street: locale.street,
      openingHours: locale.openingHours,
      comment: scelta.comment,
    }];
  });

  return NextResponse.json({ suggestions });
}
```

**Nota importante sugli errori:** ogni `catch` di questa route risponde
`NextResponse.json({ suggestions: [] })`, **mai** un codice d'errore — tranne il `400` sul
corpo malformato, che è un difetto del chiamante e non dell'utente. L'itinerario è già a
schermo: un errore qui produrrebbe un messaggio rosso su una pagina che funziona.

- [ ] **Passo 5: eseguire i test e verificare che passino**

- [ ] **Passo 5: committare**

```bash
git add app/api/dinner-suggestions lib/dinner-suggestions-request.ts lib/dinner-suggestions-request.test.ts
git commit -m "feat: route dei consigli sulla cena"
```

---

### Task 7: Le attività non nominano più locali

**File:**
- Modificare: `lib/itinerary-prompt.ts`
- Test: `lib/itinerary-prompt.test.ts`

**Perché:** senza questa modifica l'itinerario conterrebbe due cene, una inventata dentro le
attività e una verificata nel nuovo blocco. **Questa modifica chiude da sola il difetto di
partenza**, cioè i nomi di locali non verificati che l'app produce oggi.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
it("vieta di nominare ristoranti e locali fra le attività: quelli li sceglie il blocco verificato", () => {
  const prompt = buildItineraryPrompt(input).toLowerCase();
  expect(prompt).toMatch(/non nominare.*(ristorant|locali)|nessun.*(ristorant|locale) specifico/);
});
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Comando: `npx vitest run lib/itinerary-prompt.test.ts`
Atteso: FALLISCE.

- [ ] **Passo 3: modificare il prompt**

Sostituire la frase che oggi invita a proporre la cena come attività («es. cena e poi una
passeggiata/bar/spettacolo serale») con una regola esplicita: le attività possono includere
un momento serale, ma **non devono nominare ristoranti, bar, trattorie o locali specifici** —
quelli li consiglia un blocco a parte, scelto fra locali verificati.

- [ ] **Passo 4: eseguire i test e verificare che passino**

- [ ] **Passo 5: committare**

```bash
git add lib/itinerary-prompt.ts lib/itinerary-prompt.test.ts
git commit -m "fix: le attività dell'itinerario non nominano più locali non verificati"
```

---

### Task 8: L'interfaccia

**File:**
- Modificare: `components/itinerary-form/itinerary-result.tsx`
- Test: `components/itinerary-form/itinerary-result.test.tsx` (nuovo, ambiente jsdom)

**Comportamento richiesto:**
- All'apparire del risultato parte una richiesta a `/api/dinner-suggestions` con
  destinazione, coordinate, e per ogni giornata data e tappa d'ancoraggio (da
  `pickDinnerAnchor`).
- Mentre arriva, ogni giornata mostra uno stato d'attesa discreto che **non sposta il
  contenuto sotto di sé** quando il blocco compare (riservare l'altezza).
- Il blocco compare in coda alla fascia serale, distinto dalle attività: è un suggerimento,
  non una tappa con un orario. Mostra nome, distanza a piedi, e il commento; via e orari se
  presenti.
- Giornate senza consiglio: una riga discreta, nessun errore.
- Fallimento della richiesta: **nessun messaggio d'errore**, semplicemente nessun blocco.
- Rispetta il sistema visivo. Nessun marchio di terzi.

- [ ] **Passo 1: scrivere i test che falliscono** (ambiente jsdom)

Coprire: il consiglio compare nella giornata giusta; una richiesta fallita non rompe
l'itinerario e non mostra errori; il nome mostrato è quello restituito dalla route.

- [ ] **Passo 2: eseguire i test e verificare che falliscano**

Comando: `npx vitest run --project dom`

- [ ] **Passo 3: implementare**

Stato e richiesta differita, dentro `ItineraryResult`:

```tsx
interface DinnerSuggestion {
  date: string;
  name: string;
  distanceMeters: number;
  street?: string;
  openingHours?: string;
  comment: string;
}

const [dinner, setDinner] = useState<DinnerSuggestion[] | null>(null);
const [dinnerDone, setDinnerDone] = useState(false);

useEffect(() => {
  // L'itinerario è già a schermo: questa richiesta non deve poter rompere nulla, quindi
  // nessuno stato d'errore. O arriva un consiglio, o la giornata resta com'è.
  let annullato = false;

  const body = {
    destination: tripData.destination,
    coordinates,
    participants: tripData.participants,
    budget: tripData.budget,
    styleNotes: tripData.styleNotes,
    days: itinerary.days
      .map((day) => ({ date: day.date, anchorTitle: pickDinnerAnchor(day) }))
      .filter((d): d is { date: string; anchorTitle: string } => d.anchorTitle !== null),
  };

  if (body.days.length === 0) {
    setDinnerDone(true);
    return;
  }

  fetch("/api/dinner-suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (annullato) return;
      setDinner(data?.suggestions ?? []);
    })
    .catch(() => {
      if (!annullato) setDinner([]);
    })
    .finally(() => {
      if (!annullato) setDinnerDone(true);
    });

  return () => {
    annullato = true;
  };
}, [itinerary, tripData, coordinates]);
```

Resa, in coda alla fascia serale di ogni giornata:

```tsx
{(() => {
  const consiglio = dinner?.find((s) => s.date === day.date);

  if (!dinnerDone) {
    // Altezza riservata: quando il blocco arriva non deve spostare ciò che sta sotto.
    return (
      <div className="min-h-[4.5rem] border-t border-border py-3">
        <p className="text-xs text-muted-foreground">Cerchiamo dove cenare…</p>
      </div>
    );
  }

  if (!consiglio) {
    return (
      <div className="min-h-[4.5rem] border-t border-border py-3">
        <p className="text-xs text-muted-foreground">
          Nessun locale schedato vicino alla tappa di questa sera.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[4.5rem] border-t border-border py-3">
      <p className="mb-2 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        Dove cenare
      </p>
      <div className="rounded-lg border border-border bg-accent p-3">
        <p className="text-sm font-medium text-primary">{consiglio.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{consiglio.comment}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="tabular-nums">{consiglio.distanceMeters} m</span>
          {consiglio.street ? ` · ${consiglio.street}` : ""}
          {consiglio.openingHours ? ` · ${consiglio.openingHours}` : ""}
        </p>
      </div>
    </div>
  );
})()}
```

**Attenzione:** `coordinates` non è oggi fra le prop di `ItineraryResult`. Vanno passate da
`itinerary-form.tsx`, che le riceve già dalla risposta di `/api/generate-itinerary` —
verificare come sono esposte lì e, se non lo sono, aggiungerle alla risposta della route
esistente. **Se questo richiede di toccare `generate-itinerary`, fermarsi e segnalarlo**
invece di allargare il compito di iniziativa.

- [ ] **Passo 4: eseguire i test e verificare che passino**

- [ ] **Passo 5: committare**

```bash
git add components/itinerary-form/itinerary-result.tsx components/itinerary-form/itinerary-result.test.tsx components/itinerary-form/itinerary-form.tsx
git commit -m "feat: il consiglio sulla cena dentro la giornata"
```

---

### Task 9: Attribuzione, prova sul campo, documentazione

**File:**
- Modificare: `components/landing/site-footer.tsx`, `CLAUDE.md`

- [ ] **Passo 1: attribuzione OpenStreetMap**

Aggiungere OpenStreetMap alla sezione «Da dove vengono i dati» del footer, accanto a Gemini,
LocationIQ e Open-Meteo.

- [ ] **Passo 2: la prova che conta — chiamata vera**

**Obbligatoria prima di dire che è finito.** I test simulano il modello e non si
accorgerebbero di uno schema rifiutato: è già successo, e la generazione era completamente
rotta con tutta la suite verde.

```bash
npm run build
npx next start -p 3500
```

Poi generare un itinerario vero dall'interfaccia e verificare che i consigli arrivino.
Controllare in particolare: che i nomi corrispondano a locali reali, che la distanza sia
plausibile, che il commento sia in italiano e i nomi propri non tradotti. **Fermare il
server alla fine.**

Provare anche una destinazione **piccola**, non una capitale: è lì che OpenStreetMap ha
pochi dati ed è dove il degrado deve funzionare.

- [ ] **Passo 3: aggiornare CLAUDE.md**

Sezione 1: i nuovi file, la nuova route, la fonte dati nuova (Overpass, gratuita e senza
chiave), la struttura a due tempi e **perché** (il budget di 60 secondi di `/crea` è già
pieno), il cancello dell'identificativo, e il conteggio dei test aggiornato.

- [ ] **Passo 4: verifica completa**

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

- [ ] **Passo 5: committare**

```bash
git add components/landing/site-footer.tsx CLAUDE.md
git commit -m "docs: attribuzione OpenStreetMap e note sui consigli cena"
```

---

## Note per chi esegue

- **Ogni test va provato al contrario**: rompi la cosa che protegge e verifica che diventi
  rosso. Un test che non sa fallire non protegge niente. È la regola del progetto.
- **Non toccare la spaziatura verticale** delle sezioni della landing: vincolo dell'utente,
  due tentativi già respinti.
- **Il punto di ritorno è il tag `prima-consigli-cena`**: non spostarlo.
