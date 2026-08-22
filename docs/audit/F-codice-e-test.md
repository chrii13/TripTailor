# Audit F — Qualità del codice, test, performance, igiene

Repo: `C:\Users\chris\Desktop\App Itinerari` — branch `feat/respiro-landing`, commit `aa3e245`.
Ambito: tutto il repository escluso `.claude/`. Nessun file è stato modificato.

## Esito reale dei comandi

| Comando | Esito |
|---|---|
| `npm test` | **29 file di test, 254 test, tutti passati**, 7.11s. Un warning di Vite: `vitest.config.ts` usa sintassi ESM in un file caricato come CommonJS (`configLoader: 'native'` futuro default). |
| `npm run lint` | **5 problemi: 0 errori, 5 warning** (dettaglio in H-13). |
| `npm run build` | **Successo.** Next 16.3.0 Turbopack, compilato in 1422ms, TypeScript in 3.5s, 9 pagine statiche generate. Route: `/`, `/_not-found`, `/scopri` statiche; `/crea` e le 3 API dinamiche. **Un warning:** `Next.js ignored package-lock.json in C:\Users\chris because it is outside the current Git repository` → suggerisce di impostare `turbopack.root`. |

Nota: `CLAUDE.md` dichiara "240 tests across 28 test files" — la realtà è 254 su 29. Vedi H-16.

---

# BLOCCANTE

## B-1 — Il meteo storico può divorare l'intero `maxDuration` prima ancora di chiamare Gemini
**File:** `lib/climate-forecast.ts:128-152`, `app/api/generate-itinerary/route.ts:20-40, 84-92`

`getClimateAverages` fa **5 richieste sequenziali** (una per anno), ognuna con `AbortSignal.timeout(8000)` e **un retry** dopo 500ms (`fetchHistoricalYear`). Caso peggiore reale: `5 × (8s + 0.5s + 8s) = 82,5s`, cioè oltre il `maxDuration = 60` della route. Basta un'indisponibilità di Open-Meteo (429/5xx, che è proprio il caso in cui il retry scatta) per far superare il tetto.

Il commento in `route.ts:26-28` afferma `meteo storico (fino a 8s)`: è falso di un ordine di grandezza. E il problema è strutturale, non solo di commento: tutta l'infrastruttura di `computeDeadline`/`getCallAttemptBudget` protegge **solo** le chiamate a Gemini; geocodifica e meteo consumano il budget senza alcun controllo, e quando il ciclo Gemini parte può trovare `callTimeoutMs === null` (rinuncia immediata) oppure — peggio — la piattaforma taglia la funzione con un **504 grezzo**, cioè esattamente ciò che il lavoro su `maxDuration` doveva evitare.

**Correzione proposta:** passare la deadline già calcolata (o un budget massimo in ms) a `getClimateAverages`, e dentro il ciclo per anno interrompere quando il tempo residuo scende sotto una soglia, restituendo la media parziale già raccolta (il codice supporta già risposte parziali: `averageDailyClimate` accetta un sottoinsieme di anni). In alternativa, un budget complessivo per la fase meteo (es. 12s) con `Promise.race` e nessun retry oltre il budget. Va anche corretto il commento in `route.ts:26-28`.

---

# IMPORTANTE

## I-1 — L'export .ics può lanciare un'eccezione non gestita e il bottone muore in silenzio
**File:** `components/itinerary-form/itinerary-result.tsx:163-168`, `lib/itinerary-to-ics.ts:8-12, 27-30`

`buildItineraryIcs` fa `activity.suggestedTime.split("–")` (trattino lungo, en dash) e passa i due pezzi a `toDateArray`. Ma `suggestedTime` è validato in `lib/itinerary-schema.ts:13` come `z.string()` puro: il formato `"HH:MM–HH:MM"` è **solo chiesto nel prompt** (`lib/itinerary-prompt.ts`, riga della voce `suggestedTime`), mai verificato. Se il modello risponde `"09:00 - 11:00"` con trattino corto (o `"Mattina presto"`), lo split restituisce un solo elemento, `endTime` è `undefined` e `time.split(":")` lancia `TypeError`.

`handleExportCalendar` non ha `try/catch` — a differenza di `handleDownloadPdf` (righe 170-183) che ha stato d'errore e log. Risultato: l'utente clicca "Esporta calendario", non succede assolutamente nulla, nessun messaggio.

