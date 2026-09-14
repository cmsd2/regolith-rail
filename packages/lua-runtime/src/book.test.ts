import {
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
      (_, i) => runSimulation(result.scenario, policy, { seed: i + 1, detail: "summary" }).metrics,
    );
  } finally {
    policy.close();
  }
}

describe("chapter 1, modelling operations", () => {
  it("on two-station the balancing baseline leaves demand unmet while the mine's production stalls, on each of 20 seeds", () => {
    for (const metrics of metricsOver("two-station", BUILT_IN_POLICIES["balance-stock"], 20)) {
      expect(metrics.unmetDemand).toBeGreaterThan(0);
      expect(metrics.stalledProduction).toBeGreaterThan(0);
    }
  });

  it("on two-station taking everything from the mine and leaving everything at the dome meets all demand on each of 20 seeds", () => {
    const fix = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {} },
}`;
    for (const metrics of metricsOver("two-station", fix, 20)) {
      expect(metrics.unmetDemand).toBe(0);
      expect(metrics.policyErrors).toBe(0);
    }
  });
});

const DAY = 86_400_000;

/** A run's average stock at each station, its average cargo, and its metrics, over seeds. */
function stockOver(scenarioId: string, source: string, seeds: number) {
  const result = validateScenario(starterScenarios.find((s) => s.id === scenarioId)?.document);
  if (!result.ok) throw new Error(`invalid starter ${scenarioId}`);
  const policy = runtime.createPolicy(source);
  try {
    return Array.from({ length: seeds }, (_, i) => {
      const out = runSimulation(result.scenario, policy, { seed: i + 1, detail: "full" });
      const stock = out.stock as Int32Array;
      const rows = stock.length / out.sites.length;
      const stations: Record<string, number> = {};
      out.sites.forEach((site, s) => {
        let sum = 0;
        for (let r = 0; r < rows; r++) sum += stock[r * out.sites.length + s] as number;
        stations[site.station] = sum / rows / 1000;
      });
      const cargo = (out.cargo as Int32Array).reduce((a, b) => a + b, 0) / rows / 1000;
      return { stations, cargo, metrics: out.metrics, days: out.durationMs / DAY };
    });
  } finally {
    policy.close();
  }
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

describe("chapter 2, flows, rates and Little's law", () => {
  const ROLES = `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Junction = "relay", Dome = "demand" },
  target = { supply = ops.drain {}, relay = ops.pass_through {}, demand = ops.fill {} },
}`;

  /**
   * Little's law measured at one station: L from the stock trace, lambda from what left,
   * and W by following each unit first in, first out from its arrival to its departure.
   * Units still there when the run ends have not left, so their waits are not counted.
   */
  function littleAt(source: string, seed: number, station: string) {
    const result = validateScenario(starterScenarios.find((s) => s.id === "relay")?.document);
    if (!result.ok) throw new Error("invalid starter relay");
    const policy = runtime.createPolicy(source);
    try {
      const out = runSimulation(result.scenario, policy, { seed, detail: "full" });
      const sites = out.sites.length;
      const site = out.sites.findIndex((s) => s.station === station);
      const stock = out.stock as Int32Array;
      const rows = stock.length / sites;
      const unloaded = new Map<number, number>();
      const loaded = new Map<number, number>();
      for (const e of out.events) {
        if (e.kind !== "transfer" || e.station !== station) continue;
        const r = Math.floor(e.t / out.tickMs);
        if (e.amount < 0) unloaded.set(r, (unloaded.get(r) ?? 0) - e.amount);
        else loaded.set(r, (loaded.get(r) ?? 0) + e.amount);
      }
      const queue: [number, number][] = [[0, stock[site] as number]];
      let waited = 0;
      let left = 0;
      let sum = 0;
      for (let r = 0; r < rows - 1; r++) {
        const before = stock[r * sites + site] as number;
        const after = stock[(r + 1) * sites + site] as number;
        sum += before;
        const u = unloaded.get(r) ?? 0;
        const l = loaded.get(r) ?? 0;
        // What is neither unloaded nor loaded was produced or consumed here.
        const net = after - before - u + l;
        const arrived = u + Math.max(0, net);
        let leaving = l + Math.max(0, -net);
        if (arrived > 0) queue.push([r * out.tickMs, arrived]);
        const now = (r + 1) * out.tickMs;
        while (leaving > 0 && queue.length > 0) {
          const head = queue[0] as [number, number];
          const take = Math.min(leaving, head[1]);
          waited += take * (now - head[0]);
          left += take;
          leaving -= take;
          head[1] -= take;
          if (head[1] === 0) queue.shift();
        }
      }
      const days = ((rows - 1) * out.tickMs) / DAY;
      const L = sum / (rows - 1) / 1000;
      const lambda = left / 1000 / days;
      const hours = waited / left / 3_600_000;
      return { L, lambda, hours, lambdaW: (lambda * hours) / 24 };
    } finally {
      policy.close();
    }
  }

  it("on relay seed 1 under balancing, following each unit first in first out, the dome holds 6.4 units, uses 32.3 a day and a unit waits 4.7 hours there, so lambda W is within 3% of L, while at the junction a unit waits about 54 hours and lambda W comes to four fifths of L, and under roles a unit waits 15 hours at the dome", () => {
    const dome = littleAt(BUILT_IN_POLICIES["balance-stock"], 1, "Dome");
    expect(dome.L).toBeGreaterThan(6.2);
    expect(dome.L).toBeLessThan(6.7);
    expect(dome.lambda).toBeGreaterThan(32);
    expect(dome.lambda).toBeLessThan(32.6);
    expect(dome.hours).toBeGreaterThan(4.5);
    expect(dome.hours).toBeLessThan(4.9);
    expect(dome.lambdaW / dome.L).toBeGreaterThan(0.97);
    expect(dome.lambdaW / dome.L).toBeLessThan(1);
    const junction = littleAt(BUILT_IN_POLICIES["balance-stock"], 1, "Junction");
    expect(junction.hours).toBeGreaterThan(50);
    expect(junction.hours).toBeLessThan(58);
    expect(junction.lambdaW / junction.L).toBeGreaterThan(0.77);
    expect(junction.lambdaW / junction.L).toBeLessThan(0.84);
    const roles = littleAt(ROLES, 1, "Dome");
    expect(roles.hours).toBeGreaterThan(14.5);
    expect(roles.hours).toBeLessThan(15.5);
    expect(roles.lambdaW / roles.L).toBeGreaterThan(0.94);
  }, 120_000);

  it("on relay over seeds 1 to 20 the balancing baseline keeps about 13 of the line's 52 units at the junction, three tenths of the station stock, and the dome goes short on every seed", () => {
    const runs = stockOver("relay", BUILT_IN_POLICIES["balance-stock"], 20);
    const junction = mean(runs.map((r) => r.stations.Junction as number));
    expect(junction).toBeGreaterThan(12.5);
    expect(junction).toBeLessThan(14.5);
    const line = mean(
      runs.map((r) => Object.values(r.stations).reduce((a, b) => a + b, 0) + r.cargo),
    );
    expect(line).toBeGreaterThan(50);
    expect(line).toBeLessThan(54);
    for (const run of runs) {
      const stations = Object.values(run.stations).reduce((a, b) => a + b, 0);
      expect((run.stations.Junction as number) / stations).toBeGreaterThan(0.29);
      expect(run.metrics.unmetDemand).toBeGreaterThan(0);
    }
  }, 300_000);

  it("on relay over seeds 1 to 20 the balancing baseline delivers about 32.5 units a day, so by Little's law a unit spends about 38 hours on the line, 10 of them at the junction", () => {
    const runs = stockOver("relay", BUILT_IN_POLICIES["balance-stock"], 20);
    const perDay = mean(runs.map((r) => r.metrics.demandMet / 1000 / r.days));
    expect(perDay).toBeGreaterThan(32);
    expect(perDay).toBeLessThan(33);
    const line = mean(
      runs.map((r) => Object.values(r.stations).reduce((a, b) => a + b, 0) + r.cargo),
    );
    const hours = (line / perDay) * 24;
    expect(hours).toBeGreaterThan(37);
    expect(hours).toBeLessThan(40);
    const junctionHours = (mean(runs.map((r) => r.stations.Junction as number)) / perDay) * 24;
    expect(junctionHours).toBeGreaterThan(9);
    expect(junctionHours).toBeLessThan(11);
  }, 300_000);

  it("on relay over seeds 1 to 20 giving the junction the relay role holds nothing there, meets all demand, and keeps about 23 units at the dome, 16 hours of use", () => {
    const runs = stockOver("relay", ROLES, 20);
    for (const run of runs) {
      expect(run.stations.Junction).toBe(0);
      expect(run.metrics.unmetDemand).toBe(0);
      expect(run.metrics.policyErrors).toBe(0);
    }
    const dome = mean(runs.map((r) => r.stations.Dome as number));
    expect(dome).toBeGreaterThan(22);
    expect(dome).toBeLessThan(24);
    const perDay = mean(runs.map((r) => r.metrics.demandMet / 1000 / r.days));
    expect((dome / perDay) * 24).toBeGreaterThan(15);
    expect((dome / perDay) * 24).toBeLessThan(17);
  }, 300_000);

  it("on relay over seeds 1 to 20 giving the junction the any role with a balance target parks about 20 units there, while the mine and dome are served by their roles and all demand is met", () => {
    const runs = stockOver(
      "relay",
      `return ops.policy {
  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },
  target = { supply = ops.drain {}, demand = ops.fill {}, any = ops.balance {} },
}`,
      20,
    );
    const junction = mean(runs.map((r) => r.stations.Junction as number));
    expect(junction).toBeGreaterThan(19);
    expect(junction).toBeLessThan(21);
    for (const run of runs) expect(run.metrics.unmetDemand).toBe(0);
  }, 300_000);
});

/** Mean and sample standard deviation. */
function spread(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (values.length - 1);
  return { mean, sd: Math.sqrt(variance) };
}

describe("chapter 3, randomness and simulation", () => {
  const OBVIOUS = `return ops.policy {
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

  it("on two-station over seeds 1 to 100 balancing leaves 28 units unmet on average with a standard error of 0.3, single runs range over more than 10 units, and the obvious rule meets all demand on every seed", () => {
    const balance = metricsOver("two-station", BUILT_IN_POLICIES["balance-stock"], 100).map(
      (m) => m.unmetDemand / 1000,
    );
    const { mean: average, sd } = spread(balance);
    expect(average).toBeGreaterThan(27.5);
    expect(average).toBeLessThan(28.5);
    expect(sd / 10).toBeGreaterThan(0.28);
    expect(sd / 10).toBeLessThan(0.34);
    expect(Math.max(...balance) - Math.min(...balance)).toBeGreaterThan(10);
    for (const m of metricsOver("two-station", OBVIOUS, 100)) expect(m.unmetDemand).toBe(0);
  }, 300_000);

  it("on two-station over seeds 1 to 100 the two policies' stalled production rises and falls together with a correlation of about 0.75, so paired differences spread a fifth less than independent runs, while their empty running moves in opposite directions and pairing spreads more", () => {
    const balance = metricsOver("two-station", BUILT_IN_POLICIES["balance-stock"], 100);
    const obvious = metricsOver("two-station", OBVIOUS, 100);
    const compare = (pick: (m: (typeof balance)[number]) => number) => {
      const a = balance.map(pick);
      const b = obvious.map(pick);
      const paired = spread(b.map((v, i) => v - (a[i] as number))).sd;
      const independent = Math.sqrt(spread(a).sd * spread(a).sd + spread(b).sd * spread(b).sd);
      return { correlation: correlation(a, b), ratio: paired / independent };
    };
    const stalled = compare((m) => m.stalledProduction / 1000);
    expect(stalled.correlation).toBeGreaterThan(0.7);
    expect(stalled.correlation).toBeLessThan(0.8);
    expect(stalled.ratio).toBeGreaterThan(0.75);
    expect(stalled.ratio).toBeLessThan(0.85);
    const empty = compare((m) => m.emptyDistanceShare);
    expect(empty.correlation).toBeLessThan(0);
    expect(empty.ratio).toBeGreaterThan(1);
  }, 300_000);

  it("comparing base-stock levels 13 and 15 on the same 100 seeds, paired differences spread less than half as much as independent runs, and level 15 costs more", () => {
    const params = {
      random: true,
      demand: 4,
      lead_time: 2 * DAY,
      review_period: 6 * 3_600_000,
      order_cost: 0,
      duration: 30 * DAY,
    };
    const loaded = runtime.loadScript(templateCall("classic.reorder", params));
    if (!loaded.ok) throw new Error("the template should evaluate");
    const costs = (level: number) => {
      const policy = runtime.createPolicy(
        `return ops.policy { review = { target = ops.order_up_to { level = ${level * 1000} } } }`,
      );
      try {
        return Array.from({ length: 100 }, (_, i) => {
          const out = runSimulation(loaded.scenario, policy, { seed: i + 1, detail: "summary" });
          return out.metrics.costs.total / 1000 / 30;
        });
      } finally {
        policy.close();
      }
    };
    const a = costs(13);
    const b = costs(15);
    const difference = spread(b.map((cost, i) => cost - (a[i] as number)));
    const sdA = spread(a).sd;
    const sdB = spread(b).sd;
    const independent = Math.sqrt(sdA * sdA + sdB * sdB);
    expect(difference.sd).toBeLessThan(independent / 2);
    // t for 99 degrees of freedom at 97.5%.
    const half = (1.984 * difference.sd) / 10;
    expect(difference.mean - half).toBeGreaterThan(0);
  }, 300_000);
});

