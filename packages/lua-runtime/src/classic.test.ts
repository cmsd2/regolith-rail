import { type RunEvent, type RunOutput, runSimulation, type Scenario } from "@regolith-rail/engine";
import {
  classicTemplates,
  constructs,
  type TemplateParams,
  templateCall,
} from "@regolith-rail/scenario-kit";
import { beforeAll, describe, expect, it } from "vitest";
import { type LuaPolicy, LuaRuntime } from "./policy.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const DAY = 86_400_000;

const load = (source: string): Scenario => {
  const result = runtime.loadScript(source);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.scenario;
};

const template = (name: string) => {
  const found = classicTemplates.find((t) => t.name === name);
  if (!found) throw new Error(name);
  return found;
};

const ofKind = <K extends RunEvent["kind"]>(events: RunEvent[], kind: K) =>
  events.filter((e): e is RunEvent & { kind: K } => e.kind === kind);

function referencePolicy(name: string, params: TemplateParams): LuaPolicy {
  const policy = runtime.createPolicy(template(name).reference(params).policy);
  if (policy.error) throw new Error(policy.error.message);
  return policy;
}

/** Mean and 99% confidence half-width of per-seed values. */
function interval(values: number[]) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1);
  return { mean, half: 2.576 * Math.sqrt(variance / n) };
}

const errorsIn = (out: RunOutput) => ofKind(out.events, "error");

describe("classic templates", () => {
  for (const t of classicTemplates) {
    it(`${t.name} applies the defaults its description states`, () => {
      const bare = runtime.evaluateScript(`return ${t.name} {}`);
      const stated = runtime.evaluateScript(templateCall(t.name, t.defaults));
      expect(bare.ok && stated.ok).toBe(true);
      expect(bare.ok && bare.document).toEqual(stated.ok && stated.document);
      // The Lua library names the same page as the construct's description.
      expect(load(`return ${t.name} {}`).docs).toBe(
        constructs.find((c) => c.name === t.name)?.docs,
      );
    });

    it(`${t.name} runs with its reference policy`, () => {
      const scenario = load(`return ${t.name} {}`);
      const out = runSimulation(scenario, referencePolicy(t.name, {}), { detail: "summary" });
      expect(out.aborted).toBe(false);
      expect(errorsIn(out)).toEqual([]);
    });
  }
});

describe("newsvendor", () => {
  it("describes one station with expiring stock, demand per period and a daily review", () => {
    const scenario = load("return classic.newsvendor {}");
    expect(scenario.stations).toHaveLength(1);
    const stand = scenario.stations[0];
    expect(stand?.resources[0]).toMatchObject({ capacity: "unlimited", expires: true });
    expect(stand?.consumers[0]?.perPeriod).toEqual({
      periodMs: DAY,
      amount: {
        kind: "discrete",
        values: [5, 10, 15, 20, 25].map((v, i) => ({
          value: v * 1000,
          weight: [1, 2, 3, 2, 1][i],
        })),
      },
    });
    expect(stand?.review).toEqual({ periodMs: DAY, offsetMs: 60_000 });
  });

  it("reaches the analytic expected cost at the critical-ratio quantity over 400 seeds", () => {
    const params = {};
    const reference = template("classic.newsvendor").reference(params);
    expect(reference.values.quantity).toBe(15);
    const scenario = load(templateCall("classic.newsvendor", params));
    const policy = referencePolicy("classic.newsvendor", params);
    const periods = 30;
    const perPeriod = Array.from({ length: 400 }, (_, i) => {
      const out = runSimulation(scenario, policy, { seed: i + 1, detail: "summary" });
      return out.metrics.costs.total / 1000 / periods;
    });
    const { mean, half } = interval(perPeriod);
    expect(Math.abs(mean - (reference.expectedCostPerPeriod as number))).toBeLessThan(half);
  }, 120_000);
});

describe("reorder", () => {
  it("costs the economic order quantity's analytic cost with steady demand and no lead time", () => {
    const params = { review_period: 60_000 };
    const reference = template("classic.reorder").reference(params);
    expect(reference.values.quantity).toBeCloseTo(20, 9);
    const scenario = load(templateCall("classic.reorder", params));
    const out = runSimulation(scenario, referencePolicy("classic.reorder", params), {
      detail: "summary",
    });
    const perDay = out.metrics.costs.total / 1000 / 20;
    expect(Math.abs(perDay - (reference.expectedCostPerDay as number))).toBeLessThan(1);
    expect(out.metrics.unmetDemand).toBe(0);
  }, 120_000);

  it("reaches the analytic expected cost of a base-stock policy with random demand", () => {
    const params = {
      random: true,
      demand: 4,
      lead_time: 2 * DAY,
      review_period: 6 * 3_600_000,
      order_cost: 0,
      duration: 30 * DAY,
    };
    const reference = template("classic.reorder").reference(params);
    const scenario = load(templateCall("classic.reorder", params));
    const policy = referencePolicy("classic.reorder", params);
    const perDay = Array.from({ length: 200 }, (_, i) => {
      const out = runSimulation(scenario, policy, { seed: i + 1, detail: "summary" });
      return out.metrics.costs.total / 1000 / 30;
    });
    const { mean, half } = interval(perDay);
    expect(Math.abs(mean - (reference.expectedCostPerDay as number))).toBeLessThan(half);
  }, 180_000);
});

