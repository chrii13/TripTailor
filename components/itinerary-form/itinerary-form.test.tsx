// Europe/Rome è UTC+2 a maggio, cioè esattamente lo scenario che in produzione
// faceva slittare le date di un giorno (la mezzanotte locale serializzata come
// "...T22:00:00Z" e riletta in UTC dal server Vercel). Con TZ=UTC il difetto non
// si riprodurrebbe e il test non proteggerebbe nulla.
// Sta in cima per leggibilità, non perché "preceda gli import": in ESM gli
// import sono sollevati e vengono valutati prima di questa riga. Funziona lo
// stesso perché Node rilegge process.env.TZ a ogni operazione su Date, quindi
// conta solo che sia impostato prima che i test costruiscano le loro date.
process.env.TZ = "Europe/Rome";

import { render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { format } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ItineraryForm } from "@/components/itinerary-form/itinerary-form";
import { decodeCreaPrefill } from "@/lib/crea-query-params";

// "Oggi" fissato a martedì 12 maggio 2026: a metà mese, così i giorni scelti
// (20 e 24) sono nello stesso riquadro del calendario e non serve navigare.
// Solo Date è finto: setTimeout resta reale, altrimenti user-event si blocca.
const TODAY = new Date(2026, 4, 12);

/** Nome accessibile del giorno nel calendario (vedi labelDayButton in components/ui/calendar.tsx). */
function dayLabel(date: Date): string {
  return format(date, "PPPP", { locale: itLocale });
}

/** Y-M-D locale calcolato a mano: non passa da toCalendarDate, che è ciò che stiamo verificando. */
function localYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

let fetchMock: ReturnType<typeof vi.fn>;

/** Trattiene la richiesta: il componente resta in "loading" e non passa al risultato. */
function pendingFetch() {
  return vi.fn(() => new Promise<Response>(() => {}));
}

/**
 * Risponde solo a /api/generate-itinerary; l'autocompletamento della destinazione
 * resta in sospeso come con pendingFetch.
 */
function respondingFetch(status: number, payload: unknown) {
  return vi.fn((url: unknown) => {
    if (String(url) !== "/api/generate-itinerary") return new Promise<Response>(() => {});
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(payload),
    } as Response);
  });
}

const ACTIVITY = {
  title: "Colosseo",
  description: "Visita guidata dell'anfiteatro.",
  estimatedCost: "18€",
  suggestedTime: "09:00 - 11:00",
  details: { about: "", gettingThere: "", tips: "" },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  fetchMock = pendingFetch();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Compila il form dall'interfaccia, come farebbe una persona, fino a renderlo valido. */
async function fillValidForm(user: UserEvent, { from, to }: { from: Date; to: Date }) {
  await user.type(screen.getByLabelText("Destinazione"), "Roma, Italia");
  // Toglie il focus: l'autocompletamento annulla la fetch dei suggerimenti in sospeso.
  await user.tab();

  await user.click(screen.getByRole("button", { name: /Date del viaggio/ }));
  await user.click(await screen.findByRole("button", { name: dayLabel(from) }));
  await user.click(await screen.findByRole("button", { name: dayLabel(to) }));
  await user.keyboard("{Escape}");

  await user.click(screen.getByRole("button", { name: /Chi viaggia/ }));
  await user.click(await screen.findByRole("combobox", { name: "Età" }));
  await user.click(await screen.findByRole("option", { name: "30" }));
  await user.click(screen.getByRole("button", { name: "Fatto" }));
}

function requestBody(call: unknown[]): { dateRange: { from: string; to: string } } {
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe("ItineraryForm — invio", () => {
  it("manda le date come date di calendario, non come istanti", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const from = new Date(2026, 4, 20);
    const to = new Date(2026, 4, 24);

    render(<ItineraryForm />);
    await fillValidForm(user, { from, to });
    await user.click(screen.getByRole("button", { name: "Genera itinerario" }));

    const call = fetchMock.mock.calls.find(([url]) => String(url) === "/api/generate-itinerary");
    expect(call).toBeDefined();

    const body = requestBody(call!);
    // Il giorno scelto arriva intatto: niente "T", niente "Z", niente slittamento.
    expect(body.dateRange.from).toBe(localYmd(from));
    expect(body.dateRange.to).toBe(localYmd(to));
    expect(body.dateRange.from).toBe("2026-05-20");
    expect(JSON.stringify(body.dateRange)).not.toMatch(/[TZ]/);
  });

  it("con due click parte una sola richiesta", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ItineraryForm />);
    await fillValidForm(user, { from: new Date(2026, 4, 20), to: new Date(2026, 4, 24) });

    // Il bottone usa aria-disabled e non disabled: il secondo click arriva davvero
    // al gestore, e a fermarlo è solo la guardia in onSubmit.
    // Si ricicla lo stesso nodo invece di ritrovarlo per testo: durante il
    // caricamento l'etichetta diventa uno dei LOADING_MESSAGES, scelto a caso, e
    // agganciarsi a quelle frasi renderebbe il test intermittente a ogni
    // riformulazione. Il <button> è lo stesso elemento prima e dopo il re-render.
    const submit = screen.getByRole("button", { name: "Genera itinerario" });
    await user.click(submit);
    await user.click(submit);

    const calls = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/generate-itinerary");
    expect(calls).toHaveLength(1);
  });

  it("con una risposta valida mostra l'itinerario al posto del form", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    fetchMock = respondingFetch(200, {
      itinerary: {
        days: [
          { date: "2026-05-20", mattina: [ACTIVITY], pomeriggio: [], sera: [] },
          { date: "2026-05-21", mattina: [], pomeriggio: [], sera: [] },
        ],
      },
      weather: null,
      countryInfo: null,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryForm />);
    await fillValidForm(user, { from: new Date(2026, 4, 20), to: new Date(2026, 4, 24) });
    await user.click(screen.getByRole("button", { name: "Genera itinerario" }));

    expect(
      await screen.findByRole("heading", { name: /Si parte per Roma, Italia/ })
    ).toBeInTheDocument();
    expect(screen.getByText("Colosseo")).toBeInTheDocument();
    // Il form è stato sostituito, non affiancato.
    expect(screen.queryByLabelText("Destinazione")).toBeNull();
  });

  it("con un errore noto mostra il messaggio italiano e riporta al form", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    fetchMock = respondingFetch(429, { error: "rate_limit" });
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryForm />);
    await fillValidForm(user, { from: new Date(2026, 4, 20), to: new Date(2026, 4, 24) });
    await user.click(screen.getByRole("button", { name: "Genera itinerario" }));

    // Il codice dell'API è tradotto: l'utente non vede mai "rate_limit".
    expect(
      await screen.findByText("Troppe richieste in questo momento, riprova tra qualche secondo.")
    ).toBeInTheDocument();
    // Si torna al form, con il bottone di nuovo utilizzabile.
    expect(screen.getByRole("button", { name: "Genera itinerario" })).not.toHaveAttribute(
      "aria-disabled"
    );
  });
});

