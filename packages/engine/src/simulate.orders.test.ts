import { describe, expect, it } from "vitest";
import { type RunEvent, stateAt } from "./output.ts";
import type { ReviewSnapshot } from "./policy.ts";
import type { ScenarioV2Input } from "./scenario/format2.ts";
import { runSimulation } from "./simulate.ts";
import { idlePolicy, parse, reviewPolicy } from "./testing/policies.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const ofKind = <K extends RunEvent["kind"]>(events: RunEvent[], kind: K) =>
  events.filter((e): e is RunEvent & { kind: K } => e.kind === kind);

type Point = ScenarioV2Input["stations"][number];

/** A shop reviewed daily, supplied with Beer by an external supplier, with no vehicles. */
function shop(change: (input: ScenarioV2Input, shop: Point) => void = () => {}) {
  const point: Point = {
    id: "Shop",
    resources: [{ id: "Beer", capacity: 100_000 }],
    suppliers: [
      { resource: "Beer", from: "external", leadTime: { kind: "fixed", value: 2 * DAY } },
    ],
    review: { periodMs: DAY },
  };
  const input: ScenarioV2Input = {
    format: 2,
    id: "shop",
    title: "Shop",
    description: "One shop ordering beer.",
    durationMs: 5 * DAY,
    seed: 1,
    informationLevel: "local",
    resources: [{ id: "Beer" }],
    stations: [point],
  };
  change(input, point);
  return parse(input);
}

const orderOnce = (amount: number) =>
  reviewPolicy((snapshot) =>
    snapshot.review === 1 ? [{ type: "order", resource: "Beer", amount }] : [],
  );

describe("reviews and external orders", () => {
  it("reviews each station on its period and records each review", () => {
    const out = runSimulation(shop(), idlePolicy, { detail: "summary" });
    expect(ofKind(out.events, "review").map((e) => [e.t, e.review])).toEqual([
      [0, 1],
      [DAY, 2],
      [2 * DAY, 3],
      [3 * DAY, 4],
      [4 * DAY, 5],
    ]);
  });

  it("delivers an order after the supplier's lead time", () => {
    const out = runSimulation(shop(), orderOnce(5000));
    expect(stateAt(out, 2 * DAY - 1).stock[0]).toBe(0);
    expect(stateAt(out, 2 * DAY).stock[0]).toBe(5000);
    expect(ofKind(out.events, "delivery")).toEqual([
      {
        t: 2 * DAY,
        kind: "delivery",
        station: "Shop",
        resource: "Beer",
        amount: 5000,
        overflow: 0,
      },
    ]);
  });

  it("shows orders on the way and the supplier in the review snapshot", () => {
    const seen: ReviewSnapshot[] = [];
    const policy = reviewPolicy((snapshot) => {
      seen.push(snapshot);
      return snapshot.review === 1 ? [{ type: "order", resource: "Beer", amount: 5000 }] : [];
    });
    runSimulation(shop(), policy, { detail: "summary" });
    expect(seen[1]?.here.on_order).toEqual([
      { resource: "Beer", amount: 5000, from: "external", placed_at: 0, arrives_at: 2 * DAY },
    ]);
    expect(seen[1]?.here.suppliers).toEqual([
      { resource: "Beer", from: "external", lead_times: [{ value: 2 * DAY, weight: 1 }] },
    ]);
    expect(seen[2]?.here.on_order).toEqual([]);
    expect(seen[2]?.here.stock).toEqual({ Beer: 5000 });
  });

  it("clamps orders to the supplier's limits with a warning", () => {
    const scenario = shop((_input, point) => {
      const supplier = point.suppliers?.[0];
      if (supplier) Object.assign(supplier, { minOrder: 2000, maxOrder: 8000 });
    });
    const policy = reviewPolicy((snapshot) =>
      snapshot.review === 1
        ? [{ type: "order", resource: "Beer", amount: 500 }]
        : snapshot.review === 2
          ? [{ type: "order", resource: "Beer", amount: 20_000 }]
          : [],
    );
    const out = runSimulation(scenario, policy, { detail: "summary" });
    expect(ofKind(out.events, "order").map((e) => [e.requested, e.amount])).toEqual([
      [500, 2000],
      [20_000, 8000],
    ]);
    expect(ofKind(out.events, "warning").map((e) => e.message)).toEqual([
      "order Beer: raised to the supplier's minimum order of 2000",
      "order Beer: limited to the supplier's maximum order of 8000",
    ]);
  });

  it("records deliveries that do not fit as overflow", () => {
    const scenario = shop((_input, point) => {
      point.resources = [{ id: "Beer", capacity: 3000 }];
    });
    const out = runSimulation(scenario, orderOnce(5000));
    expect(stateAt(out, 3 * DAY).stock[0]).toBe(3000);
    expect(out.metrics.overflow).toBe(2000);
  });

  it("ignores an order for a resource without a supplier", () => {
    const scenario = shop((input, point) => {
      input.resources.push({ id: "Wine" });
      point.resources.push({ id: "Wine" });
    });
    const out = runSimulation(
      scenario,
      reviewPolicy(() => [{ type: "order", resource: "Wine", amount: 1000 }]),
      { detail: "summary" },
    );
    expect(ofKind(out.events, "order")).toEqual([]);
    expect(ofKind(out.events, "warning")[0]?.message).toBe(
      "Shop has no supplier for Wine; order ignored",
    );
  });

  it("handles deliveries and reviews at the same time before production and consumption", () => {
    // An order placed at 0 with a one-day lead time arrives at the same moment as the next review.
    const scenario = shop((_input, point) => {
      const supplier = point.suppliers?.[0];
      if (supplier) supplier.leadTime = { kind: "fixed", value: DAY };
      point.consumers = [{ resource: "Beer", rate: 24_000 }];
    });
    const seen: number[] = [];
    const policy = reviewPolicy((snapshot) => {
      seen.push(snapshot.here.stock?.Beer as number);
      return snapshot.review === 1 ? [{ type: "order", resource: "Beer", amount: 5000 }] : [];
    });
    const out = runSimulation(scenario, policy, { detail: "summary" });
    const kinds = out.events
      .filter((e) => e.t === DAY && ["delivery", "review"].includes(e.kind))
      .map((e) => e.kind);
    expect(kinds).toEqual(["delivery", "review"]);
    // The review at one day sees the delivery before any of that day's consumption.
    expect(seen[1]).toBe(5000);
  });
});

