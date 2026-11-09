import {
  batchSeeds,
  runAverages,
  runSimulation,
  type Scenario,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { classicTemplates, STARTER_SCRIPTS, templateCall } from "@regolith-rail/scenario-kit";
import { beforeAll, describe, expect, it } from "vitest";
import { LuaRuntime } from "./policy.ts";

// Claims the book's chapters make about the simulator, referred to from the chapters by title.

/**
 * A batch in the workbench takes one seed and gives each replication its own stream, derived
 * from the seed and the replication's number. These are the replications of seed 1.
 */
const REPLICATIONS = batchSeeds(1, 400);
const replication = (i: number) => REPLICATIONS[i] as number;

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

function metricsOver(scenarioId: string, source: string, seeds: number) {
  const result = validateScenario(starterScenarios.find((s) => s.id === scenarioId)?.document);
  if (!result.ok) throw new Error(`invalid starter ${scenarioId}`);
  const policy = runtime.createPolicy(source);
  try {
    return Array.from(
      { length: seeds },
      (_, i) =>
        runSimulation(result.scenario, policy, { seed: replication(i), detail: "summary" }).metrics,
    );
  } finally {
    policy.close();
  }
}

describe("chapter 1, modelling operations", () => {
  // Chapter 1 comes before replications, so each claim is about one run: steady demand, where the
  // seed changes nothing, or seed 1.
  const DRAIN_FILL = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {} },
}`;
  const BALANCE = BUILT_IN_POLICIES["balance-stock"];
  const TWO_STATION = STARTER_SCRIPTS["two-station"] as string;
  const STEADY = TWO_STATION.replace("variability = 20", "variability = 0");
  const withDays = (script: string, days: number) =>
    script.replace("duration = sols(10)", `duration = sols(${days})`);

  /** One run: its metrics, the loads at the mine and the time between the last mine stops. */
  function once(script: string, source: string, seed = 1) {
    const loaded = runtime.loadScript(script);
    if (!loaded.ok) throw new Error("the script should evaluate");
    const policy = runtime.createPolicy(source);
    try {
      const out = runSimulation(loaded.scenario, policy, { seed, detail: "summary" });
      const loads = out.events.flatMap((e) =>
        e.kind === "transfer" && e.station === "Mine" ? [e.amount / 1000] : [],
      );
      const arrivals = out.events.flatMap((e) =>
        e.kind === "arrival" && e.station === "Mine" ? [e.t / 3_600_000] : [],
      );
      const n = arrivals.length;
      const trip = ((arrivals[n - 1] as number) - (arrivals[n - 3] as number)) / 2;
      return { metrics: out.metrics, loads, trip, unmet: out.metrics.unmetDemand / 1000 };
    } finally {
      policy.close();
    }
  }
  const settled = (loads: number[]) => loads.slice(-10);

  it("on two-station with steady demand the drain-and-fill rule meets all demand, settling at 13.16 units a trip and a round trip of 8.77 hours, whatever the seed", () => {
    const run = once(STEADY, DRAIN_FILL);
    expect(run.unmet).toBe(0);
    expect(run.metrics.policyErrors).toBe(0);
    for (const load of settled(run.loads)) expect(load).toBeCloseTo(13.16, 1);
    expect(run.trip).toBeCloseTo(8.77, 2);
    expect(once(STEADY, DRAIN_FILL, 2).metrics).toEqual(run.metrics);
  });

  it("on two-station with steady demand balancing settles at 12.18 units a trip and a round trip of 8.74 hours, and from day 5 to day 20 leaves 2.53 units a day unmet while the mine stalls, whatever the seed", () => {
    const run = once(withDays(STEADY, 20), BALANCE);
    for (const load of settled(run.loads)) expect(load).toBeCloseTo(12.18, 1);
    expect(run.trip).toBeCloseTo(8.74, 2);
    const early = once(withDays(STEADY, 5), BALANCE);
    const rate = (run.unmet - early.unmet) / 15;
    expect(rate).toBeGreaterThan(2.5);
    expect(rate).toBeLessThan(2.56);
    const stalled = (run.metrics.stalledProduction - early.metrics.stalledProduction) / 1000 / 15;
    expect(stalled).toBeGreaterThan(11);
    expect(stalled).toBeLessThan(12);
    expect(once(withDays(STEADY, 20), BALANCE, 2).metrics).toEqual(run.metrics);
  });

  it("on two-station seed 1 with variable demand, balancing leaves 25.3 units unmet with loads between 11 and 14, and the drain-and-fill rule meets all demand", () => {
    const balance = once(TWO_STATION, BALANCE);
    expect(balance.unmet).toBeCloseTo(25.3, 1);
    for (const load of settled(balance.loads)) {
      expect(load).toBeGreaterThan(11);
      expect(load).toBeLessThan(14);
    }
    expect(once(TWO_STATION, DRAIN_FILL).unmet).toBe(0);
  });

  it("on two-station with steady demand and the line halved, balancing meets all demand at 6.84 units a trip", () => {
    const run = once(STEADY.replace("distances = 72000", "distances = 36000"), BALANCE);
    expect(run.unmet).toBe(0);
    for (const load of settled(run.loads)) expect(load).toBeCloseTo(6.84, 1);
  });

  it("on two-station with steady demand and 60-unit stations, balancing leaves 4.84 units unmet in the first five days and none after, and has come down to 13.16 units a trip by day 10", () => {
    const large = STEADY.replaceAll("small_station", "large_station");
    const run = once(large, BALANCE);
    for (const load of run.loads.slice(-3)) expect(load).toBeCloseTo(13.16, 1);
    expect(run.unmet).toBeCloseTo(4.84, 2);
    expect(once(withDays(large, 5), BALANCE).unmet).toBe(run.unmet);
  });
});

const DAY = 86_400_000;

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

describe("chapter 2, flows, rates and Little's law", () => {
  // Like chapter 1, each claim is about one run with steady demand, where the seed changes nothing.
  const DRAIN_FILL = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {} },
}`;
  const ROLES = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Junction = "relay", Dome = "demand" },
  target = { supply = ops.drain {}, relay = ops.pass_through {}, demand = ops.fill {} },
}`;
  const BALANCED = (STARTER_SCRIPTS["two-station"] as string)
    .replace("rate = 45", "rate = 36")
    .replace("variability = 20", "variability = 0");
  const RELAY = (STARTER_SCRIPTS.relay as string).replace("variability = 20", "variability = 0");
  const withDays = (script: string, days: number) =>
    script.replace("duration = sols(10)", `duration = sols(${days})`);
  const withSpeed = (script: string, speed: number) =>
    script.replace('start = "Mine" }', `start = "Mine", speed = ${speed} }`);
  const withStock = (script: string, units: number) =>
    script.replaceAll("stock = { Metals = 15 }", `stock = { Metals = ${units} }`);

  /** One run's long-run averages, in units, units a day and hours, with its metrics. */
  function averages(script: string, source: string, seed = 1) {
    const loaded = runtime.loadScript(script);
    if (!loaded.ok) throw new Error("the script should evaluate");
    const policy = runtime.createPolicy(source);
    try {
      const out = runSimulation(loaded.scenario, policy, { seed, detail: "full" });
      const av = runAverages(out);
      const site = (station: string) => {
        const s = av.sites.find((x) => x.station === station);
        if (!s) throw new Error(`no site at ${station}`);
        return {
          L: s.stock / 1000,
          outPerDay: s.outPerDay / 1000,
          hours: s.hours as number,
          waited: s.waitedHours as number,
        };
      };
      const line = av.line[0] as (typeof av.line)[number];
      return {
        site,
        stations: line.atStations / 1000,
        aboard: line.aboard / 1000,
        linePerDay: line.consumedPerDay / 1000,
        lineHours: line.hours as number,
        metrics: out.metrics,
      };
    } finally {
      policy.close();
    }
  }

  it("on two-station with the mine making 36 a day and steady demand, drain-and-fill keeps 30 units on the line, 20 hours a unit, with about 6.6 at the mine, 6.6 aboard and 16.8 at the dome over 20 days, whatever the seed", () => {
    const run = averages(withDays(BALANCED, 20), DRAIN_FILL);
    expect(run.metrics.unmetDemand).toBe(0);
    expect(run.metrics.stalledProduction).toBe(0);
    expect(run.stations + run.aboard).toBeCloseTo(30, 2);
    expect(run.lineHours).toBeCloseTo(20, 1);
    expect(run.site("Mine").L).toBeCloseTo(6.57, 2);
    expect(run.aboard).toBeCloseTo(6.63, 2);
    expect(run.site("Dome").L).toBeCloseTo(16.8, 2);
    expect(averages(withDays(BALANCED, 20), DRAIN_FILL, 2).metrics).toEqual(run.metrics);
  });

  it("on two-station with the mine making 36 a day, steady demand and the train at speed 10, drain-and-fill keeps 30 units on the line, 20 hours a unit, with about 3.4 at the mine, 3.5 aboard and 23.1 at the dome over 20 days", () => {
    const run = averages(withSpeed(withDays(BALANCED, 20), 10), DRAIN_FILL);
    expect(run.stations + run.aboard).toBeCloseTo(30, 2);
    expect(run.lineHours).toBeCloseTo(20, 1);
    expect(run.site("Mine").L).toBeCloseTo(3.43, 2);
    expect(run.aboard).toBeCloseTo(3.47, 2);
    expect(run.site("Dome").L).toBeCloseTo(23.1, 2);
  });

  it("on relay with steady demand, balancing keeps 13.29 units at the junction, where a unit waits 62.9 hours, and 6.27 at the dome, where a unit waits 4.53 hours; the line has 51.36 units in stock and delivers 32.86 a day, and the dome goes short", () => {
    const run = averages(RELAY, BUILT_IN_POLICIES["balance-stock"]);
    const junction = run.site("Junction");
    const dome = run.site("Dome");
    expect(junction.L).toBeCloseTo(13.29, 2);
    expect(junction.waited).toBeCloseTo(62.9, 1);
    expect(junction.outPerDay).toBeCloseTo(4.11, 2);
    expect(dome.L).toBeCloseTo(6.27, 2);
    expect(dome.waited).toBeCloseTo(4.53, 2);
    expect(run.stations).toBeCloseTo(44.11, 2);
    expect(run.aboard).toBeCloseTo(7.25, 2);
    expect(run.linePerDay).toBeCloseTo(32.86, 2);
    expect(run.metrics.unmetDemand).toBeGreaterThan(0);
  });

  it("on relay with steady demand, roles leave the junction empty and keep 23.00 units at the dome over 10 days, 16.24 hours of use, and 23.28 over 20; the line has 64.12 units in stock, delivers 34 a day and meets all demand", () => {
    const run = averages(RELAY, ROLES);
    expect(run.site("Junction").L).toBe(0);
    expect(run.site("Dome").L).toBeCloseTo(23.0, 2);
    expect(run.site("Dome").hours).toBeCloseTo(16.24, 2);
    expect(averages(withDays(RELAY, 20), ROLES).site("Dome").L).toBeCloseTo(23.28, 2);
    expect(run.stations).toBeCloseTo(42.98, 2);
    expect(run.aboard).toBeCloseTo(21.14, 2);
    expect(run.linePerDay).toBeCloseTo(34, 2);
    expect(run.metrics.unmetDemand).toBe(0);
  });

  it("on two-station with the mine making 36 a day, steady demand and the train at speed 2, drain-and-fill delivers 32.48 units a day, under the bound of 33.75, and the dome goes short", () => {
    const run = averages(withSpeed(BALANCED, 2), DRAIN_FILL);
    expect(run.linePerDay).toBeCloseTo(32.48, 2);
    expect(run.linePerDay).toBeLessThan(33.75);
    expect(run.metrics.unmetDemand).toBeGreaterThan(0);
  });

  it("on two-station with the mine making 36 a day and steady demand, starting with 10 units at each station, drain-and-fill keeps 20 units on the line, 13.33 hours a unit, with about 6.9 at the dome", () => {
    const run = averages(withStock(BALANCED, 10), DRAIN_FILL);
    expect(run.metrics.unmetDemand).toBe(0);
    expect(run.stations + run.aboard).toBeCloseTo(20, 2);
    expect(run.lineHours).toBeCloseTo(13.33, 2);
    expect(run.site("Dome").L).toBeCloseTo(6.86, 2);
  });
});

/** Mean and sample standard deviation. */
function spread(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (values.length - 1);
  return { mean, sd: Math.sqrt(variance) };
}

describe("chapter 3, randomness and simulation", () => {
  const DRAIN_FILL = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {} },
}`;
  /** Sample correlation between two paired samples. */
  const correlation = (x: number[], y: number[]) => {
    const a = spread(x);
    const b = spread(y);
    const cov = x.reduce((sum, v, i) => sum + (v - a.mean) * ((y[i] as number) - b.mean), 0);
    return cov / (x.length - 1) / (a.sd * b.sd);
  };

  it("on two-station over 100 replications the sample mean of unmet demand under balancing is 28 units with a standard error of 0.3, single runs range over more than 10 units, and the drain-and-fill rule meets all demand in every replication", () => {
    const balance = metricsOver("two-station", BUILT_IN_POLICIES["balance-stock"], 100).map(
      (m) => m.unmetDemand / 1000,
    );
    const { mean: average, sd } = spread(balance);
    expect(average).toBeGreaterThan(27.5);
    expect(average).toBeLessThan(28.5);
    expect(sd / 10).toBeGreaterThan(0.28);
    expect(sd / 10).toBeLessThan(0.34);
    expect(Math.max(...balance) - Math.min(...balance)).toBeGreaterThan(10);
    for (const m of metricsOver("two-station", DRAIN_FILL, 100)) expect(m.unmetDemand).toBe(0);
  }, 300_000);

  it("on two-station over 100 replications the two policies' stalled production rises and falls together with a correlation of about 0.8, so paired differences spread a fifth less than independent runs, while their empty running moves in opposite directions and pairing spreads more", () => {
    const balance = metricsOver("two-station", BUILT_IN_POLICIES["balance-stock"], 100);
    const drainFill = metricsOver("two-station", DRAIN_FILL, 100);
    const compare = (pick: (m: (typeof balance)[number]) => number) => {
      const a = balance.map(pick);
      const b = drainFill.map(pick);
      const paired = spread(b.map((v, i) => v - (a[i] as number))).sd;
      const independent = Math.sqrt(spread(a).sd * spread(a).sd + spread(b).sd * spread(b).sd);
      return { correlation: correlation(a, b), ratio: paired / independent };
    };
    const stalled = compare((m) => m.stalledProduction / 1000);
    expect(stalled.correlation).toBeGreaterThan(0.7);
    expect(stalled.correlation).toBeLessThan(0.85);
    expect(stalled.ratio).toBeGreaterThan(0.75);
    expect(stalled.ratio).toBeLessThan(0.85);
    const empty = compare((m) => m.emptyDistanceShare);
    expect(empty.correlation).toBeLessThan(0);
    expect(empty.ratio).toBeGreaterThan(1);
  }, 300_000);

  it("on two-station the same replication draws the same demand under balancing and under drain-and-fill", () => {
    const demand = (source: string) =>
      metricsOver("two-station", source, 100).map((m) => m.demandMet + m.unmetDemand);
    expect(demand(BUILT_IN_POLICIES["balance-stock"])).toEqual(demand(DRAIN_FILL));
  }, 300_000);

  it("on two-station under drain-and-fill the demand met over 25, 100 and 400 replications has means 360.46, 360.42 and 360.26 and standard deviations 3.83, 3.70 and 3.80, and each 95% interval, of half-width 1.58, 0.73 and 0.37, contains 360", () => {
    const met = metricsOver("two-station", DRAIN_FILL, 400).map((m) => m.demandMet / 1000);
    const expected = [
      { n: 25, mean: 360.46, sd: 3.83, t: 2.064, half: 1.58 },
      { n: 100, mean: 360.42, sd: 3.7, t: 1.984, half: 0.73 },
      { n: 400, mean: 360.26, sd: 3.8, t: 1.966, half: 0.37 },
    ];
    for (const { n, mean: m, sd, t, half } of expected) {
      const sample = spread(met.slice(0, n));
      expect(sample.mean).toBeCloseTo(m, 2);
      expect(sample.sd).toBeCloseTo(sd, 2);
      const halfWidth = (t * sample.sd) / Math.sqrt(n);
      expect(halfWidth).toBeCloseTo(half, 2);
      expect(Math.abs(sample.mean - 360)).toBeLessThan(halfWidth);
    }
  }, 300_000);

  it("on two-station under balancing unmet demand has sample mean 27.97 and sample standard deviation 3.00 over 100 replications, and 28.42 and 2.55 over the first 10", () => {
    const unmet = metricsOver("two-station", BUILT_IN_POLICIES["balance-stock"], 100).map(
      (m) => m.unmetDemand / 1000,
    );
    const hundred = spread(unmet);
    expect(hundred.mean).toBeCloseTo(27.97, 2);
    expect(hundred.sd).toBeCloseTo(3.0, 2);
    const ten = spread(unmet.slice(0, 10));
    expect(ten.mean).toBeCloseTo(28.42, 2);
    expect(ten.sd).toBeCloseTo(2.55, 2);
  }, 300_000);

  it("on two-station over 100 replications stalled production has mean 109.3 and standard deviation 0.92 under balancing and mean 48.4 and standard deviation 3.59 under drain-and-fill, with correlation 0.79, and the paired differences have mean 60.9 and standard deviation 2.92, against 3.71 for independent replications", () => {
    const stalled = (source: string) =>
      metricsOver("two-station", source, 100).map((m) => m.stalledProduction / 1000);
    const a = stalled(BUILT_IN_POLICIES["balance-stock"]);
    const b = stalled(DRAIN_FILL);
    expect(spread(a).mean).toBeCloseTo(109.3, 1);
    expect(spread(a).sd).toBeCloseTo(0.92, 2);
    expect(spread(b).mean).toBeCloseTo(48.4, 1);
    expect(spread(b).sd).toBeCloseTo(3.59, 2);
    expect(correlation(a, b)).toBeCloseTo(0.79, 2);
    const paired = spread(a.map((v, i) => v - (b[i] as number)));
    expect(paired.mean).toBeCloseTo(60.9, 1);
    expect(paired.sd).toBeCloseTo(2.92, 2);
    const sdA = spread(a).sd;
    const sdB = spread(b).sd;
    expect(Math.sqrt(sdA * sdA + sdB * sdB)).toBeCloseTo(3.71, 2);
  }, 300_000);
});

