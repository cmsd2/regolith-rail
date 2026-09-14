import "katex/dist/katex.min.css";
import { chapterAt, partNumeral } from "@regolith-rail/docs";
import { DocPage, mdxComponents } from "./components.tsx";
import { DocLink } from "./DocLink.tsx";
import styles from "./docs.module.css";
import { Reference } from "./Reference.tsx";
import type { DocEntry } from "./registry.ts";

export function DocArticle({ entry }: { entry: DocEntry }) {
  const { Content } = entry;
  const place = chapterAt(entry.slug);
  return (
    <article className={styles.article} data-testid="doc-article" data-slug={entry.slug}>
      <p className={styles.section}>
        {place
          ? `Part ${partNumeral(place.chapter.part.part)}: ${place.chapter.part.title} · Chapter ${place.chapter.chapter}`
          : entry.section}
      </p>
      <h1>{entry.title}</h1>
      {entry.description && <p className={styles.lead}>{entry.description}</p>}
      {entry.reference && <Reference page={entry.reference} />}
      <DocPage.Provider value={entry.slug}>
        {Content && <Content components={mdxComponents} />}
      </DocPage.Provider>
      {place && (
        <nav className={styles.chapterNav} aria-label="Chapters">
          {place.previous ? (
            <DocLink href={`/docs/${place.previous.slug}`} data-testid="chapter-previous">
              ← {place.previous.chapter}. {place.previous.title}
            </DocLink>
          ) : (
            <span />
          )}
          {place.next && (
            <DocLink href={`/docs/${place.next.slug}`} data-testid="chapter-next">
              {place.next.chapter}. {place.next.title} →
            </DocLink>
          )}
        </nav>
      )}
    </article>
  );
}
