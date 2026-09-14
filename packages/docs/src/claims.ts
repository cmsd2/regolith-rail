import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Nodes, Root } from "mdast";
import { visit } from "unist-util-visit";
import { extractExamples } from "./examples.ts";

export const CHECK_KINDS = ["maxima", "python", "example", "test"] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export interface CheckRef {
  kind: CheckKind;
  name: string;
}

/** Reads a reference such as `maxima:critical-ratio` or `test:reaches the analytic cost`. */
export function parseCheckRef(ref: string): CheckRef | null {
  const colon = ref.indexOf(":");
  if (colon <= 0) return null;
  const kind = ref.slice(0, colon);
  const name = ref.slice(colon + 1).trim();
  if (!(CHECK_KINDS as readonly string[]).includes(kind) || name === "") return null;
  return { kind: kind as CheckKind, name };
}

/** The Maxima notebook and Python script that hold a page's checks, beside the page. */
export const checkFiles = (pageFile: string) => ({
  maxima: pageFile.replace(/\.mdx$/, ".checks.macnb"),
  python: pageFile.replace(/\.mdx$/, ".checks.py"),
});

const CELL_NAME = /^\s*\/\*\s*check:\s*([\w-]+)\s*\*\//;

const cellSource = (source: unknown) =>
  Array.isArray(source) ? source.join("") : typeof source === "string" ? source : "";

/** Named check cells of a Maxima notebook, by name. A cell names itself with `/* check: name *\/`. */
export function maximaChecks(notebook: string): Map<string, string> {
  const checks = new Map<string, string>();
  const parsed = JSON.parse(notebook) as { cells?: { cell_type?: string; source?: unknown }[] };
  for (const cell of parsed.cells ?? []) {
    if (cell.cell_type !== "code") continue;
    const source = cellSource(cell.source);
    const name = CELL_NAME.exec(source)?.[1];
    if (name) checks.set(name, source.replace(CELL_NAME, "").trim());
  }
  return checks;
}

/** Names of Python checks: `check_fill_rate` is the check `fill-rate`. */
const pythonName = (fn: string) => fn.replace(/_/g, "-");

/** The `check_*` functions of a Python script, with their source, by check name. */
export function pythonChecks(script: string): Map<string, string> {
  const checks = new Map<string, string>();
  const lines = script.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = /^def check_(\w+)\s*\(/.exec(lines[i] as string);
    if (!match) continue;
    let end = i + 1;
    while (end < lines.length && !/^\S/.test(lines[end] as string)) end++;
    const body = lines.slice(i, end).join("\n").trimEnd();
    checks.set(pythonName(match[1] as string), body);
  }
  return checks;
}

/** Titles of `it` and `test` calls in test sources, with the files that define each. */
export function testTitles(files: { file: string; source: string }[]): Map<string, string[]> {
  const titles = new Map<string, string[]>();
  const call = /\b(?:it|test)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const { file, source } of files) {
    for (const match of source.matchAll(call)) {
      const title = (match[2] as string).replace(/\\(.)/g, "$1");
      if (match[1] === "`" && title.includes("${")) continue;
      titles.set(title, [...(titles.get(title) ?? []), file]);
    }
  }
  return titles;
}

const PACKAGES_DIR = fileURLToPath(new URL("../../", import.meta.url));

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const parsedTests = new Map<string, { mtimeMs: number; source: string }>();

/**
 * Test titles across the workspace's packages. Files are re-read only when they change, so a
 * development server that keeps running still resolves tests that were added or renamed.
 */
export function workspaceTestTitles(): Map<string, string[]> {
  const files = testFiles(PACKAGES_DIR).map((file) => {
    const mtimeMs = statSync(file).mtimeMs;
    let cached = parsedTests.get(file);
    if (!cached || cached.mtimeMs !== mtimeMs) {
      cached = { mtimeMs, source: readFileSync(file, "utf8") };
      parsedTests.set(file, cached);
    }
    return {
      file: `packages/${relative(PACKAGES_DIR, file).split("\\").join("/")}`,
      source: cached.source,
    };
  });
  return testTitles(files);
}

