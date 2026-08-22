# Audit design — Landing page TripTailor

Analisi statica, nessun file modificato, nessun server avviato.
Riferimento: CLAUDE.md, sistema "gravità + voltaggio".

Fatto bene, in una riga ciascuno (non ci torno sopra):
- Il pattern `reduceMotion ? undefined : ...` è applicato in **tutti** e sette i componenti animati, senza una dimenticanza.
- `scroll-behavior: smooth` è correttamente dentro `@media (prefers-reduced-motion: no-preference)`.
- Il marquee ha il track duplicato esattamente 2× e si traduce di `-50%`: il loop è matematicamente senza scatti.
- I commenti in `globals.css` (input time iOS, popover calendario) sono documentazione tecnica di qualità rara.

---

## BLOCCANTE

### B1 — La gerarchia tipografica si inverte: gli h2 diventano più grandi dell'h1 fra 640px e ~873px
`components/landing/hero.tsx:42`, `components/landing/popular-destinations.tsx:57`, `components/landing/reverse-search.tsx:27`, `components/landing/how-it-works.tsx:53`

L'h1 è `text-[clamp(2.5rem,5.5vw,4rem)]`: a 640px vale `5.5vw = 35.2px`, a 800px `44px`, e tocca i 64px solo da 1164px in su. Gli h2 invece sono `text-3xl sm:text-5xl`, cioè **saltano da 30px a 48px netti esattamente a 640px**.

Risultato misurato:
| viewport | h1 | h2 | esito |
|---|---|---|---|
| 639px | 35.1px | 30px | ok |
| 640px | 35.2px | **48px** | h2 più grande del 36% |
| 800px | 44px | **48px** | h2 ancora più grande |
| 873px | 48px | 48px | pareggio |
| 1164px+ | 64px | 48px | ok |

Su tutto il range tablet/laptop piccolo (640–873px, cioè iPad verticale, Surface, finestre affiancate su desktop) "LE METE PIÙ GETTONATE" e "PARTI DAL BUDGET" sono tipograficamente **più importanti** del titolo della pagina. È il difetto più grave della landing: rompe la gerarchia proprio dove il visitatore da tablet decide se restare.

**Correzione:** dare agli h2 la stessa logica fluida dell'h1, con un tetto sotto quello dell'h1:
`text-[clamp(1.875rem,4vw,3rem)]` (30px → 48px a 1200px), e togliere `sm:text-5xl`. In alternativa alzare il punto di rottura dell'h1 (`text-[clamp(2.5rem,7vw,4rem)]`, che a 700px dà già 49px). Va corretto in tutti e tre gli h2 insieme, non uno alla volta.

---

### B2 — `<header>` e `<footer>` sono dentro `<main>`: i landmark della pagina non esistono
`app/page.tsx:12-21`

```
<main className="flex min-h-screen flex-col">
  <SiteNav />      {/* è un <header> */}
  ...
  <SiteFooter />   {/* è un <footer> */}
</main>
```

Per la specifica ARIA, `<header>` espone il ruolo `banner` e `<footer>` il ruolo `contentinfo` **solo quando sono discendenti diretti di `<body>`** (nessun antenato `main`, `article`, `section`, `aside`, `nav`). Annidati dentro `<main>` degradano a `generic`. Conseguenza concreta: uno screen reader non ha più né "banner" né "contentinfo" nella lista dei landmark, e la navigazione rapida per regioni (VoiceOver rotor, NVDA D) salta direttamente dentro il contenuto. Non è teoria: è l'unica navigazione strutturale che la pagina offre, e non c'è nemmeno uno skip-link a compensare.

Aggravante: `<main>` ha `min-h-screen` mentre `<body>` in `app/layout.tsx:34` ha già `min-h-full flex flex-col` — doppia dichiarazione della stessa cosa su due elementi annidati.

**Correzione:** in `app/page.tsx` portare `<SiteNav />` e `<SiteFooter />` fuori da `<main>`, come fratelli, con un fragment che li avvolge; spostare `flex-1` su `<main>` invece di `min-h-screen` (il `body` è già flex column a piena altezza). Zero impatto visivo, ripristina i due landmark.

---

## IMPORTANTE

### I1 — Lo stagger della timeline "Come funziona" non funziona: i quattro passi entrano tutti insieme
`components/landing/how-it-works.tsx:63-71`

```tsx
variants={reduceMotion ? undefined : item}
transition={{ delay: i * 0.1 }}
```
con
```tsx
const item = { visible: { ..., transition: { duration: 0.5, ease: "easeOut" } } }
```

In Framer Motion la transizione **definita dentro una variante ha la precedenza sulla prop `transition`** del componente. La prop viene usata come default e viene interamente scavalcata da `item.visible.transition`, che non contiene `delay`. Quindi `delay: i * 0.1` è codice morto: i quattro `li` entrano simultaneamente, e la cascata che l'autore ha scritto non si vede mai. (Effetto secondario: `viewport.amount: 0.5` fa comunque scattare ciascun `li` quando entra, quindi in scroll lento l'effetto sembra funzionare — motivo per cui il bug è passato inosservato — ma con la sezione già interamente in viewport, es. su desktop 1080p, partono tutti insieme.)

**Correzione:** spostare il delay dentro la variante usando `custom`:
```tsx
const item: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.5, ease: "easeOut", delay: i * 0.1 },
  }),
};
// <motion.li custom={i} ... />  e rimuovere la prop transition
```

---

