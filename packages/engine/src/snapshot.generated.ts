// Generated from packages/policy-api/src/spec.ts. Do not edit.

/** The Policy API version every run output and share link records. */
export const POLICY_API_VERSION = 2;

/** Milli-units by resource id. */
export type Quantities = Record<string, number>;

/** What `on_start` receives once at the start of each run. */
export interface StartSnapshot {
  /** Game time in milliseconds since the run started; always 0 at the start. */
  now: number;
  /** How much of other stations this scenario lets the policy see. */
  information_level: "local" | "line";
  /** Every station, keyed by id. Every station a context refers to is one of these tables. */
  stations: Record<string, StationSnapshot>;
  /** Station ids in scenario order. */
  station_order: string[];
  /** Every resource, keyed by id. */
  resources: Record<string, ResourceSnapshot>;
  /** Resource ids in scenario order. */
  resource_order: string[];
  /** Every vehicle, keyed by id. */
  vehicles: Record<string, VehicleInfoSnapshot>;
}

/** What `on_stop` receives when a vehicle stops at a station. */
export interface StopSnapshot {
  /** Number of this stop within the run, starting at 1. */
  stop: number;
  /** The station the vehicle has stopped at. */
  here: StationSnapshot;
  /** The vehicle that has stopped. */
  vehicle: VehicleSnapshot;
  /** Game time in milliseconds since the run started. */
  now: number;
  /** How much of other stations this scenario lets the policy see. */
  information_level: "local" | "line";
  /** Every station, keyed by id. Every station a context refers to is one of these tables. */
  stations: Record<string, StationSnapshot>;
  /** Station ids in scenario order. */
  station_order: string[];
  /** Every resource, keyed by id. */
  resources: Record<string, ResourceSnapshot>;
  /** Resource ids in scenario order. */
  resource_order: string[];
}

/** What `on_review` receives when a station reviews what to order from its suppliers. */
export interface ReviewSnapshot {
  /** Number of this review within the run, starting at 1. */
  review: number;
  /** The station being reviewed. */
  here: StationSnapshot;
  /** Game time in milliseconds since the run started. */
  now: number;
  /** How much of other stations this scenario lets the policy see. */
  information_level: "local" | "line";
  /** Every station, keyed by id. Every station a context refers to is one of these tables. */
  stations: Record<string, StationSnapshot>;
  /** Station ids in scenario order. */
  station_order: string[];
  /** Every resource, keyed by id. */
  resources: Record<string, ResourceSnapshot>;
  /** Resource ids in scenario order. */
  resource_order: string[];
}

/** A place that holds stock. Stock, backorders and orders of stations other than `ctx.here` are readable only at the `line` level. */
export interface StationSnapshot {
  /** Station id, as written in the scenario. */
  id: string;
  /** Position in the scenario's station order, starting at 1. */
  index: number;
  /** Ids of the resources this station stores, in scenario order. */
  resources: string[];
  /** Stations joined to this one by an arc. */
  neighbours: NeighbourSnapshot[];
  /** Milli-units stored, by resource id. */
  stock?: Quantities;
  /** Storage limit in milli-units, by resource id. */
  capacity?: Quantities;
  /** Demand waiting to be served, in milli-units, by resource id. */
  backorders?: Quantities;
  /** Where each resource can be ordered from. */
  suppliers: SupplierSnapshot[];
  /** Orders placed by this station that have not arrived, oldest first. */
  on_order?: OrderSnapshot[];
}

/** A station joined to another by an arc. */
export interface NeighbourSnapshot {
  /** The neighbouring station. */
  station: StationSnapshot;
  /** Length of the arc between them. */
  distance: number;
}

/** A vehicle stopped at a station. */
export interface VehicleSnapshot {
  /** Vehicle id, as written in the scenario. */
  id: string;
  /** Direction the vehicle will leave in along its route's stops. Shuttles reverse at either end; loops always go forward. */
  direction: "forward" | "backward";
  /** Distance travelled per second. */
  speed: number;
  /** How much the vehicle can carry. */
  capacity: VehicleCapacitySnapshot;
  /** Milli-units carried, by resource id. Every scenario resource is present. */
  cargo: Quantities;
  /** Milli-units more the vehicle could load, by resource id. */
  space: Quantities;
  /** The vehicle's route and the stops ahead of it. */
  route: RouteSnapshot;
}

/** Either one capacity shared by all resources, or a capacity per resource. */
export interface VehicleCapacitySnapshot {
  /** Total milli-units across all resources, when capacity is shared. */
  shared?: number;
  /** Milli-units per resource id, when capacity is per resource. */
  per_resource?: Quantities;
}

/** A vehicle as described at the start of a run. */
export interface VehicleInfoSnapshot {
  /** Vehicle id, as written in the scenario. */
  id: string;
  /** Distance travelled per second. */
  speed: number;
  /** How much the vehicle can carry. */
  capacity: VehicleCapacitySnapshot;
  /** The kind of route the vehicle follows. */
  route_kind: "shuttle" | "loop" | "timetable";
  /** Ids of the stations on its route, in order. */
  stops: string[];
}

/** The fixed route a stopped vehicle follows. */
export interface RouteSnapshot {
  /** `shuttle` runs back and forth, `loop` goes round, and `timetable` runs trips from its first stop at listed times. */
  kind: "shuttle" | "loop" | "timetable";
  /** The next stops in visiting order, up to returning to this stop, or to the end of a timetable trip. */
  ahead: RouteStopSnapshot[];
}

/** A stop ahead on a vehicle's route. */
export interface RouteStopSnapshot {
  /** The station at that stop. */
  station: StationSnapshot;
  /** Distance along the route from `ctx.here`. */
  distance: number;
  /** Milliseconds of travel from `ctx.here`, not counting stops on the way. */
  travel_time: number;
}

/** An order on its way to the station that placed it. */
export interface OrderSnapshot {
  /** Resource id. */
  resource: string;
  /** Milli-units still to arrive. */
  amount: number;
  /** `external`, or the id of the supplying station. */
  from: string;
  /** Game time the order was placed. */
  placed_at: number;
  /** Game time the order arrives; `nil` while it waits for stock at a supplying station. */
  arrives_at?: number;
}

/** A supplier for one resource. */
export interface SupplierSnapshot {
  /** Resource id. */
  resource: string;
  /** `external`, or the id of the supplying station. */
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
