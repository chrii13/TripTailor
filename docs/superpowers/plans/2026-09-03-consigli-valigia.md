# Consigli sulla valigia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In fondo all'itinerario compare una lista di cosa mettere in valigia, calcolata in codice dalle medie climatiche già scaricate — nessuna chiamata al modello.

**Architecture:** Una funzione pura in `lib/consigli-valigia.ts` traduce `DailyClimateAverage[]` in una lista di voci. Due consumatori la chiamano e la rendono: il blocco a schermo in `components/itinerary-form/itinerary-result.tsx` e la coda del documento in `lib/itinerary-pdf.tsx`. Nessuna route, nessuno stato, nessuna persistenza: la lista si ricalcola da dati che sono già in memoria.

**Tech Stack:** TypeScript, React 19 / Next.js 16 App Router, Tailwind CSS v4, `@react-pdf/renderer`, vitest (due `projects`: node per `lib/`, jsdom per `components/**/*.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-09-03-consigli-valigia-design.md`

## Global Constraints

- **Leggere `CLAUDE.md` prima di toccare qualsiasi cosa.** Contiene regole non derogabili del progetto.
- **Interfaccia in italiano.** Ogni stringa mostrata all'utente è in italiano.
- **Commenti in italiano che spiegano il *perché*, non il *cosa*.** È lo stile di tutto il progetto.
- **Nessun linguaggio da previsione.** Le cifre sono medie storiche degli ultimi 5 anni: la resa deve dirlo, e non deve mai suggerire che sia una previsione.
- **Sistema visivo (CLAUDE.md):** Nebbia `#ecefe9` per le superfici, Bosco `#1a4d33`, Inchiostro `#3d423c`, Sole `#f0b429`; `--border` `#d4dad1` è il filetto decorativo, `--input` `#7f8a7c` è **solo** il bordo dei controlli e non va usato su elementi non interattivi. Niente ombre, niente gradienti come superficie, `rounded-lg` (10px) per le card.
- **Nessuna dipendenza nuova.** Non modificare `package.json`, `tsconfig.json`, `vitest.config.ts` o `eslint.config.mjs`.
- **Modifiche chirurgiche.** Non rifattorizzare codice adiacente, non toccare codice morto preesistente.
- **Verifiche obbligatorie prima di dichiarare finito un task:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Baseline all'inizio del piano: **499 test su 48 file**, tsc pulito, lint 0 errori / 6 warning.
- **`npm test | tail` NASCONDE i fallimenti**, perché in una pipe il codice d'uscita è quello di `tail`. Leggere sempre la riga `Tests` per intero.
- **Ogni test va provato al contrario**, rompendo di proposito il codice che protegge, e va **controllato il conteggio dei rossi**: una patch che non si applica lascia il test verde e sembra che protegga. È già successo in questo progetto.
- **Non cancellare file che non hai creato tu**, nemmeno temporanei o non tracciati: alcuni appartengono ad altre sessioni.
- **Non toccare `.claude/settings.local.json`**, che risulta già modificato nel working tree e non c'entra con questo lavoro.

---

## File Structure

| File | Responsabilità |
|---|---|
| `lib/consigli-valigia.ts` (nuovo) | Da `DailyClimateAverage[]` alla lista di voci. Funzione pura, nessun import di React. Restituisce `null` quando non c'è niente da dire. |
| `lib/consigli-valigia.test.ts` (nuovo) | Test in node sui confini delle fasce e delle soglie. |
| `components/itinerary-form/itinerary-result.tsx` (modifica) | Il blocco a schermo, fra le giornate e la fascia dei bottoni. |
| `components/itinerary-form/itinerary-result.test.tsx` (modifica) | Test in jsdom: il blocco compare con i dati e non compare senza. |
| `lib/itinerary-pdf.tsx` (modifica) | La stessa lista in coda al documento, prima del footer. |
| `lib/itinerary-pdf.test.tsx` (modifica) | Test che la lista finisca nel PDF. |

Tre task, uno per consumatore più uno per il motore. Il primo è indipendente; il secondo e il terzo dipendono solo dalla firma del primo e possono essere rivisti separatamente.

---

## Task 1: il motore di calcolo

**Files:**
- Create: `lib/consigli-valigia.ts`
- Test: `lib/consigli-valigia.test.ts`

**Interfaces:**
- Consumes: `DailyClimateAverage` da `lib/climate-forecast.ts` — `{ date: string; tempMaxAvg: number; tempMinAvg: number; precipitationChance: number }`
- Produces:
  - `export interface ConsigliValigia { voci: string[]; massima: number; minima: number }`
  - `export function costruisciConsigliValigia(clima: DailyClimateAverage[] | null): ConsigliValigia | null`
  - `SOGLIA_PIOGGIA = 30` e `SOGLIA_ESCURSIONE = 10` restano **costanti di modulo, non esportate**: nessuno le importa, e i test scrivono i valori a mano di proposito. Un export che nessuno usa è impalcatura speculativa.

Le fasce, dalla spec (confini **inclusivi a sinistra**, e un viaggio può farne scattare **due** — una per la minima più bassa, una per la massima più alta):

| fascia | capi |
|---|---|
| sotto 5° | Un cappotto pesante, guanti, berretto e sciarpa |
| 5-12° | Una giacca calda, un maglione, scarpe chiuse |
| 13-19° | Maglie a maniche lunghe, una felpa o un cardigan per la sera |
| 20-26° | Abbigliamento leggero e comodo |
| 27° e oltre | Tessuti leggeri e traspiranti, un cappello, protezione solare |

Due parole stanno **in una fascia sola**, e non vanno rimesse nell'altra credendole
dimenticate: gli **strati** non sono nella 5-12 perché rispondono alla differenza fra
giorno e notte e non al freddo, e li dice già la regola dell'escursione; **«per la sera»**
non è nella 20-26 perché con minima 15° e massima 22° — il viaggio più comune che esista —
scattano due fasce adiacenti insieme, e la lista finiva per dire quasi la stessa frase due
volte. La deduplicazione non intercetta il caso, perché le due stringhe differiscono.

Regole indipendenti dalla fascia (soglie **strette**: 10° esatti e 30% esatto **non** fanno scattare):
- escursione massima **maggiore di** `SOGLIA_ESCURSIONE` → «in media ci sono circa N gradi fra il giorno e la notte: vestiti a strati» (la frase parte dal dato, non dall'ordine: sono medie storiche)
- almeno una giornata con `precipitationChance` **maggiore di** `SOGLIA_PIOGGIA` → «una giacca impermeabile leggera»
- **più della metà** delle giornate oltre `SOGLIA_PIOGGIA` → anche «scarpe che tengano l'acqua»

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `lib/consigli-valigia.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { DailyClimateAverage } from "./climate-forecast";
import { costruisciConsigliValigia } from "./consigli-valigia";

/**
 * Le giornate sono costruite a mano e non da una fixture condivisa: ogni caso
 * di prova qui esiste per un confine preciso, e una fixture comune finirebbe
 * per farli passare tutti per la stessa ragione.
 */
function giornata(
  tempMinAvg: number,
  tempMaxAvg: number,
  precipitationChance = 0
): DailyClimateAverage {
  return { date: "2026-05-20", tempMinAvg, tempMaxAvg, precipitationChance };
}

describe("costruisciConsigliValigia — assenza di dati", () => {
  it("senza clima non produce nulla", () => {
    expect(costruisciConsigliValigia(null)).toBeNull();
  });

  it("con un elenco vuoto non produce nulla", () => {
    expect(costruisciConsigliValigia([])).toBeNull();
  });
});

describe("costruisciConsigliValigia — fasce di temperatura", () => {
  it("una giornata sola basta: il viaggio minimo non è un caso limite da escludere", () => {
    const risultato = costruisciConsigliValigia([giornata(14, 18)]);
    expect(risultato).not.toBeNull();
    expect(risultato!.minima).toBe(14);
    expect(risultato!.massima).toBe(18);
    expect(risultato!.voci.join(" ")).toContain("Maglie a maniche lunghe");
  });

  it("12 e 13 gradi cadono in due fasce diverse", () => {
    const dodici = costruisciConsigliValigia([giornata(12, 12)]);
    const tredici = costruisciConsigliValigia([giornata(13, 13)]);
    expect(dodici!.voci.join(" ")).toContain("giacca calda");
    expect(tredici!.voci.join(" ")).not.toContain("giacca calda");
    expect(tredici!.voci.join(" ")).toContain("Maglie a maniche lunghe");
  });

  it("4 e 5 gradi cadono in due fasce diverse", () => {
    const quattro = costruisciConsigliValigia([giornata(4, 4)]);
    const cinque = costruisciConsigliValigia([giornata(5, 5)]);
    expect(quattro!.voci.join(" ")).toContain("cappotto pesante");
    expect(cinque!.voci.join(" ")).not.toContain("cappotto pesante");
  });

  it("26 e 27 gradi cadono in due fasce diverse", () => {
    const ventisei = costruisciConsigliValigia([giornata(26, 26)]);
    const ventisette = costruisciConsigliValigia([giornata(27, 27)]);
    expect(ventisei!.voci.join(" ")).not.toContain("protezione solare");
    expect(ventisette!.voci.join(" ")).toContain("protezione solare");
  });

  it("un viaggio che va dal freddo al caldo fa scattare entrambe le fasce", () => {
    // Minima 3° e massima 22°: è la montagna a primavera, non un'eccezione strana.
    // La lista deve coprire i due estremi, non una media che non descrive nessuna
    // giornata reale.
    const risultato = costruisciConsigliValigia([giornata(3, 8), giornata(15, 22)]);
    const testo = risultato!.voci.join(" ");
    expect(testo).toContain("cappotto pesante");
    expect(testo).toContain("Abbigliamento leggero");
  });
});

describe("costruisciConsigliValigia — escursione", () => {
  // Si cerca la voce per come **comincia**: un marcatore deve identificare la voce,
  // non capitare dentro un'altra. "In media" è l'unico incipit che non nomina un capo.
  it("dieci gradi esatti non fanno scattare gli strati", () => {
    const risultato = costruisciConsigliValigia([giornata(10, 20)]);
    expect(risultato!.voci.some((v) => v.startsWith("In media"))).toBe(false);
  });

  it("undici gradi sì, e la differenza è detta in cifre", () => {
    const risultato = costruisciConsigliValigia([giornata(10, 21)]);
    const strati = risultato!.voci.find((v) => v.startsWith("In media"));
    expect(strati).toBeDefined();
    expect(strati).toContain("11");
  });
});

describe("costruisciConsigliValigia — pioggia", () => {
  it("il trenta per cento esatto non basta", () => {
    const risultato = costruisciConsigliValigia([giornata(15, 20, 30)]);
    expect(risultato!.voci.join(" ")).not.toContain("impermeabile");
  });

  it("sopra il trenta per cento arriva la giacca impermeabile", () => {
    const risultato = costruisciConsigliValigia([giornata(15, 20, 31)]);
    expect(risultato!.voci.join(" ")).toContain("impermeabile");
  });

  it("con più della metà delle giornate piovose arrivano anche le scarpe", () => {
    const risultato = costruisciConsigliValigia([
      giornata(15, 20, 50),
      giornata(15, 20, 50),
      giornata(15, 20, 0),
    ]);
    expect(risultato!.voci.join(" ")).toContain("tengano l'acqua");
  });

  it("esattamente metà delle giornate non basta per le scarpe", () => {
    // Due su quattro è metà, non "più della metà": la soglia è stretta anche qui,
    // altrimenti su un numero pari di giornate scatterebbe con la metà esatta.
    const risultato = costruisciConsigliValigia([
      giornata(15, 20, 50),
      giornata(15, 20, 50),
      giornata(15, 20, 0),
      giornata(15, 20, 0),
    ]);
    const testo = risultato!.voci.join(" ");
    expect(testo).toContain("impermeabile");
    expect(testo).not.toContain("tengano l'acqua");
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx vitest run lib/consigli-valigia.test.ts`
Expected: FAIL — `Failed to resolve import "./consigli-valigia"`

- [ ] **Step 3: Scrivere l'implementazione**

Creare `lib/consigli-valigia.ts`:

```ts
import type { DailyClimateAverage } from "./climate-forecast";

/**
 * Oltre questa percentuale di anni con pioggia la giornata conta come piovosa.
 * La soglia è stretta (`>`, non `>=`): 30% esatto non fa scattare niente, perché
 * un anno su tre non è una ragione per portarsi la giacca.
 */
const SOGLIA_PIOGGIA = 30;

/**
 * Oltre questa differenza fra massima e minima nella stessa giornata si consiglia
 * di vestirsi a strati: la stessa giornata chiede due cose diverse. Anche qui la
 * soglia è stretta.
 */
const SOGLIA_ESCURSIONE = 10;

export interface ConsigliValigia {
  voci: string[];
  /** La massima più alta del periodo, per la riga di contesto della resa. */
  massima: number;
  /** La minima più bassa del periodo. */
  minima: number;
}

/**
 * Le fasce sono decise sulla massima più alta **e** sulla minima più bassa del
 * periodo, non su una media: una media fra 3° e 22° dà 12°, cioè una giornata che
 * in quel viaggio non esiste. Per questo un viaggio può far scattare due fasce, e
 * in quel caso valgono entrambe.
 *
 * I confini sono inclusivi a sinistra: 12° sta in "5-12", 13° in "13-19".
 */
const FASCE = [
  { minimo: -Infinity, capi: ["Un cappotto pesante, guanti, berretto e sciarpa"] },
  // Niente "strati" qui: li dice la regola dell'escursione, una volta sola.
  { minimo: 5, capi: ["Una giacca calda, un maglione, scarpe chiuse"] },
  { minimo: 13, capi: ["Maglie a maniche lunghe, una felpa o un cardigan per la sera"] },
  // Niente "per la sera" qui: con 15°/22° scattano due fasce adiacenti insieme.
  { minimo: 20, capi: ["Abbigliamento leggero e comodo"] },
  { minimo: 27, capi: ["Tessuti leggeri e traspiranti, un cappello, protezione solare"] },
] as const;

function fasciaDi(gradi: number): (typeof FASCE)[number] {
  // Si scorre dalla più calda: la prima soglia raggiunta è la fascia giusta.
  return [...FASCE].reverse().find((fascia) => gradi >= fascia.minimo) ?? FASCE[0];
}

/**
 * Dalla media climatica del periodo alla lista di cosa portare. Funzione pura:
 * niente rete, niente modello, niente da verificare oltre l'aritmetica — ed è la
 * ragione per cui questa funzionalità non ha uno schema di risposta né un cancello,
 * a differenza dei consigli sulla cena.
 *
 * Restituisce `null` quando non c'è niente da dire, così chi la usa non deve
 * decidere da sé se il blocco vada mostrato. Senza dati climatici il blocco non
 * compare affatto: nessun consiglio è meglio di un consiglio senza fondamento.
 *
 * Una media **parziale** va invece benissimo: `getClimateAverages` degrada di
 * proposito a meno anni quando il tempo stringe, e buttare via il consiglio per
 * quello sarebbe assurdo.
 */
export function costruisciConsigliValigia(
  clima: DailyClimateAverage[] | null
): ConsigliValigia | null {
  if (!clima || clima.length === 0) return null;

  const massima = Math.max(...clima.map((g) => g.tempMaxAvg));
  const minima = Math.min(...clima.map((g) => g.tempMinAvg));

  // Un Set perché in un viaggio mite le due fasce coincidono, e la stessa voce
  // ripetuta due volte sarebbe un difetto visibile.
  const voci = new Set<string>();
  for (const capi of [fasciaDi(minima).capi, fasciaDi(massima).capi]) {
    for (const capo of capi) voci.add(capo);
  }

  const escursione = Math.max(...clima.map((g) => g.tempMaxAvg - g.tempMinAvg));
  if (escursione > SOGLIA_ESCURSIONE) {
    // Si parte dal dato: sono medie storiche, e l'ordine al presente suonerebbe
    // come una promessa sul tempo che farà.
    voci.add(
      `In media ci sono circa ${Math.round(escursione)} gradi fra il giorno e la notte: vestiti a strati`
    );
  }

  const giornatePiovose = clima.filter((g) => g.precipitationChance > SOGLIA_PIOGGIA).length;
  if (giornatePiovose > 0) {
    voci.add("Una giacca impermeabile leggera");
  }
  if (giornatePiovose > clima.length / 2) {
    voci.add("Scarpe che tengano l'acqua");
  }

  return { voci: [...voci], massima, minima };
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run lib/consigli-valigia.test.ts`
Expected: PASS, 16 test (la revisione ne ha aggiunti tre ai 13 iniziali: due fasce
adiacenti, il confine 19/20, e la pioggia su una giornata sola).

Poi la suite intera e i controlli:
```bash
npm test
npx tsc --noEmit
npm run lint
```
Expected: **515 test su 49 file** (499 + 16), tsc pulito, lint 0 errori / 6 warning.

- [ ] **Step 5: Provare i test al contrario**

Per ciascuna di queste modifiche: applicarla, eseguire `npx vitest run lib/consigli-valigia.test.ts`, **contare i rossi**, ripristinare. Se una non produce rossi, il test corrispondente non protegge niente e va riscritto.

| modifica | test che deve diventare rosso |
|---|---|
| `escursione > SOGLIA_ESCURSIONE` → `>=` | «dieci gradi esatti non fanno scattare gli strati» |
| `precipitationChance > SOGLIA_PIOGGIA` → `>=` | «il trenta per cento esatto non basta» |
| `giornatePiovose > clima.length / 2` → `>=` | «esattamente metà delle giornate non basta per le scarpe» |
| togliere `fasciaDi(massima)` dal ciclo | «un viaggio che va dal freddo al caldo fa scattare entrambe le fasce» |
| `if (!clima \|\| clima.length === 0)` → `if (!clima)` | «con un elenco vuoto non produce nulla» |
| sostituire il `Set` di `voci` con un array | «una giornata sola basta» (l'assert sull'unicità) |
| rimettere «per la sera» nella fascia 20-26 | «due fasce adiacenti non ripetono lo stesso consiglio» |

- [ ] **Step 6: Commit**

```bash
git add lib/consigli-valigia.ts lib/consigli-valigia.test.ts
git commit -m "feat: le medie climatiche diventano una lista di cosa portare

Funzione pura, nessuna chiamata al modello: da una massima di 24 e una
minima di 14 a 'strati leggeri' non c'e' un salto di conoscenza, c'e'
una tabella. Le fasce sono decise sui due estremi del periodo e non su
una media, che fra 3 e 22 darebbe 12 gradi, cioe' una giornata che in
quel viaggio non esiste.

Le soglie sono strette di proposito: 10 gradi di escursione esatti e
30% di pioggia esatto non fanno scattare niente."
```

---

## Task 2: il blocco a schermo

**Files:**
- Modify: `components/itinerary-form/itinerary-result.tsx`
- Test: `components/itinerary-form/itinerary-result.test.tsx`

**Interfaces:**
- Consumes: `costruisciConsigliValigia`, `type ConsigliValigia` da `@/lib/consigli-valigia` (Task 1)
- Produces: niente per i task successivi. Il blocco porta `data-packing-list` per essere trovato nei test senza dipendere dal testo.

Il componente ha già la prop `weather: DailyClimateAverage[] | null` (riga ~42) e la usa per il meteo delle singole giornate. Nessuna prop nuova.

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungere a `components/itinerary-form/itinerary-result.test.tsx` un `describe` nuovo. **Leggere prima com'è costruito il file**: ha già gli helper per montare il componente, il fuso fissato in cima e l'orologio fermo, e va riusato quello che c'è invece di duplicarlo.

```tsx
describe("ItineraryResult — consigli sulla valigia", () => {
  it("con i dati climatici mostra la lista di cosa portare", () => {
    // 3° di minima e 22° di massima: due fasce, e un'escursione che supera la soglia.
    renderResult({
      weather: [
        { date: "2026-05-20", tempMinAvg: 3, tempMaxAvg: 8, precipitationChance: 0 },
        { date: "2026-05-21", tempMinAvg: 15, tempMaxAvg: 22, precipitationChance: 0 },
      ],
    });

    const blocco = document.querySelector("[data-packing-list]");
    expect(blocco).not.toBeNull();
    expect(blocco!.textContent).toContain("cappotto pesante");
    expect(blocco!.textContent).toContain("Abbigliamento leggero");
  });

  it("dichiara che sono medie storiche e non una previsione", () => {
    // La riga di contesto non è decorativa: senza di essa la lista si legge come
    // una promessa sul tempo che farà, che non abbiamo modo di sostenere.
    renderResult({
      weather: [{ date: "2026-05-20", tempMinAvg: 14, tempMaxAvg: 20, precipitationChance: 0 }],
    });

    const blocco = document.querySelector("[data-packing-list]");
    expect(blocco!.textContent).toMatch(/medi[ae]/i);
    expect(blocco!.textContent).toContain("cinque anni");
  });

  it("senza dati climatici il blocco non compare affatto", () => {
    renderResult({ weather: null });
    expect(document.querySelector("[data-packing-list]")).toBeNull();
  });
});
```

`renderResult` esiste già in quel file (riga ~56) con firma `renderResult(extra: Partial<ComponentProps<typeof ItineraryResult>> = {})`: accetta sovrascritture di qualunque prop, quindi `renderResult({ weather: [...] })` funziona così com'è. Non scrivere un secondo helper.

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx vitest run components/itinerary-form/itinerary-result.test.tsx`
Expected: FAIL, 3 rossi — `expected null not to be null` sui primi due.

- [ ] **Step 3: Scrivere l'implementazione**

In `components/itinerary-form/itinerary-result.tsx`, aggiungere l'import:

```tsx
import { costruisciConsigliValigia } from "@/lib/consigli-valigia";
```

Aggiungere il componente di resa accanto agli altri blocchi del file (prima di `export function ItineraryResult`):

```tsx
/**
 * La lista di cosa portare, in fondo all'itinerario. Non ha stato e non chiede
 * niente alla rete: si ricalcola dalle medie climatiche che il componente ha già
 * fra le prop, ed è la ragione per cui — a differenza dei consigli sulla cena —
 * qui non c'è persistenza, nessuno stato di attesa e nessun caso di guasto.
 */
function PackingList({ weather }: { weather: DailyClimateAverage[] | null }) {
  const consigli = costruisciConsigliValigia(weather);
  if (!consigli) return null;

  return (
    <section data-packing-list className="rounded-lg border border-border bg-secondary p-6">
      <h3 className="font-display text-lg uppercase tracking-[-0.015em] text-primary">
        Cosa mettere in valigia
      </h3>
      {/* La riga di contesto viene prima della lista, non dopo: chi legge deve
          sapere su cosa poggia il consiglio prima di leggerlo. E dice "medie degli
          ultimi cinque anni" e non "previsioni", perché è quello che il dato è. */}
      <p className="mt-1 text-sm text-muted-foreground">
        Dalle medie degli ultimi cinque anni per queste date: da{" "}
        <span className="tabular-nums">{consigli.minima}°</span> a{" "}
        <span className="tabular-nums">{consigli.massima}°</span>. Non è una previsione.
      </p>
      <ul className="mt-4 space-y-2">
        {consigli.voci.map((voce) => (
          <li key={voce} className="flex gap-2 text-sm">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{voce}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Renderlo **dopo le giornate e prima della fascia dei bottoni**. Nel file, la `</motion.div>` che chiude le giornate è seguita da `<div className="flex flex-wrap items-center gap-3">`: il blocco va esattamente fra i due.

```tsx
        </motion.div>

        <PackingList weather={weather} />

        <div className="flex flex-wrap items-center gap-3">
```

Nota sulle classi, già verificata: `bg-secondary` **è** il token Nebbia (`--secondary: #ecefe9` in `app/globals.css:62`), ed è quello che lo stesso file usa già altrove per le fasce Nebbia (righe 163, 592, 623). Non scrivere colori a mano. `border-border` e **mai** `border-input`: quest'ultimo in questo progetto è riservato ai controlli, e un riquadro bordato come un controllo sembra interattivo senza esserlo — è un rilievo già emerso e corretto una volta.

- [ ] **Step 4: Eseguire i test e verificare che passino**

```bash
npx vitest run components/itinerary-form/itinerary-result.test.tsx
npm test
npx tsc --noEmit
npm run lint
```
Expected: **518 test su 49 file** (515 + 3), tsc pulito, lint 0 errori / 6 warning.

- [ ] **Step 5: Provare i test al contrario**

| modifica | test che deve diventare rosso |
|---|---|
| `if (!consigli) return null;` → `if (false) return null;` | «senza dati climatici il blocco non compare affatto» (il componente lancerebbe o renderebbe vuoto) |
| togliere il `<p>` con la riga di contesto | «dichiara che sono medie storiche e non una previsione» |
| togliere `<PackingList weather={weather} />` dalla resa | i primi due |

- [ ] **Step 6: Commit**

```bash
git add components/itinerary-form/itinerary-result.tsx components/itinerary-form/itinerary-result.test.tsx
git commit -m "feat: la lista della valigia compare in fondo all'itinerario

Fra l'ultima giornata e i bottoni: l'ordine di lettura diventa cosa
farai, cosa portare, cosa fare adesso. Sotto i bottoni resterebbe
orfano, in cima ruberebbe la scena all'itinerario.

La riga di contesto sta prima della lista e dice che sono medie degli
ultimi cinque anni, non una previsione."
```

---

## Task 3: la lista nel PDF

**Files:**
- Modify: `lib/itinerary-pdf.tsx`
- Test: `lib/itinerary-pdf.test.tsx`

**Interfaces:**
- Consumes: `costruisciConsigliValigia` da `@/lib/consigli-valigia` (Task 1)
- Produces: niente.

`lib/itinerary-pdf.tsx` riceve già `weather` (vedi la firma di `buildItineraryPdfBlob`, chiamata da `itinerary-result.tsx:501`). Nessun parametro nuovo.

- [ ] **Step 1: Scrivere il test che fallisce**

`lib/itinerary-pdf.test.tsx` gira in **node**, non in jsdom, benché scriva JSX: è un test di funzione pura sull'albero di elementi. Il file ha già tutto il necessario — il componente esportato `ItineraryDocument`, i dati di prova `PDF_FIXTURE` (che contengono già un `weather`), e l'helper `findElements(node, match)` che percorre l'albero cercando nodi il cui `match(style, testoDiretto)` risponde di sì.

**Ispezionare l'albero, non il buffer.** Il file rende anche un PDF vero con `renderToBuffer` e ne tiene la stringa `raw`, ma cercare del testo lì dentro è inaffidabile: il testo di un PDF è compresso e codificato, quindi una `toContain` fallirebbe o passerebbe per caso.

```tsx
describe("ItineraryDocument — lista della valigia", () => {
  // Il PDF è ciò che si porta dietro chi sta facendo la valigia col telefono
  // appoggiato al letto: una lista che vive solo a schermo lì non serve.
  const FREDDO = [
    { date: "2026-05-20", tempMinAvg: 3, tempMaxAvg: 8, precipitationChance: 0 },
  ];

  function cercaTesto(weather: typeof FREDDO | null, atteso: string) {
    return findElements(
      <ItineraryDocument {...PDF_FIXTURE} weather={weather} />,
      (_stile, testoDiretto) => testoDiretto.includes(atteso)
    );
  }

  it("la lista finisce nel documento", () => {
    expect(cercaTesto(FREDDO, "Cosa mettere in valigia")).toHaveLength(1);
    expect(cercaTesto(FREDDO, "cappotto pesante")).toHaveLength(1);
  });

  it("senza dati climatici il documento non ha la lista", () => {
    expect(cercaTesto(null, "Cosa mettere in valigia")).toHaveLength(0);
  });
});
```

Il primo parametro di `match` è tipizzato `Stile` nel file: se TypeScript si lamenta della arrow, usare il nome del parametro senza annotazione come sopra e lasciare che l'inferenza faccia il suo lavoro.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run lib/itinerary-pdf.test.tsx`
Expected: FAIL — il testo non contiene «Cosa mettere in valigia».

- [ ] **Step 3: Scrivere l'implementazione**

Aggiungere gli stili al `StyleSheet.create` esistente, accanto agli altri (usare le costanti di colore già definite in cima al file: `BOSCO`, `NEBBIA`, `FILETTO`, `SLATE`):

```tsx
  packing: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: FILETTO,
    borderRadius: 6,
    backgroundColor: NEBBIA,
    padding: 14,
  },
  packingTitle: {
    fontFamily: "Fraunces",
    fontWeight: 700,
    fontSize: 12,
    color: BOSCO,
    textTransform: "uppercase",
  },
  packingNote: { fontSize: 9, color: SLATE, marginTop: 3, marginBottom: 7 },
  packingItem: { fontSize: 9.5, marginBottom: 3 },
```

Aggiungere il blocco **dopo il ciclo delle giornate e prima del `<View style={s.footer} fixed>`**:

```tsx
        {(() => {
          const consigli = costruisciConsigliValigia(weather);
          if (!consigli) return null;
          return (
            <View style={s.packing} wrap={false}>
              <Text style={s.packingTitle}>Cosa mettere in valigia</Text>
              <Text style={s.packingNote}>
                Dalle medie degli ultimi cinque anni per queste date: da {consigli.minima}° a{" "}
                {consigli.massima}°. Non è una previsione.
              </Text>
              {consigli.voci.map((voce) => (
                <Text key={voce} style={s.packingItem}>
                  • {voce}
                </Text>
              ))}
            </View>
          );
        })()}
```

`wrap={false}` perché una lista della valigia spezzata fra due pagine è più scomoda di una pagina con un po' di spazio bianco in fondo.

- [ ] **Step 4: Eseguire i test e verificare che passino**

```bash
npx vitest run lib/itinerary-pdf.test.tsx
npm test
npx tsc --noEmit
npm run lint
npm run build
```
Expected: **520 test su 49 file** (518 + 2), tsc pulito, lint 0 errori / 6 warning, build riuscita.

- [ ] **Step 5: Provare i test al contrario**

| modifica | test che deve diventare rosso |
|---|---|
| togliere il blocco dalla resa del documento | «la lista della valigia finisce nel documento» |
| `if (!consigli) return null;` → `if (false) ...` | «senza dati climatici il documento non ha la lista» |

- [ ] **Step 6: Verifica a schermo, obbligatoria**

I test non aprono un PDF. Generare il documento vero e guardarlo:

```bash
npm run build
npx next start -p 3000
```

Generare un itinerario, scaricare il PDF, e verificare: la lista c'è, non è spezzata fra due pagine, il riquadro Nebbia non sborda, e i gradi si leggono. Poi fermare il server.

Se il PDF non si apre o il blocco è rotto, **è un difetto da correggere**, non da segnalare e lasciare.

- [ ] **Step 7: Commit**

```bash
git add lib/itinerary-pdf.tsx lib/itinerary-pdf.test.tsx
git commit -m "feat: la lista della valigia anche nel PDF

E' il documento che ci si porta dietro: una lista che vive solo a
schermo serve poco a chi sta facendo la valigia col telefono appoggiato
al letto. wrap={false} perche' una lista spezzata fra due pagine e' piu'
scomoda di un po' di spazio bianco."
```

---

## Task 4: la documentazione del progetto

**Files:**
- Modify: `CLAUDE.md` (solo la Sezione 1)

- [ ] **Step 1: Aggiornare la Sezione 1**

Aggiungere alla struttura dei file `lib/consigli-valigia.ts` con una riga di descrizione, aggiornare il conteggio dei test (**520 su 49 file**), e aggiungere una voce che spieghi:

- che il consiglio è **calcolato**, non generato, e perché: da una massima di 24° a «strati leggeri» non c'è un salto di conoscenza, quindi una chiamata al modello aggiungerebbe latenza, quota e rischio in cambio di niente. È la scelta **opposta** ai consigli sulla cena, e il contrasto va scritto perché è la cosa che un lettore futuro troverà incoerente;
- che le fasce sono decise sui **due estremi** del periodo e non su una media, con l'esempio dei 3°/22° che darebbero 12°;
- che le due soglie sono **strette** (10° e 30% esatti non fanno scattare) e che i test stanno sui confini;
- che **non serve persistenza**, perché la lista deriva da dati già salvati in `sessionStorage`;
- il **limite dichiarato**: nessun capo legato alle attività, ed è la ragione per cui la versione con il modello resta una possibilità futura;
- che il calcolo non poteva stare nella chiamata dell'itinerario, con i numeri: 12s + 45s su 60 di `maxDuration`.

**Non toccare le Sezioni 2-6.**

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: la valigia si calcola, e il contrasto con la cena e' voluto"
```

---

## Verifica finale

- [ ] `npm test` → **520 test su 49 file**, tutti verdi (leggere la riga per intero, non con `| tail`)
- [ ] `npx tsc --noEmit` → nessun errore
- [ ] `npm run lint` → 0 errori, 6 warning (baseline)
- [ ] `npm run build` → riuscita
- [ ] Il PDF vero è stato aperto e guardato (Task 3, Step 6)
- [ ] Tutte le inversioni delle tabelle sono state eseguite, con il conteggio dei rossi controllato
