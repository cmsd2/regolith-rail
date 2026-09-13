import { expect, type Page } from "@playwright/test";

/** Opens the workbench and waits until the editors are ready. */
export async function openWorkbench(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByTestId("policy-editor").locator(".cm-content")).toBeVisible();
}

/** Replaces the contents of a CodeMirror editor. */
export async function setEditorText(page: Page, testId: string, text: string) {
  const content = page.getByTestId(testId).locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(text);
}

/** Presses Run and waits for the run to finish. */
export async function run(page: Page) {
  await page.getByTestId("run").click();
  await expect(page.getByTestId("run")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('canvas[data-testid="line-map"]')).toBeVisible();
}
