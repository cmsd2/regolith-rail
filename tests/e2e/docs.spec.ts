import { expect, test } from "@playwright/test";
import { docPaths } from "../../packages/docs/src/content.ts";
import { openWorkbench, run, setEditorText } from "./helpers.ts";

const NOTICE = "not affiliated with or endorsed by Paradox Interactive or Haemimont Games";

test.describe("documentation pages", () => {
  test("a direct link shows the page content without running scripts", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/docs/ops/min-max");
    const article = page.getByTestId("doc-article");
    await expect(article.locator("h1")).toHaveText("ops.min_max");
    await expect(article.locator("#param-min")).toContainText("Inventory position below which");
    await expect(article.locator("pre.shiki").first()).toBeVisible();
    await expect(article.locator(".katex").first()).toBeVisible();
    await context.close();
  });

  test("every documentation page shows the non-affiliation notice", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const path of docPaths()) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("footer"), path).toContainText(NOTICE);
    }
    await context.close();
  });

  test("the station balancing statement names the game version and evidence level", async ({
    page,
  }) => {
    await page.goto("/docs/game-mechanics");
    const evidence = page.locator("#station-balancing ~ [data-testid='evidence']").first();
    await expect(evidence).toContainText(/Surviving Mars: Relaunched \d/);
    await expect(evidence).toHaveAttribute("data-level", "observed");
  });

  test("search finds the lookahead block", async ({ page }) => {
    await page.goto("/docs");
    await page.getByTestId("docs-search").fill("lookahead");
    const results = page.getByTestId("docs-search-results").getByRole("link");
    await expect(results.first()).toBeVisible();
    const top = await results.evaluateAll((links) => links.slice(0, 3).map((a) => a.textContent));
    expect(top).toContain("ops.lookahead");
    await results.filter({ hasText: /^ops\.lookahead$/ }).click();
    await expect(page).toHaveURL(/\/docs\/ops\/lookahead$/);
    await expect(page.getByTestId("doc-article").locator("h1")).toHaveText("ops.lookahead");
  });

  test("a runnable example opens in the editor without running", async ({ page }) => {
    await page.goto("/docs/getting-started");
    await page.getByTestId("open-example").first().click();
    await expect(page.getByTestId("policy-editor")).toContainText("ops.roles.manual", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("scenario-picker")).toHaveValue("two-station");
    await expect(page.getByTestId("run-tab-metrics")).toHaveCount(0);
  });

  test("the application views show the notice too", async ({ page }) => {
    await openWorkbench(page);
    await expect(page.locator("footer")).toContainText(NOTICE);
    await page.getByTestId("view-batch").click();
    await expect(page.locator("footer")).toContainText(NOTICE);
  });
});

test.describe("documentation panel", () => {
  test("a scenario's failure-mode link opens beside the editor and keeps the edit", async ({
    page,
  }) => {
    await openWorkbench(page);
    await setEditorText(page, "policy-editor", "-- still here\nreturn {}\n");
    await page.getByTestId("scenario-docs").click();
    const panel = page.getByTestId("docs-panel");
    await expect(panel.locator("h1")).toHaveText("Half capacity");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("policy-editor")).toContainText("-- still here");

    await panel.getByRole("link", { name: "unmet demand", exact: true }).click();
    await expect(panel.locator("h1")).toHaveText("Metrics");
    await expect(panel.locator("#unmet-demand")).toBeInViewport();
    await panel.getByTestId("docs-back").click();
    await expect(panel.locator("h1")).toHaveText("Half capacity");

    await panel.getByTestId("open-example").click();
    await expect(page.getByTestId("policy-editor")).toContainText("ops.drain");
    await panel.getByTestId("docs-close").click();
    await expect(page.getByTestId("docs-panel")).toHaveCount(0);
  });

  test("a block name in a decision trace opens that block's page", async ({ page }) => {
    await openWorkbench(page);
    await setEditorText(
      page,
      "policy-editor",
      'return ops.policy {\n  classify = ops.roles.manual { Mine = "supply", Dome = "demand" },\n  target = { supply = ops.drain {}, demand = ops.min_max { min = 20000, max = 30000 } },\n}\n',
    );
    await run(page);
    const trace = page.getByTestId("stop-traces").getByTestId("trace-block").first();
    await expect(trace).toBeVisible();
    const block = await trace.textContent();
    await trace.click();
    await expect(page.getByTestId("docs-panel").locator("h1")).toHaveText(`ops.${block}`);
  });

  test("hover help links into the panel", async ({ page }) => {
    await openWorkbench(page);
    await setEditorText(
      page,
      "policy-editor",
      "return ops.policy { target = ops.balance {}, plan = ops.lookahead {} }\n",
    );
    // Identifiers share text nodes, so hover the word itself rather than its element.
    const word = await page
      .getByTestId("policy-editor")
      .locator(".cm-content")
      .evaluate((root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const at = node.textContent?.indexOf("lookahead") ?? -1;
          if (at < 0) continue;
          const range = document.createRange();
          range.setStart(node, at + 2);
          range.setEnd(node, at + 3);
          const rect = range.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }
        throw new Error("lookahead is not in the editor");
      });
    await page.mouse.move(word.x, word.y);
    const tooltip = page.locator(".api-hover");
    await expect(tooltip).toContainText("ops.lookahead");
    await tooltip.getByRole("link", { name: "Documentation" }).click();
    await expect(page.getByTestId("docs-panel").locator("h1")).toHaveText("ops.lookahead");
  });
});
