import { type Scenario, validateScenario } from "@regolith-rail/engine";
import { SCENARIO_LIBRARIES } from "@regolith-rail/scenario-kit";
import { LuaEngine, type LuaWasm } from "wasmoon";
import { checkPolicySource, instrumentPolicySource } from "./check.ts";
import { PRELUDE } from "./prelude.ts";

/** Loop iterations and function calls a scenario script may make, libraries included. */
export const EVALUATION_BUDGET = 5_000_000;

/** Largest scenario a script may produce. */
export const DOCUMENT_LIMITS = {
  stations: 500,
  arcs: 2000,
  vehicles: 200,
  events: 200,
  resources: 100,
  /** Characters of the evaluated document as JSON. */
  size: 2_000_000,
} as const;

/** An error in a scenario script, at its line when known and at a document path for validation. */
export interface ScriptError {
  message: string;
  line?: number;
  path?: string;
}

/** The line that built each part of a document, by validation path such as `stations[0]`. */
export type SourceMap = Record<string, number>;

export type Evaluation =
  | { ok: true; document: unknown; sourceMap: SourceMap; logs: string[] }
  | { ok: false; errors: ScriptError[]; logs: string[] };

export type ScriptScenario =
  | { ok: true; scenario: Scenario; document: unknown; sourceMap: SourceMap; logs: string[] }
  | { ok: false; errors: ScriptError[]; logs: string[] };

interface RawEvaluation {
  document?: unknown;
  sourceMap?: SourceMap | [];
  error?: { message: string; line?: number };
  logs?: string[];
}

let instrumented: { core: string; mars: string; classic: string } | undefined;
/** The construct libraries, instrumented once so they count towards the budget. */
function librarySources() {
  instrumented ??= {
    core: instrumentPolicySource(SCENARIO_LIBRARIES.core as string),
    mars: instrumentPolicySource(SCENARIO_LIBRARIES.mars as string),
    classic: instrumentPolicySource(SCENARIO_LIBRARIES.classic as string),
  };
  return instrumented;
}

function withState<T>(
  module: LuaWasm,
  budget: number,
  use: (table: Record<string, (...args: unknown[]) => unknown>) => T,
): T {
  const state = new LuaEngine(module, {
    openStandardLibs: true,
    injectObjects: false,
    enableProxy: false,
  });
  try {
    // Scripts have no randomness; these only satisfy the prelude.
    state.global.set("__rr_host_rand", () => 0);
    state.global.set("__rr_host_shuffle", () => 0);
    state.global.set("__rr_budget", budget);
    state.doStringSync(PRELUDE);
    return use(state.global.get("__rr") as Record<string, (...args: unknown[]) => unknown>);
  } finally {
    state.global.close();
  }
}

const count = (value: unknown) => (Array.isArray(value) ? value.length : 0);

function limitErrors(document: unknown, json: string): ScriptError[] {
  const errors: ScriptError[] = [];
  if (json.length > DOCUMENT_LIMITS.size) {
    errors.push({
      message: `the scenario is ${json.length} characters as JSON; the limit is ${DOCUMENT_LIMITS.size}`,
    });
  }
  const doc = (document ?? {}) as Record<string, unknown>;
  for (const key of ["stations", "arcs", "vehicles", "events", "resources"] as const) {
    const n = count(doc[key]);
    if (n > DOCUMENT_LIMITS[key]) {
      errors.push({
        path: key,
        message: `the scenario has ${n} ${key}; the limit is ${DOCUMENT_LIMITS[key]}`,
      });
    }
  }
  return errors;
}

/** Evaluates a scenario script to a document, without validating the document. */
export function evaluateScript(
  module: LuaWasm,
  source: string,
  budget = EVALUATION_BUDGET,
): Evaluation {
  const diagnostics = checkPolicySource(source);
  if (diagnostics.length > 0) {
    return {
      ok: false,
      errors: diagnostics.map((d) => ({ message: d.message, line: d.line })),
      logs: [],
    };
  }
  const libraries = librarySources();
  const script = instrumentPolicySource(source, { keepCallers: true });
  const json = withState(module, budget, (rr) =>
    rr.evaluate?.(script, libraries.core, libraries.mars, libraries.classic),
  ) as string;
  const raw = JSON.parse(json) as RawEvaluation;
  const logs = raw.logs ?? [];
  if (raw.error) {
    const error: ScriptError = { message: raw.error.message };
    if (typeof raw.error.line === "number") error.line = raw.error.line;
    return { ok: false, errors: [error], logs };
  }
  const limits = limitErrors(raw.document, json);
  if (limits.length > 0) return { ok: false, errors: limits, logs };
  const sourceMap = Array.isArray(raw.sourceMap) ? {} : (raw.sourceMap ?? {});
  return { ok: true, document: raw.document, sourceMap, logs };
}

/** The line of the longest document path prefix that a construct built. */
export function lineForPath(sourceMap: SourceMap, path: string): number | undefined {
  let best: number | undefined = sourceMap["(document)"];
  const pattern = /\[\d+\]|\.?[^.[]+/g;
  let prefix = "";
  for (const match of path === "(document)" ? [] : path.matchAll(pattern)) {
    prefix += match[0];
    const line = sourceMap[prefix];
    if (line !== undefined) best = line;
  }
  return best;
}

/** Evaluates a scenario script and validates the document, reporting errors at script lines. */
export function loadScript(
  module: LuaWasm,
  source: string,
  budget = EVALUATION_BUDGET,
): ScriptScenario {
  const evaluation = evaluateScript(module, source, budget);
  if (!evaluation.ok) return evaluation;
  const result = validateScenario(evaluation.document);
  if (!result.ok) {
    return {
      ok: false,
      logs: evaluation.logs,
      errors: result.errors.map((e) => {
        const line = lineForPath(evaluation.sourceMap, e.path);
        return { message: e.message, path: e.path, ...(line === undefined ? {} : { line }) };
      }),
    };
  }
  const { document, sourceMap, logs } = evaluation;
  return { ok: true, scenario: result.scenario, document, sourceMap, logs };
}

/** Parameter types by construct and every function the libraries export, for description checks. */
export function libraryConstructs(module: LuaWasm): {
  constructs: Record<string, Record<string, string>>;
  functions: string[];
} {
  const libraries = librarySources();
  const json = withState(module, EVALUATION_BUDGET, (rr) =>
    rr.constructs?.(libraries.core, libraries.mars, libraries.classic),
  ) as string;
  return JSON.parse(json);
}