describe("chapter 6, reviews, lead times and base-stock", () => {
  // The Shop of chapter 4 with Poisson demand, a lead time of one day and no order cost. It starts
  // with its base-stock level on hand.
  const shop = (days: number) => ({
    random: true,
    demand: 10,
    lead_time: DAY,
    order_cost: 0,
    initial: 15,
    duration: days * DAY,
  });
  const orderUpTo = (level: number) =>
    `return ops.policy { review = { target = ops.order_up_to { level = ${level * 1000} } } }`;
  const costsPerDay = (days: number, source: string, replications: number) => {
    const loaded = runtime.loadScript(templateCall("classic.reorder", shop(days)));
    if (!loaded.ok) throw new Error("the template should evaluate");
    const policy = runtime.createPolicy(source);
    try {
      return Array.from({ length: replications }, (_, i) => {
        const out = runSimulation(loaded.scenario, policy, {
          seed: replication(i),
          detail: "summary",
        });
        return out.metrics.costs.total / 1000 / days;
      });
    } finally {
      policy.close();
    }
  };

  it("the reorder template's base-stock reference for the Shop with a 1-day lead time orders up to 15 and expects 6.20 a day over 60 days", () => {
    const reference = classicTemplates
      .find((t) => t.name === "classic.reorder")
      ?.reference(shop(60));
    expect(reference?.values.level).toBe(15);
    expect(reference?.expectedCostPerDay as number).toBeCloseTo(6.2, 2);
  });

  it("on the Shop with a 1-day lead time, over 200 replications of 60 days, ordering up to 14, 15 and 16 costs about 6.16, 6.14 and 6.52 a day, and the paired differences from 15 have less than half the standard deviation of independent replications", () => {
    const costs = new Map(
      [14, 15, 16].map((level) => [level, costsPerDay(60, orderUpTo(level), 200)]),
    );
    const at = (level: number) => costs.get(level) as number[];
    expect(Math.abs(spread(at(14)).mean - 6.164)).toBeLessThan(0.01);
    expect(Math.abs(spread(at(15)).mean - 6.135)).toBeLessThan(0.01);
    expect(Math.abs(spread(at(16)).mean - 6.523)).toBeLessThan(0.01);
    for (const other of [14, 16]) {
      const paired = spread(at(other).map((cost, i) => cost - (at(15)[i] as number))).sd;
      const sdA = spread(at(other)).sd;
      const sdB = spread(at(15)).sd;
      expect(paired).toBeLessThan(Math.sqrt(sdA * sdA + sdB * sdB) / 2);
    }
    // Ordering up to 16 costs more than 15: the interval for the paired difference excludes zero.
    const difference = spread(at(16).map((cost, i) => cost - (at(15)[i] as number)));
    expect(difference.mean).toBeCloseTo(0.39, 2);
    expect(difference.mean - (1.972 * difference.sd) / Math.sqrt(200)).toBeGreaterThan(0);
  }, 600_000);

  it("on the Shop with a 1-day lead time, ordering up to 15 from the stock on hand costs about 100 a day over 100 replications of 30 days, more than fifteen times the cost of ordering from the inventory position", () => {
    const position = mean(costsPerDay(30, orderUpTo(15), 100));
    const onHand = mean(
      costsPerDay(
        30,
        `return { on_review = function(ctx)
  local short = 15000 - ctx.here.stock.Goods
  if short > 0 then ctx.order("Goods", short) end
end }`,
        100,
      ),
    );
    expect(onHand).toBeGreaterThan(95);
    expect(onHand).toBeLessThan(106);
    expect(onHand).toBeGreaterThan(15 * position);
  }, 600_000);
});

