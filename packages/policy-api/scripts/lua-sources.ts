import { readdirSync, readFileSync } from "node:fs";

/** Reads every `.lua` file in a directory, keyed by file name without extension. */
export function readLuaSources(directory: URL): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const file of readdirSync(directory).sort()) {
    if (!file.endsWith(".lua")) continue;
    sources[file.slice(0, -4)] = readFileSync(new URL(file, directory), "utf8").replace(
      /\r\n/g,
      "\n",
    );
  }
  return sources;
}
