import { classicTemplates } from "@regolith-rail/scenario-kit";
import { describe, expect, it } from "vitest";
import {
  catalogue,
  catalogueItem,
  experimentParts,
  lessonOf,
  referenceOf,
  referencePolicyItem,
} from "./catalogue.ts";
import { contentHash, stableHash } from "./content-hash.ts";
import { itemId, type LibraryItem, parseItemId, parsePartId } from "./library.ts";
import { classicExperiment } from "./test-fixtures.ts";

const ids = (source: string, kind: string) =>
  catalogue.filter((i) => i.source === source && i.kind === kind).map((i) => i.id);

describe("catalogue", () => {
  it("lists the starters, built-in policies and classic templates the site ships", () => {
    expect(ids("builtin", "scenario")).toEqual([
      "builtin:scenario:two-station",
      "builtin:scenario:relay",
      "builtin:scenario:two-trains",
      "builtin:scenario:mixed-line",
      "builtin:scenario:storm-shock",
    ]);
    expect(ids("builtin", "policy")).toEqual([
      "builtin:policy:naive",
      "builtin:policy:supply-to-demand",
    ]);
    for (const template of classicTemplates) {
      for (const kind of ["scenario", "policy"] as const) {
        expect(catalogueItem(itemId("classic", kind, template.name)), template.name).toBeDefined();
      }
    }
    expect(ids("example", "policy")).toContain("example:policy:docs/ops/min-max#1");
    expect(ids("example", "scenario")).toContain("example:scenario:docs/scenarios/writing#1");
    expect(catalogue.filter((i) => i.kind === "experiment")).toEqual([]);
  });

  it("lists only working policies: documentation snippets are kept for their pages, unlisted", () => {
    const listed = catalogue.filter((i) => i.listed !== false && i.source === "example");
    expect(listed.map((i) => [i.id, i.name])).toEqual([
      ["example:policy:docs/failure-modes/dead-stock#1", "Relay station fix"],
      ["example:policy:docs/failure-modes/disruption-recovery#1", "Storm shock fix"],
      ["example:policy:docs/failure-modes/double-dispatch#1", "Two trains fix"],
      ["example:policy:docs/failure-modes/half-capacity#1", "Two stations fix"],
      ["example:policy:docs/failure-modes/ping-pong#1", "Mixed line fix"],
    ]);
    expect(catalogueItem("example:policy:docs/classic/reorder#2")?.listed).toBe(false);
  });

  it("gives every item a valid, unique id, a name and a one-line description", () => {
    expect(new Set(catalogue.map((i) => i.id)).size).toBe(catalogue.length);
    for (const item of catalogue) {
      const parsed = parseItemId(item.id);
      expect(parsed, item.id).toMatchObject({ source: item.source, kind: item.kind });
      expect(item.name, item.id).not.toBe("");
      expect(item.description, item.id).toMatch(/\S/);
      expect(item.description, item.id).not.toContain("\n");
    }
  });

  it("pairs documentation examples with the scenario they run on", () => {
    const example = catalogueItem("example:policy:docs/failure-modes/disruption-recovery#1");
    expect(example?.example).toEqual({ scenario: "builtin:scenario:storm-shock", seed: 1 });
    expect(catalogueItem(example?.example?.scenario ?? "")).toBeDefined();
  });

  it("gives every starter a lesson with its failure-mode page and suggested fix", () => {
    for (const id of ["two-station", "relay", "two-trains", "mixed-line", "storm-shock"]) {
      const starter = catalogueItem(itemId("builtin", "scenario", id));
      const lesson = starter?.kind === "scenario" ? starter.lesson : undefined;
      expect(lesson?.docs, id).toMatch(/^failure-modes\//);
      const fix = catalogueItem(lesson?.fix ?? "");
      expect(fix, id).toMatchObject({ kind: "policy", source: "example" });
      expect(fix?.example?.scenario, id).toBe(starter?.id);
    }
    const storm = catalogueItem("builtin:scenario:storm-shock");
    expect(storm?.kind === "scenario" && storm.lesson?.fix).toBe(
      "example:policy:docs/failure-modes/disruption-recovery#1",
    );
  });

  it("gives every classic template a lesson with its page and reference policy", () => {
    for (const template of classicTemplates) {
      const scenario = catalogueItem(itemId("classic", "scenario", template.name));
      expect(scenario?.kind === "scenario" && scenario.lesson, template.name).toEqual({
        docs: expect.stringMatching(/^(classic|book)\//),
        reference: template.name,
      });
    }
  });

  it("finds the lesson of a copy through the item it was copied from, or its template", () => {
    const copy: LibraryItem = {
      id: "mine:scenario:c",
      kind: "scenario",
      source: "mine",
      name: "Storm shock (copy)",
      origin: "builtin:scenario:storm-shock",
      content: { kind: "script", source: "-- edited", starterId: null },
      createdAt: 1,
      updatedAt: 1,
    };
    expect(lessonOf(copy, catalogueItem)?.docs).toBe("failure-modes/disruption-recovery");
    const { origin: _origin, ...unlinked } = copy;
    const orphan: LibraryItem = {
      ...unlinked,
      content: {
        kind: "script",
        source: "return classic.reorder {}",
        starterId: null,
        template: { name: "classic.reorder", params: {} },
      },
    };
    expect(lessonOf(orphan, catalogueItem)?.reference).toBe("classic.reorder");
  });
});

describe("transient items", () => {
  const newsvendor = classicTemplates.find((t) => t.name === "classic.newsvendor");
  if (!newsvendor) throw new Error("newsvendor template missing");

  it("give reference policies for equal parameters equal ids, matching the template", () => {
    const a = referencePolicyItem("classic.newsvendor", { lost_cost: 9 });
    const b = referencePolicyItem("classic.newsvendor", { ...newsvendor.defaults, lost_cost: 9 });
    expect(a.id).toBe(b.id);
    expect(a.listed).toBe(false);
    expect(a.content).toBe(newsvendor.reference({ ...newsvendor.defaults, lost_cost: 9 }).policy);
    expect(referencePolicyItem("classic.newsvendor", { lost_cost: 10 }).id).not.toBe(a.id);
    expect(referenceOf(a.id)).toBe("classic.newsvendor");
  });

  it("use the catalogue item at the template's defaults", () => {
    expect(referencePolicyItem("classic.newsvendor", {}).id).toBe(
      itemId("classic", "policy", "classic.newsvendor"),
    );
  });

  it("hash values independently of key order", async () => {
    expect(stableHash({ a: 1, b: { c: [1, 2] } })).toBe(stableHash({ b: { c: [1, 2] }, a: 1 }));
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
    expect(await contentHash({ a: 1, b: 2 })).toBe(await contentHash({ b: 2, a: 1 }));
    expect(await contentHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stand for an experiment's parts under its source", () => {
    const parts = experimentParts(classicExperiment());
    expect(parts.map((p) => [parsePartId(p.id)?.part, p.kind, p.source, p.listed])).toEqual([
      ["scenario", "scenario", "mine", false],
      ["policy", "policy", "mine", false],
    ]);
    expect(parts[1]?.origin).toBe("classic:policy:classic.reorder");
  });
});