describe("chapter 6, the double dispatch case study", () => {
  const ROLES = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Factory = "demand", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {} },
}`;
  const LOOKAHEAD = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Factory = "demand", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {} },
  plan = ops.lookahead {},
}`;
  const means = (source: string) => {
    const runs = metricsOver("two-trains", source, 100);
    const mean = (pick: (m: (typeof runs)[number]) => number) =>
      runs.reduce((sum, m) => sum + pick(m), 0) / runs.length;
    return {
      unmet: mean((m) => m.unmetDemand),
      empty: mean((m) => m.emptyDistanceShare),
      clear: runs.filter((m) => m.unmetDemand === 0).length,
    };
  };

  it("on two-trains over 100 replications, roles leave less than a tenth of the balancing baseline's unmet demand, and adding lookahead leaves more unmet demand than roles alone with over three times the empty running", () => {
    const baseline = means(BUILT_IN_POLICIES["balance-stock"]);
    const roles = means(ROLES);
    const lookahead = means(LOOKAHEAD);
    expect(roles.unmet).toBeLessThan(baseline.unmet / 10);
    expect(lookahead.unmet).toBeGreaterThan(roles.unmet);
    expect(lookahead.empty).toBeGreaterThan(3 * roles.empty);
    expect(roles.clear).toBeGreaterThan(baseline.clear);
  }, 600_000);
});

