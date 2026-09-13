import { expect, type Page, test } from "@playwright/test";
import { openWorkbench, run } from "./helpers.ts";

async function runSmallBatch(page: Page) {
  await page.getByTestId("view-batch").click();
  await page.getByTestId("batch-seeds").fill("4");
  await page.getByTestId("batch-run").click();
  await expect(page.getByTestId("batch-metrics")).toBeVisible({ timeout: 90_000 });
}

test.describe("static build", () => {
  test("works from a plain static file server", async ({ page, request }) => {
    const home = await request.get("/");
    expect(home.status()).toBe(200);
    const assets = [...(await home.text()).matchAll(/(?:src|href)="\/assets\/([^"#?]+)/g)].map(
      (match) => match[1] as string,
    );
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) expect(asset).toMatch(/-[\w-]{8}\.(js|css)$/);

    const docs = await request.get("/docs/metrics");
    expect(docs.status()).toBe(200);
    expect(await docs.text()).toContain("Unmet demand (weighted)");

    const missing = await request.get("/no/such/page");
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain("Page not found");

    // The page must hydrate in place at any unknown address, not render a second copy.
    for (const path of ["/docs/no-such-page", "/no/such/page"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(1);
      await expect(page.locator("footer")).toHaveCount(1);
    }
    await page.getByRole("main").getByRole("link", { name: "workbench" }).click();
    await expect(page.getByTestId("policy-editor").locator(".cm-content")).toBeVisible();
  });

  test("makes no third-party requests during a run, a batch and a search", async ({
    page,
    context,
  }) => {
    const origins = new Set<string>();
    const record = (url: string) => {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") origins.add(parsed.origin);
    };
    context.on("request", (request) => record(request.url()));
    page.on("worker", (worker) => record(worker.url()));

    await openWorkbench(page);
    await run(page);
    await runSmallBatch(page);
    await page.goto("/docs");
    await page.getByTestId("docs-search").fill("inventory position");
    await expect(page.getByTestId("docs-search-results").getByRole("link").first()).toBeVisible();

    expect([...origins]).toEqual([new URL(page.url()).origin]);
  });

  test("runs and batches without cross-origin isolation", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers() ?? {};
    expect(headers["cross-origin-opener-policy"]).toBeUndefined();
    expect(headers["cross-origin-embedder-policy"]).toBeUndefined();
    expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(false);

    await openWorkbench(page);
    await run(page);
    await page.getByTestId("run-tab-metrics").click();
    await expect(page.getByTestId("metrics")).toContainText("Unmet demand");
    await runSmallBatch(page);
  });
});
