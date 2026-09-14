import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Opens the workbench and waits until the editors are ready. The first load in a browser also compiles
 * the editors and opens storage, which can take several seconds while many tests start at once.
 */
export async function openWorkbench(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByTestId("policy-editor").locator(".cm-content")).toBeVisible({
    timeout: 30_000,
  });
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

/** A library item's row in the explorer. */
export const libraryRow = (page: Page, id: string) =>
  page.getByTestId("library-tree").locator(`[data-item-id="${id}"]`);

/**
 * Shows a library item's row: switches to the list for its kind, and opens collapsed groups until the
 * row appears.
 */
export async function showItem(page: Page, id: string) {
  const row = libraryRow(page, id);
  const kind = id.startsWith("experiment:") ? "experiment" : id.split(":")[1];
  if ((await row.count()) === 0) await page.getByTestId(`library-tab-${kind}`).click();
  const collapsed = page.locator('[data-testid^="library-group-"][aria-expanded="false"]');
  for (let i = 0; (await row.count()) === 0 && i < 10 && (await collapsed.count()) > 0; i++) {
    await collapsed.first().click();
  }
  await expect(row.first()).toBeVisible();
  return row.first();
}

/** Uses a library item: scenarios and policies fill their slot, and saved runs fill every slot. */
export async function openItem(page: Page, id: string) {
  await (await showItem(page, id)).dblclick();
}

/** Waits until a slot holds an item. */
export async function expectSlot(page: Page, slot: string, id: string | RegExp) {
  await expect(page.getByTestId(`slot-${slot}`)).toHaveAttribute("data-item-id", id);
}

/** Chooses a library item for a slot, such as a policy for the Compare slot. */
export async function chooseForSlot(page: Page, slot: string, id: string) {
  await page.getByTestId(`slot-choose-${slot}`).click();
  await openItem(page, id);
  await expectSlot(page, slot, id);
}

/** Opens the Scenario slot's template parameters, when they are folded away. */
export async function showParameters(page: Page) {
  const details = page.getByTestId("template-params-toggle").locator("..");
  if ((await details.getAttribute("open")) === null) {
    await page.getByTestId("template-params-toggle").click();
  }
}

/** Uses a classic template with its reference policy and waits until it is ready to run. */
export async function openTemplate(page: Page, name: string) {
  await openItem(page, `classic:scenario:${name}`);
  await page.getByTestId("slot-reference").click();
  await expectSlot(page, "policy", new RegExp(`^classic:policy:${name.replace(".", "\\.")}`));
  await expect(page.getByTestId("run")).toBeEnabled({ timeout: 30_000 });
  await showParameters(page);
}

/** Presses Run and waits for the run to finish. */
export async function run(page: Page) {
  await page.getByTestId("run").click();
  await expect(page.getByTestId("run")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('canvas[data-testid="line-map"][data-replaying="true"]')).toBeVisible({
    timeout: 90_000,
  });
}
