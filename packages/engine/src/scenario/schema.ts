import { z } from "zod";

/** Scenario format versions this build can read. */
export const SUPPORTED_FORMATS = [1] as const;

/** One unit of a resource, in the milli-units every quantity is stored in. */
export const UNIT = 1000;

export const DEFAULT_CAPACITY = 30 * UNIT;

const id = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "ids start with a letter and use letters, digits, _ or -");
// Upper bounds keep every intermediate engine value exactly representable.
const quantity = z.int().nonnegative().max(1_000_000_000);
const positive = z.int().positive().max(1_000_000_000);
const wholeSeconds = positive.refine((ms) => ms % 1000 === 0, "must be a whole number of seconds");

export const Variability = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("fixed") }),
  z.strictObject({
    kind: z.literal("uniform"),
    /** Maximum deviation from the base rate, in percent. */
    rangePercent: z.int().min(0).max(100),
    /** How long each sampled rate lasts. */
    periodMs: positive.default(60_000),
  }),
  z.strictObject({
    kind: z.literal("bursts"),
    /** Chance per production tick of switching on, in parts per million. */
    onPpm: z.int().min(0).max(1_000_000),
    /** Chance per production tick of switching off, in parts per million. */
    offPpm: z.int().min(0).max(1_000_000),
    startsOn: z.boolean().default(true),
  }),
]);

export const Flow = z.strictObject({
  resource: id,
  /** Milli-units per minute of game time. */
  rate: quantity,
  variability: Variability.default({ kind: "fixed" }),
});

export const StationResource = z.strictObject({
  id,
  capacity: quantity.default(DEFAULT_CAPACITY),
  initial: quantity.default(0),
});

export const Station = z.strictObject({
  id,
  resources: z.array(StationResource).min(1),
  /** Distance to the next station on the line. Omitted on the last station. */
  distanceToNext: positive.optional(),
  producers: z.array(Flow).default([]),
  consumers: z.array(Flow).default([]),
});

export const TrainCapacity = z.union([
  z.strictObject({ shared: quantity }),
  z.strictObject({ perResource: z.record(id, quantity) }),
]);

export const Train = z.strictObject({
  id,
  start: id,
  direction: z.enum(["forward", "backward"]).default("forward"),
  /** Distance per second. */
  speed: positive,
  dwellMs: quantity.default(10_000),
  /** Extra dwell per whole unit transferred. */
  dwellPerUnitMs: quantity.default(1_000),
  capacity: TrainCapacity,
});

export const StormSchedule = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("fixed"), startMs: quantity, durationMs: positive }),
  z.strictObject({
    kind: z.literal("random"),
    /** Chance of a storm starting at each check, in parts per million. */
    probabilityPpm: z.int().min(0).max(1_000_000),
    checkIntervalMs: positive,
    durationMs: positive,
  }),
]);

export const Storm = z.strictObject({
  kind: z.literal("storm"),
  id,
  stations: z.union([z.literal("all"), z.array(id).min(1)]),
  /** Production multiplier during the storm, in thousandths. */
  multiplierPermille: z.int().min(0).max(1000),
  schedule: StormSchedule,
});

export const Resource = z.strictObject({
  id,
  priority: positive.default(1),
});

export const INFORMATION_LEVELS = ["local", "line", "line+history", "colony"] as const;
export const SUPPORTED_INFORMATION_LEVELS = ["local", "line"] as const;

