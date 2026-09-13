import { describe, expect, it } from "vitest";
import { checkPolicySource, instrumentPolicySource } from "./check.ts";

describe("portable Lua subset", () => {
  it("accepts ordinary Lua 5.1 code", () => {
    const source = [
      "local policy = {}",
      "function policy.on_stop(ctx)",
      "  for _, r in ipairs(ctx.station.resources) do",
      "    local n = math.floor(ctx.station.stock[r] / 2)",
      "    if n > 0 then ctx.load(r, n) end",
      "  end",
      "end",
      "return policy",
    ].join("\n");
    expect(checkPolicySource(source)).toEqual([]);
  });

  it("rejects integer division and suggests math.floor", () => {
    expect(checkPolicySource("local a = 1\nlocal b = a // 2\n")).toEqual([
      {
        line: 2,
        column: 11,
        message: "integer division // is not available in Lua 5.1; use math.floor(a / b)",
      },
    ]);
  });

  it("rejects bitwise operators", () => {
    const diagnostics = checkPolicySource("local a = 1 & 2\nlocal b = ~a\nlocal c = a << 1\n");
    expect(diagnostics.map((d) => [d.line, d.message])).toEqual([
      [1, "bitwise operator & is not available in Lua 5.1; use arithmetic instead"],
      [2, "bitwise operator ~ is not available in Lua 5.1; use arithmetic instead"],
      [3, "bitwise operator << is not available in Lua 5.1; use arithmetic instead"],
    ]);
  });

  it("rejects goto and labels", () => {
    const diagnostics = checkPolicySource("for i = 1, 3 do\n  goto done\nend\n::done::\n");
    expect(diagnostics.map((d) => d.line)).toEqual([2, 4]);
    expect(diagnostics[0]?.message).toContain("goto and labels are not available in Lua 5.1");
  });

  it("rejects variable attributes", () => {
    expect(checkPolicySource("local x <const> = 5\n")).toEqual([
      {
        line: 1,
        column: 1,
        message:
          "variable attributes such as <const> are not available in Lua 5.1; use a plain local",
      },
    ]);
  });

  it("reports syntax errors with their line", () => {
    const [diagnostic] = checkPolicySource("local a = 1\n\nlocal b = = 2\nlocal c = 3\n");
    expect(diagnostic?.line).toBe(3);
    expect(diagnostic?.message).toBe("<expression> expected near '='");
  });

  it("reserves the runtime's name prefix", () => {
    expect(checkPolicySource("__rr_tick = nil")[0]?.message).toBe(
      "names starting with __rr are reserved",
    );
  });
});

describe("instrumentation", () => {
  const ticks = (source: string) => instrumentPolicySource(source).split("__rr_tick();").length - 1;

  it("adds a check to every loop and function body without changing line numbers", () => {
    const source = [
      "local function f(a, b) return a end",
      "local g = function() end",
      "while true do end",
      "for i = 1, 10, 2 do end",
      "for k, v in pairs({}) --[[ comment ]] do end",
      "repeat until true",
      "function t.m:n(...) end",
    ].join("\n");
    expect(ticks(source)).toBe(7);
    const instrumented = instrumentPolicySource(source);
    expect(instrumented.split("\n")).toHaveLength(7);
    expect(checkPolicySource(instrumented.replace(/__rr_tick/g, "tick"))).toEqual([]);
  });

  it("handles comments between a loop header and its body", () => {
    const source = "while x -- wait\n  --[==[ long ]==]\n  do y() end";
    expect(instrumentPolicySource(source)).toContain("do __rr_tick(); y()");
  });
});
