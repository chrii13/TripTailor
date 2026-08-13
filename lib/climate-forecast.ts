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
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });

    if (!response.ok) {
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
  } catch (error) {
    console.error("Clima storico: chiamata a Open-Meteo fallita", error);
    return null;
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
  const fetches = Array.from({ length: HISTORY_YEARS }, (_, index) => {
    const yearsAgo = index + 1;
    return fetchHistoricalYear(lat, lon, subYears(tripStart, yearsAgo), subYears(tripEnd, yearsAgo));
  });

  const responses = await Promise.all(fetches);
  const successfulResponses = responses.filter(
    (response): response is OpenMeteoArchiveResponse => response !== null
  );

  return averageDailyClimate(successfulResponses, tripStart);
}
