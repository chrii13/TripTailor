# Consigli sulla valigia — design

Data: 2026-09-03
Stato: approvato in brainstorming, da implementare

## Il problema

L'app dice dove andare, cosa vedere e dove mangiare. La domanda che uno si fa subito dopo
aver letto l'itinerario — *cosa mi porto* — non ha risposta, benché il dato per darla sia
già in casa: `lib/climate-forecast.ts` scarica la media climatica del periodo per ogni
itinerario, e quella media è **già a schermo** su ogni giornata (massima e probabilità di
pioggia) e **già dentro il prompt** dell'itinerario.

## L'idea, e cosa la distingue dalle funzionalità vicine

Il consiglio si **calcola in codice** dalle medie climatiche. Nessuna chiamata al modello,
nessuno schema di risposta, nessun cancello di verifica.

È l'opposto della scelta fatta per i consigli sulla cena, ed è deliberato. Là il problema
era che il modello inventava locali, e la soluzione fu dargli i fatti e vietargli di
aggiungerne. Qui **non c'è niente da inventare**: da una massima di 24° e una minima di 14°
a «strati leggeri, una felpa per la sera» non c'è un salto di conoscenza, c'è una tabella.
Far scrivere quella frase a un modello aggiungerebbe una chiamata, una latenza, una quota e
un rischio di affermazione non verificabile, in cambio di niente.

**Il limite, dichiarato:** la lista non può dire «scarpe da trekking» perché il terzo giorno
c'è il Vesuvio, né «qualcosa di presentabile» per una serata a teatro. Quei capi dipendono
dalle attività, e leggerle richiede il modello. È la ragione per cui questa resta la
**prima** versione: se il risultato convince a metà, la strada già valutata è una seconda
chiamata sul modello della cena (una route sua, interrogata dopo che l'itinerario è a
schermo).

## Decisioni prese, e le alternative scartate

### Una lista per tutto il viaggio, non un suggerimento per giornata

La valigia si fa una volta, prima di partire. Un consiglio giornaliero ripeterebbe quasi le
stesse cose quattordici volte su un viaggio lungo, e affollerebbe una giornata che ha già
attività, meteo e il consiglio sulla cena.

### Fuori dalla chiamata dell'itinerario — misurato, non supposto

`app/api/generate-itinerary/route.ts` usa `PRE_AI_PHASE_MS` (12s) più `PER_CALL_CAP_MS`
(45s) su un `maxDuration` di 60: **57 secondi su 60, nessuno spazio**. E allungare la
risposta è anche rischioso: un troncamento (`MAX_TOKENS`) fa ripartire la generazione sul
modello successivo, che su quattordici giorni misurava 43s e a volte rispondeva 503 (vedi
CLAUDE.md, «Ordine dei modelli Gemini»). Si metterebbe a rischio l'itinerario per un
accessorio. Con il calcolo in codice il problema non si pone: non c'è chiamata.

## Come funziona

Da `DailyClimateAverage[]` (per giornata: `tempMaxAvg`, `tempMinAvg`,
`precipitationChance`) si ricavano quattro fatti, tutti aritmetici:

1. la **massima più alta** e la **minima più bassa** del periodo;
2. la **massima escursione** fra massima e minima nella stessa giornata;
3. **quante giornate** superano la soglia di pioggia;
4. la **durata** del viaggio.

### Le fasce di temperatura

Decise sulla massima più alta e sulla minima più bassa, così la lista copre entrambi gli
estremi del periodo invece di una media che non descrive nessuna giornata reale. Un viaggio
può quindi far scattare **due** fasce, e in quel caso valgono entrambe.

| fascia | capi |
|---|---|
| sotto 5° | cappotto pesante, guanti, berretto, sciarpa |
| 5-12° | giacca, strati, scarpe chiuse |
| 13-19° | maniche lunghe, qualcosa di più caldo per la sera |
| 20-26° | abbigliamento leggero |
| 27° e oltre | tessuti traspiranti, cappello, protezione solare |

I confini sono **inclusivi a sinistra**: 12° cade nella seconda fascia, 13° nella terza.

### Le due regole indipendenti dalla fascia

- **Escursione oltre 10°** → il consiglio di vestirsi a strati: la stessa giornata chiede
  due cose diverse. La soglia si legge come «maggiore di 10», quindi 10° esatti non la fanno
  scattare.
- **Pioggia oltre il 30% in almeno una giornata** → giacca impermeabile. Oltre il 30% in
  **più della metà** delle giornate → anche scarpe adatte alla pioggia. Anche qui la soglia
  è stretta: 30% esatto non basta.

### Cosa la lista non dice, e perché

- **Nessuna quantità** («quattro magliette»): dipende da quanto si lava durante il viaggio,
  che non sappiamo. Un numero inventato è peggio di nessun numero.
