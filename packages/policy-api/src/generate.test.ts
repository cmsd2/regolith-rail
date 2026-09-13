import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readLuaSources } from "../scripts/lua-sources.ts";
import { editorEntries, generatedFiles, LUA_SOURCE_DIRECTORIES } from "./generate.ts";
import { OPS_LIBRARY } from "./ops.generated.ts";
import { BUILT_IN_POLICIES } from "./policies.generated.ts";
import { apiTypes } from "./spec.ts";

const root = new URL("../../../", import.meta.url);
const withoutWhitespace = (text: string) => text.replace(/\s+/g, "").replace(/,([}\]])/g, "$1");
const lua = {
  policies: readLuaSources(new URL(`${LUA_SOURCE_DIRECTORIES.policies}/`, root)),
  ops: readLuaSources(new URL(`${LUA_SOURCE_DIRECTORIES.ops}/`, root)),
};
const hint = "run `pnpm --filter @regolith-rail/policy-api generate`";

// Modules embedding Lua are compared by value below: the formatter may change
// the quote style of their long string literals.
const EMBEDDED = [
  "packages/policy-api/src/policies.generated.ts",
  "packages/policy-api/src/ops.generated.ts",
];

describe("generated Policy API files", () => {
  for (const [path, expected] of Object.entries(generatedFiles(lua))) {
    if (EMBEDDED.includes(path)) continue;
    it(`${path} is up to date`, () => {
      const actual = readFileSync(new URL(path, root), "utf8");
      if (path.endsWith(".json")) expect(JSON.parse(actual), hint).toEqual(JSON.parse(expected));
      else if (path.endsWith(".ts"))
        expect(withoutWhitespace(actual), hint).toBe(withoutWhitespace(expected));
      else expect(actual.replace(/\r\n/g, "\n"), hint).toBe(expected);
    });
  }

  it("embeds the built-in policies and ops library exactly", () => {
    expect(BUILT_IN_POLICIES, hint).toEqual(lua.policies);
    expect(OPS_LIBRARY, hint).toEqual(lua.ops);
  });
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
    expect(paths).toContain("ctx.vehicle.cargo");
    expect(paths).toContain("ctx.stations[i].stock");
    expect(paths).toContain("ctx.here.neighbours[i].station");
    expect(paths).toContain("ctx.vehicle.route.ahead[i].travel_time");
    expect(paths).toContain("ctx.travel_time");
    expect(paths).toContain("ctx.order");
    expect(paths).toContain("ctx.vehicles[i].stops");
  });
});
