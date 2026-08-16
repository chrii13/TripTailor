# Fallback su modello Gemini alternativo

**Data:** 2026-08-14
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

Durante lo sviluppo, l'app ha ripetutamente incontrato due problemi distinti sulla generazione con Gemini, entrambi bloccanti:

1. **Quota giornaliera esaurita (RPD)** — il fallback sulla chiave di backup (già implementato, vedi `2026-08-13-gemini-backup-key-design.md`) copre parzialmente questo caso, ma solo se la seconda chiave ha ancora quota disponibile sullo stesso modello.
2. **Sovraccarico del modello ("high demand", HTTP 503)** — un errore lato Google, non legato alla quota, che colpisce chiunque usi lo stesso modello nello stesso momento. Il fallback sulla chiave attuale non aiuta qui, perché è classificato `network`, non `rate_limit`, e il codice attuale scatta solo su quest'ultimo.

Verificato che le quote di Gemini sono tracciate per **coppia (progetto, modello)**, non a livello di solo progetto/account (confermato dal campo `quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier"` negli errori 429 osservati). Questo significa che un modello diverso ha una quota giornaliera realmente separata, e — trattandosi tipicamente di un modello più maturo — è anche meno esposto ai picchi di domanda che colpiscono i modelli appena rilasciati (pattern osservato: i modelli nuovi/preview vengono spesso sovraccaricati prima che Google scali la capacità server assegnata).

## Modello di fallback

`gemini-2.5-flash`, dopo il modello primario `gemini-flash-latest` (oggi alias di `gemini-3.6-flash`). Scelto verificando dal vivo, con la chiave reale del progetto, l'elenco dei modelli effettivamente disponibili (`ai.models.list()`) — non a memoria. `gemini-2.5-flash` è un modello più maturo e stabile, quindi con probabilità più alta di avere capacità disponibile quando `gemini-3.6-flash` è sovraccarico.

Nota: `CLAUDE.md` registra che `gemini-2.5-flash` è stato ritirato per le chiavi create di recente — se la chiave di backup è tra queste, il fallback su questo modello potrebbe non essere disponibile per quella chiave specifica; il codice gestisce comunque questo caso restituendo al client il primo errore significativo incontrato, non un errore fuorviante.

## Come si combina con il fallback sulle chiavi

Il meccanismo esistente (`lib/gemini-api-keys.ts`, `getGeminiApiKeys()`) resta invariato: elenco ordinato di chiavi (primaria, poi backup se configurata). Si aggiunge un livello annidato sopra:

- **Livello esterno — modelli**: si prova prima `gemini-flash-latest`, poi (solo se necessario) `gemini-2.5-flash`.
- **Livello interno — chiavi**: per ciascun modello, si prova ogni chiave disponibile in ordine, esattamente come already implementato oggi.

**Condizioni di passaggio al livello successivo — non sono le stesse per i due livelli:**

- **Cambio chiave** (stesso modello, chiave successiva): scatta **solo** su `rate_limit` — nessuna modifica rispetto a oggi. Un errore di configurazione (401/403) o di altro tipo continua a non attivare il tentativo con la chiave successiva.
- **Cambio modello** (dopo aver esaurito tutte le chiavi disponibili su un modello): scatta su `rate_limit` **oppure** su `network` (errori 5xx, incluso il 503 "high demand" che ha motivato questa spec). Questa è l'unica condizione allargata rispetto al comportamento attuale, e si applica solo al passaggio di modello, non al passaggio di chiave.

Se anche l'ultima chiave dell'ultimo modello disponibile fallisce, l'errore torna al client esattamente come oggi (stesso `ErrorCode`, stesso status HTTP) — nessuna modifica al contratto della risposta.

## Logging

Un nuovo messaggio di log distinto per il passaggio di modello (es. "modello Gemini non disponibile, tentativo con il modello successivo"), separato da quello già esistente per il passaggio di chiave ("chiave Gemini #N in rate limit, tentativo con la chiave successiva") — permette di distinguere dai log quale livello di fallback ha effettivamente attutito un problema.

## Cosa NON cambia

- Nessuna modifica allo schema di richiesta/risposta dell'endpoint.
- Nessuna indicazione al client su quale modello o chiave abbia generato la risposta.
- Il meccanismo di retry automatico già esistente per errori transitori (`httpOptions.retryOptions`, 408/500/502/503/504) resta invariato e si applica indipendentemente a ogni combinazione modello×chiave tentata.
- Nessuna astrazione multi-provider: resta solo Gemini, con più modelli possibili oltre alle chiavi.

## Testing

- Come per il resto del codice che chiama Gemini in questo progetto, la vera chiamata di rete (incluso il passaggio effettivo tra modelli) non viene testata in automatico — si verifica dal vivo, stesso principio già seguito per il fallback sulle chiavi.
- Verifica manuale nel browser/via richieste dirette, approfittando del fatto che il problema di sovraccarico si sta ripresentando proprio in questi giorni — permette di osservare il passaggio di modello scattare su un caso reale, non simulato.

## Variabili d'ambiente

Nessuna nuova variabile — il modello di fallback è un valore fisso nel codice, non configurabile da chi ospita l'app (a differenza delle chiavi API, che sono per natura credenziali personali).
