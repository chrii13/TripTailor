import { describe, it, expect } from "vitest";
import { averageDailyClimate } from "./climate-forecast";

function makeResponse(tempsMax: (number | null)[], tempsMin: (number | null)[], precipitation: (number | null)[]) {
  return {
    daily: {
      time: tempsMax.map((_, i) => `2025-09-0${i + 1}`),
      temperature_2m_max: tempsMax,
      temperature_2m_min: tempsMin,
      precipitation_sum: precipitation,
    },
  };
}

describe("averageDailyClimate", () => {
  it("restituisce null quando non ci sono risposte", () => {
    expect(averageDailyClimate([], new Date("2026-09-01"))).toBeNull();
  });

  it("calcola la media di temperatura e la percentuale di pioggia su più anni", () => {
    const responses = [
      makeResponse([28, 26], [18, 16], [0, 5]),
      makeResponse([24, 22], [14, 12], [2, 0]),
      makeResponse([26, 24], [16, 14], [3, 0]),
    ];

    const result = averageDailyClimate(responses, new Date("2026-09-01"));

    expect(result).toEqual([
      { date: "2026-09-01", tempMaxAvg: 26, tempMinAvg: 16, precipitationChance: 67 },
      { date: "2026-09-02", tempMaxAvg: 24, tempMinAvg: 14, precipitationChance: 33 },
    ]);
  });

  it("ignora gli anni con dati mancanti (null) per un giorno specifico", () => {
    const responses = [
      makeResponse([28], [18], [0]),
      makeResponse([null], [null], [null]),
      makeResponse([26], [16], [2]),
    ];

    const result = averageDailyClimate(responses, new Date("2026-09-01"));

    expect(result).toEqual([
      { date: "2026-09-01", tempMaxAvg: 27, tempMinAvg: 17, precipitationChance: 50 },
    ]);
  });

  it("usa il numero minimo di giorni tra le risposte quando differiscono", () => {
    const responses = [
      makeResponse([28, 26, 24], [18, 16, 14], [0, 0, 0]),
      makeResponse([24, 22], [14, 12], [0, 0]),
    ];

    const result = averageDailyClimate(responses, new Date("2026-09-01"));

    expect(result).toHaveLength(2);
  });

  it("restituisce null se nessun giorno ha dati validi", () => {
    const responses = [makeResponse([null], [null], [null])];

    expect(averageDailyClimate(responses, new Date("2026-09-01"))).toBeNull();
  });
});
