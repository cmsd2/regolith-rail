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

/** The documentation example item with this source and kind, as a page renders it. */
export function findExampleItem(source: string, script: boolean): ItemId | null {
  const kind = script ? "scenario" : "policy";
  const found = catalogue.find((item) => {
    if (item.source !== "example" || item.kind !== kind || !item.example) return false;
    const content = item.kind === "scenario" ? item.content.source : item.content;
    return content === source;
  });
  return found?.id ?? null;
}
