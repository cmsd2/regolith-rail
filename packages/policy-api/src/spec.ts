/**
 * The Policy API, described once. Everything a policy can read or call is
 * listed here; the engine's snapshot types, the Lua editor annotations, editor
 * completion and hover data, and the reference documentation are generated
 * from this description.
 */

export const POLICY_API_VERSION = 2;

export type Level = "local" | "line";

export interface Field {
  name: string;
  /** Type as written in Lua annotations. */
  lua: string;
  /** Type as written in TypeScript; required for fields built by the engine. */
  ts?: string;
  optional?: boolean;
  /** Lowest information level at which the field can be read. */
  level: Level;
  /** `snapshot` fields are built by the engine; `runtime` members are added by the Lua runtime. */
  source: "snapshot" | "runtime";
  summary: string;
  params?: { name: string; lua: string; summary: string }[];
  returns?: { lua: string; summary: string };
}

export interface ApiType {
  /** Name in Lua annotations and documentation. */
  name: string;
  /** Name of the generated TypeScript interface, when the engine builds this type. */
  ts?: string;
  summary: string;
  /** Documentation page, relative to the documentation root. */
  docs: string;
  fields: Field[];
}

const quantities = "table<string, integer>";

export const apiTypes: ApiType[] = [
  {
    name: "StopContext",
    ts: "StopSnapshot",
    summary: "Everything `on_stop` receives about the stop, the train, the station and the line.",
    docs: "api/context",
    fields: [
      {
        name: "stop",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Number of this stop within the run, starting at 1.",
      },
      {
        name: "now",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Game time in milliseconds since the run started.",
      },
      {
        name: "information_level",
        lua: '"local"|"line"',
        ts: '"local" | "line"',
        level: "local",
        source: "snapshot",
        summary: "How much of the line this scenario lets the policy see.",
      },
      {
        name: "train",
        lua: "Train",
        ts: "TrainSnapshot",
        level: "local",
        source: "snapshot",
        summary: "The train that has stopped.",
      },
      {
        name: "station",
        lua: "Station",
        ts: "CurrentStationSnapshot",
        level: "local",
        source: "snapshot",
        summary:
          "The station the train has stopped at. Its stock and capacity are always readable.",
      },
      {
        name: "line",
        lua: "Line",
        ts: "LineSnapshot",
        level: "local",
        source: "snapshot",
        summary: "The stations on the line, in order.",
      },
      {
        name: "route",
        lua: "Route",
        ts: "RouteSnapshot",
        level: "local",
        source: "snapshot",
        summary: "The stopped vehicle's route and the stops ahead of it.",
      },
      {
        name: "network",
        lua: "Network",
        ts: "NetworkSnapshot",
        optional: true,
        level: "line",
        source: "snapshot",
        summary:
          "The arcs joining stock points. Readable only at the `line` level; stock points are in `line.stations`.",
      },
      {
        name: "resources",
        lua: "Resource[]",
        ts: "ResourceSnapshot[]",
        level: "local",
        source: "snapshot",
        summary: "Every resource in the scenario, in scenario order.",
      },
      {
        name: "memory",
        lua: "table",
        level: "local",
        source: "runtime",
        summary:
          "Table kept between calls for the whole run. It may hold only booleans, numbers, strings and tables of those, without cycles.",
      },
      {
        name: "rand",
        lua: "fun(): number",
        level: "local",
        source: "runtime",
        summary: "A number from 0 up to but not including 1, repeatable for the same seed.",
        returns: { lua: "number", summary: "A number in [0, 1)." },
      },
      {
        name: "load",
        lua: "fun(resource: string, amount: integer)",
        level: "local",
        source: "runtime",
        summary:
          "Move `amount` milli-units of `resource` from the station onto the train. Clamped to what the station holds and the train can carry.",
        params: [
          { name: "resource", lua: "string", summary: "Resource id, such as `Metals`." },
          { name: "amount", lua: "integer", summary: "Milli-units to load; 1 unit is 1000." },
        ],
      },
      {
        name: "unload",
        lua: "fun(resource: string, amount: integer)",
        level: "local",
        source: "runtime",
        summary:
          "Move `amount` milli-units of `resource` from the train into the station. Clamped to what the train carries and the station can store.",
        params: [
          { name: "resource", lua: "string", summary: "Resource id, such as `Metals`." },
          { name: "amount", lua: "integer", summary: "Milli-units to unload; 1 unit is 1000." },
        ],
      },
      {
        name: "log",
        lua: "fun(...: any)",
        level: "local",
        source: "runtime",
        summary:
          "Attach a message to this stop. Arguments are converted to text and joined with spaces.",
        params: [{ name: "...", lua: "any", summary: "Values to write." }],
      },
      {
        name: "record",
        lua: "fun(name: string, value: number)",
        level: "local",
        source: "runtime",
        summary: "Add a point to a named series that is charted after the run.",
        params: [
          { name: "name", lua: "string", summary: "Series name." },
          { name: "value", lua: "number", summary: "Finite number to record." },
        ],
      },
    ],
  },
  {
    name: "StartContext",
    ts: "StartSnapshot",
    summary: "What `on_start` receives once at the start of each run.",
    docs: "api/context",
    fields: [
      {
        name: "now",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Game time in milliseconds; always 0 at the start of a run.",
      },
      {
        name: "information_level",
        lua: '"local"|"line"',
        ts: '"local" | "line"',
        level: "local",
        source: "snapshot",
        summary: "How much of the line this scenario lets the policy see.",
      },
      {
        name: "line",
        lua: "Line",
        ts: "LineSnapshot",
        level: "local",
        source: "snapshot",
        summary: "The stations on the line, without stock.",
      },
      {
        name: "resources",
        lua: "Resource[]",
        ts: "ResourceSnapshot[]",
        level: "local",
        source: "snapshot",
        summary: "Every resource in the scenario.",
      },
      {
        name: "trains",
        lua: "TrainInfo[]",
        ts: "TrainInfoSnapshot[]",
        level: "local",
        source: "snapshot",
        summary: "Every train on the line.",
      },
      {
        name: "memory",
        lua: "table",
        level: "local",
        source: "runtime",
        summary: "The same persistent table `on_stop` receives.",
      },
      {
        name: "rand",
        lua: "fun(): number",
        level: "local",
        source: "runtime",
        summary: "A number from 0 up to but not including 1, repeatable for the same seed.",
        returns: { lua: "number", summary: "A number in [0, 1)." },
      },
      {
        name: "log",
        lua: "fun(...: any)",
        level: "local",
        source: "runtime",
        summary: "Write a message at the start of the run.",
        params: [{ name: "...", lua: "any", summary: "Values to write." }],
      },
      {
        name: "record",
        lua: "fun(name: string, value: number)",
        level: "local",
        source: "runtime",
        summary: "Add a point to a named series at time 0.",
        params: [
          { name: "name", lua: "string", summary: "Series name." },
          { name: "value", lua: "number", summary: "Finite number to record." },
        ],
      },
    ],
  },
  {
    name: "Train",
    ts: "TrainSnapshot",
    summary: "A train stopped at a station.",
    docs: "api/train",
    fields: [
      {
        name: "id",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "Train id, as written in the scenario.",
      },
      {
        name: "direction",
        lua: '"forward"|"backward"',
        ts: '"forward" | "backward"',
        level: "local",
        source: "snapshot",
        summary:
          "Direction the train will leave in. `forward` runs towards the last station; trains reverse at either end.",
      },
      {
        name: "speed",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Distance travelled per second.",
      },
      {
        name: "capacity",
        lua: "TrainCapacity",
        ts: "TrainCapacitySnapshot",
        level: "local",
        source: "snapshot",
        summary: "How much the train can carry.",
      },
      {
        name: "cargo",
        lua: quantities,
        ts: "Quantities",
        level: "local",
        source: "snapshot",
        summary: "Milli-units carried, by resource id. Every scenario resource is present.",
      },
      {
        name: "space",
        lua: quantities,
        ts: "Quantities",
        level: "local",
        source: "snapshot",
        summary: "Milli-units more the train could load, by resource id.",
      },
      {
        name: "memory",
        lua: "table",
        level: "local",
        source: "runtime",
        summary: "Persistent table for this train, under the same rules as `ctx.memory`.",
      },
    ],
  },
  {
    name: "TrainCapacity",
    ts: "TrainCapacitySnapshot",
    summary: "Either one capacity shared by all resources, or a capacity per resource.",
    docs: "api/train",
    fields: [
      {
        name: "shared",
        lua: "integer",
        ts: "number",
        optional: true,
        level: "local",
        source: "snapshot",
        summary: "Total milli-units across all resources, when capacity is shared.",
      },
      {
        name: "per_resource",
        lua: quantities,
        ts: "Quantities",
        optional: true,
        level: "local",
        source: "snapshot",
        summary: "Milli-units per resource id, when capacity is per resource.",
      },
    ],
  },
  {
    name: "TrainInfo",
    ts: "TrainInfoSnapshot",
    summary: "A train as described at the start of a run.",
    docs: "api/train",
    fields: [
      {
        name: "id",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "Train id, as written in the scenario.",
      },
      {
        name: "speed",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Distance travelled per second.",
      },
      {
        name: "capacity",
        lua: "TrainCapacity",
        ts: "TrainCapacitySnapshot",
        level: "local",
        source: "snapshot",
        summary: "How much the train can carry.",
      },
    ],
  },
  {
    name: "Station",
    ts: "StationSnapshot",
    summary: "A station on the line.",
    docs: "api/station",
    fields: [
      {
        name: "id",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "Station id, as written in the scenario.",
      },
      {
        name: "index",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Position on the line, starting at 1.",
      },
      {
        name: "resources",
        lua: "string[]",
        ts: "string[]",
        level: "local",
        source: "snapshot",
        summary: "Ids of the resources this station stores, in scenario order.",
      },
      {
        name: "distance_to_next",
        lua: "integer",
        ts: "number",
        optional: true,
        level: "local",
        source: "snapshot",
        summary: "Distance to the next station; `nil` on the last station.",
      },
      {
        name: "stock",
        lua: quantities,
        ts: "Quantities",
        optional: true,
        level: "line",
        source: "snapshot",
        summary:
          "Milli-units stored, by resource id. Readable for other stations only at the `line` level.",
      },
      {
        name: "capacity",
        lua: quantities,
        ts: "Quantities",
        optional: true,
        level: "line",
        source: "snapshot",
        summary:
          "Storage limit in milli-units, by resource id. Readable for other stations only at the `line` level.",
      },
      {
        name: "backorders",
        lua: quantities,
        ts: "Quantities",
        optional: true,
        level: "line",
        source: "snapshot",
        summary:
          "Demand waiting to be served, in milli-units, by resource id. Readable for other stations only at the `line` level.",
      },
      {
        name: "memory",
        lua: "table",
        optional: true,
        level: "local",
        source: "runtime",
        summary:
          "Persistent table for this station, under the same rules as `ctx.memory`. Present on `ctx.station`.",
      },
    ],
  },
  {
    name: "Line",
    ts: "LineSnapshot",
    summary: "The line the train runs on.",
    docs: "api/line",
    fields: [
      {
        name: "stations",
        lua: "Station[]",
        ts: "StationSnapshot[]",
        level: "local",
        source: "snapshot",
        summary: "Stations in line order.",
      },
      {
        name: "distance",
        lua: "fun(from: string, to: string): integer",
        level: "local",
        source: "runtime",
        summary: "Distance along the line between two stations.",
        params: [
          { name: "from", lua: "string", summary: "Station id, as written in the scenario." },
          { name: "to", lua: "string", summary: "Station id, as written in the scenario." },
        ],
        returns: { lua: "integer", summary: "Distance, never negative." },
      },
      {
        name: "travel_time",
        lua: "fun(from: string, to: string, speed?: integer): integer",
        level: "local",
        source: "runtime",
        summary:
          "Milliseconds a train takes between two stations, not counting stops. Uses the stopped train's speed when `speed` is omitted.",
        params: [
          { name: "from", lua: "string", summary: "Station id, as written in the scenario." },
          { name: "to", lua: "string", summary: "Station id, as written in the scenario." },
          { name: "speed", lua: "integer?", summary: "Distance per second." },
        ],
        returns: { lua: "integer", summary: "Travel time in milliseconds." },
      },
    ],
  },
  {
    name: "Route",
    ts: "RouteSnapshot",
    summary: "The fixed route a vehicle follows.",
    docs: "api/train",
    fields: [
      {
        name: "kind",
        lua: '"shuttle"|"loop"|"timetable"',
        ts: '"shuttle" | "loop" | "timetable"',
        level: "local",
        source: "snapshot",
        summary:
          "`shuttle` runs back and forth, `loop` goes round, and `timetable` runs trips from its first stop at listed times.",
      },
      {
        name: "ahead",
        lua: "RouteStop[]",
        ts: "RouteStopSnapshot[]",
        level: "local",
        source: "snapshot",
        summary:
          "The next stops in visiting order, up to returning to this stop, or to the end of a timetable trip.",
      },
    ],
  },
  {
    name: "RouteStop",
    ts: "RouteStopSnapshot",
    summary: "A stop ahead on a vehicle's route.",
    docs: "api/train",
    fields: [
      {
        name: "id",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "Stock point id.",
      },
      {
        name: "distance",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Distance along the route from this stop.",
      },
      {
        name: "travel_time",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Milliseconds of travel from this stop, not counting stops on the way.",
      },
    ],
  },
  {
    name: "Network",
    ts: "NetworkSnapshot",
    summary: "How stock points are joined.",
    docs: "api/line",
    fields: [
      {
        name: "arcs",
        lua: "Arc[]",
        ts: "ArcSnapshot[]",
        level: "line",
        source: "snapshot",
        summary: "Every arc, in scenario order.",
      },
    ],
  },
  {
    name: "Arc",
    ts: "ArcSnapshot",
    summary: "A connection between two stock points, usable in both directions.",
    docs: "api/line",
    fields: [
      {
        name: "from",
        lua: "string",
        ts: "string",
        level: "line",
        source: "snapshot",
        summary: "Stock point id at one end.",
      },
      {
        name: "to",
        lua: "string",
        ts: "string",
        level: "line",
        source: "snapshot",
        summary: "Stock point id at the other end.",
      },
      {
        name: "distance",
        lua: "integer",
        ts: "number",
        level: "line",
        source: "snapshot",
        summary: "Distance between the two stock points.",
      },
    ],
  },
  {
    name: "ReviewContext",
    ts: "ReviewSnapshot",
    summary:
      "Everything `on_review` receives when a stock point reviews what to order from its suppliers.",
    docs: "api/review",
    fields: [
      {
        name: "review",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Number of this review within the run, starting at 1.",
      },
      {
        name: "now",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Game time in milliseconds since the run started.",
      },
      {
        name: "information_level",
        lua: '"local"|"line"',
        ts: '"local" | "line"',
        level: "local",
        source: "snapshot",
        summary: "How much of the scenario this policy may see.",
      },
      {
        name: "stock_point",
        lua: "StockPoint",
        ts: "StockPointSnapshot",
        level: "local",
        source: "snapshot",
        summary: "The stock point being reviewed, with its stock, orders and suppliers.",
      },
      {
        name: "line",
        lua: "Line",
        ts: "LineSnapshot",
        level: "local",
        source: "snapshot",
        summary:
          "Every stock point in the scenario, in order. Their stock is readable only at the `line` level.",
      },
      {
        name: "resources",
        lua: "Resource[]",
        ts: "ResourceSnapshot[]",
        level: "local",
        source: "snapshot",
        summary: "Every resource in the scenario, in scenario order.",
      },
      {
        name: "memory",
        lua: "table",
        level: "local",
        source: "runtime",
        summary: "The same persistent table `on_start` and `on_stop` receive.",
      },
      {
        name: "rand",
        lua: "fun(): number",
        level: "local",
        source: "runtime",
        summary: "A number from 0 up to but not including 1, repeatable for the same seed.",
        returns: { lua: "number", summary: "A number in [0, 1)." },
      },
      {
        name: "order",
        lua: "fun(resource: string, amount: integer)",
        level: "local",
        source: "runtime",
        summary:
          "Order `amount` milli-units of `resource` from the stock point's supplier for it. Clamped to the supplier's minimum and maximum order.",
        params: [
          { name: "resource", lua: "string", summary: "Resource id, such as `Beer`." },
          { name: "amount", lua: "integer", summary: "Milli-units to order; 1 unit is 1000." },
        ],
      },
      {
        name: "log",
        lua: "fun(...: any)",
        level: "local",
        source: "runtime",
        summary:
          "Attach a message to this review. Arguments are converted to text and joined with spaces.",
        params: [{ name: "...", lua: "any", summary: "Values to write." }],
      },
      {
        name: "record",
        lua: "fun(name: string, value: number)",
        level: "local",
        source: "runtime",
        summary: "Add a point to a named series that is charted after the run.",
        params: [
          { name: "name", lua: "string", summary: "Series name." },
          { name: "value", lua: "number", summary: "Finite number to record." },
        ],
      },
    ],
  },
  {
    name: "StockPoint",
    ts: "StockPointSnapshot",
    summary: "A stock point under review.",
    docs: "api/review",
    fields: [
      {
        name: "id",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "Stock point id, as written in the scenario.",
      },
      {
        name: "index",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Position in the scenario's list of stock points, starting at 1.",
      },
      {
        name: "resources",
        lua: "string[]",
        ts: "string[]",
        level: "local",
        source: "snapshot",
        summary: "Ids of the resources this stock point stores, in scenario order.",
      },
      {
        name: "stock",
        lua: quantities,
        ts: "Quantities",
        level: "local",
        source: "snapshot",
        summary: "Milli-units stored, by resource id, after any expiring stock was removed.",
      },
      {
        name: "capacity",
        lua: quantities,
        ts: "Quantities",
        level: "local",
        source: "snapshot",
        summary: "Storage limit in milli-units, by resource id.",
      },
      {
        name: "backorders",
        lua: quantities,
        ts: "Quantities",
        level: "local",
        source: "snapshot",
        summary: "Demand waiting to be served here, in milli-units, by resource id.",
      },
      {
        name: "on_order",
        lua: "Order[]",
        ts: "OrderSnapshot[]",
        level: "local",
        source: "snapshot",
        summary: "Orders placed by this stock point that have not arrived, oldest first.",
      },
      {
        name: "suppliers",
        lua: "Supplier[]",
        ts: "SupplierSnapshot[]",
        level: "local",
        source: "snapshot",
        summary: "Where each resource can be ordered from.",
      },
      {
        name: "memory",
        lua: "table",
        level: "local",
        source: "runtime",
        summary:
          "Persistent table for this stock point; the same table as `ctx.station.memory` at its stops.",
      },
    ],
  },
  {
    name: "Order",
    ts: "OrderSnapshot",
    summary: "An order on its way to the stock point that placed it.",
    docs: "api/review",
    fields: [
      {
        name: "resource",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "Resource id.",
      },
      {
        name: "amount",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Milli-units still to arrive.",
      },
      {
        name: "from",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "`external`, or the id of the supplying stock point.",
      },
      {
        name: "placed_at",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Game time the order was placed.",
      },
      {
        name: "arrives_at",
        lua: "integer",
        ts: "number",
        optional: true,
        level: "local",
        source: "snapshot",
        summary:
          "Game time the order arrives; `nil` while it waits for stock at a supplying stock point.",
      },
    ],
  },
  {
    name: "Supplier",
    ts: "SupplierSnapshot",
    summary: "A supplier for one resource.",
    docs: "api/review",
    fields: [
      {
        name: "resource",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "Resource id.",
      },
      {
        name: "from",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "`external`, or the id of the supplying stock point.",
      },
      {
        name: "lead_times",
        lua: "LeadTime[]",
        ts: "LeadTimeSnapshot[]",
        level: "local",
        source: "snapshot",
        summary: "Possible lead times in milliseconds, with their weights.",
      },
      {
        name: "min_order",
        lua: "integer",
        ts: "number",
        optional: true,
        level: "local",
        source: "snapshot",
        summary: "Smallest order in milli-units, when there is one.",
      },
      {
        name: "max_order",
        lua: "integer",
        ts: "number",
        optional: true,
        level: "local",
        source: "snapshot",
        summary: "Largest order in milli-units, when there is one.",
      },
    ],
  },
  {
    name: "LeadTime",
    ts: "LeadTimeSnapshot",
    summary: "One possible lead time and how likely it is.",
    docs: "api/review",
    fields: [
      {
        name: "value",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Lead time in milliseconds.",
      },
      {
        name: "weight",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Relative weight; a fixed lead time has one value with weight 1.",
      },
    ],
  },
  {
    name: "Resource",
    ts: "ResourceSnapshot",
    summary: "A resource and how important it is.",
    docs: "api/context",
    fields: [
      {
        name: "id",
        lua: "string",
        ts: "string",
        level: "local",
        source: "snapshot",
        summary: "Resource id, such as `Metals`.",
      },
      {
        name: "priority",
        lua: "integer",
        ts: "number",
        level: "local",
        source: "snapshot",
        summary: "Weight used when scoring unmet demand; higher is more important.",
      },
    ],
  },
];

/** Anchor of a type on its documentation page. */
export const typeAnchor = (type: Pick<ApiType, "name">) => type.name.toLowerCase();

/** Anchor of a field on its type's documentation page; unique when types share a page. */
export const fieldAnchor = (type: Pick<ApiType, "name">, field: Pick<Field, "name">) =>
  `${typeAnchor(type)}-${field.name.replace(/_/g, "-")}`;

/** The types the engine builds, as their generated TypeScript names. */
export const snapshotTypes = apiTypes.filter((t) => t.ts !== undefined);
