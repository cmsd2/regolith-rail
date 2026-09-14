import { expect, test } from "@playwright/test";
import { docPaths } from "../../packages/docs/src/content.ts";
import { MOVED_PAGES } from "../../packages/docs/src/moved.ts";
import { expectSlot, hoverText, openItem, openWorkbench, run, setEditorText } from "./helpers.ts";

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
    // Redirects left by moved pages send the browser on at once, so only real pages are visited.
    const moved = new Set(Object.keys(MOVED_PAGES).map((slug) => `/docs/${slug}`));
    for (const path of docPaths().filter((p) => !moved.has(p))) {
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
    await expectSlot(page, "scenario", "builtin:scenario:two-station");
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
  test("the header's Docs link opens a column beside the run, which stays in view", async ({
    page,
  }) => {
    await openWorkbench(page);
    await page.getByTestId("nav-docs").click();
    const panel = page.getByTestId("docs-panel");
    await expect(panel.locator("h1")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("line-map")).toBeInViewport();
    await expect(page.getByTestId("policy-editor")).toBeInViewport();

    const map = await page.getByTestId("line-map").boundingBox();
    const docs = await panel.boundingBox();
    expect(docs && map && docs.x >= map.x + map.width).toBe(true);

    await panel.getByTestId("docs-close").click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId("line-map")).toBeInViewport();
  });

  test("a scenario's failure-mode link opens beside the editor and keeps the edit", async ({
    page,
  }) => {
    await openWorkbench(page);
    await setEditorText(page, "policy-editor", "-- still here\nreturn {}\n");
    await page.getByTestId("scenario-docs").click();
    const panel = page.getByTestId("docs-panel");
    await expect(panel.locator("h1")).toHaveText("Modelling operations");
    await expect(panel.locator("#case-study-half-capacity")).toBeInViewport();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("policy-editor")).toContainText("-- still here");

    await panel.getByRole("link", { name: "empty distance", exact: true }).click();
    await expect(panel.locator("h1")).toHaveText("Metrics");
    await expect(panel.locator("#empty-distance-share")).toBeInViewport();
    await panel.getByTestId("docs-back").click();
    await expect(panel.locator("h1")).toHaveText("Modelling operations");

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
      "return ops.policy {\n  target = ops.balance {},\n  plan = ops.lookahead {},\n}\n",
    );
    const tooltip = page.locator(".api-hover");
    await hoverText(page, "policy-editor", "lookahead", tooltip);
    await expect(tooltip).toContainText("ops.lookahead");
    await tooltip.getByRole("link", { name: "Documentation" }).click();
    await expect(page.getByTestId("docs-panel").locator("h1")).toHaveText("ops.lookahead");
  });
});

