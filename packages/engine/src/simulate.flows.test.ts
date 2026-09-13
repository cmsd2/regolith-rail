import { describe, expect, it } from "vitest";
import { stateAt } from "./output.ts";
import type { ScenarioV2Input } from "./scenario/format2.ts";
import { profileAt, runSimulation } from "./simulate.ts";
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

describe("demand processes", () => {
  /** B consumes with the given process from unlimited stock, so demand is never limited. */
  function consuming(consumer: object, durationMs: number, seed = 1) {
    return scenario((input, a, b) => {
      input.durationMs = durationMs;
      input.seed = seed;
      input.vehicles = [];
      a.producers = [];
      b.resources = [{ id: "Metals", capacity: "unlimited", initial: 1_000_000_000 }];
      b.consumers = [
        { resource: "Metals", ...consumer } as Point["consumers"] extends (infer C)[] | undefined
          ? C
          : never,
      ];
    });
  }
  const demand = (out: ReturnType<typeof runSimulation>) =>
    out.flowTotals["consumer:B:Metals:0"] as number;

  it("gives Poisson arrivals their mean rate over many sols", () => {
    const sols = 50;
    const s = consuming(
      { poisson: { arrivalsPerSol: 24_000, size: { kind: "fixed", value: 1000 } } },
      sols * SOL,
    );
    const perSol = demand(runSimulation(s, idlePolicy, { detail: "summary" })) / sols;
    // 1200 arrivals: three standard deviations of the mean is about 2100 milli-units per sol.
    expect(perSol).toBeGreaterThan(24_000 - 2100);
    expect(perSol).toBeLessThan(24_000 + 2100);
  });

  it("keeps Poisson arrivals whole and repeatable for the same seed", () => {
    const s = consuming(
      { poisson: { arrivalsPerSol: 24_000, size: { kind: "fixed", value: 1000 } } },
      5 * SOL,
      9,
    );
    const first = demand(runSimulation(s, idlePolicy, { detail: "summary" }));
    expect(first % 1000).toBe(0);
    expect(demand(runSimulation(s, idlePolicy, { detail: "summary" }))).toBe(first);
  });

  it("handles Poisson rates of many arrivals per minute", () => {
    // The largest rate the format allows: a million arrivals a sol, about 694 a minute.
    const s = consuming(
      { poisson: { arrivalsPerSol: 1_000_000_000, size: { kind: "fixed", value: 1 } } },
      HOUR,
    );
    const total = demand(runSimulation(s, idlePolicy, { detail: "summary" }));
    // 41667 expected arrivals, with a standard deviation of about 204.
    expect(total).toBeGreaterThan(41_667 - 700);
    expect(total).toBeLessThan(41_667 + 700);
  });

  it("draws per-period amounts from a discrete distribution", () => {
    const days = 40;
    const s = consuming(
      {
        perPeriod: {
          periodMs: SOL,
          amount: {
            kind: "discrete",
            values: [
              { value: 0, weight: 1 },
              { value: 5000, weight: 3 },
            ],
          },
        },
      },
      days * SOL,
    );
    const total = demand(runSimulation(s, idlePolicy, { detail: "summary" }));
    expect(total % 5000).toBe(0);
    expect(total / days).toBeGreaterThan(3000);
    expect(total / days).toBeLessThan(4500);
  });

  it("spreads a recorded trace over each period and stops after its end", () => {
    const s = consuming({ trace: { periodMs: HOUR, amounts: [0, 5000, 2000] } }, 5 * HOUR);
    const out = runSimulation(s, idlePolicy);
    expect(demand(out)).toBe(7000);
    // Half-way through the second hour, half its 5000 has been consumed.
    expect(1_000_000_000 - (stateAt(out, HOUR + 30 * MINUTE).stock[1] as number)).toBe(2500);
  });

  it("ramps a rate with a profile", () => {
    const points = [
      { atMs: 0, multiplierPermille: 1000 },
      { atMs: 2 * HOUR, multiplierPermille: 2000 },
    ];
    expect(profileAt(points, HOUR)).toBe(1500);
    expect(profileAt(points, 3 * HOUR)).toBe(2000);
    const s = consuming({ rate: 1000 * 1440, profile: points }, 2 * HOUR);
    const out = runSimulation(s, idlePolicy);
    // The minute starting at 1 h runs at one and a half times the base rate.
    const before = stateAt(out, HOUR).stock[1] as number;
    const after = stateAt(out, HOUR + MINUTE).stock[1] as number;
    expect(before - after).toBe(1500);
  });
});
