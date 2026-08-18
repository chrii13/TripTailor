import { describe, it, expect, vi, afterEach } from "vitest";
import { averageDailyClimate, getClimateAverages } from "./climate-forecast";

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


describe("getClimateAverages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const ok = () =>
    new Response(JSON.stringify({
  daily: {
    time: ["2021-09-12"],
    temperature_2m_max: [26],
    temperature_2m_min: [18],
    precipitation_sum: [0],
  },
}), { status: 200 });

  it("interroga gli anni in sequenza, non in parallelo", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
        return ok();
      })
    );

    await getClimateAverages(38.7, -9.1, new Date("2026-09-12"), new Date("2026-09-12"));

    expect(maxInFlight).toBe(1);
  });

  it("riprova una volta quando Open-Meteo risponde 429", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      return call === 1 ? new Response("", { status: 429 }) : ok();
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getClimateAverages(
      38.7,
      -9.1,
      new Date("2026-09-12"),
      new Date("2026-09-12")
    );

    // 5 anni + 1 ritentativo per il primo
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(result).not.toBeNull();
  });

  it("restituisce comunque una media se solo alcuni anni falliscono", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        // il primo anno fallisce sia al primo tentativo che al retry
        if (call <= 2) return new Response("", { status: 400 });
        return ok();
      })
    );

    const result = await getClimateAverages(
      38.7,
      -9.1,
      new Date("2026-09-12"),
      new Date("2026-09-12")
    );

    expect(result).not.toBeNull();
    expect(result?.[0].tempMaxAvg).toBe(26);
  });
});
