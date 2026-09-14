import type { ScenarioV2Input } from "./format2.ts";
import type { ScenarioV1 } from "./schema.ts";

/**
 * Converts a validated format 1 scenario into an equivalent format 2 document.
 * Station, flow and train ids and their order are kept, so random streams and
 * results are unchanged.
 */
export function upgradeV1(v1: ScenarioV1): ScenarioV2Input {
  const stationIds = v1.stations.map((s) => s.id);
  return {
    format: 2,
    id: v1.id,
    title: v1.title,
    description: v1.description,
    ...(v1.docs === undefined ? {} : { docs: v1.docs }),
    durationMs: v1.durationMs,
    seed: v1.seed,
    informationLevel: v1.informationLevel,
    sampleIntervalMs: v1.sampleIntervalMs,
    resources: v1.resources.map((r) => ({ id: r.id, priority: r.priority })),
    stations: v1.stations.map((station) => ({
      id: station.id,
      resources: station.resources.map((r) => ({
        id: r.id,
        capacity: r.capacity,
        initial: r.initial,
      })),
      producers: station.producers.map((f) => ({
        resource: f.resource,
        rate: f.rate,
        variability: f.variability,
      })),
      consumers: station.consumers.map((f) => ({
        resource: f.resource,
        rate: f.rate,
        variability: f.variability,
      })),
    })),
    arcs: v1.stations.slice(0, -1).map((station, i) => ({
      from: station.id,
      to: stationIds[i + 1] as string,
      distance: station.distanceToNext as number,
    })),
    vehicles: v1.trains.map((train) => ({
      id: train.id,
      route: {
        kind: "shuttle" as const,
        stops: stationIds,
        start: train.start,
        direction: train.direction,
      },
      speed: train.speed,
      dwellMs: train.dwellMs,
      dwellPerUnitMs: train.dwellPerUnitMs,
      capacity: train.capacity,
    })),
    events: v1.events,
  };
}
