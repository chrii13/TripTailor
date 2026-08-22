# Rilievi misurati sulla produzione (https://trip-tailor-ten.vercel.app)

Misure prese col browser sul sito vero, non sul codice. Viewport 360x740 e 1440x900.

## IMPORTANTE — /crea e /scopri non hanno nemmeno un titolo (h1..h6)
`document.querySelectorAll('h1,h2,h3,h4')` restituisce **zero** elementi su entrambe le pagine.
"PIANIFICA IL TUO VIAGGIO", "IL VIAGGIO", "LE PREFERENZE", "TROVA IL TUO VIAGGIO" sono
`<p>` o `<div>` stilizzati. Conseguenze: nessuna struttura per screen reader, niente
navigazione per titoli, e per Google le due pagine non dichiarano di cosa parlano.
Correzione: h1 sul titolo della pagina, h2 sui due gruppi del form.

## IMPORTANTE — /crea e /scopri non hanno landmark header/nav/footer
Misurato: `header=0, nav=0, footer=0, main=1`. La barra sticky in cima esiste
visivamente ma è un `<div>`. Sulla landing invece è tutto corretto
(header=1, nav=1, footer=1, main=1, 6 section).

## IMPORTANTE — lo slider del budget non ha un nome accessibile
`[role=slider]` con `aria-label` e `aria-labelledby` entrambi `null`, su /crea e /scopri.
Uno screen reader legge "cursore, 1000" senza dire di cosa. WCAG 4.1.2.

## IMPORTANTE — la pagina 404 è quella di default di Next, in inglese
`/pagina-che-non-esiste` → titolo "404: This page could not be found.", pagina bianca
senza stile, senza un link per tornare a casa, su un sito interamente in italiano.
Manca `app/not-found.tsx`.

## IMPORTANTE — title e description identici su tutte e tre le pagine
Tutte e tre: "TripTailor — Pianifica il tuo viaggio" /
"Crea itinerari di viaggio personalizzati in pochi passi."
Nessun `metadata` per pagina. /crea e /scopri sono indistinguibili in SEO e nei preferiti.

## IMPORTANTE — nessun tag Open Graph né Twitter
`meta[property^="og:"]` e `meta[name^="twitter:"]`: **zero**. Un link condiviso su
WhatsApp, Telegram o LinkedIn appare nudo, senza immagine né descrizione. Per un sito
che vive di passaparola è il singolo intervento con più resa per lo sforzo richiesto.

## IMPORTANTE — la sezione #perche è l'unica senza titolo
La barra di navigazione ha la voce "Perché TripTailor" che punta a `#perche`, ma dentro
c'è un `<p class="font-display text-3xl">`, non un h2. È l'unico buco nella scaletta dei
titoli della landing, che per il resto è impeccabile.

## IMPORTANTE — su telefono la barra in alto non porta da nessuna parte
Sotto 640px il bottone "Crea itinerario" è nascosto (`hidden sm:inline-flex`) e il menu a
comparsa contiene solo le quattro àncore di sezione. Risultato: dal telefono la barra
sticky non offre **nessun** modo di arrivare a /crea. Verificato aprendo il menu:
"Destinazioni, Perché TripTailor, Come funziona, Dal budget". O si aggiunge la voce nel
menu, o si mostra il bottone anche sotto sm.

## MINORE — i giorni del calendario sono 30x30 px sul telefono
Misurato a 360px di larghezza. Sopra il minimo WCAG (24px) ma sotto la soglia comoda di
44px, e sono affiancati senza spazio: sul telefono si sbaglia giorno facilmente.
Il pannello invece sta tutto nello schermo (312x473 dentro 360x740) e i due campi orario
non sfondano più il bordo destro — almeno su Chrome; su iOS resta da verificare.

## MINORE — il mese nel calendario è tutto minuscolo ("agosto 2026")
Incoerente con l'elenco dei mesi del periodo flessibile su /scopri, appena corretto in
"Agosto 2026". Stessa parola, due rese diverse a due schermate di distanza.

