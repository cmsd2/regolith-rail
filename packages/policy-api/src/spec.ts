/**
 * The Policy API, described once. Everything a policy can read or call is
 * listed here; the engine's snapshot types, the Lua editor annotations, editor
 * completion and hover data, and the reference documentation are generated
 * from this description.
 */

export const POLICY_API_VERSION = 1;

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

/** The types the engine builds, as their generated TypeScript names. */
export const snapshotTypes = apiTypes.filter((t) => t.ts !== undefined);
