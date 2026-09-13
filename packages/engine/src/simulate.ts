import type { LineState, Metrics, RunEvent, RunOutput, Site } from "./output.ts";
import { TICK_MS } from "./output.ts";
import {
  type Action,
  type Direction,
  POLICY_API_VERSION,
  type Policy,
  type PolicyOutcome,
  type Quantities,
  type ReviewSnapshot,
  type StationSnapshot,
  type StopSnapshot,
  type TrainCapacitySnapshot,
} from "./policy.ts";
import { EventOrder, EventQueue, type Scheduled } from "./queue.ts";
import { type Random, streamFor } from "./random.ts";
import {
  type ConsumerDef,
  type DistributionDef,
  EXTERNAL_SUPPLIER,
  type ProducerDef,
  type ProfilePointDef,
  type ScenarioV2 as Scenario,
  type SupplierDef,
  travelMs,
  UNLIMITED_CAPACITY,
} from "./scenario/format2.ts";
import {
  type InformationLevel,
  SOL_MS,
  type VariabilityDef,
  type WorldEventDef,
} from "./scenario/schema.ts";

export type Detail = "full" | "summary";

export interface RunOptions {
  /** Seed for this run; defaults to the scenario's seed. */
  seed?: number;
  /** Full detail records stock and cargo at every tick for replay. Defaults to full. */
  detail?: Detail;
  /** Test hook: called after every handled event with the live state. */
  inspect?: (state: LineState, totals: FlowTotalsByResource) => void;
  /** Called with the fraction of the run completed, at most once per percent. */
  progress?: (fraction: number) => void;
}

/** Running totals by resource index, for checking conservation. */
export interface FlowTotalsByResource {
  /** Amount added to stations by producers. */
  produced: number[];
  /** Amount taken from stations by consumers. */
  consumed: number[];
  /** Amount converters added (outputs) minus the amount they took (inputs). */
  converted: number[];
  /** Amount delivered by external suppliers, including any that overflowed. */
  supplied: number[];
  /** Amount that did not fit when delivered. */
  overflow: number[];
  /** Amount removed because it expired. */
  expired: number[];
  /** Amount shipped between stock points and not yet delivered. */
  inTransit: number[];
}

type SimEvent = Scheduled &
  (
    | { kind: "tick" }
    | {
        kind: "arrival";
        train: number;
        station: number;
        pos: number;
        /** A timetable vehicle starting a trip from its first stop. */
        tripStart?: boolean;
      }
    | { kind: "departure"; train: number }
    | { kind: "event-check"; world: number }
    | { kind: "event-end"; world: number }
    | { kind: "review"; point: number }
    | { kind: "delivery"; shipment: Shipment }
  );

interface FlowState {
  name: string;
  consumer: boolean;
  station: number;
  site: number;
  resource: number;
  def: ProducerDef;
  kind: "rate" | "poisson" | "perPeriod" | "trace";
  /** Accumulator divisor: per-sol rates for `rate`, ticks per period for periodic kinds. */
  divisor: number;
  /** Amount for the current period of a periodic kind, and the period it belongs to. */
  periodAmount: number;
  periodIndex: number;
  /** Consumers only: unmet demand is carried in `backlog` instead of being lost. */
  backorder: boolean;
  backlog: number;
  rng: Random;
  accumulator: number;
  effective: number;
  periodEnd: number;
  on: boolean;
}

interface SupplierState {
  resource: number;
  /** Supplying stock point index, or `undefined` for an external supplier. */
  from: number | undefined;
  def: SupplierDef;
  rng: Random;
}

/** An order, or part of one, on its way to the stock point that placed it. */
interface Shipment {
  point: number;
  resource: number;
  from: number | undefined;
  amount: number;
  placedAt: number;
  arrivesAt: number;
}

/** The part of an order a supplying stock point could not yet ship. */
interface Backlogged {
  point: number;
  resource: number;
  from: number;
  amount: number;
  placedAt: number;
}

interface ConverterState {
  station: number;
  inputs: { site: number; resource: number; amount: number }[];
  outputs: { site: number; resource: number; amount: number }[];
  rate: number;
  variability: VariabilityDef;
  rng: Random;
  accumulator: number;
  effective: number;
  periodEnd: number;
  on: boolean;
}

interface TrainState {
  id: string;
  kind: "shuttle" | "loop" | "timetable";
  /** Stock point indices the route visits, in order. */
  path: number[];
  /** Position in `path` of the stock point the vehicle is at or last left. */
  pos: number;
  /** Cost per unit of distance travelled. */
  costPerDistance: number;
  /** Timetable departure times, and the index of the next one not yet used. */
  departures: number[];
  nextDeparture: number;
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

interface EffectState {
  offset: number;
  duration: number;
  multiplier: number;
}

interface WorldEventState {
  id: string;
  label: string;
  schedule: WorldEventDef["schedule"];
  rng: Random | undefined;
  /** When the current instance ends; checks do not start a new one before then. */
  end: number;
  /** Start times of instances whose effects may still be active. */
  starts: number[];
  /** Latest time after a start at which any effect can still be active. */
  reach: number;
}

/** Rates are per sol, applied every game minute, with multipliers in thousandths. */
const TICKS_PER_SOL = SOL_MS / TICK_MS;
const RATE_DIVISOR = TICKS_PER_SOL * 1000;
const MAX_MULTIPLIER = 1_000_000;

const directionName = (d: 1 | -1): Direction => (d === 1 ? "forward" : "backward");

/**
 * A profile's multiplier in thousandths at a time: the first point's value before it, the last
 * point's after it, and linear interpolation rounded down between points.
 */
export function profileAt(points: readonly ProfilePointDef[], t: number): number {
  const first = points[0] as ProfilePointDef;
  if (t <= first.atMs) return first.multiplierPermille;
  for (let k = 1; k < points.length; k++) {
    const next = points[k] as ProfilePointDef;
    if (t < next.atMs) {
      const previous = points[k - 1] as ProfilePointDef;
      const span = next.atMs - previous.atMs;
      const rise = next.multiplierPermille - previous.multiplierPermille;
      return previous.multiplierPermille + Math.floor((rise * (t - previous.atMs)) / span);
    }
  }
  return (points[points.length - 1] as ProfilePointDef).multiplierPermille;
}

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
  const stations = scenario.stockPoints.map((s) => s.id);
  const stationIndex = new Map(stations.map((id, i) => [id, i]));

