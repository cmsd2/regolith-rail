import { readdirSync, readFileSync } from "node:fs";
import type { Root, RootContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import { frontmatterOf } from "./markdown.ts";

export interface ScenarioNames {
  starters: ReadonlySet<string>;
  templates: ReadonlySet<string>;
  /** Built-in policies, such as `balance-stock`. */
  policies: ReadonlySet<string>;
}

const packageFile = (path: string) => new URL(`../../${path}`, import.meta.url);

/**
 * The names the site ships, read from their source files each time, so a development server that
 * keeps running still sees starters, templates and policies that were added or renamed.
 */
export function shippedNames(): ScenarioNames {
  const baseNames = (dir: string, extension: string) =>
    readdirSync(packageFile(dir))
      .filter((f) => f.endsWith(extension))
      .map((f) => f.slice(0, -extension.length));
  const constructs = JSON.parse(
    readFileSync(packageFile("scenario-kit/generated/constructs.json"), "utf8"),
  ) as { constructs: { name: string; kind: string }[] };
  return {
    starters: new Set(baseNames("engine/src/scenario/starters/", ".json")),
    templates: new Set(
      constructs.constructs.filter((c) => c.kind === "template").map((c) => c.name),
    ),
    policies: new Set(baseNames("policy-api/policies/", ".lua")),
  };
}

/**
 * Turns inline code naming a starter scenario, such as `two-station`, a classic template, such as
 * `classic.reorder`, or a built-in policy, such as `balance-stock`, into a link that puts it in the
 * workbench's run. Only Book pages are changed, where such names always mean these; elsewhere
 * `relay` can be a role. Code inside links and headings is left alone.
 */
export function remarkScenarioLinks(given?: ScenarioNames) {
  return (tree: Root) => {
    if (frontmatterOf(tree).section !== "Book") return;
    const names = given ?? shippedNames();
    visit(tree, (node, index, parent) => {
      if (node.type === "link" || node.type === "heading") return SKIP;
      if (node.type !== "inlineCode" || !parent || index === undefined) return undefined;
      const [name, attribute] = names.starters.has(node.value)
        ? ["ScenarioLink", "starter"]
        : names.templates.has(node.value)
          ? ["ScenarioLink", "template"]
          : names.policies.has(node.value)
            ? ["PolicyLink", "policy"]
            : [undefined, undefined];
      if (!name || !attribute) return undefined;
      const element = {
        type: "mdxJsxTextElement",
        name,
        attributes: [{ type: "mdxJsxAttribute", name: attribute, value: node.value }],
        children: [node],
      } as unknown as RootContent;
      (parent.children as RootContent[]).splice(index, 1, element);
      return SKIP;
    });
  };
}
