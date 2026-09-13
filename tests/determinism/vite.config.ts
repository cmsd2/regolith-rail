import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  logLevel: "warn",
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
