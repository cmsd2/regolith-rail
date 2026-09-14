import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import {
  chooseForSlot,
  expectSlot,
  libraryRow,
  openItem,
  openWorkbench,
  run,
  setEditorText,
  showItem,
} from "./helpers.ts";

const editorText = (page: Page, testId: string) =>
  page.getByTestId(testId).locator(".cm-content").innerText();

/** Rows in the explorer's current list whose ids start with a prefix, optionally with some text. */
const rows = (page: Page, prefix: string, hasText?: string) =>
  page
    .getByTestId("library-tree")
    .locator(`[data-item-id^="${prefix}"]`, hasText === undefined ? {} : { hasText });

test.describe("library explorer", () => {
  test("lists the built-in scenarios and policies in their own lists", async ({ page }) => {
    await openWorkbench(page);
    await expect(page.getByTestId("library-tree")).toHaveAttribute("role", "tree");
    for (const id of ["two-station", "relay", "two-trains", "mixed-line", "storm-shock"]) {
      await expect(libraryRow(page, `builtin:scenario:${id}`)).toBeVisible();
    }
    await expect(libraryRow(page, "classic:scenario:classic.newsvendor")).toBeVisible();
    await expect(libraryRow(page, "builtin:policy:naive")).toHaveCount(0);

    await page.getByTestId("library-tab-policy").click();
    await expect(libraryRow(page, "builtin:policy:naive")).toBeVisible();
    await expect(libraryRow(page, "builtin:policy:supply-to-demand")).toBeVisible();
    await expect(libraryRow(page, "builtin:policy:naive")).toHaveAttribute("aria-current", "true");
  });

  test("selects an item with one click without changing the run", async ({ page }) => {
    await openWorkbench(page);
    const row = await showItem(page, "builtin:policy:supply-to-demand");
    await row.click();
    await expect(page.getByTestId("item-description")).toContainText("ops blocks");
    await expectSlot(page, "policy", "builtin:policy:naive");
    expect(await editorText(page, "policy-editor")).toContain("Naive baseline");

    await page.getByTestId("item-use").click();
    await expectSlot(page, "policy", "builtin:policy:supply-to-demand");
  });

  test("moves through a list with the keyboard and uses an item with Enter", async ({ page }) => {
    await openWorkbench(page);
    await libraryRow(page, "builtin:scenario:two-station").focus();
    await page.keyboard.press("ArrowDown");
    await expect(libraryRow(page, "builtin:scenario:relay")).toBeFocused();
    await expectSlot(page, "scenario", "builtin:scenario:two-station");
    await page.keyboard.press("Enter");
    await expectSlot(page, "scenario", "builtin:scenario:relay");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(libraryRow(page, "builtin:scenario:relay")).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await expect(libraryRow(page, "builtin:scenario:relay")).toBeVisible();
  });

  test("runs a built-in policy used from the library", async ({ page }) => {
    await openWorkbench(page);
    await openItem(page, "builtin:policy:supply-to-demand");
    await expectSlot(page, "policy", "builtin:policy:supply-to-demand");
    await expect(page.getByTestId("tab-policy")).toContainText("supply-to-demand");
    expect(await editorText(page, "policy-editor")).toContain("Supply to demand");
    await run(page);
    await expect(page.getByTestId("stop-inspector")).toContainText("Stop");
  });

  test("chooses a comparison policy from its slot or the batch form, and cancels", async ({
    page,
  }) => {
    await openWorkbench(page);
    await page.getByTestId("view-batch").click();
    await page.getByTestId("batch-compare").check();
    await page.getByTestId("slot-choose-compare").click();
    await expect(page.getByTestId("choosing")).toBeVisible();
    await expect(page.getByTestId("library-tree")).toHaveAttribute("data-list", "policy");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("choosing")).toHaveCount(0);

    await chooseForSlot(page, "compare", "builtin:policy:naive");
    await expectSlot(page, "policy", "builtin:policy:naive");
    await expect(page.getByTestId("batch-policy-b")).toContainText("naive");

    await page.getByTestId("batch-choose-policy-b").click();
    await expect(page.getByTestId("choosing")).toContainText("Compare slot");
    await openItem(page, "builtin:policy:supply-to-demand");
    await expectSlot(page, "compare", "builtin:policy:supply-to-demand");
    await expect(page.getByTestId("batch-policy-b")).toContainText("supply-to-demand");
  });

  test("teaches a starter against the baseline, and offers a classic reference policy", async ({
    page,
  }) => {
    await openWorkbench(page);
    await openItem(page, "builtin:scenario:storm-shock");
    await expect(page.getByTestId("scenario-docs")).toHaveText("Why the baseline fails");
    await page.getByTestId("slot-fix").click();
    await expectSlot(page, "policy", "example:policy:docs/failure-modes/disruption-recovery#1");
    await page.getByTestId("slot-baseline").click();
    await expectSlot(page, "policy", "builtin:policy:naive");
    await expect(page.getByTestId("run-tab-metrics")).toHaveCount(0);

    await page.getByTestId("tab-policy").click();
    await setEditorText(page, "policy-editor", "-- something else\nreturn {}\n");
    await page.getByTestId("slot-compare-fix").click();
    await expect(page.getByTestId("batch-config")).toBeVisible();
    await expect(page.getByTestId("batch-compare")).toBeChecked();
    await expectSlot(page, "policy", "example:policy:docs/failure-modes/disruption-recovery#1");
    await expectSlot(page, "compare", "builtin:policy:naive");
    await expect(page.getByTestId("batch-metrics")).toHaveCount(0);
    await page.getByTestId("view-run").click();

    await openItem(page, "classic:scenario:classic.reorder");
    await expect(page.getByTestId("slot-fix")).toHaveCount(0);
    await page.getByTestId("slot-reference").click();
    await expectSlot(page, "policy", "classic:policy:classic.reorder");
  });

  test("groups policies by fit to the scenario and marks those that cannot act", async ({
    page,
  }) => {
    await openWorkbench(page);
    await openItem(page, "builtin:scenario:storm-shock");
    await page.getByTestId("library-tab-policy").click();
    const forThis = page.getByTestId("library-group-group:policy:for-scenario");
    await expect(forThis).toBeVisible();
    const order = await page
      .getByTestId("library-tree")
      .locator('[role="treeitem"]')
      .evaluateAll((items) => items.map((i) => i.getAttribute("data-item-id") ?? i.textContent));
    expect(order.indexOf("example:policy:docs/failure-modes/disruption-recovery#1")).toBeLessThan(
      order.indexOf("builtin:policy:naive"),
    );

    await openItem(page, "classic:scenario:classic.reorder");
    await page.getByTestId("library-tab-policy").click();
    const naive = libraryRow(page, "builtin:policy:naive");
    await expect(naive).toHaveAttribute("data-unfit", "true", { timeout: 30_000 });
    await naive.click();
    await expect(page.getByTestId("item-unfit")).toContainText("no vehicles");
  });

  test("copies an edited built-in policy under Mine and keeps it after a reload", async ({
    page,
  }) => {
    await openWorkbench(page);
    await setEditorText(page, "policy-editor", "-- my baseline\nreturn {}\n");
    await expectSlot(page, "policy", /^mine:policy:/);
    await expect(page.getByTestId("slot-policy")).toContainText("copied from naive");
    await expect(page.getByTestId("saving-status")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByTestId("slot-policy-name")).toHaveText("naive (copy)");
    expect(await editorText(page, "policy-editor")).toContain("-- my baseline");
    await openItem(page, "builtin:policy:naive");
    expect(await editorText(page, "policy-editor")).not.toContain("-- my baseline");
  });

  test("duplicates, exports and deletes items", async ({ page }) => {
    await openWorkbench(page);
    await (await showItem(page, "builtin:policy:naive")).click();
    await page.getByTestId("item-duplicate").click();
    const copy = rows(page, "mine:policy:", "naive (copy)");
    await expect(copy).toHaveCount(1);

    await copy.click();
    const download = page.waitForEvent("download");
    await page.getByTestId("item-export").click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("naive (copy).lua");
    expect(await readFile(await file.path(), "utf8")).toContain("Naive baseline");

    await page.getByTestId("item-delete").click();
    await page.getByTestId("item-delete-confirm").click();
    await expect(copy).toHaveCount(0);
  });
});

