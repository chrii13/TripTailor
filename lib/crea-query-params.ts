import { format } from "date-fns";
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
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isParticipantType(value: string): value is ParticipantType {
  return (PARTICIPANT_TYPES as readonly string[]).includes(value);
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

function decodeDate(value: string | undefined): Date | undefined {
  if (!value || !DATE_PATTERN.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function decodeBudget(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const budget = Number(value);
  if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000) return undefined;
  return budget;
}

function decodeParticipants(value: string | undefined): Participant[] | undefined {
  if (!value) return undefined;

  const participants: Participant[] = [];
  for (const chunk of value.split(",")) {
    const [type, rawAge] = chunk.split(":");
    if (!type || !isParticipantType(type)) return undefined;

    const age = Number(rawAge);
    if (!Number.isInteger(age)) return undefined;

    const range = AGE_RANGES[type];
    if (age < range.min || age > range.max) return undefined;

    participants.push({ type, age });
  }

  return participants.length > 0 ? participants : undefined;
}

export function decodeCreaPrefill(params: CreaSearchParams): CreaPrefill {
  const prefill: CreaPrefill = {};

  const destination = params.destination?.trim();
  if (destination) prefill.destination = destination;

  const from = decodeDate(params.from);
  if (from) prefill.from = from;

  const to = decodeDate(params.to);
  if (to) prefill.to = to;

  const budget = decodeBudget(params.budget);
  if (budget !== undefined) prefill.budget = budget;

  const participants = decodeParticipants(params.p);
  if (participants) prefill.participants = participants;

  return prefill;
}
