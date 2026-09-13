import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { hashRun } from "./hash.ts";
import { UNLIMITED_CAPACITY } from "./scenario/format2.ts";
import { runSimulation } from "./simulate.ts";
import { arbitraryScenarioV2, chaoticOrderingPolicy } from "./testing/arbitrary-v2.ts";
import { parse } from "./testing/policies.ts";

const RUNS = 300;
const TIMEOUT = 180_000;

describe("engine properties for format 2", () => {
  it(
    "conserves resources through flows, conversion, orders, shipments, overflow and expiry",
    () => {
      fc.assert(
        fc.property(arbitraryScenarioV2, fc.nat(), (input, policySeed) => {
          const scenario = parse(input);
          const resources = scenario.resources.map((r) => r.id);
          const initial = resources.map(() => 0);
          const capacity: number[] = [];
          const siteResource: number[] = [];
          for (const point of scenario.stations) {
            for (const r of point.resources) {
              const k = resources.indexOf(r.id);
              initial[k] = (initial[k] as number) + r.initial;
              capacity.push(r.capacity === "unlimited" ? UNLIMITED_CAPACITY : r.capacity);
              siteResource.push(k);
            }
          }

          runSimulation(scenario, chaoticOrderingPolicy(policySeed), {
            detail: "summary",
            inspect: (state, totals) => {
              const held = totals.inTransit.slice();
              state.stock.forEach((amount, site) => {
                if (amount < 0 || amount > (capacity[site] as number))
                  throw new Error(`stock out of bounds: ${amount}`);
                const k = siteResource[site] as number;
                held[k] = (held[k] as number) + amount;
              });
              state.cargo.forEach((cargo) => {
                cargo.forEach((amount, k) => {
                  if (amount < 0) throw new Error("negative cargo");
                  held[k] = (held[k] as number) + amount;
                });
              });
              resources.forEach((_, k) => {
                const expected =
                  (initial[k] as number) +
                  (totals.produced[k] as number) -
                  (totals.consumed[k] as number) +
                  (totals.converted[k] as number) +
                  (totals.supplied[k] as number) -
                  (totals.overflow[k] as number) -
                  (totals.expired[k] as number);
                if (held[k] !== expected)
                  throw new Error(`resource ${k} not conserved: ${held[k]} != ${expected}`);
                if ((totals.inTransit[k] as number) < 0) throw new Error("negative transit");
              });
            },
          });
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    "repeats every run exactly",
    () => {
      fc.assert(
        fc.property(arbitraryScenarioV2, fc.nat(), (input, policySeed) => {
          const scenario = parse(input);
          const a = runSimulation(scenario, chaoticOrderingPolicy(policySeed));
          const b = runSimulation(scenario, chaoticOrderingPolicy(policySeed));
          expect(hashRun(a)).toBe(hashRun(b));
        }),
        { numRuns: 100 },
      );
    },
    TIMEOUT,
  );
});
