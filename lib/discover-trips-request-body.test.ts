import { describe, it, expect } from "vitest";
import { buildDiscoverTripsRequestBody, type DiscoverFormDateValues } from "./discover-trips-request-body";
import { discoverTripsRequestSchema } from "./discover-trips-request";

const base: Omit<DiscoverFormDateValues, "dateMode" | "dateRange" | "flexiblePeriod"> = {
  departureCity: "Milano, Italia",
  participants: [{ type: "adulto", age: 35 }],
  budget: 1500,
};

describe("buildDiscoverTripsRequestBody", () => {
  it("in modalità esatte include dateRange e omette flexiblePeriod", () => {
    const body = buildDiscoverTripsRequestBody({
      ...base,
      dateMode: "esatte",
      dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) },
      flexiblePeriod: {},
    });

    expect(body).toHaveProperty("dateRange");
    expect(body).not.toHaveProperty("flexiblePeriod");
    expect(discoverTripsRequestSchema.safeParse(body).success).toBe(true);
  });

  it("in modalità flessibili include flexiblePeriod e omette dateRange", () => {
    const body = buildDiscoverTripsRequestBody({
      ...base,
      dateMode: "flessibili",
      dateRange: {},
      flexiblePeriod: { month: "2026-10", nights: 7 },
    });

    expect(body).toHaveProperty("flexiblePeriod");
    expect(body).not.toHaveProperty("dateRange");
    expect(discoverTripsRequestSchema.safeParse(body).success).toBe(true);
  });

  it("in modalità flessibili ignora un dateRange residuo lasciato dal cambio modalità", () => {
    const body = buildDiscoverTripsRequestBody({
      ...base,
      dateMode: "flessibili",
      dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) },
      flexiblePeriod: { month: "2026-10", nights: 7 },
    });

    expect(body).not.toHaveProperty("dateRange");
  });

  it("in modalità esatte ignora un flexiblePeriod residuo lasciato dal cambio modalità", () => {
    const body = buildDiscoverTripsRequestBody({
      ...base,
      dateMode: "esatte",
      dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 5) },
      flexiblePeriod: { month: "2026-10", nights: 7 },
    });

    expect(body).not.toHaveProperty("flexiblePeriod");
  });
});
