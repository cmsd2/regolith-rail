import type { Config } from "@react-router/dev/config";
import { docPaths } from "@regolith-rail/docs/content";

/** Base path the site is served under, e.g. `/regolith-rail/` on GitHub Pages. */
export const basePath = process.env.BASE_PATH ?? "/";

export default {
  appDirectory: "src",
  buildDirectory: "build",
  ssr: false,
  basename: basePath,
  // Every documentation page is prerendered with its content.
  prerender: ["/", "/404", ...docPaths()],
} satisfies Config;
