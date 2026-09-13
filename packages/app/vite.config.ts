import { execSync } from "node:child_process";
import { reactRouter } from "@react-router/dev/vite";
import { luaBrowserAliases } from "@regolith-rail/lua-runtime/vite";
import { defineConfig } from "vite";
import packageJson from "./package.json" with { type: "json" };
import { basePath } from "./react-router.config.ts";

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  base: basePath,
  plugins: [reactRouter()],
  resolve: { alias: luaBrowserAliases },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_COMMIT__: JSON.stringify(commit()),
  },
  worker: { format: "es" },
  build: { assetsInlineLimit: 0 },
});
