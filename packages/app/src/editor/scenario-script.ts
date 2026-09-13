import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { type Diagnostic as LintDiagnostic, linter } from "@codemirror/lint";
import type { Extension, Text } from "@codemirror/state";
import { hoverTooltip } from "@codemirror/view";
import type { Diagnostic, ScriptScenario } from "@regolith-rail/lua-runtime";
import { type Construct, constructAnchor, constructs } from "@regolith-rail/scenario-kit";
import { docsHref } from "../lib/format.ts";
import { toLintDiagnostics } from "./lua.ts";

const byName = new Map(constructs.map((c) => [c.name, c]));

/** The construct a name in a script refers to, such as `station` or `mars.line`. */
export const constructFor = (name: string): Construct | undefined => byName.get(name);

/** Documentation target of a construct, such as `scenarios/core#station`. */
export const constructDocs = (construct: Construct) =>
  construct.kind === "template"
    ? construct.docs
    : `${construct.docs}#${constructAnchor(construct)}`;

/** Constructs that complete a name being typed, such as `mars.sm` or `sta`. */
export function constructCompletions(typed: string): Construct[] {
  const dot = typed.lastIndexOf(".");
  const prefix = dot < 0 ? "" : typed.slice(0, dot + 1);
  return constructs.filter((c) => {
    if (!c.name.startsWith(typed)) return false;
    // Complete one level at a time: `mars.` offers Mars constructs, a bare word offers core ones.
    return prefix === "" ? !c.name.includes(".") : c.name.slice(prefix.length).indexOf(".") < 0;
  });
}

/** Errors from evaluating a script, placed on their lines. */
export function evaluationDiagnostics(doc: Text, result: ScriptScenario): LintDiagnostic[] {
  if (result.ok) return [];
  return result.errors.map((error) => {
    const line = doc.line(Math.max(1, Math.min(error.line ?? 1, doc.lines)));
    const message = error.path ? `${error.path}: ${error.message}` : error.message;
    return { from: line.from, to: Math.max(line.to, line.from + 1), severity: "error", message };
  });
}

function completions(context: CompletionContext) {
  const word = context.matchBefore(/[\w.]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const options = constructCompletions(word.text);
  const libraries = ["mars", "classic"].filter(
    (l) => l.startsWith(word.text) && !word.text.includes("."),
  );
  if (options.length === 0 && libraries.length === 0) return null;
  const from = word.from + word.text.lastIndexOf(".") + 1;
  return {
    from,
    options: [
      ...libraries.map((label) => ({ label, type: "namespace", detail: "library" })),
      ...options.map((c) => ({
        label: c.name.slice(c.name.lastIndexOf(".") + 1),
        detail: c.kind,
        info: c.summary,
        type: c.kind === "helper" ? "function" : "class",
      })),
    ],
  };
}

const hover = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  let start = pos - line.from;
  let end = start;
  while (start > 0 && /[\w.]/.test(line.text[start - 1] as string)) start--;
  while (end < line.text.length && /\w/.test(line.text[end] as string)) end++;
  const construct = constructFor(line.text.slice(start, end));
  if (!construct) return null;
  return {
    pos: line.from + start,
    end: line.from + end,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "api-hover construct-hover";
      const title = document.createElement("div");
      title.className = "api-hover-title";
      title.textContent = `${construct.name}: ${construct.returns}`;
      const summary = document.createElement("p");
      summary.textContent = construct.summary;
      dom.append(title, summary);
      if (construct.params.length > 0) {
        const list = document.createElement("ul");
        for (const param of construct.params) {
          const item = document.createElement("li");
          const name = document.createElement("code");
          name.textContent = param.name;
          const extra = [
            param.unit && `in ${param.unit}`,
            param.default && `default ${param.default}`,
          ]
            .filter(Boolean)
            .join(", ");
          item.append(name, ` ${param.summary}${extra ? ` (${extra})` : ""}`);
          list.append(item);
        }
        dom.append(list);
      }
      const link = document.createElement("a");
      const target = constructDocs(construct);
      link.href = docsHref(target);
      link.dataset.docs = target;
      link.textContent = "Documentation";
      dom.append(link);
      return { dom };
    },
  };
});

/**
 * Lua editing for scenario scripts: highlighting, language checks and evaluation errors as you
 * type, and completion and hover help for constructs.
 */
export function scenarioScriptExtensions(
  check: (source: string) => Promise<Diagnostic[]>,
  evaluate: (source: string) => Promise<ScriptScenario>,
): Extension[] {
  return [
    StreamLanguage.define(lua),
    linter(
      async (view) => {
        const text = view.state.doc.toString();
        const diagnostics = await check(text);
        if (diagnostics.length > 0) return toLintDiagnostics(view.state.doc, diagnostics);
        return evaluationDiagnostics(view.state.doc, await evaluate(text));
      },
      { delay: 400 },
    ),
    autocompletion({ override: [completions] }),
    hover,
  ];
}
