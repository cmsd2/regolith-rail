import { starterScenarios } from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { classicTemplates } from "@regolith-rail/scenario-kit";
import type { Root, RootContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import { frontmatterOf } from "./markdown.ts";

export interface ScenarioNames {
  starters: ReadonlySet<string>;
  templates: ReadonlySet<string>;
  /** Built-in policies, such as `balance-stock`. */
  policies: ReadonlySet<string>;
}

const shipped = (): ScenarioNames => ({
  starters: new Set(starterScenarios.map((s) => s.id)),
  templates: new Set(classicTemplates.map((t) => t.name)),
  policies: new Set(Object.keys(BUILT_IN_POLICIES)),
});

/**
 * Turns inline code naming a starter scenario, such as `two-station`, a classic template, such as
 * `classic.reorder`, or a built-in policy, such as `balance-stock`, into a link that puts it in the
 * workbench's run. Only Book pages are changed, where such names always mean these; elsewhere
 * `relay` can be a role. Code inside links and headings is left alone.
 */
export function remarkScenarioLinks(names: ScenarioNames = shipped()) {
  return (tree: Root) => {
    if (frontmatterOf(tree).section !== "Book") return;
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
