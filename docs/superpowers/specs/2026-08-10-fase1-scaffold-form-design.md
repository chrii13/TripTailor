# Fase 1 — Scaffold progetto + Form di input utente

**Data:** 2026-08-10
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

Progetto (nome provvisorio "App Itinerari", **non definitivo**) per la generazione automatica di itinerari di viaggio personalizzati via AI, con integrazione meteo e export calendario. Il progetto parte da zero (nessun codice esistente).

Questa spec copre **solo la Fase 1**: scaffold del progetto Next.js e form di raccolta dati utente. Le fasi successive (generazione itinerario via Claude API, integrazione meteo, integrazione calendario, app mobile) sono esplicitamente fuori scope e verranno pianificate separatamente con la propria spec.

## Obiettivo

Avere un progetto Next.js funzionante con un form responsive e d'impatto che raccoglie tutti i dati necessari a un futuro generatore di itinerari (destinazione, date, composizione gruppo con età, budget/stile), valida i dati e mostra un riepilogo modificabile — senza ancora generare nulla.

## Stack tecnologico

- **Next.js** (App Router, TypeScript)
- **Package manager:** npm
- **Styling/UI:** Tailwind CSS + shadcn/ui
- **Form:** react-hook-form + zod
- Nessun backend/API route in questa fase — tutto client-side, stato solo in memoria (nessuna persistenza).

## Struttura cartelle

```
app/
  layout.tsx
  page.tsx              # renderizza <ItineraryForm />
  globals.css
components/
  itinerary-form/
    itinerary-form.tsx       # form + riepilogo, stesso componente/stato
    participant-row.tsx      # riga dinamica partecipante
    trip-summary.tsx         # vista riepilogo (post-submit)
  ui/                         # componenti shadcn generati
lib/
  schema.ts                # zod schema condiviso form/riepilogo
  utils.ts                 # cn() helper shadcn
.env.local
.env.local.example
```

## Componenti e data flow

- `itinerary-form.tsx` possiede lo stato via `useForm` (react-hook-form) e uno stato locale `mode: "form" | "summary"`.
  - Submit valido → `mode = "summary"`.
  - Bottone "Modifica" nel riepilogo → `mode = "form"`, senza reset dei valori (react-hook-form mantiene i dati compilati).
  - Nessun cambio di route: tutto avviene sulla stessa pagina (`/`).
- `participant-row.tsx` usa `useFieldArray` di react-hook-form per le righe dinamiche di partecipanti (tipo adulto/bambino + età), con "+ Aggiungi persona" e rimozione riga.
- `trip-summary.tsx` è puramente presentazionale: riceve i dati validati come props, li mostra in sola lettura. Nessuna chiamata API (non ce ne sono in questa fase).
- `lib/schema.ts` definisce un unico zod schema (destinazione, date, array partecipanti, budget, note stile) usato sia per validare il form sia come tipo condiviso per il riepilogo — fonte di verità unica.

## Campi del form

Layout: **singola pagina**, tutte le sezioni visibili insieme (no wizard multi-step).

1. **Destinazione** — input testo, obbligatorio.
2. **Date del viaggio** — date range picker (check-in/check-out, componente shadcn Calendar + Popover). Vincolo: data fine ≥ data inizio.
3. **Composizione gruppo** — righe dinamiche per partecipante: tipo (adulto/bambino) + età (numero ≥ 0). Minimo 1 partecipante richiesto.
4. **Budget e stile** — slider per budget totale indicativo in €, più campo di testo libero per note sullo stile di viaggio (es. "economico", "lusso", preferenze).

## Validazione ed errori

- Validazione zod inline, messaggi mostrati sotto ogni campo da react-hook-form.
- Vincoli: destinazione non vuota; data fine ≥ data inizio; almeno 1 partecipante con età ≥ 0.
- Nessuna gestione di errori di rete/API (non applicabile in questa fase).

## Stile visivo

L'utente sta progettando l'aspetto grafico separatamente su claude.ai/design (progetto di tipo Design System). L'implementazione di questa fase parte con uno stile Tailwind/shadcn moderno di default (componenti shadcn standard, palette neutra), pensato per essere facilmente sostituito quando il design sarà pronto — nessuno stile hardcoded difficile da rimuovere.

## Variabili d'ambiente (`.env.local` / `.env.local.example`)

Solo placeholder in questa fase (nessuna integrazione ancora attiva):

- `ANTHROPIC_API_KEY` — Claude API (fase futura: generazione itinerario)
- `OPENWEATHER_API_KEY` — OpenWeatherMap (fase futura: meteo)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google Calendar API (fase futura: export calendario)

## Fuori scope (fasi future, spec separate)

- Generazione itinerario via Claude API e stima costi.
- Integrazione meteo (OpenWeatherMap) e consigli dinamici.
- Export calendario (Google Calendar API / `.ics`).
- App mobile (stack da definire).

## Testing

- Nessun test automatico richiesto esplicitamente in questa fase iniziale; verifica manuale: `npm run dev`, compilazione form, validazione errori, transizione form ↔ riepilogo, responsive su mobile/desktop.
