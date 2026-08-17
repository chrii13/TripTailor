# Informazioni Pratiche sul Paese Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrare valuta, lingua ufficiale e fuso orario del paese di destinazione nel riepilogo dell'itinerario generato, usando un dataset statico (nessuna chiamata di rete aggiuntiva, nessuna nuova chiave API).

**Architecture:** Il codice paese arriva gratis dalla stessa chiamata LocationIQ già usata per la geolocalizzazione. Una nuova funzione pura combina due pacchetti npm statici (`world-countries` per valuta/lingue, `countries-and-timezones` per i fusi orari) con l'API nativa `Intl.DisplayNames`/`Intl.DateTimeFormat` per tradurre in italiano e calcolare l'offset UTC corrente (gestendo automaticamente l'ora legale). Nessun dataset scritto a mano: tutti i dati vengono da pacchetti mantenuti, non dalla memoria di chi scrive il codice.

**Tech Stack:** Next.js (App Router, TypeScript), `world-countries`, `countries-and-timezones`, API `Intl` nativa (nessun pacchetto aggiuntivo per le traduzioni).

**Spec:** `docs/superpowers/specs/2026-08-17-country-info-design.md`

## Global Constraints

- Nessuna nuova variabile d'ambiente, nessuna chiamata di rete aggiuntiva.
- Il codice paese (`countryCode`, ISO 3166-1 alpha-2) arriva dalla risposta LocationIQ già ottenuta oggi in `geocodeDestination` (campo `address.country_code`), non da una chiamata separata.
- Per i paesi con più fusi orari, si elencano tutti i fusi distinti (nessuna scelta arbitraria di uno solo).
- I fusi orari mostrati riflettono l'offset UTC **attuale** (calcolato al momento della richiesta, tiene conto dell'ora legale automaticamente tramite `Intl.DateTimeFormat`), non un valore fisso scritto a mano.
- Nomi di valuta e lingue in italiano, ottenuti con `Intl.DisplayNames(["it"], ...)` — nessun pacchetto di traduzione aggiuntivo, nessuna tabella scritta a mano.
- Sezione visibile nel riepilogo solo quando i dati sono disponibili (`countryInfo !== null`) — nessun placeholder quando mancano.
- Stile visivo coerente con i chip esistenti (Data/Viaggiatori/Budget) in `itinerary-result.tsx`: stesse classi Tailwind, stesse icone Lucide, nessun nuovo colore.

---

### Task 1: Funzione pura `getCountryInfo`

**Files:**
- Create: `lib/country-info.ts`
- Test: `lib/country-info.test.ts`

**Interfaces:**
- Produces: `export interface CountryInfo { currency: { code: string; symbol: string; name: string }; languages: string[]; timezones: string[] }` e `export function getCountryInfo(countryCode: string): CountryInfo | null` — usati da Task 3.

- [ ] **Step 1: Installa le due dipendenze**

```bash
npm install world-countries@^5.1.0 countries-and-timezones@^3.10.0
```

- [ ] **Step 2: Verifica la forma esatta dei pacchetti installati prima di scrivere codice**

Prima di procedere, leggi `node_modules/countries-and-timezones/index.d.ts` (o il file `.d.ts` equivalente elencato nel campo `types` del suo `package.json`) per confermare la firma esatta di `getCountry` e la forma dell'oggetto restituito (deve avere un campo `timezones: string[]` con nomi IANA, es. `"Asia/Tokyo"`) — non fidarti a memoria della firma mostrata sotto, verificala sui tipi reali installati. Verifica anche che `import countries from "world-countries";` funzioni con un default import (il progetto ha `esModuleInterop: true` in `tsconfig.json`, quindi dovrebbe funzionare, ma conferma leggendo `node_modules/world-countries/index.d.ts` o il file a cui punta il campo `types`).

- [ ] **Step 3: Scrivi i test falliti**

