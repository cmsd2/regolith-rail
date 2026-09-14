import type { EditorEntry } from "@regolith-rail/policy-api";
import editorData from "@regolith-rail/policy-api/editor.json";

const entries = (editorData as { entries: EditorEntry[] }).entries;
const byPath = new Map(entries.map((entry) => [entry.path, entry]));
/** Paths of tables keyed by id, such as `ctx.stations`, whose members are written `[i]` in API paths. */
const keyed = new Set(entries.filter((e) => e.type.startsWith("table<string,")).map((e) => e.path));

/**
 * Replaces indexes, such as `stations[2]` or `stations["Mine"]`, and ids in tables keyed by id,
 * such as `stations.Mine`, with the `[i]` used in API paths.
 */
export function normalisePath(expression: string): string {
  const [first = "", ...rest] = expression.replace(/\[[^\]]*\]/g, "[i]").split(".");
  let path = first;
  for (const segment of rest) {
    path =
      keyed.has(path) && /^\w+/.test(segment)
        ? path + segment.replace(/^\w+/, "[i]")
        : `${path}.${segment}`;
  }
  return path;
}

/** The API entry an expression refers to, if any. */
export function entryFor(expression: string): EditorEntry | undefined {
  return byPath.get(normalisePath(expression));
}

/** Entries that can complete an expression ending at the cursor, such as `ctx.vehicle.ca`. */
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
