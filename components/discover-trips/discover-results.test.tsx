// Stesso motivo di discover-form.test.tsx: il fuso non deve essere UTC, o lo
// slittamento di un giorno delle date non si riprodurrebbe.
process.env.TZ = "Europe/Rome";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiscoverResults } from "@/components/discover-trips/discover-results";
import type { TripProposal } from "@/lib/discover-trips-schema";

const TODAY = new Date(2026, 4, 12);

function makeProposal(destination: string, overrides: Partial<TripProposal> = {}): TripProposal {
  return {
    destination,
    country: "Portogallo",
    whyItFits: "Clima mite e prezzi contenuti.",
    highlights: ["Alfama"],
    costs: {
      travelPerPerson: 150,
      travelTotal: 300,
      lodgingTotal: 400,
      onSiteTotal: 300,
      total: 1000,
    },
    ...overrides,
  } as TripProposal;
}

function renderResults(proposals: TripProposal[], budget = 1200) {
  return render(
    <DiscoverResults
      proposals={proposals}
      dateMode="esatte"
      dateRange={{ from: new Date(2026, 4, 20), to: new Date(2026, 4, 24) }}
      flexiblePeriod={{}}
      participants={[{ type: "adulto", age: 30 }]}
      budget={budget}
      departureCity="Milano, Italia"
      onEdit={() => {}}
    />
  );
}

/**
 * Le cifre in euro lette da una stringa resa ("~1.000 € su 1.185 €" → [1000,
 * 1185]). Si legge quel che è a schermo, non quel che il componente ha
 * calcolato: l'invariante da difendere è proprio fra le due cifre stampate.
 */
