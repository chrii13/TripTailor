# Itinerario: contenuto più ricco e visualizzazione v2

**Data:** 2026-08-12
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

Primo test reale con Gemini riuscito (Fase 2 + swap provider), ma il risultato è apparso troppo approssimativo: un'attività per fascia oraria, nessun orario specifico, terminologia solo maschile per i tipi di viaggiatore, e una visualizzazione essenzialmente testuale senza gerarchia visiva. Questa spec copre un giro di miglioramento sia del contenuto generato sia di come viene mostrato.

## Contenuto e prompt

### Orario specifico per attività

Oggi `openingHours` indica solo quando il luogo è aperto in generale (es. "9:00–19:00"). Si aggiunge un nuovo campo **obbligatorio** `suggestedTime` (es. "10:00–12:30") che indica quando, nell'ambito della giornata, il viaggiatore dovrebbe effettivamente essere in quel posto — i due campi convivono, servono a cose diverse (uno è informativo sul luogo, l'altro è la pianificazione).

### Più attività per fascia

Lo schema già supporta più attività per fascia (mattina/pomeriggio/sera sono array), ma il prompt attuale porta quasi sempre a una sola attività "grande" per fascia. Si aggiorna il prompt per incoraggiare 2-3 attività più brevi per fascia quando ha senso, con `suggestedTime` che si susseguono senza sovrapposizioni all'interno della fascia — **non è una regola fissa**: se un'attività è di per sé sostanziosa e occupa ragionevolmente l'intera fascia (es. un grande museo, un'escursione fuori porta), resta da sola. Il prompt deve lasciare esplicitamente questa valutazione all'AI caso per caso, non imporre un numero minimo di attività per fascia.

### Linguaggio inclusivo

Le etichette "Bambino"/"Ragazzo"/"Adulto" diventano **"Bambino/a"**, **"Ragazzo/a"**, **"Adulto/a"** — sia nella UI (menu a tendina tipo partecipante, popover "Chi viaggia", riepilogo) sia nel prompt, quando si elenca la composizione del gruppo. Queste etichette sono oggi duplicate in tre file (`components/itinerary-form/participant-row.tsx`, `components/itinerary-form/itinerary-result.tsx`, `lib/itinerary-prompt.ts`); si consolidano in un'unica costante esportata da `lib/schema.ts` (dove già vivono `ParticipantType` e `AGE_RANGES`), così l'aggiornamento avviene in un solo posto e non si può più disallineare tra i tre file.

### Approfondimenti per il popup

Si aggiunge un nuovo campo **obbligatorio** `details`, generato nella stessa chiamata (nessuna richiesta aggiuntiva — la quota gratuita giornaliera è limitata, non ha senso spenderne un'altra unità per ogni singolo click):

```ts
details: {
  about: string;         // cosa è il posto/l'attività
  gettingThere: string;  // come raggiungerlo da dove ci si trova nell'itinerario
  tips: string;          // consigli pratici utili a chi non conosce la zona
}
```

Il prompt istruisce esplicitamente l'AI a scrivere questi campi pensando a un viaggiatore che non conosce affatto la zona.

### Budget di generazione

Il contenuto per attività cresce sensibilmente (da ~4 campi a 6, inclusi i tre campi di `details`). Per non rischiare troncamenti su un viaggio di 14 giorni con più attività per fascia, il `maxOutputTokens` della chiamata Gemini sale da 24.000 a **50.000** — resta ampiamente dentro sia il limite del modello (65.536) sia il limite di token/minuto del piano gratuito (250.000).

## Visualizzazione

Direzione approvata tramite mockup interattivo nel companion visivo (vedi cronologia sessione per i confronti scartati). Riassunto della card giorno:

- **Intestazione**: barra piena nel colore primario esistente (`--primary`, verde smeraldo), "Giorno N" a sinistra in Fraunces/serif più grande, data a destra un po' più piccola del titolo ma comunque leggibile, entrambi allineati verticalmente al centro.
- **Corpo**: sezioni Mattina/Pomeriggio/Sera separate da una linea sottile (`--border`), etichetta di fascia in maiuscolo/primary, senza icone o emoji.
- **Card attività**: titolo, descrizione breve, riga separata con orario (`suggestedTime`) a sinistra e costo a destra in colore primario/bold — nessun bordo colorato per fascia (scartato in fase di mockup a favore della versione più essenziale).
- **Hover**: leggero sollevamento (`translateY(-3px)`) più sfondo accent, cursore pointer — segnala che la card è cliccabile senza essere invadente.
- **Click → popup di dettaglio**: usa il componente Dialog di shadcn/ui (non ancora installato nel progetto — va aggiunto via CLI shadcn, per coerenza con gli altri componenti UI del progetto: Popover, Select, ecc. — invece di un modal scritto a mano, per ereditare gratuitamente onFocus trap, chiusura da tastiera/Esc, backdrop). Mostra titolo attività, poi i tre campi di `details` (Cosa è / Come arrivarci / Consigli) con etichette in grassetto.

Tutto rispetta la palette colori esistente definita in `app/globals.css` — nessun nuovo colore introdotto.

## Cosa NON cambia

- Il contratto generale della route (`POST /api/generate-itinerary`), i 4 codici di errore, i relativi messaggi italiani.
- Il resto del form (destinazione, date, budget, stile) e la sua validazione.
- Nessuna persistenza: il risultato resta solo in stato React, si perde al refresh (invariato dalle fasi precedenti).

## Testing

- Test automatici (vitest) sullo schema zod aggiornato (nuovi campi `suggestedTime` e `details` — validazione di risposte valide e malformate/incomplete).
- Test sulla costante condivisa delle etichette (se ha senso testarla direttamente, altrimenti copertura indiretta tramite gli schemi che la usano).
- Nessun test automatico sulla vera chiamata a Gemini (invariato).
- Verifica manuale nel browser: una generazione reale (già disponibile una chiave funzionante) per controllare che `maxOutputTokens: 50000` sia sufficiente e che il popup mostri correttamente i nuovi campi.

## Variabili d'ambiente

Nessuna nuova variabile — invariato da Fase 2/provider swap.
