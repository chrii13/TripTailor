# Autocompletamento Destinazione

**Data:** 2026-08-13
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

L'autocompletamento della Destinazione era stato rimandato in Fase 1 con la nota "da introdurre insieme al backend per la generazione AI" (`CLAUDE.md`), dato che richiede una API route e quindi un backend, che ora esiste (Fase 2, provider Gemini).

La nota originale suggeriva Nominatim (OpenStreetMap) come proxy. Verificato che **non è utilizzabile**: la sua usage policy vieta esplicitamente l'uso per autocompletamento ("Nominatim software does not support autocomplete/type-ahead... you must not implement such a service"). Si usa invece **LocationIQ**, un servizio commerciale con tier gratuito (5.000 richieste/giorno, 2/secondo, chiave API dedicata — niente istanza condivisa "a titolo di cortesia" come l'alternativa gratuita senza chiave, Photon).

## Backend

Nuova route `app/api/geocode-autocomplete/route.ts`, **GET** (è una ricerca, non un invio — a differenza di `generate-itinerary` che è POST).

- Riceve `q` come query string param.
- Validazione minima lato server (query mancante o sotto i 3 caratteri → risposta vuota, nessuna chiamata a LocationIQ): non serve uno schema zod dedicato per un singolo parametro stringa così semplice, un controllo diretto basta.
- Chiama `https://api.locationiq.com/v1/autocomplete?key=...&q=...&limit=6`, con `LOCATIONIQ_API_KEY` letta da variabile d'ambiente, mai esposta al client (stesso pattern di `GEMINI_API_KEY`).
- Mappa la risposta di LocationIQ (array di oggetti con `place_id`, `display_name`, coordinate, classificazione OSM, ecc.) a una forma minima e propria: `{ results: Array<{ id: string; label: string }> }` — `id` da `place_id`, `label` da `display_name`. Non si espone al client nessun dettaglio grezzo di LocationIQ (coordinate, tipo OSM, indirizzo strutturato) che non serve.
- Gestione errori: se la chiamata a LocationIQ fallisce (rete, rate limit, chiave non configurata), la route logga l'errore lato server e risponde comunque con `{ results: [] }` (status 502) — mai un errore che il client deve gestire in modo speciale. L'autocompletamento è un miglioramento opzionale, non un requisito: se non funziona, il campo resta un campo di testo normale, senza banner d'errore.

## Frontend

Nuovo componente `components/itinerary-form/destination-autocomplete.tsx`, che sostituisce l'attuale `<Input {...register("destination")} />` dentro `itinerary-form.tsx`. Estratto in un componente a parte (come già fatto per `participant-row.tsx`) per non appesantire ulteriormente `itinerary-form.tsx` con la logica di debounce/tastiera/dropdown.

- Passa da `register("destination")` a `Controller` (react-hook-form), per intercettare l'input e gestire la selezione di un suggerimento.
- **Debounce**: 300ms dall'ultima battitura prima di interrogare `/api/geocode-autocomplete`.
- **Soglia minima**: 3 caratteri prima di far partire la ricerca.
- **Dropdown**: lista di suggerimenti sotto il campo (posizionamento assoluto, stile coerente con gli altri popover del form — bordo, sfondo `--popover`, ombra).
- **Tastiera**: freccia giù/su per scorrere i suggerimenti, Invio per selezionare quello evidenziato, Esc per chiudere la lista senza selezionare.
- **Click**: selezionare un suggerimento riempie il campo con la sua `label` e chiude la lista. Il click sui suggerimenti usa `onMouseDown` con `preventDefault()` (non `onClick`) per evitare che il campo perda il focus (evento `blur`) prima che il click venga registrato — problema classico di questo pattern.
- Se l'utente digita liberamente senza mai selezionare un suggerimento, il campo resta comunque valido (nessun requisito che il valore provenga da un suggerimento — la validazione esistente, `z.string().trim().min(1)`, non cambia).

## Testing

- Test automatico (vitest) sulla route: verifica che una query mancante o troppo corta restituisca `{ results: [] }` senza chiamare LocationIQ (stesso pattern del test di `generate-itinerary` che verifica il branch di validazione richiesta senza mai costruire un client verso il provider reale).
- Nessun test automatico sulla vera chiamata a LocationIQ (stesso principio delle fasi precedenti).
- Il componente frontend (debounce, tastiera, dropdown) non ha test automatici — il progetto non ha una libreria di test per componenti React installata, ed è coerente con come sono state verificate tutte le altre parti interattive della UI finora: verifica manuale nel browser.

## Variabili d'ambiente

`LOCATIONIQ_API_KEY` — nuova, richiede registrazione gratuita su LocationIQ (chiave dedicata, non condivisa).
