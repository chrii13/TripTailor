# Audit — flusso "Crea un itinerario"

Analisi statica (nessun file modificato, nessun server avviato). Verifiche puntuali di
comportamento JS/date fatte con `node -e` su espressioni pure.

File nell'ambito:
`app/crea/page.tsx`, `components/itinerary-form/*`, `lib/schema.ts`,
`lib/crea-query-params.ts`, più i confini toccati dal flusso
(`lib/generate-itinerary-request.ts`, `lib/itinerary-schema.ts`, `lib/itinerary-to-ics.ts`,
`app/api/generate-itinerary/route.ts`).

---

## BLOCCANTE

### 1. Tutte le date del viaggio slittano di un giorno indietro in produzione (fuso orario)
**Gravità:** BLOCCANTE — **VERIFICATO** (meccanismo confermato in codice + prova su `node`)
**File:** `components/itinerary-form/itinerary-form.tsx:148` (`JSON.stringify(data)`),
`lib/generate-itinerary-request.ts:10-11` (`z.coerce.date()`),
`lib/itinerary-prompt.ts:51` (`format(dateRange.from, "dd/MM/yyyy")`),
`lib/climate-forecast.ts:124` (`format(addDays(tripStart, dayIndex), "yyyy-MM-dd")`),
`lib/crea-query-params.ts:29` (`new Date(\`${str}T00:00:00\`)`)

**Come si riproduce**
1. Utente in Italia (UTC+1/+2) apre `/crea`, sceglie 20/08/2026 → 27/08/2026.
2. Invia. Il server gira su Vercel con `TZ=UTC`.

**Cosa succede**
`react-day-picker` (e il prefill da query) producono `Date` a mezzanotte **locale**.
`JSON.stringify` le serializza in UTC:

```
new Date('2026-08-20T00:00:00') → "2026-08-19T22:00:00.000Z"   // verificato
```

Il server le riparse e le formatta con `date-fns format`, che usa il fuso **del server**:

```
TZ=UTC → format(new Date('2026-08-19T22:00:00.000Z'), 'dd/MM/yyyy') === '19/08/2026'  // verificato
```

Conseguenze a catena, tutte di un giorno indietro:
- il prompt dice "dal 19/08/2026 al 26/08/2026" invece di 20-27;
- `getClimateAverages` interroga Open-Meteo per la finestra sbagliata e genera le
  chiavi `date` a partire dallo stesso `tripStart` slittato;
- il modello restituisce `days[].date` = 2026-08-19… e la **vista risultato mostra
  all'utente date diverse da quelle che ha scelto**;
- l'export ICS e il PDF ereditano le stesse date sbagliate.

Non si vede in sviluppo su una macchina italiana (client e server condividono il fuso):
è per questo che è passato inosservato. In produzione colpisce l'intero pubblico
target (fusi a offset positivo). Gli utenti in America (offset negativo) non sono
colpiti perché la mezzanotte locale cade nello stesso giorno UTC.

**Cosa dovrebbe succedere**
La data scelta è un *giorno di calendario*, non un istante: deve viaggiare come tale.

**Correzione proposta**
Trasmettere le date come stringhe `yyyy-MM-dd` invece che come `Date`:
serializzare nel client con `format(from, "yyyy-MM-dd")` e, lato server, accettare
`z.iso.date()` e ricostruire con `new Date(y, m-1, d)` (o lavorare direttamente sulle
stringhe). In alternativa, se si vuole toccare meno, normalizzare nel client a
mezzogiorno UTC (`Date.UTC(y, m, d, 12)`) — ma è un cerotto: resta sensibile a fusi
oltre ±12. Da coprire con un test che gira con `TZ=UTC` e input generato in `Europe/Rome`.

---

### 2. "Esporta calendario" va in eccezione non gestita se l'orario non usa il trattino lungo
**Gravità:** BLOCCANTE — **VERIFICATO**
**File:** `lib/itinerary-to-ics.ts:29` (`activity.suggestedTime.split("–")`),
`lib/itinerary-to-ics.ts:7-11` (`toDateArray`),
`components/itinerary-form/itinerary-result.tsx:163-168` (`handleExportCalendar`, senza try/catch),
`lib/itinerary-schema.ts:14` (`suggestedTime: z.string()`, nessun formato imposto)

