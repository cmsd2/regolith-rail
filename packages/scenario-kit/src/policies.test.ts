import { describe, expect, it } from "vitest";
import { examplePolicies, policyHeader } from "./policies.ts";

describe("example policies", () => {
  it("are named and described by their opening comments", () => {
    expect(examplePolicies.map((p) => [p.file, p.name])).toEqual([
      ["fill-the-route", "Fill the route"],
      ["moving-average", "Moving-average order-up-to"],
    ]);
    for (const policy of examplePolicies) {
      expect(policy.description, policy.file).toMatch(/^[A-Z].+\.$/);
    }
  });

  it("read a header that continues on the next line and stops at a blank comment", () => {
    const source =
      "-- Balance stock: how trains appear to decide what to\n-- carry.\n--\n-- More.\n";
    expect(policyHeader(source)).toEqual({
      name: "Balance stock",
      description: "How trains appear to decide what to carry.",
    });
  });

  it("find no header without a name and description", () => {
    expect(policyHeader("local x = 1\n")).toBeNull();
    expect(policyHeader("-- Just a comment\n")).toBeNull();
  });
});
