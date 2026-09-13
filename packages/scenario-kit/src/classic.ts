/**
 * The classic problem templates: their defaults, their reference policies and the analytic
 * results those policies should reach. Analytic values use floating point freely; they are
 * only compared with simulated results in tests and quoted in the documentation.
 */

import { type Construct, constructs } from "./constructs.ts";
import { CLASSIC_POLICIES } from "./policies.generated.ts";

/** A template parameter as a script writes it: units, milliseconds, costs, flags or choices. */
export type TemplateValue = number | boolean | string | { discrete: [number, number][] };
export type TemplateParams = Record<string, TemplateValue>;

export interface ReferenceResult {
  /** Name of the reference policy, shown to players. */
  policyName: string;
  /** Lua source of the reference policy for these parameters. */
  policy: string;
  /** What the policy does, in a sentence. */
  summary: string;
  /** Expected cost per sol under the reference policy, when an analytic result is known. */
  expectedCostPerSol?: number;
  /** Expected cost per review period, for templates stated per period. */
  expectedCostPerPeriod?: number;
  /** Other analytic values, such as the order quantity, by name. */
  values: Record<string, number>;
}

export interface ClassicTemplate {
  /** Name as called in a script, such as `classic.newsvendor`. */
  name: string;
  /** Parameter defaults in script units, matching the Lua library. */
  defaults: TemplateParams;
  reference(params: TemplateParams): ReferenceResult;
}

const MINUTE = 60_000;
const SOL = 86_400_000;

// --- Distributions ------------------------------------------------------------------------

/** Weighted values as probabilities, sorted by value. */
function probabilities(value: TemplateValue): { value: number; p: number }[] {
  if (typeof value === "number") return [{ value, p: 1 }];
  if (typeof value !== "object") throw new Error("expected a number or a discrete distribution");
  const total = value.discrete.reduce((sum, [, w]) => sum + w, 0);
  return value.discrete
    .map(([v, w]) => ({ value: v, p: w / total }))
    .sort((a, b) => a.value - b.value);
}

/** Poisson probabilities P(N = n) for n = 0 .. until the tail is negligible. */
export function poissonProbabilities(mean: number): number[] {
  const out: number[] = [];
  let p = Math.exp(-mean);
  let cumulative = 0;
  for (let n = 0; n < 100_000; n++) {
    out.push(p);
    cumulative += p;
    if (n > mean && 1 - cumulative < 1e-12) break;
    p = (p * mean) / (n + 1);
  }
  return out;
}

/** E[(level − N)+] and E[(N − level)+] for Poisson N. */
function poissonOverUnder(mean: number, level: number): { over: number; under: number } {
  let over = 0;
  poissonProbabilities(mean).forEach((p, n) => {
    if (n < level) over += (level - n) * p;
  });
  // E[(N − S)+] = E[N] − S + E[(S − N)+].
  return { over, under: mean - level + over };
}

// --- Parameters -----------------------------------------------------------------------------

const num = (params: TemplateParams, key: string) => params[key] as number;

function withDefaults(template: ClassicTemplate, params: TemplateParams): TemplateParams {
  return { ...template.defaults, ...params };
}

const templateConstruct = (name: string): Construct => {
  const found = constructs.find((c) => c.name === name);
  if (!found) throw new Error(`no construct named ${name}`);
  return found;
};

const DURATION_UNITS: [string, number][] = [
  ["weeks", 7 * SOL],
  ["days", SOL],
  ["hours", 3_600_000],
  ["minutes", MINUTE],
];

function durationLiteral(ms: number): string {
  for (const [helper, size] of DURATION_UNITS) {
    if (ms > 0 && ms % size === 0) return `${helper}(${ms / size})`;
  }
  return String(ms);
}