**Come si riproduce**
Il modello restituisce `suggestedTime` con trattino normale (`"10:00-12:30"`), oppure
un orario singolo (`"10:00"`), oppure "Tutto il giorno". Lo schema lo accetta —
è solo `z.string()`. L'utente clicca "Esporta calendario".

**Cosa succede**

```
'10:00-12:30'.split('–')  → ['10:00-12:30']
endTime === undefined → endTime.split(':')  → TypeError  // verificato
```

`handleExportCalendar` non ha try/catch: l'eccezione risale nell'handler React,
nessun file viene scaricato e **l'utente non vede nulla** (nessun messaggio, nessun
cambiamento). Il pulsante sembra semplicemente rotto. Il PDF, per confronto, è
protetto (`itinerary-result.tsx:179-183`) e mostra un messaggio in italiano.

**Cosa dovrebbe succedere**
O il formato è garantito dallo schema, o l'export non deve poter crashare.

**Correzione proposta**
Due mosse, entrambe piccole:
1. In `lib/itinerary-schema.ts`, vincolare `suggestedTime` con un regex
   (`/^\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}$/`) così una risposta fuori formato
   diventa `invalid_response` con retry, invece di arrivare all'interfaccia.
2. In `itinerary-to-ics.ts`, fare lo split su `/\s*[–—-]\s*/` e saltare (o dare durata
   di default) le attività senza orario di fine; avvolgere `handleExportCalendar` in
   try/catch con lo stesso pattern di stato d'errore già usato per il PDF.

---

## IMPORTANTE

### 3. Limiti di lunghezza solo lato server: l'utente entra in un vicolo cieco con messaggio fuorviante
**Gravità:** IMPORTANTE — **VERIFICATO**
**File:** `lib/schema.ts:39,61,62` (nessun `.max()` su `destination`, `styleNotes`, `mustSee`)
vs `lib/generate-itinerary-request.ts:7,25,26` (`max(200)`, `max(1000)`, `max(200)`);
input senza `maxLength` in `itinerary-form.tsx:377-381` e `389-393`,
`destination-autocomplete.tsx:95`

**Come si riproduce**
Incollare 250 caratteri in "Cosa non vuoi perderti" (o >1000 in "Stile di viaggio",
o arrivare su `/crea?destination=<300 caratteri>`) e premere "Genera itinerario".

**Cosa succede**
La validazione client passa. Il server risponde 400 `{error:"invalid_response"}`
(`route.ts:59-70`). L'utente legge "Non siamo riusciti a generare l'itinerario.
Riprova." — un messaggio che invita a **riprovare una cosa che fallirà sempre**,
senza dire quale campo è troppo lungo. Il CLAUDE.md documenta "max 200 caratteri"
per `mustSee`, ma il limite non è imposto da nessuna parte nel client.

**Cosa dovrebbe succedere**
Il limite va mostrato prima dell'invio, sul campo giusto, in italiano.

**Correzione proposta**
Allineare `lib/schema.ts` ai massimi del server (`.max(200, "Massimo 200 caratteri")`
ecc.) e aggiungere l'attributo `maxLength` agli input. È lo schema condiviso: lì il
disallineamento è un difetto di per sé.

### 4. Il prefill dei partecipanti non ha tetto: `?p=` con 200 viaggiatori blocca il form
**Gravità:** IMPORTANTE — **VERIFICATO**
**File:** `lib/crea-query-params.ts:52-67` (`decodeParticipants`, nessun limite)
vs `lib/schema.ts:59` (`.max(20)`)

**Come si riproduce**
`/crea?p=adulto:30,adulto:30,…` ripetuto 200 volte (sta comodamente in una query string).

