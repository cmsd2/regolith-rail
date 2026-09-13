import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const golden = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url), "utf8"));
const bundle = fileURLToPath(new URL("./dist/determinism.js", import.meta.url));

test("simulation results match the Node golden hashes", async ({ page }) => {
  await page.setContent("<!doctype html><title>determinism</title>");
  await page.addScriptTag({ path: bundle });
  const hashes = await page.evaluate(() =>
    (
      globalThis as unknown as { runDeterminismMatrix: () => Record<string, string> }
    ).runDeterminismMatrix(),
  );
  expect(Object.keys(hashes)).toHaveLength(Object.keys(golden).length);
  expect(hashes).toEqual(golden);
});
