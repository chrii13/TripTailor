"use client";

import type { UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TripFormValues } from "@/lib/schema";

interface ParticipantRowProps {
  index: number;
  register: UseFormRegister<TripFormValues>;
  onRemove: () => void;
  canRemove: boolean;
}

export function ParticipantRow({ index, register, onRemove, canRemove }: ParticipantRowProps) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <Label htmlFor={`participants.${index}.type`}>Tipo</Label>
        <select
          id={`participants.${index}.type`}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          {...register(`participants.${index}.type` as const)}
        >
          <option value="adulto">Adulto</option>
          <option value="bambino">Bambino</option>
        </select>
      </div>
      <div className="w-24">
        <Label htmlFor={`participants.${index}.age`}>Età</Label>
        <Input
          id={`participants.${index}.age`}
          type="number"
          min={0}
          {...register(`participants.${index}.age` as const, { valueAsNumber: true })}
        />
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
