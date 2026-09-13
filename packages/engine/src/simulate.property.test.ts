import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { hashRun } from "./hash.ts";
import { UNLIMITED_CAPACITY } from "./scenario/format2.ts";
import { runSimulation } from "./simulate.ts";
import { arbitraryScenario, chaoticPolicy } from "./testing/arbitrary.ts";
import { parse } from "./testing/policies.ts";

const RUNS = 500;
const TIMEOUT = 120_000;

describe("engine properties", () => {
  it(
    "conserves resources and keeps stock and cargo within bounds at every event",
    () => {
      fc.assert(
        fc.property(arbitraryScenario, fc.nat(), (input, policySeed) => {
          const scenario = parse(input);
          const resources = scenario.resources.map((r) => r.id);
          const initial = resources.map(() => 0);
          const capacity: number[] = [];
          for (const station of scenario.stations) {
            for (const r of station.resources) {
              const k = resources.indexOf(r.id);
              initial[k] = (initial[k] as number) + r.initial;
              capacity.push(r.capacity === "unlimited" ? UNLIMITED_CAPACITY : r.capacity);
            }
          }
          const siteResource = scenario.stations.flatMap((s) =>
            s.resources.map((r) => resources.indexOf(r.id)),
          );
          const trainLimit = scenario.vehicles.map(({ capacity: c }) =>
            "shared" in c
              ? { shared: c.shared, per: undefined }
              : { shared: undefined, per: resources.map((r) => c.perResource[r] ?? 0) },
          );

          runSimulation(scenario, chaoticPolicy(policySeed), {
            detail: "summary",
            inspect: (state, totals) => {
              const held = resources.map(() => 0);
              state.stock.forEach((amount, site) => {
                if (amount < 0 || amount > (capacity[site] as number))
                  throw new Error(`stock out of bounds: ${amount}`);
                const k = siteResource[site] as number;
                held[k] = (held[k] as number) + amount;
              });
              state.cargo.forEach((cargo, train) => {
                const limit = trainLimit[train];
                const total = cargo.reduce((a, b) => a + b, 0);
                if (limit?.shared !== undefined && total > limit.shared)
                  throw new Error("train over capacity");
                cargo.forEach((amount, k) => {
                  if (amount < 0) throw new Error("negative cargo");
                  if (limit?.per && amount > (limit.per[k] as number))
                    throw new Error("train over capacity");
                  held[k] = (held[k] as number) + amount;
                });
              });
              resources.forEach((_, k) => {
                const expected =
                  (initial[k] as number) +
                  (totals.produced[k] as number) -
                  (totals.consumed[k] as number);
                if (held[k] !== expected)
                  throw new Error(`resource ${k} not conserved: ${held[k]} != ${expected}`);
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
        fc.property(arbitraryScenario, fc.nat(), (input, policySeed) => {
          const scenario = parse(input);
          const a = runSimulation(scenario, chaoticPolicy(policySeed));
          const b = runSimulation(scenario, chaoticPolicy(policySeed));
          expect(hashRun(a)).toBe(hashRun(b));
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    "keeps every other flow's draws unchanged when a consumer is added",
    () => {
      fc.assert(
        fc.property(
          arbitraryScenario,
          fc.nat(),
          fc.integer({ min: 1, max: 5000 }),
          (input, pick, rate) => {
            const before = runSimulation(parse(input), chaoticPolicy(1), { detail: "summary" });
            const station = input.stations[pick % input.stations.length];
            const resource = station?.resources[pick % station.resources.length]?.id;
            if (!station || !resource) return;
            station.consumers = [
              ...(station.consumers ?? []),
              { resource, rate, variability: { kind: "uniform", rangePercent: 50 } },
            ];
            const after = runSimulation(parse(input), chaoticPolicy(1), { detail: "summary" });
            for (const [name, total] of Object.entries(before.flowTotals)) {
              expect(after.flowTotals[name], name).toBe(total);
            }
            expect(Object.keys(after.flowTotals).length).toBe(
              Object.keys(before.flowTotals).length + 1,
            );
          },
        ),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );
});