  const sites: Site[] = [];
  const siteOf: number[][] = scenario.stockPoints.map(() => resources.map(() => -1));
  const stock: number[] = [];
  const siteCapacity: number[] = [];
  scenario.stockPoints.forEach((station, s) => {
    for (const r of station.resources) {
      const ri = resourceIndex.get(r.id) as number;
      const capacity = r.capacity === "unlimited" ? UNLIMITED_CAPACITY : r.capacity;
      (siteOf[s] as number[])[ri] = sites.length;
      sites.push({ station: station.id, resource: r.id, capacity });
      stock.push(r.initial);
      siteCapacity.push(capacity);
    }
  });

  // Arc distances between stock points, in both directions.
  const arcDistance = new Map<string, number>();
  for (const arc of scenario.arcs) {
    arcDistance.set(`${arc.from}:${arc.to}`, arc.distance);
    arcDistance.set(`${arc.to}:${arc.from}`, arc.distance);
  }
  const distanceBetween = (a: number, b: number) =>
    arcDistance.get(`${stations[a]}:${stations[b]}`) as number;

  // --- Flows ----------------------------------------------------------------
  const flows: FlowState[] = [];
  scenario.stockPoints.forEach((station, s) => {
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
          kind:
            def.poisson !== undefined
              ? "poisson"
              : def.perPeriod !== undefined
                ? "perPeriod"
                : def.trace !== undefined
                  ? "trace"
                  : "rate",
          divisor:
            def.perPeriod !== undefined
              ? (def.perPeriod.periodMs / TICK_MS) * 1000
              : def.trace !== undefined
                ? (def.trace.periodMs / TICK_MS) * 1000
                : RATE_DIVISOR,
          periodAmount: 0,
          periodIndex: -1,
          backorder: "unmet" in def && def.unmet === "backorder",
          backlog: 0,
          rng: streamFor(seed, name),
          accumulator: 0,
          effective: def.rate ?? 0,
          periodEnd: 0,
          on: def.variability?.kind === "bursts" ? def.variability.startsOn : true,
        });
      }
    }
  });
  const flowTotals: Record<string, number> = Object.fromEntries(flows.map((f) => [f.name, 0]));

  // --- Costs ---------------------------------------------------------------------
  // Exact integer accumulators; costs are converted to thousandths once, at the end.
  const holdingCost: number[] = [];
  scenario.stockPoints.forEach((station) => {
    for (const r of station.resources) holdingCost.push(r.holdingCost ?? 0);
  });
  const hasCosts =
    holdingCost.some((c) => c > 0) ||
    scenario.vehicles.some((v) => (v.costPerDistance ?? 0) > 0) ||
    scenario.stockPoints.some(
      (p) =>
        p.suppliers.some((s) => (s.orderCost ?? 0) > 0 || (s.unitCost ?? 0) > 0) ||
        p.producers.some((f) => (f.stallCost ?? 0) > 0) ||
        p.consumers.some((f) => (f.lostCost ?? 0) > 0 || (f.backorderCost ?? 0) > 0),
    );
  /** Cost × milli-units × milliseconds, for holding and backorders. */
  let holdingNumerator = 0n;
  let backorderNumerator = 0n;
  /** Cost × milli-units, for orders, lost demand and stalled production. */
  let orderingNumerator = 0n;
  let lostNumerator = 0n;
  let stallNumerator = 0n;
  /** Cost × distance. */
  let transportNumerator = 0n;

  // --- Suppliers and reviews ---------------------------------------------------
  const suppliers: SupplierState[][] = scenario.stockPoints.map((station) =>
    station.suppliers.map((def) => ({
      resource: resourceIndex.get(def.resource) as number,
      from: def.from === EXTERNAL_SUPPLIER ? undefined : (stationIndex.get(def.from) as number),
      def,
      rng: streamFor(seed, `supplier:${station.id}:${def.resource}`),
    })),
  );
  const expiring: number[][] = scenario.stockPoints.map((station, s) =>
    station.resources
      .filter((r) => r.expires)
      .map((r) => (siteOf[s] as number[])[resourceIndex.get(r.id) as number] as number),
  );
  /** Orders on their way, and orders waiting at each supplying stock point, oldest first. */
  const shipments: Shipment[] = [];
  const backlogs: Backlogged[][] = scenario.stockPoints.map(() => []);
  let reviewCount = 0;

  // --- Converters -------------------------------------------------------------
  const converters: ConverterState[] = [];
  scenario.stockPoints.forEach((station, s) => {
    station.converters.forEach((def, k) => {
      const at = (amount: { resource: string; amount: number }) => {
        const resource = resourceIndex.get(amount.resource) as number;
        return {
          site: (siteOf[s] as number[])[resource] as number,
          resource,
          amount: amount.amount,
        };
      };
      converters.push({
        station: s,
        inputs: def.inputs.map(at),
        outputs: def.outputs.map(at),
        rate: def.rate,
        variability: def.variability,
        rng: streamFor(seed, `converter:${station.id}:${k}`),
        accumulator: 0,
        effective: def.rate,
        periodEnd: 0,
        on: def.variability.kind === "bursts" ? def.variability.startsOn : true,
      });
    });
  });

  // --- Vehicles -------------------------------------------------------------
  const legTime = (path: number[], speed: number, closed: boolean) => {
    let total = 0;
    const legs = closed ? path.length : path.length - 1;
    for (let k = 0; k < legs; k++) {
      total += travelMs(
        distanceBetween(path[k] as number, path[(k + 1) % path.length] as number),
        speed,
      );
    }
    return total;
  };
  const trains: TrainState[] = scenario.vehicles.map((def) => {
    const route = def.route;
    const path = route.stops.map((id) => stationIndex.get(id) as number);
    const startId = route.kind === "timetable" ? route.stops[0] : (route.start ?? route.stops[0]);
    const pos = Math.max(0, route.stops.indexOf(startId as string));
    const start = path[pos] as number;
    let direction: 1 | -1 = route.kind === "shuttle" && route.direction === "backward" ? -1 : 1;
    if (route.kind === "shuttle") {
      if (pos === path.length - 1 && direction === 1) direction = -1;
      if (pos === 0 && direction === -1) direction = 1;
    }
    // One full round of the route: out and back for a shuttle or timetable, one circuit for a loop.
    const roundTripMs =
      route.kind === "loop" ? legTime(path, def.speed, true) : 2 * legTime(path, def.speed, false);
    const shared = "shared" in def.capacity ? def.capacity.shared : undefined;
    const perResource = resources.map((r) =>
      "perResource" in def.capacity ? (def.capacity.perResource[r] ?? 0) : 0,
    );
    return {
      id: def.id,
      kind: route.kind,
      path,
      pos,
      costPerDistance: def.costPerDistance ?? 0,
      departures: route.kind === "timetable" ? route.departuresMs : [],
      nextDeparture: 0,
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
      roundTripMs,
    };
  });

  // --- World events -----------------------------------------------------------
  const worlds: WorldEventState[] = scenario.events.map((event) => ({
    id: event.id,
    label: event.label,
    schedule: event.schedule,
    rng: event.schedule.kind === "random" ? streamFor(seed, `event:${event.id}`) : undefined,
    end: 0,
    starts: [],
    reach: Math.max(
      ...event.effects.map((e) => e.startOffsetMs + (e.durationMs ?? event.schedule.durationMs)),
    ),
  }));
  // For each flow, the effects that cover it, so ticks need not search.
  const flowEffects: { world: number; effect: EffectState }[][] = flows.map((flow) => {
    const covering: { world: number; effect: EffectState }[] = [];
    const stationId = stations[flow.station] as string;
    const resourceId = resources[flow.resource] as string;
    scenario.events.forEach((event, w) => {
      for (const effect of event.effects) {
        if ((effect.type === "demand") !== flow.consumer) continue;
        if (effect.stations !== "all" && !effect.stations.includes(stationId)) continue;
        if (effect.resources !== "all" && !effect.resources.includes(resourceId)) continue;
        covering.push({
          world: w,
          effect: {
            offset: effect.startOffsetMs,
            duration: effect.durationMs ?? event.schedule.durationMs,
            multiplier: effect.multiplierPermille,
          },
        });
      }
    });
    return covering;
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
    backorderAverage: 0,
    backorderPeak: 0,
    expired: 0,
    overflow: 0,
    costs: {
      total: 0,
      holding: 0,
      ordering: 0,
      transport: 0,
      lostDemand: 0,
      backorders: 0,
      stalledProduction: 0,
    },
    converterStarvedMs: 0,
    converterBlockedMs: 0,
    byResource,
  };
  let backorderTicks = 0;
  let backorderSum = 0;

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
  let reportedPercent = -1;

  const writeRowsBefore = (time: number, inclusive: boolean) => {
    while (inclusive ? nextRowTime <= time : nextRowTime < time) {
      const row = nextRowTime / TICK_MS;
      if (stockRows) stockRows.set(stock, row * sites.length);
      if (cargoRows) {
        trains.forEach((train, i) => {
          cargoRows.set(train.cargo, (row * trains.length + i) * resources.length);
        });
      }
      if (options.progress) {
        const percent = Math.floor((nextRowTime * 100) / duration);
        if (percent > reportedPercent) {
          reportedPercent = percent;
          options.progress(percent / 100);
        }
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
  const staticStations: StationSnapshot[] = scenario.stockPoints.map((station, i) => {
    const next = stations[i + 1];
    const distance = next === undefined ? undefined : arcDistance.get(`${station.id}:${next}`);
    return {
      id: station.id,
      index: i + 1,
      resources: station.resources.map((r) => r.id),
      ...(distance === undefined ? {} : { distance_to_next: distance }),
    };
  });
  const resourceSnapshots = scenario.resources.map((r) => ({ id: r.id, priority: r.priority }));

  // Backorders appear in snapshots only for scenarios that have backordering consumers.
  const hasBackorders = scenario.stockPoints.some((p) =>
    p.consumers.some((c) => c.unmet === "backorder"),
  );
  const stationQuantities = (s: number) => {
    const stockOut: Quantities = {};
    const capacityOut: Quantities = {};
    for (const r of scenario.stockPoints[s]?.resources ?? []) {
      const site = (siteOf[s] as number[])[resourceIndex.get(r.id) as number] as number;
      stockOut[r.id] = stock[site] as number;
      capacityOut[r.id] = siteCapacity[site] as number;
    }
    return hasBackorders
      ? { stock: stockOut, capacity: capacityOut, backorders: backordersAt(s) }
      : { stock: stockOut, capacity: capacityOut };
  };

  const network = {
    arcs: scenario.arcs.map((a) => ({ from: a.from, to: a.to, distance: a.distance })),
  };

  /**
   * The stops ahead of a vehicle in visiting order, with distance and travel time from where it
   * is: up to returning to this stop in the same direction, or to the end of a timetable trip.
   */
  const routeAhead = (train: TrainState) => {
    const ahead: { id: string; distance: number; travel_time: number }[] = [];
    const n = train.path.length;
    let pos = train.pos;
    let direction = train.direction;
    let distance = 0;
    let travel = 0;
    const steps =
      train.kind === "loop" ? n - 1 : 2 * (n - 1) - (train.kind === "timetable" ? pos : 0);
    for (let k = 0; k < steps; k++) {
      let next: number;
      if (train.kind === "loop") next = (pos + 1) % n;
      else {
        if (pos + direction < 0 || pos + direction >= n) direction = direction === 1 ? -1 : 1;
        next = pos + direction;
      }
      const leg = distanceBetween(train.path[pos] as number, train.path[next] as number);
      distance += leg;
      travel += travelMs(leg, train.speed);
      pos = next;
      ahead.push({
        id: stations[train.path[pos] as number] as string,
        distance,
        travel_time: travel,
      });
      if (train.kind === "timetable" && pos === 0) break;
    }
    return ahead;
  };

  const running: FlowTotalsByResource = {
    produced: resources.map(() => 0),
    consumed: resources.map(() => 0),
    converted: resources.map(() => 0),
    supplied: resources.map(() => 0),
    overflow: resources.map(() => 0),
    expired: resources.map(() => 0),
    inTransit: resources.map(() => 0),
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
    at: { stop?: number; train?: string; station: string; review?: number } | undefined,
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
      events.push({
        t,
        kind: "record",
        ...(at?.stop === undefined ? {} : { stop: at.stop }),
        ...(at?.review === undefined ? {} : { review: at.review }),
        name,
        value,
      });
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
    if (action.type === "order") {
      warn(
        `orders can only be placed at reviews; order for ${action.resource} ignored`,
        requested,
        0,
      );
      return 0;
    }
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
    train.pos = event.pos;
    moving[event.train] = undefined;
    if (event.tripStart) train.direction = 1;
    const tripEnds = train.kind === "timetable" && train.pos === 0 && !event.tripStart;
    if (train.kind !== "loop") {
      if (train.pos === train.path.length - 1 && train.direction === 1) train.direction = -1;
      if (train.pos === 0 && train.direction === -1) train.direction = 1;
    }

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
      route: { kind: train.kind, ahead: routeAhead(train) },
      ...(level === "line" ? { network } : {}),
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
    if (tripEnds) {
      // A timetable vehicle waits at its first stop until its next listed departure.
      scheduleTrip(event.train, t + dwell);
      return;
    }
    queue.push({
      kind: "departure",
      time: t + dwell,
      order: EventOrder.departure,
      entity: event.train,
      train: event.train,
    });
    pendingDwell[event.train] = { stop, dwell };
  };

  /** Starts a timetable vehicle's next trip at its listed time, or as soon as it is free. */
  const scheduleTrip = (index: number, freeAt: number) => {
    const train = trains[index] as TrainState;
    const listed = train.departures[train.nextDeparture];
    if (listed === undefined) return;
    train.nextDeparture++;
    if (listed < freeAt) {
      metrics.warnings++;
      events.push({
        t: freeAt,
        kind: "warning",
        stop: stopCount,
        train: train.id,
        station: stations[train.path[0] as number] as string,
        message: `departure listed at ${listed} ms left late, when the previous trip finished`,
      });
    }
    queue.push({
      kind: "arrival",
      time: Math.max(listed, freeAt),
      order: EventOrder.arrival,
      entity: index,
      train: index,
      station: train.path[0] as number,
      pos: 0,
      tripStart: true,
    });
  };

  const handleDeparture = (event: Extract<SimEvent, { kind: "departure" }>) => {
    const t = event.time;
    const train = trains[event.train] as TrainState;
    const from = train.station;
    const nextPos =
      train.kind === "loop" ? (train.pos + 1) % train.path.length : train.pos + train.direction;
    const to = train.path[nextPos] as number;
    const distance = distanceBetween(from, to);
    const arriveAt = t + travelMs(distance, train.speed);
    metrics.distance += distance;
    if (train.cargo.every((c) => c === 0)) metrics.emptyDistance += distance;
    if (hasCosts && train.costPerDistance > 0) {
      transportNumerator += BigInt(train.costPerDistance) * BigInt(distance);
    }
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
      pos: nextPos,
    });
  };

  /** Draws a whole amount from a fixed value or weighted values. */
  const draw = (distribution: DistributionDef, rng: Random) => {
    if (distribution.kind === "fixed") return distribution.value;
    let total = 0;
    for (const option of distribution.values) total += option.weight;
    let pick = rng.int(0, total - 1);
    for (const option of distribution.values) {
      if (pick < option.weight) return option.value;
      pick -= option.weight;
    }
    return 0;
  };

  /** At the first tick of a period, sets the amount a periodic flow spreads over that period. */
  const startPeriod = (flow: FlowState, tickStart: number) => {
    const def = flow.def;
    const periodMs = (def.perPeriod ?? def.trace)?.periodMs as number;
    const index = Math.floor(tickStart / periodMs);
    if (index === flow.periodIndex) return;
    flow.periodIndex = index;
    flow.accumulator = 0;
    flow.periodAmount = def.perPeriod
      ? draw(def.perPeriod.amount, flow.rng)
      : (def.trace?.amounts[index] ?? 0);
  };

  /**
   * Poisson arrivals in one tick, approximated by Bernoulli sub-steps: at least eight per
   * tick, and more for high rates, so each sub-step's chance stays at most one in eight.
   */
  const poissonAmount = (flow: FlowState, multiplier: number) => {
    const poisson = flow.def.poisson as NonNullable<ProducerDef["poisson"]>;
    // Arrivals per tick are arrivalsPerSol × multiplier / (1000 × 1000 × ticks per sol).
    const numerator = poisson.arrivalsPerSol * multiplier;
    const perTick = 1_000_000 * TICKS_PER_SOL;
    const substeps = 8 * Math.max(1, Math.ceil(numerator / perTick));
    let amount = 0;
    for (let k = 0; k < substeps; k++) {
      if (flow.rng.chance(numerator, perTick * substeps)) amount += draw(poisson.size, flow.rng);
    }
    return amount;
  };

  /**
   * Runs the batches a converter is due this tick. A batch runs only with all its inputs in
   * stock and room for all its outputs; otherwise the tick counts as starved or blocked.
   */
  const runConverter = (converter: ConverterState, tickStart: number) => {
    const variability = converter.variability;
    if (variability.kind === "uniform") {
      if (tickStart >= converter.periodEnd) {
        const bound = Math.floor((converter.rate * variability.rangePercent) / 100);
        converter.effective = converter.rate - bound + converter.rng.int(0, 2 * bound);
        converter.periodEnd = tickStart - (tickStart % variability.periodMs) + variability.periodMs;
      }
    } else if (variability.kind === "bursts") {
      const flip = converter.on
        ? converter.rng.chancePpm(variability.offPpm)
        : converter.rng.chancePpm(variability.onPpm);
      if (flip) converter.on = !converter.on;
      converter.effective = converter.on ? converter.rate : 0;
    }
    // Rates are thousandths of a batch per sol.
    converter.accumulator += converter.effective;
    const batches = Math.floor(converter.accumulator / RATE_DIVISOR);
    converter.accumulator -= batches * RATE_DIVISOR;
    let starved = false;
    let blocked = false;
    for (let b = 0; b < batches; b++) {
      if (converter.inputs.some((input) => (stock[input.site] as number) < input.amount)) {
        starved = true;
        break;
      }
      const after = stock.slice();
      for (const input of converter.inputs) {
        after[input.site] = (after[input.site] as number) - input.amount;
      }
      const fits = converter.outputs.every((output) => {
        after[output.site] = (after[output.site] as number) + output.amount;
        return (after[output.site] as number) <= (siteCapacity[output.site] as number);
      });
      if (!fits) {
        blocked = true;
        break;
      }
      for (const input of converter.inputs) {
        stock[input.site] = (stock[input.site] as number) - input.amount;
        (running.converted[input.resource] as number) -= input.amount;
      }
      for (const output of converter.outputs) {
        stock[output.site] = (stock[output.site] as number) + output.amount;
        (running.converted[output.resource] as number) += output.amount;
      }
    }
    if (starved) metrics.converterStarvedMs += TICK_MS;
    else if (blocked) metrics.converterBlockedMs += TICK_MS;
  };

  /** Backorders waiting at a stock point for a resource, summed over its consumers. */
  const backordersAt = (s: number) => {
    const out: Quantities = {};
    for (const r of scenario.stockPoints[s]?.resources ?? []) out[r.id] = 0;
    for (const flow of flows) {
      if (flow.station !== s || !flow.backorder) continue;
      const id = resources[flow.resource] as string;
      out[id] = (out[id] ?? 0) + flow.backlog;
    }
    return out;
  };

  const leadTime = (supplier: SupplierState) => draw(supplier.def.leadTime, supplier.rng);

  /** Sends an amount from a supplier to the stock point that ordered it. */
  const ship = (
    t: number,
    point: number,
    supplier: SupplierState,
    amount: number,
    placedAt: number,
  ) => {
    const shipment: Shipment = {
      point,
      resource: supplier.resource,
      from: supplier.from,
      amount,
      placedAt,
      arrivesAt: t + leadTime(supplier),
    };
    if (supplier.from !== undefined) {
      const site = (siteOf[supplier.from] as number[])[supplier.resource] as number;
      stock[site] = (stock[site] as number) - amount;
      (running.inTransit[supplier.resource] as number) += amount;
    }
    shipments.push(shipment);
    events.push({
      t,
      kind: "shipment",
      station:
        supplier.from === undefined ? EXTERNAL_SUPPLIER : (stations[supplier.from] as string),
      to: stations[point] as string,
      resource: resources[supplier.resource] as string,
      amount,
      arrivesAt: shipment.arrivesAt,
    });
    queue.push({
      kind: "delivery",
      time: shipment.arrivesAt,
      order: EventOrder.delivery,
      entity: point,
      shipment,
    });
  };

  /** Ships what supplying stock points now hold towards the orders waiting there. */
  const shipBacklogs = (t: number) => {
    backlogs.forEach((waiting, from) => {
      while (waiting.length > 0) {
        const item = waiting[0] as Backlogged;
        const site = (siteOf[from] as number[])[item.resource] as number;
        const amount = Math.min(item.amount, stock[site] as number);
        if (amount <= 0) break;
        const supplier = (suppliers[item.point] as SupplierState[]).find(
          (sup) => sup.resource === item.resource,
        ) as SupplierState;
        ship(t, item.point, supplier, amount, item.placedAt);
        item.amount -= amount;
        if (item.amount === 0) waiting.shift();
      }
    });
  };

  const handleDelivery = (event: Extract<SimEvent, { kind: "delivery" }>) => {
    const t = event.time;
    const shipment = event.shipment;
    shipments.splice(shipments.indexOf(shipment), 1);
    const site = (siteOf[shipment.point] as number[])[shipment.resource] as number;
    const added = Math.min(
      shipment.amount,
      (siteCapacity[site] as number) - (stock[site] as number),
    );
    stock[site] = (stock[site] as number) + added;
    const overflow = shipment.amount - added;
    if (shipment.from === undefined)
      (running.supplied[shipment.resource] as number) += shipment.amount;
    else (running.inTransit[shipment.resource] as number) -= shipment.amount;
    (running.overflow[shipment.resource] as number) += overflow;
    metrics.overflow += overflow;
    events.push({
      t,
      kind: "delivery",
      station: stations[shipment.point] as string,
      resource: resources[shipment.resource] as string,
      amount: added,
      overflow,
    });
  };

  /** Places an order at a review, clamped to the supplier's limits. */
  const placeOrder = (action: Action, s: number, t: number, review: number) => {
    const station = stations[s] as string;
    const r = resourceIndex.get(action.resource);
    const supplier = (suppliers[s] as SupplierState[]).find((sup) => sup.resource === r);
    const requested = action.amount;
    const warn = (message: string, applied: number) => {
      metrics.warnings++;
      events.push({
        t,
        kind: "warning",
        station,
        review,
        message,
        action: { type: "order", resource: action.resource, requested, applied },
      });
    };
    if (action.type !== "order") {
      warn(
        `${action.type} is only possible at stops; ${action.type} ${action.resource} ignored`,
        0,
      );
      return;
    }
    if (supplier === undefined) {
      warn(`${station} has no supplier for ${action.resource}; order ignored`, 0);
      return;
    }
    let amount = Number.isFinite(requested) ? Math.floor(requested) : 0;
    let reason = amount === requested ? "" : "amounts are whole milli-units";
    if (amount <= 0) {
      if (amount < 0) warn("orders cannot be negative", 0);
      return;
    }
    const { minOrder, maxOrder } = supplier.def;
    if (minOrder !== undefined && amount < minOrder) {
      amount = minOrder;
      reason = `raised to the supplier's minimum order of ${minOrder}`;
    }
    if (maxOrder !== undefined && amount > maxOrder) {
      amount = maxOrder;
      reason = `limited to the supplier's maximum order of ${maxOrder}`;
    }
    if (amount !== requested) warn(`order ${action.resource}: ${reason}`, amount);
    const from =
      supplier.from === undefined ? EXTERNAL_SUPPLIER : (stations[supplier.from] as string);
    events.push({
      t,
      kind: "order",
      review,
      station,
      resource: action.resource,
      from,
      requested,
      amount,
    });
    if (hasCosts) {
      orderingNumerator +=
        BigInt(supplier.def.orderCost ?? 0) * 1000n +
        BigInt(supplier.def.unitCost ?? 0) * BigInt(amount);
    }
    if (supplier.from === undefined) {
      ship(t, s, supplier, amount, t);
      return;
    }
    const site = (siteOf[supplier.from] as number[])[supplier.resource] as number;
    const now = Math.min(amount, stock[site] as number);
    if (now > 0) ship(t, s, supplier, now, t);
    if (amount > now) {
      (backlogs[supplier.from] as Backlogged[]).push({
        point: s,
        resource: supplier.resource,
        from: supplier.from,
        amount: amount - now,
        placedAt: t,
      });
    }
  };

  const handleReview = (event: Extract<SimEvent, { kind: "review" }>) => {
    const t = event.time;
    const s = event.point;
    const station = stations[s] as string;
    const review = ++reviewCount;
    events.push({ t, kind: "review", review, station });
    for (const site of expiring[s] as number[]) {
      const amount = stock[site] as number;
      if (amount === 0) continue;
      stock[site] = 0;
      metrics.expired += amount;
      const resource = resourceIndex.get(sites[site]?.resource as string) as number;
      (running.expired[resource] as number) += amount;
      events.push({
        t,
        kind: "expire",
        station,
        resource: sites[site]?.resource as string,
        amount,
      });
    }

    const current = stationQuantities(s);
    const onOrder = [
      ...shipments
        .filter((sh) => sh.point === s)
        .map((sh) => ({
          resource: resources[sh.resource] as string,
          amount: sh.amount,
          from: sh.from === undefined ? EXTERNAL_SUPPLIER : (stations[sh.from] as string),
          placed_at: sh.placedAt,
          arrives_at: sh.arrivesAt,
        })),
      ...backlogs.flatMap((waiting) =>
        waiting
          .filter((item) => item.point === s)
          .map((item) => ({
            resource: resources[item.resource] as string,
            amount: item.amount,
            from: stations[item.from] as string,
            placed_at: item.placedAt,
          })),
      ),
    ].sort((a, b) => a.placed_at - b.placed_at);
    const snapshot: ReviewSnapshot = {
      review,
      now: t,
      information_level: level,
      stock_point: {
        ...(staticStations[s] as StationSnapshot),
        ...current,
        backorders: backordersAt(s),
        on_order: onOrder,
        suppliers: (suppliers[s] as SupplierState[]).map((sup) => ({
          resource: resources[sup.resource] as string,
          from: sup.from === undefined ? EXTERNAL_SUPPLIER : (stations[sup.from] as string),
          lead_times:
            sup.def.leadTime.kind === "fixed"
              ? [{ value: sup.def.leadTime.value, weight: 1 }]
              : sup.def.leadTime.values.map((v) => ({ value: v.value, weight: v.weight })),
          ...(sup.def.minOrder === undefined ? {} : { min_order: sup.def.minOrder }),
          ...(sup.def.maxOrder === undefined ? {} : { max_order: sup.def.maxOrder }),
        })),
      },
      line: {
        stations: staticStations.map((other, i) =>
          i === s
            ? { ...other, ...current }
            : level === "line"
              ? { ...other, ...stationQuantities(i) }
              : other,
        ),
      },
      resources: resourceSnapshots,
    };
    if (policy.review) {
      const outcome = policy.review(snapshot);
      recordOutcome(outcome, t, { station, review });
      if (!outcome.error) for (const action of outcome.actions) placeOrder(action, s, t, review);
    }
    const next = t + ((scenario.stockPoints[s]?.review?.periodMs as number) ?? duration);
    if (next < duration) {
      queue.push({ kind: "review", time: next, order: EventOrder.review, entity: s, point: s });
    }
  };

  const handleTick = (event: Extract<SimEvent, { kind: "tick" }>) => {
    const t = event.time;
    const tickStart = t - TICK_MS;
    shipBacklogs(t);
    flows.forEach((flow, f) => {
      const variability = flow.def.variability ?? { kind: "fixed" };
      const rate = flow.def.rate ?? 0;
      if (variability.kind === "uniform") {
        if (tickStart >= flow.periodEnd) {
          const bound = Math.floor((rate * variability.rangePercent) / 100);
          flow.effective = rate - bound + flow.rng.int(0, 2 * bound);
          flow.periodEnd = tickStart - (tickStart % variability.periodMs) + variability.periodMs;
        }
      } else if (variability.kind === "bursts") {
        if (
          flow.on ? flow.rng.chancePpm(variability.offPpm) : flow.rng.chancePpm(variability.onPpm)
        ) {
          flow.on = !flow.on;
        }
        flow.effective = flow.on ? rate : 0;
      }

      let multiplier = 1000;
      if (flow.def.profile) {
        multiplier = Math.min(
          MAX_MULTIPLIER,
          Math.floor((multiplier * profileAt(flow.def.profile, tickStart)) / 1000),
        );
      }
      for (const { world, effect } of flowEffects[f] as { world: number; effect: EffectState }[]) {
        for (const start of (worlds[world] as WorldEventState).starts) {
          const from = start + effect.offset;
          if (tickStart >= from && tickStart < from + effect.duration) {
            multiplier = Math.min(
              MAX_MULTIPLIER,
              Math.floor((multiplier * effect.multiplier) / 1000),
            );
          }
        }
      }
      let amount: number;
      if (flow.kind === "poisson") {
        amount = poissonAmount(flow, multiplier);
      } else {
        if (flow.kind !== "rate") startPeriod(flow, tickStart);
        const base = flow.kind === "rate" ? flow.effective : flow.periodAmount;
        flow.accumulator += base * multiplier;
        amount = Math.floor(flow.accumulator / flow.divisor);
        flow.accumulator -= amount * flow.divisor;
      }
      if (amount === 0 && flow.backlog === 0) return;
      flowTotals[flow.name] = (flowTotals[flow.name] as number) + amount;

      const site = flow.site;
      const resource = resources[flow.resource] as string;
      const perResource = byResource[resource] as { unmet: number; stalled: number; met: number };
      if (flow.consumer) {
        // Backordered demand is served before this tick's demand.
        const served = Math.min(flow.backlog, stock[site] as number);
        flow.backlog -= served;
        const taken = Math.min(amount, (stock[site] as number) - served);
        stock[site] = (stock[site] as number) - served - taken;
        const unmet = amount - taken;
        metrics.demandMet += served + taken;
        (running.consumed[flow.resource] as number) += served + taken;
        perResource.met += served + taken;
        if (flow.backorder) {
          flow.backlog += unmet;
        } else {
          metrics.unmetDemand += unmet;
          metrics.unmetDemandWeighted += unmet * (priority[flow.resource] as number);
          perResource.unmet += unmet;
          if (hasCosts && unmet > 0) {
            lostNumerator += BigInt((flow.def as ConsumerDef).lostCost ?? 0) * BigInt(unmet);
          }
        }
      } else {
        const added = Math.min(amount, (siteCapacity[site] as number) - (stock[site] as number));
        stock[site] = (stock[site] as number) + added;
        (running.produced[flow.resource] as number) += added;
        metrics.stalledProduction += amount - added;
        perResource.stalled += amount - added;
        if (hasCosts && amount > added) {
          stallNumerator += BigInt(flow.def.stallCost ?? 0) * BigInt(amount - added);
        }
      }
    });
    for (const converter of converters) runConverter(converter, tickStart);
    let backlog = 0;
    for (const flow of flows) backlog += flow.backlog;
    if (hasCosts) {
      const tick = BigInt(TICK_MS);
      stock.forEach((amount, site) => {
        const cost = holdingCost[site] as number;
        if (cost > 0 && amount > 0) holdingNumerator += BigInt(cost) * BigInt(amount) * tick;
      });
      for (const flow of flows) {
        const cost = (flow.def as ConsumerDef).backorderCost ?? 0;
        if (cost > 0 && flow.backlog > 0) {
          backorderNumerator += BigInt(cost) * BigInt(flow.backlog) * tick;
        }
      }
    }
    backorderSum += backlog;
    backorderTicks++;
    if (backlog > metrics.backorderPeak) metrics.backorderPeak = backlog;
    if (t + TICK_MS <= duration)
      queue.push({ kind: "tick", time: t + TICK_MS, order: EventOrder.tick, entity: 0 });
  };

  const handleEventCheck = (event: Extract<SimEvent, { kind: "event-check" }>) => {
    const t = event.time;
    const world = worlds[event.world] as WorldEventState;
    const schedule = world.schedule;
    let starts = false;
    if (schedule.kind === "fixed") {
      starts = true;
    } else {
      if (t >= world.end) starts = (world.rng as Random).chancePpm(schedule.probabilityPpm);
      const next = t + schedule.checkIntervalMs;
      if (next < duration) {
        queue.push({
          kind: "event-check",
          time: next,
          order: EventOrder.eventCheck,
          entity: event.world,
          world: event.world,
        });
      }
    }
    if (!starts) return;
    world.starts = world.starts.filter((start) => start + world.reach > t);
    world.starts.push(t);
    world.end = t + schedule.durationMs;
    events.push({ t, kind: "event-start", event: world.id, label: world.label });
    if (world.end <= duration) {
      queue.push({
        kind: "event-end",
        time: world.end,
        order: EventOrder.eventCheck,
        entity: event.world,
        world: event.world,
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
    worlds.forEach((world, i) => {
      const time = world.schedule.kind === "fixed" ? world.schedule.startMs : 0;
      queue.push({ kind: "event-check", time, order: EventOrder.eventCheck, entity: i, world: i });
    });
    scenario.stockPoints.forEach((station, s) => {
      if (station.review && station.review.offsetMs < duration) {
        queue.push({
          kind: "review",
          time: station.review.offsetMs,
          order: EventOrder.review,
          entity: s,
          point: s,
        });
      }
    });
    if (duration >= TICK_MS)
      queue.push({ kind: "tick", time: TICK_MS, order: EventOrder.tick, entity: 0 });
    trains.forEach((train, i) => {
      if (train.kind === "timetable") {
        scheduleTrip(i, 0);
        return;
      }
      queue.push({
        kind: "arrival",
        time: 0,
        order: EventOrder.arrival,
        entity: i,
        train: i,
        station: train.station,
        pos: train.pos,
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
        case "event-check":
          handleEventCheck(event);
          break;
        case "review":
          handleReview(event);
          break;
        case "delivery":
          handleDelivery(event);
          break;
        case "event-end": {
          const world = worlds[event.world] as WorldEventState;
          events.push({ t: event.time, kind: "event-end", event: world.id, label: world.label });
          break;
        }
      }
      options.inspect?.(liveState(event.time), {
        produced: running.produced.slice(),
        consumed: running.consumed.slice(),
        converted: running.converted.slice(),
        supplied: running.supplied.slice(),
        overflow: running.overflow.slice(),
        expired: running.expired.slice(),
        inTransit: running.inTransit.slice(),
      });
    }
  }
  writeRowsBefore(duration, true);

  metrics.emptyDistanceShare = metrics.distance > 0 ? metrics.emptyDistance / metrics.distance : 0;
  metrics.backorderAverage = backorderTicks > 0 ? backorderSum / backorderTicks : 0;
  if (hasCosts) {
    // Rates are per unit (1000 milli-units) and, for holding and backorders, per sol.
    const perUnitSol = 1000n * BigInt(SOL_MS);
    const milli = (numerator: bigint, denominator: bigint) =>
      Number((numerator * 1000n) / denominator);
    const costs = metrics.costs;
    costs.holding = milli(holdingNumerator, perUnitSol);
    costs.backorders = milli(backorderNumerator, perUnitSol);
    costs.ordering = milli(orderingNumerator, 1000n);
    costs.lostDemand = milli(lostNumerator, 1000n);
    costs.stalledProduction = milli(stallNumerator, 1000n);
    costs.transport = milli(transportNumerator, 1n);
    costs.total =
      costs.holding +
      costs.backorders +
      costs.ordering +
      costs.lostDemand +
      costs.stalledProduction +
      costs.transport;
  }

  return {
    apiVersion: POLICY_API_VERSION,
    scenarioId: scenario.id,
    seed,
    durationMs: duration,
    tickMs: TICK_MS,
    stations,
    resources,
    trains: trains.map((train) => train.id),
    trainStarts: trains.map((train) => stations[train.station] as string),
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