describe("chapter 4, order quantities", () => {
  it("on steady-demand classic.reorder reviewed every minute, ordering 10 or 40 at a time costs 25 a day, and ordering 20 costs 20, each within one cost unit", () => {
    const loaded = runtime.loadScript(templateCall("classic.reorder", { review_period: 60_000 }));
    if (!loaded.ok) throw new Error("the template should evaluate");
    const costPerDay = (quantity: number) => {
      // Reorder when the position falls below what one minute of demand needs.
      const policy = runtime.createPolicy(
        `return ops.policy { review = { target = ops.min_max { min = 7, max = ${7 + quantity * 1000} } } }`,
      );
      try {
        const out = runSimulation(loaded.scenario, policy, { detail: "summary" });
        expect(out.metrics.unmetDemand).toBe(0);
        return out.metrics.costs.total / 1000 / 20;
      } finally {
        policy.close();
      }
    };
    expect(Math.abs(costPerDay(20) - 20)).toBeLessThan(1);
    expect(Math.abs(costPerDay(10) - 25)).toBeLessThan(1);
    expect(Math.abs(costPerDay(40) - 25)).toBeLessThan(1);
  }, 120_000);

  it("on classic.reorder with its hourly reviews, ordering 10, 20 and 40 at a time costs 25.2, 20.4 and 25.4 a day, each between the model's cost and its bound, and meets all demand", () => {
    const loaded = runtime.loadScript(templateCall("classic.reorder", {}));
    if (!loaded.ok) throw new Error("the template should evaluate");
    const costPerDay = (quantity: number) => {
      const policy = runtime.createPolicy(
        `return ops.policy { review = { target = ops.min_max { min = 417, max = ${417 + quantity * 1000} } } }`,
      );
      try {
        const out = runSimulation(loaded.scenario, policy, { detail: "summary" });
        expect(out.metrics.unmetDemand).toBe(0);
        return out.metrics.costs.total / 1000 / 20;
      } finally {
        policy.close();
      }
    };
    const model = (quantity: number) => 200 / quantity + quantity / 2;
    for (const [quantity, cost] of [
      [10, 25.2],
      [20, 20.4],
      [40, 25.4],
    ] as const) {
      const simulated = costPerDay(quantity);
      expect(simulated).toBeCloseTo(cost, 1);
      expect(simulated).toBeGreaterThan(model(quantity));
      expect(simulated).toBeLessThan(model(quantity) + 10 / 24);
    }
  }, 120_000);
});

