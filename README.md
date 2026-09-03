# TripTailor

Genera itinerari di viaggio su misura a partire da poche informazioni: dove vai, quando, con chi e con che budget. L'itinerario esce diviso giorno per giorno e fascia oraria, con orari, costi stimati, come raggiungere ogni luogo e cosa sapere prima di andarci.

**In produzione:** [trip-tailor-ten.vercel.app](https://trip-tailor-ten.vercel.app)

Non serve registrarsi e non viene salvato nulla: i dati vivono nello stato della pagina finché non la chiudi.

---

## Come nasce un itinerario

Dal momento in cui premi *Genera itinerario*, in ordine:

1. **La destinazione viene geolocalizzata** con LocationIQ, per ricavare coordinate e codice paese.
2. **Si recuperano le medie climatiche** da Open-Meteo: per ciascun giorno del viaggio, la media delle stesse date negli anni precedenti — fino a cinque, meno se il servizio risponde lento.
3. **Si compone il prompt** con destinazione, date, composizione del gruppo, budget, stile, tappa imperdibile e i dati climatici.
4. **Gemini genera il piano**, che viene validato contro uno schema Zod: se la risposta non è conforme, la richiesta fallisce invece di mostrare dati incompleti.
5. **Il risultato viene arricchito** con valuta, lingue e fusi orari del paese, ricavati offline da `world-countries`.

Il clima entra nel prompt per orientare le scelte — nei giorni statisticamente più piovosi il modello preferisce attività al coperto — e viene mostrato all'utente come indicazione, mai come previsione.

---

## Funzionalità

### Il form

- **Destinazione** con autocompletamento: suggerimenti di città, paesi e isole mentre scrivi, tramite una API route che fa da proxy a LocationIQ.
- **Date** con selettore di intervallo, fino a **14 giorni**. Orario di arrivo e partenza opzionali: se li indichi, il primo e l'ultimo giorno vengono pianificati lasciando margine per trasferimento e rientro.
- **Chi viaggia**: righe per persona con tipo ed **età esatta**, non un semplice contatore. Il ritmo della giornata si adatta al membro più vincolante — con bambini le giornate restano tranquille anche se il resto del gruppo è di adulti.
- **Budget** con slider, usato come vincolo sulla somma delle stime.
- **Stile di viaggio** in testo libero.
- **Cosa non vuoi perderti**: un luogo che vuoi vedere per forza. Non viene citato di sfuggita: il modello lo inserisce come attività vera, con orario e costo, scegliendo il giorno e la fascia più sensati per posizione e orari di apertura.

### Il risultato

- Giorni divisi in mattina, pomeriggio e sera, con orari che non si sovrappongono.
- Ogni attività si apre in un pannello con **cosa è**, **come arrivarci** — dall'attività precedente, non da un punto di partenza presunto — e **consigli pratici**.
- Media climatica del giorno con temperature e probabilità di pioggia.
- Valuta, lingue e fusi orari del paese di destinazione.

### Esportare

- **Calendario `.ics`**: ogni attività diventa un evento con orario, costo e indicazioni, importabile in qualsiasi calendario.
- **PDF**: copertina con l'indice completo del viaggio, poi una pagina per giorno con tutti i dettagli in chiaro. Pensato per essere stampato e usato senza connessione, che è il caso in cui i dettagli servono davvero.

---

## Avvio in locale

Servono **due chiavi**, entrambe con un piano gratuito sufficiente per sviluppare:

| Variabile | A cosa serve | Dove si ottiene |
|---|---|---|
| `GEMINI_API_KEY` | generazione dell'itinerario | [Google AI Studio](https://aistudio.google.com/apikey) |
| `LOCATIONIQ_API_KEY` | geolocalizzazione e autocompletamento | [LocationIQ](https://locationiq.com) |

Open-Meteo non richiede chiave.

```bash
git clone https://github.com/chrii13/TripTailor.git
cd TripTailor
npm install
cp .env.local.example .env.local   # poi inserisci le due chiavi
npm run dev
```

L'app risponde su `http://localhost:3000`.

### Variabili opzionali

- `GEMINI_API_KEY_BACKUP` — chiave di riserva, usata **solo** quando la principale va in rate limit (429).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — **non ancora usate**: sono segnaposto per l'export diretto su Google Calendar, previsto più avanti. Oggi l'export avviene tramite file `.ics` e non richiede alcuna credenziale.

### Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | build di produzione |
| `npm test` | suite di test (Vitest) |
| `npm run lint` | ESLint |

---

## Struttura

```
app/
  page.tsx                    landing
  crea/page.tsx               form, legge ?destination= per il precompilamento
  api/generate-itinerary/     orchestra clima, prompt, Gemini e validazione
  api/geocode-autocomplete/   proxy verso LocationIQ
components/
  landing/                    sezioni della landing e footer
  itinerary-form/             form, riga partecipante, vista risultato
  ui/                         componenti shadcn
lib/
  schema.ts                   schema Zod condiviso fra form e API
  itinerary-prompt.ts         costruzione del prompt
  itinerary-schema.ts         forma attesa della risposta di Gemini
  climate-forecast.ts         medie climatiche storiche
  geocode-destination.ts      coordinate e codice paese
  country-info.ts             valuta, lingue, fusi orari
  itinerary-to-ics.ts         export calendario
  itinerary-pdf.tsx           documento PDF
```

---

## Scelte tecniche

**Il meteo è una media storica, non una previsione.** Un itinerario si pianifica con mesi di anticipo, quando nessuna previsione esiste. Open-Meteo viene interrogato sull'archivio degli anni precedenti per le stesse date: dice cosa è ragionevole aspettarsi, non cosa succederà. Nell'interfaccia il dato è etichettato come «media storica» ovunque compaia — **senza** promettere un numero di anni, perché quando il servizio è lento la media si accontenta di quelli raccolti.

**Le chiamate climatiche sono sequenziali, non parallele.** Cinque richieste simultanee alla stessa API gratuita possono essere strozzate tutte insieme, e in quel caso l'itinerario esce senza meteo. In sequenza, con un ritentativo su 429 e 5xx, un anno che fallisce non compromette gli altri: la media si calcola su quelli riusciti.

**Il PDF si genera nel browser.** Con `@react-pdf/renderer`, caricato tramite import dinamico solo al clic: chi non scarica il PDF non ne paga il peso. Le alternative erano la finestra di stampa del browser — che non è un download e lascia intestazioni e URL al browser — e Puppeteer lato server, che avrebbe richiesto Chromium in una funzione serverless per una cosa che altrimenti gira senza server. I font sono incorporati come sottoinsiemi TrueType, quindi il testo resta selezionabile e cercabile.

**Due livelli di ripiego sulla generazione.** Se il modello principale fallisce si passa a `gemini-flash-lite-latest`; se è la chiave ad essere in rate limit si passa a quella di riserva, quando configurata.

**La risposta del modello è validata, non creduta.** Gemini restituisce JSON che viene verificato contro uno schema Zod prima di arrivare all'interfaccia. Una risposta malformata produce un errore leggibile, non una pagina rotta.

---

## Test

```bash
npm test
```

100 test su 13 file, nessuno dei quali contatta servizi esterni: la maggior parte verifica funzioni pure — costruzione del prompt, validazione di richieste e risposte, classificazione degli errori, rotazione delle chiavi, export `.ics` — mentre quelle che toccherebbero la rete o simulano `fetch`, come i test sulle medie climatiche e sul ritentativo, o girano senza chiave configurata, così il codice si ferma prima della chiamata.

Fa eccezione il test del PDF, che **genera davvero il documento** in Node e ne verifica intestazione, numero di pagine, font incorporati e collegamenti: se l'impaginazione regredisce e un giorno torna a traboccare su due pagine, il test fallisce.

---

## Limiti noti

- Viaggi fino a **14 giorni** e **20 partecipanti**.
- Nessuna persistenza: ricaricare la pagina perde l'itinerario. Va esportato in PDF o calendario per conservarlo.
- I costi stimati li produce il modello: sono indicativi e non distinguono sempre fra prezzo a persona e totale.
- L'export diretto su Google Calendar non è ancora implementato.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Zod · react-hook-form · framer-motion · Vitest
Google Gemini · LocationIQ · Open-Meteo

---

Progetto personale. Segnalazioni e proposte: [issue del repository](https://github.com/chrii13/TripTailor/issues).
