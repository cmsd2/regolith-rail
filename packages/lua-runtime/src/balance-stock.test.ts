import {
  balanceStockReferencePolicy,
  hashRun,
  runSimulation,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { beforeAll, describe, expect, it } from "vitest";
import { LuaRuntime } from "./policy.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

describe("balance-stock.lua", () => {
  for (const starter of starterScenarios) {
    it(`matches the reference implementation on ${starter.id} for seeds 1 to 50`, () => {
      const result = validateScenario(starter.document);
      if (!result.ok) throw new Error("invalid starter");
      const lua = runtime.createPolicy(BUILT_IN_POLICIES["balance-stock"]);
      expect(lua.error).toBeUndefined();
      for (const seed of SEEDS) {
        const expected = runSimulation(result.scenario, balanceStockReferencePolicy(), { seed });
        const actual = runSimulation(result.scenario, lua, { seed });
        if (hashRun(actual) !== hashRun(expected)) {
          expect(actual.events, `${starter.id} seed ${seed}`).toEqual(expected.events);
          expect(actual.metrics, `${starter.id} seed ${seed}`).toEqual(expected.metrics);
        }
        expect(hashRun(actual)).toBe(hashRun(expected));
      }
      lua.close();
    }, 300_000);
  }
});
