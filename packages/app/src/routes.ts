import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/workbench.tsx"),
  route("docs", "routes/docs.tsx", { id: "docs-home" }),
  route("docs/*", "routes/docs.tsx"),
  route("404", "routes/not-found.tsx"),
  route("*", "routes/catch-all.tsx"),
] satisfies RouteConfig;
