import { subYears, addDays, format } from "date-fns";

const HISTORY_YEARS = 5;

export interface DailyClimateAverage {
  date: string;
  tempMaxAvg: number;
  tempMinAvg: number;
  precipitationChance: number;
}

export interface OpenMeteoArchiveResponse {
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

const REQUEST_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestHistoricalYear(url: URL): Promise<OpenMeteoArchiveResponse | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  if (!response.ok) {
    // 429 e 5xx sono transitori: li rilanciamo per far scattare il retry.
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`Open-Meteo ha risposto ${response.status}`);
    }
    console.error(`Clima storico: Open-Meteo ha risposto ${response.status}`);
    return null;
  }

  const data = await response.json();

  if (
    !data?.daily?.time ||
    !data.daily.temperature_2m_max ||
    !data.daily.temperature_2m_min ||
    !data.daily.precipitation_sum
  ) {
    return null;
  }

  return data as OpenMeteoArchiveResponse;
}

async function fetchHistoricalYear(
  lat: number,
  lon: number,
  start: Date,
  end: Date
): Promise<OpenMeteoArchiveResponse | null> {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", format(start, "yyyy-MM-dd"));
  url.searchParams.set("end_date", format(end, "yyyy-MM-dd"));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("timezone", "auto");

  try {
    return await requestHistoricalYear(url);
  } catch (error) {
    console.error("Clima storico: primo tentativo fallito, riprovo", error);
    await sleep(RETRY_DELAY_MS);
    try {
      return await requestHistoricalYear(url);
    } catch (retryError) {
      console.error("Clima storico: chiamata a Open-Meteo fallita", retryError);
      return null;
    }
  }
}

export function averageDailyClimate(
  responses: OpenMeteoArchiveResponse[],
  tripStart: Date
): DailyClimateAverage[] | null {
  if (responses.length === 0) {
    return null;
  }

  const dayCount = Math.min(...responses.map((response) => response.daily.time.length));
  const results: DailyClimateAverage[] = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const maxTemps: number[] = [];
    const minTemps: number[] = [];
    let rainYears = 0;
    let validYears = 0;

    for (const response of responses) {
      const max = response.daily.temperature_2m_max[dayIndex];
      const min = response.daily.temperature_2m_min[dayIndex];
      const precipitation = response.daily.precipitation_sum[dayIndex];

      if (max === null || min === null || precipitation === null) {
        continue;
      }

      maxTemps.push(max);
      minTemps.push(min);
      if (precipitation > 0) {
        rainYears += 1;
      }
      validYears += 1;
    }

    if (validYears === 0) {
      continue;
    }

    results.push({
      date: format(addDays(tripStart, dayIndex), "yyyy-MM-dd"),
      tempMaxAvg: Math.round(maxTemps.reduce((sum, value) => sum + value, 0) / validYears),
      tempMinAvg: Math.round(minTemps.reduce((sum, value) => sum + value, 0) / validYears),
      precipitationChance: Math.round((rainYears / validYears) * 100),
    });
  }

  return results.length > 0 ? results : null;
}

export async function getClimateAverages(
  lat: number,
  lon: number,
  tripStart: Date,
  tripEnd: Date
): Promise<DailyClimateAverage[] | null> {
  // Sequenziale, non in parallelo: cinque richieste simultanee alla stessa API
  // gratuita possono essere strozzate tutte insieme, lasciando l'itinerario senza meteo.
  const successfulResponses: OpenMeteoArchiveResponse[] = [];

  for (let yearsAgo = 1; yearsAgo <= HISTORY_YEARS; yearsAgo++) {
    const response = await fetchHistoricalYear(
      lat,
      lon,
      subYears(tripStart, yearsAgo),
      subYears(tripEnd, yearsAgo)
    );
    if (response !== null) {
      successfulResponses.push(response);
    }
  }

  return averageDailyClimate(successfulResponses, tripStart);
}
