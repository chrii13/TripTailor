# Consigli sulla cena — design

Data: 2026-08-24
Stato: approvato in brainstorming, da implementare

## Il problema

L'app non consiglia dove mangiare. Peggio: lo fa già senza dirlo. Il prompt di
`lib/itinerary-prompt.ts` permette di proporre la cena come attività («es. cena e poi una
passeggiata serale»), quindi nomi di locali compaiono già negli itinerari **e nessuno li
verifica**. Su una città famosa il modello indovina spesso; su un paese piccolo inventa.

Un indirizzo inesistente, scoperto sul posto con la valigia in mano, non costa all'utente
un consiglio sbagliato: gli costa la fiducia in tutto il resto dell'itinerario.

## L'idea

I locali vengono da **OpenStreetMap**, quindi esistono. Il modello **non li nomina**: ne
riceve un elenco reale e sceglie fra quelli, spiegando perché quello, per quella sera, per
quel gruppo. Il codice verifica che la scelta sia davvero nell'elenco.

Divisione del lavoro: OpenStreetMap ha i fatti e non ha giudizio; il modello ha giudizio e
inventa i fatti. Dandogli i fatti e vietandogli di aggiungerne, si usa la sua forza e si
blocca la sua debolezza.

È lo stesso principio già applicato tre volte nel progetto — `verify-proposal-budget.ts`,
`verify-suggested-window.ts`, `verify-itinerary-days.ts`: **il modello propone, il codice
controlla**.

## Decisioni prese, e le alternative scartate

### Fonte dati: OpenStreetMap

Verificato il 2026-08-24 sulle fonti ufficiali:

| | Voti e classifica | Gratis al mese | Poi | Vincoli |
|---|---|---|---|---|
| Google Places | sì | **1.000** (fascia Enterprise, quella che serve per i voti) | $35 / 1.000 | limiti di conservazione dei dati |
| TripAdvisor | sì | 5.000 | a scaglioni | **logo, bollini e link obbligatori** |
| Foursquare | sì, premium | **nessuna** per i voti | ~$18,75 / 1.000 | — |
| **OpenStreetMap** | **no** | illimitate | — | attribuzione |

Con Google, tre chiamate per itinerario costerebbero ~10 centesimi, contro i ~3 della
generazione AI: consigliare dove mangiare costerebbe più del triplo di scrivere
l'itinerario. TripAdvisor è più generoso ma impone il proprio marchio dentro le schede.

**Scelta: OpenStreetMap**, con possibilità di cambiare più avanti. Motivo dell'utente:
partire senza costi e senza marchi altrui. Motivo di progetto: una classifica per voti è la
stessa che l'utente troverebbe da solo in trenta secondi, mentre un consiglio cucito su
*quella* giornata è ciò che l'app promette e che nessun portale ha.

### Struttura: due tempi, non uno

I ristoranti si possono cercare solo **dopo** che l'itinerario esiste. Ma `/crea` ha già il
budget pieno: `maxDuration = 60`, di cui fino a 12 secondi per geocodifica e meteo
(`PRE_AI_PHASE_MS`) e fino a 45 per il modello (`GEMINI_CALL_TIMEOUT_MS`). Non c'è spazio.

**L'itinerario compare subito, come oggi. I consigli arrivano dopo, con una seconda
richiesta**, e si aggiungono alle giornate mentre l'utente legge.

Non è un ripiego: l'utente vede l'itinerario prima, la generazione resta intatta, e se la
ricerca dei locali fallisce l'itinerario resta valido — manca un pezzo, non compare un
errore.

### Ambito: solo la cena

Una geocodifica e una interrogazione per giornata. Il pranzo raddoppierebbe tutto; si può
aggiungere dopo se il risultato convince.

### Precisione: geocodifica della tappa, non della città

Oggi si geocodifica solo la destinazione: le attività sono titoli, non punti sulla mappa.
Per «vicino alla tappa delle 19:30» serve la posizione di quella tappa.

**Non** si geocodifica ogni attività — un viaggio di due settimane ne ha una settantina.
Si geocodifica **solo la tappa che precede la cena**, una per giornata.