describe("serial chain", () => {
  it("puts stations in series, each supplied by the one before with the lead time", () => {
    const scenario = load("return classic.serial_chain { stages = 4, lead_time = weeks(2) }");
    expect(scenario.stations.map((s) => s.id)).toEqual(["Stage1", "Stage2", "Stage3", "Stage4"]);
    expect(scenario.stations.map((s) => s.suppliers[0]?.from)).toEqual([
      "external",
      "Stage1",
      "Stage2",
      "Stage3",
    ]);
    for (const station of scenario.stations) {
      expect(station.suppliers[0]?.leadTime).toEqual({ kind: "fixed", value: 14 * DAY });
    }
    expect(scenario.stations[3]?.consumers).toHaveLength(1);
  });

  it("conserves beer through orders, shipments and demand", () => {
    const scenario = load("return classic.serial_chain {}");
    const initial = scenario.stations.length * 12_000;
    runSimulation(scenario, referencePolicy("classic.serial_chain", {}), {
      detail: "summary",
      inspect: (state, totals) => {
        const held = state.stock.reduce((a, b) => a + b, 0) + (totals.inTransit[0] as number);
        const expected = initial + (totals.supplied[0] as number) - (totals.consumed[0] as number);
        if (held !== expected) throw new Error(`beer not conserved: ${held} != ${expected}`);
      },
    });
  });

  it("amplifies the variance of orders upstream under a moving-average order-up-to policy", () => {
    const scenario = load("return classic.serial_chain {}");
    const policy = referencePolicy("classic.serial_chain", {});
    const stages = ["Stage1", "Stage2", "Stage3", "Stage4"];
    const variances = stages.map(() => 0);
    for (let seed = 1; seed <= 20; seed++) {
      const out = runSimulation(scenario, policy, { seed, detail: "summary" });
      expect(errorsIn(out)).toEqual([]);
      stages.forEach((stage, i) => {
        // Daily order sizes after a warm-up, with a zero for each review without an order.
        const reviews = ofKind(out.events, "review").filter(
          (e) => e.station === stage && e.t >= 10 * DAY,
        );
        const orders = new Map(
          ofKind(out.events, "order")
            .filter((e) => e.station === stage)
            .map((e) => [e.review, e.amount]),
        );
        const sizes = reviews.map((r) => (orders.get(r.review) ?? 0) / 1000);
        const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
        variances[i] =
          (variances[i] as number) +
          sizes.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (sizes.length - 1);
      });
    }
    // Customer demand of 2, 4 or 6 a day with weights 1, 2, 1 has a variance of 2.
    expect(variances[3] as number).toBeGreaterThan(2 * 20);
    for (let i = 0; i < 3; i++) {
      expect(variances[i] as number, stages[i]).toBeGreaterThan(variances[i + 1] as number);
    }
  }, 120_000);
});

describe("fixed-route delivery", () => {
  it("matches a trace worked out by hand", () => {
    // Two customers holding 10 of 20 with no demand, legs of 600 at speed 5 (120 s each),
    // 10 s at each stop plus 1 s per unit moved, and a depot holding 20.
    const scenario = load(
      "return classic.fixed_route_delivery { customers = 2, demand = 0, depot_initial = 20 }",
    );
    const out = runSimulation(scenario, referencePolicy("classic.fixed_route_delivery", {}), {
      detail: "full",
    });
    const trace = out.events
      .filter((e) => e.t <= 440_000)
      .flatMap((e) => {
        if (e.kind === "arrival") return [`${e.t} arrive ${e.station}`];
        if (e.kind === "departure")
          return [`${e.t} leave ${e.station} for ${e.to} at ${e.arriveAt}`];
        if (e.kind === "transfer")
          return [`${e.t} ${e.amount > 0 ? "load" : "unload"} ${Math.abs(e.amount)}`];
        if (e.kind === "order") return [`${e.t} order ${e.amount}`];
        return [];
      });
    expect(trace).toEqual([
      // The customers ahead are short 10 each, so the truck loads 20: 10 s + 20 s at the depot.
      "0 arrive Depot",
      "0 load 20000",
      "30000 leave Depot for Customer1 at 150000",
      // The first review, a minute in, orders up to the customers' storage of 40.
      "60000 order 40000",
      "150000 arrive Customer1",
      "150000 unload 10000",
      "170000 leave Customer1 for Customer2 at 290000",
      "290000 arrive Customer2",
      "290000 unload 10000",
      "310000 leave Customer2 for Depot at 430000",
      // Nobody is short, so the truck loads nothing and waits only the 10 s.
      "430000 arrive Depot",
      "440000 leave Depot for Customer1 at 560000",
    ]);
  });

  it("draws its customers on a loop of arcs with the trucks", () => {
    const scenario = load("return classic.fixed_route_delivery { customers = 3, vehicles = 2 }");
    expect(scenario.arcs.map((a) => `${a.from}-${a.to}`)).toEqual([
      "Depot-Customer1",
      "Customer1-Customer2",
      "Customer2-Customer3",
      "Customer3-Depot",
    ]);
    expect(scenario.vehicles.map((v) => v.route)).toEqual([
      { kind: "loop", stops: ["Depot", "Customer1", "Customer2", "Customer3"], start: "Depot" },
      { kind: "loop", stops: ["Depot", "Customer1", "Customer2", "Customer3"], start: "Customer1" },
    ]);
  });
});
