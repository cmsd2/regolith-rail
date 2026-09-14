import type { Root, RootContent } from "mdast";
import { toString as textOf } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import { BOOK_CONTENTS } from "./book.ts";
import { checkElements, resolveCheck, workspaceTestTitles } from "./claims.ts";

interface Page {
  slug: string;
  file: string;
  tree: Root;
  frontmatter: Record<string, unknown>;
}

const isElement = (node: RootContent | undefined, name: string) =>
  (node?.type === "mdxJsxFlowElement" || node?.type === "mdxJsxTextElement") && node.name === name;

const lineOf = (node: { position?: { start: { line: number } } | undefined }) =>
  node.position?.start.line ?? 0;

/** Whether an element contains a check anywhere inside it. */
function containsCheck(node: RootContent): boolean {
  let found = false;
  visit(node, (child) => {
    if (isElement(child as RootContent, "Check")) found = true;
  });
  return found;
}

/**
 * Problems with the claims a page makes: in Book chapters, displayed mathematics without a
 * check after it and exercise answers without a check; on every page, checks placed inline and
 * references that don't resolve.
 */
export function checkClaims(pages: Page[], tests = workspaceTestTitles()): string[] {
  const problems: string[] = [];
  for (const page of pages) {
    const name = page.slug || "index";
    for (const { node, ref, line } of checkElements(page.tree)) {
      if (node.type === "mdxJsxTextElement") {
        problems.push(`${name} line ${line}: put <Check> on a line of its own, after the claim`);
      }
      const result = resolveCheck(ref, { pageFile: page.file, tree: page.tree, tests });
      if ("error" in result) problems.push(`${name} line ${line}: ${result.error}`);
    }
    if (page.frontmatter.section !== "Book" || page.slug === BOOK_CONTENTS) continue;

    visit(page.tree, (node) => {
      if (!("children" in node)) return;
      const children = node.children as RootContent[];
      children.forEach((child, i) => {
        if (child.type !== "math") return;
        let next = i + 1;
        while (children[next]?.type === "math") next++;
        if (!isElement(children[next], "Check")) {
          problems.push(
            `${name} line ${lineOf(child)}: displayed mathematics has no <Check> after it`,
          );
        }
      });
    });

    const children = page.tree.children;
    const start = children.findIndex(
      (n) => n.type === "heading" && n.depth === 2 && textOf(n) === "Exercises",
    );
    if (start === -1) continue;
    const end = children.findIndex((n, i) => i > start && n.type === "heading" && n.depth === 2);
    const section = children.slice(start + 1, end === -1 ? undefined : end);
    const answers = section.filter((n) => isElement(n, "Answer"));
    if (answers.length < 2) {
      problems.push(
        `${name}: Exercises needs at least two exercises with an <Answer>, found ${answers.length}`,
      );
    }
    for (const answer of answers) {
      if (!containsCheck(answer)) {
        problems.push(`${name} line ${lineOf(answer)}: the answer has no <Check>`);
      }
    }
  }
  return problems;
}
