"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Banknote, CalendarDays, CalendarIcon, Clock, Euro, Languages, Users } from "lucide-react";
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

export function ItineraryResult({ tripData, itinerary, weather, countryInfo, onEdit }: ItineraryResultProps) {
  const [open, setOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

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
        <div className="space-y-4 rounded-2xl border-2 border-primary/45 bg-primary/[0.035] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Il tuo viaggio</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tripData.dateRange.from && tripData.dateRange.to && (
              <div className="flex items-start gap-3.5 rounded-lg bg-card/70 px-4 py-3.5 text-sm">
                <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Date
                  </span>
                  <span className="font-medium text-foreground">
                    {format(tripData.dateRange.from, "dd/MM/yyyy")} - {format(tripData.dateRange.to, "dd/MM/yyyy")}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3.5 rounded-lg bg-card/70 px-4 py-3.5 text-sm">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Viaggiatori
                </span>
                <span className="font-medium text-foreground">
                  {tripData.participants.map((p) => `${PARTICIPANT_TYPE_LABELS[p.type]} (${p.age})`).join(", ")}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3.5 rounded-lg bg-card/70 px-4 py-3.5 text-sm">
              <Euro className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Budget</span>
                <span className="font-medium text-foreground">{tripData.budget}€</span>
              </div>
            </div>
          </div>
        </div>

        {countryInfo && (
          <div className="space-y-4 rounded-2xl border-2 border-primary/45 bg-accent/25 p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">Paese di destinazione</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-3.5 rounded-lg bg-card/70 px-4 py-3.5 text-sm">
                <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Valuta</span>
                  <span className="font-medium text-foreground">
                    {countryInfo.currency.name} ({countryInfo.currency.symbol})
                  </span>
                </div>
              </div>
              {countryInfo.languages.length > 0 && (
                <div className="flex items-start gap-3.5 rounded-lg bg-card/70 px-4 py-3.5 text-sm">
                  <Languages className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {countryInfo.languages.length > 1 ? "Lingue" : "Lingua"}
                    </span>
                    <span className="font-medium text-foreground">{countryInfo.languages.join(", ")}</span>
                  </div>
                </div>
              )}
              {countryInfo.timezones.length > 0 && (
                <div className="flex items-start gap-3.5 rounded-lg bg-card/70 px-4 py-3.5 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {countryInfo.timezones.length > 1 ? "Fusi orari" : "Fuso orario"}
                    </span>
                    <span className="font-medium text-foreground">{countryInfo.timezones.join(", ")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {itinerary.days.map((day, dayIndex) => {
            const parsedDate = new Date(day.date);
            const formattedDate = Number.isNaN(parsedDate.getTime())
              ? day.date
              : format(parsedDate, "dd/MM/yyyy");
            const dayWeather = weather?.find((entry) => entry.date === day.date);
            return (
              <div key={dayIndex} className="overflow-hidden rounded-2xl border">
                <div className="flex items-center justify-between gap-3 bg-primary px-4 py-4 text-primary-foreground">
                  <p className="font-display text-2xl">Giorno {dayIndex + 1}</p>
                  <p className="text-base opacity-85">{formattedDate}</p>
                </div>
                <div className="bg-card px-4 pb-1">
                  {dayWeather && (
                    <div className="mt-3 mb-1 flex justify-center">
                      <p className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                        Meteo tipico (media ultimi 5 anni): {dayWeather.tempMaxAvg}°C / {dayWeather.tempMinAvg}°C,
                        Probabilità precipitazioni {dayWeather.precipitationChance}%
                      </p>
                    </div>
                  )}
                  {SLOTS.map(
                    ({ key, label }) =>
                      day[key].length > 0 && (
                        <div key={key} className="border-t py-3 first:border-t-0">
                          <p className="mb-2 text-xs font-bold tracking-wide text-primary uppercase">
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
                                className="w-full cursor-pointer rounded-lg p-2 text-left transition hover:-translate-y-0.5 hover:bg-accent"
                              >
                                <p className="text-sm font-medium">{activity.title}</p>
                                <p className="text-sm text-muted-foreground">{activity.description}</p>
                                <div className="mt-1.5 flex justify-between text-xs font-semibold text-primary">
                                  <span>{activity.suggestedTime}</span>
                                  <span>{activity.estimatedCost}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onEdit} className="flex-1">
            Modifica
          </Button>
          <Button type="button" variant="outline" onClick={handleExportCalendar} className="flex-1">
            <CalendarDays className="h-4 w-4" />
            Esporta calendario
          </Button>
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
