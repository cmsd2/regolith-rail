/**
 * Pages that moved, by old slug, with the page and anchor they moved to. Old addresses keep
 * working as redirects, the docs panel follows them, and the link check rejects links to them.
 */
export const MOVED_PAGES: Readonly<Record<string, string>> = {
  "classic/newsvendor": "book/newsvendor",
  "classic/reorder": "book/order-quantities",
  "failure-modes/dead-stock": "book/flows#case-study-dead-stock",
  "failure-modes/double-dispatch": "book/base-stock#case-study-double-dispatch",
  "failure-modes/half-capacity": "book/modelling#case-study-half-capacity",
};

/** Where a documentation target such as `failure-modes/double-dispatch` lives now. */
export function movedTarget(
  target: string,
  moved: Readonly<Record<string, string>> = MOVED_PAGES,
): string {
  const hash = target.indexOf("#");
  const slug = (hash === -1 ? target : target.slice(0, hash)).replace(/^\/+|\/+$/g, "");
  const to = moved[slug];
  if (to === undefined) return target;
  // An anchor on the old page means nothing on the new one, so the move's own anchor wins.
  return to.includes("#") || hash === -1 ? to : `${to}${target.slice(hash)}`;
}
