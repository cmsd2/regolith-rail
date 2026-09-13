import { describe, expect, it } from "vitest";
import { stateAt } from "./output.ts";
import type { ScenarioV2Input } from "./scenario/format2.ts";
import { runSimulation } from "./simulate.ts";
import { minimalScenarioV2 } from "./testing/fixtures.ts";
import { idlePolicy, parse, scriptedPolicy } from "./testing/policies.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SOL = 24 * HOUR;

type Point = ScenarioV2Input["stockPoints"][number];

function scenario(change: (s: ScenarioV2Input, a: Point, b: Point) => void) {
  const input = minimalScenarioV2();
  input.durationMs = HOUR;
  change(input, input.stockPoints[0] as Point, input.stockPoints[1] as Point);
  return parse(input);
}

describe("unlimited capacity", () => {
  it("never limits production", () => {
    const s = scenario((input, a, b) => {
      a.resources = [{ id: "Metals", capacity: "unlimited" }];
      a.producers = [{ resource: "Metals", rate: 100_000 * 1440 }];
      b.consumers = [];
      input.vehicles = [];
    });
    const out = runSimulation(s, idlePolicy);
    expect(out.metrics.stalledProduction).toBe(0);
    expect(stateAt(out, HOUR).stock[0]).toBe(6_000_000);
  });

  it("never limits unloads", () => {
    const s = scenario((input, a, b) => {
      a.resources = [{ id: "Metals", initial: 30_000 }];
      a.producers = [];
      b.resources = [{ id: "Metals", capacity: "unlimited", initial: 1_000_000 }];
      b.consumers = [];
      const vehicle = input.vehicles?.[0];
      if (vehicle) vehicle.capacity = { shared: 30_000 };
    });
    const policy = scriptedPolicy((snapshot) =>
      snapshot.station.id === "A"
        ? [{ type: "load", resource: "Metals", amount: 30_000 }]
        : [{ type: "unload", resource: "Metals", amount: 30_000 }],
    );
    const out = runSimulation(s, policy);
    const spaceWarnings = out.events.filter(
      (e) => e.kind === "warning" && e.message.includes("station space"),
    );
    expect(spaceWarnings).toEqual([]);
    expect(stateAt(out, HOUR).stock[1]).toBe(1_030_000);
  });
});

describe("backorders", () => {
  /**
   * Dome consumes 1000 a minute with backorders. A train loads 6000 at Mine at 0 s and
   * arrives at Dome at 245 s, after four minutes of unmet demand have been backordered.
   */
  function backordering(unmet: "lost" | "backorder") {
    return scenario((input, a, b) => {
      input.durationMs = 5 * MINUTE;
      a.resources = [{ id: "Metals", initial: 6000 }];
      a.producers = [];
      b.consumers = [{ resource: "Metals", rate: 1000 * 1440, unmet }];
      input.arcs = [{ from: "A", to: "B", distance: 2350 }];
      const vehicle = input.vehicles?.[0];
      if (vehicle) {
        vehicle.dwellMs = 10_000;
        vehicle.dwellPerUnitMs = 0;
      }
    });
  }
  const deliver = scriptedPolicy((snapshot) =>
    snapshot.station.id === "A"
      ? [{ type: "load", resource: "Metals", amount: 6000 }]
      : [{ type: "unload", resource: "Metals", amount: 6000 }],
  );

  it("serves the backlog before new demand when stock arrives", () => {
    const out = runSimulation(backordering("backorder"), deliver);
    // At 5 minutes the backlog of 4000 is served first, then the minute's demand of 1000.
    expect(stateAt(out, 5 * MINUTE).stock[1]).toBe(1000);
    expect(out.metrics.demandMet).toBe(5000);
    expect(out.metrics.unmetDemand).toBe(0);
    expect(out.metrics.backorderPeak).toBe(4000);
    // Backlog at the end of minutes 1 to 5: 1000, 2000, 3000, 4000, 0.
    expect(out.metrics.backorderAverage).toBe(2000);
  });

  it("loses unmet demand for consumers that do not backorder", () => {
    const out = runSimulation(backordering("lost"), deliver);
    expect(stateAt(out, 5 * MINUTE).stock[1]).toBe(5000);
    expect(out.metrics.unmetDemand).toBe(4000);
    expect(out.metrics.demandMet).toBe(1000);
    expect(out.metrics.backorderPeak).toBe(0);
  });

  it("conserves resources while serving backlogs", () => {
    const out = runSimulation(backordering("backorder"), deliver, { detail: "summary" });
    expect(out.flowTotals["consumer:B:Metals:0"]).toBe(5000);
    expect(out.metrics.demandMet + 1000).toBe(6000);
  });
});

describe("sol-scale backorders", () => {
  it("accumulates a backlog while the station is empty", () => {
    const s = scenario((input, _a, b) => {
      input.durationMs = SOL;
      input.vehicles = [];
      b.consumers = [{ resource: "Metals", rate: 24_000, unmet: "backorder" }];
    });
    const out = runSimulation(s, idlePolicy, { detail: "summary" });
    expect(out.metrics.backorderPeak).toBe(24_000);
    expect(out.metrics.unmetDemand).toBe(0);
  });
});