Crea `lib/country-info.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getCountryInfo } from "./country-info";

describe("getCountryInfo", () => {
  it("restituisce valuta, lingua e fuso orario per un paese con un solo fuso (Giappone)", () => {
    const result = getCountryInfo("JP");
    expect(result).not.toBeNull();
    expect(result?.currency.code).toBe("JPY");
    expect(result?.currency.symbol).toBe("¥");
    expect(result?.languages).toContain("giapponese");
    expect(result?.timezones).toEqual(["UTC+9"]);
  });

  it("restituisce più fusi orari distinti per un paese con più fusi (Stati Uniti)", () => {
    const result = getCountryInfo("US");
    expect(result).not.toBeNull();
    expect(result?.timezones.length).toBeGreaterThan(1);
    for (const tz of result?.timezones ?? []) {
      expect(tz).toMatch(/^UTC[+-]\d+(:\d{2})?$/);
    }
  });

  it("accetta il codice paese anche in minuscolo", () => {
    const result = getCountryInfo("jp");
    expect(result).not.toBeNull();
    expect(result?.currency.code).toBe("JPY");
  });

  it("restituisce null per un codice paese non riconosciuto", () => {
    expect(getCountryInfo("ZZ")).toBeNull();
  });

  it("restituisce nomi delle lingue in italiano, non in inglese", () => {
    const result = getCountryInfo("FR");
    expect(result?.languages).toContain("francese");
    expect(result?.languages).not.toContain("French");
  });
});
```

Nota sul test del Giappone: il Giappone non osserva l'ora legale, quindi `UTC+9` è stabile in ogni periodo dell'anno in cui viene eseguito il test — non è un valore fragile.

- [ ] **Step 4: Esegui i test e verifica che falliscano**

Run: `npm test -- lib/country-info.test.ts`
Expected: FAIL con un errore tipo "Cannot find module './country-info'" (il file non esiste ancora).

- [ ] **Step 5: Crea l'implementazione**

Crea `lib/country-info.ts`. Il codice sotto usa i nomi di funzione/campi verificati nello Step 2 — se la verifica ha trovato nomi diversi, adatta di conseguenza mantenendo la stessa logica:

```ts
import countries from "world-countries";
import { getCountry } from "countries-and-timezones";

export interface CountryInfo {
  currency: { code: string; symbol: string; name: string };
  languages: string[];
  timezones: string[];
}

function formatUtcOffset(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const part = formatter.formatToParts(new Date()).find((p) => p.type === "timeZoneName");
  return part ? part.value.replace("GMT", "UTC") : timeZone;
}

export function getCountryInfo(countryCode: string): CountryInfo | null {
  const code = countryCode.toUpperCase();
  const country = countries.find((c) => c.cca2 === code);

  if (!country) {
    return null;
  }

  const currencyEntries = Object.entries(country.currencies ?? {});
  if (currencyEntries.length === 0) {
    return null;
  }
  const [currencyCode, currencyData] = currencyEntries[0];
  const currencyNames = new Intl.DisplayNames(["it"], { type: "currency" });

  const languageCodes = Object.keys(country.languages ?? {});
  const languageNames = new Intl.DisplayNames(["it"], { type: "language" });
  const languages = languageCodes.map((langCode) => languageNames.of(langCode) ?? langCode);

  const timezoneInfo = getCountry(code);
  const timezones = Array.from(new Set((timezoneInfo?.timezones ?? []).map(formatUtcOffset)));

  return {
    currency: {
      code: currencyCode,
      symbol: currencyData.symbol,
      name: currencyNames.of(currencyCode) ?? currencyData.name,
    },
    languages,
    timezones,
  };
}
```

- [ ] **Step 6: Esegui i test e verifica che passino**

Run: `npm test -- lib/country-info.test.ts`
Expected: PASS (tutti e 5 i test).

- [ ] **Step 7: Esegui l'intera suite**

Run: `npm test`
Expected: tutti i test passano (nessuna regressione — questo file è nuovo e isolato).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/country-info.ts lib/country-info.test.ts
git commit -m "feat: add getCountryInfo for currency/language/timezone lookup"
```

---

### Task 2: Estendi `geocodeDestination` per restituire anche il codice paese

**Files:**
- Modify: `lib/geocode-destination.ts`

**Interfaces:**
- Produces: `Coordinates` (rinominata concettualmente, stesso nome esportato) ora include `countryCode: string | null` — usato da Task 3. Nessun cambiamento alla firma della funzione `geocodeDestination(destination: string): Promise<Coordinates | null>`.

- [ ] **Step 1: Modifica l'interfaccia e l'estrazione del dato**

Il file attuale è:

```ts
interface LocationIqSearchResult {
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    island?: string;
    archipelago?: string;
  };
}

