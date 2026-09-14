import { describe, expect, it } from "vitest";
import { hashRun } from "./hash.ts";
import { type LineState, type RunEvent, stateAt } from "./output.ts";
import { emptyOutcome, POLICY_API_VERSION } from "./policy.ts";
import { balanceStockReferencePolicy } from "./reference/balance-stock.ts";
import type { ScenarioV1Input as ScenarioInput } from "./scenario/schema.ts";
import { starterScenarios } from "./scenario/starters.ts";
import { validateScenario } from "./scenario/validate.ts";
import { runSimulation } from "./simulate.ts";
import { minimalScenario } from "./testing/fixtures.ts";
import { idlePolicy, parse, scriptedPolicy } from "./testing/policies.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SOL = 24 * HOUR;

function scenarioWith(change: (s: ScenarioInput) => void): ScenarioInput {
  const input = minimalScenario();
  change(input);
  return input;
}

const ofKind = <K extends RunEvent["kind"]>(events: RunEvent[], kind: K) =>
  events.filter((e): e is RunEvent & { kind: K } => e.kind === kind);

describe("time model", () => {
  it("delivers rates below one milli-unit per tick exactly over time", () => {
    const scenario = parse(
      scenarioWith((s) => {
        s.durationMs = 10 * SOL;
        const station = s.stations[1];
        if (station) station.consumers = [{ resource: "Metals", rate: 1 }];
        const producer = s.stations[0]?.producers?.[0];
        if (producer) producer.rate = 7;
      }),
    );
    const out = runSimulation(scenario, idlePolicy, { detail: "summary" });
    expect(out.flowTotals["consumer:B:Metals:0"]).toBe(10);
    expect(out.flowTotals["producer:A:Metals:0"]).toBe(70);
  });

  it("applies production once per game minute", () => {
    const out = runSimulation(parse(scenarioWith((s) => (s.durationMs = HOUR))), idlePolicy);
    expect(out.tickMs).toBe(MINUTE);
    expect(out.stock?.length).toBe(61 * out.sites.length);
  });

  it("records the Policy API version", () => {
    const out = runSimulation(parse(minimalScenario()), idlePolicy);
    expect(out.apiVersion).toBe(POLICY_API_VERSION);
    expect(out.apiVersion).toBe(2);
  });
});

describe("train movement", () => {
  it("reverses at the end of the line", () => {
    const out = runSimulation(parse(scenarioWith((s) => (s.durationMs = 5 * MINUTE))), idlePolicy);
    const moves = out.events
      .filter((e) => e.kind === "arrival" || e.kind === "departure")
      .slice(0, 5)
      .map((e) =>
        e.kind === "arrival"
          ? `arrive ${e.station} ${e.direction} @${e.t}`
          : `depart ${e.station}->${e.to} @${e.t}`,
      );
    expect(moves).toEqual([
      "arrive A forward @0",
      "depart A->B @10000",
      "arrive B backward @50000",
      "depart B->A @60000",
      "arrive A forward @100000",
    ]);
  });

  it("dwells for the fixed time plus the per-unit time for the amount transferred", () => {
    const scenario = parse(
      scenarioWith((s) => {
        s.durationMs = 5 * MINUTE;
        const site = s.stations[0]?.resources[0];
        if (site) site.initial = 12_000;
      }),
    );
    const out = runSimulation(
      scenario,
      scriptedPolicy((snap) =>
        snap.stop === 1 ? [{ type: "load", resource: "Metals", amount: 12_000 }] : [],
      ),
    );
    const departure = ofKind(out.events, "departure")[0];
    expect(departure?.t).toBe(22_000);
    expect(departure?.dwellMs).toBe(22_000);
  });

  it("does not let trains block one another", () => {
    const scenario = parse(
      scenarioWith((s) => {
        s.durationMs = 2 * MINUTE;
        s.trains.push({ id: "T2", start: "A", speed: 10, capacity: { shared: 30_000 } });
      }),
    );
    const out = runSimulation(scenario, idlePolicy);
    const arrivalsAtB = ofKind(out.events, "arrival").filter((e) => e.station === "B");
    expect(arrivalsAtB.map((e) => [e.train, e.t])).toEqual([
      ["T1", 50_000],
      ["T2", 50_000],
    ]);
  });
});

