import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { apiTypes, opsBlocks } from "@regolith-rail/policy-api";
import { constructs } from "@regolith-rail/scenario-kit";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  checkExampleIndex,
  checkStarterFixes,
  exampleIndex,
  extractExamples,
  runExample,
} from "./examples.ts";
import { checkLinks } from "./links.ts";
import { assignHeadingIds, parseMdx } from "./markdown.ts";
import { parseCodeMeta } from "./meta.ts";
import { checkConstructs, checkReference, checkTemplatePages } from "./reference.ts";

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

describe("construct reference check", () => {
  let declared: ReturnType<LuaRuntime["libraryConstructs"]>;
  beforeAll(async () => {
    declared = (await LuaRuntime.load()).libraryConstructs();
  });

  it("passes for the current construct libraries", () => {
    expect(checkConstructs(constructs, declared)).toEqual([]);
  });

  it("names a construct parameter the description leaves out", () => {
    const withExtra = {
      ...declared,
      constructs: {
        ...declared.constructs,
        "mars.line": { ...declared.constructs["mars.line"], gauge: "integer" },
      },
    };
    expect(checkConstructs(constructs, withExtra)).toEqual([
      'mars.line parameter "gauge" has no documentation',
    ]);
  });

  it("names a construct parameter with a blank summary", () => {
    const blanked = constructs.map((c) =>
      c.name === "mars.train"
        ? { ...c, params: c.params.map((p) => (p.name === "speed" ? { ...p, summary: "" } : p)) }
        : c,
    );
    expect(checkConstructs(blanked, declared)).toEqual([
      'mars.train parameter "speed" has no documentation',
    ]);
  });
});

describe("classic template pages", () => {
  it("name a template without a page", () => {
    const pages = new Set(["book/newsvendor", "book/order-quantities", "classic/serial-chain"]);
    expect(checkTemplatePages(constructs, pages)).toEqual([
      "classic.fixed_route_delivery has no page at classic/fixed-route-delivery",
    ]);
  });
});

describe("code meta", () => {
  it("reads runnable options", () => {
    expect(parseCodeMeta("runnable scenario=relay seed=4")).toEqual({
      runnable: true,
      output: false,
      script: false,
      fix: false,
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

  it("evaluate scenario script examples and report their errors at script lines", () => {
    const [good, bad] = page(
      [
        "```lua runnable script",
        "return classic.serial_chain { stages = 2 }",
        "```",
        "",
        "```lua runnable script",
        "-- a typo",
        'return scenario { id = "x", duration = sols(1), colour = 1 }',
        "```",
      ].join("\n"),
    );
    expect(good).toMatchObject({ script: true });
    expect(runExample(runtime, good as never)).toEqual([]);
    expect(runExample(runtime, bad as never)).toEqual([
      "guides/example example 2 (line 5): the script failed on line 2: scenario: has no parameter named colour",
    ]);
  });

  it("run policy examples on a classic template", () => {
    const [example] = page(
      [
        "```lua runnable scenario=classic.newsvendor",
        "return ops.policy { review = { target = ops.order_up_to { level = 15000 } } }",
        "```",
      ].join("\n"),
    );
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

  it("fail when the example names an unknown scenario", () => {
    const [example] = page(
      ["```lua runnable scenario=nowhere", "return { on_stop = function(ctx) end }", "```"].join(
        "\n",
      ),
    );
    expect(runExample(runtime, example as never)).toEqual([
      "guides/example example 1 (line 1): unknown scenario nowhere",
    ]);
  });
});

describe("examples index", () => {
  const pageOf = (slug: string, title: string, body: string) => ({
    slug,
    tree: parseMdx(body),
    frontmatter: { title },
  });
  const one = "```lua runnable scenario=relay\nreturn {}\n```";
  const pages = [
    pageOf("ops/min-max", "ops.min_max", `${one}\n\n\`\`\`lua runnable script\nreturn 1\n\`\`\``),
    pageOf("", "Documentation", one),
  ];

  it("names examples after their page, numbered when a page has several", () => {
    expect(exampleIndex(pages).map((e) => [e.id, e.name, e.scenario, e.script])).toEqual([
      ["ops/min-max#1", "ops.min_max (example 1)", "relay", false],
      ["ops/min-max#2", "ops.min_max (example 2)", "two-station", true],
      ["index#1", "Documentation", "relay", false],
    ]);
  });

  it("reports a committed index that no longer matches the documentation", () => {
    const current = exampleIndex(pages);
    expect(checkExampleIndex(JSON.parse(JSON.stringify(current)), current)).toEqual([]);
    expect(checkExampleIndex(current.slice(1), current)).toHaveLength(1);
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

  it("lists links to moved pages, except from the redirect left behind", () => {
    site({
      "index.html":
        '<a href="/rr/docs/classic/newsvendor">old</a><a href="/rr/docs/book/newsvendor">new</a>',
      "docs/classic/newsvendor/index.html":
        '<meta http-equiv="refresh" content="0; url=/rr/docs/book/newsvendor"><a href="/rr/docs/book/newsvendor">moved</a>',
      "docs/book/newsvendor/index.html": "<h1>The newsvendor</h1>",
    });
    expect(checkLinks(root, "/rr/", { "classic/newsvendor": "book/newsvendor" })).toEqual([
      {
        page: "index.html",
        href: "/rr/docs/classic/newsvendor",
        reason: "moved to /docs/book/newsvendor",
      },
    ]);
  });
});

describe("starter fixes", () => {
  const pageWith = (slug: string, body: string) => ({ slug, tree: parseMdx(body) });
  const fence = (meta: string) => `\`\`\`lua ${meta}\nreturn {}\n\`\`\`\n`;

  it("pass when a starter's page marks one fix on it, following a section anchor", () => {
    const page = pageWith(
      "book/base-stock",
      `${fence("runnable scenario=two-trains")}\n${fence("runnable scenario=two-trains fix")}`,
    );
    const starters = [{ id: "two-trains", docs: "book/base-stock#case-study-double-dispatch" }];
    expect(checkStarterFixes(starters, [page])).toEqual([]);
    expect(extractExamples(page.slug, page.tree).map((e) => e.fix)).toEqual([false, true]);
  });

  it("name a starter whose page marks no fix", () => {
    const page = pageWith("failure-modes/half-capacity", fence("runnable"));
    expect(
      checkStarterFixes([{ id: "two-station", docs: "failure-modes/half-capacity" }], [page]),
    ).toEqual([
      "two-station: failure-modes/half-capacity marks 0 fix examples on it; mark exactly one `lua runnable scenario=two-station fix`",
    ]);
  });
});
