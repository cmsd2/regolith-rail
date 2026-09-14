import { starterScenarios, validateScenario } from "@regolith-rail/engine";
import { describe, expect, it } from "vitest";
import { metricsFor } from "./metrics.ts";

const starter = (id: string) => {
  const result = validateScenario(starterScenarios.find((s) => s.id === id)?.document);
  if (!result.ok) throw new Error(`invalid starter ${id}`);
  return result.scenario;
};

describe("metrics shown for a scenario", () => {
  it("leaves out feature metrics for a scenario without those features", () => {
    const keys = metricsFor(starter("two-station")).map((m) => m.key);
    expect(keys).toHaveLength(12);
    expect(keys).not.toContain("backorderAverage");
    expect(keys.some((k) => k.startsWith("costs."))).toBe(false);
  });

  it("includes backorder, supplier and cost metrics when a scenario uses them", () => {
    const scenario = starter("two-station");
    const dome = scenario.stations[1];
    if (!dome) throw new Error("two-station has a dome");
    const consumer = dome.consumers[0];
    if (consumer) Object.assign(consumer, { unmet: "backorder", backorderCost: 2 });
    dome.suppliers.push({
      resource: "Metals",
      from: "external",
      leadTime: { kind: "fixed", value: 0 },
    });
    const keys = metricsFor(scenario).map((m) => m.key);
    expect(keys).toContain("backorderAverage");
    expect(keys).toContain("overflow");
    expect(keys).toContain("costs.total");
    expect(keys).not.toContain("expired");
  });
});
