import { expect, type Page, test } from "@playwright/test";
import { libraryRow, openWorkbench, showItem } from "./helpers.ts";

const editorWidth = async (page: Page) =>
  (await page.getByTestId("policy-editor").boundingBox())?.width ?? 0;

test.describe("workbench layout", () => {
  test("keeps the library collapsed across a reload, with the editor widened", async ({ page }) => {
    await openWorkbench(page);
    await expect(page.getByTestId("library-explorer")).toBeVisible();
    const before = await editorWidth(page);

    await page.getByTestId("library-toggle").click();
    await expect(page.getByTestId("library-explorer")).toHaveCount(0);
    await expect(page.getByTestId("library-expand")).toBeVisible();

    await page.reload();
    await openWorkbench(page);
    await expect(page.getByTestId("library-expand")).toBeVisible();
    await expect(page.getByTestId("library-explorer")).toHaveCount(0);
    expect(await editorWidth(page)).toBeGreaterThan(before);

    await page.getByTestId("library-expand").click();
    await expect(page.getByTestId("library-explorer")).toBeVisible();
    expect(await editorWidth(page)).toBeCloseTo(before, 0);
  });

  test("resizes the library by keyboard and drag, and remembers the width", async ({ page }) => {
    await openWorkbench(page);
    const resizer = page.getByTestId("library-resizer");
    const initial = Number(await resizer.getAttribute("aria-valuenow"));

    await resizer.focus();
    await page.keyboard.press("ArrowRight");
    await expect(resizer).toHaveAttribute("aria-valuenow", String(initial + 16));
    await page.keyboard.press("Home");
    await expect(resizer).toHaveAttribute("aria-valuenow", "220");

    const box = await resizer.boundingBox();
    if (!box) throw new Error("the resizer has no box");
    await page.mouse.move(box.x + box.width / 2, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + 100, { steps: 4 });
    await page.mouse.up();
    await expect(resizer).toHaveAttribute("aria-valuenow", "280");
    const explorer = await page.getByTestId("library-explorer").boundingBox();

    await page.reload();
    await openWorkbench(page);
    await expect(page.getByTestId("library-resizer")).toHaveAttribute("aria-valuenow", "280");
    expect((await page.getByTestId("library-explorer").boundingBox())?.width).toBeCloseTo(
      explorer?.width ?? 0,
      0,
    );
  });

  test.describe("on a narrow screen", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("opens the library as a drawer that closes when an item is used", async ({ page }) => {
      await openWorkbench(page);
      await expect(page.getByTestId("library-explorer")).toHaveCount(0);

      await page.getByTestId("library-toggle").click();
      const drawer = page.getByTestId("library-drawer");
      await expect(drawer).toBeVisible();
      await showItem(page, "builtin:scenario:relay");
      await libraryRow(page, "builtin:scenario:relay").dblclick();
      await expect(drawer).toHaveCount(0);

      await page.getByTestId("library-toggle").click();
      await expect(page.getByTestId("slot-scenario")).toHaveAttribute(
        "data-item-id",
        "builtin:scenario:relay",
      );
      await page.getByTestId("library-drawer-close").click();
      await expect(drawer).toHaveCount(0);
    });
  });
});
