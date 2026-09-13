import type { Config } from "@react-router/dev/config";

/** Base path the site is served under, e.g. `/regolith-rail/` on GitHub Pages. */
export const basePath = process.env.BASE_PATH ?? "/";

export default {
  appDirectory: "src",
  buildDirectory: "build",
  ssr: false,
  basename: basePath,
  prerender: ["/", "/404"],
} satisfies Config;
