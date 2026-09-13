import type { ScenarioV2Input } from "../scenario/format2.ts";
import type { ScenarioV1Input } from "../scenario/schema.ts";

/** A small valid scenario for tests to modify. */
export function minimalScenario(): ScenarioV1Input {
  return {
    format: 1,
    id: "minimal",
    title: "Minimal",
    description: "Two stations and one train.",
    durationMs: 3_600_000,
    seed: 1,
    informationLevel: "line",
    resources: [{ id: "Metals" }],
    stations: [
      {
        id: "A",
        resources: [{ id: "Metals" }],
        distanceToNext: 400,
        producers: [{ resource: "Metals", rate: 24_000 }],
      },
      {
        id: "B",
        resources: [{ id: "Metals" }],
        consumers: [{ resource: "Metals", rate: 12_000 }],
      },
    ],
    trains: [{ id: "T1", start: "A", speed: 10, capacity: { shared: 30_000 } }],
  };
}

/** A small valid format 2 scenario for tests to modify: the minimal line as a network. */
export function minimalScenarioV2(): ScenarioV2Input {
  return {
    format: 2,
    id: "minimal-v2",
    title: "Minimal",
    description: "Two stock points joined by an arc and one shuttle.",
    durationMs: 3_600_000,
    seed: 1,
    informationLevel: "line",
    resources: [{ id: "Metals" }],
    stockPoints: [
      {
        id: "A",
        resources: [{ id: "Metals" }],
        producers: [{ resource: "Metals", rate: 24_000 }],
      },
      {
        id: "B",
        resources: [{ id: "Metals" }],
        consumers: [{ resource: "Metals", rate: 12_000 }],
      },
    ],
    arcs: [{ from: "A", to: "B", distance: 400 }],
    vehicles: [
      {
        id: "T1",
        route: { kind: "shuttle", stops: ["A", "B"] },
        speed: 10,
        capacity: { shared: 30_000 },
      },
    ],
  };
}

/** A format 2 scenario that uses every feature of the format at least once. */
export function featureScenarioV2(): ScenarioV2Input {
  const DAY = 86_400_000;
  return {
    format: 2,
    id: "features",
    title: "Every feature",
    description: "A depot, a shop and a factory using every format 2 feature.",
    durationMs: 10 * DAY,
    seed: 3,
    informationLevel: "local",
    resources: [{ id: "Metals" }, { id: "Parts", priority: 2 }],
    stockPoints: [
      {
        id: "Depot",
        resources: [{ id: "Metals", capacity: "unlimited", initial: 100_000, holdingCost: 1 }],
        suppliers: [
          {
            resource: "Metals",
            from: "external",
            leadTime: {
              kind: "discrete",
              values: [
                { value: DAY, weight: 3 },
                { value: 2 * DAY, weight: 1 },
              ],
            },
            minOrder: 1000,
            maxOrder: 50_000,
            orderCost: 20,
            unitCost: 2,
          },
        ],
        review: { periodMs: DAY, offsetMs: 3_600_000 },
        position: { x: 0, y: 0 },
      },
      {
        id: "Factory",
        resources: [{ id: "Metals" }, { id: "Parts", expires: true }],
        converters: [
          {
            inputs: [{ resource: "Metals", amount: 2000 }],
            outputs: [{ resource: "Parts", amount: 1000 }],
            rate: 12_000,
            variability: { kind: "uniform", rangePercent: 10, periodMs: 3_600_000 },
          },
        ],
        producers: [
          { resource: "Metals", trace: { periodMs: DAY, amounts: [0, 5000, 2000] }, stallCost: 1 },
        ],
        review: { periodMs: 7 * DAY },
      },
      {
        id: "Shop",
        resources: [{ id: "Parts" }],
        consumers: [
          {
            resource: "Parts",
            poisson: { arrivalsPerSol: 6000, size: { kind: "fixed", value: 1000 } },
            unmet: "backorder",
            backorderCost: 3,
            profile: [
              { atMs: 0, multiplierPermille: 1000 },
              { atMs: 5 * DAY, multiplierPermille: 1500 },
            ],
          },
          {
            resource: "Parts",
            perPeriod: {
              periodMs: DAY,
              amount: {
                kind: "discrete",
                values: [
                  { value: 0, weight: 1 },
                  { value: 2000, weight: 1 },
                ],
              },
            },
            lostCost: 10,
          },
        ],
        suppliers: [
          { resource: "Parts", from: "Factory", leadTime: { kind: "fixed", value: DAY } },
        ],
        review: { periodMs: DAY },
      },
    ],
    arcs: [
      { from: "Depot", to: "Factory", distance: 3000 },
      { from: "Factory", to: "Shop", distance: 2000 },
      { from: "Shop", to: "Depot", distance: 4000 },
    ],
    vehicles: [
      {
        id: "Loop",
        route: { kind: "loop", stops: ["Depot", "Factory", "Shop"], start: "Factory" },
        speed: 20,
        capacity: { perResource: { Metals: 20_000, Parts: 10_000 } },
        costPerDistance: 1,
      },
      {
        id: "Van",
        route: { kind: "timetable", stops: ["Depot", "Factory"], departuresMs: [0, DAY, 2 * DAY] },
        speed: 30,
        dwellMs: 60_000,
        capacity: { shared: 15_000 },
      },
    ],
    events: [
      {
        id: "strike",
        label: "Strike",
        schedule: { kind: "random", probabilityPpm: 50_000, checkIntervalMs: DAY, durationMs: DAY },
        effects: [
          { type: "supply", stations: ["Factory"], resources: "all", multiplierPermille: 0 },
        ],
      },
    ],
  };
}
