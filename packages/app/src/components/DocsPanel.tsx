import { movedTarget } from "@regolith-rail/docs";
import { useEffect, useRef } from "react";
import { DocArticle } from "../docs/DocArticle.tsx";
import { DocsMode } from "../docs/DocLink.tsx";
import { DocsSearch } from "../docs/DocsSearch.tsx";
import styles from "../docs/docs.module.css";
import { findDoc, splitTarget } from "../docs/registry.ts";
import { docsHref } from "../lib/format.ts";
import { useWorkbench } from "../state/instance.ts";

/** Documentation beside the editor, so reading it never loses work in progress. */
export default function DocsPanel() {
  // Old targets, such as a lesson saved before its page moved, open where the page lives now.
  const target = movedTarget(useWorkbench((s) => s.docs.at(-1) ?? ""));
  const canGoBack = useWorkbench((s) => s.docs.length > 1);
  const back = useWorkbench((s) => s.docsBack);
  const close = useWorkbench((s) => s.closeDocs);
  const body = useRef<HTMLDivElement>(null);
  const { slug } = splitTarget(target);
  const entry = findDoc(slug);

  useEffect(() => {
    const container = body.current;
    if (!container) return;
    const { anchor } = splitTarget(target);
    const element = anchor ? container.querySelector(`[id="${CSS.escape(anchor)}"]`) : null;
    if (element) element.scrollIntoView({ block: "start" });
    else container.scrollTop = 0;
  }, [target]);

  return (
    <section className={styles.panel} aria-label="Documentation" data-testid="docs-panel">
      <DocsMode.Provider value="panel">
        <div className={styles.panelBar}>
          {canGoBack && (
            <button type="button" onClick={back} data-testid="docs-back">
              Back
            </button>
          )}
          <DocsSearch />
          <a href={docsHref(target)} target="_blank" rel="noreferrer">
            Open as page
          </a>
          <button
            type="button"
            onClick={close}
            aria-label="Close documentation"
            data-testid="docs-close"
          >
            ×
          </button>
        </div>
        <div className={styles.panelBody} ref={body}>
          {entry ? (
            <DocArticle key={slug} entry={entry} />
          ) : (
            <p>There is no documentation page called {slug}.</p>
          )}
        </div>
      </DocsMode.Provider>
    </section>
  );
}
