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

/** Una proposta il cui totale arrotondato è esattamente `total`. */
function makeProposalCosting(destination: string, total: number): TripProposal {
  return makeProposal(destination, {
    costs: {
      travelPerPerson: total / 2,
      travelTotal: total / 2,
      lodgingTotal: total / 4,
      onSiteTotal: total / 4,
      total,
    },
  } as Partial<TripProposal>);
}

/**
 * Le tre celle di ogni riga della striscia, in ordine di resa: nome, barra
 * (testo vuoto) e percentuale. Si leggono i figli diretti della griglia perché
 * è proprio la griglia unica — non sei flexbox — a garantire che le barre
 * partano dalla stessa ascissa.
 */
function righeDellaStriscia(): { destination: string; percent: string }[] {
  const striscia = screen.getByRole("region", { name: "Il budget a confronto" });
  const griglia = striscia.querySelector("h2")?.nextElementSibling;
  const celle = Array.from(griglia?.children ?? []).map((c) => c.textContent ?? "");
  const righe: { destination: string; percent: string }[] = [];
  for (let i = 0; i < celle.length; i += 3) {
    righe.push({ destination: celle[i], percent: celle[i + 2] });
  }
  return righe;
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
  it("mostra la liberatoria sulle stime una volta sola, non una per scheda", () => {
    renderResults([makeProposal("Lisbona"), makeProposal("Porto"), makeProposal("Faro")]);

    expect(screen.getAllByText(/Stime indicative generate dall'AI/)).toHaveLength(1);
  });

  it("non mostra la liberatoria quando non c'è nessuna proposta", () => {
    renderResults([]);

    expect(screen.queryByText(/Stime indicative generate dall'AI/)).toBeNull();
  });

  it("scrive nella scheda la quota di budget usata e quanto resta", () => {
    // Costi arrotondati: 300 + 400 + 300 = 1000 su un budget di 1200 → 83%.
    renderResults([makeProposal("Lisbona")]);

    expect(screen.getByText("83% del budget")).toBeTruthy();
    expect(screen.getByText(/ti restano/)).toBeTruthy();
  });

  it("senza un budget su cui fare una proporzione non disegna la barra", () => {
    renderResults([makeProposal("Lisbona")], 0);

    expect(screen.queryByText(/% del budget/)).toBeNull();
  });

  it("con un budget non numerico non scrive NaN a schermo", () => {
    // Con budget 0 la divisione darebbe Infinity, mai NaN: cercare "NaN" lì è
    // un assert che non può fallire. Il NaN vero nasce solo da un budget NaN.
    // L'assert è sulla pastiglia e non su tutto il documento: la striscia di
    // riepilogo in cima formatta il budget per conto suo e scriverebbe "NaN €"
    // comunque, ma è codice che questo ramo non tocca.
    renderResults([makeProposal("Lisbona")], Number.NaN);

    expect(screen.queryByText(/NaN%/)).toBeNull();
    expect(screen.queryByText(/% del budget/)).toBeNull();
  });

  it("dice a chi ascolta che quella cifra in cima è il totale", () => {
    // A schermo lo dice la posizione accanto al nome; senza questa parola chi
    // usa uno screen reader sente "Lisbona, circa mille euro" e basta.
    renderResults([makeProposal("Lisbona")]);

    expect(screen.getByText(/^Totale\b/)).toBeTruthy();
  });

  it("il totale più quel che resta fa esattamente il budget mostrato", () => {
    // L'invariante che il lettore verifica a occhio, ora che il budget è
    // scritto accanto al totale. Con 1185 la vecchia riga arrotondava i 185
    // residui a 200, e la somma dava 1200: quindici euro comparsi dal nulla.
    const { container } = renderResults([makeProposal("Lisbona")], 1185);

    const spans = Array.from(container.querySelectorAll("span")).map((s) => s.textContent ?? "");
    const speso = spans.find((t) => / su /.test(t));
    const resta = spans.find((t) => t.startsWith("ti restano"));

    const [totale, budgetMostrato] = leggiEuro(speso ?? "");
    const [restante] = leggiEuro(resta ?? "");

    expect(budgetMostrato).toBe(1185);
    expect(totale + restante).toBe(budgetMostrato);
  });

  it("la striscia di confronto compare da tre proposte in su, non con due", () => {
    const { unmount } = renderResults([
      makeProposalCosting("Lisbona", 300),
      makeProposalCosting("Porto", 600),
    ]);
    expect(screen.queryByRole("region", { name: "Il budget a confronto" })).toBeNull();
    unmount();

    renderResults([
      makeProposalCosting("Lisbona", 300),
      makeProposalCosting("Porto", 600),
      makeProposalCosting("Faro", 1000),
    ]);
    expect(screen.getByRole("region", { name: "Il budget a confronto" })).toBeTruthy();
  });

  it("la striscia dice per ogni meta la stessa percentuale della sua scheda", () => {
    // 300, 600 e 1000 su 1200 → 25%, 50%, 83%. Tre cifre diverse: con tre
    // proposte identiche il confronto fra striscia e schede non proverebbe
    // niente, perché combacerebbe anche mescolando le righe.
    renderResults([
      makeProposalCosting("Lisbona", 300),
      makeProposalCosting("Porto", 600),
      makeProposalCosting("Faro", 1000),
    ]);

    // "83%" nella striscia, "83% del budget" nella pastiglia della scheda:
    // la regex non può prendere per sbaglio le righe della striscia.
    const nelleSchede = screen
      .getAllByText(/% del budget$/)
      .map((el) => (el.textContent ?? "").replace(" del budget", ""));

    expect(righeDellaStriscia().map((r) => r.percent)).toEqual(nelleSchede);
    expect(nelleSchede).toEqual(["25%", "50%", "83%"]);
  });

  it("la striscia elenca le mete nello stesso ordine della griglia", () => {
    renderResults([
      makeProposalCosting("Lisbona", 300),
      makeProposalCosting("Porto", 600),
      makeProposalCosting("Faro", 1000),
    ]);

    // Il titolo della striscia è anch'esso un h2: le mete sono gli altri.
    const nelleSchede = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent ?? "")
      .filter((t) => t !== "Il budget a confronto");

    expect(righeDellaStriscia().map((r) => r.destination)).toEqual(nelleSchede);
    expect(nelleSchede).toEqual(["Lisbona", "Porto", "Faro"]);
  });
});
