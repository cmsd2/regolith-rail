import fc from "fast-check";
import { emptyOutcome, type Policy } from "../policy.ts";
import { Random } from "../random.ts";
import type { ScenarioV2Input } from "../scenario/format2.ts";
import { chaoticPolicy } from "./arbitrary.ts";

const HOUR = 3_600_000;
const RESOURCE_NAMES = ["Metals", "Food", "Polymers"];

type Point = ScenarioV2Input["stockPoints"][number];
type Producer = NonNullable<Point["producers"]>[number];

const distribution = fc.oneof(
  fc.integer({ min: 0, max: 5000 }).map((value) => ({ kind: "fixed" as const, value })),
  fc
    .array(
      fc.record({
        value: fc.integer({ min: 0, max: 5000 }),
        weight: fc.integer({ min: 1, max: 5 }),
      }),
      { minLength: 1, maxLength: 3 },
    )
    .map((values) => ({ kind: "discrete" as const, values })),
);

/** One way a flow produces or demands amounts, keyed so it can be spread into a flow. */
const process = fc.oneof(
  fc.record({ rate: fc.integer({ min: 0, max: 400_000 }) }),
  fc.record({
    rate: fc.integer({ min: 0, max: 400_000 }),
    variability: fc.oneof(
      fc.record({
        kind: fc.constant("uniform" as const),
        rangePercent: fc.integer({ min: 0, max: 100 }),
      }),
      fc.record({
        kind: fc.constant("bursts" as const),
        onPpm: fc.integer({ min: 0, max: 1_000_000 }),
        offPpm: fc.integer({ min: 0, max: 1_000_000 }),
      }),
    ),
  }),
  fc.record({
    poisson: fc.record({
      arrivalsPerSol: fc.integer({ min: 0, max: 200_000 }),
      size: distribution,
    }),
  }),
  fc.record({
    perPeriod: fc.record({
      periodMs: fc.integer({ min: 1, max: 6 }).map((h) => h * HOUR),
      amount: distribution,
    }),
  }),
  fc.record({
    trace: fc.record({
      periodMs: fc.integer({ min: 1, max: 3 }).map((h) => h * HOUR),
      amounts: fc.array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 6 }),
    }),
  }),
);

const profile = fc.option(
  fc
    .uniqueArray(fc.integer({ min: 0, max: 12 }), { minLength: 1, maxLength: 3 })
    .chain((hours) =>
      fc
        .tuple(...hours.sort((a, b) => a - b).map(() => fc.integer({ min: 0, max: 3000 })))
        .map((multipliers) =>
          hours.map((h, k) => ({ atMs: h * HOUR, multiplierPermille: multipliers[k] as number })),
        ),
    ),
  { nil: undefined },
);

