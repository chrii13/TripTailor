"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Banknote,
  CalendarDays,
  FileDown,
  Loader2,
  Clock,
  Droplets,
  Languages,
  Thermometer,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { formatCalendarDate } from "@/lib/calendar-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PARTICIPANT_TYPE_LABELS, type TripFormValues } from "@/lib/schema";
import type { Activity, ItineraryResponse } from "@/lib/itinerary-schema";
import type { DailyClimateAverage } from "@/lib/climate-forecast";
import type { CountryInfo } from "@/lib/country-info";
import { buildItineraryIcs } from "@/lib/itinerary-to-ics";
import { pickDinnerAnchor } from "@/lib/dinner-anchor";
import { buildDinnerMapUrl } from "@/lib/dinner-map-link";
// Solo il tipo, cancellato in compilazione: la forma del consiglio è quella che la
// route restituisce davvero, non una copia che può divergerne.
import type { DinnerSuggestion } from "@/app/api/dinner-suggestions/route";

interface ItineraryResultProps {
  tripData: TripFormValues;
  itinerary: ItineraryResponse;
  weather: DailyClimateAverage[] | null;
  countryInfo: CountryInfo | null;
  onEdit: () => void;
}

const SLOTS = [
  { key: "mattina", label: "Mattina" },
  { key: "pomeriggio", label: "Pomeriggio" },
  { key: "sera", label: "Sera" },
] as const;

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDateRange(from: Date, to: Date): string {
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return sameMonth
    ? `${format(from, "dd")}–${format(to, "dd/MM/yyyy")}`
    : `${format(from, "dd/MM")}–${format(to, "dd/MM/yyyy")}`;
}

const dayList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const dayCard: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

/**
 * Un tratto di testo che contiene almeno una cifra, insieme ai caratteri che fanno
 * parte del numero e gli stanno attaccati. La classe è chiusa apposta: tutto ciò che
 * non è cifra, separatore numerico o simbolo di valuta resta al testo.
 */
const NUMERALS_RUN = /([\d.,:%€$£~–—\s-]*\d[\d.,:%€$£~–—\s-]*)/;

/**
 * Cifre nel carattere di testo dentro un titolo Fraunces (vedi
 * `.display-numerals` in globals.css). Orario e costo dell'attività arrivano dal
 * modello come testo libero — "09:00 - 11:00", ma anche "Gratuito" — quindi non
 * si può marcare l'intero elemento: si avvolgono solo i gruppi di cifre.
 *
 * La cattura comprende i separatori attaccati alle cifre (due punti, virgola e punto
 * decimali, trattini di intervallo, simbolo di valuta e percentuale): sono parte del
 * numero, e lasciarli in Fraunces in mezzo a cifre Geist significa rendere lo stesso
 * orario o lo stesso prezzo con due caratteri — i due punti di "09:00" restano più
 * bassi delle cifre, e il "€" del dialog non è quello della card di /scopri.
 */
function Numerals({ text }: { text: string }) {
  return (
    <>
      {text.split(NUMERALS_RUN).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="display-numerals">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function TripPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-primary px-5 py-4 text-primary-foreground sm:px-6 sm:py-5">
      <span className="block h-[3px] w-7 bg-voltage" />
      <p className="mt-3 text-xs font-semibold tracking-[0.18em] text-primary-foreground/60 uppercase">
        Il tuo viaggio
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">{children}</dl>
    </div>
  );
}

function TripStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-[0.14em] text-primary-foreground/60 uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 text-[17px] leading-snug font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function CountryPanel({
  name,
  code,
  children,
}: {
  name: string;
  code: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-3 border-b border-border bg-secondary px-5 py-3.5 sm:px-6">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs font-[725] tracking-[0.02em] text-primary-foreground"
        >
          {code}
        </span>
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Paese di destinazione
          </p>
          <p className="font-display text-base leading-tight font-[725] tracking-[-0.005em] text-primary uppercase">
            {name}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {children}
      </dl>
    </div>
  );
}

function CountryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="px-5 py-3.5 sm:px-6">
      <dt className="flex items-center gap-1.5 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
        <Icon className="size-3 shrink-0" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-primary">{value}</dd>
    </div>
  );
}

