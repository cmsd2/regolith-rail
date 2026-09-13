import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { luaBrowserAliases } from "../../packages/lua-runtime/browser/vite.ts";

export default defineConfig({
  logLevel: "warn",
  resolve: { alias: luaBrowserAliases },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: fileURLToPath(new URL("./entry.ts", import.meta.url)),
      formats: ["iife"],
      name: "determinism",
      fileName: () => "determinism.js",
    },
  },
});
