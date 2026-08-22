# Audit D — flusso "scopri" (ricerca inversa)

Analisi statica, nessun file modificato, nessun server avviato.
Riferimenti: `CLAUDE.md` (sezione ricerca inversa) e `docs/superpowers/specs/2026-08-18-ricerca-inversa-design.md` (autorità).

Legenda: **VERIFICATO** = dimostrabile leggendo il codice; **SOSPETTO** = plausibile ma dipende da comportamento del modello o del browser non ispezionabile qui.

---

## BLOCCANTE

### 1. Il totale mostrato sulla card può superare il budget dell'utente (fino a +75 €) — VERIFICATO

- **File:** `lib/round-proposal-costs.ts:43-54`, `components/discover-trips/proposal-card.tsx:40-42`, `lib/verify-proposal-budget.ts:20-31`
- **Riproduzione:** budget 1.000 €, 2 viaggiatori, 7 notti. Il modello restituisce `travelTotal: 375`, `lodgingTotal: 325`, `onSiteTotal: 275` → totale reale 975 €, dentro il budget e sopra la soglia di plausibilità (600 ≥ 25×2×7 = 350), quindi la proposta passa entrambi i filtri server.
- **Cosa succede:** `roundProposalCosts` arrotonda ogni voce per eccesso (375→400, 325→350, 275→300; `Math.round` in JS arrotonda .5 verso l'alto) e deriva il totale mostrato dalla somma delle voci arrotondate: **1.050 €**. La striscia di riepilogo appena sopra dichiara "budget 1.000 €", la card dice "Totale ~1.050 €" e la riga "Ti restano" sparisce (`remaining` negativo, `proposal-card.tsx:42-43,119`). Lo scarto massimo è +75 € (3 voci × +25).
- **Cosa dovrebbe succedere:** una funzionalità il cui unico contratto è "proposte entro il budget" non deve mai mostrare a schermo un totale superiore al budget dichiarato. La spec (§ "Verifica del budget") è esplicita: il codice, non il modello, ha l'ultima parola sul fatto che una proposta rientri.
- **Correzione proposta:** far girare la verifica di budget **sui totali arrotondati**, non su quelli grezzi — cioè arrotondare in `route.ts` prima di `verifyProposalsAgainstBudget`, oppure aggiungere in `verifyProposalsAgainstBudget` un secondo filtro su `roundProposalCosts(proposal.costs).total <= budget`. In alternativa arrotondare le voci **per difetto** verso il basso quando la somma sfonda, ma la prima strada è più semplice e mantiene un solo punto di verità.

---

## IMPORTANTE

### 2. Date nel passato accettate in modalità "date esatte" — VERIFICATO

- **File:** `components/discover-trips/discover-form.tsx:365-376` (nessuna prop `disabled` sul `<Calendar>`), `discover-form.tsx:55-80` (superRefine), `lib/discover-trips-request.ts:31-45` (`exactDateRangeSchema`)
- **Riproduzione:** su `/scopri`, aprire "Seleziona date", tornare indietro con le frecce del calendario fino a gennaio 2020, scegliere 3–10 gennaio 2020, inviare.
- **Cosa succede:** nessuna validazione client né server rifiuta le date passate. Il prompt chiede a Gemini stime di volo/alloggio "dal 03/01/2020 al 10/01/2020", la card propone un viaggio già avvenuto, il link "Verifica i prezzi reali" genera una ricerca Google "viaggio Milano Lisbona 3 gennaio 2020" e il bottone "Crea l'itinerario" porta a `/crea?from=2020-01-03&to=2020-01-10`.
- **Cosa dovrebbe succedere:** la data di partenza non può essere anteriore a oggi. Notare l'asimmetria: la modalità flessibile è già limitata al mese corrente e ai 12 successivi (`lib/discover-trips-flexible-period.ts:21-31`), la modalità esatte no.
- **Correzione proposta:** passare `disabled={{ before: startOfToday() }}` al `<Calendar>` e aggiungere un `.refine` su `exactDateRangeSchema` (`range.from >= startOfToday()`) così che valga anche per chiamate dirette all'API. Attenzione: `exactDateRangeSchema` è usato solo da `/scopri`, quindi il fix non tocca `/crea`.

### 3. In modalità flessibile la finestra suggerita può cadere nel passato — VERIFICATO

- **File:** `lib/verify-suggested-window.ts:10-17`, `lib/discover-trips-flexible-period.ts:21-31`
- **Riproduzione:** oggi 20 agosto, scegliere il mese "Agosto 2026" (è la prima voce del menu) e 5 notti. Il modello restituisce `suggestedFrom: 2026-08-05`, `suggestedTo: 2026-08-10`.
- **Cosa succede:** `isWindowConsistent` controlla solo che entrambe le date inizino con `2026-08` e che la distanza sia esattamente 5 notti. La proposta passa e la card mostra "Consigliato 5 ago - 10 ago", cioè date già trascorse; il link a `/crea` le porta con sé. Caso limite estremo: con 13 notti (`MAX_TRIP_NIGHTS`) in un mese di 31 giorni l'ultima finestra possibile parte il 18, quindi dal 19 in poi **tutte** le finestre valide sono nel passato.
- **Cosa dovrebbe succedere:** la finestra deve stare nel mese richiesto **e** non iniziare prima di oggi; se nel mese corrente non entra più alcuna finestra della durata richiesta, il mese non dovrebbe nemmeno essere selezionabile.
- **Correzione proposta:** aggiungere a `isWindowConsistent` il controllo `parseISO(suggestedFrom) >= startOfToday()`; in `buildFlexibleMonthOptions` (o nel select delle notti) escludere il mese corrente quando i giorni residui non bastano per il numero di notti scelto. Il prompt andrebbe inoltre istruito a non proporre date passate per il mese corrente.

### 4. Nessuna verifica di coerenza fra `travelPerPerson` e `travelTotal` — VERIFICATO (gap di validazione)

- **File:** `lib/verify-proposal-budget.ts:7-31`, `components/discover-trips/proposal-card.tsx:86-92`
- **Riproduzione:** 4 viaggiatori; il modello restituisce `travelPerPerson: 120`, `travelTotal: 200` (invece di 480).
- **Cosa succede:** il server ricalcola solo `total = travelTotal + lodgingTotal + onSiteTotal` e non tocca `travelPerPerson`. La card stampa "Viaggio A/R (~120 € a persona) … ~200 €": due cifre che non possono coesistere con 4 persone. Lo stesso vale per il caso opposto (`travelTotal` gonfiato), che stringe artificiosamente il budget residuo.
- **Cosa dovrebbe succedere:** la spec ha imposto la verifica aritmetica lato server proprio perché il modello sbaglia i conti; il prompt stesso (`lib/discover-trips-prompt.ts:46`) dichiara "travelTotal: travelPerPerson moltiplicato per N", quindi è una regola verificabile in codice.
- **Correzione proposta:** in `verifyProposalsAgainstBudget` (che già riceve `travelerCount`) ricalcolare `travelTotal = travelPerPerson * travelerCount` prima di sommare, esattamente come si fa già con `total`. Attenzione: questo cambia i totali e va coordinato con il rilievo 1.

### 5. Il link "Verifica i prezzi reali" non compare mai in modalità flessibile — VERIFICATO

- **File:** `components/discover-trips/discover-results.tsx:64,73` (passa `departureDate={dateRange.from}`), `components/discover-trips/proposal-card.tsx:45-47`
- **Riproduzione:** ricerca con "Date flessibili" → risultati.
- **Cosa succede:** in modalità flessibile `dateRange.from` è `undefined`, quindi `realPriceSearchUrl` è `null` e il link sparisce da tutte e cinque le card — pur essendo disponibile `proposal.suggestedFrom`, già calcolato due righe sopra in `resolveProposalDates` e usato per l'href di `/crea`.
- **Cosa dovrebbe succedere:** con una finestra suggerita valida (garantita da `verify-suggested-window`) il link ha tutte le informazioni per esistere.
- **Correzione proposta:** in `discover-results.tsx` passare `departureDate={proposalDates.from}` invece di `dateRange.from` — vale per entrambe le modalità e usa già la funzione che decide le date "vere" della proposta.

### 6. Date in inglese dentro un'interfaccia italiana — VERIFICATO

- **File:** `lib/discover-trips-recap.ts:41-42`, `components/discover-trips/discover-form.tsx:356`
- **Riproduzione:** ricerca a date esatte 1–5 settembre.
- **Cosa succede:** `format(..., "dd MMM")` senza `locale: it` e senza `setDefaultOptions` globale (verificato: nessuna occorrenza nel progetto) produce "01 Sep - 05 Sep" nella striscia di riepilogo e "01 Sep - 05 Sep" sul bottone del date picker. Il comportamento è addirittura fissato in `lib/discover-trips-recap.test.ts:36` (`expect(label).toBe("01 Sep - 05 Sep")`). Nella stessa schermata il periodo flessibile è in italiano ("ottobre 2026", `discover-trips-recap.ts:21`) e la finestra suggerita pure ("10 ott - 17 ott", `discover-trips-suggested-window-label.ts:14`).
- **Cosa dovrebbe succedere:** tutte le date della UI in italiano, coerenti fra loro.
- **Correzione proposta:** aggiungere `{ locale: it }` alle due `format` e aggiornare i due test che oggi certificano l'inglese. Verificare se lo stesso pattern esiste su `/crea` (fuori ambito qui) prima di scegliere fra fix locale e `setDefaultOptions` globale.

### 7. La città di partenza accetta qualsiasi testo libero — VERIFICATO (punto aperto noto)

- **File:** `components/itinerary-form/destination-autocomplete.tsx` (nessun vincolo a scegliere un suggerimento), `lib/discover-trips-request.ts:58`
- **Riproduzione:** scrivere `asdfgh` come città di partenza e inviare; oppure lasciare che il debounce non trovi nulla e inviare comunque.
- **Cosa succede:** la stringa finisce tale e quale nel prompt ("Città di partenza: asdfgh") e Gemini inventa una tratta. Anche una città inesistente ma plausibile ("Villamarina di Sopra") produce stime senza alcun segnale all'utente. Campo vuoto o solo spazi è invece correttamente bloccato (`z.string().trim().min(1)`).
- **Cosa dovrebbe succedere:** la spec fonda l'intera stima sul prezzo del viaggio da un'origine reale; un'origine inventata rende le cinque cifre prive di significato.
- **Correzione proposta:** richiedere la selezione di un suggerimento LocationIQ (memorizzare il `label` scelto e invalidare il campo se l'utente ha poi digitato altro), oppure geocodificare lato server la città di partenza e rispondere con un errore dedicato se non risolve. È già annotato come punto aperto in memoria ("controllo città di partenza").

---

## MINORE

### 8. "Per persona" non torna con il totale mostrato — VERIFICATO
`components/discover-trips/proposal-card.tsx:44`. `perPerson = roundToNearestFifty(total / travelerCount)` arrotonda una seconda volta e indipendentemente: totale 1.000 € con 3 viaggiatori → 333,33 → **~350 €**, che moltiplicato per 3 fa 1.050 €. La card, che altrove è costruita perché "le righe tornino col totale" (`round-proposal-costs.ts:37-42`), qui contraddice quel principio. Correzione: mostrare `Math.round(total / travelerCount)` senza arrotondamento alla cinquantina, oppure dichiarare esplicitamente che è una media.

### 9. Il budget passato a `/crea` è la cifra grezza, non quella mostrata — VERIFICATO
`components/discover-trips/discover-results.tsx:78` usa `proposal.costs.onSiteTotal` non arrotondato, mentre la card mostra `roundProposalCosts(...).onSiteTotal`. L'utente legge "Spese in loco ~350 €", clicca "Crea l'itinerario" e su `/crea` trova 337 € nello slider. Correzione: passare la voce già arrotondata.

### 10. "Ti restano" può sovrastimare il residuo — VERIFICATO
`proposal-card.tsx:42-43`. Il residuo è calcolato sul totale arrotondato e poi arrotondato a sua volta, con il pavimento a 5 € di `roundToNearestFifty` (`round-proposal-costs.ts:24`): un residuo reale di 2 € viene mostrato come "Ti restano ~5 €". Nella direzione opposta (rilievo 1) il residuo scompare del tutto pur essendo positivo. Correzione: calcolare il residuo sul totale reale e non applicare il pavimento a 5 € a questa riga.

### 11. Budget 0 (o assurdo) consuma comunque una chiamata a Gemini — VERIFICATO
`discover-form.tsx:52,490-512` (slider `min=0`, schema `z.number().min(0)`). Con budget 0 la richiesta parte, si attendono ~30-50 secondi e poi tutte le proposte vengono scartate (`total <= 0` è incompatibile con la soglia di plausibilità, che è sempre > 0): stato vuoto onesto ma pagato con una chiamata AI e un'attesa lunga. Stesso discorso per 50 € in 4 persone per 13 notti. Correzione: minimo client-side sensato (es. 100 €) oppure un pre-controllo `budget >= 25 * viaggiatori * notti` che mostri subito lo stato vuoto senza chiamare il modello.

### 12. Lo stato vuoto attribuisce sempre la colpa al budget — VERIFICATO
`components/discover-trips/discover-results.tsx:56-60`. Il messaggio "Con questo budget non troviamo proposte per queste date" viene mostrato anche quando le proposte sono state scartate da `verify-suggested-window` (finestra fuori mese o durata sbagliata: colpa del modello, non del budget) o quando il modello ne ha restituite zero. Il consiglio "prova ad alzare il budget" in quei casi è inutile e ripete l'attesa. Correzione: distinguere lato server il motivo dello svuotamento (es. un campo `reason` nella risposta) e differenziare il messaggio, almeno fra "nessuna proposta nel budget" e "riprova, non siamo riusciti a comporre proposte valide".

### 13. `sessionStorage` non viene ripulito da "Modifica la ricerca" — VERIFICATO
`discover-form.tsx:156-175,296`. `onEdit` cambia solo `mode`, il payload resta. Conseguenze: (a) se l'utente modifica la ricerca e la nuova chiamata fallisce, un refresh riporta a schermo i risultati **vecchi** insieme al form della ricerca vecchia; (b) uscendo dalla pagina e tornando indietro riappaiono i risultati anche se l'utente stava riscrivendo la ricerca. I casi "dati corrotti", "quota esaurita" e "navigazione privata" sono invece gestiti correttamente dai `try/catch` e da `safeParse` (verificato), e scheda nuova = form vuoto è il comportamento atteso di `sessionStorage`. Correzione: rimuovere la chiave in `onEdit`, o memorizzare lo stato "sto modificando" insieme al payload.

### 14. `highlights` senza vincoli: chiavi React duplicate e layout a rischio — VERIFICATO
`lib/discover-trips-schema.ts:20` (`z.array(z.string().min(1))`, nessun `.length(3)`), `components/discover-trips/proposal-card.tsx:77-78` (`key={highlight}`). Il prompt chiede "esattamente tre punti da max 40 caratteri", ma lo schema accetta 0, 1 o 12 elementi e due highlight identici producono chiavi duplicate (warning React e possibili anomalie di riconciliazione). Lo stesso vale per `whyItFits`, senza tetto di lunghezza. Correzione: `.length(3)` (o `.min(1).max(3)`) e `.max(60)` sui singoli highlight nello schema, `key` basata sull'indice.

### 15. Il mese viene passato al prompt in formato macchina — VERIFICATO
`lib/discover-trips-prompt.ts:24,27-28`: "Periodo: mese di 2026-10". Il modello se la cava, ma la stessa informazione altrove nell'app è in italiano; scrivere "ottobre 2026 (2026-10)" costa nulla e riduce il rischio di fraintendimenti sull'anno.

### 16. Stato di caricamento poco robusto e non annunciato — VERIFICATO
`discover-form.tsx:311` disabilita i campi solo con `pointer-events-none opacity-60`: restano raggiungibili e modificabili da tastiera durante la chiamata (il doppio invio è però impedito dal `disabled` sul bottone submit, che disattiva l'invio implicito con Invio). Inoltre il messaggio a rotazione non è in una regione `aria-live` e il blocco d'errore (`discover-form.tsx:565-569`) non ha `role="alert"`: chi usa uno screen reader non viene informato né dell'attesa né dell'errore. Correzione: `fieldset disabled` o `aria-busy` sul form, `role="status"` sul messaggio di caricamento, `role="alert"` sull'errore.

### 17. Nessun ritorno ai risultati dopo "Modifica la ricerca" — VERIFICATO
`discover-form.tsx:296`. Chi clicca per sbaglio deve rifare l'intera ricerca (nuova chiamata AI, altri ~40 secondi) anche senza cambiare nulla, benché le proposte siano ancora in memoria e in `sessionStorage`. Correzione: un bottone "Torna ai risultati" quando `proposals.length > 0`.

### 18. Messaggio d'errore fuorviante per gli errori di validazione — VERIFICATO
`discover-form.tsx:121` mappa `invalid_response` su "Non siamo riusciti a trovare proposte. Riprova." Ma la route usa lo stesso codice per il Content-Type sbagliato, il body non-JSON e il body che non passa lo schema (`route.ts:46,53,66`): in quei casi "riprova" non risolverà mai nulla. Correzione: codice d'errore distinto per la richiesta non valida (es. `invalid_request`) con un messaggio diverso.

---

## SOSPETTI (da confermare sul campo)

- **Soglia di plausibilità aggirabile.** `lib/verify-proposal-budget.ts:18-26` controlla `lodgingTotal + onSiteTotal >= 25 × viaggiatori × notti`. Il modello può soddisfarla gonfiando l'alloggio e azzerando le spese in loco (o viceversa): una proposta con alloggio 700 € e spese in loco 0 € passa, ma "0 € di pasti per 7 notti" è falso quanto il caso che il filtro vuole intercettare — e in più `onSiteTotal` è proprio la cifra passata come budget a `/crea`. Ipotesi di rinforzo: soglia separata per `onSiteTotal` (es. ≥ 15 €/persona/notte).
- **Bambini contati a tariffa piena nella soglia.** Stessa riga: un neonato alza la soglia di plausibilità di 25 € a notte, il che può far scartare proposte in realtà sensate per famiglie numerose.
- **Tetto delle notti vicino alla lunghezza di un mese.** Oggi `MAX_TRIP_NIGHTS = 13` (`MAX_TRIP_DAYS = 14`), quindi una finestra flessibile entra sempre in qualunque mese. Se `MAX_TRIP_DAYS` salisse oltre 29, in febbraio nessuna finestra potrebbe stare dentro il mese e `verify-suggested-window` scarterebbe sistematicamente tutte le proposte, mostrando lo stato vuoto "colpa del budget" (rilievo 12). Vale la pena legare il numero di notti selezionabili ai giorni del mese scelto.
- **Assenza di timeout lato client.** `discover-form.tsx:261` non usa `AbortController`: se la funzione serverless viene terminata dalla piattaforma senza restituire JSON, `response.json()` lancia e si cade nel `catch` con il messaggio di rete — corretto ma generico. Da verificare in produzione che non resti mai uno spinner infinito.