describe("production and consumption", () => {
  it("stalls production at a full station", () => {
    const scenario = parse(
      scenarioWith((s) => {
        s.durationMs = HOUR;
        const site = s.stations[0]?.resources[0];
        if (site) site.initial = 30_000;
      }),
    );
    const out = runSimulation(scenario, idlePolicy);
    expect(out.samples.stock.every((row) => row[0] === 30_000)).toBe(true);
    expect(out.metrics.stalledProduction).toBe(1_000);
  });

  it("records unmet demand at an empty station", () => {
    const scenario = parse(scenarioWith((s) => (s.durationMs = HOUR)));
    const out = runSimulation(scenario, idlePolicy);
    expect(out.samples.stock.every((row) => row[1] === 0)).toBe(true);
    expect(out.metrics.unmetDemand).toBe(500);
    expect(out.metrics.demandMet).toBe(0);
  });

  it("keeps uniform variability within its range each period", () => {
    const scenario = parse(
      scenarioWith((s) => {
        s.durationMs = SOL;
        const station = s.stations[0];
        if (station?.resources[0]) station.resources[0].capacity = 1_000_000;
        if (station) {
          station.producers = [
            { resource: "Metals", rate: 8000, variability: { kind: "uniform", rangePercent: 20 } },
          ];
        }
      }),
    );
    const out = runSimulation(scenario, idlePolicy);
    const stock = out.samples.stock.map((row) => row[0] as number);
    const perHour = stock.slice(1).map((v, i) => v - (stock[i] as number));
    expect(perHour.length).toBe(24);
    // 6400 to 9600 per sol is 266.7 to 400 per hour; remainders carry between hours.
    for (const amount of perHour) {
      expect(amount).toBeGreaterThanOrEqual(266);
      expect(amount).toBeLessThanOrEqual(401);
    }
    expect(new Set(perHour).size).toBeGreaterThan(5);
  });
});