/**
 * I consigli utilizzabili dentro la risposta della route, o `null` se non c'è proprio un
 * elenco. La convalida non si ferma al contenitore: un elemento che non è un oggetto —
 * `[null]` — farebbe lanciare `entry.date` dentro il `.find()`, che gira in **fase di
 * resa**, cioè manderebbe in error boundary l'itinerario che questa richiesta non deve
 * poter toccare.
 *
 * Si convalidano i campi che la resa **non** stringifica, cioè quelli che finiscono come
 * figli JSX diretti: un oggetto lì dentro fa lanciare React ("Objects are not valid as a
 * React child"), e un `undefined` invece no — React lo ignora. Censimento campo per campo,
 * così non va rifatto da capo:
 *
 *   date           → solo confrontato (`entry.date === day.date`): stringa, obbligatoria
 *   name           → figlio JSX diretto: stringa, obbligatoria
 *   comment        → figlio JSX diretto: stringa, obbligatoria
 *   distanceMeters → dentro un template literal nella pastiglia: stringifica, non lancia
 *   street         → elemento di `meta`, reso con `.join()`: stringifica, non lancia
 *   openingHours   → elemento di `meta`, reso con `.join()`: stringifica, non lancia
 *   lat, lon       → dentro l'href del collegamento alla mappa: non lancia, ma un valore
 *                    che non è un numero produrrebbe un link che non porta da nessuna
 *                    parte, quindi il collegamento si rende solo se entrambi sono numeri
 *                    finiti (vedi DinnerSuggestionBlock).
 *
 * Aggiungendo un campo reso come figlio JSX diretto, va aggiunto anche qui.
 * Quel che si scarta si scarta in silenzio, come tutto il resto di questa fase.
 */
function accettaConsigli(value: unknown): DinnerSuggestion[] | null {
  if (!Array.isArray(value)) return null;

  return value.filter(
    (entry): entry is DinnerSuggestion =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as DinnerSuggestion).date === "string" &&
      typeof (entry as DinnerSuggestion).name === "string" &&
      typeof (entry as DinnerSuggestion).comment === "string"
  );
}

/**
 * Il posto del consiglio sulla cena, in coda alla giornata. L'altezza è riservata fin
 * dall'attesa — l'ingombro del blocco con un commento su una riga — così quando il
 * consiglio arriva non spinge in giù ciò che sta sotto. Un contenitore solo per tutti e tre
 * gli stati: separarli farebbe divergere le misure alla prima modifica.
 *
 * **13rem (208px), e la garanzia vale solo da desktop.** Misurato sulla build di
 * produzione, blocco reso alle larghezze vere del contenitore — 574px da desktop, 245px
 * da telefono — con via e orari di lunghezza realistica e commenti delle lunghezze che
 * il sistema può davvero produrre (il prompt ne chiede MAX_DINNER_COMMENT_LENGTH = 220,
 * lo schema ne tollera MAX_DINNER_COMMENT_TOLERANCE = 300):
 *
 *              commento breve   220 caratteri   300 caratteri
 *   574px           143px           183px           203px
 *   245px           183px           303px           363px
 *
 * 13rem copre i 203px, cioè **il commento più lungo che lo schema possa ammettere**: da
 * desktop lo scatto è zero garantito dallo schema, non sperato. La riserva precedente —
 * 7rem, e poi 9rem tarate su un commento breve — era sotto misura in quasi tutti i casi
 * veri.
 *
 * **Da telefono la garanzia è irraggiungibile e resta un limite aperto**, non una svista:
 * il caso peggiore costerebbe 363px riservati per ogni giornata, cioè ~180px di vuoto
 * sotto ogni consiglio normale, che è un prezzo peggiore del difetto. Lì il blocco può
 * ancora spingere in giù ciò che sta sotto. E lo scarto **non è per giornata**:
 * `dinnerDone` scatta per tutte le sere insieme, quindi su un viaggio di otto giorni gli
 * scarti si sommano — centinaia di pixel — e spostano sotto gli occhi la giornata che si
 * sta leggendo, non solo quella dopo. Chi vorrà chiuderlo dovrà accorciare il blocco o
 * troncare il commento, non alzare ancora la riserva.
 *
 * Toccando il corpo del blocco, rimisurare: queste cifre sono di misura, non di stima.
 */
