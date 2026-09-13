import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { generatedFiles } from "../src/generate.ts";

const root = new URL("../../../", import.meta.url);
const written: string[] = [];
for (const [path, text] of Object.entries(generatedFiles())) {
  const target = new URL(path, root);
  mkdirSync(new URL(".", target), { recursive: true });
  writeFileSync(target, text);
  written.push(path);
}

// Format with the project formatter so generated files pass lint; the
// staleness test compares content, not formatting.
const biome = createRequire(new URL("package.json", root)).resolve("@biomejs/biome/bin/biome");
const formattable = written.filter((p) => /\.(ts|json)$/.test(p));
execFileSync(process.execPath, [biome, "format", "--write", ...formattable], {
  cwd: fileURLToPath(root),
  stdio: "inherit",
});
for (const path of written) console.log(`wrote ${path}`);
