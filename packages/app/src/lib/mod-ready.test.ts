import {
  type Scenario,
  type ScenarioV2Input,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { beforeAll, describe, expect, it } from "vitest";
import { simulationTasks } from "../workers/simulate.ts";
import { lineOrder, modReadiness } from "./mod-ready.ts";

let tasks: ReturnType<typeof simulationTasks>;
beforeAll(async () => {
  tasks = simulationTasks(await LuaRuntime.load());
});

function parse(input: unknown): Scenario {
  const result = validateScenario(input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.scenario;
}

const starter = (id: string) =>
  parse(starterScenarios.find((s) => s.id === id)?.document as unknown);

const baseline = BUILT_IN_POLICIES["balance-stock"];

/** Mine, Junction and Dome in a line, with one shuttle, changed by `change`. */
function line(change: (s: ScenarioV2Input) => void = () => {}): Scenario {
  const input: ScenarioV2Input = {
    format: 2,
    id: "line",
    title: "Line",
    description: "A line.",
    durationMs: 3_600_000,
    seed: 1,
    informationLevel: "local",
    resources: [{ id: "Metals" }, { id: "Polymers" }],
    stations: [
      { id: "Mine", resources: [{ id: "Metals" }] },
      { id: "Junction", resources: [{ id: "Metals" }, { id: "Polymers" }] },
      { id: "Dome", resources: [{ id: "Metals" }] },
    ],
    arcs: [
      { from: "Junction", to: "Dome", distance: 100 },
      { from: "Mine", to: "Junction", distance: 100 },
    ],
    vehicles: [
      {
        id: "T1",
        route: { kind: "shuttle", stops: ["Dome", "Junction", "Mine"] },
        speed: 10,
        capacity: { shared: 1000 },
      },
    ],
  };
  change(input);
  return parse(input);
}

describe("mod-ready pairings", () => {
  it("marks every starter line with the balancing baseline as mod-ready", () => {
    for (const { id } of starterScenarios) {
      expect(tasks.modReady(baseline, starter(id)), id).toEqual({ ready: true, reasons: [] });
    }
  });

  it("marks a line whose shuttle runs end to end in either direction", () => {
    expect(lineOrder(line())).toEqual(["Mine", "Junction", "Dome"]);
    expect(tasks.modReady(baseline, line()).ready).toBe(true);
  });

  it("is blocked by a review hook and says which hook", () => {
    const policy = "return { on_stop = function(ctx) end, on_review = function(ctx) end }";
    expect(tasks.modReady(policy, line())).toEqual({
      ready: false,
      reasons: ["the policy defines on_review, which the game does not call"],
    });
  });

  it("is blocked by converters", () => {
    const scenario = line((s) => {
      const junction = s.stations[1];
      if (junction) {
        junction.converters = [
          {
            inputs: [{ resource: "Metals", amount: 1000 }],
            outputs: [{ resource: "Polymers", amount: 1000 }],
            rate: 1000,
          },
        ];
      }
    });
    expect(tasks.modReady(baseline, scenario).reasons).toEqual(["the scenario has converters"]);
  });

  it("is blocked by suppliers and by reviews", () => {
    const scenario = line((s) => {
      const dome = s.stations[2];
      if (dome) {
        dome.suppliers = [
          { resource: "Metals", from: "external", leadTime: { kind: "fixed", value: 60_000 } },
        ];
        dome.review = { periodMs: 3_600_000 };
      }
    });
    const policy = "return { on_stop = function(ctx) end, on_review = function(ctx) end }";
    expect(tasks.modReady(policy, scenario).reasons).toEqual([
      "the policy defines on_review, which the game does not call",
      "the scenario has reviews",
      "the scenario has suppliers",
    ]);
  });

  it("is blocked by routes that are not a shuttle along the whole line", () => {
    const partial = line((s) => {
      const vehicle = s.vehicles?.[0];
      if (vehicle) vehicle.route = { kind: "shuttle", stops: ["Mine", "Junction"] };
    });
    expect(modReadiness({ hooks: ["on_stop"] }, partial).reasons).toEqual([
      "vehicle T1 does not shuttle along the whole line",
    ]);
    const loop = line((s) => {
      s.arcs?.push({ from: "Dome", to: "Mine", distance: 100 });
      const vehicle = s.vehicles?.[0];
      if (vehicle) vehicle.route = { kind: "loop", stops: ["Mine", "Junction", "Dome"] };
    });
    expect(modReadiness({ hooks: ["on_stop"] }, loop).reasons).toEqual([
      "the stations are not joined in a single line",
      "vehicle T1 runs a loop route, not a shuttle",
    ]);
  });

  it("is blocked by a policy that does not load", () => {
    const result = tasks.modReady("return {", line());
    expect(result.ready).toBe(false);
    expect(result.reasons[0]).toMatch(/^the policy does not load: /);
  });
});
