# Gemini Provider Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Claude/Anthropic backend built in Fase 2 with Google Gemini's free tier, keeping the exact same external contract (request/response shapes, the four `ErrorCode` values and their Italian messages) so nothing downstream of the API route needs to change.

**Architecture:** Direct replacement, not a multi-provider abstraction. `app/api/generate-itinerary/route.ts` calls `@google/genai`'s `GoogleGenAI` client instead of `@anthropic-ai/sdk`'s `Anthropic` client. Structured output is requested via `responseJsonSchema` (built from the existing zod schema with zod v4's built-in `z.toJSONSchema()` — no new dependency needed) instead of Anthropic's `zodOutputFormat`/`messages.parse()` helper. Because Gemini's SDK has no equivalent one-call parse-and-validate helper, the route does the JSON parse and zod validation itself (previously handled internally by `messages.parse()`). Error classification moves from Anthropic's per-status exception classes (`instanceof AuthenticationError`, etc.) to Gemini's single `ApiError` class with a `.status` field. The Anthropic-specific code is fully removed from the active codebase; it remains recoverable from git history (Fase 2's commits) per the approved design — no dead code, no feature flag, no dual-provider switch.

**Tech Stack:** Next.js 16 (App Router), TypeScript, zod v4, vitest, `@google/genai` (already installed via `npm install @google/genai`, verified against `node_modules/@google/genai/dist/genai.d.ts` and the compiled `dist/node/index.mjs`).

## Global Constraints

