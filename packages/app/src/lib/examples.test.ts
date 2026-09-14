import { describe, expect, it } from "vitest";
import { catalogueItem } from "./catalogue.ts";
import {
  exampleFragment,
  exampleFragmentFor,
  findExampleItem,
  scenarioFragment,
  scenarioFragmentFor,
} from "./examples.ts";

describe("documentation examples", () => {
  it("round-trip between items and fragments", () => {
    const id = "example:policy:docs/ops/min-max#1";
    const fragment = exampleFragmentFor(id);
    expect(fragment).toBe("#example.ops/min-max.1");
    expect(exampleFragment(fragment as string)).toBe(id);
    expect(exampleFragment("#v1.abc")).toBeNull();
  });

  it("prefer the example on the page being read when pages share its source", () => {
    const source = catalogueItem("example:policy:docs/ops/min-max#1")?.content as string;
    expect(findExampleItem(source, false, "ops/min-max")).toBe("example:policy:docs/ops/min-max#1");
    expect(findExampleItem(source, false, "failure-modes/disruption-recovery")).toBe(
      "example:policy:docs/failure-modes/disruption-recovery#1",
    );
    expect(findExampleItem("return 'nothing like it'", false)).toBeNull();
  });
});

describe("chapter scenarios", () => {
  it("round-trip between items and fragments", () => {
    const id = "classic:scenario:classic.newsvendor";
    expect(scenarioFragment(scenarioFragmentFor(id))).toBe(id);
    expect(scenarioFragment("#example.ops/min-max.1")).toBeNull();
  });
});
