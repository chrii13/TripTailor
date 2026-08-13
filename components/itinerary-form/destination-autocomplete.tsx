"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, type Control } from "react-hook-form";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TripFormValues } from "@/lib/schema";

interface DestinationAutocompleteProps {
  control: Control<TripFormValues>;
  error?: string;
}

interface Suggestion {
  id: string;
  label: string;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

export function DestinationAutocomplete({ control, error }: DestinationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchSuggestions = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode-autocomplete?q=${encodeURIComponent(query)}`);
        const body = response.ok ? await response.json() : { results: [] };
        const results: Suggestion[] = body.results ?? [];
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch {
        setSuggestions([]);
        setIsOpen(false);
      }
    }, DEBOUNCE_MS);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="destination">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        Destinazione
      </Label>
      <Controller
        control={control}
        name="destination"
        render={({ field }) => (
          <div className="relative">
            <Input
              id="destination"
              placeholder="Es. Roma, Italia"
              autoComplete="off"
              value={field.value}
              onChange={(e) => {
                field.onChange(e);
                setHighlightedIndex(-1);
                fetchSuggestions(e.target.value);
              }}
              onBlur={() => {
                field.onBlur();
                setIsOpen(false);
              }}
              onKeyDown={(e) => {
                if (!isOpen || suggestions.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                } else if (e.key === "Enter" && highlightedIndex >= 0) {
                  e.preventDefault();
                  field.onChange(suggestions[highlightedIndex].label);
                  setIsOpen(false);
                  setSuggestions([]);
                } else if (e.key === "Escape") {
                  setIsOpen(false);
                }
              }}
            />
            {isOpen && suggestions.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        field.onChange(suggestion.label);
                        setIsOpen(false);
                        setSuggestions([]);
                      }}
                      className={cn(
                        "w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm",
                        index === highlightedIndex ? "bg-accent" : "hover:bg-accent"
                      )}
                    >
                      {suggestion.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
