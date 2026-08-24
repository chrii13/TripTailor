// Stesso motivo di components/itinerary-form/itinerary-form.test.tsx: il fuso
// non deve essere UTC, o lo slittamento di un giorno non si riprodurrebbe. Node
// rilegge process.env.TZ a ogni operazione su Date, quindi basta impostarlo
// prima che i test costruiscano le loro date (gli import, sollevati, girano
// comunque prima di questa riga).
process.env.TZ = "Europe/Rome";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiscoverForm } from "@/components/discover-trips/discover-form";

const TODAY = new Date(2026, 4, 12);
const STORAGE_KEY = "discover-trips-session";

const PROPOSAL = {
  destination: "Lisbona",
  country: "Portogallo",
  whyItFits: "Clima mite e prezzi contenuti.",
  highlights: ["Alfama", "Belém"],
  costs: {
    travelPerPerson: 150,
    travelTotal: 300,
    lodgingTotal: 400,
    onSiteTotal: 300,
    total: 1000,
  },
};

/** Scrive in sessionStorage esattamente come fa saveResultsToSession. */
function seedSession(submitted: unknown, proposals: unknown[] = [PROPOSAL]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ submitted, proposals }));
}

const EXACT_SEARCH = {
  departureCity: "Milano, Italia",
  dateMode: "esatte" as const,
  dateRange: { from: new Date(2026, 4, 20), to: new Date(2026, 4, 24) },
  flexiblePeriod: {},
  participants: [{ type: "adulto", age: 30 }],
  budget: 1500,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {}))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("DiscoverForm — ripristino da sessionStorage", () => {
  it("ripropone i risultati salvati e, tornando al form, la ricerca che li ha prodotti", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seedSession(EXACT_SEARCH);

    render(<DiscoverForm />);

    expect(await screen.findByRole("heading", { name: "Dove puoi andare" })).toBeInTheDocument();
    expect(screen.getByText(/Da Milano, Italia/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Modifica la ricerca" }));

    // Il form sotto ai risultati deve essere quello della ricerca, non quello vuoto.
    expect(screen.getByLabelText("Città di partenza")).toHaveValue("Milano, Italia");
    expect(screen.getByRole("button", { name: /Date del viaggio/ })).toHaveTextContent(
      "20 mag - 24 mag"
    );
    expect(screen.getByRole("button", { name: /Chi viaggia/ })).toHaveTextContent("1 viaggiatore");
    expect(screen.getByLabelText("Budget totale")).toHaveValue(1500);
  });

  it("con un mese ormai passato il campo mostra il segnaposto invece di restare vuoto", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seedSession({
      ...EXACT_SEARCH,
      dateMode: "flessibili",
      dateRange: {},
      // Aprile 2026 è finito: non è più fra le voci del menu, e Radix con un
      // valore senza voce corrispondente non rende nemmeno il segnaposto.
      flexiblePeriod: { month: "2026-04", nights: 7 },
    });

    render(<DiscoverForm />);

    expect(await screen.findByText(/Le date di questa ricerca sono ormai passate/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Modifica la ricerca" }));

    const month = screen.getByRole("combobox", { name: /Mese del viaggio/ });
    expect(month).toHaveTextContent("Scegli il mese");
    // Le notti, che restano valide, non vengono azzerate insieme al mese.
    expect(screen.getByRole("combobox", { name: /Numero di notti/ })).toHaveTextContent("7 notti");
  });

  it("con un mese ancora valido il campo mostra il mese scelto", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seedSession({
      ...EXACT_SEARCH,
      dateMode: "flessibili",
      dateRange: {},
      flexiblePeriod: { month: "2026-07", nights: 5 },
    });

    render(<DiscoverForm />);
    await user.click(await screen.findByRole("button", { name: "Modifica la ricerca" }));

    expect(screen.getByRole("combobox", { name: /Mese del viaggio/ })).toHaveTextContent(
      "Luglio 2026"
    );
    expect(screen.queryByText(/Le date di questa ricerca sono ormai passate/)).toBeNull();
  });

  it("con dati corrotti riparte dal form vuoto invece di finire in errore", () => {
    sessionStorage.setItem(STORAGE_KEY, "{non-json");

    render(<DiscoverForm />);

    expect(screen.getByRole("heading", { name: "Trova il tuo viaggio" })).toBeInTheDocument();
    expect(screen.getByLabelText("Città di partenza")).toHaveValue("");
  });

  it("con un mese malformato riparte dal form vuoto invece di finire in errore", () => {
    // "2026-99" attraverserebbe indenne il confronto fra stringhe di
    // isFlexibleMonthPast per poi far lanciare la formattazione del riepilogo.
    seedSession({
      ...EXACT_SEARCH,
      dateMode: "flessibili",
      dateRange: {},
      flexiblePeriod: { month: "2026-99", nights: 7 },
    });

    render(<DiscoverForm />);

    expect(screen.getByRole("heading", { name: "Trova il tuo viaggio" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dove puoi andare" })).toBeNull();
  });
});
