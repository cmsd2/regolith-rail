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

const snapshot = (
  name: string,
  lua: string,
  ts: string,
  summary: string,
  extra: Partial<Field> = {},
): Field => ({ name, lua, ts, level: "local", source: "snapshot", summary, ...extra });

const runtime = (
  name: string,
  lua: string,
  summary: string,
  extra: Partial<Field> = {},
): Field => ({
  name,
  lua,
  level: "local",
  source: "runtime",
  summary,
  ...extra,
});

/** Members every hook's context has, before its own. */
function sharedFields(when: string): Field[] {
  return [
    snapshot("now", "integer", "number", `Game time in milliseconds ${when}.`),
    snapshot(
      "information_level",
      '"local"|"line"',
      '"local" | "line"',
      "How much of other stations this scenario lets the policy see.",
    ),
    snapshot(
      "stations",
      "table<string, Station>",
      "Record<string, StationSnapshot>",
      "Every station, keyed by id. Every station a context refers to is one of these tables.",
    ),
    snapshot("station_order", "string[]", "string[]", "Station ids in scenario order."),
    snapshot(
      "resources",
      "table<string, Resource>",
      "Record<string, ResourceSnapshot>",
      "Every resource, keyed by id.",
    ),
    snapshot("resource_order", "string[]", "string[]", "Resource ids in scenario order."),
    runtime(
      "memory",
      "table",
      "Table kept between calls for the whole run. It may hold only booleans, numbers, strings and tables of those, without cycles.",
    ),
    runtime(
      "rand",
      "fun(): number",
      "A number from 0 up to but not including 1, repeatable for the same seed.",
      { returns: { lua: "number", summary: "A number in [0, 1)." } },
    ),
    runtime(
      "distance",
      "fun(from: string, to: string): integer",
      "Distance between two stations along the shortest path over arcs.",
      {
        params: [
          { name: "from", lua: "string", summary: "Station id." },
          { name: "to", lua: "string", summary: "Station id." },
        ],
        returns: { lua: "integer", summary: "Distance; `nil` when no path joins them." },
      },
    ),
    runtime(
      "travel_time",
      "fun(from: string, to: string, speed?: integer): integer",
      "Milliseconds of travel between two stations along the shortest path over arcs, not counting stops. Uses the stopped vehicle's speed when `speed` is omitted.",
      {
        params: [
          { name: "from", lua: "string", summary: "Station id." },
          { name: "to", lua: "string", summary: "Station id." },
          { name: "speed", lua: "integer?", summary: "Distance per second." },
        ],
        returns: { lua: "integer", summary: "Travel time in milliseconds." },
      },
    ),
    runtime(
      "log",
      "fun(...: any)",
      "Write a message. Arguments are converted to text and joined with spaces.",
      { params: [{ name: "...", lua: "any", summary: "Values to write." }] },
    ),
    runtime(
      "record",
      "fun(name: string, value: number)",
      "Add a point to a named series that is charted after the run.",
      {
        params: [
          { name: "name", lua: "string", summary: "Series name." },
          { name: "value", lua: "number", summary: "Finite number to record." },
        ],
      },
    ),
  ];
}

const transfer = (verb: "load" | "unload", summary: string): Field =>
  runtime(verb, "fun(resource: string, amount: integer)", summary, {
    params: [
      { name: "resource", lua: "string", summary: "Resource id, such as `Metals`." },
      { name: "amount", lua: "integer", summary: `Milli-units to ${verb}; 1 unit is 1000.` },
    ],
  });

const capacityField = snapshot(
  "capacity",
  "VehicleCapacity",
  "VehicleCapacitySnapshot",
  "How much the vehicle can carry.",
);

