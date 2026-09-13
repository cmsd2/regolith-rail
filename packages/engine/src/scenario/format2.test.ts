import { describe, expect, it } from "vitest";
import { minimalScenarioV2 } from "../testing/fixtures.ts";
import { ScenarioV2, type ScenarioV2Input } from "./format2.ts";
import { formatPath } from "./validate.ts";

type Point = ScenarioV2Input["stockPoints"][number];

function parse(input: unknown) {
  const result = ScenarioV2.safeParse(input);
  return result.success
    ? { ok: true as const, scenario: result.data, errors: [] }
    : {
        ok: false as const,
        errors: result.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })),
      };
}

function errorsOf(input: unknown) {
  const result = parse(input);
  expect(result.ok, "expected validation to fail").toBe(false);
  return result.errors;
}

const point = (input: ScenarioV2Input, i: number) => input.stockPoints[i] as Point;

describe("format 2 document", () => {
  it("accepts a minimal network with a shuttle and applies defaults", () => {
    const result = parse(minimalScenarioV2());
    expect(result.errors).toEqual([]);
    if (!result.ok) return;
    const { scenario } = result;
    expect(scenario.events).toEqual([]);
    expect(scenario.vehicles[0]?.dwellMs).toBe(10_000);
    expect(scenario.vehicles[0]?.route).toEqual({
      kind: "shuttle",
      stops: ["A", "B"],
      direction: "forward",
    });
    const a = scenario.stockPoints[0];
    expect(a?.resources[0]).toEqual({ id: "Metals", capacity: 30_000, initial: 0, expires: false });
    expect(a?.converters).toEqual([]);
    expect(a?.suppliers).toEqual([]);
    expect(scenario.stockPoints[1]?.consumers[0]).toMatchObject({ unmet: "lost" });
  });

  it("gives a stored resource 30000 milli-units of capacity by default", () => {
    const result = parse(minimalScenarioV2());
    expect(result.ok && result.scenario.stockPoints[1]?.resources[0]?.capacity).toBe(30_000);
  });

  it("accepts unlimited capacity", () => {
    const input = minimalScenarioV2();
    point(input, 0).resources = [{ id: "Metals", capacity: "unlimited", initial: 5_000_000 }];
    const result = parse(input);
    expect(result.errors).toEqual([]);
    expect(result.ok && result.scenario.stockPoints[0]?.resources[0]?.capacity).toBe("unlimited");
  });

  it("accepts a single stock point with no arcs or vehicles", () => {
    const input = minimalScenarioV2();
    input.stockPoints = [point(input, 1)];
    input.arcs = [];
    input.vehicles = [];
    expect(parse(input).errors).toEqual([]);
  });

  it("rejects format 1 documents", () => {
    const input = { ...minimalScenarioV2(), format: 1 };
    expect(errorsOf(input).map((e) => e.path)).toContain("format");
  });
});

describe("network topology", () => {
  it("treats a line as stock points joined in order", () => {
    const input = minimalScenarioV2();
    input.stockPoints.push({ id: "C", resources: [{ id: "Metals" }] });
    input.arcs = [
      { from: "A", to: "B", distance: 400 },
      { from: "B", to: "C", distance: 600 },
    ];
    (input.vehicles?.[0] as { route: unknown }).route = { kind: "shuttle", stops: ["A", "B", "C"] };
    expect(parse(input).errors).toEqual([]);
  });

  it("rejects a route between stock points no arc joins", () => {
    const input = minimalScenarioV2();
    input.stockPoints.push({ id: "C", resources: [{ id: "Metals" }] });
    (input.vehicles?.[0] as { route: unknown }).route = { kind: "shuttle", stops: ["A", "C"] };
    expect(errorsOf(input)).toContainEqual({
      path: "vehicles[0].route.stops[1]",
      message: "the route of vehicle T1 goes from A to C, which no arc joins",
    });
  });

  it("rejects unknown and duplicate arcs", () => {
    const input = minimalScenarioV2();
    input.arcs = [
      { from: "A", to: "B", distance: 400 },
      { from: "B", to: "A", distance: 500 },
      { from: "A", to: "Z", distance: 1 },
    ];
    const errors = errorsOf(input);
    expect(errors).toContainEqual({
      path: "arcs[1]",
      message: "stock points B and A are already joined",
    });
    expect(errors).toContainEqual({ path: "arcs[2].to", message: "unknown stock point Z" });
  });

  it("reserves the external supplier id", () => {
    const input = minimalScenarioV2();
    point(input, 0).id = "external";
    expect(errorsOf(input)).toContainEqual({
      path: "stockPoints[0].id",
      message: "external is reserved for external suppliers",
    });
  });
});

