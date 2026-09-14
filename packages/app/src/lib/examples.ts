import { catalogue } from "./catalogue.ts";
import type { ItemId } from "./library.ts";

const FRAGMENT = /^#example\.(.*)\.(\d+)$/;

/** The fragment that opens a documentation example in a fresh workbench: `#example.<page>.<n>`. */
export function exampleFragmentFor(id: ItemId): string | null {
  const match = /^example:(?:policy|scenario):docs\/(.+)#(\d+)$/.exec(id);
  return match ? `#example.${match[1]}.${match[2]}` : null;
}

/** The example item a fragment names, or null when the fragment is not an example's. */
export function exampleFragment(hash: string): ItemId | null {
  const match = FRAGMENT.exec(hash);
  if (!match) return null;
  const key = `docs/${match[1] || "index"}#${match[2]}`;
  return (
    catalogue.find((item) => item.source === "example" && item.id.endsWith(`:${key}`))?.id ??
    `example:policy:${key}`
  );
}

/** The fragment that puts a policy in the run of a fresh workbench: `#policy.<item id>`. */
export const policyFragmentFor = (id: ItemId) => `#policy.${id}`;

/** The policy item a fragment names, or null when the fragment is not a policy's. */
export function policyFragment(hash: string): ItemId | null {
  const match = /^#policy\.(.+)$/.exec(hash);
  return match ? decodeURIComponent(match[1] as string) : null;
}

/** The fragment that opens a chapter's scenario in a fresh workbench: `#scenario.<item id>`. */
export const scenarioFragmentFor = (id: ItemId) => `#scenario.${id}`;

/** The scenario item a fragment names, or null when the fragment is not a scenario's. */
export function scenarioFragment(hash: string): ItemId | null {
  const match = /^#scenario\.(.+)$/.exec(hash);
  return match ? decodeURIComponent(match[1] as string) : null;
}

/**
 * The documentation example item with this source and kind, as a page renders it. When several
 * pages show the same example, the item from the given page is preferred.
 */
export function findExampleItem(source: string, script: boolean, page?: string): ItemId | null {
  const kind = script ? "scenario" : "policy";
  const found = catalogue.filter((item) => {
    if (item.source !== "example" || item.kind !== kind || !item.example) return false;
    const content = item.kind === "scenario" ? item.content.source : item.content;
    return content === source;
  });
  const onPage = page === undefined ? null : `:docs/${page || "index"}#`;
  const preferred = onPage === null ? undefined : found.find((item) => item.id.includes(onPage));
  return (preferred ?? found[0])?.id ?? null;
}
