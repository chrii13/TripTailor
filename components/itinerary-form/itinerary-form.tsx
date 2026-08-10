"use client";

import { useState } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
  participants: [{ type: "adulto", age: 30 }],
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
    // zodResolver types the resolver by the schema's input type; since
    // `participants[].age` uses z.coerce.number(), its input type is
    // `unknown`, which doesn't structurally match TripFormValues (output
    // type, age: number). Cast to the output-typed Resolver — safe because
    // zodResolver only ever calls onSubmit with data that already passed
    // validation (i.e. the parsed/output shape).
    resolver: zodResolver(tripFormSchema) as Resolver<TripFormValues>,
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
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Pianifica il tuo viaggio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="destination">Destinazione</Label>
            <Input id="destination" placeholder="Es. Roma, Italia" {...register("destination")} />
            {errors.destination && (
              <p className="text-sm text-red-600">{errors.destination.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Date del viaggio</Label>
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
            <Label>Composizione gruppo</Label>
            {fields.map((field, index) => (
              <ParticipantRow
                key={field.id}
                index={index}
                register={register}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ type: "adulto", age: 30 })}
            >
              + Aggiungi persona
            </Button>
            {errors.participants && !Array.isArray(errors.participants) && (
              <p className="text-sm text-red-600">{errors.participants.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget indicativo: {budget}€</Label>
            <Slider
              id="budget"
              min={0}
              max={10000}
              step={100}
              value={[budget]}
              onValueChange={([value]) => setValue("budget", value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="styleNotes">Note sullo stile di viaggio</Label>
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
