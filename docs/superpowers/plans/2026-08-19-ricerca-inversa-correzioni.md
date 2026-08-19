# Correzioni alla ricerca inversa — piano

**Data:** 2026-08-19
**Origine:** revisione critica di prodotto sulla funzionalità già mergiata in `master` (non ancora pubblicata).
**Spec di riferimento:** `docs/superpowers/specs/2026-08-18-ricerca-inversa-design.md`

## Perché

La funzionalità è corretta ma si comporta male davanti a un utente reale su tre fronti, tutti verificati con esecuzioni vere contro Gemini:

1. **Con un budget impossibile inventa invece di rifiutare.** Famiglia di 4, 14 giorni, 200€ → cinque proposte a 195-198€ con alloggio a 5€ a notte per quattro persone. Budget 0€ → cinque card con "Totale 0 €" e pernottamento in bivacchi liberi. `verifyProposalsAgainstBudget` verifica che i conti tornino e che il totale stia sotto il tetto: entrambe vere. Il modello non sbaglia l'aritmetica, fa reverse engineering dei prezzi per obbedire al vincolo. **La guardia controlla la proprietà sbagliata, e lo stato vuoto previsto dalla spec è irraggiungibile.**
2. **Le due schermate si contraddicono in euro.** `buildCreaHref` passa `costs.total` come budget di `/crea`, ma quel campo alimenta `itinerary-prompt.ts`, che lo tratta come budget delle **attività** ("rispetta il budget indicativo nella somma delle stime di costo"). Una proposta che promette 400€ di spese in loco consegna 1130€ da spendere in attività.
3. **Stampiamo una precisione che non esiste.** Tre esecuzioni identiche danno Madrid a 1170 / 1010 / 1390€, e cambia anche l'insieme delle mete. "1.130 €" con quattro cifre significative invita un confronto che perderà.

Più due incoerenze minori ma visibili: il campo si chiama `flightsPerPerson` anche quando il modello scrive "raggiungibile comodamente via terra" e poi fattura un volo; e scegliere una proposta distrugge le altre quattro senza modo di tornarci, in una funzionalità il cui scopo è confrontare.

## Fuori perimetro (decisioni di prodotto, non difetti)

Da non implementare senza richiesta esplicita dell'utente: link esterni a comparatori di voli, innalzamento del tetto di budget oltre 10.000€, cambio dell'ordinamento dal più economico.

## Vincoli globali

- Italiano per tutto ciò che l'utente legge, nomi dei test e messaggi di commit inclusi.
- Ogni commit termina con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Si lavora su un branch dedicato `fix/ricerca-inversa-plausibilita`, mai direttamente su `master`.
- Nessuna nuova dipendenza, nessuna nuova variabile d'ambiente.
- **I test si eseguono con `npx vitest run --exclude "**/.claude/**" --exclude "**/node_modules/**"`** e il lint con `npx eslint app components lib --ext .ts,.tsx`. I comandi `npm test` e `npm run lint` nudi danno numeri falsi (256 test invece di 156, ~648 errori fantasma) perché scandiscono un worktree annidato sotto `.claude/`.
- Baseline attuale: 156 test su 19 file, 5 warning di lint, 0 errori.
- Token visivi esistenti, niente gradienti né ombre, bordi 1px.

---

## Task 1 — Soglia di plausibilità e passaggio corretto a `/crea`

**Files:**
- Modify: `lib/verify-proposal-budget.ts`
- Modify: `lib/verify-proposal-budget.test.ts`
- Modify: `components/discover-trips/discover-results.tsx` (una riga: `budget` passato a `buildCreaHref`)

**Produces:** `verifyProposalsAgainstBudget(proposals, budget, travelerCount, nights)` — la firma cresce di due parametri, perché la plausibilità dipende da quante persone e quante notti.

### La soglia

Una proposta è implausibile quando la spesa a terra è troppo bassa per essere vera. Regola:

```
lodgingTotal + onSiteTotal >= MIN_PER_PERSON_PER_NIGHT * travelerCount * nights
```

con `MIN_PER_PERSON_PER_NIGHT = 25` (euro). Venticinque euro a persona a notte per dormire **e** mangiare è già una soglia generosa verso il basso: sotto quella cifra la proposta non descrive un viaggio reale.

Le proposte che non la superano vengono scartate come quelle fuori budget. Se non ne resta nessuna, `/scopri` mostra lo stato vuoto già esistente — che è esattamente ciò che deve accadere con un budget impossibile.

Caso limite da gestire esplicitamente: `nights = 0` (viaggio di un giorno, `from` uguale a `to`). In quel caso la soglia sull'alloggio non ha senso: usa `Math.max(nights, 1)` per il calcolo, così una gita in giornata resta soggetta a una soglia minima sulle spese vive invece di essere accettata a zero.

### Il passaggio a `/crea`

