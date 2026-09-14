import type { Scenario } from "@regolith-rail/engine";
import type { PolicyHooks } from "@regolith-rail/lua-runtime";
import { lessonOf, referenceOf } from "./catalogue.ts";
import {
  type ExperimentItem,
  type ItemId,
  isEditable,
  type LibraryItem,
  type PolicyItem,
  type ScenarioItem,
  SOURCES,
} from "./library.ts";

export type ListName = "scenario" | "policy" | "experiment";

export const LISTS: readonly { list: ListName; label: string }[] = [
  { list: "scenario", label: "Scenarios" },
  { list: "policy", label: "Policies" },
  { list: "experiment", label: "Saved runs" },
];

export type TreeNode =
  | { key: string; type: "group"; label: string; collapsed: boolean; children: TreeNode[] }
  | { key: string; type: "item"; item: LibraryItem; children: TreeNode[] };

const newestFirst = (a: LibraryItem, b: LibraryItem) =>
  b.updatedAt - a.updatedAt || a.name.localeCompare(b.name);

const isListed = (item: LibraryItem) => item.listed !== false;

const itemNode = (item: LibraryItem): TreeNode => ({
  key: `item:${item.id}`,
  type: "item",
  item,
  children: [],
});

/** A group of items, left out when it has none. */
function group(key: string, label: string, items: LibraryItem[], collapsed = false): TreeNode[] {
  return items.length === 0
    ? []
    : [{ key: `group:${key}`, type: "group", label, collapsed, children: items.map(itemNode) }];
}

const sourceLabel = (source: LibraryItem["source"]) =>
  SOURCES.find((s) => s.source === source)?.label ?? source;

/** The Scenarios list: shipped scenarios in catalogue order, then the player's and shared, newest first. */
export function scenarioTree(
  shipped: readonly LibraryItem[],
  stored: readonly LibraryItem[],
): TreeNode[] {
  const scenarios = [...shipped, ...[...stored].sort(newestFirst)].filter(
    (i): i is ScenarioItem => i.kind === "scenario" && isListed(i),
  );
  return SOURCES.flatMap(({ source, label }) =>
    group(
      `scenario:${source}`,
      label,
      scenarios.filter((i) => i.source === source),
      source === "example",
    ),
  );
}

/** Where a scenario comes from, for judging which policies were written for it. */
export interface FitContext {
  /** The shipped scenario the Scenario slot holds, or was copied from. */
  shippedScenario: ItemId | null;
  fix: ItemId | null;
  /** The classic template whose reference policy goes with the scenario. */
  reference: string | null;
}

/** The fit context for the item in the Scenario slot. */
export function fitContext(
  scenario: LibraryItem | undefined,
  lookup: (id: ItemId) => LibraryItem | undefined,
): FitContext {
  let shipped: LibraryItem | undefined = scenario;
  for (let depth = 0; shipped && isEditable(shipped.id) && depth < 10; depth++) {
    shipped = shipped.origin ? lookup(shipped.origin) : undefined;
  }
  const lesson = lessonOf(scenario, lookup);
  return {
    shippedScenario: shipped && !isEditable(shipped.id) ? shipped.id : null,
    fix: lesson?.fix ?? null,
    reference: lesson?.reference ?? null,
  };
}

/** Whether a policy was written for the scenario: its fix, its reference policy, or an example on it. */
export function forScenario(policy: LibraryItem, context: FitContext): boolean {
  if (policy.id === context.fix) return true;
  if (context.reference && referenceOf(policy.id) === context.reference) return true;
  return context.shippedScenario !== null && policy.example?.scenario === context.shippedScenario;
}

/**
 * The Policies list: policies written for the current scenario first, then built-in, the player's and
 * shared policies, and every other example and reference policy collapsed at the end.
 */
export function policyTree(
  shipped: readonly LibraryItem[],
  stored: readonly LibraryItem[],
  context: FitContext,
): TreeNode[] {
  const policies = [...shipped, ...[...stored].sort(newestFirst)].filter(
    (i): i is PolicyItem => i.kind === "policy" && isListed(i),
  );
  const forThis = policies.filter((p) => !isEditable(p.id) && forScenario(p, context));
  const rest = policies.filter((p) => !forThis.includes(p));
  const by = (source: LibraryItem["source"]) => rest.filter((p) => p.source === source);
  return [
    ...group("policy:for-scenario", "For this scenario", forThis),
    ...group("policy:builtin", sourceLabel("builtin"), by("builtin")),
    ...group("policy:mine", sourceLabel("mine"), by("mine")),
    ...group("policy:shared", sourceLabel("shared"), by("shared")),
    ...group("policy:other", "Other examples", [...by("example"), ...by("classic")], true),
  ];
}

