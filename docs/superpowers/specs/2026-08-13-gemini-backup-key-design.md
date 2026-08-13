# Chiave Gemini di riserva

**Data:** 2026-08-13
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

Durante una sessione di test intensiva, la chiave `GEMINI_API_KEY` (tier gratuito) ha esaurito la propria quota giornaliera (429, `rate_limit`), bloccando ogni ulteriore generazione per il resto della giornata. È un problema realistico anche in uso normale (burst di richieste, RPM/RPD limitati sul tier gratuito). Si vuole una seconda chiave API di riserva che entri in gioco automaticamente quando la chiave primaria va in rate limit, senza richiedere un'astrazione multi-provider (resta comunque Gemini, stessa SDK, stesso codice di prompt/schema — una scelta deliberata per tenere la complessità minima, coerente con la decisione presa in precedenza di non voler un'astrazione multi-provider).

## Trigger del fallback

Il passaggio alla chiave di backup avviene **solo** quando l'errore della chiave primaria è classificato come `rate_limit` (429). Altri errori (chiave non valida/revocata — 401/403 — o errori di rete/server) restano errori di configurazione o di rete da correggere, non vengono aggirati con la chiave di backup: mascherare una chiave primaria rotta con un fallback silenzioso ritarderebbe la scoperta del problema reale.

## Modifiche

- **Nuova variabile d'ambiente opzionale:** `GEMINI_API_KEY_BACKUP`. Se non impostata, il comportamento dell'app resta identico a oggi (nessun fallback disponibile, un rate limit sulla chiave primaria restituisce direttamente l'errore `rate_limit` al client, come già avviene).
- **Nuovo modulo `lib/gemini-api-keys.ts`:** esporta una funzione pura `getGeminiApiKeys(): string[]` che legge `GEMINI_API_KEY` e `GEMINI_API_KEY_BACKUP` dalle variabili d'ambiente e restituisce l'elenco delle chiavi effettivamente configurate, in ordine (primaria per prima, poi backup), scartando valori assenti o stringa vuota.
- **`app/api/generate-itinerary/route.ts`:**
  - Il controllo attuale `if (!process.env.GEMINI_API_KEY)` viene sostituito da `const apiKeys = getGeminiApiKeys(); if (apiKeys.length === 0) { ... }` — stesso errore `config` di oggi quando l'elenco è vuoto (nessuna chiave configurata).
  - Al posto di costruire un solo client Gemini e chiamarlo una volta, si scorre `apiKeys`: per ogni chiave si costruisce un client (`new GoogleGenAI({ apiKey })`) e si chiama `generateContent` con la stessa configurazione di oggi (stesso modello, stesso `responseJsonSchema`, stesso `httpOptions.retryOptions` per gli errori 5xx/408 transitori, che restano invariati e si applicano indipendentemente a ciascuna chiave).
  - Se la chiamata fallisce e l'errore classificato (`classifyGenerationError`) è `rate_limit` **e** esiste una chiave successiva nell'elenco, si registra un log (`console.error`, senza includere il valore della chiave) e si ritenta con la chiave successiva.
  - Se la chiamata fallisce con un errore diverso da `rate_limit`, oppure è `rate_limit` ma non ci sono altre chiavi da provare, l'errore viene restituito al client esattamente come oggi (stesso mapping status/codice).
  - In caso di successo con qualunque chiave, la risposta al client è identica a oggi — nessuna indicazione di quale chiave sia stata usata.

## Cosa NON cambia

- Nessuna modifica allo schema di richiesta o di risposta dell'endpoint.
- L'errore `config` scatta solo quando **nessuna** delle due chiavi è configurata (stesso comportamento di oggi quando manca l'unica chiave). Se la primaria è assente/vuota ma la chiave di backup è configurata, l'app genera comunque usando la backup — non tratta la primaria come strettamente indispensabile, per evitare un fallimento evitabile quando esiste già una chiave funzionante.
- Nessuna astrazione multi-provider: resta solo Gemini, con due chiavi possibili.

## Testing

- `getGeminiApiKeys()` è pura (nessuna chiamata di rete) e viene testata direttamente con test automatici: solo chiave primaria configurata, primaria + backup configurate, nessuna delle due configurate (stringa vuota o assente per entrambe).
- Come per il resto del codice che chiama Gemini in questo progetto, la vera chiamata di rete — incluso il passaggio effettivo da chiave primaria a chiave di backup su un 429 reale — non viene testata in automatico (stesso principio già seguito per l'intero percorso di generazione). Si verifica dal vivo: la chiave primaria attuale è già in rate limit dalla sessione di test odierna, quindi basterà aggiungere una chiave di backup reale per osservare il fallback scattare su una richiesta vera, senza dover attendere o forzare ulteriormente il limite.

## Variabili d'ambiente

Nuova variabile opzionale: `GEMINI_API_KEY_BACKUP` — stessa natura di `GEMINI_API_KEY` (chiave Gemini AI Studio), da un account/progetto separato per avere una quota realmente indipendente.
