import {
  runSimulation,
  type Scenario,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";
import type { LuaRuntime } from "@regolith-rail/lua-runtime";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { parseCodeMeta } from "./meta.ts";
import { referencePages } from "./pages.ts";

export interface Example {
  page: string;
  /** Position among the page's runnable examples, from 1. */
  index: number;
  line: number;
  source: string;
  /** Whether the example is a scenario script rather than a policy. */
  script: boolean;
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
      script: meta.script,
      scenario: meta.scenario,
      seed: meta.seed,
      ...(output ? { output } : {}),
    });
  });
  return examples;
}

export const exampleName = (example: Example) =>
  `${example.page || "index"} example ${example.index} (line ${example.line})`;

/** A runnable example as the workbench library lists it. */
export interface ExampleEntry {
  /** `<page>#<index>`, with `index` for the documentation home page. */
  id: string;
  page: string;
  /** Named after its page, numbered when the page has several runnable examples. */
  name: string;
  script: boolean;
  scenario: string;
  seed: number;
  source: string;
}

/** Every runnable example on the given pages, in page order, for the workbench library. */
export function exampleIndex(
  pages: readonly { slug: string; tree: Root; frontmatter: Record<string, unknown> }[],
): ExampleEntry[] {
  // Pages that add to a generated reference page take its title.
  const referenceTitles = new Map(referencePages().map((p) => [p.slug, p.title]));
  return pages.flatMap((page) => {
    const examples = extractExamples(page.slug, page.tree);
    const title = String(
      page.frontmatter.title ?? referenceTitles.get(page.slug) ?? (page.slug || "Documentation"),
    );
    return examples.map((example) => ({
      id: `${page.slug || "index"}#${example.index}`,
      page: page.slug,
      name: examples.length > 1 ? `${title} (example ${example.index})` : title,
      script: example.script,
      scenario: example.scenario,
      seed: example.seed,
      source: example.source,
    }));
  });
}

/** Names the problem when the committed examples index differs from the documentation. */
export function checkExampleIndex(committed: unknown, current: ExampleEntry[]): string[] {
  return JSON.stringify(committed) === JSON.stringify(current)
    ? []
    : [
        "generated/examples.json is out of date with the runnable examples; run `pnpm --filter @regolith-rail/docs generate`",
      ];
}

/** A policy with every hook doing nothing, for running script examples. */
const IDLE_POLICY = "return { on_stop = function(ctx) end, on_review = function(ctx) end }";

/** A starter scenario by id, or a classic template with its defaults. */
function exampleScenario(runtime: LuaRuntime, id: string): Scenario | string {
  if (id.includes(".")) {
    const loaded = runtime.loadScript(`return ${id} {}`);
    return loaded.ok ? loaded.scenario : `template ${id} does not evaluate`;
  }
  const starter = starterScenarios.find((s) => s.id === id);
  if (!starter) return `unknown scenario ${id}`;
  const result = validateScenario(starter.document);
  return result.ok ? result.scenario : `scenario ${id} is invalid`;
}

/** Runs an example and describes anything wrong with it. */
export function runExample(runtime: LuaRuntime, example: Example): string[] {
  const name = exampleName(example);
  let scenario: Scenario;
  let source = example.source;
  if (example.script) {
    const loaded = runtime.loadScript(example.source);
    if (!loaded.ok) {
      return loaded.errors.map(
        (e) => `${name}: the script failed${e.line ? ` on line ${e.line}` : ""}: ${e.message}`,
      );
    }
    scenario = loaded.scenario;
    source = IDLE_POLICY;
  } else {
    const found = exampleScenario(runtime, example.scenario);
    if (typeof found === "string") return [`${name}: ${found}`];
    scenario = found;
  }
  const policy = runtime.createPolicy(source);
  try {
    if (policy.error) return [`${name}: ${policy.error.message}`];
    const run = runSimulation(scenario, policy, {
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
