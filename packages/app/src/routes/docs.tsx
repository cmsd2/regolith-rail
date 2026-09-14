import { BOOK, BOOK_CONTENTS, isWritten, movedTarget, partNumeral } from "@regolith-rail/docs";
import { useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { Page } from "../components/Page.tsx";
import { DocArticle } from "../docs/DocArticle.tsx";
import { DocsSearch } from "../docs/DocsSearch.tsx";
import styles from "../docs/docs.module.css";
import { docSections, findDoc } from "../docs/registry.ts";
import { docsHref } from "../lib/format.ts";
import type { Route } from "./+types/docs";

/** The page slug from a path such as `/docs/ops/min-max`; the path excludes the base path. */
const slugFrom = (pathname: string) => pathname.replace(/^\/docs\/?/, "").replace(/\/+$/, "");

export function meta({ location }: Route.MetaArgs) {
  const slug = slugFrom(location.pathname);
  const moved = movedTarget(slug);
  if (moved !== slug) {
    return [
      { title: "Moved · Regolith Rail documentation" },
      { httpEquiv: "refresh", content: `0; url=${docsHref(moved)}` },
      { tagName: "link", rel: "canonical", href: docsHref(moved) },
    ];
  }
  const entry = findDoc(slug);
  if (!entry) return [{ title: "Not found · Regolith Rail" }];
  return [
    { title: `${entry.title} · Regolith Rail documentation` },
    ...(entry.description ? [{ name: "description", content: entry.description }] : []),
  ];
}

/** The book's written chapters, grouped by part under the contents page. */
function BookNav() {
  return (
    <>
      <ul>
        <li>
          <NavLink to={`/docs/${BOOK_CONTENTS}`} end>
            Contents
          </NavLink>
        </li>
      </ul>
      {BOOK.filter(isWritten).map((part) => (
        <div key={part.part} className={styles.navPart}>
          <h3>
            Part {partNumeral(part.part)}: {part.title}
          </h3>
          <ul>
            {part.chapters.map(
              (c) =>
                c.slug && (
                  <li key={c.chapter}>
                    <NavLink to={`/docs/${c.slug}`} end>
                      {c.chapter}. {c.title}
                    </NavLink>
                  </li>
                ),
            )}
          </ul>
        </div>
      ))}
    </>
  );
}

function DocsNav() {
  return (
    <nav className={styles.nav} aria-label="Documentation">
      {docSections().map(({ section, pages }) => (
        <div key={section}>
          <h2>{section}</h2>
          {section === "Book" ? (
            <BookNav />
          ) : (
            <ul>
              {pages.map((page) => (
                <li key={page.slug}>
                  <NavLink to={page.slug ? `/docs/${page.slug}` : "/docs"} end>
                    {page.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}

/** What a moved page's old address shows while it sends the reader on. */
function Moved({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/docs/${to}`, { replace: true });
  }, [navigate, to]);
  return (
    <article className={styles.article} data-testid="doc-moved">
      <h1>This page has moved</h1>
      <p>
        <a href={docsHref(to)}>Go to its new address</a>.
      </p>
    </article>
  );
}

export default function Docs() {
  const slug = slugFrom(useLocation().pathname);
  const moved = movedTarget(slug);
  const entry = moved === slug ? findDoc(slug) : undefined;
  return (
    <Page>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <DocsSearch />
          <DocsNav />
        </aside>
        {moved !== slug ? (
          <Moved to={moved} />
        ) : entry ? (
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
