# Destination Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the plain "Destinazione" text field into a live autocomplete: suggestions appear as the user types, backed by a server-side proxy to LocationIQ so the API key never reaches the client.

**Architecture:** A new GET route (`app/api/geocode-autocomplete/route.ts`) proxies LocationIQ's Autocomplete API, returning a minimal `{ results: Array<{ id, label }> }` shape — never LocationIQ's raw response (coordinates, OSM classification, structured address). A new client component (`components/itinerary-form/destination-autocomplete.tsx`) replaces the current plain `<Input>` for the destination field: it debounces keystrokes, queries the new route, and renders a hand-written dropdown (no new dependency — matches how `components/ui/dialog.tsx` was hand-written rather than pulled from a component library) with mouse and keyboard selection. The feature degrades silently to a plain text field on any failure (network, missing key, rate limit) — it's an enhancement, not a requirement, so it never shows an error banner the way itinerary generation does.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, react-hook-form (`Controller`), vitest. No new npm dependency.

## Global Constraints

- The new route is **GET**, not POST — it's a read/search operation, unlike `generate-itinerary`.
- `LOCATIONIQ_API_KEY` is read server-side only, via `process.env.LOCATIONIQ_API_KEY` — never sent to or read by client code.
- A query under 3 characters (after trimming) never reaches LocationIQ — the route returns `{ results: [] }` immediately.
- Any failure reaching LocationIQ (missing key, network error, non-OK response) results in `{ results: [] }`, logged server-side, status 502 — the client never surfaces an error UI for this; it just shows no suggestions and keeps working as a plain text field.
- The route's JSON contract to the client is exactly `{ results: Array<{ id: string; label: string }> }` — no other LocationIQ fields (coordinates, OSM class/type, structured address, licence) are ever forwarded.
- No automated test may call the real LocationIQ API — only the route's short-query validation branch is unit-tested (same pattern as `generate-itinerary`'s pre-network-call branches).
- The destination field's existing validation (`z.string().trim().min(1, ...)` in `lib/schema.ts`) does not change — a value typed freely without ever selecting a suggestion is still valid.

---

### Task 1: Autocomplete proxy route

**Files:**
- Create: `app/api/geocode-autocomplete/route.ts`
- Create: `app/api/geocode-autocomplete/route.test.ts`
- Modify: `.env.local` (add `LOCATIONIQ_API_KEY=`)
- Modify: `.env.local.example` (same)
- Modify: `CLAUDE.md` (Tech Stack line and Required Environment Variables list)

