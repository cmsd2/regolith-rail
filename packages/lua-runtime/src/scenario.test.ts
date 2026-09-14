import { runSimulation } from "@regolith-rail/engine";
import { constructs } from "@regolith-rail/scenario-kit";
import { beforeAll, describe, expect, it } from "vitest";
import { LuaRuntime } from "./policy.ts";
import { DOCUMENT_LIMITS, lineForPath } from "./scenario.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const lines = (...text: string[]) => text.join("\n");

/** Mine and Dome on a line with one train, as a script. */
const twoStations = lines(
  "local mine = station {",
  '  id = "Mine",',
  "  resources = { Metals = { initial = 15 } },",
  '  producers = { producer { resource = "Metals", rate = 45 } },',
  "}",
  "local dome = station {",
  '  id = "Dome",',
  "  resources = { Metals = { initial = 15 } },",
  '  consumers = { consumer { resource = "Metals", rate = 36, variability = uniform { range = 20, period = hours(2) } } },',
  "}",
  "return scenario {",
  '  id = "two-station",',
  "  duration = sols(10),",
  "  parts = { line { stations = { mine, dome }, distances = 72000 } },",
  "  vehicles = {",
  '    vehicle { id = "T1", route = shuttle { stops = { mine, dome } }, speed = 5, capacity = 30 },',
  "  },",
  "}",
);

const errorsOf = (source: string) => {
  const result = runtime.loadScript(source);
  if (result.ok) throw new Error("expected the script to fail");
  return result.errors;
};

const documentOf = (source: string) => {
  const result = runtime.evaluateScript(source);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.document;
};

describe("scenario scripts", () => {
  it("evaluate to a document that validates and runs", () => {
    const result = runtime.loadScript(twoStations);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.scenario.stations.map((s) => s.id)).toEqual(["Mine", "Dome"]);
    expect(result.scenario.arcs).toEqual([{ from: "Mine", to: "Dome", distance: 72000 }]);
    expect(result.scenario.vehicles[0]?.route).toEqual({
      kind: "shuttle",
      stops: ["Mine", "Dome"],
      direction: "forward",
    });
    expect(result.scenario.resources).toEqual([{ id: "Metals", priority: 1 }]);
    expect(result.scenario.stations[1]?.consumers[0]).toMatchObject({
      rate: 36_000,
      variability: { kind: "uniform", rangePercent: 20, periodMs: 7_200_000 },
    });
    const out = runSimulation(
      result.scenario,
      runtime.createPolicy("return { on_stop = function(ctx) end }"),
      {
        detail: "summary",
      },
    );
    expect(out.aborted).toBe(false);
  });

  it("refuse randomness at authoring time", () => {
    const [error] = errorsOf('local x = math.random()\nreturn scenario { id = "x", duration = 1 }');
    expect(error?.line).toBe(1);
    expect(error?.message).toContain("scenario randomness belongs in demand and event processes");
  });

  it("evaluate the same way every time, including the order of keyed tables", () => {
    const source = lines(
      "local stations = {}",
      "for id, initial in pairs({ Zeta = 1, Alpha = 2, Mid = 3 }) do",
      "  stations[#stations + 1] = station { id = id, resources = { Water = { initial = initial }, Air = true } }",
      "end",
      'return scenario { id = "loop", duration = sols(1), stations = stations }',
    );
    const first = runtime.evaluateScript(source);
    const second = runtime.evaluateScript(source);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    const doc = documentOf(source) as { stations: { id: string; resources: { id: string }[] }[] };
    expect(doc.stations.map((s) => s.id)).toEqual(["Alpha", "Mid", "Zeta"]);
    expect(doc.stations[0]?.resources.map((r) => r.id)).toEqual(["Air", "Water"]);
  });

  it("stop a runaway script at the budget", () => {
    const [error] = errorsOf("while true do end");
    expect(error).toEqual({
      line: 1,
      message: "instruction budget exceeded; the scenario script ran too long",
    });
  });

  it("report syntax and language subset errors at their lines", () => {
    expect(errorsOf("local x = 1\nlocal y = = 2")[0]?.line).toBe(2);
    expect(errorsOf("local x = 7 // 2")[0]?.message).toContain("integer division");
  });

  it("require a returned scenario", () => {
    expect(errorsOf("return 5")[0]?.message).toBe(
      "the script must return a scenario, such as return scenario { ... }",
    );
  });
});