describe("vehicles and routes", () => {
  const loopScenario = () => {
    const input = minimalScenarioV2();
    input.stockPoints = [
      { id: "Depot", resources: [{ id: "Metals" }] },
      { id: "A", resources: [{ id: "Metals" }] },
      { id: "B", resources: [{ id: "Metals" }] },
    ];
    input.arcs = [
      { from: "Depot", to: "A", distance: 100 },
      { from: "A", to: "B", distance: 100 },
      { from: "B", to: "Depot", distance: 100 },
    ];
    return input;
  };

  it("accepts a loop route closed by an arc", () => {
    const input = loopScenario();
    (input.vehicles?.[0] as { route: unknown }).route = {
      kind: "loop",
      stops: ["Depot", "A", "B"],
    };
    expect(parse(input).errors).toEqual([]);
  });

  it("rejects a loop whose last stop is not joined to its first", () => {
    const input = loopScenario();
    input.arcs = input.arcs?.slice(0, 2);
    (input.vehicles?.[0] as { route: unknown }).route = {
      kind: "loop",
      stops: ["Depot", "A", "B"],
    };
    expect(errorsOf(input)).toContainEqual({
      path: "vehicles[0].route.stops[0]",
      message: "the route of vehicle T1 goes from B to Depot, which no arc joins",
    });
  });

  it("accepts timetable departures far enough apart", () => {
    const input = loopScenario();
    input.durationMs = 86_400_000;
    (input.vehicles?.[0] as { route: unknown }).route = {
      kind: "timetable",
      stops: ["Depot", "A", "B"],
      departuresMs: [0, 12 * 3_600_000],
    };
    expect(parse(input).errors).toEqual([]);
  });

  it("rejects a departure before the previous trip can finish", () => {
    const input = loopScenario();
    input.durationMs = 86_400_000;
    // Out and back through three stops is 4 legs of 10 s each plus 5 stops of 10 s dwell.
    (input.vehicles?.[0] as { route: unknown }).route = {
      kind: "timetable",
      stops: ["Depot", "A", "B"],
      departuresMs: [0, 60_000],
    };
    expect(errorsOf(input)).toContainEqual({
      path: "vehicles[0].route.departuresMs[1]",
      message: "departure at 60000 ms is before the previous trip can finish at 90000 ms",
    });
  });

  it("rejects a start that is not on the route", () => {
    const input = minimalScenarioV2();
    (input.vehicles?.[0] as { route: unknown }).route = {
      kind: "shuttle",
      stops: ["A", "B"],
      start: "C",
    };
    expect(errorsOf(input)).toContainEqual({
      path: "vehicles[0].route.start",
      message: "C is not a stop on the route",
    });
  });
});

