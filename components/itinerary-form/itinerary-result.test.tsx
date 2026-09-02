// Stesso fuso degli altri test dei componenti: le date del viaggio sono date di
// calendario e con TZ=UTC lo slittamento di un giorno non si riprodurrebbe.
process.env.TZ = "Europe/Rome";

import type { ComponentProps } from "react";
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
  lat: 41.8992,
  lon: 12.4768,
};

function renderResult(extra: Partial<ComponentProps<typeof ItineraryResult>> = {}) {
  return render(
    <ItineraryResult
      tripData={TRIP}
      itinerary={ITINERARY}
      weather={null}
      countryInfo={null}
      onEdit={() => {}}
      {...extra}
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
    expect(screen.queryByText(/Per questa sera non abbiamo un consiglio/)).toBeNull();
    // L'itinerario è quello di prima.
    expect(screen.getByText("Colosseo")).toBeInTheDocument();
    expect(screen.getByText("Pantheon")).toBeInTheDocument();
  });

  it("con una risposta senza consiglio per la giornata non afferma che lì attorno non ci sono locali", async () => {
    // La route risponde `200 { suggestions: [] }` in quattro casi diversi (nessun candidato,
    // modello fallito, destinazione non geocodificata, giornata oltre il tetto di fase) e il
    // client non li distingue: la riga può quindi parlare solo di noi, mai del mondo.
    fetchMock = respondingFetch({ suggestions: [SUGGESTION] });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();

    const giornata = within(dayCard("2026-05-20"));
    expect(
      await giornata.findByText("Per questa sera non abbiamo un consiglio.")
    ).toBeInTheDocument();
    // Nessuna affermazione sull'assenza di locali attorno alla tappa.
    expect(screen.queryByText(/Nessun locale|non ci sono locali/)).toBeNull();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    // La giornata senza tappe non chiede e non annuncia niente.
    expect(within(dayCard("2026-05-22")).queryByText(/Per questa sera non abbiamo un consiglio/)).toBeNull();
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
    expect(screen.queryByText(/Per questa sera non abbiamo un consiglio/)).toBeNull();
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
    expect(within(dayCard("2026-05-20")).getByText(/Per questa sera non abbiamo un consiglio/)).toBeInTheDocument();
    expect(screen.getByText("Colosseo")).toBeInTheDocument();
  });

  it("scarta il consiglio con un commento che non è testo", async () => {
    // `comment` è reso come figlio JSX diretto: un oggetto lì dentro fa lanciare React
    // ("Objects are not valid as a React child") in fase di resa, cioè di nuovo l'error
    // boundary. date e name validi non bastano a salvarlo.
    fetchMock = respondingFetch({
      suggestions: [
        { date: "2026-05-20", name: "Locale con commento rotto", comment: {} },
        SUGGESTION,
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();

    // Il consiglio buono accanto arriva comunque: si scarta l'elemento, non la risposta.
    expect(await screen.findByText(SUGGESTION.name)).toBeInTheDocument();
    expect(screen.queryByText("Locale con commento rotto")).toBeNull();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(within(dayCard("2026-05-20")).getByText(/Per questa sera non abbiamo un consiglio/)).toBeInTheDocument();
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

  it("mette la distanza in una pastiglia che si capisce anche letta da sola", async () => {
    // La distanza è uscita dalla riga dei metadati per stare accanto al nome: da sola,
    // "180 m" non dice di che misura si tratti, quindi la pastiglia porta il complemento
    // per lo screen reader. Via e orari restano nella riga, senza la distanza.
    fetchMock = respondingFetch({ suggestions: [SUGGESTION] });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();
    await screen.findByText(SUGGESTION.name);

    const slot = dayCard("2026-05-21").querySelector("[data-dinner-slot]") as HTMLElement;

    const distanza = slot.querySelector("[data-dinner-distance]");
    expect(distanza).not.toBeNull();
    // Letta ad alta voce la pastiglia è una frase, non una cifra sospesa. E dice
    // "in linea d'aria", perché distanceMeters è una distanza haversine: promettere
    // un percorso pedonale a chi non vede la mappa sarebbe un'affermazione che non
    // abbiamo modo di sostenere.
    expect(distanza!.textContent).toBe("180 m in linea d'aria");

    const meta = slot.querySelector("[data-dinner-meta]");
    expect(meta).not.toBeNull();
    expect(meta!.textContent).toContain(SUGGESTION.street);
    expect(meta!.textContent).toContain(SUGGESTION.openingHours);
    // La distanza non è ripetuta: sta nella pastiglia e basta.
    expect(meta!.textContent).not.toContain("180 m");
  });

  it("fa del nome del locale un collegamento alla mappa, centrato sulle sue coordinate", async () => {
    fetchMock = respondingFetch({ suggestions: [SUGGESTION] });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();
    await screen.findByText(SUGGESTION.name);

    const slot = dayCard("2026-05-21").querySelector("[data-dinner-slot]") as HTMLElement;
    // Il nome accessibile dice dove porta e che apre una scheda nuova: chi usa uno
    // screen reader non deve sentire solo il nome del ristorante.
    const link = within(slot).getByRole("link", {
      name: "Osteria del Pantheon su Google Maps (si apre in una nuova scheda)",
    });
    // Le coordinate vengono da OSM: senza, un omonimo in un'altra città vincerebbe.
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/Osteria%20del%20Pantheon/@41.8992,12.4768,18z"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // Il testo visibile resta il nome del locale, non l'etichetta accessibile.
    expect(link).toHaveTextContent("Osteria del Pantheon");
  });

  it("senza coordinate mostra il nome senza collegamento, invece di un link rotto", async () => {
    // Un consiglio senza lat/lon non è la forma che la route produce, ma un link
    // "@undefined,undefined" porterebbe l'utente da nessuna parte: meglio niente link.
    fetchMock = respondingFetch({
      suggestions: [{ ...SUGGESTION, lat: undefined, lon: undefined }],
    });
    vi.stubGlobal("fetch", fetchMock);

    renderResult();
    await screen.findByText(SUGGESTION.name);

    const slot = dayCard("2026-05-21").querySelector("[data-dinner-slot]") as HTMLElement;
    expect(within(slot).queryByRole("link")).toBeNull();
    expect(slot.textContent).toContain(SUGGESTION.name);
  });
});

describe("ItineraryResult — consigli ripresi dalla sessione", () => {
  it("con i consigli già in mano non tocca la rete", () => {
    renderResult({ initialDinner: [SUGGESTION] });

    // Rifarli costerebbe otto secondi, un'interrogazione a Overpass e una chiamata
    // a Gemini, e una giornata storta di Overpass li farebbe sparire.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(dayCard("2026-05-21")).getByText(SUGGESTION.name)).toBeInTheDocument();
  });

  it("con un elenco vuoto salvato li richiede lo stesso: un guasto non è una risposta", async () => {
    // La route risponde `200 { suggestions: [] }` anche quando Overpass va in timeout
    // o il modello fallisce. Trattarlo come "già ottenuti" congelerebbe un guasto
    // passeggero per tutta la sessione, mentre prima della persistenza un F5 riprovava.
    renderResult({ initialDinner: [] });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url) === "/api/dinner-suggestions")
    ).toHaveLength(1);
  });

  it("un elenco vuoto in arrivo non viene passato al genitore da salvare", async () => {
    fetchMock = respondingFetch({ suggestions: [] });
    vi.stubGlobal("fetch", fetchMock);
    const onDinnerLoaded = vi.fn();

    renderResult({ onDinnerLoaded });

    // L'attesa è finita: la riga della giornata senza consiglio è già a schermo.
    await within(dayCard("2026-05-20")).findByText("Per questa sera non abbiamo un consiglio.");
    // L'altro lato della stessa regola: quel che non è una risposta non si salva.
    expect(onDinnerLoaded).not.toHaveBeenCalled();
  });

  it("i consigli arrivati risalgono al genitore, che è chi li salva", async () => {
    fetchMock = respondingFetch({ suggestions: [SUGGESTION] });
    vi.stubGlobal("fetch", fetchMock);
    const onDinnerLoaded = vi.fn();

    renderResult({ onDinnerLoaded });

    await screen.findByText(SUGGESTION.name);
    expect(onDinnerLoaded).toHaveBeenCalledTimes(1);
    expect(onDinnerLoaded.mock.calls[0][0]).toEqual([SUGGESTION]);
  });
});
