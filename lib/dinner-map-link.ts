/**
 * Il collegamento alla mappa del locale consigliato per la cena.
 *
 * Cerca il **nome** — così si apre la scheda del locale, con orari, recensioni e
 * indicazioni — ma **centrando la mappa sulle coordinate vere** che OpenStreetMap ci ha
 * dato. Le due cose insieme, non una sola: un nome come "Osteria del Sole" esiste in mezza
 * Italia, e cercarlo senza coordinate porterebbe sul locale sbagliato, cioè esattamente
 * l'errore che i consigli sulla cena esistono per evitare.
 *
 * Si usa la forma con il percorso (`/maps/search/<nome>/@<lat>,<lon>,<zoom>z`) e non quella
 * documentata `?api=1&query=...`, che **non ha un parametro per il centro**: senza centro
 * Google sceglie da sé dove cercare, ed è proprio il pezzo che qui non si può perdere.
 *
 * Il nome passa per `encodeURIComponent` perché finisce in un segmento di percorso: fra i
 * nomi veri incontrati ce ne sono con spazi, virgolette, accenti e barre
 * (`il Becco Della Civetta -hotel/ristorante`), e una barra non codificata spezzerebbe
 * il percorso in due.
 */

// Livello di quartiere: i candidati stanno entro 600 m dalla tappa, quindi lo zoom deve
// mostrare la via, non la città.
const ZOOM = 18;

export function buildDinnerMapUrl(name: string, lat: number, lon: number): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat},${lon},${ZOOM}z`;
}
