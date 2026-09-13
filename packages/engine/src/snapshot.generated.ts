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

/** Everything `on_review` receives when a stock point reviews what to order from its suppliers. */
export interface ReviewSnapshot {
  /** Number of this review within the run, starting at 1. */
  review: number;
  /** Game time in milliseconds since the run started. */
  now: number;
  /** How much of the scenario this policy may see. */
  information_level: "local" | "line";
  /** The stock point being reviewed, with its stock, orders and suppliers. */
  stock_point: StockPointSnapshot;
  /** Every stock point in the scenario, in order. Their stock is readable only at the `line` level. */
  line: LineSnapshot;
  /** Every resource in the scenario, in scenario order. */
  resources: ResourceSnapshot[];
}

/** A stock point under review. */
export interface StockPointSnapshot {
  /** Stock point id, as written in the scenario. */
  id: string;
  /** Position in the scenario's list of stock points, starting at 1. */
  index: number;
  /** Ids of the resources this stock point stores, in scenario order. */
  resources: string[];
  /** Milli-units stored, by resource id, after any expiring stock was removed. */
  stock: Quantities;
  /** Storage limit in milli-units, by resource id. */
  capacity: Quantities;
  /** Demand waiting to be served here, in milli-units, by resource id. */
  backorders: Quantities;
  /** Orders placed by this stock point that have not arrived, oldest first. */
  on_order: OrderSnapshot[];
  /** Where each resource can be ordered from. */
  suppliers: SupplierSnapshot[];
}

/** An order on its way to the stock point that placed it. */
export interface OrderSnapshot {
  /** Resource id. */
  resource: string;
  /** Milli-units still to arrive. */
  amount: number;
  /** `external`, or the id of the supplying stock point. */
  from: string;
  /** Game time the order was placed. */
  placed_at: number;
  /** Game time the order arrives; `nil` while it waits for stock at a supplying stock point. */
  arrives_at?: number;
}

/** A supplier for one resource. */
export interface SupplierSnapshot {
  /** Resource id. */
  resource: string;
  /** `external`, or the id of the supplying stock point. */
  from: string;
  /** Possible lead times in milliseconds, with their weights. */
  lead_times: LeadTimeSnapshot[];
  /** Smallest order in milli-units, when there is one. */
  min_order?: number;
  /** Largest order in milli-units, when there is one. */
  max_order?: number;
}

/** One possible lead time and how likely it is. */
export interface LeadTimeSnapshot {
  /** Lead time in milliseconds. */
  value: number;
  /** Relative weight; a fixed lead time has one value with weight 1. */
  weight: number;
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
