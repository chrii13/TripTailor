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
  - **Test:** `npm test` (vitest, 89 tests across 12 test files)
  - **Lint/Typecheck:** `npm run lint`
- **Architecture & Conventions:**
  - **Stato:** Fase 1 in corso — scaffold Next.js + landing page informativa + form di input utente su route dedicata. Nessuna logica AI/meteo/calendario/mobile ancora implementata (fasi successive).
  - **Struttura:**
    ```
    app/
      layout.tsx
      page.tsx              # landing page informativa (hero, mete, come funziona, CTA)
      crea/
        page.tsx             # renderizza <ItineraryForm />
      globals.css
    components/
      landing/
        site-nav.tsx              # barra verde sticky in alto: logo + link a #mete/#chi-siamo/#come-funziona
        hero.tsx                 # hero: titolo display + CTA, con anteprima itinerario accanto
        itinerary-preview.tsx    # elemento firma: card itinerario che si compila in sequenza
        scroll-progress.tsx      # striscia di avanzamento scroll dentro la nav sticky
        popular-destinations.tsx # card mete gettonate (solo testo/icone, no foto)
        site-identity.tsx        # sezione identità/missione del sito
        how-it-works.tsx         # sezione "Come funziona" (timeline 01-04)
        final-cta.tsx            # CTA finale
      itinerary-form/
        itinerary-form.tsx       # form + riepilogo, stesso componente/stato
        participant-row.tsx      # riga dinamica partecipante
        trip-summary.tsx         # vista riepilogo (post-submit)
      ui/                         # componenti shadcn generati
    lib/
      schema.ts                # zod schema condiviso form/riepilogo
      utils.ts                 # cn() helper shadcn
      popular-destinations.ts  # lista statica mete gettonate (nessun fetch/API)
    ```
  - Landing page (`/`) separata dal form (`/crea`), aggiunta 2026-08-17: hero con bottone centrale "Crea il tuo itinerario", sezione mete più gettonate (solo testo/icone, niente foto — coerente con "niente backend extra" di Fase 1), sezione identità del sito, sezione "Come funziona" (numerata perché descrive una sequenza reale del processo). Palette e font invariati rispetto al resto dell'app. Animazioni con framer-motion (fade/stagger in hero, reveal on-scroll nelle sezioni), `useReducedMotion` rispettato ovunque.
  - Nessun backend/API route nella Fase 1 oltre a quelle già esistenti (generate-itinerary, geocode-autocomplete): tutto client-side, dati tenuti in stato React (nessuna persistenza).
  - Il riepilogo post-invio del form appare nella stessa pagina (il form si trasforma in riepilogo), non su una route separata. Bottone "Modifica" riporta al form con i dati precompilati.
  - Composizione gruppo: righe dinamiche per partecipante (tipo + età), non semplice conteggio.
  - Date viaggio: date range picker (check-in/check-out).
  - Budget: slider in € + campo note testuali per lo stile di viaggio.
  - Stile visivo (rifatto 2026-08-17, branch `redesign/wise-idiom`): sistema "gravità + voltaggio" ispirato al design system Wise. Token in `app/globals.css` — Canvas `#ffffff`, Nebbia `#ecefe9` (superfici), Bosco `#1a4d33` (`--primary`: testo forte, sezioni invertite), Inchiostro `#3d423c` (`--foreground`), Sole `#f0b429` (`--voltage`: **solo** CTA e stati attivi, un elemento per schermata), wash `#e4f1dc` (`--accent`). Regole: niente gradienti né ombre (bordi 1px), pill `rounded-full` per bottoni/badge, `10px` per card e input, display Fraunces 900 maiuscolo con `tracking-[-0.03em]`, sezioni alternate chiaro/scuro per il ritmo. Analisi comparativa e razionale in `docs/design/wise-breakdown.html`.
  - Design docs dettagliate per fase in `docs/superpowers/specs/`.
  - Composizione gruppo: 3 tipi (Bambino/a 0-12, Ragazzo/a 13-25, Adulto/a 26-100), età obbligatoria da selezionare esplicitamente (nessun default) tramite menu a tendina, non input numerico libero.
  - Decisione (2026-08-11): l'autocompletamento della Destinazione (suggerimenti città mentre l'utente scrive) è rimandato alla Fase 2, da introdurre insieme al backend per la generazione AI — richiede una API route (es. proxy verso OpenStreetMap Nominatim) e quindi rompe la regola "niente backend" della Fase 1, meglio farlo in un colpo solo con l'altro backend.
  - Pattern "Date del viaggio" e "Chi viaggia": bottone compatto con icona + testo auto-esplicativo che apre un Popover (stile Booking.com), senza etichetta separata sopra (evita la ridondanza label+testo). "Chi viaggia" apre un Popover con le righe tipo+età per persona (età individuale mantenuta, non un contatore aggregato come Booking) e un bottone "Fatto" per chiudere.
  - Feedback utente (2026-08-11): il design crema/smeraldo "non convince ancora del tutto". Risolto il 2026-08-17 con il redesign sopra: la landing è passata a Canvas bianco + Bosco + Sole. La pagina `/crea` eredita i nuovi token ma non è stata ancora ridisegnata (mantiene gradiente e ombra sulla card del form).
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