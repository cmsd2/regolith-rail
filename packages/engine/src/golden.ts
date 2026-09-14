import { hashRun } from "./hash.ts";
import type { RunOutput } from "./output.ts";
import type { Policy } from "./policy.ts";
import type { Scenario } from "./scenario/format2.ts";
import { starterScenarios } from "./scenario/starters.ts";
import { validateScenario } from "./scenario/validate.ts";
import { runSimulation } from "./simulate.ts";

/** Seeds every determinism check runs each scenario and policy with. */
export const GOLDEN_SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Policies in the determinism matrix: the TypeScript reference and the shipped Lua baseline. */
export const GOLDEN_POLICIES = ["reference:balance-stock", "lua:balance-stock"] as const;

export interface GoldenEntry {
  key: string;
  policy: string;
  scenario: string;
  seed: number;
}

/** The determinism matrix shared by the CLI golden file and the browser tests. */
export function goldenMatrix(
  scenarios: readonly string[],
  policies: readonly string[],
): GoldenEntry[] {
  const entries: GoldenEntry[] = [];
  for (const policy of policies) {
    for (const scenario of scenarios) {
      for (const seed of GOLDEN_SEEDS) {
        entries.push({ key: `${policy}/${scenario}/${seed}`, policy, scenario, seed });
      }
    }
  }
  return entries;
}

/** A starter scenario from its recorded document. */
export function starterScenario(id: string): Scenario {
  const starter = starterScenarios.find((s) => s.id === id);
  const result = validateScenario(starter?.document);
  if (!result.ok) throw new Error(`starter ${id} is invalid`);
  return result.scenario;
}

/**
 * Runs the whole matrix and returns result hashes by key. `scenarioFor` supplies each starter,
 * from its recorded document by default.
 */
export function runGoldenMatrix(
  makePolicy: (name: string) => Policy,
  scenarioFor: (id: string) => Scenario = starterScenario,
): Record<string, string> {
  return runGoldenMatrixWith(makePolicy, { hash: hashRun }, scenarioFor).hash as Record<
    string,
    string
  >;
}

/** Runs the matrix once and hashes every result with each of several hash functions. */
export function runGoldenMatrixWith<Name extends string>(
  makePolicy: (name: string) => Policy,
  hashers: Record<Name, (output: RunOutput) => string>,
  scenarioFor: (id: string) => Scenario = starterScenario,
): Record<Name, Record<string, string>> {
  const names = Object.keys(hashers) as Name[];
  const hashes = Object.fromEntries(names.map((name) => [name, {}])) as Record<
    Name,
    Record<string, string>
  >;
  const policies = new Map<string, Policy>();
  for (const entry of goldenMatrix(
    starterScenarios.map((s) => s.id),
    GOLDEN_POLICIES,
  )) {
    const scenario = scenarioFor(entry.scenario);
    let policy = policies.get(entry.policy);
    if (!policy) {
      policy = makePolicy(entry.policy);
      policies.set(entry.policy, policy);
    }
    const output = runSimulation(scenario, policy, { seed: entry.seed });
    for (const name of names) {
      const table: Record<string, string> = hashes[name];
      table[entry.key] = hashers[name](output);
    }
  }
  return hashes;
}
