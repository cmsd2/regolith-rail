import {
  hashRun,
  type RunEvent,
  type RunOutput,
  runSimulation,
  type Scenario,
  type ScenarioV1Input as ScenarioInput,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";
import { BUILT_IN_POLICIES, OPS_LIBRARY } from "@regolith-rail/policy-api";
import { beforeAll, describe, expect, it } from "vitest";
import { checkPolicySource } from "./check.ts";
import { type LuaPolicyOptions, LuaRuntime } from "./policy.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const HOUR = 3_600_000;

type StationInput = ScenarioInput["stations"][number];

/** A line of stations with no producers or consumers, so stock changes only by transfers. */
function line(stations: StationInput[], change: (s: ScenarioInput) => void = () => {}): Scenario {
  const input: ScenarioInput = {
    format: 1,
    id: "ops-test",
    title: "ops test",
    description: "A line for ops tests.",
    durationMs: 2 * HOUR,
    seed: 1,
    informationLevel: "line",
    resources: [{ id: "Metals" }, { id: "Food", priority: 3 }],
    stations,
    trains: [{ id: "T1", start: stations[0]?.id ?? "A", speed: 10, capacity: { shared: 30_000 } }],
  };
  change(input);
  const result = validateScenario(input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.scenario;
}

const station = (id: string, metals: number, next?: number): StationInput => ({
  id,
  resources: [{ id: "Metals", initial: metals }],
  ...(next === undefined ? {} : { distanceToNext: next }),
});

const run = (source: string, scenario: Scenario, options: LuaPolicyOptions = {}) =>
  runSimulation(scenario, runtime.createPolicy(source, options), { detail: "summary" });

const ofKind = <K extends RunEvent["kind"]>(events: RunEvent[], kind: K) =>
  events.filter((e): e is RunEvent & { kind: K } => e.kind === kind);

const transfers = (out: RunOutput) =>
  ofKind(out.events, "transfer").map(
    (e) => `${e.stop}:${e.train}@${e.station} ${e.resource} ${e.amount}`,
  );

const loadError = (out: RunOutput) => {
  expect(out.aborted).toBe(true);
  return ofKind(out.events, "error")[0];
};

describe("declarative policies", () => {
  it("require a target", () => {
    // `return ops.policy {...}` is a tail call, so Lua keeps no policy line to report.
    const out = run("return ops.policy {}", line([station("A", 0, 100), station("B", 0)]));
    expect(loadError(out)).toMatchObject({
      errorKind: "load",
      message: "ops.policy: target is required",
    });
    const named = run(
      "local policy = ops.policy {}\nreturn policy",
      line([station("A", 0, 100), station("B", 0)]),
    );
    expect(loadError(named)).toMatchObject({ errorKind: "load", line: 1 });
  });

  it("reject blocks that need more information than the scenario provides", () => {
    const scenario = line(
      [station("A", 0, 100), station("B", 0)],
      (s) => (s.informationLevel = "local"),
    );
    const out = run("return ops.policy { target = ops.balance {} }", scenario);
    expect(loadError(out)?.message).toBe(
      "ops.balance needs the line information level, but this scenario provides local",
    );
  });

  it("reject unknown parameters", () => {
    const out = run(
      "return ops.policy { target = ops.order_up_to { levle = 3 } }",
      line([station("A", 0, 100), station("B", 0)]),
    );
    expect(loadError(out)?.message).toBe("ops.order_up_to has no parameter named levle");
  });

  it("reproduce naive.lua with one line, ignoring traces", () => {
    const withoutTraces = (out: RunOutput) => ({
      ...out,
      events: out.events.filter((e) => e.kind !== "trace"),
    });
    const onePolicy = runtime.createPolicy("return ops.policy { target = ops.balance {} }");
    const naive = runtime.createPolicy(BUILT_IN_POLICIES.naive);
    for (const starter of starterScenarios) {
      const result = validateScenario(starter.document);
      if (!result.ok) throw new Error("invalid starter");
      for (let seed = 1; seed <= 50; seed++) {
        const expected = runSimulation(result.scenario, naive, { seed, detail: "summary" });
        const actual = withoutTraces(
          runSimulation(result.scenario, onePolicy, { seed, detail: "summary" }),
        );
        if (hashRun(actual) !== hashRun(expected)) {
          expect(actual.events, `${starter.id} seed ${seed}`).toEqual(expected.events);
        }
        expect(hashRun(actual), `${starter.id} seed ${seed}`).toBe(hashRun(expected));
      }
    }
  }, 600_000);
});

describe("roles", () => {
  const abc = () => line([station("A", 20_000, 400), station("B", 0, 400), station("C", 0)]);

  it("drain supply stations and fill demand stations", () => {
    const out = run(
      `return ops.policy {
        classify = ops.roles.manual { A = "supply", B = "relay", C = "demand" },
        target = { supply = ops.drain {}, relay = ops.pass_through {}, demand = ops.fill {} },
      }`,
      abc(),
    );
    expect(transfers(out).slice(0, 2)).toEqual(["1:T1@A Metals 20000", "3:T1@C Metals -20000"]);
  });

  it("must each have a target", () => {
    const out = run(
      `return ops.policy {
        classify = ops.roles.manual { A = "supply", B = "relay", C = "demand" },
        target = { supply = ops.drain {}, demand = ops.fill {} },
      }`,
      abc(),
    );
    expect(loadError(out)?.message).toBe(
      "ops.policy: B has the role relay but target has no relay entry",
    );
  });
});

describe("target blocks", () => {
  const supplied = (bMetals: number) =>
    run(
      `return ops.policy {
        classify = ops.roles.manual { A = "supply", B = "demand" },
        target = { supply = ops.drain {}, demand = ops.min_max { min = 5000, max = 25000 } },
      }`,
      line([station("A", 30_000, 400), station("B", bMetals)]),
    );

  it("leave a min-max site above its minimum alone", () => {
    expect(transfers(supplied(9_000))).toEqual(["1:T1@A Metals 30000"]);
  });

  it("raise a min-max site below its minimum to its maximum", () => {
    expect(transfers(supplied(3_000))).toContain("2:T1@B Metals -22000");
  });

  it("record traces with their inputs", () => {
    const out = run(
      "return ops.policy { target = ops.order_up_to { level = 20000 } }",
      line([station("A", 0, 400), station("C", 12_000)]),
    );
    const trace = ofKind(out.events, "trace").find((e) => e.station === "C");
    expect(trace?.trace).toEqual({
      block: "order_up_to",
      station: "C",
      resource: "Metals",
      inputs: { position: 12_000, level: 20_000 },
      result: 20_000,
    });
  });

  it("accept a custom function", () => {
    const out = run(
      "return ops.policy { target = function(site) return 2 * site.capacity / 3 end }",
      line([station("A", 30_000, 400), station("B", 0)]),
    );
    expect(transfers(out).slice(0, 2)).toEqual(["1:T1@A Metals 10000", "2:T1@B Metals -10000"]);
  });

  it("name the stage when a custom function fails", () => {
    const out = run(
      "return ops.policy {\n  target = function(site)\n    return site.nothing.here\n  end,\n}",
      line([station("A", 0, 400), station("B", 0)]),
    );
    expect(ofKind(out.events, "error")[0]).toMatchObject({ errorKind: "runtime", line: 3 });
    expect(ofKind(out.events, "error")[0]?.message).toMatch(
      /^in the target stage: attempt to index/,
    );
  });
});

describe("inventory position and lookahead", () => {
  it("stops a second train dispatching to a shortage already covered", () => {
    const scenario = line([station("S", 30_000, 400), station("D", 0)], (s) => {
      s.trains = [
        { id: "T1", start: "S", speed: 10, capacity: { shared: 30_000 } },
        { id: "T2", start: "S", speed: 10, capacity: { shared: 30_000 } },
      ];
    });
    const out = run(
      `return ops.policy {
        classify = ops.roles.manual { S = "supply", D = "demand" },
        target = { supply = ops.drain {}, demand = ops.order_up_to { level = 10000 } },
        plan = ops.lookahead {},
      }`,
      scenario,
    );
    expect(transfers(out).slice(0, 1)).toEqual(["1:T1@S Metals 10000"]);
    expect(transfers(out).some((t) => t.startsWith("2:"))).toBe(false);
    const reservations = ofKind(out.events, "trace").filter(
      (e) => e.trace.block === "lookahead" && e.trace.station === "D" && (e.stop ?? 0) <= 2,
    );
    expect(reservations.map((e) => [e.train, e.trace.result])).toEqual([["T1", 10_000]]);
  });

  it("serves the current station and keeps the rest for a station further along", () => {
    const out = run(
      `return ops.policy {
        classify = ops.roles.manual { A = "supply", B = "demand", C = "demand" },
        target = { supply = ops.drain {}, demand = function(site)
          if site.station == "C" then return 15000 end
          return 5000
        end },
        plan = ops.lookahead {},
      }`,
      line([station("A", 30_000, 400), station("B", 0, 400), station("C", 0)]),
    );
    // Only the 20000 needed ahead is loaded, out of 30000 available.
    expect(transfers(out).slice(0, 2)).toEqual(["1:T1@A Metals 20000", "2:T1@B Metals -5000"]);
    const atB = ofKind(out.events, "trace").filter(
      (e) => e.stop === 2 && e.trace.block === "lookahead" && e.trace.station === "C",
    );
    expect(atB.map((e) => e.trace.result)).toEqual([15_000]);
  });

  it("keeps reservations through a save and reload", () => {
    const source = `return ops.policy {
      classify = ops.roles.manual { S = "supply", D = "demand" },
      target = { supply = ops.drain {}, demand = ops.order_up_to { level = 10000 } },
      plan = ops.lookahead {},
    }`;
    const scenario = line([station("S", 30_000, 4000), station("D", 0)], (s) => {
      s.durationMs = 24 * HOUR;
      s.trains = [
        { id: "T1", start: "S", speed: 10, capacity: { shared: 30_000 } },
        { id: "T2", start: "D", direction: "backward", speed: 10, capacity: { shared: 30_000 } },
      ];
    });
    const normal = run(source, scenario);
    const reloaded = run(source, scenario, { saveReloadTest: true });
    expect(transfers(reloaded)).toEqual(transfers(normal));
  });
});

describe("allocation", () => {
  it("shares limited space in proportion to the requests", () => {
    const scenario = line(
      [
        {
          id: "A",
          resources: [
            { id: "Metals", initial: 20_000 },
            { id: "Food", initial: 10_000 },
          ],
          distanceToNext: 400,
        },
        { id: "B", resources: [{ id: "Metals" }, { id: "Food" }] },
      ],
      (s) => {
        s.trains = [{ id: "T1", start: "A", speed: 10, capacity: { shared: 12_000 } }];
      },
    );
    const out = run(
      `return ops.policy {
        classify = ops.roles.manual { A = "supply", B = "relay" },
        target = { supply = ops.drain {}, relay = ops.pass_through {} },
        allocate = ops.proportional {},
      }`,
      scenario,
    );
    expect(transfers(out).slice(0, 2).sort()).toEqual(["1:T1@A Food 4000", "1:T1@A Metals 8000"]);
  });

  it("serves higher priority resources first", () => {
    const scenario = line(
      [
        {
          id: "A",
          resources: [
            { id: "Metals", initial: 20_000 },
            { id: "Food", initial: 10_000 },
          ],
          distanceToNext: 400,
        },
        { id: "B", resources: [{ id: "Metals" }, { id: "Food" }] },
      ],
      (s) => {
        s.trains = [{ id: "T1", start: "A", speed: 10, capacity: { shared: 12_000 } }];
      },
    );
    const out = run(
      `return ops.policy {
        classify = ops.roles.manual { A = "supply", B = "relay" },
        target = { supply = ops.drain {}, relay = ops.pass_through {} },
        allocate = ops.priority {},
      }`,
      scenario,
    );
    expect(transfers(out).slice(0, 2).sort()).toEqual(["1:T1@A Food 10000", "1:T1@A Metals 2000"]);
  });
});

describe("reviews", () => {
  const DAY = 24 * HOUR;

  /** A shop reviewed daily, selling 2 Beer a day with backorders, and a two-day lead time. */
  const shop = (): Scenario => {
    const result = validateScenario({
      format: 2,
      id: "shop",
      title: "Shop",
      description: "A shop ordering beer.",
      durationMs: 6 * DAY,
      seed: 1,
      informationLevel: "local",
      resources: [{ id: "Beer" }],
      stations: [
        {
          id: "Shop",
          resources: [{ id: "Beer", capacity: 100_000, initial: 3000 }],
          consumers: [{ resource: "Beer", rate: 2000, unmet: "backorder" }],
          suppliers: [
            { resource: "Beer", from: "external", leadTime: { kind: "fixed", value: 2 * DAY } },
          ],
          review: { periodMs: DAY },
        },
      ],
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.scenario;
  };

  /**
   * Reviews a station with stock 3000, 2000 on order and 1000 backordered, by passing the
   * policy a context with those quantities at the shop's first review.
   */
  const reviewWith = (target: string) =>
    run(
      `local policy = ops.policy { review = { target = ${target} } }
      return { on_review = function(ctx)
        if ctx.review ~= 1 then return end
        local here = {
          id = "Shop",
          suppliers = ctx.here.suppliers,
          stock = { Beer = 3000 },
          capacity = { Beer = 100000 },
          backorders = { Beer = 1000 },
          on_order = { { resource = "Beer", amount = 2000, from = "external", placed_at = 0 } },
        }
        policy.on_review({
          here = here, stations = { Shop = here }, station_order = ctx.station_order,
          order = ctx.order, memory = ctx.memory,
        })
      end }`,
      shop(),
    );

  const traces = (out: RunOutput) => ofKind(out.events, "trace").map((e) => e.trace);

  it("order up to a base-stock level from the inventory position", () => {
    const out = reviewWith("ops.order_up_to { level = 10000 }");
    expect(ofKind(out.events, "order").map((e) => e.amount)).toEqual([6000]);
    expect(traces(out)).toContainEqual(
      expect.objectContaining({
        block: "order_up_to",
        inputs: { position: 4000, level: 10_000 },
        result: 10_000,
      }),
    );
    expect(traces(out)).toContainEqual(
      expect.objectContaining({ block: "order", resource: "Beer", result: 6000 }),
    );
  });

  it("hold off under (s, S) while the position is not below the minimum", () => {
    const out = reviewWith("ops.min_max { min = 2000, max = 10000 }");
    expect(ofKind(out.events, "order")).toEqual([]);
    expect(traces(out)).toContainEqual(
      expect.objectContaining({ block: "min_max", result: "no change" }),
    );
    expect(traces(out)).toContainEqual(expect.objectContaining({ block: "order", result: 0 }));
  });

  it("keep a base-stock position at its level over a run", () => {
    const out = run(
      "return ops.policy { review = { target = ops.order_up_to { level = 10000 } } }",
      shop(),
    );
    expect(out.aborted).toBe(false);
    // The first review orders up from 3000; each later one replaces the demand since the last.
    // The review at one day comes before that minute's demand, so it has seen 1998.
    expect(ofKind(out.events, "order").map((e) => [e.t, e.amount])).toEqual([
      [0, 7000],
      [DAY, 1998],
      [2 * DAY, 2000],
      [3 * DAY, 2000],
      [4 * DAY, 2000],
      [5 * DAY, 2000],
    ]);
  });

  it("need a target in the review table", () => {
    const out = run("return ops.policy { review = {} }", shop());
    expect(loadError(out)?.message).toBe("ops.policy: review needs a target");
  });
});

describe("the ops library", () => {
  it("passes the policy language checks", () => {
    expect(checkPolicySource(OPS_LIBRARY.ops)).toEqual([]);
  });

  it("counts towards the instruction budget", () => {
    // Even building the policy runs library loops, so a tiny budget fails at load.
    const out = run(
      "return ops.policy { target = ops.balance {} }",
      line([station("A", 10_000, 400), station("B", 0)]),
      { budget: 5 },
    );
    expect(ofKind(out.events, "error")[0]?.message).toContain("instruction budget exceeded");
  });
});