**Correzione proposta:** (a) `try/catch` attorno a `buildItineraryIcs` con uno stato d'errore come per il PDF; (b) in `buildItineraryIcs`, split tollerante (`/\s*[–-]\s*/`) e **salto** dell'attività quando gli orari non sono parsabili, invece di far fallire l'intero file. Aggiungere il test corrispondente (oggi assente, vedi T-4).

## I-2 — Nessuna verifica server-side dell'itinerario: `days: []` è una risposta accettata
**File:** `lib/itinerary-schema.ts:18-26`, `app/api/generate-itinerary/route.ts:196-206`

`itineraryResponseSchema` accetta `days: []` e non impone alcuna relazione con l'intervallo di date richiesto. Il flusso `/scopri` ha invece tre livelli di verifica dell'output del modello (`verify-proposal-budget`, `verify-suggested-window`, `strip-suggested-window`) proprio perché "il modello non è attendibile". Il flusso `/crea`, che chiede una struttura molto più complessa, non ne ha nessuno: un itinerario di 3 giorni per un viaggio di 7 (o zero giorni) passa la validazione e arriva a schermo, e `ItineraryResult` mostra intestazione, budget e paese sopra un elenco vuoto.

**Correzione proposta:** minimo `z.array(itineraryDaySchema).min(1)`; meglio una verifica esplicita nella route che il numero di giorni e le date coincidano con l'intervallo richiesto, con `invalid_response` altrimenti — simmetrica a quella di `/scopri`. Non è refactoring cosmetico: è il buco di robustezza che il gemello ha già chiuso.

## I-3 — ~90 righe di ciclo Gemini duplicate verbatim fra le due route, e non testate
**File:** `app/api/generate-itinerary/route.ts:94-186` e `app/api/discover-trips/route.ts:80-172`

I due blocchi (label `modelLoop`, ciclo modelli × chiavi, `getCallAttemptBudget`, gestione `isTimeoutError`, fallback per `rate_limit`/`network`, `firstCode ??= code`, mappatura status 429/502, blocco `budgetExhausted`) sono identici carattere per carattere a meno delle stringhe di log e di due costanti. È la logica più delicata del progetto — e quella dove un fix applicato a una route resterebbe assente nell'altra senza che nulla lo segnali.

**Correzione proposta (giustificata rispetto alla sezione 5 del CLAUDE.md):** estrarre in `lib/gemini-generate.ts` una funzione `generateJsonWithFallback({ prompt, jsonSchema, maxOutputTokens, deadline, perCallCapMs, minCallTimeoutMs, logPrefix })` che restituisce `{ text, finishReason } | { errorCode }`. Il beneficio è concreto e duplice: una sola implementazione da correggere, e — soprattutto — una superficie **testabile** con un client Gemini iniettato (vedi T-2), cosa oggi impossibile perché il ciclo è inline nella route con `new GoogleGenAI` costruito dentro.

## I-4 — Zero test sull'interfaccia: nessun ambiente jsdom, nessuna testing-library
**File:** `vitest.config.ts:6` (`environment: "node"`), `package.json` (nessun `jsdom`/`@testing-library/*`)

Tutti i 254 test sono su funzioni pure e su validazione delle route. Non è coperto nulla di ciò che l'utente tocca:
- il ripristino da `sessionStorage` in `discover-form.tsx:223-234` (compreso lo `storedPayloadSchema` e il `reset` del form) — logica non banale, con un `safeParse` che decide se l'utente ritrova la sua ricerca o un form vuoto;
- la mappatura errore API → messaggio italiano in entrambi i form (e il bug I-5 sarebbe stato preso da un test);
- il `prefill` di `/crea`: `decodeCreaPrefill` è testato, ma il fatto che i valori decodificati finiscano davvero nei `defaultValues` del form (`itinerary-form.tsx:83-90`) no;
- `DestinationAutocomplete` (debounce, guardia `requestIdRef` contro le risposte fuori ordine, navigazione da tastiera): 164 righe, zero test.

**Correzione proposta:** aggiungere `jsdom` + `@testing-library/react` in devDependencies e un secondo progetto vitest con `environment: "jsdom"` per `components/**`. Iniziare dai tre casi con più valore per il rischio/riga: ripristino sessionStorage, mappatura errori, prefill.

## I-5 — Un errore di rete su `/crea` viene mostrato come "non siamo riusciti a generare l'itinerario"
**File:** `components/itinerary-form/itinerary-form.tsx:158-163`

