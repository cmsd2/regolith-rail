import { CLASSIC_POLICIES } from "./policies.generated.ts";

/**
 * A policy's name and one-line description from its opening comment, which reads
 * `-- Name: description` and may continue on following comment lines until a blank `--`.
 */
export function policyHeader(source: string): { name: string; description: string } | null {
  const lines: string[] = [];
  for (const line of source.split("\n")) {
    const match = /^--\s?(.*)$/.exec(line.trimEnd());
    if (!match || match[1] === "") break;
    lines.push(match[1] as string);
  }
  const text = lines.join(" ");
  const colon = text.indexOf(": ");
  if (colon <= 0) return null;
  const rest = text.slice(colon + 2).trim();
  if (rest === "") return null;
  return { name: text.slice(0, colon), description: rest[0]?.toUpperCase() + rest.slice(1) };
}

export interface ExamplePolicy {
  /** The file name without `.lua`, such as `moving-average`. */
  file: string;
  name: string;
  description: string;
  source: string;
}

/** The scenario kit's example policies, named and described by their opening comments. */
export const examplePolicies: readonly ExamplePolicy[] = Object.entries(CLASSIC_POLICIES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([file, source]) => {
    const header = policyHeader(source);
    if (!header) throw new Error(`policy ${file} has no "-- Name: description" opening comment`);
    return { file, source, ...header };
  });