export interface Coordinates {
  lat: number;
  lon: number;
}
```

Sostituiscilo con:

```ts
interface LocationIqSearchResult {
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    island?: string;
    archipelago?: string;
    country_code?: string;
  };
}

export interface Coordinates {
  lat: number;
  lon: number;
  countryCode: string | null;
}
```

Poi, nel corpo di `geocodeDestination`, trova:

```ts
    const lat = Number.parseFloat(data[0].lat);
    const lon = Number.parseFloat(data[0].lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }

    return { lat, lon };
```

Sostituiscilo con:

```ts
    const lat = Number.parseFloat(data[0].lat);
    const lon = Number.parseFloat(data[0].lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }

    const countryCode = address?.country_code ? address.country_code.toUpperCase() : null;

    return { lat, lon, countryCode };
```

Il resto del file (gestione della chiave mancante, errori HTTP, try/catch) resta invariato.

- [ ] **Step 2: Esegui i test esistenti per verificare che non ci siano regressioni**

Run: `npm test -- lib/geocode-destination.test.ts`
Expected: PASS (l'unico test esistente copre solo il caso "chiave assente", non tocca l'estrazione del country code — non serve un nuovo test qui: come per il resto delle chiamate a LocationIQ in questo progetto, il parsing della risposta live non si testa in automatico, si verifica dal vivo nel Task 3).

- [ ] **Step 3: Esegui l'intera suite**

Run: `npm test`
Expected: tutti i test passano.

- [ ] **Step 4: Esegui lint**

Run: `npm run lint`
Expected: 0 errori, solo gli warning preesistenti e non correlati.

- [ ] **Step 5: Commit**

```bash
git add lib/geocode-destination.ts
git commit -m "feat: extract country code from LocationIQ geocoding response"
```

---

### Task 3: Collega tutto nella route e nel riepilogo

**Files:**
- Modify: `app/api/generate-itinerary/route.ts`
- Modify: `components/itinerary-form/itinerary-form.tsx`
- Modify: `components/itinerary-form/itinerary-result.tsx`

**Interfaces:**
- Consumes: `getCountryInfo(countryCode: string): CountryInfo | null` da Task 1 (`lib/country-info.ts`), `Coordinates.countryCode: string | null` da Task 2 (`lib/geocode-destination.ts`).

- [ ] **Step 1: Aggiorna la route**

In `app/api/generate-itinerary/route.ts`, aggiungi l'import in cima al file (dopo gli import esistenti):

```ts
import { getCountryInfo } from "@/lib/country-info";
```

Trova questo blocco:

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

Aggiungi subito dopo (prima della riga `const prompt = ...`):

```ts

  const countryInfo = coordinates?.countryCode ? getCountryInfo(coordinates.countryCode) : null;
```

Infine, trova l'ultima riga della funzione:

```ts
  return NextResponse.json({ itinerary: parsedResult.data, weather: climate });
```

Sostituiscila con:

```ts
  return NextResponse.json({ itinerary: parsedResult.data, weather: climate, countryInfo });
```

- [ ] **Step 2: Aggiorna il form per passare `countryInfo` al riepilogo**

In `components/itinerary-form/itinerary-form.tsx`, trova l'import di `DailyClimateAverage`:

```ts
import type { DailyClimateAverage } from "@/lib/climate-forecast";
```

Aggiungi subito dopo:

```ts
import type { CountryInfo } from "@/lib/country-info";
```

Trova la dichiarazione dello stato `weather`:

```ts
  const [weather, setWeather] = useState<DailyClimateAverage[] | null>(null);
```

Aggiungi subito dopo:

```ts
  const [countryInfo, setCountryInfo] = useState<CountryInfo | null>(null);
```

Trova, dentro `onSubmit`, la riga:

```ts
      setWeather(body.weather ?? null);
```

Aggiungi subito dopo:

```ts
      setCountryInfo(body.countryInfo ?? null);
```

Trova dove viene renderizzato `<ItineraryResult>`:

```tsx
      <ItineraryResult
        tripData={submittedData}
        itinerary={itinerary}
        weather={weather}
        onEdit={handleEdit}
      />
