import { describe, expect, it } from "vitest";
import { testTitles } from "./claims.ts";
import { checkClaims } from "./claims-lint.ts";
import { frontmatterOf, parseMdx } from "./markdown.ts";
import {
  bookStatements,
  checkStatements,
  refsIn,
  remarkStatements,
  statementsIn,
} from "./statements.ts";

const page = (body: string, slug = "book/flows", section = "Book") => {
  const tree = parseMdx(`---\ntitle: T\nsection: ${section}\n---\n\n${body}`);
  return { slug, file: `/nowhere/${slug}.mdx`, tree, frontmatter: frontmatterOf(tree) };
};

const attributes = (node: { attributes: unknown[] }) =>
  Object.fromEntries(
    (node.attributes as { name: string; value: string }[]).map((a) => [a.name, a.value]),
  );

describe("statements", () => {
  const body = [
    '<Definition id="def-rate" name="Rate">',
    "",
    "A rate.",
    "",
    "</Definition>",
    "",
    '<Theorem id="thm-littles-law" name="Little\'s law">',
    "",
    "It holds.",
    "",
    "</Theorem>",
    "",
    "<Proof>",
    "",
    "Count.",
    "",
    "</Proof>",
    "",
    'By <Ref to="thm-littles-law" /> and <Ref to="def-missing" />.',
  ].join("\n");

  it("number in order with one counter for the chapter, whatever their kind", () => {
    const found = statementsIn(page(body).tree, "book/flows", 2).map((s) => s.statement);
    expect(found.map((s) => `${s.kind} ${s.number} ${s.id} ${s.name}`)).toEqual([
      "Definition 2.1 def-rate Rate",
      "Theorem 2.2 thm-littles-law Little's law",
    ]);
  });

  it("are numbered and their references resolved when a page is built", () => {
    const { tree } = page(body);
    remarkStatements()(tree, { path: `${import.meta.dirname}/../content/book/flows.mdx` });
    const [definition, theorem] = statementsIn(tree, "", undefined);
    expect(attributes(definition?.node as never).number).toBe("2.1");
    expect(attributes(theorem?.node as never).number).toBe("2.2");
    const [known, missing] = refsIn(tree);
    expect(attributes(known?.node as never)).toEqual({
      to: "thm-littles-law",
      label: "Theorem 2.2",
      href: "#thm-littles-law",
    });
    expect(attributes(missing?.node as never)).toEqual({
      to: "def-missing",
      error: "no statement def-missing",
    });
  });

  it("across the book have ids that are unique", () => {
    const ids = [...bookStatements().values()].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("statement check", () => {
  it("passes statements with ids and references that resolve", () => {
    const body = '<Lemma id="lem-count">\n\nCount.\n\n</Lemma>\n\nBy <Ref to="lem-count" />, done.';
    expect(checkStatements([page(body)])).toEqual([]);
  });

  it("names a missing, malformed or repeated id, and one a heading uses", () => {
    const body = [
      "## Little's law",
      "",
      "<Theorem>\n\nNo id.\n\n</Theorem>",
      "",
      '<Theorem id="Thm_1">\n\nBad id.\n\n</Theorem>',
      "",
      '<Theorem id="littles-law">\n\nA heading has it.\n\n</Theorem>',
      "",
      '<Lemma id="lem-a">\n\nFirst.\n\n</Lemma>',
      "",
      '<Lemma id="lem-a">\n\nAgain.\n\n</Lemma>',
    ].join("\n");
    expect(checkStatements([page(body)])).toEqual([
      'book/flows line 8: <Theorem> needs an id, such as id="thm-littles-law"',
      'book/flows line 14: <Theorem> id "Thm_1" must be lower-case words and hyphens',
      'book/flows line 20: <Theorem> id "littles-law" is also a heading\'s anchor',
      'book/flows line 32: <Lemma> id "lem-a" is already used on book/flows line 26',
    ]);
  });

  it("names a reference to no statement, and statements outside a chapter", () => {
    expect(checkStatements([page('See <Ref to="thm-none" />.')])).toEqual([
      'book/flows line 6: <Ref to="thm-none"> names no statement',
    ]);
    const guide = page('<Remark id="rem-a">\n\nText.\n\n</Remark>', "getting-started", "Guides");
    expect(checkStatements([guide])).toEqual([
      "getting-started: numbered statements belong in book chapters",
    ]);
  });
});

describe("claims in statements", () => {
  const tests = testTitles([
    { file: "packages/a.test.ts", source: 'it("one", () => {}); it("two", () => {});' },
  ]);
  const exercises = [
    "## Exercises",
    "",
    "1. First.",
    "",
    '<Answer>\n\nTwelve.\n\n<Check ref="test:one" />\n\n</Answer>',
    "",
    "2. Second.",
    "",
    '<Answer>\n\nThree.\n\n<Check ref="test:one" />\n\n</Answer>',
  ].join("\n");

  it("lets one check after a theorem and its proof cover the formulas in both", () => {
    const body = [
      '<Theorem id="thm-a">\n\n$$\nL = \\lambda W\n$$\n\n</Theorem>',
      "",
      "<Proof>\n\n$$\n\\int N = \\sum W_i\n$$\n\n</Proof>",
      "",
      '<Check refs="\n  test:one\n  test:two\n" />',
      "",
      exercises,
    ].join("\n");
    expect(checkClaims([page(body, "book/newsvendor")], tests)).toEqual([]);
  });

  it("names a formula in a statement that no check after it cites", () => {
    const body = [
      '<Theorem id="thm-a">\n\n$$\nL = \\lambda W\n$$\n\n</Theorem>',
      "",
      "### Next",
      "",
      exercises,
    ].join("\n");
    expect(checkClaims([page(body, "book/newsvendor")], tests)).toEqual([
      "book/newsvendor line 8: displayed mathematics has no <Check> citing it before the next heading",
    ]);
  });
});
