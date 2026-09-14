import rehypeShiki from "@shikijs/rehype";
import rehypeKatex from "rehype-katex";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import type { PluggableList } from "unified";
import { remarkChecks } from "./claims.ts";
import { remarkExamples, remarkHeadingIds } from "./markdown.ts";

/** MDX compiler options for documentation pages. Highlighting and maths happen at build time. */
export const mdxOptions: { remarkPlugins: PluggableList; rehypePlugins: PluggableList } = {
  remarkPlugins: [
    [remarkFrontmatter, ["yaml"]],
    remarkMdxFrontmatter,
    remarkGfm,
    remarkMath,
    remarkHeadingIds,
    // Checks read the page's runnable examples, so they resolve before examples are wrapped.
    remarkChecks,
    remarkExamples,
  ],
  rehypePlugins: [
    rehypeKatex,
    [
      rehypeShiki,
      {
        themes: { light: "github-light", dark: "github-dark" },
        // Colours stay in CSS variables, so the site's stylesheet picks light or dark.
        defaultColor: false,
        langs: ["lua", "json", "bash", "text"],
      },
    ],
  ],
};
