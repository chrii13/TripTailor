"use client";

import { useState } from "react";
import { format } from "date-fns";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Banknote,
  CalendarDays,
  CalendarIcon,
  Clock,
  Euro,
  Languages,
  Users,
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

const dayList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const dayCard: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

function InfoPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <p className="border-b border-border bg-secondary px-4 py-2.5 text-xs font-semibold tracking-[0.12em] text-primary uppercase">
        {label}
      </p>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {children}
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">
          {label}
        </span>
        <span className="font-medium text-primary">{value}</span>
      </div>
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
        <CardTitle className="font-display text-3xl leading-[0.95] font-black tracking-[-0.03em] text-balance text-primary uppercase sm:text-5xl">
          Si parte per {tripData.destination}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <InfoPanel label="Il tuo viaggio">
          {tripData.dateRange.from && tripData.dateRange.to && (
            <InfoItem
              icon={CalendarIcon}
              label="Date"
              value={`${format(tripData.dateRange.from, "dd/MM/yyyy")} – ${format(tripData.dateRange.to, "dd/MM/yyyy")}`}
            />
          )}
          <InfoItem
            icon={Users}
            label="Viaggiatori"
            value={tripData.participants
              .map((p) => `${PARTICIPANT_TYPE_LABELS[p.type]} (${p.age})`)
              .join(", ")}
          />
          <InfoItem icon={Euro} label="Budget" value={`${tripData.budget}€`} />
        </InfoPanel>

        {countryInfo && (
          <InfoPanel label="Paese di destinazione">
            <InfoItem
              icon={Banknote}
              label="Valuta"
              value={`${countryInfo.currency.name} (${countryInfo.currency.symbol})`}
            />
            {countryInfo.languages.length > 0 && (
              <InfoItem
                icon={Languages}
                label={countryInfo.languages.length > 1 ? "Lingue" : "Lingua"}
                value={countryInfo.languages.join(", ")}
              />
            )}
            {countryInfo.timezones.length > 0 && (
              <InfoItem
                icon={Clock}
                label={countryInfo.timezones.length > 1 ? "Fusi orari" : "Fuso orario"}
                value={countryInfo.timezones.join(", ")}
              />
            )}
          </InfoPanel>
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
                  <p className="font-display text-xl font-black tracking-[-0.02em] uppercase">
                    Giorno {dayIndex + 1}
                  </p>
                  <p className="text-sm tabular-nums opacity-75">{formattedDate}</p>
                </div>
                {dayWeather && (
                  <p className="border-b border-border bg-secondary px-4 py-2.5 text-xs text-muted-foreground">
                    Media degli ultimi 5 anni: {dayWeather.tempMaxAvg}°C / {dayWeather.tempMinAvg}°C,
                    pioggia {dayWeather.precipitationChance}%
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
          <button
            type="button"
            onClick={onEdit}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Modifica il viaggio
          </button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {selectedActivity && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedActivity.title}</DialogTitle>
                <DialogDescription>
                  {selectedActivity.suggestedTime} · {selectedActivity.estimatedCost}
                  {selectedActivity.openingHours ? ` · ${selectedActivity.openingHours}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-foreground">Cosa è</p>
                  <p className="text-muted-foreground">{selectedActivity.details.about}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Come arrivarci</p>
                  <p className="text-muted-foreground">{selectedActivity.details.gettingThere}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Consigli</p>
                  <p className="text-muted-foreground">{selectedActivity.details.tips}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
