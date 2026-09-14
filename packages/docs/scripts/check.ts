import { readFileSync } from "node:fs";
import { starterScenarios } from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { apiTypes, opsBlocks } from "@regolith-rail/policy-api";
import { constructs } from "@regolith-rail/scenario-kit";
import {
  checkBook,
  checkChapterStandard,
  checkClaims,
  checkConstructs,
  checkExampleIndex,
  checkFrontmatter,
  checkReference,
  checkStarterFixes,
  checkTemplatePages,
  exampleIndex,
  extractExamples,
  readContentPages,
  runExample,
} from "../src/node.ts";

// The documentation check: reference completeness, page frontmatter, runnable examples and
// the examples index the workbench library lists. Links are checked against the built site by
// scripts/links.ts.

const pages = readContentPages();
const runtime = await LuaRuntime.load();
const committedExamples = JSON.parse(
  readFileSync(new URL("../generated/examples.json", import.meta.url), "utf8"),
);
const problems = [
  ...checkReference(apiTypes, opsBlocks),
  ...checkConstructs(constructs, runtime.libraryConstructs()),
  ...checkTemplatePages(constructs, new Set(pages.map((p) => p.slug))),
  ...checkFrontmatter(pages),
  ...checkBook(pages),
  ...checkChapterStandard(pages),
  ...checkClaims(pages),
  ...checkExampleIndex(committedExamples, exampleIndex(pages)),
  ...checkStarterFixes(
    starterScenarios.map(({ id, document }) => ({
      id,
      docs: (document as { docs?: string }).docs,
    })),
    pages,
  ),
];

const examples = pages.flatMap((page) => extractExamples(page.slug, page.tree));
for (const example of examples) problems.push(...runExample(runtime, example));

if (problems.length > 0) {
  console.error(`documentation check failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`documentation check passed: ${pages.length} pages, ${examples.length} examples`);
