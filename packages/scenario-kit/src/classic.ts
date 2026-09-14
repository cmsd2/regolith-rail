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
  /** Expected cost per day under the reference policy, when an analytic result is known. */
  expectedCostPerDay?: number;
  /** Expected cost per review period, for templates stated per period. */
  expectedCostPerPeriod?: number;
  /** Other analytic values, such as the order quantity, by name. */
  values: Record<string, number>;
}

export interface ClassicTemplate {
  /** Name as called in a script, such as `classic.newsvendor`. */
  name: string;
  /** Title shown in the scenario picker. */
  title: string;
  /** Parameter defaults in script units, matching the Lua library. */
  defaults: TemplateParams;
  reference(params: TemplateParams): ReferenceResult;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

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
  ["weeks", 7 * DAY],
  ["days", DAY],
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
  const entry = (v: number) => (unit === "ms" ? durationLiteral(v) : String(v));
  return `discrete { ${value.discrete.map(([v, w]) => `{ ${entry(v)}, ${w} }`).join(", ")} }`;
}

/** The widest line shipped scripts and policies use, so they read well in the editor. */
export const SCRIPT_LINE_WIDTH = 80;

/**
 * A template call as a script, with parameters in the order the template lists them: on one line
 * when it fits, otherwise one parameter per line.
 */
export function templateCall(name: string, params: TemplateParams): string {
  const construct = templateConstruct(name);
  const fields = construct.params
    .filter((p) => params[p.name] !== undefined)
    .map((p) => `${p.name} = ${valueLiteral(params[p.name] as TemplateValue, p.unit)}`);
  const line = `return ${name} { ${fields.join(", ")} }`;
  if (line.length <= SCRIPT_LINE_WIDTH) return line;
  return `return ${name} {\n${fields.map((f) => `  ${f},`).join("\n")}\n}`;
}

/** A reference policy that orders at every review towards one target, laid out as a script. */
const reviewPolicy = (comment: string[], target: string) =>
  `${comment.map((line) => `-- ${line}`).join("\n")}\nreturn ops.policy {\n  review = { target = ${target} },\n}\n`;

// --- Templates ------------------------------------------------------------------------------

const newsvendor: ClassicTemplate = {
  name: "classic.newsvendor",
  title: "Newsvendor",
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
    period: DAY,
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
      policy: reviewPolicy(
        ["Newsvendor: order up to the critical-ratio quantity."],
        `ops.order_up_to { level = ${quantity * 1000} }`,
      ),
      expectedCostPerPeriod: perPeriod,
      expectedCostPerDay: (perPeriod * DAY) / num(params, "period"),
      values: { criticalRatio: ratio, quantity },
    };
  },
};

const reorder: ClassicTemplate = {
  name: "classic.reorder",
  title: "Reorder",
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
    duration: 20 * DAY,
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
      const reorderPoint = Math.ceil((demand * 1000 * (lead + period)) / DAY);
      const orderUpTo = reorderPoint + Math.round(quantity * 1000);
      return {
        policyName: "Economic order quantity",
        summary: `Order ${quantity.toFixed(2)} units whenever the inventory position falls below what the lead time and one review period need.`,
        policy: reviewPolicy(
          [
            "Economic order quantity: order Q = sqrt(2KD/h) whenever stock would run",
            "out before the next review.",
          ],
          `ops.min_max { min = ${reorderPoint}, max = ${orderUpTo} }`,
        ),
        expectedCostPerDay: Math.sqrt(2 * k * demand * h) + c * demand,
        values: { quantity, reorderPoint: reorderPoint / 1000 },
      };
    }
    // Base-stock: the newsvendor fractile of Poisson demand over the lead time and one review.
    const b = num(params, "shortage_cost");
    const cover = (demand * (lead + period)) / DAY;
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
      policy: reviewPolicy(
        [
          "Base stock: order up to the critical fractile of demand over the lead time",
          "and a review period.",
        ],
        `ops.order_up_to { level = ${level * 1000} }`,
      ),
      values: { level, criticalRatio: ratio },
    };
    if (params.shortage === "backorder") {
      result.expectedCostPerDay = baseStockCostPerDay(params, level);
    }
    return result;
  },
};

/**
 * Cycle service level of an order-up-to level with Poisson demand: the chance that demand over a
 * review period and the lead time of the next order stays within the level, averaged over the
 * lead times the supplier draws from.
 */
export function cycleServiceLevel(
  demandPerDay: number,
  reviewPeriodMs: number,
  leadTimes: { value: number; p: number }[],
  level: number,
): number {
  return leadTimes.reduce((sum, { value, p }) => {
    const mean = (demandPerDay * (reviewPeriodMs + value)) / DAY;
    const covered = poissonProbabilities(mean)
      .slice(0, level + 1)
      .reduce((a, b) => a + b, 0);
    return sum + p * covered;
  }, 0);
}

