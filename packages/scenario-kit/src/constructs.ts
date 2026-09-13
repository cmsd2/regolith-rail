/**
 * Every scenario construct and its parameters, described once. The description drives editor
 * completion and hover help, the construct reference documentation, and a test that the Lua
 * libraries define exactly these constructs and parameters.
 */

export type Library = "core" | "mars" | "classic";

export interface ConstructParam {
  name: string;
  /** Lua type as written in annotations, such as `integer` or `station[]`. */
  type: string;
  required: boolean;
  /** Default as a script would write it, when the parameter has one. */
  default?: string;
  /** Unit the value is given in, such as `units` or `units per sol`. */
  unit?: string;
  summary: string;
}

export interface Construct {
  /** Name as called in a script, such as `station`, `sols` or `mars.line`. */
  name: string;
  library: Library;
  /**
   * `construct` takes a table of named parameters; `helper` takes positional arguments;
   * `template` returns a whole scenario.
   */
  kind: "construct" | "helper" | "template";
  summary: string;
  /** What calling it returns. */
  returns: string;
  params: ConstructParam[];
  /** Documentation page, relative to the documentation root. */
  docs: string;
}

const param = (
  name: string,
  type: string,
  summary: string,
  extra: Partial<Omit<ConstructParam, "name" | "type" | "summary">> = {},
): ConstructParam => ({ name, type, summary, required: false, ...extra });

const required = (name: string, type: string, summary: string, unit?: string): ConstructParam =>
  param(name, type, summary, { required: true, ...(unit ? { unit } : {}) });

const CORE_DOCS = "scenarios/core";

const helper = (
  name: string,
  summary: string,
  returns: string,
  value: ConstructParam,
): Construct => ({
  name,
  library: "core",
  kind: "helper",
  summary,
  returns,
  params: [value],
  docs: CORE_DOCS,
});

const durationHelper = (name: string, length: string): Construct =>
  helper(
    name,
    `Milliseconds in a number of ${name}, where one ${name.replace(/s$/, "")} is ${length}. Rejects values that are not a whole number of milliseconds.`,
    "integer",
    required("value", "number", `Number of ${name}, such as 1.5.`),
  );

const flowParams = (verb: string): ConstructParam[] => [
  required("resource", "string", "Resource id."),
  param("rate", "number", `Amount ${verb} per sol, spread evenly over each minute.`, {
    unit: "units per sol",
  }),
  param("variability", "uniform|bursts", "How the rate varies over time. Fixed when omitted."),
  param("poisson", "poisson", `Arrivals at random times instead of a rate.`),
  param(
    "per_period",
    "per_period",
    "An amount drawn at the start of each period instead of a rate.",
  ),
  param("trace", "trace", "Recorded amounts per period instead of a rate."),
  param("profile", "profile", "Multipliers over the run, for ramps and seasons."),
];

