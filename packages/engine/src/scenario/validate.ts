import { Scenario } from "./schema.ts";

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
