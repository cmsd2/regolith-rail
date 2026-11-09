import { describe, expect, it } from "vitest";
import { frontmatterOf, parseMdx } from "./markdown.ts";
import { checkPlaceholders, describePlaceholders } from "./placeholders-lint.ts";

const page = (body: string, slug = "book/safety-stock") => {
  const tree = parseMdx(`---\ntitle: T\nsection: Book\n---\n\n${body}`);
  return { slug, tree, frontmatter: frontmatterOf(tree) };
};

const runnable = "```lua runnable scenario=two-station\nreturn ops.policy {}\n```";

describe("placeholders", () => {
  it("lists open placeholders by chapter", () => {
    const body = `${runnable}\n\n<Placeholder needs="service-level-metrics">\n\nFill rates.\n\n</Placeholder>`;
    const result = checkPlaceholders([page(body)]);
    expect(result.problems).toEqual([]);
    expect(result.open).toEqual([
      { slug: "book/safety-stock", id: "service-level-metrics", line: 10 },
    ]);
    expect(describePlaceholders(result.open)).toEqual([
      "service-level-metrics (cycle service level and fill rate as run and batch metrics): book/safety-stock",
    ]);
  });

  it("names a placeholder whose capability is not registered", () => {
    const body = `${runnable}\n\n<Placeholder needs="teleporters">\n\nSoon.\n\n</Placeholder>`;
    expect(checkPlaceholders([page(body)]).problems).toEqual([
      'book/safety-stock line 10: <Placeholder needs="teleporters"> names no capability in PLACEHOLDERS',
    ]);
  });

  it("refuses a placeholder in a chapter with nothing else to run", () => {
    const body = '<Placeholder needs="service-level-metrics">\n\nFill rates.\n\n</Placeholder>';
    expect(checkPlaceholders([page(body)]).problems).toEqual([
      "book/safety-stock: has placeholders but no runnable example; a placeholder cannot replace the chapter's only run",
    ]);
  });
});
