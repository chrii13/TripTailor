# Fase 2 — Generazione itinerario via Claude API

**Data:** 2026-08-11
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

La Fase 1 ha consegnato un form di raccolta dati (destinazione, date, viaggiatori con tipo+età, budget, note stile) che al submit mostrava solo un riepilogo statico di sola lettura — nessuna generazione reale. Il bottone di submit si chiama già "Genera itinerario", ma finora non generava nulla.

Questa spec copre la Fase 2: introdurre il primo backend del progetto e collegare la generazione reale dell'itinerario tramite l'API Claude, con stima costi e orari di apertura/chiusura indicativi per le attività.

Fuori scope per questa fase (rimandato):
- Autocompletamento della Destinazione (sotto-progetto successivo, riuserà lo stesso backend).
- Integrazione meteo (Fase 3).
- Export calendario (Fase 4).
- App mobile (Fase 5).
- Persistenza dei risultati generati (si perdono al refresh, coerente con l'approccio client-only della Fase 1 — l'unica novità è la chiamata server-side alla generazione).

## Flusso

- Il submit del form (`ItineraryForm`) non mostra più un riepilogo statico: chiama direttamente la nuova API route per generare l'itinerario.
- Nuovo stato del componente: `mode: "form" | "loading" | "result" | "error"`.
  - `"loading"`: mostrato durante la chiamata (può richiedere fino a ~30s). Il bottone di submit si disabilita e mostra uno spinner con testo tipo "Generazione in corso…", il resto del form resta visibile ma non interagibile.
  - `"result"`: nuovo componente `itinerary-result.tsx` — una fascia compatta in cima con i parametri del viaggio (destinazione, date, viaggiatori, budget) seguita dall'itinerario giorno per giorno, più un bottone "Modifica" che torna al form con i dati intatti (stesso pattern già usato in Fase 1: nessun reset, nessun cambio di route).
  - `"error"`: torna alla vista form (dati intatti) con un banner d'errore in cima, messaggio personalizzato in base al tipo di errore (vedi sotto).
- **Limite durata viaggio**: se l'intervallo di date supera **14 giorni**, il form mostra un errore di validazione prima di poter inviare (evita chiamate lunghe/costose). *(Nota per il futuro: un'eventuale versione "Pro" a pagamento potrebbe rimuovere questo limite — idea registrata, non pianificata per questa fase.)*

## API route

- `app/api/generate-itinerary/route.ts` — Next.js Route Handler, `POST`.
- Riceve i dati del form già validati (destinazione, date, partecipanti, budget, note stile).
- Chiama l'API Claude **lato server** (`ANTHROPIC_API_KEY` letta da variabile d'ambiente, mai esposta al client) usando il modello **Claude Sonnet 5**.
- Timeout di 30s sulla chiamata (via `AbortController`).
- Richiede una risposta **strutturata** (JSON con schema fisso via tool use / structured output di Claude), non testo libero da interpretare — riduce il rischio di risposte malformate.
- Valida la risposta di Claude con uno schema zod dedicato prima di restituirla al client. Se non valida, tratta come errore "risposta non valida".

## Schema della risposta itinerario

```ts
{
  days: [
    {
      date: string;        // es. "2026-09-12"
      mattina: Activity[];
      pomeriggio: Activity[];
      sera: Activity[];
    }
  ]
}

interface Activity {
  title: string;
  description: string;
  estimatedCost: string;      // es. "~15€", "Gratuito"
  openingHours?: string;      // es. "9:00–19:00", "Chiuso il lunedì" — solo dove pertinente (non per attività generiche come una passeggiata)
}
```

## Contenuto del prompt

Il prompt include tutti i dati già raccolti dal form:
- Destinazione
- Numero di giorni (calcolato dall'intervallo di date)
- Composizione gruppo: tipo (bambino/ragazzo/adulto) ed età di ciascun viaggiatore
- Budget indicativo
- Note sullo stile di viaggio

Istruzioni per l'AI:
- Adattare ritmo e tipo di attività alla composizione del gruppo (bambini presenti → ritmi più rilassati, parchi; solo adulti → nightlife, trekking impegnativi ecc.), come da spec originale del progetto.
- Fornire una stima di costo indicativa per ogni attività.
- Fornire orari di apertura/chiusura indicativi dove pertinente (musei, monumenti, locali) — non per attività generiche.
- Nessun riferimento al meteo (fuori scope, Fase 3).

## Gestione errori

La API route classifica l'errore e risponde con un codice generico (mai dettagli tecnici sensibili come lo stato della chiave API):

| Codice | Quando capita | Messaggio utente |
|---|---|---|
| `network` | Timeout, connessione persa, Anthropic irraggiungibile | "Non siamo riusciti a contattare il servizio di generazione. Controlla la connessione e riprova." |
| `config` | Chiave API mancante/non valida (errore di configurazione server, non dell'utente) | "Si è verificato un problema tecnico. Riprova tra poco." |
| `rate_limit` | Troppe richieste in un breve periodo | "Troppe richieste in questo momento, riprova tra qualche secondo." |
| `invalid_response` | La risposta di Claude non rispetta lo schema atteso | "Non siamo riusciti a generare l'itinerario. Riprova." |

I dettagli tecnici reali di ogni errore vengono loggati solo lato server, mai esposti al client.

## Testing

- Test automatici (vitest) per:
  - Lo schema zod della risposta itinerario (validazione di risposte valide e malformate).
  - La logica di classificazione degli errori nella API route (dato un tipo di errore simulato, verifica che venga restituito il codice corretto).
- Nessun test automatico per la chiamata reale all'API Claude (costerebbe e sarebbe non deterministico) — verifica manuale nel browser con una chiamata reale, come fatto nelle fasi precedenti.

## Variabili d'ambiente

`ANTHROPIC_API_KEY` — già presente come placeholder in `.env.local` / `.env.local.example` dalla Fase 1, ora effettivamente utilizzata.