**Cosa succede**
`decodeParticipants` restituisce 200 elementi, che diventano i `defaultValues` del
form. Il pulsante "Aggiungi viaggiatore" è disabilitato (`fields.length >= 20`), ma
le righe esistenti restano: aprendo il popover si montano 200 `ParticipantRow`,
ciascuna con una `Select` da 75 opzioni di età (≈15.000 item). All'invio compare
"Massimo 20 partecipanti" e **l'unico modo di uscirne è cliccare "Rimuovi" 180 volte**.

**Cosa dovrebbe succedere**
Il decoder è la frontiera con l'esterno: deve rifiutare (o troncare) ciò che lo
schema del form non accetterebbe mai.

**Correzione proposta**
In `decodeParticipants`, restituire `undefined` se `participants.length > 20`
(coerente con la politica "tutto o niente" già usata per tipo/età non validi), e
aggiungere il test corrispondente in `lib/crea-query-params.test.ts`, dove oggi il
caso non è coperto.

### 5. Il budget da query può valere 1.000.000 ma lo slider si ferma a 10.000
**Gravità:** IMPORTANTE — **VERIFICATO**
**File:** `lib/crea-query-params.ts:39` (`0 … 1_000_000`),
`components/itinerary-form/itinerary-form.tsx:343-362` (`max={10000}` su Slider e Input)

**Come si riproduce**
Arrivare su `/crea?budget=20000` (raggiungibile dal flusso `/scopri`, il cui slider
arriva a 20.000€, quando `onSiteTotal` supera i 10.000 — gruppo numeroso, viaggio lungo).

**Cosa succede**
Il form parte con `budget = 20000`: il campo numerico lo mostra, ma lo slider è già
fuori scala (il pomello si appoggia al fondo). Al primo tocco dello slider — anche
accidentale — il valore **crolla silenziosamente a ≤10.000**, senza che l'utente
capisca perché il suo budget è cambiato.

**Cosa dovrebbe succedere**
O il controllo copre l'intervallo accettato, o il valore in ingresso viene
chiaramente limitato (e detto).

**Correzione proposta**
Definire un'unica costante `MAX_BUDGET` condivisa da `crea-query-params.ts`, dallo
slider e dall'input numerico; se si vuole tenere lo slider a 10.000, limitare lì il
prefill invece di accettare fino a un milione.

### 6. Un itinerario vuoto o incompleto è considerato valido
**Gravità:** IMPORTANTE — **VERIFICATO**
**File:** `lib/itinerary-schema.ts:25-27` (`days: z.array(itineraryDaySchema)`, nessun `.min(1)`),
`app/api/generate-itinerary/route.ts:200-207` (nessun confronto con le date richieste),
`components/itinerary-form/itinerary-result.tsx:239` (`itinerary.days.map`)

**Come si riproduce**
Il modello risponde `{"days": []}` (succede con `finishReason: MAX_TOKENS` o su
destinazioni ambigue), oppure restituisce 3 giorni per un viaggio di 7.

**Cosa succede**
`safeParse` passa, la route risponde 200, il form passa in `mode: "result"` e
l'utente vede la pagina "Si parte per …" con il pannello viaggio e **nessun giorno**,
oppure un itinerario che copre metà vacanza. Nessun errore, nessun retry: dal punto
di vista dell'applicazione è un successo.

**Cosa dovrebbe succedere**
Un itinerario che non copre i giorni richiesti è una risposta non conforme e deve
far scattare `invalid_response` (che nella route ha già il fallback su modello/chiave).

**Correzione proposta**
`days: z.array(itineraryDaySchema).min(1)` nello schema, e nella route un controllo
`parsedResult.data.days.length === dayCount` (il `dayCount` è già calcolabile da
`dateRange`) prima di restituire 200.

### 7. Una caduta di rete vera non produce mai il messaggio sulla connessione
**Gravità:** IMPORTANTE — **VERIFICATO**
**File:** `components/itinerary-form/itinerary-form.tsx:145-166`, `ERROR_MESSAGES.network:50-51`

**Come si riproduce**
Mettere il dispositivo offline (o farsi rispondere da un intermediario con una pagina
HTML di errore / un 504 grezzo) e premere "Genera itinerario".

**Cosa succede**
- Offline: `fetch` lancia un `TypeError("Failed to fetch")`. Nel catch,
  `isErrorCode(error.message)` è falso → si finisce su `invalid_response`.
