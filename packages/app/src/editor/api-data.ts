import type { EditorEntry } from "@regolith-rail/policy-api";
import editorData from "@regolith-rail/policy-api/editor.json";

const entries = (editorData as { entries: EditorEntry[] }).entries;
const byPath = new Map(entries.map((entry) => [entry.path, entry]));

/** Replaces array indexes, such as `stations[2]`, with the `[i]` used in API paths. */
export function normalisePath(expression: string): string {
  return expression.replace(/\[[^\]]*\]/g, "[i]");
}

/** The API entry an expression refers to, if any. */
export function entryFor(expression: string): EditorEntry | undefined {
  return byPath.get(normalisePath(expression));
}

/** Entries that can complete an expression ending at the cursor, such as `ctx.train.ca`. */
export function completionsFor(expression: string): { entry: EditorEntry; from: number }[] {
  const normalised = normalisePath(expression);
  const dot = normalised.lastIndexOf(".");
  if (dot < 0) {
    return entries
      .filter((entry) => !entry.path.includes(".", entry.path.indexOf(".") + 1))
      .filter((entry) => entry.path.startsWith(normalised) && normalised.length > 0)
      .map((entry) => ({ entry, from: 0 }));
  }
  const parent = normalised.slice(0, dot + 1);
  const partial = normalised.slice(dot + 1);
  return entries
    .filter(
      (entry) => entry.path.startsWith(parent) && !entry.path.slice(parent.length).includes("."),
    )
    .filter(
      (entry) => entry.name.startsWith(partial) && !entry.path.slice(parent.length).includes("["),
    )
    .map((entry) => ({ entry, from: expression.length - partial.length }));
}

export function documentationHref(entry: EditorEntry): string {
  return `${import.meta.env.BASE_URL}docs/${entry.docs}`;
}
