# Chiave Gemini di Riserva Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una seconda chiave API Gemini opzionale (`GEMINI_API_KEY_BACKUP`) usata automaticamente quando la chiave primaria va in rate limit (429), senza introdurre un'astrazione multi-provider.

**Architecture:** Una funzione pura `getGeminiApiKeys()` legge le due variabili d'ambiente e restituisce l'elenco ordinato delle chiavi configurate. La route `generate-itinerary` scorre questo elenco: prova una chiave, e passa alla successiva solo se l'errore è `rate_limit` e ne esiste un'altra; qualunque altro errore (o l'ultima chiave disponibile) restituisce l'esito al client esattamente come oggi.

**Tech Stack:** Next.js (App Router, TypeScript), `@google/genai`, Zod, Vitest.

## Global Constraints

- Il fallback scatta **solo** per errori classificati `rate_limit` (429). Nessun altro codice di errore (`config`, `network`, `invalid_response`) attiva il passaggio alla chiave successiva.
- `GEMINI_API_KEY_BACKUP` è opzionale. Se assente, il comportamento è identico a oggi.
- Se nessuna chiave è configurata (né primaria né backup), l'errore resta `config` con status 502 — stesso comportamento di oggi quando manca `GEMINI_API_KEY`.
- Nessuna indicazione al client su quale chiave sia stata usata per generare la risposta.
- Nessuna modifica allo schema di richiesta/risposta dell'endpoint, né al meccanismo di retry automatico già esistente per errori 5xx/408 (`httpOptions.retryOptions`), che resta invariato e si applica indipendentemente a ciascuna chiave.
- La vera chiamata di rete a Gemini (incluso il passaggio effettivo da una chiave all'altra) non viene testata in automatico — stesso principio già seguito per il resto del codice che tocca Gemini in questo progetto. Solo la funzione pura `getGeminiApiKeys()` ha test automatici.

---

### Task 1: Funzione pura per l'elenco delle chiavi Gemini

**Files:**
- Create: `lib/gemini-api-keys.ts`
- Test: `lib/gemini-api-keys.test.ts`

**Interfaces:**
- Produces: `getGeminiApiKeys(): string[]` — legge `process.env.GEMINI_API_KEY` e `process.env.GEMINI_API_KEY_BACKUP`, restituisce le chiavi effettivamente configurate (non `undefined` e non stringa vuota), in ordine: primaria per prima, poi backup. Usata da Task 2.

- [ ] **Step 1: Scrivi i test falliti**

Crea `lib/gemini-api-keys.test.ts` con questo contenuto:

```ts
import { describe, it, expect } from "vitest";
import { getGeminiApiKeys } from "./gemini-api-keys";

describe("getGeminiApiKeys", () => {
  it("restituisce solo la chiave primaria quando il backup non è configurato", () => {
    const originalPrimary = process.env.GEMINI_API_KEY;
    const originalBackup = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "primary-key";
    delete process.env.GEMINI_API_KEY_BACKUP;

    try {
      expect(getGeminiApiKeys()).toEqual(["primary-key"]);
    } finally {
      if (originalPrimary === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalPrimary;
      if (originalBackup === undefined) delete process.env.GEMINI_API_KEY_BACKUP;
      else process.env.GEMINI_API_KEY_BACKUP = originalBackup;
    }
  });

  it("restituisce primaria e backup, in ordine, quando entrambe sono configurate", () => {
    const originalPrimary = process.env.GEMINI_API_KEY;
    const originalBackup = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "primary-key";
    process.env.GEMINI_API_KEY_BACKUP = "backup-key";

    try {
      expect(getGeminiApiKeys()).toEqual(["primary-key", "backup-key"]);
    } finally {
      if (originalPrimary === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalPrimary;
      if (originalBackup === undefined) delete process.env.GEMINI_API_KEY_BACKUP;
      else process.env.GEMINI_API_KEY_BACKUP = originalBackup;
    }
  });

  it("scarta chiavi impostate come stringa vuota", () => {
    const originalPrimary = process.env.GEMINI_API_KEY;
    const originalBackup = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "";
    process.env.GEMINI_API_KEY_BACKUP = "backup-key";

    try {
      expect(getGeminiApiKeys()).toEqual(["backup-key"]);
    } finally {
      if (originalPrimary === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalPrimary;
      if (originalBackup === undefined) delete process.env.GEMINI_API_KEY_BACKUP;
      else process.env.GEMINI_API_KEY_BACKUP = originalBackup;
    }
  });

  it("restituisce un array vuoto quando nessuna delle due chiavi è configurata", () => {
    const originalPrimary = process.env.GEMINI_API_KEY;
    const originalBackup = process.env.GEMINI_API_KEY_BACKUP;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_BACKUP;

    try {
      expect(getGeminiApiKeys()).toEqual([]);
    } finally {
      if (originalPrimary === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalPrimary;
      if (originalBackup === undefined) delete process.env.GEMINI_API_KEY_BACKUP;
      else process.env.GEMINI_API_KEY_BACKUP = originalBackup;
    }
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- lib/gemini-api-keys.test.ts`
Expected: FAIL con un errore tipo "Cannot find module './gemini-api-keys'" (il file non esiste ancora).

- [ ] **Step 3: Crea l'implementazione**

Crea `lib/gemini-api-keys.ts` con questo contenuto:

```ts
export function getGeminiApiKeys(): string[] {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_BACKUP].filter(
    (key): key is string => !!key
  );
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- lib/gemini-api-keys.test.ts`
Expected: PASS (tutti e 4 i test).

- [ ] **Step 5: Esegui l'intera suite**

Run: `npm test`
Expected: tutti i test passano (nessuna regressione — questo file è nuovo e isolato, non dovrebbe toccare altro).

- [ ] **Step 6: Commit**

```bash
git add lib/gemini-api-keys.ts lib/gemini-api-keys.test.ts
git commit -m "feat: add getGeminiApiKeys for primary/backup Gemini key configuration"
```

---

### Task 2: Fallback sulla chiave di backup nella route di generazione

**Files:**
- Modify: `app/api/generate-itinerary/route.ts`
- Modify: `app/api/generate-itinerary/route.test.ts`
- Modify: `.env.local.example`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `getGeminiApiKeys(): string[]` da Task 1 (`lib/gemini-api-keys.ts`).

- [ ] **Step 1: Aggiorna il test esistente per essere indipendente dalla chiave di backup**

Il test `"restituisce l'errore 'config' quando GEMINI_API_KEY non è configurata"` in `app/api/generate-itinerary/route.test.ts` oggi svuota solo `GEMINI_API_KEY`. Dopo questo task, se in ambiente locale fosse presente anche `GEMINI_API_KEY_BACKUP`, il test fallirebbe nel modo sbagliato (proverebbe a chiamare davvero Gemini con la chiave di backup). Sostituisci l'intero test con questa versione, che salva/pulisce/ripristina entrambe le variabili:

```ts
  it("restituisce l'errore 'config' quando nessuna chiave Gemini è configurata", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const originalBackupKey = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "";
    process.env.GEMINI_API_KEY_BACKUP = "";

    try {
      const request = new Request("http://localhost/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: "Roma",
          dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
          participants: [{ type: "adulto", age: 35 }],
          budget: 1000,
          styleNotes: "",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.error).toBe("config");
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
```

- [ ] **Step 2: Esegui il test aggiornato e verifica che passi**

Run: `npm test -- app/api/generate-itinerary/route.test.ts`
Expected: PASS (i 4 test esistenti, incluso quello appena riscritto).

- [ ] **Step 3: Aggiorna la route per usare l'elenco di chiavi con fallback**

In `app/api/generate-itinerary/route.ts`, aggiungi l'import in cima al file (dopo gli import esistenti):

```ts
import { getGeminiApiKeys } from "@/lib/gemini-api-keys";
```

Sostituisci questo blocco:

```ts
  if (!process.env.GEMINI_API_KEY) {
    console.error("Generazione itinerario: GEMINI_API_KEY non configurata");
    return NextResponse.json({ error: "config" }, { status: 502 });
  }

  const coordinates = await geocodeDestination(parsedRequest.data.destination);
  const climate = coordinates
    ? await getClimateAverages(
        coordinates.lat,
        coordinates.lon,
        parsedRequest.data.dateRange.from,
        parsedRequest.data.dateRange.to
      )
    : null;

  const prompt = buildItineraryPrompt(parsedRequest.data, climate);
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  let responseText: string | undefined;
  let finishReason: string | undefined;
  try {
    const response = await client.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(itineraryResponseSchema),
        maxOutputTokens: 50000,
        thinkingConfig: { thinkingBudget: 1024 },
        httpOptions: {
          timeout: 180_000,
          retryOptions: { attempts: 2, httpStatusCodes: [408, 500, 502, 503, 504] },
        },
      },
    });
    responseText = response.text;
    finishReason = response.candidates?.[0]?.finishReason;
  } catch (error) {
    const code = classifyGenerationError(error);
    console.error(`Generazione itinerario fallita (${code}):`, error);
    const status = code === "rate_limit" ? 429 : 502;
    return NextResponse.json({ error: code }, { status });
  }
```

con questo:

```ts
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    console.error("Generazione itinerario: nessuna chiave Gemini configurata (GEMINI_API_KEY)");
    return NextResponse.json({ error: "config" }, { status: 502 });
  }

  const coordinates = await geocodeDestination(parsedRequest.data.destination);
  const climate = coordinates
    ? await getClimateAverages(
        coordinates.lat,
        coordinates.lon,
        parsedRequest.data.dateRange.from,
        parsedRequest.data.dateRange.to
      )
    : null;

  const prompt = buildItineraryPrompt(parsedRequest.data, climate);

  let responseText: string | undefined;
  let finishReason: string | undefined;

  for (let i = 0; i < apiKeys.length; i++) {
    const client = new GoogleGenAI({ apiKey: apiKeys[i] });
    try {
      const response = await client.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(itineraryResponseSchema),
          maxOutputTokens: 50000,
          thinkingConfig: { thinkingBudget: 1024 },
          httpOptions: {
            timeout: 180_000,
            retryOptions: { attempts: 2, httpStatusCodes: [408, 500, 502, 503, 504] },
          },
        },
      });
      responseText = response.text;
      finishReason = response.candidates?.[0]?.finishReason;
      break;
    } catch (error) {
      const code = classifyGenerationError(error);
      const hasNextKey = i < apiKeys.length - 1;

      if (code === "rate_limit" && hasNextKey) {
        console.error(
          `Generazione itinerario: chiave Gemini #${i + 1} in rate limit, tentativo con la chiave successiva`
        );
        continue;
      }

      console.error(`Generazione itinerario fallita (${code}):`, error);
      const status = code === "rate_limit" ? 429 : 502;
      return NextResponse.json({ error: code }, { status });
    }
  }
