import type { Root, RootContent } from "mdast";
import { toString as textOf } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import { BOOK_CONTENTS } from "./book.ts";

/** A chapter's second-level sections, in the order every chapter uses. */
export const CHAPTER_SECTIONS = [
  "What you will learn",
  "The problem",
  "The model",
  "In the simulator",
  "Where the simulator differs",
  "Exercises",
  "References",
] as const;

/** Case studies sit between the scenario and where the simulator differs. */
export const CASE_STUDY = "Case study: ";

const isChapter = (page: { slug: string; frontmatter: Record<string, unknown> }) =>
  page.frontmatter.section === "Book" && page.slug !== BOOK_CONTENTS;

/**
 * MDX elements with a name, block or inline, given as the positions of the top-level nodes that
 * hold them, once for each element.
 */
export function elements(tree: Root, name: string): number[] {
  return tree.children.flatMap((node, i) => {
    let count = 0;
    visit(node, (child) => {
      if (
        (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") &&
        child.name === name
      ) {
        count++;
      }
    });
    return Array.from({ length: count }, () => i);
  });
}

/**
 * Problems with a chapter's shape: missing, unexpected or out-of-order sections, a case study
 * outside its place, or a missing or misplaced game side note.
 */
export function checkChapterStandard(
  pages: { slug: string; tree: Root; frontmatter: Record<string, unknown> }[],
): string[] {
  const problems: string[] = [];
  for (const page of pages.filter(isChapter)) {
    const headings = page.tree.children.flatMap((node, index) =>
      node.type === "heading" && node.depth === 2 ? [{ text: textOf(node), index }] : [],
    );
    const core = headings.filter((h) => !h.text.startsWith(CASE_STUDY));
    const required: readonly string[] = CHAPTER_SECTIONS;
    for (const name of CHAPTER_SECTIONS) {
      if (!core.some((h) => h.text === name)) problems.push(`${page.slug}: no "${name}" section`);
    }
    for (const h of core) {
      if (!required.includes(h.text)) {
        problems.push(`${page.slug}: unexpected section "${h.text}"`);
      }
    }
    const order = core.map((h) => h.text).filter((t) => required.includes(t));
    const expected = CHAPTER_SECTIONS.filter((name) => order.includes(name));
    if (order.join("|") !== expected.join("|")) {
      problems.push(`${page.slug}: sections out of order, expected ${expected.join(", ")}`);
    }
    const at = (name: string) => headings.find((h) => h.text === name)?.index;
    const simulator = at("In the simulator");
    const differs = at("Where the simulator differs");
    for (const h of headings.filter((h) => h.text.startsWith(CASE_STUDY))) {
      if (
        simulator === undefined ||
        differs === undefined ||
        h.index < simulator ||
        h.index > differs
      ) {
        problems.push(
          `${page.slug}: "${h.text}" belongs between "In the simulator" and "Where the simulator differs"`,
        );
      }
    }
    const notes = elements(page.tree, "GameNote");
    const references = at("References");
    if (notes.length !== 1) {
      problems.push(`${page.slug}: needs one GameNote side note, found ${notes.length}`);
    } else if (references !== undefined && (notes[0] as number) > references) {
      problems.push(`${page.slug}: the GameNote side note belongs before "References"`);
    }
  }
  return problems;
}

/** The value of a string attribute on an MDX element. */
function attributeOf(node: RootContent, name: string): string | undefined {
  if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return undefined;
  const attribute = node.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === name);
  return attribute && typeof attribute.value === "string" ? attribute.value : undefined;
}

/**
 * Problems with chapters' scenarios: a chapter that names none, and a scenario element that
 * doesn't name exactly one existing starter or classic template.
 */
export function checkChapterScenarios(
  pages: { slug: string; tree: Root; frontmatter: Record<string, unknown> }[],
  known: { starters: ReadonlySet<string>; templates: ReadonlySet<string> },
): string[] {
  const problems: string[] = [];
  for (const page of pages.filter(isChapter)) {
    const scenarios: RootContent[] = [];
    visit(page.tree, (node) => {
      if (
        (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
        node.name === "Scenario"
      ) {
        scenarios.push(node as RootContent);
      }
    });
    if (scenarios.length === 0) {
      problems.push(
        `${page.slug}: names no scenario; add <Scenario starter="…" /> or <Scenario template="…" />`,
      );
    }
    for (const node of scenarios) {
      const starter = attributeOf(node, "starter");
      const template = attributeOf(node, "template");
      const line = node.position?.start.line ?? 0;
      if ((starter === undefined) === (template === undefined)) {
        problems.push(
          `${page.slug} line ${line}: <Scenario> needs exactly one of starter or template`,
        );
      } else if (starter !== undefined && !known.starters.has(starter)) {
        problems.push(`${page.slug} line ${line}: no starter scenario ${starter}`);
      } else if (template !== undefined && !known.templates.has(template)) {
        problems.push(`${page.slug} line ${line}: no classic template ${template}`);
      }
    }
  }
  return problems;
}