Nel `catch`, il codice ricava il codice d'errore **dal messaggio dell'eccezione**. Ma `fetch` che fallisce (offline, DNS, connessione interrotta) lancia un `TypeError` il cui messaggio non è un `ErrorCode`, quindi si finisce sul fallback `"invalid_response"` → "Non siamo riusciti a generare l'itinerario. Riprova." L'utente offline legge un messaggio che incolpa la generazione invece della connessione. `discover-form.tsx:279-282` fa la cosa giusta (`catch` separato che imposta `ERROR_MESSAGES.network`): le due implementazioni divergono.

**Correzione proposta:** separare i due casi come in `discover-form`: `if (!response.ok)` imposta l'errore dal body; il `catch` del `fetch` imposta `ERROR_MESSAGES.network`.

## I-6 — Metadata e SEO praticamente assenti su un sito in produzione
**File:** `app/layout.tsx:23-26`, `app/crea/page.tsx`, `app/scopri/page.tsx`, `app/` (nessun `robots.ts`/`sitemap.ts`)

Presenti: `lang="it"` ✔, `favicon.ico` ✔, `next/font` con `Geist`/`Fraunces` ✔, un `title` e una `description` globali. Mancano:
- `metadataBase` → tutti gli URL relativi nei metadata non risolvono;
- **`openGraph` e `twitter`**: condividere `trip-tailor-ten.vercel.app` su WhatsApp/Telegram/Slack non mostra né titolo curato né immagine;
- `export const metadata` su `/crea` e `/scopri`: entrambe ereditano "TripTailor — Pianifica il tuo viaggio", quindi due pagine diverse hanno lo stesso titolo in cronologia e nei risultati di ricerca;
- `app/robots.ts` e `app/sitemap.ts`.

**Correzione proposta:** `metadataBase: new URL("https://trip-tailor-ten.vercel.app")` + blocco `openGraph` con un'immagine (anche `app/opengraph-image.tsx` generata) nel layout; un `metadata` per `/crea` e `/scopri`; `robots.ts` e `sitemap.ts` (poche righe, 3 URL).

## I-7 — Nessun `error.tsx`, `global-error.tsx` o `not-found.tsx`
**File:** `app/` (nessuno dei tre esiste)

Qualsiasi eccezione lanciata durante il render di un segmento (per esempio in `ItineraryResult`, che formatta liberamente dati provenienti dal modello) mostra in produzione la schermata d'errore nuda di Next, in inglese, fuori dal design system. Idem per un URL inesistente. `/crea` fa `await searchParams` ed è dinamica: un `loading.tsx` sarebbe anche opportuno, ma è secondario rispetto all'assenza di `error`.

**Correzione proposta:** un `app/error.tsx` (client) e un `app/not-found.tsx` coerenti con la palette, con link "Torna alla home".

## I-8 — Le route AI non hanno alcuna protezione dall'abuso
**File:** `app/api/discover-trips/route.ts:39`, `app/api/generate-itinerary/route.ts:42`, `app/api/geocode-autocomplete/route.ts:20`

Tre endpoint pubblici, senza autenticazione, che spendono quota Gemini e LocationIQ a ogni chiamata, con `maxDuration = 60`. Uno script banale in un ciclo esaurisce la quota (e su Vercel il tempo di esecuzione) in pochi minuti. Il fatto che esista `GEMINI_API_KEY_BACKUP` per il rate limit conferma che la quota è già una risorsa scarsa.

**Correzione proposta:** un rate limit per IP (`request.headers.get("x-forwarded-for")`), anche in memoria per istanza come primo argine, o `@vercel/firewall`. Va deciso con il proprietario del progetto — qui si segnala il rischio, non si prescrive la libreria.

## I-9 — `geocodeDestination` ha 6 rami e un solo test, sul ramo meno interessante
**File:** `lib/geocode-destination.ts:18-79`, `lib/geocode-destination.test.ts`

L'unico test è "restituisce null senza chiamare LocationIQ quando la chiave non è configurata". Non sono coperti: risposta non ok, array vuoto, luogo senza coordinate precise (`hasPreciseCoordinates` falso → `{lat: null, lon: null, countryCode}`, il ramo con il commento più lungo del file e quello che decide se il meteo verrà cercato), `lat`/`lon` non numerici, `country_code` maiuscolizzato, timeout. La stessa funzione decide se `getClimateAverages` viene chiamata: una regressione qui toglie il meteo a tutti senza rompere alcun test.

