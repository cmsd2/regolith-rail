// Generated from packages/policy-api/src/spec.ts. Do not edit.

/** The Policy API version every run output and share link records. */
export const POLICY_API_VERSION = 1;

/** Milli-units by resource id. */
export type Quantities = Record<string, number>;

/** Everything `on_stop` receives about the stop, the train, the station and the line. */
export interface StopSnapshot {
  /** Number of this stop within the run, starting at 1. */
  stop: number;
  /** Game time in milliseconds since the run started. */
  now: number;
  /** How much of the line this scenario lets the policy see. */
  information_level: "local" | "line";
  /** The train that has stopped. */
  train: TrainSnapshot;
  /** The station the train has stopped at. Its stock and capacity are always readable. */
  station: CurrentStationSnapshot;
  /** The stations on the line, in order. */
  line: LineSnapshot;
  /** Every resource in the scenario, in scenario order. */
  resources: ResourceSnapshot[];
}

/** What `on_start` receives once at the start of each run. */
export interface StartSnapshot {
  /** Game time in milliseconds; always 0 at the start of a run. */
  now: number;
  /** How much of the line this scenario lets the policy see. */
  information_level: "local" | "line";
  /** The stations on the line, without stock. */
  line: LineSnapshot;
  /** Every resource in the scenario. */
  resources: ResourceSnapshot[];
  /** Every train on the line. */
  trains: TrainInfoSnapshot[];
}

/** A train stopped at a station. */
export interface TrainSnapshot {
  /** Train id, as written in the scenario. */
  id: string;
  /** Direction the train will leave in. `forward` runs towards the last station; trains reverse at either end. */
  direction: "forward" | "backward";
  /** Distance travelled per second. */
  speed: number;
  /** How much the train can carry. */
  capacity: TrainCapacitySnapshot;
  /** Milli-units carried, by resource id. Every scenario resource is present. */
  cargo: Quantities;
  /** Milli-units more the train could load, by resource id. */
  space: Quantities;
}

/** Either one capacity shared by all resources, or a capacity per resource. */
export interface TrainCapacitySnapshot {
  /** Total milli-units across all resources, when capacity is shared. */
  shared?: number;
  /** Milli-units per resource id, when capacity is per resource. */
  per_resource?: Quantities;
}

/** A train as described at the start of a run. */
export interface TrainInfoSnapshot {
  /** Train id, as written in the scenario. */
  id: string;
  /** Distance travelled per second. */
  speed: number;
  /** How much the train can carry. */
  capacity: TrainCapacitySnapshot;
}

/** A station on the line. */
export interface StationSnapshot {
  /** Station id, as written in the scenario. */
  id: string;
  /** Position on the line, starting at 1. */
  index: number;
  /** Ids of the resources this station stores, in scenario order. */
  resources: string[];
  /** Distance to the next station; `nil` on the last station. */
  distance_to_next?: number;
  /** Milli-units stored, by resource id. Readable for other stations only at the `line` level. */
  stock?: Quantities;
  /** Storage limit in milli-units, by resource id. Readable for other stations only at the `line` level. */
  capacity?: Quantities;
}

/** The line the train runs on. */
export interface LineSnapshot {
  /** Stations in line order. */
  stations: StationSnapshot[];
}

/** A resource and how important it is. */
export interface ResourceSnapshot {
  /** Resource id, such as `Metals`. */
  id: string;
  /** Weight used when scoring unmet demand; higher is more important. */
  priority: number;
}

/** The stopped train's station, whose stock and capacity are always present. */
export type CurrentStationSnapshot = StationSnapshot & { stock: Quantities; capacity: Quantities };
