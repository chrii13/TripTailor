# Universal CLAUDE.md — Self-Updating Project Memory & Guidelines

> 🤖 **INSTRUCTIONS FOR CLAUDE CODE:**
> This file is your persistent project memory and behavioral handbook.
> 1. **Read** this file at the start of every session.
> 2. **Maintain Section 1 (Project Snapshot):** Whenever new packages are installed, scripts/commands are added to `package.json`, or key architectural decisions are made, UPDATE Section 1 automatically.
> 3. **Preserve Rules:** NEVER modify or delete Sections 2 through 6 (Behavioral Guardrails) unless explicitly requested by the user.

---

## 📍 1. PROJECT SNAPSHOT (Maintained by Claude)
*Claude: Update this section automatically as the project evolves.*

- **Project Name:** "TripTailor" — Web App (MVP) + Mobile App per la creazione automatica di itinerari di viaggio personalizzati (AI, meteo, export calendario).
- **Produzione:** https://trip-tailor-ten.vercel.app/ (Vercel, deploy automatico da `master` su GitHub — repository https://github.com/chrii13/TripTailor).
- **Tech Stack:** Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, react-hook-form + zod, framer-motion (animazioni landing page). AI: Google Gemini (`@google/genai`, modello `gemini-flash-latest` — alias Google al Flash più recente, oggi `gemini-3.6-flash`; `gemini-2.5-flash` è stato ritirato per le chiavi API di nuova creazione). Autocompletamento destinazione: LocationIQ (`LOCATIONIQ_API_KEY`). Meteo: Open-Meteo (`archive-api.open-meteo.com`, nessuna chiave — media climatica storica sugli ultimi 5 anni, non una previsione). Calendario: Google Calendar API / libreria `ics` (fase futura). Mobile: da definire (fase futura).
- **Primary Commands:**
  - **Dev:** `npm run dev`
  - **Build:** `npm run build`
  - **Test:** `npm test` (vitest, 275 tests across 30 test files; `.claude/**` è escluso in `vitest.config.ts`, il comando semplice basta)
  - **Lint/Typecheck:** `npm run lint`
