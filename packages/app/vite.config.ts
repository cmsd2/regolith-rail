import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mdx from "@mdx-js/rollup";
import { reactRouter } from "@react-router/dev/vite";
import { mdxOptions } from "@regolith-rail/docs/mdx";
import { luaBrowserAliases } from "@regolith-rail/lua-runtime/vite";
import { defineConfig, type Plugin } from "vite";
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

/**
 * Book pages take their check sources, test titles and scenario and policy names from other files
 * while they compile. In development, a change to any of those recompiles the book's pages.
 */
function bookSources(): Plugin {
  const packages = fileURLToPath(new URL("../", import.meta.url));
  const source =
    /(\.checks\.(macnb|py)|\.test\.ts|[\\/]policies[\\/][^\\/]+\.lua|[\\/]starters[\\/][^\\/]+\.json|constructs\.json)$/;
  return {
    name: "regolith-rail:book-sources",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(packages);
      server.watcher.on("change", (file) => {
        if (!source.test(file) || file.includes("node_modules")) return;
        const pages = [...server.moduleGraph.idToModuleMap.values()].filter((m) =>
          /[\\/]docs[\\/]content[\\/]book[\\/][^\\/]+\.mdx$/.test(m.file ?? ""),
        );
        if (pages.length === 0) return;
        for (const page of pages) server.moduleGraph.invalidateModule(page);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [{ enforce: "pre", ...mdx(mdxOptions) }, reactRouter(), bookSources()],
  resolve: { alias: luaBrowserAliases },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_COMMIT__: JSON.stringify(commit()),
  },
  worker: { format: "es" },
  build: { assetsInlineLimit: 0 },
});