describe("world events", () => {
  type Effect = NonNullable<ScenarioInput["events"]>[number]["effects"][number];
  const withEvents = (
    events: NonNullable<ScenarioInput["events"]>,
    change: (s: ScenarioInput) => void = () => {},
  ) =>
    parse(
      scenarioWith((s) => {
        s.durationMs = 4 * HOUR;
        s.sampleIntervalMs = HOUR;
        for (const station of s.stations) {
          for (const site of station.resources) {
            site.capacity = 1_000_000;
            site.initial = 100_000;
          }
        }
        s.events = events;
        change(s);
      }),
    );
  const fixed = (startMs: number, durationMs: number) => ({
    kind: "fixed" as const,
    startMs,
    durationMs,
  });
  const stop: Effect = { type: "supply", stations: "all", resources: "all", multiplierPermille: 0 };

  it("stops all production while a storm is active", () => {
    const out = runSimulation(
      withEvents([
        { id: "dust", label: "Dust storm", schedule: fixed(2 * HOUR, HOUR), effects: [stop] },
      ]),
      idlePolicy,
    );
    const stockAt = (hour: number) => out.samples.stock[hour]?.[0];
    expect(stockAt(2)).toBe(102_000);
    expect(stockAt(3)).toBe(102_000);
    expect(stockAt(4)).toBe(103_000);
    expect(out.flowTotals["producer:A:Metals:0"]).toBe(3_000);
    expect(ofKind(out.events, "event-start")).toEqual([
      { t: 2 * HOUR, kind: "event-start", event: "dust", label: "Dust storm" },
    ]);
    expect(ofKind(out.events, "event-end").map((e) => e.t)).toEqual([3 * HOUR]);
  });

  it("starts random events from their own stream", () => {
    const out = runSimulation(
      withEvents(
        [
          {
            id: "gusts",
            label: "Gusts",
            schedule: {
              kind: "random",
              probabilityPpm: 1_000_000,
              checkIntervalMs: 2 * HOUR,
              durationMs: HOUR,
            },
            effects: [{ ...stop, multiplierPermille: 500 }],
          },
        ],
        (s) => (s.durationMs = 12 * HOUR),
      ),
      idlePolicy,
    );
    expect(ofKind(out.events, "event-start").map((e) => e.t / HOUR)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(out.flowTotals["producer:A:Metals:0"]).toBe(12 * 1000 - 6 * 500);
  });

  it("multiplies demand for chosen resources at chosen stations only", () => {
    const out = runSimulation(
      withEvents(
        [
          {
            id: "maintenance",
            label: "Sudden maintenance",
            schedule: fixed(0, HOUR),
            effects: [
              { type: "demand", stations: ["B"], resources: ["Metals"], multiplierPermille: 4000 },
            ],
          },
        ],
        (s) => {
          s.durationMs = HOUR;
          s.resources.push({ id: "Food" });
          const b = s.stations[1];
          if (b) {
            b.resources.push({ id: "Food", capacity: 1_000_000, initial: 100_000 });
            b.consumers?.push({ resource: "Food", rate: 12_000 });
          }
        },
      ),
      idlePolicy,
    );
    expect(out.flowTotals["consumer:B:Metals:0"]).toBe(2_000);
    expect(out.flowTotals["consumer:B:Food:0"]).toBe(500);
    expect(out.flowTotals["producer:A:Metals:0"]).toBe(1_000);
  });

  it("triples a demand shock for one hour", () => {
    const out = runSimulation(
      withEvents(
        [
          {
            id: "surge",
            label: "Surge",
            schedule: fixed(HOUR, HOUR),
            effects: [
              { type: "demand", stations: "all", resources: ["Metals"], multiplierPermille: 3000 },
            ],
          },
        ],
        (s) => {
          const consumer = s.stations[1]?.consumers?.[0];
          if (consumer) consumer.rate = 24_000;
        },
      ),
      idlePolicy,
    );
    const stock = out.samples.stock.map((row) => row[1] as number);
    expect(stock.slice(1).map((v, i) => (stock[i] as number) - v)).toEqual([
      1000, 3000, 1000, 1000,
    ]);
  });

  it("lets an effect start after its event and outlast it", () => {
    const out = runSimulation(
      withEvents(
        [
          {
            id: "storm",
            label: "Storm",
            schedule: fixed(HOUR, HOUR),
            effects: [
              {
                type: "demand",
                stations: "all",
                resources: "all",
                multiplierPermille: 0,
                startOffsetMs: 30 * MINUTE,
                durationMs: 2 * HOUR,
              },
            ],
          },
        ],
        (s) => (s.sampleIntervalMs = 30 * MINUTE),
      ),
      idlePolicy,
    );
    const stock = out.samples.stock.map((row) => row[1] as number);
    const perHalfHour = stock.slice(1).map((v, i) => (stock[i] as number) - v);
    expect(perHalfHour).toEqual([250, 250, 250, 0, 0, 0, 0, 250]);
  });

  it("multiplies overlapping effects together", () => {
    const half: Effect = {
      type: "supply",
      stations: ["A"],
      resources: ["Metals"],
      multiplierPermille: 500,
    };
    const out = runSimulation(
      withEvents(
        [
          { id: "one", label: "One", schedule: fixed(0, HOUR), effects: [half] },
          { id: "two", label: "Two", schedule: fixed(0, HOUR), effects: [half] },
        ],
        (s) => (s.durationMs = HOUR),
      ),
      idlePolicy,
    );
    expect(out.flowTotals["producer:A:Metals:0"]).toBe(250);
  });

  it("leaves train movement unchanged", () => {
    const moves = (events: NonNullable<ScenarioInput["events"]>) =>
      runSimulation(withEvents(events), idlePolicy)
        .events.filter((e) => e.kind === "arrival" || e.kind === "departure")
        .map((e) => `${e.kind}:${e.t}`);
    expect(
      moves([{ id: "dust", label: "Dust", schedule: fixed(0, 4 * HOUR), effects: [stop] }]),
    ).toEqual(moves([]));
  });
});

describe("stops and actions", () => {
  it("clamps a load to the stock available and warns", () => {
    const scenario = parse(
      scenarioWith((s) => {
        s.durationMs = MINUTE;
        const site = s.stations[0]?.resources[0];
        if (site) site.initial = 8_000;
      }),
    );
    const out = runSimulation(
      scenario,
      scriptedPolicy((snap) =>
        snap.stop === 1 ? [{ type: "load", resource: "Metals", amount: 20_000 }] : [],
      ),
    );
    expect(ofKind(out.events, "transfer")[0]?.amount).toBe(8_000);
    const warning = ofKind(out.events, "warning")[0];
    expect(warning?.action).toEqual({
      type: "load",
      resource: "Metals",
      requested: 20_000,
      applied: 8_000,
    });
    expect(warning?.message).toContain("station stock");
  });

  it("applies actions in the order issued", () => {
    const scenario = parse({
      ...minimalScenario(),
      durationMs: MINUTE,
      resources: [{ id: "Metals" }, { id: "Food" }],
      stations: [
        {
          id: "A",
          resources: [
            { id: "Metals", initial: 5_000 },
            { id: "Food", initial: 25_000 },
          ],
          distanceToNext: 400,
        },
        { id: "B", resources: [{ id: "Metals" }] },
      ],
      trains: [{ id: "T1", start: "A", speed: 10, capacity: { shared: 30_000 } }],
    });
    // Fill the train with Food at the first stop, then swap at the second decision.
    let calls = 0;
    const out = runSimulation(
      scenario,
      scriptedPolicy(() => {
        calls++;
        return [
          { type: "load", resource: "Food", amount: 25_000 },
          { type: "load", resource: "Metals", amount: 5_000 },
          { type: "unload", resource: "Food", amount: 5_000 },
          { type: "load", resource: "Metals", amount: 5_000 },
        ];
      }),
    );
    expect(calls).toBe(1);
    expect(ofKind(out.events, "transfer").map((e) => `${e.resource}:${e.amount}`)).toEqual([
      "Food:25000",
      "Metals:5000",
      "Food:-5000",
    ]);
    // The last load finds no Metals left, which is a clamp, not an ordering problem.
    expect(ofKind(out.events, "warning")).toHaveLength(1);
  });

  it("unloads then loads in full when a full train swaps cargo", () => {
    const scenario = parse({
      ...minimalScenario(),
      durationMs: 2 * MINUTE,
      resources: [{ id: "Metals" }, { id: "Food" }],
      stations: [
        {
          id: "A",
          resources: [{ id: "Food", initial: 30_000 }],
          distanceToNext: 400,
        },
        {
          id: "B",
          resources: [
            { id: "Metals", initial: 5_000 },
            { id: "Food", initial: 20_000 },
          ],
        },
      ],
      trains: [{ id: "T1", start: "A", speed: 10, dwellMs: 0, capacity: { shared: 30_000 } }],
    });
    const out = runSimulation(
      scenario,
      scriptedPolicy((snap) =>
        snap.stop === 1
          ? [{ type: "load", resource: "Food", amount: 30_000 }]
          : snap.stop > 2
            ? []
            : [
                { type: "unload", resource: "Food", amount: 5_000 },
                { type: "load", resource: "Metals", amount: 5_000 },
              ],
      ),
    );
    expect(
      ofKind(out.events, "transfer").map((e) => `${e.station}:${e.resource}:${e.amount}`),
    ).toEqual(["A:Food:30000", "B:Food:-5000", "B:Metals:5000"]);
    expect(ofKind(out.events, "warning")).toHaveLength(0);
  });

  it("ignores actions for resources the station does not enable", () => {
    const out = runSimulation(
      parse(scenarioWith((s) => (s.durationMs = MINUTE))),
      scriptedPolicy(() => [{ type: "load", resource: "Unobtainium", amount: 5 }]),
    );
    const warning = ofKind(out.events, "warning")[0];
    expect(warning?.message).toBe("Unobtainium is not enabled at A; load ignored");
    expect(ofKind(out.events, "transfer")).toHaveLength(0);
  });

  it("transfers nothing at a stop where the policy fails and carries on", () => {
    const scenario = parse(
      scenarioWith((s) => {
        s.durationMs = 10 * MINUTE;
        const site = s.stations[0]?.resources[0];
        if (site) site.initial = 30_000;
      }),
    );
    const out = runSimulation(
      scenario,
      scriptedPolicy((snap) =>
        snap.stop === 3
          ? {
              ...emptyOutcome(),
              actions: [{ type: "load", resource: "Metals", amount: 1_000 }],
              error: { kind: "runtime", message: "attempt to index a nil value", line: 14 },
            }
          : [
              {
                type: snap.here.id === "A" ? "load" : "unload",
                resource: "Metals",
                amount: 1_000,
              },
            ],
      ),
    );
    const errors = ofKind(out.events, "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ stop: 3, train: "T1", station: "A", line: 14 });
    const stops = ofKind(out.events, "transfer").map((e) => e.stop);
    expect(stops).not.toContain(3);
    expect(stops.some((stop) => stop > 3)).toBe(true);
    expect(out.metrics.policyErrors).toBe(1);
    expect(ofKind(out.events, "departure").find((e) => e.stop === 3)?.dwellMs).toBe(10_000);
  });
});

describe("reference balance-stock policy", () => {
  for (const starter of starterScenarios) {
    it(`runs ${starter.id} to completion`, () => {
      const result = validateScenario(starter.document);
      if (!result.ok) throw new Error("invalid starter");
      const out = runSimulation(result.scenario, balanceStockReferencePolicy());
      expect(out.aborted).toBe(false);
      expect(out.metrics.stops).toBeGreaterThan(10);
      expect(out.metrics.policyErrors).toBe(0);
      expect(out.metrics.transferred).toBeGreaterThan(0);
    });
  }
});

describe("run output", () => {
  it("rebuilds the state at any event time without re-running", () => {
    for (const starter of starterScenarios) {
      const result = validateScenario(starter.document);
      if (!result.ok) throw new Error("invalid starter");
      const captured = new Map<number, LineState>();
      const out = runSimulation(result.scenario, balanceStockReferencePolicy(), {
        inspect: (state) => captured.set(state.t, state),
      });
      const times = [...captured.keys()];
      const step = Math.max(1, Math.floor(times.length / 400));
      for (let i = 0; i < times.length; i += step) {
        const t = times[i] as number;
        expect(stateAt(out, t), `${starter.id} @${t}`).toEqual(captured.get(t));
      }
    }
  });
});

describe("metrics", () => {
  it("counts a load soon after an unload at the same station as an oscillation", () => {
    const scenario = parse(
      scenarioWith((s) => {
        s.durationMs = MINUTE;
        const site = s.stations[1]?.resources[0];
        if (site) site.initial = 10_000;
        s.trains = [
          { id: "T1", start: "B", speed: 10, capacity: { shared: 30_000 } },
          { id: "T2", start: "B", speed: 10, capacity: { shared: 30_000 } },
        ];
      }),
    );
    // T1 starts carrying nothing, so load first to have something to unload.
    const out = runSimulation(
      scenario,
      scriptedPolicy((snap) =>
        snap.vehicle.id === "T1"
          ? [
              { type: "load", resource: "Metals", amount: 2_000 },
              { type: "unload", resource: "Metals", amount: 2_000 },
            ]
          : [{ type: "load", resource: "Metals", amount: 1_000 }],
      ),
    );
    // T1: load (no previous unload), unload. T2: load within a round trip of T1's unload.
    expect(out.metrics.oscillations).toBe(1);
  });

  it("weights unmet demand by resource priority", () => {
    const scenario = parse({
      ...minimalScenario(),
      durationMs: HOUR,
      resources: [
        { id: "Food", priority: 3 },
        { id: "Metals", priority: 1 },
      ],
      stations: [
        { id: "A", resources: [{ id: "Metals" }], distanceToNext: 10_000 },
        {
          id: "B",
          resources: [{ id: "Food" }, { id: "Metals" }],
          consumers: [
            { resource: "Food", rate: 24_000 },
            { resource: "Metals", rate: 24_000 },
          ],
        },
      ],
    });
    const out = runSimulation(scenario, idlePolicy);
    expect(out.metrics.unmetDemand).toBe(2_000);
    expect(out.metrics.unmetDemandWeighted).toBe(4_000);
    expect(out.metrics.byResource.Food).toEqual({ unmet: 1_000, stalled: 0, met: 0 });
  });

  it("measures the share of distance travelled empty", () => {
    const out = runSimulation(parse(scenarioWith((s) => (s.durationMs = 5 * MINUTE))), idlePolicy);
    expect(out.metrics.distance).toBeGreaterThan(0);
    expect(out.metrics.emptyDistance).toBe(out.metrics.distance);
    expect(out.metrics.emptyDistanceShare).toBe(1);
  });
});

describe("determinism", () => {
  it("repeats a run exactly", () => {
    const result = validateScenario(starterScenarios[3]?.document);
    if (!result.ok) throw new Error("invalid starter");
    const a = runSimulation(result.scenario, balanceStockReferencePolicy(), { seed: 5 });
    const b = runSimulation(result.scenario, balanceStockReferencePolicy(), { seed: 5 });
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(hashRun(a)).toBe(hashRun(b));
    const c = runSimulation(result.scenario, balanceStockReferencePolicy(), { seed: 6 });
    expect(hashRun(c)).not.toBe(hashRun(a));
  });
});
