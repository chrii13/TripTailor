# Ricerca inversa: dal budget alle proposte di viaggio

**Data:** 2026-08-18
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

Oggi TripTailor risponde a una sola domanda: "so dove voglio andare, organizzami il viaggio". L'utente apre `/crea`, scrive la destinazione e riceve un itinerario.

Questa funzionalità inverte il flusso e risponde alla domanda opposta: **"ho questo budget e queste date, dove posso andare?"**. L'utente non indica alcuna destinazione — scoprirla è il servizio. Indica quanto può spendere, con chi parte, quando e da dove, e riceve un ventaglio di proposte di viaggio compatibili con quei vincoli.

Perché il risultato sia utile, il budget deve essere considerato **per intero**: non solo le spese in loco, ma anche il volo nel periodo scelto e l'alloggio. Una proposta che ignora il volo non è una proposta. Da qui discendono due conseguenze già decise:

- **Le date sono obbligatorie**, perché il prezzo di un volo dipende dal periodo.
- **La città di partenza è obbligatoria**, perché senza origine il prezzo di un volo non è definibile: da Milano e da Palermo la stessa destinazione costa diversamente. Si chiede la partenza, mai la destinazione.

## Approccio scelto

Le cifre di volo e alloggio sono **stime prodotte da Gemini**, non prezzi reali. Le API di prezzi veri sono state valutate e scartate: Amadeus, Kiwi e Skyscanner sono a pagamento o con quote troppo strette per un progetto in questa fase, mentre Booking e Airbnb non espongono API aperte. Questa scelta va dichiarata all'utente, non nascosta (vedi "Onestà sulle stime").

Sulla generazione sono state considerate due strade:

- **Due passaggi** (prima le destinazioni candidate, poi una chiamata di costificazione per ciascuna): stime potenzialmente più curate, ma 9-11 chiamate a Gemini per ogni ricerca. La generazione di un singolo itinerario ha già un timeout di 180 secondi, e i rate limit sono un problema abbastanza concreto da aver richiesto una chiave di backup (`GEMINI_API_KEY_BACKUP`) e il fallback su un secondo modello. Moltiplicare le chiamate per dieci peggiora l'unica cosa che l'utente percepisce davvero — l'attesa — per comprare una precisione che comunque resta quella di un modello linguistico.
- **Una sola chiamata** che restituisce le proposte già costificate. Scelta questa, con l'aggiunta di una **verifica aritmetica lato server**: il modello resta la fonte delle cifre, ma non ha l'ultima parola sul fatto che una proposta rientri nel budget, perché quella è una condizione verificabile in codice.

## Input

Nuovo schema `lib/discover-trips-request.ts`:

| Campo | Tipo | Obbligatorio |
|---|---|---|
| `departureCity` | stringa (max 200) | sì |
| `dateRange` | `{ from, to }` | sì |
| `participants` | array di partecipanti (1-20) | sì |
| `budget` | numero (0 - 1.000.000) | sì |
| `vacationType` | enum | no |

Riusa senza riscriverli i pezzi già esistenti in `lib/schema.ts`: `participantSchema` (tipo + età, con i vincoli di fascia) e i `refine` sulle date, incluso il tetto di `MAX_TRIP_DAYS`. I vincoli restano definiti in un punto solo per tutta l'app.

`vacationType` è un valore chiuso (`mare`, `montagna`, `citta-arte`, `natura`, `gastronomia`, `relax`), non testo libero. È una scelta diversa da `styleNotes` di `/crea` ed è deliberata: lì serve descrivere un gusto in prosa, qui serve orientare il ventaglio di destinazioni, e un valore chiuso lo fa in modo più affidabile in prompt. Resta opzionale: senza, il ventaglio è libero.

## Backend

Nuova route `app/api/discover-trips/route.ts`, ricalcata su `app/api/generate-itinerary/route.ts`:

- stessa rotazione delle chiavi Gemini (`getGeminiApiKeys`)
- stesso fallback di modello `gemini-flash-latest` → `gemini-flash-lite-latest`
- stessa classificazione degli errori (`classifyGenerationError`) e stessi codici di errore, così la gestione lato client è quella che il progetto già conosce
- risposta vincolata via `responseJsonSchema` come già si fa per l'itinerario

**Nessuna chiamata a LocationIQ per il geocoding e nessuna chiamata a Open-Meteo.** Non servono a questo flusso — la destinazione non è ancora nota e il clima non entra nella decisione di budget — e ogni chiamata risparmiata è latenza in meno.

