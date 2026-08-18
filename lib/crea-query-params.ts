import { format } from "date-fns";
import { z } from "zod";
import { AGE_RANGES, type Participant, type ParticipantType } from "./schema";

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

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((str) => {
    const date = new Date(`${str}T00:00:00`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  })
  .pipe(z.date().optional());

const budgetSchema = z
  .string()
  .regex(/^\d+$/, "Budget must be decimal digits only")
  .transform((str) => Number(str))
  .refine((n) => n >= 0 && n <= 1_000_000, "Budget must be 0 to 1,000,000")
  .optional();

function isParticipantType(value: string): value is ParticipantType {
  return (PARTICIPANT_TYPES as readonly string[]).includes(value);
}

function decodeParticipants(value: string | undefined): Participant[] | undefined {
  if (!value) return undefined;

  const participants: Participant[] = [];
  for (const chunk of value.split(",")) {
    const parts = chunk.split(":");
    if (parts.length !== 2) return undefined;

    const [type, rawAge] = parts;
    if (!type || !isParticipantType(type)) return undefined;

    if (!/^\d+$/.test(rawAge)) return undefined;
    const age = Number(rawAge);
    if (!Number.isInteger(age)) return undefined;

    const range = AGE_RANGES[type];
    if (age < range.min || age > range.max) return undefined;

    participants.push({ type, age });
  }

  return participants.length > 0 ? participants : undefined;
}

export function buildCreaHref(prefill: CreaPrefill): string {
  const params = new URLSearchParams();

  if (prefill.destination?.trim()) params.set("destination", prefill.destination.trim());
  if (prefill.from) params.set("from", format(prefill.from, "yyyy-MM-dd"));
  if (prefill.to) params.set("to", format(prefill.to, "yyyy-MM-dd"));
  if (prefill.budget !== undefined) params.set("budget", String(prefill.budget));
  if (prefill.participants?.length) {
    params.set("p", prefill.participants.map((p) => `${p.type}:${p.age}`).join(","));
  }

  return `/crea?${params.toString()}`;
}

export function decodeCreaPrefill(params: CreaSearchParams): CreaPrefill {
  const prefill: CreaPrefill = {};

  const destination = params.destination?.trim();
  if (destination) prefill.destination = destination;

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
