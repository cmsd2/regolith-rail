import { expect, type Page, test } from "@playwright/test";
import { openWorkbench, setEditorText } from "./helpers.ts";

async function openBatch(page: Page) {
  await page.getByTestId("view-batch").click();
  await expect(page.getByTestId("batch-config")).toBeVisible();
}

async function runBatch(page: Page, seeds: number) {
  await page.getByTestId("batch-seeds").fill(String(seeds));
  await page.getByTestId("batch-run").click();
  await expect(page.getByTestId("batch-metrics")).toBeVisible({ timeout: 90_000 });
}

test.describe("batch comparison", () => {
  test("defaults to 100 seeds of the current policy", async ({ page }) => {
    await openWorkbench(page);
    await openBatch(page);
    await expect(page.getByTestId("batch-seeds")).toHaveValue("100");
    await expect(page.getByTestId("batch-config")).toContainText("naive.lua");
    await expect(page.getByTestId("batch-config")).toContainText("Two stations");
  });

  test("shows each metric's distribution and stock over time", async ({ page }) => {
    await openWorkbench(page);
    await openBatch(page);
    await runBatch(page, 8);
    await expect(page.getByTestId("batch-metrics").locator("tbody tr")).toHaveCount(12);
    await expect(page.getByTestId("distribution-unmetDemandWeighted")).toBeVisible();
    await expect(page.getByTestId("batch-fan").locator("svg").first()).toBeVisible();
  });

  test("lists seeds whose runs had errors and opens them", async ({ page }) => {
    await openWorkbench(page);
    await setEditorText(
      page,
      "policy-editor",
      [
        "return {",
        "  on_start = function(ctx) ctx.memory.unlucky = ctx.rand() < 0.5 end,",
        '  on_stop = function(ctx) if ctx.memory.unlucky then error("unlucky seed") end end,',
        "}",
        "",
      ].join("\n"),
    );
    await openBatch(page);
    await runBatch(page, 10);
    const failed = page.getByTestId("failed-a");
    await expect(failed).toContainText("runs with errors");
    const count = Number((await failed.textContent())?.match(/(\d+) runs with errors/)?.[1]);
    await expect(failed.getByRole("listitem")).toHaveCount(count);
    await failed.getByRole("button").first().click();
    await expect(page.getByTestId("run-tab-errors")).toContainText("Errors (", { timeout: 60_000 });
  });

  test("opens a seed in the run view with the same metrics", async ({ page }) => {
    await openWorkbench(page);
    await openBatch(page);
    await runBatch(page, 5);
    await page.getByTestId("batch-seeds-table").locator("xpath=..").locator("summary").click();
    const row = page.getByTestId("batch-seeds-table").locator("tbody tr").nth(2);
    const unmet = await row.getByTestId("seed-unmet-a").textContent();
    await row.getByTestId("open-seed-a").click();
    await expect(page.locator('canvas[data-testid="line-map"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("run")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("run-tab-metrics").click();
    await expect(
      page
        .getByTestId("metrics")
        .locator("tr", { hasText: "Unmet demand (weighted)" })
        .locator("td"),
    ).toHaveText(unmet ?? "");
  });

  test("shows a clear improvement from supply-to-demand over naive on two-station", async ({
    page,
  }) => {
    await openWorkbench(page);
    await openBatch(page);
    await page.getByTestId("batch-compare").check();
    await page.getByTestId("batch-policy-b").selectOption("supply-to-demand");
    await runBatch(page, 20);
    await expect(page.getByTestId("difference-unmetDemandWeighted")).toHaveAttribute(
      "data-verdict",
      "better",
    );
  });
});
