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
        producers: [{ resource: "Metals", rate: 600 }],
      },
      {
        id: "B",
        resources: [{ id: "Metals" }],
        consumers: [{ resource: "Metals", rate: 300 }],
      },
    ],
    trains: [{ id: "T1", start: "A", speed: 10, capacity: { shared: 30_000 } }],
  };
}
