"use client";

import { useState } from "react";
import { format } from "date-fns";
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

interface ItineraryResultProps {
  tripData: TripFormValues;
  itinerary: ItineraryResponse;
  onEdit: () => void;
}

const SLOTS = [
  { key: "mattina", label: "Mattina" },
  { key: "pomeriggio", label: "Pomeriggio" },
  { key: "sera", label: "Sera" },
] as const;

export function ItineraryResult({ tripData, itinerary, onEdit }: ItineraryResultProps) {
  const [open, setOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  return (
    <Card className="relative mx-auto w-full max-w-2xl overflow-hidden shadow-[0_20px_50px_-12px_color-mix(in_oklch,var(--primary)_25%,transparent)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
      <CardHeader className="px-8 pt-8">
        <CardTitle className="font-display text-2xl font-semibold">
          Il tuo viaggio a {tripData.destination}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border bg-muted/50 px-4 py-3 text-sm">
          {tripData.dateRange.from && tripData.dateRange.to && (
            <span>
              <span className="text-muted-foreground">Date: </span>
              {format(tripData.dateRange.from, "dd/MM/yyyy")} - {format(tripData.dateRange.to, "dd/MM/yyyy")}
            </span>
          )}
          <span>
            <span className="text-muted-foreground">Viaggiatori: </span>
            {tripData.participants.map((p) => `${PARTICIPANT_TYPE_LABELS[p.type]} (${p.age})`).join(", ")}
          </span>
          <span>
            <span className="text-muted-foreground">Budget: </span>
            {tripData.budget}€
          </span>
        </div>

        <div className="space-y-6">
          {itinerary.days.map((day, dayIndex) => {
            const parsedDate = new Date(day.date);
            const formattedDate = Number.isNaN(parsedDate.getTime())
              ? day.date
              : format(parsedDate, "dd/MM/yyyy");
            return (
              <div key={dayIndex} className="overflow-hidden rounded-2xl border">
                <div className="flex items-center justify-between gap-3 bg-primary px-4 py-4 text-primary-foreground">
                  <p className="font-display text-2xl">Giorno {dayIndex + 1}</p>
                  <p className="text-base opacity-85">{formattedDate}</p>
                </div>
                <div className="bg-card px-4 pb-1">
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

        <Button type="button" variant="outline" onClick={onEdit} className="w-full">
          Modifica
        </Button>
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
