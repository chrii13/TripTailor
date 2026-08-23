"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, Compass, Euro, Loader2, Plus, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { participantSchema, MAX_TRIP_DAYS, MAX_DESTINATION_LENGTH } from "@/lib/schema";
import { startOfToday } from "@/lib/calendar-date";
import {
  VACATION_TYPES,
  VACATION_TYPE_LABELS,
  MAX_TRIP_NIGHTS,
} from "@/lib/discover-trips-request";
import { tripProposalSchema, type TripProposal } from "@/lib/discover-trips-schema";
import { buildFlexibleMonthOptions } from "@/lib/discover-trips-flexible-period";
import { buildDiscoverTripsRequestBody } from "@/lib/discover-trips-request-body";
import type { ErrorCode } from "@/lib/generate-itinerary-errors";
import { DestinationAutocomplete } from "@/components/itinerary-form/destination-autocomplete";
import { ParticipantRow } from "@/components/itinerary-form/participant-row";
import { DiscoverResults } from "@/components/discover-trips/discover-results";

const NIGHT_OPTIONS = Array.from({ length: MAX_TRIP_NIGHTS }, (_, i) => i + 1);

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const discoverFormSchema = z
  .object({
    departureCity: z
      .string()
      .trim()
      .min(1, "Inserisci la città da cui parti")
      .max(MAX_DESTINATION_LENGTH, `Massimo ${MAX_DESTINATION_LENGTH} caratteri`),
    dateMode: z.enum(["esatte", "flessibili"]),
    dateRange: z.object({ from: z.date().optional(), to: z.date().optional() }),
    flexiblePeriod: z.object({ month: z.string().optional(), nights: z.number().int().optional() }),
    participants: z.array(participantSchema).min(1, "Aggiungi almeno un viaggiatore").max(20, "Massimo 20 viaggiatori"),
    budget: z.number().min(0),
    vacationType: z.string().trim().max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dateMode === "esatte") {
      if (!data.dateRange.from || !data.dateRange.to) {
        ctx.addIssue({
          code: "custom",
          path: ["dateRange"],
          message: "Seleziona le date di inizio e fine",
        });
        return;
      }
      if (data.dateRange.from < startOfToday()) {
        ctx.addIssue({
          code: "custom",
          path: ["dateRange"],
          message: "Le date del viaggio non possono essere nel passato",
        });
        return;
      }
      if (data.dateRange.to < data.dateRange.from) {
        ctx.addIssue({
          code: "custom",
          path: ["dateRange"],
          message: "La data di fine deve essere successiva o uguale alla data di inizio",
        });
        return;
      }
      const days = Math.round((data.dateRange.to.getTime() - data.dateRange.from.getTime()) / MS_PER_DAY) + 1;
      if (days > MAX_TRIP_DAYS) {
        ctx.addIssue({
          code: "custom",
          path: ["dateRange"],
          message: `Il viaggio non può superare i ${MAX_TRIP_DAYS} giorni`,
        });
      }
    } else {
      if (!data.flexiblePeriod.month) {
        ctx.addIssue({ code: "custom", path: ["flexiblePeriod", "month"], message: "Seleziona un mese" });
      }
      if (
        data.flexiblePeriod.nights === undefined ||
        data.flexiblePeriod.nights < 1 ||
        data.flexiblePeriod.nights > MAX_TRIP_NIGHTS
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["flexiblePeriod", "nights"],
          message: `Seleziona un numero di notti tra 1 e ${MAX_TRIP_NIGHTS}`,
        });
      }
    }
  });

export type DiscoverFormValues = z.infer<typeof discoverFormSchema>;

const defaultValues: DiscoverFormValues = {
  departureCity: "",
  dateMode: "esatte",
  dateRange: { from: undefined, to: undefined },
  flexiblePeriod: { month: undefined, nights: undefined },
  participants: [{ type: "adulto", age: undefined }],
  budget: 1000,
};

const LOADING_MESSAGES = [
  "Confrontiamo le mete possibili…",
  "Stimiamo voli e alloggi…",
  "Scartiamo quelle fuori budget…",
  "Mettiamo in fila le proposte…",
];

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  network: "Non siamo riusciti a contattare il servizio. Controlla la connessione e riprova.",
  config: "Si è verificato un problema tecnico. Riprova tra poco.",
  rate_limit: "Troppe richieste in questo momento, riprova tra qualche secondo.",
  invalid_response: "Non siamo riusciti a trovare proposte. Riprova.",
  content_blocked:
    "La richiesta contiene indicazioni che non possiamo elaborare. Modifica il tipo di vacanza e riprova.",
};

const MAX_PARTICIPANTS = 20;

