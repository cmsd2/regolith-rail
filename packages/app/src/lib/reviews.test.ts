import { runSimulation } from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { classicTemplates, templateCall } from "@regolith-rail/scenario-kit";
import { beforeAll, describe, expect, it } from "vitest";
import { latestReviewAt, reviewDetail, reviews } from "./reviews.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const HOUR = 3_600_000;

describe("review detail", () => {
  it("shows a review's stock, orders with their arrival and decisions", () => {
    const reorder = classicTemplates.find((t) => t.name === "classic.reorder");
    if (!reorder) throw new Error("no reorder template");
    const params = { lead_time: 2 * HOUR, random: true };
    const result = runtime.loadScript(templateCall(reorder.name, params));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const output = runSimulation(
      result.scenario,
      runtime.createPolicy(reorder.reference(params).policy),
    );

    expect(reviews(output)[0]).toEqual({ review: 1, t: 60_000, station: "Shop" });
    expect(latestReviewAt(output, HOUR)).toBe(1);
    expect(latestReviewAt(output, 0)).toBeNull();

    const first = reviewDetail(output, 1);
    expect(first?.stock).toEqual({ Goods: 0 });
    expect(first?.orders).toHaveLength(1);
    expect(first?.orders[0]).toMatchObject({ resource: "Goods", from: "external" });
    expect(first?.orders[0]?.arrivesAt).toBe(60_000 + 2 * HOUR);
    expect(first?.traces.map((t) => t.block)).toEqual(["order_up_to", "order"]);

    // The next review sees the first order still on its way.
    const second = reviewDetail(output, 2);
    expect(second?.onTheWay.map((s) => s.amount)).toEqual([first?.orders[0]?.amount]);
    expect(second?.backorders.Goods).toBeGreaterThanOrEqual(0);
  });
});
