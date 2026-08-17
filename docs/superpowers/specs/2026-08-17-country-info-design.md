# Informazioni pratiche sul paese di destinazione

**Data:** 2026-08-17
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

Chi viaggia all'estero per la prima volta beneficia di alcune informazioni pratiche di base sulla destinazione: valuta, lingua ufficiale, fuso orario. Oggi l'app non mostra nulla di tutto questo.

La prima idea era di usare l'API REST Countries per recuperare questi dati in tempo reale, ma verificato che la versione attuale (v5) richiede una registrazione con chiave API (non più gratuita/senza chiave). Dato che valuta, lingua e fuso orario di un paese sono dati che cambiano raramente (non un dato "live" come il meteo), si è scelto un **dataset statico incluso nel codice** invece di aggiungere un'altra dipendenza esterna con relativa chiave da gestire.

## Fonte del codice paese

`lib/geocode-destination.ts` (già esistente) chiama LocationIQ con `addressdetails=1` — la risposta include già `address.country_code` (ISO 3166-1 alpha-2, minuscolo, es. `"jp"` per il Giappone), verificato con una chiamata reale. Nessuna chiamata di rete aggiuntiva: si estrae questo campo dalla stessa risposta già usata oggi per lat/lon.

## Dati

- **`lib/country-info.ts`** (nuovo): un dataset statico che copre tutti i paesi (non un sottoinsieme), indicizzato per codice ISO alpha-2, con per ciascuno:
  - `currency`: nome e simbolo (es. `{ name: "Yen giapponese", symbol: "¥" }`)
  - `languages`: elenco delle lingue ufficiali (es. `["Giapponese"]`)
  - `timezones`: elenco dei fusi orari del paese (es. `["UTC+9"]`) — per i paesi con più fusi (USA, Canada, Russia, Australia, ecc.) si elencano tutti, senza indovinare quello della città specifica: essere onesti sul fatto che il paese ne ha più di uno, piuttosto che rischiare di mostrare quello sbagliato.
- Funzione pura `getCountryInfo(countryCode: string): CountryInfo | null` — restituisce `null` se il codice non è nel dataset (caso limite, dato che il dataset copre tutti i paesi riconosciuti da LocationIQ).

## Flusso

1. `geocodeDestination` restituisce anche `countryCode` (oltre a `lat`/`lon` già esistenti) — `null` se la destinazione non è geolocalizzata (stesso comportamento di oggi per lat/lon).
2. Nella route `generate-itinerary`, se `countryCode` è disponibile, si chiama `getCountryInfo(countryCode)`.
3. La risposta della route include un nuovo campo `countryInfo` accanto a `itinerary` e `weather` — `null` se non disponibile, mai un placeholder.
4. Nessun impatto sul prompt inviato a Gemini: questi dati non servono a calibrare l'itinerario (a differenza del meteo), sono solo informativi per il viaggiatore.

## Interfaccia utente

Nuova sezione nel riepilogo del risultato (`itinerary-result.tsx`), visibile solo quando `countryInfo` non è `null` — nessun placeholder quando manca, stesso principio già seguito per il meteo.

Per coerenza visiva con quanto già presente (i tre chip Data/Viaggiatori/Budget con icona in alto, il badge del meteo centrato sotto l'intestazione di ogni giorno): questa sezione va vicino ai chip esistenti in alto (stessa famiglia di informazioni "di contesto del viaggio", non legata a un giorno specifico come il meteo) — tre righe brevi con icona coerente con lo stile Lucide già usato nel resto dell'app (valuta, lingua, fuso orario), senza introdurre nuovi colori o pattern estranei alla palette esistente. I dettagli esatti di layout (icone specifiche, disposizione) restano da rifinire in fase di implementazione seguendo lo stile già presente, non da fissare rigidamente qui.

## Testing

- `getCountryInfo()` è una funzione pura senza alcuna chiamata di rete — a differenza di meteo/geocoding/AI, qui **è possibile e opportuno** testarla in automatico con test veri: casi con un solo fuso orario, casi con più fusi, codice paese non presente nel dataset.
- Verifica manuale nel browser per il posizionamento/stile della nuova sezione nel riepilogo.

## Cosa NON cambia

- Nessuna modifica al prompt inviato a Gemini.
- Nessuna nuova variabile d'ambiente.
- Nessuna chiamata di rete aggiuntiva (il country code arriva gratis dalla chiamata LocationIQ già esistente).