// Id fissi: i messaggi di errore vanno collegati ai campi con aria-describedby,
// altrimenti chi usa uno screen reader sente il campo ma non il motivo dell'errore.
const DATE_ERROR_ID = "discover-date-error";
const NIGHTS_ERROR_ID = "discover-nights-error";
const PARTICIPANTS_ERROR_ID = "discover-participants-error";
const API_ERROR_ID = "discover-api-error";

// Le proposte servono a confrontare: scegliere una non deve far svanire le altre.
// sessionStorage (non localStorage) perché i risultati appartengono a questa
// sessione di navigazione, non devono ricomparire giorni dopo come se fossero attuali.
const STORAGE_KEY = "discover-trips-session";

const storedSubmittedSchema = z
  .object({
    departureCity: z.string().trim().min(1),
    dateMode: z.enum(["esatte", "flessibili"]),
    dateRange: z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }),
    flexiblePeriod: z.object({ month: z.string().optional(), nights: z.number().int().optional() }),
    participants: z.array(participantSchema).min(1).max(20),
    budget: z.number().min(0),
    vacationType: z.string().trim().max(100).optional(),
  })
  .refine(
    (data) =>
      data.dateMode === "esatte"
        ? !!data.dateRange.from && !!data.dateRange.to
        : !!data.flexiblePeriod.month && data.flexiblePeriod.nights !== undefined,
    { message: "Dati del periodo mancanti per la modalità salvata" }
  );

const storedPayloadSchema = z.object({
  submitted: storedSubmittedSchema,
  proposals: z.array(tripProposalSchema),
});

type StoredPayload = z.infer<typeof storedPayloadSchema>;

function saveResultsToSession(values: DiscoverFormValues, proposals: TripProposal[]): void {
  try {
    const payload = { submitted: values, proposals };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage non disponibile (es. navigazione privata): non blocca il flusso
  }
}

function loadResultsFromSession(): StoredPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = storedPayloadSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    // valore corrotto o non leggibile: si riparte dal form vuoto senza errori
    return null;
  }
}

function describeResults(count: number): string {
  if (count === 0) return "Nessuna proposta trovata per questa ricerca.";
  if (count === 1) return "Trovata 1 proposta di viaggio.";
  return `Trovate ${count} proposte di viaggio.`;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    value === "network" ||
    value === "config" ||
    value === "rate_limit" ||
    value === "invalid_response" ||
    value === "content_blocked"
  );
}

