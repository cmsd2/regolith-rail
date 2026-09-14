import { describe, expect, it } from "vitest";
import { testTitles } from "./claims.ts";
import { checkClaims } from "./claims-lint.ts";
import { frontmatterOf, parseMdx } from "./markdown.ts";

const tests = testTitles([{ file: "packages/a.test.ts", source: 'it("known test", () => {});' }]);

const page = (body: string, section = "Book") => {
  const tree = parseMdx(`---\ntitle: T\nsection: ${section}\n---\n\n${body}`);
  return {
    slug: "book/newsvendor",
    // No notebook exists beside this path, so maxima references cannot resolve.
    file: "/nowhere/book/newsvendor.mdx",
    tree,
    frontmatter: frontmatterOf(tree),
  };
};

const exercises = [
  "## Exercises",
  "",
  "1. First.",
  "",
  "<Answer>",
  "",
  "Twelve.",
  "",
  '<Check ref="test:known test" />',
  "",
  "</Answer>",
  "",
  "2. Second.",
  "",
  "<Answer>",
  "",
  "Three.",
  "",
  '<Check ref="test:known test" />',
  "",
  "</Answer>",
].join("\n");

describe("claims lint", () => {
  it("passes checked equations and answers", () => {
    const body = `$$\nq = 1\n$$\n\n<Check ref="test:known test" />\n\n${exercises}`;
    expect(checkClaims([page(body)], tests)).toEqual([]);
  });

  it("names the line of an equation with no check before the next heading or formula", () => {
    const body = `Text.\n\n$$\nq = 1\n$$\n\nMore text.\n\n### Next\n\n$$\nr = 2\n$$\n\n$$\ns = 3\n$$\n\n<Check ref="test:known test" />\n\n${exercises}`;
    expect(checkClaims([page(body)], tests)).toEqual([
      "book/newsvendor line 8: displayed mathematics has no <Check> before the next heading or formula",
      "book/newsvendor line 16: displayed mathematics has no <Check> before the next heading or formula",
    ]);
  });

  it("lets one check after the worked numbers cover a formula and its numbers", () => {
    const body = `$$\nq = 1\n$$\n\nSo $q$ is 1.\n\n- A list.\n\n<Check ref="test:known test" />\n\n${exercises}`;
    expect(checkClaims([page(body)], tests)).toEqual([]);
  });

  it("names a check cited twice outside the answers", () => {
    const body = `$$\nq = 1\n$$\n\n<Check ref="test:known test" />\n\nSo $q$ is 1.\n\n<Check ref="test:known test" />\n\n${exercises}`;
    expect(checkClaims([page(body)], tests)).toEqual([
      "book/newsvendor line 14: test:known test is already cited on line 10",
    ]);
  });

  it("names a reference to a missing notebook cell and an unknown test", () => {
    const body = `$$\nq = 1\n$$\n\n<Check ref="maxima:renamed" />\n\n$$\nr = 2\n$$\n\n<Check ref="test:gone" />\n\n${exercises}`;
    expect(checkClaims([page(body)], tests)).toEqual([
      "book/newsvendor line 10: maxima:renamed: no /nowhere/book/newsvendor.checks.macnb",
      "book/newsvendor line 16: test:gone: no test with that title",
    ]);
  });

  it("requires two answers, each with a check", () => {
    const body = "## Exercises\n\n1. Only one.\n\n<Answer>\n\nTwelve.\n\n</Answer>";
    expect(checkClaims([page(body)], tests)).toEqual([
      "book/newsvendor: Exercises needs at least two exercises with an <Answer>, found 1",
      "book/newsvendor line 10: the answer has no <Check>",
      "book/newsvendor: Exercises needs one exercise run in the simulator, with an answer citing a test: or example: check",
    ]);
  });

  it("requires one exercise answered by a simulator check", () => {
    const body = exercises.replaceAll('<Check ref="test:known test" />', "$q = 1$");
    const problems = checkClaims([page(body)], tests);
    expect(problems).toContain(
      "book/newsvendor: Exercises needs one exercise run in the simulator, with an answer citing a test: or example: check",
    );
  });

  it("rejects inline checks, and leaves unchecked maths outside the book alone", () => {
    const inline = page('A claim <Check ref="test:known test" /> inline.', "Guides");
    expect(checkClaims([inline], tests)).toEqual([
      "book/newsvendor line 6: put <Check> on a line of its own, after the claim",
    ]);
    expect(checkClaims([page("$$\nq = 1\n$$", "Guides")], tests)).toEqual([]);
  });
});