describe("chapter 7, the storm shock case study", () => {
  const HOUR = 3_600_000;
  const FILL = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {} },
}`;
  const MIN_MAX = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.min_max { min = 20000, max = 30000 } },
}`;

  /**
   * The dome's stock when the storm begins, when and for how long its station stands empty,
   * and unmet demand, averaged over seeds.
   */
  function domeOver(source: string, seeds: number) {
    const result = validateScenario(starterScenarios.find((s) => s.id === "storm-shock")?.document);
    if (!result.ok) throw new Error("invalid starter storm-shock");
    const policy = runtime.createPolicy(source);
    try {
      const runs = Array.from({ length: seeds }, (_, i) => {
        const out = runSimulation(result.scenario, policy, {
          seed: replication(i),
          detail: "full",
        });
        const stock = out.stock as Int32Array;
        const sites = out.sites.length;
        const rows = stock.length / sites;
        const dome = out.sites.findIndex((s) => s.station === "Dome");
        const at = (ms: number) =>
          (stock[Math.floor(ms / out.tickMs) * sites + dome] as number) / 1000;
        let empty = 0;
        let emptyAfterStorm = 0;
        let first = -1;
        let last = 0;
        let sum = 0;
        for (let r = 0; r < rows; r++) {
          const level = stock[r * sites + dome] as number;
          sum += level;
          if (level > 0) continue;
          empty++;
          last = r;
          if (first < 0) first = r;
          if (r * out.tickMs > 5 * DAY) emptyAfterStorm++;
        }
        return {
          atStorm: at(3 * DAY),
          average: sum / rows / 1000,
          emptyHours: (empty * out.tickMs) / HOUR,
          emptyAfterStormHours: (emptyAfterStorm * out.tickMs) / HOUR,
          firstEmptyDay: first < 0 ? Number.POSITIVE_INFINITY : (first * out.tickMs) / DAY,
          lastEmptyDay: (last * out.tickMs) / DAY,
          unmet: out.metrics.unmetDemand / 1000,
        };
      });
      const over = (pick: (r: (typeof runs)[number]) => number) => mean(runs.map(pick));
      return {
        atStorm: over((r) => r.atStorm),
        average: over((r) => r.average),
        emptyHours: over((r) => r.emptyHours),
        emptyAfterStormHours: over((r) => r.emptyAfterStormHours),
        firstEmptyDay: over((r) => r.firstEmptyDay),
        lastEmptyDay: over((r) => r.lastEmptyDay),
        unmet: over((r) => r.unmet),
      };
    } finally {
      policy.close();
    }
  }

  it("on storm-shock over 50 replications the balancing baseline holds about 10 units at the dome when the storm begins, the dome runs dry about 17 hours in and stands empty for about 24 hours, into the day after the storm, and about 53 units go unmet", () => {
    const dome = domeOver(BUILT_IN_POLICIES["balance-stock"], 50);
    expect(dome.atStorm).toBeGreaterThan(8.5);
    expect(dome.atStorm).toBeLessThan(10.5);
    expect(dome.firstEmptyDay).toBeGreaterThan(3.6);
    expect(dome.firstEmptyDay).toBeLessThan(3.8);
    expect(dome.emptyHours).toBeGreaterThan(22);
    expect(dome.emptyHours).toBeLessThan(26);
    expect(dome.lastEmptyDay).toBeGreaterThan(5);
    expect(dome.unmet).toBeGreaterThan(50);
    expect(dome.unmet).toBeLessThan(56);
  }, 600_000);

  it("on storm-shock over 50 replications keeping the dome full holds about 23 units there when the storm begins, the dome stands empty for under 2 hours, none of it after the storm, and about 4 units go unmet, while a min-max target of 20 to 30 holds 19 on average and leaves about 12", () => {
    const full = domeOver(FILL, 50);
    expect(full.atStorm).toBeGreaterThan(22);
    expect(full.atStorm).toBeLessThan(24.5);
    expect(full.emptyHours).toBeLessThan(2);
    expect(full.emptyAfterStormHours).toBe(0);
    expect(full.firstEmptyDay).toBeGreaterThan(4.8);
    expect(full.unmet).toBeGreaterThan(3);
    expect(full.unmet).toBeLessThan(6);
    const minMax = domeOver(MIN_MAX, 50);
    expect(minMax.average).toBeGreaterThan(18);
    expect(minMax.average).toBeLessThan(20);
    expect(minMax.unmet).toBeGreaterThan(10);
    expect(minMax.unmet).toBeLessThan(14);
  }, 600_000);
});

