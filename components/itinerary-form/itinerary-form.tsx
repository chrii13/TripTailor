"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Euro, MapPin, Plus, Sparkles, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { tripFormSchema, type TripFormValues } from "@/lib/schema";
import { ParticipantRow } from "./participant-row";
import { TripSummary } from "./trip-summary";

const defaultValues: TripFormValues = {
  destination: "",
  dateRange: { from: undefined, to: undefined },
  participants: [{ type: "adulto", age: undefined }],
  budget: 1000,
  styleNotes: "",
};

export function ItineraryForm() {
  const [mode, setMode] = useState<"form" | "summary">("form");
  const [submittedData, setSubmittedData] = useState<TripFormValues | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "participants",
  });

  const dateRange = watch("dateRange");
  const budget = watch("budget");

  const onSubmit = (data: TripFormValues) => {
    setSubmittedData(data);
    setMode("summary");
  };

  const handleEdit = () => {
    setMode("form");
  };

  if (mode === "summary" && submittedData) {
    return <TripSummary data={submittedData} onEdit={handleEdit} />;
  }

  return (
    <Card className="relative mx-auto w-full max-w-2xl overflow-hidden shadow-[0_20px_50px_-12px_color-mix(in_oklch,var(--primary)_25%,transparent)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
      <CardHeader className="px-8 pt-8">
        <CardTitle className="font-display text-2xl font-semibold">
          Pianifica il tuo viaggio
        </CardTitle>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="destination">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Destinazione
            </Label>
            <Input id="destination" placeholder="Es. Roma, Italia" {...register("destination")} />
            {errors.destination && (
              <p className="text-sm text-red-600">{errors.destination.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              Date del viaggio
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                    : "Seleziona le date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {errors.dateRange && (
              <p className="text-sm text-red-600">{errors.dateRange.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              Chi viaggia
            </Label>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <ParticipantRow
                  key={field.id}
                  index={index}
                  control={control}
                  setValue={setValue}
                  onRemove={() => remove(index)}
                  canRemove={fields.length > 1}
                  error={
                    Array.isArray(errors.participants)
                      ? errors.participants[index]?.age?.message
                      : undefined
                  }
                />
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ type: "adulto", age: undefined })}
            >
              <Plus className="h-4 w-4" />
              Aggiungi viaggiatore
            </Button>
            {errors.participants && !Array.isArray(errors.participants) && (
              <p className="text-sm text-red-600">{errors.participants.message}</p>
            )}
          </div>

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

          <Button type="submit" className="w-full">
            Genera itinerario
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
