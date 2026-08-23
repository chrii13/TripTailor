import { format } from "date-fns";
import { z } from "zod";

/**
 * Le date del viaggio sono date di *calendario*: "10 ottobre 2026", non un istante.
 * Serializzarle come `Date` dentro JSON.stringify le trasforma in un istante UTC
 * ("2026-10-09T22:00:00.000Z" per la mezzanotte italiana), e il server — che su Vercel
 * gira in UTC — le rilegge come il giorno prima. Sul filo passa quindi solo "yyyy-MM-dd",
 * che non ha fuso, e ogni lato la ricostruisce come mezzanotte LOCALE: così
 * `format(data, "dd/MM/yyyy")` dà lo stesso giorno di calendario ovunque giri il codice.
 *
 * Da evitare `new Date("2026-10-10")`: una stringa date-only viene interpretata in UTC
 * e riporta lo stesso slittamento che stiamo togliendo di mezzo.
 */
export function toCalendarDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Mezzanotte locale del giorno indicato. La stringa dev'essere già validata. */
function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** "2026-10-10" → "10/10/2026". Se la stringa non è una data valida la restituisce intatta. */
export function formatCalendarDate(value: string): string {
  const parsed = parseCalendarDate(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "dd/MM/yyyy");
}

/**
 * Mezzanotte locale di oggi. È il confine di "data passata" dalla parte del browser,
 * dove il fuso è quello dell'utente: un viaggio che comincia oggi è ancora plausibile,
 * uno cominciato ieri no.
 */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Lo stesso confine, ma visto dal server — che su Vercel gira in UTC mentre l'utente
 * sceglie le date nel proprio fuso. I due non concordano su "che giorno è": a Niue
 * (UTC-11) è ancora il 22 quando a Greenwich è già il 23, e a Kiritimati (UTC+14) è
 * il contrario. Confrontare la data scelta con la mezzanotte UTC scarterebbe quindi,
 * per alcune ore al giorno, un "oggi" perfettamente legittimo — lo stesso genere di
 * slittamento di un giorno che `toCalendarDate` esiste per togliere di mezzo.
 *
 * Un giorno di tolleranza copre l'intero arco dei fusi (da UTC-12 a UTC+14 lo scarto
 * fra due date di calendario non supera mai un giorno) e continua a fermare quello
 * che il controllo deve fermare: le richieste per date davvero passate.
 */
export function earliestRequestableDate(): Date {
  const boundary = startOfToday();
  boundary.setDate(boundary.getDate() - 1);
  return boundary;
}

/**
 * `z.iso.date()` accetta solo "yyyy-MM-dd" e solo date che esistono davvero
 * (scarta 2026-02-31, che `new Date` interpreterebbe come il 3 marzo).
 */
export const calendarDateSchema = z.iso.date().transform(parseCalendarDate);