export const apiTypes: ApiType[] = [
  {
    name: "StartContext",
    ts: "StartSnapshot",
    summary: "What `on_start` receives once at the start of each run.",
    docs: "api/context",
    fields: [
      ...sharedFields("since the run started; always 0 at the start"),
      snapshot(
        "vehicles",
        "table<string, VehicleInfo>",
        "Record<string, VehicleInfoSnapshot>",
        "Every vehicle, keyed by id.",
      ),
    ],
  },
  {
    name: "StopContext",
    ts: "StopSnapshot",
    summary: "What `on_stop` receives when a vehicle stops at a station.",
    docs: "api/context",
    fields: [
      snapshot("stop", "integer", "number", "Number of this stop within the run, starting at 1."),
      snapshot("here", "Station", "StationSnapshot", "The station the vehicle has stopped at."),
      snapshot("vehicle", "Vehicle", "VehicleSnapshot", "The vehicle that has stopped."),
      ...sharedFields("since the run started"),
      transfer(
        "load",
        "Move `amount` milli-units of `resource` from `ctx.here` onto the vehicle. Clamped to what the station holds and the vehicle can carry.",
      ),
      transfer(
        "unload",
        "Move `amount` milli-units of `resource` from the vehicle into `ctx.here`. Clamped to what the vehicle carries and the station can store.",
      ),
    ],
  },
  {
    name: "ReviewContext",
    ts: "ReviewSnapshot",
    summary: "What `on_review` receives when a station reviews what to order from its suppliers.",
    docs: "api/review",
    fields: [
      snapshot(
        "review",
        "integer",
        "number",
        "Number of this review within the run, starting at 1.",
      ),
      snapshot("here", "Station", "StationSnapshot", "The station being reviewed."),
      ...sharedFields("since the run started"),
      runtime(
        "order",
        "fun(resource: string, amount: integer)",
        "Order `amount` milli-units of `resource` from `ctx.here`'s supplier for it. Clamped to the supplier's minimum and maximum order.",
        {
          params: [
            { name: "resource", lua: "string", summary: "Resource id, such as `Beer`." },
            { name: "amount", lua: "integer", summary: "Milli-units to order; 1 unit is 1000." },
          ],
        },
      ),
    ],
  },
  {
    name: "Station",
    ts: "StationSnapshot",
    summary:
      "A place that holds stock. Stock, backorders and orders of stations other than `ctx.here` are readable only at the `line` level.",
    docs: "api/station",
    fields: [
      snapshot("id", "string", "string", "Station id, as written in the scenario."),
      snapshot(
        "index",
        "integer",
        "number",
        "Position in the scenario's station order, starting at 1.",
      ),
      snapshot(
        "resources",
        "string[]",
        "string[]",
        "Ids of the resources this station stores, in scenario order.",
      ),
      snapshot(
        "neighbours",
        "Neighbour[]",
        "NeighbourSnapshot[]",
        "Stations joined to this one by an arc.",
      ),
      snapshot("stock", quantities, "Quantities", "Milli-units stored, by resource id.", {
        optional: true,
        level: "line",
      }),
      snapshot(
        "capacity",
        quantities,
        "Quantities",
        "Storage limit in milli-units, by resource id.",
        {
          optional: true,
          level: "line",
        },
      ),
      snapshot(
        "backorders",
        quantities,
        "Quantities",
        "Demand waiting to be served, in milli-units, by resource id.",
        {
          optional: true,
          level: "line",
        },
      ),
      snapshot(
        "suppliers",
        "Supplier[]",
        "SupplierSnapshot[]",
        "Where each resource can be ordered from.",
      ),
      snapshot(
        "on_order",
        "Order[]",
        "OrderSnapshot[]",
        "Orders placed by this station that have not arrived, oldest first.",
        { optional: true, level: "line" },
      ),
      runtime(
        "memory",
        "table",
        "Persistent table for this station, under the same rules as `ctx.memory`.",
      ),
    ],
  },
  {
    name: "Neighbour",
    ts: "NeighbourSnapshot",
    summary: "A station joined to another by an arc.",
    docs: "api/station",
    fields: [
      snapshot("station", "Station", "StationSnapshot", "The neighbouring station."),
      snapshot("distance", "integer", "number", "Length of the arc between them."),
    ],
  },
  {
    name: "Vehicle",
    ts: "VehicleSnapshot",
    summary: "A vehicle stopped at a station.",
    docs: "api/vehicle",
    fields: [
      snapshot("id", "string", "string", "Vehicle id, as written in the scenario."),
      snapshot(
        "direction",
        '"forward"|"backward"',
        '"forward" | "backward"',
        "Direction the vehicle will leave in along its route's stops. Shuttles reverse at either end; loops always go forward.",
      ),
      snapshot("speed", "integer", "number", "Distance travelled per second."),
      capacityField,
      snapshot(
        "cargo",
        quantities,
        "Quantities",
        "Milli-units carried, by resource id. Every scenario resource is present.",
      ),
      snapshot(
        "space",
        quantities,
        "Quantities",
        "Milli-units more the vehicle could load, by resource id.",
      ),
      snapshot("route", "Route", "RouteSnapshot", "The vehicle's route and the stops ahead of it."),
      runtime(
        "memory",
        "table",
        "Persistent table for this vehicle, under the same rules as `ctx.memory`.",
      ),
    ],
  },
  {
    name: "VehicleCapacity",
    ts: "VehicleCapacitySnapshot",
    summary: "Either one capacity shared by all resources, or a capacity per resource.",
    docs: "api/vehicle",
    fields: [
      snapshot(
        "shared",
        "integer",
        "number",
        "Total milli-units across all resources, when capacity is shared.",
        {
          optional: true,
        },
      ),
      snapshot(
        "per_resource",
        quantities,
        "Quantities",
        "Milli-units per resource id, when capacity is per resource.",
        {
          optional: true,
        },
      ),
    ],
  },
  {
    name: "VehicleInfo",
    ts: "VehicleInfoSnapshot",
    summary: "A vehicle as described at the start of a run.",
    docs: "api/vehicle",
    fields: [
      snapshot("id", "string", "string", "Vehicle id, as written in the scenario."),
      snapshot("speed", "integer", "number", "Distance travelled per second."),
      capacityField,
      snapshot(
        "route_kind",
        '"shuttle"|"loop"|"timetable"',
        '"shuttle" | "loop" | "timetable"',
        "The kind of route the vehicle follows.",
      ),
      snapshot("stops", "string[]", "string[]", "Ids of the stations on its route, in order."),
    ],
  },
  {
    name: "Route",
    ts: "RouteSnapshot",
    summary: "The fixed route a stopped vehicle follows.",
    docs: "api/vehicle",
    fields: [
      snapshot(
        "kind",
        '"shuttle"|"loop"|"timetable"',
        '"shuttle" | "loop" | "timetable"',
        "`shuttle` runs back and forth, `loop` goes round, and `timetable` runs trips from its first stop at listed times.",
      ),
      snapshot(
        "ahead",
        "RouteStop[]",
        "RouteStopSnapshot[]",
        "The next stops in visiting order, up to returning to this stop, or to the end of a timetable trip.",
      ),
    ],
  },
  {
    name: "RouteStop",
    ts: "RouteStopSnapshot",
    summary: "A stop ahead on a vehicle's route.",
    docs: "api/vehicle",
    fields: [
      snapshot("station", "Station", "StationSnapshot", "The station at that stop."),
      snapshot("distance", "integer", "number", "Distance along the route from `ctx.here`."),
      snapshot(
        "travel_time",
        "integer",
        "number",
        "Milliseconds of travel from `ctx.here`, not counting stops on the way.",
      ),
    ],
  },
  {
    name: "Order",
    ts: "OrderSnapshot",
    summary: "An order on its way to the station that placed it.",
    docs: "api/review",
    fields: [
      snapshot("resource", "string", "string", "Resource id."),
      snapshot("amount", "integer", "number", "Milli-units still to arrive."),
      snapshot("from", "string", "string", "`external`, or the id of the supplying station."),
      snapshot("placed_at", "integer", "number", "Game time the order was placed."),
      snapshot(
        "arrives_at",
        "integer",
        "number",
        "Game time the order arrives; `nil` while it waits for stock at a supplying station.",
        { optional: true },
      ),
    ],
  },
  {
    name: "Supplier",
    ts: "SupplierSnapshot",
    summary: "A supplier for one resource.",
    docs: "api/review",
    fields: [
      snapshot("resource", "string", "string", "Resource id."),
      snapshot("from", "string", "string", "`external`, or the id of the supplying station."),
      snapshot(
        "lead_times",
        "LeadTime[]",
        "LeadTimeSnapshot[]",
        "Possible lead times in milliseconds, with their weights.",
      ),
      snapshot(
        "min_order",
        "integer",
        "number",
        "Smallest order in milli-units, when there is one.",
        {
          optional: true,
        },
      ),
      snapshot(
        "max_order",
        "integer",
        "number",
        "Largest order in milli-units, when there is one.",
        {
          optional: true,
        },
      ),
    ],
  },
  {
    name: "LeadTime",
    ts: "LeadTimeSnapshot",
    summary: "One possible lead time and how likely it is.",
    docs: "api/review",
    fields: [
      snapshot("value", "integer", "number", "Lead time in milliseconds."),
      snapshot(
        "weight",
        "integer",
        "number",
        "Relative weight; a fixed lead time has one value with weight 1.",
      ),
    ],
  },
  {
    name: "Resource",
    ts: "ResourceSnapshot",
    summary: "A resource and how important it is.",
    docs: "api/context",
    fields: [
      snapshot("id", "string", "string", "Resource id, such as `Metals`."),
      snapshot(
        "priority",
        "integer",
        "number",
        "Weight used when scoring unmet demand; higher is more important.",
      ),
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
