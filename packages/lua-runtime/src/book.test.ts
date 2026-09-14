import { runSimulation, starterScenarios, validateScenario } from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { classicTemplates, templateCall } from "@regolith-rail/scenario-kit";
import { beforeAll, describe, expect, it } from "vitest";
import { LuaRuntime } from "./policy.ts";

// Claims the book's chapters make about the simulator, referred to from the chapters by title.

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

function metricsOver(scenarioId: string, source: string, seeds: number) {
  const result = validateScenario(starterScenarios.find((s) => s.id === scenarioId)?.document);
  if (!result.ok) throw new Error(`invalid starter ${scenarioId}`);
  const policy = runtime.createPolicy(source);
  try {
    return Array.from(
      { length: seeds },
      (_, i) => runSimulation(result.scenario, policy, { seed: i + 1, detail: "summary" }).metrics,
    );
  } finally {
    policy.close();
  }
}

describe("chapter 1, modelling operations", () => {
  it("on two-station the naive baseline leaves demand unmet while the mine's production stalls, on each of 20 seeds", () => {
    for (const metrics of metricsOver("two-station", BUILT_IN_POLICIES.naive, 20)) {
      expect(metrics.unmetDemand).toBeGreaterThan(0);
      expect(metrics.stalledProduction).toBeGreaterThan(0);
    }
  });

  it("on two-station taking everything from the mine and leaving everything at the dome meets all demand on each of 20 seeds", () => {
    const fix = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {} },
}`;
    for (const metrics of metricsOver("two-station", fix, 20)) {
      expect(metrics.unmetDemand).toBe(0);
      expect(metrics.policyErrors).toBe(0);
    }
  });
});

const DAY = 86_400_000;

/** Mean and sample standard deviation. */
function spread(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (values.length - 1);
  return { mean, sd: Math.sqrt(variance) };
}

describe("chapter 2, randomness and simulation", () => {
  it("comparing base-stock levels 13 and 15 on the same 100 seeds, paired differences spread less than half as much as independent runs, and level 15 costs more", () => {
    const params = {
      random: true,
      demand: 4,
      lead_time: 2 * DAY,
      review_period: 6 * 3_600_000,
      order_cost: 0,
      duration: 30 * DAY,
    };
    const loaded = runtime.loadScript(templateCall("classic.reorder", params));
    if (!loaded.ok) throw new Error("the template should evaluate");
    const costs = (level: number) => {
      const policy = runtime.createPolicy(
        `return ops.policy { review = { target = ops.order_up_to { level = ${level * 1000} } } }`,
      );
      try {
        return Array.from({ length: 100 }, (_, i) => {
          const out = runSimulation(loaded.scenario, policy, { seed: i + 1, detail: "summary" });
          return out.metrics.costs.total / 1000 / 30;
        });
      } finally {
        policy.close();
      }
    };
    const a = costs(13);
    const b = costs(15);
    const difference = spread(b.map((cost, i) => cost - (a[i] as number)));
    const sdA = spread(a).sd;
    const sdB = spread(b).sd;
    const independent = Math.sqrt(sdA * sdA + sdB * sdB);
    expect(difference.sd).toBeLessThan(independent / 2);
    // t for 99 degrees of freedom at 97.5%.
    const half = (1.984 * difference.sd) / 10;
    expect(difference.mean - half).toBeGreaterThan(0);
  }, 300_000);
});

describe("chapter 3, reviews, lead times and base-stock", () => {
  const params = {
    random: true,
    demand: 4,
    lead_time: 2 * DAY,
    review_period: 6 * 3_600_000,
    order_cost: 0,
    duration: 30 * DAY,
  };

  it("the reorder template's base-stock reference for 4 a day, a 2-day lead time and 6-hour reviews orders up to 13 and expects 7.97 a day", () => {
    const reference = classicTemplates.find((t) => t.name === "classic.reorder")?.reference(params);
    expect(reference?.values.level).toBe(13);
    expect(Math.round((reference?.expectedCostPerDay as number) * 100) / 100).toBe(7.97);
  });

  it("on classic.reorder with random demand, ordering up to 13 from stock on hand costs more than five times as much a day as ordering up to 13 from the inventory position, on seeds 1 to 100", () => {
    const loaded = runtime.loadScript(templateCall("classic.reorder", params));
    if (!loaded.ok) throw new Error("the template should evaluate");
    const costPerDay = (source: string) => {
      const policy = runtime.createPolicy(source);
      try {
        const total = Array.from({ length: 100 }, (_, i) => {
          const out = runSimulation(loaded.scenario, policy, { seed: i + 1, detail: "summary" });
          return out.metrics.costs.total / 1000 / 30;
        }).reduce((a, b) => a + b, 0);
        return total / 100;
      } finally {
        policy.close();
      }
    };
    const position = costPerDay(
      "return ops.policy { review = { target = ops.order_up_to { level = 13000 } } }",
    );
    const onHand = costPerDay(`return { on_review = function(ctx)
  local short = 13000 - ctx.here.stock.Goods
  if short > 0 then ctx.order("Goods", short) end
end }`);
    expect(onHand).toBeGreaterThan(5 * position);
  }, 300_000);
});

describe("chapter 5, order quantities", () => {
  it("on steady-demand classic.reorder reviewed every minute, ordering 10 or 40 at a time costs 25 a day, and ordering 20 costs 20, each within one cost unit", () => {
    const loaded = runtime.loadScript(templateCall("classic.reorder", { review_period: 60_000 }));
    if (!loaded.ok) throw new Error("the template should evaluate");
    const costPerDay = (quantity: number) => {
      // Reorder when the position falls below what one minute of demand needs.
      const policy = runtime.createPolicy(
        `return ops.policy { review = { target = ops.min_max { min = 7, max = ${7 + quantity * 1000} } } }`,
      );
      try {
        const out = runSimulation(loaded.scenario, policy, { detail: "summary" });
        expect(out.metrics.unmetDemand).toBe(0);
        return out.metrics.costs.total / 1000 / 20;
      } finally {
        policy.close();
      }
    };
    expect(Math.abs(costPerDay(20) - 20)).toBeLessThan(1);
    expect(Math.abs(costPerDay(10) - 25)).toBeLessThan(1);
    expect(Math.abs(costPerDay(40) - 25)).toBeLessThan(1);
  }, 120_000);
});
