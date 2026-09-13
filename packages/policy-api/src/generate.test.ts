import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { editorEntries, generatedFiles } from "./generate.ts";
import { apiTypes } from "./spec.ts";

const root = new URL("../../../", import.meta.url);
const withoutWhitespace = (text: string) => text.replace(/\s+/g, "").replace(/,([}\]])/g, "$1");

describe("generated Policy API files", () => {
  for (const [path, expected] of Object.entries(generatedFiles())) {
    it(`${path} is up to date`, () => {
      const actual = readFileSync(new URL(path, root), "utf8");
      const hint = "run `pnpm --filter @regolith-rail/policy-api generate`";
      if (path.endsWith(".json")) expect(JSON.parse(actual), hint).toEqual(JSON.parse(expected));
      else if (path.endsWith(".ts"))
        expect(withoutWhitespace(actual), hint).toBe(withoutWhitespace(expected));
      else expect(actual.replace(/\r\n/g, "\n"), hint).toBe(expected);
    });
  }
});

describe("Policy API description", () => {
  it("documents every member with a summary and a documentation page", () => {
    for (const type of apiTypes) {
      expect(type.docs, type.name).toMatch(/^api\//);
      for (const field of type.fields) {
        expect(field.summary.length, `${type.name}.${field.name}`).toBeGreaterThan(10);
        if (field.source === "snapshot")
          expect(field.ts, `${type.name}.${field.name}`).toBeDefined();
      }
    }
  });

  it("gives the editor paths for nested members", () => {
    const paths = editorEntries().map((e) => e.path);
    expect(paths).toContain("ctx.train.cargo");
    expect(paths).toContain("ctx.line.stations[i].stock");
    expect(paths).toContain("ctx.line.travel_time");
    expect(paths).toContain("ctx.station.distance_to_next");
  });
});
