import { describe, expect, it } from "vitest";
import { type RunEvent, stateAt } from "./output.ts";
import type { StopSnapshot } from "./policy.ts";
import type { ScenarioV2Input } from "./scenario/format2.ts";
import { runSimulation } from "./simulate.ts";
import { minimalScenarioV2 } from "./testing/fixtures.ts";
import { idlePolicy, parse, scriptedPolicy } from "./testing/policies.ts";

const HOUR = 3_600_000;

const ofKind = <K extends RunEvent["kind"]>(events: RunEvent[], kind: K) =>
  events.filter((e): e is RunEvent & { kind: K } => e.kind === kind);

/** Depot, A and B joined in a triangle of 100-distance arcs; speed 10 makes each leg 10 s. */
function triangle(route: unknown, change: (s: ScenarioV2Input) => void = () => {}) {
  const input = minimalScenarioV2();
  input.durationMs = HOUR;
  input.stockPoints = [
    { id: "Depot", resources: [{ id: "Metals" }] },
    { id: "A", resources: [{ id: "Metals" }] },
    { id: "B", resources: [{ id: "Metals" }] },
  ];
  input.arcs = [
    { from: "Depot", to: "A", distance: 100 },
    { from: "A", to: "B", distance: 100 },
    { from: "B", to: "Depot", distance: 100 },
  ];
  input.vehicles = [
    {
      id: "V",
      route: route as never,
      speed: 10,
      dwellMs: 10_000,
      dwellPerUnitMs: 0,
      capacity: { shared: 1000 },
    },
  ];
  change(input);
  return parse(input);
}

const stops = (events: RunEvent[]) => ofKind(events, "arrival").map((e) => [e.t, e.station]);

describe("vehicle movement", () => {
  it("reverses a shuttle at the end of its path", () => {
    const scenario = triangle({ kind: "shuttle", stops: ["Depot", "A", "B"] });
    const out = runSimulation(scenario, idlePolicy, { detail: "summary" });
    expect(
      stops(out.events)
        .slice(0, 5)
        .map(([, station]) => station),
    ).toEqual(["Depot", "A", "B", "A", "Depot"]);
  });

  it("continues a loop from its last stop to its first", () => {
    const scenario = triangle({ kind: "loop", stops: ["Depot", "A", "B"] });
    const out = runSimulation(scenario, idlePolicy, { detail: "summary" });
    expect(stops(out.events).slice(0, 7)).toEqual([
      [0, "Depot"],
      [20_000, "A"],
      [40_000, "B"],
      [60_000, "Depot"],
      [80_000, "A"],
      [100_000, "B"],
      [120_000, "Depot"],
    ]);
  });

  it("starts a loop at its stated start", () => {
    const scenario = triangle({ kind: "loop", stops: ["Depot", "A", "B"], start: "B" });
    const out = runSimulation(scenario, idlePolicy, { detail: "summary" });
    expect(
      stops(out.events)
        .slice(0, 3)
        .map(([, station]) => station),
    ).toEqual(["B", "Depot", "A"]);
  });

  it("runs timetable trips out and back from their listed departures", () => {
    const scenario = triangle({
      kind: "timetable",
      stops: ["Depot", "A", "B"],
      departuresMs: [0, 30 * 60_000],
    });
    const out = runSimulation(scenario, idlePolicy, { detail: "summary" });
    expect(stops(out.events)).toEqual([
      [0, "Depot"],
      [20_000, "A"],
      [40_000, "B"],
      [60_000, "A"],
      [80_000, "Depot"],
      [1_800_000, "Depot"],
      [1_820_000, "A"],
      [1_840_000, "B"],
      [1_860_000, "A"],
      [1_880_000, "Depot"],
    ]);
    expect(out.metrics.warnings).toBe(0);
  });

  it("waits at the first stop before a timetable's first departure", () => {
    const scenario = triangle({
      kind: "timetable",
      stops: ["Depot", "A"],
      departuresMs: [HOUR / 2],
    });
    const out = runSimulation(scenario, idlePolicy);
    expect(stateAt(out, 60_000).trains[0]).toEqual({
      state: "stopped",
      station: "Depot",
      direction: "forward",
    });
    expect(stops(out.events)[0]).toEqual([HOUR / 2, "Depot"]);
  });

  it("leaves late with a warning when a trip overruns its next departure", () => {
    // Loading makes the first stop's dwell long enough to overrun the second departure.
    const scenario = triangle(
      { kind: "timetable", stops: ["Depot", "A"], departuresMs: [0, 60_000] },
      (s) => {
        const vehicle = s.vehicles?.[0];
        if (vehicle) vehicle.dwellPerUnitMs = 60_000;
        const depot = s.stockPoints[0];
        if (depot) depot.resources = [{ id: "Metals", initial: 1000 }];
      },
    );
    let loaded = false;
    const policy = scriptedPolicy((snapshot) => {
      if (loaded || snapshot.station.id !== "Depot") return [];
      loaded = true;
      return [{ type: "load", resource: "Metals", amount: 1000 }];
    });
    const out = runSimulation(scenario, policy, { detail: "summary" });
    const warning = ofKind(out.events, "warning")[0];
    expect(warning?.message).toBe(
      "departure listed at 60000 ms left late, when the previous trip finished",
    );
    // First trip: 70 s at the depot, 10 s out, 10 s at A, 10 s back, 10 s at the depot.
    expect(stops(out.events)).toEqual([
      [0, "Depot"],
      [80_000, "A"],
      [100_000, "Depot"],
      [110_000, "Depot"],
      [130_000, "A"],
      [150_000, "Depot"],
    ]);
  });

  it("adds dwell per unit transferred", () => {
    const scenario = triangle({ kind: "loop", stops: ["Depot", "A", "B"] }, (s) => {
      const vehicle = s.vehicles?.[0];
      if (vehicle) {
        vehicle.dwellMs = 10_000;
        vehicle.dwellPerUnitMs = 1_000;
        vehicle.capacity = { shared: 30_000 };
      }
      const depot = s.stockPoints[0];
      if (depot) depot.resources = [{ id: "Metals", initial: 12_000 }];
    });
    const policy = scriptedPolicy((snapshot) =>
      snapshot.stop === 1 ? [{ type: "load", resource: "Metals", amount: 12_000 }] : [],
    );
    const out = runSimulation(scenario, policy, { detail: "summary" });
    expect(ofKind(out.events, "departure")[0]).toMatchObject({ t: 22_000, dwellMs: 22_000 });
  });
});