function DinnerSlot({ children }: { children: React.ReactNode }) {
  return (
    <div data-dinner-slot className="min-h-[13rem] border-t border-border py-3">
      {children}
    </div>
  );
}

function DinnerNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

/**
 * Il consiglio non è una tappa: niente orario di appuntamento, niente bottone che apre un
 * dettaglio. È un riquadro a sé, staccato dall'elenco delle attività.
 */
function DinnerSuggestionBlock({ suggestion }: { suggestion: DinnerSuggestion }) {
  // La distanza è uscita di qui: sta nella pastiglia accanto al nome.
  const meta = [suggestion.street, suggestion.openingHours].filter(Boolean);

  // Senza coordinate non si costruisce un collegamento: `@undefined,undefined` porterebbe
  // l'utente da nessuna parte, e un link rotto è peggio di un nome semplice.
  const mapUrl =
    Number.isFinite(suggestion.lat) && Number.isFinite(suggestion.lon)
      ? buildDinnerMapUrl(suggestion.name, suggestion.lat, suggestion.lon)
      : null;

  return (
    <>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        {/* Decorativa: dice quel che dice già il testo accanto, quindi nascosta. */}
        <Utensils aria-hidden="true" className="size-3.5" />
        Dove cenare
      </p>
      <div className="rounded-lg border border-border bg-accent p-3">
        <div className="flex items-start justify-between gap-3">
          {/* Il nome è l'unica cosa che l'utente cerca: cresce di un gradino e prende
              il peso, così non pesa quanto il commento e gli orari. */}
          <p className="text-base font-semibold text-primary">
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                // Il testo visibile è il solo nome, che è quello che serve leggendo la
                // scheda; ad alta voce servirebbe anche dove porta e che apre altrove.
                aria-label={`${suggestion.name} su Google Maps (si apre in una nuova scheda)`}
                // Sottolineato come gli altri collegamenti esterni del progetto (footer,
                // "Verifica i prezzi reali"): niente ombre, niente gradienti, e nessun
                // colore proprio — il nome resta Bosco com'era.
                className="underline underline-offset-2 hover:decoration-2"
              >
                {suggestion.name}
              </a>
            ) : (
              suggestion.name
            )}
          </p>
          {/* «180 m» da solo non dice di che misura si tratti: il complemento resta
              per chi ascolta, e a schermo la pastiglia sta accanto al nome. Ed è «in
              linea d'aria», non «a piedi»: `distanceMeters` è una distanza haversine
              fra due punti (lib/dinner-candidates.ts), non un percorso pedonale, e un
              percorso pedonale non lo abbiamo mai calcolato. Dirlo solo a chi ascolta
              sarebbe pure peggio: la stessa affermazione non verificata che questa
              funzionalità esiste per eliminare, riservata a chi non può controllarla.

              `border-border` e non `border-input`: quello è il bordo dei controlli, e
              un chip bordato come un controllo accanto a un link sembra toccabile
              senza esserlo. Stesso token della pastiglia di reverse-search.tsx. */}
          <span
            data-dinner-distance
            className="mt-0.5 shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
          >
            {/* Template literal, non `{suggestion.distanceMeters} m`: così il valore
                stringifica come faceva dentro `meta` e resta fuori dal censimento dei
                campi resi come figli JSX diretti (vedi accettaConsigli). */}
            {`${suggestion.distanceMeters} m`}
            <span className="sr-only"> in linea d&apos;aria</span>
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{suggestion.comment}</p>
        <p data-dinner-meta className="mt-1.5 text-xs tabular-nums text-muted-foreground">
          {meta.join(" · ")}
        </p>
      </div>
    </>
  );
}