`lib/discover-trips-prompt.ts` (funzione pura) costruisce il prompt a partire dalla richiesta validata. Il prompt deve:

- chiedere **5 proposte** distinte tra loro, non cinque varianti della stessa idea
- vincolare le stime al periodo indicato (alta o bassa stagione cambia il prezzo del volo) e alla città di partenza
- chiedere che il totale di ogni proposta stia **entro il budget indicato**, non che lo sfiori
- chiedere una ripartizione esplicita dei costi, non una cifra unica

`lib/discover-trips-schema.ts` definisce la risposta attesa. Ogni proposta contiene:

- `destination` — città
- `country` — paese
- `whyItFits` — una frase su perché regge i vincoli dichiarati
- `highlights` — tre punti salienti brevi, ciò che rende la scheda decidibile senza generare un mezzo itinerario
- `costs` — `{ flightsPerPerson, flightsTotal, lodgingTotal, onSiteTotal, total }`, tutti numeri in euro

## Verifica del budget

Funzione pura `lib/verify-proposal-budget.ts`, che dalla risposta di Gemini:

1. ricalcola il totale di ogni proposta dai singoli componenti, senza fidarsi del campo `total`
2. scarta le proposte il cui totale ricalcolato supera il budget dichiarato
3. ordina le rimanenti

Se dopo il filtro non resta alcuna proposta, `/scopri` lo dice apertamente — "con questo budget non troviamo proposte per queste date" — invece di mostrare risultati fuori scala. È il caso in cui l'onestà vale più di un risultato qualsiasi.

## Pagina `/scopri`

Struttura speculare a `/crea`: intestazione sticky con logo e ritorno alla home, form al centro, e al submit il form si trasforma nella griglia di proposte nella stessa pagina — lo stesso pattern con cui oggi il form di `/crea` diventa riepilogo. Un bottone "Modifica" riporta al form compilato.

Ogni scheda mostra destinazione e paese, `whyItFits`, i tre `highlights` e la ripartizione dei costi (volo, alloggio, spese in loco, totale).

Il campo della città di partenza riusa `components/itinerary-form/destination-autocomplete.tsx`, che oggi è tipizzato su `Control<TripFormValues>` e ha etichetta, placeholder e nome del campo fissi. Va reso parametrico su questi tre aspetti e generico sul tipo del form. È l'unica modifica a codice esistente richiesta dall'interfaccia di questa funzionalità, ed evita un secondo componente di autocomplete copiato e destinato a divergere.

Palette, tipografia e componenti restano quelli del sistema esistente: nessun colore nuovo, nessun pattern estraneo.

### Onestà sulle stime

Sotto i costi di ogni scheda compare una riga esplicita: **stime indicative generate dall'AI, non prezzi prenotabili**. Deve essere leggibile, non un grigetto da 10px. È ciò che evita all'utente di sentirsi ingannato quando andrà a cercare il volo davvero, ed è coerente con come l'app già tratta il meteo (dichiarato come media storica, non come previsione).

## Passaggio a `/crea`

Ogni scheda ha un bottone "Crea l'itinerario" che porta a `/crea` precompilato con destinazione, date, budget e viaggiatori — da lì riparte il generatore di itinerari già esistente, senza duplicarne nulla. L'itinerario completo si genera quindi **solo per la proposta scelta**, non per tutte e cinque.

Oggi `app/crea/page.tsx` legge dalla query string il solo `destination`. Va esteso agli altri parametri:

- date e budget come parametri semplici
- i partecipanti in forma compatta, es. `p=adulto:30,adulto:32`

Tutti i parametri vengono decodificati e validati con zod in lettura (funzione pura `lib/crea-query-params.ts`, con codifica e decodifica insieme). Un parametro malformato viene ignorato e si cade sul valore di default: un URL manomesso o troncato non deve mai far esplodere la pagina.

## Landing

La landing non si limita a guadagnare un bottone: chi arriva sulla home deve capire che il sito risponde a due domande diverse. Tre interventi, tutti nello stile esistente.

**1. Secondo ingresso nell'hero.** Un bottone accanto a "Crea il tuo itinerario", in stile secondario (bordo, non riempito). Il giallo Sole resta riservato a **un solo elemento per schermata**, come impone il sistema visivo descritto in `CLAUDE.md`: la CTA primaria resta quella esistente.

**2. Nuova sezione esplicativa**, nuovo componente `components/landing/reverse-search.tsx`, collocato in `app/page.tsx` **dopo `HowItWorks` e prima di `FinalCta`**. La posizione è deliberata: a quel punto il lettore ha appena capito come funziona la generazione dell'itinerario, ed è il momento naturale per presentargli il percorso inverso — si parte da budget, date e compagnia, e il sito propone le mete. Collocarla prima (tra mete gettonate e identità del sito) spezzerebbe il discorso che porta l'utente a capire il prodotto principale.

