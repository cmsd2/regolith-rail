import {
  SEARCH_INDEX_OPTIONS,
  SEARCH_OPTIONS,
  type SearchDocument,
  type SearchResultFields,
} from "@regolith-rail/docs";
import type MiniSearch from "minisearch";
import { useEffect, useId, useRef, useState } from "react";
import { DocLink } from "./DocLink.tsx";
import styles from "./docs.module.css";
import searchIndexUrl from "./search-index.json?url";

let loading: Promise<MiniSearch<SearchDocument>> | undefined;

/** Loads the prebuilt index from this site the first time someone searches. */
function loadIndex(): Promise<MiniSearch<SearchDocument>> {
  loading ??= Promise.all([
    import("minisearch"),
    fetch(searchIndexUrl).then((response) => {
      if (!response.ok) throw new Error(`search index: ${response.status}`);
      return response.text();
    }),
  ]).then(([{ default: Search }, json]) =>
    Search.loadJSON<SearchDocument>(json, SEARCH_INDEX_OPTIONS),
  );
  loading.catch(() => {
    loading = undefined;
  });
  return loading;
}

export function DocsSearch() {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<MiniSearch<SearchDocument> | null>(null);
  const [failed, setFailed] = useState(false);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  const load = () => {
    if (index) return;
    loadIndex().then(setIndex, () => setFailed(true));
  };

  // The input is uncontrolled so that anything typed before the page's scripts
  // start is kept; pick it up once they have.
  useEffect(() => {
    const early = input.current?.value ?? "";
    if (early) {
      setQuery(early);
      loadIndex().then(setIndex, () => setFailed(true));
    }
  }, []);
  const results =
    index && query.trim()
      ? (index.search(query, SEARCH_OPTIONS).slice(0, 12) as unknown as SearchResultFields[])
      : [];

  return (
    <search className={styles.search}>
      <input
        type="search"
        placeholder="Search documentation"
        aria-label="Search documentation"
        aria-controls={listId}
        ref={input}
        defaultValue=""
        onFocus={load}
        onChange={(e) => {
          load();
          setQuery(e.target.value);
        }}
        data-testid="docs-search"
      />
      {failed && <p className={styles.muted}>Search is unavailable.</p>}
      {query.trim() && index && (
        <ul id={listId} className={styles.results} data-testid="docs-search-results">
          {results.length === 0 && <li className={styles.muted}>No matches.</li>}
          {results.map((result) => (
            <li key={result.id}>
              <DocLink
                href={`/docs/${result.id}`}
                onClick={() => {
                  if (input.current) input.current.value = "";
                  setQuery("");
                }}
              >
                {result.title}
              </DocLink>
              <span className={styles.muted}> {result.section}</span>
            </li>
          ))}
        </ul>
      )}
    </search>
  );
}
