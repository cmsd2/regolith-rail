import { expect, test } from "@playwright/test";
import { openWorkbench, run, setEditorText } from "./helpers.ts";

test.describe("first visit", () => {
  test("shows two-station with the naive baseline, ready to run", async ({ page }) => {
    await openWorkbench(page);
    await expect(page.getByTestId("scenario-picker")).toHaveValue("two-station");
    await expect(page.getByTestId("policy-editor")).toContainText("Naive baseline");
    await expect(page.getByTestId("run")).toBeEnabled();
    await run(page);
    await expect(page.getByTestId("stop-inspector")).toContainText("Stop");
  });
});

test.describe("policy editor", () => {
  test("marks a language violation while typing", async ({ page }) => {
    await openWorkbench(page);
    await setEditorText(
      page,
      "policy-editor",
      "return {\n  on_stop = function(ctx)\n    goto done\n    ::done::\n  end,\n}\n",
    );
    const error = page.getByTestId("policy-editor").locator(".cm-lintRange-error").first();
    await expect(error).toBeVisible({ timeout: 10_000 });
    await error.hover();
    await expect(page.locator(".cm-tooltip-lint")).toContainText(
      "goto and labels are not available",
    );
  });

  test("shows hover help for ops blocks with a documentation link", async ({ page }) => {
    await openWorkbench(page);
    await setEditorText(
      page,
      "policy-editor",
      "return ops.policy { target = ops.min_max { min = 5000, max = 25000 } }\n",
    );
    await page
      .getByTestId("policy-editor")
      .locator(".cm-line", { hasText: "min_max" })
      .getByText("min_max")
      .hover();
    const tooltip = page.locator(".api-hover");
    await expect(tooltip).toContainText("ops.min_max");
    await expect(tooltip).toContainText("min");
    await expect(tooltip.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      /docs\/ops\/min-max$/,
    );
  });
});

test.describe("scenario editor", () => {
  test("shows validation errors and disables Run until they are fixed", async ({ page }) => {
    await openWorkbench(page);
    await page.getByTestId("tab-scenario").click();
    await page.getByTestId("scenario-kind-json").click();
    await setEditorText(page, "scenario-editor", '{ "format": 1, "id": "broken" }');
    await expect(page.getByTestId("scenario-errors")).toContainText("title");
    await expect(page.getByTestId("run")).toBeDisabled();
    await expect(
      page.getByTestId("scenario-editor").locator(".cm-lintRange-error").first(),
    ).toBeVisible();
    await page.getByTestId("scenario-picker").selectOption("relay");
    await expect(page.getByTestId("run")).toBeEnabled();
  });
});

test.describe("runs", () => {
  test("can be cancelled, keeping the previous result and a responsive interface", async ({
    page,
  }) => {
    await openWorkbench(page);
    await run(page);
    await setEditorText(
      page,
      "policy-editor",
      "return { on_stop = function(ctx) for i = 1, 150000 do end end }\n",
    );
    await page.getByTestId("scenario-picker").selectOption("mixed-line");
    await page.getByTestId("run").click();
    await expect(page.getByTestId("cancel")).toBeVisible();
    await page.getByTestId("run-tab-metrics").click();
    await expect(page.getByTestId("metrics")).toBeVisible();
    await page.getByTestId("cancel").click();
    await expect(page.getByTestId("run")).toBeVisible();
    await expect(page.locator('canvas[data-testid="line-map"]')).toBeVisible();
    await expect(page.getByTestId("metrics")).toBeVisible();
  });
});

test.describe("run views", () => {
  test("plays back without re-rendering the map component", async ({ page }) => {
    await openWorkbench(page);
    await run(page);
    const map = page.locator('canvas[data-testid="line-map"]');
    const before = await map.getAttribute("data-render-count");
    const timeBefore = await page.getByTestId("playhead-time").textContent();
    await page.getByTestId("play").click();
    await page.waitForTimeout(1500);
    await page.getByTestId("play").click();
    expect(await page.getByTestId("playhead-time").textContent()).not.toBe(timeBefore);
    expect(await map.getAttribute("data-render-count")).toBe(before);
  });

  test("charts series the policy records", async ({ page }) => {
    await openWorkbench(page);
    await setEditorText(
      page,
      "policy-editor",
      'return { on_stop = function(ctx) ctx.record("target", 12000) end }\n',
    );
    await run(page);
    await page.getByTestId("run-tab-charts").click();
    await expect(page.getByTestId("chart-record-target")).toBeVisible();
  });

  test("moves through time without running again", async ({ page }) => {
    await openWorkbench(page);
    await run(page);
    const time = page.getByTestId("playhead-time");
    await expect(time).toHaveText("Sol 1, 00:00");
    await page.getByTestId("scrubber").focus();
    await page.keyboard.press("End");
    await expect(time).not.toHaveText("Sol 1, 00:00");
    await expect(page.getByTestId("cancel")).toHaveCount(0);
  });

  test("shows requested and applied amounts for a clamped action", async ({ page }) => {
    await openWorkbench(page);
    await run(page);
    await page.getByTestId("warning-marker").first().click();
    await expect(page.getByTestId("clamped").first()).toContainText("requested");
  });

  test("takes an error to its stop and its line in the editor", async ({ page }) => {
    await openWorkbench(page);
    await setEditorText(
      page,
      "policy-editor",
      "return {\n  on_stop = function(ctx)\n    local x = nil\n    return x.field\n  end,\n}\n",
    );
    await run(page);
    await page.getByTestId("run-tab-errors").click();
    await page.getByTestId("error-list").getByRole("button").first().click();
    await expect(page.getByTestId("stop-inspector")).toContainText("Line 4");
    await expect(page.getByTestId("policy-editor").locator(".cm-activeLine")).toContainText(
      "return x.field",
    );
  });
});

test.describe("browser support", () => {
  test("explains when WebAssembly is missing", async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(globalThis, "WebAssembly");
    });
    await page.goto("/");
    await expect(page.getByTestId("unsupported-browser")).toContainText("WebAssembly");
  });
});
