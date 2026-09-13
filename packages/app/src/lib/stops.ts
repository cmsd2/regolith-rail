import {
  type Direction,
  type RunEvent,
  type RunOutput,
  stateAt,
  type Trace,
} from "@regolith-rail/engine";

export interface Arrival {
  stop: number;
  t: number;
  train: string;
  station: string;
  direction: Direction;
}

type Ev<K extends RunEvent["kind"]> = RunEvent & { kind: K };

export interface StopDetail extends Arrival {
  dwellMs: number | null;
  transfers: Ev<"transfer">[];
  warnings: Ev<"warning">[];
  traces: Trace[];
  logs: string[];
  records: { name: string; value: number }[];
  errors: Ev<"error">[];
  /** Stock by station and resource as the policy saw it, before this stop's transfers. */
  stock: Record<string, Record<string, number>>;
  /** The train's cargo by resource before this stop's transfers. */
  cargo: Record<string, number>;
}

const cache = new WeakMap<RunOutput, Arrival[]>();

/** Every arrival in the run, in time order. */
export function arrivals(output: RunOutput): Arrival[] {
  let list = cache.get(output);
  if (!list) {
    list = output.events
      .filter((e): e is Ev<"arrival"> => e.kind === "arrival")
      .map(({ stop, t, train, station, direction }) => ({ stop, t, train, station, direction }));
    cache.set(output, list);
  }
  return list;
}

/** The last stop that started at or before `t`. */
export function latestStopAt(output: RunOutput, t: number): number | null {
  const list = arrivals(output);
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as Arrival).t <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo === 0 ? null : (list[lo - 1] as Arrival).stop;
}

export function stopDetail(output: RunOutput, stop: number): StopDetail | null {
  const arrival = arrivals(output).find((a) => a.stop === stop);
  if (!arrival) return null;
  const events = output.events.filter((e) => "stop" in e && e.stop === stop);
  const of = <K extends RunEvent["kind"]>(kind: K) =>
    events.filter((e): e is Ev<K> => e.kind === kind);

  // State after everything at this time, with this and later same-time stops undone.
  const state = stateAt(output, arrival.t);
  for (const event of output.events) {
    if (event.kind !== "transfer" || event.t !== arrival.t || event.stop < stop) continue;
    const site = output.sites.findIndex(
      (s) => s.station === event.station && s.resource === event.resource,
    );
    const train = output.trains.indexOf(event.train);
    const resource = output.resources.indexOf(event.resource);
    if (site >= 0) state.stock[site] = (state.stock[site] as number) + event.amount;
    const cargo = state.cargo[train];
    if (cargo && resource >= 0) cargo[resource] = (cargo[resource] as number) - event.amount;
  }
  const stock: StopDetail["stock"] = {};
  output.sites.forEach((site, i) => {
    stock[site.station] ??= {};
    (stock[site.station] as Record<string, number>)[site.resource] = state.stock[i] as number;
  });
  const trainCargo = state.cargo[output.trains.indexOf(arrival.train)] ?? [];
  const cargo = Object.fromEntries(output.resources.map((r, i) => [r, trainCargo[i] ?? 0]));

  return {
    ...arrival,
    dwellMs: of("departure")[0]?.dwellMs ?? null,
    transfers: of("transfer"),
    warnings: of("warning"),
    traces: of("trace").map((e) => e.trace),
    logs: of("log").map((e) => e.message),
    records: of("record").map(({ name, value }) => ({ name, value })),
    errors: of("error"),
    stock,
    cargo,
  };
}
