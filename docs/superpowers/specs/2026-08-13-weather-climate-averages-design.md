# Meteo (medie climatiche storiche)

**Data:** 2026-08-13
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

Fase 3 del roadmap (`CLAUDE.md` menzionava "OpenWeatherMap, fase futura"). Verificato che **le vere previsioni meteo coprono solo un orizzonte breve** (5 giorni gratis senza carta, 8 giorni con One Call API 3.0 che richiede comunque una carta di credito registrata) — inadeguato per un'app dove i viaggi si pianificano con settimane o mesi di anticipo. Si usa quindi sempre una **media climatica storica** (non una previsione), calcolata dagli ultimi 5 anni, indipendentemente da quanto è lontana la data del viaggio — scelta esplicita per avere un comportamento coerente (stesso tipo di dato mostrato sempre, non a volte previsione vera e a volte media).

**Provider cambiato da OpenWeatherMap a Open-Meteo**: gratuito, nessuna chiave API, nessuna carta, 10.000 richieste/giorno per uso non commerciale, con archivio storico dal 1940 — esattamente il dato necessario per calcolare una media. Verificato funzionante con una chiamata reale. `OPENWEATHER_API_KEY` (placeholder mai usato, da Fase 1) va rimosso da `CLAUDE.md`/env file di esempio.

## Flusso

1. Il form invia la richiesta a `generate-itinerary` come oggi (nessuna modifica al form/validazione).
2. **Nuovo, prima di generare il prompt**: geolocalizzazione della destinazione tramite LocationIQ — riusa `LOCATIONIQ_API_KEY` già configurata, ma con l'endpoint di ricerca diretta (`/v1/search`), diverso da quello di autocompletamento già in uso. Se fallisce (destinazione non trovata, chiave assente, errore di rete), si procede senza meteo — **non blocca mai la generazione dell'itinerario**.
3. **Nuovo, se la geolocalizzazione riesce**: per ognuno degli ultimi 5 anni, interroga Open-Meteo (archivio storico) per lo stesso intervallo di date del viaggio ma nell'anno passato corrispondente (5 chiamate in parallelo). Per ogni giorno del viaggio calcola:
   - temperatura massima media e minima media (arrotondate)
   - probabilità di pioggia = percentuale di anni passati in cui quel giorno ha avuto precipitazioni misurabili
   
   Se una o più delle 5 chiamate falliscono, si procede con la media calcolata sugli anni disponibili (basta che almeno un anno abbia dato risultati); se tutte falliscono, nessun dato meteo, generazione comunque non bloccata.
4. Se i dati climatici sono disponibili, vengono inclusi nel prompt inviato a Gemini, con l'istruzione di usarli per calibrare le attività proposte (più attività al coperto nei giorni storicamente piovosi, ritmo adattato alla temperatura) — **non è richiesto che l'AI commenti esplicitamente il meteo nel testo generato**, solo che ne tenga conto nella scelta delle attività. L'istruzione attuale nel prompt "Non fare alcun riferimento alle condizioni climatiche" viene rimossa (era lì solo perché il meteo non esisteva ancora).
5. La risposta della route include i dati climatici accanto all'itinerario generato (campo separato, non fa parte dello schema che Gemini deve rispettare — sono dati che calcoliamo noi, non generati dall'AI).
6. Nella UI, ogni card giorno mostra — solo se disponibile per quel giorno — una riga con temperatura media e probabilità di pioggia, in testo semplice coerente con lo stile esistente (nessuna icona/emoji, come per il resto della card). Se il meteo non è disponibile, la riga non compare, nessun placeholder.

## Calcolo della media

- Ultimi **5 anni** (dall'anno corrente meno 1 a meno 5 — sempre anni interamente passati, indipendentemente da quando cade il viaggio).
- Per ogni giorno del viaggio, si prende lo stesso giorno di calendario (stesso mese/giorno) in ciascuno dei 5 anni storici, e si fa la media dei valori disponibili.
- "Probabilità di pioggia" = quota di anni (tra quelli con dati disponibili per quel giorno) in cui le precipitazioni registrate sono state maggiori di zero.

## Cosa NON cambia

- Il contratto della route resta compatibile: la generazione funziona esattamente come prima se il meteo non è disponibile.
- Lo schema `itineraryResponseSchema` (quello che Gemini deve rispettare) resta invariato — il meteo è un campo separato nella risposta, non fa parte di quello che l'AI genera.
- Nessuna modifica al form o alla sua validazione.

## Testing

- Test automatici (vitest) sulla logica pura di calcolo della media climatica (aggregazione di dati storici multi-anno in medie/percentuali) — è logica deterministica testabile con dati di esempio, a differenza delle chiamate AI.
- Nessun test automatico sulle vere chiamate a LocationIQ (ricerca diretta) o Open-Meteo — stesso principio delle fasi precedenti.
- Verifica manuale nel browser con una generazione reale.

## Variabili d'ambiente

Nessuna nuova variabile. `LOCATIONIQ_API_KEY` (già esistente) viene riusata per la geolocalizzazione. `OPENWEATHER_API_KEY` (mai stata realmente usata) va rimossa da `CLAUDE.md` e dai file `.env.local*` di esempio.
