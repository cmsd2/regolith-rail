import { describe, expect, it } from "vitest";
import { minimalScenario } from "../testing/fixtures.ts";
import { DEFAULT_CAPACITY } from "./schema.ts";
import { validateScenario } from "./validate.ts";

function errorsOf(input: unknown) {
  const result = validateScenario(input);
  if (result.ok) throw new Error("expected validation to fail");
  return result.errors;
}

describe("scenario document", () => {
  it("accepts a minimal scenario and applies defaults", () => {
    const result = validateScenario(minimalScenario());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { scenario } = result;
    expect(scenario.sampleIntervalMs).toBe(3_600_000);
    expect(scenario.events).toEqual([]);
    expect(scenario.resources[0]?.priority).toBe(1);
    expect(scenario.trains[0]?.direction).toBe("forward");
    expect(scenario.trains[0]?.dwellMs).toBe(10_000);
    expect(scenario.trains[0]?.dwellPerUnitMs).toBe(1_000);
    expect(scenario.stations[0]?.consumers).toEqual([]);
    expect(scenario.stations[0]?.producers[0]?.variability).toEqual({ kind: "fixed" });
    expect(scenario.stations[0]?.resources[0]?.initial).toBe(0);
  });

  it("gives an enabled resource 30000 milli-units of capacity by default", () => {
    const result = validateScenario(minimalScenario());
    expect(result.ok && result.scenario.stations[1]?.resources[0]?.capacity).toBe(DEFAULT_CAPACITY);
    expect(DEFAULT_CAPACITY).toBe(30_000);
  });
});

describe("line topology", () => {
  it("rejects a line with one station", () => {
    const input = minimalScenario();
    input.stations = [{ id: "A", resources: [{ id: "Metals" }] }];
    input.trains = [{ id: "T1", start: "A", speed: 10, capacity: { shared: 1000 } }];
    expect(errorsOf(input)).toContainEqual({
      path: "stations",
      message: "a line needs at least two stations",
    });
  });

  it("requires distances between stations and none after the last", () => {
    const input = minimalScenario();
    delete input.stations[0]?.distanceToNext;
    (input.stations[1] as { distanceToNext?: number }).distanceToNext = 100;
    const paths = errorsOf(input).map((e) => e.path);
    expect(paths).toContain("stations[0].distanceToNext");
    expect(paths).toContain("stations[1].distanceToNext");
  });
});

describe("trains", () => {
  it("accepts shared and per-resource capacity", () => {
    const input = minimalScenario();
    input.resources.push({ id: "Food" });
    input.trains.push({
      id: "T2",
      start: "B",
      speed: 10,
      capacity: { perResource: { Metals: 10_000, Food: 5_000 } },
    });
    expect(validateScenario(input).ok).toBe(true);
  });

  it("rejects an unknown start station", () => {
    const input = minimalScenario();
    if (input.trains[0]) input.trains[0].start = "Z";
    expect(errorsOf(input)).toContainEqual({
      path: "trains[0].start",
      message: "unknown station Z",
    });
  });
});

describe("producers and consumers", () => {
  it("rejects a producer for a resource the station does not enable", () => {
    const input = minimalScenario();
    input.resources.push({ id: "Food" });
    input.stations[0]?.producers?.push({ resource: "Food", rate: 100 });
    expect(errorsOf(input)).toContainEqual({
      path: "stations[0].producers[1].resource",
      message: "station A does not enable resource Food",
    });
  });
});

describe("information level", () => {
  it("rejects levels reserved for later versions", () => {
    const input = minimalScenario();
    input.informationLevel = "colony";
    expect(errorsOf(input)).toContainEqual({
      path: "informationLevel",
      message: "the colony information level is reserved for a later version",
    });
  });
});

describe("validation errors", () => {
  it("reports multiple errors together with their paths", () => {
    const input = minimalScenario();
    if (input.stations[1]) input.stations[1].id = "A";
    const producer = input.stations[0]?.producers?.[0];
    if (producer) producer.rate = -5;
    const paths = errorsOf(input).map((e) => e.path);
    expect(paths).toContain("stations[1].id");
    expect(paths).toContain("stations[0].producers[0].rate");
  });

  it("names the supported versions for an unknown format", () => {
    const input = minimalScenario();
    input.format = 2;
    expect(errorsOf(input)).toContainEqual({
      path: "format",
      message: "format 2 is not supported; supported versions: 1",
    });
  });

  it("rejects unknown fields", () => {
    const input = { ...minimalScenario(), colour: "red" };
    expect(errorsOf(input).map((e) => e.path)).toContain("(document)");
  });

  it("rejects duplicate ids and unknown references", () => {
    const input = minimalScenario();
    input.resources.push({ id: "Metals" });
    input.events = [
      {
        id: "s",
        label: "Storm",
        schedule: { kind: "fixed", startMs: 0, durationMs: 60_000 },
        effects: [{ type: "supply", stations: ["Q"], resources: "all", multiplierPermille: 0 }],
      },
    ];
    const paths = errorsOf(input).map((e) => e.path);
    expect(paths).toContain("resources[1].id");
    expect(paths).toContain("events[0].effects[0].stations[0]");
  });

  it("names an unknown resource in an effect", () => {
    const input = minimalScenario();
    input.events = [
      {
        id: "maintenance",
        label: "Maintenance",
        schedule: { kind: "fixed", startMs: 0, durationMs: 60_000 },
        effects: [
          {
            type: "demand",
            stations: "all",
            resources: ["MachineParts"],
            multiplierPermille: 3000,
          },
        ],
      },
    ];
    expect(errorsOf(input)).toContainEqual({
      path: "events[0].effects[0].resources[0]",
      message: "unknown resource MachineParts",
    });
  });

  it("requires every event to have at least one effect", () => {
    const input = minimalScenario();
    input.events = [
      {
        id: "quiet",
        label: "Quiet",
        schedule: { kind: "fixed", startMs: 0, durationMs: 60_000 },
        effects: [],
      },
    ];
    expect(errorsOf(input).map((e) => e.path)).toContain("events[0].effects");
  });

  it("rejects non-integer quantities", () => {
    const input = minimalScenario();
    const consumer = input.stations[1]?.consumers?.[0];
    if (consumer) consumer.rate = 1.5;
    expect(errorsOf(input).map((e) => e.path)).toContain("stations[1].consumers[0].rate");
  });
});
