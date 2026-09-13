import { writeFileSync } from "node:fs";
import {
  goldenMatrix,
  hashRun,
  naiveReferencePolicy,
  runSimulation,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";

export const DEFAULT_GOLDEN_PATH = new URL(
  "../../../tests/determinism/golden.json",
  import.meta.url,
);

/** Result hashes for the determinism matrix, keyed `policy/scenario/seed`. */
export function computeGolden(): Record<string, string> {
  const hashes: Record<string, string> = {};
  const policies = { "reference:naive": naiveReferencePolicy };
  for (const entry of goldenMatrix(
    starterScenarios.map((s) => s.id),
    Object.keys(policies),
  )) {
    const starter = starterScenarios.find((s) => s.id === entry.scenario);
    const result = validateScenario(starter?.document);
    if (!result.ok) throw new Error(`starter ${entry.scenario} is invalid`);
    const policy = policies[entry.policy as keyof typeof policies]();
    hashes[entry.key] = hashRun(runSimulation(result.scenario, policy, { seed: entry.seed }));
  }
  return hashes;
}

export function writeGolden(out?: string): string {
  const target = out ?? DEFAULT_GOLDEN_PATH;
  writeFileSync(target, `${JSON.stringify(computeGolden(), null, 2)}\n`);
  return typeof target === "string" ? target : target.pathname;
}
