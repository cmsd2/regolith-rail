import { describe, expect, it } from "vitest";
import {
  maximaChecks,
  parseCheckRef,
  pythonChecks,
  resolveCheck,
  testTitles,
  workspaceTestTitles,
} from "./claims.ts";
import { parseMdx } from "./markdown.ts";

const notebook = JSON.stringify({
  nbformat: 4,
  cells: [
    { cell_type: "code", source: "/* prelude */\nexpect_equal(n, g, w) := true$" },
    { cell_type: "markdown", source: "/* check: not-code */" },
    {
      cell_type: "code",
      source: ["/* check: critical-ratio */\n", 'expect_equal("critical-ratio", 2/5, 2/5);'],
    },
  ],
});

const script = [
  "import sys",
  "",
  "def check_fill_rate():",
  "    rate = 0.9",
  '    assert rate > 0.5, "fill rate"',
  "",
  "def helper():",
  "    pass",
].join("\n");

const page = "/repo/packages/docs/content/book/newsvendor.mdx";
const files: Record<string, string> = {
  "/repo/packages/docs/content/book/newsvendor.checks.macnb": notebook,
  "/repo/packages/docs/content/book/newsvendor.checks.py": script,
};
const context = {
  pageFile: page,
  tree: parseMdx("Text.\n\n```lua runnable\nreturn {}\n```\n"),
  tests: testTitles([
    { file: "packages/a.test.ts", source: 'it("reaches the analytic cost", () => {});' },
    { file: "packages/b.test.ts", source: "it('twice', () => {}); test(`twice`, () => {});" },
  ]),
  read: (path: string) => files[path.split("\\").join("/")],
};

describe("check references", () => {
  it("parse a kind and a name", () => {
    expect(parseCheckRef("maxima:critical-ratio")).toEqual({
      kind: "maxima",
      name: "critical-ratio",
    });
    expect(parseCheckRef("test:a: title")).toEqual({ kind: "test", name: "a: title" });
    expect(parseCheckRef("sympy:x")).toBeNull();
    expect(parseCheckRef("maxima:")).toBeNull();
  });

  it("find named notebook cells and Python check functions", () => {
    expect([...maximaChecks(notebook)]).toEqual([
      ["critical-ratio", 'expect_equal("critical-ratio", 2/5, 2/5);'],
    ]);
    expect([...pythonChecks(script)]).toEqual([
      ["fill-rate", 'def check_fill_rate():\n    rate = 0.9\n    assert rate > 0.5, "fill rate"'],
    ]);
  });

  it("resolve each kind to what the reader is shown", () => {
    expect(resolveCheck("maxima:critical-ratio", context)).toEqual({
      check: {
        kind: "maxima",
        name: "critical-ratio",
        label: "Maxima check critical-ratio",
        file: "packages/docs/content/book/newsvendor.checks.macnb",
        source: 'expect_equal("critical-ratio", 2/5, 2/5);',
      },
    });
    expect(resolveCheck("python:fill-rate", context)).toMatchObject({
      check: { kind: "python", file: "packages/docs/content/book/newsvendor.checks.py" },
    });
    expect(resolveCheck("example:1", context)).toEqual({
      check: { kind: "example", name: "1", label: "Runnable example 1 on this page" },
    });
    expect(resolveCheck("test:reaches the analytic cost", context)).toEqual({
      check: {
        kind: "test",
        name: "reaches the analytic cost",
        label: "Test: reaches the analytic cost",
        file: "packages/a.test.ts",
      },
    });
  });

  it("say why a reference doesn't resolve", () => {
    expect(resolveCheck("maxima:renamed", context)).toEqual({
      error:
        'maxima:renamed: no check "renamed" in packages/docs/content/book/newsvendor.checks.macnb',
    });
    expect(resolveCheck("python:x", { ...context, read: () => undefined })).toEqual({
      error: "python:x: no packages/docs/content/book/newsvendor.checks.py",
    });
    expect(resolveCheck("example:2", context)).toEqual({
      error: "example:2: the page has 1 runnable example(s)",
    });
    expect(resolveCheck("test:unknown", context)).toEqual({
      error: "test:unknown: no test with that title",
    });
    expect(resolveCheck("test:twice", context)).toEqual({
      error: "test:twice: several tests have that title",
    });
  });

  it("find this file's tests among the workspace's", () => {
    expect(workspaceTestTitles().get("find this file's tests among the workspace's")).toEqual([
      "packages/docs/src/claims.test.ts",
    ]);
  });
});
