import { expect, type Locator, type Page } from "@playwright/test";

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

/**
 * Hovers over a target until a tooltip appears. A single hover can land while the editor is still
 * laying out or loading its help, and nothing moves the mouse again, so the hover is repeated.
 */
export async function hoverUntil(page: Page, hover: () => Promise<void>, tooltip: Locator) {
  await expect(async () => {
    await page.mouse.move(0, 0);
    await hover();
    await expect(tooltip).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/** Hovers over the first occurrence of some text in an editor until a tooltip appears. */
export async function hoverText(page: Page, testId: string, text: string, tooltip: Locator) {
  const content = page.getByTestId(testId).locator(".cm-content");
  await expect(content).toContainText(text);
  // Identifiers share text nodes with their neighbours, so hover a character inside the text.
  const pointAt = () =>
    content.evaluate((element, wanted) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent?.indexOf(wanted) ?? -1;
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(node, at + 1);
        range.setEnd(node, at + 2);
        const box = range.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      }
      throw new Error(`no text ${wanted} in the editor`);
    }, text);
  await hoverUntil(
    page,
    async () => {
      const point = await pointAt();
      await page.mouse.move(point.x, point.y);
    },
    tooltip,
  );
}

/** Presses Run and waits for the run to finish. */
export async function run(page: Page) {
  await page.getByTestId("run").click();
  await expect(page.getByTestId("run")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('canvas[data-testid="line-map"][data-replaying="true"]')).toBeVisible({
    timeout: 90_000,
  });
}
