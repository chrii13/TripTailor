"use client";

import { useState } from "react";
import { format } from "date-fns";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Banknote,
  CalendarDays,
  Clock,
  Droplets,
  Languages,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function TripPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-primary px-5 py-4 text-primary-foreground sm:px-6 sm:py-5">
      <span className="block h-[3px] w-7 bg-voltage" />
      <p className="mt-3 text-[10px] font-semibold tracking-[0.18em] text-primary-foreground/60 uppercase">
        Il tuo viaggio
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">{children}</dl>
    </div>
  );
}

function TripStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium tracking-[0.14em] text-primary-foreground/60 uppercase">
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
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
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
      <dt className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        <Icon className="size-3 shrink-0" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-primary">{value}</dd>
    </div>
  );
}

export function ItineraryResult({ tripData, itinerary, weather, countryInfo, onEdit }: ItineraryResultProps) {
  const [open, setOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const reduceMotion = useReducedMotion();

  const handleExportCalendar = () => {
    const icsContent = buildItineraryIcs(tripData, itinerary);
    const sanitizedDestination = tripData.destination
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `itinerario-${sanitizedDestination}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden border-border shadow-none">
      <CardHeader className="px-8 pt-10 pb-8">
        <CardTitle className="font-display text-3xl leading-[0.95] font-[725] tracking-[-0.01em] text-balance text-primary uppercase sm:text-5xl">
          Si parte per {tripData.destination}
        </CardTitle>
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
            const parsedDate = new Date(day.date);
            const formattedDate = Number.isNaN(parsedDate.getTime())
              ? day.date
              : format(parsedDate, "dd/MM/yyyy");
            const dayWeather = weather?.find((entry) => entry.date === day.date);
            return (
              <motion.div
                key={dayIndex}
                className="overflow-hidden rounded-xl border border-border"
                variants={reduceMotion ? undefined : dayCard}
              >
                <div className="flex items-baseline justify-between gap-3 bg-primary px-4 py-3.5 text-primary-foreground">
                  <p className="font-display text-xl font-[725] tracking-[-0.005em] uppercase">
                    Giorno {dayIndex + 1}
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
                    <span className="ml-auto text-[11px] text-muted-foreground">
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
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="flex flex-wrap items-center gap-6">
          <Button type="button" onClick={handleExportCalendar} className="gap-2">
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
                  <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    Orario
                  </dt>
                  <dd className="mt-1 font-display text-lg font-[725] tabular-nums text-primary">
                    {selectedActivity.suggestedTime}
                  </dd>
                </div>
                <div className="bg-card px-4 py-3">
                  <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    Costo
                  </dt>
                  <dd className="mt-1 font-display text-lg font-[725] text-primary">
                    {selectedActivity.estimatedCost}
                  </dd>
                </div>
                {selectedActivity.openingHours && (
                  <div className="col-span-2 bg-card px-4 py-3">
                    <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
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
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Cosa è
                  </p>
                  <p className="mt-1.5">{selectedActivity.details.about}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Come arrivarci
                  </p>
                  <p className="mt-1.5">{selectedActivity.details.gettingThere}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
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