function valueLiteral(value: TemplateValue, unit: string | undefined): string {
  if (typeof value === "number") return unit === "ms" ? durationLiteral(value) : String(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  return `discrete { ${value.discrete.map(([v, w]) => `{ ${v}, ${w} }`).join(", ")} }`;
}

/** A template call as a one-line script, with parameters in the order the template lists them. */
export function templateCall(name: string, params: TemplateParams): string {
  const construct = templateConstruct(name);
  const fields = construct.params
    .filter((p) => params[p.name] !== undefined)
    .map((p) => `${p.name} = ${valueLiteral(params[p.name] as TemplateValue, p.unit)}`);
  return `return ${name} { ${fields.join(", ")} }`;
}

// --- Templates ------------------------------------------------------------------------------

const newsvendor: ClassicTemplate = {
  name: "classic.newsvendor",
  defaults: {
    demand: {
      discrete: [
        [5, 1],
        [10, 2],
        [15, 3],
        [20, 2],
        [25, 1],
      ],
    },
    unit_cost: 2,
    lost_cost: 5,
    period: SOL,
    periods: 30,
    seed: 1,
  },
  reference(input) {
    const params = withDefaults(this, input);
    const c = num(params, "unit_cost");
    const p = num(params, "lost_cost");
    const demand = probabilities(params.demand as TemplateValue);
    // Order up to the smallest quantity whose chance of covering demand reaches the critical ratio.
    const ratio = p > c ? (p - c) / p : 0;
    let cumulative = 0;
    let quantity = 0;
    for (const { value, p: chance } of demand) {
      cumulative += chance;
      if (ratio > 0 && cumulative >= ratio - 1e-12) {
        quantity = value;
        break;
      }
    }
    const shortfall = demand.reduce((sum, d) => sum + Math.max(0, d.value - quantity) * d.p, 0);
    const perPeriod = c * quantity + p * shortfall;
    return {
      policyName: "Critical ratio",
      summary: `Order up to ${quantity} units at each review: the smallest quantity that meets demand with probability at least ${ratio.toFixed(3)}.`,
      policy: `-- Newsvendor: order up to the critical-ratio quantity.\nreturn ops.policy { review = { target = ops.order_up_to { level = ${quantity * 1000} } } }\n`,
      expectedCostPerPeriod: perPeriod,
      expectedCostPerSol: (perPeriod * SOL) / num(params, "period"),
      values: { criticalRatio: ratio, quantity },
    };
  },
};

const reorder: ClassicTemplate = {
  name: "classic.reorder",
  defaults: {
    demand: 10,
    random: false,
    lead_time: 0,
    review_period: 3_600_000,
    holding_cost: 1,
    order_cost: 20,
    unit_cost: 0,
    shortage: "backorder",
    shortage_cost: 10,
    initial: 0,
    duration: 20 * SOL,
    seed: 1,
  },
  reference(input) {
    const params = withDefaults(this, input);
    const demand = num(params, "demand");
    const h = num(params, "holding_cost");
    const k = num(params, "order_cost");
    const c = num(params, "unit_cost");
    const lead = num(params, "lead_time");
    const period = num(params, "review_period");
    if (!params.random) {
      // Economic order quantity, with a reorder point covering the lead time and one review.
      const quantity = Math.sqrt((2 * k * demand) / h);
      const reorderPoint = Math.ceil((demand * 1000 * (lead + period)) / SOL);
      const orderUpTo = reorderPoint + Math.round(quantity * 1000);
      return {
        policyName: "Economic order quantity",
        summary: `Order ${quantity.toFixed(2)} units whenever the inventory position falls below what the lead time and one review period need.`,
        policy: `-- Economic order quantity: order Q = sqrt(2KD/h) when stock would run out before the next review.\nreturn ops.policy { review = { target = ops.min_max { min = ${reorderPoint}, max = ${orderUpTo} } } }\n`,
        expectedCostPerSol: Math.sqrt(2 * k * demand * h) + c * demand,
        values: { quantity, reorderPoint: reorderPoint / 1000 },
      };
    }
    // Base-stock: the newsvendor fractile of Poisson demand over the lead time and one review.
    const b = num(params, "shortage_cost");
    const cover = (demand * (lead + period)) / SOL;
    const ratio = b / (b + h);
    const chances = poissonProbabilities(cover);
    let level = 0;
    let cumulative = 0;
    for (const [n, p] of chances.entries()) {
      cumulative += p;
      if (cumulative >= ratio) {
        level = n;
        break;
      }
    }
    const result: ReferenceResult = {
      policyName: "Base stock",
      summary: `Order up to ${level} units at each review, the level that lead-time demand stays under with probability at least ${ratio.toFixed(3)}.`,
      policy: `-- Base stock: order up to the critical fractile of demand over the lead time and a review period.\nreturn ops.policy { review = { target = ops.order_up_to { level = ${level * 1000} } } }\n`,
      values: { level, criticalRatio: ratio },
    };
    if (params.shortage === "backorder") {
      result.expectedCostPerSol = baseStockCostPerSol(params, level);
    }
    return result;
  },
};

/**
 * Expected cost per sol of a base-stock policy with Poisson demand and backorders, tick by tick
 * as the engine runs it: reviews one minute into each period, deliveries before the tick at their
 * arrival time, and costs on the stock or backlog left after each tick.
 */
function baseStockCostPerSol(params: TemplateParams, level: number): number {
  const rate = num(params, "demand") / SOL;
  const h = num(params, "holding_cost");
  const b = num(params, "shortage_cost");
  const k = num(params, "order_cost");
  const c = num(params, "unit_cost");
  const lead = num(params, "lead_time");
  const period = num(params, "review_period");
  const initial = num(params, "initial");
  const duration = num(params, "duration");

  const cache = new Map<string, number>();
  const tickCost = (start: number, window: number) => {
    const key = `${start}:${window}`;
    let cost = cache.get(key);
    if (cost === undefined) {
      const { over, under } = poissonOverUnder(rate * window, start);
      cost = h * over + b * under;
      cache.set(key, cost);
    }
    return cost;
  };

  let total = 0;
  let ticks = 0;
  const firstReview = MINUTE;
  for (let t = MINUTE; t <= duration; t += MINUTE) {
    ticks++;
    // The latest review whose order has arrived by this tick.
    const arrived = Math.floor((t - lead - firstReview) / period);
    const review = Math.min(arrived, Math.ceil((duration - firstReview) / period) - 1);
    if (t - lead < firstReview || review < 0) {
      total += tickCost(initial, t);
    } else {
      total += tickCost(level, t - (firstReview + review * period) + MINUTE);
    }
  }
  let ordering = 0;
  for (let at = firstReview; at < duration; at += period) {
    if (at === firstReview) {
      if (level > initial) ordering += k + c * (level - initial);
    } else {
      ordering += k * (1 - Math.exp(-rate * period)) + c * rate * period;
    }
  }
  return total / ticks + (ordering * SOL) / duration;
}

const serialChain: ClassicTemplate = {
  name: "classic.serial_chain",
  defaults: {
    stages: 4,
    lead_time: 2 * SOL,
    review_period: SOL,
    demand: {
      discrete: [
        [2, 1],
        [4, 2],
        [6, 1],
      ],
    },
    holding_cost: 1,
    backorder_cost: 2,
    initial: 12,
    duration: 60 * SOL,
    seed: 1,
  },
  reference() {
    return {
      policyName: "Moving-average order-up-to",
      summary:
        "Each stage orders up to its average recent demand times the lead time and one review period.",
      policy: CLASSIC_POLICIES["moving-average"] as string,
      values: {},
    };
  },
};

const fixedRouteDelivery: ClassicTemplate = {
  name: "classic.fixed_route_delivery",
  defaults: {
    customers: 3,
    demand: 4,
    customer_capacity: 20,
    customer_initial: 10,
    distance: 600,
    vehicles: 1,
    vehicle_capacity: 30,
    speed: 5,
    lead_time: SOL,
    review_period: SOL,
    depot_initial: 60,
    lost_cost: 5,
    cost_per_distance: 0,
    duration: 20 * SOL,
    seed: 1,
  },
  reference() {
    return {
      policyName: "Fill the route",
      summary:
        "Trucks load what the customers ahead are short of and fill each customer; the depot orders up to its customers' storage.",
      policy: CLASSIC_POLICIES["fill-the-route"] as string,
      values: {},
    };
  },
};

export const classicTemplates: ClassicTemplate[] = [
  newsvendor,
  reorder,
  serialChain,
  fixedRouteDelivery,
];
