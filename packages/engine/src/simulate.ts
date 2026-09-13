import type { LineState, Metrics, RunEvent, RunOutput, Site } from "./output.ts";
import { TICK_MS } from "./output.ts";
import {
  type Action,
  type Direction,
  POLICY_API_VERSION,
  type Policy,
  type PolicyOutcome,
  type Quantities,
  type StationSnapshot,
  type StopSnapshot,
  type TrainCapacitySnapshot,
} from "./policy.ts";
import { EventOrder, EventQueue, type Scheduled } from "./queue.ts";
import { type Random, streamFor } from "./random.ts";
import type { FlowDef, InformationLevel, Scenario } from "./scenario/schema.ts";

export type Detail = "full" | "summary";

export interface RunOptions {
  /** Seed for this run; defaults to the scenario's seed. */
  seed?: number;
  /** Full detail records stock and cargo at every tick for replay. Defaults to full. */
  detail?: Detail;
  /** Test hook: called after every handled event with the live state. */
  inspect?: (state: LineState, totals: FlowTotalsByResource) => void;
}

/** Running totals by resource index, for checking conservation. */
export interface FlowTotalsByResource {
  /** Amount added to stations by producers. */
  produced: number[];
  /** Amount taken from stations by consumers. */
  consumed: number[];
}

type SimEvent = Scheduled &
  (
    | { kind: "tick" }
    | { kind: "arrival"; train: number; station: number }
    | { kind: "departure"; train: number }
    | { kind: "storm-check"; storm: number }
    | { kind: "storm-end"; storm: number }
  );

interface FlowState {
  name: string;
  consumer: boolean;
  station: number;
  site: number;
  resource: number;
  def: FlowDef;
  rng: Random;
  accumulator: number;
  effective: number;
  periodEnd: number;
  on: boolean;
}

interface TrainState {
  id: string;
  speed: number;
  dwellMs: number;
  dwellPerUnitMs: number;
  shared: number | undefined;
  perResource: number[];
  capacitySnapshot: TrainCapacitySnapshot;
  cargo: number[];
  direction: 1 | -1;
  station: number;
  roundTripMs: number;
}

interface StormState {
  id: string;
  multiplier: number;
  stations: boolean[];
  stationIds: string[];
  start: number;
  end: number;
  rng: Random | undefined;
  schedule: Scenario["events"][number]["schedule"];
}

const MINUTE_PERMILLE = 60_000;

const directionName = (d: 1 | -1): Direction => (d === 1 ? "forward" : "backward");

