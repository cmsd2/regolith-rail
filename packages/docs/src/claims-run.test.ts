import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkFileShape,
  failuresIn,
  findTools,
  notebookWithPrelude,
  runClaims,
} from "./claims-run.ts";

const prelude = "/* prelude */\nexpect_equal(n, g, w) := true$";
const pythonTemplate =
  'def check_example():\n    pass\n\n\n# runner: shared\nif __name__ == "__main__":\n    run()\n';
const shared = { prelude, pythonTemplate };

let dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "claims-run-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe("check file shape", () => {
  it("accepts a notebook that starts with the prelude and checks with expect_", () => {
    const notebook = notebookWithPrelude(prelude, ['/* check: a */\nexpect_equal("a", 1, 1);']);
    expect(checkFileShape("page.checks.macnb", notebook, shared)).toEqual([]);
  });

  it("names a notebook without the prelude and a check cell that verifies nothing", () => {
    const notebook = notebookWithPrelude("/* other */", ["/* check: shown */\nprint(2/5);"]);
    expect(checkFileShape("book/page.checks.macnb", notebook, shared)).toEqual([
      "page.checks.macnb: the first cell must be the shared prelude from checks/prelude.mac",
      "page.checks.macnb: check shown calls neither expect_equal nor expect_close",
    ]);
  });

  it("requires Python scripts to end with the shared runner", () => {
    const good = pythonTemplate.replace("check_example", "check_other");
    expect(checkFileShape("page.checks.py", good, shared)).toEqual([]);
    expect(checkFileShape("page.checks.py", "def check_x():\n    pass\n", shared)).toEqual([
      "page.checks.py: must end with the shared runner from checks/template.checks.py",
    ]);
  });
});

describe("tools", () => {
  it("finds tools on PATH or from their variables", () => {
    const dir = tempDir();
    for (const name of ["aximar-mcp", "maxima", "uv"]) writeFileSync(join(dir, name), "");
    expect(findTools({ PATH: dir }, "linux")).toEqual({
      tools: { aximar: join(dir, "aximar-mcp"), maxima: join(dir, "maxima"), uv: join(dir, "uv") },
    });
    const runner = join(dir, "custom-runner");
    writeFileSync(runner, "");
    expect(findTools({ PATH: dir, AXIMAR_MCP: runner }, "linux")).toMatchObject({
      tools: { aximar: runner },
    });
  });

  it("says what is missing and how to install it", () => {
    const result = findTools({ PATH: tempDir() }, "linux");
    expect("missing" in result && result.missing.map((m) => m.split(":")[0])).toEqual([
      "aximar-mcp",
      "Maxima",
      "uv",
    ]);
  });
});

describe("running checks", () => {
  it("reports the failure lines of a run, or its last lines", () => {
    expect(
      failuresIn(
        "[1/2] ok\n[2/2] ERROR\n  Error: check failed: ratio got 3/5 want 2/5\n#0: expect",
      ),
    ).toEqual(["Error: check failed: ratio got 3/5 want 2/5"]);
    expect(failuresIn("a\nb\nc\nd")).toEqual(["b c d"]);
  });

  it("names the page and file of each failure", () => {
    const root = tempDir();
    writeFileSync(
      join(root, "ratio.checks.macnb"),
      notebookWithPrelude(prelude, ['/* check: a */\nexpect_equal("a", 1, 2);']),
    );
    writeFileSync(join(root, "ratio.checks.py"), pythonTemplate);
    const tools = { aximar: "aximar-mcp", maxima: "maxima", uv: "uv" };
    const result = runClaims(root, tools, shared, (file) =>
      file.endsWith(".macnb")
        ? { ok: false, output: "  Error: check failed: a got 1 want 2" }
        : { ok: true, output: "" },
    );
    expect(result).toEqual({
      files: 2,
      problems: ["ratio: ratio.checks.macnb: Error: check failed: a got 1 want 2"],
    });
  });
});