describe("chapter 8, forecasting", () => {
  // The Shop's demand starts at 10 a day and grows by 1 a day, without noise, so each claim is
  // about one run.
  const template = classicTemplates.find((t) => t.name === "classic.forecasting");
  const shop = (params: Record<string, number>) => ({ level: 10, ...params });
  const run = (params: Record<string, number>, detail: "full" | "summary") => {
    const loaded = runtime.loadScript(templateCall("classic.forecasting", shop(params)));
    if (!loaded.ok) throw new Error("the template should evaluate");
    const policy = runtime.createPolicy(template?.reference(shop(params)).policy ?? "");
    try {
      return runSimulation(loaded.scenario, policy, { detail });
    } finally {
      policy.close();
    }
  };
  /** Days from 40 to 59 on which some demand is backordered. */
  const waitingDays = (params: Record<string, number>) => {
    const out = run(params, "full");
    const backorders = out.backorders as Int32Array;
    const perDay = DAY / out.tickMs;
    let days = 0;
    for (let day = 40; day < 60; day++) {
      if (backorders.subarray(day * perDay, (day + 1) * perDay).some((b) => b > 0)) days++;
    }
    return days;
  };

  it("on classic.forecasting with a starting demand of 10, from day 40 each smoothed forecast is within 0.01 of 5 below the demand of the day it forecasts and 4 below the latest demand", () => {
    const out = run({}, "summary");
    const forecast = out.records.forecast;
    const used = out.records.demand;
    if (!forecast || !used) throw new Error("the reference policy should record its forecasts");
    let checked = 0;
    forecast.t.forEach((t, i) => {
      const day = Math.floor(t / DAY);
      if (day < 40) return;
      const f = forecast.v[i] as number;
      expect(used.v[i]).toBeCloseTo(10 + (day - 1), 6);
      expect(Math.abs(10 + day - f - 5)).toBeLessThan(0.01);
      expect(Math.abs(10 + (day - 1) - f - 4)).toBeLessThan(0.01);
      checked++;
    });
    expect(checked).toBe(20);
  });

  it("on classic.forecasting with a starting demand of 10, the smoothing policy leaves demand backordered on every day from 40 to 59 with a safety stock of 17 units, and on none of them with 18", () => {
    expect(waitingDays({ safety: 17 })).toBe(20);
    expect(waitingDays({ safety: 18 })).toBe(0);
  }, 120_000);

  it("on classic.forecasting with a starting demand of 10 and alpha 0.5, the smoothing policy leaves demand backordered on every day from 40 to 59 with a safety stock of 8 units, and on none of them with 9", () => {
    expect(waitingDays({ alpha: 0.5, safety: 8 })).toBe(20);
    expect(waitingDays({ alpha: 0.5, safety: 9 })).toBe(0);
  }, 120_000);
});

