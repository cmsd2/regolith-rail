import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Parser } from "htmlparser2";
import { MOVED_PAGES } from "./moved.ts";

export interface BrokenLink {
  /** Page the link is on, relative to the build folder. */
  page: string;
  href: string;
  reason: string;
}

interface ParsedPage {
  ids: Set<string>;
  hrefs: string[];
  /** Whether the page is a redirect left behind by a moved page. */
  redirect: boolean;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

function parse(html: string): ParsedPage {
  const page: ParsedPage = { ids: new Set(), hrefs: [], redirect: false };
  const parser = new Parser({
    onopentag(name, attributes) {
      if (attributes.id) page.ids.add(attributes.id);
      if (name === "meta" && attributes["http-equiv"]?.toLowerCase() === "refresh") {
        page.redirect = true;
      }
      if (name === "a" && attributes.name) page.ids.add(attributes.name);
      if (name === "a" && attributes.href !== undefined) page.hrefs.push(attributes.href);
    },
  });
  parser.write(html);
  parser.end();
  return page;
}

/**
 * Checks every link between pages of a static build, including anchors, the
 * way a plain static host would resolve them.
 */
export function checkLinks(
  root: string,
  basePath = "/",
  moved: Readonly<Record<string, string>> = MOVED_PAGES,
): BrokenLink[] {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const origin = "http://site.invalid";
  const cache = new Map<string, ParsedPage>();
  const read = (file: string) => {
    let page = cache.get(file);
    if (!page) {
      page = parse(readFileSync(file, "utf8"));
      cache.set(file, page);
    }
    return page;
  };
  const resolveFile = (path: string): string | undefined => {
    const candidates = path === "" ? ["index.html"] : [path, `${path}/index.html`, `${path}.html`];
    return candidates
      .map((candidate) => join(root, candidate))
      .find((file) => existsSync(file) && statSync(file).isFile());
  };

  const broken: BrokenLink[] = [];
  for (const file of htmlFiles(root)) {
    const page = relative(root, file).replace(/\\/g, "/");
    const pageUrl = new URL(base + page.replace(/(^|\/)index\.html$/, "$1"), origin);
    for (const href of read(file).hrefs) {
      let url: URL;
      try {
        url = new URL(href, pageUrl);
      } catch {
        broken.push({ page, href, reason: "not a valid address" });
        continue;
      }
      if (url.origin !== origin) continue;
      if (!url.pathname.startsWith(base) && `${url.pathname}/` !== base) {
        broken.push({ page, href, reason: `outside the base path ${base}` });
        continue;
      }
      const path = decodeURIComponent(url.pathname.slice(base.length)).replace(/\/$/, "");
      const old = path.startsWith("docs/") ? moved[path.slice("docs/".length)] : undefined;
      // Redirect pages link on to the new page themselves, and are the only pages that may.
      if (old !== undefined && !read(file).redirect) {
        broken.push({ page, href, reason: `moved to /docs/${old}` });
        continue;
      }
      const target = resolveFile(path);
      if (!target) {
        broken.push({ page, href, reason: "no such page" });
        continue;
      }
      const anchor = decodeURIComponent(url.hash.slice(1));
      if (anchor && target.endsWith(".html") && !read(target).ids.has(anchor)) {
        broken.push({ page, href, reason: `no anchor #${anchor}` });
      }
    }
  }
  return broken;
}
