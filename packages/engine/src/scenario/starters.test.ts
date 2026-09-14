import { describe, expect, it } from "vitest";
import { starterScenarios } from "./starters.ts";
import { validateScenario } from "./validate.ts";

describe("starter scenarios", () => {
  it("are the five documented scenarios", () => {
    expect(starterScenarios.map((s) => s.id)).toEqual([
      "two-station",
      "relay",
      "two-trains",
      "mixed-line",
      "storm-shock",
    ]);
  });

  for (const starter of starterScenarios) {
    it(`${starter.id} is written in format 2`, () => {
      expect((starter.document as { format: number }).format).toBe(2);
    });

    it(`${starter.id} passes validation and links to its documentation`, () => {
      const result = validateScenario(starter.document);
      expect(result.ok ? [] : result.errors).toEqual([]);
      if (!result.ok) return;
      expect(result.scenario.id).toBe(starter.id);
      expect(result.scenario.docs).toMatch(
        /^(failure-modes\/[\w-]+|book\/[\w-]+#case-study-[\w-]+)$/,
      );
    });

    it(`${starter.id} uses game-sized stations`, () => {
      const result = validateScenario(starter.document);
      if (!result.ok) throw new Error("invalid starter");
      for (const station of result.scenario.stations) {
        for (const site of station.resources) {
          expect([30_000, 60_000], `${station.id} ${site.id}`).toContain(site.capacity);
        }
      }
    });
  }
});
