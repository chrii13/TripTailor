"use client";

import { X } from "lucide-react";
import {
  Controller,
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type UseFormSetValue,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGE_RANGES, PARTICIPANT_TYPE_LABELS, type ParticipantType } from "@/lib/schema";

interface ParticipantRowProps<T extends FieldValues> {
  index: number;
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  onRemove: () => void;
  canRemove: boolean;
  error?: string;
}

export function ParticipantRow<T extends FieldValues>({
  index,
  control,
  setValue,
  onRemove,
  canRemove,
  error,
}: ParticipantRowProps<T>) {
  const typeName = `participants.${index}.type` as Path<T>;
  const ageName = `participants.${index}.age` as Path<T>;
  const type = useWatch({ control, name: typeName }) as ParticipantType;
  const range = AGE_RANGES[type];
  const ages = Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);

  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor={typeName}>Tipo</Label>
        <Controller
          control={control}
          name={typeName}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                const nextType = value as ParticipantType;
                field.onChange(nextType);
                setValue(ageName, undefined as never);
              }}
            >
              <SelectTrigger id={typeName} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PARTICIPANT_TYPE_LABELS) as ParticipantType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {PARTICIPANT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="w-28 space-y-1.5">
        <Label htmlFor={ageName}>Età</Label>
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
          name={ageName}
          render={({ field }) => (
            <Select
              value={field.value !== undefined ? String(field.value) : ""}
              onValueChange={(value) =>
                setValue(
                  ageName,
                  (value === "" ? undefined : Number(value)) as never,
                  { shouldValidate: true }
                )
              }
            >
              <SelectTrigger id={ageName} className="w-full">
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="space-y-1.5">
        {/*
          Not a <Label>: this is a pure visual spacer to align the remove
          button with the labeled fields in the other two columns. The
          button already carries its own accessible name via aria-label
          below; a bare unassociated <label> here would trip the browser's
          "no label associated with a form field" a11y check on every row.
        */}
        <span
          aria-hidden="true"
          className="invisible flex items-center gap-2 text-sm leading-none font-medium select-none"
        >
          Rimuovi
        </span>
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
