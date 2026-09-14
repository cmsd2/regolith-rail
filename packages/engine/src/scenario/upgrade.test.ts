import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbitraryScenario } from "../testing/arbitrary.ts";
import { minimalScenario } from "../testing/fixtures.ts";
import { format1Starters } from "../testing/format1-starters.ts";
import { ScenarioV2 } from "./format2.ts";
import { ScenarioV1 } from "./schema.ts";
import { starterScenarios } from "./starters.ts";
import { upgradeV1 } from "./upgrade.ts";
import { validateScenario } from "./validate.ts";

describe("format 1 upgrade", () => {
  it("upgrades every first-release starter to exactly the format 2 starter", () => {
    expect(format1Starters.map((s) => s.id)).toEqual(starterScenarios.map((s) => s.id));
    for (const starter of format1Starters) {
      expect((starter.document as { format: number }).format).toBe(1);
      const upgraded = validateScenario(starter.document);
      expect(upgraded.ok ? [] : upgraded.errors, starter.id).toEqual([]);
      const current = validateScenario(starterScenarios.find((s) => s.id === starter.id)?.document);
      if (!upgraded.ok || !current.ok) throw new Error(`${starter.id} should validate`);
      expect(upgraded.scenario, starter.id).toEqual(current.scenario);
    }
  });

  it("turns two-station into two stations, one arc and one shuttle", () => {
    const starter = format1Starters.find((s) => s.id === "two-station");
    const result = validateScenario(starter?.document);
    if (!result.ok) throw new Error("two-station should validate");
    const { scenario } = result;
    expect(scenario.stations.map((p) => p.id)).toEqual(["Mine", "Dome"]);
    expect(scenario.arcs).toEqual([{ from: "Mine", to: "Dome", distance: 72_000 }]);
    expect(scenario.vehicles).toHaveLength(1);
    expect(scenario.vehicles[0]?.route).toEqual({
      kind: "shuttle",
      stops: ["Mine", "Dome"],
      start: "Mine",
      direction: "forward",
    });
    expect(scenario.stations[1]?.consumers[0]).toMatchObject({ unmet: "lost" });
  });

  it("keeps station, flow and train order and settings", () => {
    const v1 = ScenarioV1.parse(minimalScenario());
    const v2 = ScenarioV2.parse(upgradeV1(v1));
    expect(v2.stations.map((p) => p.id)).toEqual(v1.stations.map((s) => s.id));
    expect(v2.vehicles.map((v) => [v.id, v.speed, v.dwellMs, v.dwellPerUnitMs])).toEqual(
      v1.trains.map((t) => [t.id, t.speed, t.dwellMs, t.dwellPerUnitMs]),
    );
    expect(v2.stations[0]?.producers).toEqual([
      { resource: "Metals", rate: 24_000, variability: { kind: "fixed" } },
    ]);
  });

  it("reports format 1 errors at their format 1 paths", () => {
    const input = minimalScenario();
    if (input.trains[0]) input.trains[0].start = "Z";
    const result = validateScenario(input);
    expect(result.ok ? [] : result.errors).toContainEqual({
      path: "trains[0].start",
      message: "unknown station Z",
    });
  });

  it("upgrades any valid format 1 document to a valid format 2 document", () => {
    fc.assert(
      fc.property(arbitraryScenario, (input) => {
        const v1 = ScenarioV1.safeParse(input);
        if (!v1.success) return;
        const v2 = ScenarioV2.safeParse(upgradeV1(v1.data));
        expect(v2.success ? [] : v2.error.issues).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });
});
