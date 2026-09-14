import { classicTemplates } from "@regolith-rail/scenario-kit";
import { describe, expect, it } from "vitest";
import {
  catalogue,
  catalogueItem,
  experimentParts,
  referenceOf,
  referencePolicyItem,
} from "./catalogue.ts";
import { contentHash, stableHash } from "./content-hash.ts";
import { type ExperimentItem, itemId, parseItemId, parsePartId } from "./library.ts";

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
      for (const kind of ["scenario", "policy", "experiment"] as const) {
        expect(catalogueItem(itemId("classic", kind, template.name)), template.name).toBeDefined();
      }
    }
    expect(ids("example", "policy")).toEqual(
      expect.arrayContaining([
        "example:policy:moving-average",
        "example:policy:docs/ops/min-max#1",
      ]),
    );
    expect(ids("example", "scenario")).toContain("example:scenario:docs/scenarios/writing#1");
    expect(ids("builtin", "experiment")).toContain("builtin:experiment:disruption-recovery");
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
    const fix = catalogueItem("builtin:experiment:disruption-recovery") as ExperimentItem;
    expect(fix.content.scenario.origin).toBe("builtin:scenario:storm-shock");
    expect(fix.content.policy.content).toBe(example?.content);
  });

  it("pairs each classic experiment with its template's reference policy at the defaults", () => {
    for (const template of classicTemplates) {
      const experiment = catalogueItem(
        itemId("classic", "experiment", template.name),
      ) as ExperimentItem;
      expect(experiment.content.policy.content).toBe(template.reference(template.defaults).policy);
      expect(experiment.content.scenario.content.template).toEqual({
        name: template.name,
        params: template.defaults,
      });
    }
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
    const experiment = catalogueItem("classic:experiment:classic.reorder") as ExperimentItem;
    const parts = experimentParts(experiment);
    expect(parts.map((p) => [parsePartId(p.id)?.part, p.kind, p.source, p.listed])).toEqual([
      ["scenario", "scenario", "classic", false],
      ["policy", "policy", "classic", false],
    ]);
    expect(parts[1]?.origin).toBe("classic:policy:classic.reorder");
  });
});
