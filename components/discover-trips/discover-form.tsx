"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Compass, Euro, Loader2, Plus, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { participantSchema, MAX_TRIP_DAYS } from "@/lib/schema";
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
    departureCity: z.string().trim().min(1, "Inserisci la città da cui parti"),
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
};

const MAX_PARTICIPANTS = 20;

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

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    value === "network" ||
    value === "config" ||
    value === "rate_limit" ||
    value === "invalid_response"
  );
}

export function DiscoverForm() {
  const [mode, setMode] = useState<"form" | "loading" | "results">("form");
  const [proposals, setProposals] = useState<TripProposal[]>([]);
  const [submitted, setSubmitted] = useState<DiscoverFormValues | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
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
    setApiError(null);
    setMode("loading");

    try {
      const response = await fetch("/api/discover-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDiscoverTripsRequestBody(values)),
      });
      const body = await response.json();

      if (!response.ok) {
        const code: ErrorCode = isErrorCode(body?.error) ? body.error : "invalid_response";
        setApiError(ERROR_MESSAGES[code]);
        setMode("form");
        return;
      }

      const receivedProposals: TripProposal[] = body.proposals ?? [];
      setProposals(receivedProposals);
      setSubmitted(values);
      setMode("results");
      saveResultsToSession(values, receivedProposals);
    } catch {
      setApiError(ERROR_MESSAGES.network);
      setMode("form");
    }
  };

  if (mode === "results" && submitted) {
    return (
      <DiscoverResults
        proposals={proposals}
        dateMode={submitted.dateMode}
        dateRange={submitted.dateRange}
        flexiblePeriod={submitted.flexiblePeriod}
        participants={submitted.participants}
        budget={submitted.budget}
        departureCity={submitted.departureCity}
        onEdit={() => setMode("form")}
      />
    );
  }

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden border-border pb-0 shadow-none">
      <CardHeader className="px-8 pt-8">
        <span aria-hidden className="mb-4 block h-[3px] w-7 bg-voltage" />
        <CardTitle className="font-display text-3xl font-[725] tracking-[-0.01em] text-primary uppercase sm:text-4xl">
          Trova il tuo viaggio
        </CardTitle>
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
                          ? `${format(dateRange.from, "dd MMM")} - ${format(dateRange.to, "dd MMM")}`
                          : "Seleziona date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="max-h-[min(var(--radix-popper-available-height,600px),600px)] w-auto overflow-y-auto p-0"
                      align="start"
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
                    </PopoverContent>
                  </Popover>
                  {dateError && <p className="mt-2 text-sm text-destructive">{dateError}</p>}
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Select
                      value={flexiblePeriod?.month ?? ""}
                      onValueChange={(value) =>
                        setValue("flexiblePeriod.month", value, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger aria-label="Mese del viaggio" className="w-full">
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
                    <Select
                      value={flexiblePeriod?.nights !== undefined ? String(flexiblePeriod.nights) : ""}
                      onValueChange={(value) =>
                        setValue("flexiblePeriod.nights", Number(value), { shouldValidate: true })
                      }
                    >
                      <SelectTrigger aria-label="Numero di notti" className="w-full">
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
                  {(dateError || nightsError) && (
                    <p className="w-full text-sm text-destructive">{dateError ?? nightsError}</p>
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
                <span className="font-normal text-muted-foreground">(facoltativo)</span>
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
                "Trova i miei viaggi"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
