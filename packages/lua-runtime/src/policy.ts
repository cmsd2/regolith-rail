import {
  emptyOutcome,
  type Policy,
  type PolicyOutcome,
  type Random,
  type ReviewSnapshot,
  type RunContext,
  type StartSnapshot,
  type StationSnapshot,
  type StopSnapshot,
  streamFor,
} from "@regolith-rail/engine";
import { OPS_LIBRARY } from "@regolith-rail/policy-api";
import { LuaEngine, LuaFactory, type LuaWasm } from "wasmoon";
import { checkPolicySource, instrumentPolicySource } from "./check.ts";
import { toLuaLiteral } from "./literal.ts";
import { PRELUDE } from "./prelude.ts";

/** Loop iterations and function calls a single hook call may make. */
export const DEFAULT_BUDGET = 200_000;

/** Chance per stop of a simulated save and reload, in parts per million. */
const RELOAD_CHANCE_PPM = 100_000;

export interface LuaPolicyOptions {
  /** Instruction budget per hook call. */
  budget?: number;
  /** Reload the policy at seeded random stops, keeping only memory, as a game reload would. */
  saveReloadTest?: boolean;
}

export type PolicyHook = "on_start" | "on_stop" | "on_review";

/** The hooks a policy's module defines, or why it does not load. */
export interface PolicyHooks {
  hooks: PolicyHook[];
  error?: PolicyOutcome["error"];
}

interface Entry {
  load(
    source: string,
    ops: string,
    level: string,
    needsStop: boolean,
    needsReview: boolean,
  ): string;
  layout(literal: string): void;
  start(literal: string): string;
  stop(literal: string): string;
  review(literal: string): string;
  hooks(): string;
  save(): string;
  restore(text: string): void;
}

let instrumentedOps: string | undefined;
/** The ops library, instrumented once so its loops count towards the budget. */
function opsSource(): string {
  instrumentedOps ??= instrumentPolicySource(OPS_LIBRARY.ops);
  return instrumentedOps;
}

/** A loaded Lua WebAssembly module, from which policy states are created. */
export class LuaRuntime {
  private readonly module: LuaWasm;

  private constructor(module: LuaWasm) {
    this.module = module;
  }

  /** Loads the Lua module. `wasmUrl` is needed in browsers, where the bundler controls asset paths. */
  static async load(wasmUrl?: string): Promise<LuaRuntime> {
    const factory = new LuaFactory(wasmUrl);
    return new LuaRuntime(await factory.getLuaModule());
  }

  createPolicy(source: string, options: LuaPolicyOptions = {}): LuaPolicy {
    return new LuaPolicy(this.module, source, options);
  }

  /** Loads a policy without running any hook and lists the hooks it defines. */
  hooksOf(source: string): PolicyHooks {
    return this.createPolicy(source).inspect();
  }
}

function parseOutcome(json: string): PolicyOutcome {
  const raw = JSON.parse(json) as Partial<PolicyOutcome> & Record<string, unknown>;
  const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    actions: list(raw.actions),
    logs: list(raw.logs),
    records: list(raw.records),
    traces: list(raw.traces),
    ...(raw.error ? { error: raw.error } : {}),
  };
}

/**
 * The parts of a context that do not change during a run. Stations refer to each other by id;
 * the prelude links them back into shared tables.
 */
function layoutOf(snapshot: StartSnapshot) {
  return {
    information_level: snapshot.information_level,
    station_order: snapshot.station_order,
    resource_order: snapshot.resource_order,
    resources: snapshot.resources,
    vehicles: snapshot.vehicles,
    stations: snapshot.station_order.map((id) => {
      const station = snapshot.stations[id] as StationSnapshot;
      return {
        id,
        index: station.index,
        resources: station.resources,
        suppliers: station.suppliers,
        neighbours: station.neighbours.map((n) => ({
          station: n.station.id,
          distance: n.distance,
        })),
      };
    }),
  };
}

/** Quantities of the stations the policy can see in this call, by station id. */
function quantitiesOf(stations: Record<string, StationSnapshot>) {
  const out: Record<string, unknown> = {};
  for (const [id, s] of Object.entries(stations)) {
    if (s.stock === undefined) continue;
    out[id] = {
      stock: s.stock,
      capacity: s.capacity,
      backorders: s.backorders,
      on_order: s.on_order,
    };
  }
  return out;
}

/** A policy written in Lua, run in a fresh sandboxed Lua state for every run. */
export class LuaPolicy implements Policy {
  private state: LuaEngine | undefined;
  private entry: Entry | undefined;
  private instrumented: string | undefined;
  private loadError: PolicyOutcome["error"];
  private rand: Random | undefined;
  private shuffle: Random | undefined;
  private reload: Random | undefined;
  private level: RunContext["informationLevel"] = "line";
  private hooks: RunContext["hooks"] = { stop: true, review: false };
  private layout = "";
  private readonly module: LuaWasm;
  private readonly options: LuaPolicyOptions;