**Correzione proposta:** test con `fetch` mockato (come già fatto bene in `climate-forecast.test.ts`) per almeno i rami "coordinate non precise", "array vuoto", "risposta non ok". Stesso discorso, più in piccolo, per `app/api/geocode-autocomplete/route.ts:56-70`: il filtro per prefisso e la mappatura delle etichette non sono testati (i 3 test coprono solo i corti circuiti su lunghezza query).

---

# MINORE

## M-1 — L'arrotondamento avviene dopo il filtro budget: una card può mostrare un totale sopra il budget
**File:** `app/api/discover-trips/route.ts:189-194` (filtro sui valori grezzi) vs `components/discover-trips/proposal-card.tsx:39-43` (arrotondamento in visualizzazione)

`verifyProposalsAgainstBudget` scarta le proposte con `total > budget` usando le cifre grezze; la card poi arrotonda **voce per voce** verso l'alto o il basso. Con budget 1000 e una proposta a 985 (340+400+245) le voci arrotondate danno 350+400+250 = **1000**; con combinazioni meno fortunate si supera il budget dichiarato. `remaining` viene poi clampato a 0 (`proposal-card.tsx:41`), quindi lo sforamento non è visibile ma "Ti restano ~0€" appare su una proposta che di fatto sfora.

**Correzione proposta:** applicare `roundProposalCosts` **prima** del filtro budget (lato server), così ciò che viene filtrato è esattamente ciò che viene mostrato.

## M-2 — `key={highlight}` può collidere
**File:** `components/discover-trips/proposal-card.tsx:78`

Le `highlights` sono stringhe libere prodotte dal modello: due identiche nella stessa proposta (`highlights` non ha vincolo di unicità in `discover-trips-schema.ts:22`) generano chiavi React duplicate. **Correzione:** `key={`${index}-${highlight}`}` o solo l'indice — la lista è statica.

## M-3 — Quattro non-null assertion su invarianti garantite solo da uno zod `refine`
**File:** `lib/discover-trips-request.ts:77` (`request.dateRange!`), `lib/discover-trips-prompt.ts:20,24` (`flexiblePeriod!`), `lib/country-info.ts:39` (`country.languages!`)

L'invariante "esattamente uno fra `dateRange` e `flexiblePeriod`" vive in un `.refine()` che il tipo inferito non esprime: se un domani si allentasse quel refine, il compilatore resterebbe zitto e il codice esploderebbe a runtime. **Correzione proposta:** un discriminated union nello schema (`z.discriminatedUnion` o due varianti unite con `z.union`) eliminerebbe tutte e tre le prime assertion; per `country-info.ts:39` basta `country.languages?.[langCode] ?? langCode`.

## M-4 — `any` impliciti da `response.json()` e tipizzazioni per asserzione delle risposte esterne
**File:** `components/itinerary-form/itinerary-form.tsx:150`, `components/discover-trips/discover-form.tsx:266`, `components/itinerary-form/destination-autocomplete.tsx:70-72`, `app/api/geocode-autocomplete/route.ts:56`, `lib/geocode-destination.ts:41`

`await response.json()` restituisce `any`: `body.itinerary`, `body.weather`, `body.proposals ?? []` entrano nello stato React **senza validazione né tipo reale**. È tanto più stridente in `discover-form`, che valida rigorosamente ciò che rilegge da `sessionStorage` (`storedPayloadSchema`) ma si fida ciecamente della rete. Analogamente `const data: LocationIqResult[] = await response.json()` è un'asserzione mascherata da annotazione: se LocationIQ risponde `{error: "..."}` con 200, `data.filter` lancia (viene catturato, ma il tipo mente).

**Correzione proposta:** riusare gli schemi che già esistono — `itineraryResponseSchema.safeParse(body.itinerary)` e `z.array(tripProposalSchema).safeParse(body.proposals)` sul client, `safeParse` sui payload LocationIQ. Costo: poche righe, schemi già scritti.

## M-5 — Budget prefillato da `/scopri` può superare il massimo dello slider di `/crea`
**File:** `components/discover-trips/discover-form.tsx:493` (`max={20000}`) vs `components/itinerary-form/itinerary-form.tsx:341,347` (`max={10000}`), `lib/crea-query-params.ts:34-38` (accetta fino a 1.000.000)

