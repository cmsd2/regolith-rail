import { type Scenario, ScenarioV2 } from "./format2.ts";
import { type ScenarioV1, ScenarioV1 as ScenarioV1Schema } from "./schema.ts";
import { upgradeV1 } from "./upgrade.ts";

export interface ValidationError {
  /** Location in the document, e.g. `stations[1].producers[0].rate`. */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; scenario: Scenario }
  | { ok: false; errors: ValidationError[] };

export function formatPath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const key of path) {
    if (typeof key === "number") out += `[${key}]`;
    else out += out === "" ? String(key) : `.${String(key)}`;
  }
  return out === "" ? "(document)" : out;
}

const errorsFrom = (issues: readonly { path: readonly PropertyKey[]; message: string }[]) =>
  issues.map((issue) => ({ path: formatPath(issue.path), message: issue.message }));

/** Validates a format 1 document without upgrading it, for tests of the format 1 rules. */
export function validateScenarioV1(
  input: unknown,
): { ok: true; scenario: ScenarioV1 } | { ok: false; errors: ValidationError[] } {
  const result = ScenarioV1Schema.safeParse(input);
  return result.success
    ? { ok: true, scenario: result.data }
    : { ok: false, errors: errorsFrom(result.error.issues) };
}

/**
 * Validates an untrusted scenario document of any supported format and applies defaults.
 * Format 1 documents are upgraded to format 2, with errors reported at their paths in the
 * format 1 document.
 */
export function validateScenario(input: unknown): ValidationResult {
  const format = (input as { format?: unknown } | null)?.format;
  if (format === 1) {
    const v1 = validateScenarioV1(input);
    if (!v1.ok) return v1;
    const upgraded = ScenarioV2.safeParse(upgradeV1(v1.scenario));
    if (!upgraded.success) {
      // A valid format 1 document always upgrades; anything else is a bug in the upgrade.
      throw new Error(
        `format 1 upgrade produced an invalid document: ${JSON.stringify(errorsFrom(upgraded.error.issues))}`,
      );
    }
    return { ok: true, scenario: upgraded.data };
  }
  if (format !== 2) {
    return {
      ok: false,
      errors: [
        {
          path: "format",
          message: `format ${String(format)} is not supported; supported versions: 1, 2`,
        },
      ],
    };
  }
  const v2 = ScenarioV2.safeParse(input);
  return v2.success
    ? { ok: true, scenario: v2.data }
    : { ok: false, errors: errorsFrom(v2.error.issues) };
}