describe("converters, suppliers and reviews", () => {
  const factory = (): ScenarioV2Input => {
    const input = minimalScenarioV2();
    input.resources.push({ id: "MachineParts" });
    point(input, 1).resources.push({ id: "MachineParts" });
    point(input, 1).converters = [
      {
        inputs: [{ resource: "Metals", amount: 2000 }],
        outputs: [{ resource: "MachineParts", amount: 1000 }],
        rate: 12_000,
      },
    ];
    return input;
  };

  it("accepts a converter whose resources are stored", () => {
    expect(parse(factory()).errors).toEqual([]);
  });

  it("rejects a converter output the stock point does not store", () => {
    const input = factory();
    point(input, 1).resources = [{ id: "Metals" }];
    expect(errorsOf(input)).toContainEqual({
      path: "stockPoints[1].converters[0].outputs[0].resource",
      message: "stock point B does not store resource MachineParts",
    });
  });

  it("accepts an external supplier with a lead time and a weekly review", () => {
    const input = minimalScenarioV2();
    point(input, 1).suppliers = [
      { resource: "Metals", from: "external", leadTime: { kind: "fixed", value: 172_800_000 } },
    ];
    point(input, 1).review = { periodMs: 7 * 86_400_000 };
    input.durationMs = 30 * 86_400_000;
    const result = parse(input);
    expect(result.errors).toEqual([]);
    expect(result.ok && result.scenario.stockPoints[1]?.review).toEqual({
      periodMs: 604_800_000,
      offsetMs: 0,
    });
  });

  it("rejects suppliers that form a cycle", () => {
    const input = minimalScenarioV2();
    point(input, 0).suppliers = [{ resource: "Metals", from: "B" }];
    point(input, 1).suppliers = [{ resource: "Metals", from: "A" }];
    expect(errorsOf(input)).toContainEqual({
      path: "stockPoints[0].suppliers[0].from",
      message: "suppliers of Metals form a cycle: A → B → A",
    });
  });

  it("rejects a supplier that does not store the resource", () => {
    const input = minimalScenarioV2();
    input.resources.push({ id: "Food" });
    point(input, 1).resources.push({ id: "Food" });
    point(input, 1).suppliers = [{ resource: "Food", from: "A" }];
    expect(errorsOf(input)).toContainEqual({
      path: "stockPoints[1].suppliers[0].from",
      message: "supplier A does not store resource Food",
    });
  });

  it("accepts backordered demand and costs", () => {
    const input = minimalScenarioV2();
    point(input, 1).consumers = [
      { resource: "Metals", rate: 12_000, unmet: "backorder", backorderCost: 5, lostCost: 0 },
    ];
    point(input, 1).resources = [{ id: "Metals", holdingCost: 1 }];
    const result = parse(input);
    expect(result.errors).toEqual([]);
    expect(result.ok && result.scenario.stockPoints[1]?.consumers[0]).toMatchObject({
      unmet: "backorder",
      backorderCost: 5,
    });
  });
});

describe("demand processes", () => {
  const withConsumer = (consumer: unknown) => {
    const input = minimalScenarioV2();
    point(input, 1).consumers = [
      consumer as Point["consumers"] extends (infer C)[] | undefined ? C : never,
    ];
    return input;
  };

  it("accepts Poisson arrivals", () => {
    const input = withConsumer({
      resource: "Metals",
      poisson: { arrivalsPerSol: 24_000, size: { kind: "fixed", value: 1000 } },
    });
    expect(parse(input).errors).toEqual([]);
  });

  it("accepts per-period amounts from a discrete distribution", () => {
    const input = withConsumer({
      resource: "Metals",
      perPeriod: {
        periodMs: 86_400_000,
        amount: {
          kind: "discrete",
          values: [
            { value: 0, weight: 1 },
            { value: 5000, weight: 3 },
          ],
        },
      },
    });
    expect(parse(input).errors).toEqual([]);
  });

  it("accepts a recorded trace with a ramp profile", () => {
    const input = withConsumer({
      resource: "Metals",
      trace: { periodMs: 3_600_000, amounts: [1000, 2000, 1500] },
      profile: [
        { atMs: 0, multiplierPermille: 1000 },
        { atMs: 3_600_000, multiplierPermille: 2000 },
      ],
    });
    expect(parse(input).errors).toEqual([]);
  });

  it("rejects an out-of-range profile multiplier with its path", () => {
    const input = withConsumer({
      resource: "Metals",
      rate: 1000,
      profile: [{ atMs: 0, multiplierPermille: 200_000 }],
    });
    expect(errorsOf(input).map((e) => e.path)).toContain(
      "stockPoints[1].consumers[0].profile[0].multiplierPermille",
    );
  });

  it("rejects profile points out of time order", () => {
    const input = withConsumer({
      resource: "Metals",
      rate: 1000,
      profile: [
        { atMs: 1000, multiplierPermille: 1000 },
        { atMs: 1000, multiplierPermille: 2000 },
      ],
    });
    expect(errorsOf(input)).toContainEqual({
      path: "stockPoints[1].consumers[0].profile[1].atMs",
      message: "profile points must be in time order",
    });
  });

  it("rejects a flow with two kinds", () => {
    const input = withConsumer({
      resource: "Metals",
      rate: 1000,
      trace: { periodMs: 3_600_000, amounts: [1] },
    });
    expect(errorsOf(input)).toContainEqual({
      path: "stockPoints[1].consumers[0]",
      message: "a flow needs exactly one of rate, poisson, perPeriod or trace",
    });
  });
});
