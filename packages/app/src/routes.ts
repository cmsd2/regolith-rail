import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/workbench.tsx"),
  route("404", "routes/not-found.tsx"),
  route("*", "routes/catch-all.tsx"),
] satisfies RouteConfig;
