import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readLuaSources } from "../scripts/lua-sources.ts";
import { constructs } from "./constructs.ts";
import { generatedFiles, LUA_SOURCE_DIRECTORIES } from "./generate.ts";
import { SCENARIO_LIBRARIES } from "./libraries.generated.ts";
import { CLASSIC_POLICIES } from "./policies.generated.ts";
import { STARTER_SCRIPTS } from "./starters.generated.ts";

const root = new URL("../../../", import.meta.url);
const lua = {
  libraries: readLuaSources(new URL(`${LUA_SOURCE_DIRECTORIES.libraries}/`, root)),
  policies: readLuaSources(new URL(`${LUA_SOURCE_DIRECTORIES.policies}/`, root)),
  starters: readLuaSources(new URL(`${LUA_SOURCE_DIRECTORIES.starters}/`, root)),
};
const hint = "run `pnpm --filter @regolith-rail/scenario-kit generate`";
const EMBEDDED = [
  "packages/scenario-kit/src/libraries.generated.ts",
  "packages/scenario-kit/src/policies.generated.ts",
  "packages/scenario-kit/src/starters.generated.ts",
];

describe("generated scenario kit files", () => {
  for (const [path, expected] of Object.entries(generatedFiles(lua))) {
    if (EMBEDDED.includes(path)) continue;
    it(`${path} is up to date`, () => {
      const actual = readFileSync(new URL(path, root), "utf8");
      if (path.endsWith(".json")) expect(JSON.parse(actual), hint).toEqual(JSON.parse(expected));
      else expect(actual.replace(/\r\n/g, "\n"), hint).toBe(expected);
    });
  }

  it("embeds the libraries and policies exactly", () => {
    expect(SCENARIO_LIBRARIES, hint).toEqual(lua.libraries);
    expect(CLASSIC_POLICIES, hint).toEqual(lua.policies);
    expect(STARTER_SCRIPTS, hint).toEqual(lua.starters);
  });
});

describe("construct descriptions", () => {
  it("give every construct and parameter a summary and a documentation page", () => {
    const names = new Set<string>();
    for (const c of constructs) {
      expect(names.has(c.name), `duplicate ${c.name}`).toBe(false);
      names.add(c.name);
      expect(c.summary.length, c.name).toBeGreaterThan(10);
      expect(c.docs, c.name).toMatch(/^(scenarios|classic|book)\//);
      for (const p of c.params) expect(p.summary.length, `${c.name}.${p.name}`).toBeGreaterThan(5);
    }
  });
});
