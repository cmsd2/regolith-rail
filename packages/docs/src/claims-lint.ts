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
 * Whether a check appears among the siblings after a displayed formula, before the next heading
 * or formula. A formula and the paragraph stating its worked numbers can then share one check.
 */
function checkedBeforeNext(children: RootContent[], from: number): boolean {
  for (let i = from + 1; i < children.length; i++) {
    const sibling = children[i] as RootContent;
    if (sibling.type === "heading" || sibling.type === "math") return false;
    if (containsCheck(sibling)) return true;
  }
  return false;
}

/**
 * Problems with the claims a page makes: in Book chapters, displayed mathematics without a
 * check before the next heading or formula, a check cited twice outside exercise answers, and
 * exercise answers without a check; on every page, checks placed inline and references that
 * don't resolve.
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
        if (child.type === "math" && !checkedBeforeNext(children, i)) {
          problems.push(
            `${name} line ${lineOf(child)}: displayed mathematics has no <Check> before the next heading or formula`,
          );
        }
      });
    });

    // A check is cited once for a claim; answers may cite the same check as the text.
    const inAnswers = new Set<RootContent>();
    visit(page.tree, (node) => {
      if (!isElement(node as RootContent, "Answer")) return;
      for (const { node: check } of checkElements(node as never)) inAnswers.add(check);
    });
    const cited = new Map<string, number>();
    for (const { node, ref, line } of checkElements(page.tree)) {
      if (inAnswers.has(node)) continue;
      const first = cited.get(ref);
      if (first === undefined) cited.set(ref, line);
      else problems.push(`${name} line ${line}: ${ref} is already cited on line ${first}`);
    }

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
    // One exercise must send the reader to the simulator, with the answer checked by a run.
    const simulated = answers.some((answer) =>
      checkElements(answer as never).some(({ ref }) => /^(test|example):/.test(ref)),
    );
    if (answers.length > 0 && !simulated) {
      problems.push(
        `${name}: Exercises needs one exercise run in the simulator, with an answer citing a test: or example: check`,
      );
    }
  }
  return problems;
}
