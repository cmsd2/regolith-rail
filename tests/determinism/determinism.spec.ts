import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const golden = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url), "utf8"));
const bundle = readFileSync(new URL("./dist/determinism.js", import.meta.url), "utf8");

// A routed origin rather than about:blank, so the bundle sees an ordinary page URL.
const ORIGIN = "http://determinism.test";

async function open(page: Page) {
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    return path === "/determinism.js"
      ? route.fulfill({ contentType: "text/javascript", body: bundle })
      : route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><title>determinism</title><script src="/determinism.js"></script>',
        });
  });
  await page.goto(`${ORIGIN}/`);
}

const matrix = (page: Page, fromScripts: boolean) =>
  page.evaluate(
    (scripts) =>
      (
        globalThis as unknown as {
          runDeterminismMatrix: (fromScripts: boolean) => Promise<Record<string, string>>;
        }
      ).runDeterminismMatrix(scripts),
    fromScripts,
  );

test("simulation results match the Node golden hashes", async ({ page }) => {
  await open(page);
  const hashes = await matrix(page, false);
  expect(Object.keys(hashes)).toHaveLength(Object.keys(golden).length);
  expect(hashes).toEqual(golden);
});

test("starter Mars scripts give the golden hashes", async ({ page }) => {
  await open(page);
  expect(await matrix(page, true)).toEqual(golden);
});
