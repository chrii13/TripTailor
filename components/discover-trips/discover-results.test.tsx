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
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
