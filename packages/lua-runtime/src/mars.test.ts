import { readFileSync } from "node:fs";
import {
  naiveReferencePolicy,
  runGoldenMatrix,
  type Scenario,
  starterScenario,
  starterScenarios,
} from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { STARTER_SCRIPTS } from "@regolith-rail/scenario-kit";
import { beforeAll, describe, expect, it } from "vitest";
import { LuaRuntime } from "./policy.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const load = (source: string): Scenario => {
  const result = runtime.loadScript(source);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.scenario;
};

const lines = (...text: string[]) => text.join("\n");

describe("starter scenarios as Mars scripts", () => {
  it("cover every starter", () => {
    expect(Object.keys(STARTER_SCRIPTS).sort()).toEqual(starterScenarios.map((s) => s.id).sort());
  });

  for (const { id } of starterScenarios) {
    it(`${id} evaluates to the recorded scenario`, () => {
      expect(load(STARTER_SCRIPTS[id] as string)).toEqual(starterScenario(id));
    });
  }

  it("give the recorded golden hashes", () => {
    const golden = JSON.parse(
      readFileSync(new URL("../../../tests/determinism/golden.json", import.meta.url), "utf8"),
    );
    const scripted = new Map(Object.entries(STARTER_SCRIPTS).map(([id, s]) => [id, load(s)]));
    const hashes = runGoldenMatrix(
      (name) =>
        name === "reference:naive"
          ? naiveReferencePolicy()
          : runtime.createPolicy(BUILT_IN_POLICIES.naive),
      (id) => scripted.get(id) as Scenario,
    );
    expect(hashes).toEqual(golden);
  }, 120_000);
});

describe("Mars constructs", () => {
  it("describe a line in game terms", () => {
    const scenario = load(
      lines(
        "return mars.line {",
        '  id = "outpost",',
        "  duration = sols(5),",
        "  stations = {",
        '    mars.small_station { id = "Mine", buildings = { mars.extractor { resource = "Metals" } } },',
        '    mars.large_station { id = "Home", buildings = { mars.dome {} } },',
        "  },",
        "  distances = 20000,",
        '  trains = { mars.train { id = "T1" } },',
        "}",
      ),
    );
    expect(scenario.stations.map((s) => s.id)).toEqual(["Mine", "Home"]);
    expect(scenario.arcs).toEqual([{ from: "Mine", to: "Home", distance: 20000 }]);
    expect(scenario.vehicles[0]).toMatchObject({
      route: { kind: "shuttle", stops: ["Mine", "Home"], start: "Mine" },
      speed: 5,
      capacity: { shared: 30_000 },
    });
    expect(scenario.stations[0]?.producers).toMatchObject([{ resource: "Metals", rate: 40_000 }]);
    expect(scenario.stations[1]?.consumers).toMatchObject([{ resource: "Food", rate: 20_000 }]);
    expect(scenario.resources).toEqual([
      { id: "Metals", priority: 1 },
      { id: "Food", priority: 3 },
    ]);
  });

  it("size stations in game units", () => {
    const scenario = load(
      lines(
        "return mars.line {",
        '  id = "sizes", duration = sols(1), distances = 100, trains = { mars.train { id = "T" } },',
        "  stations = {",
        '    mars.large_station { id = "Big", resources = { "Metals", "Food" } },',
        '    mars.small_station { id = "Small", resources = { "Metals" }, capacity = { Metals = 45 } },',
        "  },",
        "}",
      ),
    );
    expect(scenario.stations[0]?.resources.map((r) => [r.id, r.capacity])).toEqual([
      ["Metals", 60_000],
      ["Food", 60_000],
    ]);
    expect(scenario.stations[1]?.resources[0]?.capacity).toBe(45_000);
  });

  it("let a parameter override a building's default rate", () => {
    const scenario = load(
      lines(
        "return mars.line {",
        '  id = "rates", duration = sols(1), distances = 100, trains = { mars.train { id = "T" } },',
        "  stations = {",
        '    mars.small_station { id = "A", buildings = { mars.extractor { resource = "Metals", rate = 5 } } },',
        '    mars.small_station { id = "B", buildings = { mars.factory { rate = 12 } } },',
        "  },",
        "}",
      ),
    );
    expect(scenario.stations[0]?.producers[0]?.rate).toBe(5000);
    expect(scenario.stations[1]?.converters[0]).toMatchObject({
      inputs: [{ resource: "Metals", amount: 3000 }],
      outputs: [{ resource: "MachineParts", amount: 1000 }],
      rate: 12_000,
    });
  });

  it("turn a dust storm with a maintenance surge into one event", () => {
    const scenario = load(
      lines(
        "return mars.line {",
        '  id = "storm", duration = sols(5), distances = 100, trains = { mars.train { id = "T" } },',
        "  stations = {",
        '    mars.small_station { id = "Mine", buildings = { mars.extractor { resource = "Metals" } } },',
        '    mars.small_station { id = "Dome", buildings = { mars.consumer { resource = "Metals", rate = 10 } } },',
        "  },",
        "  events = {",
        "    mars.dust_storm {",
        "      start = sols(1), duration = sols(1),",
        '      surge = { station = "Dome", resource = "Metals", multiplier = 2.5, after = sols(0.5), duration = sols(1) },',
        "    },",
        "  },",
        "}",
      ),
    );
    expect(scenario.events).toHaveLength(1);
    expect(scenario.events[0]?.effects).toEqual([
      {
        type: "supply",
        stations: "all",
        resources: "all",
        multiplierPermille: 0,
        startOffsetMs: 0,
      },
      {
        type: "demand",
        stations: ["Dome"],
        resources: ["Metals"],
        multiplierPermille: 2500,
        startOffsetMs: 43_200_000,
        durationMs: 86_400_000,
      },
    ]);
  });

  it("report a misused building at its line", () => {
    const result = runtime.loadScript(
      lines(
        "return mars.line {",
        '  id = "bad", duration = sols(1), distances = 100, trains = { mars.train { id = "T" } },',
        "  stations = {",
        '    mars.small_station { id = "A", buildings = { "Metals" } },',
        '    mars.small_station { id = "B", resources = { "Metals" } },',
        "  },",
        "}",
      ),
    );
    expect(result.ok ? [] : result.errors).toEqual([
      {
        line: 4,
        message:
          "mars.small_station: buildings[1] must be a building, such as mars.extractor { ... }",
      },
    ]);
  });
});