export const Scenario = z
  .strictObject({
    format: z.int(),
    id,
    title: z.string().min(1),
    description: z.string().min(1),
    /** Documentation page explaining what the scenario demonstrates. */
    docs: z.string().optional(),
    durationMs: positive,
    seed: z.int().nonnegative(),
    informationLevel: z.enum(INFORMATION_LEVELS),
    sampleIntervalMs: wholeSeconds.default(60_000),
    resources: z.array(Resource).min(1),
    stations: z.array(Station),
    trains: z.array(Train).min(1),
    events: z.array(Storm).default([]),
  })
  .superRefine((scenario, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (!(SUPPORTED_FORMATS as readonly number[]).includes(scenario.format)) {
      issue(
        ["format"],
        `format ${scenario.format} is not supported; supported versions: ${SUPPORTED_FORMATS.join(", ")}`,
      );
    }
    if (!(SUPPORTED_INFORMATION_LEVELS as readonly string[]).includes(scenario.informationLevel)) {
      issue(
        ["informationLevel"],
        `the ${scenario.informationLevel} information level is reserved for a later version`,
      );
    }

    const resourceIds = new Set<string>();
    scenario.resources.forEach((resource, i) => {
      if (resourceIds.has(resource.id))
        issue(["resources", i, "id"], `duplicate resource id ${resource.id}`);
      resourceIds.add(resource.id);
    });

    if (scenario.stations.length < 2) {
      issue(["stations"], "a line needs at least two stations");
    }

    const stationIds = new Set<string>();
    const last = scenario.stations.length - 1;
    scenario.stations.forEach((station, i) => {
      const at = ["stations", i];
      if (stationIds.has(station.id)) issue([...at, "id"], `duplicate station id ${station.id}`);
      stationIds.add(station.id);

      if (i < last && station.distanceToNext === undefined) {
        issue(
          [...at, "distanceToNext"],
          `station ${station.id} needs a distance to the next station`,
        );
      }
      if (i === last && station.distanceToNext !== undefined) {
        issue([...at, "distanceToNext"], `the last station ${station.id} has no next station`);
      }

      const enabled = new Set<string>();
      station.resources.forEach((resource, j) => {
        if (!resourceIds.has(resource.id))
          issue([...at, "resources", j, "id"], `unknown resource ${resource.id}`);
        if (enabled.has(resource.id)) {
          issue(
            [...at, "resources", j, "id"],
            `resource ${resource.id} is enabled twice at ${station.id}`,
          );
        }
        if (resource.initial > resource.capacity) {
          issue([...at, "resources", j, "initial"], "initial stock exceeds capacity");
        }
        enabled.add(resource.id);
      });

      for (const kind of ["producers", "consumers"] as const) {
        station[kind].forEach((flow, j) => {
          if (!enabled.has(flow.resource)) {
            issue(
              [...at, kind, j, "resource"],
              `station ${station.id} does not enable resource ${flow.resource}`,
            );
          }
        });
      }
    });

    const trainIds = new Set<string>();
    scenario.trains.forEach((train, i) => {
      const at = ["trains", i];
      if (trainIds.has(train.id)) issue([...at, "id"], `duplicate train id ${train.id}`);
      trainIds.add(train.id);
      if (!stationIds.has(train.start)) issue([...at, "start"], `unknown station ${train.start}`);
      if ("perResource" in train.capacity) {
        for (const resource of Object.keys(train.capacity.perResource)) {
          if (!resourceIds.has(resource)) {
            issue([...at, "capacity", "perResource", resource], `unknown resource ${resource}`);
          }
        }
      }
    });

    const eventIds = new Set<string>();
    scenario.events.forEach((event, i) => {
      const at = ["events", i];
      if (eventIds.has(event.id)) issue([...at, "id"], `duplicate event id ${event.id}`);
      eventIds.add(event.id);
      if (event.stations !== "all") {
        event.stations.forEach((station, j) => {
          if (!stationIds.has(station)) issue([...at, "stations", j], `unknown station ${station}`);
        });
      }
      if (event.schedule.kind === "fixed" && event.schedule.startMs >= scenario.durationMs) {
        issue([...at, "schedule", "startMs"], "the storm starts after the run ends");
      }
    });
  });

export type ScenarioInput = z.input<typeof Scenario>;
export type Scenario = z.output<typeof Scenario>;
export type StationDef = z.output<typeof Station>;
export type TrainDef = z.output<typeof Train>;
export type FlowDef = z.output<typeof Flow>;
export type VariabilityDef = z.output<typeof Variability>;
export type StormDef = z.output<typeof Storm>;
export type InformationLevel = (typeof SUPPORTED_INFORMATION_LEVELS)[number];
