import { runSimulation, starterScenarios, validateScenario } from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { beforeAll, describe, expect, it } from "vitest";
import { LuaRuntime } from "./policy.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const SEEDS = 100;

function means(source: string, scenarioId: string) {
  const result = validateScenario(starterScenarios.find((s) => s.id === scenarioId)?.document);
  if (!result.ok) throw new Error(`invalid starter ${scenarioId}`);
  const policy = runtime.createPolicy(source);
  let unmet = 0;
  let oscillations = 0;
  let errors = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { metrics } = runSimulation(result.scenario, policy, { seed, detail: "summary" });
    unmet += metrics.unmetDemandWeighted;
    oscillations += metrics.oscillations;
    errors += metrics.policyErrors;
  }
  return { unmet: unmet / SEEDS, oscillations: oscillations / SEEDS, errors };
}

describe("supply-to-demand example", () => {
  for (const scenario of ["two-trains", "mixed-line"]) {
    it(`beats the naive baseline on ${scenario} over ${SEEDS} seeds`, () => {
      const naive = means(BUILT_IN_POLICIES.naive, scenario);
      const example = means(BUILT_IN_POLICIES["supply-to-demand"], scenario);
      expect(example.errors).toBe(0);
      expect(example.unmet).toBeLessThan(naive.unmet);
      expect(example.oscillations).toBeLessThan(naive.oscillations);
    }, 600_000);
  }
});
