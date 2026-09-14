import type { ScenarioSource } from "./scenario-source.ts";

/** What a library item is. */
export type ItemKind = "scenario" | "policy" | "experiment";

/** Where a library item comes from. Only `mine` items can change. */
export type ItemSource = "builtin" | "example" | "classic" | "mine" | "shared";

export type ItemId = string;

/** Sources in the order the explorer lists them, with their labels. */
export const SOURCES: readonly { source: ItemSource; label: string }[] = [
  { source: "builtin", label: "Built in" },
  { source: "example", label: "Examples" },
  { source: "classic", label: "Classic problems" },
  { source: "mine", label: "Mine" },
  { source: "shared", label: "Shared with me" },
];

/** Kinds in the order the explorer lists them, with their labels. */
export const KINDS: readonly { kind: ItemKind; label: string }[] = [
  { kind: "scenario", label: "Scenarios" },
  { kind: "policy", label: "Policies" },
  { kind: "experiment", label: "Experiments" },
];

/** One part of an experiment: a copy of its content, and the item it was made from. */
export interface ExperimentPart<T> {
  content: T;
  name: string;
  origin?: ItemId;
}

/** A snapshot of a run's setup. Later edits to the items it was made from do not change it. */
export interface ExperimentContent {
  scenario: ExperimentPart<ScenarioSource>;
  policy: ExperimentPart<string>;
  compare?: ExperimentPart<string>;
  seed: number;
  view: "run" | "batch";
  saveReloadTest: boolean;
  batch: { seedCount: number; baseSeed: number; compare: boolean };
}

interface ItemBase {
  id: ItemId;
  source: ItemSource;
  name: string;
  /** One line shown on hover or focus. */
  description?: string;
  /** The item this one was copied from. */
  origin?: ItemId;
  createdAt: number;
  updatedAt: number;
  /** False for items that exist only to fill a slot, such as an experiment's parts. */
  listed?: boolean;
  /** For a documentation example: the scenario it runs on, and its seed. */
  example?: { scenario: ItemId; seed: number };
}

/** What a shipped scenario teaches, and the policy that goes with it. */
export interface ScenarioLesson {
  /** The documentation page that explains the scenario, such as `failure-modes/half-capacity`. */
  docs: string;
  /** The suggested fix: the runnable example on a starter's failure-mode page. */
  fix?: ItemId;
  /** The classic template whose reference policy goes with the scenario. */
  reference?: string;
}

export interface ScenarioItem extends ItemBase {
  kind: "scenario";
  content: ScenarioSource;
  lesson?: ScenarioLesson;
}

export interface PolicyItem extends ItemBase {
  kind: "policy";
  content: string;
}

export interface ExperimentItem extends ItemBase {
  kind: "experiment";
  content: ExperimentContent;
}

export type LibraryItem = ScenarioItem | PolicyItem | ExperimentItem;

const KIND_NAMES = new Set<string>(["scenario", "policy", "experiment"]);
const SOURCE_NAMES = new Set<string>(SOURCES.map((s) => s.source));

/** An item id such as `builtin:policy:balance-stock`. The key may itself contain colons. */
export const itemId = (source: ItemSource, kind: ItemKind, key: string): ItemId =>
  `${source}:${kind}:${key}`;

export function parseItemId(
  id: ItemId,
): { source: ItemSource; kind: ItemKind; key: string } | null {
  const first = id.indexOf(":");
  const second = id.indexOf(":", first + 1);
  if (first < 0 || second < 0) return null;
  const source = id.slice(0, first);
  const kind = id.slice(first + 1, second);
  const key = id.slice(second + 1);
  if (!SOURCE_NAMES.has(source) || !KIND_NAMES.has(kind) || key === "") return null;
  return { source: source as ItemSource, kind: kind as ItemKind, key };
}

export type ExperimentPartName = "scenario" | "policy" | "compare";

/** The id of an experiment's part, such as `experiment:mine:experiment:1/policy`. */
export const partId = (experiment: ItemId, part: ExperimentPartName): ItemId =>
  `experiment:${experiment}/${part}`;

export function parsePartId(id: ItemId): { experiment: ItemId; part: ExperimentPartName } | null {
  const match = /^experiment:(.+)\/(scenario|policy|compare)$/.exec(id);
  return match ? { experiment: match[1] as ItemId, part: match[2] as ExperimentPartName } : null;
}

/** Whether an item may be changed in place; everything else is copied on edit. */
export const isEditable = (id: ItemId) => parseItemId(id)?.source === "mine";

/** A fresh id for a new Mine item. */
export const newMineId = (kind: ItemKind): ItemId => itemId("mine", kind, crypto.randomUUID());

const COPY_SUFFIX = / \(copy(?: \d+)?\)$/;

/** The first free name for a copy: "balance-stock (copy)", then "balance-stock (copy 2)", and so on. */
export function copyName(original: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const stem = original.replace(COPY_SUFFIX, "");
  for (let n = 1; ; n++) {
    const name = n === 1 ? `${stem} (copy)` : `${stem} (copy ${n})`;
    if (!used.has(name)) return name;
  }
}

/** The name itself when free, otherwise the name with the first free number: "buffer 2". */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(name)) return name;
  for (let n = 2; ; n++) {
    if (!used.has(`${name} ${n}`)) return `${name} ${n}`;
  }
}
