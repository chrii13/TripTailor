import { z } from "zod";
import { calendarDateSchema, toCalendarDate } from "./calendar-date";
import { AGE_RANGES, type Participant } from "./schema";

export type CreaPrefill = {
  destination?: string;
  from?: Date;
  to?: Date;
  budget?: number;
  participants?: Participant[];
};

export type CreaSearchParams = {
  destination?: string;
  from?: string;
  to?: string;
  budget?: string;
  p?: string;
};

const PARTICIPANT_TYPES = ["bambino", "ragazzo", "adulto"] as const;

const destinationSchema = z.string().trim().min(1).optional();

const dateStringSchema = calendarDateSchema.optional();

const budgetSchema = z
  .string()
  .regex(/^\d+$/, "Budget must be decimal digits only")
  .transform((str) => Number(str))
  .refine((n) => n >= 0 && n <= 1_000_000, "Budget must be 0 to 1,000,000")
  .optional();

const participantChunkSchema = z
  .object({
    type: z.enum(PARTICIPANT_TYPES),
    age: z.string().regex(/^\d+$/).transform(Number),
  })
  .refine(
    ({ type, age }) => age >= AGE_RANGES[type].min && age <= AGE_RANGES[type].max,
    "Age out of range for participant type"
  );

function decodeParticipants(value: string | undefined): Participant[] | undefined {
  if (!value) return undefined;

  const participants: Participant[] = [];
  for (const chunk of value.split(",")) {
    const parts = chunk.split(":");
    if (parts.length !== 2) return undefined;

    const result = participantChunkSchema.safeParse({ type: parts[0], age: parts[1] });
    if (!result.success) return undefined;

    participants.push(result.data);
  }

  return participants.length > 0 ? participants : undefined;
}

export function buildCreaHref(prefill: CreaPrefill): string {
  const params = new URLSearchParams();

  if (prefill.destination?.trim()) params.set("destination", prefill.destination.trim());
  if (prefill.from) params.set("from", toCalendarDate(prefill.from));
  if (prefill.to) params.set("to", toCalendarDate(prefill.to));
  if (prefill.budget !== undefined) params.set("budget", String(prefill.budget));
  if (prefill.participants?.length) {
    params.set("p", prefill.participants.map((p) => `${p.type}:${p.age}`).join(","));
  }

  return `/crea?${params.toString()}`;
}

export function decodeCreaPrefill(params: CreaSearchParams): CreaPrefill {
  const prefill: CreaPrefill = {};

  const destination = destinationSchema.safeParse(params.destination);
  if (destination.success && destination.data) prefill.destination = destination.data;

  const from = dateStringSchema.safeParse(params.from);
  if (from.success && from.data) prefill.from = from.data;

  const to = dateStringSchema.safeParse(params.to);
  if (to.success && to.data) prefill.to = to.data;

  const budget = budgetSchema.safeParse(params.budget);
  if (budget.success && budget.data !== undefined) prefill.budget = budget.data;

  const participants = decodeParticipants(params.p);
  if (participants) prefill.participants = participants;

  return prefill;
}