In `discover-results.tsx`, `buildCreaHref` riceve `budget: proposal.costs.onSiteTotal` invece di `proposal.costs.total`. Il budget di `/crea` governa la somma delle stime di costo delle **attività**: passargli il totale comprensivo di volo e alloggio gli fa pianificare attività per tre volte quanto la proposta prometteva.

### Test da aggiungere

- proposta con alloggio+in loco sotto la soglia → scartata anche se sotto budget
- proposta esattamente sulla soglia → tenuta
- famiglia di 4 per 14 notti con 200€ totali → nessuna proposta sopravvive
- viaggio di un giorno (`nights = 0`) → la soglia usa 1 notte, non divide per zero né accetta tutto
- i test esistenti vanno adeguati alla nuova firma senza indebolire ciò che già verificano

---

## Task 2 — Il trasporto non è sempre un volo

**Files:**
- Modify: `lib/discover-trips-schema.ts`, `lib/discover-trips-schema.test.ts`
- Modify: `lib/discover-trips-prompt.ts`, `lib/discover-trips-prompt.test.ts`
- Modify: `components/discover-trips/proposal-card.tsx`
- Modify: `lib/verify-proposal-budget.ts` e il suo test (i campi cambiano nome)
- Modify: `app/api/discover-trips/route.ts` se vi compaiono i nomi dei campi

Il modello scrive `whyItFits: "Raggiungibile comodamente anche via terra"` e poi fattura `flightsPerPerson: 100`. Da Palermo scrive "i voli da Catania o i traghetti" e fattura un volo. Per un pubblico italiano una quota rilevante delle mete plausibili (Roma, Napoli, Nizza, Marsiglia, Lubiana, Zurigo) si raggiunge in treno.

**Rinomina:** `flightsPerPerson` → `travelPerPerson`, `flightsTotal` → `travelTotal`. Nel prompt: "costo indicativo del viaggio di andata e ritorno per una persona, con il mezzo più sensato per quella tratta e quel periodo (aereo, treno o traghetto)". Nella card l'etichetta diventa "Viaggio A/R" invece di "Volo".

Aggiungi al prompt il vincolo che il mezzo scelto sia coerente con quanto scritto in `whyItFits`, e un test che il prompt nomini treno e traghetto oltre all'aereo.

---

## Task 3 — La card dice quello che serve per scegliere

**Files:**
- Modify: `components/discover-trips/proposal-card.tsx`
- Modify: `components/discover-trips/discover-results.tsx`

1. **Arrotondamento.** Le cifre si mostrano arrotondate alla cinquantina più vicina e precedute da `~` (es. `~1.150 €`). Tre esecuzioni identiche danno la stessa meta a 1170 / 1010 / 1390€: quattro cifre significative asseriscono una precisione che il sistema non ha. Il totale resta la somma delle voci mostrate, quindi arrotonda le voci e ricalcola il totale mostrato dalla loro somma, altrimenti le quattro righe non tornano più.
2. **Budget residuo.** Sotto il totale, una riga "Ti restano ~X €" quando avanza qualcosa, calcolata sul budget della ricerca. Serve a rendere visibile che lo slider fa qualcosa: oggi con 2500€ la prima proposta ne usa 1130 e l'utente non vede il margine.
3. **Notti e totale a persona.** La card mostra il numero di notti e, quando i viaggiatori sono più di uno, il totale a persona: chi viaggia in otto ragiona in "1.100 a testa", non in "8.960".
4. **Ricapitolazione della ricerca** sopra la griglia: date, numero di viaggiatori, budget e città di partenza. Oggi "Dove puoi andare" e cinque card non sono ancorate a nulla, e uno screenshot fuori contesto non significa niente.

`DiscoverResults` riceverà anche `budget` e `departureCity` per poterlo fare.

---

## Task 4 — Le proposte non svaniscono

**Files:**
- Modify: `components/discover-trips/discover-form.tsx`

Cliccare "Crea l'itinerario" smonta `/scopri`; il tasto indietro del browser restituisce un form vuoto, e rifare la ricerca produce un insieme diverso di proposte. La proposta che l'utente stava per scegliere è irrecuperabile, in una funzionalità che esiste per confrontare.

Salva in `sessionStorage` i valori inviati e le proposte ricevute, e ripristinali al montaggio del componente. `sessionStorage` e non `localStorage`: i risultati sono legati a quella sessione di navigazione e non devono ricomparire giorni dopo come se fossero attuali. Le date vanno serializzate e rilette come `Date`. Se il contenuto salvato non è leggibile o non rispetta lo schema, si riparte dal form vuoto senza errori.

---

## Verifica finale

- `npx vitest run --exclude "**/.claude/**" --exclude "**/node_modules/**"` verde
- `npx eslint app components lib --ext .ts,.tsx` → 0 errori, non più di 5 warning
- `npm run build` completata
- Prove reali contro Gemini: budget impossibile (4 persone, 14 giorni, 200€) → stato vuoto; budget normale → cinque proposte con cifre arrotondate, budget residuo, notti e ricapitolazione; scelta di una proposta → `/crea` con budget pari alle spese in loco; tasto indietro → proposte ancora lì
