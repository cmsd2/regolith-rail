import type { InformationLevel } from "./scenario/schema.ts";

/** The Policy API version every run output and share link records. */
export const POLICY_API_VERSION = 1;

export type Direction = "forward" | "backward";

export type Quantities = Record<string, number>;

export interface TrainCapacitySnapshot {
  shared?: number;
  perResource?: Quantities;
}

export interface TrainSnapshot {
  id: string;
  direction: Direction;
  speed: number;
  capacity: TrainCapacitySnapshot;
  cargo: Quantities;
  space: Quantities;
}

export interface StationSnapshot {
  id: string;
  /** Position on the line, starting at 1 as in Lua. */
  index: number;
  resources: string[];
  /** Present for the current station, and for every station at the `line` level. */
  stock?: Quantities;
  capacity?: Quantities;
  /** Distance to the next station; absent on the last station. */
  distanceToNext?: number;
}

export interface ResourceSnapshot {
  id: string;
  priority: number;
}

export interface StopSnapshot {
  /** Sequential number of this stop within the run, starting at 1. */
  stop: number;
  now: number;
  informationLevel: InformationLevel;
  train: TrainSnapshot;
  station: StationSnapshot & { stock: Quantities; capacity: Quantities };
  line: { stations: StationSnapshot[] };
  resources: ResourceSnapshot[];
}

export interface StartSnapshot {
  now: number;
  informationLevel: InformationLevel;
  line: { stations: StationSnapshot[] };
  resources: ResourceSnapshot[];
  trains: { id: string; speed: number; capacity: TrainCapacitySnapshot }[];
}

export type Action =
  | { type: "load"; resource: string; amount: number }
  | { type: "unload"; resource: string; amount: number };

export interface Trace {
  block: string;
  station: string;
  resource?: string;
  inputs: Record<string, number | string | boolean>;
  result: number | string;
}

export type PolicyErrorKind = "load" | "runtime" | "budget" | "memory";

export interface PolicyError {
  kind: PolicyErrorKind;
  message: string;
  /** Line in the policy source, when known. */
  line?: number;
}

export interface PolicyOutcome {
  actions: Action[];
  logs: string[];
  records: { name: string; value: number }[];
  traces: Trace[];
  error?: PolicyError;
}

export interface RunContext {
  seed: number;
  informationLevel: InformationLevel;
}

/** Anything the engine can ask what to do at a stop. */
export interface Policy {
  start(snapshot: StartSnapshot, run: RunContext): PolicyOutcome;
  stop(snapshot: StopSnapshot): PolicyOutcome;
}

export function emptyOutcome(): PolicyOutcome {
  return { actions: [], logs: [], records: [], traces: [] };
}
