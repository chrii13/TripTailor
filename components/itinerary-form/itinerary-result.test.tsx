// Stesso fuso degli altri test dei componenti: le date del viaggio sono date di
// calendario e con TZ=UTC lo slittamento di un giorno non si riprodurrebbe.
process.env.TZ = "Europe/Rome";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ItineraryResult } from "@/components/itinerary-form/itinerary-result";
import type { ItineraryResponse } from "@/lib/itinerary-schema";
import type { TripFormValues } from "@/lib/schema";

const TRIP: TripFormValues = {
  destination: "Roma, Italia",
  dateRange: { from: new Date(2026, 4, 20), to: new Date(2026, 4, 22) },
  participants: [{ type: "adulto", age: 30 }],
  budget: 1200,
  styleNotes: "Ritmo lento",
  mustSee: "",
  arrivalTime: "",
  departureTime: "",
};

function activity(title: string) {
  return {
    title,
    description: "Una visita.",
    estimatedCost: "18€",
    suggestedTime: "15:00 - 17:00",
    details: { about: "", gettingThere: "", tips: "" },
  };
}

// Due giornate con una tappa d'ancoraggio (il pomeriggio) e una terza vuota, che
// pickDinnerAnchor scarta: serve a verificare che non venga né chiesta né annunciata.
const ITINERARY: ItineraryResponse = {
  days: [
    { date: "2026-05-20", mattina: [], pomeriggio: [activity("Colosseo")], sera: [] },
    { date: "2026-05-21", mattina: [], pomeriggio: [activity("Pantheon")], sera: [] },
    { date: "2026-05-22", mattina: [], pomeriggio: [], sera: [] },
  ],
};

const SUGGESTION = {
  date: "2026-05-21",
  name: "Osteria del Pantheon",
  comment: "Cucina romana a due passi dalla piazza.",
  distanceMeters: 180,
  street: "Via dei Pastini",
  openingHours: "19:00-23:00",
};

function renderResult() {
  return render(
    <ItineraryResult
      tripData={TRIP}
      itinerary={ITINERARY}
      weather={null}
      countryInfo={null}
      onEdit={() => {}}
    />
  );
}

/** La card della giornata, presa dal suo attributo data-day-date. */
function dayCard(date: string): HTMLElement {
  const card = document.querySelector(`[data-day-date="${date}"]`);
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

let fetchMock: ReturnType<typeof vi.fn>;

/** Trattiene la richiesta: il componente resta nello stato d'attesa. */
function pendingFetch() {
  return vi.fn(() => new Promise<Response>(() => {}));
}

function respondingFetch(payload: unknown) {
  return vi.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) } as Response)
  );
}

