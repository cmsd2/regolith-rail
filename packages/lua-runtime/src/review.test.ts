import {
  type RunEvent,
  runSimulation,
  type Scenario,
  type ScenarioV2Input,
  validateScenario,
} from "@regolith-rail/engine";
import { beforeAll, describe, expect, it } from "vitest";
import { LuaRuntime } from "./policy.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const ofKind = <K extends RunEvent["kind"]>(events: RunEvent[], kind: K) =>
  events.filter((e): e is RunEvent & { kind: K } => e.kind === kind);

function parse(input: ScenarioV2Input): Scenario {
  const result = validateScenario(input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.scenario;
}

/** A shop reviewed daily with an external Beer supplier, and no vehicles. */
const shop = (change: (s: ScenarioV2Input) => void = () => {}) => {
  const input: ScenarioV2Input = {
    format: 2,
    id: "shop",
    title: "Shop",
    description: "A shop ordering beer.",
    durationMs: 3 * DAY,
    seed: 1,
    informationLevel: "local",
    resources: [{ id: "Beer" }],
    stockPoints: [
      {
        id: "Shop",
        resources: [{ id: "Beer", capacity: 100_000 }],
        consumers: [{ resource: "Beer", rate: 2000, unmet: "backorder" }],
        suppliers: [
          { resource: "Beer", from: "external", leadTime: { kind: "fixed", value: DAY } },
        ],
        review: { periodMs: DAY },
      },
    ],
  };
  change(input);
  return parse(input);
};

/** Depot, A and B in a loop, with one vehicle. */
const loop = (level: "local" | "line") =>
  parse({
    format: 2,
    id: "loop",
    title: "Loop",
    description: "A loop.",
    durationMs: HOUR,
    seed: 1,
    informationLevel: level,
    resources: [{ id: "Metals" }],
    stockPoints: [
      { id: "Depot", resources: [{ id: "Metals" }] },
      { id: "A", resources: [{ id: "Metals" }] },
      { id: "B", resources: [{ id: "Metals" }] },
    ],
    arcs: [
      { from: "Depot", to: "A", distance: 100 },
      { from: "A", to: "B", distance: 100 },
      { from: "B", to: "Depot", distance: 100 },
    ],
    vehicles: [
      {
        id: "V",
        route: { kind: "loop", stops: ["Depot", "A", "B"] },
        speed: 10,
        capacity: { shared: 1000 },
      },
    ],
  });

const run = (source: string, scenario: Scenario) =>
  runSimulation(scenario, runtime.createPolicy(source), { detail: "summary" });

describe("review hook", () => {
  it("places orders with ctx.order", () => {
    const out = run(
      `return {
        on_review = function(ctx)
          if ctx.review == 1 then ctx.order("Beer", 5000) end
        end,
      }`,
      shop(),
    );
    expect(out.aborted).toBe(false);
    expect(ofKind(out.events, "order")).toMatchObject([
      { station: "Shop", resource: "Beer", from: "external", amount: 5000 },
    ]);
  });

  it("sees the stock point, its orders, suppliers and backorders", () => {
    const out = run(
      `return {
        on_review = function(ctx)
          local point = ctx.stock_point
          if ctx.review == 1 then ctx.order("Beer", 5000) end
          if ctx.review == 2 then
            ctx.log(point.id, #point.on_order, point.on_order[1].arrives_at,
              point.suppliers[1].from, point.suppliers[1].lead_times[1].value,
              point.backorders.Beer)
          end
        end,
      }`,
      // A two-day lead time keeps the first order on its way at the second review.
      shop((input) => {
        const supplier = input.stockPoints[0]?.suppliers?.[0];
        if (supplier) supplier.leadTime = { kind: "fixed", value: 2 * DAY };
      }),
    );
    // The review at one day comes before that minute's demand: 1439 minutes of 2000 a sol.
    expect(ofKind(out.events, "log").map((e) => e.message)).toEqual([
      `Shop 1 ${2 * DAY} external ${2 * DAY} 1998`,
    ]);
  });

  it("keeps stock point memory between reviews", () => {
    const out = run(
      `return {
        on_review = function(ctx)
          local m = ctx.stock_point.memory
          m.count = (m.count or 0) + 1
          ctx.log(m.count)
        end,
      }`,
      shop(),
    );
    expect(ofKind(out.events, "log").map((e) => e.message)).toEqual(["1", "2", "3"]);
  });

  it("requires on_review when the scenario has reviews", () => {
    const out = run("return { on_stop = function(ctx) end }", shop());
    expect(out.aborted).toBe(true);
    expect(ofKind(out.events, "error")[0]).toMatchObject({
      errorKind: "load",
      message: "the policy's table has no on_review function; on_review is required",
    });
  });

  it("requires on_stop when the scenario has vehicles", () => {
    const out = run("return { on_review = function(ctx) end }", loop("line"));
    expect(out.aborted).toBe(true);
    expect(ofKind(out.events, "error")[0]?.message).toBe(
      "the policy's table has no on_stop function; on_stop is required",
    );
  });

  it("rejects a policy with no hooks at all", () => {
    const out = run(
      "return {}",
      shop((s) => delete s.stockPoints[0]?.review),
    );
    expect(ofKind(out.events, "error")[0]?.message).toBe(
      "the policy's table has no hook functions; define on_stop, on_review or on_start",
    );
  });

  it("checks ctx.order's arguments", () => {
    const out = run(`return { on_review = function(ctx) ctx.order(5000) end }`, shop());
    expect(ofKind(out.events, "error")[0]?.message).toContain(
      "ctx.order expects a resource id as its first argument",
    );
  });
});

describe("route context", () => {
  it("lists the stops ahead on a loop", () => {
    const out = run(
      `return {
        on_stop = function(ctx)
          if ctx.station.id == "A" and ctx.stop == 2 then
            local parts = { ctx.route.kind }
            for _, stop in ipairs(ctx.route.ahead) do
              parts[#parts + 1] = stop.id .. "@" .. stop.distance
            end
            ctx.log(table.concat(parts, " "))
          end
        end,
      }`,
      loop("line"),
    );
    expect(ofKind(out.events, "log").map((e) => e.message)).toEqual(["loop B@100 Depot@200"]);
  });

  it("gives the network's arcs at the line level", () => {
    const out = run(
      `return { on_stop = function(ctx) if ctx.stop == 1 then ctx.log(#ctx.network.arcs) end end }`,
      loop("line"),
    );
    expect(ofKind(out.events, "log")[0]?.message).toBe("3");
  });

  it("refuses the network at the local level", () => {
    const out = run(
      `return { on_stop = function(ctx) local n = ctx.network.arcs end }`,
      loop("local"),
    );
    expect(ofKind(out.events, "error")[0]?.message).toContain(
      "reading the network requires the line information level",
    );
  });
});
