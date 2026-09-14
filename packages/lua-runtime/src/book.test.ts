import { runSimulation, starterScenarios, validateScenario } from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { classicTemplates, templateCall } from "@regolith-rail/scenario-kit";
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
