import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exampleIndex, readContentPages } from "../src/node.ts";

// Writes the runnable examples the workbench library lists under Examples. The documentation
// check fails when this file is out of date.

export const EXAMPLES_PATH = fileURLToPath(new URL("../generated/examples.json", import.meta.url));

const index = exampleIndex(readContentPages());
mkdirSync(dirname(EXAMPLES_PATH), { recursive: true });
writeFileSync(EXAMPLES_PATH, `${JSON.stringify(index, null, 2)}\n`);
console.log(`wrote ${index.length} examples to ${EXAMPLES_PATH}`);
