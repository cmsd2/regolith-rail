import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { parseMdx } from "./markdown.ts";
import { remarkScenarioLinks } from "./scenario-links.ts";

const names = {
  starters: new Set(["two-station", "relay"]),
  templates: new Set(["classic.reorder"]),
};

const linked = (section: string, body: string) => {
  const tree = parseMdx(`---\ntitle: T\nsection: ${section}\n---\n\n${body}`);
  remarkScenarioLinks(names)(tree);
  const found: { name: string; attribute: string; value: string }[] = [];
  const walk = (node: Root | Root["children"][number]) => {
    if (node.type === "mdxJsxTextElement" && node.name === "ScenarioLink") {
      const attribute = node.attributes[0] as { name: string; value: string };
      found.push({ name: node.name, attribute: attribute.name, value: attribute.value });
    }
    if ("children" in node) for (const child of node.children) walk(child);
  };
  walk(tree);
  return found;
};

describe("scenario links", () => {
  it("link starters and classic templates named in inline code on Book pages", () => {
    expect(linked("Book", "The `two-station` starter, and `classic.reorder`.")).toEqual([
      { name: "ScenarioLink", attribute: "starter", value: "two-station" },
      { name: "ScenarioLink", attribute: "template", value: "classic.reorder" },
    ]);
  });

  it("leave other code, code in links and headings, and other sections alone", () => {
    expect(linked("Book", "`ops.drain`, [`relay`](/docs/x), and\n\n## The `relay` line")).toEqual(
      [],
    );
    expect(linked("Guides", "A `relay` role, and `two-station`.")).toEqual([]);
  });
});