- Risposta non-JSON: `await response.json()` (riga 151) lancia **prima** del controllo
  `!response.ok` (riga 153) → di nuovo `invalid_response`.

In entrambi i casi l'utente legge "Non siamo riusciti a generare l'itinerario.
Riprova.", mentre il messaggio corretto — "Controlla la connessione e riprova" —
è di fatto **codice morto**: `network` arriva solo se il server risponde con quel
codice in un JSON ben formato.

**Cosa dovrebbe succedere**
Un problema di connessione va detto come tale: è l'unico caso in cui l'utente può
davvero fare qualcosa.

**Correzione proposta**
Separare i due `await`: `try { response = await fetch(...) } catch { throw new Error("network") }`,
e leggere il corpo con un `catch` che ricade su `{}` prima di valutare `response.ok`.
Valutare anche `navigator.onLine` per distinguere offline da server irraggiungibile.

### 8. Un ricaricamento accidentale butta via un minuto di generazione, senza avviso
**Gravità:** IMPORTANTE — **VERIFICATO** (assenza di persistenza)
**File:** `components/itinerary-form/itinerary-form.tsx:73-79` (tutto in `useState`)

**Come si riproduce**
Generare un itinerario, poi ricaricare la pagina (o tornare indietro dal PDF aperto
in un'altra scheda su mobile, dove Safari/Chrome scaricano volentieri la pagina).

**Cosa succede**
Si perde tutto: itinerario, meteo, info paese **e** i dati del form. Si riparte dal
form vuoto. Nessun avviso né durante la generazione (fino a 60s) né dopo. È un
comportamento incoerente con `/scopri`, che le proposte le salva in `sessionStorage`
proprio per questo motivo (documentato nel CLAUDE.md).

**Cosa dovrebbe succedere**
Almeno i dati del form (che sono ciò che l'utente ha faticato a inserire) devono
sopravvivere a un reload.

**Correzione proposta**
Stesso pattern già presente nel progetto: salvare `submittedData` + `itinerary` in
`sessionStorage` e reidratare al mount. In subordine, un `beforeunload` mentre
`mode === "loading"`.

### 9. Nessun limite temporale sul calendario: si possono chiedere itinerari nel passato
**Gravità:** IMPORTANTE — **VERIFICATO**
**File:** `components/itinerary-form/itinerary-form.tsx:232-243` (nessuna prop `disabled`/`startMonth`/`endMonth`),
`lib/schema.ts:40-58` (nessun vincolo sul passato)

**Come si riproduce**
Aprire il calendario, navigare indietro e scegliere 10/03/2019 → 15/03/2019.

**Cosa succede**
Passa ogni validazione, client e server. Viene generato (e fatturato) un itinerario
per un viaggio già trascorso. Simmetricamente, per date molto lontane nel futuro
(> 1 anno) le "medie degli ultimi 5 anni" pescano anni che nel passato non esistono:
`getClimateAverages` restituisce `null` e ogni giornata mostra "Media climatica non
disponibile per questa data", senza spiegare il perché.

**Cosa dovrebbe succedere**
Le date passate vanno disabilitate nel calendario (non solo respinte a valle) e
l'orizzonte futuro utile va limitato o spiegato.

**Correzione proposta**
`disabled={{ before: startOfToday() }}` sul `<Calendar>` (react-day-picker lo supporta
nativamente) più un refine nello schema condiviso, così vale anche per il prefill da
query string, che oggi accetta qualunque data.

### 10. Zero test su tutto il flusso di interfaccia
**Gravità:** IMPORTANTE — **VERIFICATO**
**File:** nessun `*.test.tsx` per `components/itinerary-form/**` né per `app/crea/page.tsx`

I 28 file di test coprono bene le funzioni pure (`crea-query-params`, `schema`,
`itinerary-to-ics`, le route). Non c'è **una sola** verifica su: cablaggio del prefill
nel form, doppio invio, transizione form → loading → result, ritorno da "Modifica",
resa di un giorno vuoto. Diversi rilievi di questo report (1, 4, 5, 6) sarebbero stati
intercettati da un test di integrazione del form.
**Correzione proposta:** aggiungere `@testing-library/react` + `jsdom` per una
manciata di test sul percorso principale, prima di aggiungere altre funzionalità.

---

## MINORE

### 11. Prefill con la sola `from`: il pulsante dice "Seleziona le date" pur avendo una data
**VERIFICATO** — `itinerary-form.tsx:222-224`, `88-90`
Con `/crea?from=2026-09-01` (senza `to`), `dateRange.from` è valorizzato ma l'etichetta
richiede entrambe le date, quindi mostra "Seleziona le date" in colore normale (non
muted, perché `!dateRange?.from` è falso): l'utente non sa che una data è già scelta
finché non apre il calendario. Mostrare "01/09/2026 - …" o "Manca la data di ritorno".

### 12. Prefill con intervallo invalido: nessun segnale fino all'invio
**VERIFICATO** — `crea-query-params.ts:89-94` (from e to decodificati indipendentemente)
`/crea?from=2026-09-10&to=2026-09-01` (o un intervallo di 30 giorni) precarica un
intervallo che lo schema rifiuterà. Il pulsante mostra "10/09/2026 - 01/09/2026" e
l'errore appare solo dopo aver premuto "Genera itinerario". Validare la coppia dentro
`decodeCreaPrefill` (scartando entrambe le date se incoerenti).
*Sospetto correlato:* con `from > to`, `react-day-picker` in `mode="range"` riceve un
`DateRange` non valido — comportamento da verificare a mano, non l'ho potuto eseguire.

### 13. Date di query "sbagliate ma plausibili" scivolano su un altro giorno
**VERIFICATO** — `crea-query-params.ts:29`

```
new Date('2026-02-31T00:00:00') → Tue Mar 03 2026   // verificato, non è Invalid Date
```

`?from=2026-02-31` diventa silenziosamente 03/03/2026. (`2026-13-01` e `2026-01-00`
sono invece correttamente `Invalid Date`.) Rimedio: usare `z.iso.date()` di zod v4 o
riverificare che `format(date,'yyyy-MM-dd') === str` dopo la conversione.

### 14. Il campo budget non si può svuotare per riscriverlo
**VERIFICATO** — `itinerary-form.tsx:358-362`
`Number("") === 0` → cancellando il contenuto il campo si ripopola all'istante con `0`,
e chi digita "1500" sopra ottiene la sequenza `0` → `01` → `015`… Tenere una stringa
di stato locale e sincronizzare il form solo su valore numerico valido (o su `blur`).

### 15. Un giorno senza attività diventa una scheda vuota
**VERIFICATO** — `itinerary-result.tsx:294-323` (`day[key].length > 0 &&`)
Se il modello restituisce le tre fasce vuote, la scheda del giorno mostra solo
l'intestazione e la riga meteo, poi il nulla. Serve un fallback esplicito
("Giornata libera / nessuna attività proposta").

### 16. Invio del form con la tendina dei suggerimenti aperta
**VERIFICATO** — `destination-autocomplete.tsx:115-130`
Se la lista è aperta ma nessuna voce è evidenziata (`highlightedIndex === -1`), il
tasto Invio non viene intercettato e **invia il form** con il testo grezzo digitato,
mentre i suggerimenti sono a schermo. Attesa comune: Invio seleziona la voce
evidenziata o, in mancanza, chiude la lista. Intercettare Invio finché `isOpen`.

### 17. Nome file degenere per destinazioni non latine
**VERIFICATO** — `itinerary-result.tsx:46-48`
`sanitizeFileName("東京")` → `""` → il file scaricato si chiama `itinerario-.ics` /
`itinerario-.pdf`. Prevedere un fallback (`itinerario`).

### 18. Testi lunghi senza contenimento
**VERIFICATO per ispezione** — `itinerary-result.tsx:312-313` (titolo e descrizione
attività, nessun `break-words`/`truncate`), `201-205` (l'elenco di 20 viaggiatori
finisce in una cella di una griglia a 3 colonne)
Il prompt chiede titoli ≤40 caratteri ma niente lo impone. Una stringa lunga senza
spazi sfonda la scheda. Aggiungere `break-words` / `[overflow-wrap:anywhere]`, e per
i viaggiatori mostrare un riassunto ("2 adulti, 1 bambino") invece dell'elenco piatto.

### 19. Gli errori dei partecipanti sono nascosti dentro il popover chiuso
**VERIFICATO** — `itinerary-form.tsx:265-327`
Con l'età non selezionata, l'invio mostra "Completa i dati di ogni viaggiatore" sotto
il pulsante; per capire *quale* riga bisogna aprire il popover. In più
`shouldFocusError` di RHF non può mettere a fuoco un campo smontato, quindi al primo
invio fallito su desktop non succede visivamente nulla vicino al fuoco. Aprire il
popover automaticamente quando `errors.participants` è un array.

### 20. L'autocomplete non dice mai che sta caricando o che ha fallito
**VERIFICATO** — `destination-autocomplete.tsx:68-81`, `app/api/geocode-autocomplete/route.ts`
LocationIQ assente/in errore/oltre i 5s → `{results: []}` → semplicemente nessun
suggerimento, indistinguibile da "nessuna città trovata". Nessun indicatore durante i
500ms di debounce + latenza. Aggiungere uno stato `pending` e un messaggio discreto
in caso di errore.

### 21. Errori e stato di caricamento non annunciati
**VERIFICATO** — `itinerary-form.tsx:401-405` (nessun `role="alert"`), `195` e `407-421`
(nessun `aria-busy`)
Chi usa uno screen reader non viene informato né dell'inizio della generazione né del
suo fallimento. Un `role="alert"` sul blocco `apiError` e `aria-busy` sul form bastano.

### 22. Cambiando il tipo di partecipante l'errore precedente resta a schermo
**VERIFICATO** — `participant-row.tsx:56-60` (`setValue(ageName, undefined)` senza `shouldValidate`)
L'età viene azzerata ma la validazione non rigira: il messaggio d'errore della
selezione precedente resta visibile sotto un campo ormai vuoto. Passare
`{ shouldValidate: true }` (o `clearErrors` sul campo).

---

## SOSPETTI (da confermare a mano, non verificabili staticamente)

- **Ripristino dei campi non controllati dopo "Modifica" e alla riapertura del
  calendario.** `styleNotes`, `mustSee`, `arrivalTime`, `departureTime` sono registrati
  con `register` e vengono **smontati**: i primi due quando `mode === "result"`
  (`itinerary-form.tsx:173-183` restituisce un altro albero), gli ultimi due ogni volta
  che il `PopoverContent` del calendario si chiude (Radix smonta il contenuto). Con
  `shouldUnregister: false` (default) React Hook Form dovrebbe ripopolarli al rimontaggio,
  ma è esattamente il tipo di dettaglio che cambia tra versioni minori e che qui non è
  coperto da alcun test. **Da provare a mano:** compilare "Stile di viaggio" e "Arrivo",
  generare, premere "Modifica il viaggio", riaprire il calendario e verificare che i
  valori ci siano ancora.
- **`react-day-picker` con `from > to`** da prefill (vedi rilievo 12).
- **Destinazione a testo libero inesistente.** "asdasd" supera la validazione;
  la geocodifica fallisce, `climate` e `countryInfo` restano `null`, e il modello
  genera comunque un itinerario inventato, presentato con lo stesso tono di uno vero.
  Da valutare come scelta di prodotto: se la geocodifica non trova nulla, forse la
  risposta giusta è chiedere conferma all'utente invece di generare.
- **Doppio invio.** Le protezioni ci sono (guardia `mode === "loading"` a
  `itinerary-form.tsx:139` + `disabled` sul pulsante), e l'invio implicito da tastiera
  è bloccato dal pulsante disabilitato. Non ho trovato una finestra di corsa
  realistica, ma non c'è nemmeno un `AbortController`: se in futuro si aggiungesse un
  modo di annullare, la risposta della richiesta precedente arriverebbe comunque.
