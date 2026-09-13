import GithubSlugger from "github-slugger";
import type { Root, RootContent } from "mdast";
import { toString as textOf } from "mdast-util-to-string";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { parse as parseYaml } from "yaml";
import { parseCodeMeta } from "./meta.ts";

/** Parses MDX source into a syntax tree, the same way the site build reads it. */
export function parseMdx(source: string): Root {
  return unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    .use(remarkMath)
    .parse(source);
}

export function frontmatterOf(tree: Root): Record<string, unknown> {
  const node = tree.children.find((child) => child.type === "yaml");
  const data = node ? parseYaml(node.value) : {};
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

/**
 * Gives every heading an id from its text, like GitHub does. The site build and
 * the documentation check both use this, so anchors agree.
 */
export function assignHeadingIds(tree: Root): string[] {
  const slugger = new GithubSlugger();
  const ids: string[] = [];
  visit(tree, "heading", (node) => {
    const id = slugger.slug(textOf(node));
    // hProperties become attributes of the HTML element.
    const data = (node.data ?? {}) as { hProperties?: Record<string, unknown> };
    node.data = { ...data, hProperties: { ...data.hProperties, id } } as typeof node.data;
    ids.push(id);
  });
  return ids;
}

export function remarkHeadingIds() {
  return (tree: Root) => {
    assignHeadingIds(tree);
  };
}

/**
 * Wraps each runnable code block, and the output block after it, in an
 * `<Example>` element so the site can offer to open it in the editor.
 */
export function remarkExamples() {
  return (tree: Root) => {
    visit(tree, "code", (node, index, parent) => {
      if (!parent || index === undefined) return;
      const meta = parseCodeMeta(node.meta);
      if (!meta.runnable) return;
      const next = parent.children[index + 1];
      const output = next?.type === "code" && parseCodeMeta(next.meta).output ? next : undefined;
      const attribute = (name: string, value: string) => ({
        type: "mdxJsxAttribute",
        name,
        value,
      });
      const element = {
        type: "mdxJsxFlowElement",
        name: "Example",
        attributes: [
          attribute("source", node.value),
          attribute("scenario", meta.scenario),
          attribute("seed", String(meta.seed)),
          attribute("kind", meta.script ? "script" : "policy"),
        ],
        children: output ? [node, output] : [node],
      } as unknown as RootContent;
      parent.children.splice(index, output ? 2 : 1, element);
      return [SKIP, index + 1];
    });
  };
}

/** Headings and plain text of a page, for search. */
export function searchableText(tree: Root): { headings: string[]; text: string } {
  const headings: string[] = [];
  const parts: string[] = [];
  visit(tree, (node) => {
    if (node.type === "yaml" || node.type === "mdxjsEsm") return SKIP;
    if (node.type === "heading") {
      headings.push(textOf(node));
      return SKIP;
    }
    if (node.type === "text" || node.type === "inlineCode") parts.push(node.value);
    return undefined;
  });
  return { headings, text: parts.join(" ").replace(/\s+/g, " ").trim() };
}
