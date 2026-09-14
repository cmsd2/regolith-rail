import {
  checkFrontmatter,
  docAnchors,
  readContentPages,
  unresolvedTarget,
} from "@regolith-rail/docs/node";
import { starterScenarios } from "@regolith-rail/engine";
import { apiTypes, editorEntries, opsBlocks } from "@regolith-rail/policy-api";
import { describe, expect, it } from "vitest";
import { diagnosticDocs } from "../lib/format.ts";
import { METRICS } from "../lib/metrics.ts";

const anchors = docAnchors();
const unresolved = (targets: string[]) =>
  targets.map((target) => unresolvedTarget(anchors, target)).filter(Boolean);

describe("documentation links from the application", () => {
  it("every starter scenario links to an existing failure-mode page or book case study", () => {
    const targets = starterScenarios.map((s) => (s.document as { docs?: string }).docs ?? "");
    for (const target of targets)
      expect(target).toMatch(/^(failure-modes\/[\w-]+|book\/[\w-]+#case-study-[\w-]+)$/);
    expect(unresolved(targets)).toEqual([]);
  });

  it("every metric links to its definition", () => {
    expect(unresolved(METRICS.map((m) => `metrics#${m.anchor}`))).toEqual([]);
  });

  it("every hover and completion entry links to its reference", () => {
    expect(unresolved(editorEntries().map((e) => e.docs))).toEqual([]);
    expect(unresolved([...apiTypes, ...opsBlocks].map((t) => t.docs))).toEqual([]);
  });

  it("diagnostics link to the rule they break", () => {
    const messages = [
      "integer division // is not available in Lua 5.1; use math.floor(a / b)",
      "os is not available to policies; use ctx.now for the time",
      "instruction budget exceeded; the policy ran too long at this stop",
      "ops.lookahead needs the line information level, but this scenario provides local",
      "ctx.memory.x holds a function",
      "ops.min_max: min must not be greater than max",
      "attempt to index a nil value",
    ];
    const targets = messages.map(diagnosticDocs);
    expect(targets).toEqual([
      "language#lua-51-subset",
      "language#sandbox",
      "language#instruction-budget",
      "language#information-levels",
      "language#memory",
      "ops/min-max",
      "language",
    ]);
    expect(unresolved(targets)).toEqual([]);
  });

  it("the fixed links in reference pages and components resolve", () => {
    expect(
      unresolved([
        "language#information-levels",
        "game-mechanics#evidence-levels",
        "game-mechanics#station-balancing",
        "ops#pipeline",
        "ops#helper",
        "ops/min-max#parameters",
        "about",
      ]),
    ).toEqual([]);
  });

  it("every content page has a title and a known section", () => {
    expect(checkFrontmatter(readContentPages())).toEqual([]);
  });
});