- Model string is exactly `gemini-2.5-flash` — do not substitute another model.
- The four `ErrorCode` values and their exact Italian user-facing messages are unchanged from Fase 2 and must not be touched: `network` → "Non siamo riusciti a contattare il servizio di generazione. Controlla la connessione e riprova."; `config` → "Si è verificato un problema tecnico. Riprova tra poco."; `rate_limit` → "Troppe richieste in questo momento, riprova tra qualche secondo."; `invalid_response` → "Non siamo riusciti a generare l'itinerario. Riprova." (These live in `components/itinerary-form/itinerary-form.tsx`'s `ERROR_MESSAGES` map, which this plan does not touch.)
- `GEMINI_API_KEY` is read server-side only, via `process.env.GEMINI_API_KEY` — never sent to or read by client code. This mirrors exactly how `ANTHROPIC_API_KEY` was handled; no new risk surface.
- No streaming (`generateContent`, not the SDK's streaming variant) — matches the existing no-streaming product decision from Fase 2 (rotating-message loading state instead).
- Timeout is 30 seconds (`30_000` ms) via `config.httpOptions.timeout`, with `config.httpOptions.retryOptions.attempts` capped at `2` (one retry) — the free tier's 10 requests/minute limit makes the SDK's default of 5 attempts risky (a single failed request could burn a fifth of the per-minute quota on retries alone).
- `thinkingConfig.thinkingBudget` is set to `1024` (not left at the model's default of `-1`/automatic) and `maxOutputTokens` to `8192` — `gemini-2.5-flash` has thinking enabled by default, and thinking tokens are deducted from `maxOutputTokens`, so an unbounded thinking budget risks truncating or emptying the actual JSON response on longer (up to the app's 14-day cap) itineraries. This is the same class of issue Fase 2's final review found and fixed for Claude Sonnet 5's adaptive thinking.
- Everything outside the route and the error classifier is out of scope: `lib/schema.ts`, `lib/generate-itinerary-request.ts`, `lib/itinerary-schema.ts`, `lib/itinerary-prompt.ts`, and every client component are provider-agnostic and stay exactly as they are.
- No automated test may call the real Gemini API (would consume free-tier quota and be non-deterministic) — only the error classifier and the route's request-validation branch are unit-tested, matching the Fase 2 precedent exactly.

---

### Task 1: Swap Anthropic for Gemini in the generation backend

**Files:**
- Modify: `package.json` (remove `@anthropic-ai/sdk`; `@google/genai` is already present)
- Modify: `lib/generate-itinerary-errors.ts`
- Modify: `lib/generate-itinerary-errors.test.ts`
- Modify: `app/api/generate-itinerary/route.ts`
- Modify: `app/api/generate-itinerary/route.test.ts`
- Modify: `.env.local` (rename `ANTHROPIC_API_KEY` to `GEMINI_API_KEY`)
- Modify: `.env.local.example` (same rename)

**Interfaces:**
- Consumes: `generateItineraryRequestSchema`/`GenerateItineraryRequest` from `lib/generate-itinerary-request.ts` (unchanged), `itineraryResponseSchema`/`ItineraryResponse` from `lib/itinerary-schema.ts` (unchanged), `buildItineraryPrompt` from `lib/itinerary-prompt.ts` (unchanged), `GoogleGenAI` and `ApiError` from `@google/genai` (verified exports — both are available as named exports from the package root: `import { GoogleGenAI, ApiError } from "@google/genai";`).
- Produces: `lib/generate-itinerary-errors.ts` now exports `type ErrorCode` (unchanged shape: `"network" | "config" | "rate_limit" | "invalid_response"`) and `classifyGenerationError(error: unknown): ErrorCode` (renamed from `classifyAnthropicError` — no longer Anthropic-specific). `components/itinerary-form/itinerary-form.tsx` only imports `type ErrorCode` from this file (via `import type`), so renaming the function does not affect it — confirm this with a repo-wide search in Step 8 before considering the task done, since a stale import would only show up as a build failure, not a test failure.

This is a single task, not split further, because `route.ts` and `lib/generate-itinerary-errors.ts` are consumed together — a version of the repo with one rewritten and not the other does not build (the route imports the classifier by name). Splitting them would leave an intermediate broken state with nothing correct to review independently.

- [ ] **Step 1: Write the failing test for the new error classifier**

Replace the full contents of `lib/generate-itinerary-errors.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { ApiError } from "@google/genai";
import { classifyGenerationError } from "./generate-itinerary-errors";

describe("classifyGenerationError", () => {
  it("classifica un errore di autenticazione (401) come 'config'", () => {
    const error = new ApiError({ message: "Invalid API key", status: 401 });
    expect(classifyGenerationError(error)).toBe("config");
  });

  it("classifica un errore di permessi (403) come 'config'", () => {
    const error = new ApiError({ message: "Forbidden", status: 403 });
    expect(classifyGenerationError(error)).toBe("config");
  });

  it("classifica un rate limit (429) come 'rate_limit'", () => {
    const error = new ApiError({ message: "Rate limited", status: 429 });
    expect(classifyGenerationError(error)).toBe("rate_limit");
  });

  it("classifica un errore 5xx come 'network'", () => {
    const error = new ApiError({ message: "Server error", status: 500 });
    expect(classifyGenerationError(error)).toBe("network");
  });

  it("classifica un errore 400 generico come 'invalid_response'", () => {
    const error = new ApiError({ message: "Bad request", status: 400 });
    expect(classifyGenerationError(error)).toBe("invalid_response");
  });

  it("classifica un errore non-ApiError (fallimento di rete prima di una risposta HTTP) come 'network'", () => {
    expect(classifyGenerationError(new TypeError("fetch failed"))).toBe("network");
  });

  it("classifica un errore generico non riconosciuto come 'network'", () => {
    expect(classifyGenerationError(new Error("qualcosa di inatteso"))).toBe("network");
  });
});
```

Note on the last two tests: unlike Anthropic's `ApiError`-style hierarchy (which had a distinct connection-error class), Gemini's SDK only constructs `ApiError` for responses that actually came back from the server with an HTTP status — a genuine network failure (DNS failure, connection reset, our own 30s timeout firing) never produces an `ApiError`, it's a raw `TypeError`/abort error instead. Since this function's only caller (`route.ts`) wraps just the `generateContent` call itself, a non-`ApiError` reaching it is almost always a transport-level failure, not an application bug — so `"network"` is the correct fallback here (this is a deliberate improvement on Fase 2's Anthropic version, which used `"invalid_response"` as its fallback; that was a reasonable choice there too, but `"network"` is the better fit for what actually reaches this function in this SDK).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `classify-itinerary-errors.test.ts` (actually `lib/generate-itinerary-errors.test.ts`) fails because `classifyGenerationError` doesn't exist yet in `lib/generate-itinerary-errors.ts` (which still exports `classifyAnthropicError`).

- [ ] **Step 3: Replace `lib/generate-itinerary-errors.ts`**

```ts
import { ApiError } from "@google/genai";

export type ErrorCode = "network" | "config" | "rate_limit" | "invalid_response";

export function classifyGenerationError(error: unknown): ErrorCode {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "config";
    }
    if (error.status === 429) {
      return "rate_limit";
    }
    if (error.status >= 500) {
      return "network";
    }
    return "invalid_response";
  }
  return "network";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for `lib/generate-itinerary-errors.test.ts` (7 tests). The suite as a whole will still show failures at this point — `app/api/generate-itinerary/route.ts` and its test still reference the old Anthropic code and `classifyAnthropicError`, which no longer exists. That's expected; Steps 5-9 fix this.

- [ ] **Step 5: Write the failing/updated route test**

Replace the full contents of `app/api/generate-itinerary/route.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/generate-itinerary", () => {
  it("rifiuta un corpo non valido con 400 prima di chiamare Gemini", async () => {
    const request = new Request("http://localhost/api/generate-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: "" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_response");
  });

  it("rifiuta un corpo JSON malformato con 400 senza lanciare un'eccezione non gestita", async () => {
    const request = new Request("http://localhost/api/generate-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_response");
  });

  it("restituisce l'errore 'config' quando GEMINI_API_KEY non è configurata", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "";

    try {
      const request = new Request("http://localhost/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: "Roma",
          dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
          participants: [{ type: "adulto", age: 35 }],
          budget: 1000,
          styleNotes: "",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.error).toBe("config");
    } finally {
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });
});
```

This is the same three tests as Fase 2's version, with `ANTHROPIC_API_KEY` renamed to `GEMINI_API_KEY` and one Italian string updated ("prima di chiamare Gemini"). None of them call the real API — the first two never get past request validation, and the third fails before `GoogleGenAI` is ever constructed (same pattern as the Anthropic version's equivalent test).

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `route.test.ts` still imports `./route`, which still contains the old `Anthropic`-based implementation and references `ANTHROPIC_API_KEY`, so the third test (expecting `GEMINI_API_KEY` to gate the `config` response) fails.

- [ ] **Step 7: Replace `app/api/generate-itinerary/route.ts`**

```ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { generateItineraryRequestSchema } from "@/lib/generate-itinerary-request";
import { itineraryResponseSchema } from "@/lib/itinerary-schema";
import { buildItineraryPrompt } from "@/lib/itinerary-prompt";
import { classifyGenerationError } from "@/lib/generate-itinerary-errors";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  const parsedRequest = generateItineraryRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("Generazione itinerario: GEMINI_API_KEY non configurata");
    return NextResponse.json({ error: "config" }, { status: 502 });
  }

  const prompt = buildItineraryPrompt(parsedRequest.data);
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  let responseText: string | undefined;
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(itineraryResponseSchema),
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 1024 },
        httpOptions: {
          timeout: 30_000,
          retryOptions: { attempts: 2 },
        },
      },
    });
    responseText = response.text;
  } catch (error) {
    const code = classifyGenerationError(error);
    console.error(`Generazione itinerario fallita (${code}):`, error);
    const status = code === "rate_limit" ? 429 : 502;
    return NextResponse.json({ error: code }, { status });
  }

  if (!responseText) {
    console.error("Generazione itinerario: risposta vuota da Gemini");
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  let parsedItinerary: unknown;
  try {
    parsedItinerary = JSON.parse(responseText);
  } catch (error) {
    console.error("Generazione itinerario: JSON non valido nella risposta di Gemini", error, responseText);
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  const parsedResult = itineraryResponseSchema.safeParse(parsedItinerary);

  if (!parsedResult.success) {
    console.error("Generazione itinerario: risposta non conforme allo schema atteso", parsedResult.error);
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  return NextResponse.json({ itinerary: parsedResult.data });
}
```

Note the structural difference from the Anthropic version this replaces: Anthropic's `client.messages.parse()` did JSON parsing and zod validation internally (`response.parsed_output` was already a validated, typed object, or `null` on failure). Gemini's `generateContent()` has no such helper — `response.text` is a raw string, so this route now does the `JSON.parse` and `itineraryResponseSchema.safeParse` steps itself, each with its own `invalid_response` failure path. This is intentional, not a workaround; do not try to find a Gemini equivalent of `messages.parse()` that doesn't exist.

- [ ] **Step 8: Remove the Anthropic dependency and confirm no stale references remain**

Edit `package.json` to remove this line from `dependencies` (keep `@google/genai`, which is already present):

```json
    "@anthropic-ai/sdk": "^0.116.0",
```

Run: `npm install` (prunes `@anthropic-ai/sdk` from `node_modules` and updates `package-lock.json`)

Then search the repository for any remaining reference to confirm the swap is complete:

Run: `grep -rn "anthropic\|Anthropic\|ANTHROPIC" --include="*.ts" --include="*.tsx" --include="*.json" -i --exclude-dir=node_modules --exclude-dir=.next .`

Expected: no matches in `app/`, `lib/`, `components/`, `package.json`, `.env.local`, or `.env.local.example`. (Matches inside `docs/superpowers/specs/` or `docs/superpowers/plans/` for the Fase 2 and Fase 2-swap design docs are fine and expected — those are historical/planning records, not code.)

- [ ] **Step 9: Rename the environment variable**

In `.env.local`, change:
```
ANTHROPIC_API_KEY=
```
to:
```
GEMINI_API_KEY=
```

Make the identical change in `.env.local.example`.

- [ ] **Step 10: Run the full suite, typecheck, and build**

Run: `npm test`
Expected: PASS, full suite green (should be 45 tests: the same count as before, since this task changes the content of 2 test files but not the count of tests in them — 7 in `generate-itinerary-errors.test.ts`, 3 in `route.test.ts`, unchanged elsewhere).

Run: `npx tsc --noEmit`
Expected: no errors. Pay attention here in particular — this is what will catch a stale `Anthropic`-typed reference if Step 8's grep missed something inside a `.ts`/`.tsx` file that doesn't match the grep pattern for some reason.

Run: `npm run build`
Expected: build succeeds, `/api/generate-itinerary` still listed as a dynamic route.

- [ ] **Step 11: Manual verification**

Run: `npm run dev`, open the app in a browser, fill in a valid trip, and submit.

Since `.env.local`'s `GEMINI_API_KEY` is empty at this point (nobody has added a real key yet), confirm: the loading state appears briefly, then the form returns with the banner "Si è verificato un problema tecnico. Riprova tra poco." (the `config` message) — this exercises the `!process.env.GEMINI_API_KEY` guard added in Step 7, the same way Fase 2's equivalent check was manually verified. This confirms the swap didn't break the graceful-failure path.

If a real `GEMINI_API_KEY` has been obtained by this point (a free key from Google AI Studio, no credit card required), also verify the success path: submit a valid trip and confirm a real itinerary renders via `ItineraryResult`, exactly as Fase 2 designed it. If not available yet, skip this and note it as deferred — it is not blocking for this task, matching how Fase 2 handled the same situation with Anthropic.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json lib/generate-itinerary-errors.ts lib/generate-itinerary-errors.test.ts app/api/generate-itinerary/route.ts app/api/generate-itinerary/route.test.ts .env.local .env.local.example
git commit -m "feat: replace Anthropic/Claude backend with Gemini's free tier"
```
