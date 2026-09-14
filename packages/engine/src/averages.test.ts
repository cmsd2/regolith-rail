import { describe, expect, it } from "vitest";
import { runAverages } from "./averages.ts";
import type { RunOutput } from "./output.ts";

const TICK = 60_000;

/** A run of three intervals at one site: 6 unloaded at the start, 4 consumed in the second. */
function output(): RunOutput {
  return {
    apiVersion: 2,
    scenarioId: "tiny",
    seed: 1,
    durationMs: 3 * TICK,
    tickMs: TICK,
    stations: ["A"],
    resources: ["X"],
    trains: ["T"],
    trainStarts: ["A"],
    sites: [{ station: "A", resource: "X", capacity: 30_000 }],
    stock: Int32Array.from([10_000, 16_000, 12_000, 12_000]),
    cargo: Int32Array.from([0, 0, 4_000, 4_000]),
    events: [
      { t: 0, kind: "transfer", stop: 1, train: "T", station: "A", resource: "X", amount: -6_000 },
    ],
    records: {},
    samples: { t: [], stock: [], cargo: [] },
    flows: [],
    metrics: {} as RunOutput["metrics"],
  } as unknown as RunOutput;
}

describe("run averages", () => {
  it("average stock, flows a day, and time by Little's law and by following units", () => {
    const { sites, line, days } = runAverages(output());
    expect(days).toBeCloseTo((3 * TICK) / 86_400_000, 12);
    const [site] = sites;
    expect(site).toMatchObject({ station: "A", resource: "X" });
    expect(site?.stock).toBeCloseTo((10_000 + 16_000 + 12_000) / 3, 6);
    expect(site?.inPerDay).toBeCloseTo(6_000 / days, 6);
    expect(site?.outPerDay).toBeCloseTo(4_000 / days, 6);
    expect(site?.hours).toBeCloseTo(((site?.stock as number) / (4_000 / days)) * 24, 6);
    // The 4 units consumed were the first in, there since time 0, and left at the end of the second interval.
    expect(site?.waitedHours).toBeCloseTo((2 * TICK) / 3_600_000, 9);
    const [resource] = line;
    expect(resource?.atStations).toBeCloseTo(site?.stock as number, 6);
    expect(resource?.aboard).toBeCloseTo(4_000 / 3, 6);
    expect(resource?.consumedPerDay).toBeCloseTo(4_000 / days, 6);
    expect(resource?.hours).toBeCloseTo(
      (((site?.stock as number) + 4_000 / 3) / (4_000 / days)) * 24,
      6,
    );
  });

  it("leaves the times undefined where nothing left", () => {
    const idle = output();
    idle.stock = Int32Array.from([10_000, 10_000, 10_000, 10_000]);
    idle.events = [];
    const [site] = runAverages(idle).sites;
    expect(site?.outPerDay).toBe(0);
    expect(site?.hours).toBeUndefined();
    expect(site?.waitedHours).toBeUndefined();
  });

  it("needs a run recorded with full detail", () => {
    const { stock: _stock, ...summary } = output();
    expect(() => runAverages(summary as RunOutput)).toThrow(/full detail/);
  });
});
