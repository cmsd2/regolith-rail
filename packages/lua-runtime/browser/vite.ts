import { fileURLToPath } from "node:url";
import type { Alias } from "vite";

/** Vite aliases that let wasmoon bundle for browsers without Node built-ins. */
export const luaBrowserAliases: Alias[] = [
  {
    find: /^(module|url)$/,
    replacement: fileURLToPath(new URL("./node-builtins.ts", import.meta.url)),
  },
];