Una proposta con `onSiteTotal > 10000` prefilla `/crea` con un valore fuori scala: lo slider si satura al massimo mentre il campo numerico mostra il valore reale, e i due si contraddicono finché l'utente non tocca nulla. **Correzione:** clampare il budget in `decodeCreaPrefill` (o allineare i due massimi).

## M-6 — L'header di `/crea` e quello di `/scopri` sono identici carattere per carattere
**File:** `app/crea/page.tsx:16-35` e `app/scopri/page.tsx:9-28` (~20 righe, stesse classi Tailwind)

Non è un rilievo estetico: è la barra che il CLAUDE.md indica come "punto aperto" del redesign, e oggi va modificata in due punti sincronizzandoli a mano. **Correzione proposta:** un `components/layout/page-header.tsx` senza parametri (non serve configurabilità: le due copie sono identiche).

## M-7 — Costanti e helper duplicati fra i due flussi
**File:** `isErrorCode` in `itinerary-form.tsx:59-66` e `discover-form.tsx:175-182` (identica); `ERROR_MESSAGES` in entrambi (testi diversi, stessa forma); `MAX_PARTICIPANTS = 20` in entrambi; l'effetto di rotazione dei messaggi di caricamento in `itinerary-form.tsx:117-134` e `discover-form.tsx:236-253` (identico, incluso il `while` di anti-ripetizione); `MS_PER_DAY` in `lib/schema.ts:11`, `lib/generate-itinerary-request.ts:4`, `lib/discover-trips-request.ts:5`, `discover-form.tsx:42`.

**Correzione proposta:** spostare `isErrorCode` accanto al tipo che verifica (`lib/generate-itinerary-errors.ts`, dove `ErrorCode` è già definito) e `MS_PER_DAY` in `lib/schema.ts` come export. Questi due sono a costo zero e a rischio zero. L'estrazione dell'effetto di rotazione in un hook (`useRotatingMessage`) è utile ma opzionale — non toccherei il resto dei form senza richiesta esplicita.

## M-8 — `discover-form.tsx` è a 587 righe con tre responsabilità mescolate
**File:** `components/discover-trips/discover-form.tsx`

Nello stesso file: due schemi zod (form + payload `sessionStorage`), la persistenza (`saveResultsToSession`/`loadResultsFromSession`), la chiamata API e ~350 righe di JSX. Gli schemi e la persistenza sono **logica pura e testabile**, oggi non testabile perché sepolta in un modulo `"use client"` con 20 import di componenti.

**Correzione proposta mirata:** estrarre solo `storedPayloadSchema` + le due funzioni di sessione in `lib/discover-trips-session.ts` (~40 righe) e testarle. Non propongo di spezzare il JSX.

## M-9 — Tutta la landing è client-side per via di framer-motion
**File:** 9 file su 10 in `components/landing/` iniziano con `"use client"`; solo `site-footer.tsx` e `reverse-search-destinations.tsx` restano server.

`page.tsx` è un server component, ma ogni sezione figlia è client perché importa `motion` dalla radice di `framer-motion`. Il risultato è che la pagina di marketing — la prima che chiunque carica — spedisce l'intero runtime di framer-motion per fare dei fade-in. Numeri misurati sul build: `.next/static/chunks` pesa **2,8 MB non compressi**, con il chunk più grosso a **1,30 MB** e il secondo a **305 KB**.

**Correzione proposta:** usare `LazyMotion` + il componente `m` con `domAnimation` (riduce il core a ~5 KB caricando le feature a domanda), oppure sostituire i reveal on-scroll più semplici (`final-cta`, `site-identity`, `reverse-search`) con CSS `@keyframes` + `animation-timeline`/IntersectionObserver, lasciando framer-motion solo a `itinerary-preview` e `scroll-progress` che ne usano davvero le capacità. Da valutare, non da fare d'ufficio.

## M-10 — `useMediaQuery` restituisce `false` al primo render: il calendario "salta" da 1 a 2 mesi
**File:** `lib/use-media-query.ts:26` (`getServerSnapshot` → `false`), usato in `itinerary-form.tsx:241` e `discover-form.tsx:369` per `numberOfMonths={isDesktop ? 2 : 1}`

La scelta è documentata e corretta per l'idratazione, ma su desktop il popover del calendario si apre a un mese e si allarga a due subito dopo. Poiché il calendario esiste solo dentro un `Popover` (renderizzato al clic, quindi ben dopo l'idratazione) l'impatto reale è basso, ma vale la pena verificarlo. **Correzione (se il salto si vede):** usare `hidden sm:block` / `sm:hidden` su due `Calendar` con `numberOfMonths` fisso, deciso dal CSS.