## MINORE — 707 KB di JavaScript non compresso per una landing di solo testo
Misurato con `decodedBodySize`: 707 KB di JS, 66 KB di CSS, 117 KB di font, 16 richieste.
La landing è statica ma l'intero albero è client-side per via di framer-motion.

## MINORE — 24 SVG su 40 senza aria-hidden né titolo
Sulla landing. Le icone decorative andrebbero marcate `aria-hidden`, altrimenti finiscono
lette o annunciate come immagini senza nome.

## Verificato e a posto
- Nessuno sbordamento orizzontale su nessuna delle tre pagine, né a 360px né a 1440px.
- Il menu a comparsa della barra si apre, sposta il focus dentro, ha `aria-expanded` e un
  bersaglio da 44x44 con `aria-label`.
- `lang="it"`, link esterni con `rel="noopener noreferrer"`.
- La scaletta dei titoli della landing è corretta (un solo h1, h2/h3 annidati bene).

---

# Prove eseguite sulle API vere in produzione

Ho chiamato per davvero i due endpoint dal sito in produzione (poche chiamate, costo
trascurabile). È l'unica parte che nessuna analisi del codice può verificare.

## BLOCCANTE — confermato: tutte le date slittano di un giorno indietro
Ho inviato a `/api/generate-itinerary` esattamente ciò che manda il browser di un utente
italiano quando sceglie **10 → 12 ottobre 2026** (mezzanotte locale, cioè
`2026-10-09T22:00:00.000Z` per via del fuso UTC+2).

Risposta della produzione:
- giorni dell'itinerario: **2026-10-09, 2026-10-10, 2026-10-11**
- meteo: **2026-10-09, 2026-10-10, 2026-10-11**

L'utente chiede il 10-12 e riceve il 9-11. Il difetto colpisce chiunque si trovi a est di
Greenwich, cioè l'intero pubblico italiano, e non si vede sviluppando in locale perché lì
browser e server condividono il fuso. Causa: `JSON.stringify` su oggetti `Date` in
`components/itinerary-form/itinerary-form.tsx:148`, che li converte in UTC.
Correzione: trasmettere le date come stringhe `yyyy-MM-dd`.

## Confermato — su /scopri si possono chiedere viaggi nel passato
Aperto il calendario delle date esatte: i giorni già trascorsi non sono disabilitati
(verificati 27, 28, 29 luglio, ma vale per tutto agosto fino a ieri). La modalità
"date flessibili" invece parte correttamente dal mese corrente: le due modalità della
stessa schermata si comportano in modo diverso.

## Confermato — le date scelte compaiono in inglese
Dopo la selezione, il bottone mostra **"25 Aug - 25 Aug"**. Il calendario dentro il
pannello è invece tutto in italiano ("agosto 2026", "lun mar mer..."), come l'elenco dei
mesi del periodo flessibile. Quindi la stessa schermata mescola due lingue.

## Le API funzionano e la qualità delle proposte è buona
Ricerca inversa, Milano → mare, 2 adulti, 5 notti a ottobre, budget 1.200 €:
5 proposte (San Vito Lo Capo, La Canea, Alicante, Paphos, Albufeira), tutte con finestra
di 5 notti dentro ottobre, tutte sotto budget, e per ognuna la somma delle voci torna
esattamente col totale dichiarato. Ordinamento dal più economico. Nessun difetto.

## IMPORTANTE — i tempi di risposta oscillano moltissimo
Tre chiamate misurate: **26,1 s** e **5,7 s** per la ricerca inversa (stessa identica
richiesta), **27,8 s** per la generazione dell'itinerario. Quasi mezzo minuto di attesa
senza che l'attesa venga annunciata a chi usa uno screen reader, e con un margine
di soli ~32 s prima del tetto di 60 s di Vercel. Un modello un po' più lento del solito e
si finisce nell'errore.

## Confermato — la gerarchia dei titoli si inverte sui monitor stretti
Misurato: a **700px** di larghezza l'h1 vale **40px** mentre gli h2 valgono **48px** e
"Pronto a partire?" arriva a **60px**. Il titolo della pagina è il più piccolo della
pagina. A 1440px il rapporto si raddrizza (h1 64px contro h2 48px). La fascia critica è
quella dei tablet e dei portatili piccoli.
