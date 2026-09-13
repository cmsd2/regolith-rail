# Deploying to S3 and CloudFront

The site is a static build: HTML pages, content-hashed assets, a WebAssembly
module and a `404.html`. It needs no rewrites, no server code and no
cross-origin isolation headers, so any static host works. GitHub Pages is the
default and is deployed by CI; this guide covers Amazon S3 with CloudFront.

> Status: this guide has not yet been tried against a real bucket. See
> "Verification" below.

## 1. Build

Choose the path the site will live under. At the root of a domain:

```bash
BASE_PATH=/ pnpm build
```

Under a prefix such as `https://example.com/regolith-rail/`, set
`BASE_PATH=/regolith-rail/` and upload into that prefix of the bucket in the
steps below.

The build is written to `packages/app/build/client`. Check its links before
uploading:

```bash
pnpm docs:links --base /
```

## 2. Bucket and distribution

1. Create a private S3 bucket, with Block Public Access left on.
2. Create a CloudFront distribution with the bucket as its origin, using
   Origin Access Control so only CloudFront can read the bucket. Apply the
   bucket policy CloudFront offers.
3. Set the default root object to `index.html`.
4. Add a custom error response: HTTP 403 and 404 from the origin return
   `/404.html` with response code 404. A private bucket answers 403 for
   missing keys, so both codes are needed.
5. Documentation pages live at `docs/<page>/index.html`, and links point to
   `/docs/<page>` without `index.html`. CloudFront does not add `index.html`
   to sub-folders by itself, so add a CloudFront Function on viewer request
   that appends `/index.html` to paths without a file extension:

   ```js
   function handler(event) {
     var request = event.request;
     var uri = request.uri;
     if (uri.endsWith("/")) request.uri = uri + "index.html";
     else if (!uri.split("/").pop().includes(".")) request.uri = uri + "/index.html";
     return request;
   }
   ```

   An S3 website endpoint does this without a function, but cannot be used
   with Origin Access Control.

## 3. Upload

Upload assets first, so pages never refer to files that are not there yet.
Hashed assets never change, so they can be cached for a year; pages must be
revalidated so a new release is picked up.

```bash
cd packages/app/build/client

# Content-hashed assets, cached for a year. WebAssembly needs its own type.
aws s3 sync assets s3://BUCKET/assets \
  --exclude "*.wasm" \
  --cache-control "public, max-age=31536000, immutable"
aws s3 sync assets s3://BUCKET/assets \
  --exclude "*" --include "*.wasm" \
  --content-type application/wasm \
  --cache-control "public, max-age=31536000, immutable"

# Pages, always revalidated. --delete removes pages that no longer exist, and
# the exclude keeps older assets for anyone still on a cached page.
aws s3 sync . s3://BUCKET \
  --exclude "assets/*" \
  --cache-control "no-cache" \
  --delete
```

Then invalidate the pages in CloudFront. Assets do not need invalidating.

```bash
aws cloudfront create-invalidation --distribution-id DISTRIBUTION --paths "/*"
```

Old assets can be removed from `assets/` after a few days, once no cached page
refers to them.

## 4. Check

- `https://DOMAIN/` opens the workbench, and a run and a batch complete.
- `https://DOMAIN/docs/ops/min-max` shows the page, including with
  JavaScript turned off.
- `https://DOMAIN/no/such/page` shows the not-found page with status 404.
- The browser's network panel shows `application/wasm` for the `.wasm` file
  and no requests to other hosts.

## Verification

Task 15.5 of the `playable-sandbox-mvp` change asks for this guide to be
verified by deploying a root-base-path build to a test bucket. That has been
deferred: the project has no AWS account set up for it, and GitHub Pages is
the host for the first release. The parts that do not depend on AWS are
covered by tests: the build is checked on a plain static file server that
behaves like S3 (no rewrites, directory index files, `404.html`), without
cross-origin isolation headers, with no third-party requests, and with every
internal link and anchor resolving under both `/` and `/regolith-rail/`.
