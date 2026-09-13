import { z } from "zod";
import {
  DEFAULT_CAPACITY,
  INFORMATION_LEVELS,
  id,
  offset,
  positive,
  quantity,
  Resource,
  SUPPORTED_INFORMATION_LEVELS,
  span,
  TrainCapacity,
  Variability,
  WorldEvent,
  wholeMinutes,
} from "./schema.ts";

/**
 * Capacity that never limits stock in practice. Stock is recorded in 32-bit
 * integers, so "unlimited" stands for two million units.
 */
export const UNLIMITED_CAPACITY = 2_000_000_000;

/** Id that names an external supplier; no stock point may use it. */
export const EXTERNAL_SUPPLIER = "external";

const MAX_MULTIPLIER_PERMILLE = 100_000;

/** Whole amounts drawn from a fixed value or from weighted values. */
export const Distribution = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("fixed"), value: quantity }),
  z.strictObject({
    kind: z.literal("discrete"),
    values: z.array(z.strictObject({ value: quantity, weight: positive })).min(1),
  }),
]);

/** Durations drawn from a fixed value or from weighted values, in milliseconds. */
export const DurationDistribution = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("fixed"), value: offset }),
  z.strictObject({
    kind: z.literal("discrete"),
    values: z.array(z.strictObject({ value: offset, weight: positive })).min(1),
  }),
]);

/** A multiplier in thousandths at a time in the run, interpolated linearly between points. */
export const ProfilePoint = z.strictObject({
  atMs: offset,
  multiplierPermille: z.int().min(0).max(MAX_MULTIPLIER_PERMILLE),
});

const FLOW_KINDS = "a flow needs exactly one of rate, poisson, perPeriod or trace";

interface FlowKinds {
  rate?: number | undefined;
  variability?: unknown;
  poisson?: unknown;
  perPeriod?: unknown;
  trace?: unknown;
}

/**
 * A flow produces or demands amounts in exactly one way: a rate with variability, Poisson
 * arrivals, an amount per period, or a recorded trace. One object with optional kinds, rather
 * than a union, keeps validation errors pointing at the field that is wrong.
 */
const flowShape = {
  resource: id,
  /** Milli-units per sol. */
  rate: quantity.optional(),
  /** Applies to `rate`; fixed when omitted. */
  variability: Variability.optional(),
  /** Arrivals per sol in thousandths, each of a size drawn from `size`. */
  poisson: z.strictObject({ arrivalsPerSol: quantity, size: Distribution }).optional(),
  perPeriod: z.strictObject({ periodMs: wholeMinutes, amount: Distribution }).optional(),
  trace: z.strictObject({ periodMs: wholeMinutes, amounts: z.array(quantity).min(1) }).optional(),
  profile: z.array(ProfilePoint).min(1).optional(),
};

function checkFlow(f: FlowKinds, ctx: z.RefinementCtx) {
  const kinds = [f.rate, f.poisson, f.perPeriod, f.trace].filter((k) => k !== undefined);
  if (kinds.length !== 1) ctx.addIssue({ code: "custom", message: FLOW_KINDS });
  if (f.variability !== undefined && f.rate === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["variability"],
      message: "variability applies only to a flow with a rate",
    });
  }
}

export const Producer = z
  .strictObject({ ...flowShape, stallCost: quantity.optional() })
  .superRefine(checkFlow);

export const Consumer = z
  .strictObject({
    ...flowShape,
    /** Whether demand that cannot be met is lost or carried until stock arrives. */
    unmet: z.enum(["lost", "backorder"]).default("lost"),
    lostCost: quantity.optional(),
    backorderCost: quantity.optional(),
  })
  .superRefine(checkFlow);

const Amount = z.strictObject({ resource: id, amount: positive });

export const Converter = z.strictObject({
  inputs: z.array(Amount).default([]),
  outputs: z.array(Amount).default([]),
  /** Batches per sol in thousandths. */
  rate: quantity,
  variability: Variability.default({ kind: "fixed" }),
});

export const Supplier = z.strictObject({
  resource: id,
  /** `external` for an unlimited outside supplier, or the id of a stock point. */
  from: id,
  leadTime: DurationDistribution.default({ kind: "fixed", value: 0 }),
  minOrder: quantity.optional(),
  maxOrder: positive.optional(),
  orderCost: quantity.optional(),
  unitCost: quantity.optional(),
});