/** Runs one scenario with one policy and seed. */
export function runSimulation(
  scenario: Scenario,
  policy: Policy,
  options: RunOptions = {},
): RunOutput {
  const seed = options.seed ?? scenario.seed;
  const detail = options.detail ?? "full";
  const duration = scenario.durationMs;
  // Validation rejects the levels reserved for later versions.
  const level = scenario.informationLevel as InformationLevel;

  // --- Static layout -------------------------------------------------------
  const resources = scenario.resources.map((r) => r.id);
  const priority = scenario.resources.map((r) => r.priority);
  const resourceIndex = new Map(resources.map((id, i) => [id, i]));
  const stations = scenario.stations.map((s) => s.id);
  const stationIndex = new Map(stations.map((id, i) => [id, i]));
  const last = stations.length - 1;

  const sites: Site[] = [];
  const siteOf: number[][] = scenario.stations.map(() => resources.map(() => -1));
  const stock: number[] = [];
  const siteCapacity: number[] = [];
  scenario.stations.forEach((station, s) => {
    for (const r of station.resources) {
      const ri = resourceIndex.get(r.id) as number;
      (siteOf[s] as number[])[ri] = sites.length;
      sites.push({ station: station.id, resource: r.id, capacity: r.capacity });
      stock.push(r.initial);
      siteCapacity.push(r.capacity);
    }
  });

  const segment = scenario.stations.map((s) => s.distanceToNext ?? 0);
  const travelMs = (distance: number, speed: number) =>
    Math.floor((distance * 1000 + speed - 1) / speed);

  // --- Flows ----------------------------------------------------------------
  const flows: FlowState[] = [];
  scenario.stations.forEach((station, s) => {
    for (const consumer of [false, true]) {
      const defs = consumer ? station.consumers : station.producers;
      const seen = new Map<string, number>();
      for (const def of defs) {
        const k = seen.get(def.resource) ?? 0;
        seen.set(def.resource, k + 1);
        const name = `${consumer ? "consumer" : "producer"}:${station.id}:${def.resource}:${k}`;
        const ri = resourceIndex.get(def.resource) as number;
        flows.push({
          name,
          consumer,
          station: s,
          site: (siteOf[s] as number[])[ri] as number,
          resource: ri,
          def,
          rng: streamFor(seed, name),
          accumulator: 0,
          effective: def.rate,
          periodEnd: 0,
          on: def.variability.kind === "bursts" ? def.variability.startsOn : true,
        });
      }
    }
  });
  const flowTotals: Record<string, number> = Object.fromEntries(flows.map((f) => [f.name, 0]));

  // --- Trains ---------------------------------------------------------------
  const fullTrip = (speed: number) =>
    2 * segment.reduce((sum, distance) => sum + (distance > 0 ? travelMs(distance, speed) : 0), 0);
  const trains: TrainState[] = scenario.trains.map((def) => {
    const start = stationIndex.get(def.start) as number;
    let direction: 1 | -1 = def.direction === "forward" ? 1 : -1;
    if (start === last && direction === 1) direction = -1;
    if (start === 0 && direction === -1) direction = 1;
    const shared = "shared" in def.capacity ? def.capacity.shared : undefined;
    const perResource = resources.map((r) =>
      "perResource" in def.capacity ? (def.capacity.perResource[r] ?? 0) : 0,
    );
    return {
      id: def.id,
      speed: def.speed,
      dwellMs: def.dwellMs,
      dwellPerUnitMs: def.dwellPerUnitMs,
      shared,
      perResource,
      capacitySnapshot:
        shared === undefined
          ? { per_resource: Object.fromEntries(resources.map((r, i) => [r, perResource[i] ?? 0])) }
          : { shared },
      cargo: resources.map(() => 0),
      direction,
      station: start,
      roundTripMs: fullTrip(def.speed),
    };
  });

  // --- Storms ---------------------------------------------------------------
  const storms: StormState[] = scenario.events.map((event) => {
    const covered = stations.map((id) => event.stations === "all" || event.stations.includes(id));
    return {
      id: event.id,
      multiplier: event.multiplierPermille,
      stations: covered,
      stationIds: stations.filter((_, i) => covered[i]),
      start: -1,
      end: -1,
      rng: event.schedule.kind === "random" ? streamFor(seed, `storm:${event.id}`) : undefined,
      schedule: event.schedule,
    };
  });

  // --- Output ---------------------------------------------------------------
  const events: RunEvent[] = [];
  const records: RunOutput["records"] = {};
  const byResource = Object.fromEntries(
    resources.map((r) => [r, { unmet: 0, stalled: 0, met: 0 }]),
  );
  const metrics: Metrics = {
    unmetDemand: 0,
    unmetDemandWeighted: 0,
    stalledProduction: 0,
    demandMet: 0,
    distance: 0,
    emptyDistance: 0,
    emptyDistanceShare: 0,
    dwellMs: 0,
    oscillations: 0,
    stops: 0,
    transferred: 0,
    warnings: 0,
    policyErrors: 0,
    budgetOverruns: 0,
    byResource,
  };

  const rows = Math.floor(duration / TICK_MS) + 1;
  const stockRows = detail === "full" ? new Int32Array(rows * sites.length) : undefined;
  const cargoRows =
    detail === "full" ? new Int32Array(rows * trains.length * resources.length) : undefined;
  const samples: RunOutput["samples"] = {
    intervalMs: scenario.sampleIntervalMs,
    t: [],
    stock: [],
    cargo: [],
  };
  let nextRowTime = 0;

  const writeRowsBefore = (time: number, inclusive: boolean) => {
    while (inclusive ? nextRowTime <= time : nextRowTime < time) {
      const row = nextRowTime / TICK_MS;
      if (stockRows) stockRows.set(stock, row * sites.length);
      if (cargoRows) {
        trains.forEach((train, i) => {
          cargoRows.set(train.cargo, (row * trains.length + i) * resources.length);
        });
      }
      if (nextRowTime % scenario.sampleIntervalMs === 0) {
        samples.t.push(nextRowTime);
        samples.stock.push(stock.slice());
        samples.cargo.push(trains.flatMap((train) => train.cargo));
      }
      nextRowTime += TICK_MS;
    }
  };

  // Snapshot pieces that never change during a run.
  const staticStations: StationSnapshot[] = scenario.stations.map((station, i) => ({
    id: station.id,
    index: i + 1,
    resources: station.resources.map((r) => r.id),
    ...(station.distanceToNext === undefined ? {} : { distance_to_next: station.distanceToNext }),
  }));
  const resourceSnapshots = scenario.resources.map((r) => ({ id: r.id, priority: r.priority }));

  const stationQuantities = (s: number) => {
    const stockOut: Quantities = {};
    const capacityOut: Quantities = {};
    for (const r of scenario.stations[s]?.resources ?? []) {
      const site = (siteOf[s] as number[])[resourceIndex.get(r.id) as number] as number;
      stockOut[r.id] = stock[site] as number;
      capacityOut[r.id] = siteCapacity[site] as number;
    }
    return { stock: stockOut, capacity: capacityOut };
  };

  const running: FlowTotalsByResource = {
    produced: resources.map(() => 0),
    consumed: resources.map(() => 0),
  };
  const moving: (LineState["trains"][number] | undefined)[] = trains.map(() => undefined);
  const lastUnload: (number | undefined)[] = sites.map(() => undefined);
  const pendingDwell: ({ stop: number; dwell: number } | undefined)[] = trains.map(() => undefined);

  const trainSpace = (train: TrainState, r: number) =>
    train.shared === undefined
      ? (train.perResource[r] as number) - (train.cargo[r] as number)
      : train.shared - train.cargo.reduce((sum, c) => sum + c, 0);

  const recordOutcome = (
    outcome: PolicyOutcome,
    t: number,
    at: { stop: number; train: string; station: string } | undefined,
  ) => {
    for (const message of outcome.logs) events.push({ t, kind: "log", ...at, message });
    for (const { name, value } of outcome.records) {
      if (!Number.isFinite(value)) {
        if (at) {
          metrics.warnings++;
          events.push({
            t,
            kind: "warning",
            ...at,
            message: `record "${name}" ignored: value is not a finite number`,
          });
        }
        continue;
      }
      const series = records[name] ?? { t: [], v: [] };
      records[name] = series;
      series.t.push(t);
      series.v.push(value);
      events.push({ t, kind: "record", ...(at ? { stop: at.stop } : {}), name, value });
    }
    if (at) for (const trace of outcome.traces) events.push({ t, kind: "trace", ...at, trace });
    if (outcome.error) {
      metrics.policyErrors++;
      if (outcome.error.kind === "budget") metrics.budgetOverruns++;
      events.push({
        t,
        kind: "error",
        ...at,
        errorKind: outcome.error.kind,
        message: outcome.error.message,
        ...(outcome.error.line === undefined ? {} : { line: outcome.error.line }),
      });
    }
  };

  const liveState = (t: number): LineState => ({
    t,
    stock: stock.slice(),
    cargo: trains.map((train) => train.cargo.slice()),
    trains: trains.map((train, i) => {
      const place = moving[i];
      if (place?.state === "moving") {
        const span = place.arriveAt - place.departedAt;
        return { ...place, progress: span > 0 ? Math.min(1, (t - place.departedAt) / span) : 1 };
      }
      return {
        state: "stopped",
        station: stations[train.station] as string,
        direction: directionName(train.direction),
      };
    }),
  });

  // --- Handlers -------------------------------------------------------------
  const queue = new EventQueue<SimEvent>();
  let stopCount = 0;

  const applyAction = (action: Action, train: TrainState, s: number, t: number, stop: number) => {
    const at = { stop, train: train.id, station: stations[s] as string };
    const warn = (message: string, requested: number, applied: number) => {
      metrics.warnings++;
      events.push({
        t,
        kind: "warning",
        ...at,
        message,
        action: { type: action.type, resource: action.resource, requested, applied },
      });
    };
    const r = resourceIndex.get(action.resource);
    const site = r === undefined ? -1 : ((siteOf[s] as number[])[r] as number);
    const requested = action.amount;
    if (r === undefined || site < 0) {
      warn(
        `${action.resource} is not enabled at ${at.station}; ${action.type} ignored`,
        requested,
        0,
      );
      return 0;
    }
    let amount = Number.isFinite(requested) ? Math.floor(requested) : 0;
    let reason = amount === requested ? "" : "amounts are whole milli-units";
    if (amount < 0) {
      amount = 0;
      reason = "amounts cannot be negative";
    }
    let applied: number;
    if (action.type === "load") {
      const available = stock[site] as number;
      const space = trainSpace(train, r);
      applied = Math.min(amount, available, space);
      if (applied < amount)
        reason = available <= space ? "limited by station stock" : "limited by train space";
    } else {
      const carried = train.cargo[r] as number;
      const room = (siteCapacity[site] as number) - (stock[site] as number);
      applied = Math.min(amount, carried, room);
      if (applied < amount)
        reason = carried <= room ? "limited by train cargo" : "limited by station space";
    }
    if (applied !== requested)
      warn(`${action.type} ${action.resource}: ${reason}`, requested, applied);
    if (applied <= 0) return 0;

    const signed = action.type === "load" ? applied : -applied;
    stock[site] = (stock[site] as number) - signed;
    train.cargo[r] = (train.cargo[r] as number) + signed;
    events.push({ t, kind: "transfer", ...at, resource: action.resource, amount: signed });

    if (action.type === "unload") {
      lastUnload[site] = t;
    } else {
      const previous = lastUnload[site];
      if (previous !== undefined && t - previous <= train.roundTripMs) metrics.oscillations++;
    }
    return applied;
  };

  const handleArrival = (event: Extract<SimEvent, { kind: "arrival" }>) => {
    const t = event.time;
    const train = trains[event.train] as TrainState;
    const s = event.station;
    train.station = s;
    moving[event.train] = undefined;
    if (s === last && train.direction === 1) train.direction = -1;
    if (s === 0 && train.direction === -1) train.direction = 1;

    const stop = ++stopCount;
    metrics.stops++;
    const at = { stop, train: train.id, station: stations[s] as string };
    events.push({ t, kind: "arrival", ...at, direction: directionName(train.direction) });

    const current = stationQuantities(s);
    const snapshot: StopSnapshot = {
      stop,
      now: t,
      information_level: level,
      train: {
        id: train.id,
        direction: directionName(train.direction),
        speed: train.speed,
        capacity: train.capacitySnapshot,
        cargo: Object.fromEntries(resources.map((r, i) => [r, train.cargo[i] as number])),
        space: Object.fromEntries(resources.map((r, i) => [r, trainSpace(train, i)])),
      },
      station: { ...(staticStations[s] as StationSnapshot), ...current },
      line: {
        stations: staticStations.map((station, i) =>
          i === s
            ? { ...station, ...current }
            : level === "line"
              ? { ...station, ...stationQuantities(i) }
              : station,
        ),
      },
      resources: resourceSnapshots,
    };

    const outcome = policy.stop(snapshot);
    recordOutcome(outcome, t, at);
    let transferred = 0;
    if (!outcome.error) {
      for (const action of outcome.actions) transferred += applyAction(action, train, s, t, stop);
    }
    metrics.transferred += transferred;
    const dwell = train.dwellMs + Math.floor((transferred * train.dwellPerUnitMs) / 1000);
    metrics.dwellMs += dwell;
    queue.push({
      kind: "departure",
      time: t + dwell,
      order: EventOrder.departure,
      entity: event.train,
      train: event.train,
    });
    pendingDwell[event.train] = { stop, dwell };
  };

  const handleDeparture = (event: Extract<SimEvent, { kind: "departure" }>) => {
    const t = event.time;
    const train = trains[event.train] as TrainState;
    const from = train.station;
    const to = from + train.direction;
    const distance = train.direction === 1 ? (segment[from] as number) : (segment[to] as number);
    const arriveAt = t + travelMs(distance, train.speed);
    metrics.distance += distance;
    if (train.cargo.every((c) => c === 0)) metrics.emptyDistance += distance;
    const pending = pendingDwell[event.train];
    events.push({
      t,
      kind: "departure",
      stop: pending?.stop ?? 0,
      train: train.id,
      station: stations[from] as string,
      to: stations[to] as string,
      arriveAt,
      dwellMs: pending?.dwell ?? 0,
    });
    moving[event.train] = {
      state: "moving",
      from: stations[from] as string,
      to: stations[to] as string,
      departedAt: t,
      arriveAt,
      progress: 0,
    };
    queue.push({
      kind: "arrival",
      time: arriveAt,
      order: EventOrder.arrival,
      entity: event.train,
      train: event.train,
      station: to,
    });
  };

  const stormActive = (storm: StormState, tickStart: number) =>
    tickStart >= storm.start && tickStart < storm.end;

  const handleTick = (event: Extract<SimEvent, { kind: "tick" }>) => {
    const t = event.time;
    const tickStart = t - TICK_MS;
    for (const flow of flows) {
      const variability = flow.def.variability;
      if (variability.kind === "uniform") {
        if (tickStart >= flow.periodEnd) {
          const bound = Math.floor((flow.def.rate * variability.rangePercent) / 100);
          flow.effective = flow.def.rate - bound + flow.rng.int(0, 2 * bound);
          flow.periodEnd = tickStart - (tickStart % variability.periodMs) + variability.periodMs;
        }
      } else if (variability.kind === "bursts") {
        if (
          flow.on ? flow.rng.chancePpm(variability.offPpm) : flow.rng.chancePpm(variability.onPpm)
        ) {
          flow.on = !flow.on;
        }
        flow.effective = flow.on ? flow.def.rate : 0;
      }

      let multiplier = 1000;
      if (!flow.consumer) {
        for (const storm of storms) {
          if (storm.stations[flow.station] && stormActive(storm, tickStart)) {
            multiplier = Math.min(multiplier, storm.multiplier);
          }
        }
      }
      flow.accumulator += flow.effective * multiplier;
      const amount = Math.floor(flow.accumulator / MINUTE_PERMILLE);
      flow.accumulator -= amount * MINUTE_PERMILLE;
      if (amount === 0) continue;
      flowTotals[flow.name] = (flowTotals[flow.name] as number) + amount;

      const site = flow.site;
      const resource = resources[flow.resource] as string;
      const perResource = byResource[resource] as { unmet: number; stalled: number; met: number };
      if (flow.consumer) {
        const taken = Math.min(amount, stock[site] as number);
        stock[site] = (stock[site] as number) - taken;
        const unmet = amount - taken;
        metrics.demandMet += taken;
        (running.consumed[flow.resource] as number) += taken;
        metrics.unmetDemand += unmet;
        metrics.unmetDemandWeighted += unmet * (priority[flow.resource] as number);
        perResource.met += taken;
        perResource.unmet += unmet;
      } else {
        const added = Math.min(amount, (siteCapacity[site] as number) - (stock[site] as number));
        stock[site] = (stock[site] as number) + added;
        (running.produced[flow.resource] as number) += added;
        metrics.stalledProduction += amount - added;
        perResource.stalled += amount - added;
      }
    }
    if (t + TICK_MS <= duration)
      queue.push({ kind: "tick", time: t + TICK_MS, order: EventOrder.tick, entity: 0 });
  };

  const handleStormCheck = (event: Extract<SimEvent, { kind: "storm-check" }>) => {
    const t = event.time;
    const storm = storms[event.storm] as StormState;
    const schedule = storm.schedule;
    let starts = false;
    if (schedule.kind === "fixed") {
      starts = true;
    } else {
      if (t >= storm.end) starts = (storm.rng as Random).chancePpm(schedule.probabilityPpm);
      const next = t + schedule.checkIntervalMs;
      if (next < duration)
        queue.push({
          kind: "storm-check",
          time: next,
          order: EventOrder.stormCheck,
          entity: event.storm,
          storm: event.storm,
        });
    }
    if (!starts) return;
    storm.start = t;
    storm.end = t + schedule.durationMs;
    events.push({ t, kind: "storm-start", storm: storm.id, stations: storm.stationIds });
    if (storm.end <= duration) {
      queue.push({
        kind: "storm-end",
        time: storm.end,
        order: EventOrder.stormCheck,
        entity: event.storm,
        storm: event.storm,
      });
    }
  };

  // --- Run ------------------------------------------------------------------
  const startOutcome = policy.start(
    {
      now: 0,
      information_level: level,
      line: { stations: staticStations },
      resources: resourceSnapshots,
      trains: trains.map((train) => ({
        id: train.id,
        speed: train.speed,
        capacity: train.capacitySnapshot,
      })),
    },
    { seed, informationLevel: level },
  );
  recordOutcome(startOutcome, 0, undefined);
  const aborted = startOutcome.error?.kind === "load";

  if (!aborted) {
    storms.forEach((storm, i) => {
      const time = storm.schedule.kind === "fixed" ? storm.schedule.startMs : 0;
      queue.push({ kind: "storm-check", time, order: EventOrder.stormCheck, entity: i, storm: i });
    });
    if (duration >= TICK_MS)
      queue.push({ kind: "tick", time: TICK_MS, order: EventOrder.tick, entity: 0 });
    trains.forEach((train, i) => {
      queue.push({
        kind: "arrival",
        time: 0,
        order: EventOrder.arrival,
        entity: i,
        train: i,
        station: train.station,
      });
    });

    for (
      let event = queue.peek();
      event !== undefined && event.time <= duration;
      event = queue.peek()
    ) {
      queue.pop();
      writeRowsBefore(event.time, false);
      switch (event.kind) {
        case "tick":
          handleTick(event);
          break;
        case "arrival":
          handleArrival(event);
          break;
        case "departure":
          handleDeparture(event);
          break;
        case "storm-check":
          handleStormCheck(event);
          break;
        case "storm-end": {
          const storm = storms[event.storm] as StormState;
          events.push({
            t: event.time,
            kind: "storm-end",
            storm: storm.id,
            stations: storm.stationIds,
          });
          break;
        }
      }
      options.inspect?.(liveState(event.time), {
        produced: running.produced.slice(),
        consumed: running.consumed.slice(),
      });
    }
  }
  writeRowsBefore(duration, true);

  metrics.emptyDistanceShare = metrics.distance > 0 ? metrics.emptyDistance / metrics.distance : 0;

  return {
    apiVersion: POLICY_API_VERSION,
    scenarioId: scenario.id,
    seed,
    durationMs: duration,
    tickMs: TICK_MS,
    stations,
    resources,
    trains: trains.map((train) => train.id),
    sites,
    ...(stockRows ? { stock: stockRows } : {}),
    ...(cargoRows ? { cargo: cargoRows } : {}),
    samples,
    events,
    records,
    flowTotals,
    metrics,
    aborted,
  };
}
