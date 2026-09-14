import { runSimulation, starterScenarios, validateScenario } from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
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
