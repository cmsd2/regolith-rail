import {
  type DocFrontmatter,
  type ReferencePage,
  referencePages,
  SECTIONS,
  type Section,
} from "@regolith-rail/docs";
import type { MDXContent } from "mdx/types";

interface MdxModule {
  default: MDXContent;
  frontmatter?: Partial<DocFrontmatter>;
}

export interface DocEntry {
  slug: string;
  title: string;
  description: string;
  section: Section;
  order: number;
  /** Written content; on a reference page it follows the generated reference. */
  Content?: MDXContent;
  reference?: ReferencePage;
}

const CONTENT_PREFIX = "../../../docs/content/";

// Every page is bundled with the documentation route, so pages prerender with
// their content and the panel can show any page without another request.
const modules = import.meta.glob<MdxModule>("../../../docs/content/**/*.mdx", { eager: true });

function buildEntries(): Map<string, DocEntry> {
  const entries = new Map<string, DocEntry>();
  for (const page of referencePages()) {
    entries.set(page.slug, {
      slug: page.slug,
      title: page.title,
      description: page.description,
      section: page.section,
      order: page.order,
      reference: page,
    });
  }
  for (const [path, module] of Object.entries(modules)) {
    const slug = path.slice(CONTENT_PREFIX.length).replace(/\.mdx$/, "");
    const key = slug === "index" ? "" : slug;
    const existing = entries.get(key);
    if (existing) {
      existing.Content = module.default;
      continue;
    }
    const meta = module.frontmatter ?? {};
    entries.set(key, {
      slug: key,
      title: meta.title ?? key,
      description: meta.description ?? "",
      section: meta.section ?? "Guides",
      order: meta.order ?? 100,
      Content: module.default,
    });
  }
  return entries;
}

const entries = buildEntries();

/** Splits `ops/min-max#param-low` into a page slug and an anchor. */
export function splitTarget(target: string): { slug: string; anchor: string } {
  const hash = target.indexOf("#");
  const path = hash === -1 ? target : target.slice(0, hash);
  return {
    slug: path.replace(/^\/+|\/+$/g, ""),
    anchor: hash === -1 ? "" : decodeURIComponent(target.slice(hash + 1)),
  };
}

export function findDoc(slug: string): DocEntry | undefined {
  return entries.get(splitTarget(slug).slug);
}

export function docSections(): { section: Section; pages: DocEntry[] }[] {
  return SECTIONS.map((section) => ({
    section,
    pages: [...entries.values()]
      .filter((entry) => entry.section === section)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
  })).filter((group) => group.pages.length > 0);
}
