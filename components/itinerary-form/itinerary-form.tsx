"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Euro, Loader2, Plus, Sparkles, Star, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  tripFormSchema,
  type TripFormValues,
  MAX_DESTINATION_LENGTH,
  MAX_STYLE_NOTES_LENGTH,
  MAX_MUST_SEE_LENGTH,
} from "@/lib/schema";
import { startOfToday } from "@/lib/calendar-date";
import { buildGenerateItineraryRequestBody } from "@/lib/generate-itinerary-request-body";
import type { CreaPrefill } from "@/lib/crea-query-params";
import type { ErrorCode } from "@/lib/generate-itinerary-errors";
import type { ItineraryResponse } from "@/lib/itinerary-schema";
import type { DailyClimateAverage } from "@/lib/climate-forecast";
import type { CountryInfo } from "@/lib/country-info";
import type { DinnerSuggestion } from "@/app/api/dinner-suggestions/route";
import { loadCreaSession, saveCreaSession } from "@/lib/crea-session-storage";
import { ParticipantRow } from "./participant-row";
import { ItineraryResult } from "./itinerary-result";
import { DestinationAutocomplete } from "./destination-autocomplete";

const defaultValues: TripFormValues = {
  destination: "",
  dateRange: { from: undefined, to: undefined },
  participants: [{ type: "adulto", age: undefined }],
  budget: 1000,
  styleNotes: "",
  mustSee: "",
  arrivalTime: "",
  departureTime: "",
};

const LOADING_MESSAGES = [
  "Stiamo consultando le mappe…",
  "Cerchiamo i posti migliori…",
  "Controlliamo gli orari di apertura…",
  "Chiediamo consiglio a un local…",
  "Ottimizziamo il tuo itinerario…",
  "Prepariamo le valigie (metaforicamente)…",
];

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  network:
    "Non siamo riusciti a contattare il servizio di generazione. Controlla la connessione e riprova.",
  config: "Si è verificato un problema tecnico. Riprova tra poco.",
  rate_limit: "Troppe richieste in questo momento, riprova tra qualche secondo.",
  invalid_response: "Non siamo riusciti a generare l'itinerario. Riprova.",
  content_blocked:
    "La richiesta contiene indicazioni che non possiamo elaborare. Modifica le note sullo stile di viaggio e riprova.",
};

const MAX_PARTICIPANTS = 20;

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    value === "network" ||
    value === "config" ||
    value === "rate_limit" ||
    value === "invalid_response" ||
    value === "content_blocked"
  );
}

interface ItineraryFormProps {
  prefill?: CreaPrefill;
}