- **Nessun capo legato alle attività**: vedi il limite dichiarato sopra.
- **Nessun linguaggio da previsione.** La riga di apertura dice che sono medie degli ultimi
  cinque anni per quelle date. È la stessa classe di cautela già applicata al passaggio da
  «a piedi» a «in linea d'aria» sulla distanza del ristorante: non affermare ciò che non
  abbiamo verificato.

### Quando non c'è il dato

`weather` è `DailyClimateAverage[] | null`, e la fase meteo può anche restituire una media
parziale o niente. **Senza dati climatici il blocco non compare affatto.** Nessun consiglio
è meglio di un consiglio senza fondamento, ed è la stessa regola già in vigore per la sera
senza ristorante.

Una media **parziale** (meno di cinque anni, o meno giornate del viaggio) è invece
sufficiente: la funzione lavora su quante giornate riceve. `getClimateAverages` degrada già
così di proposito.

## Interfaccia

### A schermo

In fondo all'itinerario, **dopo l'ultima giornata e prima dei tre bottoni** (PDF, calendario,
modifica). L'ordine di lettura diventa: cosa farai, cosa portare, cosa fare adesso. Sotto i
bottoni resterebbe orfano; in cima ruberebbe la scena all'itinerario, che è ciò per cui
l'utente ha aspettato trenta secondi.

Nel sistema visivo esistente (CLAUDE.md): fascia Nebbia, titolo coerente con gli altri, capi
come elenco, e in apertura la riga sulla provenienza del dato. Nessun marchio di terzi,
nessuna ombra, nessun gradiente.

### Nel PDF

La stessa lista in coda al documento, in `lib/itinerary-pdf.tsx`, con gli stili già definiti
lì (`NEBBIA`, `FILETTO`, la scala tipografica esistente). Una lista della valigia che vive
solo a schermo serve poco a chi sta facendo la valigia col telefono appoggiato al letto.

## Superficie tecnica

### Nuovo file

- `lib/consigli-valigia.ts` — funzione pura: da `DailyClimateAverage[]` alla lista.
  Restituisce `null` quando non c'è niente da dire, così chi la usa non decide da sé.

Nota di coerenza: il progetto mescola già italiano e inglese nei nomi dei moduli
(`attesa.ts` accanto a `dinner-candidates.ts`); è un rilievo minore già registrato e non si
risolve qui.

### File toccati

- `components/itinerary-form/itinerary-result.tsx` — il blocco, fra le giornate e i bottoni.
- `lib/itinerary-pdf.tsx` — la stessa lista in coda al documento.

### Cosa NON serve

- **Nessuna persistenza.** La lista deriva da `weather` e dai dati del form, entrambi già
  salvati in `sessionStorage`: dopo un ricaricamento si ricalcola in un millisecondo.
- Nessuna route, nessun prompt, nessuno schema di risposta, nessuno stato di caricamento,
  nessun caso di guasto da gestire.

## Come si verifica

**Funzioni pure** (ambiente node), sui confini e non sui casi comodi:

- i confini esatti delle fasce: 12° e 13° devono cadere da parti diverse, e così 4/5, 19/20,
  26/27;
- un viaggio che fa scattare **due** fasce (minima sotto 5°, massima sopra 20°);
- l'escursione a 10° esatti (non scatta) e a 11° (scatta);
- la pioggia al 30% esatto (non scatta) e al 31%; e la soglia «più della metà delle
  giornate» con un numero pari e uno dispari di giornate;
- elenco climatico vuoto, e `null`: entrambi restituiscono `null`;
- una giornata sola (viaggio minimo).

**Componenti** (ambiente jsdom): il blocco compare con i dati climatici e **non** compare
senza. Leggere in CLAUDE.md la sezione «Test dei componenti» prima di scriverlo: i polyfill
Radix, `matchMedia`, il fuso in cima al file e l'orologio fermo sono trappole già battute.

**Ogni test va provato rompendo la protezione che difende**, e il conteggio dei rossi va
controllato: una patch che non si applica lascia il test verde e sembra che protegga.

## Fuori ambito

Capi legati alle attività (serve il modello: è la versione A, rimandata). Quantità. Liste
per tipo di partecipante — bambini, anziani — che il clima da solo non giustifica. Il file
calendario, che non è un posto per una lista. Qualsiasi consiglio su documenti, adattatori
o farmaci: non derivano dal clima e sarebbero affermazioni non verificate.

## Rischio residuo, dichiarato

Una media degli ultimi cinque anni non è una previsione, e un anno anomalo la smentisce. La
riga di apertura lo dice, ma un utente distratto può leggere la lista come una promessa. È
il rischio che si accetta scegliendo un dato storico, ed è l'unico disponibile per un
viaggio prenotato con mesi d'anticipo.
