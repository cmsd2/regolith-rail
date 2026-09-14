import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { notebookWithPrelude } from "../src/claims-run.ts";

// Starts a page's checks notebook with the shared prelude: `pnpm docs:new-checks book/newsvendor`.

const slug = process.argv[2];
if (!slug) {
  console.error("usage: docs:new-checks <page slug>, such as book/newsvendor");
  process.exit(1);
}
const file = new URL(`../content/${slug}.checks.macnb`, import.meta.url);
if (existsSync(file)) {
  console.error(`${slug}.checks.macnb already exists`);
  process.exit(1);
}
const prelude = readFileSync(new URL("../checks/prelude.mac", import.meta.url), "utf8");
writeFileSync(file, notebookWithPrelude(prelude, []));
console.log(`wrote content/${slug}.checks.macnb`);