export function DiscoverForm() {
  const [mode, setMode] = useState<"form" | "loading" | "results">("form");
  const [proposals, setProposals] = useState<TripProposal[]>([]);
  const [submitted, setSubmitted] = useState<DiscoverFormValues | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  // Annuncio per screen reader: l'attesa dura fino a mezzo minuto e i risultati
  // compaiono al posto del form senza che nulla lo segnali a chi non vede lo schermo.
  const [statusMessage, setStatusMessage] = useState("");
  // I risultati ripresi da sessionStorage sono già lì al caricamento della pagina:
  // non vanno annunciati né devono rubare il focus, che invece va spostato quando
  // arrivano in risposta a una ricerca appena inviata.
  const [resultsFromSearch, setResultsFromSearch] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const {
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DiscoverFormValues>({
    resolver: zodResolver(discoverFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "participants" });

  const dateMode = watch("dateMode");
  const dateRange = watch("dateRange");
  const flexiblePeriod = watch("flexiblePeriod");
  const budget = watch("budget");
  const participants = watch("participants");
  const vacationType = watch("vacationType");
  const travelerSummary = `${participants.length} ${participants.length === 1 ? "viaggiatore" : "viaggiatori"}`;
  const participantsError = Array.isArray(errors.participants)
    ? "Completa i dati di ogni viaggiatore"
    : errors.participants?.message;
  const dateError = errors.dateRange?.message ?? errors.flexiblePeriod?.month?.message;
  const nightsError = errors.flexiblePeriod?.nights?.message;

  const monthOptions = useMemo(() => buildFlexibleMonthOptions(new Date()), []);

  useEffect(() => {
    const stored = loadResultsFromSession();
    if (!stored) return;

    setSubmitted(stored.submitted);
    setProposals(stored.proposals);
    setMode("results");
    // Il form sotto ai risultati deve corrispondere a ciò che è a schermo:
    // se l'utente preme "Modifica la ricerca" deve ritrovare la sua ricerca,
    // non il form vuoto. storedSubmittedSchema usa z.coerce.date(), quindi
    // stored.submitted.dateRange.from/to sono già oggetti Date veri.
    reset(stored.submitted);
  }, [reset]);

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

  const onSubmit = async (values: DiscoverFormValues) => {
    if (mode === "loading") return;

    setApiError(null);
    setMode("loading");
    setStatusMessage("Stiamo cercando le proposte di viaggio, attendi.");

    try {
      const response = await fetch("/api/discover-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDiscoverTripsRequestBody(values)),
      });
      const body = await response.json();

      if (!response.ok) {
        const code: ErrorCode = isErrorCode(body?.error) ? body.error : "invalid_response";
        // L'errore lo annuncia il messaggio con role="alert": qui basta chiudere l'attesa.
        setStatusMessage("");
        setApiError(ERROR_MESSAGES[code]);
        setMode("form");
        return;
      }

      const receivedProposals: TripProposal[] = body.proposals ?? [];
      setProposals(receivedProposals);
      setSubmitted(values);
      setStatusMessage(describeResults(receivedProposals.length));
      setResultsFromSearch(true);
      setMode("results");
      saveResultsToSession(values, receivedProposals);
    } catch {
      setStatusMessage("");
      setApiError(ERROR_MESSAGES.network);
      setMode("form");
    }
  };

  // La regione di stato sta fuori dal ramo form/risultati: se vivesse dentro uno dei due
  // verrebbe montata insieme al testo e gli screen reader non annuncerebbero il cambio.
  const statusRegion = (
    <p role="status" aria-live="polite" className="sr-only">
      {statusMessage}
    </p>
  );

  if (mode === "results" && submitted) {
    return (
      <>
        {statusRegion}
        <DiscoverResults
          proposals={proposals}
          dateMode={submitted.dateMode}
          dateRange={submitted.dateRange}
          flexiblePeriod={submitted.flexiblePeriod}
          participants={submitted.participants}
          budget={submitted.budget}
          departureCity={submitted.departureCity}
          focusHeading={resultsFromSearch}
          onEdit={() => {
            setStatusMessage("");
            setMode("form");
          }}
        />
      </>
    );
  }

  return (
    <>
      {statusRegion}
      <Card className="mx-auto w-full max-w-2xl overflow-hidden border-border pb-0 shadow-none">
        <CardHeader className="px-8 pt-8">
          <span aria-hidden className="mb-4 block h-[3px] w-7 bg-voltage" />
          {/* h1 della pagina al posto di CardTitle, che è un <div>: le classi sono
              quelle che cn()/twMerge già produceva (leading-none e font-semibold
              venivano scartate), quindi la resa visiva non cambia. */}
          <h1 className="font-display text-3xl font-[725] tracking-[-0.01em] text-primary uppercase sm:text-4xl">
            Trova il tuo viaggio
          </h1>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className={cn("space-y-8", mode === "loading" && "pointer-events-none opacity-60")}>
              <DestinationAutocomplete
                control={control}
                name="departureCity"
                id="departure-city"
                label="Città di partenza"
                placeholder="Es. Milano, Italia"
                maxLength={MAX_DESTINATION_LENGTH}
                error={errors.departureCity?.message}
              />

              <div className="space-y-2">
                <div className="inline-flex rounded-full border border-border p-0.5">
                  {(["esatte", "flessibili"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={dateMode === option}
                      onClick={() => setValue("dateMode", option, { shouldValidate: true })}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors sm:h-auto sm:py-1.5",
                        dateMode === option
                          ? "bg-primary text-primary-foreground"
                          : "text-primary hover:bg-accent"
                      )}
                    >
                      {option === "esatte" ? "Date esatte" : "Date flessibili"}
                    </button>
                  ))}
                </div>

                {dateMode === "esatte" ? (
                  <div>
                    <Popover>
                      <PopoverTrigger asChild>
                        {/* Niente aria-label: cancellerebbe il testo visibile dal nome
                            accessibile (WCAG 2.5.3). L'etichetta sr-only lo precede. */}
                        <Button
                          type="button"
                          variant="outline"
                          aria-labelledby="discover-date-label discover-date-value"
                          aria-invalid={dateError ? true : undefined}
                          aria-describedby={dateError ? DATE_ERROR_ID : undefined}
                          className={cn(
                            "w-full justify-start rounded-md text-left font-normal",
                            !dateRange?.from && "text-muted-foreground"
                          )}
                        >
                          <span id="discover-date-label" className="sr-only">
                            Date del viaggio
                          </span>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          <span id="discover-date-value">
                            {dateRange?.from && dateRange?.to
                              ? `${format(dateRange.from, "dd MMM", { locale: it })} - ${format(dateRange.to, "dd MMM", { locale: it })}`
                              : "Seleziona date"}
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
                          numberOfMonths={isDesktop ? 2 : 1}
                          disabled={{ before: startOfToday() }}
                          startMonth={startOfToday()}
                        />
                      </PopoverContent>
                    </Popover>
                    {dateError && (
                      <p id={DATE_ERROR_ID} role="alert" className="mt-2 text-sm text-destructive">
                        {dateError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      {/* Niente aria-label sul trigger: sostituirebbe il valore
                          scelto nel nome accessibile (WCAG 2.5.3). L'etichetta
                          sr-only precede il valore, che il trigger porta con sé. */}
                      <span id="discover-month-label" className="sr-only">
                        Mese del viaggio
                      </span>
                      <Select
                        value={flexiblePeriod?.month ?? ""}
                        onValueChange={(value) =>
                          setValue("flexiblePeriod.month", value, { shouldValidate: true })
                        }
                      >
                        <SelectTrigger
                          id="discover-month-trigger"
                          aria-labelledby="discover-month-label discover-month-trigger"
                          aria-invalid={dateError ? true : undefined}
                          aria-describedby={dateError ? DATE_ERROR_ID : undefined}
                          className="w-full"
                        >
                          <SelectValue placeholder="Scegli il mese" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-40">
                      <span id="discover-nights-label" className="sr-only">
                        Numero di notti
                      </span>
                      <Select
                        value={flexiblePeriod?.nights !== undefined ? String(flexiblePeriod.nights) : ""}
                        onValueChange={(value) =>
                          setValue("flexiblePeriod.nights", Number(value), { shouldValidate: true })
                        }
                      >
                        <SelectTrigger
                          id="discover-nights-trigger"
                          aria-labelledby="discover-nights-label discover-nights-trigger"
                          aria-invalid={nightsError ? true : undefined}
                          aria-describedby={nightsError ? NIGHTS_ERROR_ID : undefined}
                          className="w-full"
                        >
                          <SelectValue placeholder="Notti" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {NIGHT_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} {n === 1 ? "notte" : "notti"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Un messaggio per campo, ciascuno col proprio id: un solo
                        paragrafo condiviso rimandava la Select delle notti
                        all'errore del mese quando erano attivi entrambi. */}
                    {dateError && (
                      <p id={DATE_ERROR_ID} role="alert" className="w-full text-sm text-destructive">
                        {dateError}
                      </p>
                    )}
                    {nightsError && (
                      <p id={NIGHTS_ERROR_ID} role="alert" className="w-full text-sm text-destructive">
                        {nightsError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      aria-labelledby="discover-travelers-label discover-travelers-value"
                      aria-invalid={participantsError ? true : undefined}
                      aria-describedby={participantsError ? PARTICIPANTS_ERROR_ID : undefined}
                      className={cn(
                        "w-full justify-start rounded-md text-left font-normal",
                        participantsError && "border-destructive"
                      )}
                    >
                      <span id="discover-travelers-label" className="sr-only">
                        Chi viaggia
                      </span>
                      <Users className="mr-2 h-4 w-4" />
                      <span id="discover-travelers-value">{travelerSummary}</span>
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
                  <p id={PARTICIPANTS_ERROR_ID} role="alert" className="text-sm text-destructive">
                    {participantsError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget-amount">
                  <Euro className="h-4 w-4 text-muted-foreground" />
                  Budget totale
                </Label>
                <div className="flex items-center gap-4">
                  <Slider
                    aria-label="Budget totale in euro"
                    min={0}
                    max={20000}
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
                      max={20000}
                      step={1}
                      value={budget}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        const clamped = Number.isNaN(next) ? 0 : Math.min(20000, Math.max(0, next));
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
                <Label htmlFor="vacation-type">
                  <Compass className="h-4 w-4 text-muted-foreground" />
                  Che tipo di vacanza cerchi?{" "}
                  <span className="font-normal text-muted-foreground">(opzionale)</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {VACATION_TYPES.map((type) => {
                    const label = VACATION_TYPE_LABELS[type];
                    const isActive = vacationType?.trim() === label;
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() =>
                          setValue("vacationType", isActive ? undefined : label, {
                            shouldValidate: true,
                          })
                        }
                        className={cn(
                          "flex h-11 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors sm:h-auto sm:py-2",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-primary hover:bg-accent"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <Input
                  id="vacation-type"
                  placeholder="Es. terme e relax in montagna"
                  maxLength={100}
                  value={vacationType ?? ""}
                  onChange={(e) =>
                    setValue("vacationType", e.target.value, { shouldValidate: true })
                  }
                />
              </div>
            </div>

            {apiError && (
              <p
                id={API_ERROR_ID}
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
                className={cn("w-full", mode === "loading" && "pointer-events-none opacity-50")}
                aria-disabled={mode === "loading" ? true : undefined}
                aria-describedby={apiError ? API_ERROR_ID : undefined}
              >
                {mode === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {LOADING_MESSAGES[loadingMessageIndex]}
                  </>
                ) : (
                  "Trova i miei viaggi"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
