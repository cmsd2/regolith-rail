import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { apiTypes, opsBlocks } from "@regolith-rail/policy-api";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { extractExamples, runExample } from "./examples.ts";
import { checkLinks } from "./links.ts";
import { assignHeadingIds, parseMdx } from "./markdown.ts";
import { parseCodeMeta } from "./meta.ts";
import { checkReference } from "./reference.ts";

describe("reference check", () => {
  it("passes for the current Policy API and ops library", () => {
    expect(checkReference(apiTypes, opsBlocks)).toEqual([]);
  });

  it("names a block parameter without documentation", () => {
    const blocks = opsBlocks.map((block) =>
      block.name === "min_max"
        ? {
            ...block,
            params: [
              ...block.params,
              { name: "hysteresis", lua: "integer", required: false, summary: "" },
            ],
          }
        : block,
    );
    expect(checkReference(apiTypes, blocks)).toEqual([
      'ops.min_max parameter "hysteresis" has no documentation',
    ]);
  });

  it("names an API member without documentation", () => {
    const types = apiTypes.map((type, i) =>
      i === 0
        ? { ...type, fields: type.fields.map((f, j) => (j === 0 ? { ...f, summary: " " } : f)) }
        : type,
    );
    const first = apiTypes[0];
    expect(checkReference(types, opsBlocks)).toEqual([
      `${first?.name}.${first?.fields[0]?.name} has no documentation`,
    ]);
  });
});

describe("code meta", () => {
  it("reads runnable options", () => {
    expect(parseCodeMeta("runnable scenario=relay seed=4")).toEqual({
      runnable: true,
      output: false,
      scenario: "relay",
      seed: 4,
    });
    expect(parseCodeMeta(undefined).runnable).toBe(false);
  });
});

describe("headings", () => {
  it("get GitHub-style ids that match metric anchors", () => {
    const tree = parseMdx(
      "# Metrics\n\n## Unmet demand (weighted)\n\n## Unmet demand\n\n## Unmet demand\n",
    );
    expect(assignHeadingIds(tree)).toEqual([
      "metrics",
      "unmet-demand-weighted",
      "unmet-demand",
      "unmet-demand-1",
    ]);
  });
});

describe("runnable examples", () => {
  let runtime: LuaRuntime;
  beforeAll(async () => {
    runtime = await LuaRuntime.load();
  });

  const page = (body: string) => extractExamples("guides/example", parseMdx(body));

  it("pass when the run logs the stated output", () => {
    const [example] = page(
      [
        "```lua runnable scenario=relay",
        'return { on_start = function(ctx) ctx.log("hello", 1 + 1) end, on_stop = function(ctx) end }',
        "```",
        "",
        "```text output",
        "hello 2",
        "```",
      ].join("\n"),
    );
    expect(example).toMatchObject({ scenario: "relay", output: ["hello 2"] });
    expect(runExample(runtime, example as never)).toEqual([]);
  });

  it("fail, naming the page and example, when the output differs", () => {
    const examples = page(
      [
        "```lua",
        "-- not runnable",
        "```",
        "",
        "```lua runnable",
        "return { on_stop = function(ctx) end }",
        "```",
        "",
        "```lua runnable",
        'return { on_start = function(ctx) ctx.log("goodbye") end, on_stop = function(ctx) end }',
        "```",
        "",
        "```text output",
        "hello",
        "```",
      ].join("\n"),
    );
    expect(examples).toHaveLength(2);
    const problems = runExample(runtime, examples[1] as never);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^guides\/example example 2 \(line 9\): expected output/);
  });

  it("fail when the policy errors", () => {
    const [example] = page(
      ["```lua runnable", 'return { on_stop = function(ctx) error("boom") end }', "```"].join("\n"),
    );
    expect(runExample(runtime, example as never)[0]).toMatch(/the policy failed on line 1: .*boom/);
  });
});

describe("link check", () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function site(files: Record<string, string>) {
    root = mkdtempSync(join(tmpdir(), "links-"));
    for (const [path, html] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), html);
    }
  }

  it("accepts pages, directories and anchors under the base path", () => {
    site({
      "index.html":
        '<a href="/rr/docs/metrics#unmet-demand">m</a><a href="https://example.com/x">x</a>',
      "docs/metrics/index.html":
        '<h2 id="unmet-demand">U</h2><a href="../../">up</a><a href="#unmet-demand">here</a>',
      "404.html": '<a href="/rr/">home</a>',
    });
    expect(checkLinks(root, "/rr/")).toEqual([]);
  });

  it("lists links to renamed pages and missing anchors", () => {
    site({
      "index.html": '<a href="/rr/docs/old-name">old</a><a href="/rr/docs/metrics#nope">anchor</a>',
      "docs/metrics/index.html": '<h2 id="unmet-demand">U</h2><a href="/docs/metrics">no base</a>',
    });
    expect(checkLinks(root, "/rr/")).toEqual([
      {
        page: "docs/metrics/index.html",
        href: "/docs/metrics",
        reason: "outside the base path /rr/",
      },
      { page: "index.html", href: "/rr/docs/old-name", reason: "no such page" },
      { page: "index.html", href: "/rr/docs/metrics#nope", reason: "no anchor #nope" },
    ]);
  });
});
