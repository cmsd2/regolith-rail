import type { ScenarioV2Input } from "../scenario/format2.ts";
import type { ScenarioInput } from "../scenario/schema.ts";

/** A small valid scenario for tests to modify. */
export function minimalScenario(): ScenarioInput {
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
