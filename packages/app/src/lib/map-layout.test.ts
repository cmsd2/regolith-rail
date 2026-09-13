import { type Scenario, starterScenario, starterScenarios } from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { beforeAll, describe, expect, it } from "vitest";
import { mapLayout } from "./map-layout.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const load = (source: string): Scenario => {
  const result = runtime.loadScript(source);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.scenario;
};

describe("map layout", () => {
  it("keeps every Mars starter as a straight line spaced by distance, as before", () => {
    for (const { id } of starterScenarios) {
      const scenario = starterScenario(id);
      const layout = mapLayout(scenario);
      expect(layout.kind, id).toBe("line");
      // The line map placed each station at its distance along the line in scenario order.
      const gaps = scenario.stations.slice(1).map((s, i) => {
        const prev = scenario.stations[i]?.id;
        return scenario.arcs.find(
          (a) => (a.from === prev && a.to === s.id) || (a.to === prev && a.from === s.id),
        )?.distance as number;
      });
      const total = gaps.reduce((a, b) => a + b, 0);
      let along = 0;
      scenario.stations.forEach((s, i) => {
        expect(layout.points.get(s.id), `${id} ${s.id}`).toEqual({ x: along / total, y: 0.5 });
        along += gaps[i] ?? 0;
      });
    }
  });

  it("draws a loop of stations on a circle", () => {
    const layout = mapLayout(load("return classic.fixed_route_delivery { customers = 3 }"));
    expect(layout.kind).toBe("loop");
    expect(layout.points.get("Depot")?.y).toBeCloseTo(0.08);
    expect(layout.external).toEqual(["Depot"]);
  });

  it("draws a serial chain in layers from its outside supplier", () => {
    const layout = mapLayout(load("return classic.serial_chain { stages = 3 }"));
    expect(layout.kind).toBe("layers");
    const xs = ["Stage1", "Stage2", "Stage3"].map((id) => layout.points.get(id)?.x as number);
    expect(xs[0]).toBeCloseTo(0.08);
    expect(xs[1]).toBeCloseTo(0.5);
    expect(xs[2]).toBeCloseTo(0.92);
    expect(layout.supplies).toEqual([
      { from: "Stage1", to: "Stage2" },
      { from: "Stage2", to: "Stage3" },
    ]);
  });

  it("uses positions from the script when every station has one", () => {
    const layout = mapLayout(
      load(
        'return scenario { id = "p", duration = sols(1), stations = { station { id = "A", resources = { "M" }, position = { x = 0, y = 0 } }, station { id = "B", resources = { "M" }, position = { x = 10, y = 5 } } } }',
      ),
    );
    expect(layout.kind).toBe("positions");
    expect(layout.points.get("B")).toEqual({ x: 0.92, y: 0.5 });
  });

  it("falls back to a circle for anything else", () => {
    expect(mapLayout(load("return classic.newsvendor {}")).kind).toBe("circle");
  });
});