export const Review = z.strictObject({ periodMs: wholeMinutes, offsetMs: offset.default(0) });

export const StockResource = z.strictObject({
  id,
  capacity: z.union([quantity, z.literal("unlimited")]).default(DEFAULT_CAPACITY),
  initial: quantity.default(0),
  /** Stock of this resource is removed at each review of its stock point. */
  expires: z.boolean().default(false),
  holdingCost: quantity.optional(),
});

export const StockPoint = z.strictObject({
  id,
  resources: z.array(StockResource).min(1),
  producers: z.array(Producer).default([]),
  consumers: z.array(Consumer).default([]),
  converters: z.array(Converter).default([]),
  suppliers: z.array(Supplier).default([]),
  review: Review.optional(),
  /** Where to draw the stock point on the map. */
  position: z.strictObject({ x: z.number(), y: z.number() }).optional(),
});

export const Arc = z.strictObject({ from: id, to: id, distance: positive });

export const Route = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("shuttle"),
    stops: z.array(id).min(2),
    start: id.optional(),
    direction: z.enum(["forward", "backward"]).default("forward"),
  }),
  z.strictObject({ kind: z.literal("loop"), stops: z.array(id).min(2), start: id.optional() }),
  z.strictObject({
    kind: z.literal("timetable"),
    stops: z.array(id).min(2),
    departuresMs: z.array(offset).min(1),
  }),
]);

export const Vehicle = z.strictObject({
  id,
  route: Route,
  /** Distance per second. */
  speed: positive,
  dwellMs: quantity.default(10_000),
  dwellPerUnitMs: quantity.default(1_000),
  capacity: TrainCapacity,
  costPerDistance: quantity.optional(),
});

/** Travel time in milliseconds for a distance at a speed, rounded up. */
export const travelMs = (distance: number, speed: number) =>
  Math.floor((distance * 1000 + speed - 1) / speed);

