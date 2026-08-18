"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DestinationAutocompleteProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  id: string;
  error?: string;
}

interface Suggestion {
  id: string;
  label: string;
}

const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 3;

export function DestinationAutocomplete<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  id,
  error,
}: DestinationAutocompleteProps<T>) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const cancelPending = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    requestIdRef.current += 1;
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const fetchSuggestions = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const requestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode-autocomplete?q=${encodeURIComponent(query)}`);
        const body = response.ok ? await response.json() : { results: [] };
        if (requestIdRef.current !== requestId) return;
        const results: Suggestion[] = body.results ?? [];
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch {
        if (requestIdRef.current !== requestId) return;
        setSuggestions([]);
        setIsOpen(false);
      }
    }, DEBOUNCE_MS);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <MapPin className="h-4 w-4 text-muted-foreground" />
        {label}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="relative">
            <Input
              id={id}
              placeholder={placeholder}
              autoComplete="off"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={`${id}-suggestions`}
              aria-autocomplete="list"
              aria-activedescendant={highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined}
              ref={field.ref}
              value={field.value ?? ""}
              onChange={(e) => {
                field.onChange(e);
                setHighlightedIndex(-1);
                fetchSuggestions(e.target.value);
              }}
              onBlur={() => {
                field.onBlur();
                cancelPending();
              }}
              onKeyDown={(e) => {
                if (!isOpen || suggestions.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
                } else if (e.key === "Enter" && highlightedIndex >= 0) {
                  e.preventDefault();
                  field.onChange(suggestions[highlightedIndex].label);
                  cancelPending();
                } else if (e.key === "Escape") {
                  cancelPending();
                }
              }}
            />
            {isOpen && suggestions.length > 0 && (
              <ul id={`${id}-suggestions`} role="listbox" className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === highlightedIndex}
                      id={`${id}-option-${index}`}
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        field.onChange(suggestion.label);
                        cancelPending();
                      }}
                      className={cn(
                        "w-full cursor-pointer truncate rounded-sm px-2 py-1.5 text-left text-sm",
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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
