import type { Participant } from "./schema";

export type DiscoverFormDateValues = {
  departureCity: string;
  dateMode: "esatte" | "flessibili";
  dateRange: { from?: Date; to?: Date };
  flexiblePeriod: { month?: string; nights?: number };
  participants: Participant[];
  budget: number;
  vacationType?: string;
};

/**
 * Costruisce il corpo della richiesta a /api/discover-trips a partire dai valori del form.
 * Il form tiene sempre in stato sia dateRange sia flexiblePeriod (per non perdere i valori
 * inseriti quando l'utente cambia modalità), ma l'API accetta esattamente uno dei due: qui
 * si sceglie in base a dateMode e si omette del tutto il campo non pertinente, non lo si
 * manda vuoto/undefined.
 */
export function buildDiscoverTripsRequestBody(values: DiscoverFormDateValues) {
  const base = {
    departureCity: values.departureCity,
    participants: values.participants,
    budget: values.budget,
    vacationType: values.vacationType,
  };

  if (values.dateMode === "flessibili") {
    return {
      ...base,
      flexiblePeriod: {
        month: values.flexiblePeriod.month ?? "",
        nights: values.flexiblePeriod.nights ?? 0,
      },
    };
  }

  return {
    ...base,
    dateRange: {
      from: values.dateRange.from,
      to: values.dateRange.to,
    },
  };
}
