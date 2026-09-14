import { starterScenarios } from "@regolith-rail/engine";
import { classicTemplates } from "@regolith-rail/scenario-kit";
import type { Root, RootContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import { frontmatterOf } from "./markdown.ts";

export interface ScenarioNames {
  starters: ReadonlySet<string>;
  templates: ReadonlySet<string>;
}

const shipped = (): ScenarioNames => ({
  starters: new Set(starterScenarios.map((s) => s.id)),
  templates: new Set(classicTemplates.map((t) => t.name)),
});

/**
 * Turns inline code naming a starter scenario, such as `two-station`, or a classic template, such as
 * `classic.reorder`, into a link that opens it in the workbench. Only Book pages are changed, where
 * such names always mean scenarios; elsewhere `relay` can be a role. Code inside links and headings
 * is left alone.
 */
export function remarkScenarioLinks(names: ScenarioNames = shipped()) {
  return (tree: Root) => {
    if (frontmatterOf(tree).section !== "Book") return;
    visit(tree, (node, index, parent) => {
      if (node.type === "link" || node.type === "heading") return SKIP;
      if (node.type !== "inlineCode" || !parent || index === undefined) return undefined;
      const starter = names.starters.has(node.value);
      if (!starter && !names.templates.has(node.value)) return undefined;
      const element = {
        type: "mdxJsxTextElement",
        name: "ScenarioLink",
        attributes: [
          { type: "mdxJsxAttribute", name: starter ? "starter" : "template", value: node.value },
        ],
        children: [node],
      } as unknown as RootContent;
      (parent.children as RootContent[]).splice(index, 1, element);
      return SKIP;
    });
  };
}
