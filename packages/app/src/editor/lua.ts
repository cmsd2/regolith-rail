import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { type Diagnostic as LintDiagnostic, linter } from "@codemirror/lint";
import type { Extension, Text } from "@codemirror/state";
import { type EditorView, hoverTooltip } from "@codemirror/view";
import type { Diagnostic } from "@regolith-rail/lua-runtime";
import { completionsFor, documentationHref, entryFor } from "./api-data.ts";

const EXPRESSION = /[\w.[\]]/;

/** Converts a 1-based line and column to a document position, clamped to the document. */
export function positionOf(doc: Text, line: number, column: number): number {
  const safeLine = doc.line(Math.max(1, Math.min(line, doc.lines)));
  return Math.min(safeLine.to, safeLine.from + Math.max(0, column - 1));
}

/** Diagnostics from the policy checker, placed on the word they point at. */
export function toLintDiagnostics(doc: Text, diagnostics: Diagnostic[]): LintDiagnostic[] {
  return diagnostics.map((d) => {
    const from = positionOf(doc, d.line, d.column);
    const lineEnd = doc.lineAt(from).to;
    let to = from;
    while (to < lineEnd && /\S/.test(doc.sliceString(to, to + 1))) to++;
    return {
      from,
      to: Math.max(to, Math.min(from + 1, lineEnd)),
      severity: "error",
      message: d.message,
    };
  });
}

function expressionAround(
  view: EditorView,
  pos: number,
): { from: number; to: number; text: string } | null {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  let start = pos - line.from;
  let end = start;
  while (start > 0 && EXPRESSION.test(text[start - 1] as string)) start--;
  while (end < text.length && /\w/.test(text[end] as string)) end++;
  if (start === end) return null;
  return { from: line.from + start, to: line.from + end, text: text.slice(start, end) };
}

function apiCompletions(context: CompletionContext) {
  const word = context.matchBefore(/[\w.[\]]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const options = completionsFor(word.text);
  if (options.length === 0) return null;
  const from = word.from + (options[0]?.from ?? 0);
  return {
    from,
    options: options.map(({ entry }) => ({
      label: entry.name,
      detail: entry.type,
      info: entry.summary,
      type: entry.kind === "function" ? "function" : "property",
    })),
  };
}

const apiHover = hoverTooltip((view, pos) => {
  const expression = expressionAround(view, pos);
  if (!expression) return null;
  const entry = entryFor(expression.text);
  if (!entry) return null;
  return {
    pos: expression.from,
    end: expression.to,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "api-hover";
      const title = document.createElement("div");
      title.className = "api-hover-title";
      title.textContent = `${entry.path}: ${entry.type}`;
      const summary = document.createElement("p");
      summary.textContent = entry.summary;
      dom.append(title, summary);
      if (entry.params && entry.params.length > 0) {
        const list = document.createElement("ul");
        for (const param of entry.params) {
          const item = document.createElement("li");
          const name = document.createElement("code");
          name.textContent = param.name;
          item.append(name, ` ${param.summary}`);
          list.append(item);
        }
        dom.append(list);
      }
      const link = document.createElement("a");
      link.href = documentationHref(entry);
      link.textContent = "Documentation";
      link.dataset.docs = entry.docs;
      dom.append(link);
      return { dom };
    },
  };
});

/** Lua editing for policies: highlighting, checks as you type, completion and hover help. */
export function luaPolicyExtensions(check: (source: string) => Promise<Diagnostic[]>): Extension[] {
  return [
    StreamLanguage.define(lua),
    linter(
      async (view) => toLintDiagnostics(view.state.doc, await check(view.state.doc.toString())),
      {
        delay: 300,
      },
    ),
    autocompletion({ override: [apiCompletions] }),
    apiHover,
  ];
}