test.describe("saved runs", () => {
  test("save a run, reopen it from Saved runs after changes, and update it", async ({ page }) => {
    await openWorkbench(page);
    await openItem(page, "builtin:scenario:storm-shock");
    // Using a scenario shows it in the editor, so go back to the policy.
    await page.getByTestId("tab-policy").click();
    await setEditorText(page, "policy-editor", "-- buffer\nreturn {}\n");
    await page.getByTestId("seed").fill("7");
    await page.getByTestId("save-experiment").click();
    await page.getByTestId("experiment-name").fill("Storm buffer");
    await page.getByTestId("experiment-save").click();

    await page.getByTestId("library-tab-experiment").click();
    const saved = rows(page, "mine:experiment:", "Storm buffer");
    await expect(saved).toHaveCount(1);
    await expect(saved).toContainText("Storm shock");
    await expect(rows(page, "builtin:")).toHaveCount(0);

    await openItem(page, "builtin:scenario:relay");
    await page.getByTestId("seed").fill("2");
    await page.getByTestId("library-tab-experiment").click();
    await saved.dblclick();
    await expectSlot(page, "scenario", "builtin:scenario:storm-shock");
    await expect(page.getByTestId("seed")).toHaveValue("7");
    expect(await editorText(page, "policy-editor")).toContain("-- buffer");
    await expect(page.getByTestId("run-tab-metrics")).toHaveCount(0);

    await page.getByTestId("seed").fill("9");
    await page.getByTestId("update-experiment").click();
    await openItem(page, "builtin:scenario:relay");
    await page.getByTestId("library-tab-experiment").click();
    await saved.dblclick();
    await expect(page.getByTestId("seed")).toHaveValue("9");
  });

  test("keep one shared run for a link opened twice", async ({ page, browser }) => {
    await openWorkbench(page);
    await setEditorText(page, "policy-editor", "-- shared twice\nreturn {}\n");
    await page.getByTestId("share").click();
    const link = (await page.getByTestId("share-link").inputValue()).replace(
      /^https?:\/\/[^/]+\//,
      "/",
    );

    const other = await browser.newContext();
    const first = await other.newPage();
    await openWorkbench(first, link);
    await expect(first.getByTestId("saving-status")).toHaveText("Saved");
    await first.close();
    const second = await other.newPage();
    await openWorkbench(second, link);
    await expect(second.getByTestId("notice-share-loaded")).toBeVisible();
    await second.getByTestId("library-tab-experiment").click();
    await expect(rows(second, "shared:experiment:")).toHaveCount(1);
    await other.close();
  });

  test("export a run and import it in another browser", async ({ page, browser }) => {
    await openWorkbench(page);
    await openItem(page, "builtin:scenario:relay");
    await page.getByTestId("seed").fill("4");
    await page.getByTestId("save-experiment").click();
    await page.getByTestId("experiment-name").fill("Relay run");
    await page.getByTestId("experiment-save").click();
    await page.getByTestId("library-tab-experiment").click();
    await rows(page, "mine:experiment:").click();
    const download = page.waitForEvent("download");
    await page.getByTestId("item-export").click();
    const path = await (await download).path();

    const other = await browser.newContext();
    const opened = await other.newPage();
    await openWorkbench(opened);
    await opened.getByTestId("import").click();
    const chooser = opened.waitForEvent("filechooser");
    await opened.getByTestId("import-experiment").click();
    await (await chooser).setFiles(path);
    await opened.getByTestId("library-tab-experiment").click();
    const imported = rows(opened, "mine:experiment:", "Relay run");
    await expect(imported).toHaveCount(1);
    await imported.dblclick();
    await expectSlot(opened, "scenario", "builtin:scenario:relay");
    await expect(opened.getByTestId("seed")).toHaveValue("4");
    await other.close();
  });
});

