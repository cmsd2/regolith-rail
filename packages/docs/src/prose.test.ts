import { describe, expect, it } from "vitest";
import { frontmatterOf, parseMdx } from "./markdown.ts";
import { checkProse, proseFindings } from "./prose.ts";

const page = (body: string, slug = "book/modelling", section = "Book") => {
  const tree = parseMdx(`---\ntitle: T\nsection: ${section}\n---\n\n${body}`);
  return { slug, tree, frontmatter: frontmatterOf(tree) };
};

const rules = (body: string) => proseFindings(page(body).tree).map((f) => f.rule);

describe("prose lint", () => {
  it("passes plain technical prose", () => {
    expect(rules("The train loads half the difference. The dome runs short.")).toEqual([]);
  });

  it("finds em dashes", () => {
    expect(rules("The train — full — returns.")).toEqual(["em dash", "em dash"]);
  });

  it("finds tailing negations", () => {
    expect(rules("That is a fact about the line, not a failure of the rule.")).toEqual([
      "tailing negation",
    ]);
    expect(rules("It is not just a bound; it is the flow.")).toEqual(["tailing negation"]);
  });

  it("finds banned words and phrases, in any case", () => {
    expect(rules("A sharp rise. It is Crucial. In other words, more.")).toEqual([
      "banned phrase",
      "banned phrase",
      "banned phrase",
    ]);
  });

  it("finds signposting openers at the start of a sentence only", () => {
    expect(rules("Let's begin. The cost falls. Moreover, it rises.")).toEqual([
      "signposting opener",
      "signposting opener",
    ]);
    expect(rules("The rules furthermore apply.")).toEqual([]);
  });

  it("ignores code, mathematics and attributes", () => {
    const body = [
      "Inline `a — b, not c` code and $x — y$ maths.",
      "",
      '<Check ref="test:keeps stock, not cargo" />',
      "",
      "```lua",
      "-- sharp, not blunt",
      "```",
    ].join("\n");
    expect(rules(body)).toEqual([]);
  });

  it("skips a line with an exemption comment", () => {
    expect(rules('The paper "Sharp bounds" {/* prose-ok: a title */} is cited.')).toEqual([]);
  });

  it("names the page and line of each finding", () => {
    const result = checkProse([page("First line.\n\nIt is crucial.")], new Set());
    expect(result.problems).toEqual(['book/modelling line 8: banned phrase "crucial"']);
  });

  it("counts findings in chapters awaiting their rewrite without failing", () => {
    const result = checkProse([page("It is crucial — really.")], new Set(["book/modelling"]));
    expect(result.problems).toEqual([]);
    expect(result.pending.get("book/modelling")).toBe(2);
  });

  it("ignores pages outside the book", () => {
    const guide = page("It is crucial.", "getting-started", "Guides");
    expect(checkProse([guide], new Set()).problems).toEqual([]);
  });
});