describe("ItineraryForm — errori di validazione", () => {
  it("collega ogni messaggio al campo che lo ha prodotto", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ItineraryForm />);
    await user.click(screen.getByRole("button", { name: "Genera itinerario" }));

    expect(fetchMock).not.toHaveBeenCalled();
    // Si aspetta che la validazione abbia prodotto i messaggi, senza citarne il
    // testo: a verificarne il contenuto è già il ciclo qui sotto.
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);

    const controls = [
      screen.getByLabelText("Destinazione"),
      screen.getByRole("button", { name: /Date del viaggio/ }),
      screen.getByRole("button", { name: /Chi viaggia/ }),
    ];

    for (const control of controls) {
      expect(control).toHaveAttribute("aria-invalid", "true");
      const describedBy = control.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      // L'id deve puntare a un elemento che esiste davvero e che dice qualcosa:
      // un aria-describedby appeso al vuoto non è annunciato da nessuno.
      const message = document.getElementById(describedBy!);
      expect(message).not.toBeNull();
      expect(message!.textContent?.trim()).not.toBe("");
    }
  });

  it("l'errore sui viaggiatori compare sul campo, non solo dentro il pannello", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ItineraryForm />);
    await user.click(screen.getByRole("button", { name: "Genera itinerario" }));

    const travelers = await screen.findByRole("button", { name: /Chi viaggia/ });
    const messageId = travelers.getAttribute("aria-describedby");
    expect(document.getElementById(messageId!)).toHaveTextContent(
      "Completa i dati di ogni viaggiatore"
    );
  });
});

describe("ItineraryForm — prefill dalla query string", () => {
  it("con valori malformati la pagina non esplode e il form parte vuoto", () => {
    const prefill = decodeCreaPrefill({
      destination: "   ",
      from: "non-una-data",
      to: "2026-13-45",
      budget: "-abc",
      p: "alieno:900",
    });

    render(<ItineraryForm prefill={prefill} />);

    expect(screen.getByLabelText("Destinazione")).toHaveValue("");
    expect(screen.getByRole("button", { name: /Date del viaggio/ })).toHaveTextContent(
      "Seleziona le date"
    );
    expect(screen.getByRole("button", { name: /Chi viaggia/ })).toHaveTextContent("1 viaggiatore");
    expect(screen.getByLabelText("Budget indicativo")).toHaveValue(1000);
  });

  it("con valori validi precompila i campi", () => {
    const prefill = decodeCreaPrefill({
      destination: "Lisbona, Portogallo",
      from: "2026-05-20",
      to: "2026-05-24",
      budget: "1500",
      p: "adulto:30,bambino:8",
    });

    render(<ItineraryForm prefill={prefill} />);

    expect(screen.getByLabelText("Destinazione")).toHaveValue("Lisbona, Portogallo");
    const dates = screen.getByRole("button", { name: /Date del viaggio/ });
    expect(within(dates).getByText("20/05/2026 - 24/05/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chi viaggia/ })).toHaveTextContent("2 viaggiatori");
    expect(screen.getByLabelText("Budget indicativo")).toHaveValue(1500);
  });
});