describe("errors at script lines", () => {
  it("name the line, construct and parameter of an invalid parameter", () => {
    const source = lines(
      "-- A shop.",
      "local shop",
      "",
      "",
      "",
      "",
      'shop = station { id = "Shop", resources = { store { resource = "Beer", capacity = -5 } } }',
      'return scenario { id = "shop", duration = sols(1), stations = { shop } }',
    );
    expect(errorsOf(source)).toEqual([
      { line: 7, message: "store: capacity must not be negative" },
    ]);
  });

  it("report a validation error at the line of the construct that built the invalid part", () => {
    const source = lines(
      'local a = station { id = "A", resources = { "Metals" } }',
      'local b = station { id = "B", resources = { "Metals" } }',
      "return scenario {",
      '  id = "routes",',
      "  duration = sols(1),",
      "  stations = { a, b },",
      '  arcs = { arc { from = "A", to = "B", distance = 100 } },',
      "  vehicles = {",
      "    vehicle {",
      '      id = "V",',
      "      speed = 10,",
      '      route = shuttle { stops = { "A", "Nowhere" } },',
      "      capacity = 10,",
      "    },",
      "  },",
      "}",
    );
    const errors = errorsOf(source);
    const stop = errors.find((e) => e.path === "vehicles[0].route.stops[1]");
    expect(stop?.line).toBe(12);
    expect(stop?.message).toContain("Nowhere");
  });

  it("report a runtime error inside a library call at the calling line", () => {
    const [error] = errorsOf('local x = 1\nreturn scenario { id = "x", duration = hours("two") }');
    expect(error).toEqual({ line: 2, message: "hours: expects a number, such as hours(2)" });
  });

  it("map paths to the longest prefix a construct built", () => {
    const map = { "(document)": 1, "stations[0]": 3, "stations[0].resources[0]": 4 };
    expect(lineForPath(map, "stations[0].resources[0].capacity")).toBe(4);
    expect(lineForPath(map, "stations[0].producers[2].rate")).toBe(3);
    expect(lineForPath(map, "arcs[0]")).toBe(1);
    expect(lineForPath({}, "arcs[0]")).toBeUndefined();
  });
});

describe("units", () => {
  it("convert durations exactly", () => {
    const doc = documentOf(
      lines(
        'local shop = station { id = "Shop", resources = { "Beer" },',
        '  suppliers = { supplier { resource = "Beer", lead_time = sols(1.5) } } }',
        'return scenario { id = "shop", duration = weeks(2), stations = { shop } }',
      ),
    ) as { durationMs: number; stations: { suppliers: { leadTime: unknown }[] }[] };
    expect(doc.stations[0]?.suppliers[0]?.leadTime).toEqual({ kind: "fixed", value: 129_600_000 });
    expect(doc.durationMs).toBe(14 * 86_400_000);
  });

  it("reject quantities finer than a milli-unit", () => {
    const [error] = errorsOf(
      'return scenario { id = "x", duration = 1, stations = { station { id = "A", resources = { store { resource = "Beer", capacity = 0.0005 } } } } }',
    );
    expect(error?.message).toBe(
      "store: capacity of 0.0005 units cannot be stated exactly: quantities have a resolution of 0.001 units; the nearest values are 0 and 0.001",
    );
  });

  it("reject durations that are not whole milliseconds", () => {
    const [error] = errorsOf('return scenario { id = "x", duration = minutes(1 / 7) }');
    expect(error?.message).toContain(
      "durations have a resolution of 1 ms; the nearest values are 8571 ms and 8572 ms",
    );
  });

  it("limit the size of the document", () => {
    const [error] = errorsOf(
      lines(
        "local stations = {}",
        `for i = 1, ${DOCUMENT_LIMITS.stations + 1} do`,
        '  stations[i] = station { id = "S" .. i, resources = { "Metals" } }',
        "end",
        'return scenario { id = "big", duration = sols(1), stations = stations }',
      ),
    );
    expect(error?.message).toBe(
      `the scenario has ${DOCUMENT_LIMITS.stations + 1} stations; the limit is ${DOCUMENT_LIMITS.stations}`,
    );
  });
});

