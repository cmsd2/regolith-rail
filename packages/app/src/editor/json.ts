import { json } from "@codemirror/lang-json";
import { type Diagnostic as LintDiagnostic, linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { ValidationError } from "@regolith-rail/engine";
import { findNodeAtLocation, type Node, parseTree } from "jsonc-parser";

/** Splits a validation path such as `stations[1].producers[0].rate` into segments. */
export function pathSegments(path: string): (string | number)[] {
  if (path === "(document)") return [];
  const segments: (string | number)[] = [];
  for (const part of path.split(".")) {
    const match = /^([^[]*)((?:\[\d+\])*)$/.exec(part);
    if (!match) {
      segments.push(part);
      continue;
    }
    if (match[1]) segments.push(match[1]);
    for (const index of (match[2] ?? "").matchAll(/\[(\d+)\]/g)) segments.push(Number(index[1]));
  }
  return segments;
}

/** Finds the text range of the value at a validation path, falling back to its nearest parent. */
export function rangeForPath(text: string, path: string): { from: number; to: number } {
  const tree = parseTree(text);
  if (!tree) return { from: 0, to: Math.min(1, text.length) };
  const segments = pathSegments(path);
  for (let length = segments.length; length >= 0; length--) {
    const node: Node | undefined = findNodeAtLocation(tree, segments.slice(0, length));
    if (node) {
      const target =
        node.parent?.type === "property" && node.parent.children?.[0]
          ? node.parent.children[0]
          : node;
      return { from: target.offset, to: target.offset + target.length };
    }
  }
  return { from: tree.offset, to: tree.offset + 1 };
}

export function scenarioDiagnostics(text: string, errors: ValidationError[]): LintDiagnostic[] {
  return errors.map((error) => {
    const syntax = /position (\d+)/.exec(error.message);
    const range = syntax
      ? {
          from: Math.min(Number(syntax[1]), text.length),
          to: Math.min(Number(syntax[1]) + 1, text.length),
        }
      : rangeForPath(text, error.path);
    return { ...range, severity: "error", message: `${error.path}: ${error.message}` };
  });
}

/** JSON editing for scenarios, with validation errors shown where they occur. */
export function scenarioExtensions(getErrors: () => ValidationError[]): Extension[] {
  return [
    json(),
    linter((view) => scenarioDiagnostics(view.state.doc.toString(), getErrors()), { delay: 200 }),
  ];
}