```

Aggiungi la nuova prop:

```tsx
      <ItineraryResult
        tripData={submittedData}
        itinerary={itinerary}
        weather={weather}
        countryInfo={countryInfo}
        onEdit={handleEdit}
      />
```

- [ ] **Step 3: Aggiorna il riepilogo per mostrare la nuova sezione**

In `components/itinerary-form/itinerary-result.tsx`, aggiungi `Banknote`, `Languages` e `Clock` all'import esistente da `lucide-react` (il file attuale importa `CalendarDays, CalendarIcon, Euro, Users` da lì — aggiungi i tre nuovi nomi allo stesso import, mantenendo ordine alfabetico):

```ts
import { Banknote, CalendarDays, CalendarIcon, Clock, Euro, Languages, Users } from "lucide-react";
```

Aggiungi l'import del tipo, insieme agli altri import di tipo già presenti (es. vicino a `import type { DailyClimateAverage } from "@/lib/climate-forecast";`):

```ts
import type { CountryInfo } from "@/lib/country-info";
```

Aggiungi `countryInfo` all'interfaccia delle props:

```ts
interface ItineraryResultProps {
  tripData: TripFormValues;
  itinerary: ItineraryResponse;
  weather: DailyClimateAverage[] | null;
  countryInfo: CountryInfo | null;
  onEdit: () => void;
}
```

Aggiorna la firma della funzione componente per accettare la nuova prop:

```ts
export function ItineraryResult({ tripData, itinerary, weather, countryInfo, onEdit }: ItineraryResultProps) {
```

Trova il blocco dei tre chip esistenti (Data/Viaggiatori/Budget):

```tsx
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {tripData.dateRange.from && tripData.dateRange.to && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
              <span>
                {format(tripData.dateRange.from, "dd/MM/yyyy")} - {format(tripData.dateRange.to, "dd/MM/yyyy")}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            <Users className="h-4 w-4 shrink-0 text-primary" />
            <span>
              {tripData.participants.map((p) => `${PARTICIPANT_TYPE_LABELS[p.type]} (${p.age})`).join(", ")}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            <Euro className="h-4 w-4 shrink-0 text-primary" />
            <span>Budget {tripData.budget}€</span>
          </div>
        </div>
```

Aggiungi subito dopo la chiusura di questo `</div>` (ancora dentro il `CardContent`, prima del blocco `<div className="space-y-6">` che elenca i giorni):

```tsx

        {countryInfo && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <Banknote className="h-4 w-4 shrink-0 text-primary" />
              <span>
                {countryInfo.currency.name} ({countryInfo.currency.symbol})
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <Languages className="h-4 w-4 shrink-0 text-primary" />
              <span>{countryInfo.languages.join(", ")}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              <span>{countryInfo.timezones.join(", ")}</span>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Esegui test e lint**

Run: `npm test && npm run lint`
Expected: tutti i test passano, 0 errori lint (solo gli warning preesistenti e non correlati).

- [ ] **Step 5: Verifica manuale nel browser**

Avvia il server se non è già attivo (`npm run dev`), compila il form con una destinazione reale (es. "Tokyo, Giappone"), genera un itinerario reale, e controlla nel riepilogo:
- La nuova sezione con valuta/lingua/fuso orario appare, con lo stesso stile visivo dei chip Data/Viaggiatori/Budget (stesso bordo, stesso sfondo, stesse dimensioni icona).
- I valori sono corretti e in italiano (es. per Tokyo: "yen giapponese (¥)", "giapponese", un fuso orario tipo "UTC+9").
- Prova anche una destinazione con più fusi orari (es. "New York, Stati Uniti") e verifica che vengano elencati più fusi distinti, non uno solo.
- Prova una destinazione che non si geolocalizza (es. una città inventata) e verifica che la nuova sezione semplicemente non compaia, senza errori in console.

- [ ] **Step 6: Commit**

```bash
git add app/api/generate-itinerary/route.ts components/itinerary-form/itinerary-form.tsx components/itinerary-form/itinerary-result.tsx
git commit -m "feat: show currency, language and timezone info in the itinerary summary"
```