// Ids cannot contain a colon, so it separates the two ends unambiguously.
const arcKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export const ScenarioV2 = z
  .strictObject({
    format: z.literal(2),
    id,
    title: z.string().min(1),
    description: z.string().min(1),
    docs: z.string().optional(),
    durationMs: span,
    seed: z.int().nonnegative(),
    informationLevel: z.enum(INFORMATION_LEVELS),
    sampleIntervalMs: wholeMinutes.default(3_600_000),
    resources: z.array(Resource).min(1),
    stockPoints: z.array(StockPoint).min(1),
    arcs: z.array(Arc).default([]),
    vehicles: z.array(Vehicle).default([]),
    events: z.array(WorldEvent).default([]),
  })
  .superRefine((scenario, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

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

    // Stock points and what each stores.
    const stored = new Map<string, Set<string>>();
    scenario.stockPoints.forEach((point, i) => {
      const at = ["stockPoints", i];
      if (stored.has(point.id)) issue([...at, "id"], `duplicate stock point id ${point.id}`);
      if (point.id === EXTERNAL_SUPPLIER) {
        issue([...at, "id"], `${EXTERNAL_SUPPLIER} is reserved for external suppliers`);
      }
      const enabled = new Set<string>();
      point.resources.forEach((resource, j) => {
        if (!resourceIds.has(resource.id))
          issue([...at, "resources", j, "id"], `unknown resource ${resource.id}`);
        if (enabled.has(resource.id)) {
          issue(
            [...at, "resources", j, "id"],
            `resource ${resource.id} is stored twice at ${point.id}`,
          );
        }
        if (resource.capacity !== "unlimited" && resource.initial > resource.capacity) {
          issue([...at, "resources", j, "initial"], "initial stock exceeds capacity");
        }
        enabled.add(resource.id);
      });
      stored.set(point.id, enabled);
    });

    const storedAt = (point: string, resource: string) => stored.get(point)?.has(resource) ?? false;

    scenario.stockPoints.forEach((point, i) => {
      const at = ["stockPoints", i];
      const needs = (path: (string | number)[], resource: string) => {
        if (!storedAt(point.id, resource)) {
          issue(path, `stock point ${point.id} does not store resource ${resource}`);
        }
      };
      for (const kind of ["producers", "consumers"] as const) {
        point[kind].forEach((f, j) => {
          needs([...at, kind, j, "resource"], f.resource);
          f.profile?.forEach((p, k) => {
            const previous = f.profile?.[k - 1];
            if (previous && p.atMs <= previous.atMs) {
              issue([...at, kind, j, "profile", k, "atMs"], "profile points must be in time order");
            }
          });
        });
      }
      point.converters.forEach((converter, j) => {
        if (converter.inputs.length === 0 && converter.outputs.length === 0) {
          issue([...at, "converters", j], "a converter needs at least one input or output");
        }
        for (const side of ["inputs", "outputs"] as const) {
          converter[side].forEach((amount, k) => {
            needs([...at, "converters", j, side, k, "resource"], amount.resource);
          });
        }
      });
      const supplied = new Set<string>();
      point.suppliers.forEach((supplier, j) => {
        const where = [...at, "suppliers", j];
        needs([...where, "resource"], supplier.resource);
        if (supplied.has(supplier.resource)) {
          issue(
            [...where, "resource"],
            `stock point ${point.id} already has a supplier for ${supplier.resource}`,
          );
        }
        supplied.add(supplier.resource);
        if (supplier.from !== EXTERNAL_SUPPLIER) {
          if (supplier.from === point.id) {
            issue([...where, "from"], `stock point ${point.id} cannot supply itself`);
          } else if (!stored.has(supplier.from)) {
            issue([...where, "from"], `unknown stock point ${supplier.from}`);
          } else if (!storedAt(supplier.from, supplier.resource)) {
            issue(
              [...where, "from"],
              `supplier ${supplier.from} does not store resource ${supplier.resource}`,
            );
          }
        }
        if (
          supplier.minOrder !== undefined &&
          supplier.maxOrder !== undefined &&
          supplier.minOrder > supplier.maxOrder
        ) {
          issue([...where, "minOrder"], "minOrder must not be greater than maxOrder");
        }
      });
    });

    // Supplier cycles, per resource.
    const resourcesWithSuppliers = new Set(
      scenario.stockPoints.flatMap((p) => p.suppliers.map((s) => s.resource)),
    );
    for (const resource of resourcesWithSuppliers) {
      const next = new Map<string, string>();
      for (const point of scenario.stockPoints) {
        const supplier = point.suppliers.find((s) => s.resource === resource);
        if (supplier && supplier.from !== EXTERNAL_SUPPLIER) next.set(point.id, supplier.from);
      }
      const reported = new Set<string>();
      for (const startId of next.keys()) {
        const chain = [startId];
        let current = next.get(startId);
        while (current !== undefined && !chain.includes(current)) {
          chain.push(current);
          current = next.get(current);
        }
        if (current === undefined) continue;
        const cycle = chain.slice(chain.indexOf(current));
        const key = [...cycle].sort().join(",");
        if (reported.has(key)) continue;
        reported.add(key);
        const index = scenario.stockPoints.findIndex((p) => p.id === cycle[0]);
        const supplierIndex =
          scenario.stockPoints[index]?.suppliers.findIndex((s) => s.resource === resource) ?? 0;
        issue(
          ["stockPoints", index, "suppliers", supplierIndex, "from"],
          `suppliers of ${resource} form a cycle: ${[...cycle, cycle[0]].join(" → ")}`,
        );
      }
    }

    // Arcs.
    const arcs = new Map<string, number>();
    scenario.arcs.forEach((arc, i) => {
      const at = ["arcs", i];
      for (const end of ["from", "to"] as const) {
        if (!stored.has(arc[end])) issue([...at, end], `unknown stock point ${arc[end]}`);
      }
      if (arc.from === arc.to) issue([...at, "to"], "an arc must join two different stock points");
      const key = arcKey(arc.from, arc.to);
      if (arcs.has(key)) issue(at, `stock points ${arc.from} and ${arc.to} are already joined`);
      arcs.set(key, arc.distance);
    });

    // Vehicles and routes.
    const vehicleIds = new Set<string>();
    scenario.vehicles.forEach((vehicle, i) => {
      const at = ["vehicles", i];
      if (vehicleIds.has(vehicle.id)) issue([...at, "id"], `duplicate vehicle id ${vehicle.id}`);
      vehicleIds.add(vehicle.id);
      if ("perResource" in vehicle.capacity) {
        for (const resource of Object.keys(vehicle.capacity.perResource)) {
          if (!resourceIds.has(resource)) {
            issue([...at, "capacity", "perResource", resource], `unknown resource ${resource}`);
          }
        }
      }
      const route = vehicle.route;
      const where = [...at, "route"];
      let known = true;
      route.stops.forEach((stop, k) => {
        if (!stored.has(stop)) {
          issue([...where, "stops", k], `unknown stock point ${stop}`);
          known = false;
        }
      });
      if (!known) return;
      const legs = route.stops.map((stop, k) => [stop, route.stops[k + 1]] as const);
      if (route.kind !== "loop") legs.pop();
      else legs[legs.length - 1] = [route.stops.at(-1) as string, route.stops[0] as string];
      let pathDistance = 0;
      legs.forEach(([a, b], k) => {
        const distance = arcs.get(arcKey(a, b as string));
        if (distance === undefined) {
          issue(
            [...where, "stops", (k + 1) % route.stops.length],
            `the route of vehicle ${vehicle.id} goes from ${a} to ${b}, which no arc joins`,
          );
        } else {
          pathDistance += travelMs(distance, vehicle.speed);
        }
      });
      if (route.kind !== "timetable" && route.start !== undefined) {
        if (!route.stops.includes(route.start)) {
          issue([...where, "start"], `${route.start} is not a stop on the route`);
        }
      }
      if (route.kind === "timetable") {
        // A trip runs out along the stops and back, stopping at each.
        const stopsPerTrip = 2 * route.stops.length - 1;
        const tripMs = 2 * pathDistance + stopsPerTrip * vehicle.dwellMs;
        route.departuresMs.forEach((departure, k) => {
          if (departure >= scenario.durationMs) {
            issue([...where, "departuresMs", k], "departure is after the run ends");
          }
          const previous = route.departuresMs[k - 1];
          if (previous === undefined) return;
          if (departure <= previous) {
            issue([...where, "departuresMs", k], "departures must be in time order");
          } else if (departure < previous + tripMs) {
            issue(
              [...where, "departuresMs", k],
              `departure at ${departure} ms is before the previous trip can finish at ${previous + tripMs} ms`,
            );
          }
        });
      }
    });

    // Events.
    const eventIds = new Set<string>();
    scenario.events.forEach((event, i) => {
      const at = ["events", i];
      if (eventIds.has(event.id)) issue([...at, "id"], `duplicate event id ${event.id}`);
      eventIds.add(event.id);
      if (event.schedule.kind === "fixed" && event.schedule.startMs >= scenario.durationMs) {
        issue([...at, "schedule", "startMs"], `event ${event.id} starts after the run ends`);
      }
      event.effects.forEach((effect, j) => {
        const where = [...at, "effects", j];
        if (effect.stations !== "all") {
          effect.stations.forEach((station, k) => {
            if (!stored.has(station))
              issue([...where, "stations", k], `unknown stock point ${station}`);
          });
        }
        if (effect.resources !== "all") {
          effect.resources.forEach((resource, k) => {
            if (!resourceIds.has(resource)) {
              issue([...where, "resources", k], `unknown resource ${resource}`);
            }
          });
        }
      });
    });
  });

export type ScenarioV2Input = z.input<typeof ScenarioV2>;
export type ScenarioV2 = z.output<typeof ScenarioV2>;
export type StockPointDef = z.output<typeof StockPoint>;
export type StockResourceDef = z.output<typeof StockResource>;
export type ProducerDef = z.output<typeof Producer>;
export type ConsumerDef = z.output<typeof Consumer>;
export type ConverterDef = z.output<typeof Converter>;
export type SupplierDef = z.output<typeof Supplier>;
export type ReviewDef = z.output<typeof Review>;
export type ArcDef = z.output<typeof Arc>;
export type RouteDef = z.output<typeof Route>;
export type VehicleDef = z.output<typeof Vehicle>;
export type DistributionDef = z.output<typeof Distribution>;
export type DurationDistributionDef = z.output<typeof DurationDistribution>;
export type ProfilePointDef = z.output<typeof ProfilePoint>;
