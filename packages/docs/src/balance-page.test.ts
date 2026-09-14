import {
  hashRun,
  type RunOutput,
  runSimulation,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { beforeAll, describe, expect, it } from "vitest";
import { readContentPages } from "./content.ts";
import { extractExamples } from "./examples.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const withoutTraces = (out: RunOutput) => ({
  ...out,
  events: out.events.filter((e) => e.kind !== "trace"),
});

describe("the ops.balance page", () => {
  it("shows plain Lua that makes the same moves as the built-in balance-stock policy on every starter, seeds 1 to 10", () => {
    const page = readContentPages().find((p) => p.slug === "ops/balance");
    const plain = page
      ? extractExamples(page.slug, page.tree).find((e) =>
          e.source.includes("function policy.on_stop"),
        )
      : undefined;
    if (!plain) throw new Error("the ops.balance page should show the rule in plain Lua");
    const lua = runtime.createPolicy(plain.source);
    const ops = runtime.createPolicy(BUILT_IN_POLICIES["balance-stock"]);
    try {
      expect(BUILT_IN_POLICIES["balance-stock"]).toContain("ops.balance {}");
      for (const starter of starterScenarios) {
        const result = validateScenario(starter.document);
        if (!result.ok) throw new Error("invalid starter");
        for (let seed = 1; seed <= 10; seed++) {
          const expected = runSimulation(result.scenario, lua, { seed, detail: "summary" });
          const actual = withoutTraces(
            runSimulation(result.scenario, ops, { seed, detail: "summary" }),
          );
          expect(hashRun(actual), `${starter.id} seed ${seed}`).toBe(hashRun(expected));
        }
      }
    } finally {
      lua.close();
      ops.close();
    }
  }, 600_000);
});
