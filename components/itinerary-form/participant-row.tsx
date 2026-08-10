"use client";

import { Controller, useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGE_RANGES, type ParticipantType, type TripFormValues } from "@/lib/schema";

interface ParticipantRowProps {
  index: number;
  control: Control<TripFormValues>;
  setValue: UseFormSetValue<TripFormValues>;
  onRemove: () => void;
  canRemove: boolean;
  error?: string;
}

const TYPE_LABELS: Record<ParticipantType, string> = {
  bambino: "Bambino",
  ragazzo: "Ragazzo",
  adulto: "Adulto",
};

export function ParticipantRow({
  index,
  control,
  setValue,
  onRemove,
  canRemove,
  error,
}: ParticipantRowProps) {
  const type = useWatch({ control, name: `participants.${index}.type` });
  const range = AGE_RANGES[type];
  const ages = Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <Label htmlFor={`participants.${index}.type`}>Tipo</Label>
        <Controller
          control={control}
          name={`participants.${index}.type`}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                const nextType = value as ParticipantType;
                field.onChange(nextType);
                setValue(`participants.${index}.age`, AGE_RANGES[nextType].default, {
                  shouldValidate: true,
                });
              }}
            >
              <SelectTrigger id={`participants.${index}.type`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as ParticipantType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="w-28">
        <Label htmlFor={`participants.${index}.age`}>Età</Label>
        {/*
          Keyed by `type`: the set of valid ages changes with the type, and
          Radix Select can race between registering the new option list and
          picking up a value set programmatically in the same tick (it clears
          the value to "" if it doesn't yet see a matching item). Remounting
          fresh on type change sidesteps the race entirely.
        */}
        <Controller
          key={type}
          control={control}
          name={`participants.${index}.age`}
          render={({ field }) => (
            <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
              <SelectTrigger id={`participants.${index}.age`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {ages.map((age) => (
                  <SelectItem key={age} value={String(age)}>
                    {age}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="Rimuovi partecipante"
      >
        ×
      </Button>
    </div>
  );
}
