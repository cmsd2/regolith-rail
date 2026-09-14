import { runSimulation, starterScenarios, validateScenario } from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { templateCall } from "@regolith-rail/scenario-kit";
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