describe("oscillations on routes", () => {
  // Two vehicles on the Depot–A–B loop: V unloads Metals at A at 20 s and W loads it back later.
  function twoOnLoop(wStart: string) {
    return triangle({ kind: "loop", stops: ["Depot", "A", "B"] }, (s) => {
      const first = s.vehicles?.[0];
      if (!first) return;
      s.vehicles = [
        first,
        { ...first, id: "W", route: { kind: "loop", stops: ["Depot", "A", "B"], start: wStart } },
      ];
      s.stockPoints = s.stockPoints.map((p) => ({
        ...p,
        resources: [{ id: "Metals", initial: p.id === "Depot" ? 1000 : 0 }],
      }));
    });
  }

  const unloadThenLoad = (loadAt: number) =>
    scriptedPolicy((snapshot) => {
      const { id } = snapshot.train;
      if (id === "V" && snapshot.station.id === "Depot" && snapshot.now === 0)
        return [{ type: "load", resource: "Metals", amount: 1000 }];
      if (id === "V" && snapshot.station.id === "A" && snapshot.now === 20_000)
        return [{ type: "unload", resource: "Metals", amount: 1000 }];
      if (id === "W" && snapshot.station.id === "A" && snapshot.now === loadAt)
        return [{ type: "load", resource: "Metals", amount: 1000 }];
      return [];
    });

  it("counts a reload within one circuit of the loading vehicle's loop", () => {
    // W starts at B, reaching A at 40 s: 20 s after the unload, within the 30 s circuit.
    const out = runSimulation(twoOnLoop("B"), unloadThenLoad(40_000), { detail: "summary" });
    expect(out.metrics.oscillations).toBe(1);
  });

  it("does not count a reload after one circuit of the loop", () => {
    // W starts at A, returning to A at 60 s: 40 s after the unload, beyond the 30 s circuit.
    const out = runSimulation(twoOnLoop("A"), unloadThenLoad(60_000), { detail: "summary" });
    expect(ofKind(out.events, "transfer")).toHaveLength(3);
    expect(out.metrics.oscillations).toBe(0);
  });
});

describe("route in stop snapshots", () => {
  const capture = () => {
    const seen: StopSnapshot[] = [];
    const policy = scriptedPolicy((snapshot) => {
      seen.push(snapshot);
      return [];
    });
    return { seen, policy };
  };

  it("lists the stops ahead on a loop with distances and travel times", () => {
    const { seen, policy } = capture();
    runSimulation(triangle({ kind: "loop", stops: ["Depot", "A", "B"] }), policy, {
      detail: "summary",
    });
    const atA = seen.find((s) => s.station.id === "A");
    expect(atA?.route).toEqual({
      kind: "loop",
      ahead: [
        { id: "B", distance: 100, travel_time: 10_000 },
        { id: "Depot", distance: 200, travel_time: 20_000 },
      ],
    });
  });

  it("lists a shuttle's stops out to the end and back", () => {
    const { seen, policy } = capture();
    runSimulation(triangle({ kind: "shuttle", stops: ["Depot", "A", "B"] }), policy, {
      detail: "summary",
    });
    expect(seen[1]?.station.id).toBe("A");
    expect(seen[1]?.route.ahead.map((stop) => stop.id)).toEqual(["B", "A", "Depot", "A"]);
  });

  it("gives the arcs at the line level and not at the local level", () => {
    const line = capture();
    runSimulation(triangle({ kind: "loop", stops: ["Depot", "A", "B"] }), line.policy, {
      detail: "summary",
    });
    expect(line.seen[0]?.network?.arcs).toHaveLength(3);
    const local = capture();
    const scenario = triangle({ kind: "loop", stops: ["Depot", "A", "B"] }, (s) => {
      s.informationLevel = "local";
    });
    runSimulation(scenario, local.policy, { detail: "summary" });
    expect(local.seen[0]?.network).toBeUndefined();
  });
});