## M-11 — File orfani in `public/`
**File:** `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`

Nessuno è referenziato da alcun file di `app/`, `components/` o `lib/` (verificato con grep). Sono i residui dello scaffold (`35776d8 chore: scaffold Next.js project`). `public/fonts/*.ttf` sono invece usati da `lib/itinerary-pdf.tsx:24-26` ✔. **Correzione:** eliminarli.

## M-12 — `next.config.ts` è vuoto e il build emette un warning sul lockfile
**File:** `next.config.ts:3-5` (solo il commento `/* config options here */`)

Il build avverte: `Next.js ignored package-lock.json in C:\Users\chris because it is outside the current Git repository`. C'è un `package-lock.json` vagante nella home dell'utente e Turbopack sbaglia la root inferita. **Correzione:** `turbopack: { root: __dirname }` in `next.config.ts` (oppure eliminare il lockfile vagante fuori dal repo). Nessun impatto funzionale, ma è rumore a ogni build.

## M-13 — I 5 warning di lint, uno per uno
1-2. `discover-form.tsx:208` e `itinerary-form.tsx:111` — *React Compiler: Compilation Skipped, Use of incompatible library*, per `watch()` di react-hook-form. **Non è un difetto del codice**: il React Compiler rinuncia a memoizzare quei due componenti perché `watch()` restituisce funzioni non memoizzabili. Conseguenza reale: i due form più pesanti dell'app **non sono ottimizzati dal compiler** e si ri-renderizzano a ogni battuta. Si può eliminare passando a `useWatch({ control, name })` per campo (già usato correttamente in `participant-row.tsx:42`), che è memoizzabile e restringe i re-render al sottoalbero interessato. Vale la pena farlo: è la causa numero uno dei re-render inutili nei form.
3-5. `lib/itinerary-schema.test.ts:66,91,98` — `'sera'`, `'suggestedTime'`, `'details'` assegnati ma mai usati. Sono destrutturazioni "per omettere" (`const { sera, ...rest } = ...`). Innocui. **Correzione:** rinominare in `_sera` ecc. o configurare `varsIgnorePattern: "^_"`. Non urgente, ma finché restano, `npm run lint` non è pulito e i warning veri si mimetizzano.

## M-14 — `tsconfig.json` lascia sul tavolo due protezioni
**File:** `tsconfig.json:3` (`target: "ES2017"`), assenza di `noUncheckedIndexedAccess`

`strict: true` c'è ✔. Manca `noUncheckedIndexedAccess`, che avrebbe segnalato esattamente il bug I-1 (`suggestedTime.split("–")[1]` è potenzialmente `undefined`) e i vari `data[0]`, `parts[0]`, `currencyEntries[0]`. `target: ES2017` è il default dello scaffold e costringe a downlevel di sintassi che tutti i browser supportati capiscono. **Correzione:** valutare `noUncheckedIndexedAccess` (attivarlo produrrà una manciata di errori da sistemare, tutti reali) e alzare il target a ES2022. Da concordare — tocca `tsconfig.json`, che la sezione 5 del CLAUDE.md protegge.

## M-15 — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` documentate ma inutilizzate
**File:** `.env.local.example:4-5`, `CLAUDE.md` (Required Environment Variables)

Nessun riferimento nel codice: sono per la fase futura "export calendario", che nel frattempo è stata realizzata **lato client con la libreria `ics`**, senza Google Calendar API. Restano quindi due variabili che chi configura il progetto crede obbligatorie. **Correzione:** commentarle nell'esempio come "fase futura, non necessarie oggi", o rimuoverle.

## M-16 — Il CLAUDE.md descrive un progetto più piccolo di quello reale
**File:** `CLAUDE.md`, Sezione 1