test.describe("import", () => {
  test("imports a policy file into Mine and rejects a binary file", async ({ page }) => {
    await openWorkbench(page);
    await page.getByTestId("import").click();
    let chooser = page.waitForEvent("filechooser");
    await page.getByTestId("import-policy").click();
    await (await chooser).setFiles({
      name: "buffer.lua",
      mimeType: "text/plain",
      buffer: Buffer.from("-- buffer\nreturn {}\n"),
    });
    await page.getByTestId("library-tab-policy").click();
    const row = rows(page, "mine:policy:", "buffer");
    await expect(row).toHaveCount(1);
    await row.dblclick();
    expect(await editorText(page, "policy-editor")).toContain("-- buffer");

    await page.getByTestId("import").click();
    chooser = page.waitForEvent("filechooser");
    await page.getByTestId("import-policy").click();
    await (await chooser).setFiles({
      name: "image.lua",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0xff, 0xfe, 0xfd]),
    });
    await expect(page.getByTestId("notice-import-rejected")).toContainText("not a text file");
  });
});

test.describe("documentation examples", () => {
  test("open without changing the player's own policy", async ({ page }) => {
    await openWorkbench(page);
    await setEditorText(page, "policy-editor", "-- mine\nreturn {}\n");
    await expectSlot(page, "policy", /^mine:policy:/);
    const mine = (await page.getByTestId("slot-policy").getAttribute("data-item-id")) as string;
    await expect(page.getByTestId("saving-status")).toHaveText("Saved");

    await page.goto("/docs/ops/min-max");
    await page.getByTestId("open-example").first().click();
    await expectSlot(page, "policy", "example:policy:docs/ops/min-max#1");
    await expectSlot(page, "scenario", "builtin:scenario:storm-shock");
    await openItem(page, mine);
    expect(await editorText(page, "policy-editor")).toContain("-- mine");
  });
});

test.describe("migration", () => {
  test("moves a policy saved by an earlier release into Mine", async ({ page }) => {
    // Any page of the site shares its storage; write the old records before the workbench loads.
    await page.goto("/docs/about");
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("regolith-rail-saved");
          request.onupgradeneeded = () => request.result.createObjectStore("items");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("items", "readwrite");
            tx.objectStore("items").put(
              { kind: "policy", name: "buffer", source: "-- from before\nreturn {}", savedAt: 1 },
              "policy:buffer",
            );
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        }),
    );
    await openWorkbench(page);
    await page.getByTestId("library-tab-policy").click();
    const row = rows(page, "mine:policy:", "buffer");
    await expect(row).toHaveCount(1);
    await row.dblclick();
    expect(await editorText(page, "policy-editor")).toContain("-- from before");
  });
});
