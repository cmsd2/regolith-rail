import { deflateRawSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";
import relay from "../../packages/engine/src/testing/format1/relay.json" with { type: "json" };
import { openWorkbench, run, setEditorText } from "./helpers.ts";

const editorText = (page: Page, testId: string) =>
  page.getByTestId(testId).locator(".cm-content").innerText();

/** Moves the mouse over the first occurrence of some text in an editor. */
async function hoverText(page: Page, testId: string, text: string) {
  const content = page.getByTestId(testId).locator(".cm-content");
  await expect(content).toContainText(text);
  const point = await content.evaluate((element, wanted) => {
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
    return null;
  }, text);
  if (!point) throw new Error(`no text ${text}`);
  await page.mouse.move(point.x, point.y);
}

async function pickTemplate(page: Page, name: string) {
  await page.getByTestId("scenario-picker").selectOption(name);
  await expect(page.getByTestId("run")).toBeEnabled({ timeout: 30_000 });
}

test.describe("scenario scripts", () => {
  test("show hover help for a construct with a documentation link", async ({ page }) => {
    await openWorkbench(page);
    await page.getByTestId("tab-scenario").click();
    await hoverText(page, "scenario-editor", "small_station");
    const tooltip = page.locator(".construct-hover");
    await expect(tooltip).toContainText("mars.small_station");
    await expect(tooltip).toContainText("stock");
    await expect(tooltip.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      /docs\/scenarios\/mars#mars-small_station$/,
    );
  });

  test("show the evaluated document read-only", async ({ page }) => {
    await openWorkbench(page);
    await page.getByTestId("tab-scenario").click();
    await page.getByTestId("scenario-evaluated-toggle").check();
    const view = page.getByTestId("scenario-evaluated");
    await expect(view).toContainText('"format": 2');
    await expect(view).toContainText('"id": "two-station"');
    await expect(view.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
  });

  test("report script errors at their lines and disable Run until they are fixed", async ({
    page,
  }) => {
    await openWorkbench(page);
    await page.getByTestId("tab-scenario").click();
    await setEditorText(
      page,
      "scenario-editor",
      '-- broken\nreturn scenario { id = "x", colour = 1 }\n',
    );
    await expect(page.getByTestId("scenario-errors")).toContainText("Line 2");
    await expect(page.getByTestId("scenario-errors")).toContainText("no parameter named colour");
    await expect(page.getByTestId("run")).toBeDisabled();
    await page.getByTestId("scenario-picker").selectOption("relay");
    await expect(page.getByTestId("run")).toBeEnabled();
  });

  test("convert JSON to an equivalent script", async ({ page }) => {
    await openWorkbench(page);
    await page.getByTestId("tab-scenario").click();
    await page.getByTestId("scenario-kind-json").click();
    expect(await editorText(page, "scenario-editor")).toContain('"format": 2');
    await page.getByTestId("scenario-kind-script").click();
    expect(await editorText(page, "scenario-editor")).toContain("return scenario {");
    await expect(page.getByTestId("run")).toBeEnabled();
  });
});

test.describe("classic templates", () => {
  test("re-evaluate from their parameter form", async ({ page }) => {
    await openWorkbench(page);
    await pickTemplate(page, "classic.serial_chain");
    const map = page.getByTestId("line-map");
    await expect(map).toHaveAttribute("data-stations", "Stage1 Stage2 Stage3 Stage4");
    await page.getByTestId("template-param-stages").fill("3");
    await expect(map).toHaveAttribute("data-stations", "Stage1 Stage2 Stage3");
    await expect(map).toHaveAttribute("data-layout", "layers");
  });

  test("link to their documentation page", async ({ page }) => {
    await openWorkbench(page);
    await pickTemplate(page, "classic.serial_chain");
    await expect(page.getByTestId("scenario-docs")).toHaveAttribute(
      "href",
      /docs\/classic\/serial-chain$/,
    );
  });

  test("say a template with reviews is not mod-ready, and a Mars line is", async ({ page }) => {
    await openWorkbench(page);
    await expect(page.getByTestId("mod-ready")).toHaveText("Mod-ready", { timeout: 30_000 });
    await pickTemplate(page, "classic.reorder");
    await expect(page.getByTestId("mod-ready")).toContainText("Not mod-ready", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("mod-ready")).toContainText("the scenario has reviews");
  });

  test("run with their reference policy and inspect a review", async ({ page }) => {
    await openWorkbench(page);
    await pickTemplate(page, "classic.reorder");
    expect(await editorText(page, "policy-editor")).toContain("ops.min_max");
    await run(page);
    // Near the start of the run, where the first review ordered.
    await page.getByTestId("review-track").click({ position: { x: 0, y: 3 } });
    const inspector = page.getByTestId("review-inspector");
    await expect(inspector).toContainText("Shop");
    await expect(page.getByTestId("review-orders")).toContainText("Ordered");
    await expect(page.getByTestId("review-orders")).toContainText("arriving");
    await expect(page.getByTestId("review-traces")).toContainText("min_max");
    await expect(page.getByTestId("review-snapshot")).toContainText("Goods");
  });

  test("draw a loop as a network with its truck moving", async ({ page }) => {
    await openWorkbench(page);
    await pickTemplate(page, "classic.fixed_route_delivery");
    const map = page.getByTestId("line-map");
    await expect(map).toHaveAttribute("data-layout", "loop");
    await expect(map).toHaveAttribute("data-stations", "Depot Customer1 Customer2 Customer3");
    await run(page);
    await expect(map).toHaveAttribute("data-replaying", "true");
  });
});

test.describe("sharing and saving scripts", () => {
  test("a link keeps a scenario script, not only its document", async ({ page, browser }) => {
    await openWorkbench(page);
    await pickTemplate(page, "classic.serial_chain");
    await page.getByTestId("template-param-stages").fill("3");
    await page.getByTestId("share").click();
    const link = await page.getByTestId("share-link").inputValue();

    const other = await browser.newContext();
    const opened = await other.newPage();
    await openWorkbench(opened, link.replace(/^https?:\/\/[^/]+\//, "/"));
    await opened.getByTestId("tab-scenario").click();
    const script = await editorText(opened, "scenario-editor");
    expect(script).toContain("classic.serial_chain");
    expect(script).toContain("stages = 3");
    await expect(opened.getByTestId("scenario-picker")).toHaveValue("classic.serial_chain");
    await other.close();
  });

  test("a saved script opens as a script and evaluates the same way", async ({ page }) => {
    await openWorkbench(page);
    await page.getByTestId("tab-scenario").click();
    await setEditorText(
      page,
      "scenario-editor",
      "-- my chain\nreturn classic.serial_chain { stages = 2 }\n",
    );
    await expect(page.getByTestId("line-map")).toHaveAttribute("data-stations", "Stage1 Stage2");
    const saved = page.getByTestId("saved-scenario");
    await saved.locator("summary").click();
    await saved.getByTestId("save-name").fill("chain");
    await saved.getByTestId("save").click();
    await expect(saved.getByTestId("saved-item")).toHaveCount(1);

    await page.getByTestId("scenario-picker").selectOption("relay");
    await saved.getByTestId("saved-open").click();
    expect(await editorText(page, "scenario-editor")).toContain("-- my chain");
    await expect(page.getByTestId("line-map")).toHaveAttribute("data-stations", "Stage1 Stage2");
  });

  test("a link from the first release opens with its scenario upgraded to format 2", async ({
    page,
  }) => {
    const edited = { ...relay, title: "My relay" };
    const state = {
      apiVersion: 2,
      appVersion: "0.1.0",
      view: "run",
      policy: { name: "old.lua", source: "return { on_stop = function(ctx) end }\n" },
      scenario: { starterId: null, text: JSON.stringify(edited, null, 2) },
      seed: 3,
      saveReloadTest: false,
    };
    const hash = `#v1.${deflateRawSync(Buffer.from(JSON.stringify(state))).toString("base64url")}`;
    await openWorkbench(page, `/${hash}`);
    await expect(page.getByTestId("notice-share-loaded")).toBeVisible();
    await page.getByTestId("tab-scenario").click();
    const text = await editorText(page, "scenario-editor");
    expect(text).toContain('"format": 2');
    expect(text).toContain('"title": "My relay"');
    expect(await editorText(page, "policy-editor")).toContain("on_stop");
    await expect(page.getByTestId("run")).toBeEnabled();
  });
});
