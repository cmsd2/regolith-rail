import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as stylua from "@johnnymorganz/stylua";
import { formatLua } from "../packages/scenario-kit/src/lua-format.ts";

// Formats the Lua the site ships with StyLua: policies, the ops library, construct libraries,
// starter scripts, and the lua code blocks in the documentation. With --check, it changes
// nothing and fails if anything is not formatted.

const root = fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.includes("--check");

const LUA_DIRS = [
  "packages/policy-api/policies",
  "packages/policy-api/ops",
  "packages/scenario-kit/lua",
  "packages/scenario-kit/starters",
  "packages/scenario-kit/policies",
];
const DOCS_DIR = "packages/docs/content";

const filesIn = (dir: string, extension: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(extension))
    .map((e) => join(e.parentPath, e.name))
    .sort();

const unformatted: string[] = [];
const problems: string[] = [];
const name = (file: string) => relative(root, file).split("\\").join("/");

function update(file: string, before: string, after: string) {
  if (before === after) return;
  unformatted.push(name(file));
  if (!check) writeFileSync(file, after);
}

for (const file of LUA_DIRS.flatMap((dir) => filesIn(dir, ".lua"))) {
  const source = readFileSync(file, "utf8");
  try {
    update(file, source, formatLua(stylua, source));
  } catch (error) {
    problems.push(`${name(file)}: ${(error as Error).message}`);
  }
}

// Lua code blocks in the documentation, fenced at the start of a line.
const FENCE = /^```lua([^\n]*)\n([\s\S]*?)\n```$/gm;
for (const file of filesIn(DOCS_DIR, ".mdx")) {
  const source = readFileSync(file, "utf8");
  const after = source.replace(FENCE, (block, meta: string, code: string, offset: number) => {
    try {
      return `\`\`\`lua${meta}\n${formatLua(stylua, `${code}\n`).trimEnd()}\n\`\`\``;
    } catch (error) {
      const line = source.slice(0, offset).split("\n").length;
      problems.push(`${name(file)} line ${line}: ${(error as Error).message}`);
      return block;
    }
  });
  update(file, source, after);
}

if (problems.length > 0) {
  console.error("Lua that could not be formatted:");
  for (const problem of problems) console.error(`- ${problem}`);
}
if (check && unformatted.length > 0) {
  console.error("Lua that is not formatted; run `pnpm format:lua`:");
  for (const file of unformatted) console.error(`- ${file}`);
}
if (problems.length > 0 || (check && unformatted.length > 0)) process.exit(1);
console.log(
  check ? "all shipped Lua is formatted" : `formatted ${unformatted.length} file(s) with StyLua`,
);
