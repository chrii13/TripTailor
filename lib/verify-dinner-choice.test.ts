import { describe, expect, it } from "vitest";
import { resolveDinnerChoice } from "./verify-dinner-choice";
import type { DinnerCandidate } from "./dinner-candidates";

const candidati: DinnerCandidate[] = [
  { id: 1, name: "Adega São Nicolau", distanceMeters: 120 },
  { id: 2, name: "Dom Tonho", distanceMeters: 240 },
];

describe("resolveDinnerChoice", () => {
  it("restituisce il candidato quando l'identificativo esiste", () => {
    expect(resolveDinnerChoice(candidati, 2)?.name).toBe("Dom Tonho");
  });

  it("scarta un identificativo inventato: è il cancello contro i locali inesistenti", () => {
    expect(resolveDinnerChoice(candidati, 99)).toBeNull();
  });

  it("scarta lo zero e i negativi, che gli identificativi partono da 1", () => {
    expect(resolveDinnerChoice(candidati, 0)).toBeNull();
    expect(resolveDinnerChoice(candidati, -1)).toBeNull();
  });

  it("scarta qualunque scelta su un elenco vuoto", () => {
    expect(resolveDinnerChoice([], 1)).toBeNull();
  });
});