## Come funziona

Per ogni giornata dell'itinerario:

1. **Si sceglie la tappa d'ancoraggio**: l'ultima attività del pomeriggio, o la prima della
   sera se il pomeriggio è vuoto. È quella che dice dove si trova l'utente verso le 19. Se
   la giornata non ha né pomeriggio né sera, la giornata non riceve consiglio: senza un
   punto di riferimento «vicino» non significa niente.
2. **Si geocodifica quella tappa** con LocationIQ (già in uso per l'autocompletamento),
   **ancorata alla destinazione**: senza vincolo geografico «Mercado do Bolhão» può
   risolversi in un altro continente. Se la geocodifica fallisce si ricade sulle coordinate
   della destinazione, già disponibili.
3. **Si interrogano i ristoranti** entro **600 m** a piedi da quel punto, via Overpass:
   `amenity=restaurant`, nodi e way, solo quelli con un `name`.
4. **Si costruisce l'elenco dei candidati**, ciascuno con un **identificativo progressivo**,
   nome, distanza in metri, e i campi presenti quando ci sono (`cuisine`, `opening_hours`,
   `addr:street`, `outdoor_seating`).

   L'elenco va **limitato ai 12 più vicini per giornata**. Misurato a Porto: 161 locali
   entro 500 m. Su un viaggio di 14 giorni, mandarli tutti al modello significherebbe
   duemila voci in un prompt solo — costo, lentezza e un modello che sceglie peggio perché
   annega. Dodici bastano a dare scelta reale entro dieci minuti a piedi.

Poi, **una sola chiamata a Gemini per tutto l'itinerario** (non una per giornata): riceve i
candidati di ogni giornata, il contesto del viaggio (partecipanti, budget, stile, la tappa
d'ancoraggio) e restituisce per ciascuna giornata **l'identificativo scelto** più un
commento.

### Il cancello

Il modello restituisce un **identificativo**, non un nome. Il codice verifica che
l'identificativo esista nell'elenco fornito per quella giornata; il nome, l'indirizzo e la
distanza mostrati a schermo vengono **dai dati di OpenStreetMap**, mai dalla risposta del
modello.

Un identificativo inventato non produce un locale inventato: produce uno scarto.

Restituire un identificativo invece del nome evita anche il confronto fra stringhe, che
fallirebbe al primo accento o spazio diverso.

### Quando non c'è nulla

Se OpenStreetMap non ha locali schedati vicino alla tappa, quella giornata **non riceve
alcun consiglio** e l'interfaccia lo dice in una riga.

Non si ripiega su un consiglio di zona generato dal modello: sarebbe una nuova
affermazione non verificabile, cioè il problema da cui siamo partiti.

## Modifica necessaria all'itinerario esistente

`lib/itinerary-prompt.ts` va cambiato perché **le attività non nominino più ristoranti,
bar o locali**. Altrimenti l'itinerario conterrebbe due cene: una inventata dentro le
attività e una verificata nel nuovo blocco.

Questa modifica **chiude anche il difetto di partenza**, indipendentemente dal resto: da
sola toglie i nomi non verificati che l'app produce oggi.

## Superficie tecnica

### Nuova route: `app/api/dinner-suggestions/route.ts`

**Riceve**: destinazione, coordinate della destinazione, e per ogni giornata la data e il
titolo della tappa d'ancoraggio, più il contesto del viaggio già in possesso del client.

**Restituisce**: per ogni giornata, o un locale (nome, indirizzo o distanza, commento,
eventuali orari) oppure l'assenza motivata.

`maxDuration = 60`, con budget di fase come `generate-itinerary`: un tetto complessivo per
geocodifica + Overpass, e il residuo alla chiamata al modello.

### Nuovi file in `lib/`

- `dinner-candidates.ts` — interrogazione Overpass e normalizzazione dei candidati
- `dinner-anchor.ts` — scelta della tappa d'ancoraggio per ciascuna giornata
- `dinner-suggestions-schema.ts` — schema della risposta del modello
- `dinner-suggestions-prompt.ts` — prompt (funzione pura)
- `verify-dinner-choice.ts` — il cancello: l'identificativo appartiene ai candidati?

Nomi coerenti con le famiglie già presenti (`discover-trips-*`, `verify-*`).

### Vincoli noti

- **Overpass pubblico è instabile.** Misurato il 2026-08-24: un'interrogazione corretta
  risponde in **1-2 secondi**, ma i fallimenti sono frequenti e **costosi** — tre istanze
  hanno restituito 500/504 dopo 46-55 secondi. Serve un timeout stretto (pochi secondi) e
  la rinuncia silenziosa, mai l'attesa lunga. Da valutare in implementazione: una seconda
  istanza come riserva.
- **La copertura dei dati è irregolare.** Misurato su 160 locali entro 500 m dalla Ribeira
  di Porto: 29% ha il tipo di cucina, 24% gli orari, 54% la via. Il prompt deve reggere
  candidati quasi nudi, senza pretendere campi che spesso mancano.
- **Nessun voto, nessuna classifica.** Il giudizio lo mette il modello, non i dati.
- **`responseJsonSchema` non accetta `maxItems`** (vedi CLAUDE.md): un tetto sul numero di
  elementi va imposto dopo il `safeParse`, non nello schema inviato.

## Interfaccia

Il consiglio compare **dentro la giornata**, in coda alla fascia serale, come blocco
distinto dalle attività — è un suggerimento, non una tappa con un orario.

Mentre arriva, la giornata mostra uno stato di attesa discreto: l'itinerario è già
leggibile e il blocco non deve spostare il contenuto sotto di sé quando compare.

Rispetta il sistema visivo di CLAUDE.md. Nessun marchio di terzi.

**PDF ed export calendario**: fuori ambito per ora. Il consiglio arriva dopo la
generazione, quindi va deciso separatamente se e come includerlo; se all'esportazione non è
ancora arrivato, l'export procede senza.

## Attribuzione

OpenStreetMap va citata. Il footer ha già una sezione **«Da dove vengono i dati»** con
Gemini, LocationIQ e Open-Meteo: si aggiunge lì, senza toccare le schede.

## Errori e degradazione

Ogni fallimento degrada, nessuno interrompe:

| Cosa fallisce | Cosa succede |
|---|---|
| geocodifica della tappa | si usano le coordinate della destinazione |
| Overpass | quella giornata resta senza consiglio |
| nessun candidato | quella giornata resta senza consiglio, detto in una riga |
| chiamata al modello | nessun consiglio, l'itinerario resta intatto |
| identificativo non valido | quella giornata resta senza consiglio |

L'itinerario è già a schermo: **nessun errore di questa fase deve produrre una schermata
d'errore**.

## Come si verifica

- **Funzioni pure** (ambiente node): scelta della tappa d'ancoraggio, normalizzazione dei
  candidati, il cancello di verifica, costruzione del prompt.
- **Componenti** (ambiente jsdom, introdotto il 2026-08-24): il consiglio compare nella
  giornata giusta; il fallimento non rompe l'itinerario; lo stato di attesa non sposta il
  contenuto.
- **Chiamata vera obbligatoria** prima di dire che è finito: Overpass e Gemini vanno
  provati sul serio, non simulati. I test simulano il modello e non si accorgerebbero di
  uno schema rifiutato — è già successo, vedi CLAUDE.md.

Ogni test va provato **rompendo la correzione che protegge**.

## Fuori ambito

Pranzo. Colazione. Prenotazione. Voti e classifiche. Filtri alimentari (vegetariano,
allergie): i dati OSM li hanno di rado, e prometterli male è peggio che non prometterli.
Inclusione nel PDF e nel file calendario.

## Rischio residuo, dichiarato

Il cancello impedisce di inventare **un locale**, non di dire una cosa sbagliata **su un
locale vero** («famoso per il pesce» quando non lo è). È un errore molto meno grave di un
indirizzo inesistente, ma esiste, e nessun controllo automatico lo intercetta.