beforeEach(() => {
  fetchMock = pendingFetch();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ItineraryResult — consiglio sulla cena", () => {
  it("mostra il consiglio nella giornata a cui appartiene", async () => {
    fetchMock = respondingFetch({ suggestions: [SUGGESTION] });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();

    // Il nome è quello restituito dalla route, non uno inventato dal componente.
    expect(await screen.findByText(SUGGESTION.name)).toBeInTheDocument();
    const giornata = within(dayCard("2026-05-21"));
    expect(giornata.getByText(SUGGESTION.name)).toBeInTheDocument();
    expect(giornata.getByText(SUGGESTION.comment)).toBeInTheDocument();

    // La giornata senza consiglio non se lo prende.
    expect(within(dayCard("2026-05-20")).queryByText(SUGGESTION.name)).toBeNull();
  });

  it("manda solo le giornate con una tappa d'ancoraggio, senza coordinate", async () => {
    fetchMock = respondingFetch({ suggestions: [] });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const call = fetchMock.mock.calls.find(([url]) => String(url) === "/api/dinner-suggestions");
    expect(call).toBeDefined();

    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.destination).toBe("Roma, Italia");
    expect(body.budget).toBe(1200);
    expect(body.participants).toEqual([{ type: "adulto", age: 30 }]);
    // La route si geocodifica la destinazione da sé: il client non ha coordinate da dare.
    expect(body).not.toHaveProperty("coordinates");
    expect(body.days).toEqual([
      { date: "2026-05-20", anchorTitle: "Colosseo" },
      { date: "2026-05-21", anchorTitle: "Pantheon" },
    ]);
  });

  it("con la richiesta fallita non mostra errori e lascia l'itinerario intatto", async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error("rete assente")));
    vi.stubGlobal("fetch", fetchMock);

    renderResult();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Cerchiamo dove cenare/)).toBeNull());

    // Nessuno stato d'errore: né un alert, né la riga della giornata senza consiglio.
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(screen.queryByText(/Dove cenare/)).toBeNull();
    expect(screen.queryByText(/Nessun locale/)).toBeNull();
    // L'itinerario è quello di prima.
    expect(screen.getByText("Colosseo")).toBeInTheDocument();
    expect(screen.getByText("Pantheon")).toBeInTheDocument();
  });

  it("con una risposta senza consiglio per la giornata mostra una riga discreta, non un errore", async () => {
    fetchMock = respondingFetch({ suggestions: [SUGGESTION] });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();

    const giornata = within(dayCard("2026-05-20"));
    expect(await giornata.findByText(/Nessun locale/)).toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    // La giornata senza tappe non chiede e non annuncia niente.
    expect(within(dayCard("2026-05-22")).queryByText(/Nessun locale/)).toBeNull();
  });

  it("con un `suggestions` che non è un array non esplode e non mostra niente", async () => {
    // Non è la forma che la route produce oggi, ma è l'unico ramo malformato scoperto:
    // accettarlo farebbe esplodere il .find() in fase di resa, cioè manderebbe in error
    // boundary l'itinerario che questa richiesta non deve poter toccare.
    fetchMock = respondingFetch({ suggestions: {} });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();

    await waitFor(() => expect(screen.queryByText(/Cerchiamo dove cenare/)).toBeNull());
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(screen.queryByText(/Dove cenare/)).toBeNull();
    expect(screen.queryByText(/Nessun locale/)).toBeNull();
    expect(screen.getByText("Colosseo")).toBeInTheDocument();
    expect(screen.getByText("Pantheon")).toBeInTheDocument();
  });

  it("scarta gli elementi malformati e tiene quello buono che li accompagna", async () => {
    // Un elemento che non è un oggetto farebbe lanciare `entry.date` dentro il .find(),
    // che gira in fase di resa: error boundary, cioè lo stesso esito che tutta questa
    // diffidenza esiste per evitare. Il consiglio valido accanto deve arrivare lo stesso.
    fetchMock = respondingFetch({ suggestions: [null, "non un oggetto", SUGGESTION] });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();

    expect(await screen.findByText(SUGGESTION.name)).toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    // La giornata senza un consiglio utilizzabile resta alla riga discreta.
    expect(within(dayCard("2026-05-20")).getByText(/Nessun locale/)).toBeInTheDocument();
    expect(screen.getByText("Colosseo")).toBeInTheDocument();
  });

  it("chiede il consiglio una volta sola, anche dopo altri render", async () => {
    // Una dipendenza instabile dell'effetto costerebbe una chiamata a Gemini per ogni
    // ridisegno del componente: qui il ridisegno si provoca apposta, due volte.
    fetchMock = respondingFetch({ suggestions: [SUGGESTION] });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    const { rerender } = renderResult();
    await screen.findByText(SUGGESTION.name);

    // Render da stato interno: aprire il dettaglio di un'attività.
    await user.click(screen.getByRole("button", { name: /Colosseo/ }));
    // Render dal genitore, con le stesse identiche prop.
    rerender(
      <ItineraryResult
        tripData={TRIP}
        itinerary={ITINERARY}
        weather={null}
        countryInfo={null}
        onEdit={() => {}}
      />
    );

    const calls = fetchMock.mock.calls.filter(
      ([url]) => String(url) === "/api/dinner-suggestions"
    );
    expect(calls).toHaveLength(1);
  });

  it("riserva lo spazio del consiglio fin dallo stato d'attesa", async () => {
    // Prima con la richiesta ancora in volo.
    const { unmount } = renderResult();
    const attesa = dayCard("2026-05-21").querySelector("[data-dinner-slot]");
    expect(attesa).not.toBeNull();
    expect(screen.getAllByText(/Cerchiamo dove cenare/).length).toBeGreaterThan(0);
    const classiInAttesa = attesa!.className;
    unmount();

    // Poi con il consiglio arrivato: stesso contenitore, stesse classi, quindi il
    // blocco non può spostare ciò che sta sotto quando compare.
    vi.stubGlobal("fetch", respondingFetch({ suggestions: [SUGGESTION] }));
    renderResult();
    await screen.findByText(SUGGESTION.name);
    const arrivato = dayCard("2026-05-21").querySelector("[data-dinner-slot]");
    expect(arrivato).not.toBeNull();
    expect(arrivato!.className).toBe(classiInAttesa);
  });

  it("non presenta il consiglio come una tappa con un orario", async () => {
    fetchMock = respondingFetch({ suggestions: [SUGGESTION] });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();
    await screen.findByText(SUGGESTION.name);

    const slot = dayCard("2026-05-21").querySelector("[data-dinner-slot]") as HTMLElement;
    // Distanza, via e orari di apertura sì; un orario di appuntamento no.
    expect(slot.textContent).toContain("180 m");
    expect(slot.textContent).toContain(SUGGESTION.street);
    expect(slot.textContent).toContain(SUGGESTION.openingHours);
    // Non è cliccabile come le attività: non apre nessun dettaglio.
    expect(within(slot).queryByRole("button")).toBeNull();
  });
});
