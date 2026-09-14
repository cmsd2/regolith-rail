import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const main = fileURLToPath(new URL("./main.ts", import.meta.url));
const run = promisify(execFile);

async function cli(...args: string[]) {
  try {
    const { stdout, stderr } = await run(process.execPath, [main, ...args]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

describe("command-line runner", () => {
  it("runs a starter scenario with the Lua baseline headlessly", async () => {
    const result = await cli(
      "run",
      "--scenario",
      "two-station",
      "--policy",
      "lua:naive",
      "--seed",
      "7",
    );
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      scenarioId: "two-station",
      seed: 7,
      apiVersion: 2,
      aborted: false,
    });
    expect(output.metrics.stops).toBeGreaterThan(0);
    expect(output.events.length).toBeGreaterThan(0);
    expect(output.hash).toMatch(/^[0-9a-f]{16}$/);
  }, 60_000);

  it("runs a range of seeds", async () => {
    const result = await cli(
      "run",
      "--scenario",
      "relay",
      "--policy",
      "reference:naive",
      "--seeds",
      "1..3",
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).map((o: { seed: number }) => o.seed)).toEqual([1, 2, 3]);
  }, 60_000);

  it("prints validation errors and fails for an invalid scenario", async () => {
    const dir = mkdtempSync(join(tmpdir(), "regolith-rail-"));
    const file = join(dir, "bad.json");
    writeFileSync(file, JSON.stringify({ format: 1, id: "bad" }));
    const result = await cli("run", "--scenario", file, "--policy", "reference:naive");
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("is not a valid scenario");
    expect(result.stderr).toContain("title:");
  }, 60_000);

  it("runs a scenario script", async () => {
    const dir = mkdtempSync(join(tmpdir(), "regolith-rail-"));
    const file = join(dir, "shop.lua");
    writeFileSync(
      file,
      [
        'local a = station { id = "A", resources = { Metals = { initial = 10 } } }',
        'local b = station { id = "B", resources = { "Metals" } }',
        "return scenario {",
        '  id = "script", duration = hours(2), parts = { line { stations = { a, b }, distances = 100 } },',
        '  vehicles = { vehicle { id = "T1", route = shuttle { stops = { a, b } }, speed = 10, capacity = 10 } },',
        "}",
      ].join("\n"),
    );
    const result = await cli("run", "--scenario", file, "--policy", "lua:naive");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ scenarioId: "script", aborted: false });
  }, 60_000);

  it("runs a template with parameters", async () => {
    const result = await cli(
      "run",
      "--template",
      "classic.reorder",
      "--param",
      "demand=5",
      "--param",
      "review_period=hours(6)",
      "--param",
      "shortage=lost",
      "--policy",
      "reference:naive",
    );
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({ scenarioId: "reorder", aborted: false });
    expect(output.events.filter((e: { kind: string }) => e.kind === "review")).toHaveLength(80);
  }, 60_000);

  it("reports a template parameter error", async () => {
    const result = await cli(
      "run",
      "--template",
      "classic.serial_chain",
      "--param",
      "stages=40",
      "--policy",
      "reference:naive",
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "classic.serial_chain: stages must be a whole number from 2 to 10",
    );
  }, 60_000);

  it("reports an invalid scenario script at its lines", async () => {
    const dir = mkdtempSync(join(tmpdir(), "regolith-rail-"));
    const file = join(dir, "bad.lua");
    writeFileSync(
      file,
      [
        'local a = station { id = "A", resources = { "Metals" } }',
        'return scenario { id = "bad", duration = hours(1), stations = { a },',
        '  vehicles = { vehicle { id = "V", route = shuttle { stops = { "A", "Nowhere" } }, speed = 1, capacity = 1 } } }',
      ].join("\n"),
    );
    const result = await cli("run", "--scenario", file, "--policy", "reference:naive");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("is not a valid scenario");
    expect(result.stderr).toContain(`${file}:3 vehicles[0].route.stops[1]:`);
  }, 60_000);

  it("reports a Lua load error with its line before running", async () => {
    const dir = mkdtempSync(join(tmpdir(), "regolith-rail-"));
    const file = join(dir, "policy.lua");
    writeFileSync(file, "return {\n  on_stop = function(ctx) return 7 // 2 end,\n}\n");
    const result = await cli("run", "--scenario", "two-station", "--policy", file);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`${file}:2: integer division`);
    expect(result.stdout).toBe("");
  }, 60_000);
});
