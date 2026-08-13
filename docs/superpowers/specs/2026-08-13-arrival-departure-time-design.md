# Orario di arrivo/partenza

**Data:** 2026-08-13
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

Oggi il form raccoglie solo le date del viaggio (check-in/check-out), non gli orari. La generazione AI tratta quindi il primo e l'ultimo giorno come giornate piene, anche quando in realtà il viaggiatore arriva a destinazione nel pomeriggio/sera del primo giorno o riparte la mattina presto dell'ultimo — producendo itinerari poco realistici su questi due giorni.

## Obiettivo

Aggiungere due campi opzionali — orario di arrivo (primo giorno) e orario di partenza (ultimo giorno) — che, se compilati, vengono passati all'AI per calibrare il primo e l'ultimo giorno dell'itinerario.

## Dati

- `lib/schema.ts` (`tripFormSchema`): due nuovi campi `arrivalTime?: string` e `departureTime?: string`, formato `"HH:MM"` (24h), entrambi opzionali con default `""`.
- `lib/generate-itinerary-request.ts` (`generateItineraryRequestSchema`): stessi due campi, stesso formato, pass-through verso la route.
- Nessuna validazione con regex: si segue lo stesso pattern già usato per `styleNotes` (stringa opzionale, verificata con un controllo di verità — `if (value) { ... }` — dove serve), dato che l'`<input type="time">` del browser garantisce già il formato `HH:MM` in condizioni normali d'uso.

## UI (form)

I due campi vanno aggiunti dentro il popover "Date del viaggio" già esistente (`components/itinerary-form/itinerary-form.tsx`), sotto il componente `<Calendar>`:

- Due `<input type="time">` affiancati (layout a due colonne, coerente con lo stile Tailwind/shadcn esistente).
- Etichette: "Arrivo (opzionale)" e "Partenza (opzionale)".
- Registrati nel form con `register("arrivalTime")` e `register("departureTime")`.

Il testo mostrato sul bottone trigger del popover resta invariato (solo l'intervallo di date) — i due nuovi campi non compaiono nel riepilogo compatto del bottone, stesso principio già applicato al bottone "Chi viaggia" (dettagli solo dentro il popover).

## Prompt AI

In `lib/itinerary-prompt.ts`, `buildItineraryPrompt` riceve i due nuovi campi (già presenti in `GenerateItineraryRequest`) e aggiunge, solo se valorizzati, istruzioni dedicate:

- Se `arrivalTime` è presente: comunica all'AI l'orario di arrivo a destinazione nel primo giorno e istruisce a non pianificare attività prima di quell'orario, lasciando un margine ragionevole per il trasferimento e il check-in in alloggio.
- Se `departureTime` è presente: comunica l'orario di partenza dell'ultimo giorno e istruisce a concludere le attività con un margine ragionevole prima, per il rientro verso aeroporto/stazione.
- Se il viaggio dura un solo giorno (`from === to`), entrambe le istruzioni si applicano allo stesso giorno.
- Se un campo è vuoto, la relativa istruzione non compare — comportamento identico a quello attuale (giornata piena).

## Cosa NON cambia

- `itinerary-result.tsx`: nessuna modifica. Gli orari di arrivo/partenza non vengono mostrati nel riepilogo del viaggio — servono solo a guidare la generazione, il loro effetto si riflette nel contenuto generato (orari delle attività), non in un campo dati a parte da esporre in UI.
- Lo schema `itineraryResponseSchema` (ciò che l'AI deve rispettare in risposta) resta invariato.
- Nessuna modifica al meteo o alla geolocalizzazione.

## Testing

- `lib/schema.test.ts` / `lib/generate-itinerary-request.test.ts`: campi opzionali, validazione pass-through, valori di default.
- `lib/itinerary-prompt.test.ts`: l'istruzione di arrivo/partenza compare solo quando il rispettivo campo è valorizzato; nessuna istruzione quando entrambi sono assenti (comportamento invariato).
- Nessun test automatico sulla vera generazione AI (stesso principio delle fasi precedenti).
- Verifica manuale nel browser con una generazione reale (viaggio con orario di arrivo pomeridiano/serale, per controllare che il primo giorno rifletta il vincolo).

## Variabili d'ambiente

Nessuna nuova variabile.
