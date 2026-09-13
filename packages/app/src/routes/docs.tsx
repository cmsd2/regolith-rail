import { NavLink, useLocation } from "react-router";
import { Page } from "../components/Page.tsx";
import { DocArticle } from "../docs/DocArticle.tsx";
import { DocsSearch } from "../docs/DocsSearch.tsx";
import styles from "../docs/docs.module.css";
import { docSections, findDoc } from "../docs/registry.ts";
import type { Route } from "./+types/docs";

/** The page slug from a path such as `/docs/ops/min-max`; the path excludes the base path. */
const slugFrom = (pathname: string) => pathname.replace(/^\/docs\/?/, "").replace(/\/+$/, "");

export function meta({ location }: Route.MetaArgs) {
  const entry = findDoc(slugFrom(location.pathname));
  if (!entry) return [{ title: "Not found · Regolith Rail" }];
  return [
    { title: `${entry.title} · Regolith Rail documentation` },
    ...(entry.description ? [{ name: "description", content: entry.description }] : []),
  ];
}

function DocsNav() {
  return (
    <nav className={styles.nav} aria-label="Documentation">
      {docSections().map(({ section, pages }) => (
        <div key={section}>
          <h2>{section}</h2>
          <ul>
            {pages.map((page) => (
              <li key={page.slug}>
                <NavLink to={page.slug ? `/docs/${page.slug}` : "/docs"} end>
                  {page.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function Docs() {
  const entry = findDoc(slugFrom(useLocation().pathname));
  return (
    <Page>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <DocsSearch />
          <DocsNav />
        </aside>
        {entry ? (
          <DocArticle entry={entry} />
        ) : (
          <article className={styles.article} data-testid="doc-not-found">
            <h1>Page not found</h1>
            <p>There is no documentation page at this address. Try searching instead.</p>
          </article>
        )}
      </div>
    </Page>
  );
}
