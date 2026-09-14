import "katex/dist/katex.min.css";
import { DocPage, mdxComponents } from "./components.tsx";
import styles from "./docs.module.css";
import { Reference } from "./Reference.tsx";
import type { DocEntry } from "./registry.ts";

export function DocArticle({ entry }: { entry: DocEntry }) {
  const { Content } = entry;
  return (
    <article className={styles.article} data-testid="doc-article" data-slug={entry.slug}>
      <p className={styles.section}>{entry.section}</p>
      <h1>{entry.title}</h1>
      {entry.description && <p className={styles.lead}>{entry.description}</p>}
      {entry.reference && <Reference page={entry.reference} />}
      <DocPage.Provider value={entry.slug}>
        {Content && <Content components={mdxComponents} />}
      </DocPage.Provider>
    </article>
  );
}
