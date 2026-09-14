import type { RunOutput } from "@regolith-rail/engine";
import { describe, expect, it } from "vitest";
import { chartSpecs } from "./chart-specs.ts";

/** A full-detail output of three one-minute ticks with the given sites and trains. */
function output(sites: number, trains: string[], records: RunOutput["records"] = {}): RunOutput {
  const rows = 3;
  return {
    tickMs: 60_000,
    sites: Array.from({ length: sites }, (_, i) => ({ station: `S${i}`, resource: "Metals" })),
    trains,
    resources: ["Metals"],
    stock: new Int32Array(rows * sites).fill(1000),
    cargo: new Int32Array(rows * trains.length),
    records,
  } as unknown as RunOutput;
}

describe("run charts", () => {
  it("chart stock and cargo on a line with trains", () => {
    expect(chartSpecs(output(2, ["T1"])).map((s) => s.id)).toEqual(["stock", "cargo"]);
  });

  it("leave out the cargo chart when a scenario has no vehicles", () => {
    const ids = chartSpecs(output(4, [], { target: { t: [0], v: [1] } })).map((s) => s.id);
    expect(ids).toEqual(["stock", "record-target"]);
  });
});