export function ItineraryForm({ prefill }: ItineraryFormProps) {
  const [mode, setMode] = useState<"form" | "loading" | "result">("form");
  const [submittedData, setSubmittedData] = useState<TripFormValues | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [weather, setWeather] = useState<DailyClimateAverage[] | null>(null);
  const [countryInfo, setCountryInfo] = useState<CountryInfo | null>(null);
  // Tenuti qui e non solo dentro il risultato: sono ciò che va salvato con il resto
  // della sessione, altrimenti dopo un ricaricamento verrebbero richiesti da capo.
  const [dinner, setDinner] = useState<DinnerSuggestion[] | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [participantsPopoverOpen, setParticipantsPopoverOpen] = useState(false);
  // 768px e non 640: la soglia deve coincidere con `md:flex-row` di
  // components/ui/calendar.tsx, l'unica regola che affianca davvero i due mesi.
  // Con 640 la fascia 640-767 chiedeva due mesi e li impilava — pannello alto
  // 712px, che su un viewport da 1000 finiva sotto il bordo dello schermo.
  // Spostando la soglia (invece di abbassare a `sm` la classe di shadcn) quella
  // fascia vede un mese solo, compatto come da telefono, e la breakpoint CSS
  // resta l'unica sorgente di verità. Cambiando l'una va cambiata l'altra.
  const isTwoMonthsWide = useMediaQuery("(min-width: 768px)");

  const initialValues: TripFormValues = {
    ...defaultValues,
    ...(prefill?.destination ? { destination: prefill.destination } : {}),
    ...(prefill?.budget !== undefined ? { budget: prefill.budget } : {}),
    ...(prefill?.participants?.length ? { participants: prefill.participants } : {}),
    ...(prefill?.from || prefill?.to
      ? { dateRange: { from: prefill.from, to: prefill.to } }
      : {}),
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    reset,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: initialValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "participants",
  });

  const dateRange = watch("dateRange");
  const budget = watch("budget");
  const participants = watch("participants");
  const travelerSummary = `${participants.length} ${participants.length === 1 ? "viaggiatore" : "viaggiatori"}`;
  const participantsError = Array.isArray(errors.participants)
    ? "Completa i dati di ogni viaggiatore"
    : errors.participants?.message;

  // Arrivare con dei parametri in query string è esprimere un'intenzione nuova:
  // ritrovarsi l'itinerario di Roma dopo aver chiesto /crea?destination=Lisbona
  // è peggio che perderlo. In quel caso la sessione salvata non si riprende.
  const hasPrefill = !!prefill && Object.keys(prefill).length > 0;

  useEffect(() => {
    if (hasPrefill) return;

    const stored = loadCreaSession();
    if (!stored) return;

    setSubmittedData(stored.submitted);
    setItinerary(stored.itinerary);
    setWeather(stored.weather);
    setCountryInfo(stored.countryInfo);
    setDinner(stored.dinner);
    setMode(stored.mode);
    // Il form dietro al risultato deve corrispondere a ciò che è a schermo: chi
    // preme «Modifica» deve ritrovare la sua richiesta, non il form vuoto.
    reset(stored.submitted);
  }, [hasPrefill, reset]);

  // Un salvataggio solo, che copre da sé i tre momenti che contano: la generazione
  // riuscita, il ritorno al form con «Modifica» (cambia il modo) e l'arrivo dei
  // consigli sulla cena. Durante il caricamento non si tocca niente, perché la
  // sessione precedente è ancora quella valida finché la nuova non è arrivata.
  useEffect(() => {
    if (mode === "loading" || !submittedData || !itinerary) return;
    saveCreaSession({ mode, submitted: submittedData, itinerary, weather, countryInfo, dinner });
  }, [mode, submittedData, itinerary, weather, countryInfo, dinner]);

  useEffect(() => {
    if (mode !== "loading") return;

    setLoadingMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => {
        if (LOADING_MESSAGES.length <= 1) return prev;
        let next = Math.floor(Math.random() * LOADING_MESSAGES.length);
        while (next === prev) {
          next = Math.floor(Math.random() * LOADING_MESSAGES.length);
        }
        return next;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [mode]);

  const onSubmit = async (data: TripFormValues) => {
    if (mode === "loading") return;

    setApiError(null);
    setMode("loading");

    try {
      const response = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildGenerateItineraryRequestBody(data)),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(isErrorCode(body?.error) ? body.error : "invalid_response");
      }

      setSubmittedData(data);
      setItinerary(body.itinerary);
      setWeather(body.weather ?? null);
      setCountryInfo(body.countryInfo ?? null);
      // I consigli di un itinerario precedente non valgono per questo: si riparte
      // da zero, altrimenti il risultato nuovo nascerebbe con le cene di quello vecchio.
      setDinner(null);
      setMode("result");
    } catch (error) {
      const code = error instanceof Error && isErrorCode(error.message) ? error.message : "invalid_response";
      setApiError(ERROR_MESSAGES[code]);
      setMode("form");
    }
  };

  const handleEdit = () => {
    setMode("form");
  };

  if (mode === "result" && submittedData && itinerary) {
    return (
      <ItineraryResult
        tripData={submittedData}
        itinerary={itinerary}
        weather={weather}
        countryInfo={countryInfo}
        onEdit={handleEdit}
        initialDinner={dinner}
        onDinnerLoaded={setDinner}
      />
    );
  }

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden border-border pb-0 shadow-none">
      <CardHeader className="px-8 pt-8">
        <span aria-hidden className="mb-4 block h-[3px] w-7 bg-voltage" />
        {/* <h1> reale al posto di CardTitle, che è un <div>: le classi sono le
            stesse che CardTitle già produceva (cn() scarta leading-none e
            font-semibold, sovrascritte da quelle qui sotto), resa identica. */}
        <h1 className="font-display text-3xl font-[725] tracking-[-0.01em] text-primary uppercase sm:text-4xl">
          Pianifica il tuo viaggio
        </h1>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className={cn("space-y-8", mode === "loading" && "pointer-events-none opacity-60")}>
            <div role="group" aria-labelledby="gruppo-viaggio" className="space-y-5">
              <h2 id="gruppo-viaggio" className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Il viaggio
              </h2>
              <DestinationAutocomplete
                control={control}
                name="destination"
                id="destination"
                label="Destinazione"
                placeholder="Es. Roma, Italia"
                maxLength={MAX_DESTINATION_LENGTH}
                error={errors.destination?.message}
              />

            <div className="space-y-2">
              <Popover>
                <PopoverTrigger asChild>
                  {/* Niente aria-label: cancellerebbe il testo visibile dal nome
                      accessibile (WCAG 2.5.3). L'etichetta sr-only lo precede. */}
                  <Button
                    type="button"
                    variant="outline"
                    aria-labelledby="date-label date-value"
                    aria-invalid={errors.dateRange ? true : undefined}
                    aria-describedby={errors.dateRange ? "date-error" : undefined}
                    className={cn(
                      "w-full justify-start rounded-md text-left font-normal",
                      !dateRange?.from && "text-muted-foreground"
                    )}
                  >
                    <span id="date-label" className="sr-only">
                      Date del viaggio
                    </span>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span id="date-value">
                      {dateRange?.from && dateRange?.to
                        ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                        : "Seleziona le date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                  data-calendar-popover=""
                >
                  <Calendar
                    mode="range"
                    selected={dateRange as DateRange | undefined}
                    onSelect={(range) => {
                      setValue(
                        "dateRange",
                        { from: range?.from, to: range?.to },
                        { shouldValidate: true }
                      );
                    }}
                    numberOfMonths={isTwoMonthsWide ? 2 : 1}
                    disabled={{ before: startOfToday() }}
                    startMonth={startOfToday()}
                  />
                  <div className="grid grid-cols-1 gap-3 border-t p-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor="arrival-time" className="text-xs text-muted-foreground">
                        Arrivo (opzionale)
                      </Label>
                      <Input id="arrival-time" type="time" className="w-full" {...register("arrivalTime")} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor="departure-time" className="text-xs text-muted-foreground">
                        Partenza (opzionale)
                      </Label>
                      <Input id="departure-time" type="time" className="w-full" {...register("departureTime")} />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {errors.dateRange && (
                <p id="date-error" role="alert" className="text-sm text-destructive">
                  {errors.dateRange.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Popover
                open={participantsPopoverOpen}
                onOpenChange={(open) => {
                  setParticipantsPopoverOpen(open);
                  if (!open) {
                    trigger("participants");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-labelledby="travelers-label travelers-value"
                    aria-invalid={participantsError ? true : undefined}
                    aria-describedby={participantsError ? "travelers-error" : undefined}
                    className={cn(
                      "w-full justify-start rounded-md text-left font-normal",
                      participantsError && "border-destructive"
                    )}
                  >
                    <span id="travelers-label" className="sr-only">
                      Chi viaggia
                    </span>
                    <Users className="mr-2 h-4 w-4" />
                    <span id="travelers-value">{travelerSummary}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm" align="start">
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <ParticipantRow
                        key={field.id}
                        index={index}
                        control={control}
                        setValue={setValue}
                        onRemove={() => {
                          if (fields.length > 1) remove(index);
                        }}
                        canRemove={fields.length > 1}
                        error={
                          Array.isArray(errors.participants)
                            ? errors.participants[index]?.age?.message
                            : undefined
                        }
                      />
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => append({ type: "adulto", age: undefined })}
                      disabled={fields.length >= MAX_PARTICIPANTS}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4" />
                      Aggiungi viaggiatore
                    </Button>
                    <PopoverClose asChild>
                      <Button type="button" className="w-full">
                        Fatto
                      </Button>
                    </PopoverClose>
                  </div>
                </PopoverContent>
              </Popover>
              {participantsError && (
                <p id="travelers-error" role="alert" className="text-sm text-destructive">
                  {participantsError}
                </p>
              )}
            </div>

            </div>

            <div role="group" aria-labelledby="gruppo-preferenze" className="space-y-5 border-t border-border pt-6">
              <h2 id="gruppo-preferenze" className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Le preferenze
              </h2>
            <div className="space-y-2">
              <Label htmlFor="budget-amount">
                <Euro className="h-4 w-4 text-muted-foreground" />
                Budget indicativo
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  aria-label="Budget indicativo in euro"
                  min={0}
                  max={10000}
                  step={50}
                  value={[budget]}
                  onValueChange={([value]) => setValue("budget", value, { shouldValidate: true })}
                  className="flex-1"
                />
                <div className="relative w-28 shrink-0">
                  <Input
                    id="budget-amount"
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={budget}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      const clamped = Number.isNaN(next) ? 0 : Math.min(10000, Math.max(0, next));
                      setValue("budget", clamped, { shouldValidate: true });
                    }}
                    className="pr-7"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="styleNotes">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Stile di viaggio{" "}
                <span className="font-normal text-muted-foreground">(opzionale)</span>
              </Label>
              <Input
                id="styleNotes"
                placeholder="Es. lusso, economico, avventura..."
                maxLength={MAX_STYLE_NOTES_LENGTH}
                {...register("styleNotes")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mustSee">
                <Star className="h-4 w-4 text-muted-foreground" />
                Cosa non vuoi perderti{" "}
                <span className="font-normal text-muted-foreground">(opzionale)</span>
              </Label>
              <Input
                id="mustSee"
                placeholder="Es. Sagrada Família, il tramonto a Oia..."
                maxLength={MAX_MUST_SEE_LENGTH}
                {...register("mustSee")}
              />
              <p className="text-xs text-muted-foreground">
                Dicci cosa non può mancare nel tuo viaggio (massimo {MAX_MUST_SEE_LENGTH} caratteri).
              </p>
            </div>
            </div>
          </div>

          {apiError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {apiError}
            </p>
          )}

          <div className="-mx-8 -mb-8 border-t border-border bg-secondary px-8 pt-6 pb-6">
            {/* aria-disabled invece di disabled: `disabled` toglierebbe il focus
                al bottone appena parte il caricamento (finirebbe su <body>). Il
                secondo invio è già ignorato dalla guardia in onSubmit; le due
                classi replicano esattamente `disabled:pointer-events-none
                disabled:opacity-50` del Button, quindi l'aspetto non cambia. */}
            <Button
              type="submit"
              aria-disabled={mode === "loading" ? true : undefined}
              className={cn("w-full", mode === "loading" && "pointer-events-none opacity-50")}
            >
              {mode === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {LOADING_MESSAGES[loadingMessageIndex]}
                </>
              ) : (
                "Genera itinerario"
              )}
            </Button>
            {/* Testo stabile: i LOADING_MESSAGES ruotano ogni 4,5s e annunciarli
                sarebbe uno spam continuo. */}
            <p role="status" className="sr-only">
              {mode === "loading" ? "Sto generando il tuo itinerario, attendi." : ""}
            </p>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Ci vuole meno di un minuto. Potrai modificare tutto in seguito.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