export const coreConstructs: Construct[] = [
  {
    name: "scenario",
    library: "core",
    kind: "construct",
    summary:
      "A complete scenario document. Resources default to every resource a station stores, in the order stations first store them.",
    returns: "scenario document",
    params: [
      required("id", "string", "Scenario id: a letter, then letters, digits, _ or -."),
      param("title", "string", "Title shown to players.", { default: "the id" }),
      param("description", "string", "What the scenario shows.", { default: "the title" }),
      param(
        "docs",
        "string",
        "Documentation page explaining the scenario, such as failure-modes/relay.",
      ),
      required("duration", "integer", "Length of a run.", "ms"),
      param("seed", "integer", "Base seed for random processes.", { default: "1" }),
      param("information", '"local"|"line"', "How much of other stations policies can see.", {
        default: '"line"',
      }),
      param("sample_interval", "integer", "How often stock is sampled for charts.", {
        default: "hours(1)",
        unit: "ms",
      }),
      param(
        "resources",
        "(string|resource)[]|table<string, table>",
        "Resources as ids, resource constructs, or parameters keyed by id.",
      ),
      param("stations", "station[]", "Stations, in scenario order."),
      param("arcs", "arc[]", "Arcs joining stations."),
      param("vehicles", "vehicle[]", "Vehicles and their routes."),
      param("events", "event[]", "Events such as storms."),
      param(
        "parts",
        "table[]",
        "Tables with stations, arcs, vehicles or events lists, such as the result of line, appended in order.",
      ),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "resource",
    library: "core",
    kind: "construct",
    summary: "A resource and its priority.",
    returns: "resource",
    params: [
      required("id", "string", "Resource id, such as Metals."),
      param("priority", "integer", "Higher numbers matter more to priority allocation.", {
        default: "1",
      }),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "station",
    library: "core",
    kind: "construct",
    summary:
      "A place that stores resources, with what produces, consumes, converts and supplies them.",
    returns: "station",
    params: [
      required("id", "string", "Station id."),
      param(
        "resources",
        "(string|store)[]|table<string, table>",
        "Resources stored: ids with default storage, store constructs, or store parameters keyed by resource id.",
        { required: true },
      ),
      param("producers", "producer[]", "What adds stock."),
      param("consumers", "consumer[]", "What takes stock as demand."),
      param("converters", "converter[]", "What turns some resources into others."),
      param("suppliers", "supplier[]", "Where the station orders resources from."),
      param("review", "review", "When the station reviews its orders."),
      param("position", "{ x: number, y: number }", "Where to draw the station on the map."),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "store",
    library: "core",
    kind: "construct",
    summary: "How a station stores one resource.",
    returns: "station resource",
    params: [
      required("resource", "string", "Resource id."),
      param("capacity", 'number|"unlimited"', "Most the station can hold.", {
        default: "30",
        unit: "units",
      }),
      param("initial", "number", "Stock at the start of a run.", { default: "0", unit: "units" }),
      param("expires", "boolean", "Whether stock is removed at each review.", { default: "false" }),
      param("holding_cost", "integer", "Cost per unit held per sol."),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "producer",
    library: "core",
    kind: "construct",
    summary:
      "Adds a resource to its station, by exactly one of rate, poisson, per_period or trace.",
    returns: "producer",
    params: [
      ...flowParams("produced"),
      param("stall_cost", "integer", "Cost per unit of production that does not fit."),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "consumer",
    library: "core",
    kind: "construct",
    summary:
      "Takes a resource from its station as demand, by exactly one of rate, poisson, per_period or trace.",
    returns: "consumer",
    params: [
      ...flowParams("demanded"),
      param(
        "unmet",
        '"lost"|"backorder"',
        "Whether demand that cannot be met is lost or waits for stock.",
        {
          default: '"lost"',
        },
      ),
      param("lost_cost", "integer", "Cost per unit of lost demand."),
      param("backorder_cost", "integer", "Cost per unit backordered per sol."),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "uniform",
    library: "core",
    kind: "construct",
    summary: "Varies a rate uniformly within a range, drawing a new rate each period.",
    returns: "variability",
    params: [
      required("range", "integer", "Largest change from the base rate, in percent."),
      param("period", "integer", "How long each drawn rate lasts.", {
        default: "hours(1)",
        unit: "ms",
      }),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "bursts",
    library: "core",
    kind: "construct",
    summary: "Switches a rate on and off at random.",
    returns: "variability",
    params: [
      required("on_ppm", "integer", "Chance per minute of switching on, in parts per million."),
      required("off_ppm", "integer", "Chance per minute of switching off, in parts per million."),
      param("starts_on", "boolean", "Whether the flow starts on.", { default: "true" }),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "poisson",
    library: "core",
    kind: "construct",
    summary: "Arrivals at random times at an average rate, each of a fixed or random size.",
    returns: "poisson process",
    params: [
      required("per_sol", "number", "Average arrivals per sol."),
      param("size", "number|discrete", "Size of each arrival.", { default: "1", unit: "units" }),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "per_period",
    library: "core",
    kind: "construct",
    summary: "An amount drawn at the start of each period and spread evenly over it.",
    returns: "per-period process",
    params: [
      required("period", "integer", "Length of each period.", "ms"),
      required("amount", "number|discrete", "Amount for each period.", "units"),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "trace",
    library: "core",
    kind: "construct",
    summary: "Recorded amounts, one per period, repeated from the start when they run out.",
    returns: "trace process",
    params: [
      required("period", "integer", "Length of each period.", "ms"),
      required("amounts", "number[]", "Amount for each period.", "units"),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "converter",
    library: "core",
    kind: "construct",
    summary: "Turns input resources into output resources at its station, in batches.",
    returns: "converter",
    params: [
      param("inputs", "table<string, number>", "Amount of each resource each batch takes.", {
        unit: "units",
      }),
      param("outputs", "table<string, number>", "Amount of each resource each batch makes.", {
        unit: "units",
      }),
      required("rate", "number", "Batches per sol."),
      param("variability", "uniform|bursts", "How the rate varies over time. Fixed when omitted."),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "supplier",
    library: "core",
    kind: "construct",
    summary: "Where a station orders one resource from, and how long orders take to arrive.",
    returns: "supplier",
    params: [
      required("resource", "string", "Resource id."),
      param("from", "string", "external, or the id of the station that ships from its own stock.", {
        default: '"external"',
      }),
      param("lead_time", "integer|discrete", "Time from order to arrival.", {
        default: "0",
        unit: "ms",
      }),
      param("min_order", "number", "Smallest order.", { unit: "units" }),
      param("max_order", "number", "Largest order.", { unit: "units" }),
      param("order_cost", "integer", "Fixed cost per order."),
      param("unit_cost", "integer", "Cost per unit ordered."),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "review",
    library: "core",
    kind: "construct",
    summary: "A schedule of reviews, when the policy decides what the station orders.",
    returns: "review schedule",
    params: [
      required("period", "integer", "Time between reviews.", "ms"),
      param("offset", "integer", "Time of the first review.", { default: "0", unit: "ms" }),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "arc",
    library: "core",
    kind: "construct",
    summary: "Joins two stations, in both directions.",
    returns: "arc",
    params: [
      required("from", "string", "Station id at one end."),
      required("to", "string", "Station id at the other end."),
      required("distance", "integer", "Length of the arc."),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "line",
    library: "core",
    kind: "construct",
    summary: "Stations joined in order by arcs. Pass the result to scenario's parts.",
    returns: "{ stations, arcs }",
    params: [
      required("stations", "station[]", "Stations from one end of the line to the other."),
      required("distances", "integer|integer[]", "Distance between neighbours, or one per gap."),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "shuttle",
    library: "core",
    kind: "construct",
    summary: "A route back and forth along its stops, reversing at each end.",
    returns: "route",
    params: [
      required(
        "stops",
        "(string|station)[]",
        "Stations in order; neighbours must be joined by arcs.",
      ),
      param("start", "string", "Stop the vehicle starts at.", { default: "the first stop" }),
      param("direction", '"forward"|"backward"', "Direction the vehicle starts in.", {
        default: '"forward"',
      }),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "loop",
    library: "core",
    kind: "construct",
    summary: "A route around its stops and back to the first, repeatedly.",
    returns: "route",
    params: [
      required(
        "stops",
        "(string|station)[]",
        "Stations in order; the last joins back to the first.",
      ),
      param("start", "string", "Stop the vehicle starts at.", { default: "the first stop" }),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "timetable",
    library: "core",
    kind: "construct",
    summary: "Trips out along its stops and back, leaving the first stop at listed times.",
    returns: "route",
    params: [
      required("stops", "(string|station)[]", "Stations in order from the first stop."),
      required("departures", "integer[]", "Departure times from the first stop.", "ms"),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "vehicle",
    library: "core",
    kind: "construct",
    summary: "A vehicle on a fixed route.",
    returns: "vehicle",
    params: [
      required("id", "string", "Vehicle id."),
      required("route", "shuttle|loop|timetable", "The route it follows."),
      required("speed", "integer", "Distance per second."),
      param("dwell", "integer", "Time at every stop.", { default: "10000", unit: "ms" }),
      param("dwell_per_unit", "integer", "Extra time per unit loaded or unloaded.", {
        default: "1000",
        unit: "ms",
      }),
      param(
        "capacity",
        "number|table<string, number>",
        "Units it can carry across all resources, or units by resource id.",
        { required: true, unit: "units" },
      ),
      param("cost_per_distance", "integer", "Cost per unit of distance travelled."),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "effect",
    library: "core",
    kind: "construct",
    summary: "How an event changes production or demand while it is active.",
    returns: "effect",
    params: [
      required("type", '"supply"|"demand"', "supply scales production; demand scales consumption."),
      param("stations", '"all"|string|string[]', "Stations affected.", { default: '"all"' }),
      param("resources", '"all"|string|string[]', "Resources affected.", { default: '"all"' }),
      required(
        "multiplier",
        "number",
        "Rate multiplier: 0 stops the flow, 2.5 multiplies it by two and a half.",
      ),
      param("start_offset", "integer", "When the effect starts after the event starts.", {
        default: "0",
        unit: "ms",
      }),
      param("duration", "integer", "How long the effect lasts.", {
        default: "the event's duration",
        unit: "ms",
      }),
    ],
    docs: CORE_DOCS,
  },
  {
    name: "event",
    library: "core",
    kind: "construct",
    summary: "Something that changes rates for a while, at a fixed time or at random.",
    returns: "event",
    params: [
      required("id", "string", "Event id."),
      param("label", "string", "Name shown to players.", { default: "the id" }),
      param("start", "integer", "Start time of a fixed event.", { unit: "ms" }),
      required("duration", "integer", "How long the event lasts.", "ms"),
      param(
        "chance_ppm",
        "integer",
        "Chance at each check of a random event starting, in parts per million.",
      ),
      param("check_every", "integer", "Time between checks of a random event.", { unit: "ms" }),
      required("effects", "effect[]", "What the event changes."),
    ],
    docs: CORE_DOCS,
  },
  helper(
    "discrete",
    "Weighted values, such as discrete { { 2, 1 }, { 3, 2 } }, drawn with chance proportional to weight. Values are converted by the parameter they are given to.",
    "distribution",
    required("pairs", "{ number, integer }[]", "Value and whole-number weight pairs."),
  ),
  helper(
    "profile",
    "Multipliers at times in the run, such as profile { { sols(0), 1 }, { sols(10), 2 } }, interpolated linearly between points.",
    "profile",
    required("points", "{ integer, number }[]", "Time and multiplier pairs."),
  ),
  helper(
    "units",
    "Milli-units in a quantity of units, for changing a construct's result. Rejects values finer than 0.001 units.",
    "integer",
    required("value", "number", "Quantity in units, such as 2.5."),
  ),
  durationHelper("minutes", "60000 ms"),
  durationHelper("hours", "60 minutes"),
  durationHelper("sols", "24 hours"),
  durationHelper("days", "24 hours, the same as a sol"),
  durationHelper("weeks", "7 days"),
];

/** Every construct in every library. */
export const constructs: Construct[] = [...coreConstructs];

/** Anchor of a construct on its documentation page. */
export const constructAnchor = (construct: Construct) => construct.name.replace(/\./g, "-");
