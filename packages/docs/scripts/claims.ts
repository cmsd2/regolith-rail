import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONTENT_DIR, checkClaims, findTools, readContentPages, runClaims } from "../src/node.ts";

// Runs the checks behind the documentation's claims: every reference must resolve, then every
// Maxima notebook runs through aximar-mcp and every Python script through uv. Pass
// `--root <folder>` to check another content folder, such as the fixtures.

const at = process.argv.indexOf("--root");
const root = at === -1 ? CONTENT_DIR : resolve(process.argv[at + 1] ?? "");
const shared = {
  prelude: readFileSync(new URL("../checks/prelude.mac", import.meta.url), "utf8"),
  pythonTemplate: readFileSync(new URL("../checks/template.checks.py", import.meta.url), "utf8"),
};

const found = findTools();
if ("missing" in found) {
  console.error("the documentation checks need tools that aren't installed:");
  for (const tool of found.missing) console.error(`- ${tool}`);
  process.exit(1);
}

const problems = checkClaims(readContentPages(root));
const run = runClaims(root, found.tools, shared);
problems.push(...run.problems);

if (problems.length > 0) {
  console.error(`documentation checks failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`documentation checks passed: ${run.files} checks file(s)`);
