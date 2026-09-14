import { starterScenario } from "@regolith-rail/engine";
import { describe, expect, it } from "vitest";
import { catalogue, catalogueItem } from "./catalogue.ts";
import {
  defaultExpanded,
  fitContext,
  policyTree,
  savedRunsTree,
  scenarioTree,
  type TreeNode,
  treeKey,
  unfitReason,
  visibleRows,
} from "./explorer.ts";
import type { LibraryItem } from "./library.ts";
import { classicExperiment } from "./test-fixtures.ts";

const policy = (id: string, name: string, updatedAt: number): LibraryItem => ({
  id,
  kind: "policy",
  source: "mine",
  name,
  content: "return {}",
  createdAt: 1,
  updatedAt,
});

const labels = (nodes: readonly TreeNode[]) =>
  nodes.map((n) => (n.type === "item" ? n.item.name : n.label));

const groupIds = (tree: readonly TreeNode[], label: string) =>
  tree.find((n) => n.type === "group" && n.label === label)?.children.map((n) => n.key.slice(5));

const lookup =
  (stored: readonly LibraryItem[] = []) =>
  (id: string) =>
    stored.find((i) => i.id === id) ?? catalogueItem(id);

describe("scenario list", () => {
  it("groups scenarios by source and leaves out empty groups", () => {
    const tree = scenarioTree(catalogue, []);
    expect(labels(tree)).toEqual(["Built in", "Classic problems"]);
    expect(labels(tree[0]?.children ?? [])).toEqual([
      "Two stations",
      "Relay station",
      "Two trains",
      "Mixed line",
      "Storm shock",
    ]);
    const items = tree.flatMap((n) => n.children);
    expect(items.every((n) => n.type === "item" && n.item.kind === "scenario")).toBe(true);
  });
});

describe("policy list", () => {
  it("puts the policies written for storm-shock first", () => {
    const storm = catalogueItem("builtin:scenario:storm-shock");
    const tree = policyTree(catalogue, [], fitContext(storm, lookup()));
    expect(labels(tree)).toEqual(["For this scenario", "Built in", "Other examples"]);
    expect(groupIds(tree, "For this scenario")).toEqual([
      "example:policy:docs/failure-modes/disruption-recovery#1",
    ]);
    expect(groupIds(tree, "Built in")).toEqual([
      "builtin:policy:balance-stock",
      "builtin:policy:supply-to-demand",
    ]);
    expect(defaultExpanded(tree).has("group:policy:other")).toBe(false);
  });

  it("puts a classic template's reference policy first, also for a copy of the template", () => {
    const copy: LibraryItem = {
      id: "mine:scenario:c",
      kind: "scenario",
      source: "mine",
      name: "Reorder (copy)",
      origin: "classic:scenario:classic.reorder",
      content: { kind: "script", source: "return classic.reorder { demand = 6 }", starterId: null },
      createdAt: 1,
      updatedAt: 1,
    };
    const tree = policyTree(catalogue, [copy], fitContext(copy, lookup([copy])));
    expect(groupIds(tree, "For this scenario")).toEqual(["classic:policy:classic.reorder"]);
    expect(groupIds(tree, "Other examples")).not.toContain("classic:policy:classic.reorder");
  });

  it("lists the player's policies newest first and hides unlisted ones", () => {
    const stored = [
      policy("mine:policy:a", "older", 1),
      policy("mine:policy:b", "newer", 2),
      { ...policy("mine:policy:c", "unsaved", 3), listed: false },
    ];
    const tree = policyTree(catalogue, stored, fitContext(undefined, lookup(stored)));
    const mine = tree.find((n) => n.type === "group" && n.label === "Mine");
    expect(labels(mine?.children ?? [])).toEqual(["newer", "older"]);
  });
});

describe("saved runs list", () => {
  it("lists only experiments, the player's and shared, newest first", () => {
    const older = { ...classicExperiment(), id: "mine:experiment:a", name: "older", updatedAt: 1 };
    const newer = { ...classicExperiment(), id: "mine:experiment:b", name: "newer", updatedAt: 2 };
    const shared = {
      ...classicExperiment(),
      id: "shared:experiment:s",
      source: "shared" as const,
      name: "link",
    };
    const tree = savedRunsTree([older, policy("mine:policy:x", "not a run", 3), newer, shared]);
    expect(labels(tree)).toEqual(["Mine", "Shared with me"]);
    expect(labels(tree[0]?.children ?? [])).toEqual(["newer", "older"]);
    expect(savedRunsTree([])).toEqual([]);
  });
});

describe("policy fit", () => {
  it("marks a policy none of whose hooks the scenario calls", () => {
    const twoStation = starterScenario("two-station");
    expect(unfitReason({ hooks: ["on_stop"] }, twoStation)).toBeNull();
    expect(unfitReason({ hooks: ["on_review"] }, twoStation)).toBe(
      "This scenario has no reviews, so on_review is never called.",
    );
    expect(unfitReason({ hooks: ["on_start"] }, twoStation)).toBe(
      "It defines neither on_stop nor on_review.",
    );
  });
});

describe("list navigation", () => {
  const stored = [policy("mine:policy:a", "buffer", 1)];
  const tree = policyTree(catalogue, stored, fitContext(undefined, lookup(stored)));
  const start = defaultExpanded(tree);
  const rows = (expanded: ReadonlySet<string>) => visibleRows(tree, expanded);

  it("opens every group except the collapsed examples at first", () => {
    expect(start.has("group:policy:builtin")).toBe(true);
    expect(start.has("group:policy:other")).toBe(false);
    expect(rows(start).some((r) => r.node.key === "item:builtin:policy:balance-stock")).toBe(true);
    expect(rows(start).some((r) => r.node.key.startsWith("item:example:"))).toBe(false);
  });

  it("moves through rows, into and out of groups, and to the ends", () => {
    const visible = rows(start);
    const move = (from: string, key: string) => treeKey(visible, from, key, start);
    expect(move("group:policy:builtin", "ArrowDown")?.focus).toBe(
      "item:builtin:policy:balance-stock",
    );
    expect(move("item:builtin:policy:balance-stock", "ArrowLeft")?.focus).toBe(
      "group:policy:builtin",
    );
    expect(move("group:policy:builtin", "ArrowLeft")?.expanded.has("group:policy:builtin")).toBe(
      false,
    );
    expect(move("group:policy:other", "ArrowRight")?.expanded.has("group:policy:other")).toBe(true);
    expect(move("item:builtin:policy:balance-stock", "Home")?.focus).toBe(visible[0]?.node.key);
    expect(move("group:policy:builtin", "End")?.focus).toBe(visible.at(-1)?.node.key);
  });

  it("uses an item with Enter, and toggles a group with Enter or Space", () => {
    const move = (from: string, key: string) => treeKey(rows(start), from, key, start);
    expect(move("item:builtin:policy:balance-stock", "Enter")?.use).toBe(
      "item:builtin:policy:balance-stock",
    );
    expect(move("item:builtin:policy:balance-stock", " ")?.use).toBeUndefined();
    expect(move("group:policy:mine", " ")?.expanded.has("group:policy:mine")).toBe(false);
    expect(move("group:policy:mine", "x")).toBeNull();
  });
});
