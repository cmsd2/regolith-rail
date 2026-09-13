import rehypeShiki from "@shikijs/rehype";
import rehypeKatex from "rehype-katex";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import type { PluggableList } from "unified";
import { remarkExamples, remarkHeadingIds } from "./markdown.ts";

/** MDX compiler options for documentation pages. Highlighting and maths happen at build time. */
export const mdxOptions: { remarkPlugins: PluggableList; rehypePlugins: PluggableList } = {
  remarkPlugins: [
    [remarkFrontmatter, ["yaml"]],
    remarkMdxFrontmatter,
    remarkGfm,
    remarkMath,
    remarkHeadingIds,
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