describe("simulator exercises", () => {
  const DRAIN_FILL = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {} },
}`;
  const orderUpTo = (level: number) =>
    `return ops.policy { review = { target = ops.order_up_to { level = ${level} } } }`;
  const load = (source: string) => {
    const loaded = runtime.loadScript(source);
    if (!loaded.ok) throw new Error("the script should evaluate");
    return loaded.scenario;
  };
  const costsPerDay = (scenario: Scenario, source: string, seeds: number, days: number) => {
    const policy = runtime.createPolicy(source);
    try {
      return Array.from({ length: seeds }, (_, i) => {
        const out = runSimulation(scenario, policy, { seed: replication(i), detail: "summary" });
        return out.metrics.costs.total / 1000 / days;
      });
    } finally {
      policy.close();
    }
  };
  /** The share of review cycles ending with no one waiting, averaged over seeds. */
  const cycleServiceLevel = (scenario: Scenario, level: number, seeds: number) => {
    const policy = runtime.createPolicy(orderUpTo(level * 1000));
    try {
      return mean(
        Array.from({ length: seeds }, (_, i) => {
          const out = runSimulation(scenario, policy, { seed: replication(i), detail: "full" });
          const site = out.sites.findIndex((s) => s.station === "Shop" && s.resource === "Goods");
          const deliveries = out.events.filter((e) => e.kind === "delivery").slice(1);
          const backorders = out.backorders as Int32Array;
          const met = deliveries.filter(
            (d) => backorders[(d.t / out.tickMs - 1) * out.sites.length + site] === 0,
          ).length;
          return met / deliveries.length;
        }),
      );
    } finally {
      policy.close();
    }
  };

  it("on two-station over 10 replications the paired difference in unmet demand between the drain-and-fill rule and balancing is about 28 units with a 95% half-width under 2, so ten replications already leave out zero", () => {
    const balance = metricsOver("two-station", BUILT_IN_POLICIES["balance-stock"], 10);
    const drainFill = metricsOver("two-station", DRAIN_FILL, 10);
    const difference = spread(
      drainFill.map(
        (m, i) => (m.unmetDemand - (balance[i] as (typeof balance)[number]).unmetDemand) / 1000,
      ),
    );
    expect(difference.mean).toBeLessThan(-27);
    expect(difference.mean).toBeGreaterThan(-30);
    // t for 9 degrees of freedom at 97.5%.
    const half = (2.262 * difference.sd) / Math.sqrt(10);
    expect(half).toBeLessThan(2);
    expect(difference.mean + half).toBeLessThan(0);
  }, 120_000);

  it("on classic.reorder with hourly reviews, ordering 30 at a time costs about 22.8 a day against the model's 21.67, because a 20-day run places 7 orders", () => {
    const scenario = load(templateCall("classic.reorder", {}));
    const policy = runtime.createPolicy(
      "return ops.policy { review = { target = ops.min_max { min = 417, max = 30417 } } }",
    );
    try {
      const out = runSimulation(scenario, policy, { detail: "summary" });
      expect(out.metrics.unmetDemand).toBe(0);
      const perDay = out.metrics.costs.total / 1000 / 20;
      expect(perDay).toBeGreaterThan(22.5);
      expect(perDay).toBeLessThan(23.1);
      expect(out.metrics.costs.ordering / 1000).toBe(7 * 20);
    } finally {
      policy.close();
    }
  }, 120_000);

  it("on classic.newsvendor over 100 replications ordering 15 costs about 41 a day, 20 about 43 and 10 about 48, each within a unit of the model", () => {
    const scenario = load(templateCall("classic.newsvendor", {}));
    const at = (units: number) => mean(costsPerDay(scenario, orderUpTo(units * 1000), 100, 30));
    const [ten, fifteen, twenty] = [at(10), at(15), at(20)];
    expect(Math.abs(fifteen - 370 / 9)).toBeLessThan(1);
    expect(Math.abs(twenty - 385 / 9)).toBeLessThan(1);
    expect(Math.abs(ten - 430 / 9)).toBeLessThan(1);
    expect(fifteen).toBeLessThan(twenty);
    expect(twenty).toBeLessThan(ten);
  }, 300_000);

  it("on classic.newsvendor over 100 replications, ordering 10, 15 and 20 costs 48.22, 41.15 and 42.79 a day on average, and each 95% interval contains the model's expected cost", () => {
    const scenario = load(templateCall("classic.newsvendor", {}));
    for (const [units, cost, model] of [
      [10, 48.22, 430 / 9],
      [15, 41.15, 370 / 9],
      [20, 42.79, 385 / 9],
    ] as const) {
      const sample = spread(costsPerDay(scenario, orderUpTo(units * 1000), 100, 30));
      expect(sample.mean).toBeCloseTo(cost, 2);
      // t for 99 degrees of freedom at 97.5%.
      expect(Math.abs(sample.mean - model)).toBeLessThan((1.984 * sample.sd) / 10);
    }
  }, 300_000);

  it("on classic.newsvendor with a lost-demand cost of 10, ordering 20 costs about 45.6 a day over 100 replications, less than ordering 15 or 25", () => {
    const scenario = load(templateCall("classic.newsvendor", { lost_cost: 10 }));
    const at = (units: number) => mean(costsPerDay(scenario, orderUpTo(units * 1000), 100, 30));
    const twenty = at(20);
    expect(twenty).toBeGreaterThan(45);
    expect(twenty).toBeLessThan(46.5);
    expect(twenty).toBeLessThan(at(15));
    expect(twenty).toBeLessThan(at(25));
  }, 300_000);

  it("on classic.reorder with a 1-day lead time the reference orders up to 8 and expects 4.81 a day, and over 100 replications the simulated cost agrees within its interval", () => {
    const params = {
      random: true,
      demand: 4,
      lead_time: DAY,
      review_period: 6 * 3_600_000,
      order_cost: 0,
      duration: 30 * DAY,
    };
    const reference = classicTemplates.find((t) => t.name === "classic.reorder")?.reference(params);
    expect(reference?.values.level).toBe(8);
    const analytic = reference?.expectedCostPerDay as number;
    expect(Math.round(analytic * 100) / 100).toBe(4.81);
    const costs = spread(
      costsPerDay(load(templateCall("classic.reorder", params)), orderUpTo(8000), 100, 30),
    );
    // 99% interval, t for 99 degrees of freedom.
    expect(Math.abs(costs.mean - analytic)).toBeLessThan((2.626 * costs.sd) / 10);
  }, 300_000);

  it("on classic.safety_stock over 200 replications level 113 meets a 0.95 cycle service level with the variable lead time and level 106 meets it with a fixed 2-day lead time, while 106 with the variable lead time reaches only about 0.88", () => {
    const variable = load(templateCall("classic.safety_stock", {}));
    const fixed = load(templateCall("classic.safety_stock", { lead_time: 2 * DAY }));
    expect(
      classicTemplates
        .find((t) => t.name === "classic.safety_stock")
        ?.reference({ lead_time: 2 * DAY }).values.level,
    ).toBe(106);
    expect(cycleServiceLevel(variable, 113, 200)).toBeGreaterThan(0.95);
    expect(cycleServiceLevel(fixed, 106, 200)).toBeGreaterThan(0.95);
    const short = cycleServiceLevel(variable, 106, 200);
    expect(short).toBeGreaterThan(0.86);
    expect(short).toBeLessThan(0.9);
  }, 600_000);

  it("on classic.safety_stock over 200 replications the share of cycles that end without backorders is 0.962 at level 113, 0.881 at 106 and 0.989 at 121, and 0.959 at 106 with a fixed 2-day lead time, and at 113 the mean backorders at the end of a cycle are 0.24 units", () => {
    const variable = load(templateCall("classic.safety_stock", {}));
    const fixed = load(templateCall("classic.safety_stock", { lead_time: 2 * DAY }));
    expect(cycleServiceLevel(variable, 113, 200)).toBeCloseTo(0.962, 3);
    expect(cycleServiceLevel(variable, 106, 200)).toBeCloseTo(0.881, 3);
    expect(cycleServiceLevel(variable, 121, 200)).toBeCloseTo(0.989, 3);
    expect(cycleServiceLevel(fixed, 106, 200)).toBeCloseTo(0.959, 3);
    const policy = runtime.createPolicy(orderUpTo(113_000));
    try {
      let short = 0;
      let cycles = 0;
      for (let i = 0; i < 200; i++) {
        const out = runSimulation(variable, policy, { seed: replication(i), detail: "full" });
        const site = out.sites.findIndex((s) => s.station === "Shop" && s.resource === "Goods");
        const backorders = out.backorders as Int32Array;
        for (const d of out.events.filter((e) => e.kind === "delivery").slice(1)) {
          short += (backorders[(d.t / out.tickMs - 1) * out.sites.length + site] as number) / 1000;
          cycles++;
        }
      }
      expect(short / cycles).toBeCloseTo(0.24, 2);
    } finally {
      policy.close();
    }
  }, 900_000);

  it("on classic.safety_stock over 200 replications level 121 meets a 0.99 cycle service level", () => {
    const template = classicTemplates.find((t) => t.name === "classic.safety_stock");
    expect(template?.reference({ target_service: 0.99 }).values.level).toBe(121);
    expect(
      cycleServiceLevel(load(templateCall("classic.safety_stock", {})), 121, 200),
    ).toBeGreaterThan(0.985);
  }, 600_000);
});
