import { index, type RouteConfig, route } from "@react-router/dev/routes";
import { docPaths } from "@regolith-rail/docs/content";

// Each documentation page has its own route rather than a `docs/*` splat, so an
// unknown address matches only the catch-all. The static 404 page is prerendered
// from that same catch-all, which lets it hydrate at any unknown address instead
// of rendering a second copy of the page.
export default [
  index("routes/workbench.tsx"),
  ...docPaths().map((path) =>
    route(path.slice(1), "routes/docs.tsx", { id: path.slice(1).replace(/\//g, "-") }),
  ),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