La sezione spiega cos'è la ricerca inversa, per chi è utile, e chiude con un rimando a `/scopri`. Segue le convenzioni delle sezioni esistenti: `id` per l'ancora, `scroll-mt-20`, alternanza chiaro/scuro coerente con le sezioni adiacenti, animazioni reveal on-scroll con `useReducedMotion` rispettato.

**3. Raccordo in `how-it-works.tsx`.** La sezione si intitola "Come funziona" — formulazione generica, che si legge come "come funziona il sito" — e il suo passo 01 recita *"Destinazione, date, chi viaggia, budget e stile"*, presentando la destinazione come un dato che l'utente deve già avere. Con due percorsi disponibili, quel testo stabilisce una regola che la nuova sezione poco più sotto smentisce.

La correzione è deliberatamente minima: **i quattro passi e la numerazione non si toccano**, perché descrivono correttamente la sequenza della generazione dell'itinerario. Cambia solo il sottotitolo, oggi *"Dal racconto del tuo viaggio all'itinerario pronto, in quattro passi"*, che va riformulato per chiarire che quei passi sono il percorso di chi la meta ce l'ha già e che ne esiste un secondo per chi non ce l'ha ancora. Una frase, nello stesso tono.

**Voce di navigazione.** `site-nav.tsx` espone oggi tre ancore — `#destinazioni`, `#perche`, `#come-funziona` — più un bottone "Crea itinerario" a destra. La nuova sezione riceve la propria voce (`#scopri`), altrimenti esiste solo per chi scorre fino in fondo alla pagina. Da verificare a mano che con quattro voci la barra regga anche sugli schermi stretti: le voci sono già a `text-xs` con `gap-0.5` sotto i 640px.

## Testing

Sono funzioni pure, quindi con test veri nello stile di quelli già presenti nel progetto:

- `lib/discover-trips-request.ts` — validazione: campi mancanti, budget negativo, date invertite, viaggio oltre `MAX_TRIP_DAYS`, `vacationType` non valido, partecipanti fuori fascia d'età
- `lib/discover-trips-prompt.ts` — presenza di budget, date, partenza e viaggiatori nel prompt; comportamento con e senza `vacationType`
- `lib/discover-trips-schema.ts` — risposta conforme, risposta con campi mancanti, costi non numerici
- `lib/verify-proposal-budget.ts` — proposta dentro il budget, proposta fuori, `total` dichiarato dal modello diverso dalla somma dei componenti, caso in cui nessuna proposta sopravvive
- `lib/crea-query-params.ts` — andata e ritorno della codifica, parametri malformati, partecipanti con età fuori fascia, parametro assente

La route si testa come `app/api/generate-itinerary/route.test.ts`: content-type errato, body non valido, chiavi assenti, rate limit con passaggio alla chiave di backup, risposta non conforme allo schema.

Non sono testabili in automatico, e si verificano a mano nel browser: la qualità e la plausibilità delle stime di Gemini, la resa visiva della griglia di proposte, e le modifiche alla landing (nuova sezione, secondo ingresso nell'hero, voce di navigazione, ritmo chiaro/scuro delle sezioni adiacenti).

## Cosa NON cambia

- Nessuna API di prezzi reali e nessuna nuova variabile d'ambiente: si usano le chiavi Gemini già configurate.
- Nessuna persistenza: come nel resto dell'app, i dati vivono nello stato React.
- Nessuna modifica al generatore di itinerari, al prompt dell'itinerario, all'export PDF o ICS.
- Nessuna modifica ai campi di `/crea`, al suo schema o al suo comportamento: la pagina guadagna solo la lettura dei nuovi parametri di query. L'unico file condiviso che cambia è `destination-autocomplete.tsx`, che diventa parametrico su nome, etichetta e placeholder mantenendo identico il comportamento attuale in `/crea`.

## Punti aperti, da rivalutare dopo la prima prova sul campo

- **Numero di proposte.** Cinque è un punto di partenza ragionevole; se la verifica di budget ne scarta abitualmente troppe, conviene chiederne di più a Gemini e mostrarne comunque cinque.
- **Qualità delle stime.** Se le cifre risultassero sistematicamente irrealistiche, la strada a due passaggi descritta sopra resta disponibile senza buttare via nulla di questo design: cambierebbe solo il contenuto della route.
