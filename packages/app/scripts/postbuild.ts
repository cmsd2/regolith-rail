import { copyFileSync, cpSync, existsSync, rmSync } from "node:fs";

const client = new URL("../build/client/", import.meta.url);
const base = (process.env.BASE_PATH ?? "/").replace(/^\/+|\/+$/g, "");

// With a base path, pages are prerendered under build/client/<base>/. The host
// serves build/client itself at the base path, so move them to the root,
// replacing the SPA fallback written there.
if (base !== "") {
  const nested = new URL(`${base}/`, client);
  if (!existsSync(nested)) throw new Error(`expected prerendered pages under ${nested.pathname}`);
  cpSync(nested, client, { recursive: true, force: true });
  rmSync(nested, { recursive: true, force: true });
  console.log(`moved pages prerendered under /${base}/ to the build root`);
}

// Static hosts serve 404.html for unknown paths; use the prerendered not-found page.
const notFound = new URL("404/index.html", client);
if (!existsSync(notFound)) throw new Error("the /404 page was not prerendered");
copyFileSync(notFound, new URL("404.html", client));
console.log("copied 404/index.html to 404.html");