```

Il resto del file (controllo `if (!responseText)`, parsing JSON, validazione con `itineraryResponseSchema`, risposta finale) resta invariato.

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- app/api/generate-itinerary/route.test.ts`
Expected: PASS (tutti i test).

- [ ] **Step 5: Esegui l'intera suite**

Run: `npm test`
Expected: tutti i test passano (nessuna regressione).

- [ ] **Step 6: Aggiungi la nuova variabile d'ambiente al file di esempio**

In `.env.local.example`, aggiungi una riga dopo `GEMINI_API_KEY=`:

```
GEMINI_API_KEY=
GEMINI_API_KEY_BACKUP=
LOCATIONIQ_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 7: Aggiorna CLAUDE.md**

In `CLAUDE.md`, sotto **Required Environment Variables**, aggiungi una riga dopo quella di `GEMINI_API_KEY`:

```
  - `GEMINI_API_KEY` — Google Gemini API (generazione itinerario)
  - `GEMINI_API_KEY_BACKUP` — chiave Gemini di riserva opzionale, usata automaticamente solo quando la chiave primaria va in rate limit (429)
```

Aggiorna anche il conteggio dei test sotto **Primary Commands** (`npm test`) al nuovo totale — esegui `npm test` e leggi il numero esatto di test dal riepilogo finale prima di scrivere la riga, non indovinarlo.

- [ ] **Step 8: Verifica manuale dal vivo**

Questa verifica sfrutta una condizione reale già presente: la chiave `GEMINI_API_KEY` attualmente configurata in `.env.local` è già in rate limit per la sessione di test di oggi. Se hai una seconda chiave Gemini (anche gratuita, da un account/progetto Google diverso), aggiungila come `GEMINI_API_KEY_BACKUP` in `.env.local`, riavvia il server (`npm run dev`), e prova a generare un itinerario reale dal form: dovrebbe funzionare (usando la chiave di backup) invece di fallire con l'errore di rate limit. Controlla il log del server: dovrebbe comparire la riga "chiave Gemini #1 in rate limit, tentativo con la chiave successiva" prima della generazione riuscita.

Se non hai ancora una seconda chiave a disposizione in questo momento, salta questo step e segnalalo nel report — non è bloccante per completare il task, ma va verificato dal vivo appena possibile prima di considerare la funzionalità pienamente validata.

- [ ] **Step 9: Commit**

```bash
git add app/api/generate-itinerary/route.ts app/api/generate-itinerary/route.test.ts .env.local.example CLAUDE.md
git commit -m "feat: fall back to a backup Gemini key when the primary key hits its rate limit"
```
