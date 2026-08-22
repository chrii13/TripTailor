# Audit B — Accessibilità (WCAG 2.2 AA)

Progetto: `C:\Users\chris\Desktop\App Itinerari` — Next.js 16 / Tailwind v4 / Radix, interfaccia in italiano.
Metodo: analisi statica del sorgente + calcolo dei rapporti di contrasto (formula WCAG relative luminance). Nessun file modificato, nessun server avviato.

---

## Riepilogo contrasti calcolati

Coppie di testo effettivamente usate (soglia AA: 4.5:1 testo normale, 3:1 testo grande ≥18.66px bold / ≥24px):

| Primo piano | Sfondo | Rapporto | Esito |
|---|---|---|---|
| Inchiostro `#3d423c` | Canvas `#ffffff` | **10.28:1** | ✅ |
| Inchiostro `#3d423c` | Nebbia `#ecefe9` | **8.85:1** | ✅ |
| Inchiostro `#3d423c` | wash `#e4f1dc` | **8.77:1** | ✅ |
| Inchiostro `#3d423c` | muted `#f4f6f2` | **9.45:1** | ✅ |
| muted-foreground `#666b64` | `#ffffff` | **5.45:1** | ✅ |
| muted-foreground `#666b64` | Nebbia `#ecefe9` | **4.70:1** | ✅ (margine minimo) |
| muted-foreground `#666b64` | wash `#e4f1dc` | **4.65:1** | ✅ (margine minimo) |
| muted-foreground `#666b64` | muted `#f4f6f2` | **5.01:1** | ✅ |
| Bosco `#1a4d33` | `#ffffff` | **9.75:1** | ✅ |
| Bosco `#1a4d33` | Nebbia `#ecefe9` | **8.40:1** | ✅ |
| Bosco `#1a4d33` | wash `#e4f1dc` | **8.32:1** | ✅ |
| Bosco `#1a4d33` (testo CTA) | Sole `#f0b429` (sfondo bottone) | **5.23:1** | ✅ |
| `#ffffff` | Bosco `#1a4d33` | **9.75:1** | ✅ |
| `primary-foreground/75` (≈`#c6d3cc`) | Bosco | **6.31:1** | ✅ |
| `primary-foreground/60` (≈`#a3b8ad`) | Bosco | **4.65:1** | ✅ (usato a 12px, margine minimo) |
| Sole `#f0b429` | Bosco `#1a4d33` | **5.23:1** | ✅ |
| destructive `#b3403a` | `#ffffff` | **5.66:1** | ✅ |
| destructive `#b3403a` | `destructive/10` (≈`#f7ecec`) | **4.89:1** | ✅ |
| **border/input `#d4dad1`** | `#ffffff` | **1.42:1** | ❌ (soglia 3:1 non-testo) |
| **border/input `#d4dad1`** | Nebbia `#ecefe9` | **1.23:1** | ❌ |
| **border/input `#d4dad1`** | wash `#e4f1dc` | **1.21:1** | ❌ |
| **`ring/50` (≈`#8da699`) — focus dei link** | `#ffffff` | **2.61:1** | ❌ (soglia 3:1) |
| **`ring/50`** | Nebbia `#ecefe9` | **2.50:1** | ❌ |
| slider track `#f4f6f2` | `#ffffff` | 1.09:1 | ⚠️ (solo sfondo, il thumb ha bordo Bosco 9.75:1) |
| `destructive/40` bordo (≈`#e1b3b0`) | `#ffffff` | 1.86:1 | ⚠️ (decorativo, il testo veicola l'errore) |
| Sole `#f0b429` | `#ffffff` / Nebbia / wash | 1.86 / 1.61 / 1.59:1 | ⚠️ solo come sfondo/decoro, mai come testo — corretto |

**Nessuna coppia di testo è sotto 4.5:1.** I fallimenti di contrasto sono tutti su **elementi non testuali** (bordi dei controlli e indicatore di focus), criterio 1.4.11.

---

## BLOCCANTE

### 1. Il nastro delle destinazioni si muove all'infinito senza alcun comando per fermarlo
- **WCAG:** 2.2.2 Pause, Stop, Hide (Livello A)
- **File:** `components/landing/reverse-search.tsx:36-53`, `app/globals.css:150-167`
- **Problema:** `.scopri-marquee-track` ha `animation: scopri-marquee 36s linear infinite`. È movimento automatico che dura ben oltre i 5 secondi, parte in automatico, ed è presentato in parallelo ad altro contenuto. Il criterio richiede **un meccanismo per l'utente** che lo metta in pausa, lo fermi o lo nasconda. Il commento in `globals.css:146-149` documenta che la pausa all'hover è stata **rimossa deliberatamente**; `prefers-reduced-motion` (righe 163-167) **non soddisfa 2.2.2**, perché è una preferenza di sistema, non un comando presente nel contenuto, e non aiuta chi ha difficoltà attentive senza quella impostazione attiva. `aria-hidden` non esenta: 2.2.2 riguarda la distrazione visiva, non l'esposizione allo screen reader.
- **Correzione:** aggiungere un bottone visibile "Metti in pausa"/"Riprendi" accanto al nastro che alterna una classe (`animation-play-state: paused`), con `aria-pressed`. In alternativa (soluzione minima che chiude il criterio) rendere il nastro statico e non animato. Ripristinare la sola pausa all'hover **non basta**: non è raggiungibile da tastiera né da touch.

### 2. `<header>`, `<nav>` e `<footer>` della landing sono annidati dentro `<main>`
- **WCAG:** 1.3.1 Info and Relationships (A), 2.4.1 Bypass Blocks (A)
- **File:** `app/page.tsx:12-21`
- **Problema:** `<main>` avvolge `SiteNav` (che contiene `<header>` e due `<nav>`) e `SiteFooter` (`<footer>`). I ruoli impliciti `banner` e `contentinfo` esistono **solo** quando `<header>`/`<footer>` non sono discendenti di `main`/`article`/`section`/`aside`: qui degradano a `generic`. Il risultato è una pagina senza landmark banner né contentinfo, con la navigazione principale conteggiata come contenuto della pagina. Chi naviga per landmark (rotore VoiceOver, `D` in NVDA) perde entrambi i punti di ancoraggio.
- **Correzione:** spostare `<SiteNav />` e `<SiteFooter />` **fuori** da `<main>`:
  ```tsx
  <>
    <SiteNav />
    <main className="flex min-h-screen flex-col">…sezioni…</main>
    <SiteFooter />
  </>
  ```

### 3. `aria-label` sostituisce il testo visibile sui bottoni "Date del viaggio" e "Chi viaggia"
- **WCAG:** 2.5.3 Label in Name (A); di riflesso 4.1.2 (A)
- **File:** `components/itinerary-form/itinerary-form.tsx:212-225` e `:276-287`; `components/discover-trips/discover-form.tsx:345-358` e `:431-442`
- **Problema:** il bottone mostra `"Seleziona le date"` / `"12/03/2026 - 18/03/2026"` / `"2 viaggiatori"`, ma `aria-label="Date del viaggio"` / `"Chi viaggia"` **cancella** quel testo dall'accessible name. 2.5.3 richiede che il nome accessibile **contenga** il testo visibile: qui non lo contiene affatto. Conseguenza pratica pesante: chi usa uno screen reader **non sente mai le date selezionate né il numero di viaggiatori** — sente sempre e solo "Date del viaggio, pulsante", anche dopo aver compilato. Il comando vocale ("clicca Seleziona le date") non funziona.
- **Correzione:** togliere `aria-label` e dare al campo un'etichetta programmatica reale che affianchi il valore visibile:
  ```tsx
  <span id="date-label" className="sr-only">Date del viaggio</span>
  <Button aria-labelledby="date-label date-value" …>
    <CalendarIcon … />
    <span id="date-value">{…testo visibile…}</span>
  </Button>
  ```
  Così il nome diventa "Date del viaggio 12/03/2026 - 18/03/2026" e include il testo visibile. Idem per "Chi viaggia" + `travelerSummary`.

### 4. Gli errori di validazione non sono associati programmaticamente ai campi né annunciati
- **WCAG:** 3.3.1 Error Identification (A), 1.3.1 (A), 4.1.3 Status Messages (AA)
- **File:** `components/itinerary-form/itinerary-form.tsx:260-262, 326, 401-405`; `components/discover-trips/discover-form.tsx:379, 421-423, 481, 565-569`; `components/itinerary-form/destination-autocomplete.tsx:161`; `components/itinerary-form/participant-row.tsx:114`
- **Problema:** ogni messaggio d'errore è un `<p className="text-sm text-destructive">` **senza `id`**, i controlli non hanno `aria-describedby` né `aria-invalid`, e non c'è `role="alert"`/`aria-live`. Al submit fallito: (a) nulla viene annunciato, (b) tornando sul campo l'errore non viene letto, (c) il focus non viene spostato sul primo campo invalido. Un utente non vedente può restare bloccato sul form senza sapere perché non procede. Stesso difetto per l'errore di rete `apiError` (`itinerary-form.tsx:401`, `discover-form.tsx:565`) e per l'errore PDF (`itinerary-result.tsx:363-367`).
- **Correzione:** per ogni campo:
  ```tsx
  <Input id="destination" aria-invalid={!!error} aria-describedby={error ? "destination-error" : undefined} … />
  {error && <p id="destination-error" className="text-sm text-destructive">{error}</p>}
  ```
  e mettere i banner di errore API in `<p role="alert">`. In `onSubmit`/`handleSubmit(onSubmit, onInvalid)` spostare il focus sul primo campo invalido (react-hook-form: `shouldFocusError: true`, già default, ma non funziona sui Popover/Select che non espongono un ref focusabile — vanno gestiti a mano).

---

## IMPORTANTE

### 5. Nessun annuncio del caricamento e del risultato (form → risultati)
- **WCAG:** 4.1.3 Status Messages (AA); di riflesso 2.4.3 Focus Order (A)
- **File:** `components/itinerary-form/itinerary-form.tsx:119-136, 173-183, 408-417`; `components/discover-trips/discover-form.tsx:237-254, 286-299, 572-581`
- **Problema:** tre difetti sommati:
  1. Nessun `aria-live` in tutto il progetto (verificato con grep: zero occorrenze di `aria-live`, `role="status"`, `aria-busy`). L'attesa di ~45 secondi verso Gemini è completamente silenziosa.
  2. Il bottone di submit diventa `disabled` durante il caricamento (`:408`): l'elemento che aveva il focus lo perde e il focus **cade su `<body>`**, perdendo la posizione nella pagina.
  3. A generazione conclusa il componente viene sostituito interamente (`ItineraryResult` / `DiscoverResults`) senza spostare il focus e senza annuncio: lo screen reader continua a leggere il vuoto.
  In più, i `LOADING_MESSAGES` ruotano ogni 4,5 s: se si aggiungesse ingenuamente `aria-live` al bottone, ne uscirebbe uno spam continuo.
- **Correzione:** aggiungere una regione di stato fuori dal bottone, con un testo **stabile** (non i messaggi rotanti):
  ```tsx
  <p role="status" className="sr-only">
    {mode === "loading" ? "Sto generando l'itinerario, attendi." : ""}
  </p>
  ```
  Mantenere il bottone abilitato con `aria-disabled` + guardia già presente (`if (mode === "loading") return`, riga 139) invece di `disabled`, così il focus non evapora. Al passaggio a `result`/`results` dare `tabIndex={-1}` al titolo e chiamarne `.focus()`.

### 6. Contrasto dei bordi dei controlli sotto 3:1
- **WCAG:** 1.4.11 Non-text Contrast (AA)
- **File:** `app/globals.css:71-72` (`--border`/`--input: #d4dad1`); usato in `components/ui/input.tsx:11`, `components/ui/select.tsx:40`, `components/ui/button.tsx:16` (variante `outline`), `components/ui/card.tsx:10`, `components/ui/popover.tsx:33`
- **Problema:** `#d4dad1` su Canvas dà **1.42:1**, su Nebbia **1.23:1**, su wash **1.21:1**. È il bordo che definisce il perimetro di input, select, bottoni `outline` e popover: sono componenti dell'interfaccia il cui confine è **l'unico** indicatore visivo della loro esistenza (nessuno sfondo di riempimento — gli input sono `bg-transparent`). Serve ≥3:1. Su Nebbia è particolarmente grave, perché `/crea` e `/scopri` hanno il fondo Nebbia e la card bianca: il bordo della card scompare del tutto.
- **Correzione:** portare `--input` a un valore ≥3:1 sul più chiaro degli sfondi usati (Canvas). Es. `#8a9487` dà ~3.1:1 su bianco; `#767f74` dà ~4.0:1 con margine. Si può tenere `--border` chiaro per i divisori puramente decorativi (`divide-border`, filetti) e introdurre `--input` più scuro solo per i controlli — la distinzione è già presente come token, oggi hanno solo lo stesso valore.

### 7. Il focus dei link non ha un indicatore visibile sufficiente
- **WCAG:** 1.4.11 Non-text Contrast (AA); 2.4.7 Focus Visible (AA) a rischio
- **File:** `app/globals.css:126-128` (`* { @apply … outline-ring/50 }`); link interessati: `components/landing/site-nav.tsx:64, 90-102, 128-141`, `components/landing/hero.tsx:72-77`, `components/landing/site-footer.tsx:41-47, 78-96`, `components/discover-trips/proposal-card.tsx:132-139`, `components/itinerary-form/itinerary-result.tsx:303-318` (bottoni attività), `components/itinerary-form/destination-autocomplete.tsx:136-153` (opzioni)
- **Problema:** la regola globale colora l'outline UA con `ring/50`, cioè Bosco al 50% ≈ `#8da699`, che su bianco dà **2.61:1** e su Nebbia **2.50:1** — sotto la soglia 3:1 per l'indicatore di focus. I `Button`/`Input` shadcn se la cavano perché hanno anche `focus-visible:border-ring` (bordo pieno Bosco, 9.75:1), ma i **link nudi** (`<a>`, `<Link>` senza classi di focus) e i bottoni delle attività dell'itinerario si affidano solo a quell'outline sbiadito. `popular-destinations.tsx:80` è l'unico posto dove è stato scritto un `focus-visible:ring` esplicito — segno che il resto è stato dimenticato, non deciso.
- **Correzione:** dare all'outline globale colore pieno e spessore: `* { @apply border-border outline-ring }` più `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`. Nelle sezioni a fondo Bosco (`site-identity.tsx`, `final-cta.tsx`) serve un focus chiaro: `focus-visible:outline-voltage` o `outline-primary-foreground`.

### 8. `/crea` e `/scopri` non hanno un `<h1>`
- **WCAG:** 1.3.1 (A), 2.4.6 Headings and Labels (AA)
- **File:** `app/crea/page.tsx:36-38` + `components/itinerary-form/itinerary-form.tsx:189-191`; `app/scopri/page.tsx:27-29` + `components/discover-trips/discover-form.tsx:305-307`; `components/itinerary-form/itinerary-result.tsx:188-190`; `components/discover-trips/discover-results.tsx:43-45`
- **Problema:** `CardTitle` di shadcn è un `<div>` (`components/ui/card.tsx:31-39`), non un heading. "Pianifica il tuo viaggio", "Trova il tuo viaggio", "Si parte per {destinazione}" sono quindi testo generico. Su `/scopri` la lista risultati parte direttamente da un `<h2>` (`discover-results.tsx:43`) e le proposte usano `<h3>` (`proposal-card.tsx:53`): gerarchia che inizia a livello 2 senza un livello 1. Chi naviga per intestazioni non ha alcun punto d'ingresso su queste due pagine, che sono il cuore dell'app.
- **Correzione:** `<CardTitle asChild><h1>…</h1></CardTitle>` — oppure passare `render`/un wrapper: la soluzione minima è sostituire `CardTitle` con un `<h1>` che porti le stesse classi. Stesso trattamento per `discover-results.tsx:43` (deve diventare `<h1>` o va aggiunto un `<h1>` a pagina).

### 9. I popover di Radix non hanno nome accessibile
- **WCAG:** 4.1.2 Name, Role, Value (A)
- **File:** `components/itinerary-form/itinerary-form.tsx:227-231, 289`; `components/discover-trips/discover-form.tsx:360-364, 444`; `components/landing/site-nav.tsx:119-123`
- **Problema:** `PopoverPrimitive.Content` espone `role="dialog"`. Nessuna delle cinque istanze passa `aria-label` o `aria-labelledby`: lo screen reader annuncia "finestra di dialogo" senza dire quale. Nel caso del pannello viaggiatori (fino a 20 righe) è disorientante.
- **Correzione:** `<PopoverContent aria-label="Date del viaggio">`, `aria-label="Composizione del gruppo"`, `aria-label="Sezioni della pagina"`.

### 10. Il pattern combobox dell'autocompletamento è strutturalmente rotto
- **WCAG:** 1.3.1 (A), 4.1.2 (A), 4.1.3 (AA)
- **File:** `components/itinerary-form/destination-autocomplete.tsx:95-157`
- **Problema:** quattro difetti nello stesso componente:
  1. Righe 133-155: le opzioni sono `<button role="option">` **dentro** `<li>`. Fra `role="listbox"` e `role="option"` si interpone un `listitem` implicito: la relazione owns è spezzata e molti screen reader non contano/non annunciano le opzioni. In più un `role="option"` non deve essere un `<button>`.
  2. Riga 101: `aria-controls={`${id}-suggestions`}` punta a un id **inesistente** quando la lista è chiusa (riferimento IDREF pendente).
  3. Nessun annuncio di quante proposte sono arrivate: dopo il debounce di 500 ms la lista compare in silenzio.
  4. Nessun `aria-busy` durante la fetch.
- **Correzione:** rendere le opzioni `<li role="option" id={…} aria-selected={…} onMouseDown={…}>` senza `<button>` interno (la navigazione avviene con le frecce + `aria-activedescendant`, già implementate correttamente alle righe 115-130); rendere `aria-controls` condizionale a `isOpen`; aggiungere `<p role="status" className="sr-only">{suggestions.length} risultati disponibili</p>`.

### 11. Nessun link "Salta al contenuto"
- **WCAG:** 2.4.1 Bypass Blocks (A)
- **File:** `app/layout.tsx:34-37`, `app/page.tsx`, `app/crea/page.tsx`, `app/scopri/page.tsx`
- **Problema:** la landing ripete in cima logo + 4 voci di menu + CTA prima del contenuto; `/crea` e `/scopri` ripetono la barra sticky. Non esiste alcun meccanismo di salto e — per il punto 2 — nemmeno un landmark `main` valido sulla landing su cui saltare. Un utente da tastiera deve attraversare l'intestazione a ogni cambio pagina.
- **Correzione:** in `layout.tsx`, come primo figlio del `<body>`:
  ```tsx
  <a href="#contenuto" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
    Salta al contenuto
  </a>
  ```
  e `id="contenuto"` sul `<main>` di ogni pagina (una volta risolto il punto 2).

### 12. I campi restano raggiungibili da tastiera mentre il form è "disattivato"
- **WCAG:** 1.3.1 (A), 2.4.3 Focus Order (A)
- **File:** `components/itinerary-form/itinerary-form.tsx:195`; `components/discover-trips/discover-form.tsx:311`
- **Problema:** durante il caricamento il blocco dei campi riceve `pointer-events-none opacity-60`. Il mouse è bloccato, la tastiera **no**: tutti i controlli restano nel tab order e modificabili, e nulla ne comunica lo stato inerte. Un utente da tastiera può cambiare la destinazione mentre la richiesta è già partita, ottenendo un risultato che non corrisponde a ciò che vede.
- **Correzione:** avvolgere i campi in `<fieldset disabled={mode === "loading"}>` (disabilita davvero l'intero sottoalbero, mouse e tastiera) oppure aggiungere `inert` al contenitore quando `mode === "loading"` (supportato nativamente e già in React 19).

### 13. Etichette non univoche nelle righe dei viaggiatori
- **WCAG:** 2.4.6 Headings and Labels (AA), 1.3.1 (A)
- **File:** `components/itinerary-form/participant-row.tsx:49, 77`
- **Problema:** con 4 viaggiatori l'utente sente "Tipo", "Età", "Tipo", "Età", "Tipo", "Età", "Tipo", "Età" senza sapere a quale persona appartengono. Anche il bottone di rimozione ripete otto volte lo stesso "Rimuovi viaggiatore" (riga 136). Il pannello inoltre non ha un `<fieldset>`/gruppo per riga.
- **Correzione:** includere l'indice: `<Label htmlFor={typeName}>Tipo <span className="sr-only">viaggiatore {index + 1}</span></Label>`, idem "Età", e `aria-label={`Rimuovi viaggiatore ${index + 1}`}`. Meglio ancora: `<fieldset><legend className="sr-only">Viaggiatore {index+1}</legend>…</fieldset>` per riga.

---

## MINORE

### 14. `<p>` annidati dentro `<button>` — HTML non valido
- **WCAG:** 1.3.1 (A) a rischio (4.1.1 ritirato in WCAG 2.2)
- **File:** `components/itinerary-form/itinerary-result.tsx:303-318`
- **Problema:** `<button>` accetta solo *phrasing content*; `<p>` è *flow content*. Il parser HTML può chiudere il bottone prima dei paragrafi, spezzando l'albero e con esso il nome accessibile del bottone.
- **Correzione:** sostituire i tre `<p>` con `<span className="block …">`, come già fatto correttamente in `itinerary-preview.tsx:90-97`.

### 15. `/crea` e `/scopri` ereditano il titolo della home
- **WCAG:** 2.4.2 Page Titled (A) — formalmente soddisfatto, sostanzialmente no
- **File:** `app/layout.tsx:23-26`; mancano `export const metadata` in `app/crea/page.tsx` e `app/scopri/page.tsx`
- **Problema:** tutte e tre le pagine si chiamano "TripTailor — Pianifica il tuo viaggio". Con più schede aperte sono indistinguibili, e lo screen reader annuncia lo stesso titolo a ogni navigazione.
- **Correzione:** `export const metadata = { title: "Crea il tuo itinerario — TripTailor", description: "…" }` in `crea/page.tsx` e l'equivalente in `scopri/page.tsx`. Nota: `crea/page.tsx` è già `async` con `searchParams`, quindi usare `generateMetadata` se si vuole includere la destinazione precompilata.

### 16. Testo "Close" in inglese dentro un'interfaccia italiana
- **WCAG:** 3.1.2 Language of Parts (AA)
- **File:** `components/ui/dialog.tsx:75`
- **Problema:** `<span className="sr-only">Close</span>` è l'unico nome accessibile del bottone di chiusura del dialog delle attività, letto da una voce sintetica italiana su una pagina `lang="it"`.
- **Correzione:** sostituire con `Chiudi`.

### 17. `aria-current="true"` invece di `"location"` sulle voci di sezione
- **WCAG:** 4.1.2 (A) — uso subottimale
- **File:** `components/landing/site-nav.tsx:92, 131`
- **Problema:** `aria-current="true"` è valido ma generico. Per una voce che indica la sezione della pagina attualmente in vista il valore appropriato è `"location"`.
- **Correzione:** `aria-current={isActive ? "location" : undefined}`.

### 18. Il logo della landing punta a `href="#"`
- **WCAG:** 2.4.4 Link Purpose (A) — marginale
- **File:** `components/landing/site-nav.tsx:64`
- **Problema:** `<a href="#">` non ha destinazione dichiarata e sporca la history; il nome accessibile è solo "TripTailor" senza indicare che riporta in cima. Su `/crea` e `/scopri` la stessa cosa è un `<Link href="/">`, quindi c'è anche un'incoerenza.
- **Correzione:** `<Link href="/">` con `<span className="sr-only"> — vai alla home</span>`, oppure `href="#contenuto"` una volta introdotto lo skip link.

### 19. Target tattili dei link del footer ridotti a ~20px sopra i 640px
- **WCAG:** 2.5.8 Target Size (Minimum) (AA) — al limite, non fallisce
- **File:** `components/landing/site-footer.tsx:43, 82, 92`
- **Problema:** `py-3 sm:py-0` toglie l'imbottitura da 640px in su, lasciando link alti ~20px. Con `gap-1.5` (6px) la distanza fra i centri è 26px > 24px, quindi l'eccezione di spaziatura del criterio è **rispettata per un soffio**. Ma la breakpoint `sm` include tablet in modalità touch, dove 20px è scomodo.
- **Correzione:** sostituire `sm:py-0` con `sm:py-1.5`, oppure meglio ancorare all'input: `@media (pointer: coarse)` mantiene i 44px indipendentemente dalla larghezza.

### 20. Lo spinner di caricamento non rispetta `prefers-reduced-motion`
- **WCAG:** 2.2.2 (A) — coperto dall'eccezione, ma incoerente col resto
- **File:** `components/itinerary-form/itinerary-form.tsx:411`, `itinerary-result.tsx:334`, `discover-form.tsx:575`
- **Problema:** `animate-spin` gira all'infinito senza guardia, mentre tutto il resto del progetto usa `motion-safe:` o `useReducedMotion()`. Gli spinner rientrano nell'eccezione "attività essenziale", quindi non è un fallimento formale, ma è l'unica animazione non presidiata.
- **Correzione:** `motion-safe:animate-spin` (con reduce-motion resta l'icona statica accanto al testo che già cambia).

### 21. `role="group"` con `<p>` come etichetta invece di `fieldset`/`legend`
- **WCAG:** 1.3.1 (A) — soddisfatto, ma fragile
- **File:** `components/itinerary-form/itinerary-form.tsx:196-199, 331-334`
- **Problema:** `role="group" aria-labelledby` funziona, ma su `discover-form.tsx` la stessa struttura **non esiste affatto**: i campi di `/scopri` non sono raggruppati né etichettati per blocco. Incoerenza fra i due form.
- **Correzione:** usare `<fieldset><legend>` in entrambi (semantica nativa, e apre la strada al `disabled` del punto 12, che risolverebbe due rilievi con la stessa modifica).

### 22. I gruppi di chip a due stati non hanno un'etichetta di gruppo
- **WCAG:** 1.3.1 (A)
- **File:** `components/discover-trips/discover-form.tsx:322-339` (Date esatte/flessibili) e `:527-552` (tipi di vacanza)
- **Problema:** i bottoni con `aria-pressed` sono corretti singolarmente, ma il contenitore non è un `role="group"` con nome: "Date esatte, pulsante, non premuto" arriva senza contesto. Per i chip del tipo di vacanza c'è anche la sovrapposizione con l'`<input id="vacation-type">` che condivide lo stesso stato senza che la relazione sia dichiarata.
- **Correzione:** `<div role="group" aria-label="Modalità delle date">` e `<div role="group" aria-labelledby="vacation-type-label">`, spostando l'`id` dell'etichetta sul `<Label>` esistente (riga 522).

---

## Verificato e conforme

Per completezza, questi punti sono stati controllati e **non** presentano rilievi:

- `lang="it"` presente su `<html>` (`app/layout.tsx:31`).
- `prefers-reduced-motion`: rispettato in modo esemplare — `useReducedMotion()` in tutti i 9 componenti framer-motion, `motion-safe:` sulle transizioni CSS, `scroll-behavior: smooth` guardato (`globals.css:134-138`), marquee fermato (`:163-167`). Unica eccezione: punto 20.
- Dialog Radix (`itinerary-result.tsx:370-435`): focus trap, chiusura con `Esc`, ritorno del focus al trigger e `DialogTitle` presente sono gestiti nativamente dalla primitiva; `DialogDescription` in `sr-only` evita il warning di Radix. Corretto.
- `aria-expanded` sui trigger di Popover e Select: fornito da Radix, non serve aggiungerlo a mano.
- Navigazione con frecce + `aria-activedescendant` + `Escape` nell'autocompletamento (`destination-autocomplete.tsx:115-130`): logica corretta (il problema è solo la struttura DOM, punto 10).
- SVG delle bandiere (`reverse-search-destinations.tsx`): il contenitore ha `aria-hidden` (`reverse-search.tsx:36`) e non contiene elementi focusabili — nascondere un fregio decorativo è la scelta giusta. Le informazioni (città/prezzo) sono illustrative e non uniche.
- Barrette di accento Sole e indicatori decorativi: sempre `aria-hidden` (`site-nav.tsx:74`, `reverse-search.tsx:23`, `site-footer.tsx:30`, `itinerary-form.tsx:188`, `itinerary-result.tsx:116, 273`). Coerente.
- Barra di avanzamento dello scroll (`scroll-progress.tsx:16`): `aria-hidden`, corretto — è puramente decorativa e non un `progressbar` da annunciare.
- `Slider`: `aria-label` esplicito su entrambe le istanze (`itinerary-form.tsx:342`, `discover-form.tsx:491`), Radix fornisce `aria-valuenow/min/max` e il controllo da tastiera con le frecce.
- Il giallo Sole non è mai usato come colore di testo: `.emphasis-mark-display` (`globals.css:172-179`) è un `background-image` dietro la parola, esattamente come documentato in CLAUDE.md. Scelta corretta e verificata (1.86:1 come testo sarebbe stato un fallimento netto).
- Gerarchia dei titoli della landing: h1 (hero) → h2 (mete, come funziona, dal budget, CTA finale) → h3 (passi, colonne del footer). Nessun salto di livello. `site-identity.tsx:20` usa un `<p>` per il testo grande: legittimo, ma lascia la sezione `#perche` — bersaglio di una voce di menu — priva di intestazione (aggiungere un h2 `sr-only` sarebbe un miglioramento).
- Testo sotto i 14px: `text-xs` (12px) è usato ampiamente per etichette e note. WCAG non impone una dimensione minima e tutte le coppie relative superano 4.5:1 (la peggiore è `primary-foreground/60` su Bosco a 4.65:1). Nessun rilievo formale.
