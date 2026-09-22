import type { Root, RootContent } from "mdast";
import { visit } from "unist-util-visit";
import { extractExamples } from "./examples.ts";
import { capability, PLACEHOLDERS } from "./placeholders.ts";

interface Page {
  slug: string;
  tree: Root;
  frontmatter: Record<string, unknown>;
}

const needsOf = (node: RootContent): string | undefined => {
  if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return undefined;
  const a = node.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === "needs");
  return a && typeof a.value === "string" ? a.value : "";
};

/**
 * Placeholders in the book, and problems with them: a capability missing from the registry, and a
 * chapter whose placeholders leave it with nothing to run.
 */
export function checkPlaceholders(
  pages: Page[],
  registry = PLACEHOLDERS,
): { problems: string[]; open: { slug: string; id: string; line: number }[] } {
  const known = new Set(registry.map((c) => c.id));
  const problems: string[] = [];
  const open: { slug: string; id: string; line: number }[] = [];
  for (const page of pages) {
    let count = 0;
    visit(page.tree, (node) => {
      if (
        (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
        node.name === "Placeholder"
      ) {
        count++;
        const id = needsOf(node as RootContent) ?? "";
        const line = node.position?.start.line ?? 0;
        if (!known.has(id)) {
          problems.push(
            `${page.slug} line ${line}: <Placeholder needs="${id}"> names no capability in PLACEHOLDERS`,
          );
        } else {
          open.push({ slug: page.slug, id, line });
        }
      }
    });
    if (count > 0 && extractExamples(page.slug, page.tree).length === 0) {
      problems.push(
        `${page.slug}: has placeholders but no runnable example; a placeholder cannot replace the chapter's only run`,
      );
    }
  }
  return { problems, open };
}

/** The open placeholders, one line per capability with the chapters waiting on it. */
export function describePlaceholders(open: { slug: string; id: string }[]): string[] {
  const byId = new Map<string, Set<string>>();
  for (const { slug, id } of open) byId.set(id, (byId.get(id) ?? new Set()).add(slug));
  return [...byId].map(
    ([id, slugs]) => `${id} (${capability(id)?.needs ?? "unknown"}): ${[...slugs].join(", ")}`,
  );
}
