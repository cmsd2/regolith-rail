import {
  goldenMatrix,
  hashRun,
  naiveReferencePolicy,
  runSimulation,
  starterScenarios,
  validateScenario,
} from "../../packages/engine/src/index.ts";

const policies = { "reference:naive": naiveReferencePolicy };

/** Runs the determinism matrix in the browser and returns the result hashes. */
function runDeterminismMatrix(): Record<string, string> {
  const hashes: Record<string, string> = {};
  const matrix = goldenMatrix(
    starterScenarios.map((s) => s.id),
    Object.keys(policies),
  );
  for (const entry of matrix) {
    const starter = starterScenarios.find((s) => s.id === entry.scenario);
    const result = validateScenario(starter?.document);
    if (!result.ok) throw new Error(`starter ${entry.scenario} is invalid`);
    const policy = policies[entry.policy as keyof typeof policies]();
    hashes[entry.key] = hashRun(runSimulation(result.scenario, policy, { seed: entry.seed }));
  }
  return hashes;
}

Object.assign(globalThis, { runDeterminismMatrix });
