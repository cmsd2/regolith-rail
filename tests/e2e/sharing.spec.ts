import { deflateRawSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";
import relay from "../../packages/engine/src/testing/format1/relay.json" with { type: "json" };
import {
  chooseForSlot,
  expectSlot,
  libraryRow,
  openItem,
  openWorkbench,
  setEditorText,
  showItem,
} from "./helpers.ts";

const POLICY = "-- shared policy\nreturn ops.policy { target = ops.balance {} }\n";

/** Makes a share fragment the way the application does, for crafted links. */
function fragment(state: unknown): string {
  return `#v1.${deflateRawSync(Buffer.from(JSON.stringify(state))).toString("base64url")}`;
}

const sharedState = {
  apiVersion: 2,
  appVersion: "test",
  view: "run",
  policy: { name: "shared.lua", source: POLICY },
  // The first release's starter document, unedited, so the link names the starter.
  scenario: { starterId: "relay", text: `${JSON.stringify(relay, null, 2)}\n` },
  seed: 7,
  saveReloadTest: false,
};

async function editorText(page: Page, testId: string) {
  return page.getByTestId(testId).locator(".cm-content").innerText();
}

async function makeLink(page: Page) {
  await page.getByTestId("share").click();
  return page.getByTestId("share-link").inputValue();
}

test.describe("sharing", () => {
  test("a comparison link opens with the same work in another browser", async ({
    page,
    browser,
  }) => {
    await openWorkbench(page);
    await setEditorText(page, "policy-editor", POLICY);
    await openItem(page, "builtin:scenario:mixed-line");
    await page.getByTestId("view-batch").click();
    await page.getByTestId("batch-compare").check();
    await chooseForSlot(page, "compare", "builtin:policy:supply-to-demand");
    await page.getByTestId("batch-seeds").fill("25");
    const link = await makeLink(page);
    expect(link).toMatch(/#v1\.[A-Za-z0-9_-]+$/);

    const other = await browser.newContext();
    const opened = await other.newPage();
    await openWorkbench(opened, link.replace(/^https?:\/\/[^/]+\//, "/"));
    await expect(opened.getByTestId("notice-share-loaded")).toBeVisible();
    await expect(opened.getByTestId("batch-config")).toBeVisible();
    await expect(opened.getByTestId("batch-compare")).toBeChecked();
    await expect(opened.getByTestId("batch-seeds")).toHaveValue("25");
    await expect(opened.getByTestId("batch-config")).toContainText("supply-to-demand");
    await expectSlot(opened, "scenario", "builtin:scenario:mixed-line");
    expect(await editorText(opened, "policy-editor")).toContain("-- shared policy");
    await expect(opened).toHaveURL(/\/$/);
    await other.close();
  });

  test("opening a link runs nothing until Run is pressed", async ({ page }) => {
    await openWorkbench(page, `/${fragment(sharedState)}`);
    await expect(page.getByTestId("notice-share-loaded")).toBeVisible();
    await expectSlot(page, "scenario", "builtin:scenario:relay");
    await expect(page.getByTestId("run")).toBeEnabled();
    expect(await editorText(page, "policy-editor")).toContain("-- shared policy");
    await expect(page.getByTestId("seed")).toHaveValue("7");
    await expect(page.locator('canvas[data-testid="line-map"]')).toHaveAttribute(
      "data-replaying",
      "false",
    );
    await expect(page.getByTestId("run-tab-metrics")).toHaveCount(0);
  });

  test("a damaged link shows an error and opens the default view", async ({ page }) => {
    const hash = fragment(sharedState);
    await openWorkbench(page, `/${hash.slice(0, hash.length - 20)}`);
    await expect(page.getByTestId("notice-share-damaged")).toContainText("damaged");
    await expectSlot(page, "scenario", "builtin:scenario:two-station");
    expect(await editorText(page, "policy-editor")).toContain("on_stop");
  });

  test("a link from another Policy API version opens with a warning", async ({ page }) => {
    await openWorkbench(page, `/${fragment({ ...sharedState, apiVersion: 99 })}`);
    await expect(page.getByTestId("notice-share-version")).toContainText("version 99");
    expect(await editorText(page, "policy-editor")).toContain("-- shared policy");
  });

  test("warns when a link is long enough to be cut off", async ({ page }) => {
    await openWorkbench(page);
    // Random-looking text compresses poorly, so the link stays long.
    let x = 12345;
    const noise = Array.from({ length: 900 }, () => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return `-- ${x.toString(36)}${(x * 7).toString(36)}`;
    }).join("\n");
    await setEditorText(page, "policy-editor", `${noise}\nreturn {}\n`);
    const link = await makeLink(page);
    expect(link.length).toBeGreaterThan(8000);
    await expect(page.getByTestId("share-length-warning")).toContainText("characters long");
  });
});

test.describe("local saving", () => {
  test("restores an unsaved edit as a draft", async ({ page, context }) => {
    await openWorkbench(page);
    await setEditorText(page, "policy-editor", "-- my draft\nreturn {}\n");
    await expect(page.getByTestId("saving-status")).toHaveText("Saved");
    await page.close();

    const reopened = await context.newPage();
    await openWorkbench(reopened);
    expect(await editorText(reopened, "policy-editor")).toContain("-- my draft");
  });

  test("renames, reopens and deletes a Mine policy", async ({ page }) => {
    await openWorkbench(page);
    await setEditorText(page, "policy-editor", "-- keep me\nreturn {}\n");
    // Editing the built-in baseline made a copy of it under Mine.
    await expectSlot(page, "policy", /^mine:policy:/);
    const id = (await page.getByTestId("slot-policy").getAttribute("data-item-id")) as string;
    await expect(await showItem(page, id)).toContainText("balance-stock (copy)");

    await libraryRow(page, id).click();
    await page.getByTestId("item-rename").click();
    await page.getByTestId("item-rename-input").fill("keeper");
    await page.getByTestId("item-rename-input").press("Enter");
    await expect(libraryRow(page, id)).toContainText("keeper");
    await expect(page.getByTestId("tab-policy")).toContainText("keeper");
    await expect(page.getByTestId("saving-status")).toHaveText("Saved");

    await page.reload();
    await expect(page.getByTestId("policy-editor").locator(".cm-content")).toBeVisible();
    expect(await editorText(page, "policy-editor")).toContain("-- keep me");
    await expect(page.getByTestId("slot-policy-name")).toHaveText("keeper");
    await (await showItem(page, id)).click();
    await page.getByTestId("item-delete").click();
    await page.getByTestId("item-delete-confirm").click();
    await expect(libraryRow(page, id)).toHaveCount(0);
    // The policy in use stays in the editor as an unsaved copy.
    expect(await editorText(page, "policy-editor")).toContain("-- keep me");
    await expect(page.getByTestId("slot-policy")).toContainText("Unsaved copy");
  });

  test("keeps working with a notice when storage is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    });
    await openWorkbench(page);
    await expect(page.getByTestId("notice-storage-unavailable")).toContainText("won't be kept");
    await expect(page.getByTestId("saving-status")).toHaveCount(0);
    await page.getByTestId("run").click();
    await expect(page.locator('canvas[data-testid="line-map"]')).toBeVisible({ timeout: 90_000 });
    expect(await makeLink(page)).toMatch(/#v1\./);
  });
});