export function ItineraryResult({ tripData, itinerary, weather, countryInfo, onEdit }: ItineraryResultProps) {
  const [open, setOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "error">("idle");
  const [calendarError, setCalendarError] = useState(false);
  // `null` vuol dire "nessun dato": è lo stato iniziale ed è anche quello in cui si resta
  // se la richiesta fallisce, perché in quel caso la giornata deve restare com'era.
  // Un array (anche vuoto) vuol dire che la route ha risposto.
  const [dinner, setDinner] = useState<DinnerSuggestion[] | null>(null);
  const [dinnerAnswered, setDinnerAnswered] = useState(false);
  const reduceMotion = useReducedMotion();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Il form viene sostituito da questa vista: senza spostare il focus resterebbe
  // su <body> e lo screen reader non annuncerebbe l'esito della generazione.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // L'itinerario è già a schermo quando questa richiesta parte: non deve poter rompere
  // niente, quindi non esiste uno stato d'errore. O arriva un consiglio, o la giornata
  // resta com'è. La route, dal canto suo, non restituisce mai un errore del modello:
  // risponde 200 con un elenco vuoto. Le coordinate non si mandano — se le ricava lei
  // dalla destinazione.
  // Le giornate per cui ha senso chiedere: senza una tappa attorno a cui cercare non c'è
  // niente da domandare. Sta fuori dall'effetto perché serve anche alla resa, che deve
  // sapere quali giornate hanno una risposta da aspettare.
  const dinnerDays = useMemo(
    () =>
      itinerary.days.flatMap((day) => {
        const anchorTitle = pickDinnerAnchor(day);
        return anchorTitle ? [{ date: day.date, anchorTitle }] : [];
      }),
    [itinerary]
  );

  // Senza giornate da chiedere non c'è nessuna attesa: l'attesa finisce prima di
  // cominciare, e si ricava invece di essere messa in stato dentro l'effetto.
  const dinnerDone = dinnerDays.length === 0 || dinnerAnswered;

  useEffect(() => {
    let annullato = false;

    if (dinnerDays.length === 0) return;

    fetch("/api/dinner-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: tripData.destination,
        participants: tripData.participants,
        budget: tripData.budget,
        styleNotes: tripData.styleNotes,
        days: dinnerDays,
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        // La forma si verifica, non si dà per buona: quel che arriva dal filo non può
        // essere lasciato raggiungere la resa senza un controllo (vedi accettaConsigli).
        if (!annullato) setDinner(accettaConsigli(data?.suggestions));
      })
      .catch(() => {})
      .finally(() => {
        if (!annullato) setDinnerAnswered(true);
      });

    return () => {
      annullato = true;
    };
  }, [dinnerDays, tripData]);

  const handleExportCalendar = () => {
    try {
      const blob = new Blob([buildItineraryIcs(tripData, itinerary)], {
        type: "text/calendar;charset=utf-8",
      });
      triggerDownload(blob, `itinerario-${sanitizeFileName(tripData.destination)}.ics`);
      setCalendarError(false);
    } catch (error) {
      console.error("Esportazione calendario fallita", error);
      setCalendarError(true);
    }
  };

  const handleDownloadPdf = async () => {
    if (pdfState === "loading") return;
    setPdfState("loading");
    try {
      // caricata solo al clic: la libreria pesa ~400 KB
      const { buildItineraryPdfBlob } = await import("@/lib/itinerary-pdf");
      const blob = await buildItineraryPdfBlob({ tripData, itinerary, weather, countryInfo });
      triggerDownload(blob, `itinerario-${sanitizeFileName(tripData.destination)}.pdf`);
      setPdfState("idle");
    } catch (error) {
      console.error("Esportazione PDF fallita", error);
      setPdfState("error");
    }
  };

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden border-border shadow-none">
      <CardHeader className="px-8 pt-10 pb-8">
        {/* <h1> reale al posto di CardTitle, che è un <div>: stesse classi che
            CardTitle già produceva, quindi la resa non cambia. `outline-none`
            perché il focus programmatico (tabIndex -1) dopo un invio da tastiera
            matcha :focus-visible e la regola globale disegnerebbe un rettangolo
            Bosco attorno al titolone. Come in discover-results.tsx. */}
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="font-display text-3xl leading-[0.95] font-[725] tracking-[-0.01em] text-balance text-primary uppercase outline-none sm:text-5xl"
        >
          Si parte per {tripData.destination}
        </h1>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <TripPanel>
          {tripData.dateRange.from && tripData.dateRange.to && (
            <TripStat
              label="Date"
              value={formatDateRange(tripData.dateRange.from, tripData.dateRange.to)}
            />
          )}
          <TripStat
            label={tripData.participants.length > 1 ? "Viaggiatori" : "Viaggiatore"}
            value={tripData.participants
              .map((p) => `${PARTICIPANT_TYPE_LABELS[p.type]} (${p.age})`)
              .join(", ")}
          />
          <TripStat label="Budget" value={`${tripData.budget}€`} />
        </TripPanel>

        {countryInfo && (
          <CountryPanel name={countryInfo.name} code={countryInfo.code}>
            <CountryStat
              icon={Banknote}
              label="Valuta"
              value={`${countryInfo.currency.name} (${countryInfo.currency.symbol})`}
            />
            {countryInfo.languages.length > 0 && (
              <CountryStat
                icon={Languages}
                label={countryInfo.languages.length > 1 ? "Lingue" : "Lingua"}
                value={countryInfo.languages.join(", ")}
              />
            )}
            {countryInfo.timezones.length > 0 && (
              <CountryStat
                icon={Clock}
                label={countryInfo.timezones.length > 1 ? "Fusi orari" : "Fuso orario"}
                value={countryInfo.timezones.join(", ")}
              />
            )}
          </CountryPanel>
        )}

        <motion.div
          className="space-y-6"
          variants={reduceMotion ? undefined : dayList}
          initial={reduceMotion ? undefined : "hidden"}
          animate={reduceMotion ? undefined : "visible"}
        >
          {itinerary.days.map((day, dayIndex) => {
            const formattedDate = formatCalendarDate(day.date);
            const dayWeather = weather?.find((entry) => entry.date === day.date);
            const dinnerAsked = pickDinnerAnchor(day) !== null;
            const dinnerSuggestion = dinner?.find((entry) => entry.date === day.date);
            return (
              <motion.div
                key={dayIndex}
                data-day-date={day.date}
                className="overflow-hidden rounded-xl border border-border"
                variants={reduceMotion ? undefined : dayCard}
              >
                <div className="flex items-baseline justify-between gap-3 bg-primary px-4 py-3.5 text-primary-foreground">
                  <p className="font-display text-xl font-[725] tracking-[-0.005em] uppercase">
                    Giorno <span className="display-numerals">{dayIndex + 1}</span>
                  </p>
                  <p className="text-sm tabular-nums opacity-75">{formattedDate}</p>
                </div>
                {dayWeather && (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-secondary px-4 py-3">
                    <span className="flex items-baseline gap-1.5">
                      <Thermometer className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" />
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {dayWeather.tempMaxAvg}°
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        / {dayWeather.tempMinAvg}°
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Droplets className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {dayWeather.precipitationChance}%
                      </span>
                      <span
                        aria-hidden
                        className="h-1 w-12 overflow-hidden rounded-full bg-border"
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${dayWeather.precipitationChance}%` }}
                        />
                      </span>
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      media degli ultimi 5 anni
                    </span>
                  </div>
                )}
                {!dayWeather && (
                  <p className="border-b border-border bg-secondary px-4 py-3 text-xs text-muted-foreground">
                    Media climatica non disponibile per questa data.
                  </p>
                )}
                <div className="bg-card px-4">
                  {SLOTS.map(
                    ({ key, label }) =>
                      day[key].length > 0 && (
                        <div key={key} className="border-t border-border py-3 first:border-t-0">
                          <p className="mb-2 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
                            {label}
                          </p>
                          <div className="space-y-1">
                            {day[key].map((activity, activityIndex) => (
                              <button
                                key={activityIndex}
                                type="button"
                                onClick={() => {
                                  setSelectedActivity(activity);
                                  setOpen(true);
                                }}
                                className="w-full cursor-pointer rounded-md p-2 text-left transition-colors hover:bg-accent"
                              >
                                <p className="text-sm font-medium text-primary">{activity.title}</p>
                                <p className="text-sm text-muted-foreground">{activity.description}</p>
                                <div className="mt-1.5 flex justify-between text-xs font-semibold text-muted-foreground">
                                  <span className="tabular-nums">{activity.suggestedTime}</span>
                                  <span>{activity.estimatedCost}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                  )}
                  {/* Solo dove c'è stato qualcosa da chiedere: una giornata senza tappe
                      non deve nemmeno annunciare che non ha un consiglio. */}
                  {dinnerAsked && !dinnerDone && (
                    <DinnerSlot>
                      <DinnerNote>Cerchiamo dove cenare…</DinnerNote>
                    </DinnerSlot>
                  )}
                  {/* `dinner` nullo a richiesta conclusa vuol dire che è andata storta:
                      nessun messaggio, la giornata resta com'era.

                      Quando invece la risposta è arrivata ma questa giornata non ha un
                      consiglio, la riga parla solo di noi: la route risponde 200 con un
                      elenco vuoto in quattro casi diversi — nessun candidato trovato,
                      modello fallito, destinazione non geocodificata, giornata oltre il
                      tetto di fase — e il client non può distinguerli. Dire "nessun locale
                      qui attorno" sarebbe un'affermazione sul mondo che non abbiamo
                      verificato, cioè lo stesso difetto che questa funzionalità esiste per
                      eliminare, spostato dal nome del locale alla sua assenza. */}
                  {dinnerAsked && dinnerDone && dinner && (
                    <DinnerSlot>
                      {dinnerSuggestion ? (
                        <DinnerSuggestionBlock suggestion={dinnerSuggestion} />
                      ) : (
                        <DinnerNote>Per questa sera non abbiamo un consiglio.</DinnerNote>
                      )}
                    </DinnerSlot>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleDownloadPdf} disabled={pdfState === "loading"} className="gap-2">
            {pdfState === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparo il PDF…
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Scarica il PDF
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCalendar}
            className="gap-2 border-primary shadow-none"
          >
            <CalendarDays className="h-4 w-4" />
            Esporta calendario
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onEdit}
            className="border-primary text-primary shadow-none hover:bg-accent hover:text-primary"
          >
            Modifica il viaggio
          </Button>
        </div>

        {pdfState === "error" && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Non siamo riusciti a creare il PDF. Riprova, oppure esporta il calendario.
          </p>
        )}

        {calendarError && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Non siamo riusciti a creare il file del calendario. Riprova, oppure scarica il PDF.
          </p>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {selectedActivity && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-[725] tracking-[-0.01em] text-balance text-primary uppercase">
                  {selectedActivity.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Dettagli dell&apos;attività
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
                <div className="bg-card px-4 py-3">
                  <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    Orario
                  </dt>
                  <dd className="mt-1 font-display text-lg font-[725] tabular-nums text-primary">
                    <Numerals text={selectedActivity.suggestedTime} />
                  </dd>
                </div>
                <div className="bg-card px-4 py-3">
                  <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    Costo
                  </dt>
                  <dd className="mt-1 font-display text-lg font-[725] text-primary">
                    <Numerals text={selectedActivity.estimatedCost} />
                  </dd>
                </div>
                {selectedActivity.openingHours && (
                  <div className="col-span-2 bg-card px-4 py-3">
                    <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      Apertura
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-primary">
                      {selectedActivity.openingHours}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Cosa è
                  </p>
                  <p className="mt-1.5">{selectedActivity.details.about}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Come arrivarci
                  </p>
                  <p className="mt-1.5">{selectedActivity.details.gettingThere}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Consigli
                  </p>
                  <p className="mt-1.5">{selectedActivity.details.tips}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