### I2 — L'elemento firma (l'anteprima itinerario) si anima interamente fuori schermo su mobile
`components/landing/itinerary-preview.tsx:57-62`, `components/landing/hero.tsx:80-82`

La preview usa `animate="visible"`, cioè parte al mount. La sequenza dura `delayChildren 0.75 + 7 × staggerChildren 0.13 + 0.4 = ~2.06s`. Su mobile la griglia dell'hero è a colonna singola (`lg:grid-cols-...`), quindi la card sta **sotto** occhiello + h1 + paragrafo + tre CTA: a 360×780 il suo bordo superiore è a circa 560–620px dal top della sezione, cioè quasi interamente sotto la piega. L'animazione più curata della pagina — "la card che si compila in sequenza", definita in CLAUDE.md come *l'elemento firma* — finisce prima che l'utente mobile la veda, e quando ci arriva trova una card statica.

**Correzione:** sostituire `animate` con `whileInView` + `viewport={{ once: true, amount: 0.25 }}` in `itinerary-preview.tsx:61`, e ridurre `delayChildren` da `0.75` a `0.15` (i 0.75s servivano ad aspettare lo stagger dell'hero, che con whileInView non è più il riferimento). Su desktop il comportamento resta identico perché la card è già in viewport al load.

---

### I3 — Due sezioni bianche consecutive proprio in apertura: l'alternanza chiaro/scuro non parte
`app/page.tsx:14-15`, `components/landing/hero.tsx:26`, `components/landing/popular-destinations.tsx:48`

Sequenza reale dei fondi: `background` (hero) → `background` (destinazioni) → `primary` (identità) → `secondary` (come funziona) → `accent` (dal budget) → `primary` (CTA finale) → `background` (footer).

Due problemi:
1. **Hero e Destinazioni sono entrambi Canvas bianco senza separatore.** Non c'è né bordo né cambio di superficie: il primo scroll dà l'impressione di una pagina unica lunghissima, e l'unica cosa che segnala "nuova sezione" è il salto tipografico dell'h2 — cioè esattamente ciò che B1 rende ambiguo. Il ritmo alternato, che è il cuore del sistema, comincia solo alla terza sezione.
2. **Nebbia (#ecefe9) e wash (#e4f1dc) sono adiacenti** (Come funziona → Dal budget). Sono due grigi-verdi chiari con differenza di luminanza minima (L ≈ 0.82 vs 0.845): il confine non legge come "cambio deliberato di superficie" ma come artefatto di rendering o come un blocco che ha ereditato per sbaglio un colore leggermente diverso. Peggio: il wash è più chiaro della Nebbia, quindi la progressione va *all'indietro*.

**Correzione:** dare a "Le mete più gettonate" fondo `bg-secondary` (Nebbia), ottenendo `bianco → Nebbia → Bosco → bianco → wash → Bosco → bianco`. Cioè: spostare `how-it-works` su `bg-background` e lasciare l'unico wash alla sezione "Dal budget", che così diventa l'unica superficie verde chiara della pagina e si distingue davvero. In subordine, se i fondi non si toccano, mettere almeno `border-t border-border` sul confine hero/destinazioni.

---

### I4 — Il Sole non è raro: 17 occorrenze, e 9 sono pallini decorativi
`components/landing/itinerary-preview.tsx:89`, `components/landing/how-it-works.tsx:72`, `components/landing/site-nav.tsx:76`, `components/landing/reverse-search.tsx:23`, `components/landing/site-footer.tsx:30`, `components/landing/hero.tsx:44-45`, `components/landing/popular-destinations.tsx:58`, `components/landing/reverse-search.tsx:28`, `components/landing/final-cta.tsx:30`

Conteggio: 5 bullet nella preview + 4 pallini della timeline + 1 sottolineatura logo + 2 barrette d'accento (reverse-search, footer) + 4 `emphasis-mark-display` + 1 bottone CTA finale = **17 elementi Sole**. CLAUDE.md dice che il Sole è "CTA, stati attivi, le barrette di accento e le sottolineature spesse sulle parole chiave" — cioè *segnali*, non decorazione. Nove pallini elenco in giallo trasformano il colore-voltaggio nel colore-bullet: quando poi arriva il bottone giallo del `final-cta`, non ha più nessuna carica residua perché l'occhio ha già visto il giallo diciassette volte.

**Correzione:** togliere il giallo dai 9 pallini. I bullet della preview (`itinerary-preview.tsx:89`) diventano `bg-primary` o `bg-border`; i pallini della timeline (`how-it-works.tsx:72`) diventano `bg-primary` con `border-secondary` invariato — e tenere il Sole **solo sul pallino del passo attivo**, se un giorno ci sarà uno stato attivo, altrimenti su nessuno. Il Sole resta su: barrette d'accento, emphasis-mark, CTA finale, sottolineatura logo. Da 17 a 8, di cui uno solo su un elemento cliccabile.

---

### I5 — Stessa azione, due colori di bottone: "Crea il tuo itinerario" è Bosco nell'hero e Sole nella CTA finale
`components/landing/hero.tsx:58` (variant default → `bg-primary`) vs `components/landing/final-cta.tsx:30` (`bg-voltage`)

Il bottone con **lo stesso identico label e la stessa identica destinazione** (`/crea`) è verde in cima e giallo in fondo. In un sistema che si chiama "gravità + voltaggio" il voltaggio deve identificare *l'azione*, non *la posizione nella pagina*. Un visitatore che scorre due volte non ha modo di sapere se sono due cose diverse.

Nota: nel `final-cta` il giallo è su fondo Bosco, dove è l'unica scelta ad alto contrasto sensata; nell'hero su fondo bianco il giallo `#f0b429` con testo Bosco dà 1.9:1 sul bordo ma il testo interno `voltage-foreground` (#1a4d33 su #f0b429) è a 6.4:1, quindi sarebbe accessibile anche lì.

**Correzione:** una delle due, non entrambe. Preferibile: rendere **Sole entrambe** le CTA primarie `/crea` (hero e finale), lasciando Bosco ai bottoni `outline` e alla nav. Se invece si vuole tenere l'hero sobrio, allora nel `final-cta` il bottone va `bg-background text-primary` e il Sole sparisce anche da lì — mai le due varianti coesistenti.

---

### I6 — Tre CTA in fila nell'hero: la decisione principale è diluita
`components/landing/hero.tsx:54-78`

Sullo stesso rigo convivono "Crea il tuo itinerario" (pieno), "Non so dove andare" (outline, stessa `size="lg"`, stesso `px-8`) e "Guarda come funziona" (link sottolineato). Due bottoni `lg` con peso visivo quasi identico costringono a una scelta che l'utente non è in grado di fare in 3 secondi, perché non sa ancora cosa sia la ricerca inversa — che viene spiegata 4 sezioni più in basso.

Misura a 360px (contenitore 328px): "Crea il tuo itinerario" ≈ 244px, "Non so dove andare" ≈ 200px, link ≈ 165px → tre righe, separate da `gap-6` (24px) sia in orizzontale che in verticale. Si ottiene una colonna di tre elementi eterogenei alta ~180px con spaziature identiche fra bottone-bottone e bottone-link: nessuna gerarchia leggibile.

**Correzione:** una CTA primaria sola. "Non so dove andare" diventa una riga di testo sotto il bottone, es. *"Non sai ancora dove andare? Parti dal budget →"* con link a `/scopri`; "Guarda come funziona" si può eliminare del tutto (la sezione è già nella nav e la pagina si scorre). E separare i gap: `gap-x-4 gap-y-3` invece di `gap-6`.

---

### I7 — Con `prefers-reduced-motion` il nastro delle destinazioni mostra 3 chip e nasconde le altre 9
`app/globals.css:163-167`, `components/landing/reverse-search.tsx:36-53`

Con reduced-motion l'animazione è `none`, quindi il track resta a `translateX(0)` dentro un contenitore `overflow-hidden`: si vedono solo le chip che entrano nella larghezza disponibile (a 360px: circa 2, su desktop 1024: circa 6 su 24 renderizzate). Le altre non sono raggiungibili in nessun modo — niente scroll (il contenitore non è scrollabile), niente wrap. E siccome il blocco è `aria-hidden`, non lo sono nemmeno via screen reader.

Il nastro non è puro fregio: porta l'unica informazione quantitativa della sezione (Cracovia ~700 €, Amsterdam ~1.400 €), cioè la prova che la funzionalità è credibile. Chi ha reduced-motion attivo — che su iOS è una preferenza comunissima — vede una fascia mozzata.

**Correzione:** in reduced-motion cambiare il layout, non solo fermare l'animazione:
```css
@media (prefers-reduced-motion: reduce) {
  .scopri-marquee-track { animation: none; flex-wrap: wrap; width: 100%; }
  .scopri-marquee-track > :nth-child(n + 13) { display: none; } /* il duplicato */
}
```
e togliere `aria-hidden` dal wrapper, sostituendolo con `aria-hidden` sulle sole bandiere SVG (che sono decorative) — così le 12 destinazioni con i prezzi diventano contenuto reale.

---

### I8 — Sotto 1024px il menu a comparsa compare ~200px prima del necessario
`components/landing/site-nav.tsx:85` (`lg:flex`), `:114` e `:122` (`lg:hidden`)

Misura della riga (font-size effettivi, Geist ~0.52em di larghezza media per il testo `text-sm`):
- logo `text-lg` Fraunces 725 `tracking-[0.15em]`, "TripTailor" 10 caratteri ≈ 157px
- pill nav: 4 label (78 + 110 + 88 + 68 = 344px) + 4 × `px-3.5` (112px) + 3 gap `gap-0.5` (6px) + `p-1` (8px) = **470px**
- CTA `size="sm"` "Crea itinerario" ≈ 100px
- 2 × `gap-3` = 24px
- `sm:px-8` = 64px

Totale ≈ **815px**. CLAUDE.md dichiara 827px. In entrambi i casi la riga sta comodamente in 900px, ma la soglia è `lg` = 1024px: fra ~840px e 1023px un utente desktop con la finestra affiancata vede l'hamburger pur avendo spazio abbondante — e perde l'indicatore di sezione attiva, che è l'unica cosa che dice "sei qui".

Aggravante di accessibilità: il trigger dell'hamburger è `size-11 sm:size-8` (`site-nav.tsx:114`), cioè **32px da 640px in su**, ma resta visibile fino a 1023px. Fra 640 e 1023 sono quasi tutti tablet, cioè dispositivi touch, e 32px è sotto la soglia dei 44px raccomandati (WCAG 2.2 SC 2.5.8 fissa il minimo a 24px, ma 44px è la soglia di usabilità reale).

**Correzione:** abbassare la soglia a un breakpoint arbitrario onesto — `max-[860px]:hidden` / `min-[860px]:flex` invece di `lg:` — e togliere `sm:size-8` dal trigger, lasciandolo `size-11` per tutta la fascia in cui è visibile.

---

### I9 — Bersagli touch che si rimpiccioliscono a 640px, dove i dispositivi touch abbondano
`components/landing/site-footer.tsx:43` e `:82` e `:92` (`py-3 sm:py-0`), `components/landing/site-nav.tsx:114` (`sm:size-8`)

Il pattern "target grande solo sotto `sm`" equipara `sm` a "desktop". Non lo è: 768px e 1024px sono iPad verticale e orizzontale. Sopra 640px i link del footer tornano ad altezza di riga (~20px) con `gap-1.5` (6px) fra uno e l'altro: su iPad sono sei bersagli da 20px separati da 6px, praticamente impossibili da centrare con il pollice.

**Correzione:** sostituire `py-3 sm:py-0` con `py-2` fisso su tutti i link del footer (accompagnato da `gap-0` sulla lista, per non far crescere la colonna) — 16px di padding + 20px di riga = 36px ovunque, un compromesso che non deforma il desktop. Stessa logica per il trigger della nav (vedi I8).

---

### I10 — La sezione `#perche` non ha nessun heading, e il suo unico titolo è un `<p>`
`components/landing/site-identity.tsx:9-22`, `components/landing/site-nav.tsx:14`, `components/landing/site-footer.tsx:7`

Nav e footer promettono entrambi "Perché TripTailor". Chi ci clicca atterra su una sezione che quelle parole non le contiene, e che nel document outline **non esiste**: la frase grande è un `<p>` (`site-identity.tsx:20`), non un `h2`. Per uno screen reader la pagina ha h1 → h2 (Mete) → h2 (Come funziona) + h3 (passi) → h2 (Dal budget) → h2 (Pronto a partire?) → h3 (colonne footer), con un buco esattamente dove la nav manda l'utente.

Nota: la scelta di `<p>` sembra deliberata (la frase è un claim, non un titolo) — ma allora la voce di nav va rinominata, o va aggiunto un occhiello `<h2 class="sr-only">Perché TripTailor</h2>`.

**Correzione minima:** promuovere la frase a `<h2>` mantenendo identiche le classi (l'aspetto non cambia di un pixel), oppure aggiungere sopra l'occhiello maiuscolo `Perché TripTailor` con lo stesso stile usato in `reverse-search.tsx:24` — che tra l'altro darebbe alla sezione la barretta d'accento che tutte le altre hanno e lei no.

---

### I11 — Copy sbagliato: "Da dove partono di solito i nostri viaggiatori" descrive le partenze, non le mete
`components/landing/popular-destinations.tsx:60-62`

Il titolo dice "Le mete più gettonate", il sottotitolo dice "**Da dove** partono di solito i nostri viaggiatori". In italiano "da dove partono" indica la città di origine. Il sottotitolo contraddice il titolo e, peggio, contraddice la sezione "Dal budget" che invece chiede davvero la città di partenza — un utente che ha letto entrambe si convince che Roma e Santorini siano aeroporti di partenza.

Aggravante: "i nostri viaggiatori" è una prova sociale inventata. CLAUDE.md dice che l'app non salva nulla e non ha account: non esistono "nostri viaggiatori" e non esiste il dato che dice quali mete siano gettonate (la lista è statica in `lib/popular-destinations.ts`). È un claim falso in una landing che altrove è scrupolosamente onesta ("media degli ultimi 5 anni, non una previsione", "il tuo sarà diverso", "stime, non prezzi prenotabili").

**Correzione:** `"Otto punti di partenza per il tuo itinerario. Scegline uno e il form si compila da solo."` — dice il vero, spiega cosa fa il click (che oggi non è annunciato da nulla) e non promette statistiche inesistenti.

---

### I12 — "su misura" tre volte, "bastano" due volte in due sezioni
`components/landing/hero.tsx:38` e `:44-45`, `components/landing/how-it-works.tsx:10` e `:26`, `components/landing/final-cta.tsx:25`

- Occhiello hero: "Itinerari **su misura**, generati dall'AI"
- H1, riga sotto: "Il tuo itinerario, cucito **su misura**." — con "su misura" per giunta *sottolineato in giallo*, cioè evidenziato come parola-chiave a 40px di distanza dalla sua stessa ripetizione a 12px.
- Passo 04: "Ricevi il tuo itinerario **su misura**"
- Passo 01: "**bastano** pochi campi" / CTA finale: "**Bastano** pochi minuti"

La ripetizione occhiello→h1 è la più dannosa: l'occhiello esiste per aggiungere informazione che il titolo non dà, e qui non ne aggiunge nessuna tranne "AI".

**Correzione:** occhiello → `"Pianificazione viaggi con l'AI"` oppure eliminarlo del tutto (l'h1 regge da solo e la pagina guadagna respiro). Passo 04 → `"Ricevi il piano completo"`. CTA finale → `"Pochi minuti e il tuo piano di viaggio è pronto."`

---

### I13 — L'anteprima itinerario a tutta larghezza fra 640px e 1024px
`components/landing/hero.tsx:28`, `components/landing/itinerary-preview.tsx:42`

La griglia è a due colonne solo da `lg`. Fra 640 e 1023px la card della preview occupa l'intera larghezza del contenitore — fino a **959px** a 1023px di viewport. Dentro ci sono cinque righe con una colonna orario `w-11` (44px), un pallino da 6px e un titolo di 20-30 caratteri: a 959px ogni riga è per l'80% vuota, e la card sembra un errore di layout più che l'anteprima di un prodotto curato.

**Correzione:** limitare la card sotto `lg`: `<div className="mx-auto w-full max-w-md lg:max-w-none">` attorno a `<ItineraryPreview />` in `hero.tsx:80`. Zero effetto su desktop, sistema tutta la fascia tablet.

---

### I14 — L'header cambia altezza *durante* lo scroll animato verso un'ancora, spostando il bersaglio
`components/landing/site-nav.tsx:25` e `:60-62`, `app/globals.css:134-138`, `scroll-mt-20` in `popular-destinations.tsx:48` / `how-it-works.tsx:43` / `reverse-search.tsx:15`

Al click su una voce di nav il browser calcola la posizione finale con l'header alto 88px, poi avvia lo smooth scroll; superati 24px `condensed` diventa `true` e l'header **si contrae di 28px con una transizione di 200ms** mentre lo scroll è ancora in volo. Il documento si accorcia sotto la posizione bersaglio già calcolata, quindi la sezione arriva ~28px più in basso del previsto. Con `scroll-mt-20` (80px) contro un header condensato di 60px, il margine reale finale è 20 + 28 = ~48px di spazio morto invece dei 20 previsti — abbastanza da far sparire l'occhiello sopra il titolo in alcuni casi.

Aggravante di performance: `motion-safe:transition-[height]` e `motion-safe:transition-[font-size]` (`site-nav.tsx:67`) animano due proprietà che forzano layout ogni frame, su un elemento `sticky` che sta sopra l'intera pagina. Sono esattamente le due proprietà da non animare mai.

**Correzione:** sostituire la contrazione dell'altezza con `padding` animato via `transform`, oppure — più semplice e più aderente al sistema — **eliminare del tutto la condensazione**: 88px fissi, e riservare l'unico feedback di scroll alla `ScrollProgress`, che già c'è, già funziona e non sposta niente. In subordine, tenere la condensazione ma allineare `scroll-mt` all'altezza condensata (`scroll-mt-[76px]`) e usare `transition-[height]` solo sull'elemento interno.

---

### I15 — Radius 14px sulle card, mentre il sistema ne dichiara 10
`components/landing/itinerary-preview.tsx:42` (`rounded-xl`), `components/landing/popular-destinations.tsx:80` (`rounded-xl`) + `components/ui/card.tsx:10` (`rounded-xl` di default)

`--radius: 0.625rem` = 10px, e nel `@theme` `--radius-xl: calc(var(--radius) + 4px)` = **14px**. CLAUDE.md dice esplicitamente "`10px` per card e input". Tutte le card della landing usano `rounded-xl`, cioè 14px. Non è un dramma isolato, ma significa che la landing ha un raggio e il resto dell'app (form di `/crea`, input) ne ha un altro: affiancando le due pagine si vede.

**Correzione:** `rounded-lg` (= `--radius-lg` = 10px) su `itinerary-preview.tsx:42` e sul wrapper `Link` in `popular-destinations.tsx:80`, più `rounded-lg` come override sulla `<Card>` in `:82`. Oppure, se i 14px piacciono, aggiornare CLAUDE.md — ma una delle due va fatta.

---

### I16 — Peso `725` hardcoded nove volte, mentre il sistema dichiara 900
`components/landing/hero.tsx:42`, `itinerary-preview.tsx:45`, `popular-destinations.tsx:57`, `reverse-search.tsx:27`, `site-identity.tsx:20`, `how-it-works.tsx:53` e `:73`, `final-cta.tsx:21`, `site-nav.tsx:67`, `site-footer.tsx:31`

CLAUDE.md: "display Fraunces **900** maiuscolo con `tracking-[-0.03em]`". Il codice: `font-[725]` ovunque, e tracking che varia fra `-0.015em`, `-0.01em` e `-0.005em`. Nessuno dei tre valori è quello documentato. O il documento è stale (probabile) o il codice è derivato; in ogni caso il valore magico `725` è ripetuto in dieci punti su undici file, cioè cambiarlo significa una ricerca-e-sostituzione a mano con rischio di dimenticarne uno.

Aggravante fine: `.font-display` in `globals.css:142-144` fissa `font-variation-settings: "opsz" 70`. L'asse `opsz` di Fraunces serve a **compensare la dimensione reale del testo**: 70 è corretto per l'h1 a 64px, sbagliato per il logo condensato a 14px (`site-nav.tsx:68`), per il numero di passo a 14px (`how-it-works.tsx:73`) e per il "TripTailor" del footer a 14px (`site-footer.tsx:31`). A 14px con opsz 70 le grazie sono troppo sottili e la spaziatura troppo stretta: è esattamente il difetto che l'asse ottico esiste per evitare.

**Correzione:** definire il peso una volta sola, dentro `.font-display` (`font-weight: 725`) e togliere i dieci `font-[725]`; aggiungere una utility `.font-display-sm { font-variation-settings: "opsz" 24; }` per le tre occorrenze piccole. E allineare `tracking` a due soli valori: uno per i titoloni (`-0.015em`) e uno per i piccoli maiuscoletti (`0.15em`).

---

### I17 — Quattro letter-spacing diversi per lo stesso ruolo tipografico
`site-nav.tsx:67` (`0.15em`), `hero.tsx:36` (`0.16em`), `reverse-search.tsx:24` (`0.16em`), `itinerary-preview.tsx:71` (`0.12em`), `site-footer.tsx:20` (`0.18em`), `site-footer.tsx:31` (`0.15em`)

Lo stesso identico ruolo — *maiuscoletto piccolo, semibold, spaziato* — ha cinque valori: 0.12, 0.15, 0.15, 0.16, 0.16, 0.18. Nessuna delle differenze è percettibile isolatamente, tutte insieme rendono impossibile mantenere il sistema: il prossimo che aggiunge un occhiello sceglierà un sesto valore.

**Correzione:** un solo token, `--tracking-eyebrow: 0.16em`, e una utility `.eyebrow` che porti anche `text-xs font-semibold uppercase text-muted-foreground` (già identiche in `hero.tsx:36` e `reverse-search.tsx:24`, che sono la stessa classe copiata due volte).

---

### I18 — Gradienti in una landing che li vieta
`components/landing/reverse-search.tsx:51-52`

```
bg-gradient-to-r from-accent to-transparent
```
CLAUDE.md: "niente gradienti né ombre". Qui il gradiente ha una giustificazione funzionale (mascherare i bordi del nastro) e la eccezione è difendibile — ma va scritta nel documento, altrimenti la prossima persona la considererà un precedente per gradienti decorativi.

Difetto tecnico dentro l'eccezione: `to-transparent` interpola verso `rgba(0,0,0,0)`, cioè verso **nero trasparente**. Su Chrome/Safari l'interpolazione premoltiplicata evita il classico alone grigio, ma su alcune combinazioni (e in Firefox con certi profili colore) la fascia mediana vira di qualche punto verso il grigio. Il fix canonico è interpolare verso lo stesso colore ad alpha zero.

**Correzione:** `from-accent to-accent/0` su entrambe le maschere. E aggiungere una riga a CLAUDE.md: "gradienti ammessi solo come maschera di leggibilità, mai come superficie".

---

## MINORE

### M1 — Classe CSS morta sul nastro
`components/landing/reverse-search.tsx:36` applica `scopri-marquee`, ma in `app/globals.css` esiste solo `@keyframes scopri-marquee` e `.scopri-marquee-track`. La regola `.scopri-marquee` non esiste: è il residuo del `:hover` di pausa rimosso nel commit `496a131`. Da togliere.

### M2 — Il pallino della timeline è 1,5px fuori asse rispetto alla linea
`components/landing/how-it-works.tsx:61` e `:72`. La `ol` ha `border-l` (1px) + `pl-8` (32px), quindi il bordo sinistro del `li` è a 33px dal bordo della lista. Con `-left-[37px]` e un pallino `size-3` (12px), il centro del pallino cade a `33 − 37 + 6 = 2px`, mentre la linea è centrata a `0.5px`. Serve `-left-[38.5px]` (o `-left-[calc(2rem+6.5px)]`). A 12px di diametro lo scarto si vede.

### M3 — La timeline è rientrata di 40px rispetto al titolo della sezione
`components/landing/how-it-works.tsx:61` (`ml-2 max-w-2xl border-l pl-8 sm:ml-0`). Su mobile i testi dei passi partono a `8 + 1 + 32 = 41px` dal bordo, mentre l'h2 sopra parte a 0: la colonna di testo non è allineata a niente. Su `sm+` restano 33px di disallineamento. Soluzione pulita: tenere la rail dentro e allineare il testo con `-ml-[33px]` sul contenitore o, più semplice, mettere la rail a destra del numero con `grid grid-cols-[auto_1fr]`.

### M4 — `text-balance` usato sui paragrafi
`components/landing/hero.tsx:49`, `components/landing/reverse-search.tsx:30`, `components/landing/site-identity.tsx:20` (qui è corretto, è un titolo). `text-wrap: balance` è specificato per blocchi corti: i browser lo disattivano oltre 4-6 righe di testo e ha costo di layout quadratico. Per i paragrafi il valore giusto è `text-pretty` (evita le righe orfane senza bilanciare tutto).

### M5 — La sottolineatura gialla dell'h1 rischia di toccare la riga successiva
`components/landing/hero.tsx:42` (`leading-[0.9]`) + `app/globals.css:174-176` (`background-position: 0 88%`, `background-size: 100% 0.14em`). A 360px l'h1 vale 40px con line-height 36px: la barra parte a `0.88 × 36 = 31.7px` ed è alta `0.14 × 40 = 5.6px`, quindi finisce a **37.3px**, cioè 1,3px *oltre* la line box. Con "IL TUO ITINERARIO, CUCITO SU MISURA." che a quella larghezza va su 3-4 righe, la barra sotto "ITINERARIO" tocca le maiuscole della riga sotto. Fix: `background-position: 0 92%` non basta (peggiora); serve `leading-[0.95]` sotto `sm` o `background-size: 100% 0.11em`.

### M6 — Due parole evidenziate su sei nell'h1
`components/landing/hero.tsx:44-45`: `itinerario` + `su misura` = 3 parole su 6 sottolineate in giallo. CLAUDE.md dice "1-2 parole per titolo". Con metà titolo evidenziato l'evidenziazione non evidenzia più niente. Tenere solo `itinerario` (che è anche il sostantivo di prodotto).

### M7 — `aria-current="true"` invece di `"location"`
`components/landing/site-nav.tsx:93` e `:131`. Per una voce che punta a una sezione della pagina corrente il token semanticamente corretto è `aria-current="location"`; `"true"` è valido ma generico e alcuni screen reader lo annunciano come "corrente" senza specificare cosa.

### M8 — Il logo è un `<a href="#">`
`components/landing/site-nav.tsx:64`. Aggiunge `#` all'URL, non è un `Link` di Next, e da `/crea` un logo `href="#"` non riporterebbe alla home. Meglio `<Link href="/">`.

### M9 — Lo stato attivo della nav resta acceso su "Dal budget" fino in fondo alla pagina
`components/landing/site-nav.tsx:40-43`. Quando nessuna sezione è in viewport, il codice azzera `active` solo se `scrollY < innerHeight / 2`; scorrendo oltre l'ultima sezione (CTA finale + footer, ~600px di pagina) la voce "Dal budget" resta evidenziata pur non essendo più dove ci si trova. Aggiungere una condizione simmetrica, o dare un `id` anche alla CTA finale.

### M10 — La griglia delle mete lascia due orfane su tre colonne
`components/landing/popular-destinations.tsx:65` + 8 elementi in `lib/popular-destinations.ts:20-29`. Su `sm` (3 colonne) 8 card danno 3+3+**2**, con l'ultima riga vuota a destra. O si va a 9 mete, o si usa `sm:grid-cols-2 lg:grid-cols-4` (2/2/4, sempre pieno).

### M11 — "Costa Rica / Costa Rica" e un badge che non ci sta a 360px
`lib/popular-destinations.ts:28` ripete lo stesso testo su nome e paese: la card mostra "Costa Rica" sopra "Costa Rica". E `:27` ha il badge `"Città sull'oceano"` (17 caratteri): a 360px la card è larga `(328 − 12) / 2 = 158px`, meno `px-4` ×2 → 126px di contenuto, contro un badge da ~116px stimati — margine di 10px, cioè sopravvive per un pelo con Geist e va a capo con qualsiasi font di fallback, producendo una pill a due righe. Fix: `country` vuoto per Costa Rica (o "America Centrale") e badge → "Oceano".

### M12 — Focus ring diverso da quello del resto dell'app
`components/landing/popular-destinations.tsx:80` usa `ring-2 ring-ring ring-offset-2`, mentre `components/ui/button.tsx:8` (e quindi tutti gli altri elementi focusabili della pagina) usa `ring-[3px] ring-ring/50`. Tabulando la landing il ring cambia spessore e opacità sulle card. Allineare al pattern shadcn.

### M13 — Il footer finisce a 20px dal bordo inferiore
`components/landing/site-footer.tsx:28` ha `pt-12` e nessun `pb`; l'unico spazio sotto la riga del copyright sono i 20px di `py-5` in `:101`. La pagina si chiude di taglio. Serve `pb-8` sul `<footer>`.

### M14 — L'anno del copyright si congela alla build
`components/landing/site-footer.tsx:103`: `new Date().getFullYear()` in un Server Component statico viene valutato al momento della build. Se la landing non viene ridistribuita, dal 1º gennaio mostra l'anno sbagliato. (Difetto minimo, ma reale su un sito che deploya di rado.)

### M15 — La barra di avanzamento e il bordo dell'header si sommano in una striscia da 4px
`components/landing/site-nav.tsx:56` (`border-b border-border`, #d4dad1) + `components/landing/scroll-progress.tsx:17` (track `bg-accent`, #e4f1dc). Il track pallido e il bordo hanno luminanze quasi identiche: a scroll 0 sotto la nav si legge un'unica fascia grigio-verde di 4px, e non è chiaro che una parte sia un indicatore. Fix: track `bg-transparent` (la barra Bosco si vede lo stesso sul bianco) oppure togliere `border-b` quando la barra è presente.

### M16 — Tema scuro definito e mai usato
`app/globals.css:89-123` definisce 34 token `.dark`, ma niente nella landing né in `app/layout.tsx` applica mai la classe `.dark` e non c'è nessun `prefers-color-scheme`. Sono ~35 righe di CSS che non entreranno mai in vigore. Non è un difetto della landing (è pre-esistente allo scaffold shadcn) ma vale la pena decidere: o si attiva, o si toglie.

### M17 — Contrasto al limite dell'occhiello sul wash
`components/landing/reverse-search.tsx:24`: `text-muted-foreground` (#666b64) su `bg-accent` (#e4f1dc) dà **4,68:1**. Passa AA per testo normale (4,5:1) con 0,18 punti di margine, ma si tratta di testo a 12px, semibold, maiuscolo e con `tracking 0.16em` — la combinazione peggiore per la leggibilità reale. Su `bg-secondary` (Nebbia) lo stesso colore scende a **4,54:1**, ancora più al limite. Passare a `text-foreground/70` (#3d423c al 70% su wash ≈ 7,3:1) toglie ogni dubbio senza cambiare la percezione.

### M18 — Il paragrafo di "Come funziona" si scusa in anticipo di una sezione che arriva dopo
`components/landing/how-it-works.tsx:57-59`: *"Vale se la meta ce l'hai già in mente: se non ce l'hai, si parte dal budget."* — è una nota a piè di pagina messa in cima, che introduce un'eccezione prima ancora di aver spiegato la regola, e rimanda a una sezione che il lettore non ha ancora visto. Meglio spostarla **dopo** il passo 04, come riga di collegamento con link: *"Non hai ancora una meta? Si può partire dal budget →"*.

### M19 — L'hero centra verticalmente due colonne di altezza molto diversa
`components/landing/hero.tsx:28` (`items-center`). A `lg`, la colonna sinistra è alta ~330px e la card di destra ~420px: il titolo si ritrova a fluttuare 45px sotto il bordo superiore della card, senza allinearsi né in alto né alla linea di base di niente. `items-start` con un `lg:pt-6` sulla colonna testo dà un allineamento intenzionale invece di uno casuale.

---

## IDEA

### D1 — `max-w-5xl` per tutto: a 1920px la landing è una colonna da 1024px in un deserto bianco
Ogni sezione usa `max-w-5xl` (1024px). Su un monitor 1920×1080 significa 448px di bianco per lato, e — cosa peggiore — l'hero a due colonne si comprime in 960px utili quando ne avrebbe 1400 disponibili. Una landing "bellissima" a 1920 ha bisogno di almeno un elemento che rompa la colonna: il nastro delle destinazioni è il candidato perfetto (oggi è clippato dentro il `max-w-5xl`, `reverse-search.tsx:17` e `:36`). Farlo full-bleed edge-to-edge, con le maschere ancorate al viewport, darebbe alla sezione una scala che oggi non ha.

### D2 — Nessun Open Graph, nessuna immagine social
`app/layout.tsx:23-26` ha solo `title` e `description`. Un link a TripTailor condiviso su WhatsApp o LinkedIn oggi è un rettangolo bianco. Con Next.js basta un `app/opengraph-image.tsx` che renderizzi il titolo in Fraunces su Bosco con la barretta Sole: 30 righe, e la landing acquista una faccia fuori dal browser.

---

## Cosa farei per alzare l'asticella

### 1. Trasformare l'anteprima itinerario in una demo che si rigenera
Oggi è una card statica su Lisbona che si compila una volta e poi resta lì per sempre. È l'unico posto in cui la landing *mostra* il prodotto invece di raccontarlo, e lo spende in due secondi. Proposta: tre destinazioni precalcolate (Lisbona, Kyoto, Dolomiti) che ruotano ogni ~6 secondi con le righe che si smontano e rimontano — o, molto meglio, **le card delle mete gettonate collegate alla preview**: passandoci sopra (o toccandole) la preview si ricompila con l'itinerario di quella meta. Diventa un giocattolo, l'utente ci perde trenta secondi, e in quei trenta secondi ha capito esattamente cosa riceverà. Costo: tre array statici in un file, nessun backend, nessuna violazione della regola "niente API in Fase 1". È l'investimento con il rapporto effetto/rischio più alto di tutta la lista.

### 2. Costruire una vera scala tipografica fluida, invece di sei valori scelti a mano
Oggi convivono un `clamp()` sull'h1, un `text-3xl sm:text-5xl` sugli h2, un `text-4xl sm:text-6xl` sulla CTA finale, e cinque letter-spacing diversi sui maiuscoletti. Il risultato è B1: la gerarchia si inverte su un'intera classe di dispositivi. Proposta: cinque token in `@theme` (`--text-display`, `--text-title`, `--text-lead`, `--text-body`, `--text-eyebrow`), ciascuno un `clamp()` con lo stesso rapporto fra i gradini (una scala 1.25 fluida da 360 a 1440px), più tre utility (`.type-display`, `.type-title`, `.type-eyebrow`) che portino peso, tracking e opsz coerenti. Da lì in poi nessun titolo della landing avrà più una classe tipografica ad hoc, e i sei difetti I16/I17/M5/M6/B1 spariscono insieme per costruzione.

### 3. Dare alla landing una firma grafica che non sia un rettangolo
Il sistema è tutto rettangoli con bordo 1px e fondi pieni: rigoroso, ma ogni sezione ha la stessa forma della precedente. Il progetto ha già una geometria propria inutilizzata — la **linea del viaggio**: la timeline verticale di "Come funziona" e la colonna oraria dell'anteprima sono la stessa idea disegnata due volte in due modi diversi. Proposta: farne l'elemento continuo della pagina, una sottile linea Bosco che entra dall'hero, attraversa i confini fra le sezioni (cambiando in Sole solo nei nodi: il pallino della meta, i quattro passi, la CTA finale) e finisce nel footer. Puramente CSS, `aria-hidden`, disattivabile in reduced-motion. Trasforma sette blocchi impilati in un unico percorso — cioè esattamente la metafora del prodotto.

### 4. Rendere onesto e navigabile il bivio "so dove andare" / "non lo so"
Il prodotto ha due porte d'ingresso (`/crea` e `/scopri`) e la landing le tratta come una principale e una di servizio: nell'hero il secondo bottone è un outline anonimo (I6), poi la ricerca inversa riappare quattro sezioni dopo come se fosse una novità, e "Come funziona" deve scusarsi di non parlarne (M18). Proposta: una sezione-bivio subito dopo l'hero, due pannelli affiancati — Bosco pieno per "Ho già una meta", wash per "Non so dove andare" — ciascuno con la sua micro-spiegazione in una riga e la sua CTA. L'hero torna ad avere una CTA sola, il bivio diventa esplicito nel primo scroll invece che implicito, e le due sezioni oggi separate (destinazioni gettonate e "dal budget") diventano l'approfondimento naturale di un pannello ciascuna.

### 5. Un passaggio serio su tablet, che oggi è il dispositivo peggio servito
Cinque dei rilievi più gravi vivono tutti nella stessa fascia 640–1024px: la gerarchia h1/h2 invertita (B1), la preview a 960px di larghezza mezza vuota (I13), l'hamburger a 32px in un contesto touch (I8), il menu che compare 200px prima del necessario (I8), i link del footer che tornano a 20px di altezza (I9). Non è un caso: il codice usa `sm` come sinonimo di "desktop" e `lg` come sinonimo di "grande", e in mezzo non c'è nessuna decisione. Proposta: introdurre `md` come breakpoint reale con una regola dichiarata ("da 768px il layout è a due colonne ma i bersagli restano touch"), rifare il passaggio su 768px e 1024px verificando ogni sezione, e scrivere la regola in CLAUDE.md — perché il difetto vero non è nessuno dei cinque bug, è che manca un'opinione su cosa sia un tablet.
