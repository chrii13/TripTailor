"use client";

import { X } from "lucide-react";
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
    <div className="flex items-start gap-3">
      <div className="flex-1 space-y-1.5">
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
                setValue(`participants.${index}.age`, undefined, {
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
      <div className="w-28 space-y-1.5">
        <Label htmlFor={`participants.${index}.age`}>Età</Label>
        {/*
          Keyed by `type`: the set of valid ages changes with the type, and
          Radix Select can race between registering a new option list and a
          value set programmatically in the same tick. Remounting fresh on
          type change sidesteps that race entirely (cheap insurance — age
          always resets to "unselected" here, which is its own safe state,
          but a fresh mount keeps it that way even if that ever changes).
        */}
        <Controller
          key={type}
          control={control}
          name={`participants.${index}.age`}
          render={({ field }) => (
            <Select
              value={field.value !== undefined ? String(field.value) : ""}
              onValueChange={(value) =>
                setValue(
                  `participants.${index}.age`,
                  value === "" ? undefined : Number(value),
                  { shouldValidate: true }
                )
              }
            >
              <SelectTrigger id={`participants.${index}.age`} className="w-full">
                <SelectValue placeholder="–" />
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
      <div className="space-y-1.5">
        <Label className="invisible">Rimuovi</Label>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Rimuovi viaggiatore"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