function leggiEuro(testo: string): number[] {
  return [...testo.matchAll(/[\d.]+(?=\s*€)/g)].map((m) => Number(m[0].replace(/\./g, "")));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DiscoverResults", () => {
  it("dice la liberatoria una volta sola, e fuori dalle schede", () => {
    // La regola si è ribaltata: prima erano tante copie quante le schede, ora
    // ne esiste **una**, sopra la griglia. Due assert, perché sono due difetti
    // diversi: il conteggio prende il ritorno della copia dentro le schede, e
    // `closest` prende il caso in cui la copia unica finisse dentro la prima
    // scheda invece che sopra la griglia — dove il conteggio resterebbe 1.
    const { container } = renderResults([
      makeProposal("Lisbona"),
      makeProposal("Porto"),
      makeProposal("Faro"),
    ]);

    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(3);

    const copie = screen.getAllByText((_, elemento) => {
      if (!elemento) return false;
      const testo = elemento.textContent ?? "";
      // Solo l'elemento che porta il testo, non i suoi antenati, che lo
      // contengono anche loro: `getAllByText` interroga tutto l'albero.
      const figliUguali = Array.from(elemento.children).some((figlio) =>
        (figlio.textContent ?? "").includes("non prezzi prenotabili"),
      );
      return testo.includes("non prezzi prenotabili") && !figliUguali;
    });

    expect(copie).toHaveLength(1);
    expect(copie[0].closest('[data-slot="card"]')).toBeNull();

    // Il riquadro promette «su ogni proposta trovi un link per verificarli», e
    // quel link è condizionato alla data di partenza. Oggi la promessa è vera,
    // ma per una garanzia sparsa su tre file: il filtro sulla finestra
    // suggerita in modalità flessibile, e la validazione del form in modalità
    // esatte. Se uno dei due diventasse clemente, il riquadro mentirebbe in
    // silenzio e nessuno se ne accorgerebbe. Qui la promessa si lega al fatto.
    expect(screen.getAllByText(/Verifica i prezzi reali/)).toHaveLength(3);
  });

  it("non mostra la liberatoria quando non c'è nessuna proposta", () => {
    // Il riquadro vive dentro il ramo delle proposte, non sopra di esso: senza
    // cifre a schermo non c'è niente da qualificare, e un'avvertenza accanto a
    // "nessuna proposta" parlerebbe di prezzi che non ci sono.
    renderResults([]);

    expect(screen.queryByText(/non prezzi prenotabili/)).toBeNull();
  });

  it("scrive nella scheda quanto costa sul budget e quanto resta, senza barra", () => {
    // Costi arrotondati: 300 + 400 + 300 = 1000 su un budget di 1200.
    renderResults([makeProposal("Lisbona")]);

    // Il punto delle migliaia è facoltativo e il € non si cerca affatto: in
    // it-IT il separatore compare solo da cinque cifre in su (1200 resta
    // "1200 €", 12000 diventa "12.000 €") e Intl attacca il simbolo con uno
    // spazio unificatore, che uno spazio normale nel pattern non incontra.
    expect(screen.getByText(/su 1\.?200/)).toBeTruthy();
    expect(screen.getByText(/ti restano/)).toBeTruthy();
    // La percentuale se n'è andata insieme al binario che riempiva: restava
    // solo come didascalia di una figura che non c'è più.
    expect(screen.queryByText(/% del budget/)).toBeNull();
  });

  it("senza un budget su cui fare una proporzione non scrive la riga del budget", () => {
    const { container } = renderResults([makeProposal("Lisbona")], 0);

    // Cercato dentro la scheda e non in tutto il documento: la liberatoria
    // sopra la griglia contiene "su ogni proposta trovi un link", cioè un " su "
    // che non ha niente a che vedere con la riga dei conti in prova.
    const scheda = container.querySelector('[data-slot="card"]')!;
    expect(/ su /.test(scheda.textContent ?? "")).toBe(false);
    // Nessun assert su "ti restano": quella riga e' gia' esclusa da
    // `remaining > 0` (con budget 0 o NaN il resto non e' positivo), quindi
    // cercarla qui non potrebbe fallire togliendo la guardia in prova. Un
    // assert che non puo' fallire e' peggio di un assert mancante: sembra
    // protezione e non lo e'.
  });

  it("con un budget non numerico non scrive NaN nella riga del budget", () => {
    // Con budget 0 la divisione darebbe Infinity, mai NaN: cercare "NaN" lì è
    // un assert che non può fallire. Il NaN vero nasce solo da un budget NaN.
    // L'assert è sulla riga del budget e non su tutto il documento: la striscia
    // di riepilogo in cima formatta il budget per conto suo e scriverebbe
    // "NaN €" comunque, ma è codice che questo ramo non tocca.
    renderResults([makeProposal("Lisbona")], Number.NaN);

    expect(screen.queryByText(/su NaN/)).toBeNull();
    // Nessun assert su "ti restano": quella riga e' gia' esclusa da
    // `remaining > 0` (con budget 0 o NaN il resto non e' positivo), quindi
    // cercarla qui non potrebbe fallire togliendo la guardia in prova. Un
    // assert che non puo' fallire e' peggio di un assert mancante: sembra
    // protezione e non lo e'.
  });

  it("qualifica la cifra come stima, e lo dice prima di mostrarla", () => {
    // Etichetta a sinistra e cifra a destra sulla stessa riga del piede, ma
    // l'ordine di lettura resta quello: chi salta al numero deve incontrare la
    // qualifica per prima, e chi ascolta la sente prima della cifra. L'ordine
    // e' la cosa da difendere, quindi e' l'ordine che va asserito: senza questo
    // test scambiare i due lati resterebbe verde.
    renderResults([makeProposal("Lisbona")]);

    const etichetta = screen.getByText(/^Stima AI$/);
    const totale = screen.getByText((testo) => testo.trim() === "Totale").closest("p")!;
    expect(etichetta).toBeTruthy();
    expect(totale).toBeTruthy();
    // compareDocumentPosition: FOLLOWING (4) vuol dire che il totale viene dopo.
    expect(etichetta.compareDocumentPosition(totale)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("dice a chi ascolta che quella cifra è il totale", () => {
    // A schermo lo dice la posizione, accanto a "Stima AI" e sopra la riga del
    // budget; senza questa parola chi usa uno screen reader sente "circa mille
    // euro" e basta.
    renderResults([makeProposal("Lisbona")]);

    expect(screen.getByText(/^Totale\b/)).toBeTruthy();
  });

  it("il totale più quel che resta fa esattamente il budget mostrato", () => {
    // L'invariante che il lettore verifica a occhio, ora che il budget è
    // scritto accanto al totale. Con 1185 la vecchia riga arrotondava i 185
    // residui a 200, e la somma dava 1200: quindici euro comparsi dal nulla.
    const { container } = renderResults([makeProposal("Lisbona")], 1185);

    // Gli <span> **della scheda**: la liberatoria sopra la griglia ne ha uno
    // che contiene "su ogni proposta" e verrebbe pescato per primo.
    const scheda = container.querySelector('[data-slot="card"]')!;
    const spans = Array.from(scheda.querySelectorAll("span")).map((s) => s.textContent ?? "");
    const speso = spans.find((t) => / su /.test(t));
    const resta = spans.find((t) => t.startsWith("ti restano"));

    const [totale, budgetMostrato] = leggiEuro(speso ?? "");
    const [restante] = leggiEuro(resta ?? "");

    expect(budgetMostrato).toBe(1185);
    expect(totale + restante).toBe(budgetMostrato);
  });
});
