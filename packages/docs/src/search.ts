import type { Options, SearchOptions } from "minisearch";

export interface SearchDocument {
  /** Page slug, with an anchor for entries within a page. */
  id: string;
  title: string;
  section: string;
  headings: string;
  text: string;
}

export type SearchResultFields = Pick<SearchDocument, "id" | "title" | "section">;

/** Index options, shared by the build that makes the index and the page that loads it. */
export const SEARCH_INDEX_OPTIONS: Options<SearchDocument> = {
  fields: ["title", "headings", "text"],
  storeFields: ["title", "section"],
};

export const SEARCH_OPTIONS: SearchOptions = {
  boost: { title: 5, headings: 2 },
  prefix: true,
  fuzzy: 0.2,
};
