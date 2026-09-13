import { describe, expect, it } from "vitest";
import type { ScenarioV2Input } from "./scenario/format2.ts";
import { runSimulation } from "./simulate.ts";
import { minimalScenarioV2 } from "./testing/fixtures.ts";
import { idlePolicy, parse, reviewPolicy, scriptedPolicy } from "./testing/policies.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SOL = 24 * HOUR;

type Point = ScenarioV2Input["stockPoints"][number];

/** A stock point alone, or with the minimal line's second stock point, for one sol. */
function single(point: Point, change: (s: ScenarioV2Input) => void = () => {}) {
  const input = minimalScenarioV2();
  input.durationMs = SOL;
  input.stockPoints = [point];
  input.arcs = [];
  input.vehicles = [];
  change(input);
  return parse(input);
}

describe("costs", () => {
  it("are all zero when a scenario states none", () => {
    const out = runSimulation(parse(minimalScenarioV2()), idlePolicy, { detail: "summary" });
    expect(out.metrics.costs).toEqual({
      total: 0,
      holding: 0,
      ordering: 0,
      transport: 0,
      lostDemand: 0,
      backorders: 0,
      stalledProduction: 0,
    });
  });

  it("charge holding per unit held per sol", () => {
    const scenario = single({
      id: "A",
      resources: [{ id: "Metals", initial: 2000, holdingCost: 3 }],
    });
    const out = runSimulation(scenario, idlePolicy, { detail: "summary" });
    // 2 units for one sol at 3 per unit per sol is 6, reported in thousandths.
    expect(out.metrics.costs.holding).toBe(6000);
    expect(out.metrics.costs.total).toBe(6000);
  });

  it("charge backorders per unit waiting per sol", () => {
    const scenario = single({
      id: "A",
      resources: [{ id: "Metals" }],
      consumers: [{ resource: "Metals", rate: 1000 * 1440, unmet: "backorder", backorderCost: 1 }],
    });
    const out = runSimulation(scenario, idlePolicy, { detail: "summary" });
    // The backlog grows by one unit a minute: its average over the sol is (1 + 1440) / 2 units.
    expect(out.metrics.costs.backorders).toBe(Math.floor((1441 / 2) * 1000));
  });

  it("charge lost demand per unit", () => {
    const scenario = single({
      id: "A",
      resources: [{ id: "Metals" }],
      consumers: [{ resource: "Metals", rate: 24_000, lostCost: 10 }],
    });
    const out = runSimulation(scenario, idlePolicy, { detail: "summary" });
    expect(out.metrics.unmetDemand).toBe(24_000);
    expect(out.metrics.costs.lostDemand).toBe(240_000);
  });

  it("charge stalled production per unit", () => {
    const scenario = single({
      id: "A",
      resources: [{ id: "Metals", capacity: 0 }],
      producers: [{ resource: "Metals", rate: 12_000, stallCost: 2 }],
    });
    const out = runSimulation(scenario, idlePolicy, { detail: "summary" });
    expect(out.metrics.costs.stalledProduction).toBe(24_000);
  });

  it("charge each order a fixed cost and a cost per unit", () => {
    const scenario = single({
      id: "A",
      resources: [{ id: "Metals" }],
      suppliers: [{ resource: "Metals", from: "external", orderCost: 20, unitCost: 2 }],
      review: { periodMs: 12 * HOUR },
    });
    const policy = reviewPolicy(() => [{ type: "order", resource: "Metals", amount: 5000 }]);
    const out = runSimulation(scenario, policy, { detail: "summary" });
    // Two reviews, each ordering 5 units: (20 + 2 × 5) × 2.
    expect(out.metrics.costs.ordering).toBe(60_000);
  });

  it("charge transport per unit of distance", () => {
    const input = minimalScenarioV2();
    input.durationMs = HOUR;
    const vehicle = input.vehicles?.[0];
    if (vehicle) vehicle.costPerDistance = 3;
    const out = runSimulation(
      parse(input),
      scriptedPolicy(() => []),
      { detail: "summary" },
    );
    expect(out.metrics.distance).toBeGreaterThan(0);
    expect(out.metrics.costs.transport).toBe(out.metrics.distance * 3 * 1000);
  });
});
