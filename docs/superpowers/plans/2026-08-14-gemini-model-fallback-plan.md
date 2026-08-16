# Fallback su Modello Gemini Alternativo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un secondo livello di fallback nella generazione dell'itinerario: dopo aver esaurito tutte le chiavi disponibili su un modello Gemini, riprovare con un modello alternativo (`gemini-2.5-flash`) prima di arrendersi, per assorbire sia l'esaurimento della quota giornaliera sia il sovraccarico "high demand" del modello.

**Architecture:** Il ciclo attuale (una chiave alla volta) diventa un ciclo annidato: modelli all'esterno, chiavi all'interno. Il passaggio di chiave resta scoperto solo dal `rate_limit` (invariato); il passaggio di modello scatta anche su `network` (5xx), l'unica condizione allargata.

**Tech Stack:** Next.js (App Router, TypeScript), `@google/genai`.

**Spec:** `docs/superpowers/specs/2026-08-14-gemini-model-fallback-design.md`

## Global Constraints

- Modelli da provare, in ordine: `gemini-flash-latest` (primario), poi `gemini-2.5-flash` (fallback) — confermati entrambi disponibili con la chiave del progetto.
- **Cambio chiave** (stesso modello): scatta **solo** su `rate_limit` — nessuna modifica al comportamento attuale.
- **Cambio modello** (dopo aver esaurito tutte le chiavi di un modello): scatta su `rate_limit` **oppure** `network` — l'unica condizione nuova introdotta da questa spec.
- Se anche l'ultima chiave dell'ultimo modello fallisce, la risposta al client resta identica a oggi (stesso `ErrorCode`, stesso status HTTP).
- Nessuna modifica allo schema di richiesta/risposta dell'endpoint.
- Nessuna nuova variabile d'ambiente — l'elenco dei modelli è un valore fisso nel codice.
- La vera chiamata di rete a Gemini (incluso il passaggio tra modelli) non viene testata in automatico, stesso principio già seguito per il resto del codice che tocca Gemini in questo progetto — si verifica dal vivo.

---

### Task 1: Ciclo annidato modelli×chiavi nella route di generazione

**Files:**
- Modify: `app/api/generate-itinerary/route.ts`

**Interfaces:**
- Nessuna nuova interfaccia esportata — la firma della funzione `POST` e il contratto della risposta restano identici.

- [ ] **Step 1: Sostituisci il ciclo di generazione**

Il file attuale (righe 59-97) contiene:

```ts
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

Sostituiscilo con:

```ts
  const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.5-flash"];

  let responseText: string | undefined;
  let finishReason: string | undefined;

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
        break modelLoop;
      } catch (error) {
        const code = classifyGenerationError(error);
        const hasNextKey = i < apiKeys.length - 1;
        const hasNextModel = m < GEMINI_MODELS.length - 1;

        if (code === "rate_limit" && hasNextKey) {
          console.error(
            `Generazione itinerario: chiave Gemini #${i + 1} in rate limit (modello ${model}), tentativo con la chiave successiva`
          );
          continue;
        }

        if ((code === "rate_limit" || code === "network") && hasNextModel) {
          console.error(
            `Generazione itinerario: modello ${model} non disponibile (${code}), tentativo con il modello successivo`
          );
          continue modelLoop;
        }

        console.error(`Generazione itinerario fallita (${code}):`, error);
        const status = code === "rate_limit" ? 429 : 502;
        return NextResponse.json({ error: code }, { status });
      }
    }
  }
```

Nota importante sulla posizione della costante: dichiara `GEMINI_MODELS` **dentro** la funzione `POST`, esattamente dove mostrato sopra (subito prima di `responseText`/`finishReason`), non a livello di modulo — non cambia il comportamento, ma tiene la costante vicina all'unico punto che la usa, coerente con lo stile del resto del file. Il resto della funzione `POST` (tutto ciò che precede e segue questo blocco) resta invariato.

- [ ] **Step 2: Esegui la suite di test esistente per verificare che non ci siano regressioni**

Run: `npm test`
Expected: tutti gli 84 test passano. Nessuno dei test esistenti in `app/api/generate-itinerary/route.test.ts` arriva a chiamare Gemini (testano solo i percorsi di validazione prima della chiamata: JSON malformato, Content-Type non valido, corpo non valido, nessuna chiave configurata) — quindi non dovrebbero essere toccati da questa modifica. Se qualcosa si rompe, non procedere a indovinare: fermati e rileggi il diff.

- [ ] **Step 3: Esegui lint**

Run: `npm run lint`
Expected: 0 errori, solo gli warning preesistenti e non correlati.

- [ ] **Step 4: Verifica manuale dal vivo**

Avvia il server se non è già attivo (`npm run dev`), poi fai una richiesta reale:

```bash
curl -s -X POST http://127.0.0.1:3000/api/generate-itinerary \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Bari, Italia",
    "dateRange": {"from": "2026-09-20", "to": "2026-09-20"},
    "participants": [{"type": "adulto", "age": 30}],
    "budget": 500,
    "styleNotes": ""
  }' -w "\nHTTP status: %{http_code}\n" --max-time 200
```

Controlla il log del server (`console.error` stampati nel terminale del dev server):

- Se la richiesta ha successo al primo tentativo (200, nessun log di errore), la funzionalità di fallback non è stata esercitata ma il percorso base resta confermato funzionante.
- Se invece il modello primario risulta in `rate_limit` o `network` su tutte le chiavi disponibili, deve comparire in log la riga "modello gemini-flash-latest non disponibile (...), tentativo con il modello successivo", seguita da un tentativo con `gemini-2.5-flash`. Se quest'ultimo ha successo, la richiesta HTTP finale deve comunque restituire 200 con un itinerario valido (il client non vede alcuna differenza).
- Dato che negli ultimi test reali di oggi il modello primario ha effettivamente avuto problemi di disponibilità, è plausibile osservare questo scenario per davvero, non simulato. Se invece oggi il modello primario funziona senza intoppi, va bene lo stesso: il comportamento sul percorso felice è comunque verificato, e la logica del cambio-modello è comunque coperta dalla revisione del codice (ogni ramo del ciclo annidato è deterministico e ispezionabile staticamente).

- [ ] **Step 5: Commit**

```bash
git add app/api/generate-itinerary/route.ts
git commit -m "feat: fall back to an alternate Gemini model when the primary is unavailable"
```