test.describe("the book", () => {
  test("lists its parts, with those not yet written marked as coming later", async ({ page }) => {
    await page.goto("/docs/book");
    const contents = page.getByTestId("book-contents");
    await expect(contents).toBeVisible();
    for (const part of [3, 4, 5]) {
      await expect(page.getByTestId(`book-part-${part}`).locator("h2")).toContainText(
        "coming later",
      );
      await expect(page.getByTestId(`book-part-${part}`).getByRole("link")).toHaveCount(0);
    }
    await expect(page.getByRole("navigation", { name: "Documentation" })).toContainText("Contents");
  });

  test("moves from one chapter to the next and back", async ({ page }) => {
    await page.goto("/docs/book/order-quantities");
    await expect(page.getByTestId("doc-article")).toContainText("Part II: Inventory · Chapter 4");
    await page.getByTestId("chapter-next").click();
    await expect(page).toHaveURL(/\/docs\/book\/newsvendor$/);
    await expect(page.getByTestId("doc-article")).toContainText("Chapter 5");
    await page.getByTestId("chapter-previous").click();
    await expect(page).toHaveURL(/\/docs\/book\/order-quantities$/);
  });

  test("a chapter shows its checks' working in the page before scripts load", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/docs/book/newsvendor");
    const article = page.getByTestId("doc-article");
    await expect(article).toContainText("Part II: Inventory · Chapter 5");
    const check = article.locator('[data-check="maxima:best-order"]').first();
    await expect(check).toHaveAttribute("data-kind", "maxima");
    expect(await check.innerHTML()).toContain('expect_equal("best-order", best, 15);');
    await expect(article.getByTestId("game-note")).toBeVisible();
    await context.close();
  });

  test("an old failure-mode page sends readers to its case study", async ({ page }) => {
    await page.goto("/docs/failure-modes/half-capacity");
    await expect(page).toHaveURL(/\/docs\/book\/modelling#case-study-half-capacity$/);
    await expect(page.getByTestId("doc-article").locator("h1")).toHaveText("Modelling operations");
  });

  test("double dispatch's old page sends readers to its case study, in a page or the panel", async ({
    page,
  }) => {
    await page.goto("/docs/failure-modes/double-dispatch");
    await expect(page).toHaveURL(/\/docs\/book\/base-stock#case-study-double-dispatch$/);
    await expect(page.getByTestId("doc-article").locator("h1")).toHaveText(
      "Reviews, lead times and base-stock",
    );

    await openWorkbench(page);
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "/docs/failure-modes/double-dispatch";
      link.dataset.docs = "failure-modes/double-dispatch";
      link.textContent = "old link";
      document.body.append(link);
      link.click();
    });
    const panel = page.getByTestId("docs-panel");
    await expect(panel.locator("h1")).toHaveText("Reviews, lead times and base-stock");
    await expect(panel.locator("#case-study-double-dispatch")).toBeInViewport();

    await openItem(page, "builtin:scenario:two-trains");
    await page.getByTestId("scenario-docs").click();
    await expect(panel.locator("#case-study-double-dispatch")).toBeInViewport();
  });

  test("the old newsvendor page sends readers to its chapter", async ({ page }) => {
    await page.goto("/docs/classic/newsvendor");
    await expect(page).toHaveURL(/\/docs\/book\/newsvendor$/);
    await expect(page.getByTestId("doc-article").locator("h1")).toHaveText(
      "One period under uncertainty: the newsvendor",
    );
  });

  test("a classic template's About this problem link opens its chapter beside the editor", async ({
    page,
  }) => {
    await openWorkbench(page);
    await openItem(page, "classic:scenario:classic.reorder");
    await page.getByTestId("scenario-docs").click();
    await expect(page.getByTestId("docs-panel").locator("h1")).toHaveText(
      "Order quantities: EOQ and (s, S)",
    );
  });

  test("a scenario named in a chapter's text opens in the workbench when clicked", async ({
    page,
  }) => {
    await page.goto("/docs/book/modelling");
    const link = page.getByTestId("scenario-link").first();
    await expect(link).toHaveAttribute("data-item-id", "builtin:scenario:two-station");
    await expect(
      page.getByTestId("doc-article").locator("h2 [data-testid='scenario-link']"),
    ).toHaveCount(0);
    await link.click();
    await expect(page.getByTestId("policy-editor").locator(".cm-content")).toBeVisible({
      timeout: 30_000,
    });
    await expectSlot(page, "scenario", "builtin:scenario:two-station");
    await expectSlot(page, "policy", "builtin:policy:balance-stock");

    await openItem(page, "builtin:scenario:relay");
    await page.getByTestId("nav-docs").click();
    const panel = page.getByTestId("docs-panel");
    await panel.getByTestId("docs-search").fill("order quantities");
    await panel.getByTestId("docs-search-results").getByRole("link").first().click();
    await panel
      .locator('[data-testid="scenario-link"][data-item-id="classic:scenario:classic.reorder"]')
      .first()
      .click();
    await expectSlot(page, "scenario", "classic:scenario:classic.reorder");
    await expectSlot(page, "policy", "classic:policy:classic.reorder");
  });

  test("a built-in policy named in a chapter puts that policy in the run", async ({ page }) => {
    await openWorkbench(page);
    await page.getByTestId("scenario-docs").click();
    const panel = page.getByTestId("docs-panel");
    await expect(panel.locator("h1")).toHaveText("Modelling operations");
    await panel.getByTestId("open-example").first().click();
    await expectSlot(page, "policy", "example:policy:docs/book/modelling#1");
    const link = panel.locator('[data-testid="policy-link"]').first();
    await expect(link).toHaveAttribute("data-item-id", "builtin:policy:balance-stock");
    await link.click();
    await expectSlot(page, "policy", "builtin:policy:balance-stock");
    await expectSlot(page, "scenario", "builtin:scenario:two-station");
  });

  test("a chapter opens its scenario in the workbench with the reference policy", async ({
    page,
  }) => {
    await page.goto("/docs/book/newsvendor");
    await page.getByTestId("open-scenario").click();
    await expect(page.getByTestId("policy-editor").locator(".cm-content")).toBeVisible({
      timeout: 30_000,
    });
    await expectSlot(page, "scenario", "classic:scenario:classic.newsvendor");
    await expectSlot(page, "policy", "classic:policy:classic.newsvendor");
  });
});
