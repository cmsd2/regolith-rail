import fc from "fast-check";
import type { Action, Policy } from "../policy.ts";
import { Random } from "../random.ts";
import type { ScenarioInput } from "../scenario/schema.ts";
import { scriptedPolicy } from "./policies.ts";

const RESOURCE_NAMES = ["Metals", "Food", "Polymers"];
const HOUR = 3_600_000;

const variability = fc.oneof(
  fc.constant({ kind: "fixed" as const }),
  fc.record({
    kind: fc.constant("uniform" as const),
    rangePercent: fc.integer({ min: 0, max: 100 }),
    periodMs: fc.integer({ min: 1, max: 12 }).map((h) => h * HOUR),
  }),
  fc.record({
    kind: fc.constant("bursts" as const),
    onPpm: fc.integer({ min: 0, max: 1_000_000 }),
    offPpm: fc.integer({ min: 0, max: 1_000_000 }),
    startsOn: fc.boolean(),
  }),
);

/** Valid scenarios with small lines, varied flows, trains and world events. */
export const arbitraryScenario: fc.Arbitrary<ScenarioInput> = fc
  .record({
    resourceCount: fc.integer({ min: 1, max: 3 }),
    stationCount: fc.integer({ min: 2, max: 4 }),
    trainCount: fc.integer({ min: 1, max: 3 }),
    eventCount: fc.integer({ min: 0, max: 2 }),
    seed: fc.nat(),
    durationHours: fc.integer({ min: 1, max: 12 }),
  })
  .chain(({ resourceCount, stationCount, trainCount, eventCount, seed, durationHours }) => {
    const resources = RESOURCE_NAMES.slice(0, resourceCount);
    const station = (i: number) =>
      fc
        .record({
          enabled: fc.subarray(resources, { minLength: 1 }),
          distance: fc.integer({ min: 50, max: 3000 }),
          capacity: fc.integer({ min: 0, max: 60_000 }),
          fill: fc.integer({ min: 0, max: 100 }),
          producers: fc.array(
            fc.record({ rate: fc.integer({ min: 0, max: 400_000 }), variability }),
            {
              maxLength: 2,
            },
          ),
          consumers: fc.array(
            fc.record({ rate: fc.integer({ min: 0, max: 400_000 }), variability }),
            {
              maxLength: 2,
            },
          ),
          pick: fc.nat(),
        })
        .map((s) => {
          const flow = (f: { rate: number; variability: unknown }, k: number) => ({
            resource: s.enabled[(s.pick + k) % s.enabled.length] as string,
            rate: f.rate,
            variability: f.variability as never,
          });
          return {
            id: `S${i}`,
            resources: s.enabled.map((id) => ({
              id,
              capacity: s.capacity,
              initial: Math.floor((s.capacity * s.fill) / 100),
            })),
            ...(i < stationCount - 1 ? { distanceToNext: s.distance } : {}),
            producers: s.producers.map(flow),
            consumers: s.consumers.map(flow),
          };
        });
    const train = (i: number) =>
      fc
        .record({
          start: fc.integer({ min: 0, max: stationCount - 1 }),
          forward: fc.boolean(),
          speed: fc.integer({ min: 1, max: 40 }),
          dwellMs: fc.integer({ min: 0, max: 30_000 }),
          dwellPerUnitMs: fc.integer({ min: 0, max: 2000 }),
          shared: fc.boolean(),
          capacity: fc.integer({ min: 0, max: 40_000 }),
          perResource: fc.array(fc.integer({ min: 0, max: 20_000 }), {
            minLength: resourceCount,
            maxLength: resourceCount,
          }),
        })
        .map((t) => ({
          id: `T${i}`,
          start: `S${t.start}`,
          direction: t.forward ? ("forward" as const) : ("backward" as const),
          speed: t.speed,
          dwellMs: t.dwellMs,
          dwellPerUnitMs: t.dwellPerUnitMs,
          capacity: t.shared
            ? { shared: t.capacity }
            : {
                perResource: Object.fromEntries(
                  resources.map((r, k) => [r, t.perResource[k] ?? 0]),
                ),
              },
        }));
    const selection = (ids: string[]) =>
      fc.oneof(fc.constant("all" as const), fc.subarray(ids, { minLength: 1 }));
    const effect = fc.record({
      type: fc.constantFrom("supply" as const, "demand" as const),
      stations: selection(Array.from({ length: stationCount }, (_, i) => `S${i}`)),
      resources: selection(resources),
      multiplierPermille: fc.integer({ min: 0, max: 5000 }),
      startOffsetMs: fc.integer({ min: 0, max: 4 }).map((h) => h * HOUR),
      durationMs: fc.option(
        fc.integer({ min: 1, max: 12 }).map((h) => h * HOUR),
        {
          nil: undefined,
        },
      ),
    });
    const worldEvent = (i: number) =>
      fc
        .record({
          random: fc.boolean(),
          startHour: fc.integer({ min: 0, max: durationHours - 1 }),
          lengthHours: fc.integer({ min: 1, max: 8 }),
          probabilityPpm: fc.integer({ min: 0, max: 1_000_000 }),
          effects: fc.array(effect, { minLength: 1, maxLength: 3 }),
        })
        .map((e) => ({
          id: `E${i}`,
          label: `Event ${i}`,
          effects: e.effects.map(({ durationMs, ...rest }) =>
            durationMs === undefined ? rest : { ...rest, durationMs },
          ),
          schedule: e.random
            ? {
                kind: "random" as const,
                probabilityPpm: e.probabilityPpm,
                checkIntervalMs: 2 * HOUR,
                durationMs: e.lengthHours * HOUR,
              }
            : {
                kind: "fixed" as const,
                startMs: e.startHour * HOUR,
                durationMs: e.lengthHours * HOUR,
              },
        }));
    return fc
      .record({
        stations: fc.tuple(...Array.from({ length: stationCount }, (_, i) => station(i))),
        trains: fc.tuple(...Array.from({ length: trainCount }, (_, i) => train(i))),
        events: fc.tuple(...Array.from({ length: eventCount }, (_, i) => worldEvent(i))),
      })
      .map(
        ({ stations, trains, events }): ScenarioInput => ({
          format: 1,
          id: "generated",
          title: "Generated",
          description: "Generated by a property test.",
          durationMs: durationHours * HOUR,
          seed,
          informationLevel: "line",
          resources: resources.map((id, k) => ({ id, priority: k + 1 })),
          stations,
          trains,
          events,
        }),
      );
  });

/** A policy issuing arbitrary, often invalid, actions chosen by a seeded generator. */
export function chaoticPolicy(seed: number): Policy {
  const rng = Random.fromSeed(seed);
  const names = [...RESOURCE_NAMES, "Unobtainium"];
  const amounts = [0, 1, 999, 5000, 30_000, 1e9, -5, 2.5, Number.NaN, Number.POSITIVE_INFINITY];
  return scriptedPolicy(() => {
    const actions: Action[] = [];
    const count = rng.int(0, 4);
    for (let i = 0; i < count; i++) {
      actions.push({
        type: rng.int(0, 1) === 0 ? "load" : "unload",
        resource: names[rng.int(0, names.length - 1)] as string,
        amount:
          rng.int(0, 3) === 0
            ? (amounts[rng.int(0, amounts.length - 1)] as number)
            : rng.int(0, 20_000),
      });
    }
    return actions;
  });
}