const safetyStock: ClassicTemplate = {
  name: "classic.safety_stock",
  title: "Safety stock",
  defaults: {
    demand: 10,
    lead_time: {
      discrete: [
        [DAY, 1],
        [3 * DAY, 1],
      ],
    },
    review_period: 7 * DAY,
    target_service: 0.95,
    holding_cost: 1,
    backorder_cost: 10,
    initial: 0,
    duration: 70 * DAY,
    seed: 1,
  },
  reference(input) {
    const params = withDefaults(this, input);
    const demand = num(params, "demand");
    const period = num(params, "review_period");
    const target = num(params, "target_service");
    const leadTimes = probabilities(params.lead_time as TemplateValue);
    // The smallest order-up-to level whose cycle service level reaches the target.
    let level = 0;
    while (cycleServiceLevel(demand, period, leadTimes, level) < target) level++;
    const meanCover = leadTimes.reduce(
      (sum, { value, p }) => sum + (p * demand * (period + value)) / DAY,
      0,
    );
    return {
      policyName: "Order up to the service level",
      summary: `Order up to ${level} units at each review: the lowest level at which a cycle ends without backorders with probability at least ${target}.`,
      policy: reviewPolicy(
        ["Safety stock: order up to the level that meets the target cycle service", "level."],
        `ops.order_up_to { level = ${level * 1000} }`,
      ),
      values: {
        level,
        cycleServiceLevel: cycleServiceLevel(demand, period, leadTimes, level),
        meanCover,
        safetyStock: level - meanCover,
      },
    };
  },
};

const forecasting: ClassicTemplate = {
  name: "classic.forecasting",
  title: "Forecasting",
  defaults: {
    level: 20,
    trend: 1,
    season_length: 0,
    season_amplitude: 0,
    noise: false,
    alpha: 0.2,
    lead_time: 2 * DAY,
    safety: 0,
    holding_cost: 1,
    backorder_cost: 10,
    duration: 60 * DAY,
    seed: 1,
  },
  reference(input) {
    const params = withDefaults(this, input);
    const alpha = num(params, "alpha");
    const trend = num(params, "trend");
    // An order placed at a daily review must last through the lead time and until the next review.
    const cover = num(params, "lead_time") / DAY + 1;
    const safety = Math.round(num(params, "safety") * 1000);
    return {
      policyName: "Exponential smoothing",
      summary: `Forecast each day's demand by exponential smoothing with weight ${alpha}, and order up to the forecast over ${cover} days plus ${safety / 1000} units of safety stock.`,
      policy: [
        "-- Exponential smoothing: forecast each day's demand from what the last day",
        "-- used, and order up to the forecast over the lead time and the next review,",
        "-- plus safety stock.",
        `local ALPHA = ${alpha}`,
        `local COVER = ${cover}`,
        `local SAFETY = ${safety}`,
        "",
        "return {",
        "  on_review = function(ctx)",
        "    local here, memory = ctx.here, ctx.memory",
        "    local stock = here.stock.Goods or 0",
        "    local backorders = here.backorders and here.backorders.Goods or 0",
        "    local position = stock - backorders",
        "    for _, order in ipairs(here.on_order or {}) do",
        '      if order.resource == "Goods" then',
        "        position = position + order.amount",
        "      end",
        "    end",
        "    if memory.after ~= nil then",
        "      -- The fall in position since the last order is the last day's demand.",
        "      local used = memory.after - position",
        "      if memory.forecast == nil then",
        "        memory.forecast = used",
        "      else",
        "        memory.forecast = ALPHA * used + (1 - ALPHA) * memory.forecast",
        "      end",
        '      ctx.record("demand", used / 1000)',
        '      ctx.record("forecast", memory.forecast / 1000)',
        "    end",
        "    local target = math.floor((memory.forecast or 0) * COVER + SAFETY + 0.5)",
        "    local amount = 0",
        "    if target > position then",
        "      amount = target - position",
        '      ctx.order("Goods", amount)',
        "    end",
        "    memory.after = position + amount",
        "  end,",
        "}",
        "",
      ].join("\n"),
      values: {
        alpha,
        cover,
        lagBehindForecastDay: trend / alpha,
        lagBehindLatestDay: (trend * (1 - alpha)) / alpha,
      },
    };
  },
};

/**
 * Expected cost per day of a base-stock policy with Poisson demand and backorders, tick by tick
 * as the engine runs it: reviews one minute into each period, deliveries before the tick at their
 * arrival time, and costs on the stock or backlog left after each tick.
 */
function baseStockCostPerDay(params: TemplateParams, level: number): number {
  const rate = num(params, "demand") / DAY;
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
  return total / ticks + (ordering * DAY) / duration;
}

const serialChain: ClassicTemplate = {
  name: "classic.serial_chain",
  title: "Serial supply chain",
  defaults: {
    stages: 4,
    lead_time: 2 * DAY,
    review_period: DAY,
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
    duration: 60 * DAY,
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
  title: "Fixed-route delivery",
  defaults: {
    customers: 3,
    demand: 4,
    customer_capacity: 20,
    customer_initial: 10,
    distance: 600,
    vehicles: 1,
    vehicle_capacity: 30,
    speed: 5,
    lead_time: DAY,
    review_period: DAY,
    depot_initial: 60,
    lost_cost: 5,
    cost_per_distance: 0,
    duration: 20 * DAY,
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
  safetyStock,
  forecasting,
  serialChain,
  fixedRouteDelivery,
];
