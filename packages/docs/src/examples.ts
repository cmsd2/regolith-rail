import { runSimulation, starterScenarios, validateScenario } from "@regolith-rail/engine";
import type { LuaRuntime } from "@regolith-rail/lua-runtime";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { parseCodeMeta } from "./meta.ts";

export interface Example {
  page: string;
  /** Position among the page's runnable examples, from 1. */
  index: number;
  line: number;
  source: string;
  scenario: string;
  seed: number;
  /** Log lines the run must begin with, when the page states them. */
  output?: string[];
}

export function extractExamples(page: string, tree: Root): Example[] {
  const examples: Example[] = [];
  visit(tree, "code", (node, index, parent) => {
    const meta = parseCodeMeta(node.meta);
    if (!meta.runnable) return;
    const next = index === undefined ? undefined : parent?.children[index + 1];
    const output =
      next?.type === "code" && parseCodeMeta(next.meta).output
        ? next.value.split("\n").filter((line) => line.trim() !== "")
        : undefined;
    examples.push({
      page,
      index: examples.length + 1,
      line: node.position?.start.line ?? 0,
      source: node.value,
      scenario: meta.scenario,
      seed: meta.seed,
      ...(output ? { output } : {}),
    });
  });
  return examples;
}

export const exampleName = (example: Example) =>
  `${example.page || "index"} example ${example.index} (line ${example.line})`;

/** Runs an example and describes anything wrong with it. */
export function runExample(runtime: LuaRuntime, example: Example): string[] {
  const name = exampleName(example);
  const starter = starterScenarios.find((s) => s.id === example.scenario);
  if (!starter) return [`${name}: unknown scenario ${example.scenario}`];
  const scenario = validateScenario(starter.document);
  if (!scenario.ok) return [`${name}: scenario ${example.scenario} is invalid`];
  const policy = runtime.createPolicy(example.source);
  try {
    if (policy.error) return [`${name}: ${policy.error.message}`];
    const run = runSimulation(scenario.scenario, policy, {
      seed: example.seed,
      detail: "summary",
    });
    const problems: string[] = [];
    const error = run.events.find((event) => event.kind === "error");
    if (error)
      problems.push(
        `${name}: the policy failed${error.line ? ` on line ${error.line}` : ""}: ${error.message}`,
      );
    if (example.output) {
      const logs = run.events.flatMap((event) => (event.kind === "log" ? [event.message] : []));
      const actual = logs.slice(0, example.output.length);
      if (actual.join("\n") !== example.output.join("\n")) {
        problems.push(
          `${name}: expected output\n  ${example.output.join("\n  ")}\nbut the run logged\n  ${actual.join("\n  ") || "(nothing)"}`,
        );
      }
    }
    return problems;
  } finally {
    policy.close();
  }
}
