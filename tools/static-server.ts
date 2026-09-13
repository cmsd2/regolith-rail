import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { parseArgs } from "node:util";

/**
 * A plain static file server that behaves like GitHub Pages or an S3 website:
 * no rewrites and no special headers. Directories serve index.html, unknown
 * paths serve 404.html with status 404.
 */
const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "packages/app/build/client" },
    base: { type: "string", default: "/" },
    port: { type: "string", default: "4173" },
  },
});

const root = resolve(values.dir);
const base = values.base.endsWith("/") ? values.base : `${values.base}/`;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function send(res: import("node:http").ServerResponse, status: number, file: string) {
  res.writeHead(status, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const notFound = join(root, "404.html");
  if (!url.pathname.startsWith(base)) {
    return existsSync(notFound) ? send(res, 404, notFound) : res.writeHead(404).end();
  }
  const relative = normalize(decodeURIComponent(url.pathname.slice(base.length)));
  let file = join(root, relative);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (existsSync(file) && statSync(file).isFile()) return send(res, 200, file);
  return existsSync(notFound) ? send(res, 404, notFound) : res.writeHead(404).end();
}).listen(Number(values.port), () => {
  console.log(`serving ${root} at http://localhost:${values.port}${base}`);
});