  constructor(module: LuaWasm, source: string, options: LuaPolicyOptions) {
    this.module = module;
    this.options = options;
    const [first] = checkPolicySource(source);
    if (first) {
      this.loadError = { kind: "load", message: first.message, line: first.line };
    } else {
      this.instrumented = instrumentPolicySource(source);
    }
  }

  /** The load error, if the source cannot run at all. */
  get error(): PolicyOutcome["error"] {
    return this.loadError;
  }

  private open(): PolicyOutcome {
    this.close();
    const state = new LuaEngine(this.module, {
      openStandardLibs: true,
      injectObjects: false,
      enableProxy: false,
    });
    const rand = this.rand as Random;
    const shuffle = this.shuffle as Random;
    state.global.set("__rr_host_rand", () => rand.fraction());
    state.global.set("__rr_host_shuffle", () => shuffle.fraction());
    state.global.set("__rr_budget", this.options.budget ?? DEFAULT_BUDGET);
    state.doStringSync(PRELUDE);
    const table = state.global.get("__rr") as Record<keyof Entry, (...args: unknown[]) => unknown>;
    this.entry = {
      load: (source, ops, level, needsStop, needsReview) =>
        table.load(source, ops, level, needsStop, needsReview) as string,
      layout: (literal) => {
        table.layout(literal);
      },
      start: (literal) => table.start(literal) as string,
      stop: (literal) => table.stop(literal) as string,
      review: (literal) => table.review(literal) as string,
      hooks: () => table.hooks() as string,
      save: () => table.save() as string,
      restore: (text) => {
        table.restore(text);
      },
    };
    this.state = state;
    const loaded = parseOutcome(
      this.entry.load(
        this.instrumented as string,
        opsSource(),
        this.level,
        this.hooks.stop,
        this.hooks.review,
      ),
    );
    if (!loaded.error && this.layout) this.entry.layout(this.layout);
    return loaded;
  }

  start(snapshot: StartSnapshot, run: RunContext): PolicyOutcome {
    if (this.loadError) return { ...emptyOutcome(), error: this.loadError };
    this.rand = streamFor(run.seed, "policy:rand");
    this.shuffle = streamFor(run.seed, "policy:pairs");
    this.reload = streamFor(run.seed, "policy:reload");
    this.level = run.informationLevel;
    this.hooks = run.hooks;
    this.layout = toLuaLiteral(layoutOf(snapshot));
    const loaded = this.open();
    if (loaded.error) return loaded;
    const call = { now: snapshot.now, quantities: quantitiesOf(snapshot.stations) };
    return parseOutcome((this.entry as Entry).start(toLuaLiteral(call)));
  }

  stop(snapshot: StopSnapshot): PolicyOutcome {
    if (this.loadError) return { ...emptyOutcome(), error: this.loadError };
    if (!this.entry) throw new Error("stop called before start");
    if (this.options.saveReloadTest && this.reload?.chancePpm(RELOAD_CHANCE_PPM)) {
      const saved = this.entry.save();
      const loaded = this.open();
      if (loaded.error) return loaded;
      (this.entry as Entry).restore(saved);
    }
    const { vehicle } = snapshot;
    const call = {
      now: snapshot.now,
      stop: snapshot.stop,
      here: snapshot.here.id,
      quantities: quantitiesOf(snapshot.stations),
      vehicle: {
        ...vehicle,
        route: {
          kind: vehicle.route.kind,
          ahead: vehicle.route.ahead.map((a) => ({ ...a, station: a.station.id })),
        },
      },
    };
    return parseOutcome((this.entry as Entry).stop(toLuaLiteral(call)));
  }

  review(snapshot: ReviewSnapshot): PolicyOutcome {
    if (this.loadError) return { ...emptyOutcome(), error: this.loadError };
    if (!this.entry) throw new Error("review called before start");
    const call = {
      now: snapshot.now,
      review: snapshot.review,
      here: snapshot.here.id,
      quantities: quantitiesOf(snapshot.stations),
    };
    return parseOutcome(this.entry.review(toLuaLiteral(call)));
  }

  /** Loads the policy without running any hook and lists the hooks its module defines. */
  inspect(): PolicyHooks {
    if (this.loadError) return { hooks: [], error: this.loadError };
    this.rand = streamFor(0, "policy:rand");
    this.shuffle = streamFor(0, "policy:pairs");
    this.level = "line";
    this.hooks = { stop: false, review: false };
    this.layout = "";
    try {
      const loaded = this.open();
      if (loaded.error) return { hooks: [], error: loaded.error };
      return { hooks: JSON.parse((this.entry as Entry).hooks()) as PolicyHook[] };
    } finally {
      this.close();
    }
  }

  /** Releases the Lua state. The policy can be started again afterwards. */
  close(): void {
    this.state?.global.close();
    this.state = undefined;
    this.entry = undefined;
  }
}
