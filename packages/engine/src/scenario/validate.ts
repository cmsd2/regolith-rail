import { ScenarioV2 } from "./format2.ts";
import { Scenario } from "./schema.ts";
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

/** Validates an untrusted scenario document and applies defaults. */
export function validateScenario(input: unknown): ValidationResult {
  const result = Scenario.safeParse(input);
  if (result.success) return { ok: true, scenario: result.data };
  const errors = result.error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }));
  return { ok: false, errors };
}

export type AnyFormatResult =
  | { ok: true; scenario: ScenarioV2 }
  | { ok: false; errors: ValidationError[] };

const errorsFrom = (issues: readonly { path: readonly PropertyKey[]; message: string }[]) =>
  issues.map((issue) => ({ path: formatPath(issue.path), message: issue.message }));

/**
 * Validates a scenario document of any supported format, upgrading format 1 to format 2.
 * Format 1 errors are reported at their paths in the format 1 document.
 */
export function validateAnyFormat(input: unknown): AnyFormatResult {
  const format = (input as { format?: unknown } | null)?.format;
  if (format === 1) {
    const v1 = Scenario.safeParse(input);
    if (!v1.success) return { ok: false, errors: errorsFrom(v1.error.issues) };
    const upgraded = ScenarioV2.safeParse(upgradeV1(v1.data));
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
