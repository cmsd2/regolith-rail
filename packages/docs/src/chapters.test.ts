import { describe, expect, it } from "vitest";
import { checkChapterScenarios, checkChapterStandard } from "./chapters.ts";
import { frontmatterOf, parseMdx } from "./markdown.ts";

const chapter = (body: string, slug = "book/newsvendor") => {
  const tree = parseMdx(
    `---\ntitle: The newsvendor\nsection: Book\npart: 2\nchapter: 4\n---\n\n${body}`,
  );
  return { slug, tree, frontmatter: frontmatterOf(tree) };
};

const sections = (names: string[], note = "<GameNote>On the line.</GameNote>") =>
  names
    .map((name) =>
      name === "References" ? `${note}\n\n## ${name}\n\nText.` : `## ${name}\n\nText.`,
    )
    .join("\n\n");

const STANDARD = [
  "What you will learn",
  "The problem",
  "The model",
  "In the simulator",
  "Case study: double dispatch",
  "Where the simulator differs",
  "Exercises",
  "References",
];

describe("chapter standard", () => {
  it("passes a chapter with every section in order, a case study and a side note", () => {
    expect(checkChapterStandard([chapter(sections(STANDARD))])).toEqual([]);
  });

  it("ignores pages outside the book and the contents page", () => {
    const guide = { ...chapter("## Anything"), frontmatter: { section: "Guides" } };
    const contents = { ...chapter("## Contents"), slug: "book" };
    expect(checkChapterStandard([guide, contents])).toEqual([]);
  });

  it("names the chapter and a missing Exercises section", () => {
    const page = chapter(sections(STANDARD.filter((s) => s !== "Exercises")));
    expect(checkChapterStandard([page])).toEqual(['book/newsvendor: no "Exercises" section']);
  });

  it("names the chapter when the side note is missing or after the references", () => {
    expect(checkChapterStandard([chapter(sections(STANDARD, ""))])).toEqual([
      "book/newsvendor: needs one GameNote side note, found 0",
    ]);
    const late = chapter(`${sections(STANDARD, "")}\n\n<GameNote>Late.</GameNote>`);
    expect(checkChapterStandard([late])).toEqual([
      'book/newsvendor: the GameNote side note belongs before "References"',
    ]);
  });

  it("names sections out of order, unexpected sections and misplaced case studies", () => {
    const swapped = ["The problem", "What you will learn", ...STANDARD.slice(2)];
    expect(checkChapterStandard([chapter(sections(swapped))])).toEqual([
      "book/newsvendor: sections out of order, expected What you will learn, The problem, The model, In the simulator, Where the simulator differs, Exercises, References",
    ]);
    const extra = [...STANDARD.slice(0, 2), "Background", ...STANDARD.slice(2)];
    expect(checkChapterStandard([chapter(sections(extra))])).toEqual([
      'book/newsvendor: unexpected section "Background"',
    ]);
    const early = ["Case study: early", ...STANDARD.filter((s) => !s.startsWith("Case"))];
    expect(checkChapterStandard([chapter(sections(early))])).toEqual([
      'book/newsvendor: "Case study: early" belongs between "In the simulator" and "Where the simulator differs"',
    ]);
  });
});

describe("chapter scenarios", () => {
  const known = {
    starters: new Set(["two-station"]),
    templates: new Set(["classic.newsvendor"]),
  };

  it("pass a chapter that opens an existing starter or template", () => {
    const pages = [
      chapter('<Scenario template="classic.newsvendor" />'),
      chapter('<Scenario starter="two-station" />', "book/modelling"),
    ];
    expect(checkChapterScenarios(pages, known)).toEqual([]);
  });

  it("names a chapter without a scenario and scenarios that don't resolve", () => {
    expect(checkChapterScenarios([chapter("Text.")], known)).toEqual([
      'book/newsvendor: names no scenario; add <Scenario starter="…" /> or <Scenario template="…" />',
    ]);
    const wrong = chapter(
      '<Scenario template="classic.nothing" />\n\n<Scenario starter="relay" template="classic.newsvendor" />',
    );
    expect(checkChapterScenarios([wrong], known)).toEqual([
      "book/newsvendor line 8: no classic template classic.nothing",
      "book/newsvendor line 10: <Scenario> needs exactly one of starter or template",
    ]);
  });
});
