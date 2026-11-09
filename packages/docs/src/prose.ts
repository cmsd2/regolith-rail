import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/** A rule the book's prose must follow, as content/book/STYLE.md describes. */
export interface ProseRule {
  name: string;
  pattern: RegExp;
}

const phrase = (words: string) => words.replace(/ /g, "\\s+");

const BANNED = [
  "sharp",
  "sharply",
  "grounded",
  "load-bearing",
  "crucial",
  "crucially",
  "key insight",
  "worth noting",
  "worth stating",
  "it turns out",
  "in other words",
  "in short",
  "the whole difference",
  "simply put",
];

const OPENERS = [
  "Let's",
  "Let’s",
  "Here's",
  "Here’s",
  "In conclusion",
  "Furthermore",
  "Moreover",
  "Additionally",
];

export const PROSE_RULES: readonly ProseRule[] = [
  { name: "em dash", pattern: /—/g },
  { name: "tailing negation", pattern: /[,;]\s+not\s/g },
  { name: "tailing negation", pattern: /\bnot\s+(?:just|only|merely)\b/gi },
  {
    name: "banned phrase",
    pattern: new RegExp(`\\b(?:${BANNED.map(phrase).join("|")})\\b`, "gi"),
  },
  {
    name: "signposting opener",
    pattern: new RegExp(`(?:^|[.!?:]\\s+)(?:${OPENERS.map(phrase).join("|")})\\b`, "g"),
  },
];

/** The comment that exempts a line from the prose rules, with a reason. */
export const PROSE_EXEMPTION = "prose-ok";

/**
 * Book chapters still in their first edition. Their prose findings are reported as a count and
 * do not fail the check; each chapter leaves this list when it is rewritten.
 */
export const PROSE_PENDING: ReadonlySet<string> = new Set([]);

interface Page {
  slug: string;
  tree: Root;
  frontmatter: Record<string, unknown>;
}

/** Lines carrying an exemption comment. */
function exemptLines(tree: Root): Set<number> {
  const lines = new Set<number>();
  visit(tree, (node) => {
    if (
      (node.type === "mdxTextExpression" || node.type === "mdxFlowExpression") &&
      node.value.includes(PROSE_EXEMPTION)
    ) {
      const line = node.position?.start.line;
      if (line !== undefined) lines.add(line);
    }
  });
  return lines;
}

/** Findings of the prose rules in a page's text, outside code, mathematics and attributes. */
export function proseFindings(tree: Root): { line: number; rule: string; match: string }[] {
  const exempt = exemptLines(tree);
  const found: { line: number; rule: string; match: string }[] = [];
  visit(tree, "text", (node) => {
    const start = node.position?.start.line ?? 0;
    for (const rule of PROSE_RULES) {
      for (const m of node.value.matchAll(rule.pattern)) {
        const line = start + (node.value.slice(0, m.index).match(/\n/g)?.length ?? 0);
        if (exempt.has(line)) continue;
        found.push({ line, rule: rule.name, match: m[0].trim() });
      }
    }
  });
  return found.sort((a, b) => a.line - b.line);
}

/**
 * Prose problems in Book pages. Chapters awaiting their rewrite are counted instead of failing,
 * so the rewrite can land one chapter at a time.
 */
export function checkProse(
  pages: Page[],
  pending: ReadonlySet<string> = PROSE_PENDING,
): { problems: string[]; pending: Map<string, number> } {
  const problems: string[] = [];
  const counts = new Map<string, number>();
  for (const page of pages) {
    if (page.frontmatter.section !== "Book") continue;
    const findings = proseFindings(page.tree);
    if (pending.has(page.slug)) {
      counts.set(page.slug, findings.length);
      continue;
    }
    for (const f of findings) {
      problems.push(`${page.slug} line ${f.line}: ${f.rule} "${f.match}"`);
    }
  }
  return { problems, pending: counts };
}
