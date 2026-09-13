import { readFileSync } from "node:fs";
import {
  type Detail,
  hashRun,
  naiveReferencePolicy,
  type Policy,
  type RunOutput,
  runSimulation,
  type Scenario,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";

export class CliError extends Error {}

/** Loads a starter scenario by id, or a scenario document from a JSON file. */
export function loadScenario(spec: string): Scenario {
  const starter = starterScenarios.find((s) => s.id === spec);
  let document: unknown = starter?.document;
  if (document === undefined) {
    let text: string;
    try {
      text = readFileSync(spec, "utf8");
    } catch {
      const ids = starterScenarios.map((s) => s.id).join(", ");
      throw new CliError(`no starter scenario or file named ${spec} (starters: ${ids})`);
    }
    try {
      document = JSON.parse(text);
    } catch (error) {
      throw new CliError(`${spec} is not valid JSON: ${(error as Error).message}`);
    }
  }
  const result = validateScenario(document);
  if (!result.ok) {
    throw new CliError(
      [
        `${spec} is not a valid scenario:`,
        ...result.errors.map((e) => `  ${e.path}: ${e.message}`),
      ].join("\n"),
    );
  }
  return result.scenario;
}

export type PolicyLoader = (spec: string, scenario: Scenario) => Policy;

const builtIn: Record<string, () => Policy> = {
  "reference:naive": naiveReferencePolicy,
};

/** Resolves built-in reference policies; Lua files are handled by loaders passed in. */
export function loadPolicy(spec: string, scenario: Scenario, loaders: PolicyLoader[] = []): Policy {
  const make = builtIn[spec];
  if (make) return make();
  for (const loader of loaders) {
    const policy = loader(spec, scenario);
    if (policy) return policy;
  }
  throw new CliError(`unknown policy ${spec} (built in: ${Object.keys(builtIn).join(", ")})`);
}

/** Run output as plain JSON: everything except the per-tick arrays, plus the result hash. */
export function toJson(output: RunOutput) {
  const { stock: _stock, cargo: _cargo, ...rest } = output;
  return { ...rest, hash: hashRun(output) };
}

export function parseSeeds(text: string): number[] {
  const range = /^(\d+)\.\.(\d+)$/.exec(text);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (to < from) throw new CliError(`seed range ${text} is empty`);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
  if (/^\d+$/.test(text)) return [Number(text)];
  throw new CliError(`seeds must be a number or a range like 1..20, not ${text}`);
}

export function runSeeds(
  scenario: Scenario,
  makePolicy: () => Policy,
  seeds: number[],
  detail: Detail,
): RunOutput[] {
  return seeds.map((seed) => runSimulation(scenario, makePolicy(), { seed, detail }));
}