- **Architecture & Conventions:**
  - **Stato:** Fase 1 in corso — scaffold Next.js + landing page informativa + form di input utente su route dedicata. Nessuna logica AI/meteo/calendario/mobile ancora implementata (fasi successive).
  - **Struttura:**
    ```
    app/
      layout.tsx            # metadata radice: metadataBase, title.template, Open Graph, Twitter
      page.tsx              # landing page informativa (hero, mete, come funziona, CTA)
      not-found.tsx         # 404 in italiano, nel sistema visivo (3 vie d'uscita)
      error.tsx             # errore di rendering, client component con reset()
      global-error.tsx      # errore del layout radice: ha html/body e font propri
      opengraph-image.tsx   # immagine 1200x630 per i link condivisi, generata con next/og
      robots.ts
      sitemap.ts
      crea/
        page.tsx             # header sticky (logo + link "Home") + <ItineraryForm>, legge destination/from/to/budget/p dalla query
      scopri/
        page.tsx             # intestazione sticky + <DiscoverForm>
      api/
        discover-trips/
          route.ts           # budget+viaggiatori+date+partenza → proposte costificate
      globals.css
    components/
      landing/
        site-nav.tsx              # barra verde sticky in alto: logo + link a #mete/#chi-siamo/#come-funziona
        hero.tsx                 # hero: titolo display + CTA, con anteprima itinerario accanto
        itinerary-preview.tsx    # elemento firma: card itinerario che si compila in sequenza
        scroll-progress.tsx      # striscia di avanzamento scroll dentro la nav sticky
        popular-destinations.tsx # card mete gettonate, cliccabili → /crea?destination=... (solo testo/icone, no foto)
        reverse-search.tsx       # sezione landing sul percorso dal budget
        site-identity.tsx        # sezione identità/missione del sito
        how-it-works.tsx         # sezione "Come funziona" (timeline 01-04)
        final-cta.tsx            # CTA finale
        site-footer.tsx          # footer: naviga, fonti dei dati, dati personali, progetto
      itinerary-form/
        itinerary-form.tsx       # form + riepilogo, stesso componente/stato; accetta prop prefill (CreaPrefill)
        participant-row.tsx      # riga dinamica partecipante
        itinerary-result.tsx     # vista risultato (post-submit): riepilogo, paese, giorni, dialog attività
        destination-autocomplete.tsx # campo Destinazione con suggerimenti LocationIQ
      discover-trips/
        discover-form.tsx    # form + stato + chiamata API
        discover-results.tsx # griglia delle proposte
        proposal-card.tsx    # scheda singola con ripartizione costi
      ui/                         # componenti shadcn generati
    lib/
      schema.ts                # zod schema condiviso form/riepilogo
      utils.ts                 # cn() helper shadcn
      popular-destinations.ts  # lista statica mete gettonate + query di prefill (nessun fetch/API)
      crea-query-params.ts     # prefill di /crea via query string
      discover-trips-request.ts  # schema richiesta (date esatte o periodo flessibile, non entrambi)
      discover-trips-request-body.ts # form → corpo richiesta /api/discover-trips
      discover-trips-schema.ts   # schema risposta AI (+ suggestedFrom/suggestedTo opzionali)
      discover-trips-prompt.ts   # prompt (funzione pura)
      discover-trips-flexible-period.ts # mesi selezionabili per il periodo flessibile
      discover-trips-proposal-dates.ts  # date da passare a /crea per una proposta
      discover-trips-suggested-window-label.ts # etichetta "10 - 17 ott" della finestra suggerita
      discover-trips-recap.ts    # ricapitolazione testuale della ricerca sulla card
      verify-proposal-budget.ts  # ricalcolo totali + filtro budget + soglia di plausibilità
      verify-suggested-window.ts # scarta proposte con finestra fuori mese o durata sbagliata
      strip-suggested-window.ts  # rimuove suggestedFrom/suggestedTo in modalità date esatte
      round-proposal-costs.ts    # arrotondamento cifre mostrate (cinquina/cinquantina)
      real-price-search-link.ts  # link "Verifica i prezzi reali" → ricerca Google generica
      calendar-date.ts           # date di calendario yyyy-MM-dd: serializzazione, schema, formattazione
      site-metadata.ts           # costante OG_IMAGE condivisa dai metadata delle pagine
      generate-itinerary-request-body.ts # form → corpo richiesta /api/generate-itinerary
    ```
  - Landing page (`/`) separata dal form (`/crea`), aggiunta 2026-08-17: hero con bottone centrale "Crea il tuo itinerario", sezione mete più gettonate (solo testo/icone, niente foto — coerente con "niente backend extra" di Fase 1), sezione identità del sito, sezione "Come funziona" (numerata perché descrive una sequenza reale del processo). Palette e font invariati rispetto al resto dell'app. Animazioni con framer-motion (fade/stagger in hero, reveal on-scroll nelle sezioni), `useReducedMotion` rispettato ovunque.
  - Le card delle mete gettonate sono cliccabili (aggiunto 2026-08-18): portano a `/crea?destination=<nome, paese>`, `app/crea/page.tsx` legge i query param `destination`, `from`, `to`, `budget` e `p` (server component async, Next.js 15+/16 `searchParams` è una Promise) tramite `decodeCreaPrefill` (`lib/crea-query-params.ts`) e passa il risultato come prop `prefill` (`CreaPrefill`) a `<ItineraryForm>`, che lo usa per precompilare destinazione, date, budget e partecipanti.
  - Header di `/crea` (rifatto 2026-08-18): sticky, logo a sinistra + link "← Home" a destra (prima era solo il logo, striscia vuota).
  - Barra sticky della landing (`site-nav.tsx`, 2026-08-19): le voci in riga compaiono solo da `lg` (1024px) in su — sotto vanno in overflow orizzontale, perché logo + pill delle quattro voci + CTA chiedono 827px. Sotto `lg` le stesse voci vivono in un menu a comparsa (Popover) aperto da un bottone pill con icona a destra; le etichette restano intere (non accorciarle) e "Dal budget" non è più nascosta sotto `sm`, sta nel menu come le altre. Il bottone "Crea itinerario" resta `hidden sm:inline-flex`. Aggiungendo una voce si aggiorna solo `NAV_LINKS`, ma va rimisurata la larghezza minima della riga: se supera 1024px serve alzare la soglia.
  - Nessun backend/API route nella Fase 1 oltre a quelle già esistenti (generate-itinerary, geocode-autocomplete): tutto client-side, dati tenuti in stato React (nessuna persistenza).
  - Il riepilogo post-invio del form appare nella stessa pagina (il form si trasforma in riepilogo), non su una route separata. Bottone "Modifica" riporta al form con i dati precompilati.
  - Composizione gruppo: righe dinamiche per partecipante (tipo + età), non semplice conteggio.
  - Date viaggio: date range picker (check-in/check-out).
  - Budget: slider in € + campo note testuali per lo stile di viaggio.
  - Campo "Cosa non vuoi perderti" (aggiunto 2026-08-18): input opzionale di testo libero (`mustSee`, max 200 caratteri), ultimo del gruppo "Le tue preferenze". Il prompt istruisce Gemini a inserirlo come attività vera in uno dei giorni — con orario e costo come le altre — scegliendo giorno e fascia in base a posizione e orari di apertura, non a nominarlo dentro la descrizione di un'altra attività.
  - Il form di `/crea` è diviso in due gruppi etichettati: "Il viaggio" (destinazione, date, chi viaggia) e "Le tue preferenze" (budget, stile, cosa non vuoi perderti), separati da un filetto. La CTA vive in una fascia Nebbia che chiude la card.
  - Stile visivo (rifatto 2026-08-17, branch `redesign/wise-idiom`): sistema "gravità + voltaggio" ispirato al design system Wise. Token in `app/globals.css` — Canvas `#ffffff`, Nebbia `#ecefe9` (superfici), Bosco `#1a4d33` (`--primary`: testo forte, sezioni invertite), Inchiostro `#3d423c` (`--foreground`), Sole `#f0b429` (`--voltage`: CTA, stati attivi, le barrette di accento e le sottolineature spesse sulle parole chiave — mai a ridosso della CTA), wash `#e4f1dc` (`--accent`). Regole: niente gradienti né ombre (bordi 1px), pill `rounded-full` per bottoni/badge, `10px` per card e input, display Fraunces 900 maiuscolo con `tracking-[-0.03em]`, sezioni alternate chiaro/scuro per il ritmo. Analisi comparativa e razionale in `docs/design/wise-breakdown.html`.
  - Design docs dettagliate per fase in `docs/superpowers/specs/`.
  - Composizione gruppo: 3 tipi (Bambino/a 0-12, Ragazzo/a 13-25, Adulto/a 26-100), età obbligatoria da selezionare esplicitamente (nessun default) tramite menu a tendina, non input numerico libero.
  - Decisione (2026-08-11): l'autocompletamento della Destinazione (suggerimenti città mentre l'utente scrive) è rimandato alla Fase 2, da introdurre insieme al backend per la generazione AI — richiede una API route (es. proxy verso OpenStreetMap Nominatim) e quindi rompe la regola "niente backend" della Fase 1, meglio farlo in un colpo solo con l'altro backend.
  - Pattern "Date del viaggio" e "Chi viaggia": bottone compatto con icona + testo auto-esplicativo che apre un Popover (stile Booking.com), senza etichetta separata sopra (evita la ridondanza label+testo). "Chi viaggia" apre un Popover con le righe tipo+età per persona (età individuale mantenuta, non un contatore aggregato come Booking) e un bottone "Fatto" per chiudere. **Riconfermato il 2026-08-18**: questi due restano gli unici campi senza etichetta sopra, mentre Destinazione, Budget, Stile e "Cosa non vuoi perderti" ce l'hanno. L'asimmetria è consapevole, non una dimenticanza — non "correggerla" aggiungendo le etichette senza chiedere. Nota per chi rivaluterà la scelta: la motivazione originale (evitare la ridondanza etichetta+testo) di fatto non vale più, perché gli altri campi hanno già etichetta sopra e placeholder dentro; l'utente ha comunque scelto di tenere l'asimmetria.
  - Il design crema/smeraldo della prima versione è stato abbandonato il 2026-08-17 in favore del sistema descritto sopra: la landing è passata a Canvas bianco + Bosco + Sole. La pagina `/crea` eredita i nuovi token (card del form ora `shadow-none border-border`, niente più gradiente/ombra).
  - Enfasi sulle parole chiave (aggiunta 2026-08-19, ristretta ai titoli il 2026-08-19): classe utility `.emphasis-mark-display` in `app/globals.css`, solo per i titoli Fraunces — una barra Sole come `background-image` dietro la parola, non colore del testo, perché il giallo su testo misura 1.9:1 (sotto la soglia 4.5:1) mentre come sfondo passa dietro ai discendenti e resta a norma. Applicata a 1-2 parole per titolo in `components/landing/` (mai vicino a un bottone CTA): "itinerario" e "su misura" in hero.tsx, "gettonate" in popular-destinations.tsx, "budget" in reverse-search.tsx. Non più usata sul corpo testo: rimossa da "si parte dal budget" (how-it-works.tsx) e "5 possibili proposte di viaggio" (reverse-search.tsx), e con essa la classe `.emphasis-mark` (corpo testo), eliminata da `app/globals.css` perché rimasta senza usi. Saltate volutamente site-identity.tsx (il titolo è già tutto in `text-voltage`, un'altra parola sottolineata affollerebbe la sezione) e final-cta.tsx (è la fascia della CTA stessa, che già usa `bg-voltage` sul bottone).
  - Ricerca inversa (aggiunta 2026-08-18): `/scopri` chiede budget (slider fino a 20.000€), viaggiatori, date e città di partenza — **mai la destinazione**, che è ciò che la funzionalità deve scoprire — e restituisce 5 proposte con stime AI di trasporto/alloggio/spese in loco. Il costo di trasporto è mode-agnostic (`travelPerPerson`/`travelTotal`, etichetta "Viaggio A/R"): le proposte arrivano anche prezzate come treno o traghetto, non solo aereo, quindi non si assume un mezzo. I totali sono ricalcolati lato server (`verify-proposal-budget.ts`): il campo `total` restituito dal modello non è considerato attendibile. Oltre al tetto di budget, un filtro di plausibilità scarta le proposte sotto 25€ a persona a notte di alloggio+spese in loco, perché il modello reverse-ingegnerizza i prezzi per obbedire a qualsiasi budget — un controllo puramente aritmetico non farebbe mai scattare lo stato vuoto onesto. Le cifre mostrate sono arrotondate voce per voce (cinquina sotto i 100€, cinquantina sopra) e il totale della card deriva dalla somma delle voci già arrotondate, non da un arrotondamento proprio, così le righe tornano sempre col totale. Ogni card mostra anche notti, budget residuo ("Ti restano ~X€"), totale a persona (se i viaggiatori sono più di uno) e un link "Verifica i prezzi reali" a una ricerca Google generica (non un comparatore voli). Le proposte restano in `sessionStorage`, così scegliere una proposta e tornare indietro non le perde, e "Modifica la ricerca" le ripristina. La proposta scelta passa a `/crea` il suo `onSiteTotal` come budget, non il totale del viaggio. Date: modalità "esatte" (date range picker) o "flessibili" (un mese fra i 12 successivi + un numero di notti, `vacationType` incluso come testo libero fino a 100 caratteri, sei chip come scorciatoia); in modalità flessibile è il modello a scegliere la finestra migliore dentro il mese per ogni proposta (`suggestedFrom`/`suggestedTo` + motivazione in `whyItFits`, mostrata come "Consigliato 5 ott - 12 ott") — le date non sono mai calcolate localmente, perché sarebbe una finestra inventata invece che scelta dal modello; il server scarta le proposte la cui finestra esce dal mese richiesto o non dura il numero di notti richiesto, e in modalità esatte i campi `suggestedFrom`/`suggestedTo` vengono rimossi del tutto dalla risposta. Le cifre sono stime dichiarate come tali nell'interfaccia, non prezzi prenotabili.
  - **Metadata e anteprima dei link (aggiunto 2026-08-21):** `app/layout.tsx` definisce `metadataBase` (`https://trip-tailor-ten.vercel.app`) e `title.template` (`%s — TripTailor`); ogni pagina dichiara il proprio `title` **senza** suffisso, che lo aggiunge il template. Attenzione a due trappole verificate col `curl` sull'HTML servito, non dedotte: (1) dichiarare `openGraph` a livello di pagina **sostituisce in blocco** quello del layout **e disattiva `app/opengraph-image.tsx` per quella pagina** — per questo `openGraph.images`/`twitter.images` ripetono la costante `OG_IMAGE` di `lib/site-metadata.ts`; (2) il `title.template` non si applica ai tag Open Graph, quindi lì il suffisso va scritto a mano. Aggiungendo una pagina, copiare il blocco di `/crea` e aggiornare `app/sitemap.ts`.
  - **Date di calendario (regola introdotta 2026-08-21, non derogabile):** una data di viaggio è una data di *calendario*, non un istante. Sul filo (corpo delle richieste, query string) viaggia **solo** come stringa `yyyy-MM-dd`, e si ricostruisce come mezzanotte **locale** tramite `lib/calendar-date.ts` (`toCalendarDate`, `calendarDateSchema`, `formatCalendarDate`). **Mai** mandare oggetti `Date` dentro `JSON.stringify` e **mai** usare `new Date("2026-10-10")`, che interpreta in UTC. Motivo: fino al 2026-08-21 in produzione ogni itinerario era datato un giorno prima di quello richiesto — il browser italiano serializzava la mezzanotte locale come `...T22:00:00Z` e il server Vercel (UTC) la rileggeva come il giorno prima. Il difetto **non si riproduce in locale**, dove client e server condividono il fuso: per questo i test di `calendar-date.test.ts` cambiano `process.env.TZ` a metà percorso, e vanno mantenuti così. Vale per entrambi i flussi (`/crea` e `/scopri`) e per la catena proposta → query string → prefill → API.
  - `maxDuration` (aggiunto 2026-08-20, tempi della fase pre-AI rivisti il 2026-08-21): `discover-trips` e `generate-itinerary` dichiarano `export const maxDuration = 60` (tetto del piano Vercel Hobby, comodo anche sotto quello Pro) e usano ciascuna una costante `GEMINI_CALL_TIMEOUT_MS` per il client Gemini (50s per `discover-trips`, 45s per `generate-itinerary`, che ha anche geocodifica+meteo prima della chiamata AI) tenuta sotto quel tetto: così è il nostro handler a restituire l'errore in italiano, non un 504 nudo della piattaforma. `geocode-autocomplete` ha anche lei `maxDuration` (10s, tetto di sicurezza), ma abortisce già la propria fetch a 5s. In `generate-itinerary` la fase pre-AI (geocodifica + meteo) ha un tetto **condiviso** di 12s (`PRE_AI_PHASE_MS`): prima non era conteggiata affatto e il meteo storico, con 5 anni sequenziali e ritentativo, poteva da solo arrivare a 82s contro un `maxDuration` di 60, vanificando tutta l'impalcatura delle scadenze. `getClimateAverages` consulta ora il residuo prima di ogni anno e si accontenta di quelli raccolti (media su 3 anni invece che su 5: degradazione voluta, meglio di un errore); il timeout per anno è sceso a 3s e il ritentativo per-anno è stato rimosso.
  - Test/lint e worktree Claude Code (2026-08-20): `.claude/**` è escluso sia in `vitest.config.ts` (`test.exclude`, in aggiunta ai default di vitest) sia in `eslint.config.mjs` (`globalIgnores`), perché la cartella contiene un worktree con una copia completa del progetto. `npm test` e `npm run lint` ora danno da soli i numeri veri (240 test su 28 file, 5 warning 0 errori), senza bisogno di esclusioni manuali.
- **Required Environment Variables:**
  - `GEMINI_API_KEY` — Google Gemini API (generazione itinerario)
  - `GEMINI_API_KEY_BACKUP` — chiave Gemini di riserva opzionale, usata automaticamente solo quando la chiave primaria va in rate limit (429)
  - `LOCATIONIQ_API_KEY` — LocationIQ (autocompletamento destinazione)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google Calendar API (fase futura, export calendario)

---

## 🔍 2. INSPECT BEFORE EDITING
- **Read first:** Always read existing code, schemas, and config files before making edits.
- **Search existing patterns:** Check how similar features or components are structured in the codebase and follow those established patterns.

---

## 🤔 3. THINK BEFORE CODING
Don't assume. Surface tradeoffs.
- **State assumptions explicitly:** Ask if uncertain before implementing.
- **Present alternatives:** If multiple reasonable interpretations exist, present them briefly — don't pick silently.
- **Push back:** If a simpler approach exists, suggest it before coding.

---

## 🎯 4. SIMPLICITY FIRST
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that wasn't requested.
- If you write 150 lines and it could be 40, rewrite it.
- **Rule:** "Would a senior engineer say this is overcomplicated?" If yes, simplify.

---

## ✂️ 5. SURGICAL CHANGES
Touch only what you must. Clean up only your own mess.
- **No unsolicited refactoring:** Don't "improve" adjacent code, comments, or formatting.
- **Match existing style:** Follow the current codebase style strictly.
- **Clean up your orphans:** Remove unused imports/variables created by *your* changes. Do not touch pre-existing dead code.
- **Config files:** Do NOT modify `package.json`, `tsconfig.json`, or environment files without confirmation.

---

## ✅ 6. GOAL-DRIVEN VERIFICATION & FAIL-FAST
- **Verifiable goals:** Define how to verify changes (build check, test, or visual output) before marking a task as done.
- **Loop limit:** If a build, test, or script fails **2 times consecutively** after your changes, **STOP**. Explain what went wrong, show the log, and ask for guidance instead of trying infinite blind fixes.