import type { Direction, PolicyErrorKind, Trace } from "./policy.ts";

export const TICK_MS = 1000;

interface At {
  /** Game time in milliseconds. */
  t: number;
}

interface AtStop extends At {
  stop: number;
  train: string;
  station: string;
}

export type RunEvent =
  | (AtStop & {
      kind: "arrival";
      /** Direction the train leaves in, after reversing at the end of the line. */
      direction: Direction;
    })
  | (AtStop & { kind: "departure"; to: string; arriveAt: number; dwellMs: number })
  | (AtStop & {
      kind: "transfer";
      resource: string;
      /** Positive when loaded onto the train, negative when unloaded. */
      amount: number;
    })
  | (AtStop & {
      kind: "warning";
      message: string;
      action?: { type: "load" | "unload"; resource: string; requested: number; applied: number };
    })
  | (At & { kind: "log"; stop?: number; train?: string; station?: string; message: string })
  | (At & { kind: "record"; stop?: number; name: string; value: number })
  | (AtStop & { kind: "trace"; trace: Trace })
  | (At & {
      kind: "error";
      stop?: number;
      train?: string;
      station?: string;
      errorKind: PolicyErrorKind;
      message: string;
      line?: number;
    })
  | (At & { kind: "storm-start" | "storm-end"; storm: string; stations: string[] });

export interface ResourceMetrics {
  unmet: number;
  stalled: number;
  met: number;
}

export interface Metrics {
  /** Consumption that could not be met, in milli-units. */
  unmetDemand: number;
  /** Unmet demand multiplied by resource priority. */
  unmetDemandWeighted: number;
  stalledProduction: number;
  /** Total amount consumed. */
  demandMet: number;
  distance: number;
  emptyDistance: number;
  /** Empty distance divided by distance travelled, or 0 before any travel. */
  emptyDistanceShare: number;
  dwellMs: number;
  oscillations: number;
  stops: number;
  transferred: number;
  warnings: number;
  policyErrors: number;
  budgetOverruns: number;
  byResource: Record<string, ResourceMetrics>;
}

export interface Site {
  station: string;
  resource: string;
  capacity: number;
}

export interface Series {
  t: number[];
  v: number[];
}

export interface RunOutput {
  apiVersion: number;
  scenarioId: string;
  seed: number;
  durationMs: number;
  tickMs: number;
  stations: string[];
  resources: string[];
  trains: string[];
  sites: Site[];
  /** Stock per site at every tick boundary, row-major (only with full detail). */
  stock?: Int32Array;
  /** Cargo per train and resource at every tick boundary (only with full detail). */
  cargo?: Int32Array;
  samples: {
    intervalMs: number;
    t: number[];
    /** stock[sample][site] */
    stock: number[][];
    /** cargo[sample][train * resources + resource] */
    cargo: number[][];
  };
  events: RunEvent[];
  records: Record<string, Series>;
  /** Total amount each producer or consumer asked for, by stream name. */
  flowTotals: Record<string, number>;
  metrics: Metrics;
  /** True when the policy could not be loaded and no stops ran. */
  aborted: boolean;
}

export type TrainPlace =
  | { state: "stopped"; station: string; direction: Direction }
  | {
      state: "moving";
      from: string;
      to: string;
      departedAt: number;
      arriveAt: number;
      /** Fraction of the segment covered, from 0 to 1. */
      progress: number;
    };

export interface LineState {
  t: number;
  /** Stock per site, in the order of `RunOutput.sites`. */
  stock: number[];
  /** Cargo per train, then per resource. */
  cargo: number[][];
  trains: TrainPlace[];
}

function lowerBoundByTime(events: RunEvent[], t: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((events[mid] as RunEvent).t <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * State of the line at time `t`, rebuilt from a full-detail run output
 * without re-running the simulation. Includes every event at or before `t`.
 */
export function stateAt(output: RunOutput, t: number): LineState {
  const { stock, cargo, sites, trains, resources, tickMs } = output;
  if (!stock || !cargo) throw new Error("stateAt needs a run recorded with full detail");
  const time = Math.max(0, Math.min(t, output.durationMs));
  const row = Math.floor(time / tickMs);
  const siteCount = sites.length;
  const resourceCount = resources.length;
  const trainCount = trains.length;

  const stockNow = Array.from(stock.subarray(row * siteCount, (row + 1) * siteCount));
  const cargoRow = cargo.subarray(
    row * trainCount * resourceCount,
    (row + 1) * trainCount * resourceCount,
  );
  const cargoNow = trains.map((_, i) =>
    Array.from(cargoRow.subarray(i * resourceCount, (i + 1) * resourceCount)),
  );

  const siteIndex = new Map(sites.map((s, i) => [`${s.station}:${s.resource}`, i]));
  const trainIndex = new Map(trains.map((id, i) => [id, i]));
  const resourceIndex = new Map(resources.map((id, i) => [id, i]));

  const end = lowerBoundByTime(output.events, time);
  const rowTime = row * tickMs;
  for (let i = lowerBoundByTime(output.events, rowTime); i < end; i++) {
    const event = output.events[i] as RunEvent;
    if (event.kind !== "transfer") continue;
    const site = siteIndex.get(`${event.station}:${event.resource}`);
    const train = trainIndex.get(event.train);
    const resource = resourceIndex.get(event.resource);
    if (site === undefined || train === undefined || resource === undefined) continue;
    stockNow[site] = (stockNow[site] ?? 0) - event.amount;
    const trainCargo = cargoNow[train] as number[];
    trainCargo[resource] = (trainCargo[resource] ?? 0) + event.amount;
  }

  const places: (TrainPlace | undefined)[] = trains.map(() => undefined);
  for (let i = end - 1; i >= 0 && places.includes(undefined); i--) {
    const event = output.events[i] as RunEvent;
    if (event.kind !== "arrival" && event.kind !== "departure") continue;
    const train = trainIndex.get(event.train);
    if (train === undefined || places[train] !== undefined) continue;
    if (event.kind === "departure") {
      const span = event.arriveAt - event.t;
      places[train] = {
        state: "moving",
        from: event.station,
        to: event.to,
        departedAt: event.t,
        arriveAt: event.arriveAt,
        progress: span > 0 ? Math.min(1, (time - event.t) / span) : 1,
      };
    } else {
      places[train] = { state: "stopped", station: event.station, direction: event.direction };
    }
  }

  return {
    t: time,
    stock: stockNow,
    cargo: cargoNow,
    // Every train arrives at its start station at time 0, so a place is always found.
    trains: places.map((place) => place ?? { state: "stopped", station: "", direction: "forward" }),
  };
}
