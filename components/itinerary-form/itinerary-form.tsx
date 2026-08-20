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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { tripFormSchema, type TripFormValues } from "@/lib/schema";
import type { CreaPrefill } from "@/lib/crea-query-params";
import type { ErrorCode } from "@/lib/generate-itinerary-errors";
import type { ItineraryResponse } from "@/lib/itinerary-schema";
import type { DailyClimateAverage } from "@/lib/climate-forecast";
import type { CountryInfo } from "@/lib/country-info";
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
};

const MAX_PARTICIPANTS = 20;

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    value === "network" ||
    value === "config" ||
    value === "rate_limit" ||
    value === "invalid_response"
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
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [participantsPopoverOpen, setParticipantsPopoverOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 640px)");

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
        body: JSON.stringify(data),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(isErrorCode(body?.error) ? body.error : "invalid_response");
      }

      setSubmittedData(data);
      setItinerary(body.itinerary);
      setWeather(body.weather ?? null);
      setCountryInfo(body.countryInfo ?? null);
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
      />
    );
  }

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden border-border pb-0 shadow-none">
      <CardHeader className="px-8 pt-8">
        <span aria-hidden className="mb-4 block h-[3px] w-7 bg-voltage" />
        <CardTitle className="font-display text-3xl font-[725] tracking-[-0.01em] text-primary uppercase sm:text-4xl">
          Pianifica il tuo viaggio
        </CardTitle>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className={cn("space-y-8", mode === "loading" && "pointer-events-none opacity-60")}>
            <div role="group" aria-labelledby="gruppo-viaggio" className="space-y-5">
              <p id="gruppo-viaggio" className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Il viaggio
              </p>
              <DestinationAutocomplete
                control={control}
                name="destination"
                id="destination"
                label="Destinazione"
                placeholder="Es. Roma, Italia"
                error={errors.destination?.message}
              />

            <div className="space-y-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Date del viaggio"
                    className={cn(
                      "w-full justify-start rounded-md text-left font-normal",
                      !dateRange?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                      : "Seleziona le date"}
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
                    numberOfMonths={isDesktop ? 2 : 1}
                  />
                  <div className="grid grid-cols-2 gap-3 border-t p-3">
                    <div className="space-y-1">
                      <Label htmlFor="arrival-time" className="text-xs text-muted-foreground">
                        Arrivo (opzionale)
                      </Label>
                      <Input id="arrival-time" type="time" {...register("arrivalTime")} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="departure-time" className="text-xs text-muted-foreground">
                        Partenza (opzionale)
                      </Label>
                      <Input id="departure-time" type="time" {...register("departureTime")} />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {errors.dateRange && (
                <p className="text-sm text-destructive">{errors.dateRange.message}</p>
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
                    aria-label="Chi viaggia"
                    className={cn(
                      "w-full justify-start rounded-md text-left font-normal",
                      participantsError && "border-destructive"
                    )}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    {travelerSummary}
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
              {participantsError && <p className="text-sm text-destructive">{participantsError}</p>}
            </div>

            </div>

            <div role="group" aria-labelledby="gruppo-preferenze" className="space-y-5 border-t border-border pt-6">
              <p id="gruppo-preferenze" className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Le preferenze
              </p>
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
                Stile di viaggio
              </Label>
              <Input
                id="styleNotes"
                placeholder="Es. lusso, economico, avventura..."
                {...register("styleNotes")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mustSee">
                <Star className="h-4 w-4 text-muted-foreground" />
                Cosa non vuoi perderti
              </Label>
              <Input
                id="mustSee"
                placeholder="Es. Sagrada Família, il tramonto a Oia..."
                {...register("mustSee")}
              />
              <p className="text-xs text-muted-foreground">
                Dicci cosa non può mancare nel tuo viaggio.
              </p>
            </div>
            </div>
          </div>

          {apiError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {apiError}
            </p>
          )}

          <div className="-mx-8 -mb-8 border-t border-border bg-secondary px-8 pt-6 pb-6">
            <Button type="submit" className="w-full" disabled={mode === "loading"}>
              {mode === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {LOADING_MESSAGES[loadingMessageIndex]}
                </>
              ) : (
                "Genera itinerario"
              )}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Ci vuole meno di un minuto. Potrai modificare tutto in seguito.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
