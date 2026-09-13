import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Root } from "mdast";
import { assignHeadingIds, frontmatterOf, parseMdx } from "./markdown.ts";
import { isSection, referenceAnchors, referencePages } from "./pages.ts";

export const CONTENT_DIR = fileURLToPath(new URL("../content/", import.meta.url));

export interface ContentPage {
  slug: string;
  file: string;
  source: string;
  tree: Root;
  frontmatter: Record<string, unknown>;
}

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith(".mdx") ? [path] : [];
  });
}

/** Slug of a content file: its path under the content folder, with `index` as the root page. */
export function slugOf(file: string, root = CONTENT_DIR): string {
  const slug = relative(root, file)
    .replace(/\\/g, "/")
    .replace(/\.mdx$/, "");
  return slug === "index" ? "" : slug;
}

export function readContentPages(root = CONTENT_DIR): ContentPage[] {
  return mdxFiles(root)
    .map((file) => {
      const source = readFileSync(file, "utf8");
      const tree = parseMdx(source);
      return { slug: slugOf(file, root), file, source, tree, frontmatter: frontmatterOf(tree) };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Problems with page frontmatter, such as a missing title or unknown section. */
export function checkFrontmatter(pages: ContentPage[]): string[] {
  const reference = new Set(referencePages().map((p) => p.slug));
  const problems: string[] = [];
  for (const page of pages) {
    const { title, section } = page.frontmatter;
    // Pages that add to a generated reference page take its title and section.
    if (reference.has(page.slug)) continue;
    const name = page.slug || "index";
    if (typeof title !== "string" || title === "") problems.push(`${name}: no title`);
    if (!isSection(section)) problems.push(`${name}: unknown section ${JSON.stringify(section)}`);
  }
  return problems;
}

/** Every documentation route, for prerendering. */
export function docPaths(root = CONTENT_DIR): string[] {
  const slugs = new Set([
    ...readContentPages(root).map((p) => p.slug),
    ...referencePages().map((p) => p.slug),
  ]);
  return [...slugs].sort().map((slug) => (slug === "" ? "/docs" : `/docs/${slug}`));
}

/** Anchors on every documentation page, by slug. */
export function docAnchors(root = CONTENT_DIR): Map<string, Set<string>> {
  const anchors = new Map<string, Set<string>>();
  for (const page of referencePages()) anchors.set(page.slug, new Set(referenceAnchors(page)));
  for (const page of readContentPages(root)) {
    const ids = anchors.get(page.slug) ?? new Set<string>();
    for (const id of assignHeadingIds(page.tree)) ids.add(id);
    anchors.set(page.slug, ids);
  }
  return anchors;
}

/** Why a link target such as `ops/min-max#param-min` does not resolve, or null when it does. */
export function unresolvedTarget(anchors: Map<string, Set<string>>, target: string): string | null {
  const [slug = "", anchor] = target.split("#", 2);
  const ids = anchors.get(slug);
  if (!ids) return `${target}: no page ${slug || "(index)"}`;
  if (anchor && !ids.has(anchor)) return `${target}: no anchor #${anchor}`;
  return null;
}
