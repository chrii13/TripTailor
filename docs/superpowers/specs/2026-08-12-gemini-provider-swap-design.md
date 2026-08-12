# Cambio provider AI: Anthropic → Google Gemini

**Data:** 2026-08-12
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

La Fase 2 (generazione itinerario via Claude API) è stata completata e integrata su `master`. L'API Anthropic è a consumo, senza piano gratuito permanente. Per evitare costi durante lo sviluppo/test di questo progetto personale, si sostituisce Claude con **Google Gemini**, che offre un tier gratuito utilizzabile senza carta di credito.

Confronto valutato tra le opzioni gratuite disponibili (Gemini, Groq, Mistral, OpenRouter): Gemini scelto per il miglior compromesso tra qualità di ragionamento (rilevante per adattare l'itinerario all'età dei viaggiatori) e supporto nativo per output strutturato via JSON schema, comparabile a quanto già costruito per Anthropic.

## Scope

**Sostituzione diretta, non un vero switch multi-provider.** Il codice specifico di Anthropic viene rimosso dai file attivi del repository; resta interamente recuperabile dalla cronologia git (i commit della Fase 2), che è la forma di conservazione richiesta — nessuna astrazione "provider" da costruire o mantenere. Se in futuro si volesse tornare a Claude (o supportare entrambi), si riparte da quei commit.

Fuori scope:
- Un layer di astrazione che permetta di scegliere il provider a runtime.
- Migrazione dei log/costi/monitoraggio (nessuno di questi esiste ancora nel progetto).

## Cosa NON cambia

Tutto ciò che è a valle della chiamata AI resta identico, perché il contratto della route (`POST /api/generate-itinerary`) non cambia forma:

- `lib/schema.ts`, `lib/generate-itinerary-request.ts` — validazione form e richiesta server, invariati.
- `lib/itinerary-schema.ts` — schema zod della risposta itinerario, invariato (è la forma dei dati, non dipende da chi li genera).
- `lib/itinerary-prompt.ts` — il testo del prompt, incluse le regole di adattamento per età, è testo semplice e non specifico di un provider. Invariato.
- I 4 codici di errore e i relativi messaggi utente in italiano (`network` / `config` / `rate_limit` / `invalid_response`) — stesso contratto verso il client, stessi messaggi.
- `components/itinerary-form/itinerary-form.tsx`, `components/itinerary-form/itinerary-result.tsx` — dipendono solo dal contratto JSON della route (`{ itinerary }` o `{ error: ErrorCode }`), non da quale provider la implementa. Nessuna modifica.

## Cosa cambia

### Dipendenze

- `package.json`: rimuovere `@anthropic-ai/sdk`, aggiungere `@google/genai` (SDK ufficiale Google per TypeScript/JavaScript).

### `app/api/generate-itinerary/route.ts`

- Il client `Anthropic` viene sostituito dal client `GoogleGenAI` dell'SDK `@google/genai`.
- La chiamata `client.messages.parse(...)` con `output_config.format: zodOutputFormat(...)` viene sostituita dalla generazione strutturata di Gemini: `ai.models.generateContent({ model, contents, config: { responseMimeType: "application/json", responseSchema: ... } })`.
- Modello: **`gemini-2.5-flash`** (tier gratuito: 10 richieste/minuto, 250/giorno, nessuna carta di credito richiesta — ampiamente sufficiente per uso personale/di sviluppo).
- Il meccanismo esatto per collegare lo schema zod esistente (`itineraryResponseSchema`) al parametro `responseSchema` di Gemini (conversione automatica zod→JSON Schema, oppure schema scritto a mano equivalente) è un dettaglio implementativo da risolvere in fase di piano — non cambia la forma dei dati, solo come viene espressa verso l'SDK.
- Verificare in fase di piano se `gemini-2.5-flash` ha un comportamento "thinking"/ragionamento che condivide il budget di token in modo simile a quanto osservato con Claude Sonnet 5 (che aveva richiesto di alzare `max_tokens` e fissare l'`effort` nella review finale della Fase 2) — se sì, applicare un accorgimento equivalente.
- Il timeout di 30s sulla chiamata e la struttura try/catch per malformed body/richiesta non validata restano concettualmente invariati; l'implementazione del timeout dipende dalle opzioni offerte dall'SDK Gemini (da verificare in fase di piano).

### `lib/generate-itinerary-errors.ts`

Il meccanismo di classificazione cambia, ma la mappatura finale (i 4 codici) resta la stessa. L'SDK Anthropic espone una classe distinta per ogni tipo di errore (`AuthenticationError`, `RateLimitError`, ecc.), controllabili con `instanceof`. L'SDK Gemini espone invece una singola classe `ApiError` con una proprietà `.status` (codice HTTP) — la classificazione si basa quindi su quel valore numerico:

| Condizione | Codice |
|---|---|
| `status` 401 o 403 (chiave mancante/non valida) | `config` |
| `status` 429 (rate limit superato) | `rate_limit` |
| `status` ≥ 500, o errore di connessione/rete prima di ricevere una risposta | `network` |
| Qualsiasi altro caso (incluso un 400 generico o una risposta che non supera la validazione zod) | `invalid_response` |

Il nome della funzione (`classifyAnthropicError`) va generalizzato (es. `classifyGenerationError`) dato che non è più specifico di Anthropic; il tipo `ErrorCode` resta identico.

### Variabili d'ambiente

- `.env.local` / `.env.local.example`: `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`.

## Testing

Stesso pattern già stabilito in Fase 2:
- Test automatici (vitest) sullo schema zod della risposta itinerario (invariati, non toccano il provider) e sulla nuova logica di classificazione errori (adattati al meccanismo basato su `status` invece che su classi tipizzate).
- Nessun test automatico contro la vera API Gemini (costerebbe rate-limit quota e sarebbe non deterministico) — verifica manuale nel browser con una chiave reale, come nelle fasi precedenti.

## Variabili d'ambiente richieste

`GEMINI_API_KEY` — chiave gratuita generabile su Google AI Studio, nessuna carta di credito richiesta.
