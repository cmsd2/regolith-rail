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
import type { LuaRuntime } from "@regolith-rail/lua-runtime";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";

export class CliError extends Error {}

/** Whether loading `spec` needs the Lua runtime: scenario scripts and templates do. */
export const scenarioNeedsLua = (spec: string) => spec.endsWith(".lua");

/** A template call as a one-line script, from `name=value` parameters. */
export function templateScript(name: string, params: string[]): string {
  if (!/^[a-z]\w*(\.[a-z]\w*)+$/.test(name)) {
    throw new CliError(`template names look like classic.reorder, not ${name}`);
  }
  const fields = params.map((param) => {
    const match = /^([a-z_]\w*)=(.*)$/s.exec(param);
    if (!match) throw new CliError(`template parameters look like name=value, not ${param}`);
    const [, key, value = ""] = match;
    // Numbers, booleans and unit helper calls pass through; anything else is a string.
    const literal =
      /^-?\d+(\.\d+)?$/.test(value) ||
      value === "true" ||
      value === "false" ||
      /^(units|minutes|hours|sols|days|weeks)\(-?\d+(\.\d+)?\)$/.test(value)
        ? value
        : `"${value.replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n")}"`;
    return `${key} = ${literal}`;
  });
  return `return ${name} { ${fields.join(", ")} }`;
}

/** Evaluates a scenario script, reporting errors at its lines. */
export function loadScriptScenario(source: string, label: string, runtime: LuaRuntime): Scenario {
  const result = runtime.loadScript(source);
  if (!result.ok) {
    throw new CliError(
      [
        `${label} is not a valid scenario:`,
        ...result.errors.map((e) => {
          const where = [e.line === undefined ? "" : `${label}:${e.line}`, e.path ?? ""]
            .filter(Boolean)
            .join(" ");
          return `  ${where ? `${where}: ` : ""}${e.message}`;
        }),
      ].join("\n"),
    );
  }
  return result.scenario;
}

/**
 * Loads a starter scenario by id, a scenario document from a JSON file, or a scenario script
 * from a `.lua` file.
 */
export function loadScenario(spec: string, runtime?: LuaRuntime): Scenario {
  if (scenarioNeedsLua(spec)) {
    let source: string;
    try {
      source = readFileSync(spec, "utf8");
    } catch {
      throw new CliError(`cannot read scenario script ${spec}`);
    }
    if (!runtime) throw new Error(`the Lua runtime is needed to load ${spec}`);
    return loadScriptScenario(source, spec, runtime);
  }
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

const REFERENCE_POLICIES: Record<string, () => Policy> = {
  "reference:naive": naiveReferencePolicy,
};

export const POLICY_HELP = [
  ...Object.keys(REFERENCE_POLICIES),
  ...Object.keys(BUILT_IN_POLICIES).map((name) => `lua:${name}`),
  "path/to/policy.lua",
].join(", ");

/**
 * Resolves a policy: a TypeScript reference (`reference:naive`), a built-in
 * Lua policy (`lua:naive`), or a Lua file. Lua that cannot load is reported
 * before any run starts.
 */
export function resolvePolicy(spec: string, runtime: LuaRuntime | undefined): Policy {
  const reference = REFERENCE_POLICIES[spec];
  if (reference) return reference();

  let source: string;
  let label = spec;
  if (spec.startsWith("lua:")) {
    const name = spec.slice(4);
    const builtIn = (BUILT_IN_POLICIES as Record<string, string>)[name];
    if (builtIn === undefined)
      throw new CliError(`unknown policy ${spec} (policies: ${POLICY_HELP})`);
    source = builtIn;
  } else if (spec.endsWith(".lua")) {
    try {
      source = readFileSync(spec, "utf8");
    } catch {
      throw new CliError(`cannot read policy file ${spec}`);
    }
    label = spec;
  } else {
    throw new CliError(`unknown policy ${spec} (policies: ${POLICY_HELP})`);
  }

  if (!runtime) throw new Error(`the Lua runtime is needed to load ${spec}`);
  const policy = runtime.createPolicy(source);
  if (policy.error) {
    const where = policy.error.line === undefined ? label : `${label}:${policy.error.line}`;
    throw new CliError(`${where}: ${policy.error.message}`);
  }
  return policy;
}

/** Whether resolving `spec` needs the Lua runtime. */
export const needsLua = (spec: string) => !(spec in REFERENCE_POLICIES);

/** Run output as plain JSON: everything except the per-tick arrays, plus the result hash. */
export function toJson(output: RunOutput) {
  const { stock: _stock, cargo: _cargo, backorders: _backorders, ...rest } = output;
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