/** Valid format 2 scenarios that use every feature of the format. */
export const arbitraryScenarioV2: fc.Arbitrary<ScenarioV2Input> = fc
  .record({
    resourceCount: fc.integer({ min: 1, max: 3 }),
    pointCount: fc.integer({ min: 1, max: 4 }),
    vehicleCount: fc.integer({ min: 0, max: 2 }),
    seed: fc.nat(),
    durationHours: fc.integer({ min: 1, max: 12 }),
    informationLevel: fc.constantFrom("local" as const, "line" as const),
  })
  .chain(({ resourceCount, pointCount, vehicleCount, seed, durationHours, informationLevel }) => {
    const resources = RESOURCE_NAMES.slice(0, resourceCount);
    const pointIds = Array.from({ length: pointCount }, (_, i) => `P${i}`);

    const point = (i: number) =>
      fc
        .record({
          enabled: fc.subarray(resources, { minLength: 1 }),
          unlimited: fc.boolean(),
          capacity: fc.integer({ min: 0, max: 60_000 }),
          fill: fc.integer({ min: 0, max: 100 }),
          expires: fc.integer({ min: 0, max: 9 }).map((n) => n === 0),
          holdingCost: fc.integer({ min: 0, max: 3 }),
          producers: fc.array(fc.tuple(process, profile, fc.integer({ min: 0, max: 2 })), {
            maxLength: 2,
          }),
          consumers: fc.array(
            fc.tuple(process, profile, fc.boolean(), fc.integer({ min: 0, max: 2 })),
            { maxLength: 2 },
          ),
          converter: fc.option(
            fc.record({
              input: fc.integer({ min: 1, max: 3000 }),
              output: fc.integer({ min: 1, max: 3000 }),
              rate: fc.integer({ min: 0, max: 100_000 }),
            }),
            { nil: undefined },
          ),
          suppliers: fc.array(
            fc.record({
              upstream: fc.nat(),
              lead: fc.integer({ min: 0, max: 3 }).map((h) => h * HOUR),
              limits: fc.boolean(),
              orderCost: fc.integer({ min: 0, max: 5 }),
            }),
            { maxLength: 2 },
          ),
          reviewHours: fc.option(fc.integer({ min: 1, max: 6 }), { nil: undefined }),
          pick: fc.nat(),
        })
        .map((p): Point => {
          const pickResource = (k: number) => p.enabled[(p.pick + k) % p.enabled.length] as string;
          const capacity = p.unlimited ? ("unlimited" as const) : p.capacity;
          // Stock points supply only resources they store, and only from earlier stock points
          // that store them, so suppliers never form a cycle.
          const supplied = new Set<string>();
          const suppliers = p.suppliers.flatMap((s, k) => {
            const resource = pickResource(k);
            if (supplied.has(resource)) return [];
            supplied.add(resource);
            const from = i > 0 && s.upstream % 2 === 0 ? `P${s.upstream % i}` : "external";
            return [
              {
                resource,
                from,
                leadTime: { kind: "fixed" as const, value: s.lead },
                ...(s.limits ? { minOrder: 500, maxOrder: 20_000 } : {}),
                orderCost: s.orderCost,
              },
            ];
          });
          return {
            id: `P${i}`,
            resources: p.enabled.map((id) => ({
              id,
              capacity,
              initial: Math.floor(((p.unlimited ? 60_000 : p.capacity) * p.fill) / 100),
              expires: p.expires,
              holdingCost: p.holdingCost,
            })),
            producers: p.producers.map(
              ([kind, points, stallCost], k): Producer => ({
                resource: pickResource(k),
                ...kind,
                ...(points ? { profile: points } : {}),
                stallCost,
              }),
            ),
            consumers: p.consumers.map(([kind, points, backorder, lostCost], k) => ({
              resource: pickResource(k + 1),
              ...kind,
              ...(points ? { profile: points } : {}),
              unmet: backorder ? ("backorder" as const) : ("lost" as const),
              lostCost,
              backorderCost: lostCost,
            })),
            converters: p.converter
              ? [
                  {
                    inputs: [{ resource: pickResource(0), amount: p.converter.input }],
                    outputs: [{ resource: pickResource(1), amount: p.converter.output }],
                    rate: p.converter.rate,
                  },
                ]
              : [],
            suppliers,
            ...(p.reviewHours ? { review: { periodMs: p.reviewHours * HOUR } } : {}),
          };
        });

    const vehicle = (i: number) =>
      fc
        .record({
          kind: fc.constantFrom("shuttle", "loop", "timetable"),
          speed: fc.integer({ min: 1, max: 40 }),
          dwellMs: fc.integer({ min: 0, max: 30_000 }),
          dwellPerUnitMs: fc.integer({ min: 0, max: 2000 }),
          shared: fc.boolean(),
          capacity: fc.integer({ min: 0, max: 40_000 }),
          costPerDistance: fc.integer({ min: 0, max: 2 }),
          start: fc.nat(),
        })
        .map((v) => {
          const kind = v.kind === "loop" && pointCount < 3 ? "shuttle" : v.kind;
          const start = pointIds[v.start % pointCount] as string;
          const route =
            kind === "shuttle"
              ? { kind, stops: pointIds, start }
              : kind === "loop"
                ? { kind, stops: pointIds, start }
                : {
                    kind: "timetable" as const,
                    stops: pointIds,
                    // Trips on these short lines take at most a few hours, so eight hours apart
                    // never overlap.
                    departuresMs: [0, 8 * HOUR].filter((d) => d < durationHours * HOUR),
                  };
          return {
            id: `V${i}`,
            route,
            speed: v.speed,
            dwellMs: v.dwellMs,
            dwellPerUnitMs: v.dwellPerUnitMs,
            capacity: v.shared
              ? { shared: v.capacity }
              : {
                  perResource: Object.fromEntries(resources.map((r) => [r, v.capacity])),
                },
            costPerDistance: v.costPerDistance,
          };
        });

    return fc
      .record({
        points: fc.tuple(...pointIds.map((_, i) => point(i))),
        distances: fc.array(fc.integer({ min: 50, max: 3000 }), {
          minLength: pointCount,
          maxLength: pointCount,
        }),
        vehicles: fc.tuple(...Array.from({ length: vehicleCount }, (_, i) => vehicle(i))),
      })
      .map(({ points, distances, vehicles }): ScenarioV2Input => {
        const arcs = pointIds.slice(0, -1).map((id, i) => ({
          from: id,
          to: pointIds[i + 1] as string,
          distance: distances[i] as number,
        }));
        if (pointCount >= 3) {
          arcs.push({
            from: pointIds[pointCount - 1] as string,
            to: "P0",
            distance: distances[pointCount - 1] as number,
          });
        }
        // Stock points are generated independently, so a supplier upstream may not store the
        // resource; such suppliers become external.
        const stockPoints = points.map((p) => ({
          ...p,
          suppliers: (p.suppliers ?? []).map((sup) => {
            const upstream = points.find((q) => q.id === sup.from);
            const stores = upstream?.resources.some((r) => r.id === sup.resource) ?? false;
            return sup.from === "external" || stores ? sup : { ...sup, from: "external" };
          }),
        }));
        return {
          format: 2,
          id: "generated-v2",
          title: "Generated",
          description: "Generated by a property test.",
          durationMs: durationHours * HOUR,
          seed,
          informationLevel,
          resources: resources.map((id, k) => ({ id, priority: k + 1 })),
          stockPoints,
          arcs,
          // A single stock point has no route to run.
          vehicles: pointCount >= 2 ? vehicles : [],
        };
      });
  });

/** A chaotic stop policy that also places arbitrary, often invalid, orders at reviews. */
export function chaoticOrderingPolicy(seed: number): Policy {
  const stops = chaoticPolicy(seed);
  const rng = Random.fromSeed(seed ^ 0x5bd1e995);
  const names = [...RESOURCE_NAMES, "Unobtainium"];
  const amounts = [0, 1, 999, 5000, 30_000, 1e9, -5, 2.5, Number.NaN];
  return {
    start: stops.start,
    stop: stops.stop,
    review: () => {
      const outcome = emptyOutcome();
      const count = rng.int(0, 3);
      for (let i = 0; i < count; i++) {
        outcome.actions.push({
          type: rng.int(0, 9) === 0 ? "load" : "order",
          resource: names[rng.int(0, names.length - 1)] as string,
          amount:
            rng.int(0, 3) === 0
              ? (amounts[rng.int(0, amounts.length - 1)] as number)
              : rng.int(0, 20_000),
        });
      }
      return outcome;
    },
  };
}