describe("chapter 6, reviews, lead times and base-stock", () => {
  const params = {
    random: true,
    demand: 4,
    lead_time: 2 * DAY,
    review_period: 6 * 3_600_000,
    order_cost: 0,
    duration: 30 * DAY,
  };

  it("the reorder template's base-stock reference for 4 a day, a 2-day lead time and 6-hour reviews orders up to 13 and expects 7.97 a day", () => {
    const reference = classicTemplates.find((t) => t.name === "classic.reorder")?.reference(params);
    expect(reference?.values.level).toBe(13);
    expect(Math.round((reference?.expectedCostPerDay as number) * 100) / 100).toBe(7.97);
  });

  it("on classic.reorder with random demand, ordering up to 13 from stock on hand costs more than five times as much a day as ordering up to 13 from the inventory position, on seeds 1 to 100", () => {
    const loaded = runtime.loadScript(templateCall("classic.reorder", params));
    if (!loaded.ok) throw new Error("the template should evaluate");
    const costPerDay = (source: string) => {
      const policy = runtime.createPolicy(source);
      try {
        const total = Array.from({ length: 100 }, (_, i) => {
          const out = runSimulation(loaded.scenario, policy, { seed: i + 1, detail: "summary" });
          return out.metrics.costs.total / 1000 / 30;
        }).reduce((a, b) => a + b, 0);
        return total / 100;
      } finally {
        policy.close();
      }
    };
    const position = costPerDay(
      "return ops.policy { review = { target = ops.order_up_to { level = 13000 } } }",
    );
    const onHand = costPerDay(`return { on_review = function(ctx)
  local short = 13000 - ctx.here.stock.Goods
  if short > 0 then ctx.order("Goods", short) end
end }`);
    expect(onHand).toBeGreaterThan(5 * position);
  }, 300_000);
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

  it("on two-trains over seeds 1 to 100, roles leave less than a tenth of the balancing baseline's unmet demand, and adding lookahead leaves more unmet demand than roles alone with over three times the empty running", () => {
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
        const out = runSimulation(result.scenario, policy, { seed: i + 1, detail: "full" });
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

  it("on storm-shock over seeds 1 to 50 the balancing baseline holds about 10 units at the dome when the storm begins, the dome runs dry about 17 hours in and stands empty for about 24 hours, into the day after the storm, and about 53 units go unmet", () => {
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

  it("on storm-shock over seeds 1 to 50 keeping the dome full holds about 23 units there when the storm begins, the dome stands empty for under 2 hours, none of it after the storm, and about 4 units go unmet, while a min-max target of 20 to 30 holds 19 on average and leaves about 12", () => {
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
  it("on classic.forecasting the smoothing policy leaves customers waiting on every day from 40 to 59 with 17 units of safety stock, and on none of them with 18", () => {
    const reference = (safety: number) =>
      classicTemplates.find((t) => t.name === "classic.forecasting")?.reference({ safety })
        .policy ?? "";
    const loaded = runtime.loadScript("return classic.forecasting {}");
    if (!loaded.ok) throw new Error("the template should evaluate");
    const waitingDays = (safety: number) => {
      const policy = runtime.createPolicy(reference(safety));
      try {
        const out = runSimulation(loaded.scenario, policy, { detail: "full" });
        const backorders = out.backorders as Int32Array;
        const perDay = DAY / out.tickMs;
        let days = 0;
        for (let day = 40; day < 60; day++) {
          if (backorders.subarray(day * perDay, (day + 1) * perDay).some((b) => b > 0)) days++;
        }
        return days;
      } finally {
        policy.close();
      }
    };
    expect(waitingDays(17)).toBe(20);
    expect(waitingDays(18)).toBe(0);
  }, 120_000);
});

describe("simulator exercises", () => {
  const OBVIOUS = `return ops.policy {
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
        const out = runSimulation(scenario, policy, { seed: i + 1, detail: "summary" });
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
          const out = runSimulation(scenario, policy, { seed: i + 1, detail: "full" });
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

  it("on two-station with 60-unit stations, balancing leaves about 5 units unmet over seeds 1 to 20 instead of about 28, but the dome still goes short on every seed", () => {
    const large = load(
      (STARTER_SCRIPTS["two-station"] as string).replaceAll("small_station", "large_station"),
    );
    const policy = runtime.createPolicy(BUILT_IN_POLICIES["balance-stock"]);
    try {
      const unmet = Array.from(
        { length: 20 },
        (_, i) =>
          runSimulation(large, policy, { seed: i + 1, detail: "summary" }).metrics.unmetDemand /
          1000,
      );
      expect(mean(unmet)).toBeGreaterThan(4);
      expect(mean(unmet)).toBeLessThan(6.5);
      for (const u of unmet) expect(u).toBeGreaterThan(0);
    } finally {
      policy.close();
    }
    const small = mean(
      metricsOver("two-station", BUILT_IN_POLICIES["balance-stock"], 20).map(
        (m) => m.unmetDemand / 1000,
      ),
    );
    expect(small).toBeGreaterThan(26);
    expect(small).toBeLessThan(30);
  }, 300_000);

  it("on two-station over seeds 1 to 10 the paired difference in unmet demand between the obvious rule and balancing is about 27 units with a 95% half-width under 2, so ten seeds already leave out zero", () => {
    const balance = metricsOver("two-station", BUILT_IN_POLICIES["balance-stock"], 10);
    const obvious = metricsOver("two-station", OBVIOUS, 10);
    const difference = spread(
      obvious.map(
        (m, i) => (m.unmetDemand - (balance[i] as (typeof balance)[number]).unmetDemand) / 1000,
      ),
    );
    expect(difference.mean).toBeLessThan(-25);
    expect(difference.mean).toBeGreaterThan(-29);
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

  it("on classic.newsvendor over seeds 1 to 100 ordering 15 costs about 41 a day, 20 about 43 and 10 about 47.5, each within a unit of the model", () => {
    const scenario = load(templateCall("classic.newsvendor", {}));
    const at = (units: number) => mean(costsPerDay(scenario, orderUpTo(units * 1000), 100, 30));
    const [ten, fifteen, twenty] = [at(10), at(15), at(20)];
    expect(Math.abs(fifteen - 370 / 9)).toBeLessThan(1);
    expect(Math.abs(twenty - 385 / 9)).toBeLessThan(1);
    expect(Math.abs(ten - 430 / 9)).toBeLessThan(1);
    expect(fifteen).toBeLessThan(twenty);
    expect(twenty).toBeLessThan(ten);
  }, 300_000);

  it("on classic.newsvendor with a lost-demand cost of 10, ordering 20 costs about 45.8 a day over seeds 1 to 100, less than ordering 15 or 25", () => {
    const scenario = load(templateCall("classic.newsvendor", { lost_cost: 10 }));
    const at = (units: number) => mean(costsPerDay(scenario, orderUpTo(units * 1000), 100, 30));
    const twenty = at(20);
    expect(twenty).toBeGreaterThan(45);
    expect(twenty).toBeLessThan(46.5);
    expect(twenty).toBeLessThan(at(15));
    expect(twenty).toBeLessThan(at(25));
  }, 300_000);

  it("on classic.reorder with a 1-day lead time the reference orders up to 8 and expects 4.81 a day, and over seeds 1 to 100 the simulated cost agrees within its interval", () => {
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

  it("on classic.safety_stock over seeds 1 to 200 level 113 meets a 0.95 cycle service level with the variable lead time and level 106 meets it with a fixed 2-day lead time, while 106 with the variable lead time reaches only about 0.88", () => {
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

  it("on classic.safety_stock over seeds 1 to 200 level 121 meets a 0.99 cycle service level", () => {
    const template = classicTemplates.find((t) => t.name === "classic.safety_stock");
    expect(template?.reference({ target_service: 0.99 }).values.level).toBe(121);
    expect(
      cycleServiceLevel(load(templateCall("classic.safety_stock", {})), 121, 200),
    ).toBeGreaterThan(0.985);
  }, 600_000);

  it("on classic.forecasting with alpha 0.5 the smoothing policy leaves customers waiting on every day from 40 to 59 with 8 units of safety stock, and on none of them with 9", () => {
    const template = classicTemplates.find((t) => t.name === "classic.forecasting");
    const scenario = load(templateCall("classic.forecasting", { alpha: 0.5 }));
    const waitingDays = (safety: number) => {
      const policy = runtime.createPolicy(template?.reference({ alpha: 0.5, safety }).policy ?? "");
      try {
        const out = runSimulation(scenario, policy, { detail: "full" });
        const backorders = out.backorders as Int32Array;
        const perDay = DAY / out.tickMs;
        let days = 0;
        for (let day = 40; day < 60; day++) {
          if (backorders.subarray(day * perDay, (day + 1) * perDay).some((b) => b > 0)) days++;
        }
        return days;
      } finally {
        policy.close();
      }
    };
    expect(waitingDays(8)).toBe(20);
    expect(waitingDays(9)).toBe(0);
  }, 120_000);
});
