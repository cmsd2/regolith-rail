import {
  naiveReferencePolicy,
  runSimulation,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";
import { describe, expect, it } from "vitest";
import { arrivals, latestStopAt, stopDetail } from "./stops.ts";

function output() {
  const result = validateScenario(starterScenarios[0]?.document);
  if (!result.ok) throw new Error("invalid starter");
  return runSimulation(result.scenario, naiveReferencePolicy(), { seed: 3 });
}

describe("stop helpers", () => {
  it("find the latest stop at a time", () => {
    const out = output();
    const list = arrivals(out);
    const third = list[2];
    if (!third) throw new Error("too few stops");
    expect(latestStopAt(out, third.t)).toBe(third.stop);
    expect(latestStopAt(out, third.t + 1)).toBe(third.stop);
    expect(latestStopAt(out, -1)).toBeNull();
  });

  it("rebuild what the policy saw before its transfers", () => {
    const out = output();
    const withTransfer = out.events.find((e) => e.kind === "transfer");
    if (withTransfer?.kind !== "transfer") throw new Error("no transfers");
    const detail = stopDetail(out, withTransfer.stop);
    if (!detail) throw new Error("no detail");
    const before = detail.stock[withTransfer.station]?.[withTransfer.resource] ?? 0;
    const cargoBefore = detail.cargo[withTransfer.resource] ?? 0;
    expect(detail.transfers.length).toBeGreaterThan(0);
    // Loading moves stock from station to train; the snapshot is from before that.
    expect(before - withTransfer.amount).toBeGreaterThanOrEqual(0);
    expect(cargoBefore + withTransfer.amount).toBeGreaterThanOrEqual(0);
    expect(detail.dwellMs).toBeGreaterThan(0);
  });
});
