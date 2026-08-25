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
 * Il posto del consiglio sulla cena, in coda alla giornata. L'altezza è riservata fin
 * dall'attesa — 7rem è l'ingombro del blocco con un commento su una riga — così quando il
 * consiglio arriva non spinge in giù ciò che sta sotto. Un contenitore solo per tutti e tre
 * gli stati: separarli farebbe divergere le misure alla prima modifica.
 */
function DinnerSlot({ children }: { children: React.ReactNode }) {
  return (
    <div data-dinner-slot className="min-h-[7rem] border-t border-border py-3">
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
  const meta = [
    `${suggestion.distanceMeters} m a piedi`,
    suggestion.street,
    suggestion.openingHours,
  ].filter(Boolean);

  return (
    <>
      <p className="mb-2 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        Dove cenare
      </p>
      <div className="rounded-lg border border-border bg-accent p-3">
        <p className="text-sm font-medium text-primary">{suggestion.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{suggestion.comment}</p>
        <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">{meta.join(" · ")}</p>
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
        if (!annullato) setDinner(data?.suggestions ?? null);
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
                      nessun messaggio, la giornata resta com'era. */}
                  {dinnerAsked && dinnerDone && dinner && (
                    <DinnerSlot>
                      {dinnerSuggestion ? (
                        <DinnerSuggestionBlock suggestion={dinnerSuggestion} />
                      ) : (
                        <DinnerNote>
                          Nessun locale segnalato vicino alla tappa di questa sera.
                        </DinnerNote>
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
