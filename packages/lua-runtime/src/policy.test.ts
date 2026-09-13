import {
  type RunEvent,
  runSimulation,
  type Scenario,
  type ScenarioInput,
  validateScenario,
} from "@regolith-rail/engine";
import { beforeAll, describe, expect, it } from "vitest";
import { LuaRuntime } from "./policy.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

const MINUTE = 60_000;

function scenario(change: (s: ScenarioInput) => void = () => {}): Scenario {
  const input: ScenarioInput = {
    format: 1,
    id: "lua-test",
    title: "Lua test",
    description: "Two stations for runtime tests.",
    durationMs: 5 * MINUTE,
    seed: 1,
    informationLevel: "line",
    resources: [{ id: "Metals" }, { id: "Food" }],
    stations: [
      { id: "A", resources: [{ id: "Metals", initial: 20_000 }], distanceToNext: 400 },
      { id: "B", resources: [{ id: "Metals", initial: 5_000 }, { id: "Food" }] },
    ],
    trains: [{ id: "T1", start: "A", speed: 10, capacity: { shared: 30_000 } }],
  };
  change(input);
  const result = validateScenario(input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.scenario;
}

const run = (source: string, s: Scenario = scenario(), options = {}) =>
  runSimulation(s, runtime.createPolicy(source, options), { detail: "summary" });

const ofKind = <K extends RunEvent["kind"]>(events: RunEvent[], kind: K) =>
  events.filter((e): e is RunEvent & { kind: K } => e.kind === kind);

const firstError = (source: string, s?: Scenario, options = {}) =>
  ofKind(run(source, s, options).events, "error")[0];

describe("Lua runtime", () => {
  it("runs a trivial policy and applies its actions", () => {
    const out = run(`
      return {
        on_stop = function(ctx)
          if ctx.station.id == "A" then ctx.load("Metals", 1000) end
        end,
      }
    `);
    expect(out.aborted).toBe(false);
    expect(ofKind(out.events, "transfer")[0]).toMatchObject({
      station: "A",
      resource: "Metals",
      amount: 1000,
    });
  });
});

describe("policy module", () => {
  it("requires on_stop", () => {
    const out = run("return {}");
    expect(out.aborted).toBe(true);
    expect(ofKind(out.events, "error")[0]).toMatchObject({
      errorKind: "load",
      message: "the policy's table has no on_stop function; on_stop is required",
    });
  });

  it("reports a syntax error with its line and runs nothing", () => {
    const out = run("return {\n  on_stop = function(ctx)\n    local x = = 1\n  end,\n}");
    expect(out.aborted).toBe(true);
    expect(out.metrics.stops).toBe(0);
    expect(ofKind(out.events, "error")[0]).toMatchObject({ errorKind: "load", line: 3 });
  });

  it("rejects integer division when loading", () => {
    expect(firstError("return { on_stop = function(ctx) return 7 // 2 end }")).toMatchObject({
      errorKind: "load",
      message: "integer division // is not available in Lua 5.1; use math.floor(a / b)",
    });
  });

  it("calls on_start once per run", () => {
    const out = run(`
      return {
        on_start = function(ctx) ctx.log("start", ctx.now, #ctx.line.stations) end,
        on_stop = function(ctx) end,
      }
    `);
    expect(ofKind(out.events, "log").map((e) => e.message)).toEqual(["start 0 2"]);
  });
});

describe("sandbox", () => {
  it("directs math.random to ctx.rand", () => {
    expect(firstError("return { on_stop = function(ctx) return math.random() end }")).toMatchObject(
      {
        errorKind: "runtime",
        line: 1,
        message:
          "math.random is not available to policies; use ctx.rand(), which repeats for the same seed",
      },
    );
  });

  for (const name of [
    "io",
    "os",
    "debug",
    "package",
    "require",
    "load",
    "loadstring",
    "dofile",
    "loadfile",
    "collectgarbage",
  ]) {
    it(`blocks ${name}`, () => {
      expect(
        firstError(`return { on_stop = function(ctx) local x = ${name} end }`)?.message,
      ).toMatch(new RegExp(`^${name} is not available to policies`));
    });
  }

  it("does not keep globals between runs", () => {
    const policy = runtime.createPolicy(`
      return { on_stop = function(ctx) ctx.log(tostring(seen)); seen = true end }
    `);
    const s = scenario((x) => (x.durationMs = 30_000));
    const first = runSimulation(s, policy, { detail: "summary" });
    const second = runSimulation(s, policy, { detail: "summary" });
    expect(ofKind(first.events, "log")[0]?.message).toBe("nil");
    expect(ofKind(second.events, "log")[0]?.message).toBe("nil");
  });

  it("caps string.rep, including method calls on strings", () => {
    expect(
      firstError('return { on_stop = function(ctx) local s = ("x"):rep(2000000) end }')?.message,
    ).toContain("string.rep result would be longer");
  });
});

describe("instruction budget", () => {
  it("stops an infinite loop, reports the line and continues the run", () => {
    const out = run(
      "return {\n  on_stop = function(ctx)\n    while true do end\n  end,\n}",
      scenario(),
      {
        budget: 10_000,
      },
    );
    const errors = ofKind(out.events, "error");
    expect(errors.length).toBe(out.metrics.stops);
    expect(errors[0]).toMatchObject({ errorKind: "budget", line: 3 });
    expect(out.metrics.budgetOverruns).toBe(out.metrics.stops);
    expect(out.metrics.stops).toBeGreaterThan(1);
  });

  it("cannot be escaped with pcall", () => {
    const source = `return { on_stop = function(ctx)
      while true do pcall(function() while true do end end) end
    end }`;
    expect(firstError(source, scenario(), { budget: 1000 })?.errorKind).toBe("budget");
  });

  it("stops runaway recursion", () => {
    const source =
      "local function f(n) return f(n + 1) end\nreturn { on_stop = function(ctx) f(1) end }";
    expect(firstError(source, scenario(), { budget: 1000 })?.errorKind).toBe("budget");
  });
});

describe("context", () => {
  it("is read-only", () => {
    expect(
      firstError("return { on_stop = function(ctx) ctx.station.stock.Metals = 1 end }"),
    ).toMatchObject({
      errorKind: "runtime",
      message: "the snapshot is read-only; keep your own data in ctx.memory",
    });
  });

  it("records named series", () => {
    const out = run('return { on_stop = function(ctx) ctx.record("target", 12000) end }');
    expect(out.records.target?.v.length).toBe(out.metrics.stops);
    expect(out.records.target?.v[0]).toBe(12000);
  });

  it("gives repeatable random numbers for the same seed", () => {
    const source = 'return { on_stop = function(ctx) ctx.record("r", ctx.rand()) end }';
    const a = run(source).records.r?.v;
    const b = run(source).records.r?.v;
    const c = runSimulation(scenario(), runtime.createPolicy(source), {
      seed: 2,
      detail: "summary",
    }).records.r?.v;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a?.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("measures distance and travel time along the line", () => {
    const out = run(
      'return { on_stop = function(ctx) ctx.log(ctx.line.distance("B", "A"), ctx.line.travel_time("A", "B")) end }',
    );
    expect(ofKind(out.events, "log")[0]?.message).toBe("400 40000");
  });

  it("exposes train cargo, space and direction", () => {
    const out = run(
      "return { on_stop = function(ctx) local t = ctx.train ctx.log(t.id, t.direction, t.cargo.Metals, t.space.Food, t.capacity.shared) end }",
    );
    expect(ofKind(out.events, "log")[0]?.message).toBe("T1 forward 0 30000 30000");
  });
});

describe("information levels", () => {
  const readOther =
    "return { on_stop = function(ctx) ctx.log(ctx.line.stations[2].stock.Metals) end }";

  it("blocks reading another station's stock at the local level", () => {
    const s = scenario((x) => (x.informationLevel = "local"));
    expect(firstError(readOther, s)).toMatchObject({
      errorKind: "runtime",
      message: "reading another station's stock requires the line information level",
    });
  });

  it("allows it at the line level", () => {
    expect(ofKind(run(readOther).events, "log")[0]?.message).toBe("5000");
  });
});

describe("memory", () => {
  it("keeps memory between stops", () => {
    const out = run(`return { on_stop = function(ctx)
      ctx.memory.count = (ctx.memory.count or 0) + 1
      ctx.train.memory.seen = true
      ctx.station.memory.visits = (ctx.station.memory.visits or 0) + 1
      ctx.record("count", ctx.memory.count)
    end }`);
    expect(out.records.count?.v).toEqual(
      Array.from({ length: out.metrics.stops }, (_, i) => i + 1),
    );
  });

  it("rejects a function stored in memory and names the key", () => {
    expect(
      firstError("return { on_stop = function(ctx) ctx.memory.callback = function() end end }"),
    ).toMatchObject({
      errorKind: "memory",
      message:
        "memory may hold only booleans, numbers, strings and tables of those: ctx.memory.callback holds a function",
    });
  });

  it("rejects cycles and snapshot tables", () => {
    expect(
      firstError("return { on_stop = function(ctx) local t = {} t.self = t ctx.memory.t = t end }")
        ?.message,
    ).toContain("ctx.memory.t.self contains a cycle");
    expect(
      firstError("return { on_stop = function(ctx) ctx.memory.s = ctx.station end }")?.message,
    ).toContain("ctx.memory.s holds part of the snapshot");
  });
});

describe("save and reload test mode", () => {
  it("loses module-level state but keeps memory", () => {
    const source = `
      local count = 0
      return { on_stop = function(ctx)
        count = count + 1
        ctx.memory.count = (ctx.memory.count or 0) + 1
        ctx.record("local", count)
        ctx.record("memory", ctx.memory.count)
      end }`;
    const s = scenario((x) => (x.durationMs = 60 * MINUTE));
    const normal = run(source, s);
    const reloaded = run(source, s, { saveReloadTest: true });
    expect(normal.records.local?.v).toEqual(normal.records.memory?.v);
    expect(reloaded.records.memory?.v).toEqual(normal.records.memory?.v);
    expect(reloaded.records.local?.v).not.toEqual(reloaded.records.memory?.v);
  });
});

describe("unordered iteration", () => {
  const source = `return { on_stop = function(ctx)
    local t = {}
    for i = 1, 10 do t["k" .. i] = i end
    local keys = {}
    for k in pairs(t) do keys[#keys + 1] = k end
    ctx.log(table.concat(keys, ","))
  end }`;
  const order = (seed: number) =>
    ofKind(
      runSimulation(scenario(), runtime.createPolicy(source), { seed, detail: "summary" }).events,
      "log",
    )[0]?.message;

  it("varies with the seed and repeats for the same seed", () => {
    expect(order(1)).not.toBe(order(2));
    expect(order(1)).toBe(order(1));
    expect(order(1)?.split(",").sort()).toEqual(
      Array.from({ length: 10 }, (_, i) => `k${i + 1}`).sort(),
    );
  });

  it("applies to next as well", () => {
    const viaNext = `return { on_stop = function(ctx)
      local t = { a = 1, b = 2, c = 3, d = 4, e = 5 }
      local keys, k = {}, next(t)
      while k do keys[#keys + 1] = k; k = next(t, k) end
      ctx.log(table.concat(keys, ","))
    end }`;
    const log = ofKind(run(viaNext).events, "log")[0]?.message;
    expect(log?.split(",").sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("errors", () => {
  it("report the line, train, station and time", () => {
    const source =
      "return {\n  on_stop = function(ctx)\n    local x = nil\n    return x.field\n  end,\n}";
    expect(firstError(source)).toMatchObject({
      errorKind: "runtime",
      line: 4,
      train: "T1",
      station: "A",
      t: 0,
    });
  });
});

describe("run output", () => {
  it("records the Policy API version", () => {
    expect(run("return { on_stop = function(ctx) end }").apiVersion).toBe(1);
  });
});
