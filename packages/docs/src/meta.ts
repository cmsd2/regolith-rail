export const DEFAULT_EXAMPLE_SCENARIO = "two-station";

export interface CodeMeta {
  /** Runs during the documentation check and can be opened in the editor. */
  runnable: boolean;
  /** Holds the log lines the runnable example before it must produce. */
  output: boolean;
  /** The example is a scenario script rather than a policy. */
  script: boolean;
  /** The example is the suggested fix for its starter scenario. */
  fix: boolean;
  /** A starter id, or a classic template name such as `classic.reorder` with its defaults. */
  scenario: string;
  seed: number;
}

/**
 * Reads the words after a code fence's language, such as
 * `lua runnable scenario=relay seed=3` or `lua runnable script`.
 */
export function parseCodeMeta(meta: string | null | undefined): CodeMeta {
  const result: CodeMeta = {
    runnable: false,
    output: false,
    script: false,
    fix: false,
    scenario: DEFAULT_EXAMPLE_SCENARIO,
    seed: 1,
  };
  for (const token of (meta ?? "").split(/\s+/).filter(Boolean)) {
    const [key, value] = token.split("=", 2) as [string, string | undefined];
    if (key === "runnable") result.runnable = true;
    else if (key === "output") result.output = true;
    else if (key === "script") result.script = true;
    else if (key === "fix") result.fix = true;
    else if (key === "scenario" && value) result.scenario = value;
    else if (key === "seed" && value && /^\d+$/.test(value)) result.seed = Number(value);
  }
  return result;
}
