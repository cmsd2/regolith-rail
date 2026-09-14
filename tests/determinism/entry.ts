import {
  naiveReferencePolicy,
  runGoldenMatrix,
  runSimulation,
  type Scenario,
  starterScenario,
  starterScenarios,
  validateScenario,
} from "../../packages/engine/src/index.ts";
import wasmUrl from "../../packages/lua-runtime/node_modules/wasmoon/dist/glue.wasm?url";
import { LuaRuntime } from "../../packages/lua-runtime/src/index.ts";
import { BUILT_IN_POLICIES } from "../../packages/policy-api/src/index.ts";
import { STARTER_SCRIPTS } from "../../packages/scenario-kit/src/index.ts";

/**
 * Runs the determinism matrix in the browser and returns the result hashes, with the starters
 * from their recorded documents or, with `fromScripts`, evaluated from their Mars scripts.
 */
async function runDeterminismMatrix(fromScripts = false): Promise<Record<string, string>> {
  const runtime = await LuaRuntime.load(wasmUrl);
  const scenarioFor = (id: string): Scenario => {
    if (!fromScripts) return starterScenario(id);
    const result = runtime.loadScript(STARTER_SCRIPTS[id] as string);
    if (!result.ok) throw new Error(`starter script ${id}: ${JSON.stringify(result.errors)}`);
    return result.scenario;
  };
  return runGoldenMatrix((name) => {
    if (name === "reference:naive") return naiveReferencePolicy();
    if (name === "lua:naive") return runtime.createPolicy(BUILT_IN_POLICIES.naive);
    throw new Error(`unknown policy ${name}`);
  }, scenarioFor);
}

/** Times a batch of `naive.lua` runs on one starter scenario, for performance checks. */
async function benchmarkNaiveBatch(scenarioId: string, seeds: number): Promise<number> {
  const runtime = await LuaRuntime.load(wasmUrl);
  const starter = starterScenarios.find((s) => s.id === scenarioId);
  const result = validateScenario(starter?.document);
  if (!result.ok) throw new Error(`unknown starter ${scenarioId}`);
  const policy = runtime.createPolicy(BUILT_IN_POLICIES.naive);
  const started = performance.now();
  for (let seed = 1; seed <= seeds; seed++) {
    runSimulation(result.scenario, policy, { seed, detail: "summary" });
  }
  return performance.now() - started;
}

Object.assign(globalThis, { runDeterminismMatrix, benchmarkNaiveBatch });
