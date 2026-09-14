import { type Scenario, starterScenario, starterScenarios } from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { classicTemplates, STARTER_SCRIPTS, templateCall } from "@regolith-rail/scenario-kit";
import { beforeAll, describe, expect, it } from "vitest";
import relayV1 from "../../../engine/src/testing/format1/relay.json" with { type: "json" };
import {
  documentToScript,
  knownScenario,
  starterSource,
  upgradeScenarioRecord,
} from "./scenario-source.ts";

/** The relay starter as the first release showed it, in format 1 JSON. */
const formerRelayText = `${JSON.stringify(relayV1, null, 2)}\n`;

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const load = (source: string): Scenario => {
  const result = runtime.loadScript(source);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.scenario;
};

/** A scenario using every part of the format. */
const EVERYTHING = `
local shop = station {
  id = "Shop",
  resources = { store { resource = "Beer", capacity = "unlimited", expires = true, holding_cost = 2 }, store { resource = "Malt", initial = 2.5 } },
  consumers = {
    consumer { resource = "Beer", poisson = poisson { per_sol = 2.5, size = discrete { { 1, 3 }, { 2.25, 1 } } }, unmet = "backorder", backorder_cost = 5 },
    consumer { resource = "Malt", per_period = per_period { period = sols(1), amount = 2 }, profile = profile { { 0, 1 }, { hours(30), 1.5 } }, lost_cost = 3 },
    consumer { resource = "Malt", rate = 1, variability = bursts { on_ppm = 10, off_ppm = 20, starts_on = false } },
  },
  producers = { producer { resource = "Malt", trace = trace { period = hours(6), amounts = { 1, 0.5 } }, stall_cost = 1 }, producer { resource = "Beer", rate = 0.001, variability = uniform { range = 5, period = minutes(90) } } },
  converters = { converter { inputs = { Malt = 2 }, outputs = { Beer = 1 }, rate = 12.5, variability = bursts { on_ppm = 100, off_ppm = 200 } } },
  suppliers = { supplier { resource = "Beer", lead_time = discrete { { days(1), 1 }, { 90000, 1 } }, min_order = 1, max_order = 50, order_cost = 10, unit_cost = 1 } },
  review = review { period = days(1), offset = hours(1) },
  position = { x = 1.5, y = -2 },
}
local depot = station { id = "Depot-1", resources = { Beer = { initial = 10 }, Malt = true } }
return scenario {
  id = "everything", title = "Everything", description = "Every part.", docs = "guides/x", information = "local",
  duration = sols(10), seed = 7, sample_interval = minutes(30),
  resources = { resource { id = "Beer", priority = 2 }, "Malt" },
  stations = { depot, shop },
  arcs = { arc { from = "Depot-1", to = "Shop", distance = 50 } },
  vehicles = {
    vehicle { id = "V", route = loop { stops = { "Depot-1", "Shop" }, start = "Shop" }, speed = 5, capacity = { Beer = 10, Malt = 2.5 }, dwell = minutes(5), dwell_per_unit = 0, cost_per_distance = 3 },
    vehicle { id = "W", route = shuttle { stops = { "Depot-1", "Shop" }, direction = "backward" }, speed = 5, capacity = 10 },
    vehicle { id = "X", route = timetable { stops = { depot, shop }, departures = { 0, hours(12) } }, speed = 5, capacity = 10 },
  },
  events = {
    event { id = "storm", label = "Storm", start = sols(2), duration = sols(1), effects = { effect { type = "supply", multiplier = 0 } } },
    event { id = "rush", chance_ppm = 1000, check_every = hours(1), duration = hours(3), effects = { effect { type = "demand", stations = "Shop", resources = { "Beer" }, multiplier = 2.5, start_offset = hours(1), duration = 90000 } } },
  },
}
`;

describe("documents as scripts", () => {
  const roundTrip = (scenario: Scenario) =>
    expect(load(documentToScript(scenario))).toEqual(scenario);

  it("reproduce every starter", () => {
    for (const { id } of starterScenarios) roundTrip(starterScenario(id));
  });

  it("reproduce every classic template", () => {
    for (const t of classicTemplates) roundTrip(load(templateCall(t.name, t.defaults)));
  });

  it("reproduce every part of the format", () => {
    roundTrip(load(EVERYTHING));
  });
});

describe("scenario records", () => {
  it("know an unedited starter's scenario without evaluating it", () => {
    expect(knownScenario(starterSource("relay"))).toEqual(starterScenario("relay"));
    expect(knownScenario({ ...starterSource("relay"), source: "return 1" })).toBeNull();
  });

  it("turn an unedited starter from an older link into its script", () => {
    expect(upgradeScenarioRecord({ starterId: "relay", text: formerRelayText })).toEqual({
      kind: "script",
      source: STARTER_SCRIPTS.relay,
      starterId: "relay",
    });
  });

  it("recognise an unedited starter by its content, whatever the layout", () => {
    const current = starterScenarios.find((s) => s.id === "relay")?.document;
    expect(upgradeScenarioRecord({ starterId: "relay", text: JSON.stringify(current) })).toEqual({
      kind: "script",
      source: STARTER_SCRIPTS.relay,
      starterId: "relay",
    });
  });

  it("show an edited format 1 document from an older link upgraded to format 2", () => {
    const edited = JSON.parse(formerRelayText);
    edited.title = "My relay";
    const record = upgradeScenarioRecord({ starterId: "relay", text: JSON.stringify(edited) });
    expect(record?.kind).toBe("json");
    expect(record?.starterId).toBeNull();
    const document = JSON.parse(record?.source ?? "");
    expect(document).toMatchObject({ format: 2, title: "My relay" });
    expect(document.arcs).toHaveLength(2);
  });

  it("keep text that is not a document for the editor to report", () => {
    expect(upgradeScenarioRecord({ starterId: null, text: "{ oops" })).toEqual({
      kind: "json",
      source: "{ oops",
      starterId: null,
    });
  });

  it("pass scripts and templates through and reject anything else", () => {
    const record = {
      kind: "script",
      source: "return classic.reorder {}",
      starterId: null,
      template: { name: "classic.reorder", params: { demand: 5 } },
    };
    expect(upgradeScenarioRecord(record)).toEqual(record);
    expect(upgradeScenarioRecord({ kind: "script" })).toBeNull();
    expect(upgradeScenarioRecord(5)).toBeNull();
  });
});