export interface ResolvedCheck {
  kind: CheckKind;
  name: string;
  /** What the reader is told the check is. */
  label: string;
  /** Where the check lives, relative to the repository. */
  file?: string;
  /** The checking code, for Maxima and Python checks. */
  source?: string;
}

export interface CheckContext {
  /** The page's MDX file on disk. */
  pageFile: string;
  /** The page's syntax tree, for its runnable examples. */
  tree: Root;
  tests: Map<string, string[]>;
  /** Reads a file, or returns undefined when it doesn't exist. */
  read?: (path: string) => string | undefined;
}

const readIfExists = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

const fileName = (path: string) => path.replace(/\\/g, "/").replace(/^.*\/packages\//, "packages/");

/** The check a reference names, or why it doesn't resolve. */
export function resolveCheck(
  ref: string,
  context: CheckContext,
): { check: ResolvedCheck } | { error: string } {
  const parsed = parseCheckRef(ref);
  if (!parsed) return { error: `"${ref}" is not a check reference such as maxima:name` };
  const read = context.read ?? readIfExists;
  const { kind, name } = parsed;
  switch (kind) {
    case "maxima":
    case "python": {
      const file = checkFiles(context.pageFile)[kind];
      const text = read(file);
      if (text === undefined) return { error: `${ref}: no ${fileName(file)}` };
      const checks = kind === "maxima" ? maximaChecks(text) : pythonChecks(text);
      const source = checks.get(name);
      if (source === undefined) return { error: `${ref}: no check "${name}" in ${fileName(file)}` };
      return {
        check: {
          kind,
          name,
          label: kind === "maxima" ? `Maxima check ${name}` : `Python check ${name}`,
          file: fileName(file),
          source,
        },
      };
    }
    case "example": {
      const index = Number(name);
      const count = extractExamples("", context.tree).length;
      if (!Number.isInteger(index) || index < 1 || index > count) {
        return { error: `${ref}: the page has ${count} runnable example(s)` };
      }
      return { check: { kind, name, label: `Runnable example ${index} on this page` } };
    }
    case "test": {
      const files = context.tests.get(name) ?? [];
      if (files.length === 0) return { error: `${ref}: no test with that title` };
      if (files.length > 1) return { error: `${ref}: several tests have that title` };
      return { check: { kind, name, label: `Test: ${name}`, file: files[0] as string } };
    }
  }
}

type CheckElement = Extract<Nodes, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;
type MdxJsxAttribute = Extract<CheckElement["attributes"][number], { type: "mdxJsxAttribute" }>;

/** Check elements in a page, with their reference and line. */
export function checkElements(tree: Root): { node: CheckElement; ref: string; line: number }[] {
  const found: { node: CheckElement; ref: string; line: number }[] = [];
  visit(tree, (node) => {
    if (
      (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
      node.name === "Check"
    ) {
      const attribute = node.attributes.find(
        (a): a is MdxJsxAttribute => a.type === "mdxJsxAttribute" && a.name === "ref",
      );
      found.push({
        node,
        ref: typeof attribute?.value === "string" ? attribute.value : "",
        line: node.position?.start.line ?? 0,
      });
    }
  });
  return found;
}

const attribute = (name: string, value: string): MdxJsxAttribute => ({
  type: "mdxJsxAttribute",
  name,
  value,
});

/**
 * Fills each `<Check ref="…" />` with what it refers to at build time, so pages show the working
 * without loading anything. Unresolved references render as such; the documentation check fails
 * on them.
 */
export function remarkChecks() {
  return (tree: Root, file: { path?: string }) => {
    const pageFile = file.path;
    if (!pageFile) return;
    if (checkElements(tree).length === 0) return;
    const context: CheckContext = { pageFile, tree, tests: workspaceTestTitles() };
    for (const { node, ref } of checkElements(tree)) {
      const result = resolveCheck(ref, context);
      node.attributes = [attribute("ref", ref)];
      if ("error" in result) {
        node.attributes.push(attribute("error", result.error));
        continue;
      }
      const { check } = result;
      node.attributes.push(attribute("kind", check.kind), attribute("label", check.label));
      if (check.file) node.attributes.push(attribute("file", check.file));
      if (check.source) node.attributes.push(attribute("source", check.source));
    }
  };
}