**Interfaces:**
- Consumes: nothing from elsewhere in the codebase — this route is self-contained (no zod schema needed for the single `q` query param, per the design spec's explicit call to keep this simple).
- Produces: `GET /api/geocode-autocomplete?q=<string>` → `{ results: Array<{ id: string; label: string }> }`. Task 2's `destination-autocomplete.tsx` fetches this endpoint and reads exactly this shape — field names (`results`, `id`, `label`) must match exactly.

- [ ] **Step 1: Write the failing test**

Create `app/api/geocode-autocomplete/route.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/geocode-autocomplete", () => {
  it("restituisce un array vuoto senza chiamare LocationIQ quando la query è assente", async () => {
    const request = new Request("http://localhost/api/geocode-autocomplete");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([]);
  });

  it("restituisce un array vuoto senza chiamare LocationIQ quando la query è troppo corta", async () => {
    const request = new Request("http://localhost/api/geocode-autocomplete?q=ro");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([]);
  });
});
```

Both cases never reach the 3-character threshold, so neither test makes a real network call — no `LOCATIONIQ_API_KEY` is needed for this test to pass.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module './route'" (the file doesn't exist yet).

- [ ] **Step 3: Create `app/api/geocode-autocomplete/route.ts`**

```ts
import { NextResponse } from "next/server";

const MIN_QUERY_LENGTH = 3;

interface LocationIqResult {
  place_id: string;
  display_name: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.LOCATIONIQ_API_KEY;

  if (!apiKey) {
    console.error("Autocompletamento destinazione: LOCATIONIQ_API_KEY non configurata");
    return NextResponse.json({ results: [] }, { status: 502 });
  }

  const url = new URL("https://api.locationiq.com/v1/autocomplete");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      console.error(`Autocompletamento destinazione: LocationIQ ha risposto ${response.status}`);
      return NextResponse.json({ results: [] }, { status: 502 });
    }

    const data: LocationIqResult[] = await response.json();
    const results = data.map((item) => ({ id: item.place_id, label: item.display_name }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Autocompletamento destinazione: chiamata a LocationIQ fallita", error);
    return NextResponse.json({ results: [] }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — both tests in `app/api/geocode-autocomplete/route.test.ts` pass.

- [ ] **Step 5: Add the environment variable**

In `.env.local`, add a new line:
```
LOCATIONIQ_API_KEY=
```

Make the identical addition in `.env.local.example`. Add it after the existing `GEMINI_API_KEY=` line in both files, don't reorder or touch the other lines.

- [ ] **Step 6: Update `CLAUDE.md`**

Read the file first to find the exact current wording of the "Tech Stack" bullet and the "Required Environment Variables" list before editing precisely — don't rewrite unrelated content.

In the "Tech Stack" bullet (under Section 1), after the sentence about Google Gemini, add a mention of LocationIQ for destination autocomplete, e.g. append: `Autocompletamento destinazione: LocationIQ (\`LOCATIONIQ_API_KEY\`).`

In "Required Environment Variables", add a new line:
```
- `LOCATIONIQ_API_KEY` — LocationIQ (autocompletamento destinazione)
```
placed after the `GEMINI_API_KEY` line.

- [ ] **Step 7: Run the full suite, typecheck, and build**

Run: `npm test`
Expected: PASS, full suite green (55 tests: the existing 53 plus the 2 new ones in this task).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds, `/api/geocode-autocomplete` listed as a dynamic route alongside `/api/generate-itinerary`.

- [ ] **Step 8: Commit**

```bash
git add app/api/geocode-autocomplete/route.ts app/api/geocode-autocomplete/route.test.ts .env.local .env.local.example CLAUDE.md
git commit -m "feat: add LocationIQ-backed destination autocomplete proxy route"
```

---

### Task 2: Autocomplete UI

**Files:**
- Create: `components/itinerary-form/destination-autocomplete.tsx`
- Modify: `components/itinerary-form/itinerary-form.tsx`

**Interfaces:**
- Consumes: `GET /api/geocode-autocomplete?q=...` → `{ results: Array<{ id: string; label: string }> }` (Task 1). `Control<TripFormValues>` from `react-hook-form` (passed down from `itinerary-form.tsx`, same pattern already used for `ParticipantRow`).
- Produces: `DestinationAutocomplete` component with props `{ control: Control<TripFormValues>; error?: string }`, rendered in place of the old destination `<Input>` block in `itinerary-form.tsx`.

- [ ] **Step 1: Create `components/itinerary-form/destination-autocomplete.tsx`**

```tsx
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
```

Note on the `onMouseDown`/`preventDefault()` on the suggestion button: `mousedown` fires before the input's `blur`, so calling `preventDefault()` there stops the input from losing focus (and `isOpen` from being set to `false` by `onBlur`) before the click has a chance to register. Using `onClick` instead would break selection — the list would close on blur before the click event fires. Keep this exactly as written.

- [ ] **Step 2: Integrate into `components/itinerary-form/itinerary-form.tsx`**

Add the import (alongside the existing `ParticipantRow`/`ItineraryResult` imports):

```ts
import { DestinationAutocomplete } from "./destination-autocomplete";
```

Remove `MapPin` from the `lucide-react` import line (it moves into `destination-autocomplete.tsx` and is no longer used directly in this file) — change:

```ts
import { CalendarIcon, Euro, Loader2, MapPin, Plus, Sparkles, Users } from "lucide-react";
```

to:

```ts
import { CalendarIcon, Euro, Loader2, Plus, Sparkles, Users } from "lucide-react";
```

Replace this block (the current destination field):

```tsx
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
```

with:

```tsx
            <DestinationAutocomplete control={control} error={errors.destination?.message} />
```

Do not remove `register` from the `useForm()` destructure — it's still used for the `styleNotes` field later in the same file. Do not touch anything else in this file.

- [ ] **Step 3: Run the full suite, lint, typecheck, and build**

Run: `npm test`
Expected: PASS, full suite green (same 55 as the end of Task 1 — this task adds no new automated tests, consistent with the project's established pattern of manually verifying interactive UI).

Run: `npm run lint`
Expected: no new errors (confirm `MapPin` isn't flagged as an unused import anywhere — it should be fully removed from `itinerary-form.tsx` and present only in `destination-autocomplete.tsx`).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual browser verification**

Run: `npm run dev`, open the app.

Check `.env.local` for `LOCATIONIQ_API_KEY`:

**If a real key is present:** type a destination (e.g., "Rom" — 3+ characters) into the field and confirm: a dropdown of real place suggestions appears after a brief pause (debounce), arrow keys move the highlight, Enter selects the highlighted suggestion and fills the field, clicking a suggestion with the mouse also selects it and closes the dropdown, and Escape closes the dropdown without changing the field's value. Confirm the field still accepts free-typed text that was never selected from the list (submitting the form with such a value should work exactly as before — this part of the app didn't change).

**If no real key is present yet (still empty in `.env.local`):** confirm the field behaves as a plain text input — typing 3+ characters triggers a request that fails gracefully (check the Network tab: a 502 from `/api/geocode-autocomplete`, no dropdown appears, no error message shown to the user, no console-visible crash), and the field remains fully usable and submits normally. Note this as deferred in the report — real-suggestion verification will need to happen once a key is added, same pattern as this project's other external-API integrations.

- [ ] **Step 5: Commit**

```bash
git add components/itinerary-form/destination-autocomplete.tsx components/itinerary-form/itinerary-form.tsx
git commit -m "feat: wire destination field to live autocomplete suggestions"
```
