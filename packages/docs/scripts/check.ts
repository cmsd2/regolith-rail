import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { apiTypes, opsBlocks } from "@regolith-rail/policy-api";
import { constructs } from "@regolith-rail/scenario-kit";
import {
  checkConstructs,
  checkFrontmatter,
  checkReference,
  checkTemplatePages,
  extractExamples,
  readContentPages,
  runExample,
} from "../src/node.ts";

// The documentation check: reference completeness, page frontmatter and runnable
// examples. Links are checked against the built site by scripts/links.ts.

const pages = readContentPages();
const runtime = await LuaRuntime.load();
const problems = [
  ...checkReference(apiTypes, opsBlocks),
  ...checkConstructs(constructs, runtime.libraryConstructs()),
  ...checkTemplatePages(constructs, new Set(pages.map((p) => p.slug))),
  ...checkFrontmatter(pages),
];

const examples = pages.flatMap((page) => extractExamples(page.slug, page.tree));
for (const example of examples) problems.push(...runExample(runtime, example));

if (problems.length > 0) {
  console.error(`documentation check failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`documentation check passed: ${pages.length} pages, ${examples.length} examples`);
