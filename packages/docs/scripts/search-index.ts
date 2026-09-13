import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildSearchIndex, readContentPages } from "../src/node.ts";

// Writes the search index the site loads when a reader first searches.
const out = resolve(process.argv[2] ?? "search-index.json");
const index = buildSearchIndex(readContentPages());
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(index));
console.log(`wrote search index with ${index.documentCount} entries to ${out}`);