describe("core constructs", () => {
  it("apply documented defaults", () => {
    const doc = documentOf(
      'return scenario { id = "x", duration = sols(1), stations = { station { id = "A", resources = { "Metals" } } } }',
    ) as { stations: { resources: unknown[] }[]; informationLevel: string; seed: number };
    expect(doc.stations[0]?.resources[0]).toEqual({
      id: "Metals",
      capacity: 30_000,
      initial: 0,
      expires: false,
    });
    expect(doc.informationLevel).toBe("line");
    expect(doc.seed).toBe(1);
  });

  it("return tables a script can change before returning the scenario", () => {
    const source = lines(
      'local l = line { stations = { station { id = "A", resources = { "Metals" } }, station { id = "B", resources = { "Metals" } } }, distances = 400 }',
      "l.stations[2].resources[1].capacity = units(45)",
      'return scenario { id = "x", duration = sols(1), parts = { l } }',
    );
    const result = runtime.loadScript(source);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.scenario.stations[1]?.resources[0]?.capacity).toBe(45_000);
  });

  it("build every part of the format", () => {
    const source = lines(
      "local shop = station {",
      '  id = "Shop",',
      '  resources = { store { resource = "Beer", capacity = "unlimited", expires = true, holding_cost = 2 }, "Malt" },',
      "  consumers = {",
      '    consumer { resource = "Beer", poisson = poisson { per_sol = 2.5, size = discrete { { 1, 3 }, { 2, 1 } } }, unmet = "backorder", backorder_cost = 5 },',
      '    consumer { resource = "Malt", per_period = per_period { period = sols(1), amount = 2 }, profile = profile { { 0, 1 }, { sols(5), 1.5 } } },',
      "  },",
      '  producers = { producer { resource = "Malt", trace = trace { period = hours(6), amounts = { 1, 0.5 } }, stall_cost = 1 } },',
      "  converters = { converter { inputs = { Malt = 2 }, outputs = { Beer = 1 }, rate = 12, variability = bursts { on_ppm = 100, off_ppm = 200 } } },",
      '  suppliers = { supplier { resource = "Beer", lead_time = discrete { { days(1), 1 }, { days(2), 1 } }, min_order = 1, max_order = 50, order_cost = 10, unit_cost = 1 } },',
      "  review = review { period = days(1), offset = hours(1) },",
      "  position = { x = 1, y = 2 },",
      "}",
      'local depot = station { id = "Depot", resources = { Beer = { initial = 10 } } }',
      "return scenario {",
      '  id = "everything", title = "Everything", description = "Every part.", information = "local",',
      "  duration = sols(10), seed = 7, sample_interval = hours(2),",
      "  resources = { Beer = { priority = 2 }, Malt = true },",
      "  stations = { depot, shop },",
      '  arcs = { arc { from = "Depot", to = "Shop", distance = 50 } },',
      "  vehicles = {",
      '    vehicle { id = "V", route = loop { stops = { "Depot", "Shop" } }, speed = 5, capacity = { Beer = 10 }, dwell = minutes(5), dwell_per_unit = 0, cost_per_distance = 3 },',
      '    vehicle { id = "W", route = timetable { stops = { depot, shop }, departures = { 0, hours(12) } }, speed = 5, capacity = 10 },',
      "  },",
      "  events = {",
      '    event { id = "storm", label = "Storm", start = sols(2), duration = sols(1), effects = { effect { type = "supply", multiplier = 0 } } },',
      '    event { id = "rush", chance_ppm = 1000, check_every = hours(1), duration = hours(3), effects = { effect { type = "demand", stations = "Shop", resources = { "Beer" }, multiplier = 2.5, start_offset = hours(1), duration = hours(1) } } },',
      "  },",
      "}",
    );
    const result = runtime.loadScript(source);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const { scenario } = result;
    expect(scenario.resources).toEqual([
      { id: "Beer", priority: 2 },
      { id: "Malt", priority: 1 },
    ]);
    const shop = scenario.stations[1];
    expect(shop?.consumers[0]?.poisson).toEqual({
      arrivalsPerSol: 2500,
      size: {
        kind: "discrete",
        values: [
          { value: 1000, weight: 3 },
          { value: 2000, weight: 1 },
        ],
      },
    });
    expect(shop?.consumers[1]?.profile).toEqual([
      { atMs: 0, multiplierPermille: 1000 },
      { atMs: 432_000_000, multiplierPermille: 1500 },
    ]);
    expect(shop?.producers[0]?.trace).toEqual({ periodMs: 21_600_000, amounts: [1000, 500] });
    expect(shop?.converters[0]).toMatchObject({
      inputs: [{ resource: "Malt", amount: 2000 }],
      outputs: [{ resource: "Beer", amount: 1000 }],
      rate: 12_000,
    });
    expect(shop?.suppliers[0]).toMatchObject({ minOrder: 1000, maxOrder: 50_000, orderCost: 10 });
    expect(shop?.review).toEqual({ periodMs: 86_400_000, offsetMs: 3_600_000 });
    expect(scenario.vehicles[1]?.route).toEqual({
      kind: "timetable",
      stops: ["Depot", "Shop"],
      departuresMs: [0, 43_200_000],
    });
    expect(scenario.events[1]?.schedule).toEqual({
      kind: "random",
      probabilityPpm: 1000,
      checkIntervalMs: 3_600_000,
      durationMs: 10_800_000,
    });
    const out = runSimulation(
      scenario,
      runtime.createPolicy("return { on_stop = function(ctx) end, on_review = function(ctx) end }"),
      { detail: "summary" },
    );
    expect(out.aborted).toBe(false);
  });

  it("reject unknown parameters", () => {
    expect(errorsOf('return scenario { id = "x", duration = 1, colour = "red" }')[0]).toEqual({
      line: 1,
      message: "scenario: has no parameter named colour",
    });
  });
});

describe("construct descriptions", () => {
  it("match the constructs and parameters the libraries define", () => {
    const { constructs: declared, functions } = runtime.libraryConstructs();
    const described = new Map(constructs.map((c) => [c.name, c]));
    expect([...described.keys()].sort()).toEqual([...functions].sort());
    for (const [name, params] of Object.entries(declared)) {
      const construct = described.get(name);
      expect(construct?.kind, name).not.toBe("helper");
      expect(construct?.params.map((p) => p.name).sort(), name).toEqual(Object.keys(params).sort());
    }
    for (const construct of constructs) {
      if (construct.kind !== "helper")
        expect(declared[construct.name], construct.name).toBeDefined();
    }
  });
});