describe("station suppliers", () => {
  /** Retailer orders from Wholesaler, which orders from an external factory. */
  function chain(wholesalerStock: number) {
    return parse({
      format: 2,
      id: "chain",
      title: "Chain",
      description: "A wholesaler supplying a retailer.",
      durationMs: 6 * DAY,
      seed: 1,
      informationLevel: "local",
      resources: [{ id: "Beer" }],
      stations: [
        {
          id: "Wholesaler",
          resources: [{ id: "Beer", capacity: 100_000, initial: wholesalerStock }],
          suppliers: [
            { resource: "Beer", from: "external", leadTime: { kind: "fixed", value: DAY } },
          ],
          review: { periodMs: DAY },
        },
        {
          id: "Retailer",
          resources: [{ id: "Beer", capacity: 100_000 }],
          suppliers: [
            { resource: "Beer", from: "Wholesaler", leadTime: { kind: "fixed", value: DAY } },
          ],
          review: { periodMs: DAY },
        },
      ],
    });
  }

  it("ships what the supplier holds and ships the rest when it receives stock", () => {
    const policy = reviewPolicy((snapshot) => {
      if (snapshot.here.id === "Wholesaler")
        return snapshot.review === 1 ? [{ type: "order", resource: "Beer", amount: 10_000 }] : [];
      return snapshot.review === 2 ? [{ type: "order", resource: "Beer", amount: 8000 }] : [];
    });
    const out = runSimulation(chain(3000), policy);
    const shipments = ofKind(out.events, "shipment").map((e) => [e.t, e.station, e.to, e.amount]);
    expect(shipments).toEqual([
      [0, "external", "Wholesaler", 10_000],
      [0, "Wholesaler", "Retailer", 3000],
      // The factory's delivery reaches the wholesaler at one day, before that minute's tick
      // ships the backlog.
      [DAY, "Wholesaler", "Retailer", 5000],
    ]);
    expect(stateAt(out, DAY).stock).toEqual([5000, 3000]);
    expect(stateAt(out, 3 * DAY).stock).toEqual([5000, 8000]);
  });

  it("lists the unshipped part of an order without an arrival time", () => {
    let seen: ReviewSnapshot | undefined;
    const policy = reviewPolicy((snapshot) => {
      if (snapshot.here.id === "Retailer" && snapshot.review === 4) seen = snapshot;
      return snapshot.here.id === "Retailer" && snapshot.review === 2
        ? [{ type: "order", resource: "Beer", amount: 8000 }]
        : [];
    });
    runSimulation(chain(3000), policy, { detail: "summary" });
    expect(seen?.here.on_order).toEqual([
      { resource: "Beer", amount: 5000, from: "Wholesaler", placed_at: 0 },
    ]);
  });
});

describe("expiring stock", () => {
  it("removes expiring stock at each review before the review hook", () => {
    const scenario = shop((_input, point) => {
      point.resources = [{ id: "Beer", capacity: 100_000, initial: 3000, expires: true }];
    });
    const seen: number[] = [];
    const policy = reviewPolicy((snapshot) => {
      seen.push(snapshot.here.stock?.Beer as number);
      return [];
    });
    const out = runSimulation(scenario, policy, { detail: "summary" });
    expect(seen[0]).toBe(0);
    expect(out.metrics.expired).toBe(3000);
    expect(ofKind(out.events, "expire")).toEqual([
      { t: 0, kind: "expire", station: "Shop", resource: "Beer", amount: 3000 },
    ]);
  });
});