Divergenze verificate:
- **Numeri di test:** dice "240 tests across 28 test files", la realtà è **254 su 29**.
- **Mappa della struttura:** non menziona affatto `lib/itinerary-pdf.tsx` (349 righe, export PDF), `lib/itinerary-to-ics.ts` (export .ics), `lib/climate-forecast.ts`, `lib/geocode-destination.ts`, `lib/country-info.ts`, `lib/use-media-query.ts`, `lib/gemini-api-keys.ts`, `lib/gemini-call-budget.ts`, `lib/generate-itinerary-errors.ts`, `lib/itinerary-prompt.ts`, `lib/generate-itinerary-request.ts`, `lib/itinerary-schema.ts`, `components/landing/reverse-search-destinations.tsx` (184 righe di bandiere SVG), né `@vercel/analytics` nel layout.
- **"Nessuna logica AI/meteo/calendario ancora implementata (fasi successive)"** e **"Nessun backend/API route nella Fase 1"**: entrambe smentite dal codice — AI, meteo, geocodifica, export ICS e PDF sono in produzione.
- Il gruppo del form è etichettato **"Le preferenze"** (`itinerary-form.tsx:325`), non "Le tue preferenze".
- Le route API in `docs`/struttura elencano solo `discover-trips`; `generate-itinerary` e `geocode-autocomplete` compaiono solo di sfuggita nel testo.

**Correzione proposta:** aggiornare la Sezione 1 (che il file stesso incarica Claude di mantenere). Sezioni 2-6 restano intoccate.

---

# Buchi di copertura (riepilogo ordinato per rischio)

- **T-1** Il ciclo di fallback Gemini (modelli × chiavi, timeout, `budgetExhausted`) non ha **nessun** test in nessuna delle due route: i test coprono solo i 400 di validazione e il caso "nessuna chiave". `gemini-call-budget.test.ts` testa l'aritmetica pura, ma non che la route la usi correttamente. È il codice più complesso e più duplicato del progetto. Sbloccabile con I-3 (estrazione + iniezione del client).
- **T-2** La pipeline di post-elaborazione di `/api/discover-trips` (`verifyProposalsAgainstBudget` → `verifyProposalsAgainstSuggestedWindow` → `stripSuggestedWindowIfExact`, `route.ts:188-200`) non è testata **come sequenza**: ogni pezzo ha ottimi test unitari, l'ordine e il cablaggio no. Invertire due chiamate non farebbe fallire nulla.
- **T-3** `lib/geocode-destination.ts`: 1 test su ~6 rami (vedi I-9).
- **T-4** `buildItineraryIcs` con `suggestedTime` malformato: assente (vedi I-1). I 5 test esistenti usano tutti il formato perfetto con en dash.
- **T-5** Tutta l'interfaccia (vedi I-4).
- **T-6** `lib/itinerary-pdf.tsx` (349 righe): `itinerary-pdf.test.tsx` sono 62 righe — verificare quanto copre della resa; in ogni caso l'unico consumatore è un `import()` dinamico non testato.

**Test che verificano l'ovvio più che la logica** (nessuno da rimuovere, ma non contateli come rete di sicurezza): `schema.test.ts` "rifiuta un'età negativa", "rifiuta zero partecipanti", "accetta un viaggio valido"; `itinerary-schema.test.ts` "rifiuta una risposta dove 'days' non è un array", "rifiuta un'attività senza title" — testano il comportamento di zod, non regole di dominio. Al contrario, `verify-proposal-budget.test.ts` e `round-proposal-costs.test.ts` sono esemplari: casi limite reali, motivazioni nei titoli.

---

# IDEA

- **ID-1** Aggiungere gli script mancanti: `"typecheck": "tsc --noEmit"` (oggi il typecheck avviene solo dentro `next build`, ~3,5s che si pagano insieme al bundling) e `"test:coverage": "vitest run --coverage"` — nessuna misura di copertura è oggi ottenibile.
- **ID-2** Convertire `vitest.config.ts` in `vitest.config.mts` per far tacere il warning di Vite sul `configLoader` nativo, che comparirà a ogni `npm test` finché non si interviene.
- **ID-3** Il fallback su `GEMINI_API_KEY_BACKUP` scatta solo su 429 (`route.ts`: `code === "rate_limit" && hasNextKey`). Con una chiave primaria revocata (401 → `config`) la route fallisce subito pur avendo una chiave di riserva valida. È coerente con quanto documentato nel CLAUDE.md, quindi lo segnalo come scelta da riconsiderare, non come difetto.
- **ID-4** `roundToNearestFifty` è usata anche per il "budget residuo" e il "totale a persona" (`proposal-card.tsx:42-43`), cioè su valori che non sono voci di costo: il nome della funzione non descrive più ciò che fa (arrotonda a 5 sotto i 100€). Rinominarla `roundMoney` renderebbe onesta la lettura delle call site. Puramente nominale.