/** The Saved runs list: the player's and shared experiments, newest first. */
export function savedRunsTree(stored: readonly LibraryItem[]): TreeNode[] {
  const runs = [...stored]
    .filter((i): i is ExperimentItem => i.kind === "experiment" && isListed(i))
    .sort(newestFirst);
  return [
    ...group(
      "experiment:mine",
      sourceLabel("mine"),
      runs.filter((r) => r.source === "mine"),
    ),
    ...group(
      "experiment:shared",
      sourceLabel("shared"),
      runs.filter((r) => r.source === "shared"),
    ),
  ];
}

/** The hooks a scenario calls: `on_stop` when vehicles stop, `on_review` when stations review. */
export function scenarioHooks(scenario: Scenario): { stops: boolean; reviews: boolean } {
  return {
    stops: scenario.vehicles.length > 0,
    reviews: scenario.stations.some((s) => s.review !== undefined),
  };
}

/** Why a policy cannot act on a scenario, or null when it can. */
export function unfitReason(hooks: PolicyHooks, scenario: Scenario): string | null {
  if (hooks.error) return "It does not load.";
  const { stops, reviews } = scenarioHooks(scenario);
  const acts =
    (stops && hooks.hooks.includes("on_stop")) || (reviews && hooks.hooks.includes("on_review"));
  if (acts) return null;
  if (hooks.hooks.includes("on_review"))
    return "This scenario has no reviews, so on_review is never called.";
  if (hooks.hooks.includes("on_stop"))
    return "This scenario has no vehicles, so on_stop is never called.";
  return "It defines neither on_stop nor on_review.";
}

export interface Row {
  node: TreeNode;
  depth: number;
  parent: string | null;
  expanded: boolean;
}

/** Groups open at first: all but those marked collapsed. */
export function defaultExpanded(tree: readonly TreeNode[]): Set<string> {
  return new Set(tree.filter((n) => n.type === "group" && !n.collapsed).map((n) => n.key));
}

/** The rows a list shows, in order, given which groups are expanded. */
export function visibleRows(tree: readonly TreeNode[], expanded: ReadonlySet<string>): Row[] {
  const rows: Row[] = [];
  const walk = (nodes: readonly TreeNode[], depth: number, parent: string | null) => {
    for (const node of nodes) {
      const open = node.children.length > 0 && expanded.has(node.key);
      rows.push({ node, depth, parent, expanded: open });
      if (open) walk(node.children, depth + 1, node.key);
    }
  };
  walk(tree, 1, null);
  return rows;
}

export interface TreeMove {
  focus: string | null;
  expanded: Set<string>;
  /** The key of the item to use, for Enter. */
  use?: string;
}

/** Focus and expansion after a key press, following the ARIA tree view pattern. */
export function treeKey(
  rows: readonly Row[],
  focus: string | null,
  key: string,
  expanded: ReadonlySet<string>,
): TreeMove | null {
  const next = new Set(expanded);
  const index = Math.max(
    0,
    rows.findIndex((r) => r.node.key === focus),
  );
  const row = rows[index];
  if (!row) return null;
  const at = (i: number) => rows[Math.max(0, Math.min(rows.length - 1, i))]?.node.key ?? null;
  switch (key) {
    case "ArrowDown":
      return { focus: at(index + 1), expanded: next };
    case "ArrowUp":
      return { focus: at(index - 1), expanded: next };
    case "Home":
      return { focus: at(0), expanded: next };
    case "End":
      return { focus: at(rows.length - 1), expanded: next };
    case "ArrowRight":
      if (row.node.children.length === 0) return { focus: row.node.key, expanded: next };
      if (!row.expanded) {
        next.add(row.node.key);
        return { focus: row.node.key, expanded: next };
      }
      return { focus: at(index + 1), expanded: next };
    case "ArrowLeft":
      if (row.expanded) {
        next.delete(row.node.key);
        return { focus: row.node.key, expanded: next };
      }
      return { focus: row.parent ?? row.node.key, expanded: next };
    case "Enter":
    case " ":
      if (row.node.type === "item") {
        return key === "Enter"
          ? { focus: row.node.key, expanded: next, use: row.node.key }
          : { focus: row.node.key, expanded: next };
      }
      if (row.expanded) next.delete(row.node.key);
      else next.add(row.node.key);
      return { focus: row.node.key, expanded: next };
    default:
      return null;
  }
}
